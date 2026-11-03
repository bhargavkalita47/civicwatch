# CivicWatch backend security and production-readiness audit
**Review date:** 2026-11-03
**Reviewed source:** `dev/backend` (fixes prepared on `dev/security-audit`).
**Backend:** Cloudflare Workers + React/Vite, Supabase Auth/Postgres/private Storage.
**Release decision:** Small controlled pilot only; **not cleared for unrestricted public launch**.

## Verified protections

- Public `GET /api/v1/health`, map, category, overview, and city discovery endpoints are separated from mutations.
- Worker validates sessions through Supabase Auth. Report ownership and admin privileges are checked server-side, not from a client-supplied role.
- Mutations require an exact same-origin `Origin` header; access and refresh tokens use Secure, HttpOnly, SameSite=Lax cookies.
- SQL admin RPC functions are limited to the service role. Moderation and role changes are transactional and audited.
- Report/comment rows have RLS enabled. Private media is served through the Worker, which checks public references or uploader ownership.
- The browser pre-processes evidence photos (rotation, canvas re-encoding, compression and metadata stripping) before upload.
- CI verifies TypeScript, Vite build, current product tests and a new security regression gate.

## Findings fixed in this audit

| Severity | Finding | Action |
|---|---|---|
| **Critical** | Supabase `civic_reports` and `civic_comments` public SELECT policies used `USING (true)`; a caller with the publishable key could bypass the Worker and read moderated/hidden content | Updated policies to expose only visible reports and visible comments belonging to visible reports; verified the SQL policy definitions in the connected CivicWatch database; indexed visible reports |
| **High** | Unfinished social providers were displayed and OAuth authorization could start despite the unverified-email account-linking risk | Both UI and Worker now default to disabled and require explicit respective build/runtime opt-in; leave flags off |
| **Medium** | A client could submit up to Cloudflare's request-body limit as JSON and trigger excessive memory allocation or 500 responses on malformed objects | Stream JSON with a hard 128 KiB limit, validate object shapes, return 400/413 without contacting Supabase |
| **Performance** | Cities, overview and dataset reads fetched every column for every row, wasting memory, bandwidth and database time | Select only the columns required by each response while preserving frontend contracts |

The RLS migration `20261103104146_civicwatch_public_moderation_rls.sql` has already been applied to the CivicWatch pilot Supabase project and is mirrored in this Git branch.

## Known blockers that still require work

1. **Identity and recovery:** email/password signup currently uses Supabase Admin API with `email_confirm: true` even though nobody proves inbox ownership. The user intentionally requested no confirmation for private testing; this must not be represented as verified identity. Avoid automatic OAuth account linking while this remains in force. Password reset is deferred, so forgotten-password users require a separate support process.
2. **Abuse and resource exhaustion:** no application-level per-IP anti-automation policy for signup, logins, reports, comments or media. The test pilot intentionally avoids a cumulative signup cap, but public launch should deploy proportionate bot defense (e.g. Turnstile/WAF) without preventing legitimate testing.
3. **Image authenticity and privacy:** the Worker checks extension-independent magic bytes, MIME allowlist and a 15 MB limit. This is not an image decoder, malware scanner or guaranteed metadata scrubber. Non-browser clients can bypass canvas re-encoding and submit images with EXIF GPS or malformed content. Server-side normalization/rejection or an appropriate trusted image-processing service should be added before open public uploads.
4. **Image quotas and orphan cleanup:** the project currently stores uploads in the *Supabase private Storage bucket* (`civic-media`), not ImageKit. Unattached uploads are not automatically removed. At a Free plan storage quota of 1 GB, a high volume of photos can exhaust space. Add scheduled orphan cleanup and fair-use media quotas/alerts.
5. **Global dataset scalability:** `GET /api/v1/dataset` still retrieves all visible reports, confirmations, comments and public-name profiles via offset pagination. This preserves product behavior now, but grows linearly with all users and risks the Free Workers limit of 50 subrequests/request and 10 ms CPU time. Implement cursor/viewport pagination and server-side clustering for a larger rollout. `/overview` also currently aggregates in Worker memory.
6. **Geocoding/tiles:** `tile.openstreetmap.org` and `photon.komoot.io` are community/public demo services, not guaranteed large-scale infrastructure. The app does not prefetch/bulk-download tiles, is configurable to swap providers, and shows attribution; monitor usage and switch providers if growth demands.
7. **Operations:** configure secure backups/export/restore, alerting on 4xx/5xx and rate limits, logs without secrets, service-role-key rotation process, rollback procedure, privacy policy, retention policy, and admin account MFA. Confirm Cloudflare secrets remain encrypted and no privileged keys enter Git.
8. **Password protection:** Supabase Security Advisor currently warns that leaked-password checking is disabled. Review account password policy; upgrade tier if necessary.
9. **CSP:** the static Content Security Policy restricts scripts to self, but allows connections and images to any HTTPS domain to support configurable providers; tighten to actual production providers when stable.

## Verified free-plan budgets (2026-11-03)

| Service | Free allowance | Operational implication |
|---|---|---|
| Cloudflare Workers | 100,000 requests/day; 10 ms CPU/request; 50 subrequests/request; 128 MB memory | The global dataset and high-frequency public reads will hit runtime limits before a very large scale |
| Supabase | 500 MB database/project; 1 GB object storage; 5 GB egress; 50,000 MAU | Images and full-dataset API responses may exhaust storage/egress |
| Supabase project lifecycle | Free projects may pause after one week of inactivity | Not appropriate for guaranteed public uptime |
| OSM tile service | Best-effort community infrastructure | Honour visible attribution, valid referer and caching; no bulk prefetch |
| Photon demo | Best-effort and may throttle extensive requests | Existing 1.1-second client throttle only controls one browser, not total concurrent users |

Sources: [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [OSMF tile use](https://operations.osmfoundation.org/policies/tiles/), [Photon demo terms](https://github.com/komoot/photon#demo-server).

## Suggested private-preview acceptance test

1. Check `/api/v1/health` in the `dev/security-audit` Cloudflare preview.
2. Verify sign up, sign in, refresh/persistence, sign out, two-user report interactions, report resolution, comments and profile/watchlist saving still work.
3. Owner/moderator test: hide one test report and one comment; they should disappear from public data, while administration can still list and restore them; reloading should preserve moderation state.
4. Security: request `/api/v1/auth/oauth/google` and Facebook; both must return 503 until enabled. Send malformed JSON to the sign-in endpoint with the exact same origin; expect 400; 128-KiB+ JSON must return 413. Run automated API tests for cross-origin denial and owner-only admin privilege management.
5. Verify direct Supabase `anon` access does not return hidden report/comment rows after moderation. Merely hiding data in React is insufficient.
6. Confirm no new recovery emails, SMTP credentials, Google/Facebook provider flags or unexpected public signup limits are enabled.
7. Inspect Cloudflare build logs, Worker errors, Supabase security/performance advisors, and confirm `main` still serves the existing frontend.
8. Do not promote to `main` until public identity, abuse, media and scaling risks above are accepted/mitigated for the intended audience.

**Note:** The listed tests are acceptance criteria, not a claim that a real-browser security penetration test has been performed.
