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
  Paper,
  Stack,
  Typography
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { auth } from '../firebase';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useBookmarksManager from '../hooks/useBookmarksManager';
import normalizeObjectId from '../utils/normalizeObjectId';
import PinCard from '../components/PinCard';
import { mapBookmarkToFeedItem } from '../utils/bookmarks';
import BackButton from '../components/BackButton';
import GlobalNavMenu from '../components/GlobalNavMenu';
import runtimeConfig from '../config/runtime';
import './BookmarksPageDebug.css';

export const pageConfig = {
  id: 'bookmarks-debug',
  label: 'Bookmarks (Debug)',
  icon: BookmarkIcon,
  path: '/bookmarks-debug',
  order: 194,
  showInNav: Boolean(runtimeConfig?.isOffline),
  protected: true,
  aliases: []
};

const BOOKMARK_QUICK_NAV_PREFS_KEY = 'pinpoint:bookmarkQuickNavPrefs';
const BOOKMARK_QUICK_NAV_PREFS_VERSION = 1;

function BookmarksPageDebug() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOffline } = useNetworkStatusContext();
  const [authUser, authLoading] = useAuthState(auth);
  const viewerProfileId = authUser?.uid ?? null;
  // Pull the bookmark payload plus helper actions from the shared data manager hook.
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
  // Local quick-nav state mirrors localStorage so designers can pin/unpin collections per device.
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
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  // Track DOM nodes for each collection header so we can scroll to them later.
  const collectionAnchorsRef = useRef(new Map());
  // Prevent spamming scrollIntoView when effects rerun with the same target.
  const focusAppliedRef = useRef(null);
  const focusParam = searchParams.get('collection');
  // Normalize the search param once so we can match either collection IDs or display names.
  const normalizedFocusParam = useMemo(
    () => (focusParam ? focusParam.trim().toLowerCase() : null),
    [focusParam]
  );
  // Resolve which collection should be highlighted/auto-scrolled, supporting ?collection=id or name.
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
    if (normalizedFocusParam === '__ungrouped__') {
      return {
        id: null,
        name: ''
      };
    }
    return null;
  }, [collections, focusParam, normalizedFocusParam]);

  const filteredGroups = useMemo(() => {
    return groupedBookmarks
      .map((group) => {
        const filteredItems =
          activeTypeFilter === 'all'
            ? group.items
            : group.items.filter((bookmark) => {
                const pinType = bookmark.pin?.type ?? 'event';
                if (activeTypeFilter === 'event') {
                  return pinType === 'event';
                }
                return pinType === 'discussion';
              });
        return { ...group, items: filteredItems };
      })
      .filter((group) => group.items.length > 0);
  }, [groupedBookmarks, activeTypeFilter]);

  const hasFilteredResults = filteredGroups.some((group) => group.items.length > 0);

  // Auto-scroll to a collection whenever ?collection= changes and briefly highlight its header.
  useEffect(() => {
    if (!resolvedFocus) {
      setHighlightedCollectionKey(null);
      focusAppliedRef.current = null;
      return undefined;
    }

    const focusKey = resolvedFocus.id ?? '__ungrouped__';
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

  // Persist which collections should appear in the quick-nav rail (a lightweight pinned list).
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

  const handleCollectionSelect = useCallback((value) => {
    setSelectedCollection(value);
    if (value === 'all') {
      return;
    }
    const anchors = collectionAnchorsRef.current;
    const targetNode = anchors.get(`${value}::header`) || anchors.get(value);
    if (targetNode) {
      try {
        targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        targetNode.scrollIntoView(true);
      }
    }
  }, []);

  const handleTypeFilterChange = useCallback((value) => {
    setActiveTypeFilter(value);
  }, []);

  // Reuse List feed navigation patterns so deep-linking a bookmark mirrors tapping a card elsewhere.
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

  // Allow sharing author-profile navigation logic with other feeds.
  const handleViewAuthor = useCallback(
    (authorId) => {
      const normalized = normalizeObjectId(authorId);
      if (!normalized) {
        return;
      }
      navigate(routes.profile.byId(normalized));
    },
    [navigate]
  );

  // Everything below is pure presentation: sticky header, filters, and grouped PinCards.
  return (
    <div className="bookmarks-shell">
      <div className="bookmarks-nav">
        <div className="bookmarks-nav-left">
          <BackButton className="bookmarks-back-link" />
          <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
        </div>
        <div className="bookmarks-nav-title">
          <BookmarkIcon fontSize="small" />
          <span>Bookmarks</span>
        </div>
        <div className="bookmarks-nav-left" />
      </div>

      <Stack spacing={3} className="bookmarks-content">
        <Stack direction="row" spacing={0} alignItems="center" className="bookmarks-main-toolbar">
          <Stack direction="row" spacing={1} flexWrap="wrap" className="bookmarks-type-filters">
            {[
              { label: 'All bookmarks', value: 'all' },
              { label: 'Events', value: 'event' },
              { label: 'Discussions', value: 'discussion' }
            ].map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={`bookmark-type-chip${activeTypeFilter === filter.value ? ' is-active' : ''}`}
                onClick={() => handleTypeFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" className="bookmarks-toolbar-actions">
            <span className="bookmarks-count">Saved pins: {totalCount}</span>
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
            You are offline. You can browse existing bookmarks, but refresh, removal, and export actions require a connection.
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
          <Paper className="bookmarks-empty-card">
            <Typography variant="h6">No bookmarks yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Tap the bookmark icon on a pin to save it. Your collection of favorites will appear here.
            </Typography>
          </Paper>
        ) : !hasFilteredResults ? (
          <Paper className="bookmarks-empty-card">
            <Typography variant="h6">Nothing in this filter</Typography>
            <Typography variant="body2" color="text.secondary">
              Try another collection chip or create your first bookmark in this group.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={3}>
            {filteredGroups.map((group) => {
              const { id: collectionId, name, description, items } = group;
              const groupKey = collectionId ?? '__ungrouped__';
              const normalizedDisplayName =
                typeof name === 'string' && name.trim().toLowerCase() !== 'unsorted'
                  ? name.trim()
                  : '';
              const normalizedName = normalizedDisplayName.toLowerCase();
              const isHighlighted = highlightedCollectionKey === groupKey;
              const isPinned = !quickNavPrefs.hidden.includes(groupKey);

              return (
                <Paper
                  key={groupKey}
                  className={`bookmarks-collection-card${isHighlighted ? ' is-highlighted' : ''}`}
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
                >
                  {normalizedDisplayName ? (
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      alignItems={{ md: 'center' }}
                      justifyContent="space-between"
                      className="bookmark-group-title"
                    >
                      <Typography variant="h6">{normalizedDisplayName}</Typography>
                    </Stack>
                  ) : null}

                  <Stack spacing={2} className="bookmarks-collection-list">
                    {items.map((bookmark, bookmarkIndex) => {
                      const pin = bookmark.pin;
                      const pinId = bookmark.pinId || pin?._id;
                      const savedAt = formatSavedDate(bookmark.createdAt);
                      const isRemoving = removingPinId === pinId;
                      const cardItem = mapBookmarkToFeedItem(bookmark, { viewerProfileId });
                      const cardKey = bookmark._id || pinId || `bookmark-${bookmarkIndex}`;
                      const canViewPin = Boolean(pinId);
                      const handleCardSelect = (selectedPinId) => {
                        handleViewPin(selectedPinId, pin);
                      };

                      return (
                        <Box key={cardKey} className="bookmark-item">
                          {cardItem ? (
                            <PinCard
                              item={cardItem}
                              onSelectItem={handleCardSelect}
                              onSelectAuthor={handleViewAuthor}
                              showAttendeeAvatars={false}
                              className="pin-card--fluid"
                            />
                          ) : (
                            <Paper variant="outlined" className="bookmark-missing-card">
                              <Typography variant="subtitle1" fontWeight={600}>
                                Pin unavailable
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                This bookmark no longer has enough pin data to render.
                              </Typography>
                            </Paper>
                          )}

                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            justifyContent="space-between"
                            className="bookmark-item-footer"
                          >
                            <Typography variant="body2">Saved on {savedAt}</Typography>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<LaunchIcon fontSize="small" />}
                                onClick={() => handleViewPin(pinId, pin)}
                                disabled={!canViewPin}
                              >
                                View
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                startIcon={<DeleteOutlineIcon fontSize="small" />}
                                disabled={isOffline || isRemoving}
                                onClick={() => handleRemoveBookmark(bookmark)}
                                title={isOffline ? 'Reconnect to remove bookmarks' : undefined}
                              >
                                {isRemoving ? 'Removing...' : 'Remove'}
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </div>
  );
}

export default BookmarksPageDebug;
