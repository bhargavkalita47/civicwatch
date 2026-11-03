import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const base = "https://preview.civicwatch.test";
const owner = "11111111-1111-4111-8111-111111111111";
const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "private-service-role",
};
const upstreamCalls: Array<{ url: URL; headers: Headers; body: any }> = [];
const page = {
  total: 15, offset: 0, pageSize: 10,
  counts: { total: 20, active: 15, resolved: 5 },
  items: [{ id: "test-report", title: "Drainage problem", commentCount: 2 }],
};
const request = (path: string, cookie = "") => new Request(base + "/api/v1" + path, {
  headers: cookie ? { Cookie: cookie } : {},
});
beforeEach(() => {
  upstreamCalls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    upstreamCalls.push({ url, headers: new Headers(init.headers), body: init.body });
    if (url.pathname === "/auth/v1/user")
      return Response.json({ id: owner, email: "owner@example.test" });
    if (url.pathname === "/rest/v1/rpc/civic_public_report_page")
      return Response.json(page);
    if (url.pathname === "/rest/v1/rpc/civic_public_overview")
      return Response.json({ platform: { reports: 20, open: 15, resolved: 5, people: 12 },
        cities: {}, updatedAt: "2026-11-03T15:00:00Z" });
    if (url.pathname === "/rest/v1/rpc/civic_public_cities")
      return Response.json([{ id: "guwahati", name: "Guwahati" }]);
    return Response.json({ error: "Unknown upstream" }, { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("returns a bounded public page with exact counts without downloading the dataset", async () => {
  const result = await liveApi(request(
    "/reports/page?section=active&sort=supported&city=guwahati&city=jorhat&category=pothole&q=road&limit=10&offset=10"
  ), env);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual(page);
  const call = upstreamCalls.find(x => x.url.pathname === "/rest/v1/rpc/civic_public_report_page")!;
  expect(call.headers.get("Authorization")).toBe("Bearer private-service-role");
  expect(JSON.parse(call.body as string)).toMatchObject({
    p_cities: ["guwahati", "jorhat"], p_categories: ["pothole"], p_section: "active",
    p_sort: "supported", p_query: "road", p_limit: 10, p_offset: 10,
  });
  expect(upstreamCalls.some(x => x.url.pathname.endsWith("civic_reports"))).toBe(false);
});

it("uses the signed-in identity for My Reports rather than accepting author spoofing", async () => {
  const result = await liveApi(request("/reports/page?mine=1", "__Host-civic-access=token"), env);
  expect(result.status).toBe(200);
  const payload = JSON.parse(upstreamCalls.find(x =>
    x.url.pathname === "/rest/v1/rpc/civic_public_report_page")!.body as string);
  expect(payload.p_author).toBe(owner);
  expect(upstreamCalls.some(x => x.url.pathname === "/auth/v1/user")).toBe(true);
  expect((await liveApi(request("/reports/page?mine=1"), env)).status).toBe(401);
  expect((await liveApi(request("/reports/page?mine=1&author=" + owner,
    "__Host-civic-access=token"), env)).status).toBe(400);
});

it("allows public resident browsing but validates the author UUID", async () => {
  const response = await liveApi(request("/reports/page?author=" + owner), env);
  expect(response.status).toBe(200);
  expect(JSON.parse(upstreamCalls.find(x =>
    x.url.pathname === "/rest/v1/rpc/civic_public_report_page")!.body as string).p_author).toBe(owner);
  expect((await liveApi(request("/reports/page?author=not-a-uuid"), env)).status).toBe(400);
});

it.each([
  "/reports/page?limit=51",
  "/reports/page?limit=0",
  "/reports/page?offset=-1",
  "/reports/page?section=invalid",
  "/reports/page?sort=invalid",
  "/reports/page?status=not-a-status",
  "/reports/page?mine=yes",
  "/reports/page?q=" + "x".repeat(121),
])("rejects malformed or unbounded browse queries: %s", async pathname => {
  const response = await liveApi(request(pathname), env);
  expect(response.status).toBe(400);
  expect(upstreamCalls.some(x => x.url.pathname.includes("civic_public_report_page"))).toBe(false);
});

it("returns overview and city aggregations using dedicated database functions", async () => {
  const stats = await liveApi(request("/overview"), env);
  const cities = await liveApi(request("/cities"), env);
  expect(stats.status).toBe(200);
  expect((await stats.json()).platform.reports).toBe(20);
  expect((await cities.json())[0].name).toBe("Guwahati");
  expect(upstreamCalls.some(x => x.url.pathname === "/rest/v1/rpc/civic_public_overview")).toBe(true);
  expect(upstreamCalls.some(x => x.url.pathname === "/rest/v1/rpc/civic_public_cities")).toBe(true);
  expect(upstreamCalls.some(x => x.url.pathname === "/rest/v1/civic_reports")).toBe(false);
});
