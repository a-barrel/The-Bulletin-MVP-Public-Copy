import { useCallback, useRef } from 'react';
import useAttachmentManager, { mapDraftAttachmentPayloads } from './useAttachmentManager';
import { ATTACHMENT_ONLY_PLACEHOLDER, MAX_CHAT_ATTACHMENTS } from '../utils/chatAttachments';

export default function useRoomComposer({
  isOffline,
  selectedRoomId,
  messageDraft,
  setMessageDraft,
  handleSendMessage,
  handleMessageInputKeyDown,
  focusComposer
}) {
  const {
    attachments,
    status,
    setStatus,
    isUploading,
    uploadProgress,
    canRetry,
    handleFiles,
    retryFailed,
    removeAttachment,
    reset,
    canAttachMore
  } = useAttachmentManager();

  const attachmentInputRef = useRef(null);
  const composerInputRef = useRef(null);

  const handleOpenAttachmentPicker = useCallback(() => {
    if (isOffline) {
      setStatus({ type: 'error', message: 'Reconnect to upload images.' });
      return;
    }
    if (!selectedRoomId) {
      setStatus({ type: 'error', message: 'Select a room before uploading images.' });
      return;
    }
    if (!canAttachMore) {
      setStatus({
        type: 'error',
        message: `You can attach up to ${MAX_CHAT_ATTACHMENTS} images per message.`
      });
      return;
    }
    attachmentInputRef.current?.click();
  }, [canAttachMore, isOffline, selectedRoomId, setStatus]);

  const handleAttachmentInputChange = useCallback(
    async (event) => {
      const fileList = Array.from(event.target.files ?? []);
      if (event.target) {
        event.target.value = '';
      }
      if (!fileList.length) {
        return;
      }
      if (isOffline) {
        setStatus({ type: 'error', message: 'Reconnect to upload images.' });
        return;
      }
      if (!selectedRoomId) {
        setStatus({ type: 'error', message: 'Select a room before uploading images.' });
        return;
      }
      await handleFiles(fileList);
    },
    [handleFiles, isOffline, selectedRoomId, setStatus]
  );

  const handleMessageChange = useCallback(
    (event) => {
      setMessageDraft(event.target.value);
    },
    [setMessageDraft]
  );

  const handleSend = useCallback(
    async (event) => {
      if (isUploading) {
        event.preventDefault();
        setStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }
      const attachmentsPayload = mapDraftAttachmentPayloads(attachments);
      const hasText = messageDraft.trim().length > 0;
      const options = {
        attachments: attachmentsPayload,
        messageOverride: hasText || attachmentsPayload.length === 0 ? undefined : ATTACHMENT_ONLY_PLACEHOLDER
      };
      const sent = await handleSendMessage(event, options);
      if (sent) {
        reset();
        focusComposer(composerInputRef);
      }
    },
    [attachments, focusComposer, handleSendMessage, isUploading, messageDraft, reset, setStatus]
  );

  const handleKeyDown = useCallback(
    (event) => {
      const isPlainEnter =
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.nativeEvent?.isComposing;

      if (isPlainEnter && isUploading) {
        event.preventDefault();
        setStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }

      const attachmentsPayload = mapDraftAttachmentPayloads(attachments);
      const result = handleMessageInputKeyDown(event, {
        attachments: attachmentsPayload,
        messageOverride:
          messageDraft.trim().length > 0 || attachmentsPayload.length === 0
            ? undefined
            : ATTACHMENT_ONLY_PLACEHOLDER
      });
      Promise.resolve(result)
        .catch(() => {})
        .finally(() => focusComposer(composerInputRef));
    },
    [attachments, focusComposer, handleMessageInputKeyDown, isUploading, messageDraft, setStatus]
  );

  return {
    messageDraft,
    setMessageDraft,
    attachments,
    attachmentStatus: status,
    setAttachmentStatus: setStatus,
    isUploadingAttachment: isUploading,
    attachmentUploadProgress: uploadProgress,
    canRetryAttachment: canRetry,
    handleOpenAttachmentPicker,
    handleAttachmentInputChange,
    handleRemoveAttachment: removeAttachment,
    handleRetryAttachment: retryFailed,
    handleMessageChange,
    handleSend,
    handleKeyDown,
    attachmentInputRef,
    composerInputRef,
    resetAttachments: reset
  };
}
