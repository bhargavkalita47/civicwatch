# CivicWatch neighbourhood-doomer copy guide

The house voice is a fed-up neighbour with excellent records: resigned, observant, locally recognisable, sarcastic about neglect, and helpful in every functional workflow. Never direct jokes at people affected by a civic problem.

## Hierarchy

Each page has **one hero heading and one supporting sentence**, both declared under `copy.pages` in `src/copy.ts`. Nested headings describe a genuine section (map, statistics, local view), rather than repeating the page's intro. On Reports, the headline leads directly into watchlist totals, Open / Resolved subsections, search and report cards.

## Functional terminology

- Keep **Report an issue**, **Open**, **Resolved**, **Town watchlist**, **I see this too**, and literal form field labels stable.
- The data model still uses `active` / `inactive` for subsection IDs, but the user-facing labels are **Open** / **Resolved**. `reported`, `acknowledged` and `in_progress` count as open; `resolved` counts as resolved.
- “Acknowledged” is a state label, not a claim of municipal acknowledgment. Do not imply the government has received a report.
- Preserve resident-authored report titles, descriptions and comments exactly as written.
- Handle singular and plural via `reportCount()` and `countNoun()` where a number is displayed.

## Where copy lives

`src/copy.ts` groups content by `brand`, `pages`, `nav`, `overview`, `watchlist`, `map`, `reports`, `reporting`, `discussion`, `help`, `empty`, `errors` and `actions`. Some short, one-off accessible and legal labels stay close to their UI elements to preserve context. Add reusable or editorial wording to the central copy module.

## Truthful feedback and error handling

- In local storage mode, feedback says **Report saved locally. Not publicly visible.** Do not imply shared publication or verified accounts.
- Connected service: **Report published.** Only after the service confirms success.
- Photo errors identify size and file-type restrictions. Never replace actionable errors with jokes.
- Maps use the same **light OpenStreetMap tiles** even in the Teal/Coral dark interface.
- Keep privacy, emergency and independent-platform disclosures direct. Technical limitations belong in operational notices and deployment documentation, not recurring marketing copy.

## QA checks

Run `npm run validate:copy`, `npm run validate:design` and `npm run build` after installing dependencies (`npm ci`). Check small-screen navigation and hero wrapping, the two report subsections, map themes, watchlist add/remove/reorder, empty states, photo restrictions, and modal labels.
