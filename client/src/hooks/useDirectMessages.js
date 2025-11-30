import { useCallback, useReducer } from 'react';
import reportClientError from '../utils/reportClientError';
import { CHAT_REACTION_OPTIONS } from '../constants/chatReactions';

import {
  createDirectMessageThread,
  sendDirectMessage,
  updateDirectMessageReaction
} from '../api';
import { dmReducer, initialState, buildOptimisticMessage } from './directMessages/dmState';
import useDmThreadsData from './directMessages/useDmThreadsData';
import useDmThreadDetail from './directMessages/useDmThreadDetail';

const ALLOWED_REACTION_KEYS = new Set(CHAT_REACTION_OPTIONS.map((option) => option.key));

const toggleReactionLocally = (message, emojiKey) => {
  if (!message) {
    return message;
  }
  const allowedReaction = emojiKey && ALLOWED_REACTION_KEYS.has(emojiKey) ? emojiKey : null;
  const existingReactions = Array.isArray(message?.reactions?.viewerReactions)
    ? message.reactions.viewerReactions
    : message?.reactions?.viewerReaction
      ? [message.reactions.viewerReaction]
      : [];
  const counts = { ...(message?.reactions?.counts || {}) };

  const nextSet = new Set(existingReactions);
  if (allowedReaction) {
    if (nextSet.has(allowedReaction)) {
      counts[allowedReaction] = Math.max(0, Number(counts[allowedReaction] || 0) - 1);
      nextSet.delete(allowedReaction);
    } else {
      counts[allowedReaction] = Math.max(0, Number(counts[allowedReaction] || 0)) + 1;
      nextSet.add(allowedReaction);
    }
  }

  const normalizedCounts = Object.fromEntries(
    Object.entries(counts).filter(([, value]) => Number.isFinite(value) && value > 0)
  );
  const viewerReactions = Array.from(nextSet);

  return {
    ...message,
    reactions: {
      counts: normalizedCounts,
      viewerReaction: viewerReactions[0],
      viewerReactions
    }
  };
};

export default function useDirectMessages({ autoLoad = true, enabled = true } = {}) {
  const [state, dispatch] = useReducer(dmReducer, initialState);

  const { loadThreads } = useDmThreadsData({ dispatch, autoLoad, enabled });
  const { loadThreadDetail, selectThread } = useDmThreadDetail({ dispatch });

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
        dispatch({ type: 'send/success' });
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

        const refreshed = enabled ? await loadThreads() : null;
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
    [enabled, loadThreads, loadThreadDetail, state.hasAccess, state.threads, state.selectedThreadId]
  );

  const toggleReaction = useCallback(
    async ({ threadId, messageId, emoji }) => {
      const normalizedMessageId = messageId ? String(messageId) : '';
      if (!threadId || !normalizedMessageId) {
        dispatch({
          type: 'thread/status',
          payload: { type: 'error', message: 'Select a message before reacting.' }
        });
        return false;
      }
      if (state.hasAccess === false) {
        dispatch({
          type: 'thread/status',
          payload: { type: 'error', message: 'Friend management privileges required.' }
        });
        return false;
      }

      const currentMessage =
        state.threadDetail && state.threadDetail.id === threadId
          ? (state.threadDetail.messages || []).find((message) => {
              const currentId = message.id || message._id;
              return currentId && String(currentId) === normalizedMessageId;
            })
          : null;

      const rollbackMessage = currentMessage || null;
      if (currentMessage) {
        dispatch({
          type: 'thread/update-message',
          threadId,
          message: toggleReactionLocally(currentMessage, emoji)
        });
      }

      dispatch({ type: 'thread/status', payload: null });
      try {
        const response = await updateDirectMessageReaction(
          threadId,
          normalizedMessageId,
          emoji
        );
        const nextMessage = response?.message || null;
        if (nextMessage) {
          dispatch({ type: 'thread/update-message', threadId, message: nextMessage });
        } else if (!currentMessage) {
          await loadThreadDetail(threadId);
        }
        return true;
      } catch (error) {
        reportClientError(error, 'Failed to update direct message reaction', {
          source: 'useDirectMessages.toggleReaction',
          threadId,
          messageId: normalizedMessageId
        });
        if (rollbackMessage) {
          dispatch({ type: 'thread/update-message', threadId, message: rollbackMessage });
        }
        dispatch({
          type: 'thread/status',
          payload: {
            type: 'error',
            message:
              error?.status === 403
                ? 'Friend management privileges required.'
                : error?.message || 'Failed to update reaction.'
          }
        });
        return false;
      }
    },
    [loadThreadDetail, state.hasAccess, state.threadDetail]
  );

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
    resetCreateStatus,
    toggleReaction
  };
}
