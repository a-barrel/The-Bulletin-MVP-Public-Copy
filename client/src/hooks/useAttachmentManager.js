import { useCallback, useMemo, useState } from 'react';

import { uploadImage } from '../api/mongoDataApi';
import {
  ATTACHMENT_ONLY_PLACEHOLDER,
  MAX_CHAT_ATTACHMENTS,
  generateAttachmentId,
  isSupportedImageFile,
  resolveAttachmentAsset
} from '../utils/chatAttachments';

const defaultStatus = null;

export default function useAttachmentManager({
  maxAttachments = MAX_CHAT_ATTACHMENTS,
  uploadFn = uploadImage
} = {}) {
  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState(defaultStatus);
  const [failedFiles, setFailedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const reset = useCallback(() => {
    setAttachments([]);
    setStatus(defaultStatus);
    setFailedFiles([]);
    setIsUploading(false);
    setUploadProgress(null);
  }, []);

  const removeAttachment = useCallback((attachmentId) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  }, []);

  const buildStatusPayload = useCallback((messages, hasError) => {
    if (!messages.length) {
      return null;
    }
    const joined = messages.join(' ');
    return {
      type: hasError ? 'error' : 'info',
      message: joined
    };
  }, []);

  const handleFiles = useCallback(
    async (filesLike) => {
      const files = Array.isArray(filesLike) ? filesLike : Array.from(filesLike ?? []);
      if (!files.length) {
        return { added: 0, failed: 0, overflow: 0, unsupported: 0 };
      }

      const currentCount = attachments.length;
      const remainingSlots = Math.max(0, maxAttachments - currentCount);
      if (remainingSlots <= 0) {
        const message = `You can attach up to ${maxAttachments} images per message.`;
        setStatus({ type: 'error', message });
        return { added: 0, failed: files.length, overflow: files.length, unsupported: 0 };
      }

      const queue = files.slice(0, remainingSlots);
      const overflow = files.length - queue.length;
      const supported = queue.filter(isSupportedImageFile);
      const unsupported = queue.length - supported.length;

      const preflightMessages = [];
      let hasError = false;

      if (overflow > 0) {
        preflightMessages.push(
          `Only the first ${remainingSlots} file${remainingSlots === 1 ? '' : 's'} were attached.`
        );
      }
      if (unsupported > 0) {
        hasError = true;
        preflightMessages.push(
          'Unsupported file type removed. Only image and GIF files are supported.'
        );
      }

      if (!supported.length) {
        setFailedFiles([]);
        setIsUploading(false);
        setUploadProgress(null);
        setStatus(buildStatusPayload(preflightMessages, hasError));
        return { added: 0, failed: queue.length, overflow, unsupported };
      }

      setIsUploading(true);
      setUploadProgress({ total: supported.length, completed: 0 });
      const uploadedEntries = [];
      const failedUploads = [];

      for (let index = 0; index < supported.length; index += 1) {
        const file = supported[index];
        try {
          const uploaded = await uploadFn(file);
          const asset = resolveAttachmentAsset(file, uploaded);
          uploadedEntries.push({
            id: generateAttachmentId(),
            asset
          });
        } catch (error) {
          failedUploads.push({ file, error });
        }
        setUploadProgress({ total: supported.length, completed: index + 1 });
      }

      setAttachments((prev) => [...prev, ...uploadedEntries]);
      setFailedFiles(failedUploads.map((entry) => entry.file));

      const uploadMessages = [...preflightMessages];
      if (failedUploads.length > 0) {
        hasError = true;
        uploadMessages.push(
          `Failed to upload ${failedUploads.length} attachment${
            failedUploads.length === 1 ? '' : 's'
          }. You can retry.`
        );
      }

      setStatus(buildStatusPayload(uploadMessages, hasError));
      setIsUploading(false);
      setUploadProgress(null);

      return {
        added: uploadedEntries.length,
        failed: failedUploads.length,
        overflow,
        unsupported
      };
    },
    [attachments.length, buildStatusPayload, maxAttachments, uploadFn]
  );

  const retryFailed = useCallback(async () => {
    if (!failedFiles.length) {
      return { added: 0, failed: 0 };
    }
    const outcome = await handleFiles(failedFiles);
    if (!outcome.failed) {
      setFailedFiles([]);
    }
    return outcome;
  }, [failedFiles, handleFiles]);

  const canRetry = useMemo(() => failedFiles.length > 0, [failedFiles.length]);
  const canAttachMore = useMemo(
    () => attachments.length < maxAttachments,
    [attachments.length, maxAttachments]
  );

  return {
    attachments,
    status,
    setStatus,
    isUploading,
    uploadProgress,
    failedFiles,
    canRetry,
    canAttachMore,
    handleFiles,
    retryFailed,
    removeAttachment,
    reset
  };
}

export function mapDraftAttachmentPayloads(attachments = []) {
  return attachments.map((item) => item.asset);
}

export function sanitizeAttachmentOnlyMessage(message, attachments) {
  if (!attachments || attachments.length === 0) {
    return message;
  }
  if (typeof message !== 'string') {
    return '';
  }
  return message === ATTACHMENT_ONLY_PLACEHOLDER ? '' : message;
}
