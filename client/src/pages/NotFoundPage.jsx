import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import { routes } from '../routes';
import reportClientError from '../utils/reportClientError';

function NotFoundPage({ defaultPath = routes.auth.login, defaultLabel = 'Go to Map' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathLabel = location?.pathname ?? 'this page';

  useEffect(() => {
    const path = location?.pathname ?? 'unknown';
    reportClientError(null, 'Page not found', { path });
    if (typeof window !== 'undefined' && window.analytics?.track) {
      window.analytics.track('not_found_view', { path });
    }
  }, [location?.pathname]);

  const handleGoBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(defaultPath, { replace: true });
  }, [defaultPath, navigate]);

  const handleGoHome = useCallback(() => {
    navigate(defaultPath, { replace: true });
  }, [defaultPath, navigate]);

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        backgroundColor: '#fff'
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 540,
          borderRadius: 3,
          p: { xs: 3, md: 4 },
          textAlign: 'center',
          color: '#000',
          backgroundColor: '#fff'
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <WarningAmberIcon color="warning" sx={{ fontSize: 100 }} />
          <Typography variant="h4" component="h1">
            Page Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We couldn&apos;t find anything at <code>{pathLabel}</code>. The page might have moved,
            been renamed, or is temporarily unavailable.
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 3 }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            fullWidth
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              borderWidth: 1.5,
              borderColor: '#000',
              color: '#000'
            }}
          >
            Go Back
          </Button>

          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={handleGoHome}
            fullWidth
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: '#9B5DE5',
              '&:hover': { backgroundColor: '#6c3bd8' }
            }}
          >
            {defaultLabel}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default NotFoundPage;
