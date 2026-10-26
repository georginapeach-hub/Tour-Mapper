-- Each signed-in user owns a private workspace. No anonymous database access.
create table public.tour_atlas_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.tour_atlas_workspaces enable row level security;
revoke all on public.tour_atlas_workspaces from anon;
revoke all on public.tour_atlas_workspaces from authenticated;
grant select, insert, update on public.tour_atlas_workspaces to authenticated;
create policy "Read own workspace" on public.tour_atlas_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own workspace" on public.tour_atlas_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.tour_atlas_workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Atomic revision check prevents a stale browser from overwriting newer work.
create function public.save_tour_atlas_workspace(new_payload jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = public as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if expected_revision is null then
    insert into public.tour_atlas_workspaces(user_id,payload)
      values (auth.uid(),new_payload) returning revision into next_revision;
  else
    update public.tour_atlas_workspaces set payload=new_payload,
      revision=revision+1, updated_at=now()
      where user_id=auth.uid() and revision=expected_revision
      returning revision into next_revision;
    if next_revision is null then
      raise exception 'Workspace changed on another device. Load the latest copy before saving.';
    end if;
  end if;
  return next_revision;
end;
$$;
revoke all on function public.save_tour_atlas_workspace(jsonb,bigint) from public, anon;
grant execute on function public.save_tour_atlas_workspace(jsonb,bigint) to authenticated;
