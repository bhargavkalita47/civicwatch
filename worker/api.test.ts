import { describe, expect, it, vi } from "vitest";
import worker from "./index";
import { handleApi } from "./api";
import type { WorkerEnv } from "./bindings";

const assetFetch = vi.fn(async (_request: Request) => new Response("<html>app</html>", { status: 200 }));
const env: WorkerEnv = { ASSETS: { fetch: assetFetch } };
const call = (path: string, method = "GET", headers?: HeadersInit) =>
  worker.fetch(new Request(`https://civicwatch.example${path}`, { method, headers }), env);

describe("Cloudflare Workers entry and backend boundary", () => {
  it("returns SPA assets for non-API paths", async () => {
    expect(await (await call("/reports/123")).text()).toContain("app");
    expect(assetFetch).toHaveBeenCalled();
  });
  it("always processes /api/* in Worker and does not return SPA HTML", async () => {
    expect((await call("/api/unknown")).status).toBe(404);
    expect((await call("/api/v2/categories")).status).toBe(404);
    expect((await call("/api")).headers.get("content-type")).toContain("application/json");
  });
  it("exposes the authoritative catalogue", async () => {
    const response = await call("/api/v1/categories");
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(70);
    const locations = await call("/api/v1/cities");
    expect(locations.status).toBe(200);
    expect(await locations.json()).toEqual([]);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("exposes truthful backend readiness with no secrets", async () => {
    expect(await (await call("/api/v1/health")).json()).toMatchObject({
      status: "integration-pending",
      authenticationConfigured: false,
      bindings: { database: false, photos: false },
    });
  });
  it("rejects accidental mutation of read-only endpoints", async () => {
    const response = await call("/api/v1/categories", "POST");
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
  it("does not treat a supplied identity or forged role as authentication", async () => {
    expect((await call("/api/v1/auth/session", "GET", { "X-User-Role": "administrator" })).status).toBe(401);
  });
  it("denies cross-origin writes and fails closed for unauthenticated routes", async () => {
    expect((await call("/api/v1/issues", "POST", { Origin: "https://attacker.example" })).status).toBe(403);
    expect((await call("/api/v1/issues", "POST")).status).toBe(501);
    expect((await call("/api/v1/dataset")).status).toBe(501);
    expect((await call("/api/v1/overview")).status).toBe(501);
    expect((await call("/api/v1/attachments", "POST")).status).toBe(501);
    expect((await call("/api/v1/issues/seed-issue-0", "DELETE")).status).toBe(501);
    expect((await call("/api/v1/issues/seed-issue-0", "DELETE", {"X-User-Id":"seed-user-0"})).status).toBe(501);
  });
  it("reports bindings but does not activate unsafe endpoints when DB/R2 are connected", async () => {
    const withBindings: WorkerEnv = {
      ASSETS: env.ASSETS,
      DB: {} as WorkerEnv["DB"],
      PHOTOS: {} as WorkerEnv["PHOTOS"],
    };
    const health = await handleApi(new Request("https://civicwatch.example/api/v1/health"), withBindings);
    expect(await health.json()).toMatchObject({
      authenticationConfigured: false,
      bindings: { database: true, photos: true },
    });
    expect((await handleApi(new Request("https://civicwatch.example/api/v1/dataset"), withBindings)).status).toBe(501);
  });
});
