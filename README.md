# Tour Mapper

A one-page UK venue and theatre tour planner. Browse venues, import CSVs, plan dated tours, route journeys, maintain tour-specific suggested venues and booking statuses, and export full venue or tour CSVs.

## Source

The application is in `dist/`:

- `index.html` — page layout
- `style.css` — neutral theme with blue controls and responsive layout
- `app.js` — Leaflet map, venue library, contact editor, dates and road routes
- `venue-information.js` — contacts, performance spaces, hire information and editable notes
- `tour-suggestions.js` — separate shortlists, imports and status colours for each tour
- `exports.js` — complete venue and tour CSV downloads
- `cloud.js` — Supabase authentication, browser caching, cloud loading and revision checks
- `company-workspaces.js` — separate company workspaces and view/edit permissions
- `cloud-config.js` — public project URL and publishable key, never a server secret

## Local preview

Run `python3 -m http.server 4173 --directory dist` from this folder, then visit http://localhost:4173. No build or package installation is required. Mapping and cloud features need internet access. Email-confirmation redirects for another deployment must be configured in Supabase.

## Company workspaces

Turnpike Productions and Wicked Pig are separate saved workspaces. Their venue libraries were initially copied from the existing cloud library. Each company's future edits, notes, tours, suggestions, status colours and access list are independent. The original personal workspace is retained.

Use the **Workspace** menu to switch jobs, **Save to cloud** to save shared edits, and **People & sharing** to add a verified sign-in email as **View only** or **Can edit**. The owner manages access. The form does not send invitation emails; send the workspace link yourself.

The existing hosted site is private at the hosting layer too. A person needs both hosted-site access and the selected company's permission. Adding them to a company alone does not bypass the hosting sign-in screen. Give hosting access through Sites sharing controls or ask Codex to configure it for named people. Do not make the site public just to work around this step.

Company URLs use `?workspace=<company UUID>`. A URL is a locator, not an access token: Supabase checks authenticated membership for every read/write. A viewer can browse and export but cannot save changes. An editor can edit and save only their permitted workspaces. Company caches are separated by workspace and account, and access is verified before displaying a cache. Sign-out clears a company's in-memory view.

Each account also retains its private personal workspace. Saved cloud information loads on startup while signed in. Browser changes are kept locally until explicitly saved to cloud. Optimistic revision checks reject outdated writes; conflicting browser changes are retained for review instead of silently overwriting the cloud.

## Database

The configured Supabase project is `vryaafuqxuifkikfpmek`. Database setup is already applied there; do not rerun the initial scripts on that project.

- `supabase/migrations/202610260001_workspace.sql` — original personal JSON workspaces
- `supabase/company-workspaces.sql` — additive company metadata, data, email access lists and RPCs

For a fresh project, apply these in order and configure Auth. Use public/publishable credentials only in browser code. Company data, membership and personal tables all have row-level security. The internal membership lookup uses the current verified identity, not editable user metadata. Only owners manage access; only owners and editors save company data. Anonymous access is denied. No private venue dataset or passwords are stored in this repository.

Database access rules were tested in an isolated Postgres-compatible runtime for owners, viewers, editors, outsiders, anonymous requests, revocation, stale writes and cross-workspace isolation. Browser logic tests cover separate caches and initial loading. The production database was checked read-only for the owner's memberships. A synthetic-user test on production was rejected by automatic approval review, so no production test users were created.

## GitHub and hosting

GitHub stores and versions this code. Supabase supplies the database and sign-in. GitHub Pages alone does not provide a database backend. The existing deployment remains at https://tour-atlas-uk.vocalrhino16.chatgpt.site/ and is published through Sites; pushing this GitHub repository does not automatically redeploy it. Sites-specific repository identity and publishing credentials are not included here.

## Mapping services

Map tiles: OpenStreetMap. Leaflet 1.9.4 and supabase-js 2.95.3 are pinned CDN dependencies. Driving routes use the public OSRM demonstration service, without live traffic or an availability guarantee; dashed lines indicate a road route was unavailable. UK postcode lookup gives approximate positions; verify venue entrances before travel. Optional Mapbox lookup uses a public, URL-restricted token stored only in the browser.
