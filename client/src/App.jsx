import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Map from './components/Map';
import LocationShare from './components/LocationShare';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    // Request user's location when component mounts
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const handleStartSharing = () => {
    setIsSharing(true);
    // In a real app, start periodic location updates
    if (userLocation) {
      // Send location to backend
      fetch('http://localhost:5000/api/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In a real app, include Firebase auth token
          // 'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          userId: 'demo-user', // In a real app, use actual user ID
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          isPublic: true
        })
      })
      .then(response => response.json())
      .then(data => console.log('Location shared:', data))
      .catch(error => console.error('Error sharing location:', error));
    }
  };

  const handleStopSharing = () => {
    setIsSharing(false);
    // In a real app, stop periodic location updates
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Bulletin Test
            </Typography>
            {userLocation && (
              <Button 
                color="inherit" 
                onClick={isSharing ? handleStopSharing : handleStartSharing}
              >
                {isSharing ? 'Stop Sharing' : 'Start Sharing'}
              </Button>
            )}
          </Toolbar>
        </AppBar>
        
        <Container maxWidth={false} sx={{ flexGrow: 1, p: 0 }}>
          {userLocation ? (
            <Map 
              userLocation={userLocation}
              nearbyUsers={nearbyUsers}
            />
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
