import { useReducer } from 'react';

import {
  moderationReducer,
  initialState
} from './moderation/moderationState';
import useModerationOverviewData from './moderation/useModerationOverviewData';
import useModerationHistoryData from './moderation/useModerationHistoryData';
import useModerationActions from './moderation/useModerationActions';

export default function useModerationTools({ autoLoad = true } = {}) {
  const [state, dispatch] = useReducer(moderationReducer, initialState);

  const { loadOverview } = useModerationOverviewData({ dispatch, autoLoad });
  const { loadHistory, selectUser } = useModerationHistoryData({ dispatch });
  const { recordAction, resetActionStatus, setActionStatus } = useModerationActions({
    dispatch,
    hasAccess: state.hasAccess,
    loadOverview,
    loadHistory
  });

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
