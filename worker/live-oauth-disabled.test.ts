import { describe, expect, it } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const env: LiveConfig = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "private-service-test",
};
const get = (provider: string) =>
  new Request("https://civicwatch-preview.example/api/v1/auth/oauth/" + provider);

describe("deferred social sign-in", () => {
  it("keeps Google OAuth inactive until explicitly enabled by the Worker", async () => {
    const response = await liveApi(get("google"), env);
    expect(response.status).toBe(503);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("keeps Facebook OAuth inactive until explicitly enabled by the Worker", async () => {
    const response = await liveApi(get("facebook"), env);
    expect(response.status).toBe(503);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("allows PKCE start only when explicitly enabled for that provider", async () => {
    const response = await liveApi(get("google"), { ...env, GOOGLE_OAUTH_ENABLED: "true" });
    expect(response.status).toBe(302);
    const location = response.headers.get("Location") || "";
    expect(location).toContain("provider=google");
    expect(location).toContain("code_challenge=");
    expect(response.headers.get("Set-Cookie")).toContain("__Host-civic-pkce=");
  });
});
