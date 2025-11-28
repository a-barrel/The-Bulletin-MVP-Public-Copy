import { useCallback, useState } from 'react';

export default function useFriendRequestDialog({ respondToFriendRequest, refreshFriendGraph, refreshNotifications }) {
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);
  const [friendActionStatus, setFriendActionStatus] = useState(null);
  const [respondingRequestId, setRespondingRequestId] = useState(null);

  const openFriendDialog = useCallback(() => {
    setFriendActionStatus(null);
    setIsFriendDialogOpen(true);
  }, []);

  const closeFriendDialog = useCallback(() => {
    if (respondingRequestId) return;
    setIsFriendDialogOpen(false);
  }, [respondingRequestId]);

  const handleRespondToFriendRequest = useCallback(
    async (requestId, decision) => {
      if (!requestId || !decision) {
        return;
      }
      setRespondingRequestId(requestId);
      setFriendActionStatus(null);
      try {
        await respondToFriendRequest({ requestId, decision });
        setFriendActionStatus({
          type: 'success',
          message: decision === 'accept' ? 'Friend request accepted.' : 'Friend request declined.'
        });
        await Promise.allSettled([
          refreshNotifications?.(),
          refreshFriendGraph?.().catch(() => {})
        ]);
      } catch (error) {
        setFriendActionStatus({
          type: 'error',
          message: error?.message || 'Failed to update friend request.'
        });
      } finally {
        setRespondingRequestId(null);
      }
    },
    [refreshFriendGraph, refreshNotifications, respondToFriendRequest]
  );

  return {
    isFriendDialogOpen,
    friendActionStatus,
    respondingRequestId,
    openFriendDialog,
    closeFriendDialog,
    setFriendActionStatus,
    handleRespondToFriendRequest
  };
}
