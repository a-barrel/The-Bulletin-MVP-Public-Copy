/* NOTE: Page exports configuration alongside the component. */
import runtimeConfig from '../config/runtime';
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import UpdateIcon from '@mui/icons-material/Update';
import './UpdatesPage.css';
import useUpdatesFeed from '../hooks/useUpdatesFeed';
import usePushNotifications from '../hooks/usePushNotifications';
import GlobalNavMenu from '../components/GlobalNavMenu';
import MainNavBackButton from '../components/MainNavBackButton';
import UpdatesTabs from '../components/updates/UpdatesTabs';
import PushNotificationPrompt from '../components/updates/PushNotificationPrompt';
import UpdatesList from '../components/updates/UpdatesList';

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
  const [selectedTab, setSelectedTab] = useState('All');
  const [secondaryTab, setSecondaryTab] = useState('All');
  const pushNotifications = usePushNotifications();
  const [expandedUpdateId, setExpandedUpdateId] = useState(null);
  const handleToggleExpand = (id) => {
    setExpandedUpdateId((prev) => (prev === id ? null : id));
  };
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
    handleDeleteUpdate,
    handleClearAllUpdates
  } = useUpdatesFeed();

  const isLoading = isProfileLoading || isLoadingUpdates;
  const isAnyDeletePending = deletingUpdateIds.length > 0;

  const { unreadDiscussionsCount, unreadEventsCount, unreadBadgesCount, unreadBookmarkCount, unreadTimeCount } = useMemo(() => {
    const counts = {
      unreadDiscussionsCount: 0,
      unreadEventsCount: 0,
      unreadBadgesCount: 0,
      unreadBookmarkCount: 0,
      unreadTimeCount: 0
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
      if (category === 'badge') {
        counts.unreadBadgesCount += 1;
      }
      if (category === 'bookmark') {
        counts.unreadBookmarkCount += 1;
      }
      if (category === 'time') {
        counts.unreadTimeCount += 1;
      }
    });

    return counts;
  }, [updates]);

  const tabFilteredUpdates = useMemo(() => {
    const normalizedFilteredUpdates = Array.isArray(filteredUpdates) ? filteredUpdates : [];
    const primaryFiltered = (() => {
      if (selectedTab === 'All') {
        return normalizedFilteredUpdates;
      }
      return normalizedFilteredUpdates.filter((update) => {
        const category = (update.category || '').toLowerCase();
        if (selectedTab === 'Discussions') {
          return category === 'discussion';
        }
        if (selectedTab === 'Events') {
          return category === 'event';
        }
        return true;
      });
    })();

    if (secondaryTab === 'All') {
      return primaryFiltered;
    }

    return primaryFiltered.filter((update) => {
      const category = (update.category || '').toLowerCase();
      if (secondaryTab === 'Badges') {
        return category === 'badge';
      }
      if (secondaryTab === 'Bookmarks') {
        return category === 'bookmark';
      }
      if (secondaryTab === 'Time') {
        return category === 'time' || category === 'event' || category === 'discussion';
      }
      return true;
    });
  }, [filteredUpdates, secondaryTab, selectedTab]);

  return (
    <Box className="updates-page">
      <Box ref={containerRef} className="updates-frame">
        <header className="updates-header-bar">
          <div className="updates-header-actions">
            <MainNavBackButton
              className="updates-header-back-btn"
              iconClassName="updates-header-back-icon"
              ariaLabel="Back to main view"
              scope="core"
            />
            <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
          </div>

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
        <UpdatesTabs
          tabs={[
            { label: 'All', count: unreadCount },
            { label: 'Discussions', count: unreadDiscussionsCount },
            { label: 'Events', count: unreadEventsCount }
          ]}
          selected={selectedTab}
          onSelect={setSelectedTab}
        />

        <UpdatesTabs
          tabs={[
            { label: 'Badges', count: unreadBadgesCount },
            { label: 'Bookmarks', count: unreadBookmarkCount },
            { label: 'Time', count: unreadTimeCount }
          ]}
          selected={secondaryTab}
          onSelect={setSecondaryTab}
        />

        {pushNotifications.isSupported &&
        pushNotifications.permission !== 'granted' &&
        !pushNotifications.promptDismissed ? (
          <PushNotificationPrompt
            onEnable={pushNotifications.requestPermission}
            onDismiss={pushNotifications.dismissPrompt}
            disabled={pushNotifications.isEnabling}
          />
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
            <UpdatesList
              updates={tabFilteredUpdates}
              expandedUpdateId={expandedUpdateId}
              onToggleExpand={handleToggleExpand}
              pendingUpdateIds={pendingUpdateIds}
              deletingUpdateIds={deletingUpdateIds}
              onMarkRead={handleMarkRead}
              onDeleteUpdate={handleDeleteUpdate}
              pullDistance={pullDistance}
              isPullRefreshing={isPullRefreshing}
              resolveBadgeImageUrl={resolveBadgeImageUrl}
            />
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
