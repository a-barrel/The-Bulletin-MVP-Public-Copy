import { useCallback, useEffect, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';

import FriendsListPanel from '../components/friends/FriendsListPanel';
import FriendRequestsDialog from '../components/friends/FriendRequestsDialog';
import useFriendsDirectory from '../hooks/useFriendsDirectory';
import useDirectMessages from '../hooks/useDirectMessages';
import useModerationTools from '../hooks/useModerationTools';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import { getParticipantId } from '../utils/chatParticipants';
import normalizeObjectId from '../utils/normalizeObjectId';
import ReportContentDialog from '../components/ReportContentDialog';
import { createContentReport } from '../api';
import './FriendsPage.css';

export const pageConfig = {
  id: 'friends',
  label: 'Friends',
  icon: SmsIcon,
  path: '/friends',
  aliases: ['/friends-todo'],
  order: 90,
  showInNav: true,
  protected: true
};

function FriendsPage() {
  const navigate = useNavigate();
  const {
    friends,
    filteredFriends,
    searchQuery,
    setSearchQuery,
    incomingRequests,
    notificationsLabel,
    requestBadge,
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

  const {
    threads: dmThreads,
    refreshThreads: refreshDmThreads,
    hasAccess: directMessagesHasAccess,
    isCreating: isCreatingDirectThread,
    createThread: createDirectThread
  } = useDirectMessages();

  const {
    hasAccess: moderationHasAccess,
    loadOverview: loadModerationOverview,
    isLoadingOverview: isLoadingModerationOverview,
    recordAction: recordModerationAction,
    isSubmitting: isRecordingModerationAction,
    actionStatus: moderationActionStatus,
    resetActionStatus: resetModerationActionStatus
  } = useModerationTools({ autoLoad: false });

  const { isOffline } = useNetworkStatusContext();

  const [moderationInitAttempted, setModerationInitAttempted] = useState(false);
  const [moderationContext, setModerationContext] = useState(null);
  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });
  const [friendActionStatus, setFriendActionStatus] = useState(null);
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportOffenses, setReportOffenses] = useState([]);
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (friendQueueStatus) {
      setFriendActionStatus(friendQueueStatus);
    }
  }, [friendQueueStatus]);

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
    isLoadingModerationOverview,
    loadModerationOverview,
    moderationHasAccess,
    moderationInitAttempted
  ]);

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
        // surfaced via moderationActionStatus
      }
    },
    [moderationContext, moderationForm, moderationHasAccess, recordModerationAction]
  );

  const handleMessageFriend = useCallback(
    async (friend) => {
      const friendId = normalizeObjectId(friend?.id);
      if (!friendId) {
        setFriendActionStatus({ type: 'error', message: 'Unable to open this conversation.' });
        return;
      }
      if (friend?.isBlockedByViewer) {
        setFriendActionStatus({
          type: 'error',
          message: 'Unblock this friend in Settings to resume conversations.'
        });
        return;
      }
      if (friend?.isBlockingViewer) {
        setFriendActionStatus({
          type: 'error',
          message: 'This friend blocked you, so messaging is disabled.'
        });
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
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to remove friend.'
        });
      }
    },
    [removeFriendRelationship]
  );

  const handleReportFriend = useCallback((friend) => {
    const friendId = normalizeObjectId(friend?.id);
    if (!friendId) {
      setFriendActionStatus({ type: 'error', message: 'Unable to report this friend.' });
      return;
    }
    setReportTarget({
      userId: friendId,
      displayName: friend.displayName || friend.username || 'User'
    });
    setReportReason('');
    setReportOffenses([]);
    setReportError(null);
  }, []);

  const handleCloseReportDialog = useCallback(() => {
    if (isSubmittingReport) {
      return;
    }
    setReportTarget(null);
    setReportReason('');
    setReportOffenses([]);
    setReportError(null);
  }, [isSubmittingReport]);

  const handleToggleReportOffense = useCallback((offense, checked) => {
    if (typeof offense !== 'string') {
      return;
    }
    setReportOffenses((prev) => {
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
    if (!reportTarget?.userId || isSubmittingReport) {
      return;
    }
    const normalizedReason = typeof reportReason === 'string' ? reportReason.trim() : '';
    const offensesList = Array.isArray(reportOffenses) ? reportOffenses : [];
    if (!normalizedReason && offensesList.length === 0) {
      setReportError('Select at least one issue or add details.');
      return;
    }
    setIsSubmittingReport(true);
    setReportError(null);
    try {
      await createContentReport({
        contentType: 'user',
        contentId: reportTarget.userId,
        context: `Friends list report: ${reportTarget.displayName || 'User'}`,
        summary: reportTarget.displayName || 'User',
        reason: normalizedReason || 'Reported via friends list.',
        offenses: offensesList
      });
      setReportTarget(null);
      setReportReason('');
      setReportOffenses([]);
      setFriendActionStatus({
        type: 'success',
        message: 'Thanks — your report was submitted.'
      });
    } catch (error) {
      setReportError(error?.message || 'Failed to submit report.');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [isSubmittingReport, reportOffenses, reportReason, reportTarget]);

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

  const disableModerationSubmit =
    !moderationContext?.userId ||
    moderationHasAccess === false ||
    isOffline ||
    isRecordingModerationAction;

  const disableMessageAction = directMessagesHasAccess === false || isCreatingDirectThread;

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <>
      <Box className="friend-page">
        <div className="friend-frame">
          <Box className="friends-list-field">
            <FriendsListPanel
              friends={friends}
              filteredFriends={filteredFriends}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isLoading={isLoadingFriends}
              friendStatus={friendStatus}
              hasAccess={friendHasAccess}
              onBack={handleBack}
              notificationsLabel={notificationsLabel}
              requestBadge={requestBadge}
              onOpenFriendRequests={handleOpenFriendDialog}
              onMessageFriend={handleMessageFriend}
              onRemoveFriend={handleUnfriend}
              onReportFriend={handleReportFriend}
              disableMessageAction={disableMessageAction}
              disableFriendActions={isProcessingFriendAction}
            />
          </Box>
        </div>
      </Box>

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
            elevation={6}
            variant="filled"
            severity={friendActionStatus.type || 'info'}
            onClose={() => setFriendActionStatus(null)}
          >
            {friendActionStatus.message}
          </Alert>
        ) : null}
      </Snackbar>

      <FriendRequestsDialog
        open={isFriendDialogOpen}
        onClose={handleCloseFriendDialog}
        requests={incomingRequests}
        actionStatus={friendActionStatus}
        respondingRequestId={respondingRequestId}
        onRespond={handleRespondToFriendRequest}
      />

      <ReportContentDialog
        open={Boolean(reportTarget)}
        onClose={handleCloseReportDialog}
        onSubmit={handleSubmitReport}
        reason={reportReason}
        onReasonChange={setReportReason}
        submitting={isSubmittingReport}
        error={reportError || undefined}
        context={reportTarget ? `Profile: ${reportTarget.displayName || 'User'}` : ''}
        selectedReasons={reportOffenses}
        onToggleReason={handleToggleReportOffense}
      />

      <Dialog
        open={Boolean(moderationContext)}
        onClose={handleCloseModerationDialog}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handleModerationSubmit}>
          <DialogTitle>Moderate {moderationContext?.displayName || 'user'}</DialogTitle>
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

export default memo(FriendsPage);
