import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const origin = "https://civicwatch-preview.test";
const authorId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const reportId = "33333333-3333-4333-8333-333333333333";
const commentId = "44444444-4444-4444-8444-444444444444";
const photoId = "55555555-5555-4555-8555-555555555555";
const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};
const baseComment = {
  id: commentId, report_id: reportId, parent_id: null, author_id: authorId,
  body: "Original comment", attachments: [{
    id: photoId, name: "crossing.jpg", mimeType: "image/jpeg", size: 1700,
    url: `/api/v1/media/${photoId}`, createdAt: "2026-11-04T00:00:00Z",
  }],
  created_at: "2026-11-04T00:00:00Z",
  moderation_state: "visible", edited_at: null, deleted_at: null,
};
let actingUser = authorId;
let owningUser = authorId;
let mediaOwner = authorId;
let hidden = false;
let persisted = { ...baseComment };
let writes: Array<{ method: string; path: string; query: string; body?: Record<string, unknown> }> = [];

function request(method: "PATCH" | "DELETE", body?: object, signedIn = true) {
  return new Request(`${origin}/api/v1/comments/${commentId}`, {
    method,
    headers: {
      Origin: origin,
      ...(signedIn ? { Cookie: "__Host-civic-access=token" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  actingUser = authorId; owningUser = authorId; mediaOwner = authorId;
  hidden = false; persisted = { ...baseComment };
  writes = [];
  vi.stubGlobal("fetch", vi.fn(async (resource: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(resource));
    if (url.pathname === "/auth/v1/user")
      return Response.json({ id: actingUser, email: "member@example.test", created_at: baseComment.created_at });
    if (url.pathname === "/rest/v1/civic_comments") {
      if (init.method === "PATCH") {
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        writes.push({ method: "PATCH", path: url.pathname, query: url.search, body });
        if (!url.searchParams.get("author_id")?.includes(authorId) ||
            url.searchParams.get("deleted_at") !== "is.null")
          return Response.json([], { status: 200 });
        persisted = { ...persisted, ...body };
        return Response.json([{ ...persisted, author_id: owningUser,
          moderation_state: hidden ? "hidden" : "visible" }]);
      }
      return Response.json([{ ...persisted, author_id: owningUser,
        moderation_state: hidden ? "hidden" : "visible" }]);
    }
    if (url.pathname === "/rest/v1/civic_media") {
      return Response.json(mediaOwner === actingUser ? [{
        id: photoId, owner_id: actingUser, name: "crossing.jpg",
        mime_type: "image/jpeg", size: 1700,
        created_at: baseComment.created_at,
      }] : []);
    }
    return Response.json({ error: "unexpected upstream" }, { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("comment author management", () => {
  it("edits text and removes all photos without changing comment identity or replies", async () => {
    const response = await liveApi(request("PATCH", { body: "Updated public comment", attachments: [] }), env);
    expect(response.status).toBe(200);
    const comment = await response.json() as { id: string; body: string; attachments: unknown[]; editedAt: string };
    expect(comment).toMatchObject({ id: commentId, body: "Updated public comment", attachments: [] });
    expect(comment.editedAt).toBeTruthy();
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("PATCH");
    expect(writes[0].body).not.toHaveProperty("parent_id");
    expect(writes[0].body).not.toHaveProperty("report_id");
    expect(writes[0].body).not.toHaveProperty("author_id");
  });

  it("lets the author delete their comment and attached photo references without a cascading DELETE", async () => {
    const response = await liveApi(request("DELETE"), env);
    expect(response.status).toBe(200);
    const comment = await response.json() as { body: string; attachments: unknown[]; deletedAt: string };
    expect(comment.body).toBe("");
    expect(comment.attachments).toEqual([]);
    expect(comment.deletedAt).toBeTruthy();
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatchObject({ body: "", attachments: [] });
    expect(writes[0].body).not.toHaveProperty("parent_id");
    expect(writes.some(entry => entry.method === "DELETE")).toBe(false);
  });

  it("rejects unauthorized editing and deleting of another resident's comment", async () => {
    owningUser = otherId;
    for (const method of ["PATCH", "DELETE"] as const) {
      const response = await liveApi(request(method, method === "PATCH" ?
        { body: "Tampered", attachments: [] } : undefined), env);
      expect(response.status).toBe(403);
    }
    expect(writes).toHaveLength(0);
  });

  it("rejects unauthenticated changes", async () => {
    for (const method of ["PATCH", "DELETE"] as const) {
      const response = await liveApi(request(method, method === "PATCH" ?
        { body: "Tampered", attachments: [] } : undefined, false), env);
      expect(response.status).toBe(401);
    }
    expect(writes).toHaveLength(0);
  });

  it("rejects edits and deletions of an already deleted comment", async () => {
    persisted = { ...baseComment, body: "", attachments: [], deleted_at: "2026-11-04T00:01:00Z" };
    for (const method of ["PATCH", "DELETE"] as const) {
      const response = await liveApi(request(method, method === "PATCH" ?
        { body: "Resurrect me", attachments: [] } : undefined), env);
      expect(response.status).toBe(409);
    }
    expect(writes).toHaveLength(0);
  });

  it("rejects editing a moderator-hidden comment but allows the author to remove it", async () => {
    hidden = true;
    expect((await liveApi(request("PATCH", {
      body: "Edited hidden comment", attachments: [],
    }), env)).status).toBe(403);
    expect((await liveApi(request("DELETE"), env)).status).toBe(200);
  });

  it("requires content after the last photo is removed", async () => {
    const response = await liveApi(request("PATCH", { body: "", attachments: [] }), env);
    expect(response.status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("cannot attach another person's uploaded image", async () => {
    mediaOwner = otherId;
    const response = await liveApi(request("PATCH", {
      body: "A useful comment", attachments: [{ id: photoId }],
    }), env);
    expect(response.status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("can keep an existing owned photo while editing text", async () => {
    const response = await liveApi(request("PATCH", {
      body: "Keeping my photo", attachments: [{ id: photoId }],
    }), env);
    expect(response.status).toBe(200);
    const comment = await response.json() as { attachments: { id: string }[] };
    expect(comment.attachments).toHaveLength(1);
    expect(comment.attachments[0].id).toBe(photoId);
  });
});
