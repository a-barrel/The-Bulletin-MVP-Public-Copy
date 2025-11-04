import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  matchPath
} from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ArticleIcon from '@mui/icons-material/Article';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import { NavOverlayProvider } from './contexts/NavOverlayContext';
import RegistrationPage from './pages/Registration';
import { UpdatesProvider } from './contexts/UpdatesContext';
import { BadgeSoundProvider } from './contexts/BadgeSoundContext';
import { preloadBadgeSound, setBadgeSoundEnabled } from './utils/badgeSound';
import { LocationProvider } from './contexts/LocationContext';
import {
  BadgeCelebrationToast,
  useBadgeCelebrationToast
} from './components/BadgeCelebrationToast';
import { routes } from './routes';
import NotFoundPage from './pages/NotFoundPage';
import { fetchCurrentUserProfile, fetchUpdates } from './api/mongoDataApi';
import { useNetworkStatusContext } from './contexts/NetworkStatusContext.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import { SocialNotificationsProvider } from './contexts/SocialNotificationsContext';
import useSocialNotifications from './hooks/useSocialNotifications';
import runtimeConfig from './config/runtime';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9'
    },
    secondary: {
      main: '#f48fb1'
    },
    background: {
      default: '#0b0c10',
      paper: '#141821'
    }
  }
});

const AUTH_ROUTES = new Set(['/login', '/forgot-password', '/reset-password']);

const pageModules = import.meta.glob('./pages/**/*.{jsx,tsx}', { eager: true });

const deriveIdFromPath = (path) =>
  path.replace(/^\.\/pages\//, '').replace(/\.\w+$/, '').replace(/[\\/]+/g, '-');

const deriveLabelFromId = (id) =>
  id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Page';

const normalizePath = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const loadPages = () =>
  Object.entries(pageModules)
    .map(([path, module]) => {
      const Component = module.default;
      if (typeof Component !== 'function') {
        return null;
      }

      const config = module.pageConfig || module.navConfig || {};
      const id =
        typeof config.id === 'string' && config.id.trim().length > 0
          ? config.id.trim()
          : deriveIdFromPath(path);
      const label =
        typeof config.label === 'string' && config.label.trim().length > 0
          ? config.label.trim()
          : deriveLabelFromId(id);
      const order = Number.isFinite(config.order) ? config.order : Number.POSITIVE_INFINITY;
      const IconComponent = config.icon;
      const pathValue = normalizePath(config.path ?? `/${id.toLowerCase()}`);
      const aliases = Array.isArray(config.aliases)
        ? config.aliases.map(normalizePath).filter(Boolean)
        : [];
      const navTargetPath = normalizePath(config.navTargetPath);
      const navResolver =
        typeof config.resolveNavTarget === 'function' ? config.resolveNavTarget : null;
      const showInNav = config.showInNav === true;
      const isDefault = Boolean(config.isDefault);
      const isProtected = config.protected !== false;

      return {
        id,
        label,
        order,
        icon: IconComponent,
        path: pathValue,
        aliases,
        navTargetPath,
        navResolver,
        showInNav,
        isDefault,
        isProtected,
        Component
      };
    })
    .filter((page) => Boolean(page?.Component && page.path))
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.label.localeCompare(b.label);
    });

const wrapWithProtection = (page, element) =>
  page.isProtected ? <ProtectedRoute>{element}</ProtectedRoute> : element;

const MAX_HISTORY_ENTRIES = 20;
const BADGE_SOUND_STORAGE_KEY = 'pinpoint:badgeSoundEnabled';

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

