const notificationBundleConfig = [
  {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Only critical alerts (moderation, direct mentions, friend requests).',
    toggles: {
      proximity: false,
      pinCreated: false,
      pinUpdates: false,
      eventReminders: false,
      discussionReminders: false,
      bookmarkReminders: false,
      chatMessages: false,
      friendRequests: true,
      badgeUnlocks: false,
      dmMentions: true,
      moderationAlerts: true,
      chatTransitions: false,
      updates: true,
      marketing: false,
      emailDigests: false
    }
  },
  {
    id: 'explorer',
    label: 'Explorer',
    description: 'Everything about new pins, events, and discussion activity. Marketing stays off.',
    toggles: {
      proximity: true,
      pinCreated: true,
      pinUpdates: true,
      eventReminders: true,
      discussionReminders: true,
      bookmarkReminders: true,
      chatMessages: true,
      friendRequests: true,
      badgeUnlocks: true,
      dmMentions: true,
      moderationAlerts: true,
      chatTransitions: true,
      updates: true,
      marketing: false,
      emailDigests: true
    }
  },
  {
    id: 'organizer',
    label: 'Organizer',
    description: 'Focus on things you run: events, bookmarks, chat transitions, and badges.',
    toggles: {
      proximity: false,
      pinCreated: true,
      pinUpdates: true,
      eventReminders: true,
      discussionReminders: true,
      bookmarkReminders: true,
      chatMessages: true,
      friendRequests: true,
      badgeUnlocks: true,
      dmMentions: true,
      moderationAlerts: true,
      chatTransitions: true,
      updates: true,
      marketing: false,
      emailDigests: false
    }
  }
];

export default notificationBundleConfig;
