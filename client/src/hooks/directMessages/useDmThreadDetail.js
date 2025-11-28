import { useCallback } from 'react';
import reportClientError from '../../utils/reportClientError';
import { fetchDirectMessageThread } from '../../api';

export default function useDmThreadDetail({ dispatch }) {
  const loadThreadDetail = useCallback(
    async (threadId) => {
      if (!threadId) {
        const error = new Error('Select a thread before loading messages.');
        dispatch({ type: 'thread/error', error: error.message });
        throw error;
      }
      dispatch({ type: 'thread/pending' });
      try {
        const payload = await fetchDirectMessageThread(threadId);
        dispatch({ type: 'thread/success', payload: payload?.thread ?? null });
        return payload?.thread ?? null;
      } catch (error) {
        reportClientError(error, 'Failed to load direct message thread', {
          source: 'useDirectMessages.loadThreadDetail',
          threadId
        });
        dispatch({
          type: 'thread/error',
          error:
            error?.status === 403
              ? 'Friend management privileges required.'
              : error?.message || 'Failed to load direct message thread.',
          status: error?.status ?? null
        });
        throw error;
      }
    },
    [dispatch]
  );

  const selectThread = useCallback(
    (threadId) => {
      dispatch({ type: 'thread/select', threadId });
      if (threadId) {
        loadThreadDetail(threadId).catch(() => {});
      }
    },
    [dispatch, loadThreadDetail]
  );

  return { loadThreadDetail, selectThread };
}
