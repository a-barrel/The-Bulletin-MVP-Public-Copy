import { useCallback, useMemo, useRef, useState } from 'react';
import { fetchUpdates, markAllUpdatesRead, markUpdateRead, deleteUpdate } from '../../api';
import usePullToRefresh from '../usePullToRefresh';
import { useUpdatesCache } from '../../contexts/UpdatesCacheContext';

const noop = () => {};

const deriveUpdateCategory = (update) => {
  const explicit = String(update?.payload?.category || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  const type = String(update?.payload?.type || '').trim().toLowerCase();
  if (type === 'bookmark-update') {
    return 'bookmark';
  }
  if (type.includes('badge')) {
    return 'badge';
  }
  if (type.includes('expiring') || type.includes('starting')) {
    return 'time';
  }
  const pinType = String(
    update?.payload?.pin?.type || update?.pin?.type || ''
  )
    .trim()
    .toLowerCase();
  if (pinType === 'event') {
    return 'event';
  }
  if (pinType === 'discussion') {
    return 'discussion';
  }
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
  const updatesCache = useUpdatesCache();
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
    const metrics = { total: 0, bookmark: 0, discussions: 0, events: 0, badges: 0, time: 0 };
    updates.forEach((update) => {
      if (update?.readAt) {
        return;
      }
      metrics.total += 1;
      const category =
        update?.derivedCategory || update?.category || deriveUpdateCategory(update) || 'other';
      if (category === 'bookmark') {
        metrics.bookmark += 1;
      } else if (category === 'badge') {
        metrics.badges += 1;
      } else if (category === 'time') {
        metrics.time += 1;
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
      if (pendingRefreshRef.current) {
        return;
      }
      pendingRefreshRef.current = true;
      if (!silent) {
        setIsLoadingUpdates(true);
      }
      setUpdatesError(null);
      try {
        const cached = updatesCache.get(profile._id);
        const normalizedCached = Array.isArray(cached)
          ? cached.map((item) => {
              const derived = deriveUpdateCategory(item);
              const category = derived === 'bookmark' ? 'other' : derived;
              return { ...item, category, derivedCategory: derived };
            })
          : null;
        if (normalizedCached) {
          setUpdates(normalizedCached);
          if (!silent) {
            setIsLoadingUpdates(false);
          }
          pendingRefreshRef.current = false;
          return;
        }

        const result = await fetchUpdates({ userId: profile._id, limit: 100 });
        const normalized = Array.isArray(result)
          ? result.map((item) => {
              const derived = deriveUpdateCategory(item);
              const category = derived === 'bookmark' ? 'other' : derived;
              return { ...item, category, derivedCategory: derived };
            })
          : [];
        setUpdates(normalized);
        updatesCache.set(profile._id, normalized);
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
      setUpdates((prev) => {
        const next = prev.map((update) =>
          update._id === updateId
            ? {
                ...update,
                readAt: new Date().toISOString()
              }
            : update
        );
        if (profile?._id) {
          updatesCache.set(profile._id, next);
        }
        return next;
      });
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
      setUpdates((prev) => {
        const next = prev.map((update) => ({ ...update, readAt: new Date().toISOString() }));
        if (profile?._id) {
          updatesCache.set(profile._id, next);
        }
        return next;
      });
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
        setUpdates((prev) => {
          const next = prev.filter((update) => update._id !== updateId);
          if (profile?._id) {
            updatesCache.set(profile._id, next);
          }
          return next;
        });
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
