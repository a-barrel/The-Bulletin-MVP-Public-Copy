/* NOTE: Page exports configuration alongside the component. */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ListPage.css';
import Navbar from '../components/Navbar';
import SortToggle from '../components/SortToggle';
import ListFiltersOverlay from '../components/ListFiltersOverlay';
import settingsIcon from '../assets/GearIcon.svg';
import addIcon from '../assets/AddIcon.svg';
import updatesIcon from '../assets/UpdateIcon.svg';
import Feed from '../components/Feed';
import GlobalNavMenu from '../components/GlobalNavMenu';
import Chip from '@mui/material/Chip';
import PlaceIcon from '@mui/icons-material/Place';
import { useUpdates } from '../contexts/UpdatesContext';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useLocationContext } from '../contexts/LocationContext';
import toIdString from '../utils/ids';
import useNearbyPinsFeed from '../hooks/useNearbyPinsFeed';
import { fetchPinCategories } from '../api/mongoDataApi';

export const pageConfig = {
  id: 'list',
  label: 'List',
  icon: PlaceIcon,
  path: '/list',
  order: 4,
  showInNav: true,
  protected: true,
};

export default function ListPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: sharedLocation } = useLocationContext();

  const defaultFilters = useMemo(
    () => ({
      search: '',
      status: 'active',
      startDate: '',
      endDate: '',
      types: [],
      categories: []
    }),
    []
  );
  const [filters, setFilters] = useState(() => ({ ...defaultFilters }));
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  const [sortByExpiration, setSortByExpiration] = useState(false);
  const {
    feedItems,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation
  } = useNearbyPinsFeed({ sharedLocation, isOffline, filters });

  const { unreadCount, refreshUnreadCount } = useUpdates();

  const refreshCategories = useCallback(async () => {
    if (isOffline) {
      setCategoriesError('Reconnect to refresh categories.');
      return;
    }
    setIsLoadingCategories(true);
    setCategoriesError(null);
    try {
      const result = await fetchPinCategories();
      setCategoryOptions(Array.isArray(result) ? result : []);
    } catch (err) {
      setCategoriesError(err?.message || 'Failed to load categories.');
    } finally {
      setIsLoadingCategories(false);
    }
  }, [isOffline]);

  useEffect(() => {
    if (!filtersDialogOpen) {
      return;
    }
    if (categoryOptions.length === 0 && !isLoadingCategories) {
      refreshCategories();
    }
  }, [filtersDialogOpen, categoryOptions.length, isLoadingCategories, refreshCategories]);

  const normalizeForCompare = useCallback((value) => ({
    search: value.search?.trim() || '',
    status: value.status || 'active',
    startDate: value.startDate || '',
    endDate: value.endDate || '',
    types: Array.isArray(value.types) ? [...value.types].sort() : [],
    categories: Array.isArray(value.categories) ? [...value.categories].sort() : []
  }), []);

  const hasActiveFilters = useMemo(() => {
    const baseline = normalizeForCompare(defaultFilters);
    const current = normalizeForCompare(filters);
    return (
      current.search !== baseline.search ||
      current.status !== baseline.status ||
      current.startDate !== baseline.startDate ||
      current.endDate !== baseline.endDate ||
      current.types.join('|') !== baseline.types.join('|') ||
      current.categories.join('|') !== baseline.categories.join('|')
    );
  }, [defaultFilters, filters, normalizeForCompare]);

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const handleSortToggle = useCallback(() => {
    setSortByExpiration((prev) => !prev);
  }, []);
  const handleNotifications = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.updates.base);
  }, [isOffline, navigate]);
  const handleCreatePin = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.createPin.base);
  }, [isOffline, navigate]);
  const handleOpenFilters = useCallback(() => {
    setFiltersDialogOpen(true);
  }, []);

  const handleCloseFilters = useCallback(() => {
    setFiltersDialogOpen(false);
  }, []);

  const handleApplyFilters = useCallback((nextFilters) => {
    setFilters({
      search: nextFilters.search?.trim() || '',
      status: nextFilters.status || 'active',
      startDate: nextFilters.startDate || '',
      endDate: nextFilters.endDate || '',
      types: Array.isArray(nextFilters.types)
        ? Array.from(new Set(nextFilters.types))
        : [],
      categories: Array.isArray(nextFilters.categories)
        ? Array.from(
            new Set(
              nextFilters.categories
                .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
                .filter(Boolean)
            )
          )
        : []
    });
    setFiltersDialogOpen(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: defaultFilters.status,
      startDate: '',
      endDate: '',
      types: [],
      categories: []
    });
  }, [defaultFilters.status]);

  const handleClearSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      search: ''
    }));
  }, []);

  const handleRemoveType = useCallback((typeValue) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.filter((entry) => entry !== typeValue)
    }));
  }, []);

  const handleRemoveCategory = useCallback((category) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((entry) => entry !== category)
    }));
  }, []);

  const handleResetDates = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      startDate: '',
      endDate: ''
    }));
  }, []);

  const handleResetStatus = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      status: defaultFilters.status
    }));
  }, [defaultFilters.status]);

  const handleClearAllFilters = useCallback(() => {
    handleClearFilters();
  }, [handleClearFilters]);
  const handleFeedItemSelect = useCallback(
    (pinId) => {
      const normalized = toIdString(pinId);
      if (!normalized) {
        return;
      }
      navigate(routes.pin.byId(normalized));
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
    return chips;
  }, [filters, defaultFilters.status, handleClearSearch, handleRemoveCategory, handleRemoveType, handleResetDates, handleResetStatus]);

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

    const sortedItems = [...statusFiltered].sort((a, b) => {
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
  }, [feedItems, filters.status, sortByExpiration]);

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
          <Feed
            items={filteredAndSortedFeed}
            isUsingFallbackLocation={isUsingFallbackLocation}
            onSelectItem={handleFeedItemSelect}
            onSelectAuthor={handleFeedAuthorSelect}
          />
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
