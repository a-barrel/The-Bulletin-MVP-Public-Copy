import { useCallback, useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { useNetworkStatusContext } from '../../../contexts/NetworkStatusContext.jsx';

function SystemTab() {
  const {
    isOnline,
    isOffline,
    autoIsOnline,
    overrideMode,
    isOverrideEnabled,
    setNetworkOverride,
    clearNetworkOverride
  } = useNetworkStatusContext();

  const toggleValue = overrideMode ?? 'auto';

  const handleModeChange = useCallback(
    (_event, nextValue) => {
      if (nextValue === null) {
        return;
      }
      if (nextValue === 'auto') {
        clearNetworkOverride();
        return;
      }
      if (nextValue === 'online' || nextValue === 'offline') {
        setNetworkOverride(nextValue);
      }
    },
    [clearNetworkOverride, setNetworkOverride]
  );

  const effectiveStatusLabel = useMemo(() => (isOnline ? 'Online' : 'Offline'), [isOnline]);
  const browserStatusLabel = useMemo(() => (autoIsOnline ? 'Online' : 'Offline'), [autoIsOnline]);

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      <Box>
        <Typography variant="h6" component="h2">
          Network Overrides
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Simulate offline mode locally without toggling OS networking. This uses the global network
          context, so the entire app will react as if the browser is {isOffline ? 'offline' : 'online'}.
          Overrides persist for this browser until reset.
        </Typography>
      </Box>

      <ToggleButtonGroup
        exclusive
        color="primary"
        value={toggleValue}
        onChange={handleModeChange}
        aria-label="Network override mode"
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="auto">
          Follow Browser ({browserStatusLabel})
        </ToggleButton>
        <ToggleButton value="online">Force Online</ToggleButton>
        <ToggleButton value="offline">Force Offline</ToggleButton>
      </ToggleButtonGroup>

      {isOverrideEnabled ? (
        <Alert severity="info">
          Override active: forced <strong>{overrideMode}</strong>. Choose &ldquo;Follow Browser&rdquo;
          to return to automatic detection.
        </Alert>
      ) : (
        <Alert severity="success">No override active. Status follows browser connectivity.</Alert>
      )}

      <Divider />

      <Stack spacing={1}>
        <Typography variant="body2">
          Effective app status: <strong>{effectiveStatusLabel}</strong>
        </Typography>
        <Typography variant="body2">
          Browser-reported status: <strong>{browserStatusLabel}</strong>
        </Typography>
        <Typography variant="body2">
          Override mode: <strong>{overrideMode ?? 'none'}</strong>
        </Typography>
      </Stack>
    </Stack>
  );
}

export default SystemTab;
