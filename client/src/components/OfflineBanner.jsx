import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import WifiOffIcon from '@mui/icons-material/WifiOff';

function OfflineBanner({ message = 'Offline mode: Some actions are disabled until connection returns.' }) {
  return (
    <Stack sx={{ width: '100%', mb: 2 }}>
      <Alert
        severity="warning"
        iconMapping={{
          warning: <WifiOffIcon fontSize="inherit" />
        }}
      >
        {message}
      </Alert>
    </Stack>
  );
}

export default OfflineBanner;