function App() {
  const pages = useMemo(loadPages, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const [firebaseAuthUser, authLoading] = useAuthState(auth);
  const [navOverlayOpen, setNavOverlayOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBookmarkCount, setUnreadBookmarkCount] = useState(0);
  const [unreadDiscussionsCount, setUnreadDiscussionsCount] = useState(0);
  const [unreadEventsCount, setUnreadEventsCount] = useState(0);
  const [badgeSoundEnabled, setBadgeSoundEnabledState] = useState(
    () => readStoredBadgeSoundPreference()
  );
  const {
    toastState: badgeToast,
    announceBadgeEarned,
    handleClose: handleBadgeToastClose
  } = useBadgeCelebrationToast();

  const isAuthRoute = AUTH_ROUTES.has(location.pathname);
  const isAuthReady = !authLoading && !!firebaseAuthUser;
  const socialNotifications = useSocialNotifications({
    enabled: !isOffline && !isAuthRoute && isAuthReady,
    autoLoad: !isAuthRoute && isAuthReady
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

  const navPages = useMemo(
    () =>
      pages.filter((page) => {
        if (page.showInNav) {
          return true;
        }
        if (page.id === 'admin-dashboard' && runtimeConfig.isOffline) {
          return true;
        }
        return false;
      }),
    [pages]
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
      pages.find((page) => page.isDefault) ??
      null
    );
  }, [navPages, pages]);

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
          if (type === 'bookmark-update') {
            bookmark += 1;
          } else if (type === 'event-starting-soon' || type === 'event-reminder') {
            events += 1;
          } else if (type === 'pin-update' || type === 'new-pin' || type === 'discussion-expiring-soon') {
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

      if (event.key === '`' || event.key === '~') {
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

  return (
    <LocationProvider>
      <BadgeSoundProvider value={badgeSoundContextValue}>
        <UpdatesProvider value={updatesContextValue}>
          <SocialNotificationsProvider value={socialNotificationsContextValue}>
            <NavOverlayProvider value={navOverlayContextValue}>
              <ThemeProvider theme={theme}>
                <CssBaseline />

                <Modal open={navOverlayOpen} onClose={closeOverlay} closeAfterTransition keepMounted>
                  <Fade in={navOverlayOpen}>
                    <Box
                      sx={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                        pointerEvents: 'none'
                      }}
                    >
                      <Paper
                        elevation={16}
                        sx={(muiTheme) => ({
                          width: 'min(420px, 90vw)',
                          maxHeight: '80vh',
                          overflow: 'hidden',
                          pointerEvents: 'auto',
                          outline: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          p: 3,
                          borderRadius: 3,
                          backgroundColor: muiTheme.palette.background.paper
                        })}
                      >
                        <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" component="h2">
                              Navigation Console
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Press ` or Esc to close
                            </Typography>
                          </Box>
                          <Divider />
                          {navPages.length > 0 ? (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                flex: 1,
                                minHeight: 0
                              }}
                            >
                              {previousNavPath && (
                                <Button
                                  onClick={handleBack}
                                  variant="contained"
                                  color="secondary"
                                  startIcon={<ArrowBackIcon fontSize="small" />}
                                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                                >
                                  {previousNavPage ? `Back to ${previousNavPage.label}` : 'Back'}
                                </Button>
                              )}
                              <Box
                                sx={{
                                  flex: 1,
                                  minHeight: 0,
                                  overflowY: 'auto',
                                  pr: 0.5,
                                  scrollbarGutter: 'stable'
                                }}
                              >
                                <Stack spacing={1}>
                                  {navPages.map((page) => {
                                    const IconComponent = page.icon ?? ArticleIcon;
                                    const isActive = page.path === currentNavPath;
                                    return (
                                      <Button
                                        key={page.id}
                                        onClick={() => handleNavigate(page)}
                                        variant={isActive ? 'contained' : 'outlined'}
                                        color={isActive ? 'primary' : 'inherit'}
                                        startIcon={<IconComponent fontSize="small" />}
                                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                                      >
                                        {page.label}
                                      </Button>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Add a new page under `src/pages` with `showInNav: true` to populate this console.
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    </Box>
                  </Fade>
                </Modal>

                {isOffline && !AUTH_ROUTES.has(location.pathname) ? (
                  <OfflineBanner message="You are offline. Data may be stale and actions are temporarily disabled." />
                ) : null}
                <Routes>
                  <Route path={routes.auth.login} element={<LoginPage />} />
                  <Route path={routes.auth.register} element={<RegistrationPage />} />
                  <Route path={routes.auth.forgotPassword} element={<ForgotPasswordPage />} />
                  <Route path={routes.auth.resetPassword} element={<ResetPasswordPage />} />

                  {pages.map((page) => (
                    <Route
                      key={page.id}
                      path={page.path}
                      element={wrapWithProtection(page, <page.Component />)}
                    />
                  ))}

                  {pages.map((page) =>
                    page.aliases.map((alias) => (
                      <Route
                        key={`${page.id}-alias-${alias}`}
                        path={alias}
                        element={wrapWithProtection(page, <page.Component />)}
                      />
                    ))
                  )}

                  <Route path={routes.root} element={<Navigate to={routes.auth.login} replace />} />
                  <Route
                    path="*"
                    element={
                      <NotFoundPage
                        defaultPath={defaultNavPage?.path ?? routes.auth.login}
                        defaultLabel={
                          defaultNavPage?.label
                            ? `Go to ${defaultNavPage.label}`
                            : 'Go to login'
                        }
                      />
                    }
                  />
                </Routes>
                <BadgeCelebrationToast toastState={badgeToast} onClose={handleBadgeToastClose} />
              </ThemeProvider>
            </NavOverlayProvider>
          </SocialNotificationsProvider>
        </UpdatesProvider>
      </BadgeSoundProvider>
    </LocationProvider>
  );
}


export default App;
