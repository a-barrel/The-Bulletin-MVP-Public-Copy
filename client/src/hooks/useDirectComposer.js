import { useCallback, useRef, useState } from 'react';
import useAttachmentManager, { mapDraftAttachmentPayloads } from './useAttachmentManager';
import useDmGifPreview from './useDmGifPreview';
import { ATTACHMENT_ONLY_PLACEHOLDER, MAX_CHAT_ATTACHMENTS } from '../utils/chatAttachments';

export default function useDirectComposer({
  authUser,
  directMessagesHasAccess,
  selectedDirectThreadId,
  sendDirectMessage,
  focusComposer,
  isOffline
}) {
  const [messageDraft, setMessageDraft] = useState('');

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

  const {
    gifPreview: dmGifPreview,
    gifPreviewError: dmGifPreviewError,
    isGifPreviewLoading: isDmGifPreviewLoading,
    composerGifPreview: dmComposerGifPreview,
    ensureGifPreviewForMessage,
    confirmGifPreview: handleDmGifPreviewConfirm,
    cancelGifPreview: handleDmGifPreviewCancel,
    shuffleGifPreview: handleDmGifPreviewShuffle
  } = useDmGifPreview({
    authUser,
    messageDraft,
    setMessageDraft,
    selectedThreadId: selectedDirectThreadId,
    sendDirectMessage,
    resetAttachments: reset,
    setAttachmentStatus: setStatus,
    attachments
  });

  const attachmentInputRef = useRef(null);
  const composerInputRef = useRef(null);

  const handleOpenAttachmentPicker = useCallback(() => {
    if (isOffline) {
      setStatus({ type: 'error', message: 'Reconnect to upload images.' });
      return;
    }
    if (directMessagesHasAccess === false) {
      setStatus({ type: 'error', message: 'Direct messages are disabled for your account.' });
      return;
    }
    if (!selectedDirectThreadId) {
      setStatus({ type: 'error', message: 'Select a conversation before uploading images.' });
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
  }, [canAttachMore, directMessagesHasAccess, isOffline, selectedDirectThreadId, setStatus]);

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
      if (directMessagesHasAccess === false) {
        setStatus({ type: 'error', message: 'Direct messages are disabled for your account.' });
        return;
      }
      if (!selectedDirectThreadId) {
        setStatus({ type: 'error', message: 'Select a conversation before uploading images.' });
        return;
      }
      await handleFiles(fileList);
    },
    [directMessagesHasAccess, handleFiles, isOffline, selectedDirectThreadId, setStatus]
  );

  const handleMessageChange = useCallback((event) => {
    setMessageDraft(event.target.value);
  }, []);

  const handleSend = useCallback(
    async (event) => {
      event.preventDefault();
      if (directMessagesHasAccess === false) {
        setStatus({ type: 'error', message: 'Direct messages are disabled for your account.' });
        return;
      }
      if (!selectedDirectThreadId) {
        return;
      }
      if (isUploading) {
        setStatus({ type: 'info', message: 'Please wait for uploads to finish.' });
        return;
      }
      const trimmed = messageDraft.trim();
      const attachmentsPayload = mapDraftAttachmentPayloads(attachments);
      const hasText = trimmed.length > 0;
      const hasAttachments = attachmentsPayload.length > 0;
      if (!hasText && !hasAttachments) {
        return;
      }
      if (ensureGifPreviewForMessage(messageDraft)) {
        return;
      }
      const handledGif = await handleDmGifPreviewConfirm();
      if (handledGif) {
        return;
      }
      try {
        await sendDirectMessage({
          threadId: selectedDirectThreadId,
          body: hasText ? messageDraft : ATTACHMENT_ONLY_PLACEHOLDER,
          attachments: attachmentsPayload
        });
        setMessageDraft('');
        reset();
        handleDmGifPreviewCancel();
        focusComposer(composerInputRef);
      } catch {
        // surfaced via send status
      }
    },
    [
      attachments,
      ensureGifPreviewForMessage,
      focusComposer,
      handleDmGifPreviewCancel,
      handleDmGifPreviewConfirm,
      isUploading,
      messageDraft,
      reset,
      selectedDirectThreadId,
      sendDirectMessage,
      setStatus
    ]
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
    attachmentInputRef,
    composerInputRef,
    gifPreview: dmComposerGifPreview,
    gifPreviewError: dmGifPreviewError,
    isGifPreviewLoading: isDmGifPreviewLoading,
    handleGifPreviewConfirm: handleDmGifPreviewConfirm,
    handleGifPreviewCancel: handleDmGifPreviewCancel,
    handleGifPreviewShuffle: handleDmGifPreviewShuffle,
    resetAttachments: reset
  };
}
