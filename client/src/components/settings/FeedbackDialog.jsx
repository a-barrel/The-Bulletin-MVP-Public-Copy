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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Send anonymous feedback</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
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
          />
          <TextField
            label="Contact (optional)"
            value={contact}
            onChange={onContactChange}
            disabled={isSubmitting}
            placeholder="Email or @username"
          />
          {error ? (
            <Alert severity="error" onClose={onClearError}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          color="secondary"
          disabled={isSubmitting || isOffline}
          title={isOffline ? 'Reconnect to send feedback' : undefined}
        >
          {isSubmitting ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FeedbackDialog;
