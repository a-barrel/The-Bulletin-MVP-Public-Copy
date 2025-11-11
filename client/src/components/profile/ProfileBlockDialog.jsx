import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

function ProfileBlockDialog({ mode, onClose, onConfirm, isProcessing }) {
  return (
    <Dialog open={Boolean(mode)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{mode === 'block' ? 'Block this user?' : 'Unblock this user?'}</DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {mode === 'block'
            ? 'Blocked users cannot interact with you and their activity is hidden. You can review blocked users in Settings whenever you change your mind.'
            : 'Unblocking lets this user interact with you again and restores their activity in your feeds.'}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color={mode === 'block' ? 'error' : 'primary'}
          variant="contained"
          disabled={isProcessing}
        >
          {isProcessing ? 'Updating...' : mode === 'block' ? 'Block user' : 'Unblock user'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProfileBlockDialog;
