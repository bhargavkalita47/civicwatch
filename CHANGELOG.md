## v2.5.8 — frontend stability and future Vercel staging readiness

- Corrected mobile topbar/search stacking while scrolling.
- Prevented map controls and nested place search from submitting report forms.
- Separated successful writes from failed refreshes to avoid duplicate reports/comments.
- Scoped Explore statuses, synchronized cross-tab authentication, and improved marker and placeholder contrast.
- Aligned current design/cluster validation, added release regression checks, and moved early theme initialization out of inline HTML for strict CSP.
- Added static Vercel configuration without switching from Cloudflare or connecting a backend.
- Full npm build/tests **not run in the patch environment** due unavailable npm registry; Cloudflare staging QA remains required. See `RELEASE_NOTES_v2_5_8.md`.

## CivicWatch v2.5.7 — Explore map controls

- Combined place lookup and report-text filtering into a single Explore search field.
- Place lookup remains explicit via Find place; typing filters reports.
- Replaced disturbance-level quick chips with the six category-group filters.
- Removed the visible Explore anywhere map badge without touching location, map reset, or marker behaviour.
- Kept the full Filters panel for individual issue-category selection.

## v2.5.6 — Mobile navigation overlay fix

- Corrected the mobile drawer and backdrop stacking order so the town search form (and other high-layer page controls) cannot overlap the open menu.
- Kept page content and the mobile header non-interactive while the drawer is open, retaining the existing outside-tap and Escape close behaviours.
- No changes to layout, colours, logo, reporting flows, or watchlist data.

## CivicWatch v2.5.5 — Supplied Brand Mark

- Replaced the old map-pin/check icon with the supplied C-and-eye vector mark.
- Updated desktop sidebar, mobile header and mobile navigation drawer.
- Updated the SVG favicon to match the new brand symbol.
- Kept Instrument Serif wordmark and the existing light/dark theme; the mark uses a coral background and dark ink.
- Added `public/civicwatch-mark.svg` as the unmodified source logo and `src/components/CivicWatchLogo.tsx` for theme-aware rendering.

## CivicWatch v2.5.4 — Town watchlist hierarchy refinement (31 October 2026)

- Replaced three competing empty-watchlist panels with one focused onboarding search. No duplicate Add a town buttons.
- Hidden all combined 0-value cards until the user has selected towns and there are reports to summarize.
- Converted the populated watchlist's four oversized statistic cards into a compact, readable totals strip.
- Avoided repeating a selected town's totals when it is the only watched town; show the resolution rate and reporting activity instead.
- Replaced the icon-only add button with one labelled Add town / Close action, and show drag/reorder buttons only for two or more towns.
- Preserved town selection, place search, suggestions, stored watchlist order, map interactions, reporting and light/dark themes.
- Added focused regression assertions for empty-state and populated-state layout.

## CivicWatch v2.5.3 — Refined Pastel Map & Marker Palette

- brightened the map treatment to better match the light Lavender/Coral CivicWatch theme
- kept roads readable, parks pale green, water powder blue, and buildings softly lavender-tinted
- replaced the muddy marker palette with stronger pastel coral, lavender, amber, and teal markers
- reduced marker darkening so dense clusters stay lively instead of turning muddy

## v2.5.2 — Harmonised civic-report markers

- Recoloured issue pins in coordinated coral, lavender, teal, sage and muted amber families to complement the existing light/pastel CivicWatch map and both app themes.
- Kept all 30 issue category colours distinct, their symbols and labels unchanged, and confirmation-based marker darkening intact.
- Matched the map legend, filter dots, report badges and discussion category accents to a single display-only palette keyed by category ID. This also works with API-fetched category records and leaves source/database colours untouched.
- Replaced the blue map-pin halo and location-selection pin with subtle category-coloured halos and coral highlighting.
- Preserved the existing light basemap, tile treatments, navigation and reporting behaviour.

## v2.5.1 — Soft pastel map refinement

- Retained the existing light OpenStreetMap basemap in both application themes.
- Replaced the earlier, strongly desaturated map treatment with gentle lightening, restrained lavender/coral accents, and near-natural colour saturation.
- Scoped all new styling to Leaflet map tiles only; civic issue markers, controls, attribution, interactions, and other app components are unaffected.
- Kept the desktop sidebar, mobile navigation drawer, and existing map/report features unchanged.

## v2.5.0 — Mobile left-side navigation drawer

- Replaces the horizontal mobile navigation rail (≤790px) with a compact header and hamburger-triggered slide-out left drawer, while keeping the desktop sidebar unchanged.
- Adds an accessible close control, backdrop-to-close, Escape support, keyboard focus containment, focus restoration, scroll locking, and responsive/reduced-motion styling.
- Keeps the existing sidebar's menu items, active state, theme switcher, sign-in/account controls, and administrator access in a single shared navigation component.
- Adds a directly accessible mobile **Report** shortcut outside the drawer.
- Leaves the light map tiles, original typography/palettes, report features, copy, and service architecture unchanged.

