import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

import useViewerProfile from '../hooks/useViewerProfile';
import canAccessModerationTools from '../utils/accessControl';
import runtimeConfig from '../config/runtime';
import { routes } from '../routes';

function RequireAdminAccess({ children, fallbackPath = routes.settings.base }) {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldFetchProfile = !runtimeConfig.isOffline;
  const { viewer, isLoading } = useViewerProfile({ enabled: shouldFetchProfile });

  const hasAccess = useMemo(() => canAccessModerationTools(viewer), [viewer]);
  const isCheckingAccess = shouldFetchProfile && isLoading;

  if (isCheckingAccess) {
    return (
      <Box
        sx={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          textAlign: 'center'
        }}
      >
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Checking admin permissions…
        </Typography>
      </Box>
    );
  }

  if (!hasAccess) {
    return (
      <Box
        sx={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          textAlign: 'center',
          px: 3
        }}
      >
        <Typography variant="h5">Admin access required</Typography>
        <Typography variant="body1" color="text.secondary">
          Your account does not have permission to view this page.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(fallbackPath, { replace: true, state: { from: location } })}
        >
          Return to Settings
        </Button>
      </Box>
    );
  }

  return children;
}

RequireAdminAccess.propTypes = {
  children: PropTypes.node.isRequired,
  fallbackPath: PropTypes.string
};

export default RequireAdminAccess;
