import { useCallback, useEffect } from 'react';
import reportClientError from '../../utils/reportClientError';
import { fetchDirectMessageThreads } from '../../api';
import { useUserCache } from '../../contexts/UserCacheContext';

const DM_POLL_INTERVAL_MS = 5 * 1000;

export default function useDmThreadsData({ dispatch, autoLoad = true, enabled = true }) {
  const userCache = useUserCache();
  const loadThreads = useCallback(async () => {
    if (!enabled) {
      return null;
    }
    dispatch({ type: 'threads/pending' });
    try {
      const payload = await fetchDirectMessageThreads();
      if (Array.isArray(payload?.threads)) {
        const participants = payload.threads.flatMap((thread) =>
          Array.isArray(thread.participants) ? thread.participants : []
        );
        if (participants.length) {
          userCache.setUsers(participants);
        }
      }
      dispatch({ type: 'threads/success', payload });
      return payload;
    } catch (error) {
      reportClientError(error, 'Failed to load direct message threads', {
        source: 'useDirectMessages.loadThreads'
      });
      dispatch({
        type: 'threads/error',
        error:
          error?.status === 403
            ? 'Friend management privileges required.'
            : error?.message || 'Failed to load direct message threads.',
        status: error?.status ?? null
      });
      throw error;
    }
  }, [dispatch]);

  useEffect(() => {
    if (autoLoad && enabled) {
      loadThreads().catch(() => {});
    }
  }, [autoLoad, enabled, loadThreads]);

  useEffect(() => {
    if (!autoLoad || !enabled || typeof window === 'undefined') {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      loadThreads().catch(() => {});
    }, DM_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoLoad, loadThreads]);

  return { loadThreads };
}
