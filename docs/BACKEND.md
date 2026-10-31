# Backend activation plan — Cloudflare Workers, D1 and R2

CivicWatch now has a genuine **Cloudflare Worker entry point** at
`worker/index.ts`. The browser still runs in `mock` mode by default, using a
central async service interface. The API scaffold at `worker/api.ts` intentionally
rejects all reads/writes that require user verification or a real database.
This distinction prevents a UI demo from pretending to be a live public system.

## Prepared and usable today

- React + TypeScript + Vite, same-origin Worker Static Assets, SPA fallback.
- Real Worker routing: all `/api/*` requests pass through Worker code before
  static assets; unknown API paths return JSON 404, not HTML.
- `GET /api/v1/health`, `GET /api/v1/categories` and `GET /api/v1/cities` work without persistence.
- API operations needing identity/storage return a deliberate 401/501.
- Runtime bindings are typed in `worker/bindings.ts` (`ASSETS`, optional `DB`,
  optional `PHOTOS`); no secrets or guessed resource IDs are committed.
- Domain models, input rules and service interfaces are in `src/domain/`.
- `src/services/mock.ts` and `src/services/api.ts` satisfy the same interface.
- D1 migrations create users, organizations, permissions, categories, reports,
  unique confirmations, threaded comments, photo metadata and status history.
- GitHub CI validates frontend tests, Worker routes, TypeScript build and schema.

## Activation is an implementation task, not a toggle

1. **Provision resources.** In the correct Cloudflare account, create a D1
   database and an R2 bucket. Using Wrangler after login:

   ```bash
   npx --yes wrangler@4.156.0 d1 create civicwatch
   npx --yes wrangler@4.156.0 r2 bucket create civicwatch-photos
   ```

2. **Bind resources** by adding the arrays below to `wrangler.jsonc` alongside
   `assets` (replace the placeholder DB id with the real id shown by Cloudflare):

   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "civicwatch",
       "database_id": "YOUR_REAL_D1_DATABASE_ID",
       "migrations_dir": "backend/migrations"
     }
   ],
   "r2_buckets": [{ "binding": "PHOTOS", "bucket_name": "civicwatch-photos" }]
   ```

   Do not commit placeholder IDs. Workers use `main` + `assets`, **not**
   `pages_build_output_dir`.

3. **Apply migrations** on a staging database first, then the actual target:

   ```bash
   npx --yes wrangler@4.156.0 d1 migrations apply civicwatch --remote
   ```

4. **Add a verified identity provider** (such as a correctly validated OAuth
   or OIDC provider). The `SignInInput` form is a *preview identity only*; it is
   NOT production login. Implement a suitable login/redirect/OTP UX in the auth
   service, and issue an `HttpOnly; Secure; SameSite=Lax` short-lived session
   cookie only after server verification. Check issuer, audience, expiry and
   signature of provider tokens. Add logout/revocation. Keep secrets in
   Cloudflare runtime secrets, not in public `VITE_` variables.

5. **Build repositories and the API handler** behind `worker/api.ts`, following
   `docs/API.md`: parameterized D1 queries for live issues, confirmations,
   discussion threads, organizations and status transitions, plus R2 uploads.
   Implement `GET /overview` as a server-side aggregate across **all** cities;
   it must not simply summarize a single page of map issues. Author-scoped
   deletion may use `worker/repository.ts`, with the verified server actor ID.
   Ensure R2 media deletion is retried safely even after D1 cascades. The API
   must never trust a client role, email or `authorId` header.
   Use `worker/bindings.ts` for resources and `src/domain/types.ts` for the
   response contract; this preserves the UI architecture. Read actor ID and
   permissions from **verified server sessions only**. Never accept `authorId`,
   role or confirmation identity from request bodies as proof of access.

6. **Secure mutation endpoints.** Server-validate every field and permission.
   Add CSRF protection for cookie sessions (including origin checks), rate
   limits, moderation/report-abuse tools, input size limits and audit logs.
   Restrict reporter resolution to their own reports; other status transitions
   must require a verified authorized moderator/admin for the jurisdiction.
   D1 unique constraints and relationships remain a second defense.

7. **Handle images safely.** Use R2 with random non-guessable object keys;
   verify actual bytes and MIME type, re-encode/strip metadata, max 4 MB and
   three photos per post, enforce upload ownership and association, and clean
   up abandoned objects. Do not accept arbitrary browser-provided photo URLs
   as attached or trusted assets.

8. **Scale public reads before broad launch.** The initial dataset shape is
   for small pilots. Add geographic bounding-box queries, cursor pagination,
   count summaries, paginated confirmations and thread endpoints. Implement
   abuse reporting and content moderation before accepting public submissions.

9. **Test real end-to-end behavior** on a staging Worker: two-device report
   visibility, guest mutation denial, duplicate confirmations, revoked
   sessions, cross-organization authorization, parent-comment ownership,
   malicious uploads, pagination and status transition history.

10. **Only after those checks**, set `VITE_SERVICE_MODE=api` and
    `VITE_API_BASE_URL=/api/v1`, run `npm run build` and deploy. Keep the
    `CivicService` contract. Switching mode before implementing routes will
    show intentional 501 errors instead of displaying mock data as real data.

## Development modes

- `npm run dev` starts Vite only; use this for frontend work in mock mode.
- `npm run dev:worker` builds and starts the Worker runtime including static
  assets and actual `/api/v1` scaffold. Re-run when source assets change.
- `npm run deploy:dry-run` validates Workers bundling without publishing.
- `npm run deploy` publishes the actual Worker and its static assets.

`/api/v1/health` is an infrastructure diagnostic, not an indication that shared
backend functionality is active. D1/R2 bindings, even when provisioned, do not
activate the API on their own. Never store private auth credentials in Git.

## City and owner-control data model (v1.2)

`backend/migrations/0003_cities_deletion.sql` adds the city catalogue and
`issues.city_id` with a foreign key, plus an index for jurisdiction filtering.
It backfills existing Guwahati/Shillong/Jorhat/Silchar coordinates as a best-effort
migration; review and manually assign any previously unmapped production issues.
Since v1.4 the client accepts coordinates anywhere in the world. `city_id` now
represents a dynamic locality grouping, not a fixed supported-jurisdiction list.
Use a validated/upserted area in the issue-creation transaction, and fetch
areas from reports rather than a hardcoded catalogue. See `docs/GEOGRAPHY.md`.

User deletion requires authentication, both UI and server permission checks,
linked-row cascading deletes and reliable cleanup of any uploaded R2 objects.
Currently only local preview deletion is enabled. Supplied headers and the
preview email form are not trusted by the Worker.
