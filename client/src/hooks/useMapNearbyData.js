import { useCallback, useState } from 'react';
import { fetchNearbyUsers, fetchPinsNearby } from '../api/mongoDataApi';
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
  setGlobalError
}) {
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [pins, setPins] = useState([]);
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
          limit: pinFetchLimit
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
    [currentProfileId, isOffline, pinFetchLimit, setGlobalError, userLocation]
  );

  const refreshNearby = useCallback(
    async (location = userLocation) => {
      if (!hasValidCoordinates(location)) return;

      if (isOffline) {
        setIsLoadingNearby(false);
        setGlobalError?.((prev) => prev ?? 'Offline mode: nearby activity is unavailable.');
        return;
      }

      setIsLoadingNearby(true);
      try {
        const results = await fetchNearbyUsers({
          longitude: location.longitude,
          latitude: location.latitude,
          maxDistance: DEFAULT_MAX_DISTANCE_METERS
        });
        setNearbyUsers(results);
        setGlobalError?.((prev) =>
          prev && prev.toLowerCase().includes('failed to load nearby users') ? null : prev
        );
      } catch (err) {
        reportClientError(err, 'Error fetching nearby users:', {
          source: 'useMapNearbyData.refreshNearby',
          location
        });
        setGlobalError?.(err.message || 'Failed to load nearby users.');
      } finally {
        setIsLoadingNearby(false);
      }
    },
    [isOffline, setGlobalError, userLocation]
  );

  const clearNearbyUsers = useCallback(() => setNearbyUsers([]), []);

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
