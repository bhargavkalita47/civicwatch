## v2.5.7 — Explore map search and category filters (31 October 2026)

Explore map now uses one search input. Typing filters report titles, addresses and descriptions; clicking **Find place** searches for a town or landmark and recentres the map. Selecting a place clears the report keyword so nearby reports are visible. The map's floating “Explore anywhere” caption is removed on Explore only. Quick filters now use six issue-category groups, with the full Filters panel still available for selecting individual disturbances. This does not change other screens, the always-light map, or the mobile drawer.

## v2.5.5 — CivicWatch C-and-eye logo (31 October 2026)

The supplied SVG replaces the old pin/check brand icon in the desktop sidebar, mobile topbar, and mobile drawer. The favicon now uses the same artwork. The silhouette is rendered in deep ink on the existing coral tile, preserving contrast in both light and dark themes. The original SVG is retained at `public/civicwatch-mark.svg`, and the reusable React vector lives at `src/components/CivicWatchLogo.tsx`. No reporting or navigation behaviour has changed.

## CivicWatch v2.5.4 — Town watchlist UI

Town watchlist now has two clear states. Before adding any town, it shows one guided place-search interface instead of redundant empty panels or zero-value statistics. Once a town is added, the watchlist, light map and smaller combined-total strip appear. A zero-report watchlist shows a single clear no-reports message instead of four zero tiles. Reordering continues to work through drag and keyboard controls when two or more towns are watched. See `src/watchlist-refinement.css` for the layout overrides.

# CivicWatch

An accessible, map-first platform for residents to document civic issues,
confirm reports at nearby locations and discuss updates. The interface has two responsive corporate-minimal themes: **Lavender + Coral (light)** and **Teal + Coral (dark)**. Instrument Serif headlines and Inter controls maintain a shared typography system. Categories have distinct
marker colours; participation changes marker intensity, and a small count
identifies locations containing multiple reports.

## v2.5 — Responsive mobile navigation (31 October 2026)

At viewport widths **790px and below**, a compact, sticky top header displays
CivicWatch, a direct **Report** action, and a hamburger button. The existing
navigation sidebar slides in from the **left** as a modal drawer; the previous
horizontal mobile navigation bar is removed. Desktop widths continue to use
the permanent left sidebar.

The drawer includes the existing navigation links, theme selector, help,
account actions, and conditional administrator entry. It closes on a link
selection, close button, backdrop click, or Escape. Keyboard focus remains
inside the open drawer and returns to the hamburger button on close. Background
scrolling is locked while the drawer is open. Reduced-motion preferences are
respected. Both light and dark themes keep their current design, and every map
remains on the light basemap.

Run `npm run validate:mobile-nav` to check the integration. This update does
not modify backend state, user reports, or reporting calculations.

## v2.4 — Public-facing copy refinement (31 October 2026)

The main interface now presents CivicWatch consistently as a civic reporting
platform rather than a product preview. Public-facing descriptions, footers,
help panels, and watchlist controls no longer refer to demo or preview modes.
Headlines, issue classifications, the light basemap in both themes, and all
reporting/watchlist functions are unchanged.

**Launch readiness:** This package does not activate a shared reporting
backend. The current default service adapter uses local browser storage, the
email form does not verify identity, and the Worker deliberately rejects
unimplemented shared reporting endpoints. These remain real limitations, even
though the marketing copy no longer foregrounds development mode. Do **not**
invite public submissions or claim that reports are published until verified
authentication, shared persistence, photo uploads, and the API are live and
tested across different devices. See [docs/BACKEND.md](docs/BACKEND.md) and
[DEPLOYMENT.md](DEPLOYMENT.md).

For a public launch with real data, turn off fictional seed content using
`VITE_SEED_DEMO=false`, then enable `VITE_SERVICE_MODE=api` **only after** the
backend has been implemented and verified. Changing either variable alone
will not make reports public.

## v2.3 — Neighbourhood-doomer copy system (31 October 2026)

