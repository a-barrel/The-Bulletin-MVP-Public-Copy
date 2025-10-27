import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
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

import {
  createProximityChatRoom,
  fetchChatRooms,
  fetchCurrentUserProfile,
  insertLocationUpdate
} from '../../../api/mongoDataApi';
import LeafletMap from '../../../components/Map';
import { auth } from '../../../firebase';
import { routes } from '../../../routes';
import {
  DEFAULT_LOCATION_COORDINATES,
  DEFAULT_LOCATION_TELEPORT_KEY,
  DEFAULT_SPOOF_STEP_MILES,
  LIVE_CHAT_ROOM_PRESETS,
  METERS_PER_MILE,
  SPOOF_MAX_MILES,
  SPOOF_MIN_MILES,
  SPOOF_STEP_INCREMENT,
  TELEPORT_PRESETS
} from '../constants';
import useViewerLocation from '../hooks/useViewerLocation';
import {
  dedupeChatRooms,
  extractPinLocation,
  formatDistanceMetersLabel,
  haversineDistanceMeters,
  mongooseObjectIdLike,
  normalizeRoomName,
  resolveActiveRoomForLocation,
  shiftLocationByDirection,
  toIdString
} from '../utils';

const formatMilesLabel = (value) => {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const trimmed = value
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
  const suffix = Math.abs(value - 1) < 1e-9 ? 'mile' : 'miles';
  return `${trimmed} ${suffix}`;
};

