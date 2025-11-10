/* NOTE: Page exports navigation config alongside the component. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  IconButton,
  Avatar,
  List,
  ListItem,
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
  MenuItem,
  Tabs,
  Tab,
  Snackbar
} from '@mui/material';
import FriendRequestIcon from '@mui/icons-material/PersonAddRounded'
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import MessageFriend from '@mui/icons-material/ChatBubbleRounded';
import RemoveFriend from '@mui/icons-material/PersonRemoveRounded'
import ReportFriend from '@mui/icons-material/FlagRounded'
import NoFriendRequests from '@mui/icons-material/GroupOffRounded';
import SmsIcon from '@mui/icons-material/Sms';
import AddCommentIcon from '@mui/icons-material/AddComment';
import RoomIcon from '@mui/icons-material/Room';
import GroupIcon from '@mui/icons-material/Group';
import PublicIcon from '@mui/icons-material/Public';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';

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
import useFriendGraph from '../hooks/useFriendGraph';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import { previewChatGif, createContentReport } from '../api/mongoDataApi';
import { ATTACHMENT_ONLY_PLACEHOLDER, MAX_CHAT_ATTACHMENTS } from '../utils/chatAttachments';
import {
  getParticipantId,
  resolveAvatarSrc,
  resolveThreadParticipants
} from '../utils/chatParticipants';
import normalizeObjectId from '../utils/normalizeObjectId';

import './FriendsPage.css';
import {
  formatFriendlyTimestamp,
  formatAbsoluteDateTime,
  formatRelativeTime
} from '../utils/dates';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

export const pageConfig = {
  id: 'friends',
  label: 'friends',
  icon: SmsIcon,
  path: '/friends',
  aliases: ['/friends-todo'],
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
  const [selectedTab, setSelectedTab] = useState('Friends');
  const socialNotifications = useSocialNotificationsContext();
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
    resetSendStatus: resetDirectSendStatus,
    isCreating: isCreatingDirectThread,
    createThread: createDirectThread
  } = useDirectMessages();

  const {
    graph: friendGraph,
    refresh: refreshFriendGraph,
    isLoading: isLoadingFriends,
    status: friendStatus,
    queueStatus: friendQueueStatus,
    removeFriend: removeFriendRelationship,
    hasAccess: friendHasAccess,
    isProcessing: isProcessingFriendAction
  } = useFriendGraph();

  const [moderationInitAttempted, setModerationInitAttempted] = useState(false);
  const [moderationContext, setModerationContext] = useState(null);
  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });
  const [channelTab, setChannelTab] = useState('rooms');
  const [channelDialogTab, setChannelDialogTab] = useState('rooms');
  const [lastConversationTab, setLastConversationTab] = useState('rooms');
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [friendActionStatus, setFriendActionStatus] = useState(null);
  const [dmMessageDraft, setDmMessageDraft] = useState('');
  const dmGifPreviewRequestRef = useRef(null);
  const [dmGifPreview, setDmGifPreview] = useState(null);
  const [dmGifPreviewError, setDmGifPreviewError] = useState(null);
  const [isDmGifPreviewLoading, setIsDmGifPreviewLoading] = useState(false);

  const incomingRequests = socialNotifications.friendData?.incomingRequests || [];
  const canShowFriendRequests = !socialNotifications.friendAccessDenied;
  const hasFriendRequests = canShowFriendRequests && incomingRequests.length > 0;
  const friendRequestsPreview = incomingRequests.slice(0, 3);
  const remainingFriendRequests = Math.max(0, incomingRequests.length - friendRequestsPreview.length);
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);

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
    return () => clearTimeout();
  }, [channelTab, uniqueMessages.length]);

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
    if (channelTab === 'rooms' || channelTab === 'direct') {
      setLastConversationTab(channelTab);
    }
  }, [channelTab, setLastConversationTab]);

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
    if (channelTab === 'friends') {
      refreshFriendGraph().catch(() => {});
    }
  }, [channelTab, refreshFriendGraph]);

  useEffect(() => {
    if (friendQueueStatus) {
      setFriendActionStatus(friendQueueStatus);
    }
  }, [friendQueueStatus]);

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
    if (tabParam === 'direct') {
      if (directMessagesHasAccess !== false) {
        setChannelTab('direct');
        setChannelDialogTab('direct');
        const threadParam = params.get('thread');
        if (threadParam) {
          selectDirectThread(threadParam);
        }
      } else {
        setChannelTab('rooms');
        setChannelDialogTab('rooms');
      }
      return;
    }

    if (tabParam === 'friends') {
      setChannelTab('friends');
      setChannelDialogTab('friends');
      return;
    }

    setChannelTab('rooms');
    setChannelDialogTab((prev) => (prev === 'direct' ? 'rooms' : prev));
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
  }, [roomAttachmentStatus, setRoomAttachmentStatus]);

  useEffect(() => {
    if (!dmAttachmentStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setDmAttachmentStatus(null);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [dmAttachmentStatus, setDmAttachmentStatus]);

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
    const defaultType =
      typeof moderationContext.defaultAction === 'string'
        ? moderationContext.defaultAction
        : 'warn';
    setModerationForm({
      type: defaultType,
      reason: '',
      durationMinutes:
        defaultType === 'mute'
          ? moderationContext.defaultDurationMinutes || '15'
          : '15'
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

  const handleSelectDirectThreadId = useCallback(
    (threadId) => {
      selectDirectThread(threadId);
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);
    },
    [selectDirectThread]
  );

  const handleActivateFriendsView = useCallback(() => {
    if (channelTab === 'friends') {
      let targetTab = lastConversationTab;
      if (targetTab === 'direct' && directMessagesHasAccess === false) {
        targetTab = 'rooms';
      }
      setChannelTab(targetTab);
      setChannelDialogTab(
        targetTab === 'direct' && directMessagesHasAccess !== false ? 'direct' : 'rooms'
      );
      setIsChannelDialogOpen(false);
      return;
    }
    setChannelTab('friends');
    setChannelDialogTab('friends');
    setIsChannelDialogOpen(false);
  }, [channelTab, directMessagesHasAccess, lastConversationTab, setChannelDialogTab, setChannelTab, setIsChannelDialogOpen]);

  const handleMessageFriend = useCallback(
    async (friend) => {
      const friendId = normalizeObjectId(friend?.id);
      if (!friendId) {
        setFriendActionStatus({ type: 'error', message: 'Unable to open this conversation.' });
        return;
      }
      if (directMessagesHasAccess === false) {
        setFriendActionStatus({
          type: 'error',
          message: 'Direct messages are disabled for your account.'
        });
        return;
      }

      const normalizedFriendId = normalizeObjectId(friendId);
      const existingThread = dmThreads.find((thread) => {
        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        return participants.some(
          (participant) => getParticipantId(participant) === normalizedFriendId
        );
      });

      if (existingThread?.id) {
        navigate(`/chat?tab=direct&thread=${existingThread.id}`);
        setFriendActionStatus({
          type: 'success',
          message: `Opened conversation with ${friend.displayName || friend.username || 'friend'}.`
        });
        return;
      }

      try {
        const result = await createDirectThread({
          participantIds: [normalizedFriendId]
        });
        let newThreadId = result?.thread?.id || '';
        if (!newThreadId) {
          const refreshed = await refreshDmThreads().catch(() => null);
          if (refreshed?.threads) {
            const fallback = refreshed.threads.find((thread) => {
              const participants = Array.isArray(thread.participants) ? thread.participants : [];
              return participants.some(
                (participant) => getParticipantId(participant) === normalizedFriendId
              );
            });
            if (fallback?.id) {
              newThreadId = fallback.id;
            }
          }
        }
        if (newThreadId) {
          navigate(`/chat?tab=direct&thread=${newThreadId}`);
        } else {
          refreshDmThreads().catch(() => {});
        }
        setFriendActionStatus({
          type: 'success',
          message: `Started a conversation with ${friend.displayName || friend.username || 'friend'}.`
        });
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to start conversation.'
        });
      }
    },
    [
      createDirectThread,
      directMessagesHasAccess,
      dmThreads,
      handleSelectDirectThreadId,
      refreshDmThreads,
      setFriendActionStatus
    ]
  );

  const handleUnfriend = useCallback(
    async (friend) => {
      const friendId = normalizeObjectId(friend?.id);
      if (!friendId) {
        setFriendActionStatus({ type: 'error', message: 'Unable to remove this friend.' });
        return;
      }
      try {
        await removeFriendRelationship(friendId);
        setFriendActionStatus({
          type: 'success',
          message: `${friend.displayName || friend.username || 'Friend'} removed.`
        });
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to remove friend.'
        });
      }
    },
    [removeFriendRelationship, setFriendActionStatus]
  );

  const handleReportFriend = useCallback(
    (friend) => {
      const friendId = normalizeObjectId(friend?.id);
      if (!friendId) {
        setFriendActionStatus({ type: 'error', message: 'Unable to report this friend.' });
        return;
      }
      setModerationContext({
        userId: friendId,
        displayName: friend.displayName || friend.username || 'User',
        messagePreview: '',
        messageId: friendId,
        defaultAction: 'report'
      });
    },
    [setFriendActionStatus, setModerationContext]
  );

  const handleOpenChannelDialog = useCallback(() => {
    if (channelTab === 'direct') {
      setChannelDialogTab(directMessagesHasAccess !== false ? 'direct' : 'rooms');
    } else if (channelTab === 'friends') {
      setChannelDialogTab('friends');
    } else {
      setChannelDialogTab('rooms');
    }
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
      resetDmAttachments();
      setDmAttachmentStatus(null);
      handleDmGifPreviewCancel();
      focusComposer(dmComposerInputRef);
    } catch {
      // surfaced via send status
    }
  }, [
    dmGifPreview,
    focusComposer,
    handleDmGifPreviewCancel,
    isDmGifPreviewLoading,
    isSendingDirectMessage,
    resetDmAttachments,
    selectedDirectThreadId,
    sendDirectMessage,
    setDmAttachmentStatus,
    setDmMessageDraft
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
    [
      focusComposer,
      handleSendMessage,
      isUploadingRoomAttachment,
      messageDraft,
      resetRoomAttachments,
      roomAttachments,
      setRoomAttachmentStatus
    ]
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
    [
      focusComposer,
      handleMessageInputKeyDown,
      isUploadingRoomAttachment,
      messageDraft,
      roomAttachments,
      setRoomAttachmentStatus
    ]
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
      focusComposer,
      handleDmGifPreviewCancel,
      handleDmGifPreviewConfirm,
      isSendingDirectMessage,
      isUploadingDmAttachment,
      requestDmGifPreview,
      resetDmAttachments,
      selectedDirectThreadId,
      sendDirectMessage,
      setDmAttachmentStatus,
      setDmMessageDraft
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
      isUploadingDmAttachment,
      setDmAttachmentStatus
    ]
  );

  const notificationsLabel =
    incomingRequests.length > 0 ? `Notifications (${incomingRequests.length} unread)` : 'Notifications';
  const displayBadge = incomingRequests.length > 0 ? (incomingRequests.length > 99 ? '99+' : String(incomingRequests.length)) : null;

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
    if (channelTab === 'friends') {
      return 'Friends list';
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
    return () => clearTimeout(timer);
  }, [channelTab, directMessageItems.length]);

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
          <Typography variant="body2" color="text.primary">
            Loading messages…
          </Typography>
        </Stack>
      );
    }

    if (uniqueMessages.length === 0) {
      return (
        <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <Typography variant="h6">No messages yet</Typography>
          <Typography variant="body2" color="text.primary">
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
          <Typography variant="body2" color="text.primary">
            Loading messages…
          </Typography>
        </Stack>
      );
    }

    if (directMessageItems.length === 0) {
      return (
        <Stack
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          sx={{ flexGrow: 1, py: 6, color: '#111' }}
        >
          <Typography variant="h6" sx={{ color: '#111' }}>
            Say hello
          </Typography>
          <Typography variant="body2" align="center" sx={{ color: '#333' }}>
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

  const renderFriendsList = ({ isOverlay = false } = {}) => {
    const [friendSearchQuery, setFriendSearchQuery] = useState(''); 
    const friends = Array.isArray(friendGraph?.friends) ? friendGraph.friends : [];

    if (friendHasAccess === false) {
      return (
        <Stack
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          sx={{ flexGrow: 1, py: 6, color: isOverlay ? 'inherit' : '#111' }}
        >
          <Typography variant="h6" align="center" sx={!isOverlay ? { color: '#111' } : undefined}>
            Friend access required
          </Typography>
          <Typography
            variant="body2"
            align="center"
            sx={!isOverlay ? { color: '#555' } : undefined}
          >
            You need additional privileges to view or manage friends.
          </Typography>
        </Stack>
      );
    }

    if (isLoadingFriends && friends.length === 0) {
      return (
        <Stack
          spacing={2}
          alignItems="center"
          justifyContent="center"
          sx={{ flexGrow: 1, py: 6, color: isOverlay ? 'inherit' : '#111' }}
        >
          <CircularProgress />
          <Typography variant="body2" sx={!isOverlay ? { color: '#111' } : undefined}>
            Loading friends…
          </Typography>
        </Stack>
      );
    }

    const filteredFriends = friends.filter((friend) => {
      const name = (friend.displayName || friend.username || '').toLowerCase();
      return name.includes(friendSearchQuery.toLowerCase());
    });

    return (
      <Box
        className="friends-list"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          color: isOverlay ? 'inherit' : '#111',
        }}
      >
        <Box
          className="friends-list-header"
          sx={{
            px: 2,
            py: 1.5,
          }}
        >
          <IconButton 
              onClick={() => navigate(-1)} 
              className="friends-list-back-btn"
            >
              <ArrowBackIcon className="friend-header-back-icon" />
            </IconButton>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography className="friends-list-title">
              Friends — {friends.length} 
            </Typography>
          </Stack>

          <Button
            className="friend-request-btn"
            type="button"
            aria-label={notificationsLabel}
            onClick={handleOpenFriendDialog}
            disabled={isLoadingFriends || isProcessingFriendAction}
          >
            <FriendRequestIcon className="friend-request-icon" aria-hidden="true"/>
            {displayBadge ? (
              <span className="friend-request-icon-badge" aria-hidden="true">
                {displayBadge}
              </span>
            ) : null}
          </Button>
                    
        </Box>

        <Box className="friends-list-search-bar">
          <TextField
            className="friends-list-search-bar-input-container"
            fullWidth
            size="small"
            placeholder="Search friends..."
            value={friendSearchQuery}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 30) {
                setFriendSearchQuery(value);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon className="friends-search-icon" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {friendStatus && friendStatus.message ? (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Alert severity={friendStatus.type || 'error'}>{friendStatus.message}</Alert>
          </Box>
        ) : null}

        {friends.length === 0 && !isLoadingFriends ? (
          <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{ flexGrow: 1, py: 6, color: isOverlay ? 'inherit' : '#111' }}
          >
            <Typography variant="h6" sx={!isOverlay ? { color: '#111' } : undefined}>
              No friends yet
            </Typography>
            <Typography
              variant="body2"
              align="center"
              sx={!isOverlay ? { color: '#555' } : undefined}
            >
              Add some friends to start direct conversations and plan meetups.
            </Typography>
          </Stack>
        ) : null}

        {/* Handling for if no names match the search query */}
        {!isLoadingFriends && friends.length > 0 && filteredFriends.length === 0 && (
          <Typography className="friends-search-none-text">
            No friends match your search.
          </Typography>
        )}

        {/* Friend list */}
        {filteredFriends.length ? (
          <List dense sx={{ flexGrow: 1, overflowY: 'auto', px: { xs: 1, sm: 2 } }}>
            {filteredFriends.map((friend) => {
              const displayName = friend.displayName || friend.username || 'Friend';
              const secondaryLabel = friend.username ? `@${friend.username}` : '';
              const avatarSrc = resolveAvatarSrc(friend);

              return (
                <ListItem
                  className="friend-card"
                  key={friend.id}
                  sx={{
                    py: 1.5,
                    px: { xs: 1, sm: 0 },
                    gap: { xs: 1.5, sm: 2 },
                    color: isOverlay ? 'inherit' : '#111',
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                      backgroundColor: (theme) => theme.palette.action.hover,
                      '& .friend-actions': {
                        opacity: 1,
                        visibility: 'visible',
                      },
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      className="friends-list-friend-avatar"
                      src={avatarSrc}
                      alt={displayName}
                      imgProps={{ referrerPolicy: 'no-referrer' }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText 
                    className="friends-list-name-container"
                    primary={
                      <Box className="friends-list-name-wrapper">
                        <Typography className="friends-list-display-name">
                          {displayName}
                        </Typography>
                        {secondaryLabel && (
                          <Typography className="friends-list-user-name">
                            {secondaryLabel}
                          </Typography>
                        )}
                      </Box>
                    }
                  />

                  <Box className="friend-actions-container">
                    <Box className="message-friend-container">
                      <MessageFriend
                        className="message-friend-icon"
                        onClick={() => handleMessageFriend(friend)}
                        disabled={
                          directMessagesHasAccess === false ||
                          isProcessingFriendAction ||
                          isCreatingDirectThread
                        }
                      />
                    </Box>
                    
                    <Box className="remove-friend-container">
                      <RemoveFriend
                        className="remove-friend-icon"
                        onClick={() => handleUnfriend(friend)}
                        disabled={isProcessingFriendAction}
                      />
                    </Box>

                    <Box className="report-friend-container">
                      <ReportFriend
                        className="report-friend-icon"
                        onClick={() => handleReportFriend(friend)}
                      />
                    </Box>
                    
                  </Box>
                </ListItem>
              );
            })}
          </List>
        ) : null}
      </Box>
    );
  };

  const handleOpenFriendDialog = () => {
    setFriendActionStatus(null);
    setIsFriendDialogOpen(true);
  };

  const handleCloseFriendDialog = () => {
    if (respondingRequestId) {
      return;
    }
    setIsFriendDialogOpen(false);
  };


  const handleRespondToFriendRequest = async (requestId, decision) => {
    if (!requestId || !decision || typeof socialNotifications.respondToFriendRequest !== 'function') {
      return;
    }
    setRespondingRequestId(requestId);
    setFriendActionStatus(null);
    try {
      await socialNotifications.respondToFriendRequest({ requestId, decision });
      setFriendActionStatus({
        type: 'success',
        message: decision === 'accept' ? 'Friend request accepted.' : 'Friend request declined.'
      });
      await socialNotifications.refreshAll();
    } catch (error) {
      setFriendActionStatus({
        type: 'error',
        message: error?.message || 'Failed to update friend request.'
      });
    } finally {
      setRespondingRequestId(null);
    }
  };

  const friendsView = renderFriendsList();

  return (
    <>
      <Box className="friend-page">
        <div className="friend-frame">
          <Box ref={containerRef} className="friends-list-field">
            {friendsView}
          </Box>

          {channelTab === 'rooms' && presenceError ? (
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
            open={reportStatus}
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
            {reportStatus && (
              <Alert
                elevation={6}
                variant="filled"
                severity={reportStatus.type}
                onClose={handleReportStatusClose}
              >
                {reportStatus.message}
              </Alert>
            )}
          </Snackbar>

          <Snackbar
            open={channelTab === 'direct' && directSendStatus}
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
            {directSendStatus && (
              <Alert
                elevation={6}
                variant="filled"
                severity={directSendStatus.type}
                onClose={resetDirectSendStatus}
              >
                {directSendStatus.message}
              </Alert>
            )}
          </Snackbar>

          <Snackbar
            open={friendActionStatus}
            autoHideDuration={4000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              setFriendActionStatus(null);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ bottom: `${scrollBtnBottom + 40}px` }}
          >
            {friendActionStatus && (
              <Alert
                elevation={6}
                variant="filled"
                severity={friendActionStatus.type || 'info'}
                onClose={() => setFriendActionStatus(null)}
              >
                {friendActionStatus.message}
              </Alert>
            )}
          </Snackbar>

    </div>
  </Box>

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

      <Dialog
        className="friend-dialog-overlay"
        open={isFriendDialogOpen}
        onClose={handleCloseFriendDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle className="friend-dialog-title">
          Pending Friend Requests
        </DialogTitle>

        <DialogContent dividers={false} className="friend-dialog-content">
          <Stack spacing={2}>
            {friendActionStatus && (
              <Alert severity={friendActionStatus.type} className="friend-dialog-alert">
                {friendActionStatus.message}
              </Alert>
            )}

            {incomingRequests.length === 0 ? (
              <Box className="friend-dialog-empty-container">
                <NoFriendRequests className="friend-dialog-empty-icon"/>
                <Typography className="friend-dialog-empty-desc">
                  All caught up! You have no pending friend requests.
                </Typography>
              </Box>
            ) : (
              incomingRequests.map((request) => {
                const requesterName =
                  request.requester?.displayName ||
                  request.requester?.username ||
                  request.requester?.id ||
                  'Unknown user';
                const isUpdating = respondingRequestId === request.id;

                return (
                  <Paper key={request.id} className="friend-dialog-request-card">
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" className="friend-dialog-request-name">
                          {requesterName}
                        </Typography>
                        <Typography variant="caption" className="friend-dialog-request-time">
                          {request.createdAt ? formatFriendlyTimestamp(request.createdAt) : ''}
                        </Typography>
                      </Stack>

                      {request.message && (
                        <Typography variant="body2" className="friend-dialog-request-message">
                          “{request.message}”
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          variant="contained"
                          className="friend-dialog-accept-btn"
                          onClick={() => handleRespondToFriendRequest(request.id, 'accept')}
                          disabled={isUpdating}
                        >
                          {isUpdating ? 'Updating…' : 'Accept'}
                        </Button>

                        <Button
                          variant="outlined"
                          className="friend-dialog-decline-btn"
                          onClick={() => handleRespondToFriendRequest(request.id, 'decline')}
                          disabled={isUpdating}
                        >
                          Decline
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })
            )}
          </Stack>
        </DialogContent>

        <DialogActions className="friend-dialog-actions-container">
          <Button
            className="friend-dialog-close-btn"
            onClick={handleCloseFriendDialog}
            disabled={respondingRequestId !== null}
          >
            Close
          </Button>
        </DialogActions>
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
