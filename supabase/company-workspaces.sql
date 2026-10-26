-- Additive company workspaces. The original personal workspace is retained.
begin;
create schema if not exists tour_mapper_private;
revoke all on schema tour_mapper_private from public, anon;
grant usage on schema tour_mapper_private to authenticated;

create table public.tour_mapper_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create unique index tour_mapper_company_owner_name on public.tour_mapper_companies(owner_id, lower(name));
create table public.tour_mapper_company_data (
  workspace_id uuid primary key references public.tour_mapper_companies(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'version'='1' and jsonb_typeof(payload->'venues')='array' and jsonb_typeof(payload->'tours')='array'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table public.tour_mapper_company_access (
  workspace_id uuid not null references public.tour_mapper_companies(id) on delete cascade,
  email text not null check (email=lower(btrim(email)) and length(email) between 3 and 254 and position('@' in email)>1),
  access_role text not null check (access_role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  primary key(workspace_id,email)
);
create index tour_mapper_company_access_email on public.tour_mapper_company_access(email,workspace_id);
alter table public.tour_mapper_companies enable row level security;
alter table public.tour_mapper_company_data enable row level security;
alter table public.tour_mapper_company_access enable row level security;

-- Internal lookup avoids recursive RLS. Identity comes from the authenticated
-- user and their current verified email, never editable JWT user_metadata.
create function tour_mapper_private.company_role(company_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when c.owner_id=auth.uid() then 'owner' else
    (select a.access_role from public.tour_mapper_company_access a
     join auth.users u on u.id=auth.uid() and lower(u.email)=a.email
     where a.workspace_id=c.id and u.email_confirmed_at is not null
       and coalesce(u.is_anonymous,false)=false)
    end
  from public.tour_mapper_companies c where c.id=company_id and auth.uid() is not null
$$;
revoke all on function tour_mapper_private.company_role(uuid) from public,anon;
grant execute on function tour_mapper_private.company_role(uuid) to authenticated;

create policy company_read on public.tour_mapper_companies for select to authenticated
 using (tour_mapper_private.company_role(id) in ('owner','editor','viewer'));
create policy company_create on public.tour_mapper_companies for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy company_rename on public.tour_mapper_companies for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy company_data_read on public.tour_mapper_company_data for select to authenticated
 using (tour_mapper_private.company_role(workspace_id) in ('owner','editor','viewer'));
create policy company_data_create on public.tour_mapper_company_data for insert to authenticated
 with check (tour_mapper_private.company_role(workspace_id)='owner');
create policy company_data_edit on public.tour_mapper_company_data for update to authenticated
 using (tour_mapper_private.company_role(workspace_id) in ('owner','editor'))
 with check (tour_mapper_private.company_role(workspace_id) in ('owner','editor'));
create policy company_access_read on public.tour_mapper_company_access for select to authenticated
 using (tour_mapper_private.company_role(workspace_id)='owner');
create policy company_access_add on public.tour_mapper_company_access for insert to authenticated
 with check (tour_mapper_private.company_role(workspace_id)='owner');
create policy company_access_edit on public.tour_mapper_company_access for update to authenticated
 using (tour_mapper_private.company_role(workspace_id)='owner')
 with check (tour_mapper_private.company_role(workspace_id)='owner');
create policy company_access_revoke on public.tour_mapper_company_access for delete to authenticated
 using (tour_mapper_private.company_role(workspace_id)='owner');

revoke all on public.tour_mapper_companies,public.tour_mapper_company_data,public.tour_mapper_company_access from anon,authenticated;
grant select,insert on public.tour_mapper_companies to authenticated;
grant update(name) on public.tour_mapper_companies to authenticated;
grant select,insert on public.tour_mapper_company_data to authenticated;
grant update(payload,revision,updated_at) on public.tour_mapper_company_data to authenticated;
grant select,insert,update,delete on public.tour_mapper_company_access to authenticated;

create function public.list_tour_mapper_companies()
returns table(id uuid,name text,access_role text)
language sql stable security invoker set search_path='' as $$
 select c.id,c.name,tour_mapper_private.company_role(c.id)
 from public.tour_mapper_companies c order by c.name;
$$;
create function public.save_tour_mapper_company(company_id uuid,new_payload jsonb,expected_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare next_revision bigint;
begin
 if auth.uid() is null or coalesce(tour_mapper_private.company_role(company_id),'') not in ('owner','editor') then
   raise exception 'You do not have editing access to this workspace' using errcode='42501';
 end if;
 update public.tour_mapper_company_data set payload=new_payload,revision=revision+1,updated_at=now()
 where workspace_id=company_id and revision=expected_revision returning revision into next_revision;
 if next_revision is null then
   raise exception 'This workspace changed. Reload its latest cloud copy before saving.' using errcode='40001';
 end if;
 return next_revision;
end;
$$;
create function public.create_tour_mapper_company(company_name text,initial_payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 insert into public.tour_mapper_companies(owner_id,name) values(auth.uid(),btrim(company_name)) returning id into new_id;
 insert into public.tour_mapper_company_data(workspace_id,payload) values(new_id,initial_payload);
 return new_id;
end;
$$;
revoke all on function public.list_tour_mapper_companies(),public.save_tour_mapper_company(uuid,jsonb,bigint),public.create_tour_mapper_company(text,jsonb) from public,anon;
grant execute on function public.list_tour_mapper_companies(),public.save_tour_mapper_company(uuid,jsonb,bigint),public.create_tour_mapper_company(text,jsonb) to authenticated;
commit;
