import { useCallback, useState } from 'react';
import { exportBookmarks, removeBookmark } from '../api';

export default function useBookmarkActions({ authUser, isOffline, setBookmarks }) {
  const [removalStatus, setRemovalStatus] = useState(null);
  const [removingPinId, setRemovingPinId] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleRemoveBookmark = useCallback(
    async (bookmark) => {
      const pinId = bookmark?.pinId || bookmark?.pin?._id;
      if (!pinId) {
        setRemovalStatus({ type: 'error', message: 'Bookmark does not include a pin id.' });
        return;
      }

      if (isOffline) {
        setRemovalStatus({ type: 'warning', message: 'Reconnect to remove bookmarks.' });
        return;
      }

      setRemovalStatus(null);
      setRemovingPinId(pinId);
      try {
        await removeBookmark(pinId);
        setBookmarks((prev) =>
          prev.filter((candidate) => {
            if (candidate._id && bookmark._id) {
              return candidate._id !== bookmark._id;
            }
            return candidate.pinId !== pinId;
          })
        );
        setRemovalStatus({ type: 'success', message: 'Bookmark removed.' });
      } catch (err) {
        console.error('Failed to remove bookmark:', err);
        setRemovalStatus({ type: 'error', message: err?.message || 'Failed to remove bookmark.' });
      } finally {
        setRemovingPinId(null);
      }
    },
    [isOffline, setBookmarks]
  );

  const handleExport = useCallback(
    async (totalCount) => {
      if (!authUser) {
        setExportStatus({ type: 'error', message: 'Sign in to export your bookmarks.' });
        return;
      }

      if (isOffline) {
        setExportStatus({ type: 'warning', message: 'Reconnect to export your bookmarks.' });
        return;
      }

      setExportStatus(null);
      setIsExporting(true);
      try {
        const { blob, filename } = await exportBookmarks();
        const downloadUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename || 'bookmarks.csv';
        document.body.appendChild(anchor);
        anchor.click();
        window.setTimeout(() => {
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(downloadUrl);
        }, 0);

        setExportStatus({
          type: 'success',
          message:
            totalCount > 0
              ? `Exported ${totalCount} bookmark${totalCount === 1 ? '' : 's'} to ${filename || 'bookmarks.csv'}.`
              : `Export ready. ${filename || 'bookmarks.csv'} downloaded.`
        });
      } catch (err) {
        console.error('Failed to export bookmarks:', err);
        setExportStatus({ type: 'error', message: err?.message || 'Failed to export bookmarks.' });
      } finally {
        setIsExporting(false);
      }
    },
    [authUser, isOffline]
  );

  return {
    removalStatus,
    setRemovalStatus,
    removingPinId,
    handleRemoveBookmark,
    exportStatus,
    setExportStatus,
    isExporting,
    handleExport
  };
}
