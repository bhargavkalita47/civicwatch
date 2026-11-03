# CivicWatch administration (preview implementation)

Administration runs in the same-origin Cloudflare Worker on top of the dedicated CivicWatch Supabase project. It is not a separate application or external admin dashboard.

## Roles and permissions

| Database role | App label | Allowed administration |
|---|---|---|
| `owner` | Administrator | Appoint/revoke admins, moderate reports/comments, read audit log |
| `admin` | Moderator | Moderate reports/comments and read audit log; **cannot** appoint admins |
| No row | Resident | No administrative access |

Only the platform owner is granted out of band during initial provisioning. The `civic_one_platform_owner` database index preserves the single owner. Never create an owner assignment through the public API. Admin appointments use an **existing** Supabase Auth user UUID, not an email or client-supplied role.

The `/admin/*` Worker routes authenticate the caller with Supabase's `auth/v1/user`, then look up their privilege in `civic_platform_roles`. Only that verified server-side identity is passed into the role/moderation SQL functions. Browser headers, request-body IDs, display names, and user metadata are never accepted as authorization.

## Routes

- `GET /api/v1/admin/summary`: owner or admin. Returns bounded recent reports, comments, and audit entries; only the owner receives the administrator list.
- `POST /api/v1/admin/administrators` with `{ "userId": "<uuid>" }`: owner only. Requires a real Supabase user; appends an audit event transactionally.
- `DELETE /api/v1/admin/administrators/<uuid>`: owner only, cannot revoke the owner; appends an audit event.
- `POST /api/v1/admin/moderation` with `{ "id": "<uuid>", "action": "report_hide|report_restore|report_status|comment_hide|comment_restore", "reason": "...", "status": "..." }`: owner/admin; server validates action and reason; changes and audit occur in one database transaction.

`report_status` requires one of `reported`, `acknowledged`, `in_progress`, `resolved`. Hiding a report or comment requires a moderation reason (3–500 characters). The pre-existing report-status endpoint also routes administrator status transitions through audited moderation.

## Visibility and reversibility

Moderation **soft-hides** reports and comments, preserving their records and history for an owner to review and restore. Hidden reports disappear from the public dataset, maps and platform totals. Hidden comments are represented by a removal notice; their original text and attachments are not sent in the public dataset. Media visibility is restricted to content attached to visible reports/comments or a profile avatar, plus the uploader.

The administration screen shows the 100 most recent reports, 100 comments, 80 audit events and up to 100 administrator accounts. Pagination and long-term log retention must be added before a large-scale launch.

## Database migration and deployment

Migration: `supabase/migrations/20261103094302_civicwatch_admin_moderation.sql` (already applied to the CivicWatch project). It adds moderation fields, a restricted audit table, and two `SECURITY INVOKER` RPC functions. The `anon` and `authenticated` database roles cannot execute these functions, even with a publishable key. The privileged service key remains in Cloudflare encrypted secrets **only**, never in `VITE_*` variables or Git.

CI runs on PRs; the `dev/admin-console` branch can be tested using a Cloudflare Worker Preview. After review, merge into **`dev/backend`**, which is a preview branch, not production `main`.

## Remaining launch blockers

- Email sign-ups intentionally do not verify inbox ownership; implement signup abuse controls and safe account linking before broader public access.
- Finish/verify Google and Facebook OAuth configuration and password-reset email flows.
- Add rate limiting, validation of image content beyond signatures (including EXIF stripping), orphaned upload cleanup, and content abuse/reporting tools.
- Add cursor pagination and bounded map queries for scale.
- Review privileged service-role usage, authentication/session revocation, and retry behavior with a security review.
- Test real owner, moderator and resident accounts across two browsers; include API mutation denial, hide/restore, status transitions, audit persistence and network failures.
- Configure backups, logs, alerting, secrets rotation and production release procedures.

**Do not promote this preview to production solely because CI passes.**
