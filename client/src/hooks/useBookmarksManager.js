/**
 * useBookmarksManager centralises every bookmark-side effect:
 *  - Fetch bookmarks + collections in parallel and expose grouped data for the page.
 *  - Handle destructive actions (remove) and exports so views can stay declarative.
 *  - Provide derived helpers (formatSavedDate, groupedBookmarks) to keep BookmarksPage lean.
 * If you touch the bookmark API contract, adjust the transforms here rather than sprinkling logic
 * across the UI. This hook intentionally mirrors the data responsibilities of useNearbyPinsFeed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  clearBookmarkHistory,
  exportBookmarks,
  fetchBookmarks,
  fetchBookmarkCollections,
  fetchBookmarkHistory,
  fetchPinById,
  removeBookmark,
  updatePinAttendance
} from '../api/mongoDataApi';
import { formatAbsoluteDateTime, formatRelativeTime } from '../utils/dates';
import toIdString from '../utils/ids';
import reportClientError from '../utils/reportClientError';

const EMPTY_GROUP = 'Unsorted';
const BOOKMARK_CACHE_TTL_MS = 45_000;

// Helpers stay in this file so both the hook and components can format bookmark metadata consistently.
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

// Bucket bookmarks by collection id so the UI can iterate over ready-to-render groups.
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

export default function useBookmarksManager({
  authUser,
  authLoading,
  isOffline,
  hideFullEvents = true
}) {
  // Lower-level state (bookmarks + collections) is kept separate from derived helpers (groupedBookmarks).
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removalStatus, setRemovalStatus] = useState(null);
  const [removingPinId, setRemovingPinId] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [attendancePendingId, setAttendancePendingId] = useState(null);
  const [viewHistory, setViewHistory] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const cacheRef = useRef(null);
  const isLoadingRef = useRef(false);

  // Keep a Map for constant-time lookups when grouping bookmarks by collection.
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

  // Fetch bookmarks + collections together so the page can show both the list and the sidebar metadata.
  const enrichBookmarksWithPins = useCallback(async (bookmarkList) => {
    if (!Array.isArray(bookmarkList) || bookmarkList.length === 0) {
      return [];
    }
    const uniquePinIds = Array.from(
      new Set(
        bookmarkList
          .map((bookmark) => toIdString(bookmark?.pinId) ?? toIdString(bookmark?.pin?._id))
          .filter(Boolean)
      )
    );
    if (uniquePinIds.length === 0) {
      return bookmarkList;
    }
    const pinDetails = new Map();
    await Promise.all(
      uniquePinIds.map(async (pinId) => {
        try {
          const pin = await fetchPinById(pinId, { previewMode: 'bookmark' });
          pinDetails.set(pinId, pin || null);
        } catch (err) {
          reportClientError(err, 'Failed to fetch pin for bookmark:', {
            source: 'useBookmarksManager.enrichPins',
            pinId
          });
          pinDetails.set(pinId, null);
        }
      })
    );
    return bookmarkList.map((bookmark) => {
      const normalizedPinId =
        toIdString(bookmark?.pinId) ?? toIdString(bookmark?.pin?._id) ?? null;
      const resolvedPin = normalizedPinId ? pinDetails.get(normalizedPinId) : null;
      if (!resolvedPin) {
        return bookmark;
      }
      return {
        ...bookmark,
        pin: resolvedPin
      };
    });
  }, []);

  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  const loadData = useCallback(async () => {
    if (!authUser) {
      setError('Sign in to view your bookmarks.');
      setBookmarks([]);
      setCollections([]);
      setViewHistory([]);
      return;
    }

    if (isLoadingRef.current) {
      return;
    }
    const cached = cacheRef.current;
    if (cached && Date.now() - cached.ts < BOOKMARK_CACHE_TTL_MS) {
      setBookmarks(cached.bookmarks);
      setCollections(cached.collections);
      if (Array.isArray(cached.viewHistory)) {
        setViewHistory(cached.viewHistory);
      }
      setError(null);
      return;
    }

    isLoadingRef.current = true;

    if (isOffline) {
      setIsLoading(false);
      setError('You are offline. Connect to refresh your bookmarks.');
      setHistoryError('You are offline. Connect to refresh your history.');
      isLoadingRef.current = false;
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [bookmarkPayload, collectionPayload, historyPayload] = await Promise.all([
        fetchBookmarks({ hideFullEvents }),
        fetchBookmarkCollections(),
        fetchBookmarkHistory()
      ]);
      const baseBookmarks = Array.isArray(bookmarkPayload) ? bookmarkPayload : [];
      const enrichedBookmarks = await enrichBookmarksWithPins(baseBookmarks);
      const normalizedBookmarks = enrichedBookmarks.map((bookmark) => {
        const pinAttendance =
          typeof bookmark?.pin?.viewerIsAttending === 'boolean'
            ? bookmark.pin.viewerIsAttending
            : undefined;
        if (pinAttendance === undefined || bookmark.viewerIsAttending === pinAttendance) {
          return bookmark;
        }
        return { ...bookmark, viewerIsAttending: pinAttendance };
      });
      setBookmarks(normalizedBookmarks);
      setCollections(Array.isArray(collectionPayload) ? collectionPayload : []);
      const nextHistory = Array.isArray(historyPayload) ? historyPayload : [];
      setViewHistory(nextHistory);
      cacheRef.current = {
        ts: Date.now(),
        bookmarks: normalizedBookmarks,
        collections: Array.isArray(collectionPayload) ? collectionPayload : [],
        viewHistory: nextHistory
      };
    } catch (err) {
      reportClientError(err, 'Failed to load bookmarks:', {
        source: 'useBookmarksManager.loadData'
      });
      setBookmarks([]);
      setCollections([]);
      setViewHistory([]);
      setError(err?.message || 'Failed to load bookmarks.');
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [authUser, enrichBookmarksWithPins, hideFullEvents, isOffline, viewHistory]);

  // Auto-refresh whenever auth or offline status changes.
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

  const refreshHistory = useCallback(async () => {
    if (!authUser) {
      setHistoryError('Sign in to view your history.');
      setViewHistory([]);
      return;
    }
    if (isOffline) {
      setHistoryError('You are offline. Connect to refresh your history.');
      return;
    }
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const historyPayload = await fetchBookmarkHistory();
      const nextHistory = Array.isArray(historyPayload) ? historyPayload : [];
      setViewHistory(nextHistory);
      cacheRef.current = cacheRef.current
        ? { ...cacheRef.current, ts: cacheRef.current.ts, viewHistory: nextHistory }
        : null;
    } catch (historyFetchError) {
      console.warn('Failed to load bookmark history:', historyFetchError);
      setViewHistory([]);
      setHistoryError(historyFetchError?.message || 'Failed to load bookmark history.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authUser, isOffline]);

  // Remove a bookmark and optimistically update cached state so the page stays snappy.
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
        invalidateCache();
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
    [invalidateCache, isOffline]
  );

  // Kick off a CSV export and surface simple status objects that the UI can show in alerts.
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

  const toggleAttendance = useCallback(
    async (bookmark) => {
      const pinId = bookmark?.pinId || bookmark?.pin?._id;
      if (!pinId) {
        throw new Error('Pin id is required to update attendance.');
      }
      if (isOffline) {
        throw new Error('Reconnect to update attendance.');
      }

      const currentAttending =
        typeof bookmark?.viewerIsAttending === 'boolean'
          ? bookmark.viewerIsAttending
          : Boolean(bookmark?.pin?.viewerIsAttending);
      const nextAttending = !currentAttending;
      setAttendancePendingId(pinId);
      try {
        await updatePinAttendance(pinId, { attending: nextAttending });
        setBookmarks((prev) =>
          prev.map((candidate) => {
            const matches =
              (candidate._id && bookmark._id && candidate._id === bookmark._id) ||
              (candidate.pinId && candidate.pinId === bookmark.pinId);
            if (!matches) {
              return candidate;
            }

            const nextPin = candidate.pin
              ? {
                  ...candidate.pin,
                  viewerIsAttending: nextAttending,
                  stats:
                    typeof candidate.pin?.stats?.participantCount === 'number'
                      ? {
                          ...candidate.pin.stats,
                          participantCount: Math.max(
                            0,
                            candidate.pin.stats.participantCount + (nextAttending ? 1 : -1)
                          )
                        }
                      : candidate.pin?.stats
                }
              : candidate.pin;

            return {
              ...candidate,
              viewerIsAttending: nextAttending,
              pin: nextPin
            };
          })
        );

        return {
          type: 'success',
          message: nextAttending
            ? 'Marked as attending.'
            : 'You are no longer attending this pin.',
          toast: true
        };
      } catch (error) {
        reportClientError(error, 'Failed to update pin attendance', {
          source: 'useBookmarksManager.toggleAttendance',
          pinId,
          nextAttending
        });
        throw new Error(error?.message || 'Failed to update attendance.');
      } finally {
        setAttendancePendingId(null);
        invalidateCache();
      }
    },
    [invalidateCache, isOffline]
  );

  const handleClearHistory = useCallback(async () => {
    if (isOffline) {
      setHistoryError('Reconnect to clear your history.');
      return;
    }
    setIsClearingHistory(true);
    setHistoryError(null);
    try {
      await clearBookmarkHistory();
      setViewHistory([]);
      invalidateCache();
    } catch (err) {
      reportClientError(err, 'Failed to clear bookmark history:', {
        source: 'useBookmarksManager.clearHistory'
      });
      setHistoryError(err?.message || 'Failed to clear bookmark history.');
    } finally {
      setIsClearingHistory(false);
    }
  }, [isOffline]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissRemovalStatus = useCallback(() => setRemovalStatus(null), []);
  const notifyRemovalStatus = useCallback((status) => {
    setRemovalStatus(status);
  }, []);
  const dismissExportStatus = useCallback(() => setExportStatus(null), []);
  const dismissHistoryError = useCallback(() => setHistoryError(null), []);

  // Expose raw data, derived data, and the helper actions so pages can pick what they need.
  return {
    bookmarks,
    groupedBookmarks,
    totalCount,
    isLoading,
    error,
    removalStatus,
    notifyRemovalStatus,
    removingPinId,
    attendancePendingId,
    isExporting,
    exportStatus,
    handleRemoveBookmark,
    handleExport,
    handleToggleAttendance: toggleAttendance,
    refresh: loadData,
    refreshHistory,
    formatSavedDate,
    collections,
    collectionsById,
    dismissError,
    dismissRemovalStatus,
    dismissExportStatus,
    viewHistory,
    clearHistory: handleClearHistory,
    isClearingHistory,
    isHistoryLoading,
    historyError,
    dismissHistoryError
  };
}

export { formatSavedDate };
