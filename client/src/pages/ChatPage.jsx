import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Button,
  IconButton,
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
  Alert,
  MenuItem
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import AddCommentIcon from '@mui/icons-material/AddComment';
import RefreshIcon from '@mui/icons-material/Refresh';
import RoomIcon from '@mui/icons-material/Room';
import GroupIcon from '@mui/icons-material/Group';
import PublicIcon from '@mui/icons-material/Public';
import updatesIcon from '../assets/UpdateIcon.svg';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';

import Navbar from '../components/Navbar';
import GlobalNavMenu from '../components/GlobalNavMenu';
import MessageBubble from '../components/MessageBubble';
import ChatComposer from '../components/ChatComposer';

import { auth } from '../firebase';
import useChatManager from '../hooks/useChatManager';
import useModerationTools from '../hooks/useModerationTools';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { formatFriendlyTimestamp, formatAbsoluteDateTime, formatRelativeTime } from '../utils/dates';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import normalizeObjectId from '../utils/normalizeObjectId';

import './ChatPage.css';

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

function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { isOffline } = useNetworkStatusContext();
  const { announceBadgeEarned } = useBadgeSound();
  const [firebaseAuthUser, authLoading] = useAuthState(auth);
  const { location: viewerLocation } = useLocationContext();
  const viewerLatitude = viewerLocation?.latitude ?? null;
  const viewerLongitude = viewerLocation?.longitude ?? null;

  const {
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
  } = useChatManager({
    authUser: firebaseAuthUser,
    authLoading,
    viewerLatitude,
    viewerLongitude,
    isOffline,
    refreshUnreadCount,
    announceBadgeEarned
  });

  const {
    hasAccess: moderationHasAccess,
    loadOverview: loadModerationOverview,
    isLoadingOverview: isLoadingModerationOverview,
    recordAction: recordModerationAction,
    isSubmitting: isRecordingModerationAction,
    actionStatus: moderationActionStatus,
    resetActionStatus: resetModerationActionStatus
  } = useModerationTools({ autoLoad: false });

  const [moderationInitAttempted, setModerationInitAttempted] = useState(false);
  const [moderationContext, setModerationContext] = useState(null);
  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });
  const [isRoomsDialogOpen, setIsRoomsDialogOpen] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollBtnBottom, setScrollBtnBottom] = useState(0);
  const containerRef = useRef(null);
  const inputContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollMessagesToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  useLayoutEffect(() => {
    const timer = setTimeout(scrollMessagesToBottom, 100);
    return () => clearTimeout(timer);
  }, [selectedRoomId, location.pathname, scrollMessagesToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      setShowScrollButton(distanceFromBottom > 20);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const inputContainer = inputContainerRef.current;
    if (!inputContainer) {
      return;
    }

    let frameId = null;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const targetBottom = Math.round(entry.contentRect.height) + 8;
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
    if (!uniqueMessages.length) {
      return;
    }
    const timer = setTimeout(scrollMessagesToBottom, 75);
    return () => clearTimeout(timer);
  }, [uniqueMessages.length, scrollMessagesToBottom]);

  useEffect(() => {
    if (isOffline || moderationHasAccess === false) {
      return;
    }
    if (moderationInitAttempted || isLoadingModerationOverview) {
      return;
    }
    setModerationInitAttempted(true);
    loadModerationOverview().catch(() => {});
  }, [
    isOffline,
    moderationHasAccess,
    moderationInitAttempted,
    isLoadingModerationOverview,
    loadModerationOverview
  ]);

  useEffect(() => {
    if (!moderationActionStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      resetModerationActionStatus();
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [moderationActionStatus, resetModerationActionStatus]);

  useEffect(() => {
    if (!moderationContext) {
      return;
    }
    setModerationForm({
      type: 'warn',
      reason: '',
      durationMinutes: '15'
    });
  }, [moderationContext]);

  const handleNotifications = useCallback(() => {
    navigate('/updates');
  }, [navigate]);

  const handleChooseRoom = useCallback(
    (roomId) => {
      handleSelectRoom(roomId);
      setIsRoomsDialogOpen(false);
    },
    [handleSelectRoom]
  );

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  const canModerateMessages = !isOffline && moderationHasAccess !== false;

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

  const getMessageKey = useCallback((message, fallbackIndex) => {
    const rawId = message?._id || message?.id;
    if (!rawId) {
      return `message-${fallbackIndex}`;
    }
    if (typeof rawId === 'object' && rawId !== null && '$oid' in rawId) {
      return rawId.$oid;
    }
    return rawId;
  }, []);

  const getMessageAuthorId = useCallback((message) => {
    if (!message) {
      return null;
    }
    const candidates = [
      message.authorId,
      message.author?.id,
      message.author?._id,
      message.author?._id?.$oid
    ];
    for (const candidate of candidates) {
      const normalized = normalizeObjectId(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }, []);

  const handleSelectModerationAction = useCallback((actionType) => {
    setModerationForm((prev) => ({
      ...prev,
      type: actionType,
      durationMinutes: actionType === 'mute' ? prev.durationMinutes || '15' : prev.durationMinutes
    }));
  }, []);

  const handleModerationFieldChange = useCallback(
    (field) => (event) => {
      const { value } = event.target;
      setModerationForm((prev) => ({
        ...prev,
        [field]: value
      }));
    },
    []
  );

  const handleOpenModerationForMessage = useCallback(
    (message) => {
      if (!canModerateMessages) {
        return;
      }
      const targetId = getMessageAuthorId(message);
      if (!targetId) {
        return;
      }
      const displayName =
        message?.author?.displayName || message?.author?.username || message?.author?.id || 'User';
      const messagePreview = getDisplayMessageText(message);
      const resolvedKey = getMessageKey(message, 0);
      setModerationContext({
        userId: targetId,
        displayName,
        messagePreview,
        messageId: resolvedKey || targetId
      });
    },
    [canModerateMessages, getDisplayMessageText, getMessageAuthorId, getMessageKey]
  );

  const handleCloseModerationDialog = useCallback(() => {
    setModerationContext(null);
    resetModerationActionStatus();
  }, [resetModerationActionStatus]);

  const handleModerationSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!moderationContext?.userId || moderationHasAccess === false) {
        return;
      }

      const trimmedReason = moderationForm.reason.trim();
      const payload = {
        userId: moderationContext.userId,
        type: moderationForm.type
      };
      if (trimmedReason) {
        payload.reason = trimmedReason;
      }
      if (moderationForm.type === 'mute') {
        const parsed = Number.parseInt(moderationForm.durationMinutes, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          payload.durationMinutes = Math.min(1440, Math.max(1, parsed));
        }
      }

      try {
        await recordModerationAction(payload);
        setModerationForm((prev) => ({
          ...prev,
          reason: ''
        }));
      } catch (error) {
        // surfaced via action status
      }
    },
    [moderationContext, moderationForm, moderationHasAccess, recordModerationAction]
  );

  const disableModerationSubmit =
    !moderationContext?.userId ||
    moderationHasAccess === false ||
    isOffline ||
    isRecordingModerationAction;

  const RoomListContent = () => (
    <>
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
          <Chip label={rooms.length} size="small" color="primary" variant="outlined" />
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
        <List dense sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {rooms.map((room) => {
            const isActive = room._id === selectedRoomId;
            const participantLabel = room.participantCount
              ? `${room.participantCount} members`
              : 'No members yet';
            return (
              <ListItemButton
                key={room._id}
                selected={isActive}
                onClick={() => handleChooseRoom(room._id)}
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
                    <IconButton edge="end" size="small" onClick={() => handleChooseRoom(room._id)}>
                      {room.isGlobal ? <PublicIcon fontSize="small" /> : <RoomIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </>
  );

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
      <RoomListContent />
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
                  <IconButton onClick={handleRefreshCurrentRoom} disabled={isLoadingMessages}>
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
                  <Stack key={key} alignItems={isSelf ? 'flex-end' : 'flex-start'}>
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
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            title={formatAbsoluteDateTime(message.createdAt) || undefined}
                          >
                            {formatFriendlyTimestamp(message.createdAt) ||
                              formatRelativeTime(message.createdAt) ||
                              ''}
                          </Typography>
                        </Stack>
                        {bodyText ? (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {bodyText}
                          </Typography>
                        ) : null}
                        {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                          <Stack spacing={1}>
                            {message.attachments.map((attachment, attachmentIndex) => {
                              if (!attachment?.url) {
                                return null;
                              }
                              return (
                                <Box
                                  key={`${message._id || message.id}-attachment-${attachmentIndex}`}
                                  component="img"
                                  src={attachment.url}
                                  alt={attachment.description || 'Chat attachment'}
                                  sx={{ maxWidth: 240, borderRadius: 1 }}
                                  loading="lazy"
                                />
                              );
                            })}
                          </Stack>
                        ) : null}
                      </Stack>
                    </Paper>
                  </Stack>
                );
              })
            )}
          </Box>
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

  return (
    <>
      <Box className="page" sx={{ display: debugMode ? 'block' : 'none', width: '100%' }}>
        <Button className="chat-debug-toggle" onClick={() => setDebugMode((prev) => !prev)}>
          {debugMode ? 'Hide Chat Debug' : 'Show Chat Debug'}
        </Button>

        <Stack spacing={2} sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 4 } }}>
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
              <Chip label="Sign in to participate" size="small" color="warning" variant="outlined" />
            )}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ minHeight: { md: 560 } }}>
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
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Latitude"
                    type="number"
                    value={createForm.latitude}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, latitude: event.target.value }))
                    }
                    fullWidth
                    inputProps={{ step: '0.0001' }}
                  />
                  <TextField
                    label="Longitude"
                    type="number"
                    value={createForm.longitude}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, longitude: event.target.value }))
                    }
                    fullWidth
                    inputProps={{ step: '0.0001' }}
                  />
                </Stack>
                <TextField
                  label="Radius (meters)"
                  type="number"
                  value={createForm.radiusMeters}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, radiusMeters: event.target.value }))
                  }
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
              position: 'fixed'
            }}
            aria-label="Scroll to latest message"
          >
            <ArrowDownwardIcon className="scroll-to-bottom-icon" />
          </IconButton>
        )}

        <div className="chat-frame">
          <header className="chat-header-bar">
            <GlobalNavMenu />

            <h1
              className="chat-header-title"
              onClick={() => setDebugMode((prev) => !prev)}
            >
              Chat
            </h1>
            <div className="chat-header-actions">
              <Chip
                className="chat-room-chip"
                icon={<GroupIcon fontSize="small" />}
                label={selectedRoom ? selectedRoom.name : 'Browse rooms'}
                onClick={() => setIsRoomsDialogOpen(true)}
                variant="outlined"
                color="secondary"
                aria-label="Browse chat rooms"
              />

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
            </div>
          </header>

          <Box ref={containerRef} className="chat-messages-field">
            {uniqueMessages.map((msg, index) => (
              <MessageBubble
                key={getMessageKey(msg, index)}
                msg={msg}
                isSelf={authUser && msg.authorId === authUser.uid}
                authUser={authUser}
                canModerate={canModerateMessages}
                onModerate={handleOpenModerationForMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </Box>

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

      <Dialog
        open={isRoomsDialogOpen}
        onClose={() => setIsRoomsDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Choose a chat room</DialogTitle>
        <DialogContent dividers>
          <RoomListContent />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moderationContext)}
        onClose={handleCloseModerationDialog}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handleModerationSubmit}>
          <DialogTitle>
            Moderate {moderationContext?.displayName || 'user'}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              {moderationContext?.messagePreview ? (
                <Alert severity="info" variant="outlined">
                  {moderationContext.messagePreview}
                </Alert>
              ) : null}

              {moderationHasAccess === false ? (
                <Alert severity="warning">Moderator privileges required to perform actions.</Alert>
              ) : null}

              {moderationActionStatus ? (
                <Alert severity={moderationActionStatus.type}>
                  {moderationActionStatus.message}
                </Alert>
              ) : null}

              <Stack direction="row" flexWrap="wrap" gap={1}>
                {MODERATION_ACTION_OPTIONS.filter((option) =>
                  QUICK_MODERATION_ACTIONS.includes(option.value)
                ).map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    color={moderationForm.type === option.value ? 'primary' : 'default'}
                    variant={moderationForm.type === option.value ? 'filled' : 'outlined'}
                    onClick={() => handleSelectModerationAction(option.value)}
                    role="button"
                    aria-pressed={moderationForm.type === option.value}
                  />
                ))}
              </Stack>

              <TextField
                select
                label="Moderation action"
                value={moderationForm.type}
                onChange={handleModerationFieldChange('type')}
                fullWidth
              >
                {MODERATION_ACTION_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              {moderationForm.type === 'mute' ? (
                <TextField
                  label="Mute duration (minutes)"
                  type="number"
                  inputProps={{ min: 1, max: 1440, step: 5 }}
                  value={moderationForm.durationMinutes}
                  onChange={handleModerationFieldChange('durationMinutes')}
                />
              ) : null}

              <TextField
                label="Reason (optional)"
                value={moderationForm.reason}
                onChange={handleModerationFieldChange('reason')}
                multiline
                minRows={2}
                placeholder="Share context for other moderators."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModerationDialog} disabled={isRecordingModerationAction}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={disableModerationSubmit}>
              {isRecordingModerationAction ? 'Applying…' : 'Apply action'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}

export default ChatPage;
