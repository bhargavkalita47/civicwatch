import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const origin = "https://civicwatch-preview.example";
const profileId = "11111111-1111-4111-8111-111111111111";
const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-service-key",
};
let found = true;
let calls: { url: string; headers: Headers }[] = [];
beforeEach(() => {
  found = true;
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init.headers) });
    if (url.includes("/rest/v1/civic_profiles")) return Response.json(found ? [{
      user_id: profileId,
      display_name: "Demo Reporter",
      avatar_url: "/api/v1/media/photo-id",
      city: "Guwahati",
      bio: "I report streets",
      website: "https://example.com",
      email: "PRIVATE@example.com",
      private_preferences: { tracked: ["personal data"] },
    }] : []);
    return new Response(null, { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("CivicWatch public resident profile", () => {
  it("allows an anonymous user to view public profile fields without a session", async () => {
    const response = await liveApi(new Request(origin + "/api/v1/users/" + profileId + "/profile"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: profileId,
      displayName: "Demo Reporter",
      avatarUrl: "/api/v1/media/photo-id",
      city: "Guwahati",
      bio: "I report streets",
      website: "https://example.com",
    });
    expect(calls).toHaveLength(1);
    const endpoint = new URL(calls[0].url);
    expect(endpoint.searchParams.get("user_id")).toBe("eq." + profileId);
    expect(endpoint.searchParams.get("select")).toBe("user_id,display_name,avatar_url,city,bio,website");
    expect(calls[0].headers.get("apikey")).toBe(env.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("never returns private data stored alongside profile attributes", async () => {
    const response = await liveApi(new Request(origin + "/api/v1/users/" + profileId + "/profile"), env);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("PRIVATE@example.com");
    expect(body).not.toContain("private_preferences");
    expect(body).not.toContain("personal data");
  });

  it("returns not found for invalid and nonexistent account IDs", async () => {
    const invalid = await liveApi(new Request(origin + "/api/v1/users/malformed/profile"), env);
    expect(invalid.status).toBe(404);
    expect(calls).toHaveLength(0);
    found = false;
    const missing = await liveApi(new Request(origin + "/api/v1/users/" + profileId + "/profile"), env);
    expect(missing.status).toBe(404);
  });

  it("refuses a non-http profile website even if older data stored one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{
      user_id: profileId,
      display_name: "Neighbour",
      website: "javascript:alert(1)",
      email: "hidden",
    }])));
    const response = await liveApi(new Request(origin + "/api/v1/users/" + profileId + "/profile"), env);
    const data = await response.json() as { website: string };
    expect(data.website).toBe("");
  });
});
