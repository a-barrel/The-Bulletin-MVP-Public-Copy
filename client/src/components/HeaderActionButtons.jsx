import PropTypes from 'prop-types';
import './HeaderActionButtons.css';
import updatesIcon from '../assets/UpdateIcon.svg';
import addIconPurple from '../assets/AddIconPurple.svg';

function HeaderActionButtons({
  isOffline,
  unreadCount = 0,
  onCreatePin,
  onOpenUpdates,
  notificationsLabel = 'View updates',
  createLabel = 'Create pin',
  children
}) {
  const badge =
    typeof unreadCount === 'number' && unreadCount > 0
      ? unreadCount > 99
        ? '99+'
        : String(unreadCount)
      : null;

  return (
    <div className="map-header-actions header-action-buttons">
      <button
        type="button"
        className="map-icon-btn map-header-create"
        onClick={onCreatePin}
        disabled={isOffline}
      aria-label={createLabel}
      title={isOffline ? 'Reconnect to create pins' : undefined}
    >
      <img src={addIconPurple} alt="" className="map-icon map-icon--create" aria-hidden="true" />
    </button>
    {children}
    <button
      className="map-icon-btn"
      type="button"
      aria-label={notificationsLabel}
      onClick={onOpenUpdates}
      disabled={isOffline}
        title={isOffline ? 'Reconnect to view updates' : undefined}
      >
        <img src={updatesIcon} alt="" className="map-icon" aria-hidden="true" />
        {badge ? (
          <span className="map-icon-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </button>
    </div>
  );
}

HeaderActionButtons.propTypes = {
  isOffline: PropTypes.bool,
  unreadCount: PropTypes.number,
  onCreatePin: PropTypes.func.isRequired,
  onOpenUpdates: PropTypes.func.isRequired,
  notificationsLabel: PropTypes.string,
  createLabel: PropTypes.string,
  children: PropTypes.node
};

HeaderActionButtons.defaultProps = {
  isOffline: false,
  unreadCount: 0,
  notificationsLabel: 'View updates',
  createLabel: 'Create pin',
  children: null
};

export default HeaderActionButtons;
