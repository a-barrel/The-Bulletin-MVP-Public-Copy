# Settings Coverage & Expansion Roadmap — 2025-11-17

**Owner:** Troy  
**Status:** Draft (branch `settings-page-expansion-and-cache-research`)  
**Scope:** Audit every existing setting, document implementation status/effort, and design the next expansion wave so the Settings surface can keep scaling without losing clarity.

---

## Objectives
1. **Coverage Audit:** Produce a canonical matrix of every toggle/input (mobile + desktop) that answers *implemented? broken? how hard to finish?* for leadership sign-off.
2. **Expansion Plan:** Define the next wave of settings (notifications, privacy, integrations, accessibility) with UX flows + backend contracts so engineering can swarm them without blockers.
3. **Operational Readiness:** Wire reporting, QA, and documentation loops so future sprints can incrementally add settings without repeating discovery.

---

## Milestones

| Phase | Target | Description | Outputs |
| --- | --- | --- | --- |
| Phase 0 — Recon | Nov 18 | Inventory sources (`SettingsPage.jsx`, `useSettingsManager`, `docs/settings-playbook.md`, FIGMA) and lock audit template. | Component list, audit template seeded. |
| Phase 1 — Coverage Audit | Nov 19 | Walk each setting (app + API) to capture status (“implemented / partial / missing”), issues, and estimated effort. | Filled audit table + CSV export for leadership. |
| Phase 2 — Expansion Design | Nov 20-21 | Draft UX sections for new toggles (Quiet Hours, DM permissions, Labs, caching opts) and write API contracts / data schema diffs. | Wireframes, API checklist, story map. |
| Phase 3 — Implementation Readiness | Nov 22 | Slice roadmap into dev-ready tickets (frontend, backend, QA) tied to metrics + owners. | TODO doc updates + Jira tickets, test checklist. |

---

## Workstream A — Settings Coverage Audit
- **Deliverable:** `settings-coverage-audit-2025-11-19.md` + dashboard snippet summarizing totals (count implemented vs. missing).
- **Actions:**
  - Use `templates/AUDIT_TEMPLATE.md` to log each setting with file references (`client/src/pages/SettingsPage.jsx`, hooks, API endpoints).
  - Note existing bugs (e.g., toggles not persisting, copy mismatches) plus dependencies (`updateCurrentUserProfile`, telemetry).
  - Classify effort: *Trivial (copy/wire up)* / *Medium (needs new API field)* / *Heavy (requires service refactor)*.
  - Export summary table for leadership review; highlight blockers needing product decisions.
- **Success Metric:** 100% of settings documented with status + effort in the matrix; issues mirrored into TODO backlog.

## Workstream B — Settings Expansion (The “more the merrier” push)
- **Goals:** Add breadth without overwhelming users by leaning on tabs/accordions and progressive disclosure.
- **Candidate Areas:**
  1. **Notifications & Focus:** Quiet hours, mute timers, bundle presets, per-surface verbosity.
  2. **Privacy & Safety:** Location radius expiry, global map visibility, advanced blocking.
  3. **Display & Accessibility:** Font/line-height presets, accent colors, granular reduced motion, widget density.
  4. **Data & Integrations:** Export scheduler, API token scopes, third-party connectors, retention reminders.
  5. **Productivity Labs:** Gesture/hotkey preferences, experimental toggles, multi-account quick switcher prep.
- **Artifacts Needed:**
  - UX map (wireframes + copy) for each new subsection.
  - Data schema updates (e.g., `preferences.notifications.quietHours[]`, `preferences.display.density`).
  - Feature flag plan (hide unfinished toggles until backend is ready).
  - Accessibility checklist (tab order, focus, translations).
- **Dependencies:** Backend endpoints, notification fan-out service, data export job queue, instrumentation.

## Workstream C — Implementation & QA Pipeline
- **Ticketization:** Convert each expansion item into bite-sized tickets with acceptance criteria (UI, API, analytics, docs).
- **Testing:** Add Cypress regression for toggles, Jest coverage for hooks, and manual QA checklist (desktop/mobile).
- **Docs:** Update `docs/settings-playbook.md`, release notes, and TODO snapshots after each ship.
- **Rollout:** Staged behind feature flags; gather analytics (settings touched per session, errors) to inform refinements.

---

