# CivicWatch authentication: email recovery and gated social sign-in

This feature targets the **CivicWatch** Supabase project only. `main` remains on the working production frontend until the release gate passes.

## Email + password

The pilot still allows immediate email/password registration **without an inbox confirmation link**, per product requirements. Do not alter the signup experience as part of this feature. A user-entered email is an account identifier, **not proof of inbox ownership**; never use it as an authorization claim. The existing registration path currently creates users through the Supabase Admin API with `email_confirm: true` without verifying the mailbox. This is a significant account-linking risk.

Password recovery uses a *different* process: the inbox recipient must receive a valid one-time code to change a password. Recovery requests reveal nothing about whether an email is registered. The Worker exchanges the OTP and updates the password server-side. It does not expose Supabase JWTs or service-role credentials to frontend JavaScript.

### Required Supabase email-template configuration

1. Go to [CivicWatch Auth Email Templates](https://supabase.com/dashboard/project/caacglqvyfwatnazhjie/auth/templates).
2. Select **Reset Password**. Use a subject such as **Your CivicWatch recovery code**.
3. Set the recovery email **HTML** to include the `{{ .Token }}` token, for example:

   ```html
   <h2>Reset your CivicWatch password</h2>
   <p>Enter the one-time code below in the CivicWatch password recovery form:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:5px">{{ .Token }}</p>
   <p>This code expires. If you did not request a password reset, ignore this message.</p>
   ```

4. Save the template. The default click-through confirmation link **alone** will not work with the code-entry UI. The one-time code must be present in the email body.
5. Configure **Supabase Auth → SMTP Settings**. The built-in Supabase mail sender is for small-volume testing and is not reliable for public deployment. For the chosen SMTP2GO plan, verify your sender/domain with SMTP2GO, then enter your SMTP2GO host, port, username, password and sender identity into Supabase's SMTP settings. **Never commit SMTP passwords to GitHub.** Check SMTP2GO's actual console for the port and credentials rather than inventing them.
6. Send a real recovery code to an existing CivicWatch test account. Check inbox/spam, submit the code, set a new password, and verify the old password no longer works.

### Live Worker routes

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/recovery/request` | Email recovery code; non-enumerating success response |
| `POST /api/v1/auth/recovery/complete` | Verify code, update password server-side, clear browser session |
| `GET /api/v1/auth/oauth/google` | Begin Google PKCE only if explicitly enabled |
| `GET /api/v1/auth/oauth/facebook` | Begin Facebook PKCE only if explicitly enabled |

The backend calls Supabase's built-in password recovery and verification endpoints and inherits their OTP expiry/cooldown safeguards. Do not remove those protections merely to support multiple test registrations. This feature does **not** introduce a signup-count cap.

## Social sign-in: provider credentials and account-linking risk

The existing OAuth callback and PKCE exchange are preserved. Both providers are **disabled by default** on the frontend **and the Worker** until setup and account linking have been reviewed. The user can still sign in via email and password. A frontend-only feature flag is never treated as backend authorization.

**Why gated:** Supabase can automatically link Google/Facebook identities to an account with a matching email. CivicWatch currently allows users to register any address, and marks those addresses as confirmed without inbox verification. An attacker could pre-register someone else's email, creating a pre-account takeover risk when the legitimate owner signs in using OAuth. **Do not turn on social OAuth simply by supplying credentials.** First establish a method to prevent unsafe automatic linking, such as verifying ownership of existing email accounts before linking, and test this with separate accounts.

Once the linking model is secured:

1. Create a Google Cloud OAuth web client and a Facebook Developers app, using separate project credentials. Both external providers redirect to the **Supabase Auth callback**: `https://caacglqvyfwatnazhjie.supabase.co/auth/v1/callback`.
2. Enable Google and Facebook in **Supabase → Authentication → Sign In / Providers**, with the respective provider client IDs/secrets. In Meta/Facebook, ensure `email` and `public_profile` permissions are available. Use test users while the Facebook app is in Development mode.
3. Allow the Cloudflare *preview application callback* URL in **Supabase → Authentication → URL Configuration**: `https://<your-preview-host>/api/v1/auth/callback`. The exact preview URL is issued by Cloudflare. Do not confuse this with the Supabase Auth callback used inside Google/Meta.
4. In **Cloudflare preview runtime variables**, set `GOOGLE_OAUTH_ENABLED=true` and/or `FACEBOOK_OAUTH_ENABLED=true`.
5. In **Cloudflare preview build variables**, set `VITE_GOOGLE_OAUTH_ENABLED=true` and/or `VITE_FACEBOOK_OAUTH_ENABLED=true`, then rebuild the preview.
6. Test fresh Google/Facebook accounts, cancel/error callbacks, linked accounts, and ensure unverified matching-email account takeover is not possible before exposing the providers to the public.
7. Only after the preview passes, configure production URLs and variables in a separate production release.

## Security and release checklist

- Keep `SUPABASE_SERVICE_ROLE_KEY` in an encrypted Cloudflare Worker secret only.
- Apply normal Supabase Auth per-user OTP cooldown and rate limits. Recovery codes can only be exchanged once; do not log codes/passwords/JWTs.
- Set a strong password policy; Supabase leaked-password protection may require a paid tier.
- Enable auth event logging and monitor SMTP failures.
- Verify reset requests reveal no account-existence information.
- Test legitimate reset, incorrect/expired code, resending code, invalid password, sign-in after reset, and other-account browser session handling.
- Test OAuth account-linking attacks before enabling social sign-in.
- Audit all privileged API paths before merging `dev/backend` into `main`.

References: Supabase [Password-based Auth](https://supabase.com/docs/guides/auth/passwords), [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Rate limits](https://supabase.com/docs/guides/auth/rate-limits).
