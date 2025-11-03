import { useCallback, useEffect, useMemo, useRef } from 'react';

import useFriendGraph from './useFriendGraph';
import useDirectMessages from './useDirectMessages';

const useSocialNotifications = ({ enabled = true, autoLoad = true } = {}) => {
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
  } = useDirectMessages({ autoLoad: false });

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
    if (!enabled || !autoLoad || didAutoLoadRef.current) {
      return;
    }
    didAutoLoadRef.current = true;
    refreshAll().catch(() => {});
  }, [autoLoad, enabled, refreshAll]);

  useEffect(() => {
    if (!enabled) {
      didAutoLoadRef.current = false;
    }
  }, [enabled]);

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
