# Moderation & Friends Admin Workflows

This guide summarizes the flows that ship in Sprint 3 for moderators and community managers. Use it as a quick handoff reference for support and onboarding teams.

## Prerequisites

- Moderator privileges are required for moderation controls (`admin`, `moderator`, `super-admin`, `system-admin`).
- Friend request and direct message dashboards require `admin`, `moderator`, or `community-manager` access.
- In offline emulation every signed-in user is treated as an admin so you can explore flows without setting custom claims.

## Profile-Level Moderation

1. Open any profile (`/profile/:id`). Moderators see a **Moderation controls** panel beneath the Preferences section.
2. Review the quick status chips to check whether the subject is currently blocked or muted.
3. Use the action presets (Warn, Mute, Block, Ban) or select any action from the dropdown. Provide reason text for audit visibility.
4. Submit the action. The panel records the change, refreshes overview statistics, and surfaces the updated moderation history inline.
5. History entries show the moderator, action type, and timestamp for quick auditing.

## In-Chat Moderation

1. Open `/chat` and choose the desired room.
2. Moderators see a gavel icon on messages they did not author. Click it to open a quick action dialog.
3. Apply warn/mute/ban actions directly from the dialog. The same presets and reason capture are available here.
4. Use **Browse rooms** in the header to switch rooms or access the creation/join dialog without toggling debug mode.

## Friend Requests & Direct Messages

- The bottom navigation now surfaces badges when pending friend requests or direct-message threads exist. Counts disappear automatically when access is revoked or queues empty.
- The global menu (`☰` button) includes dedicated entries for **Friend requests** and **Direct messages** with live counts. Selecting a tile routes to the best available screen (`/updates` for requests, `/chat` for DMs).

## Abusive User Cleanup (Debug Console)

- The Debug Console > Moderation tab still provides the fastest bulk workflow. The end-to-end test `useModerationToolsCore` exercises the “mute → ban” sequence to guard against regressions.
- Use the search box to locate an abusive account, apply the desired actions, then verify the history panel reflects the cleanup.

## Notes & Tips

- All moderation actions now write to both the audit log (`AuditLog` collection) and analytics stream (`AnalyticsEvent` collection). Support can export those collections for investigations.
- The friend and DM dashboards short-circuit when access is revoked (403). UI controls hide automatically to avoid exposing unauthorized options.
- Accessibility: moderation dialogs, navigation badges, and room switchers include descriptive aria labels so screen-reader operators can follow along during escalations.
