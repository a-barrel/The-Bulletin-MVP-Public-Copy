import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import settingsPalette, { mutedTextSx, settingsButtonStyles } from './settingsPalette';

function FeedbackDialog({
  open,
  message,
  contact,
  error,
  isSubmitting,
  isOffline,
  onClose,
  onSubmit,
  onMessageChange,
  onContactChange,
  onClearError
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 4,
          backgroundColor: '#F5EFFD',
          border: '1px solid rgba(93, 56, 137, 0.25)',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.35)'
        }
      }}
      BackdropProps={{
        sx: {
          backgroundColor: '#00000080',
          backdropFilter: 'blur(4px)'
        }
      }}
    >
      <DialogTitle sx={{ color: settingsPalette.accent, fontWeight: 700, pb: 1.5 }}>
        Send anonymous feedback
      </DialogTitle>
      <DialogContent sx={{ backgroundColor: '#FFFFFF', borderRadius: 3, m: 2, mt: 0 }}>
        <Stack spacing={2.5}>
          <Typography variant="body2" sx={mutedTextSx}>
            We read every message. Please avoid sharing personal details unless you want us to reach out.
          </Typography>
          <TextField
            label="Your feedback"
            multiline
            minRows={4}
            value={message}
            onChange={onMessageChange}
            disabled={isSubmitting}
            helperText="At least 10 characters."
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: settingsPalette.pastelLavender,
                color: settingsPalette.textPrimary
              }
            }}
          />
          <TextField
            label="Contact (optional)"
            value={contact}
            onChange={onContactChange}
            disabled={isSubmitting}
            placeholder="Email or @username"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: settingsPalette.pastelLavender,
                color: settingsPalette.textPrimary
              }
            }}
          />
          {error ? (
            <Alert severity="error" onClose={onClearError}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isSubmitting} sx={settingsButtonStyles.text}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={isSubmitting || isOffline}
          title={isOffline ? 'Reconnect to send feedback' : undefined}
          sx={{ ...settingsButtonStyles.contained, px: 3 }}
        >
          {isSubmitting ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FeedbackDialog;
