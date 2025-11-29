/* NOTE: Page exports navigation config alongside the component. */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Box, Stack, Typography, Button, IconButton, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import GroupIcon from '@mui/icons-material/Group';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import CloseIcon from '@mui/icons-material/Close';
import updatesIcon from '../assets/UpdateIcon.svg';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';
import Navbar from '../components/Navbar';
import MessageBubble from '../components/MessageBubble';
import ChatThreadHeader from '../components/chat/ChatThreadHeader';
import ChatComposerFooter from '../components/chat/ChatComposerFooter';
import FriendsListPanel from '../components/friends/FriendsListPanel';
import useBookmarksManager from '../hooks/useBookmarksManager';
import toIdString from '../utils/ids';
import resolveAssetUrl from '../utils/media';
import { routes } from '../routes';
import { useTranslation } from 'react-i18next';
import useDirectMessages from '../hooks/useDirectMessages';
import { sanitizeAttachmentOnlyMessage } from '../hooks/useAttachmentManager';

import { auth } from '../firebase';
import useChatManager from '../hooks/useChatManager';
import useModerationTools from '../hooks/useModerationTools';
import useFriendsDirectory from '../hooks/useFriendsDirectory';
import useChatTabs from '../hooks/useChatTabs';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useScrollToLatestMessage from '../hooks/useScrollToLatestMessage';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import { ATTACHMENT_ONLY_PLACEHOLDER } from '../utils/chatAttachments';
import { getParticipantId, resolveThreadParticipants } from '../utils/chatParticipants';
import normalizeObjectId from '../utils/normalizeObjectId';
import usePinCheckIn from '../hooks/usePinCheckIn';
import './ChatPage.css';
import ChatChannelDialog from '../components/chat/ChatChannelDialog';
import ChatDialogs from '../components/chat/ChatDialogs';
import ChatSnackbars from '../components/chat/ChatSnackbars';
import ChatMessagePane from '../components/chat/ChatMessagePane';
import useChatReporting from '../hooks/useChatReporting';
import useFriendRequestDialog from '../hooks/useFriendRequestDialog';
import useRoomComposer from '../hooks/useRoomComposer';
import useDirectComposer from '../hooks/useDirectComposer';
import useChatChannelController from '../hooks/useChatChannelController';
import useAutoRefreshGeolocation from '../hooks/useAutoRefreshGeolocation';
import useViewerProfile from '../hooks/useViewerProfile';
import { viewerHasDeveloperAccess } from '../utils/roles';
import runtimeConfig from '../config/runtime';

const ChatMessagesSection = memo(function ChatMessagesSection({ containerRef, content }) {
  return (
    <Box ref={containerRef} className="chat-messages-field">
      {content}
    </Box>
  );
});

