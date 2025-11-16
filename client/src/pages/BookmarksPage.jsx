/* NOTE: Page exports navigation config alongside the component. */
/**
 * Bookmark architecture cheat sheet:
 *  - Data source: useBookmarksManager fetches bookmark + collection payloads from the API, normalises
 *    them, and exposes helper actions (refresh, export, remove). Keep API-specific logic there.
 *  - Presentation: BookmarksPage handles high-level layout, collection navigation, and renders each
 *    bookmark via ExpandableBookmarkItem. Designers can iterate on layout without touching data logic.
 *  - UX helpers: Quick-nav prefs + focus handling live locally so we can auto-scroll to a collection
 *    when `?collection=` is present while keeping helpers isolated from the data hook.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListSubheader,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Typography
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { auth } from '../firebase';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useBookmarksManager from '../hooks/useBookmarksManager';
import normalizeObjectId from '../utils/normalizeObjectId';
import toIdString from '../utils/ids';
import { fetchCurrentUserProfile } from '../api/mongoDataApi';
import ExpandableBookmarkItem from '../components/ExpandableBookmarkItem';
import MainNavBackButton from '../components/MainNavBackButton';
import GlobalNavMenu from '../components/GlobalNavMenu';
import './BookmarksPage.css';
import '../components/BackButton.css';

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
const ITEMS_PER_PAGE = 10;

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

  const [highlightedCollectionKey, setHighlightedCollectionKey] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [viewerMongoId, setViewerMongoId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const collectionAnchorsRef = useRef(new Map());
  const focusAppliedRef = useRef(null);
  const focusParam = searchParams.get('collection');
  const normalizedFocusParam = useMemo(
    () => (focusParam ? focusParam.trim().toLowerCase() : null),
    [focusParam]
  );

  // Resolve ?collection= query to either an ID or a friendly name.
  const resolvedFocus = useMemo(() => {
    if (!normalizedFocusParam) {
      return null;
    }
    const foundById = collections?.find((collection) => collection?._id === focusParam);
    if (foundById) {
      return { id: foundById._id, name: foundById.name };
    }
    const foundByName = collections?.find((collection) => {
      return (
        typeof collection?.name === 'string' &&
        collection.name.trim().toLowerCase() === normalizedFocusParam
      );
    });
    if (foundByName) {
      return { id: foundByName._id, name: foundByName.name };
    }
    if (
      normalizedFocusParam === UNSORTED_COLLECTION_KEY ||
      normalizedFocusParam === UNSORTED_LABEL.toLowerCase()
    ) {
      return { id: null, name: UNSORTED_LABEL };
    }
    return null;
  }, [collections, focusParam, normalizedFocusParam]);

  // Fetch MongoDB user id for filters like "My Pins".
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
      } catch (fetchError) {
        if (!cancelled) {
          console.warn('Failed to load current user profile for bookmarks filtering:', fetchError);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, isOffline]);

  // Apply focus/scroll when ?collection= is present.
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

    const possibleKeys = [focusKey, resolvedFocus.name?.trim().toLowerCase(), `${focusKey}::header`].filter(Boolean);
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

    const filterBookmarks = (items) => {
      return items.filter((bookmark) => {
        const pin = bookmark.pin;
        if (!pin) {
          return false;
        }
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

    return groupedBookmarks
      .map((group) => ({
        ...group,
        items: filterBookmarks(group.items)
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedBookmarks, selectedFilter, viewerMongoId]);

  const handleFilterChange = useCallback((event) => {
    setSelectedFilter(event.target.value);
    setCurrentPage(1);
  }, []);

  // Flatten filtered groups for pagination.
  const flattenedBookmarks = useMemo(() => {
    const all = [];
    filteredBookmarks.forEach((group) => {
      group.items.forEach((bookmark) => {
        all.push({
          ...bookmark,
          collectionId: group.id,
          collectionName: group.name || UNSORTED_LABEL
        });
      });
    });
    return all;
  }, [filteredBookmarks]);

  const totalPages = Math.ceil(flattenedBookmarks.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedBookmarks = flattenedBookmarks.slice(startIndex, endIndex);

  const paginatedGroupedBookmarks = useMemo(() => {
    const grouped = new Map();
    paginatedBookmarks.forEach((bookmark) => {
      const groupKey = bookmark.collectionId ?? UNSORTED_COLLECTION_KEY;
      if (!grouped.has(groupKey)) {
        const originalGroup = filteredBookmarks.find(
          (candidate) => (candidate.id ?? UNSORTED_COLLECTION_KEY) === groupKey
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
  }, [filteredBookmarks, paginatedBookmarks]);

  const handlePageChange = useCallback((event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const maxPage = Math.ceil(flattenedBookmarks.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > maxPage) {
      setCurrentPage(1);
    }
  }, [currentPage, flattenedBookmarks.length]);

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
      if (!pin) {
        return;
      }
      if (pin.type === 'event') {
        eventCount += 1;
      } else if (pin.type === 'discussion') {
        discussionCount += 1;
      }
      const creatorId = toIdString(pin.creatorId) ?? toIdString(pin.creator?._id);
      if (creatorId && viewerMongoId && creatorId === viewerMongoId) {
        myPinsCount += 1;
      }
      if (pin.viewerIsAttending) {
        attendingCount += 1;
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
      <div className="back-nav-bar bookmarks-back-button">
        <MainNavBackButton
          className="back-button"
          iconClassName="back-button__icon"
          ariaLabel="Back to main view"
          scope="core"
        >
          <span className="back-button__text">Back</span>
        </MainNavBackButton>
        <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
      </div>
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
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography className="bookmarks-title" component="h1">
                Bookmarks
              </Typography>
              <Typography className="bookmarks-subtitle" component="p">
                {totalCount} saved pin{totalCount === 1 ? '' : 's'}
              </Typography>
            </Box>
            <Box className="bookmarks-actions">
              <button type="button" className="bookmarks-action" onClick={refresh} disabled={isLoading}>
                Refresh
              </button>
              <button
                type="button"
                className="bookmarks-action"
                onClick={handleExport}
                disabled={isExporting}
              >
                Export
              </button>
            </Box>
          </Stack>

          {isOffline ? (
            <Alert severity="warning" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
              You are offline. You can browse existing bookmarks, but refresh, removal, and export actions require a connection.
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
                textAlign: 'center',
                backgroundColor: '#CDAEF2',
                border: '1px solid black'
              }}
            >
              <Typography variant="h6" sx={{ fontFamily: '"Urbanist", sans-serif', color: 'black' }}>
                No bookmarks yet
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontFamily: '"Urbanist", sans-serif', color: 'black' }}>
                Tap the bookmark icon on a pin to save it. Your collection of favorites will appear here.
              </Typography>
            </Paper>
          ) : (
            <>
              <FormControl fullWidth size="small">
                <InputLabel id="bookmarks-filter-label" sx={{ color: 'black', fontFamily: '"Urbanist", sans-serif' }}>
                  Filter bookmarks
                </InputLabel>
                <Select
                  labelId="bookmarks-filter-label"
                  value={selectedFilter}
                  label="Filter bookmarks"
                  onChange={handleFilterChange}
                  sx={{
                    '& .MuiSelect-select': {
                      color: 'black',
                      fontFamily: '"Urbanist", sans-serif'
                    },
                    '& fieldset': {
                      borderColor: 'black'
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
                        {description ? (
                          <Typography variant="body2" sx={{ px: 3, py: 1, fontFamily: '"Urbanist", sans-serif' }}>
                            {description}
                          </Typography>
                        ) : null}
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
                              authUser={authUser}
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
