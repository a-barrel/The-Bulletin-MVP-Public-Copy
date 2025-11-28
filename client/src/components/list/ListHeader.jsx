import { memo } from 'react';
import GlobalNavMenu from '../GlobalNavMenu';
import updatesIcon from '../../assets/UpdateIcon.svg';

function buildBadge(unreadCount) {
  if (!unreadCount) return null;
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

function ListHeader({ unreadCount, onNotifications, isOffline }) {
  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = buildBadge(unreadCount);

  return (
    <header className="header-bar">
      <GlobalNavMenu />
      <h1 className="header-title">List</h1>
      <button
        className="header-icon-btn"
        type="button"
        aria-label={notificationsLabel}
        onClick={onNotifications}
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
  );
}

export default memo(ListHeader);
