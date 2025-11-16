import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendFriendRequest } from '../api/mongoDataApi';

export default function useProfileFriendActions({
  viewerProfile,
  setViewerProfile,
  effectiveUser,
  setFetchedUser,
  targetProfileId,
  isViewingSelf
}) {
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [hasPendingFriendRequest, setHasPendingFriendRequest] = useState(false);

  useEffect(() => {
    setHasPendingFriendRequest(false);
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

  const canSendFriendRequest = Boolean(
    !isViewingSelf && normalizedTargetId && !isFriend && !hasPendingFriendRequest
  );

  const handleSendFriendRequest = useCallback(async () => {
    if (!normalizedTargetId || isViewingSelf || !canSendFriendRequest) {
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
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
      setHasPendingFriendRequest(false);
    } finally {
      setIsSendingFriendRequest(false);
    }
  }, [canSendFriendRequest, isViewingSelf, normalizedTargetId, setFetchedUser, setViewerProfile, viewerId]);

  return {
    isFriend,
    canSendFriendRequest,
    hasPendingFriendRequest,
    isSendingFriendRequest,
    handleSendFriendRequest
  };
}
