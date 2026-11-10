import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const read = (name) => readFileSync(name, "utf8");
const rls = read("supabase/migrations/20261103104146_civicwatch_public_moderation_rls.sql");
const live = read("worker/live.ts");
const workerRouter = read("worker/api.ts");
const config = read("src/config.ts");
const form = read("src/components/Forms.tsx");
const wrangler = read("wrangler.jsonc");

assert.match(rls, /create policy civic_reports_public_read[\s\S]*?using \(moderation_state = 'visible'\)/i,
  "Public report reads must be limited to visible reports");
assert.match(rls, /create policy civic_comments_public_read[\s\S]*?moderation_state = 'visible'[\s\S]*?exists\s*\(/i,
  "Public comments must only expose visible content attached to visible reports");
assert.match(rls, /civic_reports_visible_recent/,
  "Visible reports require an indexed access path");
assert.match(live, /async function boundedJson\(req: Request\)/,
  "JSON requests must have a bounded streaming parser");
assert.doesNotMatch(live, /await req\.json\(/,
  "Do not parse unbounded request JSON in a Worker");
assert.match(live, /env\.GOOGLE_OAUTH_ENABLED === "true"/);
assert.match(live, /env\.FACEBOOK_OAUTH_ENABLED === "true"/);
assert.match(workerRouter, /GOOGLE_OAUTH_ENABLED, FACEBOOK_OAUTH_ENABLED/);
assert.match(config, /googleOAuthEnabled: !uiCleanupDemo && env\.VITE_GOOGLE_OAUTH_ENABLED === "true"/);
assert.match(form, /config\.googleOAuthEnabled &&/);
assert.doesNotMatch(wrangler, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_\w+/,
  "Keep privileged credentials out of committed Wrangler configuration");

function scan(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, item.name);
    if (item.isDirectory()) scan(path);
    else if (/\.(?:js|jsx|ts|tsx|mjs)$/.test(item.name))
      assert.doesNotMatch(read(path), /SUPABASE_SERVICE_ROLE_KEY|sb_secret_[a-zA-Z0-9_-]+/,
        "Privileged credentials must not be referenced in browser source: " + path);
  }
}
scan("src");
console.log("CivicWatch security regression checks: RLS, bounded input, OAuth gating and secret boundaries: OK");
