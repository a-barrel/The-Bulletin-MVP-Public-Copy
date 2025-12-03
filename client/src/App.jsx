import { useMemo, useState, useEffect, useCallback, useRef, Suspense, memo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, matchPath, Outlet } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import { NavOverlayProvider } from './contexts/NavOverlayContext';
import { MainNavigationProvider } from './contexts/MainNavigationContext';
import RegistrationPage from './pages/Registration';
import { UpdatesProvider } from './contexts/UpdatesContext';
import { BadgeSoundProvider } from './contexts/BadgeSoundContext';
import { FriendBadgePreferenceProvider } from './contexts/FriendBadgePreferenceContext';
import { preloadBadgeSound, setBadgeSoundEnabled } from './utils/badgeSound';
import { LocationProvider, useLocationContext } from './contexts/LocationContext';
import { BadgeCelebrationToast, useBadgeCelebrationToast } from './components/BadgeCelebrationToast';
import { routes } from './routes';
import NotFoundPage from './pages/NotFoundPage';
import { fetchCurrentUserProfile, fetchUpdates } from './api';
import { useNetworkStatusContext } from './contexts/NetworkStatusContext.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import { SocialNotificationsProvider } from './contexts/SocialNotificationsContext';
import useSocialNotifications from './hooks/useSocialNotifications';
import runtimeConfig from './config/runtime';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';
import useViewerProfile from './hooks/useViewerProfile';
import { setStoredRoleOverride, viewerHasDeveloperAccess } from './utils/roles';
import { useLazyPages, normalizePathValue } from './app/pageLoader';
import NavConsoleModal from './app/NavConsoleModal';
import LocationGateOverlay from './app/LocationGateOverlay';
import CircularProgress from '@mui/material/CircularProgress';
import { PinCacheProvider } from './contexts/PinCacheContext';
import { UserCacheProvider, useUserCache } from './contexts/UserCacheContext';
import { ReplyCacheProvider } from './contexts/ReplyCacheContext';
import { AttendeeCacheProvider } from './contexts/AttendeeCacheContext';
import { FriendCacheProvider } from './contexts/FriendCacheContext';
import { ChatRoomCacheProvider } from './contexts/ChatRoomCacheContext';
import { GeocodeCacheProvider } from './contexts/GeocodeCacheContext';
import { UpdatesCacheProvider } from './contexts/UpdatesCacheContext';
import { useThemePreference } from './contexts/ThemePreferenceContext';

const readCssVar = (name, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value ? value.trim() : fallback;
};

const buildTheme = (tokens) => {
  const {
    surface,
    surfaceWash,
    surfacePaper,
    textPrimary,
    textSecondary,
    accentPrimary,
    accentSecondary
  } = tokens;

  return createTheme({
    palette: {
      primary: { main: accentPrimary },
      secondary: { main: accentSecondary },
      background: { default: surfaceWash, paper: surfacePaper },
      text: { primary: textPrimary, secondary: textSecondary }
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: surfacePaper,
            color: textPrimary
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: surfacePaper,
            color: textPrimary
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: surfacePaper,
            color: textPrimary
          }
        }
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundColor: surfacePaper,
            color: textPrimary
          }
        }
      }
    },
    typography: {
      fontFamily: '"Urbanist", -apple-system, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif',
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' },
      h2: { fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.2 },
      h3: { fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.25 },
      h4: { fontSize: '1.4rem', fontWeight: 600, lineHeight: 1.3 },
      h5: { fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.35 },
      h6: { fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.4 },
      subtitle1: { fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.35 },
      subtitle2: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
      body2: { fontSize: '0.95rem', fontWeight: 400, lineHeight: 1.5 },
      button: { fontSize: '0.95rem', fontWeight: 600, textTransform: 'none' },
      caption: { fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.25, letterSpacing: '0.01em' }
    }
  });
};

const AUTH_ROUTES = new Set(['/login', '/forgot-password', '/reset-password']);

const normalizePath = normalizePathValue;

const wrapWithProtection = (page, element) =>
  page.isProtected ? <ProtectedRoute>{element}</ProtectedRoute> : element;

