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
import "./UpdatesPage.css";
import {
  fetchCurrentUserProfile,
  fetchUpdates,
  markUpdateRead,
  markAllUpdatesRead
} from '../api/mongoDataApi';
import {
  formatFriendlyTimestamp,
  formatAbsoluteDateTime
} from '../utils/dates';
import { useUpdates } from '../contexts/UpdatesContext';
import { routes } from '../routes';

const noop = () => {};

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
  const [selectedTab, setSelectedTab] = useState("All");
  const [firebaseUser, firebaseLoading] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [updates, setUpdates] = useState([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [updatesError, setUpdatesError] = useState(null);

  const [pendingUpdateIds, setPendingUpdateIds] = useState([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const pendingRefreshRef = useRef(false);

  const {
    setUnreadCount = noop,
    setUnreadDiscussionsCount = noop,
    setUnreadEventsCount = noop
  } = useUpdates();

  const unreadCount = useMemo(
    () => updates.filter((update) => !update.readAt).length,
    [updates]
  );

  const unreadDiscussionsCount = useMemo(
    () => updates.filter((update) => !update.readAt).length,
    [updates]
  );

  const unreadEventsCount = useMemo(
    () => updates.filter((update) => !update.readAt).length,
    [updates]
  );

  useEffect(() => {
    setUnreadCount(unreadCount);
    setUnreadDiscussionsCount(unreadDiscussionsCount);
    setUnreadEventsCount(unreadEventsCount);
  }, [unreadCount, unreadDiscussionsCount, unreadEventsCount,
    setUnreadCount, setUnreadDiscussionsCount, setUnreadEventsCount]);

  // Account/Loading Error Handling 
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

  const handleViewPost = useCallback(async () => {
    return;
  });

  const filteredUpdates = useMemo(() => {
    if (!showUnreadOnly) {
      return updates;
    }
    return updates.filter((update) => !update.readAt);
  }, [showUnreadOnly, updates]);

  const isLoading = isProfileLoading || isLoadingUpdates;

  return (
    <Box className="updates-page">
      <Box className="updates-frame">
        <header className="updates-header-bar">
          <IconButton 
            onClick={() => navigate(-1)} 
            className="updates-header-back-btn"
          >
            <ArrowBackIcon />
          </IconButton>

          <h1 className="updates-header-title">
            Updates
          </h1>

          {/* Legacy Code
          <Box className="unread-notifs-label">
            {unreadCount > 0 ? (
              <Chip label={`${unreadCount}`} color="secondary" size="small" />
            ) : (
              <Chip label="" />
            )}
          </Box>
          */}

          <IconButton 
            className="refresh-btn"
            onClick={handleRefresh} 
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>

          <FormControlLabel
            className="show-unread-toggle"
            control={
              <Switch
                checked={showUnreadOnly}
                onChange={handleToggleUnreadOnly}
                color="primary"
              />
            }
            label="Show unread only"
          />
          
          <Button 
            className="updates-header-clear-btn" 
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead || unreadCount === 0}
          >
            Clear
          </Button>
        </header>

        {/* 3 tab categories that filters updates based on type 
        TODO: Create 2 more unreadCounts for each category */}
        <Box className="updates-tabs-container">
          {[
            { label: "All", count: unreadCount },
            { label: "Discussions", count: unreadDiscussionsCount },
            { label: "Events", count: unreadEventsCount }
          ].map((tab) => (
            <Button
              key={tab.label}
              className={`update-tab ${selectedTab === tab.label ? "active" : ""}`}
              onClick={() => setSelectedTab(tab.label)}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="unread-badge">{tab.count}</span>
              )}
            </Button>
          ))}
        </Box>

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

        {/* Only renders once updates list has loaded */} 
        {isLoading ? (
          <Box className="loading-bar-container">
            <CircularProgress />
            <Typography className="loading-bar-label">
              Loading updates...
            </Typography>
          </Box>
        ) : filteredUpdates.length === 0 ? (
          
          <Paper
            className="empty-updates-msg"
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 3,
              borderColor: 'divider',
            }}
          >
            <NotificationsActiveIcon 
              className="notification-icon"
              color="disabled" 
              fontSize="large" 
            />

            <Typography 
              className="empty-updates-msg-title"
              variant="h6" 
              sx={{ mt: 2 }}
            >
              Nothing new yet
            </Typography>

            <Typography 
              className="empty-updates-msg-body"
              variant="body2" 
              color="text.secondary"
            >
              Stay tuned — new activity on your pins and chats will show up here.
            </Typography>
          </Paper>
        
        ) : (
          <Box className="updates-list">
            {filteredUpdates.map((update) => {
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
                  className="update-card"
                  key={update._id}
                  sx={{
                    borderColor: read ? 'divider' : 'secondary.main',
                    backgroundColor: read ? 'background.paper' : 'rgba(144, 202, 249, 0.04)'
                  }}
                >
                  {/* Header of the update card, consisting of a pinTitle and time of update */}
                  <Box className="update-header">
                    <Chip
                        label={displayTypeLabel}
                        size="small"
                        color={read ? 'default' : 'secondary'}
                      />

                    {pinTitle ? 
                      <Chip label={pinTitle} 
                      size="small" 
                      color="black" 
                      variant="outlined" 
                      /> 
                    : null}

                    {/* Time Label */}
                    <Typography
                      className="update-time"
                      title={formatAbsoluteDateTime(update.createdAt) || undefined}
                    >
                      {formatFriendlyTimestamp(update.createdAt) || ''}
                    </Typography>
                  </Box>

                  <Typography 
                    className="update-title"
                    variant="h6"
                  >
                    {update.payload?.title}
                  </Typography>

                  {/* TODO: Make a little circle indicator for unread messages */}
                  <Box className="unread-update-indicator"> 
                    !unread ? (
                      o
                    )
                  </Box>

                  {/* Text body of the update card */}
                  <Box>
                    {message ? (
                      <Typography className="update-message">
                        {message}
                      </Typography>
                    ) : null}
                  </Box>
                  
                  {update.payload?.avatars?.length > 0 && (
                    <Box className="avatar-row">
                      {update.payload.avatars.map((src, idx) => (
                        <img key={idx} src={src} alt="participant" className="avatar" />
                      ))}
                    </Box>
                  )}

                  {/* Badge handling */}
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

                <Stack direction="row" spacing={1}>
                  {pinId ? (
                    <Button
                      component={Link}
                      to={routes.pin.byId(pinId)}
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

                </Paper>
              );
            })}
          </Box>
        )}
        <Box className="updates-list">
          {filteredUpdates.map((update) => (
            <Paper key={update._id} className="update-card">
              <Typography className="update-title">
                <span className="update-highlight">{update.payload?.category || 'Event'}:</span>{' '}
                {update.payload?.title}
              </Typography>
              <Button variant="contained" className="view-button">
                View
              </Button>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>      
  );
}

export default UpdatesPage;

