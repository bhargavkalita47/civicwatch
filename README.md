<div align="center">
  <img src="public/civicwatch-mark.svg" alt="CivicWatch C-and-eye logo" width="72" />
  <h1>CivicWatch</h1>
  <p><strong>Infrastructure ages. The complaints stay fresh.</strong></p>
  <p>A map-first civic reporting app for documenting neighbourhood problems,<br />sharing photo evidence, and following the conversation around them.</p>
  <p>
    <a href="https://civicwatch.bhargavkalita1327.workers.dev/">Live frontend</a> ·
    <a href="DEPLOYMENT.md">Deployment</a> ·
    <a href="docs/BACKEND.md">Backend roadmap</a> ·
    <a href="CHANGELOG.md">Changelog</a>
  </p>
  <p>
    <a href="https://github.com/bhargavkalita47/civicwatch/actions/workflows/ci.yml"><img src="https://github.com/bhargavkalita47/civicwatch/actions/workflows/ci.yml/badge.svg?branch=main" alt="Verify CivicWatch Workers deployment" /></a>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.9" />
    <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  </p>
</div>

## What it does

CivicWatch gives everyday infrastructure problems a place on the map: potholes, broken streetlights, waterlogging, garbage dumps, blocked drains, accessibility barriers, and more. Residents can mark an exact location, describe the issue, attach evidence, confirm an existing report, and discuss updates in a thread.

The interface pairs plain controls with a dry, satirical “neighbourhood doomer” voice. CivicWatch is an independent community project; reports are not automatically sent to municipal authorities.

> **Current stage: backend private pilot on `dev/backend`, public `main` remains frontend-only.** The production URL still runs the existing browser-backed frontend. Cloudflare preview branches use Supabase Auth, PostgreSQL and private Storage for shared accounts, reports, discussion and uploads. Live backend administration is available on the preview. Password recovery and social sign-in are deliberately deferred. The public release is **not security-approved**; see [Backend security audit](docs/BACKEND_SECURITY_AUDIT.md) for verified fixes and remaining launch work.

## Features

| Area | Current behaviour |
| --- | --- |
| **Overview** | Interactive map of active issues and platform-wide totals from the active service. In local mode, totals describe that browser's dataset. |
| **Town watchlist** | Search for towns, add or remove them, reorder with drag or keyboard controls, and inspect selected-town activity and combined watchlist totals. |
| **Explore map** | Pan and zoom worldwide, find places, filter report text from one search field, use six category-group quick filters, and refine individual categories, statuses, and sort order. |
| **Reports** | Open and Resolved sections scoped to saved towns, with counts, search, filters, and ordering. |
| **My reports** | Review reports created by the current local account. Creators can delete their reports or mark them resolved. |
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
| `backend/migrations/` | Versioned D1 SQL migrations. |
| `scripts/` | Configuration, design, copy, navigation, release, and schema checks. |

The current Worker implements `GET /api/v1/health`, `GET /api/v1/categories`, and `GET /api/v1/cities`. Session lookup returns 401 until authentication is connected. Shared report reads, writes, and uploads deliberately return 501 until implemented. A healthy static deployment does not activate those operations.

### Backend integration roadmap

1. Add verified authentication and server-managed sessions.
2. Implement shared D1 repositories and enforce permissions on the server.
3. Add validated R2 uploads and reliable media cleanup.
4. Add moderation, rate limits, pagination, and geographic queries.
5. Verify report visibility and permissions across independent devices, then enable the API adapter.

[Backend activation](docs/BACKEND.md), [API contract](docs/API.md), and [governance](docs/GOVERNANCE.md) describe the planned boundary. Client preview identities and roles are not production authorization.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SERVICE_MODE` | `mock` | Local adapter; use `api` only after implementing and verifying the backend. |
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

The live frontend is at [civicwatch.bhargavkalita1327.workers.dev](https://civicwatch.bhargavkalita1327.workers.dev/). The checked-in Worker name is `civicwatch-community`; check the intended Worker target before a standalone CLI deploy. See [DEPLOYMENT.md](DEPLOYMENT.md) for setup, preview builds, and verification.

A `vercel.json` file is included for static frontend hosting. The Cloudflare Worker API and D1/R2 bindings do not move with that frontend configuration.

## Design and project history

CivicWatch uses the C-and-eye mark, Instrument Serif for selected editorial highlights, and Inter for interface text. Lavender/coral light and deep teal/coral dark themes share pastel report markers and an always-light map.

The latest merged work includes photo and camera support, location and form improvements, “View on map,” responsive spacing and card fixes, stronger glass effects, navigation gradients, scroll resets, and the date/time header. Details live in [CHANGELOG.md](CHANGELOG.md); earlier design decisions remain in [DESIGN_HIERARCHY.md](DESIGN_HIERARCHY.md) and the [copy guide](docs/COPY_GUIDE.md).

## Contributing

Use the existing repository: create a focused branch from `main`, open a pull request, run the checks, review the preview, and merge when ready. Backend work can use `dev/backend-integration` when that phase begins.

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports should include reproduction steps, expected/actual behaviour, browser and device details, and screenshots where useful, without private information.
