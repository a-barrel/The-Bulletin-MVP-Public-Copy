import { useCallback, useState } from 'react';

import {
  createBookmark,
  createBookmarkCollection,
  exportBookmarks,
  fetchBookmarkCollections,
  fetchBookmarks
} from '../../../api/mongoDataApi';
import {
  parseCommaSeparated,
  parseJsonField,
  parseOptionalDate,
  parseOptionalNumber,
  parseRequiredNumber
} from '../utils';

const useBookmarksTools = () => {
  const [bookmarkForm, setBookmarkForm] = useState({
    userId: '',
    pinId: '',
    collectionId: '',
    notes: '',
    reminderAt: '',
    tagIds: ''
  });
  const [bookmarkStatus, setBookmarkStatus] = useState(null);
  const [bookmarkResult, setBookmarkResult] = useState(null);
  const [isCreatingBookmark, setIsCreatingBookmark] = useState(false);

  const [collectionForm, setCollectionForm] = useState({
    userId: '',
    name: '',
    description: '',
    bookmarkIds: ''
  });
  const [collectionStatus, setCollectionStatus] = useState(null);
  const [collectionResult, setCollectionResult] = useState(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const [bookmarksQuery, setBookmarksQuery] = useState({ userId: '', limit: '20' });
  const [bookmarksStatus, setBookmarksStatus] = useState(null);
  const [bookmarksResult, setBookmarksResult] = useState(null);
  const [isFetchingBookmarks, setIsFetchingBookmarks] = useState(false);
  const [exportBookmarksStatus, setExportBookmarksStatus] = useState(null);
  const [isExportingBookmarks, setIsExportingBookmarks] = useState(false);

  const [collectionsUserId, setCollectionsUserId] = useState('');
  const [collectionsStatus, setCollectionsStatus] = useState(null);
  const [collectionsResult, setCollectionsResult] = useState(null);
  const [isFetchingCollections, setIsFetchingCollections] = useState(false);

  const handleCreateBookmark = useCallback(
    async (event) => {
      event.preventDefault();
      setBookmarkStatus(null);

      try {
        const userId = bookmarkForm.userId.trim();
        const pinId = bookmarkForm.pinId.trim();
        if (!userId || !pinId) {
          throw new Error('User ID and pin ID are required.');
        }

        const payload = { userId, pinId };
        const collectionId = bookmarkForm.collectionId.trim();
        if (collectionId) {
          payload.collectionId = collectionId;
        }

        const notes = bookmarkForm.notes.trim();
        if (notes) {
          payload.notes = notes;
        }

        const reminderAt = parseOptionalDate(bookmarkForm.reminderAt, 'Reminder at');
        if (reminderAt) {
          payload.reminderAt = reminderAt;
        }

        const tagIds = parseCommaSeparated(bookmarkForm.tagIds);
        if (tagIds.length) {
          payload.tagIds = tagIds;
        }

        setIsCreatingBookmark(true);
        const result = await createBookmark(payload);
        setBookmarkResult(result);
        setBookmarkStatus({ type: 'success', message: 'Bookmark created.' });
      } catch (error) {
        setBookmarkStatus({ type: 'error', message: error.message || 'Failed to create bookmark.' });
      } finally {
        setIsCreatingBookmark(false);
      }
    },
    [bookmarkForm]
  );

  const handleCreateCollection = useCallback(
    async (event) => {
      event.preventDefault();
      setCollectionStatus(null);

      try {
        const userId = collectionForm.userId.trim();
        const name = collectionForm.name.trim();
        if (!userId || !name) {
          throw new Error('User ID and collection name are required.');
        }

        const payload = { userId, name };

        const description = collectionForm.description.trim();
        if (description) {
          payload.description = description;
        }

        const bookmarkIds = parseCommaSeparated(collectionForm.bookmarkIds);
        if (bookmarkIds.length) {
          payload.bookmarkIds = bookmarkIds;
        }

        setIsCreatingCollection(true);
        const result = await createBookmarkCollection(payload);
        setCollectionResult(result);
        setCollectionStatus({ type: 'success', message: 'Bookmark collection created.' });
      } catch (error) {
        setCollectionStatus({
          type: 'error',
          message: error.message || 'Failed to create collection.'
        });
      } finally {
        setIsCreatingCollection(false);
      }
    },
    [collectionForm]
  );

  const handleFetchBookmarks = useCallback(
    async (event) => {
      event.preventDefault();
      setBookmarksStatus(null);
      setExportBookmarksStatus(null);

      const userId = bookmarksQuery.userId.trim();
      if (!userId) {
        setBookmarksStatus({ type: 'error', message: 'User ID is required.' });
        return;
      }

      try {
        const query = { userId };
        const limitValue = parseOptionalNumber(bookmarksQuery.limit, 'Limit');
        if (limitValue !== undefined) {
          if (limitValue <= 0) {
            throw new Error('Limit must be greater than 0.');
          }
          query.limit = limitValue;
        }

        setIsFetchingBookmarks(true);
        const bookmarks = await fetchBookmarks(query);
        setBookmarksResult(bookmarks);
        setBookmarksStatus({
          type: 'success',
          message: `Loaded ${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'}.`
        });
      } catch (error) {
        setBookmarksStatus({
          type: 'error',
          message: error.message || 'Failed to load bookmarks.'
        });
      } finally {
        setIsFetchingBookmarks(false);
      }
    },
    [bookmarksQuery]
  );

  const handleExportBookmarksCsv = useCallback(async () => {
    setExportBookmarksStatus(null);
    const userId = bookmarksQuery.userId.trim();
    if (!userId) {
      setExportBookmarksStatus({ type: 'error', message: 'User ID is required to export bookmarks.' });
      return;
    }

    try {
      setIsExportingBookmarks(true);
      const { blob, filename } = await exportBookmarks({ userId });
      if (typeof window !== 'undefined') {
        const downloadUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename || `bookmarks-${userId}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        window.setTimeout(() => {
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(downloadUrl);
        }, 0);
      }
      setExportBookmarksStatus({ type: 'success', message: 'Export started. Check your downloads.' });
    } catch (error) {
      setExportBookmarksStatus({
        type: 'error',
        message: error.message || 'Failed to export bookmarks.'
      });
    } finally {
      setIsExportingBookmarks(false);
    }
  }, [bookmarksQuery]);

  const handleFetchCollections = useCallback(
    async (event) => {
      event.preventDefault();
      setCollectionsStatus(null);
      const userId = collectionsUserId.trim();
      if (!userId) {
        setCollectionsStatus({ type: 'error', message: 'User ID is required.' });
        return;
      }

      try {
        setIsFetchingCollections(true);
        const payload = await fetchBookmarkCollections(userId);
        setCollectionsResult(payload);
        const count = Array.isArray(payload) ? payload.length : 0;
        setCollectionsStatus({
          type: 'success',
          message: `Loaded ${count} collection${count === 1 ? '' : 's'}.`
        });
      } catch (error) {
        setCollectionsStatus({
          type: 'error',
          message: error.message || 'Failed to load collections.'
        });
      } finally {
        setIsFetchingCollections(false);
      }
    },
    [collectionsUserId]
  );

  const updateBookmarkFormField = useCallback((field) => (event) => {
    const value = event.target.value;
    setBookmarkForm((prev) => ({ ...prev, [field]: value }));
    setBookmarkStatus(null);
  }, []);

  const updateCollectionFormField = useCallback((field) => (event) => {
    const value = event.target.value;
    setCollectionForm((prev) => ({ ...prev, [field]: value }));
    setCollectionStatus(null);
  }, []);

  return {
    bookmarkForm,
    setBookmarkForm,
    bookmarkStatus,
    setBookmarkStatus,
    bookmarkResult,
    isCreatingBookmark,
    handleCreateBookmark,
    updateBookmarkFormField,
    collectionForm,
    setCollectionForm,
    collectionStatus,
    setCollectionStatus,
    collectionResult,
    isCreatingCollection,
    handleCreateCollection,
    updateCollectionFormField,
    bookmarksQuery,
    setBookmarksQuery,
    bookmarksStatus,
    setBookmarksStatus,
    bookmarksResult,
    isFetchingBookmarks,
    handleFetchBookmarks,
    exportBookmarksStatus,
    setExportBookmarksStatus,
    isExportingBookmarks,
    handleExportBookmarksCsv,
    collectionsUserId,
    setCollectionsUserId,
    collectionsStatus,
    setCollectionsStatus,
    collectionsResult,
    isFetchingCollections,
    handleFetchCollections
  };
};

export default useBookmarksTools;
