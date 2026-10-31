import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf8");
const styles = readFileSync("src/mobile-nav.css", "utf8");
const entry = readFileSync("src/main.tsx", "utf8");

assert.match(entry, /import ["']\.\/mobile-nav\.css["']/);
assert.match(app, /matchMedia\("\(max-width: 790px\)"\)/);
assert.match(app, /className="mobile-topbar"/);
assert.match(app, /className="mobile-menu-trigger"/);
assert.match(app, /className="mobile-report-action"/);
assert.match(app, /className="mobile-nav-backdrop"/);
assert.match(app, /aria-expanded=\{menuOpen\}/);
assert.match(app, /aria-modal=\{isMobile && menuOpen \? true : undefined\}/);
assert.match(app, /inert=\{isMobile && !menuOpen\}/);
assert.match(app, /document\.body\.style\.overflow = "hidden"/);
assert.match(app, /event\.key === "Escape"/);
assert.match(app, /event\.key !== "Tab"/);
assert.match(app, /drawerCloseRef\.current\?\.focus\(\)/);
assert.match(app, /menuButtonRef\.current\.focus\(\)/);
assert.match(styles, /@media \(max-width: 790px\)/);
assert.match(styles, /\.site-header\.mobile-drawer-open/);
assert.match(styles, /translateX\(-105%\)/);
assert.match(styles, /\.site-header \.main-nav \{/);
assert.match(styles, /flex-direction: column/);
assert.match(styles, /prefers-reduced-motion/);
// The nav remains one shared set of controls. No detached mobile-only nav copy.
assert.equal((app.match(/<nav className="main-nav"/g) || []).length, 1);
for (const destination of ["overview", "snapshots", "explore", "reports", "mine", "admin"]) {
  assert.match(app, new RegExp(`setTab\\("${destination}"\\);[^}]*closeMenu\\(\\)`));
}
console.log("Responsive navigation checks: desktop rail, mobile drawer, focus, scroll lock, and shared destinations: OK");