## Deliverables & Success Metrics
- ✅ Audit matrix delivered with severity + effort tags.
- ✅ Updated Settings roadmap + FIGMA references stored in `TODO-AND-IDEAS`.
- ✅ Ticket backlog (Jira or TODO doc) covering at least the first 2 sprints of work.
- 📈 Target: 90% of settings changes automatically logged via telemetry so regressions are caught quickly.
- 🧪 Target: 0 accessibility violations in axe scan for updated Settings UI.

---

## Risks & Mitigations
- **Backend gaps:** Some toggles (API tokens, auto-exports) need server work → pair tickets, use feature flags.
- **Scope creep:** Too many simultaneous settings can overload QA → gate phases and maintain per-phase exit criteria.
- **UX debt:** Rapid additions might confuse users → lean on tabs + helper copy, validate with quick usability pass.
- **Telemetry blind spots:** Without analytics, we can’t prove adoption → ensure instrumentation lands with each feature.

---

## Next Actions (Settings Focus)
1. Generate audit spreadsheet from code/FIGMA references (assign to Settings pod).
2. Draft UX snippets for Quiet Hours + Notification bundles; review with design.
3. Define data schema updates + API contracts for new preferences.
4. Update TODO doc with ticket stubs referencing this roadmap.

---

## Coverage Snapshot (Initial Audit — Nov 17)

| Tab / Section | UI Locations | Implemented today? | Backend / Data | Issues & Gaps | Expansion Effort |
| --- | --- | --- | --- | --- | --- |
| **Notification Preferences** | `NotificationSettings.jsx`, `NotificationToggleList.jsx`, `useSettingsManager` | ✅ All listed toggles wired to `settings.notifications.*` and quick mute timers | `profiles.preferences.notifications`, `notificationsMutedUntil`, `digestFrequency` | No quiet-hours schedule, no bundle presets, no push/email split, mute durations hard-coded (2h/8h) | Medium — requires schema additions + UI for quiet hours and profiles |
| **Privacy & Sharing** | `PrivacySettings.jsx`, Blocked overlay (`BlockedUsersDialog.jsx`) | ✅ Location sharing, stats visibility, cuss filter, DM permissions, blocked list UI | `profiles.preferences.privacy`, `blockedUsers` API | Location radius expiry + global visibility toggles missing; block list requires online connection; admin dashboard chip depends on runtime config | Medium — new toggles + backend enforcement |
| **Appearance & Density** | `AppearanceSettings.jsx` | ✅ Theme (system/light/dark), text scale, reduce motion, high contrast, celebration sounds, friend badge toggle, map density, list-sync, radius slider | `preferences.display`, `preferences.radiusPreferenceMeters`, contexts (`BadgeSound`, `FriendBadgePreference`) | No accent color presets, no line-height or density presets beyond map, radius slider lacks validation copy for >10 miles | Low/Medium — mostly UI + schema fields |
| **Location Radius & Map Limit** | `AppearanceSettings.jsx`, `useSettingsManager.handleRadiusChange` | ✅ Radius slider persists to profile; map density uses `PIN_DENSITY_LEVELS` | `profiles.preferences.radiusPreferenceMeters`, map/feed hooks | No auto-expiry for radius, no “per-surface” radius (map vs. chat) | Medium |
| **Data & Integrations** | `DataIntegrationsSettings.jsx` | ✅ Auto-export reminders toggle, manual export button, API token CRUD | `/api/users/me/data-export`, `/api/api-tokens` | Export job responds async but no download list; token scopes fixed, no usage metadata | Medium/High — needs backend queue + UI refresh |
| **Feedback & Blocked dialogs** | `FeedbackDialog.jsx`, `BlockedUsersDialog.jsx`, `SettingsPage` | ✅ Feedback modal posts to `submitAnonymousFeedback`; blocked list enumerates/unblocks | Feedback endpoint, `fetchBlockedUsers` (inside hook) | Feedback modal lacks history/status; blocked modal has no search or role gating | Low |
| **Sign-out & reset** | Buttons in `SettingsPage.jsx` | ✅ Sign-out uses Firebase auth; reset restores defaults via hook | `useSettingsManager.handleReset` / `handleSignOut` | No confirmation for destructive reset besides snackbar; telemetry missing | Low |

---

## Detailed Findings by Tab

