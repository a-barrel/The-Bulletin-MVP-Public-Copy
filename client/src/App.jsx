import { useMemo } from 'react';
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
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import ArticleIcon from '@mui/icons-material/Article';
import Typography from '@mui/material/Typography';
import ProtectedRoute from './components/ProtectedRoute';

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

const pageModules = import.meta.glob('./pages/**/*.{jsx,tsx}', { eager: true });

const deriveIdFromPath = (path) => path
  .replace(/^\.\/pages\//, '')
  .replace(/\.\w+$/, '')
  .replace(/[\\/]+/g, '-');

const deriveLabelFromId = (id) => id
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

const loadPages = () => Object.entries(pageModules)
  .map(([path, module]) => {
    const Component = module.default;
    if (typeof Component !== 'function') {
      return null;
    }

    const config = module.pageConfig || module.navConfig || {};
    const id = typeof config.id === 'string' && config.id.trim().length > 0
      ? config.id.trim()
      : deriveIdFromPath(path);
    const label = typeof config.label === 'string' && config.label.trim().length > 0
      ? config.label.trim()
      : deriveLabelFromId(id);
    const order = Number.isFinite(config.order) ? config.order : Number.POSITIVE_INFINITY;
    const IconComponent = config.icon;
    const pathValue = normalizePath(config.path ?? `/${id.toLowerCase()}`);
    const aliases = Array.isArray(config.aliases)
      ? config.aliases.map(normalizePath).filter(Boolean)
      : [];
    const showInNav = config.showInNav !== false;
    const isDefault = Boolean(config.isDefault);
    const isProtected = Boolean(config.protected);

    return {
      id,
      label,
      order,
      icon: IconComponent,
      path: pathValue,
      aliases,
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

const wrapWithProtection = (page, element) => (
  page.isProtected ? <ProtectedRoute>{element}</ProtectedRoute> : element
);

function App() {
  const pages = useMemo(loadPages, []);
  const location = useLocation();
  const navigate = useNavigate();

  const navPages = useMemo(
    () => pages.filter((page) => page.showInNav),
    [pages]
  );

  const defaultPage = useMemo(() => {
    return pages.find((page) => page.isDefault)
      ?? navPages[0]
      ?? pages[0]
      ?? null;
  }, [pages, navPages]);

  const currentNavPath = useMemo(() => {
    if (!navPages.length) {
      return null;
    }

    const matched = navPages.find((page) => {
      const { path, aliases } = page;
      if (path && matchPath({ path, end: path === '/' }, location.pathname)) {
        return true;
      }

      return aliases.some(
        (alias) => alias && matchPath({ path: alias, end: alias === '/' }, location.pathname)
      );
    });

    return matched?.path ?? null;
  }, [location.pathname, navPages]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'background.default'
        }}
      >
        <Box component="main" sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {pages.length > 0 ? (
            <Routes>
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

              {defaultPage && defaultPage.path !== '/' && (
                <Route path="/" element={<Navigate to={defaultPage.path} replace />} />
              )}

              {defaultPage && (
                <Route path="*" element={<Navigate to={defaultPage.path} replace />} />
              )}
            </Routes>
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 3
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Add a new page under `src/pages` to populate the navigation.
              </Typography>
            </Box>
          )}
        </Box>

        {navPages.length > 0 && (
          <Paper elevation={8} component="nav">
            <BottomNavigation
              showLabels
              value={currentNavPath}
              onChange={(event, newValue) => {
                if (typeof newValue === 'string' && newValue.length > 0) {
                  navigate(newValue);
                }
              }}
            >
              {navPages.map((page) => {
                const IconComponent = page.icon ?? ArticleIcon;
                return (
                  <BottomNavigationAction
                    key={page.id}
                    label={page.label}
                    value={page.path}
                    icon={<IconComponent fontSize="medium" />}
                  />
                );
              })}
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
