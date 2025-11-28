import PropTypes from 'prop-types';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

function ChatSnackbars({
  reportStatus,
  onCloseReportStatus,
  directSendStatus,
  onCloseDirectSendStatus,
  friendActionStatus,
  onCloseFriendActionStatus,
  scrollButtonOffset,
  channelTab
}) {
  return (
    <>
      <Snackbar
        open={Boolean(reportStatus)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          onCloseReportStatus();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: `${scrollButtonOffset + 72}px` }}
      >
        {reportStatus ? (
          <Alert elevation={6} variant="filled" severity={reportStatus.type} onClose={onCloseReportStatus}>
            {reportStatus.message}
          </Alert>
        ) : null}
      </Snackbar>

      <Snackbar
        open={channelTab === 'direct' && Boolean(directSendStatus)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          onCloseDirectSendStatus();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ bottom: `${scrollButtonOffset + 72}px`, right: 16 }}
      >
        {directSendStatus ? (
          <Alert
            elevation={6}
            variant='filled'
            severity={directSendStatus.type}
            onClose={onCloseDirectSendStatus}
          >
            {directSendStatus.message}
          </Alert>
        ) : null}
      </Snackbar>

      <Snackbar
        open={Boolean(friendActionStatus)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          onCloseFriendActionStatus();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: `${scrollButtonOffset + 40}px` }}
      >
        {friendActionStatus ? (
          <Alert
            elevation={6}
            variant='filled'
            severity={friendActionStatus.type || 'info'}
            onClose={onCloseFriendActionStatus}
          >
            {friendActionStatus.message}
          </Alert>
        ) : null}
      </Snackbar>
    </>
  );
}

ChatSnackbars.propTypes = {
  reportStatus: PropTypes.object,
  onCloseReportStatus: PropTypes.func.isRequired,
  directSendStatus: PropTypes.object,
  onCloseDirectSendStatus: PropTypes.func.isRequired,
  friendActionStatus: PropTypes.object,
  onCloseFriendActionStatus: PropTypes.func.isRequired,
  scrollButtonOffset: PropTypes.number.isRequired,
  channelTab: PropTypes.string.isRequired
};

ChatSnackbars.defaultProps = {
  reportStatus: null,
  directSendStatus: null,
  friendActionStatus: null
};

export default ChatSnackbars;
