import runtimeConfig from '../config/runtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import UpdateIcon from '@mui/icons-material/Update';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase';
import {
  fetchCurrentUserProfile,
  fetchUpdates,
  markUpdateRead,
  markAllUpdatesRead
} from '../api/mongoDataApi';
import { useUpdates } from '../contexts/UpdatesContext';

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

const formatRelativeTime = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiff = Math.abs(diffMs);

  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000]
  ];

  for (const [unit, ms] of units) {
    if (absDiff >= ms || unit === 'second') {
      const valueRounded = Math.round(diffMs / ms);
      const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return formatter.format(valueRounded, unit);
    }
  }

  return '';
};

const formatAbsoluteDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

function UpdatesPage() {
  const navigate = useNavigate();
  const [firebaseUser, firebaseLoading] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [updates, setUpdates] = useState([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [updatesError, setUpdatesError] = useState(null);

  const [pendingUpdateIds, setPendingUpdateIds] = useState([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const pendingRefreshRef = useRef(false);

  const { setUnreadCount } = useUpdates();

  const unreadCount = useMemo(
    () => updates.filter((update) => !update.readAt).length,
    [updates]
  );

  useEffect(() => {
    setUnreadCount(unreadCount);
  }, [unreadCount, setUnreadCount]);

  useEffect(() => {
    if (firebaseLoading) {
      return;
    }

    if (!firebaseUser) {
      setProfile(null);
      setProfileError('Sign in to view your updates.');
      setIsProfileLoading(false);
      return;
    }

    let isCancelled = false;
    async function loadProfile() {
      setIsProfileLoading(true);
      setProfileError(null);
      try {
        const result = await fetchCurrentUserProfile();
        if (!isCancelled) {
          setProfile(result);
        }
      } catch (error) {
        if (!isCancelled) {
          setProfile(null);
          setProfileError(error?.message || 'Failed to load profile information.');
        }
      } finally {
        if (!isCancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, [firebaseLoading, firebaseUser]);

  const loadUpdates = useCallback(
    async ({ silent } = {}) => {
      if (!profile?._id) {
        return;
      }

      if (!silent) {
        setIsLoadingUpdates(true);
      }
      setUpdatesError(null);
      pendingRefreshRef.current = true;
      try {
        const result = await fetchUpdates({ userId: profile._id, limit: 100 });
        setUpdates(result);
      } catch (error) {
        setUpdates([]);
        setUpdatesError(error?.message || 'Failed to load updates.');
      } finally {
        pendingRefreshRef.current = false;
        setIsLoadingUpdates(false);
      }
    },
    [profile?._id]
  );

  useEffect(() => {
    if (profile?._id) {
      loadUpdates({ silent: true });
    }
  }, [profile?._id, loadUpdates]);

  const handleRefresh = useCallback(() => {
    if (!pendingRefreshRef.current) {
      loadUpdates();
    }
  }, [loadUpdates]);

  const handleToggleUnreadOnly = useCallback((event) => {
    setShowUnreadOnly(Boolean(event?.target?.checked));
  }, []);

  const handleMarkRead = useCallback(
    async (updateId) => {
      if (!updateId) {
        return;
      }
      setPendingUpdateIds((prev) => (prev.includes(updateId) ? prev : [...prev, updateId]));
      try {
        const updated = await markUpdateRead(updateId);
        setUpdates((prev) =>
          prev.map((item) => (item._id === updated._id ? { ...item, ...updated } : item))
        );
      } catch (error) {
        setUpdatesError(error?.message || 'Failed to mark update as read.');
      } finally {
        setPendingUpdateIds((prev) => prev.filter((value) => value !== updateId));
      }
    },
    []
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!updates.length || unreadCount === 0) {
      return;
    }
    setIsMarkingAllRead(true);
    setUpdatesError(null);
    try {
      const result = await markAllUpdatesRead();
      const readAt = result?.readAt ? new Date(result.readAt).toISOString() : new Date().toISOString();
      setUpdates((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt })));
    } catch (error) {
      setUpdatesError(error?.message || 'Failed to mark updates as read.');
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [unreadCount, updates.length]);

  const filteredUpdates = useMemo(() => {
    if (!showUnreadOnly) {
      return updates;
    }
    return updates.filter((update) => !update.readAt);
  }, [showUnreadOnly, updates]);

  const isLoading = isProfileLoading || isLoadingUpdates;

  return (
    <Box
      component="section"
      sx={{
        width: '100%',
        maxWidth: 840,
        mx: 'auto',
        py: { xs: 3, md: 4 },
        px: { xs: 2, md: 4 }
      }}
    >
      <Stack spacing={3}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate(-1)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back
        </Button>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <UpdateIcon color="primary" />
            <Typography variant="h4" component="h1">
              Updates
            </Typography>
            {unreadCount > 0 ? (
              <Chip label={`${unreadCount} unread`} color="secondary" size="small" />
            ) : (
              <Chip label="All caught up" color="success" size="small" />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={handleRefresh} disabled={isLoading}>
                  {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Mark all as read">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DoneAllIcon fontSize="small" />}
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAllRead || unreadCount === 0}
                >
                  {isMarkingAllRead ? 'Marking...' : 'Mark all read'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {profileError ? (
          <Alert severity="warning" variant="outlined">
            {profileError}
          </Alert>
        ) : null}

        {updatesError ? (
          <Alert severity="error" onClose={() => setUpdatesError(null)}>
            {updatesError}
          </Alert>
        ) : null}

        <FormControlLabel
          control={
            <Switch
              checked={showUnreadOnly}
              onChange={handleToggleUnreadOnly}
              color="primary"
            />
          }
          label="Show unread only"
        />

        {isLoading ? (
          <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading updates...
            </Typography>
          </Stack>
        ) : filteredUpdates.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 3,
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center'
            }}
          >
            <NotificationsActiveIcon color="disabled" fontSize="large" />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Nothing new yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stay tuned — new activity on your pins and chats will show up here.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {filteredUpdates.map((update) => {
              const createdAtLabel = formatRelativeTime(update.createdAt);
              const createdAtExact = formatAbsoluteDate(update.createdAt);
              const read = Boolean(update.readAt);
              const pending = pendingUpdateIds.includes(update._id);
              const message = update.payload?.body;
              const pinTitle = update.payload?.pin?.title;
              const pinId = update.payload?.pin?._id;
              const typeKey = update.payload?.type ?? 'update';
              const displayTypeLabel = typeKey.replace(/-/g, ' ');
              const isBadgeUpdate = typeKey === 'badge-earned';
              const badgeId = update.payload?.metadata?.badgeId;
              const badgeImage = update.payload?.metadata?.badgeImage;
              const badgeImageUrl = badgeImage ? resolveBadgeImageUrl(badgeImage) : null;

              return (
                <Paper
                  key={update._id}
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    borderColor: read ? 'divider' : 'secondary.main',
                    backgroundColor: read ? 'background.paper' : 'rgba(144, 202, 249, 0.04)'
                  }}
                >
                  <Stack spacing={1.5} sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={displayTypeLabel}
                          size="small"
                          color={read ? 'default' : 'secondary'}
                        />
                        {pinTitle ? <Chip label={pinTitle} size="small" variant="outlined" /> : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" title={createdAtExact}>
                        {createdAtLabel}
                      </Typography>
                    </Stack>

                    <Typography variant="h6">{update.payload?.title}</Typography>

                    {message ? (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message}
                      </Typography>
                    ) : null}

                    {isBadgeUpdate && badgeImageUrl ? (
                      <Box
                        component="img"
                        src={badgeImageUrl || undefined}
                        alt={badgeId ? `${badgeId} badge` : 'Badge earned'}
                        sx={{
                          width: { xs: 96, sm: 128 },
                          height: { xs: 96, sm: 128 },
                          borderRadius: 3,
                          alignSelf: 'flex-start',
                          border: (theme) => `1px solid ${theme.palette.divider}`,
                          objectFit: 'cover'
                        }}
                      />
                    ) : null}

                    <Divider />

                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1}>
                        {pinId ? (
                          <Button
                            component={Link}
                            to={`/pin/${pinId}`}
                            size="small"
                            variant="outlined"
                          >
                            View pin
                          </Button>
                        ) : null}
                      </Stack>
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
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default UpdatesPage;







