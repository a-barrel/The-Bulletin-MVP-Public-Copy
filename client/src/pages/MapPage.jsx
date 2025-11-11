import { useCallback, useEffect, useMemo, useState } from 'react';
import '../pages/MapPage.css';
import { useNavigate } from 'react-router-dom';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';

import Map from '../components/Map';
import GlobalNavMenu from '../components/GlobalNavMenu';
import Navbar from '../components/Navbar';
import updatesIcon from '../assets/UpdateIcon.svg';
import addIcon from '../assets/AddIcon.svg';
import filterIcon from '../assets/FilterIcon.svg';
import { routes } from '../routes';
import { useLocationContext } from '../contexts/LocationContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useUpdates } from '../contexts/UpdatesContext';
import useMapExplorer, { DEFAULT_MAX_DISTANCE_METERS } from '../hooks/useMapExplorer';


export const pageConfig = {
  id: 'map',
  label: 'Map',
  icon: MapIcon,
  path: '/map',
  order: 1,
  protected: true,
  showInNav: true
};

const EVENT_MARKER_ICON =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png';
const DISCUSSION_MARKER_ICON =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
const PERSONAL_MARKER_ICON =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png';

function MapPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleFilters = () => setFiltersOpen(v => !v);
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();

  const {
    userLocation,
    nearbyUsers,
    combinedPins,
    showChatRooms,
    handleMapPinSelect,
    selectedChatRoomId
  } = useMapExplorer({
    sharedLocation,
    setSharedLocation,
    isOffline
  });

  const [showEvents, setShowEvents] = useState(true);
  const [showDiscussions, setShowDiscussions] = useState(true);
  const [showPersonalPins, setShowPersonalPins] = useState(true);

  const filteredPins = useMemo(() => {
    if (!Array.isArray(combinedPins)) {
      return [];
    }

    return combinedPins.filter((pin) => {
      if (!pin || typeof pin !== 'object') {
        return false;
      }

      const type = typeof pin.type === 'string' ? pin.type.toLowerCase() : '';

      if (type === 'event' && !showEvents) {
        return false;
      }

      if (type === 'discussion' && !showDiscussions) {
        return false;
      }

      if ((pin.isSelf || pin.viewerIsCreator) && !showPersonalPins) {
        return false;
      }

      return true;
    });
  }, [combinedPins, showDiscussions, showEvents, showPersonalPins]);

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const handleViewPinDetails = useCallback(
    (pin) => {
      if (!pin) {
        return;
      }
      const pinId = pin._id ?? pin.id ?? null;
      if (!pinId) {
        return;
      }
      navigate(routes.pin.byId(pinId), { state: { pin } });
    },
    [navigate]
  );

  const handleViewChatRoom = useCallback(() => {
    navigate(routes.chat.base);
  }, [navigate]);

  const handleToggleEvents = useCallback((event) => {
    setShowEvents(Boolean(event?.target?.checked));
  }, []);

  const handleToggleDiscussions = useCallback((event) => {
    setShowDiscussions(Boolean(event?.target?.checked));
  }, []);

  const handleTogglePersonalPins = useCallback((event) => {
    setShowPersonalPins(Boolean(event?.target?.checked));
  }, []);

  const handleViewProfile = useCallback(() => {
    navigate(routes.profile.me);
  }, [navigate]);

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

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  return (
    <div className="map-page">
      <div className="map-frame">
        <header className="map-header">
          <GlobalNavMenu triggerClassName="map-icon-btn" iconClassName="map-icon" />

          <h1 className="map-title">Map</h1>

          <button
            className="map-icon-btn"
            type="button"
            aria-label={notificationsLabel}
            onClick={handleNotifications}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to view updates' : undefined}
          >
            <img src={updatesIcon} alt="" className="map-icon" aria-hidden="true" />
            {displayBadge ? (
              <span className="map-icon-badge" aria-hidden="true">
                {displayBadge}
              </span>
            ) : null}
          </button>
        </header>

        <Box
          sx={{
            width: '100%',
            height: 'calc(100vh - var(--header-h) - 90px)',
            position: 'relative',
            flex: '1 1 auto',
            maxWidth: '100%',
            p: 0,
            m: 0,
            overflow: 'hidden',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper'
          }}
        >
          <Map
            userLocation={userLocation}
            nearbyUsers={nearbyUsers}
            pins={filteredPins}
            userRadiusMeters={DEFAULT_MAX_DISTANCE_METERS}
            selectedPinId={showChatRooms ? selectedChatRoomId : undefined}
            onPinSelect={showChatRooms ? handleMapPinSelect : undefined}
            onPinView={handleViewPinDetails}
            onChatRoomView={handleViewChatRoom}
            onCurrentUserView={handleViewProfile}
            isOffline={isOffline}
          />
        </Box>

        {/* Floating Add Button (always visible) */}
        <button
          className="map-add-btn"
          type="button"
          aria-label="Create pin"
          onClick={handleCreatePin}
          disabled={isOffline}
          title={isOffline ? 'Reconnect to create a pin' : undefined}
        >
          <img src={addIcon} alt="" aria-hidden="true" />
        </button>

        {/* NEW: Filter FAB (mobile-only) */}
        <button
          className="map-filter-fab"
          type="button"
          aria-label="Open filters"
          aria-expanded={filtersOpen}
          onClick={toggleFilters}
        >
          <img src={filterIcon} alt="" className="map-filter-fab__img" aria-hidden="true" />
        </button>

        {/* Filter Panel (collapsible on mobile, always visible on desktop) */}
        <div
          className={`map-filter-panel ${filtersOpen ? 'is-open' : ''}`}
          role="group"
          aria-label="Pin visibility filters"
        >
          {/* ===== Filter: Events ===== */}
          <label className="map-filter-toggle">
            <img
              src={EVENT_MARKER_ICON}
              alt=""
              className="map-filter-icon"
              aria-hidden="true"
            />
            <span className="map-filter-label">Events</span>
            <input
              type="checkbox"
              checked={showEvents}
              onChange={handleToggleEvents}
              aria-label="Toggle event pins"
            />
            <span className="map-filter-slider" aria-hidden="true" />
          </label>

          {/* ===== Filter: Discussions ===== */}
          <label className="map-filter-toggle">
            <img
              src={DISCUSSION_MARKER_ICON}
              alt=""
              className="map-filter-icon"
              aria-hidden="true"
            />
            <span className="map-filter-label">Discussions</span>
            <input
              type="checkbox"
              checked={showDiscussions}
              onChange={handleToggleDiscussions}
              aria-label="Toggle discussion pins"
            />
            <span className="map-filter-slider" aria-hidden="true" />
          </label>

          {/* ===== Filter: Personal Pins ===== */}
          <label className="map-filter-toggle">
            <img
              src={PERSONAL_MARKER_ICON}
              alt=""
              className="map-filter-icon"
              aria-hidden="true"
            />
            <span className="map-filter-label">Personal pins</span>
            <input
              type="checkbox"
              checked={showPersonalPins}
              onChange={handleTogglePersonalPins}
              aria-label="Toggle your pins"
            />
            <span className="map-filter-slider" aria-hidden="true" />
          </label>
        </div>

        {/* Bottom Navigation */}
      <Navbar />
      </div>
    </div>
  );
}

export default MapPage;
