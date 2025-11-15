import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';

function AttachmentPreview({
  attachments,
  onRemove,
  status,
  isUploading,
  uploadProgress,
  onRetry,
  canRetry,
  padding
}) {
  if (!attachments.length && !status && !isUploading) {
    return null;
  }

  const progressLabel = (() => {
    if (!uploadProgress || typeof uploadProgress.total !== 'number' || uploadProgress.total <= 0) {
      return 'Uploading…';
    }
    const completed = Math.min(uploadProgress.completed || 0, uploadProgress.total);
    return `Uploading ${completed}/${uploadProgress.total}…`;
  })();

  return (
    <>
      {status ? (
        <Box sx={{ px: padding, pb: 1 }}>
          <Alert
            severity={status.type}
            action={
              status.type === 'error' && typeof onRetry === 'function' && canRetry ? (
                <Button color="inherit" size="small" onClick={onRetry}>
                  Retry
                </Button>
              ) : null
            }
          >
            {status.message}
          </Alert>
        </Box>
      ) : null}
      {attachments.length ? (
        <Box sx={{ px: padding, pb: 1 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {attachments.map((item) => (
              <Box
                key={item.id}
                sx={{
                  position: 'relative',
                  width: 132,
                  height: 132,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  backgroundColor: 'background.paper',
                  boxShadow: 3
                }}
              >
                <Box
                  component="img"
                  src={item.asset.url}
                  alt={item.asset.description || 'Chat attachment'}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {typeof onRemove === 'function' ? (
                  <IconButton
                    size="small"
                    aria-label="Remove attachment"
                    onClick={() => onRemove(item.id)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.75)'
                      }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
      {isUploading ? (
        <Box sx={{ px: padding, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {progressLabel}
          </Typography>
        </Box>
      ) : null}
    </>
  );
}

AttachmentPreview.propTypes = {
  attachments: PropTypes.arrayOf(PropTypes.object),
  onRemove: PropTypes.func,
  status: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  isUploading: PropTypes.bool,
  uploadProgress: PropTypes.shape({
    completed: PropTypes.number,
    total: PropTypes.number
  }),
  onRetry: PropTypes.func,
  canRetry: PropTypes.bool,
  padding: PropTypes.oneOfType([PropTypes.number, PropTypes.object])
};

AttachmentPreview.defaultProps = {
  attachments: [],
  onRemove: undefined,
  status: null,
  isUploading: false,
  uploadProgress: null,
  onRetry: undefined,
  canRetry: false,
  padding: { xs: 2, md: 3 }
};

export default AttachmentPreview;
