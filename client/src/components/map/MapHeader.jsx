import GlobalNavMenu from '../GlobalNavMenu';

function MapHeader({
  onNotifications,
  notificationsLabel,
  notificationBadge,
  notificationsIcon,
  isOffline,
  onCreatePin,
  createIcon,
  createLabel = 'Create pin'
}) {
  return (
    <header className="map-header">
      <GlobalNavMenu triggerClassName="map-icon-btn" iconClassName="map-icon" />

      <h1 className="map-title">Map</h1>

      <div className="map-header-actions">
        <button
          type="button"
          className="map-icon-btn map-header-create"
          onClick={onCreatePin}
          disabled={isOffline}
          aria-label={createLabel}
          title={isOffline ? 'Reconnect to create a pin' : undefined}
        >
          {createIcon ? (
            <img src={createIcon} alt="" className="map-icon map-icon--create" aria-hidden="true" />
          ) : (
            <span className="map-icon map-icon--create" aria-hidden="true" />
          )}
        </button>

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
      </div>
    </header>
  );
}

export default MapHeader;
