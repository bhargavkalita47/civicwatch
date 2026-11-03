import { categories } from "../src/data/categories";
import type { Attachment, City, Comment, Dataset, Issue, OverviewSnapshot, Profile, Role, Session } from "../src/domain/types";

export interface LiveConfig { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string }
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
  const role = async (id: string): Promise<Role> => {
    const [row] = await db("platform_roles", { user_id: "eq." + id });
    return row?.role === "owner" ? "administrator" : row?.role === "admin" ? "moderator" : "resident";
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
    authorId: r.author_id, body: r.body, attachments: r.attachments || [], createdAt: r.created_at });
  const lookup = (id: string) => ({ id: "eq." + id });
  const areaList = (reports: Row[]) => [...new Map(reports.map(r => [r.city_id, city(r)])).values()];

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
      if (path === "/categories") return reply(categories);
      if (path === "/auth/session") return reply(await session(await actor()));
      if (path === "/watchlist") {
        const [row] = await db("watchlists", { user_id: "eq." + (await actor()).id });
        return reply(row?.towns || []);
      }
      const provider = /^\/auth\/oauth\/(google|facebook)$/.exec(path)?.[1];
      if (provider) {
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
      if (path === "/profile") return reply(await profile((await actor()).id));
      const mediaId = /^\/media\/([^/]+)$/.exec(path)?.[1];
      if (mediaId && uuid.test(mediaId)) {
        const [row] = await db("media", lookup(mediaId));
        if (!row) throw new Failure(404, "Photo unavailable.");
        const contained = "cs." + JSON.stringify([{ id: mediaId }]);
        const [reports, comments, avatars] = await Promise.all([
          db("reports", { select: "id", attachments: contained }),
          db("comments", { select: "id", attachments: contained }),
          db("profiles", { select: "user_id", avatar_url: "eq." + media(row).url }),
        ]);
        if (!reports.length && !comments.length && !avatars.length && (await actor()).id !== row.owner_id)
          throw new Failure(404, "Photo unavailable.");
        const photo = await upstream(`/storage/v1/object/authenticated/${bucket}/${mediaId}`);
        return new Response(photo.body, { headers: { ...headers, "Content-Type": row.mime_type } });
      }
      if (["/dataset", "/cities", "/overview"].includes(path)) {
        const reports = await db("reports", { order: "created_at.desc,id" });
        if (path === "/cities") return reply(areaList(reports));
        const confirmations = await db("confirmations", { order: "report_id,user_id" });
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
          db("comments", { order: "created_at,id" }),
          db("profiles", { select: "user_id,display_name", order: "user_id" }),
        ]);
        const publicAuthors = new Set([...reports, ...comments].map(r => r.author_id));
        return reply({ version: 1, areas: areaList(reports), issues: reports.map(r => issue(r, byIssue.get(r.id))),
          comments: comments.map(comment), users: profiles.filter(p => publicAuthors.has(p.user_id)).map(p => ({ id: p.user_id, displayName: p.display_name, role: "resident" })) } satisfies Dataset);
      }
    }

    if (path === "/auth/sign-in" && method === "POST") {
      const input = await req.json() as Row;
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

    const match = /^\/issues\/([^/]+)(?:\/(confirmations|comments|status))?$/.exec(path);
    if (method === "GET" || (!match && !["/issues", "/attachments", "/profile", "/watchlist"].includes(path)))
      throw new Failure(404, "API route not found.");
    const user = await actor();
    if (path === "/watchlist" && method === "PUT") {
      if (req.headers.get("X-Civic-Account") !== user.id) throw new Failure(409, "The active account changed.");
      const towns = await req.json();
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
      const input = await req.json() as Row;
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
      const input = await req.json() as Row;
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
        const input = await req.json() as Row;
        [updated] = await db("reports", scoped, "PATCH", { title: field(input.title, 160, 1),
          description: field(input.description, 5000), address: field(input.address, 500), updated_at: new Date().toISOString() });
      } else if (action === "status" && method === "PATCH") {
        const input = await req.json() as Row;
        if (!["reported", "acknowledged", "in_progress", "resolved"].includes(input.status)) throw new Failure(400, "Invalid status.");
        if (!(owner && input.status === "resolved") && await role(user.id) === "resident")
          throw new Failure(403, "You cannot change this status.");
        [updated] = await db("reports", { ...lookup(id), status: "eq." + row.status }, "PATCH",
          { status: input.status, updated_at: new Date().toISOString() });
      } else if (action === "confirmations" && method === "POST") {
        if (row.status === "resolved") throw new Failure(400, "This report is resolved.");
        await db("confirmations", {}, "POST", { report_id: id, user_id: user.id }, true);
      } else if (action === "comments" && method === "POST") {
        const input = await req.json() as Row;
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
