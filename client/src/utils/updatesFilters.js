const normalizeCategory = (category) => {
  if (!category || typeof category !== 'string') {
    return '';
  }
  return category.trim().toLowerCase();
};

const filterUpdatesByCategory = (updates, selectedCategory) => {
  const safeUpdates = Array.isArray(updates) ? updates : [];
  const categoryFilter = selectedCategory || 'All';

  if (categoryFilter === 'All') {
    return safeUpdates;
  }

  const normalizedCategory = categoryFilter.toLowerCase();
  const categoryMap = {
    discussions: 'discussion',
    discussion: 'discussion',
    events: 'event',
    event: 'event',
    badges: 'badge',
    badge: 'badge',
    bookmarks: 'bookmark',
    bookmark: 'bookmark',
    time: 'time'
  };
  const targetCategory = categoryMap[normalizedCategory] || normalizedCategory;

  return safeUpdates.filter((update) => normalizeCategory(update?.category) === targetCategory);
};

const countUnreadByCategory = (updates) => {
  const counts = {
    unreadDiscussionsCount: 0,
    unreadEventsCount: 0,
    unreadBadgesCount: 0,
    unreadBookmarkCount: 0,
    unreadTimeCount: 0
  };

  if (!Array.isArray(updates) || updates.length === 0) {
    return counts;
  }

  updates.forEach((update) => {
    if (update?.readAt) {
      return;
    }
    const category = normalizeCategory(update?.category);
    if (category === 'discussion') {
      counts.unreadDiscussionsCount += 1;
    } else if (category === 'event') {
      counts.unreadEventsCount += 1;
    } else if (category === 'badge') {
      counts.unreadBadgesCount += 1;
    } else if (category === 'bookmark') {
      counts.unreadBookmarkCount += 1;
    } else if (category === 'time') {
      counts.unreadTimeCount += 1;
    }
  });

  return counts;
};

export { normalizeCategory, filterUpdatesByCategory, countUnreadByCategory };
