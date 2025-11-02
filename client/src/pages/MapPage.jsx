import { useCallback, useEffect } from 'react';
import '../pages/MapPage.css';
import { useNavigate } from 'react-router-dom';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';

import Map from '../components/Map';
import GlobalNavMenu from '../components/GlobalNavMenu';
import Navbar from '../components/Navbar';
import updatesIcon from '../assets/UpdateIcon.svg';
import addIcon from '../assets/AddIcon.svg';
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

function MapPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();

  const {
    userLocation,
    nearbyUsers,
    combinedPins,
    showChatRooms,
    setShowChatRooms,
    isSharing,
    shareDisabled,
    shareHelperText,
    handleStartSharing,
    handleStopSharing,
    handleSpoofMove,
    spoofStepMiles,
    setSpoofStepMiles,
    handleMapPinSelect,
    selectedChatRoomId
  } = useMapExplorer({
    sharedLocation,
    setSharedLocation,
    isOffline
  });

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
      navigate(routes.pin.byId(pinId));
    },
    [navigate]
  );

  const handleViewChatRoom = useCallback(() => {
    navigate(routes.chat.base);
  }, [navigate]);

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
            pins={combinedPins}
            userRadiusMeters={DEFAULT_MAX_DISTANCE_METERS}
            selectedPinId={showChatRooms ? selectedChatRoomId : undefined}
            onPinSelect={showChatRooms ? handleMapPinSelect : undefined}
            onPinView={handleViewPinDetails}
            onChatRoomView={handleViewChatRoom}
            onCurrentUserView={handleViewProfile}
            isOffline={isOffline}
          />
        </Box>

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

        <Navbar />
      </div>
    </div>
  );
}

export default MapPage;
