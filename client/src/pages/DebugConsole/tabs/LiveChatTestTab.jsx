import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  createProximityChatMessage,
  createProximityChatPresence,
  createProximityChatRoom,
  fetchChatMessages,
  fetchChatPresence,
  fetchChatRooms,
  fetchCurrentUserProfile,
  insertLocationUpdate
} from '../../../api/mongoDataApi';
import { auth } from '../../../firebase';
import {
  DEFAULT_AVATAR_PATH,
  DEFAULT_LOCATION_TELEPORT_KEY,
  LIVE_CHAT_ROOM_PRESETS,
  TELEPORT_PRESETS
} from '../constants';
import useViewerLocation from '../hooks/useViewerLocation';
import {
  dedupeChatRooms,
  evaluateRoomAccess,
  formatReadableTimestamp,
  mongooseObjectIdLike,
  normalizeRoomName,
  resolveMediaUrl,
  toIdString
} from '../utils';

function LiveChatTestTab() {
  const [currentUser] = useAuthState(auth);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [roomsByKey, setRoomsByKey] = useState({});
  const [selectedRoomKey, setSelectedRoomKey] = useState(LIVE_CHAT_ROOM_PRESETS[0].key);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [status,       setStatus] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [isEnsuringRooms, setIsEnsuringRooms] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [activeLocationKey, setActiveLocationKey] = useState(DEFAULT_LOCATION_TELEPORT_KEY);
  const defaultTeleportPreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === DEFAULT_LOCATION_TELEPORT_KEY),
    []
  );
  const resolveAuthorAvatar = useCallback((author) => {
    if (!author) {
      return resolveMediaUrl(DEFAULT_AVATAR_PATH);
    }
    const avatar = author.avatar;
    if (typeof avatar === 'string') {
      return resolveMediaUrl(avatar);
    }
    if (avatar && typeof avatar === 'object') {
      const source = avatar.url || avatar.thumbnailUrl;
      if (typeof source === 'string' && source.trim()) {
        return resolveMediaUrl(source);
      }
    }
    return resolveMediaUrl(DEFAULT_AVATAR_PATH);
  }, []);
  const [lastSpoofedLocation, setLastSpoofedLocation] = useState(() =>
    defaultTeleportPreset
      ? {
          latitude: defaultTeleportPreset.latitude,
          longitude: defaultTeleportPreset.longitude,
          accuracy: defaultTeleportPreset.accuracy
        }
      : null
  );
  const selectedRoomKeyRef = useRef(selectedRoomKey);
  const messagesEndRef = useRef(null);
  const ensurePresetRoomsRef = useRef(null);

  const effectiveLatitude = Number.isFinite(lastSpoofedLocation?.latitude)
    ? lastSpoofedLocation.latitude
    : null;
  const effectiveLongitude = Number.isFinite(lastSpoofedLocation?.longitude)
    ? lastSpoofedLocation.longitude
    : null;

  const lastEnsuredRef = useRef({ profileId: null, latitude: null, longitude: null });
  const currentProfileId = useMemo(() => toIdString(currentProfile?._id), [currentProfile]);
  const activeRoomRadiusLabel = useMemo(() => {
    if (!activeRoom?.radiusMeters) {
      return null;
    }
    if (activeRoom.radiusMeters >= 1000) {
      return `${(activeRoom.radiusMeters / 1000).toFixed(1)} km radius`;
    }
    return `${Math.round(activeRoom.radiusMeters)} m radius`;
  }, [activeRoom]);
  const activeTeleportPreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === activeLocationKey),
    [activeLocationKey]
  );
  const roomAccess = useMemo(
    () => evaluateRoomAccess(activeRoom, lastSpoofedLocation),
    [activeRoom, lastSpoofedLocation]
  );
  const {
    location: viewerLocation,
    setLocation: setViewerLocation,
    refresh: refreshViewerLocation
  } = useViewerLocation({
    currentProfileId,
    selectedRoomKeyRef,
    ensurePresetRoomsRef,
    setLocationStatus
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

    if (ensurePresetRoomsRef.current && selectedRoomKeyRef.current) {
      ensurePresetRoomsRef.current(selectedRoomKeyRef.current);
    }
  }, [viewerLocation, ensurePresetRoomsRef, selectedRoomKeyRef]);

  useEffect(() => {
    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      return;
    }
    refreshViewerLocation();
  }, [currentProfileId, refreshViewerLocation]);

  const distanceToRoomLabel = useMemo(() => {
    if (!roomAccess?.allowed || roomAccess.distanceMeters === undefined) {
      return null;
    }
    const distance = roomAccess.distanceMeters;
    if (!Number.isFinite(distance)) {
      return null;
    }
    return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km away` : `${Math.round(distance)} m away`;
  }, [roomAccess]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    selectedRoomKeyRef.current = selectedRoomKey;
  }, [selectedRoomKey]);

  const loadProfile = useCallback(async () => {
    if (!currentUser) {
      setCurrentProfile(null);
      return;
    }
    try {
      const profile = await fetchCurrentUserProfile();
      setCurrentProfile(profile);
    } catch (error) {
      console.error('Failed to load current user profile:', error);
              setStatus({ type: 'error', message: error.message || 'Failed to load current user profile.' });
      setCurrentProfile(null);
    }
  }, [currentUser]);

  const loadMessages = useCallback(async (room) => {
    const roomId = toIdString(room?._id);
    if (!roomId || !mongooseObjectIdLike(roomId)) {
      if (!roomId) {
                setStatus({
          type: 'warning',
          message: 'Select a valid chat room before refreshing messages.'
        });
      } else {
                setStatus({
          type: 'error',
          message: `Selected chat room has an invalid id (${roomId}). Reload the rooms.`
        });
      }
      setMessages([]);
      return;
    }

    setIsRefreshingMessages(true);
    try {
      const list = await fetchChatMessages(roomId);
      setMessages(list);
    } catch (error) {
      console.error('Failed to refresh chat messages:', error);
              setStatus({ type: 'error', message: error.message || 'Failed to refresh messages.' });
    } finally {
      setIsRefreshingMessages(false);
    }
  }, []);

  const ensurePresetRooms = useCallback(
    async (preferredKey) => {
      const latitude = Number.isFinite(effectiveLatitude)
        ? effectiveLatitude
        : Number.isFinite(lastSpoofedLocation?.latitude)
        ? lastSpoofedLocation.latitude
        : null;
      const longitude = Number.isFinite(effectiveLongitude)
        ? effectiveLongitude
        : Number.isFinite(lastSpoofedLocation?.longitude)
        ? lastSpoofedLocation.longitude
        : null;

      if (!currentUser) {
        setRoomsByKey({});
        setActiveRoom(null);
        setMessages([]);
                setStatus({ type: 'warning', message: 'Sign in to test the live chat rooms.' });
        return;
      }

      if (!currentProfile?._id) {
                setStatus({
          type: 'warning',
          message: 'Current user profile is unavailable. Swap accounts or refresh the page.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
                setStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      setIsEnsuringRooms(true);
      try {
        let rooms = await fetchChatRooms({
          latitude: Number.isFinite(latitude) ? latitude : undefined,
          longitude: Number.isFinite(longitude) ? longitude : undefined
        });
        rooms = dedupeChatRooms(rooms);
        const remainingRooms = Array.isArray(rooms) ? [...rooms] : [];
        const nextRoomsByKey = {};

        for (const preset of LIVE_CHAT_ROOM_PRESETS) {
          const presetKey = preset.key;
          let resolvedRoom = null;

          const presetIndex = remainingRooms.findIndex((candidate) =>
            candidate?.presetKey && candidate.presetKey === presetKey
          );

          if (presetIndex >= 0) {
            resolvedRoom = remainingRooms.splice(presetIndex, 1)[0];
          } else {
            const targetNames = [preset.name, ...(preset.aliases ?? [])].map(normalizeRoomName);
            const matchIndex = remainingRooms.findIndex((candidate) =>
              targetNames.includes(normalizeRoomName(candidate?.name))
            );
            if (matchIndex >= 0) {
              resolvedRoom = remainingRooms.splice(matchIndex, 1)[0];
            }
          }

          if (!resolvedRoom) {
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
            resolvedRoom = created;
          }

          const normalizedRoom = {
            ...resolvedRoom,
            _id: toIdString(resolvedRoom?._id),
            ownerId: toIdString(resolvedRoom?.ownerId),
            presetKey
          };
          nextRoomsByKey[preset.key] = normalizedRoom;
        }

        setRoomsByKey(nextRoomsByKey);

        const resolveNextKey = () => {
          if (preferredKey && nextRoomsByKey[preferredKey]) {
            return preferredKey;
          }

          const accessible = LIVE_CHAT_ROOM_PRESETS.find((preset) => {
            const room = nextRoomsByKey[preset.key];
            if (!room) {
              return false;
            }
            return evaluateRoomAccess(room, lastSpoofedLocation).allowed;
          });
          if (accessible) {
            return accessible.key;
          }

          return LIVE_CHAT_ROOM_PRESETS.find((preset) => nextRoomsByKey[preset.key])?.key;
        };

        const nextKey = resolveNextKey() ?? LIVE_CHAT_ROOM_PRESETS[0].key;

        const nextRoom = nextRoomsByKey[nextKey] ?? null;
        setSelectedRoomKey(nextKey);
        setActiveRoom(nextRoom);
        if (!nextRoom) {
          setMessages([]);
        } else {
                setStatus(null);
        }
      } catch (error) {
        console.error('Failed to ensure chat rooms:', error);
        setRoomsByKey({});
        setActiveRoom(null);
        setMessages([]);
                setStatus({ type: 'error', message: error.message || 'Failed to load chat rooms.' });
      } finally {
        setIsEnsuringRooms(false);
      }
    },
    [currentProfile, currentProfileId, currentUser, effectiveLatitude, effectiveLongitude]
  );

  useEffect(() => {
    ensurePresetRoomsRef.current = ensurePresetRooms;
  }, [ensurePresetRooms, ensurePresetRoomsRef]);

  const handleSelectRoom = useCallback(
    (roomKey) => {
      if (!roomKey) {
        return;
      }
      setSelectedRoomKey(roomKey);
      const nextRoom = roomsByKey[roomKey];
      if (nextRoom) {
        setActiveRoom(nextRoom);
      } else {
        ensurePresetRooms(roomKey);
      }
    },
    [ensurePresetRooms, roomsByKey]
  );

  const handleReloadRooms = useCallback(() => {
    ensurePresetRooms(selectedRoomKeyRef.current);
  }, [ensurePresetRooms]);

  const handleRefreshMessages = useCallback(() => {
    if (!activeRoom) {
              setStatus({ type: 'warning', message: 'Select a chat room before refreshing messages.' });
      return;
    }
    if (!roomAccess.allowed) {
              setStatus({ type: 'warning', message: roomAccess.reason });
      return;
    }
    loadMessages(activeRoom);
  }, [activeRoom, loadMessages, roomAccess]);

  const handleTeleport = useCallback(
    async (preset) => {
      if (!currentProfile?._id) {
        setLocationStatus({
          type: 'warning',
          message: 'Current user profile is unavailable. Swap accounts or refresh the page.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setLocationStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      setIsTeleporting(true);
      setLocationStatus(null);

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
        setActiveLocationKey(preset.key);
        setLastSpoofedLocation(nextLocation);
        setViewerLocation(nextLocation);
        setLocationStatus({
          type: 'success',
          message: preset.statusMessage
        });
      } catch (error) {
        console.error('Failed to spoof location:', error);
        setLocationStatus({ type: 'error', message: error.message || 'Failed to spoof location.' });
      } finally {
        setIsTeleporting(false);
      }
    },
    [currentProfile, currentProfileId, setViewerLocation]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!currentUser || !currentProfile?._id) {
      return;
    }
    ensurePresetRoomsRef.current(selectedRoomKeyRef.current);
  }, [currentUser, currentProfile, currentProfileId]);

  useEffect(() => {
    const roomId = toIdString(activeRoom?._id);
    if (!roomId || !mongooseObjectIdLike(roomId)) {
      if (!activeRoom) {
        setMessages([]);
      }
      return;
    }

    if (!roomAccess.allowed) {
      setMessages([]);
      return;
    }

    setMessages([]);
    loadMessages(activeRoom);

    if (currentProfileId && mongooseObjectIdLike(currentProfileId)) {
      createProximityChatPresence({
        roomId,
        userId: currentProfileId
      }).catch((error) => {
        console.warn('Failed to record chat presence:', error);
      });
    }
  }, [activeRoom, currentProfileId, loadMessages, roomAccess]);

  useEffect(() => {
    const roomId = toIdString(activeRoom?._id);
    if (!roomId || !mongooseObjectIdLike(roomId) || !roomAccess.allowed) {
      return undefined;
    }
    const interval = setInterval(() => {
      loadMessages(activeRoom);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeRoom, loadMessages, roomAccess]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
          setStatus(null);

    const roomId = toIdString(activeRoom?._id);
    if (!roomId || !mongooseObjectIdLike(roomId)) {
              setStatus({ type: 'warning', message: 'Select a chat room before sending a message.' });
      return;
    }

    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
              setStatus({
        type: 'error',
        message: 'Current user profile is unavailable. Try swapping accounts again.'
      });
      return;
    }

    if (!roomAccess.allowed) {
              setStatus({ type: 'warning', message: roomAccess.reason });
      return;
    }

    const trimmed = messageInput.trim();
    if (!trimmed) {
              setStatus({ type: 'warning', message: 'Enter a message before sending.' });
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        roomId,
        authorId: currentProfileId,
        message: trimmed
      };

      if (lastSpoofedLocation) {
        payload.latitude = lastSpoofedLocation.latitude;
        payload.longitude = lastSpoofedLocation.longitude;
        if (lastSpoofedLocation.accuracy !== undefined) {
          payload.accuracy = lastSpoofedLocation.accuracy;
        }
      }

      const created = await createProximityChatMessage(payload);
      setMessages((prev) => [...prev, created]);
      setMessageInput('');
      try {
        await createProximityChatPresence({
          roomId,
          userId: currentProfileId
        });
      } catch (presenceError) {
        console.warn('Failed to update chat presence after sending message:', presenceError);
      }
    } catch (error) {
      console.error('Failed to send chat message:', error);
              setStatus({ type: 'error', message: error.message || 'Failed to send message.' });
    } finally {
      setIsSending(false);
    }
  };

  const sendingAsLabel = useMemo(() => {
    if (currentProfile) {
      return (
        currentProfile.displayName ||
        currentProfile.username ||
        currentProfile.email ||
        currentProfile._id
      );
    }
    if (currentUser) {
      return currentUser.displayName || currentUser.email || currentUser.uid;
    }
    return 'Unknown user';
  }, [currentProfile, currentUser]);

  const currentAvatar = useMemo(() => resolveAuthorAvatar(currentProfile), [currentProfile, resolveAuthorAvatar]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Live Chat Test</Typography>
          <Typography variant="body2" color="text.secondary">
            Swap between preset chat rooms and spoof GPS to validate proximity behavior for live chat.
          </Typography>
        </Stack>

        {status && (
          <Alert severity={status.type} onClose={() =>       setStatus(null)}>
            {status.message}
          </Alert>
        )}
        {!roomAccess.allowed && activeRoom && (
          <Alert severity="warning">{roomAccess.reason}</Alert>
        )}

        {!currentUser && (
          <Alert severity="warning">
            Sign in to interact with the live chat rooms.
          </Alert>
        )}

        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Chat room presets</Typography>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <ToggleButtonGroup
                value={selectedRoomKey}
                exclusive
                onChange={(_, value) => value && handleSelectRoom(value)}
                size="small"
                color="primary"
                sx={{ flexWrap: 'wrap' }}
              >
                {LIVE_CHAT_ROOM_PRESETS.map((preset) => (
                  <ToggleButton
                    key={preset.key}
                    value={preset.key}
                    disabled={isEnsuringRooms && !roomsByKey[preset.key]}
                    sx={{ textTransform: 'none', minWidth: 140 }}
                  >
                    {preset.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {isEnsuringRooms && <CircularProgress size={20} />}
            </Stack>
            {activeRoom && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activeRoom.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {activeRoomRadiusLabel && <Chip size="small" label={activeRoomRadiusLabel} />}
                  {distanceToRoomLabel && <Chip size="small" color="secondary" label={distanceToRoomLabel} />}
                  {activeRoom.description && (
                    <Typography variant="caption" color="text.secondary">
                      {activeRoom.description}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">GPS spoofing</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              {TELEPORT_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  size="small"
                  variant={preset.key === activeLocationKey ? 'contained' : 'outlined'}
                  onClick={() => handleTeleport(preset)}
                  disabled={isTeleporting || !currentUser}
                  sx={{ textTransform: 'none', minWidth: 220 }}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>
            {activeTeleportPreset && (
              <Typography variant="caption" color="text.secondary">
                Active GPS preset: {activeTeleportPreset.label} ({activeTeleportPreset.latitude.toFixed(4)}, {activeTeleportPreset.longitude.toFixed(4)})
              </Typography>
            )}
            {locationStatus && (
              <Alert severity={locationStatus.type} onClose={() => setLocationStatus(null)}>
                {locationStatus.message}
              </Alert>
            )}
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={currentAvatar} alt={sendingAsLabel} />
            <Stack spacing={0.3}>
              <Typography variant="subtitle2">Sending as</Typography>
              <Typography variant="body2" color="text.secondary">
                {sendingAsLabel}
              </Typography>
            </Stack>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={handleReloadRooms}
              disabled={isEnsuringRooms || !currentUser}
            >
              {isEnsuringRooms ? 'Loading rooms...' : 'Reload rooms'}
            </Button>
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={handleRefreshMessages}
              disabled={isRefreshingMessages || !activeRoom}
            >
              {isRefreshingMessages ? 'Refreshing...' : 'Refresh messages'}
            </Button>
          </Stack>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2 },
            height: 360,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            backgroundColor: 'background.default'
          }}
        >
          {!roomAccess.allowed && activeRoom ? (
            <Typography variant="body2" color="text.secondary">
              {roomAccess.reason}
            </Typography>
          ) : messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {isEnsuringRooms || isRefreshingMessages
                ? 'Loading messages...'
                : 'No messages yet. Send something to get started.'}
            </Typography>
          ) : (
            messages.map((message) => {
              const key = message?._id || `${message?.createdAt}-${message?.authorId || Math.random()}`;
              const authorName =
                message?.author?.displayName ||
                message?.author?.username ||
                message?.authorId ||
                'Unknown user';
              const avatarSrc = resolveAuthorAvatar(message?.author);
              const timestamp = formatReadableTimestamp(message?.createdAt);
              const messageAuthorId = toIdString(message?.authorId);
              const isSelf = currentProfileId && messageAuthorId && messageAuthorId === currentProfileId;

              return (
                <Stack
                  key={key}
                  direction="row"
                  spacing={2}
                  alignItems="flex-start"
                  justifyContent={isSelf ? 'flex-end' : 'flex-start'}
                >
                  {!isSelf && <Avatar src={avatarSrc} alt={authorName} sx={{ width: 36, height: 36 }} />}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      maxWidth: '80%',
                      backgroundColor: isSelf ? 'primary.main' : 'background.paper',
                      color: isSelf ? 'primary.contrastText' : 'text.primary'
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {authorName}
                        </Typography>
                        {timestamp && (
                          <Typography variant="caption" color="text.secondary">
                            {timestamp}
                          </Typography>
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message?.message}
                      </Typography>
                    </Stack>
                  </Paper>
                  {isSelf && <Avatar src={avatarSrc} alt={authorName} sx={{ width: 36, height: 36 }} />}
                </Stack>
              );
            })
          )}
          <Box ref={messagesEndRef} />
        </Paper>

        <Box component="form" onSubmit={handleSendMessage}>
          <Stack spacing={2}>
            <TextField
              label="Message"
              multiline
              minRows={2}
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder={`Type a message for ${activeRoom?.name ?? 'the selected chat room'}`}
              disabled={!currentUser || !activeRoom || !roomAccess.allowed}
            />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={!currentUser || !activeRoom || !roomAccess.allowed || isSending}
              >
                {isSending ? 'Sending...' : 'Send message'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}

export default LiveChatTestTab;
