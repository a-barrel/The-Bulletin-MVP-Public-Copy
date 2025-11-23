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
  FormControlLabel,
  InputLabel,
  List,
  ListSubheader,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
  Checkbox,
  Button
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { auth } from '../firebase';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import useBookmarksManager from '../hooks/useBookmarksManager';
import normalizeObjectId from '../utils/normalizeObjectId';
import toIdString from '../utils/ids';
import useBookmarkViewerProfile from '../hooks/bookmarks/useBookmarkViewerProfile';
import useHideFullEventsPreference from '../hooks/useHideFullEventsPreference';
import ExpandableBookmarkItem from '../components/ExpandableBookmarkItem';
import MainNavBackButton from '../components/MainNavBackButton';
import GlobalNavMenu from '../components/GlobalNavMenu';
import './BookmarksPage.css';
import '../components/BackButton.css';
import { resolveUserAvatarUrl, DEFAULT_AVATAR_PATH } from '../utils/pinFormatting';

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

  const [highlightedCollectionKey, setHighlightedCollectionKey] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [hideOwnPins, setHideOwnPins] = useState(true);
  const [activeTab, setActiveTab] = useState('bookmarks');
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

  const filteredGroups = useMemo(() => {
    const shouldHideOwnPins = hideOwnPins && viewerMongoId;

    const matchesSelectedFilter = (bookmark) => {
      const pin = bookmark.pin;
      if (!pin) {
        return false;
      }
      const pinType = typeof pin.type === 'string' ? pin.type.toLowerCase() : '';
      switch (selectedFilter) {
        case 'event':
          return pinType === 'event';
        case 'discussion':
          return pinType === 'discussion';
        case 'my-pins': {
          const creatorId =
            toIdString(pin.creatorId) ??
            toIdString(pin.creator?._id) ??
            toIdString(bookmark.creatorId) ??
            toIdString(bookmark.creator?._id);
          return creatorId && viewerMongoId && creatorId === viewerMongoId;
        }
        case 'attending':
          return Boolean(pin.viewerIsAttending);
        default:
          return true;
      }
    };

    return groupedBookmarks
      .map((group) => {
        const filteredItems = group.items.filter((bookmark) => {
          if (shouldHideOwnPins) {
            const ownerId =
              toIdString(bookmark?.pin?.creatorId) ??
              toIdString(bookmark?.pin?.creator?._id) ??
              toIdString(bookmark?.creatorId) ??
              toIdString(bookmark?.creator?._id);
            if (ownerId && ownerId === viewerMongoId) {
              return false;
            }
          }
          return matchesSelectedFilter(bookmark);
        });
        return { ...group, items: filteredItems };
      })
      .filter((group) => group.items.length > 0);
  }, [groupedBookmarks, hideOwnPins, selectedFilter, viewerMongoId]);

  const handleFilterChange = useCallback((event) => {
    setSelectedFilter(event.target.value);
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

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

  const handleBookmarkAttendanceToggle = useCallback(
    async (bookmark) => {
      try {
        const status = await handleToggleAttendance(bookmark);
        if (status) {
          notifyRemovalStatus(status);
        }
      } catch (error) {
        notifyRemovalStatus({
          type: 'error',
          message: error?.message || 'Failed to update attendance.',
          toast: true
        });
      }
    },
    [handleToggleAttendance, notifyRemovalStatus]
  );

  // Flatten filtered groups for pagination.
  const flattenedBookmarks = useMemo(() => {
    const all = [];
    filteredGroups.forEach((group) => {
      group.items.forEach((bookmark) => {
        all.push({
          ...bookmark,
          collectionId: group.id,
          collectionName: group.name || UNSORTED_LABEL
        });
      });
    });
    return all;
  }, [filteredGroups]);

  const totalPages = Math.ceil(flattenedBookmarks.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedBookmarks = flattenedBookmarks.slice(startIndex, endIndex);

  const paginatedGroupedBookmarks = useMemo(() => {
    const grouped = new Map();
    paginatedBookmarks.forEach((bookmark) => {
      const groupKey = bookmark.collectionId ?? UNSORTED_COLLECTION_KEY;
      if (!grouped.has(groupKey)) {
        const originalGroup = filteredGroups.find(
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
  }, [filteredGroups, paginatedBookmarks]);

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
      const pinType = typeof pin.type === 'string' ? pin.type.toLowerCase() : '';
      if (pinType === 'event') {
        eventCount += 1;
      } else if (pinType === 'discussion') {
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
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              label={`Bookmarks (${totalCount})`}
              variant={activeTab === 'bookmarks' ? 'filled' : 'outlined'}
              onClick={() => handleTabChange('bookmarks')}
              sx={{
                fontWeight: 600,
                backgroundColor: activeTab === 'bookmarks' ? '#5D3889' : 'rgba(93,56,137,0.1)',
                color: activeTab === 'bookmarks' ? '#fff' : '#5D3889',
                borderColor: '#5D3889'
              }}
            />
            <Chip
              label={`History (${viewHistory.length})`}
              variant={activeTab === 'history' ? 'filled' : 'outlined'}
              onClick={() => handleTabChange('history')}
              sx={{
                fontWeight: 600,
                backgroundColor: activeTab === 'history' ? '#5D3889' : 'rgba(93,56,137,0.1)',
                color: activeTab === 'history' ? '#fff' : '#5D3889',
                borderColor: '#5D3889'
              }}
            />
            {activeTab === 'history' ? (
              <Button
                variant="text"
                color="secondary"
                onClick={handleHistoryClear}
                disabled={isClearingHistory || viewHistory.length === 0 || isOffline}
                sx={{ fontFamily: '"Urbanist", sans-serif' }}
              >
                {isClearingHistory ? 'Clearing…' : 'Clear history'}
              </Button>
            ) : null}
          </Stack>

          {isOffline ? (
            <Alert severity="warning" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
              You are offline. You can browse existing bookmarks, but refresh, removal, and export actions require a connection.
            </Alert>
          ) : null}

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
          {hideFullPreferenceError ? (
            <Alert
              severity="error"
              onClose={clearPreferenceError}
              sx={{ fontFamily: '"Urbanist", sans-serif' }}
            >
              {hideFullPreferenceError}
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
                      onChange={(event) => setHideOwnPins(event.target.checked)}
                      color="secondary"
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
                    />
                  }
                  label="Hide full events"
                  sx={{ fontFamily: '"Urbanist", sans-serif', color: 'black' }}
                />
              </Stack>
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
                              onShowRemovalStatus={notifyRemovalStatus}
                              onToggleAttendance={handleBookmarkAttendanceToggle}
                              isTogglingAttendance={attendancePendingId === pinId}
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
              <Stack spacing={1.25}>
                {viewHistory.map((entry) => {
                  const pin = entry.pin;
                  const title = pin?.title || 'Unavailable pin';
                  const typeLabel =
                    pin?.type === 'event' ? 'Event' : pin?.type === 'discussion' ? 'Discussion' : 'Pin';
                  const hostName = pin?.creator?.displayName || pin?.creator?.username || 'Unknown host';
                  const hostAvatar = resolveUserAvatarUrl(pin?.creator, DEFAULT_AVATAR_PATH) || DEFAULT_AVATAR_PATH;
                  const isClickable = Boolean(pin);
                  return (
                    <Box
                      key={`${entry.pinId}-${entry.viewedAt}`}
                      onClick={() => (pin ? handleViewPin(entry.pinId, pin) : undefined)}
                      className={`history-card${isClickable ? ' history-card--clickable' : ''}`}
                    >
                      <div className="history-card__row">
                        <Typography variant="subtitle1" className="history-card__title">
                          {title}
                        </Typography>
                        <span className="history-card__badge">{typeLabel}</span>
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
