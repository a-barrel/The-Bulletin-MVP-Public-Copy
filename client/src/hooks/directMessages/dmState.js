export const initialState = {
  viewer: null,
  threads: [],
  selectedThreadId: '',
  threadDetail: null,
  isLoadingThreads: false,
  threadsStatus: null,
  isLoadingThread: false,
  threadStatus: null,
  isSending: false,
  sendStatus: null,
  isCreating: false,
  createStatus: null,
  hasAccess: null,
  lastErrorStatus: null
};

export const buildOptimisticMessage = ({ body, sender }) => ({
  id: `optimistic-${Date.now()}`,
  body,
  sender: sender || null,
  attachments: [],
  createdAt: new Date().toISOString(),
  optimistic: true
});

export const dmReducer = (state, action) => {
  switch (action.type) {
    case 'threads/pending':
      return {
        ...state,
        isLoadingThreads: true,
        threadsStatus: null,
        lastErrorStatus: null
      };
    case 'threads/success':
      return {
        ...state,
        isLoadingThreads: false,
        threadsStatus: { type: 'success' },
        threads: action.payload.threads || [],
        viewer: action.payload.viewer || null,
        hasAccess: true,
        lastErrorStatus: null
      };
    case 'threads/error':
      return {
        ...state,
        isLoadingThreads: false,
        threadsStatus: { type: 'error', message: action.error },
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? state.lastErrorStatus
      };
    case 'thread/select':
      return {
        ...state,
        selectedThreadId: action.threadId,
        threadStatus: null,
        threadDetail:
          state.threadDetail && state.threadDetail.id === action.threadId
            ? state.threadDetail
            : null
      };
    case 'thread/pending':
      return {
        ...state,
        isLoadingThread: true,
        threadStatus: null
      };
    case 'thread/success':
      return {
        ...state,
        isLoadingThread: false,
        threadStatus: { type: 'success' },
        threadDetail: action.payload
      };
    case 'thread/error':
      return {
        ...state,
        isLoadingThread: false,
        threadStatus: { type: 'error', message: action.error },
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? state.lastErrorStatus
      };
    case 'thread/optimistic-message':
      if (!state.threadDetail || state.threadDetail.id !== action.threadId) {
        return state;
      }
      return {
        ...state,
        threadDetail: {
          ...state.threadDetail,
          messages: [action.message, ...(state.threadDetail.messages || [])]
        }
      };
    case 'thread/remove-optimistic-message':
      if (!state.threadDetail || state.threadDetail.id !== action.threadId) {
        return state;
      }
      return {
        ...state,
        threadDetail: {
          ...state.threadDetail,
          messages: (state.threadDetail.messages || []).filter(
            (message) => message.id !== action.optimisticId
          )
        }
      };
    case 'send/pending':
      return {
        ...state,
        isSending: true,
        sendStatus: null
      };
    case 'send/success':
      return {
        ...state,
        isSending: false,
        sendStatus: { type: 'success', message: action.message },
        hasAccess: true,
        lastErrorStatus: null
      };
    case 'send/error':
      return {
        ...state,
        isSending: false,
        sendStatus: { type: 'error', message: action.error },
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? state.lastErrorStatus
      };
    case 'send/reset':
      return {
        ...state,
        sendStatus: null
      };
    case 'create/pending':
      return {
        ...state,
        isCreating: true,
        createStatus: null
      };
    case 'create/success':
      return {
        ...state,
        isCreating: false,
        createStatus: { type: 'success', message: action.message },
        threads: action.payload.threads,
        selectedThreadId: action.payload.selectedThreadId,
        threadDetail: action.payload.threadDetail || state.threadDetail,
        hasAccess: true,
        lastErrorStatus: null
      };
    case 'create/error':
      return {
        ...state,
        isCreating: false,
        createStatus: { type: 'error', message: action.error },
        hasAccess: action.status === 403 ? false : state.hasAccess,
        lastErrorStatus: action.status ?? state.lastErrorStatus
      };
    case 'create/reset':
      return {
        ...state,
        createStatus: null
      };
    default:
      return state;
  }
};
