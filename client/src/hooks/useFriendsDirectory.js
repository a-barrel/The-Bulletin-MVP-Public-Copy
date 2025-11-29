import { useCallback, useMemo, useState } from 'react';

import useFriendGraph from './useFriendGraph';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import { useUserCache } from '../contexts/UserCacheContext';

const MAX_SEARCH_LENGTH = 30;

function normalizeQuery(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

export default function useFriendsDirectory() {
  const userCache = useUserCache();
  const {
    graph,
    refresh,
    isLoading,
    status,
    queueStatus,
    removeFriend,
    hasAccess,
    isProcessing
  } = useFriendGraph();
  const socialNotifications = useSocialNotificationsContext();
  const [searchQuery, setSearchQuery] = useState('');

  const friends = useMemo(
    () => {
      const list = Array.isArray(graph?.friends) ? graph.friends : [];
      if (list.length) {
        userCache.setUsers(list);
      }
      return list;
    },
    [graph, userCache]
  );

  const normalizedQuery = normalizeQuery(searchQuery);
  const filteredFriends = useMemo(() => {
    if (!normalizedQuery) {
      return friends;
    }
    return friends.filter((friend) => {
      const name = `${friend.displayName || ''} ${friend.username || ''}`.trim().toLowerCase();
      return name.includes(normalizedQuery);
    });
  }, [friends, normalizedQuery]);

  const handleSearchChange = useCallback((value) => {
    if (typeof value !== 'string') {
      setSearchQuery('');
      return;
    }
    setSearchQuery(value.slice(0, MAX_SEARCH_LENGTH));
  }, []);

  const incomingRequests = socialNotifications.friendData?.incomingRequests || [];
  const canShowFriendRequests = !socialNotifications.friendAccessDenied;
  const hasFriendRequests = canShowFriendRequests && incomingRequests.length > 0;
  const requestBadge = hasFriendRequests
    ? incomingRequests.length > 99
      ? '99+'
      : String(incomingRequests.length)
    : null;
  const notificationsLabel = hasFriendRequests
    ? `Notifications (${incomingRequests.length} unread)`
    : 'Notifications';

  const respondToFriendRequest = useCallback(
    async ({ requestId, decision }) => {
      if (
        !requestId ||
        (decision !== 'accept' && decision !== 'decline') ||
        typeof socialNotifications.respondToFriendRequest !== 'function'
      ) {
        throw new Error('Unable to update friend request.');
      }
      await socialNotifications.respondToFriendRequest({ requestId, decision });
    },
    [socialNotifications]
  );

  const refreshNotifications = useCallback(async () => {
    if (typeof socialNotifications.refreshAll === 'function') {
      await socialNotifications.refreshAll();
    }
  }, [socialNotifications]);

  return {
    friends,
    filteredFriends,
    friendGraph: graph,
    incomingRequests,
    hasFriendRequests,
    canShowFriendRequests,
    requestBadge,
    notificationsLabel,
    searchQuery,
    setSearchQuery: handleSearchChange,
    isLoadingFriends: isLoading,
    friendStatus: status,
    friendQueueStatus: queueStatus,
    friendHasAccess: hasAccess,
    isProcessingFriendAction: isProcessing,
    refreshFriendGraph: refresh,
    removeFriendRelationship: removeFriend,
    respondToFriendRequest,
    refreshNotifications
  };
}
