import { useCallback, useEffect, useMemo } from 'react';
import { useUpdates } from '../contexts/UpdatesContext';
import useUpdatesProfile from './updates/useUpdatesProfile';
import useUpdatesData from './updates/useUpdatesData';

const noop = () => {};

export default function useUpdatesFeed() {
  const {
    setUnreadCount = noop,
    setUnreadBookmarkCount = noop,
    setUnreadDiscussionsCount = noop,
    setUnreadEventsCount = noop
  } = useUpdates();

  const { profile, profileError, isProfileLoading } = useUpdatesProfile();

  const {
    updates,
    isLoadingUpdates,
    updatesError,
    showUnreadOnly,
    handleToggleUnreadOnly,
    handleRefresh,
    loadUpdates,
    containerRef,
    pullDistance,
    isPullRefreshing,
    pendingUpdateIds,
    deletingUpdateIds,
    handleMarkRead,
    handleMarkAllRead,
    handleDeleteUpdate,
    isMarkingAllRead,
    unreadMetrics,
    applyUnreadMetrics
  } = useUpdatesData({
    profile,
    unreadCallbacks: {
      setUnreadCount,
      setUnreadBookmarkCount,
      setUnreadDiscussionsCount,
      setUnreadEventsCount
    }
  });

  useEffect(() => {
    applyUnreadMetrics();
  }, [applyUnreadMetrics, unreadMetrics]);

  useEffect(() => {
    if (profile?._id) {
      loadUpdates({ silent: true });
    }
  }, [profile?._id, loadUpdates]);

  const handleManualRefresh = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  const filteredUpdates = useMemo(() => {
    if (!Array.isArray(updates)) {
      return [];
    }
    if (!showUnreadOnly) {
      return updates;
    }
    return updates.filter((update) => !update?.readAt);
  }, [showUnreadOnly, updates]);

  return {
    profile,
    profileError,
    isProfileLoading,
    updates,
    filteredUpdates,
    isLoadingUpdates,
    updatesError,
    pendingUpdateIds,
    deletingUpdateIds,
    isMarkingAllRead,
    showUnreadOnly,
    handleToggleUnreadOnly,
    handleMarkRead,
    handleMarkAllRead,
    handleDeleteUpdate,
    handleRefresh: handleManualRefresh,
    containerRef,
    pullDistance,
    isPullRefreshing
  };
}
