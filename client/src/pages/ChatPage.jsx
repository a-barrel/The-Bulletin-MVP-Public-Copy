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
  CircularProgress
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
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { formatFriendlyTimestamp, formatAbsoluteDateTime, formatRelativeTime } from '../utils/dates';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';

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

  const handleNotifications = useCallback(() => {
    navigate('/updates');
  }, [navigate]);

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

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

          <Box ref={containerRef} className="chat-messages-field">
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
  );
}

export default ChatPage;
