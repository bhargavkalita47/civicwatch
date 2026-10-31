# CivicWatch Worker API contract

Base URL: `/api/v1` (same-origin Cloudflare Worker, not a Pages Function). JSON request/response fields use the interfaces in `src/domain/types.ts`. Timestamps are UTC ISO 8601; record IDs are opaque stable strings. Endpoints return the record itself, not a nested success wrapper. An error uses `{ "error": { "code": "VALIDATION", "message": "Human-readable explanation" } }` and an appropriate HTTP status.

| Method | Path                        | Contract                                                                                  | Worker state                         |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| GET    | `/health`                   | Infrastructure state; no secrets                                                          | Implemented; integration-pending          |
| GET    | `/categories`               | `Category[]`                                                                              | Implemented                            |
| GET    | `/cities`                   | `City[]` — dynamically discovered reporting areas                                 | Implemented; D1-backed when connected            |
| GET    | `/overview`                 | `OverviewSnapshot` with global and per-city aggregates                    | 501 until aggregate query is implemented |
| GET    | `/dataset`                  | `Dataset` containing public users, issues and comments                                    | 501 until repositories are implemented |
| GET    | `/auth/session`             | `Session`, or 401 when signed out                                                         | Always 401 until auth is integrated    |
| POST   | `/auth/sign-in`             | Replace preview credentials with a real identity-provider flow; final result is `Session` | 501                                    |
| POST   | `/auth/sign-out`            | Invalidate server session, clear cookie, return 204                                       | 501                                    |
| POST   | `/issues`                   | `CreateIssueInput` → `Issue`                                                              | 501                                    |
| POST   | `/issues/:id/confirmations` | No body; actor from verified session → updated `Issue`                                    | 501                                    |
| POST   | `/issues/:id/comments`      | `CreateCommentInput` → `Comment`                                                          | 501                                    |
| POST   | `/attachments`              | `multipart/form-data`, field `file` → `Attachment`                                        | 501                                    |
| DELETE | `/issues/:id`               | Delete the issue if and only if current verified actor is its original author | 501 until server auth / D1 + R2 are ready  |
| PATCH  | `/issues/:id/status`        | `{ "status": IssueStatus }` → `Issue`                                                     | 501                                    |

## Input rules

- Title: 8–120 characters after trimming. Description: 20–3,000 characters. Address/landmark: 3–240 characters. Trim on the server before validating and saving.
- Category: a known catalogue ID. `CreateIssueInput.area` carries locality/region/country metadata; server derives/upserts a stable reporting-area ID transactionally, then saves exact coordinates. Never treat locality labels or client-supplied coordinates as an authorization boundary. Verify location metadata before making official jurisdiction claims.
- Latitude: finite, -90 to 90. Longitude: finite, -180 to 180.
- Comment: 2–2,000 characters, or an image attachment with an optional shorter body.
- Reply parent: an existing comment on the same issue. A production moderation/deletion strategy must retain parent relationships or replace removed posts with a tombstone.
- Confirmation: unique `(issue_id, user_id)` and idempotent. The author is already counted and cannot add a second voice. Return the existing report for a duplicate request.
- Photos: no more than three per report or comment; at most 4 MB each; JPG, PNG or WebP only. Client-side checks are convenience checks. The server must independently inspect bytes, authorize ownership and enforce limits transactionally.
- Initial status: always `reported`. Author identity, creation timestamp and organization assignment are server-controlled.
- Resolve: the original reporter may mark their own report resolved. Other changes need server-verified jurisdiction-scoped moderator or administrator authority. A production system should also collect resolution evidence and support review/reopening.

## Geographic aggregation and author-only deletion

`OverviewSnapshot` is fetched separately from map reports, so `GET /overview` can
calculate or cache locality and platform totals even when `GET /dataset` is later
paged by bounding box. Compute unique people with deduplication across the
relevant scope; don't sum city-specific unique counts to obtain global people.

`DELETE /issues/:id` requires a signed, HttpOnly server-authenticated session.
Use only the verified actor ID, not request-supplied role or author ID.
`worker/repository.ts` demonstrates a parameterized, author-scoped database
`DELETE`; missing/deleted and unauthorized records should expose the same safe
client-facing 404. Linked confirmations, comments, status events and attachment
metadata are removed by D1 foreign-key cascades. Objects in R2 also need
cleanup with reliable retries; don't orphan media. The preview does not run this
route, and unverified sign-in is not production authentication.

## Data mapping

The database uses snake_case columns. Map to camelCase interfaces in a repository/serializer module. `Issue.location` contains latitude/longitude; attachments are joined from the attachment table; confirmation identities come from the confirmation table. `Dataset.users` is `PublicUser[]`, without email or provider identifiers. A private `Session.user` contains the current authenticated user only.

Use an actual verified session cookie, not `Authorization` data supplied by the mock service. Mutating responses require `Cache-Control: no-store`. Validate Origin and CSRF tokens as appropriate. Bind permissions to the stored record and verified actor before any write; use D1 transactions/batches and parameterized SQL.

## Scale boundary

The first API adapter consumes a complete dataset, matching the functioning mock version. Before broad public use, add cursor pagination, bounding-box queries, independent thread endpoints and paged people lists. The UI can continue using `CivicService`; server-to-domain mapping stays in the adapter. Avoid returning every confirmation identity for every marker at city scale.

## Runtime and rollout

The active Worker route handler is `worker/api.ts`; `worker/index.ts` owns
`/api/*` and serves no HTML for API errors. Security headers and no-store
responses are applied to API JSON. In preview mode, all user or database
operations are intentionally unimplemented; `GET /auth/session` returns 401,
while writes and `/dataset` return 501. Binding D1 or R2 does not enable these
operations. Implement real identity verification and persistence before
turning on the live frontend API adapter. See `docs/BACKEND.md`.
