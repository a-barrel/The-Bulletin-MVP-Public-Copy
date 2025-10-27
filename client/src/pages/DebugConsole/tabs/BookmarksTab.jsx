import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  createBookmark,
  createBookmarkCollection,
  exportBookmarks,
  fetchBookmarkCollections,
  fetchBookmarks
} from '../../../api/mongoDataApi';
import JsonPreview from '../components/JsonPreview';
import {
  parseCommaSeparated,
  parseJsonField,
  parseOptionalDate,
  parseOptionalNumber,
  parseRequiredNumber
} from '../utils';

function BookmarksTab() {
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

  const handleCreateBookmark = async (event) => {
    event.preventDefault();
    setBookmarkStatus(null);

    try {
      const userId = bookmarkForm.userId.trim();
      const pinId = bookmarkForm.pinId.trim();
      if (!userId || !pinId) {
        throw new Error('User ID and pin ID are required.');
      }

      const payload = {
        userId,
        pinId
      };

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
  };

  const handleCreateCollection = async (event) => {
    event.preventDefault();
    setCollectionStatus(null);

    try {
      const userId = collectionForm.userId.trim();
      const name = collectionForm.name.trim();
      if (!userId || !name) {
        throw new Error('User ID and collection name are required.');
      }

      const payload = {
        userId,
        name
      };

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
      setCollectionStatus({ type: 'error', message: error.message || 'Failed to create collection.' });
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleFetchBookmarks = async (event) => {
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
      setBookmarksStatus({ type: 'error', message: error.message || 'Failed to load bookmarks.' });
    } finally {
      setIsFetchingBookmarks(false);
    }
  };

  const handleExportBookmarksCsv = async () => {
    setExportBookmarksStatus(null);
    const userId = bookmarksQuery.userId.trim();
    if (!userId) {
      setExportBookmarksStatus({ type: 'error', message: 'User ID is required to export bookmarks.' });
      return;
    }

    try {
      setIsExportingBookmarks(true);
      const { blob, filename } = await exportBookmarks({ userId });
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

      setExportBookmarksStatus({
        type: 'success',
        message: `Exported bookmarks for ${userId} to ${filename || 'bookmarks.csv'}.`
      });
    } catch (error) {
      console.error('Failed to export bookmarks:', error);
      setExportBookmarksStatus({ type: 'error', message: error?.message || 'Failed to export bookmarks.' });
    } finally {
      setIsExportingBookmarks(false);
    }
  };

  const handleFetchCollections = async (event) => {
    event.preventDefault();
    setCollectionsStatus(null);
    const userId = collectionsUserId.trim();
    if (!userId) {
      setCollectionsStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      setIsFetchingCollections(true);
      const collections = await fetchBookmarkCollections(userId);
      setCollectionsResult(collections);
      setCollectionsStatus({
        type: 'success',
        message: `Loaded ${collections.length} collection${collections.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setCollectionsStatus({ type: 'error', message: error.message || 'Failed to load collections.' });
    } finally {
      setIsFetchingCollections(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateBookmark}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create bookmark</Typography>
        <Typography variant="body2" color="text.secondary">
          Store a pin in a user's saved list or collection.
        </Typography>
        {bookmarkStatus && (
          <Alert severity={bookmarkStatus.type} onClose={() => setBookmarkStatus(null)}>
            {bookmarkStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={bookmarkForm.userId}
              onChange={(event) => setBookmarkForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Pin ID"
              value={bookmarkForm.pinId}
              onChange={(event) => setBookmarkForm((prev) => ({ ...prev, pinId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Collection ID (optional)"
            value={bookmarkForm.collectionId}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, collectionId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Notes"
            value={bookmarkForm.notes}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, notes: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Reminder at"
            type="datetime-local"
            value={bookmarkForm.reminderAt}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, reminderAt: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Tag IDs (comma separated)"
            value={bookmarkForm.tagIds}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tagIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingBookmark}>
              {isCreatingBookmark ? 'Creating...' : 'Create bookmark'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setBookmarkForm({
                  userId: '',
                  pinId: '',
                  collectionId: '',
                  notes: '',
                  reminderAt: '',
                  tagIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={bookmarkResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreateCollection}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create bookmark collection</Typography>
        <Typography variant="body2" color="text.secondary">
          Group multiple bookmarks together for quick access.
        </Typography>
        {collectionStatus && (
          <Alert severity={collectionStatus.type} onClose={() => setCollectionStatus(null)}>
            {collectionStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={collectionForm.userId}
              onChange={(event) => setCollectionForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Name"
              value={collectionForm.name}
              onChange={(event) => setCollectionForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Description"
            value={collectionForm.description}
            onChange={(event) => setCollectionForm((prev) => ({ ...prev, description: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Bookmark IDs (comma separated)"
            value={collectionForm.bookmarkIds}
            onChange={(event) => setCollectionForm((prev) => ({ ...prev, bookmarkIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingCollection}>
              {isCreatingCollection ? 'Creating...' : 'Create collection'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setCollectionForm({
                  userId: '',
                  name: '',
                  description: '',
                  bookmarkIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={collectionResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchBookmarks}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch bookmarks</Typography>
        <Typography variant="body2" color="text.secondary">
          List saved pins for a given user.
        </Typography>
        {bookmarksStatus && (
          <Alert severity={bookmarksStatus.type} onClose={() => setBookmarksStatus(null)}>
            {bookmarksStatus.message}
          </Alert>
        )}
        {exportBookmarksStatus && (
          <Alert severity={exportBookmarksStatus.type} onClose={() => setExportBookmarksStatus(null)}>
            {exportBookmarksStatus.message}
          </Alert>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
          sx={{ flexWrap: 'wrap' }}
        >
          <TextField
            label="User ID"
            value={bookmarksQuery.userId}
            onChange={(event) => setBookmarksQuery((prev) => ({ ...prev, userId: event.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Limit"
            value={bookmarksQuery.limit}
            onChange={(event) => setBookmarksQuery((prev) => ({ ...prev, limit: event.target.value }))}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="outlined" disabled={isFetchingBookmarks}>
              {isFetchingBookmarks ? 'Loading...' : 'Fetch'}
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={handleExportBookmarksCsv}
              disabled={isExportingBookmarks || isFetchingBookmarks}
            >
              {isExportingBookmarks ? 'Exporting...' : 'Export CSV'}
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={bookmarksResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchCollections}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch collections</Typography>
        <Typography variant="body2" color="text.secondary">
          Retrieve bookmark collections owned by a user.
        </Typography>
        {collectionsStatus && (
          <Alert severity={collectionsStatus.type} onClose={() => setCollectionsStatus(null)}>
            {collectionsStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={collectionsUserId}
            onChange={(event) => setCollectionsUserId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingCollections}>
            {isFetchingCollections ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={collectionsResult} />
      </Paper>
    </Stack>
  );
}

export default BookmarksTab;
