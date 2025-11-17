import { useCallback } from 'react';
import { fetchModerationHistory } from '../../api/mongoDataApi';
import reportClientError from '../../utils/reportClientError';

export default function useModerationHistoryData({ dispatch }) {
  const loadHistory = useCallback(
    async (userId) => {
      if (!userId) {
        dispatch({
          type: 'history/error',
          error: 'Select a user to load moderation history.'
        });
        return null;
      }
      dispatch({ type: 'history/pending' });
      try {
        const payload = await fetchModerationHistory(userId);
        const history = Array.isArray(payload?.history) ? payload.history : [];
        dispatch({ type: 'history/success', payload: history, userId });
        return history;
      } catch (error) {
        dispatch({
          type: 'history/error',
          error:
            error?.status === 403
              ? 'Moderator privileges required.'
              : error?.message || 'Failed to load moderation history.',
          status: error?.status ?? null
        });
        reportClientError(error, 'Failed to load moderation history.', {
          hook: 'useModerationTools',
          step: 'loadHistory',
          userId
        });
        throw error;
      }
    },
    [dispatch]
  );

  const selectUser = useCallback(
    (userId) => {
      dispatch({ type: 'select-user', userId });
      if (userId) {
        loadHistory(userId).catch(() => {});
      }
    },
    [dispatch, loadHistory]
  );

  return { loadHistory, selectUser };
}
