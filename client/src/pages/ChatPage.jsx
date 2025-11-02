/* NOTE: Page exports navigation config alongside the component. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemAvatar,
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
  Avatar,
  MenuItem,
  Tabs,
  Tab,
  Snackbar
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import AddCommentIcon from '@mui/icons-material/AddComment';
import RefreshIcon from '@mui/icons-material/Refresh';
import RoomIcon from '@mui/icons-material/Room';
import GroupIcon from '@mui/icons-material/Group';
import PublicIcon from '@mui/icons-material/Public';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import CloseIcon from '@mui/icons-material/Close';
import updatesIcon from '../assets/UpdateIcon.svg';
import AvatarIcon from '../assets/AvatarIcon.svg';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';

import Navbar from '../components/Navbar';
import GlobalNavMenu from '../components/GlobalNavMenu';
import MessageBubble from '../components/MessageBubble';
import ChatComposer from '../components/ChatComposer';
import useDirectMessages from '../hooks/useDirectMessages';

import { auth } from '../firebase';
import useChatManager from '../hooks/useChatManager';
import useModerationTools from '../hooks/useModerationTools';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { formatFriendlyTimestamp, formatRelativeTime } from '../utils/dates';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import normalizeObjectId from '../utils/normalizeObjectId';
import { previewChatGif, uploadImage } from '../api/mongoDataApi';

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

const MAX_CHAT_ATTACHMENTS = 10;
const ATTACHMENT_ONLY_PLACEHOLDER = '[attachment-only-message]';

const generateAttachmentId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isSupportedImageFile = (file) => {
  if (!file) {
    return false;
  }
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  if (file.name) {
    return /\.(jpe?g|png|gif|webp|avif|heic|heif)$/i.test(file.name);
  }
  return false;
};

const getParticipantId = (participant) => {
  if (!participant) {
    return null;
  }
  if (typeof participant === 'string') {
    return normalizeObjectId(participant);
  }
  return normalizeObjectId(
    participant.id ||
      participant._id ||
      (typeof participant?.id === 'object' && participant.id !== null && '$oid' in participant.id
        ? participant.id.$oid
        : null)
  );
};

const getParticipantDisplayName = (participant) => {
  if (!participant || typeof participant === 'string') {
    return typeof participant === 'string' ? participant : '';
  }
  return (
    participant.displayName ||
    participant.username ||
    participant.email ||
    participant.id ||
    participant._id ||
    ''
  );
};

const resolveAvatarSrc = (participant) => {
  if (!participant) {
    return AvatarIcon;
  }
  const avatar = participant.avatar;
  const url =
    typeof avatar === 'string'
      ? avatar
      : typeof avatar?.url === 'string'
      ? avatar.url
      : typeof avatar?.thumbnailUrl === 'string'
      ? avatar.thumbnailUrl
      : null;
  if (typeof url === 'string' && url.trim()) {
    const trimmed = url.trim();
    if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    return `/${trimmed.replace(/^\/+/, '')}`;
  }
  return AvatarIcon;
};

function AttachmentPreview({ attachments, onRemove, status, uploading, padding }) {
  if (!attachments.length && !status && !uploading) {
    return null;
  }

  return (
    <>
      {status ? (
        <Box sx={{ px: padding, pb: 1 }}>
          <Alert severity={status.type}>{status.message}</Alert>
        </Box>
      ) : null}
      {attachments.length ? (
        <Box sx={{ px: padding, pb: 1 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {attachments.map((item) => (
              <Box
                key={item.id}
                sx={{
                  position: 'relative',
                  width: 132,
                  height: 132,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  backgroundColor: 'background.paper',
                  boxShadow: 3
                }}
              >
                <Box
                  component="img"
                  src={item.asset.url}
                  alt={item.asset.description || 'Chat attachment'}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {typeof onRemove === 'function' ? (
                  <IconButton
                    size="small"
                    aria-label="Remove attachment"
                    onClick={() => onRemove(item.id)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.75)'
                      }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
      {uploading ? (
        <Box sx={{ px: padding, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Uploading…
          </Typography>
        </Box>
      ) : null}
    </>
  );
}

AttachmentPreview.defaultProps = {
  attachments: [],
  onRemove: undefined,
  status: null,
  uploading: false,
  padding: { xs: 2, md: 3 }
};

const resolveThreadParticipants = (thread, viewerId) => {
  if (!thread) {
    return [];
  }
  const participants = Array.isArray(thread.participants) ? thread.participants : [];
  const names = [];
  const normalizedViewerId = viewerId ? normalizeObjectId(viewerId) : null;
  participants.forEach((participant) => {
    const participantId = participant?.id || participant?._id || participant;
    const normalizedParticipantId = normalizeObjectId(participantId);
    if (normalizedParticipantId && normalizedViewerId && normalizedParticipantId === normalizedViewerId) {
      return;
    }
    const name =
      participant?.displayName ||
      participant?.username ||
      participant?.email ||
      participant?.id ||
      participantId;
    if (name) {
      names.push(name);
    }
  });
  return names.length ? names : ['You'];
};

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
    debugMode: _debugMode,
    setDebugMode: _setDebugMode,
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
    presenceError,
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

  const {
    viewer: dmViewer,
    threads: dmThreads,
    refreshThreads: refreshDmThreads,
    isLoadingThreads: isLoadingDmThreads,
    threadsStatus: dmThreadsStatus,
    hasAccess: directMessagesHasAccess,
    selectThread: selectDirectThread,
    selectedThreadId: selectedDirectThreadId,
    threadDetail: directThreadDetail,
    isLoadingThread: isLoadingDirectThread,
    threadStatus: directThreadStatus,
    sendMessage: sendDirectMessage,
    isSending: isSendingDirectMessage,
    sendStatus: directSendStatus,
    resetSendStatus: resetDirectSendStatus
  } = useDirectMessages();

  const [moderationInitAttempted, setModerationInitAttempted] = useState(false);
  const [moderationContext, setModerationContext] = useState(null);
  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });
  const [channelTab, setChannelTab] = useState('rooms');
  const [channelDialogTab, setChannelDialogTab] = useState('rooms');
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [dmMessageDraft, setDmMessageDraft] = useState('');
  const dmGifPreviewRequestRef = useRef(null);
  const [dmGifPreview, setDmGifPreview] = useState(null);
  const [dmGifPreviewError, setDmGifPreviewError] = useState(null);
  const [isDmGifPreviewLoading, setIsDmGifPreviewLoading] = useState(false);
  const [roomAttachments, setRoomAttachments] = useState([]);
  const [roomAttachmentStatus, setRoomAttachmentStatus] = useState(null);
  const [isUploadingRoomAttachment, setIsUploadingRoomAttachment] = useState(false);
  const [dmAttachments, setDmAttachments] = useState([]);
  const [dmAttachmentStatus, setDmAttachmentStatus] = useState(null);
  const [isUploadingDmAttachment, setIsUploadingDmAttachment] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollBtnBottom, setScrollBtnBottom] = useState(0);
  const containerRef = useRef(null);
  const inputContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const roomAttachmentInputRef = useRef(null);
  const dmAttachmentInputRef = useRef(null);

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
    if (channelTab !== 'rooms') {
      return;
    }
    if (!uniqueMessages.length) {
      return;
    }
    const timer = setTimeout(scrollMessagesToBottom, 75);
    return () => clearTimeout(timer);
  }, [channelTab, uniqueMessages.length, scrollMessagesToBottom]);

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
    if (channelTab === 'direct' && directMessagesHasAccess === false) {
      setChannelTab('rooms');
    }
  }, [channelTab, directMessagesHasAccess]);

  useEffect(() => {
    if (channelDialogTab === 'direct' && directMessagesHasAccess === false) {
      setChannelDialogTab('rooms');
    }
  }, [channelDialogTab, directMessagesHasAccess]);

  useEffect(() => {
    if (channelTab === 'direct') {
      refreshDmThreads().catch(() => {});
    }
  }, [channelTab, refreshDmThreads]);

  useEffect(() => {
    setRoomAttachments([]);
    setRoomAttachmentStatus(null);
  }, [selectedRoomId]);

  useEffect(() => {
    if (channelTab !== 'direct') {
      return;
    }
    if (directMessagesHasAccess === false) {
      return;
    }
    if (selectedDirectThreadId || dmThreads.length === 0) {
      return;
    }
    selectDirectThread(dmThreads[0].id);
  }, [channelTab, directMessagesHasAccess, dmThreads, selectedDirectThreadId, selectDirectThread]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'direct' && directMessagesHasAccess !== false) {
      setChannelTab('direct');
      setChannelDialogTab('direct');
      const threadParam = params.get('thread');
      if (threadParam) {
        selectDirectThread(threadParam);
      }
      return;
    }

    if (tabParam !== 'direct') {
      setChannelTab((prev) => (prev === 'direct' ? 'rooms' : prev));
      setChannelDialogTab((prev) => (prev === 'direct' ? 'rooms' : prev));
    }
  }, [directMessagesHasAccess, location.search, selectDirectThread]);

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
    if (!directSendStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      resetDirectSendStatus();
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [directSendStatus, resetDirectSendStatus]);

  useEffect(() => {
    if (!roomAttachmentStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setRoomAttachmentStatus(null);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [roomAttachmentStatus]);

  useEffect(() => {
    if (!dmAttachmentStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setDmAttachmentStatus(null);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [dmAttachmentStatus]);

  useEffect(() => {
    const gifQuery = getGifCommandQuery(dmMessageDraft);
    if (!gifQuery) {
      if (dmGifPreview || dmGifPreviewError || isDmGifPreviewLoading) {
        dmGifPreviewRequestRef.current = null;
        setDmGifPreview(null);
        setDmGifPreviewError(null);
        setIsDmGifPreviewLoading(false);
      }
      return;
    }

    if (dmGifPreview && dmGifPreview.query !== gifQuery && !isDmGifPreviewLoading) {
      dmGifPreviewRequestRef.current = null;
      setDmGifPreview(null);
      setDmGifPreviewError(null);
    }
  }, [dmGifPreview, dmGifPreviewError, dmMessageDraft, isDmGifPreviewLoading]);

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

  useEffect(() => {
    dmGifPreviewRequestRef.current = null;
    setDmGifPreview(null);
    setDmGifPreviewError(null);
    setIsDmGifPreviewLoading(false);
    setDmMessageDraft('');
    setDmAttachments([]);
    setDmAttachmentStatus(null);
  }, [selectedDirectThreadId]);

  const handleNotifications = useCallback(() => {
    navigate('/updates');
  }, [navigate]);

  const handleChooseRoom = useCallback(
    (roomId) => {
      handleSelectRoom(roomId);
      setChannelTab('rooms');
      setChannelDialogTab('rooms');
      setIsChannelDialogOpen(false);
    },
    [handleSelectRoom]
  );

  const handleSelectDirectThreadId = useCallback(
    (threadId) => {
      selectDirectThread(threadId);
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);
    },
    [selectDirectThread]
  );

  const handleOpenChannelDialog = useCallback(() => {
    setChannelDialogTab(
      channelTab === 'direct' && directMessagesHasAccess !== false ? 'direct' : 'rooms'
    );
    setIsChannelDialogOpen(true);
  }, [channelTab, directMessagesHasAccess]);

  const requestDmGifPreview = useCallback(
    async (query) => {
      if (!authUser) {
        return;
      }
      const trimmedQuery = typeof query === 'string' ? query.trim() : '';
      if (!trimmedQuery) {
        return;
      }

      const requestId = Symbol('dm-gif-preview');
      dmGifPreviewRequestRef.current = requestId;
      setDmGifPreview({ query: trimmedQuery, options: [], selectedIndex: null });
      setIsDmGifPreviewLoading(true);
      setDmGifPreviewError(null);

      try {
        const payload = await previewChatGif(trimmedQuery, { limit: 12 });
        if (dmGifPreviewRequestRef.current !== requestId) {
          return;
        }
        const options = Array.isArray(payload?.results) ? payload.results : [];
        if (!options.length) {
          setDmGifPreview({ query: trimmedQuery, options: [], selectedIndex: null });
          setDmGifPreviewError(`No GIFs found for "${trimmedQuery}". Try another search.`);
          return;
        }
        setDmGifPreview({ query: trimmedQuery, options, selectedIndex: 0 });
      } catch (error) {
        if (dmGifPreviewRequestRef.current !== requestId) {
          return;
        }
        setDmGifPreviewError(error?.message || 'Failed to load GIF preview.');
      } finally {
        if (dmGifPreviewRequestRef.current === requestId) {
          setIsDmGifPreviewLoading(false);
        }
      }
    },
    [authUser]
  );

  const handleDmGifPreviewCancel = useCallback(() => {
    dmGifPreviewRequestRef.current = null;
    setDmGifPreview(null);
    setDmGifPreviewError(null);
    setIsDmGifPreviewLoading(false);
  }, []);

  const handleDmGifPreviewShuffle = useCallback(() => {
    if (isDmGifPreviewLoading) {
      return;
    }
    if (!dmGifPreview) {
      const query = getGifCommandQuery(dmMessageDraft);
      if (query) {
        setDmGifPreviewError(null);
        requestDmGifPreview(query);
      }
      return;
    }
    setDmGifPreviewError(null);
    const options = Array.isArray(dmGifPreview.options) ? dmGifPreview.options : [];
    if (options.length > 1) {
      setDmGifPreview((prev) => {
        if (!prev) {
          return prev;
        }
        const opts = Array.isArray(prev.options) ? prev.options : [];
        if (opts.length < 2) {
          return prev;
        }
        const nextIndex =
          typeof prev.selectedIndex === 'number' ? (prev.selectedIndex + 1) % opts.length : 0;
        return { ...prev, selectedIndex: nextIndex };
      });
    } else if (dmGifPreview.query) {
      requestDmGifPreview(dmGifPreview.query);
    }
  }, [dmGifPreview, dmMessageDraft, isDmGifPreviewLoading, requestDmGifPreview]);

  const handleDmGifPreviewConfirm = useCallback(async () => {
    if (
      isDmGifPreviewLoading ||
      isSendingDirectMessage ||
      !dmGifPreview ||
      typeof dmGifPreview.selectedIndex !== 'number'
    ) {
      return;
    }
    const options = Array.isArray(dmGifPreview.options) ? dmGifPreview.options : [];
    const selected = options[dmGifPreview.selectedIndex];
    if (!selected?.attachment) {
      return;
    }
    if (!selectedDirectThreadId) {
      return;
    }
    try {
      await sendDirectMessage({
        threadId: selectedDirectThreadId,
        body: `GIF: ${dmGifPreview.query}`,
        attachments: [selected.attachment]
      });
      setDmMessageDraft('');
      setDmAttachments([]);
      setDmAttachmentStatus(null);
      handleDmGifPreviewCancel();
    } catch {
      // surfaced via send status
    }
  }, [
    dmGifPreview,
    handleDmGifPreviewCancel,
    isDmGifPreviewLoading,
    isSendingDirectMessage,
    selectedDirectThreadId,
    sendDirectMessage
  ]);

  const handleChannelDialogTabChange = useCallback(
    (event, value) => {
      if (value === 'direct' && directMessagesHasAccess === false) {
        return;
      }
      setChannelDialogTab(value);
    },
    [directMessagesHasAccess]
  );

  const handleOpenRoomAttachmentPicker = useCallback(() => {
    if (isOffline) {
      setRoomAttachmentStatus({ type: 'error', message: 'Reconnect to upload images.' });
      return;
    }
    if (!selectedRoomId) {
      setRoomAttachmentStatus({ type: 'error', message: 'Select a room before uploading images.' });
      return;
    }
    if (roomAttachments.length >= MAX_CHAT_ATTACHMENTS) {
      setRoomAttachmentStatus({ type: 'error', message: 'You can attach up to 10 images per message.' });
      return;
    }
    roomAttachmentInputRef.current?.click();
  }, [isOffline, roomAttachments.length, selectedRoomId]);

  const handleOpenDmAttachmentPicker = useCallback(() => {
    if (isOffline) {
      setDmAttachmentStatus({ type: 'error', message: 'Reconnect to upload images.' });
      return;
    }
    if (directMessagesHasAccess === false) {
      setDmAttachmentStatus({ type: 'error', message: 'Direct messages are disabled for your account.' });
      return;
    }
    if (!selectedDirectThreadId) {
      setDmAttachmentStatus({ type: 'error', message: 'Select a conversation before uploading images.' });
      return;
    }
    if (dmAttachments.length >= MAX_CHAT_ATTACHMENTS) {
      setDmAttachmentStatus({ type: 'error', message: 'You can attach up to 10 images per message.' });
      return;
    }
    dmAttachmentInputRef.current?.click();
  }, [directMessagesHasAccess, dmAttachments.length, isOffline, selectedDirectThreadId]);

  const handleRemoveRoomAttachment = useCallback((attachmentId) => {
    setRoomAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  }, []);

  const handleRemoveDmAttachment = useCallback((attachmentId) => {
    setDmAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  }, []);

  const handleRoomAttachmentInputChange = useCallback(
    async (event) => {
      const fileList = Array.from(event.target.files ?? []);
      if (event.target) {
        event.target.value = '';
      }
      if (!fileList.length) {
        return;
      }
      if (isOffline) {
        setRoomAttachmentStatus({ type: 'error', message: 'Reconnect to upload images.' });
        return;
      }

      const remainingSlots = MAX_CHAT_ATTACHMENTS - roomAttachments.length;
      if (remainingSlots <= 0) {
        setRoomAttachmentStatus({ type: 'error', message: 'You can attach up to 10 images per message.' });
        return;
      }

      const limitedFiles = fileList.slice(0, remainingSlots);
      if (fileList.length > remainingSlots) {
        setRoomAttachmentStatus({
          type: 'info',
          message: `Only the first ${remainingSlots} file${remainingSlots === 1 ? '' : 's'} were attached.`
        });
      }

      const supportedFiles = limitedFiles.filter((file) => isSupportedImageFile(file));
      if (!supportedFiles.length) {
        setRoomAttachmentStatus({ type: 'error', message: 'Only image and GIF files are supported.' });
        return;
      }
      if (supportedFiles.length !== limitedFiles.length) {
        setRoomAttachmentStatus({ type: 'error', message: 'Unsupported file type removed. Only image and GIF files are supported.' });
      }

      setIsUploadingRoomAttachment(true);
      try {
        const uploadedEntries = [];
        for (const file of supportedFiles) {
          try {
            const uploaded = await uploadImage(file);
            const url = uploaded?.url || uploaded?.path;
            if (!url) {
              throw new Error(`Upload failed for ${file.name || 'image'}.`);
            }
            uploadedEntries.push({
              id: generateAttachmentId(),
              asset: {
                url,
                width: uploaded?.width,
                height: uploaded?.height,
                mimeType: uploaded?.mimeType || file.type || undefined,
                description: uploaded?.fileName || file.name || undefined,
                uploadedAt: uploaded?.uploadedAt
              }
            });
          } catch (error) {
            setRoomAttachmentStatus({
              type: 'error',
              message: error?.message || `Failed to upload ${file.name || 'image'}.`
            });
          }
        }

        if (uploadedEntries.length) {
          setRoomAttachments((prev) => [...prev, ...uploadedEntries]);
        }
      } finally {
        setIsUploadingRoomAttachment(false);
      }
    },
    [isOffline, roomAttachments.length]
  );

  const handleDmAttachmentInputChange = useCallback(
    async (event) => {
      const fileList = Array.from(event.target.files ?? []);
      if (event.target) {
        event.target.value = '';
      }
      if (!fileList.length) {
        return;
      }
      if (isOffline) {
        setDmAttachmentStatus({ type: 'error', message: 'Reconnect to upload images.' });
        return;
      }
      if (directMessagesHasAccess === false) {
        setDmAttachmentStatus({ type: 'error', message: 'Direct messages are disabled for your account.' });
        return;
      }

      const remainingSlots = MAX_CHAT_ATTACHMENTS - dmAttachments.length;
      if (remainingSlots <= 0) {
        setDmAttachmentStatus({ type: 'error', message: 'You can attach up to 10 images per message.' });
        return;
      }

      const limitedFiles = fileList.slice(0, remainingSlots);
      if (fileList.length > remainingSlots) {
        setDmAttachmentStatus({
          type: 'info',
          message: `Only the first ${remainingSlots} file${remainingSlots === 1 ? '' : 's'} were attached.`
        });
      }

      const supportedFiles = limitedFiles.filter((file) => isSupportedImageFile(file));
      if (!supportedFiles.length) {
        setDmAttachmentStatus({ type: 'error', message: 'Only image and GIF files are supported.' });
        return;
      }
      if (supportedFiles.length !== limitedFiles.length) {
        setDmAttachmentStatus({ type: 'error', message: 'Unsupported file type removed. Only image and GIF files are supported.' });
      }

      setIsUploadingDmAttachment(true);
      try {
        const uploadedEntries = [];
        for (const file of supportedFiles) {
          try {
            const uploaded = await uploadImage(file);
            const url = uploaded?.url || uploaded?.path;
            if (!url) {
              throw new Error(`Upload failed for ${file.name || 'image'}.`);
            }
            uploadedEntries.push({
              id: generateAttachmentId(),
              asset: {
                url,
                width: uploaded?.width,
                height: uploaded?.height,
                mimeType: uploaded?.mimeType || file.type || undefined,
                description: uploaded?.fileName || file.name || undefined,
                uploadedAt: uploaded?.uploadedAt
              }
            });
          } catch (error) {
            setDmAttachmentStatus({
              type: 'error',
              message: error?.message || `Failed to upload ${file.name || 'image'}.`
            });
          }
        }

        if (uploadedEntries.length) {
          setDmAttachments((prev) => [...prev, ...uploadedEntries]);
        }
      } finally {
        setIsUploadingDmAttachment(false);
      }
    },
    [directMessagesHasAccess, dmAttachments.length, isOffline]
  );

  const handleRoomSendMessage = useCallback(
    async (event) => {
      if (isUploadingRoomAttachment) {
        event.preventDefault();
        setRoomAttachmentStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }
      const attachments = roomAttachments.map((item) => item.asset);
      const hasText = messageDraft.trim().length > 0;
      const options = {
        attachments,
        messageOverride: hasText || attachments.length === 0 ? undefined : ATTACHMENT_ONLY_PLACEHOLDER
      };
      const sent = await handleSendMessage(event, options);
      if (sent) {
        setRoomAttachments([]);
        setRoomAttachmentStatus(null);
      }
    },
    [handleSendMessage, isUploadingRoomAttachment, messageDraft, roomAttachments]
  );

  const handleRoomMessageKeyDown = useCallback(
    (event) => {
      const isPlainEnter =
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.nativeEvent?.isComposing;

      if (isPlainEnter && isUploadingRoomAttachment) {
        event.preventDefault();
        setRoomAttachmentStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }

      const attachments = roomAttachments.map((item) => item.asset);
      handleMessageInputKeyDown(event, {
        attachments,
        messageOverride:
          messageDraft.trim().length > 0 || attachments.length === 0
            ? undefined
            : ATTACHMENT_ONLY_PLACEHOLDER
      });
    },
    [handleMessageInputKeyDown, isUploadingRoomAttachment, messageDraft, roomAttachments]
  );

  const handleSendDirectMessage = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedDirectThreadId || isSendingDirectMessage) {
        return;
      }
      if (isUploadingDmAttachment) {
        setDmAttachmentStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }
      const trimmed = dmMessageDraft.trim();
      const attachments = dmAttachments.map((item) => item.asset);
      const hasText = trimmed.length > 0;
      const hasAttachments = attachments.length > 0;
      if (!hasText && !hasAttachments) {
        return;
      }
      const pendingGifQuery = getGifCommandQuery(dmMessageDraft);
      if (pendingGifQuery && !dmGifPreview) {
        setDmGifPreviewError(null);
        requestDmGifPreview(pendingGifQuery);
        return;
      }
      if (
        dmGifPreview &&
        Array.isArray(dmGifPreview.options) &&
        typeof dmGifPreview.selectedIndex === 'number' &&
        dmGifPreview.options[dmGifPreview.selectedIndex]?.attachment
      ) {
        handleDmGifPreviewConfirm();
        return;
      }
      try {
        await sendDirectMessage({
          threadId: selectedDirectThreadId,
          body: hasText ? dmMessageDraft : ATTACHMENT_ONLY_PLACEHOLDER,
          attachments
        });
        setDmMessageDraft('');
        setDmAttachments([]);
        setDmAttachmentStatus(null);
        handleDmGifPreviewCancel();
      } catch {
        // surfaced via send status
      }
    },
    [
      dmAttachments,
      dmGifPreview,
      dmMessageDraft,
      handleDmGifPreviewCancel,
      handleDmGifPreviewConfirm,
      isSendingDirectMessage,
      isUploadingDmAttachment,
      requestDmGifPreview,
      selectedDirectThreadId,
      sendDirectMessage
    ]
  );

  const handleDirectMessageKeyDown = useCallback(
    (event) => {
      const isPlainEnter =
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.nativeEvent?.isComposing;
      if (!isPlainEnter) {
        return;
      }
      event.preventDefault();
      if (isUploadingDmAttachment) {
        setDmAttachmentStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }
      if (dmGifPreviewError) {
        handleDmGifPreviewShuffle();
        return;
      }
      if (isDmGifPreviewLoading) {
        return;
      }
      if (
        dmGifPreview &&
        Array.isArray(dmGifPreview.options) &&
        typeof dmGifPreview.selectedIndex === 'number' &&
        dmGifPreview.options[dmGifPreview.selectedIndex]?.attachment
      ) {
        handleDmGifPreviewConfirm();
        return;
      }
      handleSendDirectMessage(event);
    },
    [
      dmGifPreview,
      dmGifPreviewError,
      handleDmGifPreviewConfirm,
      handleDmGifPreviewShuffle,
      handleSendDirectMessage,
      isDmGifPreviewLoading,
      isUploadingDmAttachment
    ]
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
    if (stripped === ATTACHMENT_ONLY_PLACEHOLDER) {
      return '';
    }
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

  const directViewerId = dmViewer?._id ? String(dmViewer._id) : null;

  const selectedDirectThread = useMemo(() => {
    if (!selectedDirectThreadId) {
      return null;
    }
    return dmThreads.find((thread) => thread.id === selectedDirectThreadId) || null;
  }, [dmThreads, selectedDirectThreadId]);

  const selectedDirectNames = useMemo(
    () => resolveThreadParticipants(selectedDirectThread, directViewerId),
    [selectedDirectThread, directViewerId]
  );

  const directMessageItems = useMemo(() => {
    if (!directThreadDetail || !Array.isArray(directThreadDetail.messages)) {
      return [];
    }
    const sorted = [...directThreadDetail.messages].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
    return sorted.map((message) => {
      const author = message.sender || {};
      const authorId = author.id || author._id || null;
      const body = message.body || '';
      const sanitizedBody = body === ATTACHMENT_ONLY_PLACEHOLDER ? '' : body;
      return {
        _id: message.id || message._id,
        message: sanitizedBody,
        createdAt: message.createdAt,
        authorId,
        author,
        attachments: Array.isArray(message.attachments) ? message.attachments : []
      };
    });
  }, [directThreadDetail]);

  const dmSelectedGifOption = useMemo(() => {
    if (
      !dmGifPreview ||
      !Array.isArray(dmGifPreview.options) ||
      typeof dmGifPreview.selectedIndex !== 'number'
    ) {
      return null;
    }
    return dmGifPreview.options[dmGifPreview.selectedIndex] ?? null;
  }, [dmGifPreview]);

  const dmComposerGifPreview = useMemo(
    () =>
      dmGifPreview
        ? {
            query: dmGifPreview.query,
            attachment: dmSelectedGifOption?.attachment || null,
            sourceUrl: dmSelectedGifOption?.sourceUrl,
            optionsCount: Array.isArray(dmGifPreview.options) ? dmGifPreview.options.length : 0
          }
        : null,
    [dmGifPreview, dmSelectedGifOption]
  );

  const headerChannelLabel = useMemo(() => {
    if (channelTab === 'direct') {
      if (selectedDirectNames.length) {
        return `Direct · ${selectedDirectNames.join(', ')}`;
      }
      return 'Direct messages';
    }
    return selectedRoom ? selectedRoom.name : 'Choose a room';
  }, [channelTab, selectedDirectNames, selectedRoom]);

  useEffect(() => {
    if (channelTab !== 'direct') {
      return;
    }
    if (!directMessageItems.length) {
      return;
    }
    const timer = setTimeout(scrollMessagesToBottom, 75);
    return () => clearTimeout(timer);
  }, [channelTab, directMessageItems.length, scrollMessagesToBottom]);

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
      if (channelTab !== 'rooms') {
        return;
      }
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
    [channelTab, canModerateMessages, getDisplayMessageText, getMessageAuthorId, getMessageKey]
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
      } catch {
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

  const roomMessageBubbles = useMemo(
    () =>
      uniqueMessages.map((message, index) => (
        <MessageBubble
          key={getMessageKey(message, index)}
          msg={
            message.message === ATTACHMENT_ONLY_PLACEHOLDER
              ? { ...message, message: '' }
              : message
          }
          isSelf={Boolean(authUser && message.authorId === authUser.uid)}
          authUser={authUser}
          canModerate={canModerateMessages}
          onModerate={handleOpenModerationForMessage}
        />
      )),
    [authUser, canModerateMessages, getMessageKey, handleOpenModerationForMessage, uniqueMessages]
  );

  const directMessageBubbles = useMemo(
    () =>
      directMessageItems.map((message, index) => (
        <MessageBubble
          key={getMessageKey(message, index)}
          msg={
            message.message === ATTACHMENT_ONLY_PLACEHOLDER
              ? { ...message, message: '' }
              : message
          }
          isSelf={Boolean(directViewerId && message.authorId && directViewerId === message.authorId)}
          authUser={authUser}
          canModerate={false}
        />
      )),
    [authUser, directMessageItems, directViewerId, getMessageKey]
  );

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

  const DirectListContent = () => {
    if (directMessagesHasAccess === false) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Direct messages are disabled for your account.
          </Typography>
        </Box>
      );
    }

    return (
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
              Direct messages
            </Typography>
            <Chip
              label={dmThreads.length}
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Stack>
          <Tooltip title="Refresh conversations">
            <span>
              <IconButton onClick={refreshDmThreads} disabled={isLoadingDmThreads}>
                {isLoadingDmThreads ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {dmThreadsStatus && dmThreadsStatus.message ? (
          <Box sx={{ p: 2 }}>
            <Alert severity={dmThreadsStatus.type}>{dmThreadsStatus.message}</Alert>
          </Box>
        ) : null}

        {dmThreads.length === 0 && !isLoadingDmThreads ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              You have no conversations yet. Start one from a profile page.
            </Typography>
          </Box>
        ) : null}

        <List dense sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {dmThreads.map((thread) => {
            const isActive = thread.id === selectedDirectThreadId;
            const participantsArray = Array.isArray(thread.participants)
              ? thread.participants
              : [];
            const otherParticipants = participantsArray.filter((participant) => {
              const id = getParticipantId(participant);
              if (!id) {
                return false;
              }
              if (!directViewerId) {
                return true;
              }
              return id !== normalizeObjectId(directViewerId);
            });
            const participantNames = otherParticipants.length
              ? otherParticipants
                  .map((participant) => getParticipantDisplayName(participant) || 'Unknown user')
                  .filter(Boolean)
              : resolveThreadParticipants(thread, directViewerId);
            const displayName = participantNames.length
              ? participantNames.join(', ')
              : 'Direct message';
            const avatarParticipant = otherParticipants[0];
            const avatarSrc = resolveAvatarSrc(avatarParticipant);
            return (
              <ListItemButton
                key={thread.id}
                selected={isActive}
                onClick={() => handleSelectDirectThreadId(thread.id)}
                sx={{ alignItems: 'flex-start', py: 1.5 }}
              >
                <ListItemAvatar>
                  <Avatar src={avatarSrc} alt={displayName} imgProps={{ referrerPolicy: 'no-referrer' }}>
                    {displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" fontWeight={600}>
                      {displayName}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {thread.lastMessageAt
                        ? formatFriendlyTimestamp(thread.lastMessageAt) ||
                          formatRelativeTime(thread.lastMessageAt) ||
                          ''
                        : `${thread.messageCount} messages`}
                    </Typography>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      </>
    );
  };

  const renderRoomMessagesMobile = () => {
    if (!selectedRoom) {
      return (
        <Stack
          spacing={2}
          alignItems="center"
          justifyContent="center"
          sx={{ flexGrow: 1, py: 6, textAlign: 'center', color: 'text.secondary' }}
        >
          <SmsIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h6">Choose a chat room to start talking</Typography>
          <Typography variant="body2">
            Pick a room from the selector in the header or create a new one.
          </Typography>
        </Stack>
      );
    }

    if (messagesError) {
      return (
        <Alert severity="error" sx={{ mx: { xs: 2, md: 4 }, my: 2 }}>
          {messagesError}
        </Alert>
      );
    }

    if (isLoadingMessages && uniqueMessages.length === 0) {
      return (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading messages…
          </Typography>
        </Stack>
      );
    }

    if (uniqueMessages.length === 0) {
      return (
        <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <Typography variant="h6">No messages yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Start the conversation with everyone in this room.
          </Typography>
        </Stack>
      );
    }

    return (
      <>
        {roomMessageBubbles}
        <AttachmentPreview
          attachments={roomAttachments}
          onRemove={handleRemoveRoomAttachment}
          status={roomAttachmentStatus}
          uploading={isUploadingRoomAttachment}
          padding={{ xs: 2, md: 3 }}
        />
        <div ref={messagesEndRef} />
      </>
    );
  };

  const renderDirectMessagesMobile = () => {
    if (directMessagesHasAccess === false) {
      return (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Direct messages are disabled for your account.
          </Typography>
        </Stack>
      );
    }

    if (!selectedDirectThreadId) {
      if (dmThreads.length === 0 && !isLoadingDmThreads) {
        return (
          <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
            <Typography variant="h6">Start a new conversation</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Visit a profile and choose “Message user” to invite them to chat.
            </Typography>
          </Stack>
        );
      }
      if (isLoadingDmThreads) {
        return (
          <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading conversations…
            </Typography>
          </Stack>
        );
      }
      return (
        <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <Typography variant="h6">Select a direct message</Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Open the channel picker above and choose a conversation.
          </Typography>
        </Stack>
      );
    }

    if (directThreadStatus && directThreadStatus.message) {
      return (
        <Alert severity={directThreadStatus.type} sx={{ mx: { xs: 2, md: 4 }, my: 2 }}>
          {directThreadStatus.message}
        </Alert>
      );
    }

    if (isLoadingDirectThread && directMessageItems.length === 0) {
      return (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading messages…
          </Typography>
        </Stack>
      );
    }

    if (directMessageItems.length === 0) {
      return (
        <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <Typography variant="h6">Say hello</Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Send the first message to keep the conversation going.
          </Typography>
        </Stack>
      );
    }

    return (
      <>
        {directMessageBubbles}
        <AttachmentPreview
          attachments={dmAttachments}
          onRemove={handleRemoveDmAttachment}
          status={dmAttachmentStatus}
          uploading={isUploadingDmAttachment}
          padding={{ xs: 2, md: 3 }}
        />
        <div ref={messagesEndRef} />
      </>
    );
  };

  return (
    <>
      <Box
        className="chat-page"
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

            <h1 className="chat-header-title">
              Chat
            </h1>
            <div className="chat-header-actions">
              <Chip
                className="chat-room-chip"
                icon={
                  channelTab === 'direct' ? (
                    <MarkUnreadChatAltIcon fontSize="small" />
                  ) : (
                    <GroupIcon fontSize="small" />
                  )
                }
                label={headerChannelLabel}
                onClick={handleOpenChannelDialog}
                variant="outlined"
                color={channelTab === 'direct' ? 'secondary' : 'primary'}
                aria-label="Choose channel"
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
            {channelTab === 'direct' ? renderDirectMessagesMobile() : renderRoomMessagesMobile()}
          </Box>

          {channelTab === 'direct' ? (
            <>
              <ChatComposer
                variant="modern"
                message={dmMessageDraft}
                placeholder="Send a message"
                onMessageChange={(event) => setDmMessageDraft(event.target.value)}
                onKeyDown={handleDirectMessageKeyDown}
                onSend={handleSendDirectMessage}
                disabled={
                  !selectedDirectThreadId ||
                  isSendingDirectMessage ||
                  directMessagesHasAccess === false ||
                  isUploadingDmAttachment
                }
                sendDisabled={
                  (!dmMessageDraft.trim() && dmAttachments.length === 0) ||
                  !selectedDirectThreadId ||
                  isSendingDirectMessage ||
                  directMessagesHasAccess === false ||
                  isUploadingDmAttachment
                }
                isSending={isSendingDirectMessage}
                containerRef={inputContainerRef}
                containerClassName="chat-input-container"
                onAddAttachment={handleOpenDmAttachmentPicker}
                addAttachmentTooltip="Upload image or GIF"
                gifPreview={dmComposerGifPreview}
                gifPreviewError={dmGifPreviewError}
                isGifPreviewLoading={isDmGifPreviewLoading}
                onGifPreviewConfirm={handleDmGifPreviewConfirm}
                onGifPreviewCancel={handleDmGifPreviewCancel}
                onGifPreviewShuffle={handleDmGifPreviewShuffle}
              />
            </>
          ) : (
            <>
              <ChatComposer
                variant="modern"
                message={messageDraft}
                placeholder="Send a message"
                onMessageChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={handleRoomMessageKeyDown}
                onSend={handleRoomSendMessage}
                disabled={!authUser || isSendingMessage || isUploadingRoomAttachment}
                sendDisabled={
                  (!messageDraft.trim() && roomAttachments.length === 0) ||
                  !authUser ||
                  isSendingMessage ||
                  isUploadingRoomAttachment
                }
                isSending={isSendingMessage}
                containerRef={inputContainerRef}
                containerClassName="chat-input-container"
                onAddAttachment={handleOpenRoomAttachmentPicker}
                addAttachmentTooltip="Upload image or GIF"
                gifPreview={composerGifPreview}
                gifPreviewError={gifPreviewError}
                isGifPreviewLoading={isGifPreviewLoading}
                onGifPreviewConfirm={handleGifPreviewConfirm}
                onGifPreviewCancel={handleGifPreviewCancel}
                onGifPreviewShuffle={handleGifPreviewShuffle}
              />
            </>
          )}

          {presenceError ? (
            <Box sx={{ px: 2, py: 1 }}>
              <Alert severity="error">{presenceError}</Alert>
            </Box>
          ) : null}

          <Snackbar
            open={channelTab === 'direct' && Boolean(directSendStatus)}
            autoHideDuration={4000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              resetDirectSendStatus();
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ bottom: `${scrollBtnBottom + 16}px` }}
          >
            {directSendStatus ? (
              <Alert
                elevation={6}
                variant="filled"
                severity={directSendStatus.type}
                onClose={resetDirectSendStatus}
              >
                {directSendStatus.message}
              </Alert>
            ) : null}
          </Snackbar>

      <Navbar />
    </div>
  </Box>

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

      <Dialog
        open={isChannelDialogOpen}
        onClose={() => setIsChannelDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Choose a conversation</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Tabs
            value={channelDialogTab}
            onChange={handleChannelDialogTabChange}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab
              value="rooms"
              label="Rooms"
              icon={<GroupIcon fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              value="direct"
              label="Direct messages"
              icon={<MarkUnreadChatAltIcon fontSize="small" />}
              iconPosition="start"
              disabled={directMessagesHasAccess === false}
            />
          </Tabs>
          <Box sx={{ maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
            {channelDialogTab === 'direct' ? <DirectListContent /> : <RoomListContent />}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsChannelDialogOpen(false)}>Close</Button>
        </DialogActions>
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

      <input
        ref={roomAttachmentInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleRoomAttachmentInputChange}
      />
      <input
        ref={dmAttachmentInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleDmAttachmentInputChange}
      />
    </>
  );
}

export default ChatPage;
