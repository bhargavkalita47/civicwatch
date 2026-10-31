import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = (name) => readFileSync(name, 'utf8');
const copy = read('src/copy.ts');
const app = read('src/App.tsx');
const overview = read('src/components/Overview.tsx');
const watchlist = read('src/components/LocalSnapshots.tsx');
const thread = read('src/components/ThreadPanel.tsx');
const form = read('src/components/Forms.tsx');
const map = read('src/components/CivicMap.tsx');
const photos = read('src/components/ui.tsx');

// Source-of-truth copy and exact user-selected hero headlines.
for (const phrase of [
  'Lower your expectations. Open the map.',
  'Home is where the problems are.',
  'Disappointment has coordinates.',
  'New day. Same complaints.',
  'Your patience has a paper trail.',
  'A scenic view of neglect.',
  'Managed expectations, in numbers.',
  'The usual problems. Your chosen places.',
  'Put it on the record.',
  'The collective sigh',
  'Infrastructure ages. The complaints stay fresh.',
]) assert.ok(copy.includes(phrase), `Missing specified copy: ${phrase}`);
assert.match(app, /copy\.pages\[tab\]\.title/);
assert.match(app, /copy\.pages\[tab\]\.subtitle/);
assert.doesNotMatch(app, /The local paper trail|The venting thread|WATCHLIST FILTERS|YOUR REPORT TOOLS/);
assert.match(app, /copy\.reports\.open/);
assert.match(app, /copy\.reports\.resolved/);
assert.match(app, /reportCount\(reportCounts\[reportSection\]/);
assert.match(app, /watchlistReportGroups\(watchlist, cityIssues\)/);
assert.match(overview, /stats\.platform/);
assert.match(watchlist, /summarizeWatchlist/);
assert.match(watchlist, /copy\.watchlist\.noData/);
assert.match(watchlist, /onPointerDown=/);
assert.match(thread, /copy\.discussion\.heading/);
assert.match(thread, /issue\.description/); // Resident-written content is unchanged
assert.match(thread, /comment\.body/);
assert.match(form, /copy\.reporting\.submit/);
assert.match(form, /copy\.reporting\.titlePlaceholder/);
assert.match(photos, /copy\.errors\.uploadLarge/);
assert.match(photos, /copy\.errors\.uploadType/);
assert.match(app, /config\.serviceMode === "mock" \? copy\.reporting\.saved : copy\.reporting\.published/);
assert.match(map, /L\.tileLayer\(config\.tileUrl/);
assert.doesNotMatch(map, /darkTileUrl|data-theme/);
assert.doesNotMatch(watchlist, /Resolved, apparently/);
console.log('Copy checks: supplied voice, page titles, truthful modes, count labels, watchlist scopes, light basemap, safety copy: OK');
