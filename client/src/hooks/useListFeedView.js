import { useCallback, useEffect, useMemo, useState } from 'react';
import toIdString from '../utils/ids';

const DEFAULT_PAGE_SIZE = 10;

const buildFiltersSignature = (filters, { sortByExpiration, hideOwnPins, hideFullEvents }) =>
  JSON.stringify({
    filters,
    sortByExpiration,
    hideOwnPins,
    hideFullEvents
  });

const sortByPopularity = (a, b, primaryKey, secondaryKey) => {
  const aPrimary = Number.isFinite(a?.[primaryKey]) ? a[primaryKey] : 0;
  const bPrimary = Number.isFinite(b?.[primaryKey]) ? b[primaryKey] : 0;
  if (bPrimary !== aPrimary) {
    return bPrimary - aPrimary;
  }
  const aSecondary = Number.isFinite(a?.[secondaryKey]) ? a[secondaryKey] : 0;
  const bSecondary = Number.isFinite(b?.[secondaryKey]) ? b[secondaryKey] : 0;
  if (bSecondary !== aSecondary) {
    return bSecondary - aSecondary;
  }
  const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
  const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
  return bUpdated - aUpdated;
};

const sortByDistanceOrExpiration = (a, b, sortByExpiration) => {
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
};

export function useListFeedView({
  feedItems,
  filters,
  hideOwnPins,
  hideFullEvents,
  viewerMongoId,
  sortByExpiration,
  pageSize = DEFAULT_PAGE_SIZE
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const filtersSignature = useMemo(
    () => buildFiltersSignature(filters, { sortByExpiration, hideOwnPins, hideFullEvents }),
    [filters, sortByExpiration, hideFullEvents, hideOwnPins]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filtersSignature]);

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
        return sortByPopularity(a, b, 'comments', 'participantCount');
      }

      if (filters.popularSort === 'attending') {
        return sortByPopularity(a, b, 'participantCount', 'comments');
      }

      return sortByDistanceOrExpiration(a, b, sortByExpiration);
    });

    return sortedItems;
  }, [feedItems, filters.popularSort, filters.status, hideOwnPins, sortByExpiration, viewerMongoId]);

  const totalResults = filteredAndSortedFeed.length;
  const totalPages = totalResults === 0 ? 1 : Math.ceil(totalResults / pageSize);

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
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedFeed.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredAndSortedFeed, pageSize, totalResults]);

  const startItemNumber = totalResults === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItemNumber = totalResults === 0 ? 0 : Math.min(totalResults, currentPage * pageSize);

  const handlePageChange = useCallback((_, page) => {
    setCurrentPage(page);
  }, []);

  return {
    filteredAndSortedFeed,
    paginatedFeedItems,
    currentPage,
    totalPages,
    totalResults,
    startItemNumber,
    endItemNumber,
    handlePageChange,
    filtersSignature
  };
}

export default useListFeedView;
