import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Map from '../components/Map';
import LocationShare from '../components/LocationShare';

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

function MapPage() {
  const [userLocation, setUserLocation] = useState(null);
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
          setError('We could not access your location. Enable location permissions to continue.');
        }
      );
    } else {
      setError('Geolocation is not supported in this browser.');
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Pinpoint
            </Typography>
            <Link to="/list" style={{ color: 'white', textDecoration: 'none', marginRight: '10px' }}>List</Link>
            <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
            {userLocation && (
              <Typography variant="body2" sx={{ mr: 2 }}>
                Location sharing is paused
              </Typography>
            )}
          </Toolbar>
        </AppBar>

        <Container maxWidth={false} sx={{ flexGrow: 1, p: 0 }}>
          {userLocation ? (
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              <Box sx={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
                <LocationShare
                  isSharing={false}
                  onToggle={() => {}}
                  disabled={true}
                  helperText="Location sharing is temporarily disabled."
                />
              </Box>

              {error && (
                <Box sx={{ position: 'absolute', top: 90, right: 16, zIndex: 1000, maxWidth: 320 }}>
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                </Box>
              )}

              <Map userLocation={userLocation} nearbyUsers={[]} />
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

export default MapPage;