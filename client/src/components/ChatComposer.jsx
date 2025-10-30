import PropTypes from 'prop-types';
import { Box, TextField, Button, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/SendRounded';
import AddIcon from '@mui/icons-material/AddCircleOutlineRounded';

function ChatComposer({
  variant = 'legacy',
  message,
  placeholder,
  onMessageChange,
  onKeyDown,
  onSend,
  disabled = false,
  sendDisabled = false,
  isSending = false,
  containerRef,
  containerClassName,
  addAttachmentAriaLabel = 'Add attachment',
  onAddAttachment
}) {
  const sharedInputProps = {
    value: message,
    onChange: onMessageChange,
    onKeyDown,
    multiline: true,
    minRows: 1
  };

  if (variant === 'modern') {
    return (
      <Box
        component="form"
        className={containerClassName}
        ref={containerRef}
        onSubmit={onSend}
      >
        <IconButton
          className="add-img-btn"
          type="button"
          onClick={onAddAttachment}
          disabled={disabled || !onAddAttachment}
          aria-label={addAttachmentAriaLabel}
        >
          <AddIcon className="add-img-icon" />
        </IconButton>

        <TextField
          {...sharedInputProps}
          placeholder={placeholder}
          fullWidth
          variant="outlined"
          maxRows={5}
          className="chat-input"
          disabled={disabled}
        />

        <button
          className="send-message-btn"
          type="submit"
          disabled={sendDisabled}
        >
          <SendIcon className="send-message-icon" />
        </button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={onSend}
      sx={{
        display: 'flex',
        gap: 1,
        px: { xs: 2, md: 3 },
        py: 2,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      <TextField
        {...sharedInputProps}
        placeholder={placeholder}
        maxRows={4}
        fullWidth
        disabled={disabled}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        startIcon={<SendIcon />}
        disabled={sendDisabled}
      >
        {isSending ? 'Sending…' : 'Send'}
      </Button>
    </Box>
  );
}

ChatComposer.propTypes = {
  variant: PropTypes.oneOf(['legacy', 'modern']),
  message: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  onMessageChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  sendDisabled: PropTypes.bool,
  isSending: PropTypes.bool,
  containerRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ]),
  containerClassName: PropTypes.string,
  addAttachmentAriaLabel: PropTypes.string,
  onAddAttachment: PropTypes.func
};

export default ChatComposer;
