const BADGE_DEFINITIONS = {
  'enter-debug-console': {
    label: 'Debugger',
    description: 'Entered the debug console for the first time.',
    image: '/images/badges/enter_debug_console_first_time_badge.jpg'
  },
  'chat-first-message': {
    label: 'Conversation Starter',
    description: 'Sent your first message in chat.',
    image: '/images/badges/chat_first_time_badge.jpg'
  },
  'create-first-pin': {
    label: 'Trailblazer',
    description: 'Created your very first pin.',
    image: '/images/badges/create_pin_first_time_badge.jpg'
  },
  'bookmark-first-pin': {
    label: 'Curator',
    description: 'Bookmarked your first pin.',
    image: '/images/badges/bookmark_first_time_badge.jpg'
  },
  'attend-first-event': {
    label: 'Participant',
    description: 'Joined an event for the first time.',
    image: '/images/badges/attend_event_first_time_badge.jpg'
  },
  'how-badge': {
    label: 'HOW?!',
    description: 'Discovered the hidden Kirby portal (Ctrl + `).',
    image: '/images/badges/how_badge.jpg'
  }
};

const formatFallbackLabel = (badgeId) => {
  if (!badgeId || typeof badgeId !== 'string') {
    return 'Badge';
  }

  return badgeId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export const BADGE_METADATA = BADGE_DEFINITIONS;

export const getBadgeMetadata = (badgeId) => {
  if (!badgeId) {
    return null;
  }
  return BADGE_DEFINITIONS[badgeId] ?? null;
};

export const getBadgeLabel = (badgeId) => {
  const metadata = getBadgeMetadata(badgeId);
  if (metadata?.label) {
    return metadata.label;
  }
  return formatFallbackLabel(badgeId);
};
