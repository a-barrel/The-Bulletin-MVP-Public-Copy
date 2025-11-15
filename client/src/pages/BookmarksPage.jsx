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
  Pagination,
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
import toIdString from '../utils/ids';
import { fetchCurrentUserProfile } from '../api/mongoDataApi';
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
    bookmarks,
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
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [viewerMongoId, setViewerMongoId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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

  // Fetch MongoDB user ID for filtering
  useEffect(() => {
    if (!authUser || isOffline) {
      setViewerMongoId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!cancelled && profile?._id) {
          setViewerMongoId(toIdString(profile._id));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load current user profile for bookmarks filtering:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, isOffline]);

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
    if (selectedFilter === 'all') {
      return groupedBookmarks;
    }

    const filterBookmarks = (bookmarks) => {
      return bookmarks.filter((bookmark) => {
        const pin = bookmark.pin;
        if (!pin) return false;

        switch (selectedFilter) {
          case 'event':
            return pin.type === 'event';
          case 'discussion':
            return pin.type === 'discussion';
          case 'my-pins': {
            const creatorId = toIdString(pin.creatorId) ?? toIdString(pin.creator?._id);
            return creatorId && viewerMongoId && creatorId === viewerMongoId;
          }
          case 'attending':
            return Boolean(pin.viewerIsAttending);
          default:
            return true;
        }
      });
    };

    // Apply filter to each group's items
    return groupedBookmarks
      .map((group) => ({
        ...group,
        items: filterBookmarks(group.items)
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedBookmarks, selectedFilter, viewerMongoId]);

  const handleFilterChange = useCallback((event) => {
    setSelectedFilter(event.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  }, []);

  // Flatten all bookmarks from filtered groups for pagination
  const flattenedBookmarks = useMemo(() => {
    const allBookmarks = [];
    filteredBookmarks.forEach((group) => {
      group.items.forEach((bookmark) => {
        allBookmarks.push({
          ...bookmark,
          collectionId: group.id,
          collectionName: group.name || UNSORTED_LABEL
        });
      });
    });
    return allBookmarks;
  }, [filteredBookmarks]);

  // Calculate pagination
  const totalPages = Math.ceil(flattenedBookmarks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBookmarks = flattenedBookmarks.slice(startIndex, endIndex);

  // Group paginated bookmarks back by collection for display
  const paginatedGroupedBookmarks = useMemo(() => {
    const grouped = new Map();
    paginatedBookmarks.forEach((bookmark) => {
      const groupKey = bookmark.collectionId ?? UNSORTED_COLLECTION_KEY;
      if (!grouped.has(groupKey)) {
        const originalGroup = filteredBookmarks.find(
          (g) => (g.id ?? UNSORTED_COLLECTION_KEY) === groupKey
        );
        grouped.set(groupKey, {
          id: originalGroup?.id,
          name: originalGroup?.name,
          description: originalGroup?.description,
          items: []
        });
      }
      grouped.get(groupKey).items.push(bookmark);
    });
    return Array.from(grouped.values());
  }, [paginatedBookmarks, filteredBookmarks]);

  const handlePageChange = useCallback((event, value) => {
    setCurrentPage(value);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Reset page if it's out of bounds after filtering
  useEffect(() => {
    const maxPage = Math.ceil(flattenedBookmarks.length / itemsPerPage) || 1;
    if (currentPage > maxPage) {
      setCurrentPage(1);
    }
  }, [flattenedBookmarks.length, currentPage]);

  // Calculate counts for each filter option using bookmarks from useBookmarksManager
  const filterCounts = useMemo(() => {
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return {
        all: 0,
        event: 0,
        discussion: 0,
        'my-pins': 0,
        attending: 0
      };
    }

    let eventCount = 0;
    let discussionCount = 0;
    let myPinsCount = 0;
    let attendingCount = 0;

    bookmarks.forEach((bookmark) => {
      const pin = bookmark.pin;
      if (!pin) return;

      // Count by type
      if (pin.type === 'event') {
        eventCount++;
      } else if (pin.type === 'discussion') {
        discussionCount++;
      }

      // Count user's own pins
      const creatorId = toIdString(pin.creatorId) ?? toIdString(pin.creator?._id);
      if (creatorId && viewerMongoId && creatorId === viewerMongoId) {
        myPinsCount++;
      }

      // Count attending pins
      if (Boolean(pin.viewerIsAttending)) {
        attendingCount++;
      }
    });

    return {
      all: bookmarks.length,
      event: eventCount,
      discussion: discussionCount,
      'my-pins': myPinsCount,
      attending: attendingCount
    };
  }, [bookmarks, viewerMongoId]);

  // Filter options with counts
  const filterOptions = useMemo(
    () => [
      { value: 'all', label: `All Pins (${filterCounts.all})` },
      { value: 'event', label: `Event Pins (${filterCounts.event})` },
      { value: 'discussion', label: `Discussion Pins (${filterCounts.discussion})` },
      { value: 'my-pins', label: `My Pins (${filterCounts['my-pins']})` },
      { value: 'attending', label: `I'm Attending (${filterCounts.attending})` }
    ],
    [filterCounts]
  );

  return (
    <>
      <BackButton className="bookmarks-back-button" />
      <Box
        sx={{
          width: '100%',
          minHeight: '100vh',
          py: { xs: 3, md: 5 },
          px: { xs: 2, md: 4 },
          backgroundColor: '#ffffff',
          fontFamily: '"Urbanist", sans-serif'
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
            {/* 
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
          <Alert severity="warning" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
            You are offline. You can browse existing bookmarks, but refresh, removal, and export actions
            require a connection.
          </Alert>
        ) : null}

        {exportStatus ? (
          <Alert severity={exportStatus.type} onClose={() => setExportStatus(null)} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
            {exportStatus.message}
          </Alert>
        ) : null}

        {removalStatus ? (
          <Alert severity={removalStatus.type} onClose={() => setRemovalStatus(null)} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
            {removalStatus.message}
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" onClose={() => setError(null)} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
            {error}
          </Alert>
        ) : null}

        {isLoading ? (
          <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
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
            <Typography variant="h6" sx={{ fontFamily: '"Urbanist", sans-serif' }}>No bookmarks yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontFamily: '"Urbanist", sans-serif' }}>
              Tap the bookmark icon on a pin to save it. Your collection of favorites will appear here.
            </Typography>
          </Paper>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel
                id="filter-select-label"
                sx={{ color: 'black', fontFamily: '"Urbanist", sans-serif' }}
              >
                Filter
              </InputLabel>
              <Select
                labelId="filter-select-label"
                id="filter-select"
                value={selectedFilter}
                label="Filter"
                onChange={handleFilterChange}
                sx={{
                  color: 'black',
                  fontFamily: '"Urbanist", sans-serif',
                  '& .MuiSelect-select': {
                    color: 'black'
                  },
                  '&.Mui-focused .MuiSelect-select': {
                    color: 'black'
                  },
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
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: 'white',
                      fontFamily: '"Urbanist", sans-serif'
                    }
                  }
                }}
              >
                {filterOptions.map((option) => (
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
                {paginatedGroupedBookmarks.map((group) => {
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
                        <Typography variant="subtitle1" fontWeight={600} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
                          {displayName}
                        </Typography>
                        <Chip label={items.length} size="small" variant="outlined" sx={{ fontFamily: '"Urbanist", sans-serif' }} />
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
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontFamily: '"Urbanist", sans-serif',
                    color: 'black'
                  },
                  '& .MuiPaginationItem-root.Mui-selected': {
                    backgroundColor: '#4b208c',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#6b2fa8'
                    }
                  }
                }}
              />
            </Box>
          )}
          </>
        )}
      </Stack>
      </Box>
    </>
  );
}

export default BookmarksPage;


