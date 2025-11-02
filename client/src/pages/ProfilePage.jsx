/* NOTE: Page exports configuration alongside the component. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';

import runtimeConfig from '../config/runtime';
import { BADGE_METADATA } from '../utils/badges';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import useProfileDetail from '../hooks/useProfileDetail';
import useModerationTools from '../hooks/useModerationTools';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../constants/moderationActions';
import { formatFriendlyTimestamp, formatAbsoluteDateTime } from '../utils/dates';
import normalizeObjectId from '../utils/normalizeObjectId';
import { createDirectMessageThread } from '../api/mongoDataApi';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

export const pageConfig = {
  id: 'profile',
  label: 'Profile',
  icon: AccountCircleIcon,
  path: '/profile/:userId',
  order: 91,
  showInNav: true,
  protected: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    if (!runtimeConfig.isOffline) {
      return routes.profile.me;
    }

    if (typeof window === 'undefined') {
      return routes.profile.me;
    }

    const input = window.prompt(
      'Enter a profile ID (leave blank for your profile, type "me" or cancel to stay put):'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'me') {
      return routes.profile.me;
    }
    const sanitized = trimmed.replace(/^\/+/, '');
    if (/^profile\/.+/i.test(sanitized)) {
      return `/${sanitized}`;
    }
    if (/^\/profile\/.+/i.test(trimmed)) {
      return trimmed;
    }
    return routes.profile.byId(sanitized);
  }
};

const FRIEND_AVATAR_FALLBACK = '/images/profile/profile-01.jpg';

const resolveFriendAvatarUrl = (avatar) => {
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  if (!avatar) {
    return FRIEND_AVATAR_FALLBACK;
  }
  const source =
    typeof avatar === 'string'
      ? avatar
      : avatar.url || avatar.thumbnailUrl || avatar.path;
  if (typeof source === 'string' && source.trim()) {
    const trimmed = source.trim();
    if (/^(?:https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      return trimmed;
    }
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return base ? `${base}${normalized}` : normalized;
  }
  return FRIEND_AVATAR_FALLBACK;
};

const resolveBadgeImageUrl = (value) => {
  if (!value) {
    return '—';
  }
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) {
    return '—';
  }
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return base ? `${base}${normalized}` : normalized;
};

const formatEntryValue = (value) => {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[unserializable object]';
    }
  }
  return String(value);
};

const Section = ({ title, description, children }) => (
  <Stack spacing={1.5}>
    <Box>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
    </Box>
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default',
        p: { xs: 2, md: 3 }
      }}
    >
      {children}
    </Box>
  </Stack>
);

function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { isOffline } = useNetworkStatusContext();

  const {
    originPath,
    targetUserId,
    effectiveUser,
    displayName,
    avatarUrl,
    hasProfile,
    bioText,
    badgeList,
    mutualFriendPreview,
    mutualFriendCount,
    statsVisible,
    statsEntries,
    activityEntries,
    preferenceSummary,
    notificationPreferences,
    accountTimeline,
    detailEntries,
    rawDataAvailable,
    showRawData,
    setShowRawData,
    isFetchingProfile,
    fetchError,
    relationshipStatus,
    setRelationshipStatus,
    isEditing,
    formState,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleClearAvatar,
    handleFieldChange,
    handleThemeChange,
    handleToggleLocationSharing,
    handleSaveProfile,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    editingAvatarSrc,
    canEditProfile,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    blockDialogMode,
    isProcessingBlockAction,
    canManageBlock,
    isBlocked
  } = useProfileDetail({
    userIdParam: userId,
    locationState: location.state,
    isOffline
  });

  const {
    overview: moderationOverview,
    hasAccess: moderationHasAccess,
    isLoadingOverview: isLoadingModerationOverview,
    overviewStatus: moderationOverviewStatus,
    history: moderationHistory,
    historyStatus: moderationHistoryStatus,
    isLoadingHistory: isLoadingModerationHistory,
    recordAction: recordModerationAction,
    isSubmitting: isRecordingModerationAction,
    actionStatus: moderationActionStatus,
    resetActionStatus: resetModerationActionStatus,
    selectedUserId: moderationSelectedUserId,
    selectUser: selectModerationUser,
    loadOverview: loadModerationOverview
  } = useModerationTools({ autoLoad: false });

  const [moderationForm, setModerationForm] = useState({
    type: 'warn',
    reason: '',
    durationMinutes: '15'
  });

  const [moderationInitAttempted, setModerationInitAttempted] = useState(false);
  const [isDmDialogOpen, setIsDmDialogOpen] = useState(false);
  const [dmMessage, setDmMessage] = useState('');
  const [isCreatingDm, setIsCreatingDm] = useState(false);
  const [dmStatus, setDmStatus] = useState(null);
  const [dmSnackbar, setDmSnackbar] = useState(null);
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendSnackbar, setFriendSnackbar] = useState(null);
  const [isFriendActionPending, setIsFriendActionPending] = useState(false);
  const socialNotifications = useSocialNotificationsContext();

  const moderationTargetId = useMemo(() => {
    if (effectiveUser) {
      const resolved = normalizeObjectId(effectiveUser._id);
      if (resolved) {
        return resolved;
      }
    }
    if (targetUserId && targetUserId !== 'me') {
      return targetUserId;
    }
    return null;
  }, [effectiveUser, targetUserId]);

  const friendData = socialNotifications?.friendData || null;
  const hasFriendAccess = !socialNotifications?.friendAccessDenied;

  const isFriend = useMemo(() => {
    if (!hasFriendAccess || !moderationTargetId) {
      return false;
    }
    return Boolean(friendData?.friends?.some((friend) => friend?.id === moderationTargetId));
  }, [friendData, hasFriendAccess, moderationTargetId]);

  const incomingFriendRequest = useMemo(() => {
    if (!hasFriendAccess || !moderationTargetId) {
      return null;
    }
    return (friendData?.incomingRequests || []).find(
      (request) => request?.requester?.id === moderationTargetId
    ) || null;
  }, [friendData, hasFriendAccess, moderationTargetId]);

  const outgoingFriendRequest = useMemo(() => {
    if (!hasFriendAccess || !moderationTargetId) {
      return null;
    }
    return (friendData?.outgoingRequests || []).find(
      (request) => request?.recipient?.id === moderationTargetId
    ) || null;
  }, [friendData, hasFriendAccess, moderationTargetId]);

  useEffect(() => {
    setModerationInitAttempted(false);
  }, [moderationTargetId]);

  useEffect(() => {
    if (!moderationTargetId || canEditProfile || isOffline) {
      return;
    }
    if (moderationHasAccess === false) {
      return;
    }
    if (moderationSelectedUserId === moderationTargetId) {
      return;
    }
    if (moderationInitAttempted || isLoadingModerationOverview) {
      if (moderationHasAccess && moderationSelectedUserId !== moderationTargetId) {
        selectModerationUser(moderationTargetId);
      }
      return;
    }

    setModerationInitAttempted(true);
    let cancelled = false;
    loadModerationOverview()
      .then(() => {
        if (!cancelled) {
          selectModerationUser(moderationTargetId);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    moderationTargetId,
    canEditProfile,
    isOffline,
    moderationHasAccess,
    moderationSelectedUserId,
    moderationInitAttempted,
    isLoadingModerationOverview,
    loadModerationOverview,
    selectModerationUser
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

  const isTargetBlocked = useMemo(() => {
    if (!moderationOverview || !moderationTargetId) {
      return false;
    }
    return Boolean(
      moderationOverview.blockedUsers?.some((user) => user?.id === moderationTargetId)
    );
  }, [moderationOverview, moderationTargetId]);

  const isTargetMuted = useMemo(() => {
    if (!moderationOverview || !moderationTargetId) {
      return false;
    }
    return Boolean(
      moderationOverview.mutedUsers?.some((user) => user?.id === moderationTargetId)
    );
  }, [moderationOverview, moderationTargetId]);

  const moderationHistoryPreview = useMemo(
    () => (Array.isArray(moderationHistory) ? moderationHistory.slice(0, 5) : []),
    [moderationHistory]
  );

  const handleSelectModerationAction = useCallback(
    (actionType) => {
      if (moderationHasAccess === false) {
        return;
      }
      setModerationForm((prev) => ({
        ...prev,
        type: actionType,
        durationMinutes: actionType === 'mute' ? prev.durationMinutes || '15' : prev.durationMinutes
      }));
    },
    [moderationHasAccess]
  );

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
      if (!moderationTargetId || moderationHasAccess === false) {
        return;
      }

      const trimmedReason = moderationForm.reason.trim();
      const payload = {
        userId: moderationTargetId,
        type: moderationForm.type,
        reason: trimmedReason ? trimmedReason : undefined
      };

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
          reason: '',
          durationMinutes: prev.type === 'mute' ? prev.durationMinutes || '15' : prev.durationMinutes
        }));
      } catch {
        // Errors surface through hook status; no-op.
      }
    },
    [moderationForm, moderationHasAccess, moderationTargetId, recordModerationAction]
  );

  const moderationAccessPending =
    !canEditProfile &&
    !isOffline &&
    Boolean(moderationTargetId) &&
    moderationHasAccess === null;

  const showModerationSection =
    !canEditProfile &&
    Boolean(moderationTargetId) &&
    !isOffline;

  const moderationInputsDisabled = moderationHasAccess === false || isOffline;

  const disableModerationSubmit =
    moderationInputsDisabled ||
    !moderationTargetId ||
    isRecordingModerationAction ||
    isLoadingModerationOverview;

  const canSendFriendRequest =
    hasFriendAccess &&
    !isFriend &&
    !incomingFriendRequest &&
    !outgoingFriendRequest &&
    !isOffline;

  const friendActionDisabled = isFriendActionPending || !hasFriendAccess || isOffline;

  const handleBack = () => {
    if (originPath) {
      navigate(originPath);
    } else {
      navigate(-1);
    }
  };

  const handleOpenDmDialog = useCallback(() => {
    setDmMessage('');
    setDmStatus(null);
    setIsDmDialogOpen(true);
  }, []);

  const handleCloseDmDialog = useCallback(() => {
    if (isCreatingDm) {
      return;
    }
    setIsDmDialogOpen(false);
    setDmStatus(null);
  }, [isCreatingDm]);

  const handleSubmitDirectMessage = useCallback(async () => {
    if (!moderationTargetId) {
      setDmStatus({
        type: 'error',
        message: 'Select a valid user before starting a conversation.'
      });
      return;
    }

    const trimmed = dmMessage.trim();
    setIsCreatingDm(true);
    setDmStatus(null);
    try {
      const response = await createDirectMessageThread({
        participantIds: [moderationTargetId],
        initialMessage: trimmed ? trimmed : undefined
      });
      if (typeof socialNotifications?.refreshAll === 'function') {
        await socialNotifications.refreshAll().catch(() => {});
      }
      setIsDmDialogOpen(false);
      setDmSnackbar('Direct message thread created.');
      if (response?.thread?.id) {
        navigate(routes.directMessages.thread(response.thread.id));
      } else {
        navigate(routes.directMessages.base);
      }
    } catch (error) {
      setDmStatus({
        type: 'error',
        message: error?.message || 'Failed to start a direct message with this user.'
      });
    } finally {
      setIsCreatingDm(false);
    }
  }, [dmMessage, moderationTargetId, navigate, socialNotifications]);

  const handleDmSnackbarClose = useCallback(() => {
    setDmSnackbar(null);
  }, []);

  const handleSendFriendRequest = useCallback(async () => {
    if (!hasFriendAccess || !moderationTargetId || typeof socialNotifications?.sendFriendRequest !== 'function') {
      return;
    }
    setIsFriendActionPending(true);
    setFriendStatus(null);
    try {
      await socialNotifications.sendFriendRequest({ targetUserId: moderationTargetId });
      setFriendStatus({ type: 'success', message: 'Friend request sent.' });
      setFriendSnackbar('Friend request sent.');
      if (typeof socialNotifications.refreshAll === 'function') {
        await socialNotifications.refreshAll().catch(() => {});
      }
    } catch (error) {
      setFriendStatus({
        type: 'error',
        message: error?.message || 'Failed to send friend request.'
      });
    } finally {
      setIsFriendActionPending(false);
    }
  }, [hasFriendAccess, moderationTargetId, socialNotifications]);

  const handleRespondToFriendRequest = useCallback(
    async (decision) => {
      if (!incomingFriendRequest || typeof socialNotifications?.respondToFriendRequest !== 'function') {
        return;
      }
      setIsFriendActionPending(true);
      setFriendStatus(null);
      try {
        await socialNotifications.respondToFriendRequest({
          requestId: incomingFriendRequest.id,
          decision
        });
        setFriendStatus({
          type: 'success',
          message: decision === 'accept' ? 'Friend request accepted.' : 'Friend request declined.'
        });
        setFriendSnackbar(
          decision === 'accept' ? 'Friend request accepted.' : 'Friend request declined.'
        );
        if (typeof socialNotifications.refreshAll === 'function') {
          await socialNotifications.refreshAll().catch(() => {});
        }
      } catch (error) {
        setFriendStatus({
          type: 'error',
          message: error?.message || 'Failed to update friend request.'
        });
      } finally {
        setIsFriendActionPending(false);
      }
    },
    [incomingFriendRequest, socialNotifications]
  );

  const handleFriendSnackbarClose = useCallback(() => {
    setFriendSnackbar(null);
  }, []);

  const handleDismissFriendStatus = useCallback(() => {
    setFriendStatus(null);
  }, []);

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 }
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          backgroundColor: 'background.paper'
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              size="small"
              color="primary"
              sx={{ alignSelf: 'flex-start' }}
            >
              Back
            </Button>
          </Box>

          {isFetchingProfile ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2" color="text.secondary">
                Loading profile data...
              </Typography>
            </Stack>
          ) : null}

          {fetchError ? (
            <Alert severity="warning" variant="outlined">
              {fetchError}
            </Alert>
          ) : null}

          {isOffline ? (
            <Alert severity="warning" variant="outlined">
              You are offline. Profile changes and relationship actions are disabled until you reconnect.
            </Alert>
          ) : null}

          {relationshipStatus ? (
            <Alert severity={relationshipStatus.type} onClose={() => setRelationshipStatus(null)}>
              {relationshipStatus.message}
            </Alert>
          ) : null}

          <Stack spacing={2} alignItems="center" textAlign="center">
            <Avatar
              src={avatarUrl}
              alt={`${displayName} avatar`}
              sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
            >
              {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1">
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                User ID: {effectiveUser?._id || targetUserId || 'N/A'}
              </Typography>
            </Box>
            {!hasProfile && !isFetchingProfile && !fetchError ? (
              <Typography variant="body2" color="text.secondary">
                No additional user context was provided. Use a pin, reply, or enter a valid user ID to see
                more detail here.
              </Typography>
            ) : null}
            {!canEditProfile ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                <Button variant="contained" color="secondary" onClick={handleOpenDmDialog}>
                  Message user
                </Button>
                {hasFriendAccess ? (
                  isFriend ? (
                    <Chip label="Friends" color="success" variant="outlined" />
                  ) : incomingFriendRequest ? (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleRespondToFriendRequest('accept')}
                        disabled={friendActionDisabled}
                      >
                        {friendActionDisabled ? 'Updating…' : 'Accept request'}
                      </Button>
                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => handleRespondToFriendRequest('decline')}
                        disabled={friendActionDisabled}
                      >
                        Decline
                      </Button>
                    </Stack>
                  ) : outgoingFriendRequest ? (
                    <Chip label="Request sent" color="secondary" variant="outlined" />
                  ) : (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleSendFriendRequest}
                      disabled={!canSendFriendRequest || friendActionDisabled}
                    >
                      {friendActionDisabled ? 'Sending…' : 'Add friend'}
                    </Button>
                  )
                ) : (
                  <Tooltip title="Friend management privileges required">
                    <span>
                      <Button variant="outlined" color="inherit" disabled>
                        Add friend
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            ) : null}
            {friendStatus ? (
              <Alert severity={friendStatus.type} onClose={handleDismissFriendStatus}>
                {friendStatus.message}
              </Alert>
            ) : null}
            {canManageBlock ? (
              <Button
                variant="outlined"
                startIcon={isBlocked ? <HowToRegIcon /> : <BlockIcon />}
                color={isBlocked ? 'primary' : 'error'}
                onClick={isBlocked ? handleRequestUnblock : handleRequestBlock}
              >
                {isBlocked ? 'Unblock user' : 'Block user'}
              </Button>
            ) : null}
          </Stack>

          {updateStatus ? (
            <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
              {updateStatus.message}
            </Alert>
          ) : null}

          {canEditProfile ? (
            <Stack spacing={2}>
              {isEditing ? (
                <Box component="form" onSubmit={handleSaveProfile}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Edit profile</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                      <Avatar
                        src={editingAvatarSrc || avatarUrl}
                        alt={`${displayName} avatar`}
                        sx={{ width: 96, height: 96 }}
                      />
                      <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }}>
                        <Button variant="outlined" component="label">
                          Upload avatar
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleAvatarFileChange}
                          />
                        </Button>
                        <Button variant="text" color="secondary" onClick={handleClearAvatar}>
                          Remove avatar
                        </Button>
                      </Stack>
                    </Stack>

                    <TextField
                      label="Display name"
                      value={formState.displayName}
                      onChange={handleFieldChange('displayName')}
                      required
                      fullWidth
                    />

                    <TextField
                      label="Bio"
                      value={formState.bio}
                      onChange={handleFieldChange('bio')}
                      fullWidth
                      multiline
                      minRows={2}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={formState.locationSharingEnabled}
                          onChange={handleToggleLocationSharing}
                        />
                      }
                      label="Share location with friends"
                    />

                    <TextField
                      select
                      label="Interface theme"
                      value={formState.theme}
                      onChange={handleThemeChange}
                    >
                      <MenuItem value="system">Match system</MenuItem>
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                    </TextField>

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button variant="text" onClick={handleCancelEditing} disabled={isSavingProfile}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? 'Saving…' : 'Save changes'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={handleBeginEditing}
                    disabled={isOffline || !effectiveUser || isFetchingProfile}
                    title={isOffline ? 'Reconnect to edit your profile' : undefined}
                  >
                    Edit profile
                  </Button>
                </Box>
              )}
            </Stack>
          ) : null}

          {hasProfile ? (
            <>
              <Divider />
              <Stack spacing={3}>
                <Section
                  title="Bio"
                  description="Everything they want you to know right now."
                >
                  {bioText ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {bioText}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This user hasn't added a bio yet.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Mutual friends"
                  description="People you both know."
                >
                  {mutualFriendCount > 0 ? (
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ '--gap': '0.75rem' }}
                      >
                        {mutualFriendPreview.map((friend) => {
                          const friendId = friend?._id || friend?.id;
                          const friendName = friend?.displayName || friend?.username || 'Friend';
                          const avatarSrc = resolveFriendAvatarUrl(friend?.avatar);
                          return (
                            <Button
                              key={friendId || friendName}
                              variant="outlined"
                              color="inherit"
                              size="small"
                              startIcon={
                                <Avatar
                                  src={avatarSrc}
                                  alt={friendName}
                                  sx={{ width: 32, height: 32 }}
                                />
                              }
                              onClick={() => {
                                if (friendId) {
                                  navigate(routes.profile.byId(friendId));
                                }
                              }}
                              sx={{
                                borderColor: 'rgba(255, 255, 255, 0.12)',
                                textTransform: 'none'
                              }}
                            >
                              {friendName}
                            </Button>
                          );
                        })}
                      </Stack>
                      {mutualFriendCount > mutualFriendPreview.length ? (
                        <Typography variant="caption" color="text.secondary">
                          +{mutualFriendCount - mutualFriendPreview.length} more mutual
                          {mutualFriendCount - mutualFriendPreview.length === 1 ? '' : 's'}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      You have no mutual friends yet. Start connecting!
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Badges & achievements"
                  description="Recognition earned by this community member."
                >
                  {badgeList.length ? (
                    <Stack direction="row" flexWrap="wrap" gap={1.5}>
                      {badgeList.map((badgeId) => {
                        const badgeInfo =
                          BADGE_METADATA[badgeId] ?? {
                            label: badgeId,
                            description: 'Earn this badge to uncover its story.',
                            image: undefined
                          };
                        const badgeImageUrl = resolveBadgeImageUrl(badgeInfo.image);
                        return (
                          <Tooltip key={badgeId} title={badgeInfo.description} arrow enterTouchDelay={0}>
                            <Chip
                              label={badgeInfo.label}
                              color="primary"
                              variant="outlined"
                              sx={{
                                fontSize: '1rem',
                                px: 1.5,
                                py: 0.75,
                                borderWidth: 2
                              }}
                              avatar={
                                badgeImageUrl ? (
                                  <Avatar
                                    src={badgeImageUrl}
                                    alt={`${badgeInfo.label} badge`}
                                    sx={{ width: 56, height: 56 }}
                                  />
                                ) : undefined
                              }
                            />
                          </Tooltip>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No badges yet — they’ll appear here once this user starts collecting achievements.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Highlights"
                  description="At-a-glance stats across this profile."
                >
                  {statsVisible ? (
                    statsEntries.length ? (
                      <Grid container spacing={2}>
                        {statsEntries.map(({ key, label, value }) => (
                          <Grid item xs={6} sm={4} key={key}>
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle2" color="text.secondary">
                                {label}
                              </Typography>
                              <Typography variant="h5">{value}</Typography>
                            </Stack>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Stats will appear here once this user starts hosting events, posting, or connecting with others.
                      </Typography>
                    )
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This user keeps their stats private.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Activity & collections"
                  description="Quick counts for pins, bookmarks, rooms, and locations associated with this user."
                >
                  {activityEntries.length ? (
                    <Grid container spacing={2}>
                      {activityEntries.map(({ key, label, value }) => (
                        <Grid item xs={6} sm={4} key={key}>
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="h6">{value}</Typography>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Activity counters will populate as soon as this user creates or saves pins, joins chats, or shares check-ins.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Preferences"
                  description="Theme, privacy, and notification settings currently applied to this profile."
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Interface theme
                        </Typography>
                        <Typography variant="body1">
                          {preferenceSummary.theme.charAt(0).toUpperCase() +
                            preferenceSummary.theme.slice(1)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Discovery radius
                        </Typography>
                        <Typography variant="body1">
                          {typeof preferenceSummary.radiusMiles === 'number'
                            ? `${preferenceSummary.radiusMiles} mi`
                            : 'Default'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Location sharing
                        </Typography>
                        <Typography variant="body1">
                          {preferenceSummary.locationSharing ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Stats visibility
                        </Typography>
                        <Typography variant="body1">
                          {statsVisible ? 'Shared' : 'Hidden'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Divider flexItem />

                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {notificationPreferences.map(({ key, label, enabled }) => (
                        <Chip
                          key={key}
                          label={`${label}${enabled ? '' : ' (off)'}`}
                          color={enabled ? 'success' : 'default'}
                          variant={enabled ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Section>

                {showModerationSection ? (
                  <Section
                    title="Moderation controls"
                    description="Apply warnings or restrict access for this user without leaving their profile."
                  >
                    <Stack spacing={2}>
                      {moderationHasAccess === false ? (
                        <Alert severity="info">
                          Moderator privileges required. Ask an administrator to assign you the moderator role.
                        </Alert>
                      ) : null}

                      {moderationAccessPending ? (
                        <Alert severity="info">Loading moderation toolkit…</Alert>
                      ) : null}

                      {moderationOverviewStatus && moderationOverviewStatus.message ? (
                        <Alert severity={moderationOverviewStatus.type}>
                          {moderationOverviewStatus.message}
                        </Alert>
                      ) : null}

                      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
                        <Box
                          component="form"
                          onSubmit={handleModerationSubmit}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Quick presets
                            </Typography>
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
                                  disabled={moderationInputsDisabled}
                                />
                              ))}
                            </Stack>

                            <TextField
                              select
                              label="Moderation action"
                              value={moderationForm.type}
                              onChange={handleModerationFieldChange('type')}
                              helperText="Choose how you want to intervene."
                              fullWidth
                              disabled={moderationInputsDisabled}
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
                                helperText="Muted users lose chat access for this duration."
                                disabled={moderationInputsDisabled}
                              />
                            ) : null}

                            <TextField
                              label="Reason (optional)"
                              value={moderationForm.reason}
                              onChange={handleModerationFieldChange('reason')}
                              multiline
                              minRows={2}
                              placeholder="Add context for other moderators."
                              disabled={moderationInputsDisabled}
                            />

                            <Stack direction="row" spacing={1}>
                              <Button type="submit" variant="contained" disabled={disableModerationSubmit}>
                                {isRecordingModerationAction ? 'Recording…' : 'Apply action'}
                              </Button>
                              <Button
                                type="button"
                                variant="outlined"
                                onClick={() => moderationTargetId && selectModerationUser(moderationTargetId)}
                                disabled={isLoadingModerationHistory || moderationInputsDisabled}
                              >
                                {isLoadingModerationHistory ? 'Refreshing…' : 'Refresh history'}
                              </Button>
                            </Stack>

                            {moderationActionStatus ? (
                              <Alert severity={moderationActionStatus.type}>
                                {moderationActionStatus.message}
                              </Alert>
                            ) : null}

                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {isTargetBlocked ? (
                                <Chip size="small" label="Currently blocked" color="error" variant="outlined" />
                              ) : null}
                              {isTargetMuted ? (
                                <Chip size="small" label="Muted" color="warning" variant="outlined" />
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack spacing={1.5}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Typography variant="subtitle2" color="text.secondary">
                                Recent moderation history
                              </Typography>
                              {isLoadingModerationHistory ? <CircularProgress size={16} /> : null}
                            </Stack>

                            {moderationHistoryStatus && moderationHistoryStatus.message ? (
                              <Alert severity={moderationHistoryStatus.type}>
                                {moderationHistoryStatus.message}
                              </Alert>
                            ) : null}

                            {moderationHistoryPreview.length ? (
                              <Stack spacing={1.25}>
                                {moderationHistoryPreview.map((entry) => (
                                  <Paper
                                    key={entry.id}
                                    variant="outlined"
                                    sx={{ p: 1.5, backgroundColor: 'background.default' }}
                                  >
                                    <Stack spacing={0.75}>
                                      <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        justifyContent="space-between"
                                      >
                                        <Chip
                                          size="small"
                                          label={entry.type.toUpperCase()}
                                          color="primary"
                                          variant="outlined"
                                        />
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          title={
                                            entry.createdAt
                                              ? formatAbsoluteDateTime(entry.createdAt)
                                              : undefined
                                          }
                                        >
                                          {entry.createdAt
                                            ? formatFriendlyTimestamp(entry.createdAt)
                                            : '—'}
                                        </Typography>
                                      </Stack>
                                      {entry.reason ? (
                                        <Typography variant="body2">{entry.reason}</Typography>
                                      ) : (
                                        <Typography variant="body2" color="text.secondary">
                                          No reason provided.
                                        </Typography>
                                      )}
                                      <Typography variant="caption" color="text.secondary">
                                        {entry.moderator
                                          ? `By ${
                                              entry.moderator.displayName ||
                                              entry.moderator.username ||
                                              entry.moderator.id
                                            }`
                                          : 'Moderator record'}
                                      </Typography>
                                    </Stack>
                                  </Paper>
                                ))}
                              </Stack>
                            ) : isLoadingModerationOverview || isLoadingModerationHistory ? (
                              <Typography variant="body2" color="text.secondary">
                                Loading moderation history…
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No moderation actions recorded for this user yet.
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </Stack>
                  </Section>
                ) : null}

                <Section
                  title="Account timeline"
                  description="Provisioning details captured when this account was created."
                >
                  {accountTimeline ? (
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        User ID
                      </Typography>
                      <Typography variant="body1">{accountTimeline.userId}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Email
                      </Typography>
                      <Typography variant="body1">{accountTimeline.email}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Account status
                      </Typography>
                      <Typography variant="body1">
                        {accountTimeline.status.charAt(0).toUpperCase() + accountTimeline.status.slice(1)}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Created
                      </Typography>
                      <Typography variant="body1">{accountTimeline.createdAt}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Last updated
                      </Typography>
                      <Typography variant="body1">{accountTimeline.updatedAt}</Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      We’ll surface account timestamps once this profile finishes loading.
                    </Typography>
                  )}
                </Section>

                {rawDataAvailable ? (
                  <Stack spacing={1}>
                    <Button
                      type="button"
                      variant="text"
                      color="secondary"
                      onClick={() => setShowRawData((prev) => !prev)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {showRawData ? 'Hide raw profile JSON' : 'Show raw profile JSON'}
                    </Button>
                    <Collapse in={showRawData} unmountOnExit>
                      <Stack spacing={1.5}>
                        {detailEntries.map(({ key, value, isObject }) => (
                          <Box
                            key={key}
                            sx={{
                              borderRadius: 2,
                              border: '1px dashed',
                              borderColor: 'divider',
                              backgroundColor: 'background.default',
                              p: 2
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                textTransform: 'uppercase',
                                letterSpacing: 0.6,
                                fontWeight: 600
                              }}
                            >
                              {key}
                            </Typography>
                            {isObject ? (
                              <Box
                                component="pre"
                                sx={{
                                  mt: 1,
                                  mb: 0,
                                  fontSize: '0.85rem',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {formatEntryValue(value)}
                              </Box>
                            ) : (
                              <Typography variant="body1" sx={{ mt: 0.5 }}>
                                {formatEntryValue(value)}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    </Collapse>
                  </Stack>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Paper>
      <Dialog
        open={isDmDialogOpen}
        onClose={handleCloseDmDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Message {displayName}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {dmStatus ? <Alert severity={dmStatus.type}>{dmStatus.message}</Alert> : null}
            <TextField
              label="Message"
              value={dmMessage}
              onChange={(event) => setDmMessage(event.target.value)}
              placeholder="Say hello or share a quick update."
              multiline
              minRows={3}
              disabled={isCreatingDm || isOffline}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDmDialog} disabled={isCreatingDm}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitDirectMessage}
            variant="contained"
            color="secondary"
            disabled={isCreatingDm || isOffline || !moderationTargetId}
          >
            {isCreatingDm ? 'Sending…' : 'Send message'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(blockDialogMode)}
        onClose={handleCloseBlockDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{blockDialogMode === 'block' ? 'Block this user?' : 'Unblock this user?'}</DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {blockDialogMode === 'block'
              ? 'Blocked users cannot interact with you and their activity is hidden. You can review blocked users in Settings whenever you change your mind.'
              : 'Unblocking lets this user interact with you again and restores their activity in your feeds.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseBlockDialog} disabled={isProcessingBlockAction}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBlockDialog}
            color={blockDialogMode === 'block' ? 'error' : 'primary'}
            variant="contained"
            disabled={isProcessingBlockAction}
          >
            {isProcessingBlockAction
              ? 'Updating...'
              : blockDialogMode === 'block'
              ? 'Block user'
            : 'Unblock user'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(dmSnackbar)}
        autoHideDuration={4000}
        onClose={handleDmSnackbarClose}
        message={dmSnackbar || ''}
      />
      <Snackbar
        open={Boolean(friendSnackbar)}
        autoHideDuration={4000}
        onClose={handleFriendSnackbarClose}
        message={friendSnackbar || ''}
      />
    </Box>
  );
}

export default ProfilePage;
