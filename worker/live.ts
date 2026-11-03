import { categories } from "../src/data/categories";
import { reverseGeocodeResponse } from "./geoReverse";
import type { Attachment, City, Comment, Dataset, Issue, OverviewSnapshot, Profile, Role, Session } from "../src/domain/types";

export interface LiveConfig {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_OAUTH_ENABLED?: string;
  FACEBOOK_OAUTH_ENABLED?: string;
}
type Row = Record<string, any>;
class Failure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const bucket = "civic-media";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function field(value: unknown, max: number, min = 0) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max)
    throw new Failure(400, "Check the required fields and their lengths.");
  return value.trim();
}

/** Bound JSON requests before parsing. The Cloudflare Free plan has a 128 MB
 * memory ceiling; accepting a 100 MB JSON request can exhaust an invocation.
 * 128 KiB leaves room for a full 100-town watchlist at maximum field lengths. */
async function boundedJson(req: Request): Promise<unknown> {
  const maxBytes = 128 * 1024;
  const advertised = req.headers.get("Content-Length");
  if (advertised && Number(advertised) > maxBytes)
    throw new Failure(413, "This request is too large.");
  if (!req.body) throw new Failure(400, "A JSON request body is required.");
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let content = "";
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Failure(413, "This request is too large.");
    }
    content += decoder.decode(part.value, { stream: true });
  }
  content += decoder.decode();
  return JSON.parse(content);
}

async function jsonObject(req: Request): Promise<Row> {
  const value = await boundedJson(req);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Failure(400, "A JSON object is required.");
  return value as Row;
}

