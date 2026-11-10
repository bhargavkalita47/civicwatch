<div align="center">
  <img src="public/civicwatch-mark.svg" alt="CivicWatch C-and-eye logo" width="72" />
  <h1>CivicWatch</h1>
  <p><strong>Community infrastructure reporting and resolution tracking</strong></p>
  <p>A location-based platform for reporting neighbourhood infrastructure issues,<br />sharing evidence, discussing updates and tracking resolutions.</p>
  <p>
    <a href="https://civicwatch.bhargavkalita1327.workers.dev/">Open CivicWatch</a> ·
    <a href="DEPLOYMENT.md">Deployment</a> ·
    <a href="docs/BACKEND.md">Backend notes</a> ·
    <a href="CHANGELOG.md">Changelog</a>
  </p>
  <p>
    <a href="https://github.com/bhargavkalita47/civicwatch/actions/workflows/ci.yml"><img src="https://github.com/bhargavkalita47/civicwatch/actions/workflows/ci.yml/badge.svg?branch=main" alt="Verify CivicWatch Workers deployment" /></a>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.9" />
    <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  </p>
</div>

## Product overview

CivicWatch gives everyday infrastructure problems a place on the map: potholes, broken streetlights, waterlogging, garbage dumps, blocked drains, accessibility barriers, and more. Residents can mark an exact location, describe the issue, attach evidence, confirm an existing report, and discuss updates in a thread.

The interface pairs plain controls with a dry, satirical “neighbourhood doomer” voice. CivicWatch is an independent community project; reports are not automatically sent to municipal authorities.

Use the town watchlist to follow the places you care about and check report resolution status.

## Product capabilities

- Location-based infrastructure reporting with map pins, category filters and photo evidence.
- Town watchlists, platform totals, report discovery and resolution history.
- Threaded discussions, community confirmations and author-managed reports.
- Account profiles, role-based moderation and a shared Supabase-backed report database.
- Cloudflare Worker API, server-side pagination and access-controlled media.

**Stack:** React · TypeScript · Cloudflare Workers · Supabase Auth · PostgreSQL · Supabase Storage

## Project timeline

