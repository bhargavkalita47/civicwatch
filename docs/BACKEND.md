# CivicWatch backend

Cloudflare serves the Vite frontend and the same-origin Worker API. Supabase Auth, Postgres and Storage are used for live data. The mock frontend remains available for local development.

## Deploy a preview

1. Apply the SQL migrations under `supabase/migrations` to the CivicWatch project.
2. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as Worker runtime variables. Add `SUPABASE_SERVICE_ROLE_KEY` as a Worker secret using the project's legacy service_role JWT. Keep it out of the frontend build environment and Git.
3. Build with `VITE_SERVICE_MODE=api` and `VITE_API_BASE_URL=/api/v1`. Deploy the Worker and static assets together using `npm run deploy`. Use an isolated preview Worker before promoting to the public site.
4. Verify `/api/v1/health`, register two test users, then verify report sharing, author-only edits and deletion, confirmations, photo access and signed-in watchlist persistence across browsers.

Email and password registration creates a Supabase account immediately. An email address is the account identifier, and CivicWatch does not verify inbox ownership or impose a signup-count cap during this pilot. Platform roles are assigned by Supabase user UUID in `civic_platform_roles`.

To enable Google and Facebook, configure the provider credentials in Supabase Auth, register the Supabase OAuth callback with each provider, and add the Worker origin's `/api/v1/auth/callback` to the Supabase redirect allowlist. The Worker uses PKCE and HttpOnly cookies. Consider the consequences of linking social identities to self-asserted email addresses before enabling these providers.

Reports and comments accept three JPEG, PNG or WebP attachments of up to 15 MB each. Uploads go to a private Supabase bucket. The Worker serves linked photos publicly and unlinked uploads to their owner. The pilot dataset API loads all report rows and threads to preserve the current map and frontend behavior.
