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
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { auth } from '../firebase';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useBookmarksManager from '../hooks/useBookmarksManager';
import normalizeObjectId from '../utils/normalizeObjectId';
import runtimeConfig from '../config/runtime';
import './BookmarksPageDebug.css';
import useBookmarkQuickNavPrefs from '../hooks/useBookmarkQuickNavPrefs';
import BookmarksDebugHeader from '../components/bookmarks/debug/BookmarksDebugHeader';
import BookmarksDebugFilters from '../components/bookmarks/debug/BookmarksDebugFilters';
import BookmarkCollectionList from '../components/bookmarks/debug/BookmarkCollectionList';

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
    removalStatus,
    removingPinId,
    isExporting,
    exportStatus,
    handleRemoveBookmark,
    handleExport,
    refresh,
    formatSavedDate,
    collections,
    dismissError,
    dismissRemovalStatus,
    dismissExportStatus
  } = useBookmarksManager({ authUser, authLoading, isOffline });
  const quickNav = useBookmarkQuickNavPrefs();
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
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
      <BookmarksDebugHeader totalCount={totalCount} />

      <Stack spacing={3} className="bookmarks-content">
        <BookmarksDebugFilters
          activeType={activeTypeFilter}
          onActiveTypeChange={handleTypeFilterChange}
          totalCount={totalCount}
          onRefresh={refresh}
          onExport={handleExport}
          refreshDisabled={isOffline || isLoading || authLoading || !authUser}
          exportDisabled={isOffline || isExporting || authLoading || !authUser}
          isLoading={isLoading}
          isExporting={isExporting}
        />

        {isOffline ? (
          <Alert severity="warning">
            You are offline. You can browse existing bookmarks, but refresh, removal, and export actions require a connection.
          </Alert>
        ) : null}

        {exportStatus ? (
          <Alert severity={exportStatus.type} onClose={dismissExportStatus}>
            {exportStatus.message}
          </Alert>
        ) : null}

        {removalStatus ? (
          <Alert severity={removalStatus.type} onClose={dismissRemovalStatus}>
            {removalStatus.message}
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" onClose={dismissError}>
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
          <BookmarkCollectionList
            groups={filteredGroups}
            focusTarget={resolvedFocus}
            quickNav={quickNav}
            viewerProfileId={viewerProfileId}
            removingPinId={removingPinId}
            isOffline={isOffline}
            formatSavedDate={formatSavedDate}
            onViewPin={handleViewPin}
            onViewAuthor={handleViewAuthor}
            onRemoveBookmark={handleRemoveBookmark}
          />
        )}
      </Stack>
    </div>
  );
}

export default BookmarksPageDebug;