- The five resident-facing pages use one editorial headline and one supporting sentence each, with dry civic satire aimed at neglected infrastructure rather than residents.
- Navigation is direct: **Overview, Town watchlist, Explore map, Reports, My reports**.
- Reports uses **Open / Resolved** headings and straightforward counts; it remains filtered by the user's town watchlist.
- Reporting, discussion, notifications, empty states, map search and help/About text now use clearer and shorter wording.
- `src/copy.ts` contains the centralized, feature-grouped copy catalogue and singular/plural helpers. `scripts/validate-copy.mjs` checks the important copy, truthfulness and UX invariants.
- Reporting feedback distinguishes **locally saved** from **published** according to the active service. Resident-submitted report titles, descriptions, comments and evidence are never modified.
- **No backend activation or data schema changes**. The OpenStreetMap basemap remains **light in both interface themes**. Existing watchlist drag-and-drop, platform Overview totals, watched-town totals and historical discussions remain intact.
- See [docs/COPY_GUIDE.md](docs/COPY_GUIDE.md) for editorial and developer guidance.

## v2.1 — Reports: Active / Inactive, scoped to your town watchlist

- **Community** and **History** have been replaced by one **Reports** navigation item. The new page has a prominent **Total reports** count followed by equal-priority **Active** and **Inactive** subsections, with a count for each. Its total counts all reports from saved towns, regardless of search/category filters.
- **Active** lists `reported`, `acknowledged` and `in_progress` reports. **Inactive** lists **resolved** reports, retaining their discussions, evidence and update history; nothing is discarded.
- The Reports page only includes issues whose **reporting-town ID is in your Local Snapshot watchlist**. It excludes every other town, even if it is near the selected map view. A blank watchlist shows an explicit link to add towns.
- The saved watchlist is now shared live between Local Snapshot and Reports: adding, removing or reordering towns updates the other page without a reload. Existing browser watchlists are restored using the original storage key (`civicwatch.local-watchlist.v1`); cross-tab storage updates are supported.
- Search, category, and sorting work within the chosen subsection. Status filtering is offered for Active only; Inactive always means resolved. Switching subsections clears a restrictive status filter.
- Deep links to resolved reports and opening historical discussion panels still work. Explore map and My Reports stay separate and otherwise unchanged. Overview metrics remain platform-wide; Local Snapshot combined metrics remain watchlist-wide.
- The Reports visual hierarchy is intentionally total count → Active/Inactive subsections → search/sort → report cards. Typography stays regular Instrument Serif for editorial headings and Inter for metrics and controls; the low-opacity light/dark gradients remain in place.
- `src/domain/watchlist.ts` now owns the shared persistence key, watchlist restoration, canonical report grouping and watchlist totals; new tests cover status partitions, duplicate town IDs, invalid persisted entries and empty watchlists.

## v2.0 — Consistent visual hierarchy (carried forward)

- **Regular Instrument Serif (400)** for all major headings, page hero and hero supporting text; Inter for UI labels, report list titles, body copy and bold numerical data. Synthetic serif bold is disabled, and low-opacity light/dark gradients add depth without stealing attention from the map.
- Unified six-level typography/spacing scale across Overview, Local Snapshot, Explore, Reports, My Reports, reporting and sign-in dialogs, discussion threads, administration and empty states.
- Overview map remains the primary visual, with equal-weight summary metric cards below it; the single oversized coral metric highlight is removed.
- More readable small labels and inputs, consistent CTA sizes, responsive layouts and `aria-current` on active navigation.
- **[DESIGN_HIERARCHY.md](DESIGN_HIERARCHY.md)** documents the three directions considered, the selected system and the page-by-page priority rules. The final stylesheet is `src/hierarchy.css`, imported after themes to eliminate conflicting legacy overrides.
- Only UI/design files and validation rules changed; neither platform data nor backend scaffolding was modified.

## v1.7 — Parody copy, map-first Overview and town watchlists

- App-wide writing adopts a dry, sarcastic and pessimistic civic-satire voice. Practical navigation, reports, safety disclosures and moderation controls remain understandable and factual.
- Overview is now a **full-width, interactive active-issues map** with total/open/resolved/participants metrics **at the bottom**, not above the map.
- **Local Snapshot** is now its own navigation destination, with a user-managed list of towns: add from the location search or existing reporting areas, remove, reorder and switch between locations.
- Local Snapshot selection shows per-town total, open, resolved and participation counts, resolution share, mini map, recent issues and a button to open the town on the full map.
- Watchlist and selected town are stored in browser localStorage separately from the report dataset; towns with no reports correctly show zero counts. Search depends on the existing configurable Photon place-lookup provider.
- No backend, database, authentication or worker configuration changes were made.

