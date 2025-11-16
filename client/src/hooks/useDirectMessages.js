import { useCallback, useEffect, useReducer } from 'react';
import reportClientError from '../utils/reportClientError';

import {
  createDirectMessageThread,
  fetchDirectMessageThread,
  fetchDirectMessageThreads,
  sendDirectMessage
} from '../api/mongoDataApi';
import { dmReducer, initialState, buildOptimisticMessage } from './directMessages/dmState';

export default function useDirectMessages({ autoLoad = true } = {}) {
  const [state, dispatch] = useReducer(dmReducer, initialState);

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

      if (state.hasAccess === false) {
        const error = new Error('Friend management privileges required.');
        dispatch({ type: 'send/error', error: error.message, status: 403 });
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
        reportClientError(error, 'Failed to send direct message', {
          source: 'useDirectMessages.sendMessage',
          threadId
        });
        dispatch({
          type: 'thread/remove-optimistic-message',
          threadId,
          optimisticId: optimisticMessage.id
        });
        dispatch({
          type: 'send/error',
          error:
            error?.status === 403
              ? 'Friend management privileges required.'
              : error?.message || 'Failed to send direct message.',
          status: error?.status ?? null
        });
        throw error;
      }
    },
    [loadThreadDetail, state.hasAccess]
  );

  const createThread = useCallback(
    async ({ participantIds, topic, initialMessage }) => {
      if (!participantIds || participantIds.length === 0) {
        const error = new Error('Add at least one participant.');
        dispatch({ type: 'create/error', error: error.message });
        throw error;
      }

      if (state.hasAccess === false) {
        const error = new Error('Friend management privileges required.');
        dispatch({ type: 'create/error', error: error.message, status: 403 });
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
        reportClientError(error, 'Failed to create direct message thread', {
          source: 'useDirectMessages.createThread',
          participantCount: participantIds.length
        });
        dispatch({
          type: 'create/error',
          error:
            error?.status === 403
              ? 'Friend management privileges required.'
              : error?.message || 'Failed to create direct message thread.',
          status: error?.status ?? null
        });
        throw error;
      }
    },
    [loadThreads, loadThreadDetail, state.hasAccess, state.threads, state.selectedThreadId]
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
    hasAccess: state.hasAccess,
    lastErrorStatus: state.lastErrorStatus,
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
