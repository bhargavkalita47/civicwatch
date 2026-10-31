# Deploy CivicWatch to Cloudflare Workers (GitHub integration)

Cloudflare Workers with Static Assets remains the **current staging target**.
A separate `vercel.json` config is included for a future **static frontend-only** migration;
we are not switching hosts or implementing the backend in this patch.
It is not a Cloudflare Pages project. Source configuration (`wrangler.jsonc`) specifies the
Worker entry point, static build output, SPA routing and API routes together.
No Pages Functions or Pages-only configuration is included.

> **Public launch prerequisite:** The default service is browser-local and
> the Worker currently returns `501 BACKEND_NOT_ACTIVATED` for report reads and
> writes. A successful Cloudflare deployment does **not** mean residents can
> publish or share reports. Before inviting real submissions, activate verified
> authentication, persistent reporting APIs (D1), secure uploads (R2), and
> moderation, then test reports on two independent devices. Set
> `VITE_SEED_DEMO=false`; only switch to `VITE_SERVICE_MODE=api` once the API
> is implemented. See `docs/BACKEND.md`.

## 1. Create the GitHub repository

1. Extract the latest CivicWatch source ZIP.
2. Create a new empty GitHub repository (for example, `civicwatch-community`).
3. Upload **the contents** of the extracted folder to the repository root.
   `package.json`, `wrangler.jsonc`, `worker/`, `src/`, `backend/` and
   `package-lock.json` must be directly at that root, not nested in an extra
   project folder.
4. Commit to `main`. Never upload `node_modules`, `dist`, `.env.local`,
   service tokens, or private credentials.

If the new Worker must have a different name, update the `name` field in
`wrangler.jsonc` **before** creating the Cloudflare deployment. Its default is
`civicwatch-community`; use only lowercase letters, numbers and hyphens. The GitHub
repository name can differ from the Worker name. The new default name is
intentionally different from the existing `civicwatch` Worker, so deploying
this ZIP will not silently overwrite that earlier project.

## 2. Connect a *new Worker* to GitHub

1. In Cloudflare, open **Workers & Pages** → **Create** → **Worker** and choose
   the GitHub repository deployment option (the wording may differ).
2. Select your new repository and production branch `main`.
3. Configure these values exactly:

   | Field | Value |
   | --- | --- |
   | Build command | `npm run build` |
   | Deploy command | `npm run deploy` |
   | Root directory | `/` |
   | Node.js version | `22` (or newer supported version) |

4. If the dashboard has a framework selection, choose **None/Other** for this
   Worker deployment. No Pages output directory is needed: Wrangler reads
   `assets.directory: "./dist"` from `wrangler.jsonc`.
5. Optionally set the *build-time* variable `VITE_SERVICE_MODE=mock` explicitly.
   Mock mode is already the source default. `VITE_SEED_DEMO=true` displays
   fictional reports and starter discussions on new browsers.
6. Save and deploy. The project publishes as a `*.workers.dev` address (or a
   custom domain you attach). Future pushes to `main` redeploy from GitHub.

**Important:** Do not set `npx wrangler pages deploy` or `pages_build_output_dir`.
Do not create a Pages project for this package. The supported command is
`npm run deploy`, which pins Wrangler CLI to 4.156.0 in the npm script and
executes `wrangler deploy` with the checked-in Worker configuration.

## 3. Verify production

After deployment, check:

- Map background uses OpenStreetMap tiles, with no CARTO watermark or map API
  key. You do **not** need `VITE_CARTO_API_KEY` or any CARTO account.

- `/` shows the CivicWatch application and loads the map tiles.
- `/api/v1/health` returns JSON with `status: "integration-pending"`.
- `/api/v1/categories` returns the 30 issue types as JSON.
- `/api/v1/cities` returns available D1 reporting areas, or `[]` until D1 is connected (the frontend mock obtains areas from preview reports).
- `/api/v1/overview` returns intentional 501 until the database/aggregates are connected.
- `/api/v1/dataset` returns an intentional JSON `501` (not the HTML app).
- Searching and panning to any place updates the visible map and nearby reports; Overview shows dynamically discovered localities and one platform-wide total.
- A report creator can delete their own report with explicit confirmation; another local preview account cannot.
- Map reporting, confirmations, comments and reload persistence work in the
  **same browser**, using browser-local preview data.
