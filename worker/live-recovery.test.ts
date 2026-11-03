import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const origin = "https://civicwatch-preview.example";
const env: LiveConfig = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "private-service-test",
};
const email = "member@example.com";
const pass = "SafeNewPass9!";

const call = (path: string, body?: Record<string, unknown>, method = "POST") =>
  new Request(origin + "/api/v1" + path, {
    method,
    headers: { Origin: origin, ...(method !== "GET" ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let requests: { path: string; init: RequestInit; headers: Headers }[] = [];
let verificationFails = false;
beforeEach(() => {
  requests = [];
  verificationFails = false;
  vi.stubGlobal("fetch", vi.fn(async (target: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(target)).pathname;
    const headers = new Headers(init.headers);
    requests.push({ path, init, headers });
    if (path === "/auth/v1/recover") return Response.json({});
    if (path === "/auth/v1/verify") {
      if (verificationFails) return Response.json({ message: "expired" }, { status: 422 });
      return Response.json({
        access_token: "temporary-recovery-jwt", refresh_token: "unused",
        expires_in: 3600, user: { id: "verified-account" },
      });
    }
    if (path === "/auth/v1/user") return Response.json({ id: "verified-account" });
    if (path === "/auth/v1/logout") return new Response(null, { status: 204 });
    return Response.json({ error: "unexpected endpoint" }, { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("password recovery and OAuth security", () => {
  it("requests a recovery code without disclosing account existence", async () => {
    const response = await liveApi(call("/auth/recovery/request", { email }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requested: true });
    expect(requests.map(r => r.path)).toEqual(["/auth/v1/recover"]);
    expect(requests[0].headers.get("apikey")).toBe("publishable-test");
    expect(requests[0].headers.get("Authorization")).toBe(null);
  });

  it("never reveals whether an unknown recovery email exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "not found" }, { status: 400 })));
    const response = await liveApi(call("/auth/recovery/request", { email }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requested: true });
  });

  it("rejects an invalid recovery code before changing a password", async () => {
    verificationFails = true;
    const response = await liveApi(call("/auth/recovery/complete", {
      email, code: "123456", password: pass,
    }), env);
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("invalid or expired");
    expect(requests.map(r => r.path)).toEqual(["/auth/v1/verify"]);
  });

  it("exchanges code and updates password server-side without leaking tokens", async () => {
    const response = await liveApi(call("/auth/recovery/complete", {
      email, code: "123456", password: pass,
    }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changed: true });
    expect(requests.map(r => r.path)).toEqual([
      "/auth/v1/verify", "/auth/v1/user", "/auth/v1/logout",
    ]);
    expect(requests[0].headers.get("apikey")).toBe("publishable-test");
    expect(requests[0].headers.get("Authorization")).toBe(null);
    expect(requests[1].init.method).toBe("PUT");
    expect(requests[1].headers.get("Authorization")).toBe("Bearer temporary-recovery-jwt");
    expect(requests[1].headers.get("apikey")).toBe("publishable-test");
    expect(JSON.stringify(requests[1].init.body)).toContain(pass);
    const cookies = response.headers.get("Set-Cookie") || "";
    expect(cookies).toContain("Max-Age=0");
    expect(JSON.stringify(await response.clone().text())).not.toContain("temporary-recovery-jwt");
  });

  it("rejects a malformed recovery request without upstream calls", async () => {
    const response = await liveApi(call("/auth/recovery/complete", {
      email, code: "not-a-code", password: pass,
    }), env);
    expect(response.status).toBe(400);
    expect(requests).toHaveLength(0);
  });

  it("requires same-origin submissions", async () => {
    const changed = call("/auth/recovery/request", { email });
    changed.headers.set("Origin", "https://attacker.example");
    const response = await liveApi(changed, env);
    expect(response.status).toBe(403);
    expect(requests).toHaveLength(0);
  });

  it("does not start unapproved social login flows", async () => {
    const response = await liveApi(call("/auth/oauth/google", undefined, "GET"), env);
    expect(response.status).toBe(503);
    expect(response.headers.get("Location")).toBe(null);
  });

  it("starts PKCE social login only when the server flag is explicitly enabled", async () => {
    const response = await liveApi(call("/auth/oauth/google", undefined, "GET"), {
      ...env, GOOGLE_OAUTH_ENABLED: "true",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("provider=google");
    expect(response.headers.get("Location")).toContain("code_challenge_method=S256");
    expect(response.headers.get("Set-Cookie")).toContain("__Host-civic-pkce=");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
  });
});
