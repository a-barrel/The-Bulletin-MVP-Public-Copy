export const initialState = {
  overview: null,
  overviewStatus: null,
  isLoadingOverview: false,
  viewer: null,
  hasAccess: null,
  lastErrorStatus: null,
  historyByUser: {},
  historyStatus: null,
  isLoadingHistory: false,
  selectedUserId: '',
  isSubmitting: false,
  actionStatus: null,
  lastOptimisticActionId: null
};

export const moderationReducer = (state, action) => {
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
        overviewStatus: null,
        lastErrorStatus: null
      };
    case 'overview/success':
      return {
        ...state,
        isLoadingOverview: false,
        overview: action.payload,
        overviewStatus: { type: 'success' },
        viewer: action.payload?.viewer ?? null,
        hasAccess: true,
        lastErrorStatus: null
      };
    case 'overview/error':
      return {
        ...state,
        isLoadingOverview: false,
        overviewStatus: { type: 'error', message: action.error },
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? null,
        viewer: action.status === 403 ? null : state.viewer,
        overview: action.status === 403 ? null : state.overview
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
        historyStatus: { type: 'error', message: action.error },
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? state.lastErrorStatus
      };
    case 'action/pending':
      return {
        ...state,
        isSubmitting: true,
        actionStatus: null,
        lastOptimisticActionId: action.optimistic?.id,
        historyByUser:
          action.optimistic && action.userId
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
        actionStatus: action.message ? { type: 'success', message: action.message } : null,
        lastOptimisticActionId: null,
        hasAccess: true,
        lastErrorStatus: null
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
        lastOptimisticActionId: null,
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? state.lastErrorStatus
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

export const buildOptimisticAction = ({ userId, type, reason }) => ({
  id: `optimistic-${Date.now()}`,
  type,
  reason: reason || '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subject: { id: userId },
  moderator: null,
  optimistic: true
});
