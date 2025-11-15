import GlobalNavMenu from '../GlobalNavMenu';

function MapHeader({
  onNotifications,
  notificationsLabel,
  notificationBadge,
  notificationsIcon,
  isOffline
}) {
  return (
    <header className="map-header">
      <GlobalNavMenu triggerClassName="map-icon-btn" iconClassName="map-icon" />

      <h1 className="map-title">Map</h1>

      <button
        className="map-icon-btn"
        type="button"
        aria-label={notificationsLabel}
        onClick={onNotifications}
        disabled={isOffline}
        title={isOffline ? 'Reconnect to view updates' : undefined}
      >
        {notificationsIcon ? (
          <img src={notificationsIcon} alt="" className="map-icon" aria-hidden="true" />
        ) : (
          <span className="map-icon" aria-hidden="true" />
        )}
        {notificationBadge ? (
          <span className="map-icon-badge" aria-hidden="true">
            {notificationBadge}
          </span>
        ) : null}
      </button>
    </header>
  );
}

export default MapHeader;
