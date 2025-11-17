import PropTypes from 'prop-types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CloseIcon from '@mui/icons-material/CancelRounded';

function PushNotificationPrompt({ onEnable, onDismiss, disabled }) {
  return (
    <Alert
      className="push-notifs-container"
      severity="info"
      variant="outlined"
      sx={{ mb: 3 }}
      action={
        <Box className="push-notifs-info">
          <Button
            variant="contained"
            size="small"
            startIcon={<NotificationsActiveIcon fontSize="small" />}
            onClick={onEnable}
            disabled={disabled}
          >
            Enable push notifications
          </Button>
          <Button
            variant="text"
            size="small"
            startIcon={<CloseIcon fontSize="small" />}
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </Box>
      }
    >
      <strong>Stay in the loop.</strong> Enable push notifications to get realtime updates.
    </Alert>
  );
}

PushNotificationPrompt.propTypes = {
  onEnable: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

PushNotificationPrompt.defaultProps = {
  disabled: false
};

export default PushNotificationPrompt;
