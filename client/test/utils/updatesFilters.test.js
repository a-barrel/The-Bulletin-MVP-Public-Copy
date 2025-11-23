import { filterUpdatesByCategory, countUnreadByCategory } from '../../src/utils/updatesFilters';

const buildUpdates = () => [
  { _id: '1', category: 'Discussion' },
  { _id: '2', category: 'EVENT' },
  { _id: '3', category: 'badge' },
  { _id: '4', category: 'bookmark' },
  { _id: '5', category: ' time ' },
  { _id: '6', category: null }
];

describe('updatesFilters', () => {
  it('filters discussions deterministically', () => {
    const updates = buildUpdates();
    const filtered = filterUpdatesByCategory(updates, 'Discussions');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]._id).toBe('1');
  });

  it('filters badges and bookmarks exclusively', () => {
    const updates = buildUpdates();
    const filteredBadges = filterUpdatesByCategory(updates, 'Badges');
    expect(filteredBadges).toHaveLength(1);
    expect(filteredBadges[0]._id).toBe('3');

    const filteredBookmarks = filterUpdatesByCategory(updates, 'Bookmarks');
    expect(filteredBookmarks).toHaveLength(1);
    expect(filteredBookmarks[0]._id).toBe('4');
  });

  it('filters time exclusively', () => {
    const updates = buildUpdates();
    const filteredTime = filterUpdatesByCategory(updates, 'Time');
    expect(filteredTime.map((u) => u._id)).toEqual(['5']);
  });

  it('counts unread categories with normalization', () => {
    const updates = buildUpdates().map((update, index) =>
      index === 2 ? { ...update, readAt: new Date().toISOString() } : update
    );
    const counts = countUnreadByCategory(updates);
    expect(counts.unreadDiscussionsCount).toBe(1);
    expect(counts.unreadEventsCount).toBe(1);
    expect(counts.unreadBadgesCount).toBe(0);
    expect(counts.unreadBookmarkCount).toBe(1);
    expect(counts.unreadTimeCount).toBe(1);
  });
});
