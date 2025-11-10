import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

import {
  fetchCurrentUserProfile,
  fetchUpdates,
  markAllUpdatesRead,
  markUpdateRead,
  deleteUpdate
} from '../api/mongoDataApi';
import { auth } from '../firebase';
import { useUpdates } from '../contexts/UpdatesContext';
import usePullToRefresh from './usePullToRefresh';

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

export default function useUpdatesFeed() {
  const [firebaseUser, firebaseLoading] = useAuthState(auth);

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [updates, setUpdates] = useState([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [updatesError, setUpdatesError] = useState(null);

  const [pendingUpdateIds, setPendingUpdateIds] = useState([]);
  const [deletingUpdateIds, setDeletingUpdateIds] = useState([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const pendingRefreshRef = useRef(false);

  const {
    setUnreadCount = noop,
    setUnreadBookmarkCount = noop,
    setUnreadDiscussionsCount = noop,
    setUnreadEventsCount = noop
  } = useUpdates();

  const unreadMetrics = useMemo(() => {
    const metrics = {
      total: 0,
      bookmark: 0,
      discussions: 0,
      events: 0
    };

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

  const unreadCount = unreadMetrics.total;

  useEffect(() => {
    setUnreadCount(unreadMetrics.total);
    setUnreadBookmarkCount(unreadMetrics.bookmark);
    setUnreadDiscussionsCount(unreadMetrics.discussions);
    setUnreadEventsCount(unreadMetrics.events);
  }, [
    setUnreadBookmarkCount,
    setUnreadCount,
    setUnreadDiscussionsCount,
    setUnreadEventsCount,
    unreadMetrics
  ]);

  useEffect(() => {
    if (firebaseLoading) {
      return;
    }

    if (!firebaseUser) {
      setProfile(null);
      setProfileError('Sign in to view your updates.');
      setIsProfileLoading(false);
      return;
    }

    let isCancelled = false;
    async function loadProfile() {
      setIsProfileLoading(true);
      setProfileError(null);
      try {
        const result = await fetchCurrentUserProfile();
        if (!isCancelled) {
          setProfile(result);
        }
      } catch (error) {
        if (!isCancelled) {
          setProfile(null);
          setProfileError(error?.message || 'Failed to load profile information.');
        }
      } finally {
        if (!isCancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, [firebaseLoading, firebaseUser]);

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
            ? result.map((item) => ({
                ...item,
                category: deriveUpdateCategory(item)
              }))
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

  useEffect(() => {
    if (profile?._id) {
      loadUpdates({ silent: true });
    }
  }, [profile?._id, loadUpdates]);

  const handleRefresh = useCallback(() => {
    if (!pendingRefreshRef.current) {
      loadUpdates();
    }
  }, [loadUpdates]);

  const handleToggleUnreadOnly = useCallback((event) => {
    setShowUnreadOnly(Boolean(event?.target?.checked));
  }, []);

  const handleMarkRead = useCallback(async (updateId) => {
    if (!updateId) {
      return;
    }
    setPendingUpdateIds((prev) => (prev.includes(updateId) ? prev : [...prev, updateId]));
    try {
      const updated = await markUpdateRead(updateId);
      setUpdates((prev) =>
        prev.map((item) =>
          item._id === updated._id
            ? {
                ...item,
                readAt: updated.readAt,
                readBy: updated.readBy,
                category: item.category ?? deriveUpdateCategory(updated)
              }
            : item
        )
      );
    } catch (error) {
      setUpdatesError(error?.message || 'Failed to mark update as read.');
    } finally {
      setPendingUpdateIds((prev) => prev.filter((id) => id !== updateId));
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!profile?._id || isMarkingAllRead) {
      return;
    }
    setIsMarkingAllRead(true);
    try {
      await markAllUpdatesRead(profile._id);
      setUpdates((prev) =>
        prev.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString()
        }))
      );
    } catch (error) {
      setUpdatesError(error?.message || 'Failed to mark updates as read.');
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [isMarkingAllRead, profile?._id]);

  const handleDismissUpdatesError = useCallback(() => {
    setUpdatesError(null);
  }, []);

  const handleDeleteUpdate = useCallback(async (updateId) => {
    if (!updateId) {
      return;
    }
    setDeletingUpdateIds((prev) => (prev.includes(updateId) ? prev : [...prev, updateId]));
    try {
      await deleteUpdate(updateId);
      setUpdates((prev) => prev.filter((item) => item._id !== updateId));
    } catch (error) {
      setUpdatesError(error?.message || 'Failed to delete update.');
    } finally {
      setDeletingUpdateIds((prev) => prev.filter((id) => id !== updateId));
      setPendingUpdateIds((prev) => prev.filter((id) => id !== updateId));
    }
  }, []);

  const handleClearAllUpdates = useCallback(async () => {
    const ids = updates.map((update) => update?._id).filter(Boolean);
    if (!ids.length) {
      return;
    }
    setDeletingUpdateIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
    const deletedIds = [];
    try {
      for (const id of ids) {
        await deleteUpdate(id);
        deletedIds.push(id);
      }
    } catch (error) {
      setUpdatesError(error?.message || 'Failed to clear updates.');
    } finally {
      if (deletedIds.length) {
        setUpdates((prev) => prev.filter((item) => !deletedIds.includes(item._id)));
      }
      setDeletingUpdateIds((prev) => prev.filter((id) => !ids.includes(id)));
      setPendingUpdateIds((prev) => prev.filter((id) => !ids.includes(id)));
    }
  }, [updates]);

  const filteredUpdates = useMemo(() => {
    // TODO: reintroduce unread-only filtering once ui exposes that toggle again.
    return updates;
  }, [updates]);

  return {
    firebaseLoading,
    firebaseUser,
    profile,
    profileError,
    isProfileLoading,
    updates,
    filteredUpdates,
    isLoadingUpdates,
    updatesError,
    showUnreadOnly,
    pendingUpdateIds,
    deletingUpdateIds,
    isMarkingAllRead,
    unreadCount,
    containerRef,
    pullDistance,
    isPullRefreshing,
    handleToggleUnreadOnly,
    handleRefresh,
    handleMarkRead,
    handleMarkAllRead,
    handleDeleteUpdate,
    handleClearAllUpdates,
    handleDismissUpdatesError
  };
}
