import { useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ReplayIcon from '@mui/icons-material/Replay';
import RefreshIcon from '@mui/icons-material/Refresh';

import reportClientError from '../utils/reportClientError';
import { routes } from '../routes';

function ErrorFallback({ onRetry, onReload, error }) {
  useEffect(() => {
    if (error) {
      reportClientError(error, 'Unhandled error captured by boundary');
    }
  }, [error]);

  const handleRetry = useCallback(() => {
    if (typeof onRetry === 'function') {
      onRetry();
    } else if (typeof window !== 'undefined') {
      window.location.assign(routes.auth.login);
    }
  }, [onRetry]);

  const handleReload = useCallback(() => {
    if (typeof onReload === 'function') {
      onReload();
    } else if (typeof window !== 'undefined') {
      // Avoid infinite reload loops on repeated boundary hits.
      window.location.href = routes.auth.login;
    }
  }, [onReload]);

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 6
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h4" component="h1">
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary">
            An unexpected error occurred while rendering this page. You can try again or reload the
            app to recover.
          </Typography>
          {error?.message ? (
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              {error.message}
            </Typography>
          ) : null}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<ReplayIcon />}
            onClick={handleRetry}
            fullWidth
          >
            Try again
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            fullWidth
          >
            Reload app
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default ErrorFallback;