## v2.4.0 — Public-facing copy refinement (31 October 2026)

- Removed preview/demo marketing notices from the footer, help, and About sections.
- Updated sign-in note to state the real limitation only when local authentication is active.
- Simplified watchlist persistence text and general error recovery copy.
- Preserved factual local-save and non-public-link notifications while the API is inactive.
- Kept the existing neighbourhood-doomer voice, light map in both themes, and navigation.
- Added clear production launch prerequisites to the README/deployment guide, and set the `.env.example` seed preference to false.
- No backend activation or change to existing domain/service contracts.

## CivicWatch v2.3.0 — Neighbourhood-doomer copy & UI clarity (31 October 2026)

- Applied the user-supplied neighbourhood-doomer voice throughout primary pages, maps, town watchlist, reporting, discussions, alerts, help and About, while preserving factual controls and resident-authored posts.
- Consolidated editorial strings into `src/copy.ts`, including consistent count/grammar helpers.
- Replaced Reports Active / Inactive display names with Open / Resolved, removed redundant heading layers, and retained watchlist-scoped totals.
- Made reporting confirmations honest for local preview and connected modes; added early image type/size validation with actionable errors.
- Simplified empty states, added a direct reporting action for towns with no reports, and corrected resolution percentage when no reports exist.
- Preserved always-light map tiles, current visual themes, drag-reordering and prior feature behaviour.
- Added `scripts/validate-copy.mjs` to the verification workflow.

## CivicWatch v2.2.1 — Always-light maps

- Restored a light basemap in Overview, Local Snapshot, Explore, and the reporting map, regardless of the selected app theme.
- Removed dark tile switching and dark map colour filtering; the rest of the interface can still use dark mode.
- No changes to report data, watchlists, or navigation.

## CivicWatch v2.2 — Fine-tuning

- kept maps dark when the app is in dark mode by adding a dark basemap
- simplified section hierarchy so each tab has one clear hero and lighter secondary copy
- reduced explanatory text in Overview, Local Snapshot, and Reports
- slimmed Reports into a count-first summary with Active and Inactive subsections

# CivicWatch Changelog

## 2.1.0 — Consolidated Reports (31 October 2026)

- Merged the former Community and History navigation into Reports, with Active (reported/acknowledged/in-progress) and Inactive (resolved) subsections.
- Added total watched-town reports and independent unfiltered Active/Inactive counts above the issue grid. Search/sort/categories apply within the selected subsection.
- Restricted the new Reports page to exact town IDs in the saved Local Snapshot watchlist; no platform-wide or neighboring-town leakage.
- Moved watchlist ownership to App to keep the town list and report counts synchronized across navigation, while preserving drag-to-reorder and browser storage compatibility.
- Retained resolved issues, threads, evidence and deep links; updated archived-issue navigation and in-app copy.
- Added first-run empty-watchlist guidance, adjusted responsive layout and accessibility for subsection selectors, and expanded regression tests and design checks.
- Preserved the map-first platform overview, Local Snapshot watchlist totals, regular Instrument Serif, and subtle light/dark gradients.

# v2.0 — Watchlist drag-and-drop + correctly scoped totals (2026-10-31)

- Added a drag grip to every saved town, with mouse/touch/stylus pointer reordering, visual targets and edge scrolling. Kept accessible arrow-key and up/down controls. Saved order persists in the existing browser storage key.
- Moved “Numbers that speak for themselves.” from Overview to Local Snapshot, where it now represents combined totals across all saved towns, not the entire platform. Participants are deduplicated across watched towns.
- Renamed the Overview metrics section “The big picture, unfortunately.” and clarified its numbers always come from platform-wide reporting totals.
- Restored Local Snapshot hierarchy: one primary watchlist-wide statistic section; town selection below; map before small, contextual selected-town statistics and activity.
- Added isolated watchlist aggregation/reorder helpers, unit tests, extra design validation, and updated hierarchy documentation.
- Retained regular Instrument Serif and subtle theme-specific gradients.

# v1.9 — Regular serif and subtle gradients (2026-10-31)

- Reverted all editorial Instrument Serif headings, nested emphasis and hero descriptions to native regular (400); disabled synthetic bold. Inter remains bold for data and important controls.
- Added low-opacity lavender/coral/teal gradients to ambient page/background, navigation, map header, section headers, selected watchlist items, equal-weight metric cards and the primary report action.
- Included theme-specific light and dark treatments and preserved category-marker colours, map clarity, functional status colours, layout and accessibility.
- Updated design hierarchy document, version and CSS validation.

# Changelog

## v1.8.0 — Unified editorial typography and interface hierarchy

