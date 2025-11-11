import { useCallback, useEffect, useMemo, useState } from 'react';
import { blockUser, sendFriendRequest, unblockUser } from '../api/mongoDataApi';

function normalizeId(value) {
  if (!value) {
    return null;
  }
  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

export default function useProfileInteractions({
  viewerProfile,
  effectiveUser,
  targetUserId,
  shouldLoadCurrentUser,
  userFromState,
  setViewerProfile,
  setFetchedUser,
  displayName
}) {
  const [relationshipStatus, setRelationshipStatus] = useState(null);
  const [blockDialogMode, setBlockDialogMode] = useState(null);
  const [isProcessingBlockAction, setIsProcessingBlockAction] = useState(false);
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [hasPendingFriendRequest, setHasPendingFriendRequest] = useState(false);

  const viewerId = viewerProfile?._id ? String(viewerProfile._id) : null;
  const normalizedTargetId = useMemo(() => {
    if (effectiveUser?._id) {
      return String(effectiveUser._id);
    }
    if (targetUserId && targetUserId !== 'me') {
      return targetUserId;
    }
    return null;
  }, [effectiveUser?._id, targetUserId]);

  const normalizedBlockedIds = useMemo(() => {
    if (!Array.isArray(viewerProfile?.relationships?.blockedUserIds)) {
      return [];
    }
    return viewerProfile.relationships.blockedUserIds.map((id) => String(id));
  }, [viewerProfile?.relationships?.blockedUserIds, viewerProfile]);

  useEffect(() => {
    setHasPendingFriendRequest(false);
  }, [normalizedTargetId]);

  const normalizedFriendIds = useMemo(() => {
    if (Array.isArray(viewerProfile?.relationships?.friendIds)) {
      return viewerProfile.relationships.friendIds.map((id) => String(id));
    }
    return [];
  }, [viewerProfile?.relationships?.friendIds, viewerProfile]);

  const isViewingSelf =
    shouldLoadCurrentUser || Boolean(viewerId && normalizedTargetId && viewerId === normalizedTargetId);
  const isBlocked = Boolean(normalizedTargetId && normalizedBlockedIds.includes(String(normalizedTargetId)));
  const isFriend = Boolean(normalizedTargetId && normalizedFriendIds.includes(String(normalizedTargetId)));
  const canEditProfile = Boolean(isViewingSelf && !userFromState);
  const canManageBlock = Boolean(!isViewingSelf && viewerProfile && normalizedTargetId);
  const canSendFriendRequest = Boolean(!isViewingSelf && normalizedTargetId && !isBlocked);

  const handleRequestBlock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('block');
  }, [canManageBlock]);

  const handleRequestUnblock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('unblock');
  }, [canManageBlock]);

  const handleCloseBlockDialog = useCallback(() => {
    if (isProcessingBlockAction) {
      return;
    }
    setBlockDialogMode(null);
  }, [isProcessingBlockAction]);

  const handleConfirmBlockDialog = useCallback(async () => {
    if (!blockDialogMode) {
      return;
    }

    const targetId = normalizeId(effectiveUser?._id) ?? normalizeId(normalizedTargetId);
    if (!targetId) {
      return;
    }

    setIsProcessingBlockAction(true);
    setRelationshipStatus(null);
    try {
      const response =
        blockDialogMode === 'block' ? await blockUser(targetId) : await unblockUser(targetId);

      setViewerProfile((prev) => {
        if (!prev) {
          return prev;
        }

        if (response?.updatedRelationships) {
          return {
            ...prev,
            relationships: response.updatedRelationships
          };
        }

        const currentRelationships = prev.relationships ?? {};
        const currentBlockedIds = Array.isArray(currentRelationships.blockedUserIds)
          ? currentRelationships.blockedUserIds.map((id) => String(id))
          : [];
        const blockedSet = new Set(currentBlockedIds);
        if (blockDialogMode === 'block') {
          blockedSet.add(targetId);
        } else {
          blockedSet.delete(targetId);
        }
        return {
          ...prev,
          relationships: {
            ...currentRelationships,
            blockedUserIds: Array.from(blockedSet)
          }
        };
      });

      setRelationshipStatus({
        type: 'success',
        message:
          blockDialogMode === 'block'
            ? `${displayName} has been blocked.`
            : `${displayName} has been unblocked.`
      });
      setBlockDialogMode(null);
    } catch (error) {
      setRelationshipStatus({
        type: 'error',
        message: error?.message || 'Failed to update block status.'
      });
    } finally {
      setIsProcessingBlockAction(false);
    }
  }, [blockDialogMode, displayName, effectiveUser?._id, normalizedTargetId, setViewerProfile]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!normalizedTargetId || isViewingSelf) {
      return;
    }
    setIsSendingFriendRequest(true);
    setRelationshipStatus(null);
    try {
      const response = await sendFriendRequest({ targetUserId: normalizedTargetId });
      if (response?.autoAccepted) {
        setHasPendingFriendRequest(false);
        setViewerProfile((prev) => {
          if (!prev) {
            return prev;
          }
          const currentFriendIds = Array.isArray(prev.relationships?.friendIds)
            ? prev.relationships.friendIds.map((id) => String(id))
            : [];
          if (currentFriendIds.includes(String(normalizedTargetId))) {
            return prev;
          }
          return {
            ...prev,
            relationships: {
              ...(prev.relationships || {}),
              friendIds: [...currentFriendIds, String(normalizedTargetId)]
            }
          };
        });
        setFetchedUser((prev) => {
          if (!prev || !prev._id || String(prev._id) !== String(normalizedTargetId)) {
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
      setRelationshipStatus({
        type: 'success',
        message: response?.autoAccepted
          ? `${displayName} accepted your friend request.`
          : `Friend request sent to ${displayName}.`
      });
    } catch (error) {
      setRelationshipStatus({
        type: 'error',
        message: error?.message || 'Failed to send friend request.'
      });
    } finally {
      setIsSendingFriendRequest(false);
    }
  }, [displayName, isViewingSelf, normalizedTargetId, setFetchedUser, setViewerProfile, viewerId]);

  useEffect(() => {
    if (!relationshipStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setRelationshipStatus(null);
    }, 5000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [relationshipStatus]);

  return {
    normalizedTargetId,
    viewerId,
    isViewingSelf,
    isBlocked,
    isFriend,
    canEditProfile,
    canManageBlock,
    canSendFriendRequest,
    blockDialogMode,
    isProcessingBlockAction,
    relationshipStatus,
    setRelationshipStatus,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    hasPendingFriendRequest,
    isSendingFriendRequest,
    handleSendFriendRequest
  };
}
