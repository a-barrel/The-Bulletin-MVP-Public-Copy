import { useState, useEffect, useCallback, useRef } from 'react';
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
import { insertLocationUpdate, fetchNearbyUsers, fetchPinsNearby } from '../api/mongoDataApi.js';

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
const DEFAULT_MAX_DISTANCE_METERS = DEFAULT_RADIUS_MILES * METERS_PER_MILE;
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
  const [userLocation, setUserLocation] = useState(FALLBACK_LOCATION);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [pins, setPins] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(false);
  const [error, setError] = useState(null);
  const lastSharedLocationRef = useRef(null);

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
            longitude: position.coords.longitude
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
    await insertLocationUpdate({
      userId: DEMO_USER_ID,
      coordinates: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      },
      isPublic: true,
      source: 'web',
      createdAt: timestamp,
      lastSeenAt: timestamp
    });
  }, [insertLocationUpdate]);

  const handleStartSharing = useCallback(async () => {
    let locationToShare = userLocation;

    try {
      const resolvedLocation = await requestBrowserLocation();
      locationToShare = resolvedLocation;
      setUserLocation((prev) => {
        if (
          prev &&
          Math.abs(prev.latitude - resolvedLocation.latitude) < 1e-9 &&
          Math.abs(prev.longitude - resolvedLocation.longitude) < 1e-9
        ) {
          return prev;
        }
        return resolvedLocation;
      });
      setIsUsingFallbackLocation(false);
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
      await refreshNearby(locationToShare);
    } catch (err) {
      console.error('Error sharing location:', err);
      setError(err.message || 'Failed to share your location.');
      lastSharedLocationRef.current = null;
      setIsSharing(false);
    }
  }, [userLocation, requestBrowserLocation, pushLocationUpdate, refreshNearby]);

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

  const shiftLocation = useCallback((direction) => {
    setUserLocation((previous) => {
      const source = previous ?? FALLBACK_LOCATION;
      const latitudeStep = metersToLatitudeDegrees(SPOOF_STEP_METERS);
      const longitudeStep = metersToLongitudeDegrees(SPOOF_STEP_METERS, source.latitude);

      let nextLatitude = source.latitude;
      let nextLongitude = source.longitude;

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
          return source;
      }

      const clampedLatitude = clampLatitude(nextLatitude);
      const normalizedLongitude = normalizeLongitude(nextLongitude);

      if (
        Math.abs(clampedLatitude - source.latitude) < 1e-9 &&
        Math.abs(normalizedLongitude - source.longitude) < 1e-9
      ) {
        return source;
      }

      return {
        latitude: clampedLatitude,
        longitude: normalizedLongitude
      };
    });
  }, []);

  const handleSpoofMove = useCallback(
    (direction) => {
      setError((prev) =>
        prev && prev.toLowerCase().includes('failed to load') ? null : prev
      );
      setIsUsingFallbackLocation(false);
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
    </Box>
  );
}

export default MapPage;
