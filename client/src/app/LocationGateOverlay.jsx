import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

function LocationGateOverlay({
  visible,
  locationPromptError,
  onRequestLocation,
  requestingLabel = 'Requesting…',
  ctaLabel = 'Enable location',
  isRequesting = false
}) {
  if (!visible) {
    return null;
  }
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: (theme) => theme.zIndex.modal + 10,
        p: 2
      }}
    >
      <Paper
        role="dialog"
        aria-modal="true"
        aria-label="Location access required"
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography variant="h6">Location access required</Typography>
        <Typography variant="body2" color="text.secondary">
          PinPoint needs your live location to show nearby pins. Enable location services in your browser to continue.
        </Typography>
        {locationPromptError ? (
          <Alert severity="error" variant="outlined">
            {locationPromptError}
          </Alert>
        ) : null}
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button variant="contained" color="primary" onClick={onRequestLocation} disabled={isRequesting}>
            {isRequesting ? requestingLabel : ctaLabel}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

LocationGateOverlay.propTypes = {
  visible: PropTypes.bool.isRequired,
  locationPromptError: PropTypes.string,
  onRequestLocation: PropTypes.func.isRequired,
  requestingLabel: PropTypes.string,
  ctaLabel: PropTypes.string,
  isRequesting: PropTypes.bool
};

LocationGateOverlay.defaultProps = {
  locationPromptError: null,
  requestingLabel: 'Requesting…',
  ctaLabel: 'Enable location',
  isRequesting: false
};

export default LocationGateOverlay;
