import { categories } from "../src/data/categories";
import type { WorkerEnv } from "./bindings";
import { listCities } from "./repository";

const API_PREFIX = "/api/v1";
const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

function json(payload: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function error(status: number, code: string, message: string, headers?: Record<string, string>) {
  return json({ error: { code, message } }, status, headers);
}

/** The router is intentionally NOT a mock backend. Never trust browser identities. */
export async function handleApi(request: Request, env: WorkerEnv): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) {
    return error(404, "NOT_FOUND", "API route not found.");
  }

  const path = pathname.slice(API_PREFIX.length) || "/";
  if (path === "/health" || path === "/categories" || path === "/cities") {
    if (request.method !== "GET") {
      return error(405, "METHOD_NOT_ALLOWED", "This endpoint is read-only.", { Allow: "GET" });
    }
    if (path === "/categories") return json(categories);
    if (path === "/cities") {
      if (!env.DB) return json([]);
      try { return json(await listCities(env.DB)); }
      catch { return error(503, "CITY_CATALOGUE_UNAVAILABLE", "City records could not be loaded."); }
    }
    return json({
      service: "civicwatch",
      status: "integration-pending",
      mode: "mock-frontend",
      apiVersion: "v1",
      bindings: { database: Boolean(env.DB), photos: Boolean(env.PHOTOS) },
      authenticationConfigured: false,
    });
  }

  if (path === "/auth/session" && request.method === "GET") {
    return error(401, "UNAUTHENTICATED", "A verified server session is required.");
  }

  // No cross-origin write can be sent to the scaffold. The eventual cookie-
  // authenticated API must ALSO enforce CSRF and server-side permissions.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) {
      return error(403, "FORBIDDEN", "Cross-origin mutations are not permitted.");
    }
  }

  const pendingRoutes = [
    /^\/dataset$/,
    /^\/overview$/,
    /^\/auth\/(sign-in|sign-out)$/,
    /^\/issues$/,
    /^\/issues\/[^/]+\/(confirmations|comments|status)$/,
    /^\/issues\/[^/]+$/,
    /^\/attachments$/,
  ];
  if (pendingRoutes.some((pattern) => pattern.test(path))) {
    return error(
      501,
      "BACKEND_NOT_ACTIVATED",
      "Public reporting is not available. Shared storage and verified sign-in must be activated first.",
    );
  }

  return error(404, "NOT_FOUND", "API route not found.");
}
