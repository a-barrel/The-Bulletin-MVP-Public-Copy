import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography
} from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';

function BlockedUsersDialog({
  open,
  status,
  onClearStatus,
  isLoading,
  users,
  onUnblock,
  isOffline,
  isManaging,
  onClose
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Blocked users</DialogTitle>
      <DialogContent dividers>
        {status ? (
          <Alert severity={status.type} sx={{ mb: 2 }} onClose={onClearStatus}>
            {status.message}
          </Alert>
        ) : null}
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading blocked users...
            </Typography>
          </Stack>
        ) : users.length ? (
          <List disablePadding sx={{ mt: -1 }}>
            {users.map((user) => {
              const primary = user.displayName || user.username || user._id;
              const secondary =
                user.username && user.username !== primary
                  ? `@${user.username}`
                  : user.email || user._id;
              const avatarSource =
                user?.avatar?.url || user?.avatar?.thumbnailUrl || user?.avatar?.path || null;
              return (
                <ListItem
                  key={user._id}
                  secondaryAction={
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<HowToRegIcon />}
                      onClick={() => onUnblock(user._id)}
                      disabled={isOffline || isManaging}
                      title={isOffline ? 'Reconnect to unblock users' : undefined}
                    >
                      Unblock
                    </Button>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={avatarSource || undefined}>
                      {primary?.charAt(0)?.toUpperCase() ?? 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={primary} secondary={secondary} />
                </ListItem>
              );
            })}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            You haven&apos;t blocked any users yet. Block someone from their profile to see them here.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isManaging}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BlockedUsersDialog;
