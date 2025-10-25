import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  EXPERIMENT_SCREENS,
  EXPERIMENT_TAB_ID,
  EXPERIMENT_TITLE
} from '../constants';

function ExperimentTab() {
  const defaultScreenId = EXPERIMENT_SCREENS[0]?.id ?? null;
  const [selectedScreen, setSelectedScreen] = useState(defaultScreenId);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const activeScreen = useMemo(() => {
    if (!selectedScreen) {
      return null;
    }
    return EXPERIMENT_SCREENS.find((screen) => screen.id === selectedScreen) ?? null;
  }, [selectedScreen]);

  const ScreenComponent = activeScreen?.Component ?? null;

  const handleSelectionChange = (_event, value) => {
    if (value) {
      setSelectedScreen(value);
    }
  };

  const handleOpenPreview = () => setIsPreviewOpen(true);
  const handleClosePreview = () => setIsPreviewOpen(false);

  return (
    <>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">{EXPERIMENT_TITLE}</Typography>
        <Typography variant="body2" color="text.secondary">
          Private sandbox for Troy. Keep this local and off the main repo.
        </Typography>

        <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Heads up</Typography>
            <Typography variant="body2">
              This is a contingency experiment. Do not ship, demo, or commit it upstream.
            </Typography>
          </Stack>
        </Alert>

        <Typography variant="subtitle2">Pick a screen:</Typography>
        <ToggleButtonGroup
          value={selectedScreen}
          exclusive
          onChange={handleSelectionChange}
          color="primary"
          orientation="horizontal"
          sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButton-root': { flexGrow: 1 } }}
        >
          {EXPERIMENT_SCREENS.length > 0 ? (
            EXPERIMENT_SCREENS.map((screen) => (
              <ToggleButton key={screen.id} value={screen.id} aria-label={screen.label}>
                {screen.label}
              </ToggleButton>
            ))
          ) : (
            <ToggleButton value="placeholder" disabled>
              Screens archived locally
            </ToggleButton>
          )}
        </ToggleButtonGroup>

        <Button
          type="button"
          variant="contained"
          onClick={handleOpenPreview}
          disabled={!ScreenComponent}
        >
          Open Preview
        </Button>
      </Paper>

      <Dialog
        open={isPreviewOpen}
        onClose={handleClosePreview}
        fullWidth
        maxWidth="md"
        aria-labelledby={`${EXPERIMENT_TAB_ID}-dialog-title`}
      >
        <DialogTitle id={`${EXPERIMENT_TAB_ID}-dialog-title`}>
          {EXPERIMENT_TITLE} - {activeScreen?.label}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              backgroundColor: 'grey.900',
              borderRadius: 2,
              p: { xs: 2, sm: 3 }
            }}
          >
            <Box
              sx={{
                width: { xs: '100%', sm: 360 },
                transform: { xs: 'scale(0.9)', sm: 'none' },
                transformOrigin: 'top center'
              }}
            >
              {ScreenComponent ? <ScreenComponent /> : null}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ExperimentTab;