## v1.6 visual system and functionality

- Lavender/Coral light theme and Deep Teal/Coral dark theme, with a saved preference and accessible controls.
- Instrument Serif display typography, bold Inter UI text; responsive desktop sidebar and mobile navigation.
- The Overview uses real service-backed statistics and an interactive active-only map; in v1.7 the location directory moved out of Overview to a separate local watchlist.
- Report issues anywhere, discuss and confirm reports, archive resolved issues, and permit only their creators to delete them.
- A real authorization provider and shared database are **not enabled** in the current implementation. The Worker API boundary, D1 migrations and admin role schema are kept for subsequent backend activation.

## New: Cloudflare Workers deployment

**This repository is configured for Cloudflare Workers, not Pages.** A single
Worker deploys the built Vite frontend as Cloudflare Static Assets and owns all
`/api/*` paths. There is no `pages_build_output_dir`, Pages `functions/` folder,
or Pages `_routes.json` routing manifest. The checked-in configuration is
`wrangler.jsonc`, with `main: ./worker/index.ts`, `assets.directory: ./dist`
and `run_worker_first` for API paths.

**Connect a GitHub repository to a Cloudflare Worker**, then set:

| Cloudflare build setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Root directory | `/` |
| Node | 22+ |

The default Worker name is `civicwatch-community` to avoid unintentionally overwriting an existing `civicwatch` Worker. If you choose a different Worker name, set the
`name` in `wrangler.jsonc` to the exact same value before deployment.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for step-by-step setup and verification.
The source uses pinned Wrangler CLI 4.156.0 through its npm deployment scripts
so the build command and deployment mechanism remain in version-controlled
source, rather than depending on a manually entered `--assets` workaround.

## Run and verify locally

```bash
npm ci
npm run dev
npm run verify
npm run dev:worker
```

`npm run verify` runs automated tests, TypeScript checks, production Vite build
and Cloudflare configuration assertions. GitHub Actions runs the same checks
plus the D1 schema test for each commit and pull request.

## Data storage and public backend readiness

This ZIP is **deployable as a working frontend with a server-side API boundary**.
It is not yet a multi-user production civic reporting service. The current
`VITE_SERVICE_MODE=mock` uses asynchronous, browser-local persistence and a
mock seven-day identity session. Preview reports and photos are not shared
across devices; demo issues and names are fictional. Do not enter sensitive
personal data. The mock sign-in does not verify email addresses.

The real Worker provides `/api/v1/health`, `/api/v1/categories` and `/api/v1/cities` as JSON.
Operations that require authentication or shared storage fail closed with 401
or 501 (not fake success). Typed Cloudflare DB/R2 binding contracts and
versioned D1 migrations are included, along with an API adapter that uses
secure same-origin credentials. Server-side verified authentication, shared
D1 repositories, R2 upload handling, moderation and load/pagination work
remain **explicit activation requirements**. See [docs/BACKEND.md](docs/BACKEND.md)
and [docs/API.md](docs/API.md). Never set `VITE_SERVICE_MODE=api` before those
endpoints are implemented and tested. No security boundary relies on client
mock identities or roles.

## New in v1.2 — Visual system, geographic insights and author controls

- A redesigned charcoal/white interface influenced by the supplied professional
  dashboards: restrained editorial typography, modular cards, clearer hierarchy,
  focused map workspace and accessible mobile layout. No forest/ivory theme.
- The old metrics strip is **removed from Explore**. A separate **Overview** tab
  presents exactly one platform-wide summary and an independent breakdown for
  each city/town.
- In v1.2 a city selector switched the map center; **v1.4 replaces that restriction** with unrestricted map navigation and worldwide place search.
  Areas are served asynchronously through `CivicService.getCities()` and added when reported.
  Four illustrative locations are seeded: Guwahati, Shillong, Jorhat and Silchar;
  these are **fictional preview reports**, not genuine municipal statistics.
