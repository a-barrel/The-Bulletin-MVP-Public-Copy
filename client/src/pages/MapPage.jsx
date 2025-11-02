/* NOTE: Page exports configuration alongside the component. */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import Navbar from '../components/Navbar';
import { useLocationContext } from '../contexts/LocationContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useMapExplorer, {
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_RADIUS_MILES,
  SPOOF_MIN_MILES,
  SPOOF_MAX_MILES,
  SPOOF_STEP_INCREMENT
} from '../hooks/useMapExplorer';

export const pageConfig = {
  id: 'map',
  label: 'Map',
  icon: MapIcon,
  path: '/map',
  order: 1,
  protected: true,
  showInNav: true
};

function MapPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();

  const {
    userLocation,
    nearbyUsers,
    combinedPins,
    chatRoomPins,
    showChatRooms,
    setShowChatRooms,
    isSharing,
    shareDisabled,
    shareHelperText,
    handleStartSharing,
    handleStopSharing,
    handleSpoofMove,
    spoofStepMiles,
    setSpoofStepMiles,
    handleMapPinSelect,
    isLoadingNearby,
    isLoadingPins,
    isLoadingChatRooms,
    chatRoomsError,
    setChatRoomsError,
    error,
    setError,
    selectedChatRoomId,
    selectedChatRoom,
    selectedChatRoomRadiusLabel,
    selectedChatRoomDistanceLabel
  } = useMapExplorer({
    sharedLocation,
    setSharedLocation,
    isOffline
  });

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

        {isLoadingChatRooms ? <Alert severity="info">Loading chat rooms…</Alert> : null}

        {chatRoomsError ? (
          <Alert severity="warning" onClose={() => setChatRoomsError(null)}>
            {chatRoomsError}
          </Alert>
        ) : null}

        {isOffline ? (
          <Alert severity="warning">
            Offline mode: map data is read-only. Location sharing and live updates will resume when you reconnect.
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

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
              Each press moves the simulated location by roughly {spoofStepMiles.toFixed(2)} mile
              {Math.abs(spoofStepMiles - 1) < 1e-9 ? '' : 's'}.
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
