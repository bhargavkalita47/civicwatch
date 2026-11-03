# CivicWatch live-mode scaling changes

**Branch:** `dev/backend` (not production `main`)  
**Database:** Dedicated CivicWatch Supabase project only.

## Implemented in the server-pagination feature

**Public list pagination.** `GET /api/v1/reports/page` accepts `section` (active, resolved, all), `q`, repeated `city` and `category`, `status`, `sort`, `author` or authenticated `mine=1`, plus `limit` and `offset`. The server validates filters, allows at most 50 records, caps offsets, and returns matching totals and active/resolved counts. UI screens request **10 at a time** and append results without fetching earlier pages again. Search requests are lightly debounced. The My Reports author ID is derived from the authenticated HttpOnly session.

**Overview and towns.** `/overview` and `/cities` now call private PostgreSQL aggregate functions. They no longer require fetching every report and confirmation into Cloudflare Workers memory just to calculate totals or discover towns.

**Lazy startup.** In live mode, Overview and paginated lists no longer fetch `/dataset` on initial page load. Explore, watchlist activity, reporting and report threads fetch the full map/thread archive only when it becomes necessary. Mock mode still uses the existing in-browser data adapter.

**Moderation.** The earlier admin work has already introduced separate server-paged moderation sections for reports, comments and audit activity.

**Database.** Two additive migrations implement indexed read paths and read-only SQL RPCs:

- `supabase/migrations/20261103193000_civicwatch_public_report_pages.sql`
- `supabase/migrations/20261103194400_civicwatch_aggregate_reads.sql`

These migrations were applied and queried on the dedicated CivicWatch pilot Supabase project. All three RPCs run as `SECURITY INVOKER`, enforce public visibility, and grant execution only to `service_role`. Never put this secret in the frontend.

## Still required for high traffic

1. **Viewport-based map queries.** `GET /dataset` still returns the entire visible archive when the map or a thread is loaded. For large usage, replace this with bounded map queries and server-side geospatial clustering while preserving deep links.
2. **Discussion on demand.** Retrieve each report's comments and author display names when its thread opens, not for every report on a map visit.
3. **Storage lifecycle.** Implement unused-photo deletion, quota monitoring and a clear data-retention policy before broad public uploads.
4. **Operations and abuse controls.** Set up error/latency monitoring, backups, credential rotation and appropriate abuse controls before public launch, without changing the current private test signup allowances.
5. **Load testing.** Verify real Worker CPU/subrequest budgets and database query plans at representative data sizes before committing to traffic/capacity claims.

This improves the early stages of app loading and report browsing. It does **not** mean that the entire CivicWatch map is yet horizontally scalable, nor that the private backend is approved for unrestricted public deployment.
