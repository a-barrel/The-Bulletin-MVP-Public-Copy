/* NOTE: Page exports navigation config alongside the component. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Snackbar
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import GroupIcon from '@mui/icons-material/Group';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import CloseIcon from '@mui/icons-material/Close';
import updatesIcon from '../assets/UpdateIcon.svg';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';
import Navbar from '../components/Navbar';
import MessageBubble from '../components/MessageBubble';
import ReportContentDialog from '../components/ReportContentDialog';
import ChatThreadHeader from '../components/chat/ChatThreadHeader';
import ChatRoomList from '../components/chat/ChatRoomList';
import ChatComposerFooter from '../components/chat/ChatComposerFooter';
import ChatModerationDialog from '../components/chat/ChatModerationDialog';
import DirectThreadList from '../components/chat/DirectThreadList';
import FriendsListPanel from '../components/friends/FriendsListPanel';
import ChatSharePinModal from '../components/chat/ChatSharePinModal';
import useBookmarksManager from '../hooks/useBookmarksManager';
import toIdString from '../utils/ids';
import resolveAssetUrl from '../utils/media';
import { routes } from '../routes';
import FriendRequestsDialog from '../components/friends/FriendRequestsDialog';
import { useTranslation } from 'react-i18next';
import useDirectMessages from '../hooks/useDirectMessages';
import useAttachmentManager, {
  mapDraftAttachmentPayloads,
  sanitizeAttachmentOnlyMessage
} from '../hooks/useAttachmentManager';

import { auth } from '../firebase';
import useChatManager from '../hooks/useChatManager';
import useModerationTools from '../hooks/useModerationTools';
import useFriendsDirectory from '../hooks/useFriendsDirectory';
import useChatTabs from '../hooks/useChatTabs';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useDmGifPreview from '../hooks/useDmGifPreview';
import useScrollToLatestMessage from '../hooks/useScrollToLatestMessage';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import { createContentReport } from '../api/mongoDataApi';
import { ATTACHMENT_ONLY_PLACEHOLDER, MAX_CHAT_ATTACHMENTS } from '../utils/chatAttachments';
import { getParticipantId, resolveThreadParticipants } from '../utils/chatParticipants';
import normalizeObjectId from '../utils/normalizeObjectId';
import usePinCheckIn from '../hooks/usePinCheckIn';
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
  const { t } = useTranslation();
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
  } = useChatManager({
    authUser: firebaseAuthUser,
    authLoading,
    viewerLatitude,
    viewerLongitude,
    isOffline,
    refreshUnreadCount,
    announceBadgeEarned,
    pinId: location.state?.pinId || new URLSearchParams(location.search).get('pinId')
  });
  const {
    bookmarks,
    refresh: refreshBookmarks,
    isLoading: isLoadingBookmarks
  } = useBookmarksManager({ authUser, authLoading, isOffline, hideFullEvents: true });

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
    friends,
    filteredFriends,
    searchQuery: friendSearchQuery,
    setSearchQuery: setFriendSearchQuery,
    incomingRequests,
    notificationsLabel: friendNotificationsLabel,
    requestBadge: friendRequestBadge,
    isLoadingFriends,
    friendStatus,
    friendQueueStatus,
    friendHasAccess,
    isProcessingFriendAction,
    refreshFriendGraph,
    removeFriendRelationship,
    respondToFriendRequest,
    refreshNotifications
  } = useFriendsDirectory();

  const [moderationInitAttempted, setModerationInitAttempted] = useState(false);
  const [moderationContext, setModerationContext] = useState(null);
  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });
  const [lastConversationTab, setLastConversationTab] = useState('rooms');
  const [shareModalContext, setShareModalContext] = useState(null); // 'room' | 'direct' | null
  const {
    channelTab,
    channelDialogTab,
    setChannelDialogTab,
    setChannelTab
  } = useChatTabs({
    locationSearch: location.search,
    directMessagesHasAccess,
    selectDirectThread,
    refreshDmThreads,
    refreshFriendGraph,
    setLastConversationTab
  });
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSelectedOffenses, setReportSelectedOffenses] = useState([]);
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [friendActionStatus, setFriendActionStatus] = useState(null);
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [dmMessageDraft, setDmMessageDraft] = useState('');
  const profileDmTargetRef = useRef(null);

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

  const directMessageCount = Array.isArray(directThreadDetail?.messages)
    ? directThreadDetail.messages.length
    : 0;

  const shareableBookmarks = useMemo(
    () => (Array.isArray(bookmarks) ? bookmarks : []),
    [bookmarks]
  );

  const {
    containerRef,
    inputContainerRef,
    showScrollButton,
    scrollButtonOffset,
    scrollToBottom: scrollMessagesToBottom
  } = useScrollToLatestMessage({
    activeChannel: channelTab,
    roomDependency: selectedRoomId,
    directDependency: selectedDirectThreadId,
    roomMessageCount: uniqueMessages.length,
    directMessageCount,
    locationKey: location.pathname
  });
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

  const {
    gifPreview: dmGifPreview,
    gifPreviewError: dmGifPreviewError,
    isGifPreviewLoading: isDmGifPreviewLoading,
    composerGifPreview: dmComposerGifPreview,
    ensureGifPreviewForMessage,
    confirmGifPreview: handleDmGifPreviewConfirm,
    cancelGifPreview: handleDmGifPreviewCancel,
    shuffleGifPreview: handleDmGifPreviewShuffle
  } = useDmGifPreview({
    authUser,
    messageDraft: dmMessageDraft,
    setMessageDraft: setDmMessageDraft,
    selectedThreadId: selectedDirectThreadId,
    sendDirectMessage,
    resetAttachments: resetDmAttachments,
    setAttachmentStatus: setDmAttachmentStatus,
    focusComposerInput: () => focusComposer(dmComposerInputRef)
  });


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
  }, [channelTab, directMessagesHasAccess, setChannelTab]);


  useEffect(() => {
    if (channelDialogTab === 'direct' && directMessagesHasAccess === false) {
      setChannelDialogTab('rooms');
    }
  }, [channelDialogTab, directMessagesHasAccess, setChannelDialogTab]);

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
  }, [directMessagesHasAccess, location.search, selectDirectThread, setChannelDialogTab, setChannelTab]);

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
    setDmMessageDraft('');
    resetDmAttachments();
  }, [resetDmAttachments, selectedDirectThreadId]);

  const handleNotifications = useCallback(() => {
    navigate('/updates');
  }, [navigate]);

  const findDirectThreadForUser = useCallback(
    (rawUserId) => {
      const normalizedId = normalizeObjectId(rawUserId);
      if (!normalizedId) {
        return null;
      }
      return (
        dmThreads.find((thread) => {
          const participants = Array.isArray(thread.participants)
            ? thread.participants
            : [];
          return participants.some(
            (participant) => getParticipantId(participant) === normalizedId
          );
        }) || null
      );
    },
    [dmThreads]
  );

  const handleChooseRoom = useCallback(
    (roomId) => {
      handleSelectRoom(roomId);
      selectDirectThread(null); // clears DM selection
      setChannelTab('rooms');
      setChannelDialogTab('rooms');
      setIsChannelDialogOpen(false);
    },
    [handleSelectRoom, selectDirectThread, setChannelDialogTab, setChannelTab]
  );

  const handleSelectDirectThreadId = useCallback(
    (threadId) => {
      selectDirectThread(threadId);
      handleSelectRoom(null); // clears room selection
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);
    },
    [handleSelectRoom, selectDirectThread, setChannelDialogTab, setChannelTab]
  );

  useEffect(() => {
    const state = location.state;
    if (!state || !state.fromProfile) {
      return;
    }
    const normalizedTargetId = normalizeObjectId(state.targetUserId);
    if (!normalizedTargetId) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      return;
    }
    profileDmTargetRef.current = {
      userId: normalizedTargetId,
      displayName: state.displayName || null
    };
    setChannelTab('direct');
    setChannelDialogTab('direct');
    setIsChannelDialogOpen(false);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, setChannelDialogTab, setChannelTab]);

  useEffect(() => {
    if (!profileDmTargetRef.current || directMessagesHasAccess === false) {
      return;
    }
    const target = profileDmTargetRef.current;

    const openConversation = async () => {
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);

      const existingThread = findDirectThreadForUser(target.userId);
      if (existingThread?.id) {
        handleSelectDirectThreadId(existingThread.id);
        profileDmTargetRef.current = null;
        return;
      }

      try {
        const result = await createDirectThread({
          participantIds: [target.userId]
        });
        let newThreadId = result?.thread?.id || '';
        if (!newThreadId) {
          const refreshed = await refreshDmThreads().catch(() => null);
          if (refreshed?.threads) {
            const fallback = refreshed.threads.find((thread) => {
              const participants = Array.isArray(thread.participants)
                ? thread.participants
                : [];
              return participants.some(
                (participant) => getParticipantId(participant) === target.userId
              );
            });
            if (fallback?.id) {
              newThreadId = fallback.id;
            }
          }
          if (!newThreadId) {
            const fallback = findDirectThreadForUser(target.userId);
            if (fallback?.id) {
              newThreadId = fallback.id;
            }
          }
        }
        if (newThreadId) {
          handleSelectDirectThreadId(newThreadId);
        }
      } catch (error) {
        console.error('Failed to open direct message from profile:', error);
      } finally {
        profileDmTargetRef.current = null;
      }
    };

    openConversation();
  }, [
    createDirectThread,
    directMessagesHasAccess,
    findDirectThreadForUser,
    handleSelectDirectThreadId,
    refreshDmThreads,
    setChannelDialogTab,
    setChannelTab,
    setIsChannelDialogOpen
  ]);

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

  const handleOpenFriendDialog = useCallback(() => {
    setFriendActionStatus(null);
    setIsFriendDialogOpen(true);
  }, []);

  const handleCloseFriendDialog = useCallback(() => {
    if (respondingRequestId) {
      return;
    }
    setIsFriendDialogOpen(false);
  }, [respondingRequestId]);

  const handleRespondToFriendRequest = useCallback(
    async (requestId, decision) => {
      if (!requestId || !decision) {
        return;
      }
      setRespondingRequestId(requestId);
      setFriendActionStatus(null);
      try {
        await respondToFriendRequest({ requestId, decision });
        setFriendActionStatus({
          type: 'success',
          message: decision === 'accept' ? 'Friend request accepted.' : 'Friend request declined.'
        });

        await Promise.allSettled([
          refreshNotifications(),
          refreshFriendGraph().catch(() => {})
        ]);
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to update friend request.'
        });
      } finally {
        setRespondingRequestId(null);
      }
    },
    [refreshFriendGraph, refreshNotifications, respondToFriendRequest]
  );

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
      const existingThread = findDirectThreadForUser(normalizedFriendId);

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
      findDirectThreadForUser,
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
  }, [channelTab, directMessagesHasAccess, setChannelDialogTab]);

  const handleChannelDialogTabChange = useCallback(
    (event, value) => {
      if (value === 'direct' && directMessagesHasAccess === false) {
        return;
      }
      setChannelDialogTab(value);
    },
    [directMessagesHasAccess, setChannelDialogTab]
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

  const selectedRoomPinId = selectedRoom?.pinId || null;
  const {
    data: checkIn,
    isLoading: isLoadingCheckIn,
    error: checkInError,
    toggleCheckIn
  } = usePinCheckIn({ pinId: selectedRoomPinId, isOffline });

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
      if (ensureGifPreviewForMessage(dmMessageDraft)) {
        return;
      }
      const handledGif = await handleDmGifPreviewConfirm();
      if (handledGif) {
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
      dmMessageDraft,
      focusComposer,
      handleDmGifPreviewCancel,
      handleDmGifPreviewConfirm,
      ensureGifPreviewForMessage,
      isSendingDirectMessage,
      isUploadingDmAttachment,
      resetDmAttachments,
      selectedDirectThreadId,
      sendDirectMessage,
      setDmAttachmentStatus,
      setDmMessageDraft
    ]
  );

  const handleOpenSharePin = useCallback(
    (context) => {
      if (isOffline) {
        return;
      }
      if (isLoadingBookmarks) {
        refreshBookmarks();
      }
      setShareModalContext(context);
    },
    [isLoadingBookmarks, isOffline, refreshBookmarks]
  );

  const handleCloseSharePin = useCallback(() => {
    setShareModalContext(null);
  }, []);

  const handleSharePinSelect = useCallback(
    async (pin) => {
      if (!pin) {
        setShareModalContext(null);
        return;
      }
      const pinId =
        toIdString(pin.pinId) ??
        toIdString(pin._id) ??
        toIdString(pin.id) ??
        toIdString(pin.pin_id);
      const title = pin.title || 'Shared pin';
      const link = pinId ? routes.pin.byId(pinId) : '';
      const message = `Shared pin: ${title}`;
      const cover =
        resolveAssetUrl(pin.coverPhoto, null) ||
        (Array.isArray(pin.photos) ? resolveAssetUrl(pin.photos[0], null) : null);
      const thumb = cover || (Array.isArray(pin.photos) ? resolveAssetUrl(pin.photos[1], null) : null);
      const locationLabel =
        (pin.approximateAddress && typeof pin.approximateAddress === 'object'
          ? [pin.approximateAddress.city, pin.approximateAddress.state, pin.approximateAddress.country]
              .filter((part) => typeof part === 'string' && part.trim())
              .join(', ') || pin.approximateAddress.formatted
          : null) ||
        (pin.address && typeof pin.address === 'object'
          ? pin.address.formatted ||
            [pin.address.line1, pin.address.city, pin.address.state, pin.address.country]
              .filter((part) => typeof part === 'string' && part.trim())
              .join(', ')
          : typeof pin.address === 'string'
          ? pin.address
          : null);
      const pinShareMeta = {
        pinId,
        title,
        type: pin.type,
        link,
        location: locationLabel || null,
        thumb
      };
      const attachment = {
        url: cover || link || '/',
        description: `PINSHARE:${JSON.stringify(pinShareMeta)}`,
        pinId,
        mimeType: 'application/x-pinshare'
      };
      const attachments = cover || link ? [attachment] : [];

      if (shareModalContext === 'room') {
        const sent = await handleSendMessage({ preventDefault() {} }, { attachments, messageOverride: message });
        if (sent !== false) {
          setMessageDraft('');
          resetRoomAttachments();
        }
      } else if (shareModalContext === 'direct' && selectedDirectThreadId) {
        try {
          await sendDirectMessage({
            threadId: selectedDirectThreadId,
            body: message,
            attachments
          });
          setDmMessageDraft('');
          resetDmAttachments();
        } catch {
          // errors surfaced via send status
        }
      }

      setShareModalContext(null);
    },
    [
      handleSendMessage,
      resetRoomAttachments,
      sendDirectMessage,
      selectedDirectThreadId,
      setDmMessageDraft,
      setMessageDraft,
      shareModalContext,
      resetDmAttachments
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
    if (channelTab === 'rooms' || channelTab === 'direct') {
      setLastConversationTab(channelTab);
    }
  }, [channelTab, setLastConversationTab]);

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

  const disableMessageAction = directMessagesHasAccess === false || isCreatingDirectThread;

  const friendPanelProps = {
    friends,
    filteredFriends,
    searchQuery: friendSearchQuery,
    onSearchChange: setFriendSearchQuery,
    isLoading: isLoadingFriends,
    friendStatus,
    hasAccess: friendHasAccess,
    notificationsLabel: friendNotificationsLabel,
    requestBadge: friendRequestBadge,
    onOpenFriendRequests: handleOpenFriendDialog,
    onMessageFriend: handleMessageFriend,
    onRemoveFriend: handleUnfriend,
    onReportFriend: handleReportFriend,
    disableMessageAction,
    disableFriendActions: isProcessingFriendAction
  };

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
      </>
    );
  };

  const renderFriendsList = ({ variant }) => (
    <FriendsListPanel
      {...friendPanelProps}
      onBack={variant === 'dialog' ? () => setIsChannelDialogOpen(false) : handleActivateFriendsView}
    />
  );

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
              bottom: `${scrollButtonOffset + 90}px`,
              position: 'fixed'
            }}
            aria-label="Scroll to latest message"
          >
            <ArrowDownwardIcon className="scroll-to-bottom-icon" />
          </IconButton>
        )}

        <div className="chat-frame">
          <ChatThreadHeader
            pageTitle={t('nav.bottomNav.chat')}
            channelLabel={headerChannelLabel}
            isChannelDialogOpen={isChannelDialogOpen}
            onOpenChannelDialog={handleOpenChannelDialog}
            notificationsLabel={notificationsLabel}
            onNotifications={handleNotifications}
            isOffline={isOffline}
            notificationBadge={displayBadge}
            updatesIconSrc={updatesIcon}
            checkInBanner={
              selectedRoomPinId && checkIn.ready ? (
                <Box className="chat-checkin-banner">
                  <div className="chat-checkin-meta">
                    <strong>Check-ins</strong>
                    <span>
                      {checkIn.checkedInCount ?? 0}/{checkIn.attendingCount ?? '—'}
                    </span>
                  </div>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => toggleCheckIn(!checkIn.viewerCheckedIn)}
                    disabled={!checkIn.canCheckIn || isLoadingCheckIn || isOffline}
                  >
                    {checkIn.viewerCheckedIn ? 'Checked in' : 'Check in'}
                  </Button>
                  {checkInError ? (
                    <span className="chat-checkin-error">Unable to check in</span>
                  ) : null}
                </Box>
              ) : null
            }
          />

          <Box ref={containerRef} className="chat-messages-field">
            {channelTab === 'direct'
              ? renderDirectMessagesMobile()
              : channelTab === 'friends'
              ? renderFriendsList({ variant: 'page' })
              : renderRoomMessagesMobile()}
          </Box>

          {channelTab === 'direct' ? (
            <ChatComposerFooter
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
              onSharePin={() => handleOpenSharePin('direct')}
              inputRef={dmComposerInputRef}
              gifPreview={dmComposerGifPreview}
              gifPreviewError={dmGifPreviewError}
              isGifPreviewLoading={isDmGifPreviewLoading}
              onGifPreviewConfirm={handleDmGifPreviewConfirm}
              onGifPreviewCancel={handleDmGifPreviewCancel}
              onGifPreviewShuffle={handleDmGifPreviewShuffle}
              attachments={dmAttachments}
              attachmentStatus={dmAttachmentStatus}
              isUploadingAttachment={isUploadingDmAttachment}
              attachmentUploadProgress={dmUploadProgress}
              onRemoveAttachment={removeDmAttachment}
              onRetryAttachment={retryDmFailedUploads}
              canRetryAttachment={canRetryDmUploads}
            />
          ) : channelTab === 'rooms' ? (
            <ChatComposerFooter
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
              onSharePin={() => handleOpenSharePin('room')}
              inputRef={roomComposerInputRef}
              gifPreview={composerGifPreview}
              gifPreviewError={gifPreviewError}
              isGifPreviewLoading={isGifPreviewLoading}
              onGifPreviewConfirm={handleGifPreviewConfirm}
              onGifPreviewCancel={handleGifPreviewCancel}
              onGifPreviewShuffle={handleGifPreviewShuffle}
              attachments={roomAttachments}
              attachmentStatus={roomAttachmentStatus}
              isUploadingAttachment={isUploadingRoomAttachment}
              attachmentUploadProgress={roomUploadProgress}
              onRemoveAttachment={removeRoomAttachment}
              onRetryAttachment={retryRoomFailedUploads}
              canRetryAttachment={canRetryRoomUploads}
            />
          ) : null}

          {channelTab === 'rooms' && presenceError ? (
            <Box sx={{ px: 2, py: 1 }}>
              <Alert severity="error">{presenceError}</Alert>
            </Box>
          ) : null}

          <ChatSharePinModal
            open={Boolean(shareModalContext)}
            bookmarks={shareableBookmarks}
            onClose={handleCloseSharePin}
            onSelect={handleSharePinSelect}
          />

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

          <FriendRequestsDialog
            open={isFriendDialogOpen}
            onClose={handleCloseFriendDialog}
            requests={incomingRequests}
            actionStatus={friendActionStatus}
            respondingRequestId={respondingRequestId}
            onRespond={handleRespondToFriendRequest}
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
            sx={{ bottom: `${scrollButtonOffset + 72}px` }}
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
            sx={{ bottom: `${scrollButtonOffset + 16}px` }}
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
            sx={{ bottom: `${scrollButtonOffset + 40}px` }}
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
              renderFriendsList({ variant: 'dialog' })
            ) : (
              <ChatRoomList
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                isRefreshing={isLoadingRooms}
                error={roomsError}
                onRefresh={loadRooms}
                onSelectRoom={handleChooseRoom}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <ChatModerationDialog
        open={Boolean(moderationContext)}
        context={moderationContext}
        hasAccess={moderationHasAccess}
        actionStatus={moderationActionStatus}
        form={moderationForm}
        onClose={handleCloseModerationDialog}
        onSubmit={handleModerationSubmit}
        onFieldChange={handleModerationFieldChange}
        onSelectQuickAction={handleSelectModerationAction}
        disableSubmit={disableModerationSubmit}
        isSubmitting={isRecordingModerationAction}
      />

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
