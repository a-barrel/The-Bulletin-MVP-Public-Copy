import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchPinsNearby, fetchPinById, fetchCurrentUserProfile } from '../api/mongoDataApi';
import reportClientError from '../utils/reportClientError';
import { mapPinToFeedItem } from '../utils/pinFeedItem';
import { resolvePinFetchLimit } from '../utils/pinDensity';
import { enableListPerfLogs, logListPerf, nowMs } from '../utils/listPerfLogger';
const DEFAULT_RADIUS_MILES = 10;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
const FETCH_THROTTLE_MS = 250;
const FETCH_DEBOUNCE_MS = 250;
const CACHE_TTL_MS = 45_000;
const DETAIL_CACHE_TTL_MS = 60_000;
const nearbyCacheStore = new Map();
const detailCacheStore = new Map();

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
  hideFullEvents = true,
  requireLocation = false,
  isAdminExempt = false
}) {
  const sharedLatitude = sharedLocation?.latitude ?? null;
  const sharedLongitude = sharedLocation?.longitude ?? null;
  const shouldRequireLocation = requireLocation && !isOffline && !isAdminExempt;

  const hasSharedLocation = hasValidCoordinates(sharedLocation);
  const initialLocation = hasSharedLocation
    ? { latitude: sharedLatitude, longitude: sharedLongitude }
    : shouldRequireLocation
    ? null
    : FALLBACK_LOCATION;

  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(initialLocation);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(
    !hasSharedLocation && !shouldRequireLocation
  );
  const [locationNotice, setLocationNotice] = useState(
    hasSharedLocation || shouldRequireLocation
      ? null
      : 'Showing popular pins near Long Beach until you enable location.'
  );
  const [viewerProfileId, setViewerProfileId] = useState(null);
  const fallbackLimit = limit ?? PIN_FETCH_LIMIT;
  const [pinDisplayLimit, setPinDisplayLimit] = useState(fallbackLimit);
  const [syncListWithMapLimit, setSyncListWithMapLimit] = useState(true);
  const normalizedFilters = useMemo(() => {
    const safeFilters = filters || {};
    return {
      search: typeof safeFilters.search === 'string' ? safeFilters.search.trim() : '',
      status: safeFilters.status || '',
      types: Array.isArray(safeFilters.types) ? [...safeFilters.types].sort() : [],
      categories: Array.isArray(safeFilters.categories) ? [...safeFilters.categories].sort() : [],
      friendEngagements: Array.isArray(safeFilters.friendEngagements)
        ? [...safeFilters.friendEngagements].sort()
        : [],
      startDate: safeFilters.startDate || '',
      endDate: safeFilters.endDate || '',
      popularSort: safeFilters.popularSort || null
    };
  }, [filters]);
  const filtersRef = useRef(normalizedFilters);
  const isLoadingRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const cacheRef = useRef(nearbyCacheStore);
  const activeRequestRef = useRef({ id: 0, controller: null });
  const debounceTimerRef = useRef(null);
  const detailCacheRef = useRef(detailCacheStore);
  const perfCountersRef = useRef({
    fetchNearbyCalls: 0,
    detailCalls: 0,
    cacheHits: 0,
    throttledSkips: 0
  });

  useEffect(() => {
    filtersRef.current = normalizedFilters;
  }, [normalizedFilters]);

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

    setIsUsingFallbackLocation(!shouldRequireLocation);
    if (shouldRequireLocation) {
      setLocationNotice('Location required to view nearby pins. Enable location services.');
      setUserLocation((previous) => (hasValidCoordinates(previous) ? previous : null));
      return;
    }
    setLocationNotice('Showing popular pins near Long Beach until you enable location.');
    setUserLocation((previous) => {
      if (hasValidCoordinates(previous)) {
        return previous;
      }
      return FALLBACK_LOCATION;
    });
  }, [sharedLocation, shouldRequireLocation]);

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

  const fetchParamsSignature = useMemo(
    () =>
      JSON.stringify({
        location: hasValidCoordinates(userLocation)
          ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
          : null,
        distanceMiles,
        limit: pinDisplayLimit,
        filters: normalizedFilters,
        hideFullEvents
      }),
    [
      distanceMiles,
      hideFullEvents,
      normalizedFilters,
      pinDisplayLimit,
      userLocation?.latitude,
      userLocation?.longitude
    ]
  );

  const loadPins = useCallback(
    async (overrideLocation) => {
      const perfStart = enableListPerfLogs ? nowMs() : null;
      const targetLocation = overrideLocation ?? userLocation;
      if (shouldRequireLocation && !hasValidCoordinates(targetLocation)) {
        if (enableListPerfLogs) {
          logListPerf('loadPins skipped: location required', {
            isOffline,
            usingFallback: isUsingFallbackLocation,
            hasSharedLocation
          });
        }
        setError('Location required to load nearby pins.');
        setLoading(false);
        setPins([]);
        return;
      }
      if (!hasValidCoordinates(targetLocation)) {
        if (enableListPerfLogs) {
          logListPerf('loadPins skipped: invalid target location', {
            isOffline,
            usingFallback: isUsingFallbackLocation
          });
        }
        return;
      }

      if (isOffline) {
        if (activeRequestRef.current?.controller) {
          activeRequestRef.current.controller.abort();
        }
        if (enableListPerfLogs) {
          logListPerf('loadPins skipped: offline mode');
        }
        setLoading(false);
        isLoadingRef.current = false;
        setError((prev) => prev ?? 'Offline mode: showing previously loaded pins.');
        return;
      }

      if (activeRequestRef.current?.controller) {
        activeRequestRef.current.controller.abort();
      }
      const requestId = (activeRequestRef.current?.id ?? 0) + 1;
      const abortController =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      activeRequestRef.current = { id: requestId, controller: abortController };

      const now = Date.now();
      cacheRef.current.forEach((entry, key) => {
        if (!entry || now - entry.ts >= CACHE_TTL_MS) {
          cacheRef.current.delete(key);
        }
      });
      detailCacheRef.current.forEach((entry, key) => {
        if (!entry || now - entry.ts >= DETAIL_CACHE_TTL_MS) {
          detailCacheRef.current.delete(key);
        }
      });

      const cacheKey = JSON.stringify({
        loc: {
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude
        },
        distanceMiles,
        limit: pinDisplayLimit,
        filters: filtersRef.current
      });
      const cached = cacheRef.current.get(cacheKey);
      if (cached && now - cached.ts < CACHE_TTL_MS) {
        if (enableListPerfLogs) {
          perfCountersRef.current.cacheHits += 1;
          logListPerf('nearby cache hit', {
            cacheHits: perfCountersRef.current.cacheHits,
            fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls,
            detailCalls: perfCountersRef.current.detailCalls,
            resultCount: Array.isArray(cached?.pins) ? cached.pins.length : 0,
            elapsedMs: perfStart !== null ? Math.round(nowMs() - perfStart) : null
          });
        }
        setPins(cached.pins);
        isLoadingRef.current = false;
        setLoading(false);
        setError(null);
        return;
      }

      const nowTs = Date.now();
      if (nowTs - lastFetchAtRef.current < FETCH_THROTTLE_MS) {
        if (enableListPerfLogs) {
          perfCountersRef.current.throttledSkips += 1;
          logListPerf('nearby fetch throttled', {
            throttledSkips: perfCountersRef.current.throttledSkips
          });
        }
        return;
      }
      lastFetchAtRef.current = nowTs;

      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      const activeFilters = filtersRef.current || {};

      try {
        const filterCounts = enableListPerfLogs
          ? {
              search: Boolean(activeFilters.search),
              types: Array.isArray(activeFilters.types) ? activeFilters.types.length : 0,
              categories: Array.isArray(activeFilters.categories) ? activeFilters.categories.length : 0,
              engagements: Array.isArray(activeFilters.friendEngagements)
                ? activeFilters.friendEngagements.length
                : 0,
              status: activeFilters.status || null
            }
          : null;
        const fetchStartedAt = enableListPerfLogs ? nowMs() : null;
        if (enableListPerfLogs) {
          perfCountersRef.current.fetchNearbyCalls += 1;
          logListPerf('nearby fetch started', {
            requestId,
            fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls,
            usingFallback: isUsingFallbackLocation,
            limit: pinDisplayLimit,
            distanceMiles,
            filterCounts
          });
        }
        const results = await fetchPinsNearby({
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          distanceMiles,
          limit: pinDisplayLimit,
          search: typeof activeFilters.search === 'string' ? activeFilters.search : undefined,
          types: Array.isArray(activeFilters.types) ? activeFilters.types : undefined,
          categories: Array.isArray(activeFilters.categories) ? activeFilters.categories : undefined,
          status: activeFilters.status,
          startDate: activeFilters.startDate || undefined,
          endDate: activeFilters.endDate || undefined,
          friendEngagements: Array.isArray(activeFilters.friendEngagements)
            ? activeFilters.friendEngagements
            : undefined,
          hideFullEvents,
          signal: abortController?.signal
        });

        if (activeRequestRef.current.id !== requestId) {
          return;
        }

        if (!Array.isArray(results) || results.length === 0) {
          if (enableListPerfLogs) {
            logListPerf('nearby fetch returned no results', {
              fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls
            });
          }
          setPins([]);
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }

        let detailNetworkCalls = 0;
        const detailStartedAt = enableListPerfLogs ? nowMs() : null;
        const detailResults = await Promise.all(
          results.map(async (pin) => {
            if (!pin?._id) {
              return pin;
            }
            const cachedDetail = detailCacheRef.current.get(pin._id);
            const cacheAgeMs = cachedDetail ? Date.now() - cachedDetail.ts : Number.POSITIVE_INFINITY;
            if (cachedDetail && cacheAgeMs < DETAIL_CACHE_TTL_MS) {
              if (enableListPerfLogs) {
                logListPerf('detail cache hit', { pinId: pin._id });
              }
              return {
                ...cachedDetail.data,
                distanceMeters: pin.distanceMeters ?? cachedDetail.data.distanceMeters,
                startDate: cachedDetail.data.startDate ?? pin.startDate,
                endDate: cachedDetail.data.endDate ?? pin.endDate,
                expiresAt: cachedDetail.data.expiresAt ?? pin.expiresAt,
                type: cachedDetail.data.type ?? pin.type
              };
            }
            try {
              detailNetworkCalls += 1;
              const detail = await fetchPinById(pin._id, { signal: abortController?.signal });
              if (!detail || typeof detail !== 'object') {
                return pin;
              }
              const merged = {
                ...detail,
                distanceMeters: pin.distanceMeters ?? detail.distanceMeters,
                startDate: detail.startDate ?? pin.startDate,
                endDate: detail.endDate ?? pin.endDate,
                expiresAt: detail.expiresAt ?? pin.expiresAt,
                type: detail.type ?? pin.type
              };
              detailCacheRef.current.set(pin._id, { ts: Date.now(), data: detail });
              return merged;
            } catch (detailError) {
              if (detailError?.name === 'AbortError') {
                return pin;
              }
              reportClientError(detailError, 'Failed to load full pin details:', {
                source: 'useNearbyPinsFeed.detail',
                pinId: pin?._id
              });
              return pin;
            }
          })
        );

        if (activeRequestRef.current.id !== requestId) {
          return;
        }

        if (enableListPerfLogs) {
          perfCountersRef.current.detailCalls += detailNetworkCalls;
          const nearbyMs = fetchStartedAt !== null ? Math.round(nowMs() - fetchStartedAt) : null;
          const detailMs =
            detailStartedAt !== null ? Math.round(nowMs() - detailStartedAt) : null;
          logListPerf('nearby fetch completed', {
            fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls,
            detailFetchCount: detailNetworkCalls,
            detailCallsTotal: perfCountersRef.current.detailCalls,
            resultCount: detailResults.length,
            nearbyMs,
            detailMs
          });
        }
        setPins(detailResults);
        cacheRef.current.set(cacheKey, { pins: detailResults, ts: Date.now() });
      } catch (err) {
        if (err?.name === 'AbortError') {
          if (enableListPerfLogs) {
            logListPerf('nearby fetch aborted', { requestId });
          }
          if (activeRequestRef.current.id === requestId) {
            isLoadingRef.current = false;
            setLoading(false);
          }
          return;
        }
        if (enableListPerfLogs) {
          logListPerf('nearby fetch failed', {
            fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls,
            message: err?.message
          });
        }
        reportClientError(err, 'Failed to load nearby pins:', {
          source: 'useNearbyPinsFeed.fetchPins',
          location: targetLocation,
          filters: activeFilters
        });
        setPins([]);
        setError(err?.message || 'Failed to load nearby pins.');
      } finally {
        if (activeRequestRef.current.id === requestId) {
          isLoadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [
      distanceMiles,
      hasSharedLocation,
      hideFullEvents,
      isOffline,
      isUsingFallbackLocation,
      pinDisplayLimit,
      shouldRequireLocation,
      userLocation?.latitude,
      userLocation?.longitude
    ]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (isOffline) {
      return () => {};
    }
    debounceTimerRef.current = setTimeout(() => {
      loadPins();
    }, FETCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchParamsSignature, isOffline, loadPins]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (activeRequestRef.current?.controller) {
        activeRequestRef.current.controller.abort();
      }
    };
  }, []);

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
