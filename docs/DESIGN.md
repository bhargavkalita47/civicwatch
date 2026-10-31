# CivicWatch design system — v1.6

## Typography
- Instrument Serif: editorial headings, map-card headlines, locality names.
- Inter: navigation, buttons, filters, numbers, statuses, forms.

## Color directions
| Token | Light — Lavender + Coral | Dark — Teal + Coral |
|---|---|---|
| Page | #F6F3FA | #06191C |
| Panels | #FFFAFD | #0A2328 |
| Text | #211A30 | #E9F4F2 |
| Coral action | #FF746E | #FF7574 |
| Secondary accent | #9B81DD | #49C3BC |

`src/themes.css` owns color tokens. Switch by setting `data-theme` on the document root. The preference is saved as `civicwatch.theme.v1`. No report or authentication data is affected. The UI is a sidebar on desktop and a touch-friendly top navigation on mobile.

## Map semantics
Pin colors continue to be generated from issue-category definitions and participation count; dark mode only filters the OSM *tile pane*. Resolved reports never appear as active pins; they belong to History. For high-volume public usage, replace the public OSM raster tiles with a dedicated tile provider via `VITE_TILE_URL`.

## Non-negotiable requirements
The four aggregate metrics, locality list, map markers, discussions, and issue counts come from centralized service contracts, not embedded marketing numbers. No client-side theme choice may modify authorization, persistence, or API behavior. The admin controls remain intentionally backend-integration pending.
