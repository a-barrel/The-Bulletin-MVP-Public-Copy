# Settings Coverage Audit — 2025-11-17

**Scope:** Enumerate every active setting in the refactored page (branch `settings-page-expansion-and-cache-research`), confirm whether it is functionally implemented end-to-end today, and note any gaps or follow-ups. Use this as the canonical checklist while we plan expansions.

Legend — Status: ✅ Implemented • ⚠️ Partial • ⛔ Missing  
Effort: S (copy/UI only), M (requires moderate UI+API work), L (requires new services/infra)

| Setting / Control | UI Source | Backend Field / API | Status | Notes & Gaps | Effort to Finish |
| --- | --- | --- | --- | --- | --- |
| Theme (system/light/dark) | `AppearanceSettings.jsx` | `preferences.theme` | ✅ | Fully wired via `handleThemeChange`. | — |
| Text scale slider | `AppearanceSettings.jsx` | `preferences.display.textScale` | ✅ | Clamped to 0.8–1.4. | — |
| Reduce motion toggle | `AppearanceSettings.jsx` | `preferences.display.reduceMotion` | ✅ | Applies across pages via contexts. | — |
| High contrast mode | `AppearanceSettings.jsx` | `preferences.display.highContrast` | ✅ | No known gaps. | — |
| Celebration sounds | `AppearanceSettings.jsx` + `BadgeSoundContext` | `preferences.display.celebrationSounds` | ✅ | Propagates instantly; telemetry missing. | S (instrumentation) |
| Show friend badges | `AppearanceSettings.jsx` + `FriendBadgePreferenceContext` | `preferences.display.showFriendBadges` | ✅ | Works; again needs telemetry. | S |
| Map pin density (Sparse/Balanced/Detailed) | `AppearanceSettings.jsx` | `preferences.display.mapDensity` | ✅ | Used by map + feeds. | — |
| “Match List view to this limit” | `AppearanceSettings.jsx` + `useNearbyPinsFeed` | `preferences.display.listSyncsWithMapLimit` | ✅ | List falls back when disabled; doc mention pending. | S |
| Location radius slider | `AppearanceSettings.jsx` | `preferences.radiusPreferenceMeters` | ✅ | Limits 100m–50mi. No auto-expiry. | — |
| Share live location | `PrivacySettings.jsx` | `profile.locationSharingEnabled` | ✅ | Server honors flag when broadcasting; consider expiry toggle. | M (expiry idea) |
| Allow stats visibility | `PrivacySettings.jsx` | `preferences.statsPublic` | ✅ | Profile hides stats when false. | — |
| Filter explicit language | `PrivacySettings.jsx` | `preferences.filterCussWords` | ✅ | Basic filter both client/server; upgrade list later. | M (better filtering) |
| DM permission (Everyone/Friends/Nobody) | `PrivacySettings.jsx` | `preferences.dmPermission` | ✅ | Enforced in DM creation pipeline. | — |
| Manage blocked users dialog | `BlockedUsersDialog.jsx` via `PrivacySettings.jsx` | `/api/users/me/blocked` endpoints | ✅ | Functional but no search/pagination; offline disabled. | M (enhancements) |
| Admin dashboard shortcut | `PrivacySettings.jsx` | Route guard (`runtimeConfig.moderation`) | ✅ | Only renders for allowed roles. | — |
| Notification toggles (15 keys: proximity, pinCreated, pinUpdates, eventReminders, discussionReminders, bookmarkReminders, chatMessages, friendRequests, badgeUnlocks, dmMentions, moderationAlerts, chatTransitions, updates, marketing, emailDigests) | `NotificationSettings.jsx` + `notificationToggleConfig.js` | `preferences.notifications.*` | ✅ | All persisted and consumed by fan-out services. | — |
| Quick mute presets (1h/4h/24h) + countdown | `NotificationSettings.jsx` | `preferences.notificationsMutedUntil` | ✅ | Buttons now cover common windows with countdown helper text. Could add custom duration dialog later. | S (custom durations) |
| Quiet hours schedule | `NotificationSettings.jsx` + `NotificationQuietHoursEditor.jsx` + `updateFanoutService` | `preferences.notifications.quietHours` | ✅ | Fan-out respects per-day windows (UTC-based until per-user timezones exist). | M (timezone support) |
| Notification bundles (Minimalist / Explorer / Organizer) | `NotificationSettings.jsx` + `NotificationBundleSelector.jsx` | Applies directly to `preferences.notifications.*` | ✅ | Applies presets locally; add telemetry + backend-provided bundles later. | S/M (analytics + remote config) |
| Chat notification intensity (highlights/all/muted) | `NotificationSettings.jsx` + `NotificationBundleSelector.jsx` + `updateFanoutService` | `preferences.notificationsVerbosity.chat` | ✅ | “Muted” suppresses chat fan-out even if the toggle stays on. “All” currently mirrors Highlights until lower-signal events exist. | M (telmetry + future ranking) |
| Auto-disable location sharing | `PrivacySettings.jsx` | `preferences.location.autoDisableAfterHours` | ⚠️ | UI/persistence in place; backend still needs to flip `locationSharingEnabled` when the timer elapses. | M (service enforcement) |
| Hide me on global map | `PrivacySettings.jsx` + `server/routes/pins.js` | `preferences.location.globalMapVisible` | ✅ | When disabled, map/list endpoints hide the user’s pins from everyone else. | M (friend exceptions + analytics) |
| DM guardrails | `ProfilePage.jsx` (DM CTA) | `preferences.dmPermission` | ✅ | Profile “Message” button now respects the target’s DM permission (Friends-only or Nobody) and shows contextual tooltips; navigation is blocked when disallowed. | M (server-side enforcement + telemetry) |
| Digest frequency (Immediate/Daily/Weekly/Never) | `NotificationSettings.jsx` | `preferences.digestFrequency` | ✅ | Server records value; digest worker integration TBD. | M (wire to digester) |
| Auto-export reminders toggle | `DataIntegrationsSettings.jsx` | `preferences.data.autoExportReminders` | ⚠️ | Stored, but reminder scheduler not built. | L (needs cron/notifications) |
| Data export request button | `DataIntegrationsSettings.jsx` | `requestDataExport()` | ✅ | Queue works; no history/download list yet. | M (history UI) |
| API token management (label, create, list, revoke) | `DataIntegrationsSettings.jsx` | `fetchApiTokens`, `createApiToken`, `revokeApiToken` | ✅ | Missing scopes/usage metadata; clipboard fallback copy plain text. | M (scopes/logging) |
| Feedback dialog | `FeedbackDialog.jsx` | `submitAnonymousFeedback` | ✅ | Functional; lacks submission history. | S |
| Reset to defaults | `SettingsPage.jsx` (`handleReset`) | Local only (reverts to baseline) | ✅ | Works; add confirm modal later. | S |
| Save button | `SettingsPage.jsx` (`handleSave`) | `updateCurrentUserProfile` API | ✅ | Handles optimistic state + errors. | — |
| Sign out | `SettingsPage.jsx` (`handleSignOut`) | Firebase Auth + `/api/auth/revoke` | ✅ | Includes server session revoke. | — |

## Observations
- **Only partial area:** Auto-export reminders don’t trigger real reminders yet—requires scheduler + notification entry points (estimate Large).
- **Telemetry gap:** Most toggles lack analytics; capturing change events would be a Small follow-up per setting.
- **Enhancement ideas:** Quiet hours/custom mute durations, advanced privacy controls (location expiry, global visibility), API token scopes, export history UI.

## Next Steps
1. Socialize this checklist with product/leadership to confirm everything prior to sprint 4 is covered.
2. Prioritize expansion items starting with Notifications (Quiet Hours, bundles) and Privacy (location expiry).
3. Create tickets referencing this document so new work doesn’t regress existing functionality.
