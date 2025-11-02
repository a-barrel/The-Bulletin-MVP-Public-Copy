import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { fetchBookmarkCollections } from '../api/mongoDataApi';
import { useUpdates } from '../contexts/UpdatesContext';

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

const BOOKMARK_QUICK_NAV_STORAGE_KEY = 'pinpoint:bookmarkQuickNav';
const BOOKMARK_QUICK_NAV_PREFS_KEY = 'pinpoint:bookmarkQuickNavPrefs';
const BOOKMARK_UNSORTED_ID = '__ungrouped__';
const QUICK_NAV_MAX_ITEMS = 4;
const QUICK_NAV_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
  const { isOffline } = useNetworkStatusContext();
  const socialNotifications = useSocialNotificationsContext();
  const { unreadBookmarkCount } = useUpdates();
  const bookmarkFetchMetaRef = useRef({ fetchedAt: 0, loading: false });
  const hiddenQuickNavRef = useRef(new Set());
  const [bookmarkShortcuts, setBookmarkShortcuts] = useState([]);
  const [bookmarkStatus, setBookmarkStatus] = useState(null);

  const filterShortcuts = useCallback(
    (items = []) =>
      items.filter((item) => {
        if (!item) {
          return false;
        }
        if (item.key === 'all-bookmarks') {
          return true;
        }
        return !hiddenQuickNavRef.current.has(item.key);
      }),
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const cached = window.localStorage.getItem(BOOKMARK_QUICK_NAV_STORAGE_KEY);
      const prefs = window.localStorage.getItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
      if (prefs) {
        try {
          const parsedPrefs = JSON.parse(prefs);
          if (parsedPrefs && Array.isArray(parsedPrefs.hidden)) {
            hiddenQuickNavRef.current = new Set(parsedPrefs.hidden);
          }
        } catch (prefError) {
          console.warn('Failed to parse bookmark quick nav preferences', prefError);
        }
      }
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.items)) {
          setBookmarkShortcuts(filterShortcuts(parsed.items));
        }
      }
    } catch (error) {
      console.warn('Failed to read bookmark quick navigation cache', error);
    }
  }, [filterShortcuts]);

  const computeBookmarkQuickNav = useCallback(
    (collections = []) => {
      const sorted = [...collections]
        .filter((collection) => Array.isArray(collection?.bookmarkIds))
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
          const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
          return bTime - aTime;
        })
        .slice(0, QUICK_NAV_MAX_ITEMS)
        .map((collection) => ({
          key: collection._id,
          label: collection.name || 'Untitled collection',
          to: routes.bookmarks.collection(collection._id),
          count: Array.isArray(collection.bookmarkIds) ? collection.bookmarkIds.length : undefined,
          description: collection.description || ''
        }));

      const result = [
        {
          key: 'all-bookmarks',
          label: 'All bookmarks',
          to: routes.bookmarks.base,
          count: null,
          description: 'View your full library'
        },
        ...sorted,
        {
          key: BOOKMARK_UNSORTED_ID,
          label: 'Unsorted',
          to: routes.bookmarks.collection(BOOKMARK_UNSORTED_ID),
          count: null,
          description: 'Pins saved without a collection'
        }
      ];

      const unique = [];
      result.forEach((entry) => {
        if (!entry) {
          return;
        }
        if (unique.some((candidate) => candidate.key === entry.key)) {
          return;
        }
        unique.push(entry);
      });

      return unique;
    },
    []
  );

  useEffect(() => {
    if (!open || isOffline) {
      if (isOffline && open && !bookmarkShortcuts.length) {
        setBookmarkStatus('Offline — showing cached collections only.');
      }
      return;
    }

    const meta = bookmarkFetchMetaRef.current;
    if (meta.loading) {
      return;
    }

    const now = Date.now();
    if (bookmarkShortcuts.length && now - meta.fetchedAt < QUICK_NAV_CACHE_TTL_MS) {
      return;
    }

    meta.loading = true;
    setBookmarkStatus(null);
    fetchBookmarkCollections()
      .then((collections) => {
        const items = computeBookmarkQuickNav(Array.isArray(collections) ? collections : []);
        const filteredItems = filterShortcuts(items);
        setBookmarkShortcuts(filteredItems);
        meta.fetchedAt = Date.now();
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(
              BOOKMARK_QUICK_NAV_STORAGE_KEY,
              JSON.stringify({
                updatedAt: new Date().toISOString(),
                items
              })
            );
          } catch (error) {
            console.warn('Failed to cache bookmark quick nav items', error);
          }
        }
      })
      .catch((error) => {
        setBookmarkStatus(error?.message || 'Failed to load bookmark collections.');
      })
      .finally(() => {
        bookmarkFetchMetaRef.current.loading = false;
      });
  }, [bookmarkShortcuts.length, computeBookmarkQuickNav, filterShortcuts, isOffline, open]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncPrefs = () => {
      try {
        const stored = window.localStorage.getItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.hidden)) {
            hiddenQuickNavRef.current = new Set(parsed.hidden);
          } else {
            hiddenQuickNavRef.current = new Set();
          }
        } else {
          hiddenQuickNavRef.current = new Set();
        }
        let cachedItems = [];
        try {
          const cachedRaw = window.localStorage.getItem(BOOKMARK_QUICK_NAV_STORAGE_KEY);
          if (cachedRaw) {
            const parsedCache = JSON.parse(cachedRaw);
            if (parsedCache && Array.isArray(parsedCache.items)) {
              cachedItems = parsedCache.items;
            }
          }
        } catch (cacheError) {
          console.warn('Failed to parse cached quick nav items', cacheError);
        }
        const nextItems = cachedItems.length ? cachedItems : bookmarkShortcuts;
        setBookmarkShortcuts(filterShortcuts(nextItems));
      } catch (error) {
        console.warn('Failed to sync bookmark quick nav preferences', error);
      }
    };

    const handleStorage = (event) => {
      if (event.key === BOOKMARK_QUICK_NAV_PREFS_KEY) {
        syncPrefs();
      }
    };

    syncPrefs();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pinpoint:bookmarkQuickNavPrefsChanged', syncPrefs);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pinpoint:bookmarkQuickNavPrefsChanged', syncPrefs);
    };
  }, [bookmarkShortcuts, filterShortcuts]);

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

      return filtered.map((item) => {
        if (item.key === 'bookmarks') {
          const badge = unreadBookmarkCount;
          if (badge > 0) {
            return {
              ...item,
              badgeCount: badge,
              description:
                badge === 1
                  ? '1 unread bookmark update'
                  : `${badge} unread bookmark updates`
            };
          }
          return {
            ...item,
            badgeCount: item.badgeCount
          };
        }
        return item;
      });
    },
    [
      items,
      unreadBookmarkCount,
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
            {bookmarkShortcuts.length ? (
              <div className="global-nav-menu__section">
                <h3 className="global-nav-menu__section-title">Saved collections</h3>
                <ul className="global-nav-menu__quick-list">
                  {bookmarkShortcuts.map((shortcut) => (
                    <li key={shortcut.key} className="global-nav-menu__quick-item">
                      <button
                        type="button"
                        className="global-nav-menu__quick-action"
                        onClick={() => handleNavigate(shortcut.to)}
                      >
                        <span className="global-nav-menu__quick-name">{shortcut.label}</span>
                        {typeof shortcut.count === 'number' ? (
                          <span className="global-nav-menu__quick-count">{shortcut.count}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {bookmarkStatus ? (
              <div className="global-nav-menu__section">
                <p className="global-nav-menu__helper-text">{bookmarkStatus}</p>
              </div>
            ) : null}
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
