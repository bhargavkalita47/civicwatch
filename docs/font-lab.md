# Font Lab — dev/fonts only

**Debug branch only. Never merge dev/fonts into main.**

This branch contains an experimental typography panel for comparing font combinations in the live CivicWatch interface. The production branch remains unchanged.

## How to test

1. Check out \`dev/fonts\` or open its branch preview deployment (if your Cloudflare project deploys preview branches).
2. Open CivicWatch and click the floating **Font lab** button at the bottom right.
3. Choose an **Interface / body font** and an **Editorial / display font** independently. Changes appear immediately throughout the interface, including its headings, body copy, reporting UI, maps, statistics, and forms.
4. Use the quick comparisons to switch between common pairings.
5. Choose **Other Google Font…** and enter the exact family name from [Google Fonts](https://fonts.google.com) to try a font not in the dropdown.
6. Use **Reset to original** to return to Instrument Serif + Inter.

Selections are saved under \`civicwatch.debug.font-lab.v1\` in **this browser's localStorage**. They do not change backend data, accounts, other browsers, or the production site. Some custom fonts only load their default weight and may need an explicit production weight configuration if adopted.

## Promoting the chosen typography

**Do not merge this branch or cherry-pick its full diff into main.** When the combination is approved:

1. Start a new branch from the latest \`main\`.
2. Update only the production font imports and the font-family declarations to the approved pairing, using the full supported weight set.
3. Update the existing design validation checks if necessary.
4. Run \`npm run verify\`, review mobile and desktop typography, and merge only that focused production change.
5. Leave \`FontLab.tsx\`, \`font-lab.css\`, and all debug controls in \`dev/fonts\` forever.

The test branch uses CSS variables (\`--cw-font-ui\` and \`--cw-font-display\`) throughout the stylesheets so selections can update without a page reload.
