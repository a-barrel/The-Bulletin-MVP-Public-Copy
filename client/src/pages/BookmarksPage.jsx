/* NOTE: Page exports navigation config alongside the component. */
/**
 * Bookmark architecture cheat sheet:
 *  - Data source: useBookmarksManager fetches bookmark + collection payloads from the API, normalises
 *    them, and exposes helper actions (refresh, export, remove). Keep API-specific logic there.
 *  - Presentation: BookmarksPage handles high-level layout, collection navigation, and renders each
 *    bookmark via PinCard. We never duplicate card markup here — mapBookmarkToFeedItem adapts the
 *    saved pin record into the exact shape PinCard expects (see PinCard Data Contract in docs).
 *  - UX helpers: Quick-nav prefs + focus handling live locally in this component so designers can
 *    iterate on the experience without touching the data hook. Anchors are tracked in ref maps so we
 *    can auto-scroll to a collection when `?collection=` is present.
 *  - Editing tips: If you redesign the cards, consider whether the bookmark metadata (saved date,
 *    remove button) belongs inside PinCard or alongside it. Right now PinCard is intentionally unaware
 *    of bookmark-only affordances, so those controls live in the list item footer.
 */
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
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
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
import normalizeObjectId from '../utils/normalizeObjectId';
import ExpandableBookmarkItem from '../components/ExpandableBookmarkItem';
import BackButton from '../components/BackButton';
import './BookmarksPage.css';

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
  const [selectedCollection, setSelectedCollection] = useState('all');
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
    (pinId, pin) => {
      const normalized = normalizeObjectId(pinId);
      if (!normalized) {
        return;
      }
      navigate(routes.pin.byId(normalized), { state: { pin } });
    },
    [navigate]
  );

  const filteredBookmarks = useMemo(() => {
    if (selectedCollection === 'all') {
      return groupedBookmarks;
    }
    if (selectedCollection === UNSORTED_COLLECTION_KEY) {
      return groupedBookmarks.filter((group) => group.id === null);
    }
    // Filter by collection name (e.g., "Weekend Events")
    return groupedBookmarks.filter((group) => {
      return group.name === selectedCollection || group.id === selectedCollection;
    });
  }, [groupedBookmarks, selectedCollection]);

  const handleCollectionChange = useCallback((event) => {
    setSelectedCollection(event.target.value);
  }, []);

  // Get available collection names for the dropdown
  const collectionOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Bookmarks' }];
    groupedBookmarks.forEach((group) => {
      if (group.id === null) {
        // Unsorted
        if (!options.find((opt) => opt.value === UNSORTED_COLLECTION_KEY)) {
          options.push({ value: UNSORTED_COLLECTION_KEY, label: UNSORTED_LABEL });
        }
      } else {
        // Named collection (e.g., "Weekend Events")
        if (!options.find((opt) => opt.value === group.name || opt.value === group.id)) {
          options.push({ value: group.name, label: group.name });
        }
      }
    });
    return options;
  }, [groupedBookmarks]);

  return (
    <>
      <BackButton className="bookmarks-back-button" />
      <Box
        sx={{
          width: '100%',
          minHeight: '100vh',
          py: { xs: 3, md: 5 },
          px: { xs: 2, md: 4 },
          backgroundColor: '#ffffff'
        }}
      >
        <Stack spacing={3}>


        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          {/*
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            Quickly revisit saved pins. Bookmarks are grouped by collection and can be removed at any time.
          </Typography>
          */}
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
            {/*
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
            */} 
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
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel
                id="collection-select-label"
                sx={{ color: 'black', fontFamily: '"Urbanist", sans-serif' }}
              >
                Filter by Collection
              </InputLabel>
              <Select
                labelId="collection-select-label"
                id="collection-select"
                value={selectedCollection}
                label="Filter by Collection"
                onChange={handleCollectionChange}
                sx={{
                  color: 'black',
                  fontFamily: '"Urbanist", sans-serif',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'black',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'black'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'black'
                  }
                }}
              >
                {collectionOptions.map((option) => (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    sx={{ color: 'black', fontFamily: '"Urbanist", sans-serif' }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', backgroundColor: 'transparent' }}>
              <List disablePadding>
                {filteredBookmarks.map((group) => {
                const { id: collectionId, name, description, items } = group;
                const groupKey = collectionId ?? UNSORTED_COLLECTION_KEY;
                const displayName = name || UNSORTED_LABEL;
                const normalizedName = displayName.trim().toLowerCase();
                const isHighlighted = highlightedCollectionKey === groupKey;
                const isPinned = !quickNavPrefs.hidden.includes(groupKey);

                const shouldHideHeader = displayName === 'Weekend Events' || displayName === UNSORTED_LABEL;

                return (
                  <Box key={groupKey}>
                  {!shouldHideHeader && (
                    <>
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
                      </ListSubheader>
                      <Divider />
                    </>
                  )}
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
                      <ExpandableBookmarkItem
                        key={bookmark._id || pinId}
                        bookmark={bookmark}
                        pin={pin}
                        pinId={pinId}
                        pinTitle={pinTitle}
                        pinType={pinType}
                        tagLabel={tagLabel}
                        savedAt={savedAt}
                        isRemoving={isRemoving}
                        isOffline={isOffline}
                        onViewPin={handleViewPin}
                        onRemoveBookmark={handleRemoveBookmark}
                      />
                    );
                  })}
                  {!shouldHideHeader && <Divider />}
                </Box>
              );
            })}
            </List>
          </Paper>
          </>
        )}
      </Stack>
      </Box>
    </>
  );
}

export default BookmarksPage;
