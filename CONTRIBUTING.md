# Contributing to CivicWatch

CivicWatch is currently a working frontend with a browser-local service adapter and a Cloudflare backend scaffold. Keep that distinction explicit when changing features or documenting behaviour.

## Workflow

1. Start a focused branch from the latest `main`, such as `feat/...`, `fix/...`, or `docs/...`.
2. Make the change in this repository and keep the existing service contracts wherever possible.
3. Run the relevant checks and describe any checks you could not run.
4. Open a pull request against `main`; include the problem, resulting behaviour, and screenshots for visible changes.
5. Review GitHub checks and the Cloudflare preview, merge when ready, and delete the merged branch.
6. Check the production build after merging.

Use `dev/backend-integration` when backend implementation begins. Keep `main` as the stable frontend baseline while that work is reviewed.

## Local setup and checks

Use Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Before merging:

```bash
npm run verify
python scripts/check_schema.py
```

See [README.md](README.md) for configuration and [docs/VERIFICATION.md](docs/VERIFICATION.md) for manual checks. Python is needed for the schema check. Worker integration changes should also be checked with `npm run dev:worker` and `npm run deploy:dry-run`.

## Engineering conventions

- Use TypeScript domain models and stable IDs.
- Keep report fixtures and catalogues outside UI components.
- Route data, session, geocoding, and upload operations through the service layer.
- Preserve loading, empty, success, and error states; handle partial failures without repeating successful writes.
- Keep the mock and HTTP adapters aligned with `CivicService`.
- Validate permissions and inputs on the server when implementing real APIs. Preview roles and client IDs are not authentication.
- Keep secrets out of Git and public `VITE_` variables.
- Add focused regression coverage for meaningful behaviour changes.

## Interface conventions

- Keep the core flow clear on mobile: select a location, add details, save.
- Preserve light map tiles in both interface themes.
- Use Instrument Serif selectively for editorial highlights and Inter for controls and dense information.
- Keep labels factual and plain; use civic satire in supporting copy without mocking residents or rewriting their submissions.
- Check keyboard access, focus handling, reduced motion, narrow screens, and light/dark contrast.
- Keep report-form state intact when cancelling file selection or camera capture.
- Preserve separate scopes for Overview totals and watched-town totals.

## Issues and pull requests

For a bug, include reproduction steps, expected and actual behaviour, browser/device, and the affected page. Mention whether the dataset is local or API-backed. Remove personal information from screenshots and logs.

For backend changes, describe API/schema effects, migration order, authorization, failure recovery, and staging validation. Update [docs/API.md](docs/API.md), [docs/BACKEND.md](docs/BACKEND.md), and relevant deployment guidance when behaviour changes.

Add notable user-visible changes to [CHANGELOG.md](CHANGELOG.md). Update the README when the feature set or setup changes; historical release notes belong in the changelog.
