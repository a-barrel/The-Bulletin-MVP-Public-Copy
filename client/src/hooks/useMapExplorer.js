import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

import { insertLocationUpdate } from '../api';
import { auth } from '../firebase';
import {
  clampLatitude,
  haversineDistanceMeters,
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
  normalizeLongitude,
  METERS_PER_MILE
} from '../utils/geo';
import reportClientError from '../utils/reportClientError';
import {
  DEMO_USER_ID,
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_SPOOF_STEP_MILES,
  FALLBACK_LOCATION,
  SPOOF_MAX_MILES,
  SPOOF_MIN_MILES,
  SPOOF_STEP_INCREMENT
} from '../utils/mapExplorerConstants';

export { DEFAULT_SPOOF_STEP_MILES, SPOOF_MAX_MILES };
import { hasValidCoordinates } from '../utils/mapLocation';
import useMapViewerProfile from './useMapViewerProfile';
import useMapNearbyData from './useMapNearbyData';
import useMapChatRooms from './useMapChatRooms';
import { usePinCache } from '../contexts/PinCacheContext';

const requestBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000
      }
    );
  });

export default function useMapExplorer({
  sharedLocation,
  setSharedLocation,
  isOffline,
  hideFullEvents = true,
  enforceLocation = false,
  isAdminExempt = false
}) {
  const [authUser] = useAuthState(auth);
  const shouldRequireLocation = enforceLocation && !isOffline && !isAdminExempt;

  const sharedLatitude = sharedLocation?.latitude ?? null;
  const sharedLongitude = sharedLocation?.longitude ?? null;
  const sharedAccuracy = sharedLocation?.accuracy;
  const initialLocation = hasValidCoordinates(sharedLocation)
    ? {
        latitude: sharedLatitude,
        longitude: sharedLongitude,
        ...(sharedAccuracy !== undefined ? { accuracy: sharedAccuracy } : {})
      }
    : shouldRequireLocation
    ? null
    : FALLBACK_LOCATION;

  const [userLocation, setUserLocation] = useState(initialLocation);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(
    !hasValidCoordinates(sharedLocation) && !shouldRequireLocation
  );
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);
  const lastSharedLocationRef = useRef(null);
  const spoofAnchorRef = useRef(null);
  const [spoofStepMiles, setSpoofStepMiles] = useState(DEFAULT_SPOOF_STEP_MILES);

  const { viewerProfile, currentProfileId, pinFetchLimit } = useMapViewerProfile({
    authUser,
    isOffline
  });
  const pinCache = usePinCache();

  const [adminChatView, setAdminChatView] = useState(false);

  const {
    nearbyUsers,
    pins,
    refreshPins,
    refreshNearby,
    isLoadingNearby,
    isLoadingPins,
    clearNearbyUsers
  } = useMapNearbyData({
    userLocation,
    isOffline,
    pinFetchLimit,
    currentProfileId,
    setGlobalError: setError,
    hideFullEvents,
    cacheNamespace: 'nearby-shared'
  });

  const {
    showChatRooms,
    setShowChatRooms,
    chatRoomPins,
    isLoadingChatRooms,
    chatRoomsError,
    setChatRoomsError,
    selectedChatRoomId,
    setSelectedChatRoomId,
    selectedChatRoom,
    selectedChatRoomDistanceLabel,
    selectedChatRoomRadiusLabel,
    handleMapPinSelect
  } = useMapChatRooms({ userLocation, isOffline, adminView: adminChatView, authUser });

  useEffect(() => {
    if (!Number.isFinite(sharedLatitude) || !Number.isFinite(sharedLongitude)) {
      if (shouldRequireLocation) {
        setIsUsingFallbackLocation(true);
        setUserLocation(null);
        setError((prev) => prev ?? 'Location required to use the map. Enable location services.');
        return;
      }
      return;
    }
    setUserLocation((prev) => {
      if (
        prev &&
        Math.abs(prev.latitude - sharedLatitude) < 1e-9 &&
        Math.abs(prev.longitude - sharedLongitude) < 1e-9
      ) {
        if (
          sharedAccuracy !== undefined &&
          sharedAccuracy !== prev.accuracy
        ) {
          return {
            ...prev,
            accuracy: sharedAccuracy
          };
        }
        return prev;
      }
      return {
        latitude: sharedLatitude,
        longitude: sharedLongitude,
        ...(sharedAccuracy !== undefined ? { accuracy: sharedAccuracy } : {})
      };
    });
    setIsUsingFallbackLocation(false);
    setError((prev) =>
      prev && prev.toLowerCase().includes('location required') ? null : prev
    );
  }, [sharedLatitude, sharedLongitude, sharedAccuracy, shouldRequireLocation]);

  const updateGlobalLocation = useCallback(
    (next, { source } = {}) => {
      if (!hasValidCoordinates(next)) {
        return null;
      }
      const normalized = {
        latitude: Number(next.latitude),
        longitude: Number(next.longitude)
      };
      if (Number.isFinite(next.accuracy)) {
        normalized.accuracy = Number(next.accuracy);
      }

      let computed = normalized;
      setUserLocation((prev) => {
        if (
          prev &&
          Math.abs(prev.latitude - normalized.latitude) < 1e-9 &&
          Math.abs(prev.longitude - normalized.longitude) < 1e-9
        ) {
          if (
            normalized.accuracy !== undefined &&
            normalized.accuracy !== prev.accuracy
          ) {
            computed = { ...prev, accuracy: normalized.accuracy };
            return computed;
          }
          computed = prev;
          return prev;
        }
        return normalized;
      });

      const accuracyMatches =
        normalized.accuracy === undefined ||
        (sharedAccuracy !== undefined &&
          Math.abs(sharedAccuracy - normalized.accuracy) < 1e-6);

      if (
        !(
          Math.abs((sharedLatitude ?? 0) - normalized.latitude) < 1e-9 &&
          Math.abs((sharedLongitude ?? 0) - normalized.longitude) < 1e-9 &&
          accuracyMatches
        )
      ) {
        setSharedLocation({ ...normalized, source });
      }

      setIsUsingFallbackLocation(false);
      return computed;
    },
    [setSharedLocation, sharedLatitude, sharedLongitude, sharedAccuracy]
  );

  const pushLocationUpdate = useCallback(
    async (location) => {
      if (!hasValidCoordinates(location)) {
      throw new Error('Location permission is required to continue.');
      }
      if (isOffline) {
        throw new Error('Location sharing is unavailable while offline.');
      }
      const timestamp = new Date().toISOString();
      const userId = currentProfileId ?? DEMO_USER_ID;
      await insertLocationUpdate({
        userId,
        coordinates: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        },
        isPublic: true,
        source: 'web',
        createdAt: timestamp,
        lastSeenAt: timestamp
      });
    },
    [currentProfileId, isOffline]
  );

  const handleStartSharing = useCallback(async () => {
    if (isOffline) {
      setError('You are offline. Connect to provide your location.');
      setIsSharing(false);
      return;
    }

    let locationToShare = userLocation;

    try {
      const resolvedLocation = await requestBrowserLocation();
      const normalized = updateGlobalLocation(resolvedLocation, { source: 'browser' });
      if (normalized) {
        locationToShare = normalized;
      } else if (hasValidCoordinates(resolvedLocation)) {
        locationToShare = resolvedLocation;
      }
      setError(null);
    } catch (geoError) {
      reportClientError(geoError, 'Error getting browser location:', {
        source: 'useMapExplorer.browserLocation'
      });
      if (geoError?.code === 1) {
        setError('Location permission denied. Enable location access to share.');
      } else if (geoError?.code === 2) {
        setError('Device location unavailable. Check your GPS or network settings.');
      } else if (geoError?.code === 3) {
        setError('Timed out retrieving device location. Try again.');
      } else {
        setError(
          geoError?.message || 'We could not access your location. Using default Long Beach coordinates.'
        );
      }
      setIsSharing(false);
      return;
    }

    setError((prev) =>
      prev && prev.toLowerCase().includes('failed to load') ? null : prev
    );
    setIsSharing(true);
    try {
      await pushLocationUpdate(locationToShare);
      lastSharedLocationRef.current = locationToShare;
      await Promise.all([refreshNearby(locationToShare), refreshPins(locationToShare)]);
    } catch (err) {
      reportClientError(err, 'Error sharing location:', {
        source: 'useMapExplorer.shareLocation',
        location: locationToShare
      });
      setError(err.message || 'Failed to update your location.');
      lastSharedLocationRef.current = null;
      setIsSharing(false);
    }
  }, [isOffline, pushLocationUpdate, refreshNearby, refreshPins, updateGlobalLocation, userLocation]);

  const handleStopSharing = useCallback(() => {
    setIsSharing(false);
    clearNearbyUsers();
    lastSharedLocationRef.current = null;
  }, [clearNearbyUsers]);

  useEffect(() => {
    if (!hasValidCoordinates(userLocation) || isOffline) {
      return;
    }
    refreshPins(userLocation);
  }, [isOffline, refreshPins, userLocation]);

  useEffect(() => {
    let cancelled = false;

    const syncLocationSharing = async () => {
      if (!isSharing || isOffline) {
        return;
      }
      if (!hasValidCoordinates(userLocation)) {
        return;
      }
      if (
        lastSharedLocationRef.current &&
        Math.abs(lastSharedLocationRef.current.latitude - userLocation.latitude) < 1e-6 &&
        Math.abs(lastSharedLocationRef.current.longitude - userLocation.longitude) < 1e-6
      ) {
        return;
      }
      try {
        await pushLocationUpdate(userLocation);
        if (!cancelled) {
          lastSharedLocationRef.current = userLocation;
        }
      } catch (err) {
        if (!cancelled) {
          reportClientError(err, 'Failed to sync shared location:', {
            source: 'useMapExplorer.syncSharedLocation',
            userLocation
          });
          setError(err.message || 'Failed to update your location.');
          lastSharedLocationRef.current = null;
          setIsSharing(false);
        }
      }
    };

    syncLocationSharing();

    return () => {
      cancelled = true;
    };
  }, [isOffline, isSharing, pushLocationUpdate, refreshNearby, userLocation]);

  useEffect(() => {
    if (!isSharing || isOffline) {
      return undefined;
    }
    const intervalId = window.setInterval(refreshNearby, 5_000);
    return () => window.clearInterval(intervalId);
  }, [isOffline, isSharing, refreshNearby]);

  const shiftLocation = useCallback(
    (direction) => {
      const base =
        hasValidCoordinates(userLocation)
          ? userLocation
          : Number.isFinite(sharedLatitude) && Number.isFinite(sharedLongitude)
          ? {
              latitude: sharedLatitude,
              longitude: sharedLongitude,
              ...(sharedAccuracy !== undefined ? { accuracy: sharedAccuracy } : {})
            }
          : FALLBACK_LOCATION;

      const stepMeters = spoofStepMiles * METERS_PER_MILE;
      const latitudeStep = metersToLatitudeDegrees(stepMeters);
      const longitudeStep = metersToLongitudeDegrees(stepMeters, base.latitude);

      let nextLatitude = base.latitude;
      let nextLongitude = base.longitude;

      switch (direction) {
        case 'north':
          nextLatitude += latitudeStep;
          break;
        case 'south':
          nextLatitude -= latitudeStep;
          break;
        case 'east':
          nextLongitude += longitudeStep;
          break;
        case 'west':
          nextLongitude -= longitudeStep;
          break;
        default:
          return;
      }

      const clampedLatitude = clampLatitude(nextLatitude);
      const normalizedLongitude = normalizeLongitude(nextLongitude);

      if (
        Math.abs(clampedLatitude - base.latitude) < 1e-9 &&
        Math.abs(normalizedLongitude - base.longitude) < 1e-9
      ) {
        return;
      }

      const anchor = spoofAnchorRef.current || base;
      const proposed = { latitude: clampedLatitude, longitude: normalizedLongitude };
      const distanceFromAnchor = haversineDistanceMeters(anchor, proposed);
      if (distanceFromAnchor > DEFAULT_MAX_DISTANCE_METERS) {
        setError(
          `Spoofing limited to ${Math.round(DEFAULT_MAX_DISTANCE_METERS / METERS_PER_MILE)} miles from your anchor location.`
        );
        return;
      }

      const MAX_LATITUDE = 85;
      if (Math.abs(clampedLatitude) > MAX_LATITUDE) {
        setError(
          'That move would take you outside the supported map bounds. Resetting to Long Beach.'
        );
        const resetAnchor = FALLBACK_LOCATION;
        spoofAnchorRef.current = resetAnchor;
        updateGlobalLocation(resetAnchor, { source: 'map-spoof-reset' });
        return;
      }

      updateGlobalLocation(
        {
          latitude: clampedLatitude,
          longitude: normalizedLongitude,
          accuracy: base.accuracy
        },
        { source: 'map-spoof' }
      );
    },
    [sharedAccuracy, sharedLatitude, sharedLongitude, spoofStepMiles, updateGlobalLocation, userLocation]
  );

  const handleSpoofMove = useCallback(
    (direction) => {
      if (isOffline) {
        setError((prev) => prev ?? 'Reconnect to adjust spoofed location.');
        return;
      }
      setError((prev) =>
        prev && prev.toLowerCase().includes('failed to load') ? null : prev
      );
      shiftLocation(direction);
    },
    [isOffline, shiftLocation]
  );

  const teleportToLocation = useCallback(
    async (nextLocation, options = {}) => {
      if (
        !nextLocation ||
        !Number.isFinite(nextLocation.latitude) ||
        !Number.isFinite(nextLocation.longitude)
      ) {
        return;
      }
      const updated = updateGlobalLocation(
        {
          latitude: Number(nextLocation.latitude),
          longitude: Number(nextLocation.longitude),
          accuracy:
            Number.isFinite(nextLocation.accuracy) && nextLocation.accuracy >= 0
              ? Number(nextLocation.accuracy)
              : undefined
        },
        { source: options.source || 'map-teleport' }
      );
      if (updated) {
        refreshPins(updated);
        refreshNearby(updated);
        if (!isOffline) {
          try {
            await pushLocationUpdate(updated);
          } catch (error) {
            reportClientError(error, 'Failed to push teleport location update', {
              source: 'useMapExplorer.teleport',
              latitude: updated.latitude,
              longitude: updated.longitude
            });
          }
        }
      }
    },
    [isOffline, pushLocationUpdate, refreshNearby, refreshPins, updateGlobalLocation]
  );

  const combinedPins = useMemo(() => {
    if (!showChatRooms) {
      pinCache.setPins(pins);
      return pins;
    }
    const merged = [...pins, ...chatRoomPins];
    pinCache.setPins(merged);
    return merged;
  }, [chatRoomPins, pinCache, pins, showChatRooms]);

  const shareDisabled = isOffline || !hasValidCoordinates(userLocation);
  const shareHelperText = isOffline
    ? 'Offline mode: reconnect to share your real-time location.'
    : shouldRequireLocation && !hasValidCoordinates(userLocation)
    ? 'Location required: enable GPS/location to view and interact with the map.'
    : isUsingFallbackLocation
    ? 'Using default Long Beach location. Enable GPS for precise results.'
    : null;

  return {
    authUser,
    viewerProfile,
    userLocation,
    nearbyUsers,
    pins,
    combinedPins,
    chatRoomPins,
    showChatRooms,
    setShowChatRooms,
    isUsingFallbackLocation,
    locationRequired: shouldRequireLocation,
    hasResolvedLocation: hasValidCoordinates(userLocation),
    isSharing,
    shareDisabled,
    shareHelperText,
    handleStartSharing,
    handleStopSharing,
    handleSpoofMove,
    spoofStepMiles,
    setSpoofStepMiles,
    handleMapPinSelect,
    refreshPins,
    refreshNearby,
    isLoadingNearby,
    isLoadingPins,
    isLoadingChatRooms,
    chatRoomsError,
    setChatRoomsError,
    error,
    setError,
    selectedChatRoomId,
    setSelectedChatRoomId,
    selectedChatRoom,
    selectedChatRoomRadiusLabel,
    selectedChatRoomDistanceLabel,
    teleportToLocation,
    setAdminChatView
  };
}
