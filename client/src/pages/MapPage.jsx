import { useCallback, useEffect, useMemo, useState } from 'react';
import '../pages/MapPage.css';
import { useNavigate } from 'react-router-dom';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';

import Map from '../components/Map';
import Navbar from '../components/Navbar';
import updatesIcon from '../assets/UpdateIcon.svg';
import addIcon from '../assets/AddIcon.svg';
import filterIcon from '../assets/FilterIcon.svg';
import { routes } from '../routes';
import { useLocationContext } from '../contexts/LocationContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useUpdates } from '../contexts/UpdatesContext';
import useMapExplorer, { DEFAULT_MAX_DISTANCE_METERS } from '../hooks/useMapExplorer';
import MapHeader from '../components/map/MapHeader';
import MapFilterPanel from '../components/map/MapFilterPanel';
import { MAP_FILTERS } from '../utils/mapMarkers';


export const pageConfig = {
  id: 'map',
  label: 'Map',
  icon: MapIcon,
  path: '/map',
  order: 1,
  protected: true,
  showInNav: true
};

function MapPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleFilters = () => setFiltersOpen((prev) => !prev);
  const closeFilters = () => setFiltersOpen(false);
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
    selectedChatRoomId,
    viewerProfile
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

  const filterItems = useMemo(
    () =>
      MAP_FILTERS.map((filter) => {
        if (filter.key === 'event') {
          return { ...filter, checked: showEvents, onChange: handleToggleEvents };
        }
        if (filter.key === 'discussion') {
          return { ...filter, checked: showDiscussions, onChange: handleToggleDiscussions };
        }
        if (filter.key === 'personal') {
          return { ...filter, checked: showPersonalPins, onChange: handleTogglePersonalPins };
        }
        return filter;
      }),
    [handleToggleDiscussions, handleToggleEvents, handleTogglePersonalPins, showDiscussions, showEvents, showPersonalPins]
  );

  return (
    <div className="map-page">
      <div className="map-frame">
        <MapHeader
          onNotifications={handleNotifications}
          notificationsLabel={notificationsLabel}
          notificationBadge={displayBadge}
          notificationsIcon={updatesIcon}
          isOffline={isOffline}
        />

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
            currentUserAvatar={viewerProfile?.avatar}
            currentUserDisplayName={viewerProfile?.displayName}
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
          aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
          aria-expanded={filtersOpen}
          onClick={toggleFilters}
        >
          <img src={filterIcon} alt="" className="map-filter-fab__img" aria-hidden="true" />
        </button>

        {/* Filter Panel (collapsible on mobile, always visible on desktop) */}
        <MapFilterPanel open={filtersOpen} onClose={closeFilters} filters={filterItems} />

        {/* Bottom Navigation */}
        <Navbar />
      </div>
    </div>
  );
}

export default MapPage;
