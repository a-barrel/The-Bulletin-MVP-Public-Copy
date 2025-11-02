import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import Divider from '@mui/material/Divider';

import LeafletMap from '../../../components/Map';
import { routes } from '../../../routes';
import {
  TELEPORT_PRESETS,
  SPOOF_MIN_MILES,
  SPOOF_MAX_MILES,
  SPOOF_STEP_INCREMENT
} from '../constants';
import DebugPanel from '../components/DebugPanel';
import useChatRoomVisualizationTools from '../hooks/useChatRoomVisualizationTools';
import { extractPinLocation, toIdString } from '../utils';

function ChatRoomVisualizationTab() {
  const navigate = useNavigate();
  const {
    currentUser,
    profileStatus,
    setProfileStatus,
    teleportStatus,
    setTeleportStatus,
    isTeleporting,
    spoofStepMiles,
    setSpoofStepMiles,
    roomsStatus,
    setRoomsStatus,
    isFetchingRooms,
    handleRefreshRooms,
    rooms,
    mapPins,
    selectedRoom,
    currentRoom,
    selectedRoomDistanceLabel,
    currentRoomDistanceLabel,
    handlePinSelect,
    handleFocusRoom,
    activePreset,
    lastSpoofedLocation,
    mapCenterOverride,
    userRadiusMeters,
    stepSummaryLabel,
    handleTeleport,
    handleDirectionalSpoof,
    selectedRoomId,
    currentRoomId,
    movementStatus,
    setMovementStatus,
    hasUserMoved
  } = useChatRoomVisualizationTools();

  const roomsAlerts = roomsStatus
    ? [
        {
          key: 'rooms-status',
          severity: roomsStatus.type,
          content: roomsStatus.message,
          onClose: () => setRoomsStatus(null)
        }
      ]
    : [];

  const teleportAlerts = [];
  if (profileStatus) {
    teleportAlerts.push({
      key: 'profile-status',
      severity: profileStatus.type,
      content: profileStatus.message,
      onClose: () => setProfileStatus(null)
    });
  }
  if (teleportStatus) {
    teleportAlerts.push({
      key: 'teleport-status',
      severity: teleportStatus.type,
      content: teleportStatus.message,
      onClose: () => setTeleportStatus(null)
    });
  }

  const mapAlerts = movementStatus
    ? [
        {
          key: 'movement-status',
          severity: movementStatus.type,
          content: movementStatus.message,
          onClose: () => setMovementStatus(null)
        }
      ]
    : [];

  const handleViewChatRoom = useCallback(() => {
    navigate(routes.chat.base);
  }, [navigate]);

  const handleViewProfile = useCallback(() => {
    navigate(routes.profile.me);
  }, [navigate]);

  return (
    <Stack spacing={2}>
      <DebugPanel
        title="Chat room overview"
        description="Visualize chat room geofences alongside your spoofed location."
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshRooms}
            disabled={isFetchingRooms}
          >
            {isFetchingRooms ? 'Refreshing...' : 'Refresh rooms'}
          </Button>
        }
        alerts={roomsAlerts}
      />

      <DebugPanel
        title="GPS spoofer"
        description="Teleport your active debug account to quickly test chat room access."
        alerts={teleportAlerts}
      >
        {!currentUser && <Alert severity="warning">Sign in to spoof your location.</Alert>}

        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            {TELEPORT_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant={preset.key === activePreset?.key ? 'contained' : 'outlined'}
                onClick={() => handleTeleport(preset)}
                disabled={isTeleporting || !currentUser}
                sx={{ textTransform: 'none' }}
              >
                {preset.label}
              </Button>
            ))}
            {isTeleporting && <CircularProgress size={20} />}
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Directional nudge</Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Step size: {spoofStepMiles.toFixed(2)} mile{spoofStepMiles === 1 ? '' : 's'}
              </Typography>
              <Slider
                aria-label="Spoof step size"
                min={SPOOF_MIN_MILES}
                max={SPOOF_MAX_MILES}
                step={SPOOF_STEP_INCREMENT}
                value={spoofStepMiles}
                onChange={(_, value) => {
                  if (typeof value === 'number') {
                    setSpoofStepMiles(value);
                  }
                }}
                disabled={isTeleporting}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(2)} mi`}
              />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('north')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                North
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('west')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                West
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('east')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                East
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('south')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                South
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" align="center">
              Each press moves the spoofed location by roughly {stepSummaryLabel}.
            </Typography>
          </Stack>

          {activePreset && (
            <Typography variant="caption" color="text.secondary">
              Active GPS preset: {activePreset.label} ({activePreset.latitude.toFixed(4)},{' '}
              {activePreset.longitude.toFixed(4)})
            </Typography>
          )}
        </Stack>
      </DebugPanel>

      <DebugPanel
        title="Map view"
        description="Click a marker to focus a chat room and compare against your spoofed location."
        alerts={mapAlerts}
      >
        {currentRoom ? (
          <Alert severity="info">
            Currently inside <strong>{currentRoom.name ?? 'Untitled chat room'}</strong>
            {currentRoomDistanceLabel ? ` - ${currentRoomDistanceLabel}` : ''}
          </Alert>
        ) : hasUserMoved ? (
          <Alert severity="warning">
            Not currently inside any geofenced chat room. Move closer to one of the markers to join it.
          </Alert>
        ) : null}

        <Box sx={{ height: 420, borderRadius: 2, overflow: 'hidden' }}>
          <LeafletMap
            userLocation={lastSpoofedLocation ?? undefined}
            userRadiusMeters={userRadiusMeters}
            centerOverride={mapCenterOverride ?? undefined}
            pins={mapPins}
            selectedPinId={selectedRoomId ?? undefined}
            onPinSelect={handlePinSelect}
            onChatRoomView={handleViewChatRoom}
            onCurrentUserView={handleViewProfile}
          />
        </Box>

        {selectedRoom ? (
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">{selectedRoom.name ?? 'Untitled chat room'}</Typography>
            {selectedRoom.description ? (
              <Typography variant="body2" color="text.secondary">
                {selectedRoom.description}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              Radius: {Number.isFinite(selectedRoom.radiusMeters) ? `${selectedRoom.radiusMeters} m` : 'Not set'}
              {selectedRoom.isGlobal ? ' (global room)' : ''}
            </Typography>
            {selectedRoomDistanceLabel && (
              <Typography variant="body2" color="text.secondary">
                Distance from spoofed location: {selectedRoomDistanceLabel}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a chat room marker or card to see details.
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Chat rooms"
        description="Review rooms cached from the server and focus them on the map."
      >
        {rooms.length ? (
          <Stack spacing={1}>
            {rooms.map((room, index) => {
              const id = toIdString(room?._id);
              const key = id || `${index}-${room?.name ?? 'room'}`;
              const isSelected = id && id === selectedRoomId;
              const isCurrent = id && id === currentRoomId;
              const location = extractPinLocation(room);
              return (
                <Paper
                  key={key}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderColor: isCurrent ? 'success.main' : isSelected ? 'primary.main' : 'divider',
                    borderWidth: isCurrent || isSelected ? 2 : 1,
                    backgroundColor: isCurrent ? 'success.light' : undefined
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1">{room?.name ?? 'Untitled chat room'}</Typography>
                        {isCurrent && <Chip label="Current" color="success" size="small" />}
                        {isSelected && !isCurrent && <Chip label="Focused" color="primary" size="small" />}
                        {room?.isGlobal && <Chip label="Global" color="default" size="small" />}
                      </Stack>
                      {room?.description ? (
                        <Typography variant="body2" color="text.secondary">
                          {room.description}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No description provided.
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {location
                          ? `Center: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                          : 'Missing coordinates'}
                        {Number.isFinite(room?.radiusMeters) ? ` | Radius: ${room.radiusMeters} m` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {!isSelected && (
                        <Button size="small" onClick={() => handleFocusRoom(room)}>
                          Focus on map
                        </Button>
                      )}
                      {isSelected && (
                        <Chip
                          label={isCurrent ? 'Current focus' : 'Focused'}
                          color={isCurrent ? 'success' : 'primary'}
                          size="small"
                        />
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isFetchingRooms ? 'Loading chat rooms...' : 'Chat rooms will appear here once loaded.'}
          </Typography>
        )}
      </DebugPanel>
    </Stack>
  );
}

export default ChatRoomVisualizationTab;
