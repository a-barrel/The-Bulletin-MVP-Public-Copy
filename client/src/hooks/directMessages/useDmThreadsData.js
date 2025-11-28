import { useCallback, useEffect } from 'react';
import reportClientError from '../../utils/reportClientError';
import { fetchDirectMessageThreads } from '../../api';

const DM_POLL_INTERVAL_MS = 30 * 1000;

export default function useDmThreadsData({ dispatch, autoLoad = true }) {
  const loadThreads = useCallback(async () => {
    dispatch({ type: 'threads/pending' });
    try {
      const payload = await fetchDirectMessageThreads();
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
    if (autoLoad) {
      loadThreads().catch(() => {});
    }
  }, [autoLoad, loadThreads]);

  useEffect(() => {
    if (!autoLoad || typeof window === 'undefined') {
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
