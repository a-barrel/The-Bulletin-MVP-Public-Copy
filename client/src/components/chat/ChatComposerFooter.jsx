import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import AttachmentPreview from './AttachmentPreview';
import ChatComposer from '../ChatComposer';

function ChatComposerFooter({
  attachments,
  attachmentStatus,
  isUploadingAttachment,
  attachmentUploadProgress,
  onRemoveAttachment,
  onRetryAttachment,
  canRetryAttachment,
  attachmentPadding,
  ...composerProps
}) {
  const showPreview =
    (attachments && attachments.length > 0) ||
    attachmentStatus ||
    isUploadingAttachment;

  return (
    <Box sx={{ width: '100%' }}>
      {showPreview ? (
        <AttachmentPreview
          attachments={attachments}
          onRemove={onRemoveAttachment}
          status={attachmentStatus}
          isUploading={isUploadingAttachment}
          uploadProgress={attachmentUploadProgress}
          onRetry={onRetryAttachment}
          canRetry={canRetryAttachment}
          padding={attachmentPadding}
        />
      ) : null}
      <ChatComposer {...composerProps} />
    </Box>
  );
}

ChatComposerFooter.propTypes = {
  attachments: PropTypes.arrayOf(PropTypes.object),
  attachmentStatus: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  isUploadingAttachment: PropTypes.bool,
  attachmentUploadProgress: PropTypes.shape({
    completed: PropTypes.number,
    total: PropTypes.number
  }),
  onRemoveAttachment: PropTypes.func,
  onRetryAttachment: PropTypes.func,
  canRetryAttachment: PropTypes.bool,
  attachmentPadding: PropTypes.oneOfType([PropTypes.number, PropTypes.object])
};

ChatComposerFooter.defaultProps = {
  attachments: [],
  attachmentStatus: null,
  isUploadingAttachment: false,
  attachmentUploadProgress: null,
  onRemoveAttachment: undefined,
  onRetryAttachment: undefined,
  canRetryAttachment: false,
  attachmentPadding: { xs: 2, md: 3 }
};

export default ChatComposerFooter;
