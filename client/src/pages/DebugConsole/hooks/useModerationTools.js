import { useCallback, useEffect, useMemo, useState } from 'react';

import useModerationCore from '../../../hooks/useModerationTools';
import { fetchUsers } from '../../../api';
import { parseOptionalNumber } from '../utils';
import { useUserCache } from '../../../contexts/UserCacheContext';

const DEFAULT_ACTION = {
  userId: '',
  type: 'warn',
  reason: '',
  durationMinutes: '5'
};

const useModerationTools = () => {
  const userCache = useUserCache();
  const {
    overview,
    overviewStatus,
    isLoadingOverview,
    history,
    historyStatus,
    isLoadingHistory,
    selectedUserId,
    selectUser,
    loadOverview,
    loadHistory,
    recordAction,
    isSubmitting,
    actionStatus,
    resetActionStatus,
    setActionStatus
  } = useModerationCore();

  const [actionForm, setActionForm] = useState(DEFAULT_ACTION);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState(null);

  useEffect(() => {
    if (!selectedUserId && overview?.flaggedUsers?.length) {
      const initial = overview.flaggedUsers[0]?.user?.id ?? '';
      if (initial) {
        selectUser(initial);
        setActionForm((prev) => ({ ...prev, userId: initial }));
      }
    }
  }, [overview, selectedUserId, selectUser]);

  const handleSelectUser = useCallback(
    (userId) => {
      selectUser(userId);
      setActionForm((prev) => ({ ...prev, userId }));
    },
    [selectUser]
  );

  const updateActionField = useCallback((field, value) => {
    setActionForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const submitAction = useCallback(
    async (overrides = {}) => {
      const payload = {
        ...actionForm,
        ...overrides
      };

      const userId = payload.userId || selectedUserId;
      if (!userId) {
        setActionStatus({
          type: 'error',
          message: 'Select a user before performing an action.'
        });
        return;
      }

      try {
        const durationMinutes = parseOptionalNumber(payload.durationMinutes);
        await recordAction({
          userId,
          type: payload.type,
          reason: payload.reason?.trim() || '',
          durationMinutes: durationMinutes || undefined
        });

        setActionForm((prev) => ({
          ...prev,
          userId,
          reason: '',
          durationMinutes: prev.durationMinutes
        }));
      } catch (error) {
        setActionStatus({
          type: 'error',
          message: error?.message || 'Failed to record moderation action.'
        });
        throw error;
      }
    },
    [actionForm, selectedUserId, recordAction, setActionStatus]
  );

  const runSearch = useCallback(
    async (term = searchTerm) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchStatus(null);
        return;
      }

      setIsSearching(true);
      setSearchStatus(null);
      try {
        const results = await fetchUsers({ search: trimmed, limit: 10 });
        const normalized = Array.isArray(results) ? results : [];
        setSearchResults(normalized);
        userCache.setUsers(normalized);
      } catch (error) {
        setSearchStatus({
          type: 'error',
          message: error?.message || 'Failed to search users.'
        });
      } finally {
        setIsSearching(false);
      }
    },
    [searchTerm]
  );

  const flaggedUsers = useMemo(() => overview?.flaggedUsers || [], [overview]);

  return {
    overview,
    isLoadingOverview,
    overviewStatus,
    refreshOverview: loadOverview,
    flaggedUsers,
    selectedUserId,
    handleSelectUser,
    history,
    historyStatus,
    isLoadingHistory,
    refreshHistory: loadHistory,
    actionForm,
    updateActionField,
    submitAction,
    isSubmitting,
    actionStatus,
    searchTerm,
    setSearchTerm,
    searchResults,
    runSearch,
    isSearching,
    searchStatus,
    resetActionStatus
  };
};

export default useModerationTools;
