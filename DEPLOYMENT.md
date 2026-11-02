# Deploy CivicWatch

CivicWatch currently runs on **Cloudflare Workers with Static Assets**. The Vite build serves the frontend; the Worker owns `/api` and `/api/*` before static asset routing.

Live frontend: https://civicwatch.bhargavkalita1327.workers.dev/

> The default adapter stores reports, photos, and preview accounts in the browser. Deployment does not activate shared reporting. Implement and verify authentication, persistent APIs, and hosted uploads before enabling `VITE_SERVICE_MODE=api`. See [backend activation](docs/BACKEND.md).

## Existing GitHub deployment

Continue using [bhargavkalita47/civicwatch](https://github.com/bhargavkalita47/civicwatch). Updates are commits to this repository; a new repository or Worker is not required for each change.

| Build setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root (`/`) |
| Node.js | `22` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Static asset output | `dist/`, configured in `wrangler.jsonc` |

Keep existing account bindings and build settings unless a change requires them. Check the Cloudflare build result after merging a pull request.

### Worker name

The checked-in `wrangler.jsonc` uses `name: "civicwatch-community"`. The current live URL belongs to the `civicwatch` Worker. A Git-connected build may supply its configured Worker target; a standalone CLI deploy must explicitly target the intended Worker.

Before publishing from a local machine or creating another Git integration, check the destination name and align the source or deployment configuration. A plain CLI deployment using the checked-in name can create or update `civicwatch-community` rather than the existing live Worker.

### Preview builds

`wrangler.jsonc` includes `"previews": {}` for the preview configuration. Keep production on `main`; use a feature branch and the connected Worker's preview build to review changes before merging. Preview availability and its URL are shown by the Cloudflare build integration.

The checked-in scripts pin Wrangler to `4.156.0`. Use `npm run deploy` for Worker deployment. Pages deployment commands do not match this repository's Worker entry and API routing.

## Set up another environment

1. Use the existing GitHub repository and decide which Worker/environment the deployment should target.
2. In Cloudflare Workers & Pages, create a Worker using the GitHub integration.
3. Choose the repository and desired production branch, then apply the build settings above.
4. Confirm the Worker name and source configuration before the first deploy.
5. Set any required frontend build variables and deploy.

The Worker configuration contains:

- `main: "./worker/index.ts"`
- `assets.directory: "./dist"`
- `assets.binding: "ASSETS"`
- `assets.not_found_handling: "single-page-application"`
- `assets.run_worker_first: ["/api", "/api/*"]`

Keep `package.json`, `wrangler.jsonc`, `src/`, `worker/`, and `backend/` at the repository root.

## Build-time configuration

The defaults are defined in [src/config.ts](src/config.ts) and illustrated in [.env.example](.env.example).

- `VITE_SERVICE_MODE=mock`: browser-local adapter.
- `VITE_API_BASE_URL=/api/v1`: same-origin API base for future integration.
- `VITE_SEED_DEMO=false`: empty dataset for new browsers.
- `VITE_SEED_DEMO=true`: explicitly opt in to fictional examples on an empty dataset.
- `VITE_DEFAULT_CITY`, `VITE_DEFAULT_LAT`, and `VITE_DEFAULT_LNG`: initial map view.
- `VITE_TILE_URL`, `VITE_TILE_ATTRIBUTION`, and `VITE_TILE_MAX_ZOOM`: raster tile provider.
- `VITE_GEOCODER_BASE_URL`: Photon-compatible place lookup provider.

Frontend variables are embedded in the build and are public. Runtime credentials belong in Cloudflare secrets. Rebuild after changing a `VITE_` value.

Local reports and watchlists are origin-scoped. A preview domain, production domain, and localhost each have separate storage. Changing the seed flag does not erase an existing dataset.

## Local checks

Use Node.js 22 and npm, with Python available for the schema check.

```bash
npm ci
npm run verify
python scripts/check_schema.py
```

For the frontend development server:

```bash
npm run dev
```

To build and test the actual Worker routing locally:

```bash
npm run dev:worker
```

To check the bundle and publish from an authenticated local environment:

```bash
npm run deploy:dry-run
npm run deploy
```

Check the Worker destination before the final command. The dry run does not publish.

## Verify the deployed frontend

| Check | Expected result before backend integration |
| --- | --- |
| `/` and frontend deep links | Application loads and refreshes successfully. |
| `/api/v1/health` | JSON with `status: "integration-pending"`. |
| `/api/v1/categories` | JSON catalogue of 70 issue types. |
| `/api/v1/cities` | D1-backed reporting areas if connected; otherwise an empty array. |
| `/api/v1/auth/session` | Intentional JSON 401. |
| `/api/v1/dataset` and `/api/v1/overview` | Intentional JSON 501. |
| Unimplemented shared writes/uploads | Intentional JSON 501. |
| Unknown API route | JSON 404, rather than the frontend HTML. |
| Maps | Light basemap in both themes, visible attribution, working controls. |
| Local reporting and discussion | Saved in the same browser; state survives reload. |

Run the [manual verification checklist](docs/VERIFICATION.md) for navigation, reporting, camera, uploads, and report-to-map behaviour. Browser storage is limited; local photo persistence is a development capability, not durable hosted media.

## Backend activation

The optional D1 `DB` and R2 `PHOTOS` bindings are scaffolding. Provisioning them alone does not activate report endpoints.

Follow [docs/BACKEND.md](docs/BACKEND.md) and [docs/API.md](docs/API.md). Implement verified sessions, server authorization, shared repositories, validated uploads, moderation, and public-read pagination. Test on staging across independent browsers/devices before enabling the API adapter. Do not import fictional preview data into production implicitly.

## Alternative static hosting

`vercel.json` provides a static frontend configuration. Use `npm ci`, `npm run build`, output `dist`, and Node.js 22. `npm run deploy` is a Cloudflare command and does not deploy to Vercel.

The Worker API, D1 database, and R2 bucket do not migrate with static assets. Keep the local adapter until a working backend is available, and account for origin-scoped storage on the new URL.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing entry point or assets | Build first; retain `worker/index.ts` and `assets.directory` in Wrangler configuration. |
| Deployment targets a different Worker | Reconcile the connected Worker's target with the checked-in `civicwatch-community` name. |
| API returns HTML | Verify Worker-first API routing and the request path. |
| Blank map | Check tile requests, network restrictions, and stale build-variable overrides. |
| Place lookup fails or names the wrong locality | Check the geocoder provider; correct optional location labels manually. The pin remains usable. |
| No reports in a new browser | Expected with the empty default and browser-local service. |
| No cross-device sync | Expected before shared backend integration. |
| Storage quota error | Remove large local attachments or use a fresh test origin; avoid clearing valuable local data without exporting it. |
| Camera/location unavailable | Use HTTPS or localhost, check browser permissions, and try the upload/manual-pin alternatives. |

Public OSM tiles and the Photon demo are shared services with usage limits. Review provider suitability before increased traffic.

Official references: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/), and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
