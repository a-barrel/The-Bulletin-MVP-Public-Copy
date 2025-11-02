import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuIcon from '../assets/MenuIcon.svg';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import UpdateIcon from '@mui/icons-material/Update';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import './GlobalNavMenu.css';
import { routes } from '../routes';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

const DEFAULT_ITEMS = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'View your profile',
    to: routes.profile.me,
    Icon: AccountCircleIcon
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Adjust preferences',
    to: routes.settings.base,
    Icon: SettingsIcon
  },
  {
    key: 'bookmarks',
    label: 'Bookmarks',
    description: 'See saved pins',
    to: routes.bookmarks.base,
    Icon: BookmarkIcon
  },
  {
    key: 'updates',
    label: 'Updates',
    description: 'Check notifications',
    to: routes.updates.base,
    Icon: UpdateIcon
  }
];

export default function GlobalNavMenu({
  className = '',
  triggerClassName = 'header-icon-btn',
  triggerAriaLabel = 'Open navigation menu',
  iconClassName = 'header-icon',
  menuTitle = 'Quick Navigation',
  items = DEFAULT_ITEMS
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const socialNotifications = useSocialNotificationsContext();

  const menuItems = useMemo(
    () => {
      const filtered = items.filter((item) => item && item.to && item.label);

      const existingKeys = new Set(filtered.map((item) => item.key));

      if (!socialNotifications.friendAccessDenied && !existingKeys.has('friend-requests')) {
        filtered.push({
          key: 'friend-requests',
          label: 'Friend requests',
          description:
            socialNotifications.friendRequestCount > 0
              ? `${socialNotifications.friendRequestCount} pending`
              : 'No pending invites',
          to: routes.updates.base,
          Icon: GroupAddIcon,
          badgeCount: socialNotifications.friendRequestCount
        });
      }

      if (!socialNotifications.dmAccessDenied && !existingKeys.has('direct-messages')) {
        filtered.push({
          key: 'direct-messages',
          label: 'Direct messages',
          description:
            socialNotifications.dmThreadCount > 0
              ? `${socialNotifications.dmThreadCount} conversations`
              : 'No active conversations yet',
          to: routes.directMessages.base,
          Icon: MarkUnreadChatAltIcon,
          badgeCount: socialNotifications.dmThreadCount
        });
      }

      return filtered;
    },
    [
      items,
      socialNotifications.friendAccessDenied,
      socialNotifications.friendRequestCount,
      socialNotifications.dmAccessDenied,
      socialNotifications.dmThreadCount
    ]
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleNavigate = useCallback(
    (to) => {
      setOpen(false);
      navigate(to);
    },
    [navigate]
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className={`global-nav-menu ${className}`}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        onClick={handleOpen}
      >
        <img src={MenuIcon} alt="" className={iconClassName} />
      </button>

      {open && (
        <div className="global-nav-menu__overlay" role="dialog" aria-modal="true">
          <button
            type="button"
            className="global-nav-menu__backdrop"
            aria-label="Close navigation menu"
            onClick={handleClose}
          />
          <div className="global-nav-menu__panel">
            <div className="global-nav-menu__header">
              <h2 className="global-nav-menu__title">{menuTitle}</h2>
              <button
                type="button"
                className="global-nav-menu__close"
                aria-label="Close menu"
                onClick={handleClose}
              >
                &times;
              </button>
            </div>
            <ul className="global-nav-menu__list">
              {menuItems.map(({ key, label, description, to, Icon, badgeCount }) => (
                <li key={key} className="global-nav-menu__list-item">
                  <button
                    type="button"
                    className="global-nav-menu__action"
                    onClick={() => handleNavigate(to)}
                  >
                    <span className="global-nav-menu__action-main">
                      {Icon ? <Icon className="global-nav-menu__action-icon" /> : null}
                      <span className="global-nav-menu__action-text">
                        <span className="global-nav-menu__action-label">{label}</span>
                        {description ? (
                          <span className="global-nav-menu__action-description">{description}</span>
                        ) : null}
                      </span>
                    </span>
                    {typeof badgeCount === 'number' && badgeCount > 0 ? (
                      <span className="global-nav-menu__badge" aria-hidden="true">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
