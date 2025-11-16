import { Box, CircularProgress, Typography } from '@mui/material';

function LoadingOverlay({ label = 'Loading…', minHeight = 180, sx, ...props }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        width: '100%',
        minHeight,
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 1,
        textAlign: 'center',
        px: 3,
        py: 4,
        color: 'text.secondary',
        ...sx
      }}
      {...props}
    >
      <CircularProgress size={24} />
      {label ? (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      ) : null}
    </Box>
  );
}

export default LoadingOverlay;
