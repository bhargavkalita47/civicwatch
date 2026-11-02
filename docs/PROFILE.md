# Profile feature

Profile is available through the shared desktop/mobile navigation and the account avatar. Community Reports continues to show watched-town reports. My Reports belongs to Profile and includes Active, Resolved and All reports (all of the current user's reports, newest first by default). Search, multiple issue-type filters, status filters and most-supported sorting remain available within My Reports.

All personal fields are optional. An empty name displays as CivicWatch member. Profile city is display text only; it never changes report coordinates or the town watchlist. The single website/social link must use HTTP or HTTPS. Email remains in private Account settings, opened using the button at the bottom of Profile.

## Service boundaries

- `CivicService.getProfile`, `updateProfile` and `prepareProfilePhoto` provide the typed profile interface.
- Mock profiles are stored in the existing version-1 dataset's optional `profiles` collection, keyed by user ID. Older datasets need no destructive migration. Profile and public author name changes use one storage write; failure leaves the saved data unchanged.
- The form sends only changed fields. Photo preparation is local and does not persist until Save. Input is limited to JPG/PNG/WebP, 5 MB, and center-cropped to a 384px square with metadata stripped by canvas encoding. Photos can be replaced or removed.
- The existing API adapter reserves GET/PATCH `/profile` and PATCH `/issues/:id` contracts. These server handlers are not implemented in this frontend feature. Profile photo preparation in API mode reports a configuration error. Full feature testing uses mock mode (the default).
- `updateIssue` allows only the owner of a report with status `reported` to edit title, description and street/landmark. Coordinates, attachments, author, status and discussion remain intact. Owner deletion follows existing service permissions and removes the discussion after confirmation. Status changes remain in the existing report thread.
- Authentication controls for Google, Facebook, other providers and email/password are explanatory, disabled placeholders. Existing local sign-in/sign-out is preserved. No OAuth, password, Supabase or ImageKit integration is introduced.

## Interaction checks

Edit Profile and Edit Report preserve drafts on service errors. Cancel, backdrop and Escape ask before discarding dirty drafts; browser departure uses `beforeunload`. Closing is blocked during image preparation or save. Canceling the native image picker leaves the form open and all data intact. Saving updates the profile immediately and refreshes the account avatar/name and public report author labels. Failed follow-up reads do not misreport a successful save.

Mobile uses one column, wrapping report actions, 44px controls and sticky save/cancel actions with safe-area padding. The same navigation drawer serves all destinations. My Reports reuses the shared search field, category chips, Filters dialog and sorting toolbar. Selected report tabs use lavender.

## Validation

Run `npm run verify` under the repository's Node 22 runtime. Under Node 25, use `NODE_OPTIONS=--no-experimental-webstorage` to avoid Node's native localStorage shadowing jsdom in both existing and new tests.

Automated coverage includes optional-field persistence across sign out/sign in, partial updates, safe URLs, storage failure/retry, report ownership/status restrictions, image crop/size/type/error handling, photo-picker cancel, draft dismissal/departure guards, saving state, and personal report counts/tabs/map callbacks. Existing report, map, discussion and mobile-nav checks remain enabled.

Manual browser checks: profile navigation/avatar entry, saved city/bio after reload, desktop and 390px mobile layouts, mobile edit form/save controls, and retained community Reports navigation.
