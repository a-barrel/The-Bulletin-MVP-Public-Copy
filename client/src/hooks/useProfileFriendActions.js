import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelFriendRequest,
  removeFriendRelationship,
  sendFriendRequest
} from '../api';

export default function useProfileFriendActions({
  viewerProfile,
  setViewerProfile,
  setFetchedUser,
  targetProfileId,
  isViewingSelf
}) {
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [hasPendingFriendRequest, setHasPendingFriendRequest] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [isCancellingFriendRequest, setIsCancellingFriendRequest] = useState(false);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);

  useEffect(() => {
    setHasPendingFriendRequest(false);
    setPendingRequestId(null);
  }, [targetProfileId]);

  const normalizedTargetId = targetProfileId ? String(targetProfileId) : null;
  const viewerId = viewerProfile?._id ? String(viewerProfile._id) : null;

  const normalizedFriendIds = useMemo(() => {
    if (Array.isArray(viewerProfile?.relationships?.friendIds)) {
      return viewerProfile.relationships.friendIds.map((id) => String(id));
    }
    return [];
  }, [viewerProfile]);

  const isFriend = Boolean(
    normalizedTargetId && normalizedFriendIds.includes(normalizedTargetId)
  );

  const canSendFriendRequest = Boolean(!isViewingSelf && normalizedTargetId && !isFriend);

  const handleSendFriendRequest = useCallback(async () => {
    if (
      !normalizedTargetId ||
      isViewingSelf ||
      !canSendFriendRequest ||
      isFriend ||
      hasPendingFriendRequest
    ) {
      return;
    }
    setIsSendingFriendRequest(true);
    setHasPendingFriendRequest(false);
    try {
      const response = await sendFriendRequest({ targetUserId: normalizedTargetId });
      if (response?.autoAccepted) {
        setViewerProfile((prev) => {
          if (!prev) {
            return prev;
          }
          const currentFriendIds = Array.isArray(prev.relationships?.friendIds)
            ? prev.relationships.friendIds.map((id) => String(id))
            : [];
          if (currentFriendIds.includes(normalizedTargetId)) {
            return prev;
          }
          return {
            ...prev,
            relationships: {
              ...(prev.relationships || {}),
              friendIds: [...currentFriendIds, normalizedTargetId]
            }
          };
        });
        setFetchedUser((prev) => {
          if (!prev || !prev._id || String(prev._id) !== normalizedTargetId) {
            return prev;
          }
          const friendIds = Array.isArray(prev.relationships?.friendIds)
            ? prev.relationships.friendIds.map((id) => String(id))
            : [];
          if (friendIds.includes(String(viewerId))) {
            return prev;
          }
          return {
            ...prev,
            relationships: {
              ...(prev.relationships || {}),
              friendIds: [...friendIds, String(viewerId)]
            }
          };
        });
      } else {
        setHasPendingFriendRequest(true);
        setPendingRequestId(response?.request?._id ?? null);
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
      setHasPendingFriendRequest(false);
      setPendingRequestId(null);
    } finally {
      setIsSendingFriendRequest(false);
    }
  }, [canSendFriendRequest, hasPendingFriendRequest, isFriend, isViewingSelf, normalizedTargetId, setFetchedUser, setViewerProfile, viewerId]);

  const handleCancelFriendRequest = useCallback(async () => {
    if (!pendingRequestId || !hasPendingFriendRequest || isViewingSelf) {
      return;
    }
    setIsCancellingFriendRequest(true);
    try {
      await cancelFriendRequest(pendingRequestId);
      setHasPendingFriendRequest(false);
      setPendingRequestId(null);
    } catch (error) {
      console.error('Failed to cancel friend request:', error);
    } finally {
      setIsCancellingFriendRequest(false);
    }
  }, [hasPendingFriendRequest, isViewingSelf, pendingRequestId]);

  const handleRemoveFriend = useCallback(async () => {
    if (!isFriend || !normalizedTargetId || isViewingSelf) {
      return;
    }
    setIsRemovingFriend(true);
    try {
      await removeFriendRelationship(normalizedTargetId);
      setViewerProfile((prev) => {
        if (!prev) {
          return prev;
        }
        const currentFriendIds = Array.isArray(prev.relationships?.friendIds)
          ? prev.relationships.friendIds.map((id) => String(id))
          : [];
        return {
          ...prev,
          relationships: {
            ...(prev.relationships || {}),
            friendIds: currentFriendIds.filter((id) => id !== normalizedTargetId)
          }
        };
      });
      setFetchedUser((prev) => {
        if (!prev || !viewerId) {
          return prev;
        }
        const friendIds = Array.isArray(prev.relationships?.friendIds)
          ? prev.relationships.friendIds.map((id) => String(id))
          : [];
        return {
          ...prev,
          relationships: {
            ...(prev.relationships || {}),
            friendIds: friendIds.filter((id) => id !== viewerId)
          }
        };
      });
    } catch (error) {
      console.error('Failed to remove friend:', error);
    } finally {
      setIsRemovingFriend(false);
    }
  }, [isFriend, isViewingSelf, normalizedTargetId, setFetchedUser, setViewerProfile, viewerId]);

  const friendState = isFriend ? 'friends' : hasPendingFriendRequest ? 'pending' : 'idle';

  const handleFriendAction = useCallback(() => {
    if (friendState === 'friends') {
      handleRemoveFriend();
      return;
    }
    if (friendState === 'pending') {
      handleCancelFriendRequest();
      return;
    }
    handleSendFriendRequest();
  }, [friendState, handleCancelFriendRequest, handleRemoveFriend, handleSendFriendRequest]);

  const friendActionBusy = isSendingFriendRequest || isCancellingFriendRequest || isRemovingFriend;

  return {
    isFriend,
    canSendFriendRequest,
    friendState,
    pendingRequestId,
    friendActionBusy,
    handleFriendAction
  };
}