const MAX_HISTORY_ENTRIES = 20;
const BADGE_SOUND_STORAGE_KEY = 'pinpoint:badgeSoundEnabled';
const FRIEND_BADGE_STORAGE_KEY = 'pinpoint:friendBadgesEnabled';
const CORE_MAIN_PATHS = [routes.chat.base, routes.map.base, routes.list.base];
const CORE_NAV_STORAGE_KEY = 'pinpoint:lastCoreNavPath';
const MAIN_NAV_STORAGE_KEY = 'pinpoint:lastMainNavPath';
const CORE_MAIN_PATH_SET = new Set(CORE_MAIN_PATHS);
const EXTENDED_MAIN_PATH_SET = new Set([...CORE_MAIN_PATHS, routes.updates.base, routes.bookmarks.base]);

const buildFullPathFromLocation = (loc) => {
  if (!loc) {
    return routes.map.base;
  }
  const base = typeof loc.pathname === 'string' && loc.pathname ? loc.pathname : routes.map.base;
  const search = typeof loc.search === 'string' ? loc.search : '';
  const hash = typeof loc.hash === 'string' ? loc.hash : '';
  return `${base}${search}${hash}`;
};

const resolveInitialTrackedPath = (storageKey, allowedPathSet, location) => {
  if (allowedPathSet.has(location.pathname)) {
    return buildFullPathFromLocation(location);
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored && typeof stored === 'string' && stored.startsWith('/')) {
        return stored;
      }
    } catch {
      // ignore storage failures
    }
  }
  return routes.map.base;
};

