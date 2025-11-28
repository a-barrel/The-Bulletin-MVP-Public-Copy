import { useCallback, useEffect, useState } from 'react';
import { fetchBlockedUsers, unblockUser } from '../../api';
import reportClientError from '../../utils/reportClientError';

export default function useBlockedUsersManager({ isOffline, setProfile }) {
  const [blockedOverlayOpen, setBlockedOverlayOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [isManagingBlockedUsers, setIsManagingBlockedUsers] = useState(false);
  const [blockedOverlayStatus, setBlockedOverlayStatus] = useState(null);

  useEffect(() => {
    if (!blockedOverlayOpen) {
      return;
    }

    if (isOffline) {
      setIsLoadingBlockedUsers(false);
      setBlockedOverlayStatus((prev) =>
        prev?.type === 'warning'
          ? prev
          : {
              type: 'warning',
              message: 'Blocked users cannot be managed while offline.'
            }
      );
      return;
    }

    let cancelled = false;

    const loadBlocked = async () => {
      setIsLoadingBlockedUsers(true);
      setBlockedOverlayStatus(null);
      try {
        const response = await fetchBlockedUsers();
        if (cancelled) {
          return;
        }
        setBlockedUsers(Array.isArray(response?.blockedUsers) ? response.blockedUsers : []);
        if (response?.relationships) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  relationships: response.relationships
                }
              : prev
          );
        }
      } catch (error) {
        if (!cancelled) {
          setBlockedUsers([]);
          reportClientError(error, 'Failed to load blocked users.', {
            source: 'useBlockedUsersManager'
          });
          setBlockedOverlayStatus({
            type: 'error',
            message: error?.message || 'Failed to load blocked users.'
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBlockedUsers(false);
        }
      }
    };

    loadBlocked();

    return () => {
      cancelled = true;
    };
  }, [blockedOverlayOpen, isOffline, setProfile]);

  useEffect(() => {
    if (!blockedOverlayStatus || blockedOverlayStatus.type !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBlockedOverlayStatus(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [blockedOverlayStatus]);

  const handleOpenBlockedOverlay = useCallback(() => {
    if (isOffline) {
      setBlockedOverlayStatus({
        type: 'warning',
        message: 'Reconnect to manage blocked users.'
      });
      return;
    }
    setBlockedOverlayStatus(null);
    setBlockedOverlayOpen(true);
  }, [isOffline]);

  const handleCloseBlockedOverlay = useCallback(() => {
    if (isManagingBlockedUsers) {
      return;
    }
    setBlockedOverlayOpen(false);
  }, [isManagingBlockedUsers]);

  const handleUnblockUser = useCallback(
    async (userId) => {
      if (!userId) {
        return;
      }

      if (isOffline) {
        setBlockedOverlayStatus({
          type: 'warning',
          message: 'Reconnect to unblock users.'
        });
        return;
      }

      const targetUser = blockedUsers.find((user) => user._id === userId);
      setIsManagingBlockedUsers(true);
      setBlockedOverlayStatus(null);
      try {
        const response = await unblockUser(userId);
        setBlockedUsers(Array.isArray(response?.blockedUsers) ? response.blockedUsers : []);
        if (response?.updatedRelationships) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  relationships: response.updatedRelationships
                }
              : prev
          );
        }
        setBlockedOverlayStatus({
          type: 'success',
          message: targetUser?.displayName
            ? `${targetUser.displayName} has been unblocked.`
            : 'User has been unblocked.'
        });
      } catch (error) {
        reportClientError(error, 'Failed to unblock user.', {
          source: 'useBlockedUsersManager.unblock'
        });
        setBlockedOverlayStatus({
          type: 'error',
          message: error?.message || 'Failed to unblock user.'
        });
      } finally {
        setIsManagingBlockedUsers(false);
      }
    },
    [blockedUsers, isOffline, setProfile]
  );

  return {
    blockedOverlayOpen,
    blockedUsers,
    isLoadingBlockedUsers,
    isManagingBlockedUsers,
    blockedOverlayStatus,
    setBlockedOverlayStatus,
    handleOpenBlockedOverlay,
    handleCloseBlockedOverlay,
    handleUnblockUser
  };
}
