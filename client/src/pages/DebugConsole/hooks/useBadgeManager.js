import { useCallback, useEffect, useState } from 'react';

import {
  debugGrantBadge,
  debugListBadges,
  debugResetBadges,
  debugRevokeBadge,
  fetchCurrentUserProfile
} from '../../../api';

const useBadgeManager = ({ currentUser } = {}) => {
  const [badgeStatus, setBadgeStatus] = useState(null);
  const [status, setStatus] = useState(null);
  const [mutatingBadgeId, setMutatingBadgeId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [autoUserId, setAutoUserId] = useState('');

  const loadBadges = useCallback(
    async (targetId, { suppressStatus = false } = {}) => {
      const trimmed = targetId ? String(targetId).trim() : '';
      if (!trimmed) {
        if (!suppressStatus) {
          setStatus({ type: 'error', message: 'Enter a user ID to load badges.' });
        }
        return null;
      }

      if (!suppressStatus) {
        setStatus(null);
      }

      setIsLoading(true);
      try {
        const data = await debugListBadges({ userId: trimmed });
        setBadgeStatus(data);
        if (!suppressStatus) {
          const displayName = data.user?.displayName || data.user?.username || trimmed;
          setStatus({ type: 'success', message: `Loaded badges for ${displayName}.` });
        }
        return data;
      } catch (error) {
        if (!suppressStatus) {
          setStatus({ type: 'error', message: error?.message || 'Failed to load badges.' });
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (cancelled || !profile?._id) {
          return;
        }
        setAutoUserId(profile._id);
        await loadBadges(profile._id, { suppressStatus: true });
      } catch (error) {
        if (!cancelled) {
          setStatus({ type: 'error', message: error?.message || 'Failed to load badges.' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, loadBadges]);

  const grantBadge = useCallback(
    async (userId, badgeId) => {
      if (!badgeId) {
        return;
      }
      const trimmedUserId = userId ? String(userId).trim() : '';
      if (!trimmedUserId) {
        setStatus({ type: 'error', message: 'Load a user before granting badges.' });
        return;
      }
      try {
        setMutatingBadgeId(badgeId);
        setStatus(null);
        const data = await debugGrantBadge({ userId: trimmedUserId, badgeId });
        setBadgeStatus(data);
        const badgeMeta = data.badges?.find((badge) => badge.id === badgeId);
        setStatus({
          type: 'success',
          message: `Granted "${badgeMeta?.label || badgeId}" badge.`
        });
        return data;
      } catch (error) {
        setStatus({ type: 'error', message: error?.message || 'Failed to grant badge.' });
        throw error;
      } finally {
        setMutatingBadgeId(null);
      }
    },
    []
  );

  const revokeBadge = useCallback(
    async (userId, badgeId) => {
      if (!badgeId) {
        return;
      }
      const trimmedUserId = userId ? String(userId).trim() : '';
      if (!trimmedUserId) {
        setStatus({ type: 'error', message: 'Load a user before removing badges.' });
        return;
      }
      try {
        setMutatingBadgeId(badgeId);
        setStatus(null);
        const data = await debugRevokeBadge({ userId: trimmedUserId, badgeId });
        setBadgeStatus(data);
        const badgeMeta = data.badges?.find((badge) => badge.id === badgeId);
        setStatus({
          type: 'success',
          message: `Removed "${badgeMeta?.label || badgeId}" badge.`
        });
        return data;
      } catch (error) {
        setStatus({ type: 'error', message: error?.message || 'Failed to remove badge.' });
        throw error;
      } finally {
        setMutatingBadgeId(null);
      }
    },
    []
  );

  const resetBadges = useCallback(
    async (userId) => {
      const trimmedUserId = userId ? String(userId).trim() : '';
      if (!trimmedUserId) {
        setStatus({ type: 'error', message: 'Load a user before resetting badges.' });
        return;
      }
      try {
        setIsResetting(true);
        setStatus(null);
        const data = await debugResetBadges({ userId: trimmedUserId });
        setBadgeStatus(data);
        setStatus({ type: 'success', message: 'All badges reset.' });
        return data;
      } catch (error) {
        setStatus({ type: 'error', message: error?.message || 'Failed to reset badges.' });
        throw error;
      } finally {
        setIsResetting(false);
      }
    },
    []
  );

  return {
    badgeStatus,
    status,
    setStatus,
    mutatingBadgeId,
    isLoading,
    isResetting,
    autoUserId,
    loadBadges,
    grantBadge,
    revokeBadge,
    resetBadges
  };
};

export default useBadgeManager;
