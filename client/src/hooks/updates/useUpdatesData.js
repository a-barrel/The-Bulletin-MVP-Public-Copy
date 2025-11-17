import { useCallback, useMemo, useRef, useState } from 'react';
import { fetchUpdates, markAllUpdatesRead, markUpdateRead, deleteUpdate } from '../../api/mongoDataApi';
import usePullToRefresh from '../usePullToRefresh';

const noop = () => {};

const deriveUpdateCategory = (update) => {
  const explicit = String(update?.payload?.category || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  const type = String(update?.payload?.type || '').trim().toLowerCase();
  if (!type) {
    return 'other';
  }
  if (type.startsWith('event')) {
    return 'event';
  }
  if (
    type.includes('discussion') ||
    type.includes('pin') ||
    type.includes('reply') ||
    type.includes('chat')
  ) {
    return 'discussion';
  }
  return 'other';
};

export default function useUpdatesData({ profile, unreadCallbacks = {} }) {
  const [updates, setUpdates] = useState([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [updatesError, setUpdatesError] = useState(null);
  const [pendingUpdateIds, setPendingUpdateIds] = useState([]);
  const [deletingUpdateIds, setDeletingUpdateIds] = useState([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const pendingRefreshRef = useRef(false);

  const { setUnreadCount = noop, setUnreadBookmarkCount = noop, setUnreadDiscussionsCount = noop, setUnreadEventsCount = noop } = unreadCallbacks;

  const unreadMetrics = useMemo(() => {
    const metrics = { total: 0, bookmark: 0, discussions: 0, events: 0 };
    updates.forEach((update) => {
      if (update?.readAt) {
        return;
      }
      metrics.total += 1;
      const category = update?.category || deriveUpdateCategory(update);
      const type = String(update?.payload?.type || '').toLowerCase();
      if (type === 'bookmark-update') {
        metrics.bookmark += 1;
      } else if (category === 'event') {
        metrics.events += 1;
      } else if (category === 'discussion') {
        metrics.discussions += 1;
      }
    });
    return metrics;
  }, [updates]);

  const applyUnreadMetrics = useCallback(() => {
    setUnreadCount(unreadMetrics.total);
    setUnreadBookmarkCount(unreadMetrics.bookmark);
    setUnreadDiscussionsCount(unreadMetrics.discussions);
    setUnreadEventsCount(unreadMetrics.events);
  }, [setUnreadBookmarkCount, setUnreadCount, setUnreadDiscussionsCount, setUnreadEventsCount, unreadMetrics]);

  const loadUpdates = useCallback(
    async ({ silent } = {}) => {
      if (!profile?._id) {
        return;
      }
      if (!silent) {
        setIsLoadingUpdates(true);
      }
      setUpdatesError(null);
      pendingRefreshRef.current = true;
      try {
        const result = await fetchUpdates({ userId: profile._id, limit: 100 });
        setUpdates(
          Array.isArray(result)
            ? result.map((item) => ({ ...item, category: deriveUpdateCategory(item) }))
            : []
        );
      } catch (error) {
        setUpdates([]);
        setUpdatesError(error?.message || 'Failed to load updates.');
      } finally {
        pendingRefreshRef.current = false;
        setIsLoadingUpdates(false);
      }
    },
    [profile?._id]
  );

  const { containerRef, pullDistance, isPullRefreshing } = usePullToRefresh(loadUpdates);

  const handleRefresh = useCallback(() => {
    if (!pendingRefreshRef.current) {
      loadUpdates();
    }
  }, [loadUpdates]);

  const handleToggleUnreadOnly = useCallback((event) => {
    setShowUnreadOnly(Boolean(event?.target?.checked));
  }, []);

  const handleMarkRead = useCallback(
    async (updateId) => {
      if (!updateId || pendingUpdateIds.includes(updateId)) {
        return;
      }
      setPendingUpdateIds((prev) => [...prev, updateId]);
      try {
        await markUpdateRead(updateId);
        setUpdates((prev) =>
          prev.map((update) =>
            update._id === updateId
              ? {
                  ...update,
                  readAt: new Date().toISOString()
                }
              : update
          )
        );
      } catch (error) {
        setUpdatesError(error?.message || 'Failed to mark update as read.');
      } finally {
        setPendingUpdateIds((prev) => prev.filter((id) => id !== updateId));
      }
    },
    [pendingUpdateIds]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (isMarkingAllRead || !updates.length) {
      return;
    }
    setIsMarkingAllRead(true);
    try {
      await markAllUpdatesRead();
      setUpdates((prev) => prev.map((update) => ({ ...update, readAt: new Date().toISOString() })));
    } catch (error) {
      setUpdatesError(error?.message || 'Failed to mark updates as read.');
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [isMarkingAllRead, updates.length]);

  const handleDeleteUpdate = useCallback(
    async (updateId) => {
      if (!updateId || deletingUpdateIds.includes(updateId)) {
        return;
      }
      setDeletingUpdateIds((prev) => [...prev, updateId]);
      try {
        await deleteUpdate(updateId);
        setUpdates((prev) => prev.filter((update) => update._id !== updateId));
      } catch (error) {
        setUpdatesError(error?.message || 'Failed to delete update.');
      } finally {
        setDeletingUpdateIds((prev) => prev.filter((id) => id !== updateId));
      }
    },
    [deletingUpdateIds]
  );

  return {
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
  };
}
