import { useCallback, useEffect, useMemo, useRef } from 'react';

import useFriendGraph from './useFriendGraph';
import useDirectMessages from './useDirectMessages';

const SOCIAL_POLL_INTERVAL_MS = 30 * 1000;

const useSocialNotifications = ({ enabled = true, autoLoad = true, authUser = null } = {}) => {
  const effectiveEnabled = enabled && !!authUser;
  const {
    refresh: refreshFriendGraph,
    graph: friendGraphData,
    isLoading: friendIsLoading,
    isProcessing: friendIsProcessing,
    status: friendStatus,
    hasAccess: friendHasAccess,
    respondToRequest,
    sendFriendRequest: sendFriendRequestAction
  } = useFriendGraph({ autoLoad: false });
  const {
    refreshThreads: refreshDirectThreads,
    threads: dmThreads,
    isLoadingThreads: dmIsLoading,
    threadsStatus: dmStatus,
    hasAccess: dmHasAccess
  } = useDirectMessages({ autoLoad: false, enabled: effectiveEnabled });

  const didAutoLoadRef = useRef(false);

  const refreshAll = useCallback(async () => {
    const tasks = [];
    if (refreshFriendGraph) {
      tasks.push(refreshFriendGraph().catch(() => {}));
    }
    if (refreshDirectThreads) {
      tasks.push(refreshDirectThreads().catch(() => {}));
    }
    if (!tasks.length) {
      return null;
    }
    const results = await Promise.allSettled(tasks);
    return results;
  }, [refreshDirectThreads, refreshFriendGraph]);

  useEffect(() => {
    if (!effectiveEnabled || !autoLoad || didAutoLoadRef.current) {
      return;
    }
    didAutoLoadRef.current = true;
    refreshAll().catch(() => {});
  }, [autoLoad, effectiveEnabled, refreshAll]);

  useEffect(() => {
    if (!effectiveEnabled) {
      didAutoLoadRef.current = false;
    }
  }, [effectiveEnabled]);

  useEffect(() => {
    if (!effectiveEnabled || typeof window === 'undefined') {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      refreshAll().catch(() => {});
    }, SOCIAL_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [effectiveEnabled, refreshAll]);

  const friendRequestCount = useMemo(() => {
    if (friendHasAccess === false) {
      return 0;
    }
    return Array.isArray(friendGraphData?.incomingRequests)
      ? friendGraphData.incomingRequests.length
      : 0;
  }, [friendGraphData, friendHasAccess]);

  const dmThreadCount = useMemo(() => {
    if (dmHasAccess === false) {
      return 0;
    }
    return Array.isArray(dmThreads) ? dmThreads.length : 0;
  }, [dmHasAccess, dmThreads]);

  const friendAccessDenied = friendHasAccess === false;
  const dmAccessDenied = dmHasAccess === false;

  return {
    friendRequestCount,
    friendData: friendGraphData,
    friendIsLoading,
    friendIsProcessing,
    friendStatus,
    friendAccessDenied,
    respondToFriendRequest: respondToRequest,
    sendFriendRequest: sendFriendRequestAction,
    dmThreadCount,
    dmThreads,
    dmIsLoading,
    dmStatus,
    dmAccessDenied,
    refreshAll,
    hasAnyAccess: !friendAccessDenied || !dmAccessDenied
  };
};

export default useSocialNotifications;