const MAX_RENDERED_MESSAGES = 100;
const ROOM_LOAD_MORE_STEP = 50;
const DM_LOAD_MORE_STEP = 50;

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
  const { location: viewerLocation, setLocation: setSharedLocation } = useLocationContext();
  const { viewer: viewerProfile, isLoading: isLoadingViewerProfile } = useViewerProfile({
    enabled: !isOffline
  });
  const isAdminViewer = useMemo(
    () =>
      viewerHasDeveloperAccess(viewerProfile, {
        offlineOverride: runtimeConfig.isOffline || isOffline
      }),
    [isOffline, viewerProfile]
  );
  const shouldAutoRefreshLocation = !isOffline && !isLoadingViewerProfile && !isAdminViewer;

  useAutoRefreshGeolocation({
    enabled: shouldAutoRefreshLocation,
    setSharedLocation,
    source: 'chat-page-auto-refresh'
  });
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
  const {
    isChannelDialogOpen,
    setIsChannelDialogOpen,
    handleSelectDirectThreadId,
    handleActivateFriendsView,
    handleOpenChannelDialog,
    handleChannelDialogTabChange,
    handleSelectDirectFromProfile
  } = useChatChannelController({
    channelTab,
    setChannelTab,
    setChannelDialogTab,
    lastConversationTab,
    directMessagesHasAccess,
    selectDirectThread,
    handleSelectRoom,
    refreshDmThreads
  });
  const {
    reportDialogOpen,
    reportTarget,
    reportReason,
    reportSelectedOffenses,
    reportError,
    reportStatus,
    isSubmittingReport,
    openReportDialog,
    closeReportDialog,
    toggleReportOffense,
    submitReport,
    setReportReason,
    setReportStatus,
    handleReportStatusClose: closeReportStatus
  } = useChatReporting();
  const {
    isFriendDialogOpen,
    friendActionStatus,
    respondingRequestId,
    openFriendDialog,
    closeFriendDialog,
    setFriendActionStatus,
    handleRespondToFriendRequest
  } = useFriendRequestDialog({
    respondToFriendRequest,
    refreshFriendGraph,
    refreshNotifications
  });
  const profileDmTargetRef = useRef(null);

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
    attachments: roomAttachments,
    attachmentStatus: roomAttachmentStatus,
    setAttachmentStatus: setRoomAttachmentStatus,
    isUploadingAttachment: isUploadingRoomAttachment,
    attachmentUploadProgress: roomUploadProgress,
    canRetryAttachment: canRetryRoomUploads,
    handleOpenAttachmentPicker: handleOpenRoomAttachmentPicker,
    handleAttachmentInputChange: handleRoomAttachmentInputChange,
    handleRemoveAttachment: removeRoomAttachment,
    handleRetryAttachment: retryRoomFailedUploads,
    handleMessageChange: handleRoomMessageChange,
    handleSend: handleRoomSendMessage,
    handleKeyDown: handleRoomMessageKeyDown,
    attachmentInputRef: roomAttachmentInputRef,
    composerInputRef: roomComposerInputRef,
    resetAttachments: resetRoomAttachments
  } = useRoomComposer({
    isOffline,
    selectedRoomId,
    messageDraft,
    setMessageDraft,
    handleSendMessage,
    handleMessageInputKeyDown,
    focusComposer
  });

  const {
    messageDraft: dmMessageDraft,
    setMessageDraft: setDmMessageDraft,
    attachments: dmAttachments,
    attachmentStatus: dmAttachmentStatus,
    setAttachmentStatus: setDmAttachmentStatus,
    isUploadingAttachment: isUploadingDmAttachment,
    attachmentUploadProgress: dmUploadProgress,
    canRetryAttachment: canRetryDmUploads,
    handleOpenAttachmentPicker: handleOpenDmAttachmentPicker,
    handleAttachmentInputChange: handleDmAttachmentInputChange,
    handleRemoveAttachment: removeDmAttachment,
    handleRetryAttachment: retryDmFailedUploads,
    handleMessageChange: handleDirectMessageChange,
    handleSend: handleSendDirectMessage,
    attachmentInputRef: dmAttachmentInputRef,
    composerInputRef: dmComposerInputRef,
    gifPreview: dmComposerGifPreview,
    gifPreviewError: dmGifPreviewError,
    isGifPreviewLoading: isDmGifPreviewLoading,
    handleGifPreviewConfirm: handleDmGifPreviewConfirm,
    handleGifPreviewCancel: handleDmGifPreviewCancel,
    handleGifPreviewShuffle: handleDmGifPreviewShuffle,
    resetAttachments: resetDmAttachments
  } = useDirectComposer({
    authUser,
    directMessagesHasAccess,
    selectedDirectThreadId,
    sendDirectMessage,
    focusComposer,
    isOffline
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

  // Always ensure a room is selected when rooms are available to avoid empty chat state.
  useEffect(() => {
    if (isLoadingRooms) return;
    if (selectedRoomId) return;
    if (!Array.isArray(rooms) || rooms.length === 0) return;
    const firstRoomId = toIdString(rooms[0]?.id || rooms[0]?._id);
    if (!firstRoomId) return;
    handleSelectRoom(firstRoomId);
    setChannelTab('rooms');
    setChannelDialogTab('rooms');
  }, [
    handleSelectRoom,
    isLoadingRooms,
    rooms,
    selectedRoomId,
    setChannelDialogTab,
    setChannelTab
  ]);

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
    handleSelectDirectFromProfile({
      targetUserId: target.userId,
      displayName: target.displayName,
      findDirectThreadForUser,
      createDirectThread
    }).finally(() => {
      profileDmTargetRef.current = null;
    });
  }, [
    createDirectThread,
    directMessagesHasAccess,
    handleSelectDirectFromProfile,
    setChannelDialogTab,
    setChannelTab,
    setIsChannelDialogOpen,
    findDirectThreadForUser
  ]);

  const handleOpenFriendDialog = useCallback(() => {
    openFriendDialog();
  }, [openFriendDialog]);

  const handleCloseFriendDialog = useCallback(() => {
    closeFriendDialog();
  }, [closeFriendDialog]);

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

  const selectedRoomPinId = selectedRoom?.pinId || null;
  const {
    data: checkIn,
    isLoading: isLoadingCheckIn,
    error: checkInError,
    toggleCheckIn
  } = usePinCheckIn({ pinId: selectedRoomPinId, isOffline });

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

  const handleShareDirect = useCallback(() => {
    handleOpenSharePin('direct');
  }, [handleOpenSharePin]);

  const handleShareRoom = useCallback(() => {
    handleOpenSharePin('room');
  }, [handleOpenSharePin]);

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
        dmComposerGifPreview &&
        Array.isArray(dmComposerGifPreview.options) &&
        typeof dmComposerGifPreview.selectedIndex === 'number' &&
        dmComposerGifPreview.options[dmComposerGifPreview.selectedIndex]?.attachment
      ) {
        handleDmGifPreviewConfirm();
        return;
      }
      handleSendDirectMessage(event);
    },
    [
      dmComposerGifPreview,
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

  const [roomLoadCount, setRoomLoadCount] = useState(MAX_RENDERED_MESSAGES);
  const [dmLoadCount, setDmLoadCount] = useState(MAX_RENDERED_MESSAGES);

  const handleLoadMoreRoomMessages = useCallback(() => {
    setRoomLoadCount((prev) => prev + ROOM_LOAD_MORE_STEP);
  }, []);

  const handleLoadMoreDirectMessages = useCallback(() => {
    setDmLoadCount((prev) => prev + DM_LOAD_MORE_STEP);
  }, []);

  const displayedRoomMessages = useMemo(() => {
    if (!Array.isArray(uniqueMessages)) {
      return [];
    }
    if (uniqueMessages.length <= roomLoadCount) {
      return uniqueMessages;
    }
    return uniqueMessages.slice(uniqueMessages.length - roomLoadCount);
  }, [roomLoadCount, uniqueMessages]);

  const displayedDirectMessages = useMemo(() => {
    if (!Array.isArray(directMessageItems)) {
      return [];
    }
    if (directMessageItems.length <= dmLoadCount) {
      return directMessageItems;
    }
    return directMessageItems.slice(directMessageItems.length - dmLoadCount);
  }, [directMessageItems, dmLoadCount]);

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
      openReportDialog({
        contentType: 'chat-message',
        contentId: messageId,
        summary,
        context: contextLabel
      });
    },
    [getMessageIdForReport, getMessageReportSummary, openReportDialog, selectedRoom, setReportStatus]
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
      openReportDialog({
        contentType: 'direct-message',
        contentId: messageId,
        summary,
        context: contextLabel,
        threadId: selectedDirectThreadId
      });
    },
    [
      getMessageIdForReport,
      getMessageReportSummary,
      openReportDialog,
      selectedDirectNames,
      selectedDirectThreadId,
      setReportStatus
    ]
  );

  const handleCloseReportDialog = useCallback(() => {
    closeReportDialog();
  }, [closeReportDialog]);

  const handleToggleReportOffense = useCallback(
    (offense, checked) => {
      toggleReportOffense(offense, checked);
    },
    [toggleReportOffense]
  );

  const handleSubmitReport = useCallback(async () => {
    await submitReport();
  }, [submitReport]);

  const handleReportStatusClose = useCallback(() => {
    closeReportStatus();
  }, [closeReportStatus]);

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

  const friendPanelProps = useMemo(
    () => ({
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
    }),
    [
      disableMessageAction,
      filteredFriends,
      friendHasAccess,
      friendNotificationsLabel,
      friendRequestBadge,
      friendSearchQuery,
      friendStatus,
      friends,
      handleMessageFriend,
      handleOpenFriendDialog,
      handleReportFriend,
      handleUnfriend,
      isLoadingFriends,
      isProcessingFriendAction,
      setFriendSearchQuery
    ]
  );

  const roomMessageBubbles = useMemo(
    () =>
      displayedRoomMessages.map((message, index) => (
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
    [
      authUser,
      canModerateMessages,
      displayedRoomMessages,
      getMessageKey,
      handleOpenModerationForMessage,
      handleOpenReportForRoomMessage
    ]
  );

  const directMessageBubbles = useMemo(
    () =>
      displayedDirectMessages.map((message, index) => (
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
    [authUser, displayedDirectMessages, directViewerId, getMessageKey, handleOpenReportForDirectMessage]
  );

  const handleFriendListBackDialog = useCallback(() => {
    setIsChannelDialogOpen(false);
  }, []);

  const renderFriendsList = useCallback(
    ({ variant }) => (
      <FriendsListPanel
        {...friendPanelProps}
        onBack={variant === 'dialog' ? handleFriendListBackDialog : handleActivateFriendsView}
      />
    ),
    [friendPanelProps, handleActivateFriendsView, handleFriendListBackDialog]
  );

  const friendsContent = useMemo(() => renderFriendsList({ variant: 'page' }), [renderFriendsList]);

  const messagesContent = useMemo(() => {
    if (channelTab === 'direct') {
      return (
        <ChatMessagePane
          mode="direct"
          directMessagesHasAccess={directMessagesHasAccess}
          selectedDirectThreadId={selectedDirectThreadId}
          dmThreadsCount={dmThreads.length}
          isLoadingDmThreads={isLoadingDmThreads}
          directThreadStatus={directThreadStatus}
          isLoadingDirectThread={isLoadingDirectThread}
          directMessageItemsCount={directMessageItems.length}
          displayedDirectMessagesCount={displayedDirectMessages.length}
          directMessageBubbles={directMessageBubbles}
          onLoadMoreDirectMessages={handleLoadMoreDirectMessages}
        />
      );
    }
    if (channelTab === 'friends') {
      return friendsContent;
    }
    return (
      <ChatMessagePane
        mode="rooms"
        selectedRoom={selectedRoom}
        messagesError={messagesError}
        isLoadingMessages={isLoadingMessages}
        uniqueMessagesCount={uniqueMessages.length}
        displayedRoomMessagesCount={displayedRoomMessages.length}
        roomMessageBubbles={roomMessageBubbles}
        onLoadMoreRoomMessages={handleLoadMoreRoomMessages}
      />
    );
  }, [
    channelTab,
    directMessageBubbles,
    directMessageItems.length,
    directMessagesHasAccess,
    displayedDirectMessages.length,
    displayedRoomMessages.length,
    dmThreads.length,
    friendsContent,
    handleLoadMoreDirectMessages,
    handleLoadMoreRoomMessages,
    isLoadingDirectThread,
    isLoadingDmThreads,
    isLoadingMessages,
    directThreadStatus,
    messagesError,
    roomMessageBubbles,
    selectedDirectThreadId,
    selectedRoom,
    uniqueMessages.length
  ]);

  return (
    <>
      <Box className="chat-page">
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
            backAriaLabel={t('common.back', { defaultValue: 'Back' })}
            onBack={() => navigate(-1)}
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
                    disableRipple
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

          <ChatMessagesSection containerRef={containerRef} content={messagesContent} />

          {channelTab === 'direct' ? (
            <ChatComposerFooter
              variant="modern"
              message={dmMessageDraft}
              placeholder="Send a message"
              onMessageChange={handleDirectMessageChange}
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
              onSharePin={handleShareDirect}
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
              onMessageChange={handleRoomMessageChange}
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
              onSharePin={handleShareRoom}
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

          <ChatSnackbars
            reportStatus={reportStatus}
            onCloseReportStatus={handleReportStatusClose}
            directSendStatus={directSendStatus}
            onCloseDirectSendStatus={resetDirectSendStatus}
            friendActionStatus={friendActionStatus}
            onCloseFriendActionStatus={() => setFriendActionStatus(null)}
            scrollButtonOffset={scrollButtonOffset}
            channelTab={channelTab}
          />

      <Navbar />
    </div>
  </Box>

          <ChatChannelDialog
            open={isChannelDialogOpen}
            onClose={() => setIsChannelDialogOpen(false)}
            channelDialogTab={channelDialogTab}
            onTabChange={handleChannelDialogTabChange}
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            isLoadingRooms={isLoadingRooms}
            roomsError={roomsError}
            onRefreshRooms={loadRooms}
            onSelectRoom={handleChooseRoom}
            dmThreads={dmThreads}
            selectedDirectThreadId={selectedDirectThreadId}
            onSelectDirectThreadId={handleSelectDirectThreadId}
            dmThreadsStatus={dmThreadsStatus}
            isLoadingDmThreads={isLoadingDmThreads}
            refreshDmThreads={refreshDmThreads}
            directMessagesHasAccess={directMessagesHasAccess}
            directViewerId={directViewerId}
            dmViewer={dmViewer}
          />

      <ChatDialogs
        shareModalContext={shareModalContext}
        shareableBookmarks={shareableBookmarks}
        onCloseSharePin={handleCloseSharePin}
        onSelectSharePin={handleSharePinSelect}
        reportDialogOpen={reportDialogOpen}
        onCloseReportDialog={handleCloseReportDialog}
        onSubmitReport={handleSubmitReport}
        reportReason={reportReason}
        onReportReasonChange={setReportReason}
        isSubmittingReport={isSubmittingReport}
        reportError={reportError}
        reportTarget={reportTarget}
        reportSelectedOffenses={reportSelectedOffenses}
        onToggleReportOffense={handleToggleReportOffense}
        isFriendDialogOpen={isFriendDialogOpen}
        onCloseFriendDialog={handleCloseFriendDialog}
        incomingRequests={incomingRequests}
        friendActionStatus={friendActionStatus}
        respondingRequestId={respondingRequestId}
        onRespondFriendRequest={handleRespondToFriendRequest}
        moderationContext={moderationContext}
        moderationHasAccess={moderationHasAccess}
        moderationActionStatus={moderationActionStatus}
        moderationForm={moderationForm}
        onCloseModerationDialog={handleCloseModerationDialog}
        onSubmitModeration={handleModerationSubmit}
        onModerationFieldChange={handleModerationFieldChange}
        onSelectModerationQuickAction={handleSelectModerationAction}
        disableModerationSubmit={disableModerationSubmit}
        isRecordingModerationAction={isRecordingModerationAction}
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

export default memo(ChatPage);
