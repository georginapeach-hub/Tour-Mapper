# Tour Mapper

A one-page UK venue and theatre tour planner. Browse venues, import CSVs, plan dated tours, route journeys, maintain tour-specific suggested venues and booking statuses, and export full venue or tour CSVs.

## Source

The editable application is in `src/`:

- `index.html` — page layout
- `style.css` — neutral theme with blue controls and responsive layout
- `app.js` — Leaflet map, venue library, contact editor, dates and road routes
- `venue-information.js` — contacts, performance spaces, hire information and editable notes
- `tour-suggestions.js` — separate shortlists, imports and status colours for each tour
- `exports.js` — complete venue and tour CSV downloads
- `cloud.js` — Supabase authentication, browser caching, cloud loading and revision checks
- `company-workspaces.js` — separate company workspaces and view/edit permissions
- `cloud-config.js` — public project URL and publishable key, never a server secret

## Development

Use Node.js 24 (`nvm use` if you use nvm), then:

```sh
npm ci
npm run dev
```

Open http://localhost:4173 and refresh after editing `src/`. No framework or build dependency is needed for this browser application. Mapping and cloud features need internet access.

```sh
npm run check    # JavaScript syntax and local asset references
npm run build    # Validate and generate dist/ from src/
npm run preview  # Serve the generated site at http://localhost:4173
```

Stop the dev server before running preview on the same port, or use `npm run preview -- --port 4174`.

`src/` is the source of truth; `scripts/` contains the Node build and preview tools. `dist/` and `node_modules/` are ignored generated folders. Database scripts remain in `supabase/`. Browser scripts deliberately retain their existing order and shared global scope.

## Company workspaces

Turnpike Productions and Wicked Pig are separate saved workspaces. Their venue libraries were initially copied from the existing cloud library. Each company's future edits, notes, tours, suggestions, status colours and access list are independent. The original personal workspace is retained.

Use the **Workspace** menu to switch jobs, **Save to cloud** to save shared edits, and **People & sharing** to add a verified sign-in email as **View only** or **Can edit**. The owner manages access. The form does not send invitation emails; send the workspace link yourself.

The GitHub Pages interface is public, while saved company data requires Supabase sign-in and workspace membership. The original Sites deployment additionally requires hosted-site access. Company permissions apply on both deployments.

Company URLs use `?workspace=<company UUID>`. A URL is a locator, not an access token: Supabase checks authenticated membership for every read/write. A viewer can browse and export but cannot save changes. An editor can edit and save only their permitted workspaces. Company caches are separated by workspace and account, and access is verified before displaying a cache. Sign-out clears a company's in-memory view.

Each account also retains its private personal workspace. Saved cloud information loads on startup while signed in. Browser changes are kept locally until explicitly saved to cloud. Optimistic revision checks reject outdated writes; conflicting browser changes are retained for review instead of silently overwriting the cloud.

## Database

The configured Supabase project is `vryaafuqxuifkikfpmek`. Database setup is already applied there; do not rerun the initial scripts on that project.

- `supabase/migrations/202610260001_workspace.sql` — original personal JSON workspaces
- `supabase/company-workspaces.sql` — additive company metadata, data, email access lists and RPCs

For a fresh project, apply these in order and configure Auth. Use public/publishable credentials only in browser code. Company data, membership and personal tables all have row-level security. The internal membership lookup uses the current verified identity, not editable user metadata. Only owners manage access; only owners and editors save company data. Anonymous access is denied. No private venue dataset or passwords are stored in this repository.

Database access rules were tested in an isolated Postgres-compatible runtime for owners, viewers, editors, outsiders, anonymous requests, revocation, stale writes and cross-workspace isolation. Browser logic tests cover separate caches and initial loading. The production database was checked read-only for the owner's memberships. A synthetic-user test on production was rejected by automatic approval review, so no production test users were created.

## GitHub and hosting

The GitHub Pages site is https://georginapeach-hub.github.io/Tour-Mapper/ . The `.github/workflows/pages.yml` workflow runs `npm ci` and `npm run build`, then publishes generated `dist/` when source, build scripts or npm configuration change on `main`; it can also be run manually. Edit `src/` for website updates and commit the source, never generated `dist/`. Pages Settings uses GitHub Actions as the source.

Supabase continues to supply the existing database, sign-in and workspace permissions. Allow `https://georginapeach-hub.github.io/Tour-Mapper/` in Supabase Auth redirect URLs for email confirmation links from this deployment. Browser storage and login sessions are separate for each site address: save any local changes to cloud on the old site, then sign in on the new site.

The original deployment remains at https://tour-atlas-uk.vocalrhino16.chatgpt.site/ and is published separately through Sites; GitHub pushes do not redeploy that address. Sites-specific repository identity and publishing credentials are not included here.

## Mapping services

Map tiles: OpenStreetMap. Leaflet 1.9.4 and supabase-js 2.95.3 are pinned CDN dependencies. Driving routes use the public OSRM demonstration service, without live traffic or an availability guarantee; dashed lines indicate a road route was unavailable. UK postcode lookup gives approximate positions; verify venue entrances before travel. Optional Mapbox lookup uses a public, URL-restricted token stored only in the browser.
