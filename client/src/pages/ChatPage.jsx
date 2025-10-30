import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, NavLink, useLocation  } from "react-router-dom";
import Navbar from '../components/Navbar';
import GlobalNavMenu from '../components/GlobalNavMenu';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Button,
  IconButton,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  CircularProgress,
  Fab,
  Icon
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import AddCommentIcon from '@mui/icons-material/AddComment';
import RefreshIcon from '@mui/icons-material/Refresh';
import RoomIcon from '@mui/icons-material/Room';
import GroupIcon from '@mui/icons-material/Group';
import PublicIcon from '@mui/icons-material/Public';
import updatesIcon from "../assets/UpdateIcon.svg";
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';
import { auth } from '../firebase';
import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import {
  fetchChatRooms,
  createChatRoom,
  fetchChatMessages,
  createChatMessage,
  fetchChatPresence,
  upsertChatPresence,
  previewChatGif
} from '../api/mongoDataApi';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from "../contexts/UpdatesContext";
import { useNetworkStatusContext } from "../contexts/NetworkStatusContext";
import "./ChatPage.css";
import MessageBubble from '../components/MessageBubble';
import ChatComposer from '../components/ChatComposer';

export const pageConfig = {
  id: 'chat',
  label: 'Chat',
  icon: SmsIcon,
  path: '/chat',
  aliases: ['/chat-todo'],
  order: 90,
  showInNav: true,
  protected: true
};

const DEFAULT_COORDINATES = {
  latitude: 33.7838,
  longitude: -118.1136
};

const PRESENCE_HEARTBEAT_MS = 30_000;
const MESSAGES_REFRESH_MS = 7_000;

