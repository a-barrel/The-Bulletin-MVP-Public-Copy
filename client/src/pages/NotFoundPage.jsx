import { useCallback } from 'react';
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

function NotFoundPage({ defaultPath = routes.auth.login, defaultLabel = 'Return to safety' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoBack = useCallback(() => {
    if (window.history.length > 1) {
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
        py: 6
      }}
    >
      <Paper
        elevation={6}
        sx={{
          maxWidth: 480,
          width: '100%',
          borderRadius: 4,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          textAlign: 'center'
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <WarningAmberIcon color="warning" sx={{ fontSize: 48 }} />
          <Typography variant="h4" component="h1">
            Page Not Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We couldn&apos;t find anything at <code>{location.pathname}</code>. The page might have
            moved, been renamed, or is temporarily unavailable.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            fullWidth
          >
            Go back
          </Button>
          <Button
            variant="contained"
            color="primary"
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
