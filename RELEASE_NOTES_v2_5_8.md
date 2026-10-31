# CivicWatch v2.5.8 — frontend release-hardening patch

**Status:** Source patch prepared for Cloudflare staging tests. **Not certified or deployed.** Keep Cloudflare as the test deployment. Do not change `VITE_SERVICE_MODE` from `mock` or activate the backend in this stage.

## Implemented

1. **Mobile sticky navbar and search:** The mobile topbar stays above the Explore toolbar during vertical scrolling. Reduced the Explore toolbar's z-index from 600 to 2, raised the mobile navbar's from 200 to 1200, and isolated its stacking context. Category quick filters, the single search, and the left drawer are retained.
2. **Form interactions:** Map zoom, geolocate, reset, legend and tile retry controls now use `type="button"`. Replaced the nested `<form>` inside the report's place picker with a search group that handles Enter independently of the outer report form.
3. **Avoid duplicate reports:** A successful create immediately closes the reporting dialog, shows the new report optimistically, and updates the view. A failed follow-up read only warns that totals are stale; it is never treated as a failed create. The report modal also records the first returned report ID and disables repeat submissions after success.
4. **Avoid duplicate comments:** The returned comment is shown immediately and its draft is cleared before refreshing the feed. A failed read shows a refresh warning rather than leaving the same submission to be retried.
5. **Resolved filter carry-over:** The Explore map always filters active issues only and ignores stale resolved-status settings inherited from My Reports. The Explore search/filter interface no longer offers a status filter it cannot apply. Other destinations retain their filtering controls.
6. **Cross-tab sessions:** The authentication context now observes session storage changes (mock preview) and broadcasts sign-in/sign-out events so other open tabs reconcile with the service. Backend cookie-session reconciliation can reuse this structure later.
7. **Contrast:** Category pin symbols get a dark or white foreground chosen from the actual marker color *after* density darkening. The existing 30 pastel category colors are unchanged. Raised the contrast of faint light-theme text and placeholders.
8. **Heading/landmark order:** Added a visually-hidden level-two heading for the main report workspace and made the visible mobile topbar a semantic banner landmark, retaining visible layout and typography.
9. **Release checks:** Corrected the stale cluster expectation (16 active clusters, excluding four resolved reports) and removed outdated compact-watchlist assertions from the design validator. Added `scripts/validate-release.mjs` for key static regressions and included it in `npm run verify`.
10. **CSP and Vercel groundwork:** Moved the early theme switch into self-hosted `public/theme-init.js` so the existing `script-src 'self'` policy permits it. Added `vercel.json` with Vite settings and headers aligned to Cloudflare. Retained `wrangler.jsonc`, the Worker entry, `_headers`, the existing typed service interface, mock/API adapters, and Cloudflare commands without alteration.

## Checks actually run in this environment

| Check | Result |
|---|---|
| All TypeScript/TSX source-file parsing (38 files) | PASS — no syntax diagnostics |
| `node scripts/validate-design.mjs` | PASS |
| `node scripts/validate-copy.mjs` | PASS |
| `node scripts/validate-mobile-nav.mjs` | PASS |
| `node scripts/validate-release.mjs` | PASS |
| `python3 scripts/check_schema.py` | PASS |
| Category icon contrast, 30 categories × 4 confirmation densities | PASS — minimum observed contrast 4.04:1 |
| Seed clustering, 22 reports with four resolved | PASS — 16 active clusters |
| `npm ci`, `npm run build`, `npm run verify`, full Vitest tests | **NOT COMPLETED** — npm package registry connection failed (`EAI_AGAIN`), leaving Vite/React dependencies unavailable. `npm run build` reports missing `vite/client`. This is a testing-environment blocker, not proof of a code error. |
| Actual mobile browser interaction and Cloudflare deployment | **NOT RUN** — must be checked on the staging deployment. |

**Not addressed:** The audit's development-tool advisories (Vitest/Tinypool/@vitest/mocker) remain in the original dependency lock. Without a working registry and end-to-end tests, changing only declared versions or hand-editing transitive package integrity values would risk making `npm ci` fail. On a machine or GitHub Action with npm connectivity, run `npm audit`, upgrade the affected test dependencies and regenerate the lockfile with npm, rerun `npm run verify`, and commit the regenerated lockfile. Verify production dependency advisories separately.

## Cloudflare staging verification — required before merging or considering Vercel

1. In the **existing GitHub repository**, commit the extracted contents of this ZIP to a separate branch and open a pull request. Do not delete the repository. Check that its Actions verification job passes before merging into `main`. Use Cloudflare's existing Worker name in `wrangler.jsonc` if it differs from the archived configuration; do not unintentionally create a second Worker.
2. Use Node 22: `npm ci`, `npm run verify`, `python3 scripts/check_schema.py`, and `npm audit` with network access. Keep `VITE_SERVICE_MODE=mock` and choose `VITE_SEED_DEMO=true` only for explicit testing. Cloudflare build: `npm run build`; deploy: `npm run deploy`.
3. On a phone or browser at 320, 375, 390, 430, and 768 px widths, repeatedly scroll Explore up/down and horizontally scroll category chips. Search must always remain **below**, never on top of, the sticky mobile topbar; open/close the hamburger drawer and test focus. Verify the mobile UI doesn't overflow horizontally.
4. Open Report, pin a location, fill address fields and operate zoom/geolocate. No control should move from Location to Details except **Continue**. Search for a town with Enter, and check that Enter does not advance the report wizard.
5. Create a report (with/without a photo), reload and check its marker, discussion, and ownership actions. Confirm one report was created. To test failure recovery in API mode later, simulate successful POST followed by failed GET and ensure the UI never offers to POST that item again.
6. Post a comment and reply, reload, and confirm each appears **once**. Test a successful comment write followed by a failed refresh separately when API mode is available.
7. Set My Reports → Resolved, then switch to Explore. Active reports should still appear (if seeded or created), and the resolved filter should not be carried into Explore. Check all category group chips, expanded filters, clustering and map location navigation.
8. Sign into two tabs on the same origin, then sign out in one tab; the other must update its account state without reloading. Test cross-tab sign-in similarly.
9. Test light/dark modes while keeping the basemap light. Verify all pin types, density changes, the contrast of symbols, controls, map labels, and a refreshed page (no startup theme flash).
10. Test Local Snapshot watchlist add/reorder/remove, totals, Reports active/inactive sections, resolving and deleting *owned* reports, deep links, and both empty and populated states. Check phone and desktop.
11. In browser DevTools, verify that `theme-init.js` loads, the CSP does not block it, and the map tiles/geocoder function. Check API health endpoints separately; do not infer backend readiness from a successful static deployment.

## Vercel later, after staging

A `vercel.json` is included for a static frontend build. When ready: import the **same GitHub repository**, choose Vite, root folder with `package.json`, Node 22, `npm ci`, `npm run build`, output `dist`; leave `VITE_SERVICE_MODE=mock` until a real API exists. The Cloudflare Worker, D1 and R2 are **not** deployed by Vercel automatically. The currently used hash-based issue links do not require an SPA path rewrite. The new origin will **not** inherit the existing Cloudflare origin's browser-local reports, watchlists or session; plan data migration before public use.

**Current scope:** frontend fixes and deployment configuration only. No persistent backend, real authentication, server authorization, or migration has been implemented.
