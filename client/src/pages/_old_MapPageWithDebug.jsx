import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MapIcon from '@mui/icons-material/Map';
import Map from '../components/Map';
import LocationShare from '../components/LocationShare';
import { routes } from '../routes';
import {
  insertLocationUpdate,
  fetchNearbyUsers,
  fetchPinsNearby,
  fetchCurrentUserProfile,
  fetchChatRooms
} from '../api/mongoDataApi.js';
import { useLocationContext } from '../contexts/LocationContext';
import { auth } from '../firebase';
import Navbar from '../components/Navbar';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';

export const pageConfig = {
  id: 'olddebugmap',
  label: 'Old Map with Debug',
  icon: MapIcon,
  path: '/olddebugmap',
  order: 99,
  protected: true,
  showInNav: true
};

const DEMO_USER_ID = 'demo-user';
const METERS_PER_MILE = 1609.34;
const DEFAULT_RADIUS_MILES = 25;
const DEFAULT_MAX_DISTANCE_METERS = Math.round(DEFAULT_RADIUS_MILES * METERS_PER_MILE);
const EARTH_RADIUS_METERS = 6_371_000;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
const DEFAULT_SPOOF_STEP_MILES = 1;
const SPOOF_MIN_MILES = 0.25;
const SPOOF_MAX_MILES = 5;
const SPOOF_STEP_INCREMENT = 0.25;

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

const toRadians = (value) => (value * Math.PI) / 180;
const metersToLatitudeDegrees = (meters) => (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);
const metersToLongitudeDegrees = (meters, latitude) => {
  const latitudeRadians = toRadians(latitude);
  const denominator = Math.cos(latitudeRadians);
  if (Math.abs(denominator) < 1e-6) {
    return 0;
  }
  return (meters / (EARTH_RADIUS_METERS * denominator)) * (180 / Math.PI);
};
const clampLatitude = (value) => Math.max(-90, Math.min(90, value));
const normalizeLongitude = (value) => {
  if (!Number.isFinite(value)) {
    return value;
  }
  let normalized = value;
  while (normalized > 180) {
    normalized -= 360;
  }
  while (normalized < -180) {
    normalized += 360;
  }
  return normalized;
};
const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === 'object' &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);
const haversineDistanceMeters = (a, b) => {
  if (!a || !b) {
    return Infinity;
  }
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
};
const formatDistanceMiles = (meters) => {
  if (!Number.isFinite(meters)) {
    return null;
  }
  return (meters / METERS_PER_MILE).toFixed(2);
};