- `CivicService.getOverviewStats()` returns an explicit typed aggregate snapshot.
  This is independent of the map dataset, so a future backend can calculate
  accurate platform totals without shipping every report to the client.
- Report creator can delete their own issue through a confirmation control.
  The mock service checks the current session's author ID and removes linked
  discussion data. Other residents see no delete action and receive a
  `FORBIDDEN` error if they call the service directly.
- Added D1 city catalogue/migration, foreign-key cascade for issue status
  history, and an author-scoped parameterized delete repository method.
  **Live deletion stays disabled** until verified server authentication and
  database/R2 cleanup are implemented.

## Currently usable features

- Pan/zoom/recenter Leaflet map using keyless OpenStreetMap standard tiles and visible attribution.
- 70 categories for roads, drainage, lighting, waste, infrastructure, safety,
  parks, accessibility, utilities and more, with individual marker colours.
- Darker pins for more unique confirmations, count badge for multiple issues at
  a place; click to explore issue threads and participant counts.
- Report creation with map point selection, explicit confirmation and details.
- Existing-report suggestion near an issue of the same type.
- Confirmations, threaded discussion, attached photos, image preview/lightbox.
- Search, filters, report ordering, community list and My Reports.
- Browser-local preview persistence, accessible feedback/loading/error states,
  keyboard-focus styling and responsive layouts.

The new preview has 22 sample reports across four cities. Older browser-local datasets are preserved and geotagged on read if possible.

The preview uses a 45-metre co-location threshold and a 75-metre duplicate
suggestion threshold. These are geographic grouping rules, not a moderation or
severity assessment. Counts in the mock dataset are simulated; they must not
be represented as verified public participation.

## Architecture

```text
src/domain/           Typed models, validators, map grouping and filters
src/data/             Category catalogue and demo fixtures (not in UI)
src/services/         Shared asynchronous mock and live HTTP adapters
src/components/       Map, forms, accessible dialogs and threads
src/App.tsx           UI composition and interaction state
src/redesign.css      Previous compatibility style layer
src/studio.css        New editorial UI design language
src/components/Overview.tsx  City directory and platform totals
src/data/cities.ts    Preview city catalogue (service-owned)
worker/index.ts       Cloudflare Worker entry + asset fallback
worker/api.ts         Same-origin API routes and safe activation boundary
worker/bindings.ts    Typed optional D1/R2 and ASSETS contracts
backend/migrations/   Cloudflare D1 schema (not yet provisioned)
docs/                 API, backend activation and verification notes
scripts/              Deploy configuration and schema assertions
```

`src/services/index.ts` is the only place selecting mock/API modes. UI code
does not access storage directly and carries no hardcoded demonstration reports.
The included `package-lock.json` supports reproducible `npm ci` installs.

## Configuration

Copy `.env.example` to `.env.local` for local UI configuration. All `VITE_`
variables are **public** at build time; never put tokens, database secrets or
private keys there. Cloudflare runtime secrets belong in Workers secrets.

- `VITE_SERVICE_MODE=mock` (default) or `api` **after backend activation**.
- `VITE_API_BASE_URL=/api/v1` uses same-origin Worker routes.
- `VITE_SEED_DEMO=true` seeds demo data on an empty local browser dataset.
- `VITE_DEFAULT_CITY` / `VITE_DEFAULT_LAT` / `VITE_DEFAULT_LNG` set map start.
- `VITE_TILE_URL` configures the raster tile URL (default: OpenStreetMap).
- `VITE_TILE_ATTRIBUTION` overrides tile credits when changing tile provider.
- `VITE_TILE_MAX_ZOOM` controls the provider's highest tile zoom level.

### Basemap hosting and responsible usage

