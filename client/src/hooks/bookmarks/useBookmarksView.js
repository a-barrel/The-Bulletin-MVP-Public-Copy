import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toIdString from '../../utils/ids';

const ITEMS_PER_PAGE = 10;
const UNSORTED_COLLECTION_KEY = '__ungrouped__';
const UNSORTED_LABEL = 'Unsorted';
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

export default function useBookmarksView({
  groupedBookmarks,
  bookmarks,
  viewHistory,
  handleToggleAttendance,
  notifyRemovalStatus,
  formatSavedDate,
  viewerMongoId
}) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [hideOwnPins, setHideOwnPins] = useState(false);
  const [activeTab, setActiveTab] = useState('bookmarks');
  const [currentPage, setCurrentPage] = useState(1);
  const collectionAnchorsRef = useRef(new Map());
  const bookmarkItemCacheRef = useRef(new Map());
  const groupCacheRef = useRef(new Map());

  const matchesSelectedFilter = useCallback(
    (bookmark) => {
      const pin = bookmark.pin;
      if (!pin) {
        return false;
      }
      const pinType = typeof pin.type === 'string' ? pin.type.toLowerCase() : '';

      if (selectedFilter === 'event') {
        return pinType === 'event';
      }
      if (selectedFilter === 'discussion') {
        return pinType === 'discussion';
      }
      if (selectedFilter === 'my-pins') {
        const ownerId =
          toIdString(pin?.creatorId) ?? toIdString(pin?.creator?._id) ?? toIdString(pin?.creator);
        return Boolean(ownerId && viewerMongoId && ownerId === viewerMongoId);
      }
      if (selectedFilter === 'attending') {
        return Boolean(pin.viewerIsAttending);
      }
      return true;
    },
    [selectedFilter, viewerMongoId]
  );

  const filteredGroups = useMemo(() => {
    if (!Array.isArray(groupedBookmarks)) {
      return [];
    }
    return groupedBookmarks
      .map((group) => {
        const shouldHideOwnPins = hideOwnPins;
        const filteredItems = (group.items || []).filter((bookmark) => {
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
  }, [groupedBookmarks, hideOwnPins, matchesSelectedFilter, viewerMongoId]);

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
  const paginatedBookmarks = useMemo(
    () => flattenedBookmarks.slice(startIndex, endIndex),
    [endIndex, flattenedBookmarks, startIndex]
  );

  const filteredGroupsById = useMemo(() => {
    const map = new Map();
    filteredGroups.forEach((group) => {
      const key = group.id ?? UNSORTED_COLLECTION_KEY;
      map.set(key, group);
    });
    return map;
  }, [filteredGroups]);

  const stablePaginatedBookmarks = useMemo(() => {
    const currentCache = bookmarkItemCacheRef.current;
    const nextCache = new Map();
    const list = paginatedBookmarks.map((bookmark) => {
      const pin = bookmark.pin;
      const pinId = bookmark.pinId || pin?._id;
      const cacheKey = bookmark._id || pinId || null;
      const trimmedPin = pin
        ? {
            _id: pin._id,
            title: pin.title,
            type: pin.type,
            description: pin.description,
            creator: pin.creator,
            creatorId: pin.creatorId,
            coverPhoto: pin.coverPhoto,
            mediaAssets: pin.mediaAssets,
            photos: pin.photos,
            images: pin.images,
            viewerIsAttending: pin.viewerIsAttending,
            participantCount: pin.participantCount,
            stats:
              typeof pin?.stats?.participantCount === 'number'
                ? { participantCount: pin.stats.participantCount }
                : pin?.stats
          }
        : null;
      const viewerIsAttending =
        typeof bookmark.viewerIsAttending === 'boolean'
          ? bookmark.viewerIsAttending
          : typeof pin?.viewerIsAttending === 'boolean'
          ? pin.viewerIsAttending
          : undefined;
      const savedAtText = bookmark.savedAtText || formatSavedDate(bookmark.createdAt);
      const payload = {
        _id: bookmark._id,
        pinId,
        pin: trimmedPin,
        createdAt: bookmark.createdAt,
        savedAtText,
        viewerIsAttending,
        collectionId: bookmark.collectionId,
        collectionName: bookmark.collectionName
      };

      if (cacheKey) {
        const prev = currentCache.get(cacheKey);
        if (
          prev &&
          prev.pinId === payload.pinId &&
          prev.createdAt === payload.createdAt &&
          prev.savedAtText === payload.savedAtText &&
          prev.viewerIsAttending === payload.viewerIsAttending &&
          shallowEqualPinPayload(prev.pin, payload.pin) &&
          prev.collectionId === payload.collectionId &&
          prev.collectionName === payload.collectionName
        ) {
          nextCache.set(cacheKey, prev);
          return prev;
        }
        nextCache.set(cacheKey, payload);
      }
      return payload;
    });
    bookmarkItemCacheRef.current = nextCache;
    return list;
  }, [formatSavedDate, paginatedBookmarks]);

  const paginatedGroupedBookmarks = useMemo(() => {
    const grouped = new Map();
    stablePaginatedBookmarks.forEach((bookmark) => {
      const groupKey = bookmark.collectionId ?? UNSORTED_COLLECTION_KEY;
      if (!grouped.has(groupKey)) {
        const originalGroup = filteredGroupsById.get(groupKey);
        grouped.set(groupKey, {
          id: originalGroup?.id,
          name: originalGroup?.name,
          description: originalGroup?.description,
          items: []
        });
      }
      grouped.get(groupKey).items.push(bookmark);
    });
    const nextGroupCache = new Map();
    const result = Array.from(grouped.entries()).map(([groupKey, group]) => {
      const prev = groupCacheRef.current.get(groupKey);
      const prevItems = prev?.items || [];
      const itemsUnchanged =
        prevItems.length === group.items.length && prevItems.every((item, index) => item === group.items[index]);
      if (prev && itemsUnchanged && prev.name === group.name && prev.description === group.description) {
        nextGroupCache.set(groupKey, prev);
        return prev;
      }
      const payload = { ...group, items: group.items };
      nextGroupCache.set(groupKey, payload);
      return payload;
    });
    groupCacheRef.current = nextGroupCache;
    return result;
  }, [filteredGroupsById, stablePaginatedBookmarks]);

  const handlePageChange = useCallback(
    (event, value) => {
      if (value === currentPage) {
        return;
      }
      setCurrentPage(value);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentPage]
  );

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

  const limitedHistory = useMemo(
    () => (viewHistory.length > HISTORY_RENDER_LIMIT ? viewHistory.slice(0, HISTORY_RENDER_LIMIT) : viewHistory),
    [viewHistory]
  );
  const isHistoryTrimmed = viewHistory.length > HISTORY_RENDER_LIMIT;

  const handleFilterChange = useCallback((event) => {
    setSelectedFilter(event.target.value);
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const handleHideOwnPinsToggle = useCallback((event) => {
    setHideOwnPins(Boolean(event.target.checked));
    setCurrentPage(1);
  }, []);

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

  return {
    selectedFilter,
    setSelectedFilter,
    hideOwnPins,
    setHideOwnPins,
    activeTab,
    setActiveTab,
    currentPage,
    setCurrentPage,
    filteredGroups,
    paginatedGroupedBookmarks,
    totalPages,
    filteredGroupsById,
    flattenedBookmarks,
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
  };
}
