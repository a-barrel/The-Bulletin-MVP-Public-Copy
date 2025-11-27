import { useCallback, useMemo } from 'react';

import { mapPinToFeedItem } from '../utils/pinFeedItem';
import usePinsFeedCore from './usePinsFeedCore';

export default function useNearbyPinsFeed({
  sharedLocation,
  isOffline,
  distanceMiles,
  limit,
  filters = {},
  hideFullEvents = true,
  requireLocation = false,
  isAdminExempt = false,
  allowPerfLogging = false
}) {
  const {
    pins,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation,
    viewerProfileId,
    normalizedFilters,
    refresh: coreRefresh
  } = usePinsFeedCore({
    sharedLocation,
    isOffline,
    distanceMiles,
    limit,
    filters,
    hideFullEvents,
    requireLocation,
    isAdminExempt,
    allowFallback: true,
    cacheNamespace: 'list',
    syncLimitWithProfile: true,
    enablePerfLogging: allowPerfLogging
  });

  const feedItems = useMemo(() => {
    const mapped = Array.isArray(pins)
      ? pins.map((pin) => mapPinToFeedItem(pin, { viewerProfileId }))
      : [];
    const popularSort = normalizedFilters.popularSort || null;
    if (!popularSort || mapped.length === 0) {
      return mapped;
    }

    const sorted = [...mapped];
    if (popularSort === 'replies') {
      sorted.sort((a, b) => {
        const aReplies = Number.isFinite(a?.comments) ? a.comments : 0;
        const bReplies = Number.isFinite(b?.comments) ? b.comments : 0;
        if (bReplies !== aReplies) {
          return bReplies - aReplies;
        }
        const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bUpdated - aUpdated;
      });
    } else if (popularSort === 'attending') {
      const resolveParticipants = (item) => {
        if (Number.isFinite(item?.participantCount)) {
          return item.participantCount;
        }
        const parsedCount =
          parseInt(item?.participantCount, 10) ||
          parseInt(item?.stats?.participantCount, 10);
        if (Number.isFinite(parsedCount)) {
          return parsedCount;
        }
        if (Array.isArray(item?.attendeeIds)) {
          return item.attendeeIds.length;
        }
        return 0;
      };

      sorted.sort((a, b) => {
        const aCount = resolveParticipants(a);
        const bCount = resolveParticipants(b);
        if (bCount !== aCount) {
          return bCount - aCount;
        }
        const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bUpdated - aUpdated;
      });
    }
    return sorted;
  }, [normalizedFilters.popularSort, pins, viewerProfileId]);

  const refresh = useCallback(
    (overrideLocation, options) => coreRefresh(overrideLocation, { ...options, force: true }),
    [coreRefresh]
  );

  return {
    feedItems,
    pins,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation,
    refresh
  };
}
