import { Box, Typography, Switch, FormControlLabel } from '@mui/material';

const LocationShare = ({ isSharing, onToggle, disabled = false, helperText }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 2,
        borderRadius: 1,
        minWidth: 200
      }}
    >
      <Typography variant="caption" color="white" sx={{ display: 'block', mb: 0.5 }}>
        {isSharing ? 'Location sharing is on' : 'Location sharing is off'}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={isSharing}
            onChange={onToggle}
            color="primary"
            disabled={disabled}
          />
        }
        label={
          <Typography variant="body2" color="white">
            Share Location
          </Typography>
        }
      />
      {helperText && (
        <Typography variant="caption" color="white" sx={{ mt: 0.5, display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default LocationShare;
