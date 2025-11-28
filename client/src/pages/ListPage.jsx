/* NOTE: Page exports configuration alongside the component. */
import React, { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import './ListPage.css';
import Navbar from '../components/Navbar';
import PlaceIcon from '@mui/icons-material/Place';
import { FRIEND_ENGAGEMENT_OPTIONS } from '../constants/listFilters';
import Feed from '../components/Feed';
import { useUpdates } from '../contexts/UpdatesContext';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useLocationContext } from '../contexts/LocationContext';
import toIdString from '../utils/ids';
import useNearbyPinsFeed from '../hooks/useNearbyPinsFeed';
import useListFilters from '../hooks/useListFilters';
import usePinCategories from '../hooks/usePinCategories';
import useOfflineNavigation from '../hooks/useOfflineNavigation';
import useViewerProfile from '../hooks/useViewerProfile';
import useHideFullEventsPreference from '../hooks/useHideFullEventsPreference';
import { useTranslation } from 'react-i18next';
import runtimeConfig from '../config/runtime';
import { viewerHasDeveloperAccess } from '../utils/roles';
import { enableListPerfLogs, logListPerf } from '../utils/listPerfLogger';
import { resolvePinFetchLimit } from '../utils/pinDensity';
import ListHeader from '../components/list/ListHeader';
import ListTopbar from '../components/list/ListTopbar';
import ListFilterChips from '../components/list/ListFilterChips';
import ListLocationNotice from '../components/list/ListLocationNotice';
import ListPaginationFooter from '../components/list/ListPaginationFooter';
import useListFeedView from '../hooks/useListFeedView';

export const pageConfig = {
  id: 'list',
  label: 'List',
  icon: PlaceIcon,
  path: '/list',
  order: 4,
  showInNav: true,
  protected: true
};

const LIST_PAGE_SIZE = 10;
const paginationSx = {
  '& .MuiPaginationItem-root': {
    backgroundColor: '#EBE4F8',
    color: '#5D3889',
    fontWeight: 600,
    borderRadius: 999,
    border: '1px solid rgba(93, 56, 137, 0.25)',
    minWidth: 36,
    height: 36
  },
  '& .MuiPaginationItem-root.Mui-selected': {
    backgroundColor: '#5D3889',
    color: '#FFFFFF'
  },
  '& .MuiPaginationItem-root:hover': {
    backgroundColor: '#DCCBF4'
  }
};

const ListFiltersOverlay = lazy(() => import('../components/ListFiltersOverlay'));

function ListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();
  const {
    filters,
    defaultFilters,
    hasActiveFilters,
    setFilters,
    applyFilters,
    clearFilters,
    clearSearch,
    removeType,
    removeCategory,
    removeFriendEngagement,
    resetDates
  } = useListFilters();
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const renderCountRef = useRef(0);
  if (enableListPerfLogs) {
    renderCountRef.current += 1;
  }
  const {
    categories: categoryOptions,
    isLoading: isLoadingCategories,
    error: categoriesError,
    refresh: refreshCategories
  } = usePinCategories({ isOffline });

  const [sortByExpiration, setSortByExpiration] = useState(false);
  const [hideOwnPins, setHideOwnPins] = useState(true);
  const { viewer: viewerProfile } = useViewerProfile({ enabled: !isOffline, skip: isOffline });
  const [locationRequestError, setLocationRequestError] = useState(null);
  const isAdminViewer = useMemo(
    () =>
      viewerHasDeveloperAccess(viewerProfile, {
        offlineOverride: runtimeConfig.isOffline || isOffline
      }),
    [isOffline, viewerProfile]
  );
  const locationRequired = !isAdminViewer && !isOffline;
  const {
    hideFullEvents,
    setHideFullEvents,
    isSavingPreference: isSavingHideFullPreference,
    preferenceError: hideFullPreferenceError,
    clearPreferenceError
  } = useHideFullEventsPreference({
    profileValue: viewerProfile?.preferences?.display?.hideFullEventsByDefault,
    disablePersistence: isOffline
  });
  const {
    feedItems,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation
  } = useNearbyPinsFeed({
    sharedLocation,
    isOffline,
    limit: resolvePinFetchLimit(viewerProfile),
    filters,
    hideFullEvents,
    requireLocation: locationRequired,
    isAdminExempt: isAdminViewer,
    allowPerfLogging: isAdminViewer && !isOffline
  });
  const initialPerfContextRef = useRef(null);
  if (initialPerfContextRef.current === null) {
    initialPerfContextRef.current = {
      hasActiveFilters,
      isUsingFallbackLocation
    };
  }
  const viewerMongoId = useMemo(
    () => toIdString(viewerProfile?._id) ?? toIdString(viewerProfile?.id) ?? null,
    [viewerProfile]
  );

  const {
    filteredAndSortedFeed,
    paginatedFeedItems,
    currentPage,
    totalPages,
    totalResults,
    startItemNumber,
    endItemNumber,
    handlePageChange,
    filtersSignature
  } = useListFeedView({
    feedItems,
    filters,
    hideOwnPins,
    hideFullEvents,
    viewerMongoId,
    sortByExpiration,
    pageSize: LIST_PAGE_SIZE
  });

  const friendEngagementLabels = useMemo(() => {
    const lookup = {};
    FRIEND_ENGAGEMENT_OPTIONS.forEach((value) => {
      lookup[value] = t(`bookmarks.filters.friendOptions.${value}.chip`);
    });
    return lookup;
  }, [t]);

  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { navigateIfOnline } = useOfflineNavigation(isOffline);
  const handleRequestLocation = useCallback(() => {
    if (isAdminViewer || isOffline) {
      return;
    }
    if (!navigator.geolocation) {
      setLocationRequestError(t('location.retryError'));
      return;
    }
    setLocationRequestError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSharedLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'list-location-retry'
        });
      },
      () => {
        setLocationRequestError(t('location.retryError'));
      }
    );
  }, [isAdminViewer, isOffline, setSharedLocation, t]);
  useEffect(() => {
    if (!filtersDialogOpen) {
      return;
    }
    if (categoryOptions.length === 0 && !isLoadingCategories) {
      refreshCategories();
    }
  }, [filtersDialogOpen, categoryOptions.length, isLoadingCategories, refreshCategories]);

  useEffect(() => {
    if (!enableListPerfLogs) {
      return;
    }
    const initialContext = initialPerfContextRef.current || {};
    logListPerf('ListPage mount', {
      hasActiveFilters: initialContext.hasActiveFilters,
      usingFallbackLocation: initialContext.isUsingFallbackLocation
    });
    return () => {
      logListPerf('ListPage unmount', { totalRenders: renderCountRef.current });
    };
  }, []);

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const handleSortToggle = useCallback(() => {
    setSortByExpiration((prev) => !prev);
  }, []);
  const handleNotifications = useCallback(() => {
    navigateIfOnline(routes.updates.base);
  }, [navigateIfOnline]);
  const handleCreatePin = useCallback(() => {
    navigateIfOnline(routes.createPin.base);
  }, [navigateIfOnline]);
  const handleOpenFilters = useCallback(() => {
    setFiltersDialogOpen(true);
  }, []);

  const handleCloseFilters = useCallback(() => {
    setFiltersDialogOpen(false);
  }, []);

  const handleApplyFilters = useCallback(
    (nextFilters) => {
      applyFilters(nextFilters);
      setFiltersDialogOpen(false);
    },
    [applyFilters]
  );

  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  const locationMessage =
    locationRequired && !sharedLocation ? t('location.requiredBody') : locationNotice;

  useEffect(() => {
    if (!enableListPerfLogs) {
      return;
    }
    const filterSummary = {
      search: Boolean(filters.search),
      types: Array.isArray(filters.types) ? filters.types.length : 0,
      categories: Array.isArray(filters.categories) ? filters.categories.length : 0,
      engagements: Array.isArray(filters.friendEngagements) ? filters.friendEngagements.length : 0,
      status: filters.status || null,
      sortByExpiration,
      hideOwnPins,
      hideFullEvents
    };
    logListPerf('ListPage filters updated', {
      renderCount: renderCountRef.current,
      currentPage,
      filterSummary
    });
  }, [
    currentPage,
    filters,
    filtersSignature,
    sortByExpiration,
    hideOwnPins,
    hideFullEvents
  ]);

  useEffect(() => {
    if (!enableListPerfLogs) {
      return;
    }
    logListPerf('ListPage page changed', {
      currentPage,
      totalPages,
      totalResults
    });
  }, [currentPage, totalPages, totalResults]);

  useEffect(() => {
    if (!enableListPerfLogs) {
      return;
    }
    logListPerf('ListPage feed stats', {
      renderCount: renderCountRef.current,
      feedItems: feedItems.length,
      paginatedItems: paginatedFeedItems.length,
      currentPage,
      totalPages,
      totalResults,
      loading,
      error: Boolean(error)
    });
  }, [
    currentPage,
    totalPages,
    totalResults,
    feedItems.length,
    paginatedFeedItems.length,
    loading,
    error
  ]);

  const handleRemoveType = useCallback(
    (typeValue) => {
      removeType(typeValue);
    },
    [removeType]
  );

  const handleRemoveCategory = useCallback(
    (category) => {
      removeCategory(category);
    },
    [removeCategory]
  );

  const handleRemoveFriendEngagement = useCallback(
    (engagement) => {
      removeFriendEngagement(engagement);
    },
    [removeFriendEngagement]
  );

  const handleResetDates = useCallback(() => {
    resetDates();
  }, [resetDates]);

  const handleResetStatus = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      status: defaultFilters.status
    }));
  }, [defaultFilters.status, setFilters]);

  const handleClearAllFilters = useCallback(() => {
    handleClearFilters();
  }, [handleClearFilters]);

  const handleHideFullEventsToggle = useCallback(
    (nextValue) => {
      if (hideFullPreferenceError) {
        clearPreferenceError();
      }
      setHideFullEvents(nextValue);
    },
    [clearPreferenceError, hideFullPreferenceError, setHideFullEvents]
  );

  const handleToggleHideOwnPins = useCallback((nextValue) => {
    setHideOwnPins(nextValue);
  }, []);

  const handleFeedItemSelect = useCallback(
    (pinId, pin) => {
      const normalized = toIdString(pinId);
      if (!normalized) {
        return;
      }
      navigate(routes.pin.byId(normalized), { state: { pin } });
    },
    [navigate]
  );
  const handleFeedAuthorSelect = useCallback(
    (creatorId) => {
      const normalized = toIdString(creatorId);
      if (!normalized) {
        return;
      }
      navigate(routes.profile.byId(normalized));
    },
    [navigate]
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.search?.trim()) {
      chips.push({
        key: 'search',
        label: t('bookmarks.filters.chips.keyword', { keyword: filters.search.trim() }),
        onDelete: handleClearSearch
      });
    }
    const typeLabels = {
      event: t('bookmarks.filters.typeOptions.event'),
      discussion: t('bookmarks.filters.typeOptions.discussion')
    };
    filters.types.forEach((typeValue) => {
      chips.push({
        key: `type-${typeValue}`,
        label: t('bookmarks.filters.chips.type', {
          type: typeLabels[typeValue] || typeValue
        }),
        onDelete: () => handleRemoveType(typeValue)
      });
    });
    filters.categories.forEach((category) => {
      chips.push({
        key: `category-${category}`,
        label: t('bookmarks.filters.chips.category', { category }),
        onDelete: () => handleRemoveCategory(category)
      });
    });
    filters.friendEngagements.forEach((engagement) => {
      const label = friendEngagementLabels[engagement] || t('bookmarks.filters.chips.friend', { engagement });
      chips.push({
        key: `friend-${engagement}`,
        label,
        onDelete: () => handleRemoveFriendEngagement(engagement)
      });
    });
    if (filters.status && filters.status !== defaultFilters.status) {
      chips.push({
        key: `status-${filters.status}`,
        label: t('bookmarks.filters.chips.status', {
          status: t(`bookmarks.filters.statusOptions.${filters.status}`, {
            defaultValue: filters.status
          })
        }),
        onDelete: handleResetStatus
      });
    }
    if (filters.startDate || filters.endDate) {
      let label = t('bookmarks.filters.chips.dateRange');
      if (filters.startDate && filters.endDate) {
        label = t('bookmarks.filters.chips.dateRangeBetween', {
          start: filters.startDate,
          end: filters.endDate
        });
      } else if (filters.startDate) {
        label = t('bookmarks.filters.chips.dateFrom', { start: filters.startDate });
      } else if (filters.endDate) {
        label = t('bookmarks.filters.chips.dateUntil', { end: filters.endDate });
      }
      chips.push({
        key: 'date-range',
        label,
        onDelete: handleResetDates
      });
    }
    if (!hideFullEvents) {
      chips.push({
        key: 'full-events-visible',
        label: t('bookmarks.filters.chips.showingFullEvents'),
        onDelete: () => setHideFullEvents(true)
      });
    }
    if (filters.popularSort === 'replies') {
      chips.push({
        key: 'popular-replies',
        label: t('bookmarks.filters.popularOptions.replies'),
        onDelete: () => applyFilters({ ...filters, popularSort: null })
      });
    } else if (filters.popularSort === 'attending') {
      chips.push({
        key: 'popular-attending',
        label: t('bookmarks.filters.popularOptions.attending'),
        onDelete: () => applyFilters({ ...filters, popularSort: null })
      });
    }
    return chips;
  }, [
    applyFilters,
    filters,
    defaultFilters.status,
    handleClearSearch,
    handleRemoveCategory,
    handleRemoveType,
    handleRemoveFriendEngagement,
    handleResetDates,
    handleResetStatus,
    hideFullEvents,
    setHideFullEvents,
    t,
    friendEngagementLabels
  ]);

  const slimmedFeedItems = useMemo(() => {
    return paginatedFeedItems.map((item) => ({
      id: item?.id,
      _id: item?._id,
      pinId: item?.pinId,
      type: item?.type,
      images: Array.isArray(item?.images) ? item.images : [],
      creatorId: item?.creatorId,
      authorId: item?.authorId,
      creator: item?.creator
        ? {
            _id: item.creator?._id,
            avatar: item.creator?.avatar,
            displayName: item.creator?.displayName,
            username: item.creator?.username
          }
        : undefined,
      viewerOwnsPin: item?.viewerOwnsPin,
      viewerIsAttending: item?.viewerIsAttending,
      viewerHasBookmarked: item?.viewerHasBookmarked,
      isBookmarked: item?.isBookmarked,
      participantCount: item?.participantCount,
      attendeeIds: Array.isArray(item?.attendeeIds) ? item.attendeeIds : [],
      attendeeVersion: item?.attendeeVersion,
      interested: Array.isArray(item?.interested) ? item.interested : [],
      title: item?.title,
      text: item?.text,
      distance: item?.distance,
      timeLabel: item?.timeLabel,
      expiresInHours: item?.expiresInHours,
      comments: item?.comments
    }));
  }, [paginatedFeedItems]);

  const feedCardProps = useMemo(
    () => ({
      lazyLoadAttendees: true
    }),
    []
  );

  return (
    <div className="list-page">
      <div className="list-frame">
        <ListHeader unreadCount={unreadCount} onNotifications={handleNotifications} isOffline={isOffline} />

        <ListTopbar
          hasActiveFilters={hasActiveFilters}
          filtersDialogOpen={filtersDialogOpen}
          onOpenFilters={handleOpenFilters}
          sortByExpiration={sortByExpiration}
          onToggleSort={handleSortToggle}
          hideOwnPins={hideOwnPins}
          onToggleHideOwnPins={handleToggleHideOwnPins}
          hideFullEvents={hideFullEvents}
          onToggleHideFullEvents={handleHideFullEventsToggle}
          isSavingHideFullPreference={isSavingHideFullPreference}
          hideFullPreferenceError={hideFullPreferenceError}
          totalResults={totalResults}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          pageSize={LIST_PAGE_SIZE}
          paginationSx={paginationSx}
          onCreatePin={handleCreatePin}
          isOffline={isOffline}
        />

        {hideFullPreferenceError ? (
          <p className="topbar-pref-error" role="status">
            {hideFullPreferenceError}
          </p>
        ) : null}

        <ListFilterChips chips={activeFilterChips} onClearAll={handleClearAllFilters} />

        {loading && <p>Loading...</p>}
        {locationMessage && !loading ? (
          <ListLocationNotice
            message={locationMessage}
            locationRequired={locationRequired}
            hasLocation={Boolean(sharedLocation)}
            onRequestLocation={handleRequestLocation}
            retryLabel={t('location.retryButton')}
            errorMessage={locationRequestError}
          />
        ) : null}
        {error && <p>Error: {error}</p>}

        {!loading && !error && (
          <>
            <Feed
              items={slimmedFeedItems}
              maxRenderCount={LIST_PAGE_SIZE}
              isUsingFallbackLocation={isUsingFallbackLocation}
              onSelectItem={handleFeedItemSelect}
              onSelectAuthor={handleFeedAuthorSelect}
              cardProps={feedCardProps}
            />
            <ListPaginationFooter
              totalResults={totalResults}
              startItemNumber={startItemNumber}
              endItemNumber={endItemNumber}
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              paginationSx={paginationSx}
              pageSize={LIST_PAGE_SIZE}
            />
          </>
        )}

        <Suspense fallback={null}>
          <ListFiltersOverlay
            open={filtersDialogOpen}
            onClose={handleCloseFilters}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            defaultFilters={defaultFilters}
            initialFilters={filters}
            categories={categoryOptions}
            loadingCategories={isLoadingCategories}
            onRefreshCategories={refreshCategories}
            categoryError={categoriesError}
          />
        </Suspense>

        <Navbar />
      </div>
    </div>
  );
}

export default memo(ListPage);
