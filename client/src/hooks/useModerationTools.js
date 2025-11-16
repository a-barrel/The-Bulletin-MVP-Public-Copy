import { useCallback, useEffect, useReducer } from 'react';

import {
  fetchModerationHistory,
  fetchModerationOverview,
  submitModerationAction
} from '../api/mongoDataApi';
import reportClientError from '../utils/reportClientError';
import {
  moderationReducer,
  initialState,
  buildOptimisticAction
} from './moderation/moderationState';

const buildAccessDeniedError = () => {
  const error = new Error('Moderator privileges required.');
  error.status = 403;
  return error;
};

export default function useModerationTools({ autoLoad = true } = {}) {
  const [state, dispatch] = useReducer(moderationReducer, initialState);

  const loadOverview = useCallback(async () => {
    dispatch({ type: 'overview/pending' });
    try {
      const payload = await fetchModerationOverview();
      dispatch({ type: 'overview/success', payload });
      return payload;
    } catch (error) {
      dispatch({
        type: 'overview/error',
        error:
          error?.status === 403
            ? 'Moderator privileges required.'
            : error?.message || 'Failed to load moderation overview.',
        status: error?.status ?? null
      });
      reportClientError(error, 'Failed to load moderation overview.', {
        hook: 'useModerationTools',
        step: 'loadOverview'
      });
      throw error;
    }
  }, []);

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
    []
  );

  const selectUser = useCallback(
    (userId) => {
      dispatch({ type: 'select-user', userId });
      if (userId) {
        loadHistory(userId).catch(() => {});
      }
    },
    [loadHistory]
  );

  const recordAction = useCallback(
    async ({ userId, type, reason, durationMinutes }) => {
      if (!userId) {
        const error = new Error('Select a user before performing an action.');
        dispatch({ type: 'action/error', error: error.message, userId: '', optimisticId: null });
        throw error;
      }

      if (state.hasAccess === false) {
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
    [loadOverview, loadHistory, state.hasAccess]
  );

  const resetActionStatus = useCallback(() => {
    dispatch({ type: 'action/reset' });
  }, []);

  const setActionStatus = useCallback((status) => {
    dispatch({ type: 'action/custom', payload: status });
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadOverview().catch(() => {});
    }
  }, [autoLoad, loadOverview]);

  const history = state.selectedUserId ? state.historyByUser[state.selectedUserId] || [] : [];

  return {
    overview: state.overview,
    overviewStatus: state.overviewStatus,
    isLoadingOverview: state.isLoadingOverview,
    viewer: state.viewer,
    hasAccess: state.hasAccess,
    lastErrorStatus: state.lastErrorStatus,
    history,
    historyStatus: state.historyStatus,
    isLoadingHistory: state.isLoadingHistory,
    selectedUserId: state.selectedUserId,
    selectUser,
    loadOverview,
    loadHistory,
    recordAction,
    isSubmitting: state.isSubmitting,
    actionStatus: state.actionStatus,
    resetActionStatus,
    setActionStatus,
    lastOptimisticActionId: state.lastOptimisticActionId
  };
}
