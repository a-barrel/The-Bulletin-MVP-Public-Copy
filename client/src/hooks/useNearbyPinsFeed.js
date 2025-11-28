import { useMemo } from 'react';

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
    refresh
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
    cacheNamespace: 'nearby-shared',
    syncLimitWithProfile: true,
    enablePerfLogging: allowPerfLogging
  });

  const feedItems = useMemo(
    () => (Array.isArray(pins) ? pins.map((pin) => mapPinToFeedItem(pin, { viewerProfileId })) : []),
    [pins, viewerProfileId]
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
