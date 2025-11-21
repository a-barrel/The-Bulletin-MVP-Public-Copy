/* NOTE: Page exports configuration alongside the component. */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ListPage.css';
import Navbar from '../components/Navbar';
import SortToggle from '../components/SortToggle';
import ListFiltersOverlay, { FRIEND_ENGAGEMENT_OPTIONS } from '../components/ListFiltersOverlay';
import settingsIcon from '../assets/GearIcon.svg';
import addIcon from '../assets/AddIcon.svg';
import updatesIcon from '../assets/UpdateIcon.svg';
import Feed from '../components/Feed';
import GlobalNavMenu from '../components/GlobalNavMenu';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Pagination from '@mui/material/Pagination';
import PlaceIcon from '@mui/icons-material/Place';
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

export const pageConfig = {
  id: 'list',
  label: 'List',
  icon: PlaceIcon,
  path: '/list',
  order: 4,
  showInNav: true,
  protected: true,
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

const FRIEND_ENGAGEMENT_LABEL_LOOKUP = FRIEND_ENGAGEMENT_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.chipLabel || option.label;
  return acc;
}, {});

export default function ListPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: sharedLocation } = useLocationContext();
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
  const {
    categories: categoryOptions,
    isLoading: isLoadingCategories,
    error: categoriesError,
    refresh: refreshCategories
  } = usePinCategories({ isOffline });

  const [sortByExpiration, setSortByExpiration] = useState(false);
  const [hideOwnPins, setHideOwnPins] = useState(true);
  const { viewer: viewerProfile } = useViewerProfile({ enabled: !isOffline, skip: isOffline });
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
  } = useNearbyPinsFeed({ sharedLocation, isOffline, filters, hideFullEvents });
  const viewerMongoId = useMemo(
    () => toIdString(viewerProfile?._id) ?? toIdString(viewerProfile?.id) ?? null,
    [viewerProfile]
  );
  const [currentPage, setCurrentPage] = useState(1);

  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { navigateIfOnline } = useOfflineNavigation(isOffline);
  useEffect(() => {
    if (!filtersDialogOpen) {
      return;
    }
    if (categoryOptions.length === 0 && !isLoadingCategories) {
      refreshCategories();
    }
  }, [filtersDialogOpen, categoryOptions.length, isLoadingCategories, refreshCategories]);

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
      setCurrentPage(1);
    },
    [applyFilters]
  );

  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  const filtersSignature = useMemo(() => {
    return JSON.stringify({
      search: filters.search ?? '',
      status: filters.status ?? '',
      types: Array.isArray(filters.types) ? [...filters.types].sort() : [],
      categories: Array.isArray(filters.categories) ? [...filters.categories].sort() : [],
      friendEngagements: Array.isArray(filters.friendEngagements)
        ? [...filters.friendEngagements].sort()
        : [],
      startDate: filters.startDate ?? '',
      endDate: filters.endDate ?? '',
      popularSort: filters.popularSort ?? null
    });
  }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtersSignature, sortByExpiration, hideOwnPins, hideFullEvents]);

  const handleRemoveType = useCallback((typeValue) => {
    removeType(typeValue);
  }, [removeType]);

  const handleRemoveCategory = useCallback((category) => {
    removeCategory(category);
  }, [removeCategory]);

  const handleRemoveFriendEngagement = useCallback((engagement) => {
    removeFriendEngagement(engagement);
  }, [removeFriendEngagement]);

  const handleResetDates = useCallback(() => {
    resetDates();
  }, [resetDates]);

  const handleResetStatus = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      status: defaultFilters.status
    }));
  }, [defaultFilters.status]);

  const handleClearAllFilters = useCallback(() => {
    handleClearFilters();
  }, [handleClearFilters]);

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
        label: `Keyword: "${filters.search.trim()}"`,
        onDelete: handleClearSearch
      });
    }
    filters.types.forEach((typeValue) => {
      chips.push({
        key: `type-${typeValue}`,
        label: `Type: ${typeValue}`,
        onDelete: () => handleRemoveType(typeValue)
      });
    });
    filters.categories.forEach((category) => {
      chips.push({
        key: `category-${category}`,
        label: `Category: ${category}`,
        onDelete: () => handleRemoveCategory(category)
      });
    });
    filters.friendEngagements.forEach((engagement) => {
      const label =
        FRIEND_ENGAGEMENT_LABEL_LOOKUP[engagement] || `Friends: ${engagement}`;
      chips.push({
        key: `friend-${engagement}`,
        label,
        onDelete: () => handleRemoveFriendEngagement(engagement)
      });
    });
    if (filters.status && filters.status !== defaultFilters.status) {
      chips.push({
        key: `status-${filters.status}`,
        label: `Status: ${filters.status}`,
        onDelete: handleResetStatus
      });
    }
    if (filters.startDate || filters.endDate) {
      let label = 'Date range';
      if (filters.startDate && filters.endDate) {
        label = `Date: ${filters.startDate} → ${filters.endDate}`;
      } else if (filters.startDate) {
        label = `From ${filters.startDate}`;
      } else if (filters.endDate) {
        label = `Until ${filters.endDate}`;
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
        label: 'Showing full events',
        onDelete: () => setHideFullEvents(true)
      });
    }
    if (filters.popularSort === 'replies') {
      chips.push({
        key: 'popular-replies',
        label: 'Most replies',
        onDelete: () => applyFilters({ ...filters, popularSort: null })
      });
    } else if (filters.popularSort === 'attending') {
      chips.push({
        key: 'popular-attending',
        label: 'Most attending',
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
    setHideFullEvents
  ]);

  const filteredAndSortedFeed = useMemo(() => {
    const statusFiltered = feedItems.filter((item) => {
      const hours = Number.isFinite(item.expiresInHours) ? item.expiresInHours : null;
      if (filters.status === 'expired') {
        if (hours === null) {
          return false;
        }
        return hours <= 0;
      }
      if (filters.status === 'all') {
        return true;
      }
      if (hours === null) {
        return true;
      }
      return hours > 0;
    });

    const ownerFiltered =
      hideOwnPins
        ? statusFiltered.filter((item) => {
            if (item?.viewerOwnsPin) {
              return false;
            }
            const ownerId =
              toIdString(item?.creatorId) ??
              toIdString(item?.creator?._id) ??
              toIdString(item?.creator?._id?.$oid) ??
              null;
            if (viewerMongoId && ownerId && ownerId === viewerMongoId) {
              return false;
            }
            return true;
          })
        : statusFiltered;

    const sortedItems = [...ownerFiltered].sort((a, b) => {
      if (filters.popularSort === 'replies') {
        const aReplies = Number.isFinite(a?.comments) ? a.comments : 0;
        const bReplies = Number.isFinite(b?.comments) ? b.comments : 0;
        if (bReplies !== aReplies) {
          return bReplies - aReplies;
        }
        const aAttending = Number.isFinite(a?.participantCount) ? a.participantCount : 0;
        const bAttending = Number.isFinite(b?.participantCount) ? b.participantCount : 0;
        if (bAttending !== aAttending) {
          return bAttending - aAttending;
        }
        const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bUpdated - aUpdated;
      }

      if (filters.popularSort === 'attending') {
        const aAttending = Number.isFinite(a?.participantCount) ? a.participantCount : 0;
        const bAttending = Number.isFinite(b?.participantCount) ? b.participantCount : 0;
        if (bAttending !== aAttending) {
          return bAttending - aAttending;
        }
        const aReplies = Number.isFinite(a?.comments) ? a.comments : 0;
        const bReplies = Number.isFinite(b?.comments) ? b.comments : 0;
        if (bReplies !== aReplies) {
          return bReplies - aReplies;
        }
        const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bUpdated - aUpdated;
      }

      if (sortByExpiration) {
        const hoursA = Number.isFinite(a.expiresInHours) ? a.expiresInHours : Number.POSITIVE_INFINITY;
        const hoursB = Number.isFinite(b.expiresInHours) ? b.expiresInHours : Number.POSITIVE_INFINITY;
        if (hoursA !== hoursB) {
          return hoursA - hoursB;
        }
      } else {
        const distanceA = Number.isFinite(a.distanceMiles) ? a.distanceMiles : Number.POSITIVE_INFINITY;
        const distanceB = Number.isFinite(b.distanceMiles) ? b.distanceMiles : Number.POSITIVE_INFINITY;
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
      }

      const textA = a.text || '';
      const textB = b.text || '';
      return textA.localeCompare(textB);
    });

    return sortedItems;
  }, [feedItems, filters.popularSort, filters.status, hideOwnPins, sortByExpiration, viewerMongoId]);

  const totalResults = filteredAndSortedFeed.length;
  const totalPages = totalResults === 0 ? 1 : Math.ceil(totalResults / LIST_PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((previous) => {
      if (previous <= 1) {
        return totalResults === 0 ? 1 : previous;
      }
      return previous > totalPages ? totalPages : previous;
    });
  }, [totalPages, totalResults]);

  const paginatedFeedItems = useMemo(() => {
    if (totalResults === 0) {
      return [];
    }
    const startIndex = (currentPage - 1) * LIST_PAGE_SIZE;
    return filteredAndSortedFeed.slice(startIndex, startIndex + LIST_PAGE_SIZE);
  }, [currentPage, filteredAndSortedFeed, totalResults]);

  const startItemNumber =
    totalResults === 0 ? 0 : (currentPage - 1) * LIST_PAGE_SIZE + 1;
  const endItemNumber =
    totalResults === 0 ? 0 : Math.min(totalResults, currentPage * LIST_PAGE_SIZE);

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* Header */}
        <header className="header-bar">
          <GlobalNavMenu />
          <h1 className="header-title">List</h1>
          <button
            className="header-icon-btn"
            type="button"
            aria-label={notificationsLabel}
            onClick={handleNotifications}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to view updates' : undefined}
          >
            <img src={updatesIcon} alt="" className="header-icon" aria-hidden="true" />
            {displayBadge ? (
              <span className="header-icon-badge" aria-hidden="true">
                {displayBadge}
              </span>
            ) : null}
          </button>
        </header>

        {/* Topbar */}
        <div className="topbar">
          <div className="top-left">
            <button
              className={`icon-btn ${hasActiveFilters ? 'active' : ''} ${filtersDialogOpen ? 'open' : ''}`.trim()}
              type="button"
              aria-label="Filter pins"
              aria-pressed={filtersDialogOpen}
              onClick={handleOpenFilters}
              title={hasActiveFilters ? 'Filters applied. Click to adjust filters.' : 'Filter pins'}
            >
              <img src={settingsIcon} alt="Filters" />
            </button>

            {/* Sort Toggle */}
            <SortToggle sortByExpiration={sortByExpiration} onToggle={handleSortToggle} />

            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  color="secondary"
                  checked={hideOwnPins}
                  onChange={(event) => setHideOwnPins(event.target.checked)}
                  sx={{
                    color: '#666',
                    '& .MuiSvgIcon-root': {
                      stroke: '#666',
                      strokeWidth: 1.4,
                      borderRadius: '4px'
                    },
                    '&.Mui-checked': {
                      color: '#5d3889'
                    }
                  }}
                />
              }
              label="Hide my pins"
              className="topbar-hide-own"
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  color="secondary"
                  checked={hideFullEvents}
                  onChange={handleHideFullEventsToggle}
                  disabled={isSavingHideFullPreference}
                  sx={{
                    color: '#666',
                    '& .MuiSvgIcon-root': {
                      stroke: '#666',
                      strokeWidth: 1.4,
                      borderRadius: '4px'
                    },
                    '&.Mui-checked': {
                      color: '#5d3889'
                    }
                  }}
                />
              }
              label="Hide full events"
              className="topbar-hide-own"
              title={hideFullPreferenceError || undefined}
            />
            {totalResults > LIST_PAGE_SIZE ? (
              <div className="top-pagination">
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  size="small"
                  shape="rounded"
                  onChange={(_, page) => setCurrentPage(page)}
                  sx={paginationSx}
                />
              </div>
            ) : null}
          </div>

          <button
            className="add-btn"
            type="button"
            aria-label="Create pin"
            onClick={handleCreatePin}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to create a pin' : undefined}
          >
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {hideFullPreferenceError ? (
          <p className="topbar-pref-error" role="status">
            {hideFullPreferenceError}
          </p>
        ) : null}

        {activeFilterChips.length > 0 ? (
          <div className="filter-chip-row">
            {activeFilterChips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                size="small"
                color="primary"
                variant="outlined"
                onDelete={chip.onDelete}
              />
            ))}
            <button type="button" className="clear-filters-link" onClick={handleClearAllFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        {loading && <p>Loading...</p>}
        {locationNotice && !loading && <p>{locationNotice}</p>}
        {error && <p>Error: {error}</p>}

        {!loading && !error && (
          <>
            <Feed
              items={paginatedFeedItems}
              isUsingFallbackLocation={isUsingFallbackLocation}
              onSelectItem={handleFeedItemSelect}
              onSelectAuthor={handleFeedAuthorSelect}
            />
            {totalResults > 0 ? (
              <div className="list-pagination">
                <span className="list-pagination__summary">
                  Showing {startItemNumber}–{endItemNumber} of {totalResults} pins
                </span>
                {totalResults > LIST_PAGE_SIZE ? (
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    color="primary"
                    shape="rounded"
                    onChange={(_, page) => setCurrentPage(page)}
                    sx={paginationSx}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}

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

        <Navbar />
      </div>
    </div>
  );
}
