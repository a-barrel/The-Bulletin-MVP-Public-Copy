# Bookmark Navigation & Offline Behavior

This note explains how the Sprint 3 bookmark experience behaves, especially when the client is offline. Share it with QA and support teammates who need to understand what is expected.

## Quick Navigation Cache

- The global nav menu persists up to four recently updated bookmark collections (plus "All" and "Unsorted") in `localStorage` using the key `pinpoint:bookmarkQuickNav`.
- Cache entries include a schema version (`2`) and an `updatedAt` timestamp. Entries older than 10 minutes are purged the next time the menu opens.
- Hidden collections are tracked separately via `pinpoint:bookmarkQuickNavPrefs` (version `1`). Users can toggle visibility from the Bookmarks page; preference updates emit a `pinpoint:bookmarkQuickNavPrefsChanged` event so other tabs stay in sync.

## Offline Expectations

- When the client detects offline mode, the quick navigation menu still renders whatever was cached most recently. A banner communicates that only cached collections are available.
- Creating or renaming collections while offline does not update the cache immediately. Once the app reconnects and the menu is opened, it refreshes and replaces stale entries.
- Clearing site data removes both the cache and hidden-preference keys. On the next launch the menu falls back to the default set (Profile, Settings, Bookmarks, Updates) until a fresh sync occurs.

## Troubleshooting

1. If the menu shows outdated collections, clear `localStorage` keys `pinpoint:bookmarkQuickNav` and `pinpoint:bookmarkQuickNavPrefs`, reload, and reopen the menu.
2. Ensure the Express server is running if you expect new collections to appear—offline emulation will not fetch remote updates.
3. When reporting bugs, capture the contents of those keys along with the browser console log so engineering can reproduce the state.
