const notificationToggleConfig = [
  { key: 'proximity', label: 'Nearby pin alerts', helper: 'Alerts when new pins appear within your radius.' },
  { key: 'pinCreated', label: 'New pin posts', helper: 'Notify me when people I follow publish new pins.' },
  { key: 'pinUpdates', label: 'Pin edits & replies', helper: 'Changes to pins you saved, including edits, replies, and attendance updates.' },
  { key: 'eventReminders', label: 'Event reminders', helper: 'Heads-up before events you are attending begin.' },
  { key: 'discussionReminders', label: 'Discussion closing reminders', helper: 'Warn me when discussions or polls I joined are about to end.' },
  { key: 'bookmarkReminders', label: 'Bookmark reminders', helper: 'Activity triggered by pins you bookmarked.' },
  { key: 'chatMessages', label: 'Chat message highlights', helper: 'Notify me about high-signal chat messages in rooms I am part of.' },
  { key: 'friendRequests', label: 'Friend request updates', helper: 'Approvals, declines, and invites.' },
  { key: 'badgeUnlocks', label: 'Badge achievements', helper: 'Celebrate new milestones.' },
  { key: 'dmMentions', label: 'Direct message mentions', helper: 'Notifications for direct mentions or replies.' },
  { key: 'moderationAlerts', label: 'Moderation/reports', helper: 'Warnings, appeals, and report outcomes.' },
  { key: 'chatTransitions', label: 'Chatroom join/leave events', helper: 'Heads-up when friends enter or leave rooms.' },
  { key: 'updates', label: 'Product updates', helper: 'Release notes, outages, and roadmap news.' },
  { key: 'marketing', label: 'Experiments & promotions', helper: 'Beta features, surveys, and offers.' },
  { key: 'emailDigests', label: 'Email digests', helper: 'Allow digests outside the app.' }
];

export default notificationToggleConfig;
