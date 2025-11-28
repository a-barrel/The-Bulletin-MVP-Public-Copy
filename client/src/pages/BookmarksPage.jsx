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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Alert, Box, CircularProgress, FormControl, FormControlLabel, InputLabel, MenuItem, Pagination, PaginationItem, Paper, Select, Snackbar, Stack, Typography, Checkbox } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { auth } from '../firebase';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useBookmarksManager from '../hooks/useBookmarksManager';
import normalizeObjectId from '../utils/normalizeObjectId';
import toIdString from '../utils/ids';
import useBookmarkViewerProfile from '../hooks/bookmarks/useBookmarkViewerProfile';
import useHideFullEventsPreference from '../hooks/useHideFullEventsPreference';
import MainNavBackButton from '../components/MainNavBackButton';
import GlobalNavMenu from '../components/GlobalNavMenu';
import './BookmarksPage.css';
import '../components/BackButton.css';
import { resolveUserAvatarUrl, DEFAULT_AVATAR_PATH } from '../utils/pinFormatting';
import resolveAssetUrl from '../utils/media';
import BookmarkGroupSection from '../components/bookmarks/BookmarkGroupSection';
import BookmarksTopbar from '../components/bookmarks/BookmarksTopbar';
import useBookmarksView from '../hooks/bookmarks/useBookmarksView';

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
const HISTORY_RENDER_LIMIT = 40;

const shallowEqualPinPayload = (a, b) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a._id === b._id &&
    a.title === b.title &&
    a.type === b.type &&
    a.description === b.description &&
    a.creator === b.creator &&
    a.creatorId === b.creatorId &&
    a.coverPhoto === b.coverPhoto &&
    a.mediaAssets === b.mediaAssets &&
    a.photos === b.photos &&
    a.images === b.images &&
    a.viewerIsAttending === b.viewerIsAttending &&
    a.participantCount === b.participantCount &&
    (a.stats?.participantCount ?? null) === (b.stats?.participantCount ?? null)
  );
};

const BookmarksList = memo(
  function BookmarksList({
    groups,
    highlightedCollectionKey,
    collectionAnchorsRef,
    handleViewPin,
    handleRemoveBookmark,
    notifyRemovalStatus,
    handleBookmarkAttendanceToggle,
    removingPinId,
    attendancePendingId,
    isOffline,
    authUser
  }) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', backgroundColor: 'transparent' }}>
        <Box component="div" role="list">
          {groups.map((group) => (
            <BookmarkGroupSection
              key={group.id ?? UNSORTED_COLLECTION_KEY}
              group={group}
              highlightedCollectionKey={highlightedCollectionKey}
              collectionAnchorsRef={collectionAnchorsRef}
              handleViewPin={handleViewPin}
              handleRemoveBookmark={handleRemoveBookmark}
              notifyRemovalStatus={notifyRemovalStatus}
              handleBookmarkAttendanceToggle={handleBookmarkAttendanceToggle}
              removingPinId={removingPinId}
              attendancePendingId={attendancePendingId}
              isOffline={isOffline}
              authUser={authUser}
            />
          ))}
        </Box>
      </Paper>
    );
  },
  (prev, next) =>
    prev.groups === next.groups &&
    prev.highlightedCollectionKey === next.highlightedCollectionKey &&
    prev.removingPinId === next.removingPinId &&
    prev.attendancePendingId === next.attendancePendingId &&
    prev.isOffline === next.isOffline &&
    prev.authUser === next.authUser &&
    prev.handleViewPin === next.handleViewPin &&
    prev.handleRemoveBookmark === next.handleRemoveBookmark &&
    prev.notifyRemovalStatus === next.notifyRemovalStatus &&
    prev.handleBookmarkAttendanceToggle === next.handleBookmarkAttendanceToggle
);

function BookmarksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOffline } = useNetworkStatusContext();
  const [authUser, authLoading] = useAuthState(auth);
  const { viewerProfile: bookmarkViewerProfile, viewerMongoId } = useBookmarkViewerProfile({
    authUser,
    isOffline
  });
  const {
    hideFullEvents,
    setHideFullEvents,
    isSavingPreference: isSavingHideFullPreference,
    preferenceError: hideFullPreferenceError,
    clearPreferenceError
  } = useHideFullEventsPreference({
    profileValue: bookmarkViewerProfile?.preferences?.display?.hideFullEventsByDefault,
    disablePersistence: isOffline
  });

  const {
    bookmarks,
    groupedBookmarks,
    totalCount,
    isLoading,
    error,
    dismissError,
    removalStatus,
    notifyRemovalStatus,
    dismissRemovalStatus,
    removingPinId,
    attendancePendingId,
    isExporting,
    exportStatus,
    dismissExportStatus,
    handleRemoveBookmark,
    handleExport,
    handleToggleAttendance,
    refresh,
    formatSavedDate,
    collections,
    viewHistory,
    clearHistory,
    isClearingHistory,
    historyError,
    dismissHistoryError,
    refreshHistory
  } = useBookmarksManager({ authUser, authLoading, isOffline, hideFullEvents });
  const focusAppliedRef = useRef(null);
  const focusParam = searchParams.get('collection');
  const normalizedFocusParam = useMemo(
    () => (focusParam ? focusParam.trim().toLowerCase() : null),
    [focusParam]
  );

  const {
    selectedFilter,
    hideOwnPins,
    activeTab,
    currentPage,
    filteredGroups,
    paginatedGroupedBookmarks,
    totalPages,
    handlePageChange,
    filterOptions,
    limitedHistory,
    isHistoryTrimmed,
    handleFilterChange,
    handleTabChange,
    handleHideOwnPinsToggle,
    handleBookmarkAttendanceToggle,
    collectionAnchorsRef,
    ITEMS_PER_PAGE
  } = useBookmarksView({
    groupedBookmarks,
    bookmarks,
    viewHistory,
    handleToggleAttendance,
    notifyRemovalStatus,
    formatSavedDate,
    viewerMongoId
  });

  const [highlightedCollectionKey, setHighlightedCollectionKey] = useState(null);

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

  const handleHideFullEventsToggle = useCallback(
    (event) => {
      const nextValue = Boolean(event.target.checked);
      if (hideFullPreferenceError) {
        clearPreferenceError();
      }
      setHideFullEvents(nextValue);
    },
    [clearPreferenceError, hideFullPreferenceError, setHideFullEvents]
  );

  const handleHistoryClear = useCallback(() => {
    if (historyError) {
      dismissHistoryError();
    }
    clearHistory();
  }, [clearHistory, dismissHistoryError, historyError]);

  useEffect(() => {
    if (activeTab === 'history') {
      refreshHistory();
    }
  }, [activeTab, refreshHistory]);

  return (
    <>
      <div className="back-nav-bar bookmarks-back-button">
        <MainNavBackButton
          className="back-button"
          iconClassName="back-button__icon"
          ariaLabel="Back to main view"
          scope="core"
        />
        <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
        <Typography className="bookmarks-header-title" component="h1">
          Bookmarks
        </Typography>
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
          <BookmarksTopbar
            totalCount={totalCount}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onRefresh={refresh}
            onExport={handleExport}
            isLoading={isLoading}
            isExporting={isExporting}
            isOffline={isOffline}
            viewHistoryLength={viewHistory.length}
            onClearHistory={handleHistoryClear}
            isClearingHistory={isClearingHistory}
            hideFullPreferenceError={hideFullPreferenceError}
            onClearPreferenceError={clearPreferenceError}
          />

          {exportStatus ? (
            <Alert severity={exportStatus.type} onClose={dismissExportStatus} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
              {exportStatus.message}
            </Alert>
          ) : null}

          {removalStatus && !removalStatus.toast ? (
            <Alert severity={removalStatus.type} onClose={dismissRemovalStatus} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
              {removalStatus.message}
            </Alert>
          ) : null}
          {historyError ? (
            <Alert
              severity="error"
              onClose={dismissHistoryError}
              sx={{ fontFamily: '"Urbanist", sans-serif' }}
            >
              {historyError}
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error" onClose={dismissError} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
              {error}
            </Alert>
          ) : null}

          {activeTab === 'bookmarks' ? (
            isLoading ? (
              <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
                  Loading bookmarks...
                </Typography>
              </Stack>
            ) : totalCount === 0 ? (
              <Paper
                variant="outlined"
                className="bookmark-empty"
                sx={{
                  borderRadius: 3,
                  p: 4,
                  textAlign: 'center'
                }}
              >
                <Typography variant="h6" className="bookmark-empty__title">
                  No bookmarks yet
                </Typography>
                <Typography variant="body2" className="bookmark-empty__body" sx={{ mt: 1 }}>
                  Tap the bookmark icon on a pin to save it. Your collection of favorites will appear here.
                </Typography>
              </Paper>
            ) : (
              <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
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
                    MenuProps={{
                      PaperProps: {
                        sx: { backgroundColor: '#E6F1FF' }
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hideOwnPins}
                      onChange={handleHideOwnPinsToggle}
                      color="secondary"
                      disableRipple
                    />
                  }
                  label="Hide my pins"
                  sx={{ fontFamily: '"Urbanist", sans-serif', color: 'black' }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hideFullEvents}
                      onChange={handleHideFullEventsToggle}
                      color="secondary"
                      disabled={isSavingHideFullPreference}
                      disableRipple
                    />
                  }
                  label="Hide full events"
                  sx={{ fontFamily: '"Urbanist", sans-serif', color: 'black' }}
                />
              </Stack>
              <BookmarksList
                groups={paginatedGroupedBookmarks}
                highlightedCollectionKey={highlightedCollectionKey}
                collectionAnchorsRef={collectionAnchorsRef}
                handleViewPin={handleViewPin}
                handleRemoveBookmark={handleRemoveBookmark}
                notifyRemovalStatus={notifyRemovalStatus}
                handleBookmarkAttendanceToggle={handleBookmarkAttendanceToggle}
                removingPinId={removingPinId}
                attendancePendingId={attendancePendingId}
                isOffline={isOffline}
                authUser={authUser}
              />
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    renderItem={(item) => <PaginationItem disableRipple {...item} />}
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
            )
          ) : isLoading ? (
            <Stack
              spacing={2}
              alignItems="center"
              justifyContent="center"
              className="history-loading"
              sx={{ py: 6 }}
            >
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
                Loading history...
              </Typography>
            </Stack>
          ) : viewHistory.length === 0 ? (
            <Paper
              variant="outlined"
              className="history-empty"
              sx={{
                borderRadius: 3,
                p: 4,
                textAlign: 'center'
              }}
            >
              <Typography variant="h6" className="history-empty__title">
                No viewed pins yet
              </Typography>
              <Typography variant="body2" className="history-empty__body" sx={{ mt: 1 }}>
                Pins you open will appear here so you can jump back quickly.
              </Typography>
            </Paper>
          ) : (
            <Paper
              variant="outlined"
              className="history-panel"
              sx={{ borderRadius: 3, p: 2 }}
            >
              {isHistoryTrimmed ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
                  Showing latest {limitedHistory.length} of {viewHistory.length}.
                </Typography>
              ) : null}
              <Stack spacing={1.25}>
                {limitedHistory.map((entry) => {
                  const pin = entry.pin;
                  const title = pin?.title || 'Unavailable pin';
                  const typeLabel =
                    pin?.type === 'event' ? 'Event' : pin?.type === 'discussion' ? 'Discussion' : 'Pin';
                  const hostName = pin?.creator?.displayName || pin?.creator?.username || 'Unknown host';
                  const hostAvatar = resolveUserAvatarUrl(pin?.creator, DEFAULT_AVATAR_PATH) || DEFAULT_AVATAR_PATH;
                  const isClickable = Boolean(pin);
                  const canonicalImage = entry.imageUrl ? resolveAssetUrl(entry.imageUrl) : null;
                  // Media priority: canonical history imageUrl -> coverPhoto -> mediaAssets[0] -> photos[0] -> images[0]
                  const rawImage =
                    canonicalImage ||
                    resolveAssetUrl(pin?.coverPhoto) ||
                    resolveAssetUrl(Array.isArray(pin?.mediaAssets) ? pin.mediaAssets[0] : null) ||
                    resolveAssetUrl(Array.isArray(pin?.photos) ? pin.photos[0] : null) ||
                    resolveAssetUrl(Array.isArray(pin?.images) ? pin.images[0] : null);
                  const mediaSrc =
                    rawImage && typeof rawImage === 'string' && !rawImage.includes('UNKNOWN_TEXTURE')
                      ? rawImage
                      : null;
                  return (
                    <Box
                      key={`${entry.pinId}-${entry.viewedAt}`}
                      onClick={() => (pin ? handleViewPin(entry.pinId, pin) : undefined)}
                      className={`history-card${isClickable ? ' history-card--clickable' : ''}`}
                    >
                      <div className="history-card__row">
                        <div className="history-card__content">
                          <div className="history-card__header">
                            <Typography variant="subtitle1" className="history-card__title">
                              {title}
                            </Typography>
                            <span
                              className={`history-card__badge ${
                                pin?.type === 'discussion' ? 'history-card__badge--discussion' : ''
                              }`}
                            >
                              {typeLabel}
                            </span>
                          </div>
                          <Typography variant="body2" className="history-card__meta">
                            Viewed {formatSavedDate(entry.viewedAt)}
                          </Typography>
                          <Box className="history-card__host">
                            <img
                              className="history-card__avatar"
                              src={hostAvatar}
                              alt={`${hostName} avatar`}
                            />
                            <Box className="history-card__host-text">
                              <div className="history-card__host-label">Hosted by</div>
                              <div className="history-card__host-name">{hostName}</div>
                            </Box>
                          </Box>
                        </div>
                        <div
                          className={`history-card__media${
                            mediaSrc ? '' : ' history-card__media--placeholder'
                          }`}
                          aria-hidden={!mediaSrc}
                        >
                          {mediaSrc ? (
                            <img src={mediaSrc} alt={`${title} preview`} loading="lazy" />
                          ) : (
                            <span className="history-card__media-fallback">Photo</span>
                          )}
                        </div>
                      </div>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          )}
      </Stack>
      <Snackbar
        open={Boolean(removalStatus?.toast)}
        autoHideDuration={4000}
        onClose={dismissRemovalStatus}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {removalStatus?.toast ? (
          <Alert
            severity={removalStatus?.type || 'info'}
            variant="filled"
            onClose={dismissRemovalStatus}
            sx={{ width: '100%' }}
          >
            {removalStatus?.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  </>
);
}

export default BookmarksPage;
