/* NOTE: Page exports configuration alongside the component. */
import runtimeConfig from '../config/runtime';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import UpdateIcon from '@mui/icons-material/Update';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './UpdatesPage.css';
import {
  formatFriendlyTimestamp,
  formatAbsoluteDateTime,
  formatRelativeTime
} from '../utils/dates';
import useUpdatesFeed from '../hooks/useUpdatesFeed';
import { routes } from '../routes';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

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
  const incomingRequests = socialNotifications.friendData?.incomingRequests || [];
  const hasFriendRequests = !socialNotifications.friendAccessDenied && incomingRequests.length > 0;
  const friendRequestsPreview = incomingRequests.slice(0, 3);
  const remainingFriendRequests = Math.max(0, incomingRequests.length - friendRequestsPreview.length);
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [friendActionStatus, setFriendActionStatus] = useState(null);

  const {
    profileError,
    isProfileLoading,
    filteredUpdates,
    updates,
    isLoadingUpdates,
    updatesError,
    showUnreadOnly,
    pendingUpdateIds,
    isMarkingAllRead,
    unreadCount,
    handleDismissUpdatesError,
    handleToggleUnreadOnly,
    handleRefresh,
    handleMarkRead,
    handleMarkAllRead
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
      const category = (update.payload?.category || update.payload?.type || '').toLowerCase();
      if (category.includes('discussion')) {
        counts.unreadDiscussionsCount += 1;
      }
      if (category.includes('event')) {
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
      const category = (update.payload?.category || update.payload?.type || '').toLowerCase();
      if (selectedTab === 'Discussions') {
        return category.includes('discussion');
      }
      if (selectedTab === 'Events') {
        return category.includes('event');
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
      <Box className="updates-frame">
        <header className="updates-header-bar">
          <IconButton onClick={() => navigate(-1)} className="updates-header-back-btn">
            <ArrowBackIcon />
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

        {hasFriendRequests ? (
          <Paper
            elevation={1}
            sx={{
              mt: 3,
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
                  {incomingRequests.length === 1
                    ? '1 person is waiting for your response.'
                    : `${incomingRequests.length} people are waiting for your response.`}
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                  {friendRequestsPreview.map((request) => (
                    <Chip
                      key={request.id}
                      label={
                        request.requester?.displayName ||
                        request.requester?.username ||
                        request.requester?.id ||
                        'Unknown user'
                      }
                      color="secondary"
                      variant="outlined"
                    />
                  ))}
                  {remainingFriendRequests > 0 ? (
                    <Chip label={`+${remainingFriendRequests} more`} variant="outlined" />
                  ) : null}
                </Stack>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleOpenFriendDialog}
                disabled={socialNotifications.friendIsLoading || respondingRequestId !== null}
                sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
              >
                Review requests
              </Button>
            </Stack>
          </Paper>
        ) : null}

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
            {tabFilteredUpdates.map((update) => {
              const read = Boolean(update.readAt);
              const pending = pendingUpdateIds.includes(update._id);
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

                    {pinTitle ? <Chip label={pinTitle} size="small" variant="outlined" /> : null}

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
                      <Button component={Link} to={routes.pin.byId(pinId)} size="small" variant="outlined">
                        View pin
                      </Button>
                    ) : null}

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
                        disabled={pending}
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
    </Box>
  );
}

export default UpdatesPage;