function ChatRoomVisualizationTab() {
  const navigate = useNavigate();
  const [currentUser] = useAuthState(auth);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState(null);

  const defaultTeleportPreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === DEFAULT_LOCATION_TELEPORT_KEY),
    []
  );

  const initialSpoofLocation = useMemo(
    () => ({
      latitude: defaultTeleportPreset?.latitude ?? DEFAULT_LOCATION_COORDINATES.latitude,
      longitude: defaultTeleportPreset?.longitude ?? DEFAULT_LOCATION_COORDINATES.longitude,
      accuracy: defaultTeleportPreset?.accuracy
    }),
    [defaultTeleportPreset]
  );

  const [activePresetKey, setActivePresetKey] = useState(
    defaultTeleportPreset?.key ?? DEFAULT_LOCATION_TELEPORT_KEY
  );
  const [lastSpoofedLocation, setLastSpoofedLocation] = useState(initialSpoofLocation);
  const [mapCenterOverride, setMapCenterOverride] = useState(() => ({
    latitude: initialSpoofLocation.latitude,
    longitude: initialSpoofLocation.longitude
  }));
  const currentProfileId = useMemo(() => toIdString(currentProfile?._id), [currentProfile]);

  const {
    location: viewerLocation,
    setLocation: setViewerLocation,
    refresh: refreshViewerLocation
  } = useViewerLocation({
    currentProfileId,
    selectedRoomKeyRef: null,
    ensurePresetRoomsRef: null
  });

  useEffect(() => {
    if (
      !viewerLocation ||
      !Number.isFinite(viewerLocation.latitude) ||
      !Number.isFinite(viewerLocation.longitude)
    ) {
      return;
    }

    setLastSpoofedLocation((previous) => {
      if (
        previous &&
        Math.abs(previous.latitude - viewerLocation.latitude) < 1e-9 &&
        Math.abs(previous.longitude - viewerLocation.longitude) < 1e-9 &&
        ((previous.accuracy ?? null) === (viewerLocation.accuracy ?? null))
      ) {
        return previous;
      }
      return viewerLocation;
    });

    setMapCenterOverride((previous) => {
      if (
        previous &&
        Math.abs(previous.latitude - viewerLocation.latitude) < 1e-9 &&
        Math.abs(previous.longitude - viewerLocation.longitude) < 1e-9
      ) {
        return previous;
      }
      return { latitude: viewerLocation.latitude, longitude: viewerLocation.longitude };
    });
  }, [viewerLocation]);

  useEffect(() => {
    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      return;
    }
    refreshViewerLocation();
  }, [currentProfileId, refreshViewerLocation]);
  const [teleportStatus, setTeleportStatus] = useState(null);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [spoofStepMiles, setSpoofStepMiles] = useState(DEFAULT_SPOOF_STEP_MILES);

  const [rooms, setRooms] = useState([]);
  const [roomsStatus, setRoomsStatus] = useState(null);
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const selectedRoomIdRef = useRef(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const currentRoomRef = useRef(null);
  const lastAnnouncedTransitionRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const [movementStatus, setMovementStatus] = useState(null);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const loadProfile = useCallback(async () => {
    if (!currentUser) {
      setCurrentProfile(null);
      return;
    }

    setProfileStatus(null);
    try {
      const profile = await fetchCurrentUserProfile();
      setCurrentProfile(profile);
    } catch (error) {
      console.error('Failed to load current user profile for visualization tab:', error);
      setProfileStatus({ type: 'error', message: error.message || 'Failed to load current user profile.' });
      setCurrentProfile(null);
    }
  }, [currentUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const fetchRooms = useCallback(async () => {
    setRoomsStatus(null);
    setIsFetchingRooms(true);
    let createdCount = 0;
    try {
      let results = dedupeChatRooms(await fetchChatRooms({}));

      if (currentProfileId && mongooseObjectIdLike(currentProfileId)) {
        const scratch = [...results];

        for (const preset of LIVE_CHAT_ROOM_PRESETS) {
          const presetKey = preset.key;
          const existing = scratch.find((candidate) => {
            if (!candidate) {
              return false;
            }
            if (candidate.presetKey && candidate.presetKey === presetKey) {
              return true;
            }
            const targetNames = [preset.name, ...(preset.aliases ?? [])].map(normalizeRoomName);
            return targetNames.includes(normalizeRoomName(candidate.name));
          });

          if (existing) {
            continue;
          }

          try {
            const created = await createProximityChatRoom({
              ownerId: currentProfileId,
              name: preset.name,
              description: preset.description,
              latitude: preset.latitude,
              longitude: preset.longitude,
              accuracy: preset.accuracy,
              radiusMeters: preset.radiusMeters,
              isGlobal: Boolean(preset.isGlobal),
              participantIds: [currentProfileId],
              moderatorIds: [currentProfileId],
              presetKey
            });
            scratch.push({ ...created, presetKey });
            createdCount += 1;
          } catch (creationError) {
            console.warn('Failed to ensure preset chat room:', preset, creationError);
          }
        }

        if (createdCount > 0) {
          results = dedupeChatRooms(await fetchChatRooms({}));
        }
      }

      setRooms(results);
      setRoomsStatus({
        type: 'success',
        message: `Loaded ${results.length} chat room${results.length === 1 ? '' : 's'}${
          createdCount ? ` (created ${createdCount} preset${createdCount === 1 ? '' : 's'})` : ''
        }.`
      });

      if (!selectedRoomIdRef.current) {
        const focusRoom = results.find((room) => extractPinLocation(room));
        if (focusRoom) {
          const focus = extractPinLocation(focusRoom);
          if (focus) {
            setMapCenterOverride(focus);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chat rooms for visualization tab:', error);
      setRooms([]);
      setRoomsStatus({ type: 'error', message: error.message || 'Failed to load chat rooms.' });
    } finally {
      setIsFetchingRooms(false);
    }
  }, [currentProfileId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleRefreshRooms = useCallback(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleTeleport = useCallback(
    async (preset) => {
      if (!preset) {
        return;
      }

      if (!currentUser) {
        setTeleportStatus({
          type: 'warning',
          message: 'Sign in to spoof your location.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setTeleportStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      setIsTeleporting(true);
      setTeleportStatus(null);

      try {
        await insertLocationUpdate({
          userId: currentProfileId,
          coordinates: {
            type: 'Point',
            coordinates: [preset.longitude, preset.latitude],
            accuracy: preset.accuracy
          },
          isPublic: true,
          source: 'web'
        });

        const nextLocation = {
          latitude: preset.latitude,
          longitude: preset.longitude,
          accuracy: preset.accuracy
        };
        setActivePresetKey(preset.key);
        setLastSpoofedLocation(nextLocation);
        setViewerLocation(nextLocation);
        setMapCenterOverride({ latitude: preset.latitude, longitude: preset.longitude });
        setTeleportStatus({
          type: 'success',
          message: preset.statusMessage
        });
        hasUserMovedRef.current = true;
      } catch (error) {
        console.error('Failed to spoof location from visualization tab:', error);
        setTeleportStatus({ type: 'error', message: error.message || 'Failed to spoof location.' });
      } finally {
        setIsTeleporting(false);
      }
    },
    [currentUser, currentProfileId, lastSpoofedLocation, initialSpoofLocation, setViewerLocation]
  );

  const handleDirectionalSpoof = useCallback(
    async (direction) => {
      if (!direction) {
        return;
      }

      if (!currentUser) {
        setTeleportStatus({
          type: 'warning',
          message: 'Sign in to spoof your location.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setTeleportStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      const sourceLocation =
        (lastSpoofedLocation &&
          Number.isFinite(lastSpoofedLocation.latitude) &&
          Number.isFinite(lastSpoofedLocation.longitude) &&
          lastSpoofedLocation) ||
        initialSpoofLocation;

      const stepMeters = spoofStepMiles * METERS_PER_MILE;
      const nextLocation = shiftLocationByDirection(sourceLocation, direction, stepMeters);
      if (!nextLocation) {
        setTeleportStatus({
          type: 'error',
          message: 'Unable to adjust location. Teleport to a preset first.'
        });
        return;
      }

      setIsTeleporting(true);
      setTeleportStatus(null);

      try {
        const payload = {
          userId: currentProfileId,
          coordinates: {
            type: 'Point',
            coordinates: [nextLocation.longitude, nextLocation.latitude]
          },
          isPublic: true,
          source: 'web'
        };

        if (Number.isFinite(nextLocation.accuracy)) {
          payload.coordinates.accuracy = nextLocation.accuracy;
        }

        await insertLocationUpdate(payload);

        setActivePresetKey(null);
        setLastSpoofedLocation(nextLocation);
        setViewerLocation(nextLocation);
        setMapCenterOverride({ latitude: nextLocation.latitude, longitude: nextLocation.longitude });
        const stepLabel = formatMilesLabel(spoofStepMiles);
        setTeleportStatus({
          type: 'success',
          message:
            stepLabel ? `Moved ${direction} by roughly ${stepLabel}.` : 'Spoofed location updated.'
        });
        hasUserMovedRef.current = true;
      } catch (error) {
        console.error('Failed to adjust spoofed location:', error);
        setTeleportStatus({ type: 'error', message: error.message || 'Failed to adjust location.' });
      } finally {
        setIsTeleporting(false);
      }
    },
    [
      currentUser,
      currentProfileId,
      lastSpoofedLocation,
      initialSpoofLocation,
      setViewerLocation,
      spoofStepMiles
    ]
  );

  useEffect(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) {
      setCurrentRoomId(null);
      currentRoomRef.current = null;
      return;
    }

    const nextRoom = resolveActiveRoomForLocation(rooms, lastSpoofedLocation);
    const nextRoomId = toIdString(nextRoom?._id) || null;
    setCurrentRoomId(nextRoomId);

    const previousRoom = currentRoomRef.current;
    const previousRoomId = toIdString(previousRoom?._id) || null;

    if (previousRoomId === nextRoomId) {
      return;
    }

    currentRoomRef.current = nextRoom;

    if (!hasUserMovedRef.current) {
      return;
    }

    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      return;
    }

    const transitionKey = `${previousRoomId ?? 'none'}->${nextRoomId ?? 'none'}`;
    if (
      pendingTransitionRef.current === transitionKey ||
      lastAnnouncedTransitionRef.current === transitionKey
    ) {
      return;
    }

    pendingTransitionRef.current = transitionKey;
    let isCancelled = false;

    (async () => {
      try {
        if (nextRoomId) {
          await createProximityChatPresence({
            roomId: nextRoomId,
            userId: currentProfileId
          });
        }

        const fromLabel = previousRoom?.name ?? 'Outside chat rooms';
        const toLabel = nextRoom?.name ?? 'Outside chat rooms';
        const title = nextRoom
          ? previousRoom
            ? `Moved from ${fromLabel} to ${toLabel}`
            : `Entered ${toLabel}`
          : `Left ${fromLabel}`;

        const metadata = {
          fromRoomId: previousRoomId,
          toRoomId: nextRoomId,
          latitude: Number.isFinite(lastSpoofedLocation?.latitude) ? lastSpoofedLocation.latitude : null,
          longitude: Number.isFinite(lastSpoofedLocation?.longitude) ? lastSpoofedLocation.longitude : null
        };

        let distanceLabel = null;
        if (nextRoom && !isGlobalChatRoom(nextRoom)) {
          const nextLocation = extractPinLocation(nextRoom);
          const distanceMeters = nextLocation
            ? haversineDistanceMeters(lastSpoofedLocation, nextLocation)
            : Number.NaN;
          if (Number.isFinite(distanceMeters)) {
            metadata.distanceMeters = Number(distanceMeters.toFixed(2));
            distanceLabel = formatDistanceMetersLabel(distanceMeters);
          }
        }

        const bodyParts = [];
        if (distanceLabel) {
          bodyParts.push(`Now approximately ${distanceLabel} from the ${toLabel} center.`);
        }

        if (lastSpoofedLocation?.accuracy !== undefined) {
          metadata.accuracy = lastSpoofedLocation.accuracy;
        }

        await createUpdate({
          userId: currentProfileId,
          payload: {
            type: 'chat-room-transition',
            title,
            body: bodyParts.length ? bodyParts.join(' ') : undefined,
            metadata
          }
        });

        if (!isCancelled) {
          const severity = nextRoom ? 'success' : 'warning';
          setMovementStatus({ type: severity, message: title });
          lastAnnouncedTransitionRef.current = transitionKey;
        }
      } catch (error) {
        console.warn('Failed to record chat room transition:', error);
        if (!isCancelled) {
          setMovementStatus({
            type: 'error',
            message: error.message || 'Failed to record chat room movement.'
          });
        }
      } finally {
        if (pendingTransitionRef.current === transitionKey) {
          pendingTransitionRef.current = null;
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [rooms, lastSpoofedLocation, currentProfileId]);

  const mapPins = useMemo(
    () =>
      rooms
        .map((room) => {
          const coordinates = room?.coordinates?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return null;
          }
          const [longitude, latitude] = coordinates;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          const pin = {
            _id: toIdString(room?._id),
            title: room?.name ?? 'Untitled chat room',
            type: room?.isGlobal ? 'global-chat-room' : 'chat-room',
            coordinates: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            proximityRadiusMeters: room?.radiusMeters,
            description: room?.description ?? undefined
          };

          if (lastSpoofedLocation) {
            const distance = haversineDistanceMeters(lastSpoofedLocation, {
              latitude,
              longitude
            });
            if (Number.isFinite(distance)) {
              pin.distanceMeters = distance;
            }
          }

          return pin;
        })
        .filter(Boolean),
    [rooms, lastSpoofedLocation]
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => toIdString(room?._id) === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const currentRoom = useMemo(
    () => rooms.find((room) => toIdString(room?._id) === currentRoomId) ?? null,
    [rooms, currentRoomId]
  );

  const selectedRoomDistanceLabel = useMemo(() => {
    if (!selectedRoom || !lastSpoofedLocation) {
      return null;
    }
    const location = extractPinLocation(selectedRoom);
    if (!location) {
      return null;
    }
    const distance = haversineDistanceMeters(lastSpoofedLocation, location);
    if (!Number.isFinite(distance)) {
      return null;
    }
    return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km away` : `${Math.round(distance)} m away`;
  }, [selectedRoom, lastSpoofedLocation]);

  const currentRoomDistanceLabel = useMemo(() => {
    if (!currentRoom || !lastSpoofedLocation) {
      return null;
    }
    const location = extractPinLocation(currentRoom);
    if (!location) {
      return null;
    }
    const distance = haversineDistanceMeters(lastSpoofedLocation, location);
    if (!Number.isFinite(distance)) {
      return null;
    }
    const label = formatDistanceMetersLabel(distance);
    return label ? `${label} from the center` : null;
  }, [currentRoom, lastSpoofedLocation]);

  const handlePinSelect = useCallback((pin) => {
    const id = toIdString(pin?._id);
    setSelectedRoomId(id || null);
    const focus = extractPinLocation(pin);
    if (focus) {
      setMapCenterOverride(focus);
    }
  }, []);

  const handleViewChatRoom = useCallback(() => {
    navigate(routes.chat.base);
  }, [navigate]);

  const handleViewProfile = useCallback(() => {
    navigate(routes.profile.me);
  }, [navigate]);

  const handleFocusRoom = useCallback((room) => {
    const id = toIdString(room?._id);
    setSelectedRoomId(id || null);
    const focus = extractPinLocation(room);
    if (focus) {
      setMapCenterOverride(focus);
    }
  }, []);

  const activePreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === activePresetKey) ?? null,
    [activePresetKey]
  );

  const activeRadiusSource = selectedRoom ?? currentRoom;
  const userRadiusMeters = Number.isFinite(activeRadiusSource?.radiusMeters)
    ? activeRadiusSource.radiusMeters
    : undefined;
  const stepSummaryLabel = formatMilesLabel(spoofStepMiles) ?? 'the selected distance';

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box>
            <Typography variant="h6">Chat room overview</Typography>
            <Typography variant="body2" color="text.secondary">
              Visualize chat room geofences alongside your spoofed location.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshRooms}
            disabled={isFetchingRooms}
          >
            {isFetchingRooms ? 'Refreshing...' : 'Refresh rooms'}
          </Button>
        </Stack>
        {roomsStatus && (
          <Alert severity={roomsStatus.type} onClose={() => setRoomsStatus(null)}>
            {roomsStatus.message}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">GPS spoofer</Typography>
          <Typography variant="body2" color="text.secondary">
            Teleport your active debug account to quickly test chat room access.
          </Typography>
          {!currentUser && <Alert severity="warning">Sign in to spoof your location.</Alert>}
          {profileStatus && (
            <Alert severity={profileStatus.type} onClose={() => setProfileStatus(null)}>
              {profileStatus.message}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
            {TELEPORT_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={preset.key === activePresetKey ? 'contained' : 'outlined'}
                onClick={() => handleTeleport(preset)}
                disabled={isTeleporting}
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
              Active GPS preset: {activePreset.label} ({activePreset.latitude.toFixed(4)}, 
              {activePreset.longitude.toFixed(4)})
            </Typography>
          )}
          {teleportStatus && (
            <Alert severity={teleportStatus.type} onClose={() => setTeleportStatus(null)}>
              {teleportStatus.message}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Map view</Typography>
          <Typography variant="body2" color="text.secondary">
            Click a marker to focus a chat room and compare against your spoofed location.
          </Typography>
        </Stack>
        {movementStatus && (
          <Alert severity={movementStatus.type} onClose={() => setMovementStatus(null)}>
            {movementStatus.message}
          </Alert>
        )}
        {currentRoom ? (
          <Alert severity="info">
            Currently inside <strong>{currentRoom.name ?? 'Untitled chat room'}</strong>
            {currentRoomDistanceLabel ? ` - ${currentRoomDistanceLabel}` : ''}
          </Alert>
        ) : hasUserMovedRef.current ? (
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
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Chat rooms</Typography>
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
                        <Chip label={isCurrent ? 'Current focus' : 'Focused'} color={isCurrent ? 'success' : 'primary'} size="small" />
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
      </Paper>
    </Stack>
  );
}

export default ChatRoomVisualizationTab;
