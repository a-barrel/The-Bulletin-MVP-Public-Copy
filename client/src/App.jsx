import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Map from './components/Map';
import LocationShare from './components/LocationShare';
import { insertLocationUpdate, fetchNearbyUsers, isMongoDataApiConfigured } from './api/mongoDataApi.js';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9'
    },
    secondary: {
      main: '#f48fb1'
    }
  }
});

const DEMO_USER_ID = 'demo-user';
const DEFAULT_MAX_DISTANCE_METERS = 16093; // ~10 miles

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [error, setError] = useState(null);
  const [dataApiConfigured] = useState(() => isMongoDataApiConfigured());

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
        },
        (err) => {
          console.error('Error getting location:', err);
          setError('We could not access your location. Enable location permissions to continue.');
        }
      );
    } else {
      setError('Geolocation is not supported in this browser.');
    }
  }, []);

  useEffect(() => {
    if (!dataApiConfigured) {
      setError((prev) => prev ?? 'MongoDB Data API environment variables are missing. Update client/.env to enable sharing.');
    }
  }, [dataApiConfigured]);

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
      await insertLocationUpdate({
        userId: DEMO_USER_ID,
        coordinates: {
          type: 'Point',
          coordinates: [userLocation.longitude, userLocation.latitude]
        },
        isPublic: true,
        createdAt: new Date().toISOString()
      });
      await refreshNearby();
    } catch (err) {
      console.error('Error sharing location:', err);
      setError(err.message || 'Failed to share your location.');
      setIsSharing(false);
    }
  }, [userLocation, refreshNearby]);

  const shareDisabledReason = !dataApiConfigured
    ? 'Configure MongoDB Data API settings to enable sharing.'
    : !userLocation
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
              <LocationShare
                isSharing={isSharing}
                onToggle={() => (isSharing ? handleStopSharing() : handleStartSharing())}
                disabled={Boolean(shareDisabledReason)}
                helperText={shareDisabledReason}
              />

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
    </ThemeProvider>
  );
}

export default App;


