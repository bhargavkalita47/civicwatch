# Verification

This document is a repeatable checklist, not a claim that the latest revision has passed every check. Use the GitHub Actions run for the exact commit, Cloudflare build logs, and recorded manual results as evidence.

## Automated checks

Use Node.js 22, npm, and Python:

```bash
npm ci
npm run verify
python scripts/check_schema.py
```

The GitHub workflow runs the verification command and schema check on pushes to `main` and pull requests. `npm run verify` covers Vitest, the TypeScript/Vite production build, and configuration, design, copy, mobile-navigation, and release assertions.

For Worker changes, also run `npm run dev:worker` and `npm run deploy:dry-run`. These checks do not prove that shared backend features are active.

## Frontend smoke test

Use a disposable test dataset. Test at a narrow mobile width and a desktop width, in both themes.

| Flow | Expected behaviour |
| --- | --- |
| Navigation | Desktop sidebar and mobile drawer work; drawer closes with selection, backdrop, close button, or Escape. Focus returns appropriately. |
| Scroll | Changing page starts at the top. Reporting steps reset the dialog scroll position. |
| Header and footer | Date/time displays; content has usable spacing; footer remains below short and long page content. |
| Maps | Always-light tiles, readable controls/attribution, category markers, and sensible empty states. |
| Explore search | One search field supports report-text filtering and explicit place lookup; quick chips filter category groups. |
| Device location | Permission success shows the current-location marker; denied/unavailable location leaves manual pin selection usable. |
| Report location | Confirm a pin anywhere; optional City/Locality labels are editable. Search-selected or manually edited city survives pin adjustment. Failed lookup does not block continuing. |
| Report details | Search the 70-type category catalogue; category and title are required, description optional. Nearby same-type reports can be opened instead. |
| Uploads | Multiple JPG/PNG/WebP files work, up to three per report/comment and 15 MB per input image. Invalid types, oversize images, and excess counts show clear errors. |
| Picker cancellation | Closing the OS picker leaves the form and entered values intact. |
| Camera | Capture/preview works where supported; permission denial offers the device-camera/upload fallback. Closing/capturing releases the camera. |
| Submit/reload | A successful report survives reload in the same browser. Refresh failure after a successful write does not duplicate it. |
| Discussion | Confirmations, replies, photo attachments, and image previews work. The author cannot count as a second confirmation. |
| View on map | Report details open Explore at the report location and highlight the selected report. Resolved reports remain excluded from ordinary active markers. |
| Watchlist | Add/remove/reorder towns; keyboard controls work; order persists. Combined totals reflect saved towns only. |
| Reports | Open/Resolved sections contain watched-town reports; counts and filters use the intended scope. |
| Author controls | Own report can be resolved or deleted with confirmation; another local account cannot delete it through the service. |
| Layout | Long titles and content fit report cards, controls remain usable, selected-nav icons have contrast, and no horizontal overflow appears. |

New browser datasets are empty by default. Enable `VITE_SEED_DEMO=true` before starting a fresh test dataset when fictional examples are useful. Existing local datasets are retained; do not clear user data as part of routine verification.

## Worker deployment checks

After deploying the intended Worker:

- Frontend routes and refreshes load the application.
- `/api/v1/health` returns JSON with `integration-pending`.
- `/api/v1/categories` returns 70 issue types.
- `/api/v1/cities` returns database areas or an empty array when unbound.
- Session lookup returns 401 while auth is pending.
- Shared dataset/overview and write/upload operations return intentional 501 while unimplemented.
- Unknown API paths return JSON 404 rather than frontend HTML.
- Local reports remain local; opening another origin or browser does not imply shared storage.

## Backend acceptance criteria

Before changing to the API adapter, follow [BACKEND.md](BACKEND.md) and verify:

- Two independent devices can see the same newly created report.
- Guest, expired, revoked, and unauthorized sessions cannot mutate protected data.
- Identity and permissions come from verified server sessions.
- Confirmations are idempotent and unique per actor/report.
- Reports, replies, and uploads have validated ownership and relationships.
- Resolution and deletion enforce author/moderator rules, with reliable media cleanup.
- Malformed inputs, malicious media, oversized payloads, and rate limits are handled.
- Pagination, geographic queries, aggregates, and moderation work with realistic data volume.

Record the commit SHA, environment, automated results, tested browsers/devices, and remaining failures when reporting verification.
