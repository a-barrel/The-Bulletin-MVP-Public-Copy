# Backlog Ideas (2025-10-21)

- **[Done 2025-10-21] Promote profile update endpoints:** `/api/users/me` now supports display name, bio, avatar, theme, and location sharing updates and the profile page saves through it while keeping the debug route available for tooling.
- **Profile polish follow-ups:** consider banner uploads, richer preference toggles (notifications, radius), and admin-level mutations for editing other users when needed.
- **[Done 2025-10-21] Launch production proximity chat writes:** `/api/chats/rooms`, `/rooms/:roomId/messages`, and `/rooms/:roomId/presence` now create data with the shared service used by the debug console, so authenticated users can spin up rooms, post messages, and send presence heartbeats without touching the debug endpoints.
- **Chat follow-ups:** layer in access control (owner/mod/participant rules), real-time delivery (websocket or SSE), and cleanup jobs for stale rooms/presence.
- **Expand bookmark management:** Mirror the debug-only bookmark and collection creation features in `server/routes/bookmarks.js` to support notes, reminders, and collections from the core app rather than just the debug console.
- **[Done 2025-10-21] Automate updates/feed generation:** Pin creation, replies, and attendance changes now emit Update documents for relevant users via shared fan-out helpers, so `/api/updates` returns live activity instead of relying on debug inserts.
- **Update follow-ups:** expand fan-out to additional events (bookmarks, chat), add delivery preferences per user, and surface unread counts in the UI.
- **[Done 2025-10-21] Script sample data seeding:** Added `server/scripts/load-sample-data.js` plus the `npm run seed:samples` task, enabling one-command refreshes (with collection filters, dry-run mode, and custom data directories) from the fixtures in `docs/mongodb-local-sample-data`.
- **Sample data follow-ups:** consider per-environment presets (e.g., smaller mobile datasets), add sanity checks for referential integrity, and wire CI smoke tests against the fixtures.
- **[Done 2025-10-21] Build first-class chat UI:** `ChatPage.jsx` now lists rooms, supports creation/discovery, live messaging, and presence heartbeats through the production chat APIs.
- **[Done 2025-10-21] Create user settings hub:** flesh out `Settings_TODO.jsx` so users can manage notification preferences, theme, radius defaults, and account controls via the backed `/api/users/me` endpoint.
- **Settings follow-ups:** surface account security (password reset, linked accounts) and advanced privacy controls once the core UI ships.
- **Replace list feed stub:** hook `ListPage.jsx` into real datasets (nearby pins, bookmarks, "for you") instead of the current `DUMMY_FEED`, and plumb the updates badge into the bell icon.
- **[Done 2025-10-21] Finish bookmarks screen:** `BookmarksPage.jsx` now groups saved pins by collection, offers quick view/remove actions, and replaces the debug JSON dump.
- **Tidy remaining placeholders:** clean up lingering `-todo` routes, refine the forgot password flow, and align page configs once the final UIs land.
- **[Done 2025-10-22] Profile page UX pass:** upgraded `ProfilePage.jsx` with stats, activity highlights, badge chips, preferences, and raw profile toggles, retiring the `_TODO` scaffolding entirely.
- **[Done 2025-10-22] Testing expansion:** replaced the placeholder Jest sanity check with component coverage (`Feed`, `LocationShare`) and utility mocks to keep regressions visible.
- **Testing follow-ups:** layer in integration-level tests (MSW-powered API mocks for profile/updates flows) and bring server routes under test once the suite stabilizes.
- **Expired pin follow-ups:** add API-level safeguards to mark/bookmark checks, include server tests around expired pins, and surface expiry info in the list feed.
- **Navigation polish:** expand the bottom nav and overlay to surface Updates/Bookmarks and feed the unread updates badge once the shared context is wired up.
- **Automation tools:** evaluate layering in Jest (unit tests), Cypress/Playwright (E2E), Husky pre-commit hooks, and GitHub Actions CI to keep lint/tests running automatically as the team stabilizes.

- **Expired Pin Functionality:** handle all use cases of a user seeing an expired pin and guide the user back to the home page should they somehow
access an expired pin.

Implemention of Chat Room visualization: a tab in the debug console with the map
and GPS spoofer, with visual circles for chatrooms that exist - and make it so
it sends update notifications when that user leaves and enters chatrooms. And
double check the chat page if they swapped rooms.

Persistent storage: Firebase persistent storage for online testing. Going to 
wait on this since our demos are localhost offline testing for now. 

Remove "Replies: 3" from the 
"Bookmarks: 13
Replies: 3
Attending: 3 / 50" window

- No indicator that bookmark button actually works
- "" same for  reply button on pin details 

- **[Done 2025-10-22] Fix reply ordering:** Replies now sort by creation timestamp (newest first) in the pins API and both Pin Details UIs, so timelines no longer shuffle based on author data. Added client-side defensive sorting to keep things stable even if upstream ordering changes.
- **Reply follow-ups:** consider threading UI once parent reply support lands, and surface relative timestamps.

- **[Done 2025-10-22] Backfill Firebase accounts for legacy samples:** added provisioning to `server/scripts/sync-firebase-users.js` so any Mongo users without a Firebase auth record get an emulator account (with default password support and dry-run mode). Linking now runs before the usual Firebase-to-Mongo sync, so older fixtures authenticate like the newer ones.
- **Firebase follow-ups:** document the generated passwords and consider per-environment secrets before pointing at production auth.

- **[Done 2025-10-22] Route list + button to pin creation:** wired the List screen CTA to navigate to `/create-pin`, so the quick action now opens the pin composer instead of doing nothing.
- **List follow-ups:** consider guarding with auth state and showing a tooltip/disabled state when offline data is unavailable.

-