function MapPage() {
  const navigate = useNavigate();
  const [authUser] = useAuthState(auth);
  const { isOffline } = useNetworkStatusContext();
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();
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

  const requestBrowserLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
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
  }, []);

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

  useEffect(() => {
    let isMounted = true;

    const resolveProfile = async () => {
      if (!authUser) {
        if (isMounted) {
          setCurrentProfileId(null);
        }
        return;
      }

      if (isOffline) {
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
        console.error('Failed to load current user profile on MapPage:', fetchError);
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
        console.error('Error fetching nearby pins:', err);
        setError(err.message || 'Failed to load nearby pins.');
      } finally {
        setIsLoadingPins(false);
      }
    },
    [currentProfileId, fetchPinsNearby, isOffline, userLocation]
  );

  const refreshNearby = useCallback(async (location = userLocation) => {
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
      console.error('Error fetching nearby users:', err);
      setError(err.message || 'Failed to load nearby users.');
    } finally {
      setIsLoadingNearby(false);
    }
  }, [fetchNearbyUsers, isOffline, userLocation]);

  const pushLocationUpdate = useCallback(async (location) => {
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
  }, [currentProfileId, isOffline]);

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
      console.error('Error getting browser location:', geoError);
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
      await Promise.all([
        refreshNearby(locationToShare),
        refreshPins(locationToShare)
      ]);
    } catch (err) {
      console.error('Error sharing location:', err);
      setError(err.message || 'Failed to share your location.');
      lastSharedLocationRef.current = null;
      setIsSharing(false);
    }
  }, [
    isOffline,
    refreshNearby,
    refreshPins,
    pushLocationUpdate,
    requestBrowserLocation,
    updateGlobalLocation,
    userLocation
  ]);

  const shareDisabled = isOffline || !hasValidCoordinates(userLocation);
  const shareHelperText = isOffline
    ? 'Offline mode: reconnect to share your real-time location.'
    : isUsingFallbackLocation
    ? 'Using default Long Beach location. Enable GPS for precise results.'
    : null;

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
          console.error('Failed to load chat rooms:', err);
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
    const miles = formatDistanceMiles(selectedChatRoomPin?.distanceMeters);
    return miles ? `${miles} mi` : null;
  }, [selectedChatRoomPin]);

  const selectedChatRoomRadiusLabel = useMemo(() => {
    if (!selectedChatRoom || !Number.isFinite(selectedChatRoom.radiusMeters)) {
      return null;
    }
    const miles = formatDistanceMiles(selectedChatRoom.radiusMeters);
    return miles ? `${Math.round(selectedChatRoom.radiusMeters)} m (${miles} mi)` : `${Math.round(selectedChatRoom.radiusMeters)} m`;
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
  useEffect(() => {
    if (hasValidCoordinates(userLocation)) {
      spoofAnchorRef.current = spoofAnchorRef.current ?? userLocation;
    }
  }, [userLocation]);

  useEffect(() => {
    if (!hasValidCoordinates(userLocation) || !isSharing || isOffline) {
      return;
    }

    const lastShared = lastSharedLocationRef.current;
    if (
      lastShared &&
      Math.abs(lastShared.latitude - userLocation.latitude) < 1e-6 &&
      Math.abs(lastShared.longitude - userLocation.longitude) < 1e-6
    ) {
      return;
    }

    let cancelled = false;

    const syncLocationSharing = async () => {
      try {
        await pushLocationUpdate(userLocation);
        if (!cancelled) {
          lastSharedLocationRef.current = userLocation;
          await refreshNearby();
        }
      } catch (err) {
        console.error('Error syncing shared location:', err);
        if (!cancelled) {
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

  const handleViewPinDetails = useCallback(
    (pin) => {
      if (!pin) {
        return;
      }
      const pinId = pin._id ?? pin.id ?? null;
      if (!pinId) {
        return;
      }
      navigate(routes.pin.byId(pinId));
    },
    [navigate]
  );

  const handleViewChatRoom = useCallback(() => {
    navigate(routes.chat.base);
  }, [navigate]);

  const handleViewProfile = useCallback(() => {
    navigate(routes.profile.me);
  }, [navigate]);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        mx: 0,
        mt: { xs: 1, md: 2 },
        mb: { xs: 2, md: 4 },
        borderRadius: 0,
        overflow: 'hidden',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper'
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Pinpoint
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {isSharing ? 'Location sharing is active' : 'Location sharing is paused'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          position: 'relative',
          width: '100vw',
          left: '50%',
          right: '50%',
          marginLeft: '-50vw',
          marginRight: '-50vw',
          overflow: 'visible',
          height: { xs: '65vh', md: '80vh' },
          minHeight: { xs: 420, md: 720 }
        }}
      >
        <Map
          userLocation={userLocation}
          nearbyUsers={nearbyUsers}
          pins={combinedPins}
          userRadiusMeters={DEFAULT_MAX_DISTANCE_METERS}
          selectedPinId={showChatRooms ? selectedChatRoomId : undefined}
          onPinSelect={showChatRooms ? handleMapPinSelect : undefined}
          onPinView={handleViewPinDetails}
          onChatRoomView={handleViewChatRoom}
          onCurrentUserView={handleViewProfile}
          isOffline={isOffline}
        />
      </Box>

      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}>
        <LocationShare
          isSharing={isSharing}
          onToggle={() => (isSharing ? handleStopSharing() : handleStartSharing())}
          disabled={shareDisabled}
          helperText={shareHelperText}
        />

        <FormControlLabel
          control={
            <Switch
              checked={showChatRooms}
              onChange={(event) => setShowChatRooms(event.target.checked)}
              disabled={isOffline}
            />
          }
          label="Show chat room coverage"
        />

        {isLoadingChatRooms ? (
          <Alert severity="info">Loading chat rooms…</Alert>
        ) : null}

        {chatRoomsError ? (
          <Alert severity="warning" onClose={() => setChatRoomsError(null)}>
            {chatRoomsError}
          </Alert>
        ) : null}

        {isOffline ? (
          <Alert severity="warning">
            Offline mode: map data is read-only. Location sharing and live updates will resume when
            you reconnect.
          </Alert>
        ) : null}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={2} alignItems="center">
          {(isLoadingNearby || isLoadingPins) && <CircularProgress color="primary" size={28} />}
          <Typography variant="body2" color="text.secondary">
            {isLoadingNearby || isLoadingPins
              ? 'Loading nearby data…'
              : `Showing pins within a ${DEFAULT_RADIUS_MILES}-mile radius`}
          </Typography>
        </Stack>

        <Paper elevation={1} sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">GPS Spoofing</Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Step size: {spoofStepMiles.toFixed(2)} mile{spoofStepMiles === 1 ? '' : 's'}
              </Typography>
              <Slider
                min={SPOOF_MIN_MILES}
                max={SPOOF_MAX_MILES}
                step={SPOOF_STEP_INCREMENT}
                value={spoofStepMiles}
                onChange={(_, value) => {
                  if (typeof value === 'number') {
                    setSpoofStepMiles(value);
                  }
                }}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(2)} mi`}
              />
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleSpoofMove('north')}
                disabled={isOffline}
                sx={{ minWidth: 96 }}
              >
                North
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleSpoofMove('west')}
                disabled={isOffline}
                sx={{ minWidth: 96 }}
              >
                West
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleSpoofMove('east')}
                disabled={isOffline}
                sx={{ minWidth: 96 }}
              >
                East
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleSpoofMove('south')}
                disabled={isOffline}
                sx={{ minWidth: 96 }}
              >
                South
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" align="center">
              Each press moves the simulated location ~2 miles.
            </Typography>
          </Stack>
        </Paper>

        {showChatRooms ? (
          <Paper elevation={1} sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">Chat room coverage</Typography>
              <Typography variant="body2" color="text.secondary">
                {isLoadingChatRooms
                  ? 'Loading chat rooms…'
                  : chatRoomPins.length
                  ? `Displaying ${chatRoomPins.length} chat room${chatRoomPins.length === 1 ? '' : 's'} near this area.`
                  : 'No chat rooms found near this location.'}
              </Typography>
              {selectedChatRoom ? (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">
                    {selectedChatRoom.name ?? 'Untitled chat room'}
                    {selectedChatRoom.isGlobal ? ' (global)' : ''}
                  </Typography>
                  {selectedChatRoom.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {selectedChatRoom.description}
                    </Typography>
                  ) : null}
                  {selectedChatRoomRadiusLabel ? (
                    <Typography variant="body2" color="text.secondary">
                      Radius: {selectedChatRoomRadiusLabel}
                    </Typography>
                  ) : null}
                  {selectedChatRoomDistanceLabel ? (
                    <Typography variant="body2" color="text.secondary">
                      Distance from you: {selectedChatRoomDistanceLabel}
                    </Typography>
                  ) : null}
                </Stack>
              ) : chatRoomPins.length ? (
                <Typography variant="body2" color="text.secondary">
                  Select a chat room marker to view details.
                </Typography>
              ) : null}
            </Stack>
          </Paper>
        ) : null}
      </Stack>

      <Navbar />
    </Box>
  );
}

export default MapPage;
