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