export async function liveApi(req: Request, env: LiveConfig): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.slice("/api/v1".length);
  const method = req.method;
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const cookies = new Map((req.headers.get("Cookie") || "").split(/;\s*/).map(pair => {
    const i = pair.indexOf("=");
    return [pair.slice(0, i), pair.slice(i + 1)];
  }));
  const outputHeaders = new Headers(headers);
  const cookie = (name: string, value: string, age: number) =>
    outputHeaders.append("Set-Cookie", `__Host-civic-${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`);
  const reply = (value?: unknown, status = 200) => {
    if (value === undefined) return new Response(null, { status: 204, headers: outputHeaders });
    return Response.json(value, { status, headers: outputHeaders });
  };

  async function upstream(endpoint: string, init: RequestInit = {}, access?: string) {
    const key = access === undefined ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_PUBLISHABLE_KEY;
    const requestHeaders = new Headers(init.headers);
    requestHeaders.set("apikey", key);
    if (access || access === undefined) requestHeaders.set("Authorization", `Bearer ${access || key}`);
    if (typeof init.body === "string") requestHeaders.set("Content-Type", "application/json");
    const response = await fetch(base + endpoint, { ...init, headers: requestHeaders });
    if (!response.ok) {
      if (response.status === 429) throw new Failure(429, "Please wait before trying again.");
      if (endpoint.startsWith("/auth/v1/admin/users/") && response.status === 404)
        throw new Failure(404, "This account does not exist. Check the account UUID.");
      if (endpoint === "/auth/v1/admin/users" && [400, 409, 422].includes(response.status))
        throw new Failure(400, "Could not create an account with those credentials.");
      if (endpoint.startsWith("/auth/")) throw new Failure(401, "Authentication failed. Check your credentials and try again.");
      if ([400, 409].includes(response.status)) throw new Failure(400, "The supplied data could not be saved.");
      throw new Failure(503, "CivicWatch storage is temporarily unavailable.");
    }
    return response;
  }

  async function db(table: string, query: Record<string, string> = {}, method = "GET", body?: unknown, merge = false): Promise<Row[]> {
    const qs = new URLSearchParams(query);
    const endpoint = `/rest/v1/civic_${table}?${qs}`;
    const init = { method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { Prefer: merge ? "resolution=merge-duplicates,return=representation" : "return=representation" } };
    if (method !== "GET") return (await upstream(endpoint, init)).json();
    const rows: Row[] = [];
    for (let offset = 0; ; offset += 1000) {
      const response = await upstream(endpoint + `&limit=1000&offset=${offset}`, init);
      const page: Row[] = await response.json();
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }

  const auth = async (endpoint: string, body?: unknown, token = ""): Promise<Row> =>
    (await upstream("/auth/v1/" + endpoint, { method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body) }, token)).json();
  const saveTokens = (tokens: Row) => {
    cookie("access", tokens.access_token, tokens.expires_in);
    cookie("refresh", tokens.refresh_token, 30 * 86400);
    return tokens.user as Row;
  };
  const profile = async (id: string): Promise<Profile> => {
    const [row] = await db("profiles", { user_id: "eq." + id });
    return { userId: id, displayName: row?.display_name || "", city: row?.city || "", bio: row?.bio || "",
      website: row?.website || "", avatarUrl: row?.avatar_url || "" };
  };
  const privilege = async (id: string): Promise<"owner" | "admin" | null> => {
    const [row] = await db("platform_roles", { user_id: "eq." + id });
    return row?.role === "owner" ? "owner" : row?.role === "admin" ? "admin" : null;
  };
  const role = async (id: string): Promise<Role> => {
    const assigned = await privilege(id);
    return assigned === "owner" ? "administrator" : assigned === "admin" ? "moderator" : "resident";
  };
  const session = async (user: Row): Promise<Session> => {
    const [p, r] = await Promise.all([profile(user.id), role(user.id)]);
    return { user: { id: user.id, email: user.email, displayName: p.displayName || user.user_metadata?.displayName || "Resident",
      avatarUrl: p.avatarUrl, role: r, createdAt: user.created_at }, expiresAt: new Date(Date.now() + 55 * 60_000).toISOString() };
  };
  async function actor(): Promise<Row> {
    const access = cookies.get("__Host-civic-access");
    if (access) {
      try { return await auth("user", undefined, access); }
      catch (cause) { if (!(cause instanceof Failure) || cause.status !== 401) throw cause; }
    }
    const token = cookies.get("__Host-civic-refresh");
    if (token) return saveTokens(await auth("token?grant_type=refresh_token", { refresh_token: token }));
    throw new Failure(401, "Sign in to continue.");
  }

  const city = (r: Row): City => ({ id: r.city_id, name: r.city_name, region: r.city_region || "", country: r.city_country || "",
    center: { lat: r.latitude, lng: r.longitude }, radiusKm: 0 });
  const issue = (r: Row, confirmations: string[] = []): Issue => ({
    id: r.id, categoryId: r.category_id, cityId: r.city_id, title: r.title, description: r.description,
    address: r.address, location: { lat: r.latitude, lng: r.longitude }, status: r.status, authorId: r.author_id,
    organizationId: null, confirmationUserIds: confirmations, attachments: r.attachments || [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  });
  const comment = (r: Row): Comment => ({ id: r.id, issueId: r.report_id, parentId: r.parent_id,
    authorId: r.author_id, body: r.deleted_at ? "" : r.body,
    attachments: r.deleted_at ? [] : (r.attachments || []),
    createdAt: r.created_at, editedAt: r.edited_at ?? null, deletedAt: r.deleted_at ?? null });
  const lookup = (id: string) => ({ id: "eq." + id });
  const areaList = (reports: Row[]) => [...new Map(reports.map(r => [r.city_id, city(r)])).values()];
  // Bounded administrative reads; do not load the entire public dataset into the console.
  const adminPage = async (table: "reports" | "comments" | "platform_roles" | "profiles" | "admin_audit",
    select: string, order: string, limit: number): Promise<Row[]> => {
    const query = new URLSearchParams({ select, order, limit: String(limit) });
    return (await (await upstream(`/rest/v1/civic_${table}?${query}`)).json()) as Row[];
  };
  // Paginated moderation reads: use bounded PostgREST result windows and
  // exact counts instead of hiding anything older than the summary's recent 100.
  const adminQueue = async (
    table: "reports" | "comments" | "admin_audit",
    select: string, order: string, page: number,
    queryText: string, visibility: string,
  ) => {
    const limit = 10;
    const offset = (page - 1) * limit;
    const query = new URLSearchParams({
      select, order, limit: String(limit), offset: String(offset),
    });
    if (table !== "admin_audit" && visibility !== "all")
      query.set("moderation_state", "eq." + visibility);
    if (queryText) {
      const safe = queryText.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim().replace(/\s+/g, " ");
      if (safe) {
        const field = table === "reports" ? "title" : table === "comments" ? "body" : "action";
        query.set(field, "ilike.*" + safe + "*");
      }
    }
    const response = await upstream("/rest/v1/civic_" + table + "?" + query, {
      headers: { Prefer: "count=exact" },
    });
    const items = await response.json() as Row[];
    const range = response.headers.get("Content-Range") || "";
    const totalText = range.split("/")[1];
    const total = totalText && totalText !== "*" ? Number(totalText) : null;
    return {
      page, pageSize: limit,
      total: total !== null && Number.isFinite(total) ? total : offset + items.length,
      items,
    };
  };
  const runAdminTransaction = async (functionName: "civic_admin_set_role" | "civic_admin_moderate", input: object) => {
    await upstream("/rest/v1/rpc/" + functionName, { method: "POST", body: JSON.stringify(input) });
  };

  async function attachments(input: unknown, userId: string): Promise<Attachment[]> {
    if (!Array.isArray(input) || input.length > 3) throw new Failure(400, "Choose up to three photos.");
    return Promise.all(input.map(async entry => {
      if (!entry || !uuid.test(entry.id)) throw new Failure(400, "Invalid attachment.");
      const [row] = await db("media", { ...lookup(entry.id), owner_id: "eq." + userId });
      if (!row) throw new Failure(400, "This attachment is unavailable.");
      return media(row);
    }));
  }

  const media = (row: Row): Attachment => ({
    id: row.id, url: `/api/v1/media/${row.id}`, name: row.name, mimeType: row.mime_type,
    size: row.size, createdAt: row.created_at,
  });

  try {
    if (!["GET", "HEAD"].includes(method) && req.headers.get("Origin") !== url.origin)
      throw new Failure(403, "Cross-origin requests are blocked.");

    if (method === "GET") {
      if (path === "/health") {
        await upstream("/rest/v1/civic_reports?select=id&limit=1");
        return reply({ service: "civicwatch", status: "healthy", apiVersion: "v1" });
      }
      if (path === "/geo/reverse") return reverseGeocodeResponse(req);
      if (path === "/categories") return reply(categories);
      if (path === "/auth/session") return reply(await session(await actor()));
      if (path === "/watchlist") {
        const [row] = await db("watchlists", { user_id: "eq." + (await actor()).id });
        return reply(row?.towns || []);
      }
      const provider = /^\/auth\/oauth\/(google|facebook)$/.exec(path)?.[1];
      if (provider) {
        // Unverified email registration is permitted in this pilot. Until
        // identity linking is secured, neither social login may start by default.
        const enabled = provider === "google" ? env.GOOGLE_OAUTH_ENABLED === "true"
          : env.FACEBOOK_OAUTH_ENABLED === "true";
        if (!enabled) throw new Failure(503, "This sign-in method is not available yet.");
        const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const verifier = encode(crypto.getRandomValues(new Uint8Array(48)));
        const challenge = encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
        cookie("pkce", verifier, 600);
        const query = new URLSearchParams({ provider, code_challenge: challenge, code_challenge_method: "s256",
          redirect_to: url.origin + "/api/v1/auth/callback" });
        outputHeaders.set("Location", base + "/auth/v1/authorize?" + query);
        return new Response(null, { status: 302, headers: outputHeaders });
      }
      if (path === "/auth/callback") {
        const verifier = cookies.get("__Host-civic-pkce");
        const code = url.searchParams.get("code");
        cookie("pkce", "", 0);
        if (!verifier || !code) throw new Failure(401, "Social sign-in was cancelled or expired.");
        const user = saveTokens(await auth("token?grant_type=pkce", { auth_code: code, code_verifier: verifier }));
        const existing = await profile(user.id);
        if (!existing.displayName) {
          const name = String(user.user_metadata?.full_name || user.user_metadata?.name || "Resident").slice(0, 80);
          await db("profiles", {}, "POST", { user_id: user.id, display_name: name }, true);
        }
        outputHeaders.set("Location", url.origin + "/");
        return new Response(null, { status: 303, headers: outputHeaders });
      }
      // Public-facing profile cards reveal only fields the resident chose for
      // their profile. Never include email, session data, roles or watchlists.
      const memberProfileId = /^\/users\/([^/]+)\/profile$/.exec(path)?.[1];
      if (memberProfileId) {
        if (!uuid.test(memberProfileId)) throw new Failure(404, "Profile not found.");
        const [member] = await db("profiles", {
          select: "user_id,display_name,avatar_url,city,bio,website",
          user_id: "eq." + memberProfileId,
        });
        if (!member) throw new Failure(404, "Profile not found.");
        return reply({
          userId: member.user_id,
          displayName: member.display_name || "CivicWatch member",
          avatarUrl: member.avatar_url || "",
          city: member.city || "",
          bio: member.bio || "",
          website: typeof member.website === "string" && /^https?:\/\//i.test(member.website)
            ? member.website : "",
        });
      }
      if (path === "/profile") return reply(await profile((await actor()).id));
      if (path === "/overview" || path === "/cities") {
        // These read-only aggregates are computed in PostgreSQL. In
        // particular, Overview no longer transfers every report and
        // confirmation to the Worker just to count them.
        const functionName = path === "/overview"
          ? "civic_public_overview" : "civic_public_cities";
        const result = await upstream("/rest/v1/rpc/" + functionName, {
          method: "POST", body: "{}",
        });
        return reply(await result.json());
      }
      if (path === "/reports/page") {
        // Page report lists on the server. Public profiles may request any
        // resident's *visible* reports; the 'mine' option derives its author
        // from the authenticated session, never from client-supplied identity.
        const params = url.searchParams;
        const section = params.get("section") || "active";
        const sort = params.get("sort") || "recent";
        const status = params.get("status") || "all";
        const query = params.get("q") || "";
        const mine = params.get("mine") === "1";
        const suppliedAuthor = params.get("author");
        const rawLimit = params.get("limit") || "10";
        const rawOffset = params.get("offset") || "0";
        const cityIds = params.getAll("city");
        const categoryIds = params.getAll("category");
        if (!["active", "resolved", "all"].includes(section) ||
          !["recent", "supported"].includes(sort) ||
          !["all", "reported", "acknowledged", "in_progress", "resolved"].includes(status) ||
          query.length > 120 || !/^\d{1,2}$/.test(rawLimit) ||
          !/^\d{1,6}$/.test(rawOffset) ||
          Number(rawLimit) < 1 || Number(rawLimit) > 50 ||
          Number(rawOffset) > 100000 ||
          cityIds.length > 30 || categoryIds.length > 100 ||
          cityIds.some(id => id.length < 1 || id.length > 255) ||
          categoryIds.some(id => id.length < 1 || id.length > 80) ||
          (mine && suppliedAuthor !== null) ||
          (params.has("mine") && !["0", "1"].includes(params.get("mine")!)) ||
          (suppliedAuthor !== null && !uuid.test(suppliedAuthor)))
          throw new Failure(400, "Invalid report browse filters.");
        const authorId = mine ? (await actor()).id : suppliedAuthor;
        const response = await upstream("/rest/v1/rpc/civic_public_report_page", {
          method: "POST",
          body: JSON.stringify({
            p_cities: cityIds.length ? cityIds : null,
            p_author: authorId || null,
            p_section: section,
            p_query: query.trim(),
            p_categories: categoryIds.length ? categoryIds : null,
            p_status: status,
            p_sort: sort,
            p_limit: Number(rawLimit),
            p_offset: Number(rawOffset),
          }),
        });
        outputHeaders.set("Cache-Control", "private, no-store");
        return reply(await response.json());
      }

      if (path === "/admin/queue") {
        const user = await actor();
        if (!await privilege(user.id))
          throw new Failure(403, "Administrator access is required.");
        const section = url.searchParams.get("section");
        if (!["reports", "comments", "activity"].includes(section || ""))
          throw new Failure(400, "Choose a valid moderation section.");
        const rawPage = url.searchParams.get("page") || "1";
        if (!/^[1-9]\d{0,5}$/.test(rawPage))
          throw new Failure(400, "Choose a valid page.");
        const page = Number(rawPage);
        const search = url.searchParams.get("q") || "";
        if (search.length > 80)
          throw new Failure(400, "Search is too long.");
        const visibility = url.searchParams.get("visibility") || "all";
        if (!["all", "visible", "hidden"].includes(visibility) ||
          (section === "activity" && visibility !== "all"))
          throw new Failure(400, "Invalid visibility filter.");
        if (section === "reports") {
          const result = await adminQueue("reports",
            "id,title,city_name,status,moderation_state,created_at",
            "created_at.desc,id.desc", page, search, visibility);
          return reply({ ...result, items: result.items.map(row => ({
            id: row.id, title: row.title, city: row.city_name, status: row.status,
            moderationState: row.moderation_state || "visible", createdAt: row.created_at,
          })) });
        }
        if (section === "comments") {
          const result = await adminQueue("comments",
            "id,report_id,body,moderation_state,created_at",
            "created_at.desc,id.desc", page, search, visibility);
          return reply({ ...result, items: result.items.map(row => ({
            id: row.id, reportId: row.report_id, body: row.body,
            moderationState: row.moderation_state || "visible", createdAt: row.created_at,
          })) });
        }
        const result = await adminQueue("admin_audit",
          "id,actor_id,action,target_id,reason,created_at",
          "created_at.desc,id.desc", page, search, "all");
        return reply({ ...result, items: result.items.map(row => ({
          id: row.id, actorId: row.actor_id, action: row.action,
          targetId: row.target_id, reason: row.reason || "", createdAt: row.created_at,
        })) });
      }
      if (path === "/admin/summary") {
        const user = await actor();
        const assigned = await privilege(user.id);
        if (!assigned) throw new Failure(403, "Administrator access is required.");
        const [reports, comments, history, assignedRoles, profiles] = await Promise.all([
          adminPage("reports", "id,title,city_name,status,moderation_state,created_at", "created_at.desc", 100),
          adminPage("comments", "id,report_id,body,moderation_state,created_at", "created_at.desc", 100),
          adminPage("admin_audit", "id,actor_id,action,target_id,reason,created_at", "created_at.desc", 80),
          assigned === "owner" ? adminPage("platform_roles", "user_id,role", "role", 100) : Promise.resolve([]),
          assigned === "owner" ? adminPage("profiles", "user_id,display_name", "user_id", 1000) : Promise.resolve([]),
        ]);
        const names = new Map(profiles.map(row => [row.user_id, row.display_name]));
        return reply({
          viewerRole: assigned,
          administrators: assignedRoles.filter(row => row.role === "admin")
            .map(row => ({ userId: row.user_id, displayName: names.get(row.user_id) || "CivicWatch member" })),
          reports: reports.map(row => ({ id: row.id, title: row.title, city: row.city_name, status: row.status,
            moderationState: row.moderation_state || "visible", createdAt: row.created_at })),
          comments: comments.map(row => ({ id: row.id, reportId: row.report_id,
            body: row.body, moderationState: row.moderation_state || "visible", createdAt: row.created_at })),
          history: history.map(row => ({ id: row.id, actorId: row.actor_id, action: row.action,
            targetId: row.target_id, reason: row.reason || "", createdAt: row.created_at })),
        });
      }
      const mediaId = /^\/media\/([^/]+)$/.exec(path)?.[1];
      if (mediaId && uuid.test(mediaId)) {
        const [row] = await db("media", lookup(mediaId));
        if (!row) throw new Failure(404, "Photo unavailable.");
        const contained = "cs." + JSON.stringify([{ id: mediaId }]);
        const [reports, comments, avatars] = await Promise.all([
          db("reports", { select: "id", attachments: contained, moderation_state: "eq.visible" }),
          db("comments", { select: "report_id", attachments: contained, moderation_state: "eq.visible" }),
          db("profiles", { select: "user_id", avatar_url: "eq." + media(row).url }),
        ]);
        const visibleParentReports = comments.length
          ? await db("reports", { select: "id", id: "in.(" + [...new Set(comments.map(c => c.report_id))].join(",") + ")",
            moderation_state: "eq.visible" })
          : [];
        if (!reports.length && !visibleParentReports.length && !avatars.length && (await actor()).id !== row.owner_id)
          throw new Failure(404, "Photo unavailable.");
        const photo = await upstream(`/storage/v1/object/authenticated/${bucket}/${mediaId}`);
        return new Response(photo.body, { headers: { ...headers, "Content-Type": row.mime_type } });
      }
      if (["/dataset", "/cities", "/overview"].includes(path)) {
        // Fetch only the columns the requested view consumes. Keeping the
        // existing full-dataset response contract avoids breaking map filters.
        const columns = path === "/cities"
          ? "city_id,city_name,city_region,city_country,latitude,longitude"
          : path === "/overview" ? "id,author_id,city_id,status"
          : "id,category_id,city_id,city_name,city_region,city_country,title,description,address,latitude,longitude,status,author_id,attachments,created_at,updated_at";
        const reports = await db("reports", { select: columns, moderation_state: "eq.visible", order: "created_at.desc,id" });
        if (path === "/cities") return reply(areaList(reports));
        const confirmations = await db("confirmations", { select: "report_id,user_id", order: "report_id,user_id" });
        const byIssue = new Map<string, string[]>();
        for (const row of confirmations) {
          const users = byIssue.get(row.report_id) || [];
          users.push(row.user_id);
          byIssue.set(row.report_id, users);
        }
        if (path === "/overview") {
          const stats = (rows: Row[]) => {
            const people = new Set(rows.flatMap(r => [r.author_id, ...(byIssue.get(r.id) || [])]));
            const resolved = rows.filter(r => r.status === "resolved").length;
            return { reports: rows.length, resolved, open: rows.length - resolved, people: people.size };
          };
          const grouped = new Map<string, Row[]>();
          for (const row of reports) {
            const group = grouped.get(row.city_id) || [];
            group.push(row);
            grouped.set(row.city_id, group);
          }
          return reply({ platform: stats(reports), cities: Object.fromEntries([...grouped].map(([id, rows]) => [id, stats(rows)])),
            updatedAt: new Date().toISOString() } satisfies OverviewSnapshot);
        }
        const [comments, profiles] = await Promise.all([
          db("comments", { select: "id,report_id,parent_id,author_id,body,attachments,moderation_state,created_at,edited_at,deleted_at", order: "created_at,id" }),
          db("profiles", { select: "user_id,display_name", order: "user_id" }),
        ]);
        const visibleReportIds = new Set(reports.map(r => r.id));
        const publicComments = comments.filter(row => visibleReportIds.has(row.report_id));
        const publicAuthors = new Set([...reports, ...publicComments.filter(row => row.moderation_state !== "hidden")]
          .map(r => r.author_id));
        return reply({ version: 1, areas: areaList(reports), issues: reports.map(r => issue(r, byIssue.get(r.id))),
          comments: publicComments.map(row => row.moderation_state === "hidden"
            ? { ...comment(row), body: "This comment was removed by a moderator.", attachments: [] }
            : comment(row)),
          users: profiles.filter(p => publicAuthors.has(p.user_id)).map(p => ({ id: p.user_id, displayName: p.display_name, role: "resident" })) } satisfies Dataset);
      }
    }

    if (path === "/auth/sign-in" && method === "POST") {
      const input = await jsonObject(req);
      const email = field(input.email, 254, 3).toLowerCase();
      const password = input.password;
      if (typeof password !== "string" || password.length < 8 || password.length > 72)
        throw new Failure(400, "Enter a password between 8 and 72 characters.");
      if (input.register === true) {
        const displayName = field(input.displayName, 60, 2);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Failure(400, "Enter a valid email address.");
        await upstream("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({
          email, password, email_confirm: true, user_metadata: { displayName },
        }) });
        const user = saveTokens(await auth("token?grant_type=password", { email, password }));
        await db("profiles", {}, "POST", { user_id: user.id, display_name: displayName }, true);
        return reply(await session(user));
      }
      return reply(await session(saveTokens(await auth("token?grant_type=password", { email, password }))));
    }

    if (path === "/auth/sign-out" && method === "POST") {
      const token = cookies.get("__Host-civic-access");
      if (token) {
        try { await upstream("/auth/v1/logout?scope=local", { method: "POST" }, token); }
        catch (cause) { if (!(cause instanceof Failure) || cause.status !== 401) throw cause; }
      }
      cookie("access", "", 0);
      cookie("refresh", "", 0);
      return reply();
    }

    if (path === "/admin/administrators" && method === "POST") {
      const user = await actor();
      if (await privilege(user.id) !== "owner") throw new Failure(403, "Only the owner can appoint administrators.");
      const input = await jsonObject(req);
      const target = input?.userId;
      if (typeof target !== "string" || !uuid.test(target)) throw new Failure(400, "Enter a valid account UUID.");
      if (target === user.id) throw new Failure(400, "The owner account cannot be reassigned.");
      await upstream("/auth/v1/admin/users/" + target);
      await runAdminTransaction("civic_admin_set_role", { p_actor_id: user.id, p_target_id: target, p_enabled: true });
      return reply({ success: true });
    }
    const removeAdminId = /^\/admin\/administrators\/([^/]+)$/.exec(path)?.[1];
    if (removeAdminId && method === "DELETE") {
      const user = await actor();
      if (await privilege(user.id) !== "owner") throw new Failure(403, "Only the owner can revoke administrators.");
      if (!uuid.test(removeAdminId) || user.id === removeAdminId) throw new Failure(400, "Invalid administrator.");
      await runAdminTransaction("civic_admin_set_role", { p_actor_id: user.id,
        p_target_id: removeAdminId, p_enabled: false });
      return reply({ success: true });
    }
    if (path === "/admin/moderation" && method === "POST") {
      const user = await actor();
      if (!await privilege(user.id)) throw new Failure(403, "Administrator access is required.");
      const input = await jsonObject(req);
      const actions = ["report_hide", "report_restore", "report_status", "comment_hide", "comment_restore"];
      if (!input || !actions.includes(input.action) || typeof input.id !== "string" || !uuid.test(input.id))
        throw new Failure(400, "Invalid moderation request.");
      const reason = input.reason === undefined ? "" : field(input.reason, 500);
      if (["report_hide", "comment_hide"].includes(input.action) && reason.length < 3)
        throw new Failure(400, "Explain why this content is being hidden.");
      if (input.action === "report_status" &&
        !["reported", "acknowledged", "in_progress", "resolved"].includes(input.status))
        throw new Failure(400, "Invalid report status.");
      await runAdminTransaction("civic_admin_moderate", {
        p_actor_id: user.id, p_target_id: input.id, p_action: input.action,
        p_status: input.action === "report_status" ? input.status : null, p_reason: reason,
      });
      return reply({ success: true });
    }
    const match = /^\/issues\/([^/]+)(?:\/(confirmations|comments|status))?$/.exec(path);
    const commentMatch = /^\/comments\/([^/]+)$/.exec(path);
    if (method === "GET" || (!match && !commentMatch && !["/issues", "/attachments", "/profile", "/watchlist"].includes(path)))
      throw new Failure(404, "API route not found.");
    const user = await actor();
    if (commentMatch) {
      const commentId = commentMatch[1];
      if (!uuid.test(commentId) || !["PATCH", "DELETE"].includes(method))
        throw new Failure(404, "API route not found.");
      const [existing] = await db("comments", lookup(commentId));
      if (!existing) throw new Failure(404, "Comment not found.");
      if (existing.author_id !== user.id)
        throw new Failure(403, "Only the comment author can change this comment.");
      if (existing.deleted_at)
        throw new Failure(409, "This comment has already been deleted.");
      if (method === "PATCH" && existing.moderation_state === "hidden")
        throw new Failure(403, "A hidden comment cannot be edited.");
      const scoped = { ...lookup(commentId), author_id: "eq." + user.id, deleted_at: "is.null" };
      if (method === "PATCH") {
        const input = await jsonObject(req);
        const photos = await attachments(input.attachments, user.id);
        const text = field(input.body, 2000, photos.length ? 0 : 2);
        const [updated] = await db("comments", scoped, "PATCH", {
          body: text, attachments: photos, edited_at: new Date().toISOString(),
        });
        if (!updated) throw new Failure(409, "The comment changed. Reload and try again.");
        return reply(comment(updated));
      }
      // A deletion is a tombstone rather than a hard delete. The row remains
      // so replies authored by OTHER users are not cascaded away.
      const [deleted] = await db("comments", scoped, "PATCH", {
        body: "", attachments: [], deleted_at: new Date().toISOString(),
      });
      if (!deleted) throw new Failure(409, "The comment changed. Reload and try again.");
      return reply(comment(deleted));
    }
    if (path === "/watchlist" && method === "PUT") {
      if (req.headers.get("X-Civic-Account") !== user.id) throw new Failure(409, "The active account changed.");
      const towns = await boundedJson(req);
      if (!Array.isArray(towns) || towns.length > 100) throw new Failure(400, "Choose up to 100 towns.");
      const clean = towns.map(town => {
        const lat = town?.center?.lat, lng = town?.center?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
          throw new Failure(400, "Invalid town location.");
        return { id: field(town.id, 255, 1), name: field(town.name, 120, 1), region: field(town.region, 120),
          country: field(town.country, 120), center: { lat, lng }, radiusKm: 0 };
      });
      await db("watchlists", {}, "POST", { user_id: user.id, towns: clean }, true);
      return reply();
    }
    if (path === "/profile" && method === "PATCH") {
      const input = await jsonObject(req);
      const row: Row = { user_id: user.id };
      for (const [key, column, limit] of [["displayName", "display_name", 80], ["city", "city", 120], ["bio", "bio", 500], ["website", "website", 300]] as const) {
        if (key in input) row[column] = field(input[key], limit);
      }
      if (row.website && !/^https?:\/\//i.test(row.website)) throw new Failure(400, "Enter an HTTP or HTTPS website.");
      if ("avatarUrl" in input) {
        const id = /^\/api\/v1\/media\/(.+)$/.exec(input.avatarUrl)?.[1];
        row.avatar_url = input.avatarUrl === "" ? "" : (await attachments([{ id }], user.id))[0].url;
      }
      await db("profiles", {}, "POST", row, true);
      return reply(await profile(user.id));
    }

    if (path === "/attachments" && method === "POST") {
      const max = 15 * 1024 * 1024;
      const length = Number(req.headers.get("Content-Length"));
      if (length > max + 65536) throw new Failure(413, "Photos must be 15 MB or smaller.");
      const file = (await req.formData()).get("file");
      if (!(file instanceof File) || file.size < 12 || file.size > max) throw new Failure(400, "Choose an image up to 15 MB.");
      const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const signature = String.fromCharCode(...b);
      const mime = b[0] === 255 && b[1] === 216 && b[2] === 255 ? "image/jpeg"
        : b[0] === 137 && signature.slice(1, 8) === "PNG\r\n\x1a\n" ? "image/png"
          : signature.startsWith("RIFF") && signature.slice(8) === "WEBP" ? "image/webp" : null;
      if (!mime) throw new Failure(400, "Choose a JPEG, PNG or WebP image.");
      const id = crypto.randomUUID();
      const endpoint = `/storage/v1/object/${bucket}/${id}`;
      await upstream(endpoint, { method: "POST", body: file, headers: { "Content-Type": mime } });
      try {
        const [row] = await db("media", {}, "POST", { id, owner_id: user.id, name: file.name.slice(0, 255), mime_type: mime, size: file.size });
        return reply(media(row), 201);
      } catch (cause) {
        await upstream(endpoint, { method: "DELETE" }).catch(() => undefined);
        throw cause;
      }
    }

    if (path === "/issues" && method === "POST") {
      const input = await jsonObject(req);
      if (!categories.some(c => c.id === input.categoryId)) throw new Failure(400, "Select a category.");
      const lat = input.location?.lat, lng = input.location?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw new Failure(400, "Choose a valid map location.");
      const [row] = await db("reports", {}, "POST", { author_id: user.id, category_id: input.categoryId,
        city_id: field(input.area?.id, 255, 1), city_name: field(input.area?.name, 120, 1),
        city_region: field(input.area?.region ?? "", 120), city_country: field(input.area?.country ?? "", 120),
        title: field(input.title, 160, 1), description: field(input.description, 5000), address: field(input.address, 500),
        latitude: lat, longitude: lng, attachments: await attachments(input.attachments, user.id) });
      return reply(issue(row), 201);
    }

    if (match && uuid.test(match[1])) {
      const [, id, action] = match;
      const [row] = await db("reports", lookup(id));
      if (!row) throw new Failure(404, "Report not found.");
      // Hidden reports cannot be confirmed, edited or discussed by ordinary users.
      // The reporter may still permanently delete their own hidden report.
      const deletingOwn = row.author_id === user.id && method === "DELETE" && !action;
      if (row.moderation_state === "hidden" && !deletingOwn && !(await privilege(user.id)))
        throw new Failure(404, "Report not found.");
      const owner = row.author_id === user.id;
      const scoped = { ...lookup(id), author_id: "eq." + user.id };
      if (!action && method === "DELETE") {
        if (!owner) throw new Failure(403, "Only the reporter can delete this report.");
        await db("reports", scoped, "DELETE");
        return reply();
      }
      let updated = row;
      if (!action && method === "PATCH") {
        if (!owner) throw new Failure(403, "Only the reporter can edit this report.");
        const input = await jsonObject(req);
        const changes: Row = {
          title: field(input.title, 160, 1),
          description: field(input.description, 5000),
          address: field(input.address, 500),
          updated_at: new Date().toISOString(),
        };
        // An omitted list leaves existing photos untouched. A supplied list
        // replaces them, after verifying every referenced upload belongs to
        // the reporter and respecting the existing three-image limit.
        if (input.attachments !== undefined)
          changes.attachments = await attachments(input.attachments, user.id);
        [updated] = await db("reports", scoped, "PATCH", changes);
      } else if (action === "status" && method === "PATCH") {
        const input = await jsonObject(req);
        if (!["reported", "acknowledged", "in_progress", "resolved"].includes(input.status)) throw new Failure(400, "Invalid status.");
        // Administrator status changes are always written with an audit event
        // in the same database transaction. Ordinary authors may only resolve their own reports.
        const assigned = await privilege(user.id);
        if (assigned) {
          await runAdminTransaction("civic_admin_moderate", {
            p_actor_id: user.id, p_target_id: id, p_action: "report_status",
            p_status: input.status, p_reason: "",
          });
          [updated] = await db("reports", lookup(id));
        } else if (owner && input.status === "resolved") {
          [updated] = await db("reports", { ...lookup(id), status: "eq." + row.status }, "PATCH",
            { status: input.status, updated_at: new Date().toISOString() });
        } else {
          throw new Failure(403, "You cannot change this status.");
        }
      } else if (action === "confirmations" && method === "POST") {
        if (row.status === "resolved") throw new Failure(400, "This report is resolved.");
        await db("confirmations", {}, "POST", { report_id: id, user_id: user.id }, true);
      } else if (action === "comments" && method === "POST") {
        const input = await jsonObject(req);
        const photos = await attachments(input.attachments, user.id);
        const [created] = await db("comments", {}, "POST", { report_id: id, author_id: user.id,
          parent_id: input.parentId == null ? null : field(input.parentId, 36, 36),
          body: field(input.body, 5000, photos.length ? 0 : 1), attachments: photos });
        return reply(comment(created), 201);
      } else throw new Failure(404, "API route not found.");
      if (!updated) throw new Failure(409, "The report changed. Reload it and try again.");
      const confirmations = await db("confirmations", { report_id: "eq." + id, order: "user_id" });
      return reply(issue(updated, confirmations.map(r => r.user_id)));
    }
    throw new Failure(404, "API route not found.");
  } catch (cause) {
    const status = cause instanceof Failure ? cause.status : cause instanceof SyntaxError ? 400 : 500;
    const message = cause instanceof Failure ? cause.message : status === 400 ? "Invalid request body." : "CivicWatch could not complete the request.";
    return reply({ error: { code: status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED", message } }, status);
  }
}