### Notification Tab
- **Granular toggles:** 12+ toggles driven by `notificationToggleConfig`. ✅ Persisted via `handleNotificationToggle`. Needs analytics to detect unused toggles.
- **Quick mute:** Buttons hard-coded to 2h/8h and rely on `handleQuickMuteNotifications` (sets `notificationsMutedUntil`). No UI for custom durations, quiet hours, or auto-unmute summary.
- **Digest frequency:** Dropdown saved via `handleDigestFrequencyChange`. Values (`immediate`, `daily`, `weekly`, `never`) already stored but not surfaced to backend digest worker (needs confirmation).
- **Focus Ideas:** Add Quiet Hours schedule, per-surface verbosity (chat vs. events), channel bundles for onboarding, and a “Mute all for X hours” action that surfaces in header (deferred earlier).

### Appearance Tab
- **Theme & typography:** Works end-to-end; slider value stored in `display.textScale`. Missing discrete presets (dyslexia/high-contrast combos) and line-height controls.
- **Accessibility toggles:** `reduceMotion`, `highContrast`, `celebrationSounds`, `showFriendBadges` persist but rely on contexts (`BadgeSound`, `FriendBadgePreference`). Need telemetry + tests to ensure cross-page sync.
- **Map density / list sync:** `PIN_DENSITY_LEVELS` from `utils/pinDensity`. `listSyncsWithMapLimit` new boolean gating List page limit; no UI to explain fallback when disabled.
- **Radius slider:** Wires to `handleRadiusChange` -> `preferences.radiusPreferenceMeters`. Should add guardrails (min 0.5mi, warn on >15mi) and optional auto-expiry toggle.
- **Future hooks:** Accent color picker, widget density, labs toggles (reduce motion granular).

### Privacy Tab
- **Location sharing:** `settings.locationSharingEnabled` toggles with `handleLocationSharingToggle`. Requires backend to honor by excluding user from map queries when false (verify).
- **Stats visibility:** `handleStatsVisibilityToggle`. Need to audit Profile page to confirm stats hide.
- **Cuss filter:** `settings.filterCussWords` toggles local chat filter only; server enforcement TBD (documented risk).
- **DM permission:** Radio group writing to `settings.dmPermission`. Need to ensure chat creation respects value (friends/everyone/nobody). Add copy clarifying fallback.
- **Blocked users:** Button opens `BlockedUsersDialog`; `handleOpenBlockedOverlay` fetches list. Works but lacks search/pagination; offline state disables button.
- **Admin / profile shortcuts:** Buttons depend on `runtimeConfig.moderation`. Should hide if route unavailable; add copy.

### Data & Integrations Tab
- **Auto-export reminders:** `handleAutoExportRemindersToggle` flips `preferences.data.autoExportReminders`. No scheduler yet (future work).
- **Data export:** `requestDataExport` call with optimistic status messages; duplicates flagged via response. Need history list + download link surfacing once server ready.
- **API tokens:** CRUD flow calling `fetchApiTokens/createApiToken/revokeApiToken`. Missing scope selection, usage metadata, and copy for rate limits. Need warning for offline state + handle clipboard failures gracefully.

### Global / Cross-Cutting
- **Tabs:** `Tabs` + `TabPanel` for Notifications, Appearance, Privacy, Data. Need ability to deep-link to a tab via query param for onboarding.
- **Save flow:** `handleSave` persists all changes; `hasChanges` controls disabled Save button. Need autosave for lightweight toggles? Add optimistic UI for notifications/density.
- **Error handling:** `profileError`, `saveStatus`, `blockedOverlayStatus`, `tokenStatus`, `dataStatus` all present but not centralized. Add telemetry + DEV_LOGS logging when toasts fire.
- **Docs:** `docs/settings-playbook.md` still references pre-expansion page; update after audit.

---

## Audit TODOs (WIP Checklist)
- [ ] Build detailed matrix (CSV) enumerating each field in `DEFAULT_SETTINGS` + runtime contexts with current status, owners, and effort.
- [ ] Verify backend enforcement for each privacy toggle (location sharing, stats visibility, DM permission) and document gaps.
- [ ] Add telemetry plan (events fired when toggles change, quiet hours set, exports requested, tokens created).
- [ ] Schedule design review for Quiet Hours, Notification bundles, and Labs section (target Nov 20).
- [ ] Confirm `useSettingsManager` defaults stay in sync with `DEFAULT_SETTINGS` and server schema (prevent drift).

---

# Notifications & Focus Roadmap — Sprint 4

**Goal:** Expand the Notifications tab so users can control when/how they receive updates (quiet hours, mute timers, bundles, verbosity) while keeping persistence and backend fan-out aligned.

