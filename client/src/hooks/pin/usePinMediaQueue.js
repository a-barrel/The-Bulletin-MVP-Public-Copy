import { useCallback, useEffect, useState } from 'react';
import { uploadPinImage } from '../../api';

const DEFAULT_MAX_PHOTOS = 3;

export default function usePinMediaQueue({ isOffline, maxPhotos = DEFAULT_MAX_PHOTOS }) {
  const [photoAssets, setPhotoAssets] = useState([]);
  const [coverPhotoId, setCoverPhotoId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (!photoAssets.length) {
      if (coverPhotoId !== null) {
        setCoverPhotoId(null);
      }
      return;
    }

    if (!coverPhotoId || !photoAssets.some((photo) => photo.id === coverPhotoId)) {
      setCoverPhotoId(photoAssets[0].id);
    }
  }, [coverPhotoId, photoAssets]);

  const clearUploadStatus = useCallback(() => setUploadStatus(null), []);

  const resetMedia = useCallback(() => {
    setPhotoAssets([]);
    setCoverPhotoId(null);
    setUploadStatus(null);
    setIsUploading(false);
  }, []);

  const hydrateMedia = useCallback((assets = [], coverId = null) => {
    if (Array.isArray(assets)) {
      setPhotoAssets(assets);
    }
    if (coverId) {
      setCoverPhotoId(coverId);
    }
  }, []);

  const handleImageSelection = useCallback(
    async (event) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        return;
      }

      if (isOffline) {
        setUploadStatus({ type: 'warning', message: 'You are offline. Connect to upload images.' });
        event.target.value = '';
        return;
      }

      const remainingSlots = maxPhotos - photoAssets.length;
      if (remainingSlots <= 0) {
        setUploadStatus({
          type: 'warning',
          message: `You can attach up to ${maxPhotos} images per pin.`
        });
        event.target.value = '';
        return;
      }

      const filesToUpload = files.slice(0, remainingSlots);
      if (filesToUpload.length < files.length) {
        setUploadStatus({
          type: 'info',
          message: `Only the first ${filesToUpload.length} image${
            filesToUpload.length === 1 ? '' : 's'
          } were queued (max ${maxPhotos}).`
        });
      }

      setIsUploading(true);
      const successfulUploads = [];
      const failedUploads = [];

      for (const file of filesToUpload) {
        try {
          const uploaded = await uploadPinImage(file);
          successfulUploads.push({
            id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            asset: {
              url: uploaded.url,
              width: uploaded.width,
              height: uploaded.height,
              mimeType: uploaded.mimeType ?? (file.type || 'image/jpeg'),
              description: uploaded.fileName || file.name || 'Pin image'
            }
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : `Failed to upload ${file.name || 'image'}.`;
          failedUploads.push(message);
        }
      }

      if (successfulUploads.length) {
        setPhotoAssets((prev) => [...prev, ...successfulUploads]);
      }

      if (failedUploads.length && successfulUploads.length) {
        setUploadStatus({
          type: 'warning',
          message: `Uploaded ${successfulUploads.length} image${
            successfulUploads.length === 1 ? '' : 's'
          }, but ${failedUploads.length} failed. ${failedUploads[0]}`
        });
      } else if (failedUploads.length) {
        setUploadStatus({ type: 'error', message: failedUploads[0] });
      } else if (successfulUploads.length) {
        setUploadStatus({
          type: 'success',
          message: `Uploaded ${successfulUploads.length} image${
            successfulUploads.length === 1 ? '' : 's'
          }.`
        });
      }

      setIsUploading(false);
      event.target.value = '';
    },
    [isOffline, maxPhotos, photoAssets.length]
  );

  const handleRemovePhoto = useCallback((photoId) => {
    setPhotoAssets((prev) => prev.filter((photo) => photo.id !== photoId));
    setUploadStatus({ type: 'info', message: 'Removed image from pin.' });
  }, []);

  const handleSetCoverPhoto = useCallback((photoId) => {
    setCoverPhotoId(photoId);
    setUploadStatus({ type: 'success', message: 'Cover photo updated.' });
  }, []);

  return {
    photoAssets,
    coverPhotoId,
    isUploading,
    uploadStatus,
    setUploadStatus,
    clearUploadStatus,
    handleImageSelection,
    handleRemovePhoto,
    handleSetCoverPhoto,
    hydrateMedia,
    resetMedia
  };
}
