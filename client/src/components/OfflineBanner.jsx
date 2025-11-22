import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import WifiOffIcon from '@mui/icons-material/WifiOff';

function OfflineBanner({ message }) {
  const { t } = useTranslation();
  const resolvedMessage = message ?? t('offline.default');

  return (
    <Stack sx={{ width: '100%', mb: 2 }}>
      <Alert
        severity="warning"
        iconMapping={{
          warning: <WifiOffIcon fontSize="inherit" />
        }}
      >
        {resolvedMessage}
      </Alert>
    </Stack>
  );
}

export default OfflineBanner;
