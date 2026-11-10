import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

// The checked-in Wrangler file intentionally uses strict JSON (valid JSONC)
// so CI can validate it without adding a dependency.
const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

assert.equal(typeof wrangler.name, 'string');
assert.match(wrangler.name, /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
assert.equal(wrangler.main, './worker/index.ts');
assert.ok(existsSync('worker/index.ts'));
assert.equal(wrangler.assets.directory, './dist');
assert.equal(wrangler.assets.binding, 'ASSETS');
assert.equal(wrangler.assets.not_found_handling, 'single-page-application');
assert.ok(wrangler.assets.run_worker_first.includes('/api/*'));
assert.ok(!('pages_build_output_dir' in wrangler), 'Pages configuration must not be used in Workers');
assert.ok(!existsSync('functions'), 'Pages Functions cannot be deployed with Workers');
assert.ok(!existsSync('public/_routes.json'), 'Pages Functions route manifest should not be included');
assert.equal(lock.packages[''].version, pkg.version);
assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
assert.ok(existsSync('dist/index.html'), 'Build must create dist before validation');
assert.ok(existsSync('dist/_headers'), 'Vite must copy security headers to dist');
const mapConfig = readFileSync('src/config.ts', 'utf8');
assert.match(mapConfig, /serviceMode: uiCleanupDemo \? "mock" : import\.meta\.env\.PROD \? "api"/,
  'Live production must retain API authentication; only opted-in previews may use isolated demo data');
assert.match(mapConfig, /new URLSearchParams\(window\.location\.search\)\.get\("demo"\) === "1"/,
  'Demo mode must require an explicit preview URL or demo flag');
assert.match(mapConfig, /storageKey: uiCleanupDemo \? "civicwatch\.ui-cleanup-demo\.dataset\.v1"/,
  'Demo browser data must use a separate storage namespace');
assert.ok(wrangler.vars?.SUPABASE_URL?.includes('caacglqvyfwatnazhjie.supabase.co'),
  'Production must target only the dedicated CivicWatch Supabase project');
assert.equal(wrangler.vars?.SUPABASE_URL, wrangler.previews?.vars?.SUPABASE_URL,
  'Production and preview must use the same dedicated CivicWatch project');
assert.equal(wrangler.vars?.SUPABASE_PUBLISHABLE_KEY, wrangler.previews?.vars?.SUPABASE_PUBLISHABLE_KEY,
  'Production requires its public Supabase publishable key');
assert.ok(!('SUPABASE_SERVICE_ROLE_KEY' in (wrangler.vars || {})),
  'Private service-role credentials must only be Cloudflare secrets');
const mapSource = readFileSync('src/components/CivicMap.tsx', 'utf8');
assert.ok(mapConfig.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png'), 'OSM keyless tile URL must be the default');
assert.ok(mapConfig.includes('VITE_TILE_URL'), 'Raster tiles must remain configurable');
assert.ok(mapSource.includes('config.tileAttribution'), 'Tile attribution must be visible');
assert.ok(existsSync('src/services/geo.ts'), 'World-wide place search service must remain provider-independent');
assert.ok(existsSync('backend/migrations/0005_unrestricted_reporting.sql'), 'D1 unrestricted area migration is required');
assert.ok(!/basemaps\.cartocdn\.com|VITE_CARTO_API_KEY/.test(mapConfig + mapSource), 'CARTO must not be a default dependency');
console.log('Workers entry, static assets, API routing, package lock and keyless OSM basemap: OK');
