import { useCallback, useState } from 'react';
import { fetchPinsNearby } from '../api/mongoDataApi';
import reportClientError from '../utils/reportClientError';
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
  const [pins, setPins] = useState([]);
  const nearbyUsers = [];
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(false);

  const refreshPins = useCallback(
    async (location = userLocation) => {
      if (!hasValidCoordinates(location)) {
        if (!location) {
          setPins([]);
        }
        return;
      }

      if (isOffline) {
        setIsLoadingPins(false);
        setGlobalError?.((prev) => prev ?? 'Offline mode: pin data may be stale.');
        return;
      }

      setIsLoadingPins(true);
      try {
        const results = await fetchPinsNearby({
          latitude: location.latitude,
          longitude: location.longitude,
          distanceMiles: DEFAULT_RADIUS_MILES,
          limit: pinFetchLimit,
          hideFullEvents
        });

        const viewerId = normalizeId(currentProfileId);
        const normalizedResults = Array.isArray(results)
          ? results.map((pin) => {
              const creatorId =
                normalizeId(pin?.creatorId) ??
                normalizeId(pin?.creator?._id) ??
                normalizeId(pin?.creator?.id);
              const isSelf = Boolean(viewerId && creatorId && viewerId === creatorId);
              if (pin && typeof pin === 'object') {
                return { ...pin, isSelf };
              }
              return pin;
            })
          : [];

        setPins(normalizedResults);
        setGlobalError?.((prev) =>
          prev && prev.toLowerCase().includes('failed to load nearby pins') ? null : prev
        );
      } catch (err) {
        reportClientError(err, 'Error fetching nearby pins:', {
          source: 'useMapNearbyData.refreshPins',
          location
        });
        setGlobalError?.(err.message || 'Failed to load nearby pins.');
      } finally {
        setIsLoadingPins(false);
      }
    },
    [currentProfileId, hideFullEvents, isOffline, pinFetchLimit, setGlobalError, userLocation]
  );

  const refreshNearby = useCallback(
    async () => {
      setIsLoadingNearby(false);
      setGlobalError?.(null);
    },
    [setGlobalError]
  );

  const clearNearbyUsers = useCallback(() => {}, []);

  return {
    nearbyUsers,
    pins,
    refreshPins,
    refreshNearby,
    isLoadingNearby,
    isLoadingPins,
    clearNearbyUsers
  };
}
