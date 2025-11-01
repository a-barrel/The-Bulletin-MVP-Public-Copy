import { useCallback, useEffect, useReducer } from 'react';

import {
  createDirectMessageThread,
  fetchDirectMessageThread,
  fetchDirectMessageThreads,
  sendDirectMessage
} from '../api/mongoDataApi';

const initialState = {
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
  createStatus: null
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'threads/pending':
      return {
        ...state,
        isLoadingThreads: true,
        threadsStatus: null
      };
    case 'threads/success':
      return {
        ...state,
        isLoadingThreads: false,
        threadsStatus: { type: 'success' },
        threads: action.payload.threads || [],
        viewer: action.payload.viewer || null
      };
    case 'threads/error':
      return {
        ...state,
        isLoadingThreads: false,
        threadsStatus: { type: 'error', message: action.error }
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
        threadStatus: { type: 'error', message: action.error }
      };
    case 'thread/optimistic-message': {
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
    }
    case 'thread/remove-optimistic-message': {
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
    }
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
        sendStatus: { type: 'success', message: action.message }
      };
    case 'send/error':
      return {
        ...state,
        isSending: false,
        sendStatus: { type: 'error', message: action.error }
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
        threadDetail: action.payload.threadDetail || state.threadDetail
      };
    case 'create/error':
      return {
        ...state,
        isCreating: false,
        createStatus: { type: 'error', message: action.error }
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

const buildOptimisticMessage = ({ body, sender }) => ({
  id: `optimistic-${Date.now()}`,
  body,
  sender: sender || null,
  attachments: [],
  createdAt: new Date().toISOString(),
  optimistic: true
});

export default function useDirectMessages({ autoLoad = true } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadThreads = useCallback(async () => {
    dispatch({ type: 'threads/pending' });
    try {
      const payload = await fetchDirectMessageThreads();
      dispatch({ type: 'threads/success', payload });
      return payload;
    } catch (error) {
      dispatch({
        type: 'threads/error',
        error: error?.message || 'Failed to load direct message threads.'
      });
      throw error;
    }
  }, []);

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
        dispatch({
          type: 'thread/error',
          error: error?.message || 'Failed to load direct message thread.'
        });
        throw error;
      }
    },
    []
  );

  const selectThread = useCallback(
    (threadId) => {
      dispatch({ type: 'thread/select', threadId });
      if (threadId) {
        loadThreadDetail(threadId).catch(() => {});
      }
    },
    [loadThreadDetail]
  );

  const sendMessageAction = useCallback(
    async ({ threadId, body, attachments, sender }) => {
      if (!threadId) {
        const error = new Error('Select a thread before sending a message.');
        dispatch({ type: 'send/error', error: error.message });
        throw error;
      }
      if (!body || !body.trim()) {
        const error = new Error('Message body cannot be empty.');
        dispatch({ type: 'send/error', error: error.message });
        throw error;
      }

      const optimisticMessage = buildOptimisticMessage({ body, sender });
      dispatch({ type: 'thread/optimistic-message', threadId, message: optimisticMessage });
      dispatch({ type: 'send/pending' });

      try {
        const response = await sendDirectMessage(threadId, { body, attachments });
        dispatch({
          type: 'thread/remove-optimistic-message',
          threadId,
          optimisticId: optimisticMessage.id
        });
        dispatch({ type: 'send/success', message: 'Message sent.' });
        await loadThreadDetail(threadId);
        return response;
      } catch (error) {
        dispatch({
          type: 'thread/remove-optimistic-message',
          threadId,
          optimisticId: optimisticMessage.id
        });
        dispatch({
          type: 'send/error',
          error: error?.message || 'Failed to send direct message.'
        });
        throw error;
      }
    },
    [loadThreadDetail]
  );

  const createThread = useCallback(
    async ({ participantIds, topic, initialMessage }) => {
      if (!participantIds || participantIds.length === 0) {
        const error = new Error('Add at least one participant.');
        dispatch({ type: 'create/error', error: error.message });
        throw error;
      }

      dispatch({ type: 'create/pending' });
      try {
        const response = await createDirectMessageThread({
          participantIds,
          topic,
          initialMessage
        });

        const refreshed = await loadThreads();
        const newThreadId = response?.thread?.id;
        let threadDetail = null;
        if (newThreadId) {
          threadDetail = await loadThreadDetail(newThreadId);
        }

        dispatch({
          type: 'create/success',
          message: 'Thread created.',
          payload: {
            threads: refreshed?.threads || state.threads,
            selectedThreadId: newThreadId || state.selectedThreadId,
            threadDetail: threadDetail || response?.thread
          }
        });

        return response;
      } catch (error) {
        dispatch({
          type: 'create/error',
          error: error?.message || 'Failed to create direct message thread.'
        });
        throw error;
      }
    },
    [loadThreads, loadThreadDetail, state.threads, state.selectedThreadId]
  );

  useEffect(() => {
    if (autoLoad) {
      loadThreads().catch(() => {});
    }
  }, [autoLoad, loadThreads]);

  const resetSendStatus = useCallback(() => {
    dispatch({ type: 'send/reset' });
  }, []);

  const resetCreateStatus = useCallback(() => {
    dispatch({ type: 'create/reset' });
  }, []);

  return {
    viewer: state.viewer,
    threads: state.threads,
    refreshThreads: loadThreads,
    isLoadingThreads: state.isLoadingThreads,
    threadsStatus: state.threadsStatus,
    selectedThreadId: state.selectedThreadId,
    selectThread,
    threadDetail: state.threadDetail,
    isLoadingThread: state.isLoadingThread,
    threadStatus: state.threadStatus,
    loadThreadDetail,
    isSending: state.isSending,
    sendStatus: state.sendStatus,
    sendMessage: sendMessageAction,
    resetSendStatus,
    isCreating: state.isCreating,
    createStatus: state.createStatus,
    createThread,
    resetCreateStatus
  };
}
