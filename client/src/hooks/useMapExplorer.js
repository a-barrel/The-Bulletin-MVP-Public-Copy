import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

import {
  insertLocationUpdate,
  fetchNearbyUsers,
  fetchPinsNearby,
  fetchCurrentUserProfile,
  fetchChatRooms
} from '../api/mongoDataApi';
import { auth } from '../firebase';
import {
  clampLatitude,
  formatDistanceMiles,
  haversineDistanceMeters,
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
  normalizeLongitude,
  METERS_PER_MILE
} from '../utils/geo';
import reportClientError from '../utils/reportClientError';

const DEMO_USER_ID = 'demo-user';
export const DEFAULT_RADIUS_MILES = 25;
export const DEFAULT_MAX_DISTANCE_METERS = Math.round(DEFAULT_RADIUS_MILES * METERS_PER_MILE);
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
export const DEFAULT_SPOOF_STEP_MILES = 1;
export const SPOOF_MIN_MILES = 0.25;
export const SPOOF_MAX_MILES = 5;
export const SPOOF_STEP_INCREMENT = 0.25;

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'object') {
    if (typeof value._id === 'string') {
      const trimmed = value._id.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value.id === 'string') {
      const trimmed = value.id.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value.$oid === 'string') {
      const trimmed = value.$oid.trim();
      return trimmed.length ? trimmed : null;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === 'object' &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);

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
  isOffline
}) {
  const [authUser] = useAuthState(auth);

  const sharedLatitude = sharedLocation?.latitude ?? null;
  const sharedLongitude = sharedLocation?.longitude ?? null;
  const sharedAccuracy = sharedLocation?.accuracy;
  const initialLocation = hasValidCoordinates(sharedLocation)
    ? {
        latitude: sharedLatitude,
        longitude: sharedLongitude,
        ...(sharedAccuracy !== undefined ? { accuracy: sharedAccuracy } : {})
      }
    : FALLBACK_LOCATION;

  const [userLocation, setUserLocation] = useState(initialLocation);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(
    !hasValidCoordinates(sharedLocation)
  );
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [pins, setPins] = useState([]);
  const [showChatRooms, setShowChatRooms] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [isLoadingChatRooms, setIsLoadingChatRooms] = useState(false);
  const [chatRoomsError, setChatRoomsError] = useState(null);
  const [selectedChatRoomId, setSelectedChatRoomId] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(false);
  const [error, setError] = useState(null);
  const lastSharedLocationRef = useRef(null);
  const [currentProfileId, setCurrentProfileId] = useState(null);
  const spoofAnchorRef = useRef(null);
  const [spoofStepMiles, setSpoofStepMiles] = useState(DEFAULT_SPOOF_STEP_MILES);

  useEffect(() => {
    if (!Number.isFinite(sharedLatitude) || !Number.isFinite(sharedLongitude)) {
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
  }, [sharedLatitude, sharedLongitude, sharedAccuracy]);

  useEffect(() => {
    let isMounted = true;

    const resolveProfile = async () => {
      if (!authUser || isOffline) {
        if (isMounted) {
          setCurrentProfileId(null);
        }
        return;
      }

      try {
        const profile = await fetchCurrentUserProfile();
        if (isMounted) {
          setCurrentProfileId(profile?._id ? String(profile._id) : null);
        }
      } catch (fetchError) {
        reportClientError(fetchError, 'Failed to load current user profile on MapPage:', {
          source: 'useMapExplorer.profile'
        });
        if (isMounted) {
          setCurrentProfileId(null);
        }
      }
    };

    resolveProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser, isOffline]);

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
        setError((prev) => prev ?? 'Offline mode: pin data may be stale.');
        return;
      }

      setIsLoadingPins(true);
      try {
        const results = await fetchPinsNearby({
          latitude: location.latitude,
          longitude: location.longitude,
          distanceMiles: DEFAULT_RADIUS_MILES,
          limit: PIN_FETCH_LIMIT
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
        setError((prev) =>
          prev && prev.toLowerCase().includes('failed to load nearby pins') ? null : prev
        );
      } catch (err) {
        reportClientError(err, 'Error fetching nearby pins:', {
          source: 'useMapExplorer.fetchPins',
          location
        });
        setError(err.message || 'Failed to load nearby pins.');
      } finally {
        setIsLoadingPins(false);
      }
    },
    [currentProfileId, isOffline, userLocation]
  );

  const refreshNearby = useCallback(
    async (location = userLocation) => {
      if (!hasValidCoordinates(location)) return;

      if (isOffline) {
        setIsLoadingNearby(false);
        setError((prev) => prev ?? 'Offline mode: nearby activity is unavailable.');
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
        setError((prev) =>
          prev && prev.toLowerCase().includes('failed to load nearby users') ? null : prev
        );
      } catch (err) {
        reportClientError(err, 'Error fetching nearby users:', {
          source: 'useMapExplorer.fetchNearbyUsers',
          location
        });
        setError(err.message || 'Failed to load nearby users.');
      } finally {
        setIsLoadingNearby(false);
      }
    },
    [isOffline, userLocation]
  );

  const pushLocationUpdate = useCallback(
    async (location) => {
      if (!hasValidCoordinates(location)) {
        throw new Error('Cannot share location without valid coordinates.');
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
      setError('You are offline. Connect to share your location.');
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
      setError(err.message || 'Failed to share your location.');
      lastSharedLocationRef.current = null;
      setIsSharing(false);
    }
  }, [isOffline, pushLocationUpdate, refreshNearby, refreshPins, updateGlobalLocation, userLocation]);

  const handleStopSharing = useCallback(() => {
    setIsSharing(false);
    setNearbyUsers([]);
    lastSharedLocationRef.current = null;
  }, []);

  useEffect(() => {
    if (!hasValidCoordinates(userLocation) || isOffline) {
      return;
    }
    refreshPins(userLocation);
  }, [isOffline, refreshPins, userLocation]);

  useEffect(() => {
    if (!showChatRooms) {
      setChatRooms([]);
      setChatRoomsError(null);
      setIsLoadingChatRooms(false);
      setSelectedChatRoomId(null);
      return;
    }

    if (isOffline) {
      setChatRooms([]);
      setChatRoomsError('Reconnect to load chat rooms.');
      setIsLoadingChatRooms(false);
      return;
    }

    const latitude = Number.isFinite(userLocation?.latitude) ? userLocation.latitude : undefined;
    const longitude = Number.isFinite(userLocation?.longitude) ? userLocation.longitude : undefined;

    let cancelled = false;
    setIsLoadingChatRooms(true);
    setChatRoomsError(null);

    fetchChatRooms({ latitude, longitude, maxDistanceMiles: 50 })
      .then((rooms) => {
        if (!cancelled) {
          setChatRooms(Array.isArray(rooms) ? rooms : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          reportClientError(err, 'Failed to load chat rooms:', {
            source: 'useMapExplorer.chatRooms',
            latitude,
            longitude
          });
          setChatRooms([]);
          setChatRoomsError(err?.message || 'Failed to load chat rooms.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingChatRooms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOffline, showChatRooms, userLocation]);

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
          setError(err.message || 'Failed to share your location.');
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
    const intervalId = window.setInterval(refreshNearby, 60000);
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

  const handleMapPinSelect = useCallback(
    (pin) => {
      if (!pin || !showChatRooms) {
        return;
      }
      if (pin.type === 'chat-room' || pin.type === 'global-chat-room') {
        setSelectedChatRoomId(pin._id ?? null);
      }
    },
    [showChatRooms]
  );

  const chatRoomPins = useMemo(() => {
    if (!showChatRooms) {
      return [];
    }

    return chatRooms
      .map((room, index) => {
        const coordinatesArray = room?.coordinates?.coordinates || room?.location?.coordinates;
        if (!Array.isArray(coordinatesArray) || coordinatesArray.length < 2) {
          return null;
        }
        const [longitude, latitude] = coordinatesArray;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const id = room?._id ? String(room._id) : `chat-room-${index}`;
        const distance = hasValidCoordinates(userLocation)
          ? haversineDistanceMeters(userLocation, { latitude, longitude })
          : null;

        return {
          _id: id,
          title: room?.name || 'Chat room',
          type: room?.isGlobal ? 'global-chat-room' : 'chat-room',
          coordinates: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          proximityRadiusMeters: Number.isFinite(room?.radiusMeters) ? room.radiusMeters : undefined,
          description: room?.description || undefined,
          distanceMeters: Number.isFinite(distance) ? distance : undefined,
          metadata: room
        };
      })
      .filter(Boolean);
  }, [chatRooms, showChatRooms, userLocation]);

  const combinedPins = useMemo(() => {
    if (!showChatRooms) {
      return pins;
    }
    return [...pins, ...chatRoomPins];
  }, [chatRoomPins, pins, showChatRooms]);

  const selectedChatRoom = useMemo(() => {
    if (!selectedChatRoomId) {
      return null;
    }
    return chatRooms.find((room) => String(room?._id) === String(selectedChatRoomId)) ?? null;
  }, [chatRooms, selectedChatRoomId]);

  const selectedChatRoomPin = useMemo(() => {
    if (!selectedChatRoomId) {
      return null;
    }
    return chatRoomPins.find((pin) => pin._id === selectedChatRoomId) ?? null;
  }, [chatRoomPins, selectedChatRoomId]);

  const selectedChatRoomDistanceLabel = useMemo(() => {
    const miles = formatDistanceMiles(selectedChatRoomPin?.distanceMeters, { decimals: 2 });
    return miles ? `${miles} mi` : null;
  }, [selectedChatRoomPin]);

  const selectedChatRoomRadiusLabel = useMemo(() => {
    if (!selectedChatRoom || !Number.isFinite(selectedChatRoom.radiusMeters)) {
      return null;
    }
    const miles = formatDistanceMiles(selectedChatRoom.radiusMeters, { decimals: 2 });
    return miles
      ? `${Math.round(selectedChatRoom.radiusMeters)} m (${miles} mi)`
      : `${Math.round(selectedChatRoom.radiusMeters)} m`;
  }, [selectedChatRoom]);

  useEffect(() => {
    if (!selectedChatRoomId) {
      return;
    }
    if (!chatRooms.some((room) => String(room?._id) === String(selectedChatRoomId))) {
      setSelectedChatRoomId(null);
    }
  }, [chatRooms, selectedChatRoomId]);

  useEffect(() => {
    if (!showChatRooms || !chatRoomPins.length) {
      return;
    }
    if (!selectedChatRoomId) {
      const first = chatRoomPins[0];
      setSelectedChatRoomId(first._id ?? null);
    }
  }, [chatRoomPins, selectedChatRoomId, showChatRooms]);

  const shareDisabled = isOffline || !hasValidCoordinates(userLocation);
  const shareHelperText = isOffline
    ? 'Offline mode: reconnect to share your real-time location.'
    : isUsingFallbackLocation
    ? 'Using default Long Beach location. Enable GPS for precise results.'
    : null;

  return {
    authUser,
    userLocation,
    nearbyUsers,
    pins,
    combinedPins,
    chatRoomPins,
    showChatRooms,
    setShowChatRooms,
    isUsingFallbackLocation,
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
    selectedChatRoomDistanceLabel
  };
}
