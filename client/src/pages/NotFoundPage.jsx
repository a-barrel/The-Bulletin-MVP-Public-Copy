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
import "./NotFoundPage.css";
import { routes } from '../routes';
import reportClientError from '../utils/reportClientError';

function NotFoundPage({ defaultPath = routes.auth.login, defaultLabel = 'Go to Map' }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    reportClientError(null, 'Page not found', { path: location?.pathname ?? 'unknown' });
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
    <Box component="section" className="notfound-container">
      <Paper className="notfound-card">
        <Stack spacing={1.5} alignItems="center">
          <WarningAmberIcon color="warning" sx={{ fontSize: 100 }} />
          <Typography variant="h4" component="h1">
            Page Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We couldn&apos;t find anything at <code>{location.pathname}</code>. The page might have
            moved, been renamed, or is temporarily unavailable.
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="notfound-buttons">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            fullWidth
          >
            Go Back
          </Button>

          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={handleGoHome}
            fullWidth
          >
            {defaultLabel}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default NotFoundPage;
