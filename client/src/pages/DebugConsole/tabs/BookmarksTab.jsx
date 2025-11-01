import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import JsonPreview from '../components/JsonPreview';
import DebugPanel from '../components/DebugPanel';
import useBookmarksTools from '../hooks/useBookmarksTools';

const EMPTY_BOOKMARK_FORM = {
  userId: '',
  pinId: '',
  collectionId: '',
  notes: '',
  reminderAt: '',
  tagIds: ''
};

const EMPTY_COLLECTION_FORM = {
  userId: '',
  name: '',
  description: '',
  bookmarkIds: ''
};

function BookmarksTab() {
  const {
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
  } = useBookmarksTools();

  const bookmarkAlerts = [
    bookmarkStatus
      ? {
          key: 'bookmark-status',
          severity: bookmarkStatus.type,
          content: bookmarkStatus.message,
          onClose: () => setBookmarkStatus(null)
        }
      : null
  ].filter(Boolean);

  const collectionAlerts = [
    collectionStatus
      ? {
          key: 'collection-status',
          severity: collectionStatus.type,
          content: collectionStatus.message,
          onClose: () => setCollectionStatus(null)
        }
      : null
  ].filter(Boolean);

  const bookmarksAlerts = [
    bookmarksStatus
      ? {
          key: 'bookmarks-status',
          severity: bookmarksStatus.type,
          content: bookmarksStatus.message,
          onClose: () => setBookmarksStatus(null)
        }
      : null,
    exportBookmarksStatus
      ? {
          key: 'bookmarks-export-status',
          severity: exportBookmarksStatus.type,
          content: exportBookmarksStatus.message,
          onClose: () => setExportBookmarksStatus(null)
        }
      : null
  ].filter(Boolean);

  const collectionsAlerts = [
    collectionsStatus
      ? {
          key: 'collections-status',
          severity: collectionsStatus.type,
          content: collectionsStatus.message,
          onClose: () => setCollectionsStatus(null)
        }
      : null
  ].filter(Boolean);

  const resetBookmarkForm = () => {
    setBookmarkForm(EMPTY_BOOKMARK_FORM);
    setBookmarkStatus(null);
  };

  const resetCollectionForm = () => {
    setCollectionForm(EMPTY_COLLECTION_FORM);
    setCollectionStatus(null);
  };

  return (
    <Stack spacing={2}>
      <DebugPanel
        component="form"
        onSubmit={handleCreateBookmark}
        title="Create bookmark"
        description="Store a pin in a user's saved list or collection."
        alerts={bookmarkAlerts}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={bookmarkForm.userId}
              onChange={updateBookmarkFormField('userId')}
              required
              fullWidth
            />
            <TextField
              label="Pin ID"
              value={bookmarkForm.pinId}
              onChange={updateBookmarkFormField('pinId')}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Collection ID (optional)"
            value={bookmarkForm.collectionId}
            onChange={updateBookmarkFormField('collectionId')}
            fullWidth
          />
          <TextField
            label="Notes"
            value={bookmarkForm.notes}
            onChange={updateBookmarkFormField('notes')}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Reminder at"
            type="datetime-local"
            value={bookmarkForm.reminderAt}
            onChange={updateBookmarkFormField('reminderAt')}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Tag IDs (comma separated)"
            value={bookmarkForm.tagIds}
            onChange={updateBookmarkFormField('tagIds')}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingBookmark}>
              {isCreatingBookmark ? 'Creating...' : 'Create bookmark'}
            </Button>
            <Button type="button" variant="text" onClick={resetBookmarkForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={bookmarkResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleCreateCollection}
        title="Create bookmark collection"
        description="Group bookmarks together for a user to simulate saved lists."
        alerts={collectionAlerts}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={collectionForm.userId}
              onChange={updateCollectionFormField('userId')}
              required
              fullWidth
            />
            <TextField
              label="Collection name"
              value={collectionForm.name}
              onChange={updateCollectionFormField('name')}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Description"
            value={collectionForm.description}
            onChange={updateCollectionFormField('description')}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Bookmark IDs (comma separated)"
            value={collectionForm.bookmarkIds}
            onChange={updateCollectionFormField('bookmarkIds')}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingCollection}>
              {isCreatingCollection ? 'Creating...' : 'Create collection'}
            </Button>
            <Button type="button" variant="text" onClick={resetCollectionForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={collectionResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchBookmarks}
        title="Fetch bookmarks"
        description="List saved pins for a given user."
        alerts={bookmarksAlerts}
      >
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
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchCollections}
        title="Fetch collections"
        description="Retrieve bookmark collections owned by a user."
        alerts={collectionsAlerts}
      >
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
      </DebugPanel>
    </Stack>
  );
}

export default BookmarksTab;
