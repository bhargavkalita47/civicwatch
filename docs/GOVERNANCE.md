# CivicWatch governance and archival behavior

## Active reports and historical logs

A status change to `resolved` does not delete an issue, its comments, confirmations or attachments. The Explore map and active community list exclude resolved issues. Historical Logs display resolved reports, keeping their original conversations searchable and readable. Platform/city summary statistics include both active and resolved reports, and count them separately.

The browser-local demo simulates the workflow using localStorage. For shared production data, the D1 database must be connected and the API must be activated. Use two distinct SQL predicates for listing: `status <> 'resolved'` for active maps and `status = 'resolved'` for history. Persist a status_events row in the same transaction as each status change, including verified actor, timestamp and previous and next status. Never rely on filtering markers alone: server queries should exclude resolved reports from the active map endpoint.

## Platform owner and delegated administrators

Migration `0004_governance_archives.sql` creates `platform_roles` with a unique single-owner constraint and `admin_audit`. `worker/governance.ts` contains role lookup and owner-only grant/revoke helpers that require a **verified server-side actor identifier**. Administrators are not permitted to grant other admins. A migration does not itself prove identity: manually bootstrap the first owner only *after* a real identity provider and D1 user have been verified. Never designate an owner using a publicly exposed email address, public endpoint or localStorage. A self-assigned browser role cannot be used as authorization.

The present API intentionally returns HTTP 501 for authenticated workflows because no verified authentication or session implementation exists yet. The Admin page is therefore a governance placeholder, **not** a functioning live administrator invitation screen. Before allowing live administration, implement authenticated owner-only endpoints, secure HttpOnly cookies, CSRF and same-origin protections, activity audit, recovery and revocation flow, and tests verifying residents, admins, and owner cannot exceed their privileges. Require role checks server-side for every protected action. Ensure only the issue reporter can permanently delete their issue, as specified. Archiving is preferable to deletion for ordinary resolution.

## GitHub update workflow

Keep one canonical GitHub repository and one Cloudflare Worker connected to its `main` branch. Create a feature branch for each change (`feature/archived-issues`, `feature/admin-governance`), commit the changed files, open a pull request, wait for GitHub Actions CI, review, merge to `main`, and let Cloudflare deploy automatically. `npm run verify` runs tests, TypeScript/Vite build, and deployment configuration checks. Cloudflare build command is `npm run build` and deploy command is `npm run deploy`. No new repository or Worker is necessary for later releases. Do not commit `.env`, tokens, D1 IDs or passwords; configure secrets in Cloudflare environment bindings.
