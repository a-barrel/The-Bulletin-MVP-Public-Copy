import { Box, Typography, Switch, FormControlLabel } from '@mui/material';

const LocationShare = ({ isSharing, onToggle }) => {
  return (
    <Box sx={{ 
      position: 'absolute', 
      top: 16, 
      right: 16, 
      zIndex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 2,
      borderRadius: 1
    }}>
      <FormControlLabel
        control={
          <Switch
            checked={isSharing}
            onChange={onToggle}
            color="primary"
          />
        }
        label={
          <Typography variant="body2" color="white">
            Share Location
          </Typography>
        }
      />
    </Box>
  );
};

export default LocationShare; 