const readStoredBadgeSoundPreference = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(BADGE_SOUND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const readStoredFriendBadgePreference = () => {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(FRIEND_BADGE_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === 'true';
  } catch {
    return true;
  }
};

function AppContent() {
  const { pages, ready: pagesReady, error: pagesError } = useLazyPages();
  const location = useLocation();
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { resolvedMode } = useThemePreference();
  const userCache = useUserCache();
  const [firebaseAuthUser, authLoading] = useAuthState(auth);
  const [navOverlayOpen, setNavOverlayOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBookmarkCount, setUnreadBookmarkCount] = useState(0);
  const [unreadDiscussionsCount, setUnreadDiscussionsCount] = useState(0);
  const [unreadEventsCount, setUnreadEventsCount] = useState(0);
  const [badgeSoundEnabled, setBadgeSoundEnabledState] = useState(
    () => readStoredBadgeSoundPreference()
  );
  const [friendBadgesEnabled, setFriendBadgesEnabled] = useState(
    () => readStoredFriendBadgePreference()
  );
  const [lastMainNavPath, setLastMainNavPath] = useState(() =>
    resolveInitialTrackedPath(MAIN_NAV_STORAGE_KEY, EXTENDED_MAIN_PATH_SET, location)
  );
  const [lastCoreNavPath, setLastCoreNavPath] = useState(() =>
    resolveInitialTrackedPath(CORE_NAV_STORAGE_KEY, CORE_MAIN_PATH_SET, location)
  );
  const {
    toastState: badgeToast,
    announceBadgeEarned,
    handleClose: handleBadgeToastClose
  } = useBadgeCelebrationToast();
  const { location: sharedLocation, setLocation } = useLocationContext();
  const [locationPromptError, setLocationPromptError] = useState(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  const isAuthRoute = AUTH_ROUTES.has(location.pathname);
  const isAuthReady = !authLoading && !!firebaseAuthUser;
  const isLoginRoute = location.pathname === routes.auth.login;
  const shouldLoadViewerProfile = isAuthReady && !isAuthRoute;
  const { viewer: viewerProfile } = useViewerProfile({
    enabled: shouldLoadViewerProfile
  });
  const isPinpointBypass =
    typeof viewerProfile?.email === 'string' &&
    viewerProfile.email.trim().toLowerCase() === 'pinpoint@gmail.com';
  const hasAdminRoleBypass =
    Array.isArray(viewerProfile?.roles) &&
    viewerProfile.roles.some((role) => {
      if (typeof role !== 'string') {
        return false;
      }
      const normalized = role.trim().toLowerCase();
      return (
        normalized === 'admin' ||
        normalized === 'super-admin' ||
        normalized === 'system-admin' ||
        normalized === 'moderator' ||
        normalized === 'community-manager'
      );
    });
  const isLocationBypassUser = Boolean(isPinpointBypass || hasAdminRoleBypass);
  const isDeveloper = useMemo(
    () => viewerHasDeveloperAccess(viewerProfile, { offlineOverride: runtimeConfig.isOffline }),
    [viewerProfile]
  );

  const previousAuthUidRef = useRef(null);
  useEffect(() => {
    const currentUid = firebaseAuthUser?.uid || null;
    const previousUid = previousAuthUidRef.current;

    if (!currentUid || (previousUid && previousUid !== currentUid)) {
      if (typeof userCache?.clearAll === 'function') {
        userCache.clearAll();
      }
      setStoredRoleOverride(null);
    }

    previousAuthUidRef.current = currentUid;
  }, [firebaseAuthUser?.uid, userCache]);

  const socialNotifications = useSocialNotifications({
    enabled: !isOffline && !isAuthRoute && !!firebaseAuthUser,
    autoLoad: !isAuthRoute && !!firebaseAuthUser,
    authUser: firebaseAuthUser
  });
  const {
    friendRequestCount,
    friendData,
    friendIsLoading,
    friendIsProcessing,
    friendStatus,
    respondToFriendRequest,
    sendFriendRequest,
    dmThreadCount,
    dmThreads,
    dmIsLoading,
    dmStatus,
    friendAccessDenied,
    dmAccessDenied,
    refreshAll: refreshSocialNotifications
  } = socialNotifications;
  const locationGateEnabled =
    runtimeConfig.isOffline || import.meta.env.VITE_ENABLE_LOCATION_GATE === 'false'
      ? false
      : true;
  const locationGateActive = locationGateEnabled && isLoginRoute && !runtimeConfig.isOffline;
  const shouldShowLocationGate =
    locationGateActive && !isLocationBypassUser && !sharedLocation && !isOffline;

  useEffect(() => {
    setBadgeSoundEnabled(badgeSoundEnabled);
    if (badgeSoundEnabled) {
      preloadBadgeSound();
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          BADGE_SOUND_STORAGE_KEY,
          badgeSoundEnabled ? 'true' : 'false'
        );
      } catch {
        // ignore storage errors (e.g., private browsing)
      }
    }
  }, [badgeSoundEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(
        FRIEND_BADGE_STORAGE_KEY,
        friendBadgesEnabled ? 'true' : 'false'
      );
    } catch {
      // ignore storage failures (e.g., private browsing)
    }
  }, [friendBadgesEnabled]);

  useEffect(() => {
    const nextPath = buildFullPathFromLocation(location);
    if (
      EXTENDED_MAIN_PATH_SET.has(location.pathname) &&
      nextPath &&
      lastMainNavPath !== nextPath
    ) {
      setLastMainNavPath(nextPath);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(MAIN_NAV_STORAGE_KEY, nextPath);
        } catch {
          // ignore storage failures (e.g., private browsing)
        }
      }
    }
    if (
      CORE_MAIN_PATH_SET.has(location.pathname) &&
      nextPath &&
      lastCoreNavPath !== nextPath
    ) {
      setLastCoreNavPath(nextPath);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(CORE_NAV_STORAGE_KEY, nextPath);
        } catch {
          // ignore storage failures (e.g., private browsing)
        }
      }
    }
  }, [lastCoreNavPath, lastMainNavPath, location]);

  const filteredPages = useMemo(
    () =>
      pages.filter((page) => {
        if (page.id === 'debug-console' && !isDeveloper) {
          return false;
        }
        return true;
      }),
    [isDeveloper, pages]
  );

  const navPages = useMemo(
    () =>
      filteredPages.filter((page) => {
        if (page.showInNav) {
          return true;
        }
        if (page.id === 'admin-dashboard' && runtimeConfig.isOffline) {
          return true;
        }
        return false;
      }),
    [filteredPages]
  );

  const navPathSet = useMemo(() => {
    const set = new Set();
    navPages.forEach((page) => {
      if (page.path) {
        set.add(page.path);
      }
      if (Array.isArray(page.aliases)) {
        page.aliases.forEach((alias) => {
          if (alias) {
            set.add(alias);
          }
        });
      }
    });
    return set;
  }, [navPages]);

  const [navHistory, setNavHistory] = useState(() =>
    navPathSet.has(location.pathname) ? [location.pathname] : []
  );
  const backTargetRef = useRef(null);
  const unreadRefreshPendingRef = useRef(false);

  const defaultNavPage = useMemo(() => {
    return (
      navPages.find((page) => page.isDefault) ??
      navPages[0] ??
      filteredPages.find((page) => page.isDefault) ??
      null
    );
  }, [filteredPages, navPages]);

  const currentNavPath = useMemo(() => {
    if (!navPages.length) {
      return null;
    }

    const matched = navPages.find((page) => {
      const { path, aliases } = page;
      if (path && matchPath({ path, end: path === '/' }, location.pathname)) {
        return true;
      }

      return aliases.some((alias) => alias && matchPath({ path: alias, end: alias === '/' }, location.pathname));
    });

    return matched?.path ?? null;
  }, [location.pathname, navPages]);

  // Track overlay navigation history so we can surface a back action.
  useEffect(() => {
    if (!navPathSet.has(location.pathname)) {
      backTargetRef.current = null;
      return;
    }

    setNavHistory((prev) => {
      const pendingBackTarget = backTargetRef.current;
      if (pendingBackTarget) {
        backTargetRef.current = null;
        const targetIndex = prev.lastIndexOf(pendingBackTarget);
        const baseHistory = targetIndex !== -1 ? prev.slice(0, targetIndex + 1) : prev;
        if (!baseHistory.length) {
          return [location.pathname];
        }
        if (baseHistory[baseHistory.length - 1] === location.pathname) {
          return baseHistory;
        }
        const appended = [...baseHistory, location.pathname];
        return appended.length > MAX_HISTORY_ENTRIES
          ? appended.slice(appended.length - MAX_HISTORY_ENTRIES)
          : appended;
      }

      if (!prev.length) {
        return [location.pathname];
      }

      const last = prev[prev.length - 1];
      if (last === location.pathname) {
        return prev;
      }

      const next = [...prev, location.pathname];
      return next.length > MAX_HISTORY_ENTRIES
        ? next.slice(next.length - MAX_HISTORY_ENTRIES)
        : next;
    });
  }, [location.pathname, navPathSet]);

  const previousNavPath = useMemo(() => {
    if (navHistory.length < 2) {
      return null;
    }

    for (let index = navHistory.length - 2; index >= 0; index -= 1) {
      const candidate = navHistory[index];
      if (!candidate || candidate === location.pathname) {
        continue;
      }
      if (navPathSet.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }, [navHistory, location.pathname, navPathSet]);

  const previousNavPage = useMemo(() => {
    if (!previousNavPath) {
      return null;
    }

    return (
      navPages.find(
        (page) =>
          page.path === previousNavPath ||
          (Array.isArray(page.aliases) && page.aliases.includes(previousNavPath))
      ) ?? null
    );
  }, [navPages, previousNavPath]);

  const closeOverlay = useCallback(() => {
    setNavOverlayOpen(false);
  }, []);

  const handleBack = useCallback(() => {
    if (!previousNavPath) {
      return;
    }
    backTargetRef.current = previousNavPath;
    navigate(previousNavPath);
    setNavOverlayOpen(false);
  }, [navigate, previousNavPath]);

  const navOverlayContextValue = useMemo(
    () => ({
      handleBack,
      previousNavPath,
      previousNavPage
    }),
    [handleBack, previousNavPage, previousNavPath]
  );

  const refreshUnreadCount = useCallback(
    async ({ silent } = {}) => {
      if (unreadRefreshPendingRef.current) {
        return;
      }

      unreadRefreshPendingRef.current = true;
      try {
        const profile = await fetchCurrentUserProfile();
        if (!profile?._id) {
          setUnreadCount(0);
          return;
        }

        const updates = await fetchUpdates({ userId: profile._id, limit: 100 });
        let total = 0;
        let bookmark = 0;
        let discussions = 0;
        let events = 0;

        updates.forEach((update) => {
          if (update?.readAt) {
            return;
          }
          total += 1;
          const type = update?.payload?.type;
          const pinType =
            typeof update?.payload?.pin?.type === 'string'
              ? update.payload.pin.type.toLowerCase()
              : '';
          if (type === 'bookmark-update') {
            bookmark += 1;
          } else if (
            type === 'event-starting-soon' ||
            type === 'event-reminder' ||
            pinType === 'event'
          ) {
            events += 1;
          } else if (
            type === 'pin-update' ||
            type === 'new-pin' ||
            type === 'discussion-expiring-soon' ||
            pinType === 'discussion'
          ) {
            discussions += 1;
          }
        });

        setUnreadCount(total);
        setUnreadBookmarkCount(bookmark);
        setUnreadDiscussionsCount(discussions);
        setUnreadEventsCount(events);
      } catch (error) {
        if (!silent) {
          console.warn('Failed to refresh unread update count', error);
        }
        setUnreadCount(0);
        setUnreadBookmarkCount(0);
        setUnreadDiscussionsCount(0);
        setUnreadEventsCount(0);
      } finally {
        unreadRefreshPendingRef.current = false;
      }
    },
    [setUnreadBookmarkCount, setUnreadCount, setUnreadDiscussionsCount, setUnreadEventsCount]
  );

  const badgeSoundContextValue = useMemo(
    () => ({
      enabled: badgeSoundEnabled,
      setEnabled: setBadgeSoundEnabledState,
      announceBadgeEarned
    }),
    [announceBadgeEarned, badgeSoundEnabled]
  );

  const friendBadgePreferenceValue = useMemo(
    () => ({
      enabled: friendBadgesEnabled,
      setEnabled: setFriendBadgesEnabled
    }),
    [friendBadgesEnabled]
  );

  useEffect(() => {
    if (isAuthRoute || !isAuthReady) {
      setUnreadCount(0);
      setUnreadBookmarkCount(0);
      setUnreadDiscussionsCount(0);
      setUnreadEventsCount(0);
      return;
    }
    refreshUnreadCount({ silent: true });
  }, [
    isAuthReady,
    isAuthRoute,
    refreshUnreadCount,
    setUnreadBookmarkCount,
    setUnreadCount,
    setUnreadDiscussionsCount,
    setUnreadEventsCount
  ]);

  useEffect(() => {
    if (isOffline || isAuthRoute || !isAuthReady) {
      return;
    }
    refreshSocialNotifications().catch(() => {});
  }, [isAuthReady, isAuthRoute, isOffline, refreshSocialNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const shouldRefresh = () => isAuthReady && !AUTH_ROUTES.has(location.pathname);

    const handleFocus = () => {
      if (shouldRefresh()) {
        refreshUnreadCount({ silent: true });
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && shouldRefresh()) {
        refreshUnreadCount({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isAuthReady, location.pathname, refreshUnreadCount]);

  useEffect(() => {
    if (typeof window === 'undefined' || isOffline || isAuthRoute || !isAuthReady) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      refreshUnreadCount({ silent: true });
    }, 5_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthReady, isAuthRoute, isOffline, refreshUnreadCount]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleFocus = () => {
      if (!isOffline && !isAuthRoute && isAuthReady) {
        refreshSocialNotifications().catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthReady, isAuthRoute, isOffline, refreshSocialNotifications]);

  const updatesContextValue = useMemo(
    () => ({
      unreadCount,
      unreadBookmarkCount,
      unreadDiscussionsCount,
      unreadEventsCount,
      setUnreadCount,
      setUnreadBookmarkCount,
      setUnreadDiscussionsCount,
      setUnreadEventsCount,
      refreshUnreadCount
    }),
    [
      unreadBookmarkCount,
      unreadCount,
      unreadDiscussionsCount,
      unreadEventsCount,
      refreshUnreadCount,
      setUnreadBookmarkCount,
      setUnreadCount,
      setUnreadDiscussionsCount,
      setUnreadEventsCount
    ]
  );

  const mainNavigationValue = useMemo(
    () => ({ lastMainPath: lastMainNavPath, lastCorePath: lastCoreNavPath }),
    [lastCoreNavPath, lastMainNavPath]
  );

  const socialNotificationsContextValue = useMemo(
    () => ({
      friendRequestCount,
      friendData,
      friendIsLoading,
      friendIsProcessing,
      friendStatus,
      respondToFriendRequest,
      sendFriendRequest,
      dmThreadCount,
      dmThreads,
      dmIsLoading,
      dmStatus,
      friendAccessDenied,
      dmAccessDenied,
      isLoading: friendIsLoading || dmIsLoading,
      refreshAll: refreshSocialNotifications
    }),
    [
      dmAccessDenied,
      dmIsLoading,
      dmStatus,
      dmThreadCount,
      dmThreads,
      friendAccessDenied,
      friendData,
      friendIsLoading,
      friendIsProcessing,
      friendRequestCount,
      friendStatus,
      refreshSocialNotifications,
      respondToFriendRequest,
      sendFriendRequest
    ]
  );

  const protectedPages = useMemo(
    () => filteredPages.filter((page) => page.isProtected !== false),
    [filteredPages]
  );
  const publicPages = useMemo(
    () => filteredPages.filter((page) => page.isProtected === false),
    [filteredPages]
  );

  const protectedProvidersElement = useMemo(
    () => (
      <UpdatesProvider value={updatesContextValue}>
        <SocialNotificationsProvider value={socialNotificationsContextValue}>
          <Outlet />
        </SocialNotificationsProvider>
      </UpdatesProvider>
    ),
    [socialNotificationsContextValue, updatesContextValue]
  );

  const handleNavigate = useCallback(
    (target) => {
      let targetPath = null;

      if (typeof target === 'string') {
        targetPath = normalizePath(target) ?? target;
      } else if (target && typeof target === 'object') {
        if (typeof target.navResolver === 'function') {
          try {
            const resolved = target.navResolver({ currentPath: location.pathname });
            if (typeof resolved === 'string' && resolved.trim().length > 0) {
              targetPath = normalizePath(resolved) ?? resolved.trim();
            }
          } catch (error) {
            console.error('Failed to resolve navigation path for page', target.id, error);
          }
        }

        if (!targetPath && typeof target.navTargetPath === 'string') {
          targetPath = target.navTargetPath;
        }

        if (!targetPath && typeof target.path === 'string') {
          targetPath = target.path;
        }
      }

      if (typeof targetPath === 'string' && targetPath.length > 0) {
        navigate(targetPath);
        setNavOverlayOpen(false);
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Backquote' && event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!AUTH_ROUTES.has(location.pathname)) {
          setNavOverlayOpen(false);
          navigate('/emulation-test');
        }
        return;
      }

      if ((event.key === '`' || event.key === '~') && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (AUTH_ROUTES.has(location.pathname) || navPages.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setNavOverlayOpen((prev) => !prev);
      } else if (event.key === 'Escape') {
        setNavOverlayOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname, navPages.length, navigate]);

  const handleRequestLocationAccess = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationPromptError('Location services are unavailable in this browser.');
      return;
    }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequestingLocation(false);
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'browser-geolocation'
        });
        setLocationPromptError(null);
      },
      (error) => {
        setIsRequestingLocation(false);
        setLocationPromptError(error?.message || 'We could not retrieve your current location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0
      }
    );
  }, [setLocation]);

  const appTheme = useMemo(() => {
    const surface = readCssVar('--color-surface', 'var(--color-surface)');
    const surfaceWash = readCssVar('--color-surface-wash', 'var(--color-surface-wash)');
    const surfaceWashStrong = readCssVar('--color-surface-wash-strong', 'var(--color-surface-wash-strong)');
    const surfacePaper = readCssVar('--color-surface', 'var(--color-surface)');
    const textPrimary = readCssVar('--color-text-primary', 'var(--color-text-primary)');
    const textSecondary = readCssVar('--color-text-secondary', 'var(--color-text-secondary)');
    const accentPrimary = readCssVar('--accent-primary', 'var(--accent-primary)');
    const accentSecondary = readCssVar('--accent-blue', 'var(--accent-blue)');

    return buildTheme({
      surface,
      surfaceWash: surfaceWashStrong || surfaceWash,
      surfacePaper,
      textPrimary,
      textSecondary,
      accentPrimary,
      accentSecondary
    });
  }, [resolvedMode]);

  return (
    <FriendBadgePreferenceProvider value={friendBadgePreferenceValue}>
      <BadgeSoundProvider value={badgeSoundContextValue}>
        <MainNavigationProvider value={mainNavigationValue}>
          <NavOverlayProvider value={navOverlayContextValue}>
            <NavConsoleModal
              open={navOverlayOpen}
              onClose={closeOverlay}
              navPages={navPages}
              previousNavPath={previousNavPath}
              previousNavPage={previousNavPage}
              currentNavPath={currentNavPath}
              onBack={handleBack}
              onNavigate={handleNavigate}
            />

            {isOffline && !AUTH_ROUTES.has(location.pathname) ? (
              <OfflineBanner message="You are offline. Data may be stale and actions are temporarily disabled." />
            ) : null}
            <MemoizedThemeRoutes
              pagesError={pagesError}
              pagesReady={pagesReady}
              publicPages={publicPages}
              protectedPages={protectedPages}
              protectedProvidersElement={protectedProvidersElement}
              defaultNavPage={defaultNavPage}
              shouldShowLocationGate={shouldShowLocationGate}
              locationPromptError={locationPromptError}
              handleRequestLocationAccess={handleRequestLocationAccess}
              isRequestingLocation={isRequestingLocation}
              badgeToast={badgeToast}
              handleBadgeToastClose={handleBadgeToastClose}
              appTheme={appTheme}
            />
          </NavOverlayProvider>
        </MainNavigationProvider>
      </BadgeSoundProvider>
    </FriendBadgePreferenceProvider>
  );
}

