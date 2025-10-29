import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import updatesIcon from '../assets/UpdateIcon.svg';
import { routes } from '../routes';
import { useUpdates } from '../contexts/UpdatesContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';

export default function TopTitleBarUpdateIcon({
  className = '',
  onClick,
  disabled: disabledProp,
  title: titleProp
}) {
  const navigate = useNavigate();
  const { unreadCount = 0 } = useUpdates() ?? {};
  const { isOffline } = useNetworkStatusContext() ?? {};

  const disabled = Boolean(disabledProp ?? isOffline);
  const displayBadge = useMemo(() => {
    if (!unreadCount || unreadCount <= 0) {
      return null;
    }
    return unreadCount > 99 ? '99+' : String(unreadCount);
  }, [unreadCount]);

  const notificationsLabel = displayBadge
    ? `Notifications (${displayBadge} unread)`
    : 'Notifications';

  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }
    if (typeof onClick === 'function') {
      onClick();
      return;
    }
    navigate(routes.updates.base);
  }, [disabled, navigate, onClick]);

  const buttonTitle = disabled
    ? 'Reconnect to view updates'
    : titleProp ?? undefined;

  const buttonClassName = ['top-bar__action', 'top-bar__action--updates', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={buttonClassName}
      aria-label={notificationsLabel}
      onClick={handleClick}
      disabled={disabled}
      title={buttonTitle}
    >
      <img src={updatesIcon} alt="" className="top-bar__action-icon" aria-hidden="true" />
      {displayBadge ? (
        <span className="top-bar__badge" aria-hidden="true">
          {displayBadge}
        </span>
      ) : null}
    </button>
  );
}
