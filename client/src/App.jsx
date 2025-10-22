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

function App() {
  const pages = useMemo(loadPages, []);
  const location = useLocation();
  const navigate = useNavigate();
  const [navOverlayOpen, setNavOverlayOpen] = useState(false);

  const navPages = useMemo(
    () => pages.filter((page) => page.showInNav),
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
              <Stack spacing={1.5}>
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
                  <Stack spacing={1}>
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

        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

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

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="*"
          element={
            defaultNavPage ? (
              <Navigate to={defaultNavPage.path} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        </Routes>
      </ThemeProvider>
    </NavOverlayProvider>
  );
}

export default App;