const MemoizedAppContent = memo(AppContent);

function ThemeRoutesShell({
  pagesError,
  pagesReady,
  publicPages,
  protectedPages,
  protectedProvidersElement,
  defaultNavPage,
  shouldShowLocationGate,
  locationPromptError,
  handleRequestLocationAccess,
  isRequestingLocation,
  badgeToast,
  handleBadgeToastClose,
  appTheme
}) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <MemoizedAppRoutes
        pagesError={pagesError}
        pagesReady={pagesReady}
        publicPages={publicPages}
        protectedPages={protectedPages}
        protectedProvidersElement={protectedProvidersElement}
        defaultNavPage={defaultNavPage}
      />
      <LocationGateOverlay
        visible={shouldShowLocationGate}
        locationPromptError={locationPromptError}
        onRequestLocation={handleRequestLocationAccess}
        isRequesting={isRequestingLocation}
      />
      <BadgeCelebrationToast toastState={badgeToast} onClose={handleBadgeToastClose} />
    </ThemeProvider>
  );
}

const MemoizedThemeRoutes = memo(ThemeRoutesShell);

function RoutesSuspenseFallback() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
      <CircularProgress />
    </Box>
  );
}

function AppRoutes({
  pagesError,
  pagesReady,
  publicPages,
  protectedPages,
  protectedProvidersElement,
  defaultNavPage
}) {
  if (pagesError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <p>Failed to load pages. Please refresh.</p>
      </Box>
    );
  }

  if (!pagesReady) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Suspense fallback={<RoutesSuspenseFallback />}>
      <Routes>
        <Route path={routes.auth.login} element={<LoginPage />} />
        <Route path={routes.auth.register} element={<RegistrationPage />} />
        <Route path={routes.auth.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.auth.resetPassword} element={<ResetPasswordPage />} />

        {publicPages.map((page) => (
          <Route
            key={page.id}
            path={page.path}
            element={wrapWithProtection(page, <page.Component />)}
          />
        ))}

        <Route element={protectedProvidersElement}>
          {protectedPages.map((page) => (
            <Route
              key={page.id}
              path={page.path}
              element={wrapWithProtection(page, <page.Component />)}
            />
          ))}
          {protectedPages.map((page) =>
            page.aliases.map((alias) => (
              <Route
                key={`${page.id}-alias-${alias}`}
                path={alias}
                element={wrapWithProtection(page, <page.Component />)}
              />
            ))
          )}
        </Route>

        <Route path={routes.root} element={<Navigate to={routes.auth.login} replace />} />
        <Route
          path="*"
          element={
            <NotFoundPage
              defaultPath={defaultNavPage?.path ?? routes.auth.login}
              defaultLabel={
                defaultNavPage?.label ? `Go to ${defaultNavPage.label}` : 'Go to login'
              }
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

const MemoizedAppRoutes = memo(AppRoutes);

function App() {
  return (
    <UserCacheProvider>
      <PinCacheProvider>
        <ReplyCacheProvider>
          <AttendeeCacheProvider>
            <FriendCacheProvider>
              <ChatRoomCacheProvider>
                <GeocodeCacheProvider>
                  <UpdatesCacheProvider>
                    <LocationProvider>
                      <MemoizedAppContent />
                    </LocationProvider>
                  </UpdatesCacheProvider>
                </GeocodeCacheProvider>
              </ChatRoomCacheProvider>
            </FriendCacheProvider>
          </AttendeeCacheProvider>
        </ReplyCacheProvider>
      </PinCacheProvider>
    </UserCacheProvider>
  );
}

export default App;