## Phases & Milestones
| Phase | Target | Deliverables |
| --- | --- | --- |
| Phase A — Research & UX (Nov 18) | Quiet Hours UX flow, copy for bundles, API contract draft, design sign-off |
| Phase B — Backend Prep (Nov 19-21) | Schema additions (`preferences.notifications.quietHours[]`, `mutePreset`, bundle defaults), digester/fan-out updates, telemetry plan |
| Phase C — Frontend Implementation (Nov 21-24) | UI for Quiet Hours editor, mute presets, bundle selector, per-surface verbosity sliders, integration with `useSettingsManager` |
| Phase D — QA & Telemetry (Nov 25) | Tests (unit + Cypress), analytics events, release notes, settings doc updates |

## Deliverable Breakdown

### 1. Quiet Hours Scheduler
- **UI:** 7-day grid with start/end times + toggle per day (or “Every day” option).
- **Data Contract:** `preferences.notifications.quietHours = [{ day: 'mon', start: '22:00', end: '07:00' }, ...]`.
- **Backend:** Update notification fan-out to skip non-critical pushes during set windows. Provide overrides for high-priority alerts (moderation, safety).
- **Status:** ✅ MVP shipped (Nov 17). UI + persistence live; fan-out respects UTC-based quiet hours. Follow-up: per-user timezone + UX polish.
- **Complexity:** Medium/High (future enhancements include timezone selection and urgency overrides). Stage follow-ups behind feature flag.

### 2. Mute-All Presets & Auto-Unmute
- **UI:** Buttons for 1h / 4h / 24h + countdown indicator. Option to cancel early.
- **Data:** Reuse `notificationsMutedUntil` but store metadata (selected preset). Add a “Resume at” label to header.
- **Backend:** Ensure fan-out respects the field (already does) and add telemetry for auto-unmute events.
- **Status:** ✅ Buttons + countdown shipped; telemetry/auto-unmute analytics TBD.
- **Complexity:** Low/Medium (follow-up for custom durations).

### 3. Channel Bundles
- **Purpose:** Quick onboarding preset (“Minimalist,” “Explorer,” “Organizer”) that sets multiple toggles at once.
- **UI:** Dropdown/list in Notifications tab; applying a bundle overrides toggles with ability to tweak afterwards.
- **Data:** No new schema; `notificationBundles` config lives client-side or in runtime config.
- **Status:** ✅ MVP shipped (local config + selector). Future idea: remote-config bundles + telemetry.
- **Complexity:** Low (UI + copy); expansions include analytics + backend-provided bundles.

### 4. Per-Surface Verbosity (Stretch)
- **UI:** Slider or segmented control for Chat vs. Map vs. Badges (e.g., “Important only”, “All activity”).
- **Data:** `preferences.notifications.verbosity.chat = 'important'` etc.
- **Backend:** Requires fan-out weighting to respect verbosity levels. If backend not ready, gate behind feature flag.
- **Complexity:** Medium/High depending on backend readiness.

### 5. Telemetry & QA
- Emit analytics events for:
  - Quiet Hours saved/updated.
  - Mute preset applied/cleared.
  - Bundle selected.
  - Verbosity level changes.
- Tests:
  - Jest unit tests for `useSettingsManager` handling new fields.
  - Cypress flows for setting quiet hours, verifying mute timers, applying bundles.
- Docs:
  - Update `docs/settings-playbook.md`.
  - Add release notes and support FAQ entries.

## Dependencies
- Backend updates to notification fan-out + digest pipeline.
- Design input for Quiet Hours grid + microcopy.
- Product approval for bundle definitions and default values.

## Risks & Mitigations
- **Backend lag:** Quiet Hours useless without fan-out changes → coordinate with backend early, hide UI behind `featureFlag.notificationsQuietHours`.
- **User confusion:** Too many controls on one tab → use accordions (Quick Actions, Quiet Hours, Bundles) to keep layout clean.
- **Telemetry gaps:** Without analytics, we can’t prove adoption → ship instrumentation alongside UI.

## Next Steps (Action Items)
1. ✅ Draft Quiet Hours wireframes + spec (owner: Settings pod) — merged into MVP.
2. ✅ Update `DEFAULT_SETTINGS` + schema proposal with new fields (quietHours, mutePreset, notificationBundles) — quietHours landed with schema changes.
3. Create feature flags for Quiet Hours + Bundles.
4. Stub UI components (skeleton states) while backend work progresses. *(Quiet Hours done; bundles next.)*
5. Prepare migration script for existing users (default quietHours empty).
