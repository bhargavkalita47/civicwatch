import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const origin = "https://civicwatch-preview.example";
const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
};
const userId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
let privilege: "resident" | "owner" | "admin" = "resident";
const outbound: string[] = [];

function request(path: string, method = "GET", body?: object, signedIn = true) {
  const headers: Record<string, string> = method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json" };
  if (signedIn) headers.Cookie = "__Host-civic-access=valid-session-token";
  return new Request(origin + "/api/v1" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  outbound.length = 0;
  privilege = "resident";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    outbound.push(url.pathname);
    if (url.pathname === "/auth/v1/user")
      return Response.json({ id: userId, email: "account@example.test", created_at: "2026-01-01T00:00:00Z" });
    if (url.pathname.startsWith("/auth/v1/admin/users/"))
      return Response.json({ id: targetId, email: "target@example.test" });
    if (url.pathname === "/rest/v1/civic_platform_roles")
      return Response.json(privilege === "resident" ? [] : [{ user_id: userId, role: privilege }]);
    if (url.pathname === "/rest/v1/rpc/civic_admin_set_role" ||
        url.pathname === "/rest/v1/rpc/civic_admin_moderate")
      return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/civic_reports") {
      expect(url.searchParams.get("moderation_state")).toBe("eq.visible");
      return Response.json([{
        id: targetId, category_id: "pothole", city_id: "place", city_name: "Test",
        city_region: "", city_country: "", title: "Visible report", description: "",
        address: "Test street", latitude: 26, longitude: 91, status: "reported",
        author_id: userId, attachments: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      }]);
    }
    if (url.pathname === "/rest/v1/civic_confirmations") return Response.json([]);
    if (url.pathname === "/rest/v1/civic_comments") return Response.json([{
      id: "33333333-3333-4333-8333-333333333333", report_id: targetId, parent_id: null,
      author_id: userId, body: "Private moderated comment", moderation_state: "hidden",
      attachments: [{ id: "secret-file" }], created_at: "2026-01-01T00:00:00Z",
    }]);
    if (url.pathname === "/rest/v1/civic_profiles") return Response.json([
      { user_id: userId, display_name: "Tester" },
    ]);
    if (url.pathname === "/rest/v1/civic_admin_audit") return Response.json([]);
    return new Response(null, { status: 404 });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("live CivicWatch administration security boundary", () => {
  it("rejects unauthenticated administration access", async () => {
    const response = await liveApi(request("/admin/summary", "GET", undefined, false), env);
    expect(response.status).toBe(401);
  });
  it("denies residents before any privileged RPC or admin-user lookup", async () => {
    const response = await liveApi(request("/admin/administrators", "POST", { userId: targetId }), env);
    expect(response.status).toBe(403);
    expect(outbound).not.toContain("/rest/v1/rpc/civic_admin_set_role");
    expect(outbound).not.toContain("/auth/v1/admin/users/" + targetId);
  });
  it("denies administrators the ability to appoint other administrators", async () => {
    privilege = "admin";
    const response = await liveApi(request("/admin/administrators", "POST", { userId: targetId }), env);
    expect(response.status).toBe(403);
    expect(outbound).not.toContain("/rest/v1/rpc/civic_admin_set_role");
  });
  it("only lets the owner assign an existing user through an audited database function", async () => {
    privilege = "owner";
    const response = await liveApi(request("/admin/administrators", "POST", { userId: targetId }), env);
    expect(response.status).toBe(200);
    expect(outbound).toContain("/auth/v1/admin/users/" + targetId);
    expect(outbound).toContain("/rest/v1/rpc/civic_admin_set_role");
  });
  it("rejects cross-origin moderator writes", async () => {
    privilege = "owner";
    const changed = request("/admin/moderation", "POST", { id: targetId, action: "report_hide", reason: "Spam" });
    changed.headers.set("Origin", "https://attacker.example");
    const response = await liveApi(changed, env);
    expect(response.status).toBe(403);
    expect(outbound).toHaveLength(0);
  });
  it("requires a meaningful reason before hiding content", async () => {
    privilege = "admin";
    const response = await liveApi(request("/admin/moderation", "POST", {
      id: targetId, action: "report_hide", reason: "",
    }), env);
    expect(response.status).toBe(400);
    expect(outbound).not.toContain("/rest/v1/rpc/civic_admin_moderate");
  });
  it("permits verified administrators to moderate through the audited RPC", async () => {
    privilege = "admin";
    const response = await liveApi(request("/admin/moderation", "POST", {
      id: targetId, action: "report_hide", reason: "Duplicate issue",
    }), env);
    expect(response.status).toBe(200);
    expect(outbound).toContain("/rest/v1/rpc/civic_admin_moderate");
  });
  it("removes moderated comment text and attachments from the public dataset", async () => {
    const response = await liveApi(request("/dataset", "GET", undefined, false), env);
    expect(response.status).toBe(200);
    const data = await response.json() as { comments: { body: string; attachments: unknown[] }[] };
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].body).toContain("removed by a moderator");
    expect(data.comments[0].attachments).toEqual([]);
    expect(JSON.stringify(data)).not.toContain("Private moderated comment");
  });
});
