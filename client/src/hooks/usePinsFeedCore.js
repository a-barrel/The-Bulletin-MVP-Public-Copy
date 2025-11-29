import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchPinsNearby, fetchPinById, fetchCurrentUserProfile } from '../api';
import reportClientError from '../utils/reportClientError';
import { resolvePinFetchLimit } from '../utils/pinDensity';
import { enableListPerfLogs, logListPerf, nowMs } from '../utils/listPerfLogger';
import { usePinCache } from '../contexts/PinCacheContext';

const DEFAULT_RADIUS_MILES = 10;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
// Light smoothing: prevent rapid refetch churn on tiny input changes,
// but low enough to keep pins responsive when location changes.
const FETCH_THROTTLE_MS = 120;
const FETCH_DEBOUNCE_MS = 120;
const CACHE_TTL_MS = 120_000;
const DETAIL_CACHE_TTL_MS = 180_000;

const nearbyCacheStores = new Map();
const detailCacheStores = new Map();

const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === 'object' &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);

const getNamespacedStore = (storeMap, namespace) => {
  if (!storeMap.has(namespace)) {
    storeMap.set(namespace, new Map());
  }
  return storeMap.get(namespace);
};

const hasDetailedPinFields = (pin) => {
  const hasDescription =
    pin?.description ||
    pin?.content ||
    pin?.body ||
    pin?.text ||
    pin?.summary ||
    pin?.details?.description ||
    pin?.details?.content ||
    pin?.details?.body ||
    pin?.details?.text ||
    pin?.details?.summary ||
    pin?.details?.longDescription ||
    pin?.pin?.description ||
    pin?.pin?.content ||
    pin?.pin?.body ||
    pin?.pin?.text ||
    pin?.pin?.summary;

  const hasAddress =
    pin?.address ||
    pin?.approximateAddress ||
    pin?.location?.address ||
    pin?.location?.label ||
    pin?.location?.name ||
    pin?.location?.description ||
    pin?.locationLabel ||
    pin?.locationName ||
    pin?.locationText ||
    pin?.locationString ||
    pin?.location?.addressString ||
    pin?.addressString ||
    pin?.address?.precise ||
    pin?.address?.components ||
    pin?.street ||
    pin?.street1 ||
    pin?.street2 ||
    pin?.city ||
    pin?.state ||
    pin?.stateCode ||
    pin?.province ||
    pin?.region ||
    pin?.country ||
    pin?.countryCode ||
    pin?.neighborhood ||
    pin?.place?.name ||
    pin?.place?.address ||
    pin?.place?.formattedAddress ||
    pin?.place?.formatted_address ||
    pin?.place?.label ||
    pin?.place?.description ||
    pin?.place?.vicinity ||
    pin?.addressLabel ||
    pin?.addressName ||
    pin?.addressDescription ||
    pin?.addressText;

  // Only treat a pin as detailed if it has text plus some address-ish info,
  // or was explicitly marked detailed by a full-detail fetch.
  return Boolean((hasDescription && (hasAddress || pin?.__hasDetails === true)) || pin?.__hasDetails === true);
};

export const normalizePinFilters = (filters) => {
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
};

