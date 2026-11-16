import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const css = readFileSync("src/motion.css", "utf8");
const entry = readFileSync("src/main.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const ui = readFileSync("src/components/ui.tsx", "utf8");
assert.match(entry, /import "\.\/motion\.css";/, "Load motion styling");
assert.ok(entry.indexOf('import "./motion.css";') > entry.indexOf('import "./explore-hero.css";'), "Motion must load last");
for (const token of ["--cw-motion-in: 220ms", "--cw-motion-out: 175ms", "--cw-motion-stagger: 30ms",
  "cw-pop", "cw-row", "cw-confirm", "cw-icon-crossfade", "cw-dialog-enter"]) {
  assert.ok(css.includes(token), "Missing motion token: " + token);
}
for (const selector of [".report-list > .issue-card", ".profile-report-list > .profile-report-card",
  ".snapshot-watch-rows > .snapshot-watch-entry", ".people-list > *",
  ".admin-report-item", ".category-select-options", ".explore-search-results",
  ".snapshot-watch-menu", ".theme-control button", ".modal[open]"]) {
  assert.ok(css.includes(selector), "Missing UI coverage: " + selector);
}
assert.match(css, /nth-child\(-n\+12\)/, "Cap staggering on large lists");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "Reduced motion required");
assert.match(css, /leaflet-marker-icon/, "Exclude Leaflet markers");
assert.match(css, /maplibregl-marker/, "Exclude MapLibre markers");
assert.match(css, /:not\(:disabled\):active/, "Disabled buttons must not press");
assert.match(css, /transition-duration:\s*0ms\s*!important/, "No tween while held");
assert.match(css, /@media\s*\(pointer:\s*coarse\)/, "44px touch targets");
assert.match(css, /:root\\s*\\{\\s*-webkit-tap-highlight-color:\\s*transparent;/, "Disable the Android tap highlight across inherited interactive elements");
assert.doesNotMatch(css, /user-select:\\s*none/, "Never disable text selection to suppress a tap highlight");
assert.match(readFileSync("src/styles.css", "utf8"), /button:focus-visible/, "Retain keyboard focus outlines");
assert.match(app, /data-current-section=\{tab\}/);
assert.match(app, /<div className="intro-copy" key=\{tab\}>/, "Hero headline and subtitle are one keyed subtree");
assert.match(app, /<h1>\{copy\.pages\[tab\]\.title\}<\/h1>/);
assert.match(app, /<p>\{copy\.pages\[tab\]\.subtitle\}<\/p>/);
assert.match(css, /main > \.intro > \.intro-copy\s*\{\s*animation: cw-fade/, "Fade the whole hero copy, not individual text layers");
assert.doesNotMatch(css, /main > \.intro h1\s*\{\s*animation:/, "Never transform headline glyph layers");
assert.match(ui, /--cw-motion-origin-x/, "Trigger-oriented dialogs");
assert.match(ui, /dialog\.showModal\(\)/, "Keep native dialog behavior");
console.log("Motion checks: timing, stagger, trigger orientation and accessibility: OK");
