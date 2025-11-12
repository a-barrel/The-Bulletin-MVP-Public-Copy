/* NOTE: Page exports configuration alongside the component. */
import runtimeConfig from '../config/runtime';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CloseIcon from '@mui/icons-material/CancelRounded';
import UpdateIcon from '@mui/icons-material/Update';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DropDownArrow from '@mui/icons-material/ArrowForwardIosRounded';
import './UpdatesPage.css';
import {
  formatRelativeTime
} from '../utils/dates';
import useUpdatesFeed from '../hooks/useUpdatesFeed';
import { routes } from '../routes';
import usePushNotifications from '../hooks/usePushNotifications';

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
  const pushNotifications = usePushNotifications();
  const [expandedUpdateId, setExpandedUpdateId] = useState(null);
  const handleToggleExpand = (id) => {
    setExpandedUpdateId((prev) => (prev === id ? null : id));
  };
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
    pendingUpdateIds,
    deletingUpdateIds,
    isMarkingAllRead,
    unreadCount,
    containerRef,
    pullDistance,
    isPullRefreshing,
    handleDismissUpdatesError,
    handleMarkRead,
    handleMarkAllRead,
    handleDeleteUpdate,
    handleClearAllUpdates
  } = useUpdatesFeed();

  const isLoading = isProfileLoading || isLoadingUpdates;
  const isAnyDeletePending = deletingUpdateIds.length > 0;

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

  return (
    <Box className="updates-page">
      <Box ref={containerRef} className="updates-frame">
        <header className="updates-header-bar">
          <IconButton onClick={() => navigate(-1)} className="updates-header-back-btn">
            <ArrowBackIcon className="updates-header-back-icon" />
          </IconButton>

          <h1 className="updates-header-title">Updates</h1>

          <Button
            className="updates-header-clear-btn"
            onClick={handleClearAllUpdates}
            disabled={isMarkingAllRead || unreadCount === 0 || isAnyDeletePending}
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
              className="push-notifs-container"
              severity="info"
              variant="outlined"
              sx={{ mb: 3 }}
              action={
                <Box className="push-notifs-info">
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
                </Box>
              }
            >
              <Box className="push-notifs-description">
                Enable push notifications to get updates even when you're away.
              </Box>
            </Alert>
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
              <Typography className="loading-bar-label"> 
                Loading updates... 
              </Typography>
            </Box>
          ) : tabFilteredUpdates.length === 0 ? (
            <div className="empty-updates-msg-container"> 
              <NotificationsActiveIcon 
                className="notification-icon"
                fontSize="large" 
              />
  
              <Typography 
                className="empty-updates-msg-title"
                variant="h6" 
              >
                Nothing new yet.
              </Typography>
  
              <Typography 
                className="empty-updates-msg-body"
                variant="body2" 
              >
                Stay tuned — new activity on your pins and chats will show up here.
              </Typography>
            </div>     
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
                  <Box
                    className="update-card"
                    key={update._id}
                    onClick={() => handleToggleExpand(update._id)}
                  >
                    {/* Header of the update card, consisting of a pinTitle and time of update */}
                    <Box className="update-header">
                      <Chip
                        label={displayTypeLabel}
                        size="small"
                        color={read ? 'secondary' : 'secondary'}
                      />
  
                      {pinTitle ? 
                        <Typography 
                          className="pin-title"
                          size="small" 
                          color="black" 
                          variant="outlined" 
                        >
                          {pinTitle} 
                        </Typography>
                      : null}
  
                      {/* Time Label */}
                      <Typography className="update-time">
                        {formatRelativeTime(createdAt) || ''}
                      </Typography>
  
                      {!read && (
                      <span className="unread-dot"/>
                      )}
                    </Box>
  
                    <Typography className="update-title">
                      {update.payload?.title}
                    </Typography>
                    
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
  
                    {/* Achievement Badge handling */}
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

                    <Box className="drop-down-arrow-container">
                      <DropDownArrow
                        className="update-action-drop-down-indicator-arrow"
                        sx={{
                          transform: expandedUpdateId === update._id ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}
                      />
                    </Box>
  
                    <Box 
                      className="update-action-container"
                      sx={{
                        maxHeight: expandedUpdateId === update._id ? 200 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 0.3s ease, opacity 0.3s ease',
                        opacity: expandedUpdateId === update._id ? 1 : 0,
                        mt: expandedUpdateId === update._id ? 1.5 : 0
                      }}
                      onClick={(e) => e.stopPropagation()} // prevent collapsing when clicking buttons
                    >

                      {pinId ? (
                        <Button
                          component={Link}
                          to={routes.pin.byId(pinId)}
                          className="view-pin-btn"
                        >
                          View
                        </Button>
                      ) : null}
    
                      {/* Currently there is no way to 'hide' the notifications as before with the toggle, so...
                          TODO: create a way to actually clear updates 
                      */}
                      {!read && (
                      <Button
                        className="mark-as-read-btn"
                        startIcon={<CheckCircleOutlineIcon classname="read-icon" fontSize="small" />}
                        onClick={() => handleMarkRead(update._id)}
                        disabled={pending || isDeleting}
                      >
                        {pending ? 'Marking...' : 'Mark as read'}
                      </Button>
                      )}
                      <Button
                        className="delete-update-btn"
                        startIcon={<CloseIcon className="delete-icon" fontSize="small" />}
                        onClick={() => handleDeleteUpdate(update._id)}
                        disabled={pending || isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    </Box>
                  </Box>
                );
              })}
          </Box>
        )}
      </Box>

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