The bundled map uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
This **does not require an API key**. It uses the existing Leaflet renderer,
so the issue pins, location picker, threads and backend adapters are unchanged.
Visible OpenStreetMap attribution and a browser referrer policy are preserved.
The public OSM tile servers are donation-funded, offer **no SLA**, and enforce
[usage limits](https://operations.osmfoundation.org/policies/tiles/).
Do not bulk-download tiles, bypass their caching headers, or run a growing
high-traffic service on the public endpoint. For a large launch, use your own
OSM-derived tiles, or a hosted tile provider appropriate to your traffic and
license. Switching a raster provider is a configuration change; vector-only
providers such as OpenFreeMap require a MapLibre rendering integration.

CivicWatch is an independent community tool, not a government-operated service.
Reports are not automatically forwarded to municipal authorities. Review
basemap provider usage limits and licensing before a large public launch.

## Current release (v1.3)
Resolved issues disappear from map markers but remain in Reports → Inactive (when watchlisted) and in My Reports with their discussions, and in platform/city resolved statistics. Owner-admin governance SQL and Worker helpers are included, but **live roles and admin granting are not activated** without verified server authentication. See `docs/GOVERNANCE.md`.

**Do not create a new repository for every update.** Keep using the same GitHub repo connected to a Cloudflare Worker, commit changes to branches, merge through pull requests, and let the Cloudflare Git integration redeploy `main`. The source archive is only a means to bootstrap/update the repository once.

## v1.4 — Report anywhere on the map

- The four original cities are **sample data**, not an allowed-location list.
- Search for places anywhere (user-submitted Photon searches), pan the map,
  or use device location. Issue pins and the report list follow the map viewport.
- Report at any exact coordinate; location names are suggested if available and
  always editable manually. No fixed-city radius restrictions.
- New towns, villages and other localities are registered through the typed
  service when the first report is created, and become visible in Overview.
- The historical archive, owner-only deletion, admin governance scaffold and
  Cloudflare Workers deployment setup are preserved.
- `VITE_GEOCODER_BASE_URL` configures an interchangeable Photon-compatible
  place lookup provider. Public Photon is a limited pilot/demo service, not a
  guaranteed production geocoder. See `docs/GEOGRAPHY.md`.

**Live API note:** User accounts, global cross-device totals, and shared D1
issue writes are not yet activated. The preview is still browser-local.


## Latest UI update

Version 1.5 removes the large overview banner and introduces a more restrained corporate-minimal design language with Instrument Serif and Inter.

## v1.6 Visual system

The app ships with two cohesive themes: **Lavender + Coral (Light)** and **Deep Teal + Coral (Dark)**. The theme selector lives in the main navigation and persists only a visual preference in `localStorage` (`civicwatch.theme.v1`). Layouts are responsive; typography is Instrument Serif for editorial headings and Inter for controls/data. Styles are centralized in `src/themes.css`, loaded after legacy CSS. The map always uses the same light OpenStreetMap raster tiles, even when the app is in dark mode. Map controls also remain light; category markers are not recolored.

Overview statistics, ranked localities and the active map are data-driven. Resolved reports are intentionally excluded from both maps and retained in Reports → Inactive for watched towns. The app still defaults to mock local-browser data until verified authentication and D1-backed APIs are enabled.

### v2.0 design revision

Instrument Serif editorial headlines and hero text use regular weight 400, not synthetic bold. Low-opacity accent gradients add depth to page backgrounds, navigation, map/section headers, select states, statistics, and the report CTA. The existing two themes and map-first hierarchy remain intact. See `DESIGN_HIERARCHY.md`.

### v2.0 — Watchlist statistics and reordering

The **Overview** map remains the primary view, and its statistics are platform-wide, regardless of each visitor's personal list. The **Local Snapshot** page has the “Numbers that speak for themselves.” block at the top, aggregating all saved towns (including unique contributors counted only once); below that is a drag-to-reorder watchlist and the map/detail for one selected town. Reorder by dragging a grip with mouse or touch, or by using the grip's arrow keys / up-down controls. Saved order stays in local browser storage.

### CivicWatch map marker colours (v2.5.2)

Map markers use `src/domain/markerPalette.ts` as a display-only palette of seventy distinct, accessible-hued category colours. The same function is applied to the map legend, filter chips, issue badges and detail-panel category accents. Adding an API-defined category automatically falls back to its own valid hexadecimal colour. Confirmation counts still darken the marker without changing its underlying issue type. To adjust category colours, edit only the central palette; no database migration or map-tile provider change is needed.
