import { afterEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
};
const url = "https://civicwatch-preview.example/api/v1/auth/sign-in";
const request = (payload: string, headers: Record<string, string> = {}) => new Request(url, {
  method: "POST",
  headers: { Origin: "https://civicwatch-preview.example", "Content-Type": "application/json", ...headers },
  body: payload,
});

afterEach(() => vi.unstubAllGlobals());

describe("Worker payload size and shape protections", () => {
  it("rejects a non-object JSON body without calling Supabase", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await liveApi(request("null"), env);
    expect(response.status).toBe(400);
    expect((await response.json() as { error: { message: string } }).error.message)
      .toContain("JSON object");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects array input, which cannot be a sign-in request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await liveApi(request("[]"), env)).status).toBe(400);
  });

  it("rejects malformed JSON as a client error rather than a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const response = await liveApi(request("{"), env);
    expect(response.status).toBe(400);
  });

  it("rejects large streaming bodies even without Content-Length", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await liveApi(request(JSON.stringify({ email: "x".repeat(132000) })), env);
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects oversized declared Content-Length without reading upstream", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await liveApi(request("{}", { "Content-Length": "200000" }), env);
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still validates small sign-in payloads normally", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await liveApi(request(JSON.stringify({ email: "resident@example.com", password: "short" })), env);
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