- Establishes one final typography/spacing stylesheet (`src/hierarchy.css`) loaded after the theme system, eliminating conflicting heading priorities from legacy CSS layers.
- Uses Instrument Serif **bold appearance** consistently for page hero headings, hero supporting copy, section headings, panel headings and editorial modal/dialog titles. The font only provides regular and italic files; bold is browser-synthesized explicitly.
- Keeps Inter for navigation, controls, dense report titles, body text and tabular metrics.
- Applies a documented six-level size system consistently across Overview, Explore, Local Snapshot, Community, History, My Reports, forms, discussions, administration and empty/error states.
- Improves small text and button hit targets; adjusts mobile/tablet type scaling and spacing; adds active navigation `aria-current="page"`.
- Gives the Overview map primary attention and moves equally styled reporting statistics below it, removing the single disproportionate coral highlight card.
- Keeps light Lavender/Coral and dark Teal/Coral themes, all map marker semantics, service/data architecture and browser-local watchlist behavior unchanged.
- Updates design validation to match the new separate Local Snapshot feature rather than old v1.6 markup.

## v1.7.0 — Satirical complaint copy and town watchlists

- Rewrites editorial copy, empty states, reporting prompts and community-thread text into sardonic civic satire.
- Makes the Overview map full-width and tall; moves all four platform metrics below the map.
- Moves Local Snapshot out of Overview into its own sidebar navigation destination.
- Adds a persistent, ordered town/city watchlist with geocoder search, add/remove/reorder and selected-place details.
- Adds per-town summaries, resolution rate, map, recent reports, and a link to explore the selected town.
- Preserves active-only map pins, archived resolved reports, and preexisting lavender/coral and teal/coral themes.
- Keeps the browser-local preview architecture and backend-ready service contracts unchanged.


## v1.6.0 — Lavender / Coral + Teal / Coral

- Introduces two complete, responsive CivicWatch themes: light Lavender/Coral and dark Teal/Coral.
- Adds a persistent, keyboard-accessible Light/Dark switch without modifying domain state.
- Locks Instrument Serif for headings and Inter for the interface.
- Reorganizes desktop navigation as a clean application sidebar and mobile navigation as a scrollable top rail.
- Redesigns the Overview as real platform aggregates, an interactive active-issues map, ranked reporting areas, and dynamically generated locality cards.
- Preserves worldwide issue reporting, OSM keyless mapping, resolved-history archiving, original-author deletion, and the Worker/D1 backend scaffolding.
- Does not activate authentication, shared persistence, or administrative role changes.


## v1.5
- Removed the promotional hero banner from the Overview page.
- Refreshed the UI with a quieter corporate-minimal visual system.
- Adopted Instrument Serif for editorial headings and Inter for interface typography.
- Retained responsive behaviour and dynamic reporting/location logic from v1.4.

## 1.4.0 — Unrestricted worldwide reporting

- Removed the four-city whitelist and geographic radius check from issue creation.
- Added explicit worldwide place search, reverse lookup with manual fallback, and viewport-driven Explore reports.
- Added service-owned dynamic reporting area registry, preserved legacy preview data, and automatic Overview grouping.
- Added D1 migration and area upsert helper for later authenticated writes.
- Retained resolved issue archive, author-scoped deletion, admin-governance protections, mobile layout and Cloudflare Workers setup.
- Added geometry, dynamic place creation and worldwide reporting integration tests.
- Documented public Photon capacity limits and the provider switch point.

## 1.2.0 — CivicWatch Atlas UI and city reporting

- Replaced blue slab styling with charcoal/grey editorial dashboard system and signal accent.
- Reorganized interface: map-first Explore, independent Overview, Community and My Reports.
- Dedicated async city catalogue and aggregate stats contract, no hardcoded UI totals.
- City-specific map/filter logic, geotagging of existing browser-local issues.
- Four multi-city demo data groups clearly identified as preview samples.
- Creator-only issue deletion with explicit confirmation and discussion cleanup.
- Author-checked D1 delete repository helper, cascading schema migration, tests.
- Preserved Cloudflare Workers static assets + API routing and keyless OSM map.

## 1.1.1 — Keyless map tiles

- Keyless OpenStreetMap raster tile source and configurable tile URL.

## 1.1.0 — Workers source

- Workers entry, typed API scaffold, D1/R2 bindings, verification scripts.

## 1.3.0 — History, governance foundation and responsive refinements
- Removed resolved issues from active issue clustering and map; kept them in a dedicated History section with existing comments.
- Preserved resolved reports in platform and city totals.
- Added a platform-owner/administrator D1 governance schema, audit trail, and server-side role authorization helpers; administrators cannot appoint other administrators.
- Added an access-controlled admin destination with transparent setup state. The actual authenticated admin-management API remains disabled until verified identity is implemented.
- Improved small-screen navigation, map/list stacking, overlays and dashboard cards.
- Documented same-repository GitHub pull-request workflow, automatic Cloudflare deployments and backend activation steps.
