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
import AttachmentPreview from '../components/chat/AttachmentPreview';
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
  const {
    channelTab,
    channelDialogTab,
    setChannelDialogTab,
    toggleChannelTab
  } = useChatTabs({
    locationSearch: location.search,
    directMessagesHasAccess,
    selectDirectThread,
    refreshDmThreads,
    refreshFriendGraph,
    setLastConversationTab
  });
  const [lastConversationTab, setLastConversationTab] = useState('rooms');
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSelectedOffenses, setReportSelectedOffenses] = useState([]);
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [friendActionStatus, setFriendActionStatus] = useState(null);
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

  const handleNotifications = useCallback(() => {
    navigate('/updates');
  }, [navigate]);

  const handleChooseRoom = useCallback(
    (roomId) => {
      handleSelectRoom(roomId);
      selectDirectThread(null); // clears DM selection
      setChannelTab('rooms');
      setChannelDialogTab('rooms');
      setIsChannelDialogOpen(false);
    },
    [handleSelectRoom, selectDirectThread]
  );

  const handleSelectDirectThreadId = useCallback(
    (threadId) => {
      selectDirectThread(threadId);
      handleSelectRoom(null); // clears room selection
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);
    },
    [selectDirectThread, handleSelectRoom]
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
        handleSelectDirectThreadId(existingThread.id);
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
          handleSelectDirectThreadId(newThreadId);
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
      setReportSelectedOffenses([]);
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
      setReportSelectedOffenses([]);
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
    setReportSelectedOffenses([]);
    setReportError(null);
  }, [isSubmittingReport]);

  const handleToggleReportOffense = useCallback((offense, checked) => {
    if (typeof offense !== 'string') {
      return;
    }
    setReportSelectedOffenses((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(offense);
      } else {
        next.delete(offense);
      }
      return Array.from(next);
    });
  }, []);

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
        context: reportTarget.context || '',
        offenses: reportSelectedOffenses
      });
      setReportDialogOpen(false);
      setReportTarget(null);
      setReportReason('');
      setReportSelectedOffenses([]);
      setReportStatus({
        type: 'success',
        message: 'Thanks for the report. Our moderators will review it shortly.'
      });
    } catch (error) {
      setReportError(error?.message || 'Failed to submit report. Please try again later.');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportSelectedOffenses, reportTarget, reportReason, isSubmittingReport]);

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
  <Box className="room-list-container">
    <Box className="room-list-header">
      <Typography className="room-list-title">
        Select a room below
      </Typography>

      <Box className="room-list-header-action-btns">
        <IconButton
          onClick={loadRooms}
          disabled={isLoadingRooms}
          className="room-refresh-btn"
        >
          {isLoadingRooms ? (
              <CircularProgress size={18} />
            ) : (
              <RefreshIcon sx={{ fontSize: 18, color: '#5C48A8' }} />
            )}
        </IconButton>

        <IconButton
          onClick={handleOpenCreateDialog}
          className="room-create-btn"
        >
          <AddCommentIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>

    {roomsError ? (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{roomsError}</Alert>
      </Box>
    ) : rooms.length === 0 ? (
      <Stack
        sx={{ flexGrow: 1, py: 6, alignItems: 'center', justifyContent: 'center' }}
        spacing={1}
      >
        <Typography variant="body2" color="text.secondary">
          {isLoadingRooms ? 'Loading rooms...' : 'No rooms yet. Create one to get started!'}
        </Typography>
      </Stack>
    ) : (
      <List className="room-list">
        {rooms.map((room) => {
          const isActive = room._id === selectedRoomId;
          const participantLabel = room.participantCount
            ? `${room.participantCount} members`
            : 'No members yet';

          return (
            <ListItemButton
              className="room-card"
              key={room._id}
              onClick={() => handleChooseRoom(room._id)}
              selected={isActive}
              sx={{
                transition: 'background-color 0.2s ease',
                backgroundColor: isActive ? '#d9f2ffff !important' : 'white',
              }}
            >
              <ListItemText
                primary={
                  <Box className="room-card-header">
                    <Box className="room-card-header-left">
                      <Typography
                        className="room-card-room-title"
                        variant="subtitle2"
                      >
                        {room.name}
                      </Typography>

                      <Chip
                        className="room-card-globality-chip"
                        label={room.isGlobal ? 'Global' : 'Local'}
                        size="small"
                      />
                    </Box>

                    <IconButton
                      className="room-card-pin-icon"
                      edge="end"
                      size="small"
                    >
                      {room.isGlobal ? (
                        <PublicIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <RoomIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </Box>
                }
                secondary={
                  <span className="room-card-bottom">
                    <Typography 
                      component="span"
                      className="room-card-member-count" 
                      variant="caption"
                    >
                      {participantLabel}
                    </Typography>
                    {isActive && (
                      <Typography 
                        component="span"
                        className="room-card-joined-label"
                        variant="caption"
                      >
                        Joined
                      </Typography>
                    )}
                  </span>
                }
              />
            </ListItemButton>
          );
        })}
      </List>
    )}
  </Box>
);


  const renderRoomMessagesMobile = () => {
    if (!selectedRoom) {
      return (
        <Box className="no-room-selected-container">
          <SmsIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography
            className="no-room-selected-title" 
            variant="h6"
          >
            Choose a chat room to start talking
          </Typography>
          <Typography 
            className="no-room-selected-body"
            variant="body2" 
          >
            Pick a room from the selector in the header or create a new one.
          </Typography>
        </Box>
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
        <Box className="loading-msgs-container">
          <CircularProgress className="loading-msgs-circle"/>
          <Typography 
            className="loading-msgs-body"
            variant="body2" 
          >
            Loading messages…
          </Typography>
        </Box>
      );
    }

    if (uniqueMessages.length === 0) {
      return (
        <Box className="empty-msgs-container">
          <Typography
            className="empty-msgs-title" 
            variant="h6"
          >
            No messages yet
          </Typography>
          <Typography 
            className="empty-msgs-body"
            variant="body2" 
          >
            Start the conversation with everyone in this room.
          </Typography>
        </Box>
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
        <Box className="disabled-dms-container">
          <Typography className="disabled-dms-body" variant="body2" color="text.secondary" align="center">
            Direct messages are disabled for your account.
          </Typography>
        </Box>
      );
    }

    if (!selectedDirectThreadId) {
      if (dmThreads.length === 0 && !isLoadingDmThreads) {
        return (
          <Box className="no-dm-selected-container">
            <Typography className="no-dm-selected-title" variant="h6" >
              Start a new conversation
            </Typography>

            <Typography className="no-dm-selected-body" variant="body2" color="text.secondary" align="center">
              Visit a profile and choose “Message user” to invite them to chat.
            </Typography>
          </Box>
        );
      }
      if (isLoadingDmThreads) {
        return (
          <Box className="loading-dms-container">
          <CircularProgress className="loading-dms-circle"/>
          <Typography 
            className="loading-dms-body"
            variant="body2" 
          >
            Loading messages…
          </Typography>
        </Box>
        );
      }
      return (
        <Box className="select-dms-container">
          <Typography 
            className="select-dms-title"
            variant="h6" 
          >
            Select a direct message
          </Typography>

          <Typography 
            className="select-dms-body"
            variant="body2" 
          >
            Open the channel picker above and choose a conversation.
          </Typography>
        </Box>
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
        <Box className="loading-dms-container">
          <CircularProgress className="loading-dms-circle"/>
          <Typography 
            className="loading-dms-body"
            variant="body2" 
          >
            Loading messages…
          </Typography>
        </Box>
      );
    }

    if (directMessageItems.length === 0) {
      return (
        <Box className="empty-dms-container">
          <Typography className="empty-dms-title" variant="h6" >
            Start a new conversation
          </Typography>

          <Typography className="empty-dms-body" variant="body2" color="text.secondary" align="center">
            Visit a profile and choose “Message user” to invite them to chat.
          </Typography>
        </Box>
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

    const friends = Array.isArray(friendGraph?.friends) ? friendGraph.friends : [];

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

    return (
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          color: isOverlay ? 'inherit' : '#111'
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
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={!isOverlay ? { color: '#111' } : undefined}
            >
              Friends
            </Typography>
            <Chip label={friends.length} size="small" color="primary" variant="outlined" />
          </Stack>
          <Tooltip title="Refresh friends">
            <span>
              <IconButton
                onClick={refreshFriendGraph}
                disabled={isLoadingFriends || isProcessingFriendAction}
                color="primary"
                sx={{
                  '&.Mui-disabled': {
                    color: (theme) => theme.palette.action.disabled
                  }
                }}
              >
                {isLoadingFriends ? (
                  <CircularProgress size={20} color="primary" />
                ) : (
                  <RefreshIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
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

        {friends.length ? (
          <List dense sx={{ flexGrow: 1, overflowY: 'auto', px: { xs: 1, sm: 2 } }}>
            {friends.map((friend) => {
              const displayName = friend.displayName || friend.username || 'Friend';
              const secondaryLabel = friend.username ? `@${friend.username}` : '';
              const avatarSrc = resolveAvatarSrc(friend);
              return (
                <ListItem
                  key={friend.id}
                  alignItems="center"
                  sx={{
                    py: 1.5,
                    px: { xs: 1, sm: 0 },
                    gap: { xs: 1.5, sm: 2 },
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    color: isOverlay ? 'inherit' : '#111'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={avatarSrc}
                      alt={displayName}
                      imgProps={{ referrerPolicy: 'no-referrer' }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        sx={!isOverlay ? { color: '#111' } : undefined}
                      >
                        {displayName}
                      </Typography>
                    }
                    secondary={
                      secondaryLabel ? (
                        <Typography
                          variant="caption"
                          color={isOverlay ? 'text.secondary' : undefined}
                          sx={!isOverlay ? { color: '#555' } : undefined}
                        >
                          {secondaryLabel}
                        </Typography>
                      ) : null
                    }
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      width: { xs: '100%', sm: 'auto' },
                      justifyContent: { xs: 'flex-end', sm: 'flex-start' },
                      flexWrap: 'wrap',
                      rowGap: 1
                    }}
                  >
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => handleMessageFriend(friend)}
                      disabled={
                        directMessagesHasAccess === false ||
                        isProcessingFriendAction ||
                        isCreatingDirectThread
                      }
                    >
                      Message
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleUnfriend(friend)}
                      disabled={isProcessingFriendAction}
                    >
                      Unfriend
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleReportFriend(friend)}
                    >
                      Report
                    </Button>
                  </Stack>
                </ListItem>
              );
            })}
          </List>
        ) : null}
      </Box>
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
            <GlobalNavMenu className="chat-header-menu-nav" />
            <div className="chat-header-actions">

              <Button
                className={`switch-chat-btn ${isChannelDialogOpen ? 'open' : ''}`}
                onClick={handleOpenChannelDialog}
                endIcon={<ArrowDownwardIcon className="switch-chat-arrow" />}
              >
                {headerChannelLabel}
              </Button>
            </div>
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
            {channelTab === 'direct'
              ? renderDirectMessagesMobile()
              : channelTab === 'friends'
              ? renderFriendsList({ isOverlay: false })
              : renderRoomMessagesMobile()}
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
          ) : channelTab === 'rooms' ? (
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
          ) : null}

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
            selectedReasons={reportSelectedOffenses}
            onToggleReason={handleToggleReportOffense}
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
        className="channel-switch-overlay"
        open={isChannelDialogOpen}
        onClose={() => setIsChannelDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <Box className="channel-switch-header">
          <DialogTitle className="channel-switch-title">
            Choose a conversation
          </DialogTitle>

          <Button 
              className="close-channel-switch-btn"
              onClick={() => setIsChannelDialogOpen(false)}
            >
              <CloseIcon
                className="close-channel-switch-icon"
              ></CloseIcon>
            </Button>
        </Box>
        
        <DialogContent dividers sx={{ p: 0 }}>
          <Tabs
            className="channel-switch-tabs-background"
            value={channelDialogTab}
            onChange={handleChannelDialogTabChange}
            variant="fullWidth"
            slotProps={{
              indicator: {
                className: "channel-switch-tab-indicator"
              },
            }}
          >
            <Tab
              className="channel-switch-rooms-tab"
              value="rooms"
              icon={<GroupIcon fontSize="small" />}
              iconPosition="start"
              label={
                <Box className="channel-switch-tab-container">                
                  <span className="channel-switch-tab-title">
                    Rooms 
                  </span>
                  {rooms.length > 0 && (
                    <Typography
                      className="channel-switch-tab-badge"
                    >
                      {rooms.length}
                    </Typography>
                  )}
                </Box>
              }
            >
            </Tab>
              
            <Tab
              className="channel-switch-dm-tab"
              value="direct"
              icon={<MarkUnreadChatAltIcon fontSize="small" />}
              iconPosition="start"
              disabled={directMessagesHasAccess === false}
              label={
                <Box className="channel-switch-tab-container">
                  <span className="channel-switch-tab-title">
                    Messages
                  </span>
                  {dmThreads.length > 0 && (
                    <Typography
                      className="channel-switch-tab-badge"
                    >
                      {dmThreads.length}
                    </Typography>
                  )}
                </Box>
              }
            />
            {/* Removed friends tab, since handling of it is now on the friends page
            <Tab
              value="friends"
              label="Friends"
              icon={<PeopleAltIcon fontSize="small" />}
              iconPosition="start"
            />
            */}
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
                viewerUsername={dmViewer?.username || null}
                viewerDisplayName={dmViewer?.displayName || null}
              />
            ) : channelDialogTab === 'friends' ? (
              renderFriendsList({ isOverlay: true })
            ) : (
              <RoomListContent />
            )}
          </Box>
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
