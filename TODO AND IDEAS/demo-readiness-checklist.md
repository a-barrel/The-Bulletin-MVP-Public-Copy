# Demo Readiness Checklist

Use this as the running list for the “lock it down” sprint before next week’s demo. Grouped by theme so we can assign owners quickly.

## Stability & Safety Nets

- [x] Build a dedicated `NotFound` / crash-fallback page and confirm React Router falls back to it on unknown routes or component errors.
- [x] Audit every page for offline guard-rails (cached data, graceful retry messaging, disabled controls when offline).
- [x] Add global error boundaries so catastrophic component failures render the fallback instead of white-screening.
- [x] Verify map/chat components degrade gracefully when geolocation or WebSocket APIs fail or are denied.
- [ ] Implement smoke tests (manual or automated) that hit critical flows after each deploy/handover.

## UI / UX Polish

- [ ] Fine-tune Profile, Pin Details (v1/v2), and global visuals (icons, spacing, typography, animations).
- [ ] Ensure loading & empty states exist for every list/detail view (pins, bookmarks, updates, chat).
- [ ] Confirm settings toggles mirror actual persisted preferences (theme, location sharing, notifications).
- [ ] Review accessibility basics: tab order, ARIA labels, high-contrast support, focus indicators.
- [ ] Validate responsive behavior on phones, tablets, and desktop breakpoints.

## Maps & Location

- [x] Expose a real map toggle for the chat-room visualizer layer (lift logic from Debug Console).
- [ ] Rework GPS spoofer to use ±1 mile hops (configurable), and ensure it respects interaction radius rules.
- [x] Add guard rail when spoofed position exits valid map bounds (auto reset or confirm dialog).
- [x] Pre-cache common map tiles or provide offline fallback messaging when tiles fail to load.

## Notifications & Updates

- [ ] Fix bell badge so it live-updates when new updates arrive (not only after visiting the Updates page).
- [ ] Confirm badge/celebration sounds obey the mute toggle and persist across sessions.
- [ ] Add push notification eligibility check and fallback (e.g., local toaster) when browser blocks notifications.

## Data & Backend Integration

- [ ] Automate switching between local storage and Firebase storage when running `npm run devFirebase` or deploying to Vercel/Render.
- [ ] Set up environment variables / secrets in Vercel + Render so we never ship dev keys (include Firebase, Mongo, Map, Auth providers).
- [ ] Create a secrets checklist for teammates (naming, rotation cadence, how to request access).
- [ ] Validate API rate limits, CORS, auth guards, and data validation for all exposed endpoints.
- [x] Run a dependency vulnerability scan (npm audit / snyk) and document required patches.

## Sprint 3 Foundations

- [ ] Design moderation/reporting data model (reports table/collection, status workflow).
- [ ] Implement report submission UI (pins, replies, profiles) with backend API scaffolding.
- [ ] Flesh out blocking rules (visibility, notifications, chat membership, follower relationships) and update UI states accordingly.
- [ ] Prepare admin/moderator views (even if basic) for handling reports and blocks.
- [ ] Decide on escalation policy (email alert, Slack webhook, etc.) for severe reports.

## Deployment & DevOps

- [ ] Document the exact deploy pipeline (build commands, environment matrix, manual steps) for Vercel and Render.
- [ ] Add health-check endpoint(s) so Render can auto-restart unhealthy instances.
- [ ] Ensure logs/metrics are centralized (Vercel/Render dashboards, optional Logtail/Datadog hook).
- [ ] Schedule regular backups or exports for MongoDB/Firestore data.
- [ ] Create a versioned config for feature flags and emergency kill-switches.

## Testing & QA

- [ ] Expand unit/integration tests for API clients (`mongoDataApi`) and reducers/context providers.
- [ ] Add end-to-end smoke coverage (Playwright/Cypress) for auth, map interaction, pin creation, and bookmarking.
- [ ] Record manual QA matrix (browsers, devices, offline mode, low bandwidth).
- [ ] Validate analytics events (if any) fire once and only once per action.
- [ ] Add lint/format/test gates to CI to catch regressions before merge.

## Documentation & Team Process

- [ ] Update README / getting_started with latest setup steps (Firebase, Render, Vercel, env vars).
- [ ] Produce a short “demo script” outlining key flows to show the professor.
- [ ] Draft user-facing release notes for the milestone (major features, known issues).
- [ ] Capture tech debt / refactor targets (decouple components, trim shared state, document module responsibilities).
- [ ] Confirm everyone knows how to work with Git branches (avoid detached HEAD), fetching remote updates, and code review expectations.

## Stretch / Nice-to-Haves

- [ ] Investigate prefetching frequently visited routes for snappier navigation.
- [ ] Explore progressive web app (PWA) setup for offline caching and installability.
- [ ] Add feature metrics dashboard (Map usage, chat joins, bookmarks) for post-demo insights.
- [ ] Plan post-demo backlog grooming session to re-prioritize based on feedback.
