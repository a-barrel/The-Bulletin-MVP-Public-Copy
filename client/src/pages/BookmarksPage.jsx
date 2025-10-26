import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase';
import {
  exportBookmarks,
  fetchBookmarks,
  fetchBookmarkCollections,
  removeBookmark
} from '../api/mongoDataApi';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';

export const pageConfig = {
  id: 'bookmarks',
  label: 'Bookmarks',
  icon: BookmarkIcon,
  path: '/bookmarks',
  aliases: ['/bookmarks-todo'],
  order: 94,
  showInNav: true,
  protected: true
};

const EMPTY_GROUP = 'Unsorted';

function formatSavedDate(input) {
  if (!input) {
    return 'Unknown date';
  }
  const date = new Date(input);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function groupBookmarks(bookmarks, collectionsById) {
  const groups = new Map();
  bookmarks.forEach((bookmark) => {
    const collectionId = bookmark.collectionId || null;
    const collectionName = collectionsById.get(collectionId)?.name ?? EMPTY_GROUP;
    if (!groups.has(collectionName)) {
      groups.set(collectionName, []);
    }
    groups.get(collectionName).push(bookmark);
  });
  return Array.from(groups.entries()).map(([name, items]) => ({
    name,
    items
  }));
}

function BookmarksPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const [authUser, authLoading] = useAuthState(auth);

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
      console.error('Failed to load bookmarks:', err);
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

  const handleViewPin = useCallback(
    (pinId) => {
      if (pinId) {
        navigate(routes.pin.byId(pinId));
      }
    },
    [navigate]
  );

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
      console.error('Failed to export bookmarks:', err);
      setExportStatus({ type: 'error', message: err?.message || 'Failed to export bookmarks.' });
    } finally {
      setIsExporting(false);
    }
  }, [authUser, isOffline, totalCount]);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 }
      }}
    >
      <Stack spacing={3}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate(-1)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back
        </Button>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <BookmarkIcon color="primary" />
          <Typography variant="h4" component="h1">
            Bookmarks
          </Typography>
          <Chip
            label={`${totalCount} saved`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            Quickly revisit saved pins. Bookmarks are grouped by collection and can be removed at any time.
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' } }}
          >
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={loadData}
              disabled={isOffline || isLoading || authLoading || !authUser}
              title={isOffline ? 'Reconnect to refresh bookmarks' : undefined}
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              type="button"
              variant="contained"
              size="small"
              onClick={handleExport}
              disabled={isOffline || isExporting || authLoading || !authUser}
              title={isOffline ? 'Reconnect to export bookmarks' : undefined}
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </Stack>
        </Stack>

        {isOffline ? (
          <Alert severity="warning">
            You are offline. You can browse existing bookmarks, but refresh, removal, and export actions
            require a connection.
          </Alert>
        ) : null}

        {exportStatus ? (
          <Alert severity={exportStatus.type} onClose={() => setExportStatus(null)}>
            {exportStatus.message}
          </Alert>
        ) : null}

        {removalStatus ? (
          <Alert severity={removalStatus.type} onClose={() => setRemovalStatus(null)}>
            {removalStatus.message}
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {isLoading ? (
          <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading bookmarks...
            </Typography>
          </Stack>
        ) : totalCount === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 3,
              p: 4,
              textAlign: 'center'
            }}
          >
            <Typography variant="h6">No bookmarks yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Tap the bookmark icon on a pin to save it. Your collection of favorites will appear here.
            </Typography>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <List disablePadding>
              {groupedBookmarks.map(({ name, items }) => (
                <Box key={name}>
                  <ListSubheader
                    component="div"
                    sx={{
                      backgroundColor: 'background.paper',
                      px: 3,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      {name}
                    </Typography>
                    <Chip label={items.length} size="small" variant="outlined" />
                  </ListSubheader>
                  <Divider />
                  {items.map((bookmark) => {
                    const pin = bookmark.pin;
                    const pinId = bookmark.pinId || pin?._id;
                    const pinTitle = pin?.title ?? 'Untitled Pin';
                    const pinType = pin?.type ?? 'pin';
                    const tagLabel =
                      pinType === 'event' ? 'Event' : pinType === 'discussion' ? 'Discussion' : 'Pin';
                    const savedAt = formatSavedDate(bookmark.createdAt);
                    const isRemoving = removingPinId === pinId;

                    return (
                      <ListItemButton
                        key={bookmark._id || pinId}
                        alignItems="flex-start"
                        onClick={() => handleViewPin(pinId)}
                        sx={{ py: 2, px: { xs: 2, md: 3 }, gap: 1.5 }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle1" fontWeight={600}>
                                {pinTitle}
                              </Typography>
                              <Chip label={tagLabel} size="small" color="secondary" variant="outlined" />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              Saved on {savedAt}
                            </Typography>
                          }
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<LaunchIcon fontSize="small" />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewPin(pinId);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          disabled={isOffline || isRemoving}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveBookmark(bookmark);
                          }}
                          title={isOffline ? 'Reconnect to remove bookmarks' : undefined}
                        >
                          {isRemoving ? 'Removing...' : 'Remove'}
                        </Button>
                      </ListItemButton>
                    );
                  })}
                  <Divider />
                </Box>
              ))}
            </List>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default BookmarksPage;
