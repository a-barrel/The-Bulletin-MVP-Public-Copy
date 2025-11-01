import { useCallback } from 'react';
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
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useBookmarksManager from '../hooks/useBookmarksManager';

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
  const { isOffline } = useNetworkStatusContext();
  const [authUser, authLoading] = useAuthState(auth);
  const {
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
    refresh,
    formatSavedDate
  } = useBookmarksManager({ authUser, authLoading, isOffline });

  const handleViewPin = useCallback(
    (pinId) => {
      if (pinId) {
        navigate(routes.pin.byId(pinId));
      }
    },
    [navigate]
  );

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
              onClick={refresh}
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