export default function usePinsFeedCore({
  sharedLocation,
  controlledLocation,
  isOffline,
  distanceMiles = DEFAULT_RADIUS_MILES,
  limit = PIN_FETCH_LIMIT,
  filters = {},
  hideFullEvents = true,
  requireLocation = false,
  isAdminExempt = false,
  allowFallback = true,
  cacheNamespace = 'default',
  syncLimitWithProfile = false,
  onErrorChange,
  enablePerfLogging = false
}) {
  const shouldRequireLocation = requireLocation && !isOffline && !isAdminExempt;
  const normalizedFilters = useMemo(() => normalizePinFilters(filters), [filters]);
  const filtersRef = useRef(normalizedFilters);
  const isLocationControlled = controlledLocation !== undefined;
  const perfEnabled = enablePerfLogging && enableListPerfLogs;

  const hasSharedLocation = hasValidCoordinates(sharedLocation);
  const initialLocation = hasSharedLocation
    ? { latitude: sharedLocation.latitude, longitude: sharedLocation.longitude }
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
  const [syncListWithMapLimit, setSyncListWithMapLimit] = useState(syncLimitWithProfile);

  const cacheRef = useRef(getNamespacedStore(nearbyCacheStores, cacheNamespace));
  const detailCacheRef = useRef(getNamespacedStore(detailCacheStores, `${cacheNamespace}-detail`));
  const pinCache = usePinCache();
  const isLoadingRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const activeRequestRef = useRef({ id: 0, controller: null });
  const debounceTimerRef = useRef(null);
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
    if (typeof onErrorChange === 'function') {
      onErrorChange(error);
    }
  }, [error, onErrorChange]);

  useEffect(() => {
    if (isLocationControlled) {
      setIsUsingFallbackLocation(false);
      setLocationNotice(null);
      return;
    }
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
    if (allowFallback) {
      setLocationNotice('Showing popular pins near Long Beach until you enable location.');
      setUserLocation((previous) => {
        if (hasValidCoordinates(previous)) {
          return previous;
        }
        return FALLBACK_LOCATION;
      });
    }
  }, [allowFallback, isLocationControlled, sharedLocation, shouldRequireLocation]);

  useEffect(() => {
    if (!syncLimitWithProfile || isOffline) {
      setSyncListWithMapLimit(syncLimitWithProfile);
      return undefined;
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
          setSyncListWithMapLimit(syncLimitWithProfile);
          setPinDisplayLimit(fallbackLimit);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [fallbackLimit, isOffline, syncLimitWithProfile]);

  useEffect(() => {
    if (!syncListWithMapLimit) {
      setPinDisplayLimit(fallbackLimit);
    }
  }, [fallbackLimit, syncListWithMapLimit]);

  const fetchParamsSignature = useMemo(
    () =>
      JSON.stringify({
        location: hasValidCoordinates(isLocationControlled ? controlledLocation : userLocation)
          ? {
              latitude: (isLocationControlled ? controlledLocation : userLocation)?.latitude,
              longitude: (isLocationControlled ? controlledLocation : userLocation)?.longitude
            }
          : null,
        distanceMiles,
        limit: pinDisplayLimit,
        filters: normalizedFilters,
        hideFullEvents
      }),
    [
      controlledLocation,
      distanceMiles,
      hideFullEvents,
      isLocationControlled,
      normalizedFilters,
      pinDisplayLimit,
      userLocation?.latitude,
      userLocation?.longitude
    ]
  );

  const loadPins = useCallback(
    async (overrideLocation) => {
      const perfStart = perfEnabled ? nowMs() : null;
      const targetLocation =
        overrideLocation ?? (isLocationControlled ? controlledLocation : userLocation);
      if (shouldRequireLocation && !hasValidCoordinates(targetLocation)) {
        if (perfEnabled) {
          logListPerf('loadPins skipped: location required', {
            isOffline,
            usingFallback: isUsingFallbackLocation,
            hasSharedLocation
          });
        }
        if (!isLocationControlled) {
          setError('Location required to load nearby pins.');
          setLoading(false);
          setPins([]);
        }
        return;
      }
      if (!hasValidCoordinates(targetLocation)) {
        if (perfEnabled) {
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
        if (perfEnabled) {
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
        if (perfEnabled) {
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
        if (perfEnabled) {
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
        const filterCounts = perfEnabled
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
        const fetchStartedAt = perfEnabled ? nowMs() : null;
        if (perfEnabled) {
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
        if (perfEnabled) {
          logListPerf('nearby fetch returned no results', {
            fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls
          });
          }
          setPins([]);
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }

        // Seed shared cache with the basic nearby payloads so other views/pages can reuse them.
        pinCache.setPins(
          results.map((pin) => {
            const cached = pinCache.getPin(pin?._id);
            return {
              ...pin,
              viewerHasBookmarked:
                typeof cached?.viewerHasBookmarked === 'boolean'
                  ? cached.viewerHasBookmarked
                  : pin?.viewerHasBookmarked,
              bookmarkCount:
                typeof cached?.bookmarkCount === 'number'
                  ? cached.bookmarkCount
                  : typeof pin?.bookmarkCount === 'number'
                  ? pin.bookmarkCount
                  : typeof pin?.stats?.bookmarkCount === 'number'
                  ? pin.stats.bookmarkCount
                  : null,
              __hasDetails: hasDetailedPinFields(pin)
            };
          })
        );

        let detailNetworkCalls = 0;
        const detailStartedAt = perfEnabled ? nowMs() : null;
        const detailResults = await Promise.all(
          results.map(async (pin) => {
            if (!pin?._id) {
              return pin;
            }
            const cachedDetail = detailCacheRef.current.get(pin._id);
            const cacheAgeMs = cachedDetail ? Date.now() - cachedDetail.ts : Number.POSITIVE_INFINITY;
            if (
              cachedDetail &&
              cacheAgeMs < DETAIL_CACHE_TTL_MS &&
              hasDetailedPinFields(cachedDetail.data)
            ) {
              if (perfEnabled) {
                logListPerf('detail cache hit', { pinId: pin._id });
              }
              const mergedCached = {
                ...cachedDetail.data,
                viewerHasBookmarked:
                  typeof pin?.viewerHasBookmarked === 'boolean'
                    ? pin.viewerHasBookmarked
                    : cachedDetail.data.viewerHasBookmarked,
                bookmarkCount:
                  typeof pin?.bookmarkCount === 'number'
                    ? pin.bookmarkCount
                    : cachedDetail.data.bookmarkCount,
                distanceMeters: pin.distanceMeters ?? cachedDetail.data.distanceMeters,
                startDate: cachedDetail.data.startDate ?? pin.startDate,
                endDate: cachedDetail.data.endDate ?? pin.endDate,
                expiresAt: cachedDetail.data.expiresAt ?? pin.expiresAt,
                type: cachedDetail.data.type ?? pin.type
              };
              pinCache.upsertPin(mergedCached);
              return mergedCached;
            }

            const sharedCached = pinCache.getPin(pin._id);
            if (sharedCached && hasDetailedPinFields(sharedCached)) {
              detailCacheRef.current.set(pin._id, { ts: Date.now(), data: sharedCached });
              return {
                ...sharedCached,
                viewerHasBookmarked:
                  typeof pin?.viewerHasBookmarked === 'boolean'
                    ? pin.viewerHasBookmarked
                    : sharedCached.viewerHasBookmarked,
                bookmarkCount:
                  typeof pin?.bookmarkCount === 'number'
                    ? pin.bookmarkCount
                    : sharedCached.bookmarkCount,
                distanceMeters: pin.distanceMeters ?? sharedCached.distanceMeters,
                startDate: sharedCached.startDate ?? pin.startDate,
                endDate: sharedCached.endDate ?? pin.endDate,
                expiresAt: sharedCached.expiresAt ?? pin.expiresAt,
                type: sharedCached.type ?? pin.type
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
                viewerHasBookmarked:
                  typeof pin?.viewerHasBookmarked === 'boolean'
                    ? pin.viewerHasBookmarked
                    : detail.viewerHasBookmarked,
                bookmarkCount:
                  typeof detail?.bookmarkCount === 'number'
                    ? detail.bookmarkCount
                    : pin?.bookmarkCount ?? detail?.stats?.bookmarkCount ?? pin?.stats?.bookmarkCount,
                distanceMeters: pin.distanceMeters ?? detail.distanceMeters,
                startDate: detail.startDate ?? pin.startDate,
                endDate: detail.endDate ?? pin.endDate,
                expiresAt: detail.expiresAt ?? pin.expiresAt,
                type: detail.type ?? pin.type
              };
              const detailed = { ...merged, __hasDetails: true };
              detailCacheRef.current.set(pin._id, { ts: Date.now(), data: detailed });
              pinCache.upsertPin(detailed);
              return detailed;
            } catch (detailError) {
              if (detailError?.name === 'AbortError') {
                return pin;
              }
              reportClientError(detailError, 'Failed to load full pin details:', {
                source: 'usePinsFeedCore.detail',
                pinId: pin?._id
              });
              return pin;
            }
          })
        );

        if (activeRequestRef.current.id !== requestId) {
          return;
        }

        if (perfEnabled) {
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
          if (perfEnabled) {
            logListPerf('nearby fetch aborted', { requestId });
          }
          if (activeRequestRef.current.id === requestId) {
            isLoadingRef.current = false;
            setLoading(false);
          }
          return;
        }
        if (perfEnabled) {
          logListPerf('nearby fetch failed', {
            fetchNearbyCalls: perfCountersRef.current.fetchNearbyCalls,
            message: err?.message
          });
        }
        reportClientError(err, 'Failed to load nearby pins:', {
          source: 'usePinsFeedCore.fetchPins',
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
      controlledLocation,
      distanceMiles,
      hasSharedLocation,
      hideFullEvents,
      isLocationControlled,
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

  return {
    pins,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation,
    viewerProfileId,
    normalizedFilters,
    refresh: loadPins,
    locationRequired: shouldRequireLocation
  };
}
