# CivicWatch Design Lab (debug branch only)

This is an experimental visual design sandbox based on the **current main branch** and equipped with the font-testing controls previously used on `dev/fonts`.

**Never merge this branch into `main` or cherry-pick its debug code.**

## How to use

1. Run / deploy the `dev/design-lab` branch. If your Cloudflare Pages / Workers integration exposes branch previews, open its branch preview URL. This is not the production `main` deployment.
2. Click the floating **Design lab** button (bottom-right).
3. In **Typography**, select separate interface and editorial fonts or enter any Google Fonts family name. The default is **Public Sans + Instrument Serif**.
4. In **Colors & themes**, click one of six palette presets: CivicWatch original, Cobalt Office, Paper & Ink, Mint Signal, Orchid Night, or Graphite & Amber.
5. Switch between **Light** and **Dark** to preview both versions through CivicWatch's actual theme control.
6. Modify any of the 11 semantic colors using the color inputs (background, panels, navigation, text, muted text, borders, soft surfaces, primary accent, accent text, secondary accent, highlight). These edits live-update all dependent CSS color tokens.
7. Review the built-in **contrast checks**, reset to production colors if needed, or copy the two palettes for later implementation.

Theme and font preferences persist **only within the current browser's localStorage**, and have no effect on backend data. Changing these debug controls does not edit GitHub or Cloudflare configuration.

Color design deliberately **does not recolor the light basemap or issue-category markers**, preserving those separate semantic rules. Some older illustration and minor accent elements may contain hardcoded colors and are therefore excluded from semantic palette testing.

## Fictional demo content

This preview is deliberately **offline for civic data**: its browser UI uses the existing mock service even in a deployed Worker preview, and the preview Worker replies with a 404 for all `/api/*` routes. It does **not** read from or write to the CivicWatch production Supabase project.

On first launch the Design Lab creates a local sample with:

- **40 fictional reports** spanning Guwahati, Shillong, Jorhat and Silchar, including clustered markers and all four report statuses.
- **20 demo comments**, including replies, and representative report support counts.
- A preselected **three-town watchlist** for Local Snapshot and Reports.
- A signed-in **Demo Resident** with authored reports and a profile so My Reports can be previewed immediately. The email uses an intentionally non-deliverable `.invalid` domain.

The entire sample is stored under branch-specific localStorage keys (`civicwatch.design-lab.*`) and is **not live civic data**. You can create, edit or comment on reports without contacting the live API. The original sample is restored with **Design lab → Reset demo**. This reset clears only local demo records, the demo session and the demo watchlist; it keeps your chosen font and color previews.

The light map continues to load tiles from OpenStreetMap when internet access is available. That raster tile provider is separate from the mock civic-data service.

## Promotion into production

Only after choosing a final combination, make a **new narrowly scoped branch from the latest `main`** and apply the selected production colors and fonts directly to the real stylesheets; validate mobile and desktop contrast, test builds, and merge that clean production PR.

Never merge `src/components/FontLab.tsx`, `src/components/ColorLab.tsx`, `src/font-lab.css`, or the variable-driven debug typography overrides from `dev/design-lab` into `main`.

## Branch naming

The connected GitHub actions cannot rename or delete Git branches. `dev/design-lab` is the replacement branch with preserved Font Lab functionality, created from updated production main. The former `dev/fonts` branch can be deleted manually through GitHub when no longer needed.
