import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import UpdateIcon from '@mui/icons-material/Update';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import MapIcon from '@mui/icons-material/Map';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import './GlobalNavMenu.css';
import { routes } from '../routes';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { fetchBookmarkCollections } from '../api';
import { useUpdates } from '../contexts/UpdatesContext';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import useViewerProfile from '../hooks/useViewerProfile';
import canAccessModerationTools from '../utils/accessControl';
import { useTranslation } from 'react-i18next';

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
const BOOKMARK_QUICK_NAV_SCHEMA_VERSION = 2;
const BOOKMARK_QUICK_NAV_PREFS_VERSION = 1;

const NAV_TRANSLATION_KEY_OVERRIDES = {
  'admin-dashboard': 'admin',
  'direct-messages': 'directMessages',
  'friend-menu': 'friends'
};

const resolveNavTranslationKey = (key) => NAV_TRANSLATION_KEY_OVERRIDES[key] ?? key;

const QUICK_TAP_ACTIONS = [
  {
    key: 'chat',
    label: 'Chat',
    to: routes.chat.base,
    Icon: MarkUnreadChatAltIcon
  },
  {
    key: 'friends',
    label: 'Friends',
    to: routes.friends.base,
    Icon: GroupAddIcon
  },
  {
    key: 'map',
    label: 'Map',
    to: routes.map.base,
    Icon: MapIcon
  },
  {
    key: 'list',
    label: 'List',
    to: routes.list.base,
    Icon: FormatListBulletedIcon
  },
  {
    key: 'bookmarks',
    label: 'Bookmarks',
    to: routes.bookmarks.base,
    Icon: BookmarkIcon
  },
  {
    key: 'settings',
    label: 'Settings',
    to: routes.settings.base,
    Icon: SettingsIcon
  }
];

function areShortcutListsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const prev = a[index];
    const next = b[index];
    if (prev === next) {
      continue;
    }
    if (!prev || !next) {
      return false;
    }
    if (
      prev.key !== next.key ||
      prev.label !== next.label ||
      prev.to !== next.to ||
      prev.count !== next.count ||
      prev.description !== next.description ||
      prev.badgeCount !== next.badgeCount
    ) {
      return false;
    }
  }
  return true;
}

