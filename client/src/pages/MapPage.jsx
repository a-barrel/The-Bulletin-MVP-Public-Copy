import { useState, useEffect, useCallback } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MapIcon from '@mui/icons-material/Map';
import Map from '../components/Map';
import LocationShare from '../components/LocationShare';
import { insertLocationUpdate, fetchNearbyUsers } from '../api/mongoDataApi.js';

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
const DEFAULT_MAX_DISTANCE_METERS = 16093; // ~10 miles
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };

function MapPage() {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
        },
        (err) => {
          console.error('Error getting location:', err);
          if (err?.code === 1) {
            setUserLocation(FALLBACK_LOCATION);
            setError('Using default campus location. Enable location permissions for precise results.');
          } else {
            setError('We could not access your location. Enable location permissions to continue.');
          }
        }
      );
    } else {
      setError('Geolocation is not supported in this browser.');
    }
  }, []);

  const refreshNearby = useCallback(async () => {
    if (!userLocation) return;

    setIsLoadingNearby(true);
    try {
      const results = await fetchNearbyUsers({
        longitude: userLocation.longitude,
        latitude: userLocation.latitude,
        maxDistance: DEFAULT_MAX_DISTANCE_METERS
      });
      setNearbyUsers(results);
      setError(null);
    } catch (err) {
      console.error('Error fetching nearby users:', err);
      setError(err.message || 'Failed to load nearby users.');
    } finally {
      setIsLoadingNearby(false);
    }
  }, [userLocation]);

  const handleStartSharing = useCallback(async () => {
    if (!userLocation) return;

    setIsSharing(true);
    try {
      const now = new Date().toISOString();
      await insertLocationUpdate({
        userId: DEMO_USER_ID,
        coordinates: {
          type: 'Point',
          coordinates: [userLocation.longitude, userLocation.latitude]
        },
        isPublic: true,
        createdAt: now,
        lastSeenAt: now
      });
      await refreshNearby();
    } catch (err) {
      console.error('Error sharing location:', err);
      setError(err.message || 'Failed to share your location.');
      setIsSharing(false);
    }
  }, [userLocation, refreshNearby]);

  const shareDisabledReason = !userLocation
    ? 'Waiting for your device location...'
    : null;

  const handleStopSharing = useCallback(() => {
    setIsSharing(false);
    setNearbyUsers([]);
  }, []);

  useEffect(() => {
    if (!isSharing) return;
    refreshNearby();
    const intervalId = window.setInterval(refreshNearby, 60000);
    return () => window.clearInterval(intervalId);
  }, [isSharing, refreshNearby]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Pinpoint
          </Typography>
          {userLocation && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              {isSharing ? 'Location sharing is active' : 'Location sharing is paused'}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ flexGrow: 1, p: 0 }}>
        {userLocation ? (
          <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
            <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
              <LocationShare
                isSharing={isSharing}
                onToggle={() => (isSharing ? handleStopSharing() : handleStartSharing())}
                disabled={Boolean(shareDisabledReason)}
                helperText={shareDisabledReason}
              />
            </Box>

            {error && (
              <Box sx={{ position: 'absolute', top: 90, right: 16, zIndex: 2, maxWidth: 320 }}>
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              </Box>
            )}

            {isLoadingNearby && (
              <Box sx={{ position: 'absolute', bottom: 24, right: 24, zIndex: 2 }}>
                <CircularProgress color="primary" size={36} />
              </Box>
            )}

            <Map userLocation={userLocation} nearbyUsers={nearbyUsers} />
          </Box>
        ) : (
          <Box sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="h6">
              Please allow location access to use this app
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}

export default MapPage;