- Deep links and refreshes load the frontend correctly without 404 errors.

**Preview data is not shared between browsers or users.** Global totals in mock mode represent the combined sample data stored in the current browser, not live platform-wide participation. Only a shared backend can produce public cross-device totals. The backend is
prepared but not activated. This is deployable frontend infrastructure, not yet
an authenticated municipal reporting service. See `docs/BACKEND.md` for the
remaining security, persistence, photo and moderation integration.

## 4. Local development and preflight

Requires Node.js 22 or later and a working npm registry connection.

```bash
npm ci
npm run verify
npm run dev          # fast Vite UI development (mock service)
npm run dev:worker   # build and run through the real Worker entry with Wrangler
```

Before deploying from a local Cloudflare-authenticated machine:

```bash
npm run deploy:dry-run
npm run deploy
```

GitHub Actions (`.github/workflows/ci.yml`) runs tests, a strict TypeScript
production build, configuration checks and D1 migration checks on each push/PR.

## 5. Activating D1/R2 and verified authentication later

Follow `docs/BACKEND.md`. Optional `DB` and `PHOTOS` bindings can be added to
`wrangler.jsonc` after provisioning the actual Cloudflare resources. Binding
those resources does **not** automatically switch the app to live mode or
activate unsafe write endpoints. Implement and verify server-side authentication,
repositories and uploads first; then change `VITE_SERVICE_MODE=api` and rebuild.
Do not transfer preview reports to production without a dedicated import process.

### Troubleshooting

- **Missing entry-point or assets:** ensure `wrangler.jsonc` still has
  `main: "./worker/index.ts"` and `assets.directory: "./dist"`, and that
  `npm run build` succeeds.
- **Workers command in a Pages project:** you created a Pages project or still
  have `pages_build_output_dir`. Create a **new Worker** and deploy this source.
- **API returns HTML:** inspect `assets.run_worker_first` and verify that
  `worker/index.ts` owns all `/api/*` routes.
- **Maps are blank:** open browser DevTools → Network and check requests to
  `https://tile.openstreetmap.org/`. Remove old `VITE_TILE_URL` overrides in
  Cloudflare build-time variables, then rebuild. Confirm that privacy software
  or a network firewall is not blocking tiles. The public tile service has no
  uptime SLA and enforces a usage policy.
- **Old CARTO watermark appears:** an older deploy or Cloudflare build variable
  is still configuring CARTO. Remove the override and redeploy with the new
  source. Refresh the page after deployment.
- **No cross-device sync:** expected with mock service; see backend activation.

Official Cloudflare references:
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## Worldwide place search

`VITE_GEOCODER_BASE_URL` optionally selects a compatible Photon API. The default
public Photon demo is suitable for limited testing only; configure your own
instance or a managed provider for substantial traffic. Geocoding is not
required to publish a report: users can select a pin and enter locality, region
and country manually. See `docs/GEOGRAPHY.md` for provider limits and backend
requirements. No map/geocoder API key is required for the preview.

## Future changes without ZIP uploads
After importing this version into your existing/new canonical GitHub repository, all future changes should be commits to that repository. Branch -> PR -> CI checks -> merge to `main` -> automatic Cloudflare deployment. See `docs/GOVERNANCE.md`. Avoid creating another Worker or repository per release.

## Important security limitation
The UI initially uses local browser preview data. Admin roles, shared issue history, authenticated write APIs and D1-backed persistence require a real verified identity system before activation. The admin database helpers are not exposed as unsecured public endpoints. See `docs/GOVERNANCE.md`.


## Version note

This deployment package includes the v1.5 visual refresh and overview simplification.


## 6. Vercel preparation — defer until Cloudflare staging tests pass

`vercel.json` contains the Vite output directory and CSP/other response headers.
When ready, import the **same GitHub repository** into Vercel, use Node.js 22,
`npm ci` and `npm run build`, output `dist`, and leave `VITE_SERVICE_MODE=mock`
until real authentication and persistence are built. Do **not** use
`npm run deploy` on Vercel: that command is for Cloudflare Wrangler.

The Worker and its Cloudflare services will **not** migrate with these static
assets. Local preview data is origin-scoped, so the Vercel URL will not see
reports/watchlists stored under the Cloudflare URL. See
`RELEASE_NOTES_v2_5_8.md` for the required staging QA and remaining checks.
