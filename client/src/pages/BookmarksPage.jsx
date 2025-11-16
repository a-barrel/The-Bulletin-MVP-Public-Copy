import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { routes } from '../routes';
import './BookmarksPage.css';
import useBookmarksData from '../hooks/useBookmarksData';
import useBookmarkActions from '../hooks/useBookmarkActions';
import { formatBookmarkSavedDate, groupBookmarksByCollection } from '../utils/bookmarks';
import BookmarksHeader from '../components/bookmarks/BookmarksHeader';
import BookmarksGroups from '../components/bookmarks/BookmarksGroups';
import BookmarksStatusToasts from '../components/bookmarks/BookmarksStatusToasts';

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

function BookmarksPage() {
  const navigate = useNavigate();
  const {
    authUser,
    authLoading,
    isOffline,
    bookmarks,
    setBookmarks,
    collections,
    isLoading,
    error,
    setError,
    reload
  } = useBookmarksData();
  const {
    removalStatus,
    setRemovalStatus,
    removingPinId,
    handleRemoveBookmark,
    exportStatus,
    setExportStatus,
    isExporting,
    handleExport
  } = useBookmarkActions({ authUser, isOffline, setBookmarks });

  const collectionsById = useMemo(() => {
    const map = new Map();
    collections.forEach((collection) => {
      map.set(collection._id, collection);
    });
    return map;
  }, [collections]);

  const groupedBookmarks = useMemo(
    () => groupBookmarksByCollection(bookmarks, collectionsById),
    [bookmarks, collectionsById]
  );

  const totalCount = bookmarks.length;

  const handleViewPin = useCallback(
    (pinId) => {
      if (pinId) {
        navigate(routes.pin.byId(pinId));
      }
    },
    [navigate]
  );

  const handleExportClick = useCallback(() => {
    handleExport(totalCount);
  }, [handleExport, totalCount]);

  return (
    <Box
      className="bookmarks-classic-shell"
      sx={{
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 }
      }}
    >
      <Stack spacing={3}>
        <BookmarksHeader
          totalCount={totalCount}
          onRefresh={reload}
          onExport={handleExportClick}
          isOffline={isOffline}
          isLoading={isLoading}
          isExporting={isExporting}
          authLoading={authLoading}
          hasAuth={Boolean(authUser)}
        />

        {isOffline ? (
          <Alert severity="warning">
            You are offline. You can browse existing bookmarks, but refresh, removal, and export actions
            require a connection.
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
            <BookmarksGroups
              groups={groupedBookmarks}
              onViewPin={handleViewPin}
              onRemove={handleRemoveBookmark}
              removingPinId={removingPinId}
              formatSavedDate={formatBookmarkSavedDate}
              isOffline={isOffline}
            />
          </Paper>
        )}

        <BookmarksStatusToasts
          exportStatus={exportStatus}
          onClearExport={() => setExportStatus(null)}
          removalStatus={removalStatus}
          onClearRemoval={() => setRemovalStatus(null)}
        />
      </Stack>
    </Box>
  );
}

export default BookmarksPage;
