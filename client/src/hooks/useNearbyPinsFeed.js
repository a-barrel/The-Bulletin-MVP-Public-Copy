import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchPinsNearby, fetchPinById, fetchCurrentUserProfile } from '../api/mongoDataApi';
import reportClientError from '../utils/reportClientError';
import { mapPinToFeedItem } from '../utils/pinFeedItem';
import { resolvePinFetchLimit } from '../utils/pinDensity';
const DEFAULT_RADIUS_MILES = 10;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };

const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === 'object' &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);

export default function useNearbyPinsFeed({
  sharedLocation,
  isOffline,
  distanceMiles = DEFAULT_RADIUS_MILES,
  limit = PIN_FETCH_LIMIT,
  filters = {},
  hideFullEvents = true
}) {
  const sharedLatitude = sharedLocation?.latitude ?? null;
  const sharedLongitude = sharedLocation?.longitude ?? null;

  const hasSharedLocation = hasValidCoordinates(sharedLocation);
  const initialLocation = hasSharedLocation
    ? { latitude: sharedLatitude, longitude: sharedLongitude }
    : FALLBACK_LOCATION;

  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(initialLocation);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(!hasSharedLocation);
  const [locationNotice, setLocationNotice] = useState(
    hasSharedLocation ? null : 'Showing popular pins near Long Beach until you enable location.'
  );
  const [viewerProfileId, setViewerProfileId] = useState(null);
  const fallbackLimit = limit ?? PIN_FETCH_LIMIT;
  const [pinDisplayLimit, setPinDisplayLimit] = useState(fallbackLimit);
  const [syncListWithMapLimit, setSyncListWithMapLimit] = useState(true);

  useEffect(() => {
    if (hasValidCoordinates(sharedLocation)) {
      setUserLocation((previous) => {
        if (
          previous &&
          Math.abs(previous.latitude - sharedLocation.latitude) < 1e-9 &&
          Math.abs(previous.longitude - sharedLocation.longitude) < 1e-9
        ) {
          return previous;
        }
        return {
          latitude: sharedLocation.latitude,
          longitude: sharedLocation.longitude
        };
      });
      setIsUsingFallbackLocation(false);
      setLocationNotice(null);
      return;
    }

    setIsUsingFallbackLocation(true);
      setLocationNotice('Showing popular pins near Long Beach until you enable location.');
    setUserLocation((previous) => {
      if (hasValidCoordinates(previous)) {
        return previous;
      }
      return FALLBACK_LOCATION;
    });
  }, [sharedLocation]);

  useEffect(() => {
    if (isOffline) {
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!isMounted) {
          return;
        }
        const normalizedId =
          typeof profile?._id === 'string' && profile._id.trim().length > 0
            ? profile._id.trim()
            : null;
        setViewerProfileId(normalizedId);
        const syncPreference = profile?.preferences?.display?.listSyncsWithMapLimit;
        const shouldSync = syncPreference !== false;
        setSyncListWithMapLimit(shouldSync);
        setPinDisplayLimit(shouldSync ? resolvePinFetchLimit(profile) : fallbackLimit);
      } catch (profileError) {
        console.warn('Failed to load viewer profile for nearby feed:', profileError);
        if (isMounted) {
          setViewerProfileId(null);
          setSyncListWithMapLimit(true);
          setPinDisplayLimit(fallbackLimit);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [fallbackLimit, isOffline]);

  useEffect(() => {
    if (!syncListWithMapLimit) {
      setPinDisplayLimit(fallbackLimit);
    }
  }, [fallbackLimit, syncListWithMapLimit]);

  const loadPins = useCallback(
    async (overrideLocation) => {
      const targetLocation = overrideLocation ?? userLocation;
      if (!hasValidCoordinates(targetLocation)) {
        return;
      }

      if (isOffline) {
        setLoading(false);
        setError((prev) => prev ?? 'Offline mode: showing previously loaded pins.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await fetchPinsNearby({
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          distanceMiles,
          limit: pinDisplayLimit,
          search: typeof filters.search === 'string' ? filters.search : undefined,
          types: Array.isArray(filters.types) ? filters.types : undefined,
          categories: Array.isArray(filters.categories) ? filters.categories : undefined,
          status: filters.status,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          friendEngagements: Array.isArray(filters.friendEngagements)
            ? filters.friendEngagements
            : undefined,
          hideFullEvents
        });

        if (!Array.isArray(results) || results.length === 0) {
          setPins([]);
          return;
        }

        const detailResults = await Promise.all(
          results.map(async (pin) => {
            if (!pin?._id) {
              return pin;
            }
            try {
              const detail = await fetchPinById(pin._id);
              if (!detail || typeof detail !== 'object') {
                return pin;
              }
              return {
                ...detail,
                distanceMeters: pin.distanceMeters ?? detail.distanceMeters,
                startDate: detail.startDate ?? pin.startDate,
                endDate: detail.endDate ?? pin.endDate,
                expiresAt: detail.expiresAt ?? pin.expiresAt,
                type: detail.type ?? pin.type
              };
            } catch (detailError) {
              reportClientError(detailError, 'Failed to load full pin details:', {
                source: 'useNearbyPinsFeed.detail',
                pinId: pin?._id
              });
              return pin;
            }
          })
        );

        setPins(detailResults);
      } catch (err) {
        reportClientError(err, 'Failed to load nearby pins:', {
          source: 'useNearbyPinsFeed.fetchPins',
          location: targetLocation,
          filters
        });
        setPins([]);
        setError(err?.message || 'Failed to load nearby pins.');
      } finally {
        setLoading(false);
      }
    },
    [distanceMiles, filters, hideFullEvents, isOffline, pinDisplayLimit, userLocation]
  );

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const feedItems = useMemo(() => {
    const mapped = Array.isArray(pins)
      ? pins.map((pin) => mapPinToFeedItem(pin, { viewerProfileId }))
      : [];
    const popularSort = filters?.popularSort || null;
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
  }, [filters?.popularSort, pins, viewerProfileId]);

  return {
    feedItems,
    pins,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation,
    refresh: loadPins
  };
}
