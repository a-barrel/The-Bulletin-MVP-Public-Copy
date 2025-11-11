import { useMemo } from 'react';

export default function useProfileStats(effectiveUser) {
  const statsEntries = useMemo(() => {
    const stats = effectiveUser?.stats;
    if (!stats) {
      return [];
    }
    return [
      { key: 'eventsHosted', label: 'Events hosted', value: stats.eventsHosted ?? 0 },
      { key: 'eventsAttended', label: 'Events attended', value: stats.eventsAttended ?? 0 },
      { key: 'posts', label: 'Posts', value: stats.posts ?? 0 },
      { key: 'bookmarks', label: 'Bookmarks', value: stats.bookmarks ?? 0 },
      { key: 'followers', label: 'Followers', value: stats.followers ?? 0 },
      { key: 'following', label: 'Following', value: stats.following ?? 0 },
      { key: 'cussCount', label: 'Times cussed', value: stats.cussCount ?? 0 }
    ];
  }, [effectiveUser]);

  const statValues = useMemo(
    () =>
      statsEntries.reduce((accumulator, { key, value }) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          accumulator[key] = value;
        } else if (value !== undefined && value !== null) {
          const parsed = Number(value);
          accumulator[key] = Number.isFinite(parsed) ? parsed : 0;
        } else {
          accumulator[key] = 0;
        }
        return accumulator;
      }, {}),
    [statsEntries]
  );

  return {
    statsEntries,
    statValues,
    postCount: statValues.posts ?? 0,
    eventsHosted: statValues.eventsHosted ?? 0,
    eventsAttended: statValues.eventsAttended ?? 0,
    statsVisible: effectiveUser?.preferences?.statsPublic !== false
  };
}
