# Production owner access — Cloudflare and Supabase

CivicWatch's server checks admin/owner privileges against `public.civic_platform_roles` in the **dedicated CivicWatch Supabase project**. Production must use the API adapter rather than the browser-local mock identity.

## Configuration

The production Vite build now always uses `serviceMode: "api"`; Vite development retains an explicit mock mode. The Wrangler top-level `vars` contain only the safe-to-commit CivicWatch `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; preview vars are defined separately. The database owner role is **not** changed by this patch.

Cloudflare must also have the **production runtime secret** `SUPABASE_SERVICE_ROLE_KEY`, supplied via **Workers & Pages → civicwatch → Settings → Variables and Secrets → Production → Add secret**, using the service-role secret for the **same** CivicWatch Supabase project. Do not put it in the repository, build variables, PR comments, or the browser, and do not use a project belonging to Recruider.

These are different settings:
- `VITE_SERVICE_MODE=api` was historically a **frontend build variable**. The production code now selects the API without relying on that variable.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are **Worker runtime variables**, now declared in top-level Wrangler configuration.
- `SUPABASE_SERVICE_ROLE_KEY` is a **Worker runtime secret** configured in Cloudflare. The repository cannot provide it.

If the last secret is absent, `GET /api/v1/health` reports integration pending and the real sign-in endpoint cannot run. Restore the secret to the production Worker, then redeploy the verified main release. Never automatically create or assign an owner based on email, display name, or a browser-supplied identity.

## Verification after deployment

1. Open `https://civicwatch.bhargavkalita1327.workers.dev/api/v1/health` in a fresh browser tab. It should return a live-backend health response rather than `mode: "mock-frontend"` or `authenticationConfigured: false`.
2. Sign out of the old local/mock session in the **production** hostname and sign back in with the existing owner account from the dedicated Supabase Auth project.
3. Open **Profile → Account settings**. It should say **Current account session**, never **Local preview session**.
4. Open Administration: the account whose immutable Supabase user ID matches the existing owner row should receive owner-only Admin Access. Confirm report/discussion moderation and activity log still load.
5. If you remain a Resident, compare that session's Supabase user ID with `public.civic_platform_roles.user_id` using a trusted admin diagnostic (never expose raw user IDs or role decisions to anonymous callers).

**Launch reminder:** The existing password-recovery, anti-abuse and map-scaling issues remain controlled-pilot launch blockers. This change only restores the correct production authentication path.
