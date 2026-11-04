import type { WorkerEnv } from "./bindings";

/**
 * DESIGN LAB ONLY — intentionally never route public preview API requests to
 * the CivicWatch production backend. All browser data is fictional/local.
 * This file and the whole dev/design-lab branch must never merge into main.
 */
const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: { message: "Design Lab is a local demo. No live API is available." } }),
        { status: 404, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
