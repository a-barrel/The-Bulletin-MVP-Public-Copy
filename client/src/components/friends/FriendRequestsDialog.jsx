import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import NoFriendRequestsIcon from '@mui/icons-material/GroupOffRounded';

function FriendRequestsDialog({
  open,
  onClose,
  requests,
  actionStatus,
  respondingRequestId,
  onRespond,
  formatTimestamp
}) {
  const hasRequests = Array.isArray(requests) && requests.length > 0;
  const disabledClose = Boolean(respondingRequestId);

  return (
    <Dialog
      className="friend-dialog-overlay"
      open={open}
      onClose={disabledClose ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle className="friend-dialog-title">Pending Friend Requests</DialogTitle>
      <DialogContent dividers={false} className="friend-dialog-content">
        <Stack spacing={2}>
          {actionStatus ? (
            <Alert severity={actionStatus.type || 'info'} className="friend-dialog-alert">
              {actionStatus.message}
            </Alert>
          ) : null}

          {!hasRequests ? (
            <Box className="friend-dialog-empty-container">
              <NoFriendRequestsIcon className="friend-dialog-empty-icon" />
              <Typography className="friend-dialog-empty-desc">
                All caught up! You have no pending friend requests.
              </Typography>
            </Box>
          ) : (
            requests.map((request) => {
              const requesterName =
                request.requester?.displayName ||
                request.requester?.username ||
                request.requester?.id ||
                'Unknown user';
              const isUpdating = respondingRequestId === request.id;

              return (
                <Paper key={request.id} className="friend-dialog-request-card">
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" className="friend-dialog-request-name">
                        {requesterName}
                      </Typography>
                      <Typography variant="caption" className="friend-dialog-request-time">
                        {request.createdAt && formatTimestamp
                          ? formatTimestamp(request.createdAt)
                          : ''}
                      </Typography>
                    </Stack>

                    {request.message ? (
                      <Typography variant="body2" className="friend-dialog-request-message">
                        “{request.message}”
                      </Typography>
                    ) : null}

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        className="friend-dialog-accept-btn"
                        onClick={() => onRespond?.(request.id, 'accept')}
                        disabled={isUpdating}
                      >
                        {isUpdating ? 'Updating…' : 'Accept'}
                      </Button>
                      <Button
                        variant="outlined"
                        className="friend-dialog-decline-btn"
                        onClick={() => onRespond?.(request.id, 'decline')}
                        disabled={isUpdating}
                      >
                        Decline
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          )}
        </Stack>
      </DialogContent>
      <DialogActions className="friend-dialog-actions-container">
        <Button
          className="friend-dialog-close-btn"
          onClick={onClose}
          disabled={disabledClose}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

FriendRequestsDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  requests: PropTypes.arrayOf(PropTypes.object),
  actionStatus: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  respondingRequestId: PropTypes.string,
  onRespond: PropTypes.func,
  formatTimestamp: PropTypes.func
};

FriendRequestsDialog.defaultProps = {
  open: false,
  onClose: undefined,
  requests: [],
  actionStatus: null,
  respondingRequestId: null,
  onRespond: undefined,
  formatTimestamp: undefined
};

export default FriendRequestsDialog;
