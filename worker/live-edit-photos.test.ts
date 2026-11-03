import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const origin = "https://civicwatch-preview.example";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const reportId = "33333333-3333-4333-8333-333333333333";
const photoId = "44444444-4444-4444-8444-444444444444";
const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-only-key",
};
let reportOwner = ownerId;
let mediaOwner = ownerId;
let patched: Record<string, unknown> | null = null;
const existing = {
  id: reportId, category_id: "pothole", city_id: "city",
  city_name: "Guwahati", city_region: "Assam", city_country: "India",
  title: "Original title", description: "Original description",
  address: "Street", latitude: 26, longitude: 91, status: "reported",
  attachments: [], created_at: "2026-11-03T00:00:00Z",
  updated_at: "2026-11-03T00:00:00Z",
  moderation_state: "visible",
};
const input = {
  title: "Updated title", description: "Updated description", address: "Updated street",
};
const request = (body: Record<string, unknown>, authenticated = true) =>
  new Request(origin + "/api/v1/issues/" + reportId, {
    method: "PATCH",
    headers: {
      Origin: origin, "Content-Type": "application/json",
      ...(authenticated ? { Cookie: "__Host-civic-access=token" } : {}),
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  patched = null; reportOwner = ownerId; mediaOwner = ownerId;
  vi.stubGlobal("fetch", vi.fn(async (resource: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(resource));
    if (url.pathname === "/auth/v1/user")
      return Response.json({ id: ownerId, email: "member@example.test", created_at: existing.created_at });
    if (url.pathname === "/rest/v1/civic_reports") {
      if (init.method === "PATCH") {
        patched = JSON.parse(init.body as string);
        return Response.json([{ ...existing, author_id: reportOwner, ...patched }]);
      }
      return Response.json([{ ...existing, author_id: reportOwner }]);
    }
    if (url.pathname === "/rest/v1/civic_platform_roles") return Response.json([]);
    if (url.pathname === "/rest/v1/civic_media")
      return Response.json(mediaOwner === ownerId ? [{
        id: photoId, owner_id: ownerId, name: "new.jpg",
        mime_type: "image/jpeg", size: 1200, created_at: existing.created_at,
      }] : []);
    if (url.pathname === "/rest/v1/civic_confirmations") return Response.json([]);
    return Response.json({ error: "unexpected upstream" }, { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("owner-only report photo editing", () => {
  it("accepts new photos from the report author's uploads", async () => {
    const response = await liveApi(request({ ...input, attachments: [{ id: photoId }] }), env);
    expect(response.status).toBe(200);
    const result = await response.json() as { attachments: { id: string }[] };
    expect(result.attachments[0].id).toBe(photoId);
    expect((patched?.attachments as { id: string }[])[0].id).toBe(photoId);
    expect(patched?.title).toBe(input.title);
  });

  it("allows removing all photos with an explicit empty list", async () => {
    const response = await liveApi(request({ ...input, attachments: [] }), env);
    expect(response.status).toBe(200);
    expect(patched?.attachments).toEqual([]);
  });

  it("preserves previously attached photos for older clients with no attachment field", async () => {
    const response = await liveApi(request(input), env);
    expect(response.status).toBe(200);
    expect(patched).not.toHaveProperty("attachments");
  });

  it("rejects attempts to attach another user's uploaded media", async () => {
    mediaOwner = otherId;
    const response = await liveApi(request({ ...input, attachments: [{ id: photoId }] }), env);
    expect(response.status).toBe(400);
    expect(patched).toBeNull();
  });

  it("enforces the three-photo limit server-side", async () => {
    const response = await liveApi(request({ ...input,
      attachments: [{ id: photoId }, { id: photoId }, { id: photoId }, { id: photoId }],
    }), env);
    expect(response.status).toBe(400);
    expect(patched).toBeNull();
  });

  it("does not permit editing someone else's report", async () => {
    reportOwner = otherId;
    const response = await liveApi(request({ ...input, attachments: [{ id: photoId }] }), env);
    expect(response.status).toBe(403);
    expect(patched).toBeNull();
  });

  it("rejects unauthenticated report edits", async () => {
    const response = await liveApi(request({ ...input, attachments: [] }, false), env);
    expect(response.status).toBe(401);
    expect(patched).toBeNull();
  });
});
