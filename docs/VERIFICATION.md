# Verification and rollout evidence

## Release 1.1.0 — Workers configuration (30 October 2026)

Local verification completed for this source revision:

- D1 migrations: SQLite schema check passed for all 30 categories, uniqueness,
  author deduplication, geolocation limits and reply relationships.
- Worker entry: strict TypeScript check of the Worker API, binding contracts,
  catalogue and domain type imports passed using the global TypeScript compiler.
- Worker runtime: compiled standalone module and executed eight checks covering
  `/health`, categories, 401 session rejection, 501 pending reads/writes, 403
  foreign-origin writes, JSON 404 for unknown API paths, and SPA fallback.
- Cloudflare configuration: checked for `main`, Workers static assets, explicit
  `/api/*` routing, and absence of Pages-only settings; automated assertions are
  provided in `scripts/validate-config.mjs`.

**Environment limit:** npm registry downloads were unavailable in the local
packaging environment, so a fresh `npm ci`, complete Vitest/Vite production
build and authenticated `wrangler deploy --dry-run` were not completed for this
revision. The *previous* frontend revision was successfully built on Cloudflare
(its build log was supplied by the project owner), but this new release adds a
Worker entry point and deployment config that still require fresh full CI and
Cloudflare build verification. The GitHub workflow and `npm run verify` are
included expressly for those checks. Do not mistake static checks for a
confirmed live Cloudflare deployment.

## Before marking a production deployment successful

1. Run `npm ci && npm run verify` (or observe the successful GitHub Actions run).
2. Run `npm run deploy:dry-run` with an authenticated Wrangler CLI.
3. Deploy the **Worker** from the new GitHub repository with `npm run deploy`.
4. Confirm JSON health, categories, 401/501 responses, SPA routes and map tiles
   from the actual deployed domain.
5. Complete real backend activation and two-device authorization tests before
   allowing genuine public multi-user civic reporting.

## Previous frontend verification (1.0.0)

The earlier frontend report stated that TypeScript/Vite builds, mock service
unit tests, map and browser interactions, and 390px responsive checks passed.
Those checks applied to the prior Pages-targeted frontend release; they are not
presented here as proof of successful deployment of the new Workers version.

## v1.2 interaction checks

- Explore: search for any location by name (press Find) or pan beyond the four demo cities. Verify the map and list follow the viewport.
- Overview: one platform total plus separate city figures, with 22 total
  preview records on a new browser. City cards open the right map location.
- Report: choose a pin in an unlisted country or village, fill locality/region/country if reverse lookup fails, publish. Verify the new reporting area appears in Overview and the platform total increments.
- Delete: create an issue as local account A; account B must not see Delete and
  its service request must be forbidden. Account A can confirm deletion and
  the issue's comments must disappear from local storage.
- Data is preview-local; repeat security checks with real server sessions once
  the backend is activated.
