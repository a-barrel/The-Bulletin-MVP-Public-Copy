import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import './AttachmentPreview.css';

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
  const [closingIds, setClosingIds] = useState(new Set());

  const handleRemove = (id) => {
    // Mark attachment as closing (to trigger fade-out)
    setClosingIds(prev => new Set(prev).add(id));

    // After animation duration (300ms), actually remove the attachment
    setTimeout(() => {
      onRemove(id);
      setClosingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

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
    <Box className="attachment-preview-container">
      {status ? (
        <Box className="attachment-preview-error-container">
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
        <Box className="attachment-preview-img-list">
          {attachments.map((item) => (
            <Box
              className={`attachment-preview-img-container ${closingIds.has(item.id) ? 'fade-out' : ''}`}
              key={item.id}
            >
              <Box
                className="attachment-preview-img"
                component="img"
                src={item.asset.url}
                alt={item.asset.description || 'Chat attachment'}
              />
              {typeof onRemove === 'function' ? (
                <IconButton
                  className="attachment-preview-close-btn"
                  aria-label="Remove attachment"
                  onClick={() => handleRemove(item.id)}
                  disabled={closingIds.has(item.id)}
                >
                  <CloseIcon className="attachment-preview-close-icon" />
                </IconButton>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}

      {isUploading ? (
        <Box className="attachment-preview-loading-container">
          <CircularProgress
            className="attachment-preview-loading-bar" 
            size={32} 
          />
          <Typography className="attachment-preview-loading-label">
            {progressLabel}
          </Typography>
        </Box>
      ) : null}
    </Box>
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
