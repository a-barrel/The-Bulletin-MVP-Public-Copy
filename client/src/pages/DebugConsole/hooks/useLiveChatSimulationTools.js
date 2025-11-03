import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

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
  mongooseObjectIdLike,
  normalizeRoomName,
  resolveMediaUrl,
  toIdString
} from '../utils';

const useLiveChatSimulationTools = () => {
  const [currentUser] = useAuthState(auth);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [roomsByKey, setRoomsByKey] = useState({});
  const [selectedRoomKey, setSelectedRoomKey] = useState(LIVE_CHAT_ROOM_PRESETS[0].key);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [status, setStatus] = useState(null);
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
  }, [viewerLocation]);

  useEffect(() => {
    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      return;
    }
    refreshViewerLocation();
  }, [currentProfileId, refreshViewerLocation]);

  const roomAccess = useMemo(
    () => evaluateRoomAccess(activeRoom, lastSpoofedLocation),
    [activeRoom, lastSpoofedLocation]
  );

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

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
    [currentProfile, currentProfileId, currentUser, effectiveLatitude, effectiveLongitude, lastSpoofedLocation]
  );

  useEffect(() => {
    ensurePresetRoomsRef.current = ensurePresetRooms;
  }, [ensurePresetRooms]);

  useEffect(() => {
    if (!currentProfileId || !lastSpoofedLocation) {
      return;
    }

    const lastEnsured = lastEnsuredRef.current;
    if (
      lastEnsured.profileId === currentProfileId &&
      lastEnsured.latitude === lastSpoofedLocation.latitude &&
      lastEnsured.longitude === lastSpoofedLocation.longitude
    ) {
      return;
    }

    lastEnsuredRef.current = {
      profileId: currentProfileId,
      latitude: lastSpoofedLocation.latitude,
      longitude: lastSpoofedLocation.longitude
    };
    ensurePresetRooms(selectedRoomKeyRef.current);
  }, [ensurePresetRooms, currentProfileId, lastSpoofedLocation]);

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
    if (!activeRoom) {
      setMessages([]);
      return;
    }

    loadMessages(activeRoom);
    const interval = window.setInterval(() => {
      loadMessages(activeRoom);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [activeRoom, loadMessages]);

  useEffect(() => {
    if (!activeRoom) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await fetchChatPresence(toIdString(activeRoom?._id));
        if (!cancelled) {
          // no-op: the presence panel currently relies on manual refresh, but we preload entries for future use
        }
      } catch (error) {
        console.warn('Failed to preload presence log:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRoom]);

  const handleSendMessage = useCallback(
    async (event) => {
      event.preventDefault();

      if (!currentUser) {
        setStatus({ type: 'warning', message: 'Sign in to send messages.' });
        return;
      }

      const roomId = toIdString(activeRoom?._id);
      if (!roomId || !mongooseObjectIdLike(roomId)) {
        setStatus({ type: 'error', message: 'Select a valid chat room before sending messages.' });
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
    },
    [activeRoom, currentProfileId, currentUser, lastSpoofedLocation, messageInput, roomAccess]
  );

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

  return {
    currentUser,
    currentProfile,
    roomsByKey,
    selectedRoomKey,
    setSelectedRoomKey,
    activeRoom,
    messages,
    messageInput,
    setMessageInput,
    status,
    setStatus,
    locationStatus,
    setLocationStatus,
    isEnsuringRooms,
    isRefreshingMessages,
    isSending,
    isTeleporting,
    activeLocationKey,
    setActiveLocationKey,
    lastSpoofedLocation,
    roomAccess,
    distanceToRoomLabel,
    activeRoomRadiusLabel,
    activeTeleportPreset,
    handleSelectRoom,
    handleReloadRooms,
    handleRefreshMessages,
    handleTeleport,
    handleSendMessage,
    resolveAuthorAvatar,
    messagesEndRef,
    currentAvatar,
    sendingAsLabel
  };
};

export default useLiveChatSimulationTools;
