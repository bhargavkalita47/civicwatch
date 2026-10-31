# CivicWatch — Editorial hierarchy and navigation (v2.1)

## Reports section: information priority

1. **Context**: The Reports hero states that the page is scoped to towns in the local watchlist.
2. **Primary data**: One large, unfiltered total report count for all saved towns, with a Manage watchlist link.
3. **Subsections**: Two equally prominent tabs, Active (reported, acknowledged, in progress) and Inactive (resolved), each with its unfiltered count and selected state.
4. **Task controls**: Search, categories, optional status filtering for Active, and sort inside the selected subsection.
5. **Content**: Report cards showing title, category, area, people, replies, and status. Clicking opens the original discussion thread, including for resolved reports.
6. **Empty cases**: No saved towns routes to Local Snapshot; no reports in a subsection suggests the other subsection; filtered-out results suggest clearing filters.

Counts on Overview continue to be platform-wide; Local Snapshot combined metrics and Reports counts are watchlist-wide, but Reports list counts are derived from available report records to match the cards shown. The page does not invent reports for a place without any matching records.

The existing regular-weight Instrument Serif editorial typography and low-opacity lavender/coral or teal/coral atmospheric surfaces are unchanged. Report selectors use Inter for functional labels and data, with equal visual priority to each subsection.

---

# CivicWatch — v2.0 interface hierarchy

## Options considered

**A. Editorial clarity (chosen).** Regular Instrument Serif carries the parody and the page identity. Inter carries functionality, counts and long scannable lists. Restrained coral/lavender/teal accents and consistent spacing avoid visual noise.

**B. Operational dashboard.** Compact Inter-heavy layout and denser statistics prioritise throughput but weaken the distinctive satirical editorial identity.

**C. Maximal satirical magazine.** Oversized statements and loud accents create a distinctive voice but crowd the reporting map and make states and actions harder to scan.

## Global visual priority

| Rank | Element | Typography on desktop | Expected emphasis |
|---|---|---|---|
| 1 | Page headline | Instrument Serif regular 48–68 px | One per page; identifies page purpose |
| 2 | Main section heading | Instrument Serif regular 30–38 px | Introduces major content e.g. active map, stats |
| 3 | Panel/dialog heading | Instrument Serif regular 24–30 px | Groups actions and local content |
| 4 | Actions, list titles, totals | Inter 14–16 px, semibold/bold; numbers 34–40 px | Functional, legible and independently scannable |
| 5 | Descriptions and body text | Inter 14 px, regular/medium | Explanations and steps, no competing headline styling |
| 6 | Labels and metadata | Inter 11–12 px | Quiet timestamps, captions, badges |

**Hero supporting copy is also Instrument Serif regular**, at 19–23 px, below the H1 in size and contrast. The eyebrow is Inter uppercase (11 px). Instrument Serif has only regular and italic weights from Google Fonts. Synthetic bold is disabled for all serif headlines, including nested emphasis. No paid font file is included.

## Layout priorities by destination

- **Overview:** one primary H1 in the intro; map directly under its H2 with a subdued action. Map uses full content width and dominates the page; all four PLATFORM-WIDE statistics appear after the map, with the heading “The big picture, unfortunately.” These always come from `stats.platform`, never a personal watchlist. The resolved-issue archive is accessible via Reports → Inactive for watched towns.
- **Local Snapshot:** page H1, a full-width watchlist-only aggregate section titled “Numbers that speak for themselves”, then the reorderable town rail and a focused selected-town detail. The selected-town map precedes smaller local figures, resolution rate and recent reports. There is only one major metric section. Watchlist totals change with membership (not selection) and people are deduplicated across watched towns.
- **Explore:** page H1, a smaller H2 within the workspace, search/filter tools, then the map and readable report list. The location and issue metadata are intentionally quiet.
- **Reports / My Reports:** shared workspace H2, filters and consistent Inter issue titles; Reports adds a watched-town total and Active/Inactive subsection switch.
- **Report and sign-in forms:** modal H2 → step titles H3 → clear input labels → helper text. Actions share consistent button sizes; validation text stays functional.
- **Threads:** 30–41 px Instrument Serif headline, separate discussion H3 and readable comments. Metadata is not presented as a heading.
- **Help / Admin / empty states:** follow the same H2/H3 and body sizing rather than using ad-hoc labels.

## Interaction and accessibility

- Existing Lavender/Coral light and Teal/Coral dark colour values are preserved. Quiet, theme-aware gradients are used for background atmosphere, section header surfaces, selected navigation/watchlist items, equal-weight metric cards and the report CTA.
- Primary report action is the only persistent coral CTA, with a very subtle coral gradient; secondary actions remain neutral.
- Report status, map-category pin colours and data logic do not change.
- Active primary-navigation buttons also expose `aria-current="page"`.
- Content text sizes avoid the widespread 9–10 px legacy overrides; UI controls use accessible tap-size targets where possible.
- Responsive breakpoints at 1050, 790, 600 and 390 px preserve the same typographic order without overflow.
- `src/hierarchy.css` is loaded LAST in `src/main.tsx`; make future hierarchy changes here, not in legacy stylesheets.

## Checks

Run `npm run validate:design` for dependency-free source checks, then `npm ci && npm run verify` when npm dependencies and the network/package cache are available. The full build needs React/Vite dependencies; it cannot be inferred from CSS parsing alone.

## v1.9 visual changes

- Restored the regular (400) native Instrument Serif weight everywhere editorial serif is used; the hero paragraph is also regular.
- Added restrained lavender/coral/teal atmospheric gradients to page, rail, map header, workspace section headings, selected destinations and equal-priority statistics; dark mode uses quieter teal/lavender washes.
- Left map tiles, report pins, issue cards, status badges, form fields and accessibility indicators unaltered.
- Gradients are static, preserve light/dark readability, and do not add images or external dependencies.

## v2.0 watchlist interaction and statistic scopes

- Every town row exposes a drag grip with pointer capture so a mouse, touchscreen or stylus can reorder locations. Rows visually signal the source and destination. Long lists scroll when dragging near the edges. Up/down buttons and arrow keys on the grip provide keyboard alternatives. Order persists in browser storage.
- The watchlist's aggregate metrics are report, open, resolved and unique participant counts for **the set of saved towns**. The count calculation uses the city's service-provided totals when available and deduplicates people using issue author/confirmation IDs across all watched cities. Duplicate IDs are ignored. Switching the selected town does not change this aggregate.
- Below the watchlist, selected-town data is subordinate: a town heading, a local map, small per-town numeric facts, a resolution rate and recent reports.
- The Overview metrics continue to come only from the service's platform aggregate, independent of any user's saved towns.
- `src/domain/watchlist.test.ts` covers moving towns, no-op/invalid reorders, watchlist scope, duplicate towns, empty state, unique users across towns and incomplete snapshots.
