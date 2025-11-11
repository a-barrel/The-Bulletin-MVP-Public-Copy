## Development Maintenance Notes

### Port & Proxy Baseline
- **API** defaults to `http://localhost:8000` in dev; the Vite server runs on `http://localhost:5173`.
- Vite proxies `/api`, `/images`, and `/sounds` to the API origin so the browser never needs to talk directly to port 8000.
- Legacy references to `localhost:5000` are still rewritten at runtime for backward compatibility, but nothing listens on that port by default.

### Timing Instrumentation
- Express now emits timing labels for chat endpoints (`chat:*`) and pin endpoints (`pins:*`). Watch the backend console while reproducing a scenario to catch slow Mongo queries.
- In offline mode those timings are mirrored to `DEV_LOGS/<category>.log`, giving you a shareable trace without polluting Git.
- Any HTTP responses with status ≥ 400 are logged to `DEV_LOGS/http-errors.log` during offline runs, alongside the console warning.
- Integration failures (Firebase syncs, Tenor API, analytics, etc.) append stack traces to `DEV_LOGS/integrations.log` when run offline.
- When debugging, search for the relevant prefix (e.g. `pins:nearby`, `pins:list`, `pins:detail`, `pins:replies`) to see how long each DB hop took.
- Tenor GIF search always runs with `contentfilter=high` unless you override `TENOR_CONTENT_FILTER` (`off|low|medium|high`). Only bump it down when QA explicitly needs spicier results—otherwise keep it at `high` so `/gif` commands stay campus-friendly.

### Asset Hosting
- All UI icons come from local assets or Material UI components; external SVG CDNs (e.g. svgrepo) are no longer used in development.
- Cached assets served by Vite may return `304 Not Modified`; that is expected and simply indicates the browser reused its local cache.
- Any missing `/images/...` reference now returns `UNKNOWN_TEXTURE.jpg` (Valve’s purple/black grid) from `server/uploads/images`. Replace that file if you want a different “broken texture” indicator.

### Sample Data Refresh (2025-11-09)
- Added the new `options` object to every pin (and exposed it through the API) so Darrel’s routes can toggle bookmarks/replies/visibility. Re-import pins with `node scripts/load-sample-data.js --collections pins` after pulling latest.
- Seed library now includes 20 additional hiking/sport-focused pins plus two goofy discussions, all expiring in 2026 for stable demos.
- Every example user ships with a banner pulled from `/images/background/background-06.jpg` onward; see `TODO-AND-IDEAS/user-banner-map.md` for the assignment list.

### Seed Image Pipeline
- Drop raw assets into a temporary folder and run `scripts/process-seed-images.sh <dir> <category>` (categories: `background`, `discussion`, `event`). The script auto-resizes to centered 512×512 JPGs, increments names (e.g. `event-21.jpg`), and optionally deletes the originals with `--cleanup`.
- The helper uses ImageMagick’s `convert`, so install it (or ensure WSL has it) before running bulk imports.

### Image Extension Resilience
- The server now sanity-checks `/images/...` paths against `server/uploads/images`. If a document references `/images/background/background-06.png` but only a `.jpg` exists, the response rewrites itself to the correct file.
- Tests live in `server/test/utils/media.test.js`; add more cases there when introducing new asset types or folders.
- Seed JSON now omits explicit file extensions (e.g., `/images/background/background-06`), so the resolver controls which asset variant to serve. Keep following that convention when adding new fixtures.

### Client/Server Error Logging
- All offline HTTP 4xx/5xx responses are already mirrored to `DEV_LOGS/http-errors.log`. To capture frontend issues too, the SPA now posts structured events to `/api/dev-logs`, which writes to `DEV_LOGS/client-errors.log`.
- Window-level `error` and `unhandledrejection` listeners plus targeted API catches (starting with `fetchPinsNearby`) ensure console errors aren’t silently lost; extend `client/src/utils/clientLogger.js` for additional sources as needed.
- Production (Render) now mirrors `logLine` events into MongoDB via `server/models/LogEvent`. Tune with:
  - `PINPOINT_LOG_TO_MONGO=true|false` (defaults to `true` online).
  - `PINPOINT_LOG_MONGO_MIN_SEVERITY=warn|error|fatal` (defaults to `warn`).
  - `PINPOINT_LOG_TTL_DAYS=14` to adjust retention.
  - `PINPOINT_ENABLE_FILE_LOGS=true` if you need legacy filesystem logs outside offline mode.
- Client consoles can get noisy with CSS parser warnings. The filter in `client/src/utils/styleWarningFilter.js` now runs by default; set `VITE_SUPPRESS_STYLE_WARNINGS=false` if you explicitly need to see those “Declaration dropped/Unknown property” messages while debugging browser quirks.
- Debug-only APIs (`/api/debug/moderation/*`, `/api/debug/bad-users/*`, etc.) no longer fire in production builds unless `VITE_ENABLE_DEBUG_API_CALLS=true`. Flip that flag when you’re actively using the Debug Console online—otherwise the app skips those requests so Render logs stay clean.
- See `docs/logging-playbook.md` for mongosh/Compass snippets that help query the new `LogEvent` collection quickly.

### Dependency Health (audit run 2025‑11‑04)
- **Root:** `@babel/preset-env`/`@babel/preset-react` (minor bumps available), `concurrently@9`, `eslint@9`, `eslint-plugin-react-hooks@7`.
- **Server:** Major upgrades available for `express@5`, `mongoose@8`, `firebase-admin@13`, `zod@4`; consider scheduling targeted migrations.
- **Client:** Minor bumps for `@mui/material`/`icons`, `axios`, `vite@6.4`, plus larger jumps (`vite@7`, `firebase@12`, `react@19.2`).
- Re-run `npm outdated` in each workspace before the next sprint to keep this list fresh.
