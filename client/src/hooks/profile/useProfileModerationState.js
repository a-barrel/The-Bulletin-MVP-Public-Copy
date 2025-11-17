import { useCallback, useEffect, useMemo, useState } from 'react';
import { blockUser, unblockUser } from '../../api/mongoDataApi';

export default function useProfileModerationState({
  viewerProfile,
  setViewerProfile,
  effectiveUser,
  targetUserId,
  isOffline,
  displayName
}) {
  const [relationshipStatus, setRelationshipStatus] = useState(null);
  const [blockDialogMode, setBlockDialogMode] = useState(null);
  const [isProcessingBlockAction, setIsProcessingBlockAction] = useState(false);

  const viewerId = viewerProfile?._id ? String(viewerProfile._id) : null;
  const normalizedTargetId = effectiveUser?._id
    ? String(effectiveUser._id)
    : targetUserId && targetUserId !== 'me'
    ? targetUserId
    : null;
  const isViewingSelf =
    Boolean(viewerId && normalizedTargetId && viewerId === normalizedTargetId) || !normalizedTargetId;

  const normalizedBlockedIds = useMemo(() => {
    if (Array.isArray(viewerProfile?.relationships?.blockedUserIds)) {
      return viewerProfile.relationships.blockedUserIds.map((id) => String(id));
    }
    return [];
  }, [viewerProfile]);

  const isBlocked = Boolean(
    normalizedTargetId && normalizedBlockedIds.includes(String(normalizedTargetId))
  );
  const canManageBlock = Boolean(!isViewingSelf && viewerProfile && normalizedTargetId);

  const handleRequestBlock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    if (isOffline) {
      setRelationshipStatus({ type: 'warning', message: 'Reconnect to block users.' });
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('block');
  }, [canManageBlock, isOffline]);

  const handleRequestUnblock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    if (isOffline) {
      setRelationshipStatus({ type: 'warning', message: 'Reconnect to unblock users.' });
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('unblock');
  }, [canManageBlock, isOffline]);

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
    const targetId = effectiveUser?._id ? String(effectiveUser._id) : normalizedTargetId;
    if (!targetId) {
      return;
    }
    if (isOffline) {
      setRelationshipStatus({
        type: 'warning',
        message: 'Reconnect to change block status.'
      });
      setBlockDialogMode(null);
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
  }, [blockDialogMode, displayName, effectiveUser?._id, isOffline, normalizedTargetId, setViewerProfile]);

  useEffect(() => {
    if (!relationshipStatus) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRelationshipStatus(null);
    }, 5000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [relationshipStatus]);

  return {
    relationshipStatus,
    setRelationshipStatus,
    blockDialogMode,
    isProcessingBlockAction,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    isBlocked,
    canManageBlock,
    isViewingSelf
  };
}
