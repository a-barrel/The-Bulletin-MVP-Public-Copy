import { useCallback, useEffect, useState } from 'react';

import {
  fetchCurrentUserProfile,
  fetchUsersWithCussCount,
  incrementUserCussCount,
  resetUserCussCount
} from '../../../api';

const useBadUsers = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setStatus(null);
    setIsLoading(true);
    try {
      const data = await fetchUsersWithCussCount();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to load cuss stats.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (cancelled) {
          return;
        }
        const id = profile?._id || profile?.userId || profile?.id || '';
        if (id) {
          setCurrentUserId(id);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error?.message || 'Failed to load current user id.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const incrementSelf = useCallback(async () => {
    if (!currentUserId) {
      setStatus({ type: 'error', message: 'Load your profile id first.' });
      return;
    }
    try {
      setIsLoading(true);
      await incrementUserCussCount(currentUserId);
      await loadUsers();
      setStatus({ type: 'success', message: 'Added 1 cuss to your profile.' });
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to increment.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, loadUsers]);

  const resetSelf = useCallback(async () => {
    if (!currentUserId) {
      setStatus({ type: 'error', message: 'Load your profile id first.' });
      return;
    }
    try {
      setIsLoading(true);
      await resetUserCussCount(currentUserId);
      await loadUsers();
      setStatus({ type: 'success', message: 'Cuss count cleared.' });
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to reset.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, loadUsers]);

  return {
    users,
    isLoading,
    status,
    setStatus,
    profileError,
    setProfileError,
    currentUserId,
    refresh: loadUsers,
    incrementSelf,
    resetSelf
  };
};

export default useBadUsers;