export default memo(function GlobalNavMenu({
  className = '',
  triggerClassName = 'header-icon-btn',
  triggerAriaLabel,
  iconClassName = 'header-icon',
  menuTitle,
  items = DEFAULT_ITEMS
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedTriggerAriaLabel = triggerAriaLabel ?? t('nav.openMenu');
  const resolvedMenuTitle = menuTitle ?? t('nav.menuTitle');
  const closeNavigationLabel = t('nav.closeMenu');
  const closeMenuLabel = t('nav.close');
  const quickShortcutsLabel = t('nav.quickShortcuts');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const [anchor, setAnchor] = useState({ x: 16, y: 56, w: 40, h: 40 });
  const { isOffline } = useNetworkStatusContext();
  const socialNotifications = useSocialNotificationsContext();
  const { unreadBookmarkCount } = useUpdates();
  const bookmarkFetchMetaRef = useRef({ fetchedAt: 0, loading: false });
  const hiddenQuickNavRef = useRef(new Set());
  const [bookmarkShortcuts, setBookmarkShortcuts] = useState([]);
  const bookmarkShortcutsRef = useRef(bookmarkShortcuts);
  const { viewer: viewerProfile } = useViewerProfile({ enabled: !isOffline, skip: isOffline });

  const translateNavItem = useCallback(
    (item) => {
      const translationKey = resolveNavTranslationKey(item?.key || '');
      const translatedLabel = t(`nav.items.${translationKey}.label`, {
        defaultValue: item?.label ?? translationKey
      });
      const translatedDescription =
        item?.description !== undefined
          ? t(`nav.items.${translationKey}.description`, { defaultValue: item.description })
          : undefined;

      return {
        ...item,
        label: translatedLabel,
        description: translatedDescription ?? item?.description
      };
    },
    [t]
  );

  const baseItems = useMemo(() => {
    const source = Array.isArray(items) && items.length ? items : DEFAULT_ITEMS;
    return source.map((item) => translateNavItem(item));
  }, [items, translateNavItem]);
  const resolvedMenuItems = useMemo(() => {
    const filteredBase = baseItems.filter(
      (entry) => entry && !['bookmarks', 'settings', 'friends'].includes(entry.key)
    );
    if (!canAccessModerationTools(viewerProfile)) {
      return filteredBase;
    }
    const alreadyHasAdmin = filteredBase.some((entry) => entry?.key === 'admin-dashboard');
    if (alreadyHasAdmin) {
      return filteredBase;
    }
    return [
      ...filteredBase,
      translateNavItem({
        key: 'admin-dashboard',
        label: 'Admin Dashboard',
        description: 'Moderate reports and audits',
        to: routes.admin.base,
        Icon: AdminPanelSettingsIcon
      })
    ];
  }, [baseItems, translateNavItem, viewerProfile]);

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

  const applyBookmarkShortcuts = useCallback(
    (items = []) => {
      const filtered = filterShortcuts(Array.isArray(items) ? items : []);
      setBookmarkShortcuts((prev) => (areShortcutListsEqual(prev, filtered) ? prev : filtered));
    },
    [filterShortcuts]
  );

  useEffect(() => {
    bookmarkShortcutsRef.current = bookmarkShortcuts;
  }, [bookmarkShortcuts]);

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
          const version = parsedPrefs?.version ?? 0;
          const hidden = Array.isArray(parsedPrefs?.hidden) ? parsedPrefs.hidden : [];
          if (version === BOOKMARK_QUICK_NAV_PREFS_VERSION || version === 0) {
            hiddenQuickNavRef.current = new Set(hidden);
            if (version === 0) {
              window.localStorage.setItem(
                BOOKMARK_QUICK_NAV_PREFS_KEY,
                JSON.stringify({
                  version: BOOKMARK_QUICK_NAV_PREFS_VERSION,
                  hidden
                })
              );
            }
          } else {
            hiddenQuickNavRef.current = new Set();
            window.localStorage.removeItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
          }
        } catch (prefError) {
          console.warn('Failed to parse bookmark quick nav preferences', prefError);
        }
      }
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const version = parsed?.version ?? 0;
          const updatedAt = parsed?.updatedAt ? new Date(parsed.updatedAt).getTime() : NaN;
          const isFresh = !Number.isNaN(updatedAt) && Date.now() - updatedAt <= QUICK_NAV_CACHE_TTL_MS;
          if (version === BOOKMARK_QUICK_NAV_SCHEMA_VERSION && Array.isArray(parsed?.items) && isFresh) {
            applyBookmarkShortcuts(parsed.items);
          } else if (Array.isArray(parsed?.items) && version === 0 && isFresh) {
            applyBookmarkShortcuts(parsed.items);
            window.localStorage.setItem(
              BOOKMARK_QUICK_NAV_STORAGE_KEY,
              JSON.stringify({
                version: BOOKMARK_QUICK_NAV_SCHEMA_VERSION,
                updatedAt: new Date().toISOString(),
                items: parsed.items
              })
            );
          } else {
            window.localStorage.removeItem(BOOKMARK_QUICK_NAV_STORAGE_KEY);
          }
        } catch (cacheError) {
          console.warn('Failed to parse bookmark quick nav cache', cacheError);
          window.localStorage.removeItem(BOOKMARK_QUICK_NAV_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.warn('Failed to read bookmark quick navigation cache', error);
    }
  }, [applyBookmarkShortcuts]);

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
          label: collection.name || t('nav.bookmarkQuickNav.untitled'),
          to: routes.bookmarks.collection(collection._id),
          count: Array.isArray(collection.bookmarkIds) ? collection.bookmarkIds.length : undefined,
          description: collection.description || ''
        }));

      const result = [
        {
          key: 'all-bookmarks',
          label: t('nav.bookmarkQuickNav.all'),
          to: routes.bookmarks.base,
          count: null,
          description: t('nav.bookmarkQuickNav.allDescription')
        },
        ...sorted,
        {
          key: BOOKMARK_UNSORTED_ID,
          label: t('nav.bookmarkQuickNav.unsorted'),
          to: routes.bookmarks.collection(BOOKMARK_UNSORTED_ID),
          count: null,
          description: t('nav.bookmarkQuickNav.unsortedDescription')
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
    [t]
  );

  useEffect(() => {
    if (!open || isOffline) {
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
    fetchBookmarkCollections()
      .then((collections) => {
        const items = computeBookmarkQuickNav(Array.isArray(collections) ? collections : []);
        applyBookmarkShortcuts(items);
        meta.fetchedAt = Date.now();
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(
              BOOKMARK_QUICK_NAV_STORAGE_KEY,
              JSON.stringify({
                version: BOOKMARK_QUICK_NAV_SCHEMA_VERSION,
                updatedAt: new Date().toISOString(),
                items
              })
            );
          } catch (error) {
            console.warn('Failed to cache bookmark quick nav items', error);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        bookmarkFetchMetaRef.current.loading = false;
      });
  }, [applyBookmarkShortcuts, bookmarkShortcuts.length, computeBookmarkQuickNav, isOffline, open, t]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncPrefs = () => {
      try {
        const stored = window.localStorage.getItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const version = parsed?.version ?? 0;
          const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden : [];
          if (version === BOOKMARK_QUICK_NAV_PREFS_VERSION || version === 0) {
            hiddenQuickNavRef.current = new Set(hidden);
            if (version === 0) {
              window.localStorage.setItem(
                BOOKMARK_QUICK_NAV_PREFS_KEY,
                JSON.stringify({
                  version: BOOKMARK_QUICK_NAV_PREFS_VERSION,
                  hidden
                })
              );
            }
          } else {
            hiddenQuickNavRef.current = new Set();
            window.localStorage.removeItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
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
              const version = parsedCache?.version ?? 0;
              const updatedAt = parsedCache?.updatedAt ? new Date(parsedCache.updatedAt).getTime() : NaN;
              const isFresh =
                !Number.isNaN(updatedAt) && Date.now() - updatedAt <= QUICK_NAV_CACHE_TTL_MS;
              if (version === BOOKMARK_QUICK_NAV_SCHEMA_VERSION && isFresh) {
                cachedItems = parsedCache.items;
              } else if (version === 0 && isFresh) {
                cachedItems = parsedCache.items;
                window.localStorage.setItem(
                  BOOKMARK_QUICK_NAV_STORAGE_KEY,
                  JSON.stringify({
                    version: BOOKMARK_QUICK_NAV_SCHEMA_VERSION,
                    updatedAt: new Date().toISOString(),
                    items: parsedCache.items
                  })
                );
              } else {
                window.localStorage.removeItem(BOOKMARK_QUICK_NAV_STORAGE_KEY);
              }
            }
          }
        } catch (cacheError) {
          console.warn('Failed to parse cached quick nav items', cacheError);
        }
        const nextItems = cachedItems.length ? cachedItems : bookmarkShortcutsRef.current;
        applyBookmarkShortcuts(nextItems);
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
  }, [applyBookmarkShortcuts]);

  const menuItems = useMemo(
    () => {
      const filtered = resolvedMenuItems.filter((item) => item && item.to && item.label);

      const existingKeys = new Set(filtered.map((item) => item.key));

      if (!socialNotifications.friendAccessDenied && !existingKeys.has('friend-requests')) {
        const friendDescription =
          socialNotifications.friendRequestCount > 0
            ? t('nav.friendRequests.pending', { count: socialNotifications.friendRequestCount })
            : t('nav.friendRequests.none');
        filtered.push(
          translateNavItem({
            key: 'friend-menu',
            label: t('nav.items.friends.label'),
            description: friendDescription,
            to: routes.friends.base,
            Icon: GroupAddIcon,
            badgeCount: socialNotifications.friendRequestCount
          })
        );
      }

      if (!socialNotifications.dmAccessDenied && !existingKeys.has('direct-messages')) {
        const dmDescription =
          socialNotifications.dmThreadCount > 0
            ? t('nav.directMessages.pending', { count: socialNotifications.dmThreadCount })
            : t('nav.directMessages.none');
        filtered.push(
          translateNavItem({
            key: 'direct-messages',
            label: t('nav.items.directMessages.label'),
            description: dmDescription,
            to: routes.directMessages.base,
            Icon: MarkUnreadChatAltIcon,
            badgeCount: socialNotifications.dmThreadCount
          })
        );
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
                  ? t('nav.bookmarksBadge.one')
                  : t('nav.bookmarksBadge.other', { count: badge })
            };
          }
          return {
            ...item,
            badgeCount: item.badgeCount
          };
        }
        return translateNavItem(item);
      });
    },
    [
      resolvedMenuItems,
      unreadBookmarkCount,
      socialNotifications.friendAccessDenied,
      socialNotifications.friendRequestCount,
      socialNotifications.dmAccessDenied,
      socialNotifications.dmThreadCount,
      t,
      translateNavItem
    ]
  );

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAnchor({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    }
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

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

  const originX = anchor.x + anchor.w / 2;
  const originY = anchor.y + anchor.h / 2;

  return (
    <div className={`global-nav-menu ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={resolvedTriggerAriaLabel}
        onClick={handleOpen}
      >
        <MenuIcon className={iconClassName} aria-hidden="true" />
      </button>

      {open && (
        <div className="global-nav-menu__overlay" role="dialog" aria-modal="true">
          <button
            type="button"
            className="global-nav-menu__backdrop"
            aria-label={closeNavigationLabel}
            onClick={handleClose}
          />
          <div
            className="global-nav-menu__panel global-nav-menu__panel--anchored"
            style={{
              '--anchor-x': `${anchor.x}px`,
              '--anchor-y': `${anchor.y}px`,
              '--origin-x': `${originX}px`,
              '--origin-y': `${originY}px`
            }}
          >
            <div className="global-nav-menu__header">
              <h2 className="global-nav-menu__title">{resolvedMenuTitle}</h2>
              <button
                type="button"
                className="global-nav-menu__close"
                aria-label={closeMenuLabel}
                onClick={handleClose}
              >
                &times;
              </button>
            </div>
            <div className="global-nav-menu__quick-panel" role="group" aria-label={quickShortcutsLabel}>
              {QUICK_TAP_ACTIONS.map((action) => {
                const ActionIcon = action.Icon;
                const actionLabel = t(
                  `nav.items.${resolveNavTranslationKey(action.key)}.label`,
                  { defaultValue: action.label }
                );
                return (
                  <button
                    key={action.key}
                    type="button"
                    className="global-nav-menu__quick-button"
                    onClick={() => handleNavigate(action.to)}
                  >
                    <span className="global-nav-menu__quick-button-icon" aria-hidden="true">
                      <ActionIcon fontSize="medium" />
                    </span>
                    <span className="global-nav-menu__quick-button-label">{actionLabel}</span>
                  </button>
                );
              })}
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
});