| Phase | What changed |
| --- | --- |
| October 2026 · Initial idea | Give residents a shared map for potholes, waterlogging and other local issues, with a report thread and photo evidence for each location. Early builds kept data in the browser. |
| 1–2 November · Frontend iteration | Added town watchlists, grouped filters, a two-step report flow, multiple photos, map navigation from reports and profile-based report management. |
| 3 November · [Backend pilot](https://github.com/bhargavkalita47/civicwatch/commit/c6f86bf5) | Merged the Cloudflare Worker and Supabase integration to `main`. Introduced shared accounts, report and discussion persistence, private media, moderation and server-side paging. |
| 3 November · Production and geocoding fixes | Restored live account access by [correcting production backend configuration](https://github.com/bhargavkalita47/civicwatch/commit/fd957f93). Simplified [reverse geocoding](https://github.com/bhargavkalita47/civicwatch/commit/bec47c47) to fall back to county when a provider omits city. |
| November · Discussion controls | Added [author-only comment editing, photo removal and reply-safe deletion](https://github.com/bhargavkalita47/civicwatch/commit/9a22b215). |

**Today:** Residents can browse, report and discuss infrastructure issues, follow activity in watched towns and track resolutions.

## Engineering challenges and solutions

- **Production login.** The backend merge exposed a deployment configuration gap. The Worker gained the public Supabase settings and production builds were made to [require the real API auth path](https://github.com/bhargavkalita47/civicwatch/commit/a9628561).
- **Incomplete map addresses.** Reverse geocoding sometimes returned a county without a city. The [normalizer falls back to county](https://github.com/bhargavkalita47/civicwatch/commit/bec47c47), and the form still accepts manual city and locality input.
- **Archive-sized requests.** [Database summaries and ten-record report pages](https://github.com/bhargavkalita47/civicwatch/commit/b24ff267) replaced full-archive reads for overview and browsing. Map and discussion views load their own data.
- **Mobile drafts and threaded replies.** Dismissing the photo picker preserves the report draft. [Discussion controls](https://github.com/bhargavkalita47/civicwatch/commit/9a22b215) scope editing and photo removal to the author and keep replies usable after a parent comment is deleted.

See the [changelog](CHANGELOG.md) for earlier frontend releases.

## Features

| Area | Current behaviour |
| --- | --- |
| **Overview** | Statistics-first platform totals with a resolution indicator and link to Explore; no duplicate map. |
| **Town watchlist** | Search for towns, add or remove them, reorder with drag or keyboard controls, and inspect selected-town activity and combined watchlist totals. |
| **Explore map** | Pan and zoom worldwide, find places, filter report text from one search field, use six category-group quick filters, and refine individual categories, statuses, and sort order. |
| **Reports** | Active and Resolved sections scoped to watched towns. Live mode loads ten records per server page, with filters, sorting, totals and Load more. |
| **My reports** | Active, Resolved and All report history with server-side paging in live mode. Signed-in creators can edit or remove their reports; public profiles have the same filters. |
| **Reporting** | Two-step location → details flow; choose a map pin, search for a place, or use device location. City, locality, description, and photos are optional. Category and title are required. |
| **Issue catalogue** | 70 issue types across Safety & access, Roads & travel, Water & drainage, Waste & environment, Public utilities, and Public spaces, with a searchable grouped category picker. |
| **Community threads** | Confirm an existing issue, read discussions and replies, attach photos, and open image previews. “View on map” opens Explore at the report's location and highlights its marker. |
| **Photo evidence** | Up to three JPG, PNG, or WebP images per report or comment, with a 15 MB input limit per image. Upload multiple files or capture a photo using the camera. |
| **Responsive interface** | Desktop sidebar, mobile navigation drawer, light/dark themes, frosted surfaces, clearer selected navigation, and a live date/time header. |

### Map and reporting details

- The basemap stays **light in both themes**, using Leaflet and configurable OpenStreetMap raster tiles.
- Category colours distinguish issue types. More confirmations strengthen marker colour; a count identifies nearby reports grouped together.
- Active issues are grouped within a 45-metre threshold. The form suggests an existing report of the same category within 75 metres.
- Resolved reports leave the active map and remain available in report history and discussions.
- Device location displays a separate location marker. Place names come from the configurable Photon-compatible geocoder and remain editable.
- The exact pin is sufficient to continue if place lookup fails. Search selections and manual city edits survive subsequent pin adjustments.
- Camera capture includes a preview and device-camera fallback. Uploaded and captured images share orientation correction, metadata removal, resizing, and compression before saving.
- Cancelling the file picker keeps the report form and entered values intact. Navigation and report-step changes reset scrolling to the top.

## Run locally

Use **Node.js 22** (see [.nvmrc](.nvmrc)) and npm.

```bash
git clone https://github.com/bhargavkalita47/civicwatch.git
cd civicwatch
npm ci
```

Copy `.env.example` to `.env.local` if you want to customise settings, then start the frontend:

```bash
npm run dev
```

New browser datasets are empty by default. To explore fictional example reports, set `VITE_SEED_DEMO=true` before starting the app. The seed applies when no saved dataset exists; it does not replace existing local reports.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend with the selected service adapter. |
| `npm test` | Run Vitest tests. |
| `npm run check` | Check TypeScript. |
| `npm run build` | Check TypeScript and build the frontend into `dist/`. |
| `npm run verify` | Run tests, production build, and configuration/design/copy/navigation/release checks. |
| `python scripts/check_schema.py` | Check the D1 migration schema with SQLite. |
| `npm run preview` | Preview the built frontend locally. |
| `npm run dev:worker` | Build and serve through the Cloudflare Worker runtime. |
| `npm run deploy:dry-run` | Check the Worker deployment bundle without publishing. |
| `npm run deploy` | Publish the Worker and static assets to Cloudflare. |

GitHub Actions runs `npm run verify` and the schema check on pushes to `main` and pull requests. See [verification guidance](docs/VERIFICATION.md) for the manual checks.

## Architecture

See the [backend audit](docs/BACKEND_SECURITY_AUDIT.md) for deployment scope and release work.

React components call the typed `CivicService` interface. The service entry point selects either the asynchronous local adapter or the HTTP adapter, keeping report data and storage behaviour outside page components.

| Path | Responsibility |
| --- | --- |
| `src/components/` | Maps, report forms, navigation-related UI, photo pickers, and discussion panels. |
| `src/domain/` | Types, validation, filters, geographic grouping, watchlist logic, and marker palette. |
| `src/data/` | Issue catalogue and optional fictional seed data. |
| `src/services/` | Local/API adapters, session handling, geocoding, and photo preparation. |
| `src/config.ts` | Build-time settings and upload limits. |
| `src/copy.ts` | Shared interface copy and count helpers. |
| `src/App.tsx` | Page composition, navigation, and application interaction state. |
| `worker/` | Worker entry, API routing, binding contracts, and repository/governance scaffolding. |
| `supabase/migrations/` | Versioned PostgreSQL schema, security, moderation and performance migrations for the live backend. |
| `scripts/` | Configuration, design, copy, navigation, release, and schema checks. |

The Cloudflare Worker on `main` connects to the CivicWatch Supabase project. It handles HttpOnly sessions, access to private media and server-side role checks. PostgreSQL stores reports and discussions.

### Live backend performance

- Report listings now use a validated, server-side paginated endpoint with exact counts and 10-record UI batches. My Reports always uses the authenticated server identity; public profiles are visible-records only.
- Overview and town discovery are computed by private PostgreSQL aggregation functions, not by downloading all reports into Worker memory.
- Initial Overview and report browsing avoid the full map archive; it loads only on a map, watchlist-activity or report-thread visit.
- SQL paging and aggregation functions are `SECURITY INVOKER` with `service_role`-only execution. Migrations were applied to the dedicated CivicWatch Supabase pilot project.
- The map archive is **still a scaling limit** until viewport-based map fetching and on-demand discussion hydration are introduced. This is a controlled backend pilot, not a high-traffic release claim.

See [Scaling architecture](docs/SCALING.md) and the [Backend security audit](docs/BACKEND_SECURITY_AUDIT.md) for current pilot limits.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SERVICE_MODE` | `mock` | Local adapter for development. The production build uses `api`. |
| `VITE_API_BASE_URL` | `/api/v1` | API adapter base URL. |
| `VITE_SEED_DEMO` | `false` | Opt in to fictional reports on an empty local dataset. |
| `VITE_DEFAULT_CITY` | `Guwahati` | Initial map label. |
| `VITE_DEFAULT_LAT` / `VITE_DEFAULT_LNG` | `26.1716` / `91.7606` | Initial map centre; reporting is not limited to this location. |
| `VITE_TILE_URL` | OpenStreetMap raster URL | Replaceable map tile provider. |
| `VITE_TILE_ATTRIBUTION` | OpenStreetMap credits | Attribution appropriate to the selected provider. |
| `VITE_TILE_MAX_ZOOM` | `19` | Maximum tile zoom. |
| `VITE_GEOCODER_BASE_URL` | `https://photon.komoot.io` | Photon-compatible place search and reverse lookup. |

All `VITE_` settings are public build-time values. Keep credentials in server-side runtime secrets. Local data is tied to a browser and origin; another deployment URL has separate storage. Clearing site storage removes that local data. Browser storage quotas can limit photo-heavy use.

Public OpenStreetMap tiles and the Photon demo have usage limits and no guaranteed availability. Choose suitable providers before substantial public traffic. See [geography and providers](docs/GEOGRAPHY.md).

## Deployment

The current target is **Cloudflare Workers with Static Assets**, configured in `wrangler.jsonc`.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Build output | `dist/`, read by Wrangler |
| Node.js | `22` |

The live pilot is at [civicwatch.bhargavkalita1327.workers.dev](https://civicwatch.bhargavkalita1327.workers.dev/). The checked-in Worker name is `civicwatch`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the original hosting setup and [wrangler.jsonc](wrangler.jsonc) for the current Worker configuration.

A `vercel.json` file is included for static frontend hosting. The API and Supabase runtime configuration are handled by the Cloudflare Worker.

## Design

CivicWatch pairs the C-and-eye mark and editorial headlines with pastel category markers and a light map in both interface themes. See the [design hierarchy](DESIGN_HIERARCHY.md) and [copy guide](docs/COPY_GUIDE.md).

## Contributing

Use focused pull requests against `main`. Run `npm run verify` and check the Cloudflare preview when changing frontend or backend behaviour.

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports should include reproduction steps, expected/actual behaviour, browser and device details, and screenshots where useful, without private information.
