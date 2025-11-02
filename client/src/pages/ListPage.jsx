/* NOTE: Page exports configuration alongside the component. */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ListPage.css';
import Navbar from '../components/Navbar';
import SortToggle from '../components/SortToggle';
import settingsIcon from '../assets/GearIcon.svg';
import addIcon from '../assets/AddIcon.svg';
import updatesIcon from '../assets/UpdateIcon.svg';
import Feed from '../components/Feed';
import GlobalNavMenu from '../components/GlobalNavMenu';
import PlaceIcon from '@mui/icons-material/Place';
import { useUpdates } from '../contexts/UpdatesContext';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useLocationContext } from '../contexts/LocationContext';
import toIdString from '../utils/ids';
import useNearbyPinsFeed from '../hooks/useNearbyPinsFeed';

export const pageConfig = {
  id: 'list',
  label: 'List',
  icon: PlaceIcon,
  path: '/list',
  order: 4,
  showInNav: true,
  protected: true,
};

export default function ListPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: sharedLocation } = useLocationContext();
  const [sortByExpiration, setSortByExpiration] = useState(false);
  const {
    feedItems,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation
  } = useNearbyPinsFeed({ sharedLocation, isOffline });

  const { unreadCount, refreshUnreadCount } = useUpdates();

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const handleSortToggle = useCallback(() => {
    setSortByExpiration((prev) => !prev);
  }, []);
  const handleNotifications = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.updates.base);
  }, [isOffline, navigate]);
  const handleCreatePin = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.createPin.base);
  }, [isOffline, navigate]);
  const handleSettings = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.settings.base);
  }, [isOffline, navigate]);
  const handleFeedItemSelect = useCallback(
    (pinId) => {
      const normalized = toIdString(pinId);
      if (!normalized) {
        return;
      }
      navigate(routes.pin.byId(normalized));
    },
    [navigate]
  );
  const handleFeedAuthorSelect = useCallback(
    (creatorId) => {
      const normalized = toIdString(creatorId);
      if (!normalized) {
        return;
      }
      navigate(routes.profile.byId(normalized));
    },
    [navigate]
  );

  const filteredAndSortedFeed = useMemo(() => {
    const activeItems = feedItems.filter((item) => {
      if (item.expiresInHours === null) {
        return true;
      }
      return item.expiresInHours > 0;
    });

    const sortedItems = [...activeItems].sort((a, b) => {
      if (sortByExpiration) {
        const hoursA = Number.isFinite(a.expiresInHours) ? a.expiresInHours : Number.POSITIVE_INFINITY;
        const hoursB = Number.isFinite(b.expiresInHours) ? b.expiresInHours : Number.POSITIVE_INFINITY;
        if (hoursA !== hoursB) {
          return hoursA - hoursB;
        }
      } else {
        const distanceA = Number.isFinite(a.distanceMiles) ? a.distanceMiles : Number.POSITIVE_INFINITY;
        const distanceB = Number.isFinite(b.distanceMiles) ? b.distanceMiles : Number.POSITIVE_INFINITY;
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
      }

      const textA = a.text || "";
      const textB = b.text || "";
      return textA.localeCompare(textB);
    });

    return sortedItems;
  }, [feedItems, sortByExpiration]);

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* Header */}
        <header className="header-bar">
          <GlobalNavMenu />
          <h1 className="header-title">List</h1>
          <button
            className="header-icon-btn"
            type="button"
            aria-label={notificationsLabel}
            onClick={handleNotifications}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to view updates' : undefined}
          >
            <img src={updatesIcon} alt="" className="header-icon" aria-hidden="true" />
            {displayBadge ? (
              <span className="header-icon-badge" aria-hidden="true">
                {displayBadge}
              </span>
            ) : null}
          </button>
        </header>

        {/* Topbar */}
        <div className="topbar">
          <div className="top-left">
            <button
              className="icon-btn"
              type="button"
              aria-label="Settings"
              onClick={handleSettings}
              disabled={isOffline}
              title={isOffline ? 'Settings unavailable offline' : undefined}
            >
              <img src={settingsIcon} alt="Settings" />
            </button>

            {/* Sort Toggle */}
            <SortToggle sortByExpiration={sortByExpiration} onToggle={handleSortToggle} />
          </div>

          <button
            className="add-btn"
            type="button"
            aria-label="Create pin"
            onClick={handleCreatePin}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to create a pin' : undefined}
          >
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {loading && <p>Loading...</p>}
        {locationNotice && !loading && <p>{locationNotice}</p>}
        {error && <p>Error: {error}</p>}

        {!loading && !error && (
          <Feed
            items={filteredAndSortedFeed}
            isUsingFallbackLocation={isUsingFallbackLocation}
            onSelectItem={handleFeedItemSelect}
            onSelectAuthor={handleFeedAuthorSelect}
          />
        )}

        <Navbar />
      </div>
    </div>
  );
}
