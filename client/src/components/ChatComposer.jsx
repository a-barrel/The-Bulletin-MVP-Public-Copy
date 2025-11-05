import PropTypes from 'prop-types';
import {
  Box,
  TextField,
  Button,
  IconButton,
  Stack,
  Typography,
  CircularProgress,
  Tooltip
} from '@mui/material';
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
  addAttachmentTooltip = 'Add image or GIF',
  onAddAttachment,
  inputRef,
  gifPreview,
  gifPreviewError,
  isGifPreviewLoading = false,
  onGifPreviewConfirm,
  onGifPreviewCancel,
  onGifPreviewShuffle
}) {
  const sharedInputProps = {
    value: message,
    onChange: onMessageChange,
    onKeyDown,
    multiline: true,
    minRows: 1,
    inputRef
  };

  const hasPendingPreview = Boolean(gifPreview || gifPreviewError);
  const previewActive = Boolean(isGifPreviewLoading) || hasPendingPreview;
  const effectiveSendDisabled = sendDisabled || previewActive;
  const previewOptions = Array.isArray(gifPreview?.options) ? gifPreview.options : [];
  const previewSelectedIndex =
    typeof gifPreview?.selectedIndex === 'number' && gifPreview.selectedIndex >= 0
      ? gifPreview.selectedIndex
      : 0;
  const previewAttachment =
    gifPreview?.attachment ??
    (previewOptions.length > 0 ? previewOptions[previewSelectedIndex]?.attachment : undefined);
  const previewHasMultipleOptions = previewOptions.length > 1;

  const handleConfirmClick = (event) => {
    event.preventDefault();
    if (typeof onGifPreviewConfirm === 'function') {
      onGifPreviewConfirm();
    }
  };

  const handleCancelClick = (event) => {
    event.preventDefault();
    if (typeof onGifPreviewCancel === 'function') {
      onGifPreviewCancel();
    }
  };

  const handleShuffleClick = (event) => {
    event.preventDefault();
    if (typeof onGifPreviewShuffle === 'function') {
      onGifPreviewShuffle();
    }
  };

  const renderPreviewPanel = (mode) => {
    if (!previewActive) {
      return null;
    }

    return (
      <Box
        className="chat-composer-gif-preview"
        sx={{
          position: 'absolute',
          bottom: 'calc(100% + 12px)',
          right: 0,
          p: 1.5,
          width: mode === 'legacy' ? { xs: 'min(90vw, 320px)', sm: 320 } : { xs: 'min(90vw, 320px)' },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          backgroundColor: 'background.default',
          boxShadow: 6,
          zIndex: 20
        }}
      >
        {isGifPreviewLoading ? (
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            <CircularProgress size={20} />
            <Typography variant="body2">Searching Tenor…</Typography>
          </Stack>
        ) : gifPreviewError ? (
          <Stack spacing={1}>
            <Typography variant="body2" color="error">
              {gifPreviewError}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={handleShuffleClick}>
                Try Again
              </Button>
              <Button size="small" onClick={handleCancelClick}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography variant="body2">
              Previewing <strong>/gif {gifPreview?.query || ''}</strong>
            </Typography>
            {previewAttachment?.url ? (
              <Box
                component="img"
                src={previewAttachment.url}
                alt={previewAttachment?.description || `GIF for ${gifPreview?.query || 'preview'}`}
                sx={{ maxWidth: '100%', borderRadius: 1.5 }}
                loading="lazy"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No preview available yet.
              </Typography>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-start" flexWrap="wrap">
              <Button
                size="small"
                variant="contained"
                onClick={handleConfirmClick}
                disabled={!previewAttachment || disabled || isSending}
              >
                Send GIF
              </Button>
              <Button
                size="small"
                onClick={handleShuffleClick}
                disabled={isGifPreviewLoading || (!previewHasMultipleOptions && !previewAttachment)}
              >
                Shuffle
              </Button>
              <Button size="small" onClick={handleCancelClick}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    );
  };

  if (variant === 'modern') {
    const attachmentButton = (
      <IconButton
        className="add-img-btn"
        type="button"
        onClick={onAddAttachment}
        disabled={disabled || !onAddAttachment}
        aria-label={addAttachmentAriaLabel}
        sx={{
          color: 'primary.main',
          backgroundColor: 'rgba(124, 77, 255, 0.08)',
          transition: 'background-color 120ms ease, transform 120ms ease',
          '&:hover, &:focus-visible': {
            backgroundColor: 'rgba(124, 77, 255, 0.18)',
            transform: 'scale(1.05)'
          },
          '&.Mui-disabled': {
            backgroundColor: 'transparent',
            color: 'action.disabled'
          }
        }}
      >
        <AddIcon className="add-img-icon" />
      </IconButton>
    );

    return (
      <Box
        component="form"
        className={containerClassName}
        ref={containerRef}
        onSubmit={onSend}
        sx={{ position: 'relative', width: '100%' }}
      >
        {renderPreviewPanel('modern')}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}>
          {onAddAttachment ? (
            <Tooltip title={addAttachmentTooltip} enterDelay={200} arrow>
              <span>{attachmentButton}</span>
            </Tooltip>
          ) : (
            attachmentButton
          )}

          <TextField
            {...sharedInputProps}
            placeholder={placeholder}
            fullWidth
            variant="outlined"
            maxRows={5}
            className="chat-input"
            inputRef={inputRef}
            disabled={disabled}
          />

          <button
            className="send-message-btn"
            type="submit"
            disabled={effectiveSendDisabled}
            aria-disabled={effectiveSendDisabled}
          >
            <SendIcon className="send-message-icon" />
          </button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={onSend}
      sx={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        gap: 1,
        px: { xs: 12, md: 16 },
        py: 2,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      {renderPreviewPanel('legacy')}
      {onAddAttachment ? (
        <Tooltip title={addAttachmentTooltip} enterDelay={200} arrow>
          <span>
            <IconButton
              className="add-img-btn"
              type="button"
              onClick={onAddAttachment}
              disabled={disabled}
              aria-label={addAttachmentAriaLabel}
              sx={{
                color: 'primary.main',
                transition: 'background-color 120ms ease, transform 120ms ease',
                backgroundColor: 'rgba(124, 77, 255, 0.08)',
                '&:hover, &:focus-visible': {
                  backgroundColor: 'rgba(124, 77, 255, 0.18)',
                  transform: 'scale(1.05)'
                },
                '&.Mui-disabled': {
                  backgroundColor: 'transparent',
                  color: 'action.disabled'
                }
              }}
            >
              <AddIcon className="add-img-icon" />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      <TextField
        {...sharedInputProps}
        placeholder={placeholder}
        maxRows={4}
        fullWidth
        inputRef={inputRef}
        disabled={disabled}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        startIcon={<SendIcon />}
        disabled={effectiveSendDisabled}
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
  addAttachmentTooltip: PropTypes.string,
  onAddAttachment: PropTypes.func,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  gifPreview: PropTypes.shape({
    query: PropTypes.string,
    attachment: PropTypes.oneOfType([
      PropTypes.shape({
        url: PropTypes.string.isRequired,
        thumbnailUrl: PropTypes.string,
        width: PropTypes.number,
        height: PropTypes.number,
        mimeType: PropTypes.string,
        description: PropTypes.string
      }),
      PropTypes.oneOf([null])
    ]),
    sourceUrl: PropTypes.string,
    optionsCount: PropTypes.number
  }),
  gifPreviewError: PropTypes.string,
  isGifPreviewLoading: PropTypes.bool,
  onGifPreviewConfirm: PropTypes.func,
  onGifPreviewCancel: PropTypes.func,
  onGifPreviewShuffle: PropTypes.func
};

export default ChatComposer;
