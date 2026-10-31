import { handleApi } from "./api";
import type { WorkerEnv } from "./bindings";

/**
 * A single Cloudflare Worker owns /api/*, and Cloudflare Static Assets serves
 * the compiled Vite frontend. Missing SPA routes fall back to index.html.
 */
const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    // For unmatched assets, ASSETS applies SPA fallback via wrangler.jsonc.
    return env.ASSETS.fetch(request);
  },
};

export default worker;
