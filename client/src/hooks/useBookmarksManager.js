import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  exportBookmarks,
  fetchBookmarks,
  fetchBookmarkCollections,
  removeBookmark
} from '../api/mongoDataApi';
import { formatAbsoluteDateTime, formatRelativeTime } from '../utils/dates';
import reportClientError from '../utils/reportClientError';

const EMPTY_GROUP = 'Unsorted';

const formatSavedDate = (input) => {
  if (!input) {
    return 'Unknown date';
  }
  const relative = formatRelativeTime(input);
  const absolute = formatAbsoluteDateTime(input);
  if (relative && absolute) {
    return `${relative} (${absolute})`;
  }
  return absolute || relative || 'Unknown date';
};

const groupBookmarks = (bookmarks, collectionsById) => {
  const groups = new Map();

  bookmarks.forEach((bookmark) => {
    const collectionId = bookmark.collectionId || null;
    const collection = collectionsById.get(collectionId) ?? null;
    const key = collectionId ?? '__ungrouped__';

    if (!groups.has(key)) {
      groups.set(key, {
        id: collectionId,
        name: collection?.name ?? EMPTY_GROUP,
        description: collection?.description ?? '',
        items: []
      });
    }

    groups.get(key).items.push(bookmark);
  });

  return Array.from(groups.values());
};

export default function useBookmarksManager({ authUser, authLoading, isOffline }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removalStatus, setRemovalStatus] = useState(null);
  const [removingPinId, setRemovingPinId] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const collectionsById = useMemo(() => {
    const map = new Map();
    collections.forEach((collection) => {
      map.set(collection._id, collection);
    });
    return map;
  }, [collections]);

  const groupedBookmarks = useMemo(
    () => groupBookmarks(bookmarks, collectionsById),
    [bookmarks, collectionsById]
  );

  const totalCount = bookmarks.length;

  const loadData = useCallback(async () => {
    if (!authUser) {
      setError('Sign in to view your bookmarks.');
      setBookmarks([]);
      setCollections([]);
      return;
    }

    if (isOffline) {
      setIsLoading(false);
      setError('You are offline. Connect to refresh your bookmarks.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [bookmarkPayload, collectionPayload] = await Promise.all([
        fetchBookmarks(),
        fetchBookmarkCollections()
      ]);
      setBookmarks(Array.isArray(bookmarkPayload) ? bookmarkPayload : []);
      setCollections(Array.isArray(collectionPayload) ? collectionPayload : []);
    } catch (err) {
      reportClientError(err, 'Failed to load bookmarks:', {
        source: 'useBookmarksManager.loadData'
      });
      setBookmarks([]);
      setCollections([]);
      setError(err?.message || 'Failed to load bookmarks.');
    } finally {
      setIsLoading(false);
    }
  }, [authUser, isOffline]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!authUser) {
      setBookmarks([]);
      setCollections([]);
      setError('Sign in to view your bookmarks.');
      setIsLoading(false);
      return;
    }
    loadData();
  }, [authLoading, authUser, isOffline, loadData]);

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
          reportClientError(err, 'Failed to remove bookmark:', {
            source: 'useBookmarksManager.remove',
            pinId
          });
          setRemovalStatus({ type: 'error', message: err?.message || 'Failed to remove bookmark.' });
        } finally {
        setRemovingPinId(null);
      }
    },
    [isOffline]
  );

  const handleExport = useCallback(async () => {
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
      reportClientError(err, 'Failed to export bookmarks:', {
        source: 'useBookmarksManager.export'
      });
      setExportStatus({ type: 'error', message: err?.message || 'Failed to export bookmarks.' });
    } finally {
      setIsExporting(false);
    }
  }, [authUser, isOffline, totalCount]);

  return {
    bookmarks,
    groupedBookmarks,
    totalCount,
    isLoading,
    error,
    setError,
    removalStatus,
    setRemovalStatus,
    removingPinId,
    isExporting,
    exportStatus,
    setExportStatus,
    handleRemoveBookmark,
    handleExport,
    refresh: loadData,
    formatSavedDate,
    collections,
    collectionsById
  };
}

export { formatSavedDate };
