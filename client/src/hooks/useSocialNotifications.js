import { useCallback, useEffect, useMemo, useRef } from 'react';

import useFriendGraph from './useFriendGraph';
import useDirectMessages from './useDirectMessages';

const useSocialNotifications = ({ enabled = true, autoLoad = true } = {}) => {
  const friendGraph = useFriendGraph({ autoLoad: false });
  const directMessages = useDirectMessages({ autoLoad: false });

  const didAutoLoadRef = useRef(false);

  const refreshAll = useCallback(async () => {
    const tasks = [];
    if (friendGraph.refresh) {
      tasks.push(friendGraph.refresh().catch(() => {}));
    }
    if (directMessages.refreshThreads) {
      tasks.push(directMessages.refreshThreads().catch(() => {}));
    }
    if (!tasks.length) {
      return null;
    }
    const results = await Promise.allSettled(tasks);
    return results;
  }, [directMessages.refreshThreads, friendGraph.refresh]);

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
    if (friendGraph.hasAccess === false) {
      return 0;
    }
    return Array.isArray(friendGraph.graph?.incomingRequests)
      ? friendGraph.graph.incomingRequests.length
      : 0;
  }, [friendGraph.graph, friendGraph.hasAccess]);

  const dmThreadCount = useMemo(() => {
    if (directMessages.hasAccess === false) {
      return 0;
    }
    return Array.isArray(directMessages.threads) ? directMessages.threads.length : 0;
  }, [directMessages.hasAccess, directMessages.threads]);

  const friendAccessDenied = friendGraph.hasAccess === false;
  const dmAccessDenied = directMessages.hasAccess === false;

  return {
    friendRequestCount,
    friendData: friendGraph.graph,
    friendIsLoading: friendGraph.isLoading,
    friendIsProcessing: friendGraph.isProcessing,
    friendStatus: friendGraph.status,
    friendAccessDenied,
    respondToFriendRequest: friendGraph.respondToRequest,
    sendFriendRequest: friendGraph.sendFriendRequest,
    dmThreadCount,
    dmThreads: directMessages.threads,
    dmIsLoading: directMessages.isLoadingThreads,
    dmStatus: directMessages.threadsStatus,
    dmAccessDenied,
    refreshAll,
    hasAnyAccess: !friendAccessDenied || !dmAccessDenied
  };
};

export default useSocialNotifications;
