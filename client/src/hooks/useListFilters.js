import { useCallback, useMemo, useState } from 'react';
import { FRIEND_ENGAGEMENT_OPTIONS } from '../components/ListFiltersOverlay';

export const DEFAULT_LIST_FILTERS = {
  search: '',
  status: 'active',
  startDate: '',
  endDate: '',
  types: [],
  categories: [],
  friendEngagements: []
};

const FRIEND_ENGAGEMENT_VALUE_SET = new Set(
  FRIEND_ENGAGEMENT_OPTIONS.map((option) => option.value)
);

const sanitizeFriendEngagements = (input) => {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  const ordered = [];
  const seen = new Set();
  input.forEach((value) => {
    if (FRIEND_ENGAGEMENT_VALUE_SET.has(value) && !seen.has(value)) {
      ordered.push(value);
      seen.add(value);
    }
  });
  return ordered;
};

const normalizeForCompare = (value) => ({
  search: value.search?.trim() || '',
  status: value.status || 'active',
  startDate: value.startDate || '',
  endDate: value.endDate || '',
  types: Array.isArray(value.types) ? [...value.types].sort() : [],
  categories: Array.isArray(value.categories) ? [...value.categories].sort() : [],
  friendEngagements: Array.isArray(value.friendEngagements)
    ? [...value.friendEngagements].sort()
    : []
});

export default function useListFilters(initialOverrides = {}) {
  const defaultFilters = useMemo(
    () => ({
      ...DEFAULT_LIST_FILTERS,
      ...initialOverrides
    }),
    [initialOverrides]
  );

  const [filters, setFilters] = useState(() => ({ ...defaultFilters }));

  const hasActiveFilters = useMemo(() => {
    const baseline = normalizeForCompare(defaultFilters);
    const current = normalizeForCompare(filters);
    return (
      current.search !== baseline.search ||
      current.status !== baseline.status ||
      current.startDate !== baseline.startDate ||
      current.endDate !== baseline.endDate ||
      current.types.join('|') !== baseline.types.join('|') ||
      current.categories.join('|') !== baseline.categories.join('|') ||
      current.friendEngagements.join('|') !== baseline.friendEngagements.join('|')
    );
  }, [defaultFilters, filters]);

  const applyFilters = useCallback((nextFilters) => {
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
        : [],
      friendEngagements: sanitizeFriendEngagements(nextFilters.friendEngagements)
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
  }, [defaultFilters]);

  const clearSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      search: ''
    }));
  }, []);

  const removeType = useCallback((typeValue) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.filter((entry) => entry !== typeValue)
    }));
  }, []);

  const removeCategory = useCallback((category) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((entry) => entry !== category)
    }));
  }, []);

  const removeFriendEngagement = useCallback((engagement) => {
    setFilters((prev) => ({
      ...prev,
      friendEngagements: prev.friendEngagements.filter((entry) => entry !== engagement)
    }));
  }, []);

  const resetDates = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      startDate: '',
      endDate: ''
    }));
  }, []);

  return {
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
  };
}
