import { useCallback } from 'react';
import { useMemo } from 'react';
import usePinsFeedCore from './usePinsFeedCore';
import {
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_RADIUS_MILES
} from '../utils/mapExplorerConstants';
import { hasValidCoordinates, normalizeId } from '../utils/mapLocation';

export default function useMapNearbyData({
  userLocation,
  isOffline,
  pinFetchLimit,
  currentProfileId,
  setGlobalError,
  hideFullEvents = true
}) {
  const nearbyUsers = [];
  const { pins, loading: isLoadingPins, refresh: refreshPins } = usePinsFeedCore({
    controlledLocation: hasValidCoordinates(userLocation) ? userLocation : null,
    sharedLocation: userLocation,
    isOffline,
    distanceMiles: DEFAULT_RADIUS_MILES,
    limit: pinFetchLimit,
    filters: {},
    hideFullEvents,
    requireLocation: false,
    isAdminExempt: true,
    allowFallback: false,
    cacheNamespace: 'map',
    syncLimitWithProfile: false,
    onErrorChange: setGlobalError,
    enablePerfLogging: true
  });
  const viewerId = normalizeId(currentProfileId);
  const normalizedPins = useMemo(() => {
    const source = Array.isArray(pins) ? pins : [];
    if (!viewerId) {
      return source;
    }
    return source.map((pin) => {
      const creatorId =
        normalizeId(pin?.creatorId) ??
        normalizeId(pin?.creator?._id) ??
        normalizeId(pin?.creator?.id);
      const isSelf = Boolean(viewerId && creatorId && viewerId === creatorId);
      if (pin && typeof pin === 'object') {
        return { ...pin, isSelf };
      }
      return pin;
    });
  }, [pins, viewerId]);

  const refreshNearby = useCallback(
    async () => {
      setGlobalError?.(null);
    },
    [setGlobalError]
  );

  const clearNearbyUsers = useCallback(() => {}, []);

  return {
    nearbyUsers,
    pins: normalizedPins,
    refreshPins,
    refreshNearby,
    isLoadingNearby: false,
    isLoadingPins,
    clearNearbyUsers
  };
}
