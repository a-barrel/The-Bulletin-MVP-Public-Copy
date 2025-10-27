import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuIcon from '../assets/MenuIcon.svg';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import UpdateIcon from '@mui/icons-material/Update';
import './GlobalNavMenu.css';

const DEFAULT_ITEMS = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'View your profile',
    to: '/profile/me',
    Icon: AccountCircleIcon
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Adjust preferences',
    to: '/settings',
    Icon: SettingsIcon
  },
  {
    key: 'bookmarks',
    label: 'Bookmarks',
    description: 'See saved pins',
    to: '/bookmarks',
    Icon: BookmarkIcon
  },
  {
    key: 'updates',
    label: 'Updates',
    description: 'Check notifications',
    to: '/updates',
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

  const menuItems = useMemo(
    () => items.filter((item) => item && item.to && item.label),
    [items]
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
              {menuItems.map(({ key, label, description, to, Icon }) => (
                <li key={key} className="global-nav-menu__list-item">
                  <button
                    type="button"
                    className="global-nav-menu__action"
                    onClick={() => handleNavigate(to)}
                  >
                    {Icon ? <Icon className="global-nav-menu__action-icon" /> : null}
                    <span className="global-nav-menu__action-text">
                      <span className="global-nav-menu__action-label">{label}</span>
                      {description ? (
                        <span className="global-nav-menu__action-description">{description}</span>
                      ) : null}
                    </span>
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
