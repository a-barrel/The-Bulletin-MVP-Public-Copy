import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

function BookmarksStatusToasts({
  exportStatus,
  onClearExport,
  removalStatus,
  onClearRemoval,
  autoHideDuration = 4000
}) {
  return (
    <>
      <Snackbar
        open={Boolean(exportStatus)}
        autoHideDuration={autoHideDuration}
        onClose={(_event, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          onClearExport();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {exportStatus ? (
          <Alert
            severity={exportStatus.type}
            variant="filled"
            onClose={onClearExport}
            sx={{ width: '100%' }}
          >
            {exportStatus.message}
          </Alert>
        ) : null}
      </Snackbar>

      <Snackbar
        open={Boolean(removalStatus)}
        autoHideDuration={autoHideDuration}
        onClose={(_event, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          onClearRemoval();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mt: 2 }}
      >
        {removalStatus ? (
          <Alert
            severity={removalStatus.type}
            variant="filled"
            onClose={onClearRemoval}
            sx={{ width: '100%' }}
          >
            {removalStatus.message}
          </Alert>
        ) : null}
      </Snackbar>
    </>
  );
}

export default BookmarksStatusToasts;
