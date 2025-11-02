export const MAX_CHAT_ATTACHMENTS = 10;
export const ATTACHMENT_ONLY_PLACEHOLDER = '[attachment-only-message]';

export const generateAttachmentId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isSupportedImageFile = (file) => {
  if (!file) {
    return false;
  }
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  if (file.name) {
    return /\.(jpe?g|png|gif|webp|avif|heic|heif)$/i.test(file.name);
  }
  return false;
};

export const resolveAttachmentAsset = (file, uploaded = {}) => {
  if (!file) {
    throw new Error('File is required to resolve attachment asset.');
  }

  const url = uploaded?.url || uploaded?.path;
  if (!url) {
    throw new Error(`Upload failed for ${file.name || 'image'}.`);
  }

  return {
    url,
    width: uploaded?.width,
    height: uploaded?.height,
    mimeType: uploaded?.mimeType || file.type || undefined,
    description: uploaded?.fileName || file.name || undefined,
    uploadedAt: uploaded?.uploadedAt
  };
};
