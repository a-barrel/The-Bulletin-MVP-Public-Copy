import { memo } from 'react';
import { useTranslation } from 'react-i18next';
function MapHeader({
  onNotifications,
  notificationsLabel,
  notificationBadge,
  notificationsIcon,
  isOffline,
  onCreatePin,
  createIcon,
  createLabel
}) {
  const { t } = useTranslation();
  const resolvedCreateLabel = createLabel || t('mapHeader.createPin');
  const resolvedNotificationsLabel = notificationsLabel || t('nav.items.updates.label');

  return (
    <div className="map-header-actions">
      <button
        type="button"
        className="map-icon-btn map-header-create"
        onClick={onCreatePin}
        disabled={isOffline}
        aria-label={resolvedCreateLabel}
        title={isOffline ? t('mapHeader.offlineCreate') : undefined}
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
        aria-label={resolvedNotificationsLabel}
        onClick={onNotifications}
        disabled={isOffline}
        title={isOffline ? t('mapHeader.offlineNotifications') : undefined}
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
  );
}

export default memo(MapHeader);
