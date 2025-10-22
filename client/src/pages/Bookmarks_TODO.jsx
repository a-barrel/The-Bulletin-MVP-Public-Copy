import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { fetchBookmarks, removeBookmark } from '../api/mongoDataApi';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

export const pageConfig = {
  id: 'bookmarks-todo',
  label: 'Bookmarks TODO',
  icon: BookmarkBorderIcon,
  path: '/bookmarks-todo',
  order: 94,
  showInNav: true,
  protected: true
};

function BookmarksTodoPage() {
  const navigate = useNavigate();
  const [currentUser, authLoading] = useAuthState(auth);
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removalStatus, setRemovalStatus] = useState(null);
  const [removingBookmarkKey, setRemovingBookmarkKey] = useState(null);

  const loadBookmarks = useCallback(async () => {
    if (!currentUser) {
      setError('Sign in to view your bookmarks.');
      setBookmarks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setRemovalStatus(null);
    try {
      const payload = await fetchBookmarks();
      setBookmarks(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      setBookmarks([]);
      setError(err?.message || 'Failed to load bookmarks.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!currentUser) {
      setIsLoading(false);
      setBookmarks([]);
      setError('Sign in to view your bookmarks.');
      return;
    }
    loadBookmarks();
  }, [authLoading, currentUser, loadBookmarks]);

  const handleRemoveBookmark = async (bookmark) => {
    if (!currentUser) {
      setRemovalStatus({ type: 'error', message: 'Sign in to manage bookmarks.' });
      return;
    }

    const pinId = bookmark?.pinId || bookmark?.pin?._id;
    if (!pinId) {
      setRemovalStatus({ type: 'error', message: 'Bookmark does not include a pin id.' });
      return;
    }

    const removalKey = bookmark?._id || pinId;
    setRemovalStatus(null);
    setRemovingBookmarkKey(removalKey);

    try {
      await removeBookmark(pinId);
      setBookmarks((prev) =>
        prev.filter((item) => {
          if (bookmark?._id && item?._id) {
            return item._id !== bookmark._id;
          }
          return item.pinId !== pinId;
        })
      );
      setRemovalStatus({ type: 'success', message: 'Bookmark removed.' });
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
      setRemovalStatus({ type: 'error', message: err?.message || 'Failed to remove bookmark.' });
    } finally {
      setRemovingBookmarkKey(null);
    }
  };

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3
      }}
    >
      <Stack
        spacing={2}
        sx={{
          width: '100%',
          maxWidth: 768,
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'warning.main',
          backgroundColor: 'background.paper',
          p: 4
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BookmarkBorderIcon fontSize="large" color="warning" />
          <Typography variant="h5">Your Bookmarks</Typography>
        </Stack>

        <Button
          type="button"
          variant="outlined"
          size="small"
          onClick={loadBookmarks}
          disabled={isLoading || authLoading || !currentUser}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' } }}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>

        {removalStatus && (
          <Alert severity={removalStatus.type} onClose={() => setRemovalStatus(null)}>
            {removalStatus.message}
          </Alert>
        )}

        {isLoading ? (
          <Typography variant="body1" color="text.secondary">
            Loading bookmarks...
          </Typography>
        ) : error ? (
          <Typography variant="body1" color="error">
            {error}
          </Typography>
        ) : bookmarks.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            You have not bookmarked any pins yet.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {bookmarks.map((bookmark) => {
              const labelPrefix =
                bookmark?.pin?.type?.toLowerCase() === 'event'
                  ? '[Event]'
                  : bookmark?.pin?.type?.toLowerCase() === 'discussion'
                    ? '[Discussion]'
                    : '[Pin]';
              const title = bookmark?.pin?.title ?? 'Untitled Pin';
              const bookmarkKey = bookmark._id ?? `${bookmark.pinId}-${bookmark.createdAt ?? 'unknown'}`;
              const removalKey = bookmark._id ?? bookmark.pinId ?? bookmarkKey;

              return (
                <Stack key={bookmarkKey} spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {`${labelPrefix} ${title}`}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<LaunchIcon fontSize="small" />}
                      onClick={() => navigate(`/pin/${bookmark.pinId}`)}
                    >
                      View Pin
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => handleRemoveBookmark(bookmark)}
                      disabled={!currentUser || removingBookmarkKey === removalKey}
                    >
                      {removingBookmarkKey === removalKey ? 'Removing...' : 'Remove Bookmark'}
                    </Button>
                  </Stack>
                  <Box
                    component="article"
                    sx={{
                      textAlign: 'left',
                      backgroundColor: 'background.default',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 2,
                      fontSize: '1rem',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                      wordBreak: 'break-word'
                    }}
                  >
                    {JSON.stringify(bookmark, null, 2)}
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default BookmarksTodoPage;
