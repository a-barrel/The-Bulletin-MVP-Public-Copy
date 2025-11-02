/* NOTE: Page exports navigation config alongside the component. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const UNSORTED_COLLECTION_KEY = '__ungrouped__';
const UNSORTED_LABEL = 'Unsorted';
const BOOKMARK_QUICK_NAV_PREFS_KEY = 'pinpoint:bookmarkQuickNavPrefs';
const BOOKMARK_QUICK_NAV_PREFS_VERSION = 1;

function BookmarksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
    formatSavedDate,
    collections
  } = useBookmarksManager({ authUser, authLoading, isOffline });
  const [quickNavPrefs, setQuickNavPrefs] = useState(() => {
    if (typeof window === 'undefined') {
      return { hidden: [] };
    }
    try {
      const stored = window.localStorage.getItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const version = parsed?.version ?? 0;
        const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden : [];
        if (version === BOOKMARK_QUICK_NAV_PREFS_VERSION || version === 0) {
          if (version === 0) {
            window.localStorage.setItem(
              BOOKMARK_QUICK_NAV_PREFS_KEY,
              JSON.stringify({
                version: BOOKMARK_QUICK_NAV_PREFS_VERSION,
                hidden
              })
            );
          }
          return { hidden };
        }
        window.localStorage.removeItem(BOOKMARK_QUICK_NAV_PREFS_KEY);
      }
    } catch (error) {
      console.warn('Failed to read bookmark quick nav preferences', error);
    }
    return { hidden: [] };
  });
  const [highlightedCollectionKey, setHighlightedCollectionKey] = useState(null);
  const collectionAnchorsRef = useRef(new Map());
  const focusAppliedRef = useRef(null);
  const focusParam = searchParams.get('collection');
  const normalizedFocusParam = useMemo(
    () => (focusParam ? focusParam.trim().toLowerCase() : null),
    [focusParam]
  );
  const resolvedFocus = useMemo(() => {
    if (!normalizedFocusParam) {
      return null;
    }
    const foundById = collections?.find((collection) => collection?._id === focusParam);
    if (foundById) {
      return {
        id: foundById._id,
        name: foundById.name
      };
    }
    const foundByName = collections?.find(
      (collection) =>
        typeof collection?.name === 'string' &&
        collection.name.trim().toLowerCase() === normalizedFocusParam
    );
    if (foundByName) {
      return {
        id: foundByName._id,
        name: foundByName.name
      };
    }
    if (
      normalizedFocusParam === UNSORTED_COLLECTION_KEY ||
      normalizedFocusParam === UNSORTED_LABEL.toLowerCase()
    ) {
      return {
        id: null,
        name: UNSORTED_LABEL
      };
    }
    return null;
  }, [collections, focusParam, normalizedFocusParam]);

  useEffect(() => {
    if (!resolvedFocus) {
      setHighlightedCollectionKey(null);
      focusAppliedRef.current = null;
      return undefined;
    }

    const focusKey = resolvedFocus.id ?? UNSORTED_COLLECTION_KEY;
    if (focusAppliedRef.current === focusKey && highlightedCollectionKey === focusKey) {
      return undefined;
    }

    const possibleKeys = [
      focusKey,
      resolvedFocus.name?.trim().toLowerCase(),
      `${focusKey}::header`
    ].filter(Boolean);

    let targetNode = null;
    for (const key of possibleKeys) {
      const candidate = collectionAnchorsRef.current.get(key);
      if (candidate) {
        targetNode = candidate;
        break;
      }
    }

    if (!targetNode) {
      return undefined;
    }

    focusAppliedRef.current = focusKey;
    setHighlightedCollectionKey(focusKey);
    try {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    } catch {
      targetNode.scrollIntoView(true);
    }

    const timer = window.setTimeout(() => {
      setHighlightedCollectionKey((prev) => (prev === focusKey ? null : prev));
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [groupedBookmarks, highlightedCollectionKey, resolvedFocus]);

  const handleQuickNavPreferenceChange = useCallback((collectionKey, enabled) => {
    setQuickNavPrefs((prev) => {
      const hiddenSet = new Set(prev.hidden);
      if (enabled) {
        hiddenSet.delete(collectionKey);
      } else {
        hiddenSet.add(collectionKey);
      }
      const nextHidden = Array.from(hiddenSet);
      const next = { hidden: nextHidden };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            BOOKMARK_QUICK_NAV_PREFS_KEY,
            JSON.stringify({
              version: BOOKMARK_QUICK_NAV_PREFS_VERSION,
              hidden: nextHidden
            })
          );
          window.dispatchEvent(new Event('pinpoint:bookmarkQuickNavPrefsChanged'));
        } catch (error) {
          console.warn('Failed to persist quick nav preferences', error);
        }
      }
      return next;
    });
  }, []);

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
              {groupedBookmarks.map((group) => {
                const { id: collectionId, name, description, items } = group;
                const groupKey = collectionId ?? UNSORTED_COLLECTION_KEY;
                const displayName = name || UNSORTED_LABEL;
                const normalizedName = displayName.trim().toLowerCase();
                const isHighlighted = highlightedCollectionKey === groupKey;
                const isPinned = !quickNavPrefs.hidden.includes(groupKey);

                return (
                  <Box key={groupKey}>
                  <ListSubheader
                    component="div"
                    ref={(node) => {
                      const anchors = collectionAnchorsRef.current;
                      const keys = [groupKey, normalizedName, `${groupKey}::header`].filter(Boolean);
                      keys.forEach((key) => {
                        if (!key) {
                          return;
                        }
                        if (node) {
                          anchors.set(key, node);
                        } else {
                          anchors.delete(key);
                        }
                      });
                    }}
                    sx={{
                      backgroundColor: isHighlighted ? 'rgba(144, 202, 249, 0.12)' : 'background.paper',
                      transition: 'background-color 220ms ease',
                      px: 3,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      borderLeft: isHighlighted ? '3px solid rgba(144, 202, 249, 0.6)' : '3px solid transparent'
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      {displayName}
                    </Typography>
                    <Chip label={items.length} size="small" variant="outlined" />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginLeft: 'auto' }}>
                      {description ? (
                        <Typography variant="body2" color="text.secondary">
                          {description}
                        </Typography>
                      ) : null}
                      <Button
                        size="small"
                        variant={isPinned ? 'contained' : 'outlined'}
                        color="secondary"
                        onClick={() => handleQuickNavPreferenceChange(groupKey, !isPinned)}
                      >
                        {isPinned ? 'Pinned' : 'Pin to quick nav'}
                      </Button>
                    </Box>
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
              );
            })}
            </List>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default BookmarksPage;