function ChatPage() {
  const navigate = useNavigate();
  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { isOffline } = useNetworkStatusContext();
  const [debugMode, setDebugMode] = useState(false);
  const { announceBadgeEarned } = useBadgeSound();
  const [authUser, authLoading] = useAuthState(auth);
  const { location: viewerLocation } = useLocationContext();
  const viewerLatitude = viewerLocation?.latitude ?? null;
  const viewerLongitude = viewerLocation?.longitude ?? null;
  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const selectedRoom = useMemo(
    () => rooms.find((room) => room._id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

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

  const messagesEndRef = useRef(null);
  const presenceIntervalRef = useRef(null);
  const messageIntervalRef = useRef(null);
  const containerRef = useRef(null);
  const location = useLocation();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const inputContainerRef = useRef(null);
  const [scrollBtnBottom, setScrollBtnBottom] = useState(0);
  const gifPreviewRequestRef = useRef(null);

  useEffect(() => {
      if (typeof refreshUnreadCount === 'function' && !isOffline) {
        refreshUnreadCount({ silent: true });
      }
    }, [isOffline, refreshUnreadCount]);

  const getGifCommandQuery = useCallback((value) => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed.toLowerCase().startsWith('/gif')) {
      return null;
    }
    const query = trimmed.slice(4).trim();
    return query.length ? query : null;
  }, []);


  const scrollMessagesToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // Makes the screen automatically display the bottom-most (latest) chat message whenever a new room is joined, this page is navigated to, or a new message is sent
  useLayoutEffect(() => {
    const timer = setTimeout(scrollMessagesToBottom, 100);
    return () => clearTimeout(timer);
  }, [selectedRoomId, location.pathname, scrollMessagesToBottom]);

  useEffect(() => {
    if (!authLoading && !authUser) {
      setRooms([]);
      setSelectedRoomId(null);
      setMessages([]);
      setPresence([]);
    }
  }, [authLoading, authUser]);

  // Detect user scroll to show/hide "scroll to bottom" button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      // calculate distance from bottom
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

      // show button if more than 20px from bottom
      setShowScrollButton(distanceFromBottom > 20);
    };

    container.addEventListener('scroll', handleScroll);    
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Automatically repositions the scroll button whenever the input height changes.
  // We throttle updates with requestAnimationFrame and skip redundant state writes.
  useEffect(() => {
    const inputContainer = inputContainerRef.current;
    if (!inputContainer) return;

    let frameId = null;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const targetBottom = Math.round(entry.contentRect.height) + 8; // 8px gap

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        setScrollBtnBottom((prev) =>
          Math.abs(prev - targetBottom) > 0.5 ? targetBottom : prev
        );
      });
    });

    resizeObserver.observe(inputContainer);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, []);

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
  }, [
    messageDraft,
    gifPreview,
    gifPreviewError,
    isGifPreviewLoading,
    getGifCommandQuery
  ]);

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
    [authUser, previewChatGif]
  );

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

    const sendPresence = async () => {
      try {
        await upsertChatPresence(selectedRoomId, {});
      } catch (error) {
        console.warn('Failed to update chat presence', error);
      }
    };

    sendPresence();
    const interval = setInterval(sendPresence, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [authUser, selectedRoomId]);

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
    if (isCreatingRoom) return;
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
        announceBadgeEarned(message.badgeEarnedId);
      }
      setMessageDraft('');
      gifPreviewRequestRef.current = null;
      setGifPreview(null);
      setGifPreviewError(null);
      setIsGifPreviewLoading(false);

      // Allows time for DOM to update, then scrolls to bottom
      setTimeout(scrollMessagesToBottom, 50);
    },
    [announceBadgeEarned, playBadgeSound, scrollMessagesToBottom]
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
    [authUser, createChatMessage, handleMessageSent, isSendingMessage, selectedRoomId]
  );

  const handleSendMessage = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedRoomId || !authUser || isSendingMessage) {
        return;
      }
      const trimmed = messageDraft.trim();
      if (!trimmed) {
        return;
      }

      const gifQuery = getGifCommandQuery(trimmed);
      if (gifQuery) {
        const hasSelection =
          gifPreview &&
          gifPreview.query === gifQuery &&
          Array.isArray(gifPreview.options) &&
          typeof gifPreview.selectedIndex === 'number' &&
          gifPreview.options[gifPreview.selectedIndex]?.attachment;

        if (hasSelection) {
          await sendGifMessage({
            query: gifQuery,
            attachment: gifPreview.options[gifPreview.selectedIndex].attachment
          });
        } else if (!isGifPreviewLoading) {
          await requestGifPreview(gifQuery);
        }
        return;
      }

      setIsSendingMessage(true);
      setMessagesError(null);
      try {
        const message = await createChatMessage(selectedRoomId, { message: trimmed });
        handleMessageSent(message);
      } catch (error) {
        setMessagesError(error?.message || 'Failed to send message.');
      } finally {
        setIsSendingMessage(false);
      }
    },
    [
      authUser,
      createChatMessage,
      getGifCommandQuery,
      gifPreview,
      handleMessageSent,
      isGifPreviewLoading,
      isSendingMessage,
      messageDraft,
      requestGifPreview,
      selectedRoomId,
      sendGifMessage
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
  }, [gifPreview, getGifCommandQuery, isGifPreviewLoading, messageDraft, requestGifPreview]);

  const handleMessageInputKeyDown = useCallback(
    (event) => {
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
      handleSendMessage(event);
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

  const filteredPresence = useMemo(() => {
    const map = new Map();
    presence.forEach((entry) => {
      map.set(entry.userId, entry);
    });
    return Array.from(map.values());
  }, [presence]);

  const activeUserCount = filteredPresence.length;

  const renderRoomList = () => (
    <Paper
      elevation={3}
      sx={{
        width: { xs: '100%', md: 320 },
        flexShrink: 0,
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: { xs: 360, md: '100%' }
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight={700}>
            Rooms
          </Typography>
          <Chip
            label={rooms.length}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh rooms">
            <span>
              <IconButton onClick={loadRooms} disabled={isLoadingRooms}>
                {isLoadingRooms ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Create room">
            <IconButton color="primary" onClick={handleOpenCreateDialog}>
              <AddCommentIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {roomsError ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="error">
            {roomsError}
          </Typography>
        </Box>
      ) : rooms.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {isLoadingRooms ? 'Loading rooms...' : 'No rooms yet. Create one to get started!'}
          </Typography>
        </Box>
      ) : (
        <List
          dense
          sx={{
            overflowY: 'auto',
            flexGrow: 1
          }}
        >
          {rooms.map((room) => {
            const isActive = room._id === selectedRoomId;
            const participantLabel = room.participantCount
              ? `${room.participantCount} members`
              : 'No members yet';
            return (
              <ListItemButton
                key={room._id}
                selected={isActive}
                onClick={() => handleSelectRoom(room._id)}
                sx={{ alignItems: 'flex-start', py: 1.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={600}>
                        {room.name}
                      </Typography>
                      <Chip
                        label={room.isGlobal ? 'Global' : 'Local'}
                        size="small"
                        color={room.isGlobal ? 'secondary' : 'default'}
                      />
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {participantLabel}
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title={room.isGlobal ? 'Global room' : 'Local room'}>
                    <IconButton edge="end" size="small">
                      {room.isGlobal ? <PublicIcon fontSize="small" /> : <RoomIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Paper>
  );

  const renderConversation = () => (
    <Paper
      elevation={3}
      sx={{
        flexGrow: 1,
        borderRadius: 3,
        overflow: 'hidden',
        minHeight: { xs: 420, md: '100%' },
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {selectedRoom ? (
        <>
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h5">{selectedRoom.name}</Typography>
                <Chip
                  icon={<GroupIcon fontSize="small" />}
                  label={`${activeUserCount} online`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              </Stack>
              {selectedRoom.description ? (
                <Typography variant="body2" color="text.secondary">
                  {selectedRoom.description}
                </Typography>
              ) : null}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh messages">
                <span>
                  <IconButton
                    onClick={() => {
                      if (selectedRoomId) {
                        loadMessages(selectedRoomId);
                        loadPresence(selectedRoomId);
                      }
                    }}
                    disabled={isLoadingMessages}
                  >
                    {isLoadingMessages ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              px: { xs: 2, md: 3 },
              py: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            {messagesError ? (
              <Typography variant="body2" color="error">
                {messagesError}
              </Typography>
            ) : uniqueMessages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No messages yet. Start the conversation!
              </Typography>
            ) : (
              uniqueMessages.map((message, index) => {
                const isSelf = authUser && message.authorId === authUser.uid;
                const key = getMessageKey(message, index);
                const bodyText = getDisplayMessageText(message);
                return (
                  <Stack
                    key={key}
                    alignItems={isSelf ? 'flex-end' : 'flex-start'}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        maxWidth: '100%',
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: isSelf ? 'primary.light' : 'background.default'
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={600}>
                            {message.author?.displayName || message.author?.username || 'Someone'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </Typography>
                        </Stack>
                        {bodyText ? (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {bodyText}
                          </Typography>
                        ) : null}
                        {Array.isArray(message.attachments) && message.attachments.length > 0
                          ? message.attachments.map((attachment, index) =>
                              attachment?.url ? (
                                <Box
                                  component="img"
                                  key={attachment._id || `${attachment.url}-${index}`}
                                  src={attachment.url}
                                  alt={
                                    attachment.description ||
                                    (bodyText ? `Attachment for message "${bodyText}"` : 'Chat attachment')
                                  }
                                  sx={{ mt: 1, maxWidth: '100%', borderRadius: 1 }}
                                  loading="lazy"
                                />
                              ) : null
                            )
                          : null}
                      </Stack>
                    </Paper>
                  </Stack>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Box>

          <Divider />

          <ChatComposer
            variant="legacy"
            message={messageDraft}
            placeholder={authUser ? 'Type your message…' : 'Sign in to chat'}
            onMessageChange={(event) => setMessageDraft(event.target.value)}
            onKeyDown={handleMessageInputKeyDown}
            onSend={handleSendMessage}
            disabled={!authUser || isSendingMessage}
            sendDisabled={!authUser || !messageDraft.trim() || isSendingMessage}
            isSending={isSendingMessage}
            gifPreview={composerGifPreview}
            gifPreviewError={gifPreviewError}
            isGifPreviewLoading={isGifPreviewLoading}
            onGifPreviewConfirm={handleGifPreviewConfirm}
            onGifPreviewCancel={handleGifPreviewCancel}
            onGifPreviewShuffle={handleGifPreviewShuffle}
          />
        </>
      ) : (
        <Stack
          spacing={2}
          alignItems="center"
          justifyContent="center"
          sx={{ flexGrow: 1, p: 4, textAlign: 'center' }}
        >
          <SmsIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h6">Select a room to get started</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a chat from the list or create a new space for your team.
          </Typography>
          <Button variant="outlined" onClick={handleOpenCreateDialog}>
            Create room
          </Button>
        </Stack>
      )}
    </Paper>
  );

  const handleNotifications = useCallback(() => {
      navigate("/updates");
    }, [navigate]);

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

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;  

  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    return messages.filter((message) => {
      const rawId = message?._id || message?.id;
      const id =
        typeof rawId === 'object' && rawId !== null && '$oid' in rawId ? rawId.$oid : rawId;
      if (!id) {
        return true;
      }
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [messages]);

  const getMessageKey = useCallback((message, fallbackIndex) => {
    const rawId = message?._id || message?.id;
    if (!rawId) {
      return `message-${fallbackIndex}`;
    }
    return typeof rawId === 'object' && rawId !== null && '$oid' in rawId ? rawId.$oid : rawId;
  }, []);

  const getDisplayMessageText = useCallback((msg) => {
    if (!msg || typeof msg.message !== 'string') {
      return '';
    }
    const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
    if (!hasAttachments) {
      return msg.message;
    }
    const stripped = msg.message.replace(/^GIF:\s*/i, '').trim();
    return stripped;
  }, []);

  return (
    <>
      {/*
        ======================================================================
        LEGACY VERSION HERE
        Debug layout that mirrors the original chat debug UI. Keep this block
        intact until the legacy view is fully componentized or removed.
        ======================================================================
      */}
      <Box
      sx={{
        display: debugMode ? 'block' : 'none',
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 4 }
      }}
      >
        <Button
          className="chat-debug-toggle"
          onClick={() => setDebugMode((prev) => !prev)}
        >
          {debugMode ? 'Hide Chat Debug' : 'Show Chat Debug'}
        </Button>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SmsIcon color="primary" />
            <Typography variant="h4" component="h1">
              Chat
            </Typography>
            {authUser ? (
              <Chip
                label={`Signed in as ${authUser.displayName || authUser.email || 'You'}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            ) : (
              <Chip
                label="Sign in to participate"
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ minHeight: { md: 560 } }}
          >
            {renderRoomList()}
            {renderConversation()}
          </Stack>

          {presenceError ? (
            <Typography variant="body2" color="error">
              {presenceError}
            </Typography>
          ) : null}
        </Stack>

      <Dialog open={isCreateDialogOpen} onClose={handleCloseCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create chat room</DialogTitle>
        <Box component="form" onSubmit={handleCreateRoom}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={createForm.description}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                multiline
                minRows={2}
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Latitude"
                  type="number"
                  value={createForm.latitude}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, latitude: event.target.value }))}
                  fullWidth
                  inputProps={{ step: '0.0001' }}
                />
                <TextField
                  label="Longitude"
                  type="number"
                  value={createForm.longitude}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, longitude: event.target.value }))}
                  fullWidth
                  inputProps={{ step: '0.0001' }}
                />
              </Stack>
              <TextField
                label="Radius (meters)"
                type="number"
                value={createForm.radiusMeters}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, radiusMeters: event.target.value }))}
                fullWidth
                inputProps={{ min: 50, step: 10 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.isGlobal}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, isGlobal: event.target.checked }))
                    }
                  />
                }
                label="Global room (visible everywhere)"
              />

              {createError ? (
                <Typography variant="body2" color="error">
                  {createError}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateDialog} disabled={isCreatingRoom}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isCreatingRoom}>
              {isCreatingRoom ? 'Creating…' : 'Create room'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>

    {/* Figma-based frontend design */}
    {/*
      ======================================================================
      NEWER VERSION HERE
      Production-facing chat experience modeled after the Figma designs.
      ======================================================================
    */}
    <Box 
      className="chat-page"
      sx={{ display: debugMode ? 'none' : 'block' }}
    >
      {showScrollButton && (
        <IconButton
          className="chat-scroll-to-bottom-btn"
          onClick={scrollMessagesToBottom}
          style={{
            bottom: `${scrollBtnBottom + 90}px`,
            position: 'fixed',
          }}
        >
          <ArrowDownwardIcon className="scroll-to-bottom-icon" />
        </IconButton>
      )}
      <div className="chat-frame">
        <header className="chat-header-bar">
          <GlobalNavMenu />

          {/*
            ======================================================================
            BIG NOTE FOR FUTURE TROY (AND CODEx ME):
            Clicking this header toggles `debugMode`, which swaps between the new
            Figma layout and the legacy chat page. Remember: there are two chat
            variations bundled in here until the old one is retired.
            ======================================================================
          */}
          <h1 
            className="chat-header-title"
            onClick={() => setDebugMode((prev) => !prev)}
            >
              Chat
          </h1>

          <button
            className="updates-icon-btn"
            type="button"
            aria-label={notificationsLabel}
            onClick={handleNotifications}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to view updates' : undefined}
          >
            <img src={updatesIcon} alt="" className="updates-icon" aria-hidden="true" />
            {displayBadge ? (
              <span className="updates-icon-badge" aria-hidden="true">
                {displayBadge}
              </span>
            ) : null}
          </button>
        </header>
        <Box 
          ref={containerRef}
          className="chat-messages-field"
        >
          {uniqueMessages.map((msg, index) => (
            <MessageBubble
              key={getMessageKey(msg, index)}
              msg={msg}
              isSelf={authUser && msg.authorId === authUser.uid}
              authUser={authUser}
            />
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Chat Message input
        TO DO: Make it modernly resize when selected and have additional buttons pop up (just add img planned) as well as making the input box bigger for bigger messages + character limit
        */}
        <ChatComposer
          variant="modern"
          message={messageDraft}
          placeholder="Send a message"
          onMessageChange={(event) => setMessageDraft(event.target.value)}
          onKeyDown={handleMessageInputKeyDown}
          onSend={handleSendMessage}
          disabled={!authUser || isSendingMessage}
          sendDisabled={!authUser || !messageDraft.trim() || isSendingMessage}
          isSending={isSendingMessage}
          containerRef={inputContainerRef}
          containerClassName="chat-input-container"
          gifPreview={composerGifPreview}
          gifPreviewError={gifPreviewError}
          isGifPreviewLoading={isGifPreviewLoading}
          onGifPreviewConfirm={handleGifPreviewConfirm}
          onGifPreviewCancel={handleGifPreviewCancel}
          onGifPreviewShuffle={handleGifPreviewShuffle}
        />
        <Navbar />
      </div>
    </Box>
    </>
)}



export default ChatPage;




