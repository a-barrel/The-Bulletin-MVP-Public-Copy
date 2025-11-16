import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Snackbar,
  Stack,
  Typography
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FriendRequestIcon from '@mui/icons-material/PersonAddRounded';

import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import useFriendGraph from '../hooks/useFriendGraph';
import useDirectMessages from '../hooks/useDirectMessages';
import useModerationTools from '../hooks/useModerationTools';
import normalizeObjectId from '../utils/normalizeObjectId';
import { getParticipantId } from '../utils/chatParticipants';
import { formatFriendlyTimestamp } from '../utils/dates';
import FriendsSidebar from '../components/friends/FriendsSidebar';
import FriendRequestsDialog from '../components/friends/FriendRequestsDialog';
import ChatModerationDialog from '../components/chat/ChatModerationDialog';

import './FriendsPage.css';

export const pageConfig = {
  id: 'friends',
  label: 'Friends',
  icon: FriendRequestIcon,
  path: '/friends',
  aliases: ['/friends-todo'],
  order: 90,
  showInNav: true,
  protected: true
};

function FriendsPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const socialNotifications = useSocialNotificationsContext();

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

  const {
    threads: dmThreads,
    refreshThreads: refreshDmThreads,
    hasAccess: directMessagesHasAccess,
    createThread: createDirectThread,
    isCreating: isCreatingDirectThread
  } = useDirectMessages();

  const {
    hasAccess: moderationHasAccess,
    recordAction: recordModerationAction,
    isSubmitting: isRecordingModerationAction,
    actionStatus: moderationActionStatus,
    resetActionStatus: resetModerationActionStatus
  } = useModerationTools({ autoLoad: false });

  const friends = useMemo(
    () => (Array.isArray(friendGraph?.friends) ? friendGraph.friends : []),
    [friendGraph]
  );

  const incomingRequests = socialNotifications.friendData?.incomingRequests || [];
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  const [friendActionStatus, setFriendActionStatus] = useState(null);
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [moderationContext, setModerationContext] = useState(null);
  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });

  const handleRefreshFriends = useCallback(() => {
    refreshFriendGraph().catch(() => {});
  }, [refreshFriendGraph]);

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

        const refreshTasks = [];
        if (typeof socialNotifications.refreshAll === 'function') {
          refreshTasks.push(socialNotifications.refreshAll());
        }
        refreshTasks.push(refreshFriendGraph());
        await Promise.allSettled(refreshTasks);
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to update friend request.'
        });
      } finally {
        setRespondingRequestId(null);
      }
    },
    [refreshFriendGraph, setFriendActionStatus, socialNotifications]
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
          const candidateThreads = refreshed?.threads || dmThreads;
          const fallback = candidateThreads.find((thread) => {
            const participants = Array.isArray(thread.participants) ? thread.participants : [];
            return participants.some(
              (participant) => getParticipantId(participant) === normalizedFriendId
            );
          });
          newThreadId = fallback?.id || '';
        }
        if (newThreadId) {
          navigate(`/chat?tab=direct&thread=${newThreadId}`);
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
    [createDirectThread, directMessagesHasAccess, dmThreads, navigate, refreshDmThreads]
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
        refreshFriendGraph().catch(() => {});
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to remove friend.'
        });
      }
    },
    [refreshFriendGraph, removeFriendRelationship]
  );

  const handleReportFriend = useCallback((friend) => {
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

  const handleBackNavigation = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const notificationsLabel =
    incomingRequests.length > 0 ? `Friend requests (${incomingRequests.length} unread)` : 'Friend requests';
  const displayBadge =
    incomingRequests.length > 0 ? (incomingRequests.length > 99 ? '99+' : String(incomingRequests.length)) : null;

  const friendsSidebarProps = {
    friends,
    friendHasAccess,
    isLoading: isLoadingFriends,
    friendStatus,
    searchQuery: friendSearchQuery,
    onSearchChange: setFriendSearchQuery,
    onNavigateBack: handleBackNavigation,
    notificationsLabel,
    notificationBadge: displayBadge,
    onOpenRequests: socialNotifications.friendAccessDenied ? undefined : handleOpenFriendDialog,
    directMessagesHasAccess: directMessagesHasAccess !== false,
    isProcessingFriendAction,
    isCreatingDirectThread,
    onMessageFriend: handleMessageFriend,
    onUnfriend: handleUnfriend,
    onReportFriend: handleReportFriend
  };

  useEffect(() => {
    if (friendQueueStatus) {
      setFriendActionStatus(friendQueueStatus);
    }
  }, [friendQueueStatus]);

  return (
    <>
      <Box className="friends-page-shell">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          className="friends-page-toolbar"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={handleBackNavigation} aria-label="Back">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" fontWeight={700}>
              Friends
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {friends.length} total
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshFriends}
              disabled={isLoadingFriends}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<FriendRequestIcon />}
              onClick={handleOpenFriendDialog}
              disabled={socialNotifications.friendAccessDenied}
            >
              Requests
              {displayBadge ? <span className="friends-request-badge">{displayBadge}</span> : null}
            </Button>
          </Stack>
        </Stack>

        {isOffline ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You are offline. Friend list actions may be limited.
          </Alert>
        ) : null}

        <Box sx={{ mt: 3 }}>
          <FriendsSidebar {...friendsSidebarProps} />
        </Box>
      </Box>

      <FriendRequestsDialog
        open={isFriendDialogOpen}
        onClose={handleCloseFriendDialog}
        requests={incomingRequests}
        actionStatus={isFriendDialogOpen ? friendActionStatus : null}
        respondingRequestId={respondingRequestId}
        onRespond={handleRespondToFriendRequest}
        formatTimestamp={formatFriendlyTimestamp}
      />

      <ChatModerationDialog
        open={Boolean(moderationContext)}
        context={moderationContext}
        hasAccess={moderationHasAccess}
        actionStatus={moderationActionStatus}
        form={moderationForm}
        onClose={() => {
          setModerationContext(null);
          resetModerationActionStatus();
        }}
        onSubmit={handleModerationSubmit}
        onFieldChange={handleModerationFieldChange}
        onSelectQuickAction={handleSelectModerationAction}
        disableSubmit={disableModerationSubmit}
        isSubmitting={isRecordingModerationAction}
      />

      <Snackbar
        open={Boolean(friendActionStatus)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setFriendActionStatus(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {friendActionStatus ? (
          <Alert
            onClose={() => setFriendActionStatus(null)}
            severity={friendActionStatus.type || 'info'}
            variant="filled"
          >
            {friendActionStatus.message}
          </Alert>
        ) : null}
      </Snackbar>
    </>
  );
}

export default FriendsPage;
