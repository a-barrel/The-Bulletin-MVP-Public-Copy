/* NOTE: Page exports configuration alongside the component. */
import runtimeConfig from '../config/runtime';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import UpdateIcon from '@mui/icons-material/Update';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import './UpdatesPage.css';
import {
  formatFriendlyTimestamp,
  formatAbsoluteDateTime,
  formatRelativeTime
} from '../utils/dates';
import useUpdatesFeed from '../hooks/useUpdatesFeed';
import { routes } from '../routes';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import usePushNotifications from '../hooks/usePushNotifications';
import FriendBadge from '../components/FriendBadge';

export const pageConfig = {
  id: 'updates',
  label: 'Updates',
  icon: UpdateIcon,
  path: '/updates',
  aliases: ['/update-todo'],
  order: 93,
  showInNav: true,
  protected: true
};

const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const PUSH_PROMPT_DISMISS_KEY = 'pinpoint:pushPromptDismissed';

const resolveBadgeImageUrl = (value) => {
  if (!value) {
    return null;
  }
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) {
    return value;
  }
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
};

function UpdatesPage() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('All');
  const socialNotifications = useSocialNotificationsContext();
  const pushNotifications = usePushNotifications();
  const [pushPromptDismissed, setPushPromptDismissed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem(PUSH_PROMPT_DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const incomingRequests = socialNotifications.friendData?.incomingRequests || [];
  const canShowFriendRequests = !socialNotifications.friendAccessDenied;
  const hasFriendRequests = canShowFriendRequests && incomingRequests.length > 0;
  const friendRequestsPreview = incomingRequests.slice(0, 3);
  const remainingFriendRequests = Math.max(0, incomingRequests.length - friendRequestsPreview.length);
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [friendActionStatus, setFriendActionStatus] = useState(null);

  useEffect(() => {
    if (pushNotifications.permission === 'granted') {
      setPushPromptDismissed(true);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, 'true');
        } catch {
          // ignore
        }
      }
    }
  }, [pushNotifications.permission]);

  const {
    profileError,
    isProfileLoading,
    filteredUpdates,
    updates,
    isLoadingUpdates,
    updatesError,
    showUnreadOnly,
    pendingUpdateIds,
    deletingUpdateIds,
    isMarkingAllRead,
    unreadCount,
    containerRef,
    pullDistance,
    isPullRefreshing,
    handleDismissUpdatesError,
    handleToggleUnreadOnly,
    handleRefresh,
    handleMarkRead,
    handleMarkAllRead,
    handleDeleteUpdate
  } = useUpdatesFeed();

  const isLoading = isProfileLoading || isLoadingUpdates;

  const { unreadDiscussionsCount, unreadEventsCount } = useMemo(() => {
    const counts = {
      unreadDiscussionsCount: 0,
      unreadEventsCount: 0
    };

    updates.forEach((update) => {
      if (update.readAt) {
        return;
      }
      const category = (update.category || '').toLowerCase();
      if (category === 'discussion') {
        counts.unreadDiscussionsCount += 1;
      }
      if (category === 'event') {
        counts.unreadEventsCount += 1;
      }
    });

    return counts;
  }, [updates]);

  const tabFilteredUpdates = useMemo(() => {
    if (selectedTab === 'All') {
      return filteredUpdates;
    }

    return filteredUpdates.filter((update) => {
      const category = (update.category || '').toLowerCase();
      if (selectedTab === 'Discussions') {
        return category === 'discussion';
      }
      if (selectedTab === 'Events') {
        return category === 'event';
      }
      return true;
    });
  }, [filteredUpdates, selectedTab]);

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

  return (
    <Box className="updates-page">
      <Box ref={containerRef} className="updates-frame">
        <header className="updates-header-bar">
          <IconButton onClick={() => navigate(-1)} className="updates-header-back-btn">
            <ArrowBackIcon className="updates-header-back-icon" />
          </IconButton>

          <h1 className="updates-header-title">Updates</h1>

          <IconButton className="refresh-btn" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>

          <FormControlLabel
            className="show-unread-toggle"
            control={
              <Switch checked={showUnreadOnly} onChange={handleToggleUnreadOnly} color="primary" />
            }
            label="Show unread only"
          />

          <Button
            className="updates-header-clear-btn"
            onClick={handleMarkAllRead}
            startIcon={<DoneAllIcon fontSize="small" />}
            disabled={isMarkingAllRead || unreadCount === 0}
          >
            Clear
          </Button>
        </header>

        <Box className="updates-content">
          <Box className="updates-tabs-container">
            {[
              { label: 'All', count: unreadCount },
              { label: 'Discussions', count: unreadDiscussionsCount },
              { label: 'Events', count: unreadEventsCount }
            ].map((tab) => (
              <Button
                key={tab.label}
                className={`update-tab ${selectedTab === tab.label ? 'active' : ''}`}
                onClick={() => setSelectedTab(tab.label)}
              >
                {tab.label}
                {tab.count > 0 ? <span className="unread-badge">{tab.count}</span> : null}
              </Button>
            ))}
          </Box>

          {pushNotifications.isSupported &&
           pushNotifications.permission !== 'granted' &&
           !pushPromptDismissed ? (
            <Alert
              severity="info"
              variant="outlined"
              sx={{ mb: 3 }}
              action={
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={async () => {
                      try {
                        await pushNotifications.requestPermission();
                      } catch {
                        // status handled by hook
                      }
                    }}
                    disabled={pushNotifications.isEnabling}
                  >
                    {pushNotifications.isEnabling ? 'Enabling…' : 'Enable'}
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      pushNotifications.dismissPrompt();
                      setPushPromptDismissed(true);
                    }}
                  >
                    Dismiss
                  </Button>
                </Stack>
              }
            >
              Enable push notifications to get updates even when you're away.
            </Alert>
          ) : null}

          {canShowFriendRequests ? (
            <Paper
              elevation={1}
              sx={{
                mt: 2,
                mb: 2,
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider'
              }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" component="h2">
                  Pending friend requests
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {hasFriendRequests
                    ? incomingRequests.length === 1
                      ? '1 person is waiting for your response.'
                      : `${incomingRequests.length} people are waiting for your response.`
                    : 'All caught up — new friend requests will appear here.'}
                </Typography>
                {hasFriendRequests ? (
                  <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                    {friendRequestsPreview.map((request) => {
                      const requesterId =
                        request.requester?._id || request.requester?.id || request.requester?.userId;
                      const requesterName =
                        request.requester?.displayName ||
                        request.requester?.username ||
                        request.requester?.id ||
                        'Unknown user';
                      return (
                        <Chip
                          key={request.id}
                          label={
                            <span className="friend-chip-label">
                              {requesterName}
                              <FriendBadge userId={requesterId} size="0.8em" />
                            </span>
                          }
                          color="secondary"
                          variant="outlined"
                        />
                      );
                    })}
                    {remainingFriendRequests > 0 ? (
                      <Chip label={`+${remainingFriendRequests} more`} variant="outlined" />
                    ) : null}
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} mt={2}>
                    <Chip label="No pending requests" color="default" variant="outlined" />
                  </Stack>
                )}
              </Box>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleOpenFriendDialog}
                disabled={
                  socialNotifications.friendIsLoading ||
                  respondingRequestId !== null
                }
                sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
              >
                Review requests
              </Button>
            </Stack>
          </Paper>
          ) : null}

          {profileError ? (
            <Alert severity="warning" variant="outlined">
              {profileError}
            </Alert>
          ) : null}

          {updatesError ? (
            <Alert severity="error" onClose={handleDismissUpdatesError}>
              {updatesError}
            </Alert>
          ) : null}

          {isLoading ? (
            <Box className="loading-bar-container">
              <CircularProgress />
              <Typography className="loading-bar-label">Loading updates...</Typography>
            </Box>
          ) : tabFilteredUpdates.length === 0 ? (
            <Paper
              className="empty-updates-msg"
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                borderColor: 'divider'
              }}
            >
              <NotificationsActiveIcon className="notification-icon" color="disabled" fontSize="large" />

              <Typography className="empty-updates-msg-title" variant="h6" sx={{ mt: 2 }}>
                Nothing new yet
              </Typography>

              <Typography className="empty-updates-msg-body" variant="body2" color="text.secondary">
                Stay tuned — new activity on your pins and chats will show up here.
              </Typography>
            </Paper>
          ) : (
            <Box className="updates-list">
              <Box
                className="pull-refresh-indicator"
                style={{
                  height: Math.max(isPullRefreshing ? 48 : 0, pullDistance),
                  opacity: pullDistance > 0 || isPullRefreshing ? 1 : 0
                }}
              >
                {isPullRefreshing ? (
                  <CircularProgress className="pull-refresh-loading-circle" size={28} />
                ) : (
                  <>
                    <span
                      className={`pull-refresh-arrow-wrapper${
                        pullDistance > 36 ? ' pull-refresh-arrow-wrapper--flipped' : ''
                      }`}
                    >
                      <ArrowUpwardRoundedIcon className="pull-refresh-prompt-arrow" />
                    </span>
                    <Typography className="pull-refresh-label" variant="body2">
                      {pullDistance > 36 ? 'Release to refresh' : 'Pull to refresh'}
                    </Typography>
                  </>
                )}
              </Box>
              {tabFilteredUpdates.map((update) => {
                const read = Boolean(update.readAt);
                const pending = pendingUpdateIds.includes(update._id);
                const isDeleting = deletingUpdateIds.includes(update._id);
                const message = update.payload?.body;
                const pinTitle = update.payload?.pin?.title;
                const pinId = update.payload?.pin?._id;
                const typeKey = update.payload?.type ?? 'update';
                const displayTypeLabel = typeKey.replace(/-/g, ' ');
                const isBadgeUpdate = typeKey === 'badge-earned';
                const badgeImage = update.payload?.metadata?.badgeImage;
                const badgeImageUrl = badgeImage ? resolveBadgeImageUrl(badgeImage) : null;
                const createdAt = update.createdAt;

                return (
                  <Paper
                    className="update-card"
                    key={update._id}
                    sx={{
                      borderColor: read ? 'divider' : 'secondary.main',
                      backgroundColor: read ? 'background.paper' : 'rgba(144, 202, 249, 0.04)',
                      mb: 2
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" className="update-header">
                      <Chip
                        label={displayTypeLabel}
                        size="small"
                        color={read ? 'default' : 'secondary'}
                      />

                      {pinTitle ? (
                        <Chip label={pinTitle} size="small" className="pin-title-chip" variant="outlined" />
                      ) : null}

                      <Typography
                        className="update-time"
                        variant="body2"
                        sx={{ marginLeft: 'auto' }}
                        title={formatAbsoluteDateTime(createdAt) || undefined}
                      >
                        {formatFriendlyTimestamp(createdAt) || formatRelativeTime(createdAt) || ''}
                      </Typography>
                    </Stack>

                    {update.payload?.title ? (
                      <Typography className="update-title" variant="h6" sx={{ mt: 1 }}>
                        {update.payload.title}
                      </Typography>
                    ) : null}

                    {message ? (
                      <Typography className="update-message" sx={{ mt: 1 }}>
                        {message}
                      </Typography>
                    ) : null}

                    {typeKey === 'pin-update' && Array.isArray(update.payload?.metadata?.changedFields) ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {update.payload.metadata.changedFields.map((field) => (
                          <Chip key={field} size="small" variant="outlined" label={`Changed: ${field}`} />
                        ))}
                      </Stack>
                    ) : null}

                    {update.payload?.avatars?.length ? (
                      <Box className="avatar-row" sx={{ mt: 1 }}>
                        {update.payload.avatars.map((src, idx) => (
                          <img key={idx} src={src} alt="participant" className="avatar" />
                        ))}
                      </Box>
                    ) : null}

                    {isBadgeUpdate && badgeImageUrl ? (
                      <Box
                        component="img"
                        src={badgeImageUrl || undefined}
                        alt={
                          update.payload?.metadata?.badgeId
                            ? `${update.payload.metadata.badgeId} badge`
                            : 'Badge earned'
                        }
                        sx={{
                          width: { xs: 96, sm: 128 },
                          height: { xs: 96, sm: 128 },
                          borderRadius: 3,
                          alignSelf: 'flex-start',
                          border: (theme) => `1px solid ${theme.palette.divider}`,
                          objectFit: 'cover',
                          mt: 2
                        }}
                      />
                    ) : null}

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {pinId ? (
                        <Button
                          component={Link}
                          to={routes.pin.byId(pinId)}
                          size="small"
                          className="view-pin-btn"
                          variant="contained"
                        >
                          View pin
                        </Button>
                      ) : null}

                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon fontSize="small" />}
                        onClick={() => handleDeleteUpdate(update._id)}
                        disabled={isDeleting || pending}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Button>

                      {read ? (
                        <Chip
                          label="Read"
                          size="small"
                          icon={<CheckCircleOutlineIcon fontSize="small" />}
                          variant="outlined"
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                          onClick={() => handleMarkRead(update._id)}
                          disabled={pending || isDeleting}
                        >
                          {pending ? 'Marking...' : 'Mark as read'}
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
          </Box>
        )}
      </Box>
      <Dialog open={isFriendDialogOpen} onClose={handleCloseFriendDialog} fullWidth maxWidth="sm">
        <DialogTitle>Pending friend requests</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {friendActionStatus ? (
              <Alert severity={friendActionStatus.type}>{friendActionStatus.message}</Alert>
            ) : null}

            {incomingRequests.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                All caught up! You have no pending friend requests.
              </Typography>
            ) : null}

            {incomingRequests.map((request) => {
              const requesterId =
                request.requester?._id || request.requester?.id || request.requester?.userId;
              const requesterName =
                request.requester?.displayName ||
                request.requester?.username ||
                request.requester?.id ||
                'Unknown user';
              const isUpdating = respondingRequestId === request.id;

              return (
                <Paper
                  key={request.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: 'background.default'
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="subtitle1" fontWeight={600}>
                        {requesterName}
                        <FriendBadge userId={requesterId} size="0.85em" />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {request.createdAt
                          ? formatFriendlyTimestamp(request.createdAt)
                          : null}
                      </Typography>
                    </Stack>
                    {request.message ? (
                      <Typography variant="body2" color="text.secondary">
                        “{request.message}”
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleRespondToFriendRequest(request.id, 'accept')}
                        disabled={isUpdating}
                      >
                        {isUpdating ? 'Updating…' : 'Accept'}
                      </Button>
                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => handleRespondToFriendRequest(request.id, 'decline')}
                        disabled={isUpdating}
                      >
                        Decline
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFriendDialog} disabled={respondingRequestId !== null}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(pushNotifications.status)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          pushNotifications.setStatus(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {pushNotifications.status ? (
          <Alert
            elevation={6}
            variant="filled"
            severity={pushNotifications.status.type || 'info'}
            onClose={() => pushNotifications.setStatus(null)}
          >
            {pushNotifications.status.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  </Box>
  );
}

export default UpdatesPage;
