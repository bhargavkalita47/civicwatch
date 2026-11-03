import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const origin = "https://civicwatch-preview.example";
const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
  SUPABASE_SERVICE_ROLE_KEY: "secret-test",
};
const actorId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
let authorized = true;
let queries: URL[] = [];
let pageCount = 267;
let stored: Record<string, unknown>[] = [];
const get = (path: string, signedIn = true) => new Request(origin + "/api/v1" + path, {
  headers: signedIn ? { Cookie: "__Host-civic-access=token" } : {},
});
beforeEach(() => {
  authorized = true;
  pageCount = 267;
  stored = [];
  queries = [];
  vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL, opts: RequestInit = {}) => {
    const u = new URL(String(request));
    queries.push(u);
    if (u.pathname === "/auth/v1/user")
      return Response.json({ id: actorId, email: "admin@example.test" });
    if (u.pathname === "/rest/v1/civic_platform_roles")
      return Response.json(authorized ? [{ user_id: actorId, role: "admin" }] : []);
    if (u.pathname.startsWith("/rest/v1/civic_")) {
      expect(new Headers(opts.headers).get("Prefer")).toBe("count=exact");
      return new Response(JSON.stringify(stored), {
        headers: { "Content-Type": "application/json", "Content-Range": "10-19/" + pageCount },
      });
    }
    return new Response(null, { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("administration server-side work queues", () => {
  it("denies unauthenticated visitors before any moderation data is queried", async () => {
    const r = await liveApi(get("/admin/queue?section=reports", false), env);
    expect(r.status).toBe(401);
    expect(queries.some(u => u.pathname === "/rest/v1/civic_reports")).toBe(false);
  });
  it("denies residents even when asking for audit records", async () => {
    authorized = false;
    const r = await liveApi(get("/admin/queue?section=activity"), env);
    expect(r.status).toBe(403);
    expect(queries.some(u => u.pathname === "/rest/v1/civic_admin_audit")).toBe(false);
  });
  it("pages report moderation beyond the original 100-row cap", async () => {
    stored = [{ id, title: "Broken walkway", city_name: "Guwahati",
      status: "reported", moderation_state: "visible", created_at: "2026-11-03T12:00:00Z" }];
    const r = await liveApi(get("/admin/queue?section=reports&page=12&visibility=hidden&q=walkway"), env);
    expect(r.status).toBe(200);
    const b = await r.json() as { total: number; page: number; pageSize: number;
      items: { title: string; moderationState: string }[] };
    expect(b).toMatchObject({ total: 267, page: 12, pageSize: 10 });
    expect(b.items[0]).toMatchObject({ title: "Broken walkway", moderationState: "visible" });
    const u = queries.find(u => u.pathname === "/rest/v1/civic_reports")!;
    expect(u.searchParams.get("offset")).toBe("110");
    expect(u.searchParams.get("limit")).toBe("10");
    expect(u.searchParams.get("moderation_state")).toBe("eq.hidden");
    expect(u.searchParams.get("title")).toBe("ilike.*walkway*");
    expect(u.searchParams.get("select")).not.toContain("email");
  });
  it("returns bounded comment records including their report relationship", async () => {
    stored = [{ id, report_id: actorId, body: "Moderator attention", moderation_state: "hidden",
      created_at: "2026-11-03T12:00:00Z" }];
    const r = await liveApi(get("/admin/queue?section=comments&page=2&q=attention"), env);
    expect(r.status).toBe(200);
    const body = await r.json() as { items: { body: string; reportId: string }[] };
    expect(body.items).toEqual([expect.objectContaining({
      body: "Moderator attention", reportId: actorId,
    })]);
    const u = queries.find(u => u.pathname === "/rest/v1/civic_comments")!;
    expect(u.searchParams.get("body")).toBe("ilike.*attention*");
  });
  it("supports paging historical audit actions independently of reports", async () => {
    stored = [{ id: 7, actor_id: actorId, action: "report_hide", target_id: id,
      reason: "Spam", created_at: "2026-11-03T12:00:00Z" }];
    const r = await liveApi(get("/admin/queue?section=activity&page=21&q=report_hide"), env);
    expect(r.status).toBe(200);
    const body = await r.json() as { items: { action: string; reason: string }[] };
    expect(body.items[0]).toEqual(expect.objectContaining({
      action: "report_hide", reason: "Spam",
    }));
    const u = queries.find(u => u.pathname === "/rest/v1/civic_admin_audit")!;
    expect(u.searchParams.get("offset")).toBe("200");
    expect(u.searchParams.get("action")).toBe("ilike.*report_hide*");
  });
  it.each([
    "/admin/queue?section=unknown",
    "/admin/queue?section=reports&page=-1",
    "/admin/queue?section=reports&page=1.5",
    "/admin/queue?section=reports&visibility=other",
    "/admin/queue?section=activity&visibility=hidden",
    "/admin/queue?section=reports&q=" + "x".repeat(81),
  ])("rejects invalid queue requests: %s", async path => {
    const r = await liveApi(get(path), env);
    expect(r.status).toBe(400);
    expect(queries.some(u => u.pathname.endsWith("civic_reports") ||
      u.pathname.endsWith("civic_admin_audit"))).toBe(false);
  });
  it("strips PostgREST control characters from search before forwarding", async () => {
    const r = await liveApi(get("/admin/queue?section=reports&q=" +
      encodeURIComponent("road),(moderation_state.eq.hidden")), env);
    expect(r.status).toBe(200);
    const q = queries.find(u => u.pathname === "/rest/v1/civic_reports")!;
    const text = q.searchParams.get("title") || "";
    expect(text).not.toMatch(/[(),]/);
    expect(text).toContain("road");
  });
});
