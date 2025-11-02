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
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';

import Navbar from '../components/Navbar';
import GlobalNavMenu from '../components/GlobalNavMenu';
import MessageBubble from '../components/MessageBubble';
import ChatComposer from '../components/ChatComposer';
import ReportContentDialog from '../components/ReportContentDialog';
import DirectThreadList from '../components/chat/DirectThreadList';
import useDirectMessages from '../hooks/useDirectMessages';
import useAttachmentManager, {
  mapDraftAttachmentPayloads,
  sanitizeAttachmentOnlyMessage
} from '../hooks/useAttachmentManager';

import { auth } from '../firebase';
import useChatManager from '../hooks/useChatManager';
import useModerationTools from '../hooks/useModerationTools';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { formatFriendlyTimestamp, formatRelativeTime } from '../utils/dates';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import { previewChatGif, createContentReport } from '../api/mongoDataApi';
import { ATTACHMENT_ONLY_PLACEHOLDER, MAX_CHAT_ATTACHMENTS } from '../utils/chatAttachments';
import {
  getParticipantId,
  getParticipantDisplayName,
  resolveAvatarSrc,
  resolveThreadParticipants
} from '../utils/chatParticipants';
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

function AttachmentPreview({
  attachments,
  onRemove,
  status,
  isUploading,
  uploadProgress,
  onRetry,
  canRetry,
  padding
}) {
  if (!attachments.length && !status && !isUploading) {
    return null;
  }

  const progressLabel = (() => {
    if (!uploadProgress || typeof uploadProgress.total !== 'number' || uploadProgress.total <= 0) {
      return 'Uploading…';
    }
    const completed = Math.min(uploadProgress.completed || 0, uploadProgress.total);
    return `Uploading ${completed}/${uploadProgress.total}…`;
  })();

  return (
    <>
      {status ? (
        <Box sx={{ px: padding, pb: 1 }}>
          <Alert
            severity={status.type}
            action={
              status.type === 'error' && typeof onRetry === 'function' && canRetry ? (
                <Button color="inherit" size="small" onClick={onRetry}>
                  Retry
                </Button>
              ) : null
            }
          >
            {status.message}
          </Alert>
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
      {isUploading ? (
        <Box sx={{ px: padding, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {progressLabel}
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
  isUploading: false,
  uploadProgress: null,
  onRetry: undefined,
  canRetry: false,
  padding: { xs: 2, md: 3 }
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
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [dmMessageDraft, setDmMessageDraft] = useState('');
  const dmGifPreviewRequestRef = useRef(null);
  const [dmGifPreview, setDmGifPreview] = useState(null);
  const [dmGifPreviewError, setDmGifPreviewError] = useState(null);
  const [isDmGifPreviewLoading, setIsDmGifPreviewLoading] = useState(false);

  const {
    attachments: roomAttachments,
    status: roomAttachmentStatus,
    setStatus: setRoomAttachmentStatus,
    isUploading: isUploadingRoomAttachment,
    uploadProgress: roomUploadProgress,
    canRetry: canRetryRoomUploads,
    handleFiles: processRoomAttachmentFiles,
    retryFailed: retryRoomFailedUploads,
    removeAttachment: removeRoomAttachment,
    reset: resetRoomAttachments,
    canAttachMore: canAttachMoreRoom
  } = useAttachmentManager();

  const {
    attachments: dmAttachments,
    status: dmAttachmentStatus,
    setStatus: setDmAttachmentStatus,
    isUploading: isUploadingDmAttachment,
    uploadProgress: dmUploadProgress,
    canRetry: canRetryDmUploads,
    handleFiles: processDmAttachmentFiles,
    retryFailed: retryDmFailedUploads,
    removeAttachment: removeDmAttachment,
    reset: resetDmAttachments,
    canAttachMore: canAttachMoreDm
  } = useAttachmentManager();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollBtnBottom, setScrollBtnBottom] = useState(0);
  const containerRef = useRef(null);
  const inputContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const roomAttachmentInputRef = useRef(null);
  const dmAttachmentInputRef = useRef(null);
  const roomComposerInputRef = useRef(null);
  const dmComposerInputRef = useRef(null);

  const focusComposer = useCallback((targetRef) => {
    if (!targetRef || !targetRef.current) {
      return;
    }
    const focusNode = () => {
      const node = targetRef.current;
      if (node && typeof node.focus === 'function') {
        node.focus();
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => focusNode());
    } else {
      setTimeout(focusNode, 0);
    }
  }, []);

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
    resetRoomAttachments();
  }, [resetRoomAttachments, selectedRoomId]);

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
    resetDmAttachments();
  }, [resetDmAttachments, selectedDirectThreadId]);

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
      focusComposer(dmComposerInputRef);
    } catch {
      // surfaced via send status
    }
  }, [
    dmGifPreview,
    handleDmGifPreviewCancel,
    isDmGifPreviewLoading,
    isSendingDirectMessage,
    selectedDirectThreadId,
    sendDirectMessage,
    focusComposer
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
    if (!canAttachMoreRoom) {
      setRoomAttachmentStatus({
        type: 'error',
        message: `You can attach up to ${MAX_CHAT_ATTACHMENTS} images per message.`
      });
      return;
    }
    roomAttachmentInputRef.current?.click();
  }, [canAttachMoreRoom, isOffline, selectedRoomId, setRoomAttachmentStatus]);

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
    if (!canAttachMoreDm) {
      setDmAttachmentStatus({
        type: 'error',
        message: `You can attach up to ${MAX_CHAT_ATTACHMENTS} images per message.`
      });
      return;
    }
    dmAttachmentInputRef.current?.click();
  }, [
    canAttachMoreDm,
    directMessagesHasAccess,
    isOffline,
    selectedDirectThreadId,
    setDmAttachmentStatus
  ]);

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
      if (!selectedRoomId) {
        setRoomAttachmentStatus({ type: 'error', message: 'Select a room before uploading images.' });
        return;
      }

      await processRoomAttachmentFiles(fileList);
    },
    [isOffline, processRoomAttachmentFiles, selectedRoomId, setRoomAttachmentStatus]
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
      if (!selectedDirectThreadId) {
        setDmAttachmentStatus({ type: 'error', message: 'Select a conversation before uploading images.' });
        return;
      }

      await processDmAttachmentFiles(fileList);
    },
    [
      directMessagesHasAccess,
      isOffline,
      processDmAttachmentFiles,
      selectedDirectThreadId,
      setDmAttachmentStatus
    ]
  );

  const handleRoomSendMessage = useCallback(
    async (event) => {
      if (isUploadingRoomAttachment) {
        event.preventDefault();
        setRoomAttachmentStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }
      const attachments = mapDraftAttachmentPayloads(roomAttachments);
      const hasText = messageDraft.trim().length > 0;
      const options = {
        attachments,
        messageOverride: hasText || attachments.length === 0 ? undefined : ATTACHMENT_ONLY_PLACEHOLDER
      };
      const sent = await handleSendMessage(event, options);
      if (sent) {
        resetRoomAttachments();
        focusComposer(roomComposerInputRef);
      }
    },
    [focusComposer, handleSendMessage, isUploadingRoomAttachment, messageDraft, resetRoomAttachments, roomAttachments]
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

      const attachments = mapDraftAttachmentPayloads(roomAttachments);
      const result = handleMessageInputKeyDown(event, {
        attachments,
        messageOverride:
          messageDraft.trim().length > 0 || attachments.length === 0
            ? undefined
            : ATTACHMENT_ONLY_PLACEHOLDER
      });
      Promise.resolve(result)
        .catch(() => {})
        .finally(() => focusComposer(roomComposerInputRef));
    },
    [focusComposer, handleMessageInputKeyDown, isUploadingRoomAttachment, messageDraft, roomAttachments]
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
      const attachments = mapDraftAttachmentPayloads(dmAttachments);
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
        resetDmAttachments();
        handleDmGifPreviewCancel();
        focusComposer(dmComposerInputRef);
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
      resetDmAttachments,
      selectedDirectThreadId,
      sendDirectMessage,
      focusComposer
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
    const base = sanitizeAttachmentOnlyMessage(msg.message, msg.attachments);
    if (!Array.isArray(msg.attachments) || msg.attachments.length === 0) {
      return base;
    }
    return base.replace(/^GIF:\s*/i, '').trim();
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

  const getMessageIdForReport = useCallback((message) => {
    if (!message) {
      return null;
    }
    const candidates = [message._id, message.id, message.messageId, message?._id?.$oid, message?.id?.$oid];
    for (const candidate of candidates) {
      const normalized = normalizeObjectId(candidate);
      if (normalized) {
        return normalized;
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    if (typeof message?.messageId === 'string' && message.messageId.trim()) {
      return message.messageId.trim();
    }
    return null;
  }, []);

  const getMessageReportSummary = useCallback((message) => {
    if (!message) {
      return '';
    }
    const text = getDisplayMessageText(message);
    if (text) {
      return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
    }
    if (Array.isArray(message?.attachments) && message.attachments.length > 0) {
      return 'Attachment shared';
    }
    return 'Message';
  }, [getDisplayMessageText]);

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
      const sanitizedBody = sanitizeAttachmentOnlyMessage(body, message.attachments);
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

  const handleOpenReportForRoomMessage = useCallback(
    (message) => {
      const messageId = getMessageIdForReport(message);
      if (!messageId) {
        setReportStatus({ type: 'error', message: 'Unable to report this message.' });
        return;
      }
      const summary = getMessageReportSummary(message);
      const contextLabel = selectedRoom
        ? `Room: ${selectedRoom.name || 'Unnamed room'}`
        : 'Proximity chat';
      setReportTarget({
        contentType: 'chat-message',
        contentId: messageId,
        summary,
        context: contextLabel
      });
      setReportReason('');
      setReportError(null);
      setReportDialogOpen(true);
    },
    [getMessageIdForReport, getMessageReportSummary, selectedRoom]
  );

  const handleOpenReportForDirectMessage = useCallback(
    (message) => {
      const messageId = getMessageIdForReport(message);
      if (!messageId) {
        setReportStatus({ type: 'error', message: 'Unable to report this message.' });
        return;
      }
      const summary = getMessageReportSummary(message);
      const contextLabel = selectedDirectNames.length
        ? `Direct thread with ${selectedDirectNames.join(', ')}`
        : 'Direct message thread';
      setReportTarget({
        contentType: 'direct-message',
        contentId: messageId,
        summary,
        context: contextLabel,
        threadId: selectedDirectThreadId
      });
      setReportReason('');
      setReportError(null);
      setReportDialogOpen(true);
    },
    [getMessageIdForReport, getMessageReportSummary, selectedDirectNames, selectedDirectThreadId]
  );

  const handleCloseReportDialog = useCallback(() => {
    if (isSubmittingReport) {
      return;
    }
    setReportDialogOpen(false);
    setReportTarget(null);
    setReportReason('');
    setReportError(null);
  }, [isSubmittingReport]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportTarget?.contentType || !reportTarget?.contentId) {
      setReportError('Unable to submit this report.');
      return;
    }
    if (isSubmittingReport) {
      return;
    }
    setIsSubmittingReport(true);
    setReportError(null);
    try {
      await createContentReport({
        contentType: reportTarget.contentType,
        contentId: reportTarget.contentId,
        reason: reportReason.trim(),
        context: reportTarget.context || ''
      });
      setReportDialogOpen(false);
      setReportTarget(null);
      setReportReason('');
      setReportStatus({
        type: 'success',
        message: 'Thanks for the report. Our moderators will review it shortly.'
      });
    } catch (error) {
      setReportError(error?.message || 'Failed to submit report. Please try again later.');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportTarget, reportReason, isSubmittingReport]);

  const handleReportStatusClose = useCallback(() => {
    setReportStatus(null);
  }, []);

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
          onReport={handleOpenReportForRoomMessage}
        />
      )),
    [authUser, canModerateMessages, getMessageKey, handleOpenModerationForMessage, handleOpenReportForRoomMessage, uniqueMessages]
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
          onReport={handleOpenReportForDirectMessage}
        />
      )),
    [authUser, directMessageItems, directViewerId, getMessageKey, handleOpenReportForDirectMessage]
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
          onRemove={removeRoomAttachment}
          status={roomAttachmentStatus}
          isUploading={isUploadingRoomAttachment}
          uploadProgress={roomUploadProgress}
          onRetry={retryRoomFailedUploads}
          canRetry={canRetryRoomUploads}
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
          onRemove={removeDmAttachment}
          status={dmAttachmentStatus}
          isUploading={isUploadingDmAttachment}
          uploadProgress={dmUploadProgress}
          onRetry={retryDmFailedUploads}
          canRetry={canRetryDmUploads}
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
                inputRef={dmComposerInputRef}
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
                inputRef={roomComposerInputRef}
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

          <ReportContentDialog
            open={reportDialogOpen}
            onClose={handleCloseReportDialog}
            onSubmit={handleSubmitReport}
            reason={reportReason}
            onReasonChange={setReportReason}
            submitting={isSubmittingReport}
            error={reportError}
            contentSummary={reportTarget?.summary || ''}
            context={reportTarget?.context || ''}
          />

          <Snackbar
            open={Boolean(reportStatus)}
            autoHideDuration={4000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              handleReportStatusClose();
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ bottom: `${scrollBtnBottom + 72}px` }}
          >
            {reportStatus ? (
              <Alert
                elevation={6}
                variant="filled"
                severity={reportStatus.type}
                onClose={handleReportStatusClose}
              >
                {reportStatus.message}
              </Alert>
            ) : null}
          </Snackbar>

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
            {channelDialogTab === 'direct' ? (
              <DirectThreadList
                threads={dmThreads}
                selectedThreadId={selectedDirectThreadId}
                onSelectThread={handleSelectDirectThreadId}
                status={dmThreadsStatus}
                isLoading={isLoadingDmThreads}
                onRefresh={refreshDmThreads}
                canAccess={directMessagesHasAccess !== false}
                viewerId={directViewerId}
              />
            ) : (
              <RoomListContent />
            )}
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
