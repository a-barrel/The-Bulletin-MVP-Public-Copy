import { useCallback } from 'react';
import { submitModerationAction } from '../../api';
import reportClientError from '../../utils/reportClientError';
import { buildOptimisticAction } from './moderationState';

const buildAccessDeniedError = () => {
  const error = new Error('Moderator privileges required.');
  error.status = 403;
  return error;
};

export default function useModerationActions({
  dispatch,
  hasAccess,
  loadOverview,
  loadHistory
}) {
  const recordAction = useCallback(
    async ({ userId, type, reason, durationMinutes }) => {
      if (!userId) {
        const error = new Error('Select a user before performing an action.');
        dispatch({ type: 'action/error', error: error.message, userId: '', optimisticId: null });
        throw error;
      }

      if (hasAccess === false) {
        const disabled = buildAccessDeniedError();
        dispatch({
          type: 'action/error',
          userId,
          optimisticId: null,
          error: disabled.message,
          status: disabled.status ?? 403
        });
        throw disabled;
      }

      const optimisticAction = buildOptimisticAction({ userId, type, reason });
      dispatch({
        type: 'action/pending',
        optimistic: optimisticAction,
        userId
      });

      try {
        const response = await submitModerationAction({
          userId,
          type,
          reason,
          durationMinutes
        });

        dispatch({
          type: 'action/success',
          message: `Action "${type}" recorded.`
        });

        await Promise.all([loadOverview(), loadHistory(userId)]);

        return response;
      } catch (error) {
        dispatch({
          type: 'action/error',
          userId,
          optimisticId: optimisticAction.id,
          error:
            error?.status === 403
              ? 'Moderator privileges required.'
              : error?.message || 'Failed to record moderation action.',
          status: error?.status ?? null
        });
        reportClientError(error, 'Failed to record moderation action.', {
          hook: 'useModerationTools',
          step: 'recordAction',
          userId,
          actionType: type
        });
        throw error;
      }
    },
    [dispatch, hasAccess, loadHistory, loadOverview]
  );

  const resetActionStatus = useCallback(() => {
    dispatch({ type: 'action/reset' });
  }, [dispatch]);

  const setActionStatus = useCallback(
    (status) => {
      dispatch({ type: 'action/custom', payload: status });
    },
    [dispatch]
  );

  return { recordAction, resetActionStatus, setActionStatus };
}
