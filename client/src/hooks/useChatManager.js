import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createChatMessage,
  createChatRoom,
  fetchChatMessages,
  fetchChatPresence,
  fetchChatRooms,
  previewChatGif,
  upsertChatPresence
} from '../api/mongoDataApi';
import { playBadgeSound } from '../utils/badgeSound';

const DEFAULT_COORDINATES = {
  latitude: 33.7838,
  longitude: -118.1136
};

const PRESENCE_HEARTBEAT_MS = 30_000;
const MESSAGES_REFRESH_MS = 7_000;

const getGifCommandQuery = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('/gif')) {
    return null;
  }
  const query = trimmed.slice(4).trim();
  return query.length ? query : null;
};

const normalizeMessageId = (rawId, fallbackIndex) => {
  if (!rawId) {
    return `message-${fallbackIndex}`;
  }
  if (typeof rawId === 'object' && rawId !== null && '$oid' in rawId) {
    return rawId.$oid;
  }
  return rawId;
};

export function useChatManager({
  authUser,
  authLoading,
  viewerLatitude,
  viewerLongitude,
  isOffline,
  refreshUnreadCount,
  announceBadgeEarned
}) {
  const [debugMode, setDebugMode] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [presence, setPresence] = useState([]);
  const [presenceError, setPresenceError] = useState(null);

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');

  const [gifPreview, setGifPreview] = useState(null);
  const [isGifPreviewLoading, setIsGifPreviewLoading] = useState(false);
  const [gifPreviewError, setGifPreviewError] = useState(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    radiusMeters: 500,
    isGlobal: false
  });

  const messageIntervalRef = useRef(null);
  const presenceIntervalRef = useRef(null);
  const gifPreviewRequestRef = useRef(null);

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room._id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  useEffect(() => {
    if (!authLoading && !authUser) {
      setRooms([]);
      setSelectedRoomId(null);
      setMessages([]);
      setPresence([]);
    }
  }, [authLoading, authUser]);

  const loadRooms = useCallback(async () => {
    if (!authUser) {
      return;
    }
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const data = await fetchChatRooms({
        latitude: Number.isFinite(viewerLatitude) ? viewerLatitude : undefined,
        longitude: Number.isFinite(viewerLongitude) ? viewerLongitude : undefined
      });
      setRooms(data);
      if (data.length > 0 && !selectedRoomId) {
        setSelectedRoomId(data[0]._id);
      }
    } catch (error) {
      setRooms([]);
      setRoomsError(error?.message || 'Failed to load chat rooms.');
    } finally {
      setIsLoadingRooms(false);
    }
  }, [authUser, selectedRoomId, viewerLatitude, viewerLongitude]);

  useEffect(() => {
    if (!authLoading && authUser) {
      loadRooms();
    }
  }, [authLoading, authUser, loadRooms]);

  const loadMessages = useCallback(
    async (roomId, { silent } = {}) => {
      if (!roomId) {
        return;
      }
      if (!silent) {
        setIsLoadingMessages(true);
      }
      setMessagesError(null);
      try {
        const data = await fetchChatMessages(roomId);
        setMessages(data);
      } catch (error) {
        setMessages([]);
        setMessagesError(error?.message || 'Failed to load messages.');
      } finally {
        if (!silent) {
          setIsLoadingMessages(false);
        }
      }
    },
    []
  );

  const loadPresence = useCallback(async (roomId) => {
    if (!roomId) {
      return;
    }
    try {
      const data = await fetchChatPresence(roomId);
      setPresence(data);
      setPresenceError(null);
    } catch (error) {
      setPresence([]);
      setPresenceError(error?.message || 'Failed to load room presence.');
    }
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      setPresence([]);
      return;
    }

    loadMessages(selectedRoomId);
    loadPresence(selectedRoomId);

    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
    }
    messageIntervalRef.current = setInterval(() => {
      loadMessages(selectedRoomId, { silent: true });
    }, MESSAGES_REFRESH_MS);

    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current);
    }
    presenceIntervalRef.current = setInterval(() => {
      loadPresence(selectedRoomId);
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [loadMessages, loadPresence, selectedRoomId]);

  useEffect(() => {
    if (!authUser || !selectedRoomId) {
      return;
    }

    const sendPresenceHeartbeat = async () => {
      try {
        await upsertChatPresence(selectedRoomId, {});
      } catch (error) {
        console.warn('Failed to update chat presence', error);
      }
    };

    sendPresenceHeartbeat();
    const interval = setInterval(sendPresenceHeartbeat, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [authUser, selectedRoomId]);

  const requestGifPreview = useCallback(
    async (query) => {
      if (!authUser) {
        return;
      }
      const trimmedQuery = typeof query === 'string' ? query.trim() : '';
      if (!trimmedQuery) {
        return;
      }

      const requestId = Symbol('gif-preview');
      gifPreviewRequestRef.current = requestId;
      setGifPreview({ query: trimmedQuery, options: [], selectedIndex: null });
      setIsGifPreviewLoading(true);
      setGifPreviewError(null);

      try {
        const payload = await previewChatGif(trimmedQuery, { limit: 12 });
        if (gifPreviewRequestRef.current !== requestId) {
          return;
        }
        const options = Array.isArray(payload?.results) ? payload.results : [];
        if (!options.length) {
          setGifPreview({ query: trimmedQuery, options: [], selectedIndex: null });
          setGifPreviewError(`No GIFs found for "${trimmedQuery}". Try another search.`);
          return;
        }
        setGifPreview({ query: trimmedQuery, options, selectedIndex: 0 });
      } catch (error) {
        if (gifPreviewRequestRef.current !== requestId) {
          return;
        }
        setGifPreviewError(error?.message || 'Failed to load GIF preview.');
      } finally {
        if (gifPreviewRequestRef.current === requestId) {
          setIsGifPreviewLoading(false);
        }
      }
    },
    [authUser]
  );

  useEffect(() => {
    const gifQuery = getGifCommandQuery(messageDraft);
    if (!gifQuery) {
      if (gifPreview || gifPreviewError || isGifPreviewLoading) {
        gifPreviewRequestRef.current = null;
        setGifPreview(null);
        setGifPreviewError(null);
        setIsGifPreviewLoading(false);
      }
      return;
    }

    if (gifPreview && gifPreview.query !== gifQuery && !isGifPreviewLoading) {
      gifPreviewRequestRef.current = null;
      setGifPreview(null);
      setGifPreviewError(null);
    }
  }, [gifPreview, gifPreviewError, isGifPreviewLoading, messageDraft]);

  const handleSelectRoom = useCallback((roomId) => {
    setSelectedRoomId(roomId);
  }, []);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateForm((prev) => ({
      ...prev,
      name: '',
      description: '',
      radiusMeters: 500,
      isGlobal: false
    }));
    setCreateError(null);
    setIsCreateDialogOpen(true);
  }, []);

  const handleCloseCreateDialog = useCallback(() => {
    if (isCreatingRoom) {
      return;
    }
    setIsCreateDialogOpen(false);
  }, [isCreatingRoom]);

  const handleCreateRoom = useCallback(
    async (event) => {
      event.preventDefault();
      if (!authUser) {
        setCreateError('Sign in to create a chat room.');
        return;
      }

      if (!createForm.name.trim()) {
        setCreateError('Room name is required.');
        return;
      }

      setIsCreatingRoom(true);
      setCreateError(null);
      try {
        const payload = {
          name: createForm.name.trim(),
          description: createForm.description.trim() || undefined,
          latitude: Number(createForm.latitude) || DEFAULT_COORDINATES.latitude,
          longitude: Number(createForm.longitude) || DEFAULT_COORDINATES.longitude,
          radiusMeters: Number(createForm.radiusMeters) || 500,
          isGlobal: Boolean(createForm.isGlobal)
        };

        const room = await createChatRoom(payload);
        setRooms((prev) => [room, ...prev]);
        setSelectedRoomId(room._id);
        setIsCreateDialogOpen(false);
      } catch (error) {
        setCreateError(error?.message || 'Failed to create chat room.');
      } finally {
        setIsCreatingRoom(false);
      }
    },
    [authUser, createForm]
  );

  const handleMessageSent = useCallback(
    (message) => {
      if (!message) {
        return;
      }
      setMessages((prev) => [...prev, message]);
      if (message?.badgeEarnedId) {
        playBadgeSound();
        if (typeof announceBadgeEarned === 'function') {
          announceBadgeEarned(message.badgeEarnedId);
        }
      }
      setMessageDraft('');
      gifPreviewRequestRef.current = null;
      setGifPreview(null);
      setGifPreviewError(null);
      setIsGifPreviewLoading(false);
    },
    [announceBadgeEarned]
  );

  const sendGifMessage = useCallback(
    async ({ query, attachment }) => {
      if (!selectedRoomId || !authUser || !attachment || !query) {
        return;
      }
      if (isSendingMessage) {
        return;
      }
      setIsSendingMessage(true);
      setMessagesError(null);
      try {
        const payload = await createChatMessage(selectedRoomId, {
          message: `GIF: ${query}`,
          attachments: [attachment]
        });
        handleMessageSent(payload);
      } catch (error) {
        setMessagesError(error?.message || 'Failed to send message.');
      } finally {
        setIsSendingMessage(false);
      }
    },
    [authUser, handleMessageSent, isSendingMessage, selectedRoomId]
  );

  const handleSendMessage = useCallback(
    async (event, options = {}) => {
      event.preventDefault();
      if (!selectedRoomId || !authUser || isSendingMessage) {
        return false;
      }

      const trimmed = messageDraft.trim();
      const attachments = Array.isArray(options.attachments) ? options.attachments : [];
      const hasMessage = trimmed.length > 0;
      const hasAttachments = attachments.length > 0;

      if (!hasMessage && !hasAttachments) {
        return false;
      }

      const pendingGifQuery = getGifCommandQuery(messageDraft);
      if (pendingGifQuery && !gifPreview) {
        setGifPreviewError(null);
        requestGifPreview(pendingGifQuery);
        return false;
      }

      const messageToSend = hasMessage
        ? messageDraft
        : options.messageOverride || 'Attachment';

      setIsSendingMessage(true);
      setMessagesError(null);
      try {
        const message = await createChatMessage(selectedRoomId, {
          message: messageToSend,
          attachments
        });
        handleMessageSent(message);
        return true;
      } catch (error) {
        setMessagesError(error?.message || 'Failed to send message.');
        return false;
      } finally {
        setIsSendingMessage(false);
      }
    },
    [
      authUser,
      gifPreview,
      handleMessageSent,
      isSendingMessage,
      messageDraft,
      requestGifPreview,
      selectedRoomId
    ]
  );

  const handleGifPreviewConfirm = useCallback(() => {
    if (
      isGifPreviewLoading ||
      isSendingMessage ||
      !gifPreview ||
      typeof gifPreview.selectedIndex !== 'number'
    ) {
      return;
    }
    const options = Array.isArray(gifPreview.options) ? gifPreview.options : [];
    const selected = options[gifPreview.selectedIndex];
    if (!selected?.attachment) {
      return;
    }
    return sendGifMessage({
      query: gifPreview.query,
      attachment: selected.attachment
    });
  }, [gifPreview, isGifPreviewLoading, isSendingMessage, sendGifMessage]);

  const handleGifPreviewCancel = useCallback(() => {
    gifPreviewRequestRef.current = null;
    setGifPreview(null);
    setGifPreviewError(null);
    setIsGifPreviewLoading(false);
  }, []);

  const handleGifPreviewShuffle = useCallback(() => {
    if (isGifPreviewLoading) {
      return;
    }
    if (!gifPreview) {
      const query = getGifCommandQuery(messageDraft);
      if (query) {
        setGifPreviewError(null);
        requestGifPreview(query);
      }
      return;
    }
    setGifPreviewError(null);
    const options = Array.isArray(gifPreview.options) ? gifPreview.options : [];
    if (options.length > 1) {
      setGifPreview((prev) => {
        if (!prev) {
          return prev;
        }
        const opts = Array.isArray(prev.options) ? prev.options : [];
        if (opts.length < 2) {
          return prev;
        }
        const nextIndex =
          typeof prev.selectedIndex === 'number'
            ? (prev.selectedIndex + 1) % opts.length
            : 0;
        return { ...prev, selectedIndex: nextIndex };
      });
    } else if (gifPreview.query) {
      requestGifPreview(gifPreview.query);
    }
  }, [gifPreview, isGifPreviewLoading, messageDraft, requestGifPreview]);

  const handleMessageInputKeyDown = useCallback(
    (event, options = {}) => {
      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.nativeEvent?.isComposing
      ) {
        return;
      }

      event.preventDefault();
      if (gifPreviewError) {
        handleGifPreviewShuffle();
        return;
      }
      if (isGifPreviewLoading) {
        return;
      }
      if (
        gifPreview &&
        Array.isArray(gifPreview.options) &&
        typeof gifPreview.selectedIndex === 'number' &&
        gifPreview.options[gifPreview.selectedIndex]?.attachment
      ) {
        handleGifPreviewConfirm();
        return;
      }
      const result = handleSendMessage(event, options);
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
      }
      return result;
    },
    [
      gifPreview,
      gifPreviewError,
      handleGifPreviewConfirm,
      handleGifPreviewShuffle,
      handleSendMessage,
      isGifPreviewLoading
    ]
  );

  useEffect(
    () => () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    },
    []
  );

  const selectedGifOption = useMemo(() => {
    if (
      !gifPreview ||
      !Array.isArray(gifPreview.options) ||
      typeof gifPreview.selectedIndex !== 'number'
    ) {
      return null;
    }
    return gifPreview.options[gifPreview.selectedIndex] ?? null;
  }, [gifPreview]);

  const composerGifPreview = useMemo(
    () =>
      gifPreview
        ? {
            query: gifPreview.query,
            attachment: selectedGifOption?.attachment || null,
            sourceUrl: selectedGifOption?.sourceUrl,
            optionsCount: Array.isArray(gifPreview.options) ? gifPreview.options.length : 0
          }
        : null,
    [gifPreview, selectedGifOption]
  );

  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    return messages.filter((message, index) => {
      const key = normalizeMessageId(message?._id || message?.id, index);
      if (!key) {
        return true;
      }
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [messages]);

  const filteredPresence = useMemo(() => {
    const map = new Map();
    presence.forEach((entry) => {
      map.set(entry.userId, entry);
    });
    return Array.from(map.values());
  }, [presence]);

  const activeUserCount = filteredPresence.length;

  const handleRefreshCurrentRoom = useCallback(() => {
    if (!selectedRoomId) {
      return;
    }
    loadMessages(selectedRoomId);
    loadPresence(selectedRoomId);
  }, [loadMessages, loadPresence, selectedRoomId]);

  return {
    debugMode,
    setDebugMode,
    authUser,
    rooms,
    roomsError,
    isLoadingRooms,
    loadRooms,
    selectedRoomId,
    selectedRoom,
    handleSelectRoom,
    messages,
    uniqueMessages,
    messagesError,
    isLoadingMessages,
    handleRefreshCurrentRoom,
    presenceError,
    activeUserCount,
    messageDraft,
    setMessageDraft,
    handleSendMessage,
    handleMessageInputKeyDown,
    isSendingMessage,
    gifPreview,
    gifPreviewError,
    isGifPreviewLoading,
    handleGifPreviewConfirm,
    handleGifPreviewCancel,
    handleGifPreviewShuffle,
    composerGifPreview,
    handleOpenCreateDialog,
    handleCloseCreateDialog,
    handleCreateRoom,
    isCreateDialogOpen,
    createForm,
    setCreateForm,
    isCreatingRoom,
    createError
  };
}

export default useChatManager;
