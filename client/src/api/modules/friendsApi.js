import { apiGet, apiPost, apiDelete, apiPatch } from '../httpClient';

export const fetchFriendOverview = () => apiGet('/api/debug/friends/overview');

export const sendFriendRequest = ({ targetUserId, message }) =>
  apiPost('/api/debug/friends/request', { targetUserId, message });

export const respondToFriendRequest = (requestId, decision) => {
  if (!requestId) throw new Error('requestId is required to respond to a friend request');
  return apiPost(`/api/debug/friends/requests/${encodeURIComponent(requestId)}/respond`, { decision });
};

export const cancelFriendRequest = (requestId) => {
  if (!requestId) throw new Error('requestId is required to cancel a friend request');
  return apiDelete(`/api/debug/friends/requests/${encodeURIComponent(requestId)}`);
};

export const removeFriendRelationship = (friendId) => {
  if (!friendId) throw new Error('friendId is required to remove a friend');
  return apiDelete(`/api/debug/friends/${encodeURIComponent(friendId)}`);
};

export const fetchDirectMessageThreads = () => apiGet('/api/debug/direct-messages/threads');

export const fetchDirectMessageThread = (threadId) => {
  if (!threadId) throw new Error('threadId is required to load a direct message thread');
  return apiGet(`/api/debug/direct-messages/threads/${encodeURIComponent(threadId)}`);
};

export const createDirectMessageThread = ({ participantIds, topic, initialMessage }) =>
  apiPost('/api/debug/direct-messages/threads', { participantIds, topic, initialMessage });

export const sendDirectMessage = (threadId, { body, attachments }) => {
  if (!threadId) throw new Error('threadId is required to send a direct message');
  return apiPost(`/api/debug/direct-messages/threads/${encodeURIComponent(threadId)}/messages`, {
    body,
    attachments
  });
};

export const updateDirectMessageReaction = (threadId, messageId, emoji) => {
  if (!threadId) throw new Error('threadId is required to react to a direct message');
  if (!messageId) throw new Error('messageId is required to react to a direct message');
  return apiPatch(
    `/api/debug/direct-messages/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(
      messageId
    )}/reactions`,
    { emoji }
  );
};
