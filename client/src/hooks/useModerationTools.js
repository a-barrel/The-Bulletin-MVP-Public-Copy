import { useCallback, useEffect, useReducer } from 'react';

import {
  fetchModerationHistory,
  fetchModerationOverview,
  submitModerationAction
} from '../api/mongoDataApi';

const initialState = {
  overview: null,
  overviewStatus: null,
  isLoadingOverview: false,
  historyByUser: {},
  historyStatus: null,
  isLoadingHistory: false,
  selectedUserId: '',
  isSubmitting: false,
  actionStatus: null,
  lastOptimisticActionId: null
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'select-user':
      return {
        ...state,
        selectedUserId: action.userId,
        historyStatus: null
      };
    case 'overview/pending':
      return {
        ...state,
        isLoadingOverview: true,
        overviewStatus: null
      };
    case 'overview/success':
      return {
        ...state,
        isLoadingOverview: false,
        overview: action.payload,
        overviewStatus: { type: 'success' }
      };
    case 'overview/error':
      return {
        ...state,
        isLoadingOverview: false,
        overviewStatus: { type: 'error', message: action.error }
      };
    case 'history/pending':
      return {
        ...state,
        isLoadingHistory: true,
        historyStatus: null
      };
    case 'history/success':
      return {
        ...state,
        isLoadingHistory: false,
        historyByUser: {
          ...state.historyByUser,
          [action.userId]: action.payload
        },
        historyStatus: { type: 'success' }
      };
    case 'history/error':
      return {
        ...state,
        isLoadingHistory: false,
        historyStatus: { type: 'error', message: action.error }
      };
    case 'action/pending':
      return {
        ...state,
        isSubmitting: true,
        actionStatus: null,
        lastOptimisticActionId: action.optimistic?.id,
        historyByUser: action.optimistic && action.userId
          ? {
              ...state.historyByUser,
              [action.userId]: [
                action.optimistic,
                ...(state.historyByUser[action.userId] || [])
              ]
            }
          : state.historyByUser
      };
    case 'action/success':
      return {
        ...state,
        isSubmitting: false,
        actionStatus: action.message
          ? { type: 'success', message: action.message }
          : null,
        lastOptimisticActionId: null
      };
    case 'action/error': {
      const { userId, optimisticId, error } = action;
      const existingHistory = state.historyByUser[userId] || [];
      const filteredHistory = optimisticId
        ? existingHistory.filter((entry) => entry.id !== optimisticId)
        : existingHistory;
      return {
        ...state,
        isSubmitting: false,
        actionStatus: { type: 'error', message: error },
        historyByUser: {
          ...state.historyByUser,
          [userId]: filteredHistory
        },
        lastOptimisticActionId: null
      };
    }
    case 'action/reset':
      return {
        ...state,
        actionStatus: null
      };
    case 'action/custom':
      return {
        ...state,
        actionStatus: action.payload
      };
    default:
      return state;
  }
};

const buildOptimisticAction = ({ userId, type, reason }) => ({
  id: `optimistic-${Date.now()}`,
  type,
  reason: reason || '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subject: { id: userId },
  moderator: null,
  optimistic: true
});

export default function useModerationTools({ autoLoad = true } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadOverview = useCallback(async () => {
    dispatch({ type: 'overview/pending' });
    try {
      const payload = await fetchModerationOverview();
      dispatch({ type: 'overview/success', payload });
      return payload;
    } catch (error) {
      dispatch({
        type: 'overview/error',
        error: error?.message || 'Failed to load moderation overview.'
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
          error: error?.message || 'Failed to load moderation history.'
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
          error: error?.message || 'Failed to record moderation action.'
        });
        throw error;
      }
    },
    [loadOverview, loadHistory]
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
