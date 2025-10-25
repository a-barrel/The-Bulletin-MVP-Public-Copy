import { useState, useEffect, useCallback, useRef } from 'react';
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
import MapIcon from '@mui/icons-material/Map';
import Map from '../components/Map';
import LocationShare from '../components/LocationShare';
import {
  insertLocationUpdate,
  fetchNearbyUsers,
  fetchPinsNearby,
  fetchCurrentUserProfile
} from '../api/mongoDataApi.js';
import { useLocationContext } from '../contexts/LocationContext';
import { auth } from '../firebase';
import Navbar from '../components/Navbar';

export const pageConfig = {
  id: 'map',
  label: 'Map',
  icon: MapIcon,
  path: '/map',
  order: 1,
  protected: true,
  showInNav: true
};

const DEMO_USER_ID = 'demo-user';
const METERS_PER_MILE = 1609.34;
const DEFAULT_RADIUS_MILES = 10;
const DEFAULT_MAX_DISTANCE_METERS = Math.round(DEFAULT_RADIUS_MILES * METERS_PER_MILE);
const SPOOF_STEP_METERS = 3218; // ~2 miles
const EARTH_RADIUS_METERS = 6_371_000;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };

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

function MapPage() {
  const [authUser] = useAuthState(auth);
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
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(false);
  const [error, setError] = useState(null);
  const lastSharedLocationRef = useRef(null);
  const [currentProfileId, setCurrentProfileId] = useState(null);

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
  }, [authUser]);

  const refreshPins = useCallback(
    async (location = userLocation) => {
      if (!hasValidCoordinates(location)) {
        if (!location) {
          setPins([]);
        }
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
        setPins(results);
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
    [userLocation, fetchPinsNearby]
  );

  const refreshNearby = useCallback(async (location = userLocation) => {
    if (!hasValidCoordinates(location)) return;

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
  }, [userLocation, fetchNearbyUsers]);

  const pushLocationUpdate = useCallback(async (location) => {
    if (!hasValidCoordinates(location)) {
      throw new Error('Cannot share location without valid coordinates.');
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
  }, [currentProfileId]);

  const handleStartSharing = useCallback(async () => {
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
    userLocation,
    requestBrowserLocation,
    updateGlobalLocation,
    pushLocationUpdate,
    refreshNearby,
    refreshPins
  ]);

  const shareDisabled = !hasValidCoordinates(userLocation);
  const shareHelperText = isUsingFallbackLocation
    ? 'Using default Long Beach location. Enable GPS for precise results.'
    : null;

  const handleStopSharing = useCallback(() => {
    setIsSharing(false);
    setNearbyUsers([]);
    lastSharedLocationRef.current = null;
  }, []);

  useEffect(() => {
    if (!hasValidCoordinates(userLocation)) {
      return;
    }
    refreshPins(userLocation);
  }, [userLocation, refreshPins]);

  useEffect(() => {
    if (!hasValidCoordinates(userLocation) || !isSharing) {
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
  }, [userLocation, isSharing, pushLocationUpdate, refreshNearby]);

  useEffect(() => {
    if (!isSharing) {
      return undefined;
    }
    const intervalId = window.setInterval(refreshNearby, 60000);
    return () => window.clearInterval(intervalId);
  }, [isSharing, refreshNearby]);

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

      const latitudeStep = metersToLatitudeDegrees(SPOOF_STEP_METERS);
      const longitudeStep = metersToLongitudeDegrees(SPOOF_STEP_METERS, base.latitude);

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

      updateGlobalLocation(
        {
          latitude: clampedLatitude,
          longitude: normalizedLongitude,
          accuracy: base.accuracy
        },
        { source: 'map-spoof' }
      );
    },
    [userLocation, sharedLatitude, sharedLongitude, sharedAccuracy, updateGlobalLocation]
  );

  const handleSpoofMove = useCallback(
    (direction) => {
      setError((prev) =>
        prev && prev.toLowerCase().includes('failed to load') ? null : prev
      );
      shiftLocation(direction);
    },
    [shiftLocation]
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        mt: 2,
        mb: 4,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: (theme) => theme.shadows[4],
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
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          aspectRatio: { xs: '3 / 4', md: '4 / 3' },
          minHeight: 320
        }}
      >
        <Map
          userLocation={userLocation}
          nearbyUsers={nearbyUsers}
          pins={pins}
          userRadiusMeters={DEFAULT_MAX_DISTANCE_METERS}
        />
      </Box>

      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}>
        <LocationShare
          isSharing={isSharing}
          onToggle={() => (isSharing ? handleStopSharing() : handleStartSharing())}
          disabled={shareDisabled}
          helperText={shareHelperText}
        />

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
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button variant="contained" size="small" onClick={() => handleSpoofMove('north')} sx={{ minWidth: 96 }}>
                North
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button variant="contained" size="small" onClick={() => handleSpoofMove('west')} sx={{ minWidth: 96 }}>
                West
              </Button>
              <Button variant="contained" size="small" onClick={() => handleSpoofMove('east')} sx={{ minWidth: 96 }}>
                East
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button variant="contained" size="small" onClick={() => handleSpoofMove('south')} sx={{ minWidth: 96 }}>
                South
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" align="center">
              Each press moves the simulated location ~2 miles.
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      <Navbar />
    </Box>
  );
}

export default MapPage;
