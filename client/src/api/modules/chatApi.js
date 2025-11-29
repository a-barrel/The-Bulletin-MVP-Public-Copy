import { apiGet, apiPatch, apiPost } from '../httpClient';

export const createProximityChatRoom = (input) => apiPost('/api/debug/chat-rooms', input);
export const createChatRoom = (input) => apiPost('/api/chats/rooms', input);

export const fetchChatRooms = ({ pinId, ownerId, latitude, longitude, includeBookmarked = true, adminView } = {}) => {
  const params = new URLSearchParams();
  if (pinId) params.set('pinId', pinId);
  if (ownerId) params.set('ownerId', ownerId);
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) params.set('latitude', String(latitude));
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) params.set('longitude', String(longitude));
  if (!includeBookmarked) params.set('includeBookmarked', 'false');
  if (adminView) params.set('adminView', 'true');
  const query = params.toString();
  const path = query ? `/api/chats/rooms?${query}` : '/api/chats/rooms';
  return apiGet(path);
};

export const createProximityChatMessage = (input) => apiPost('/api/debug/chat-messages', input);
export const createChatMessage = (roomId, input) => {
  if (!roomId) throw new Error('Room id is required to create a chat message');
  return apiPost(`/api/chats/rooms/${encodeURIComponent(roomId)}/messages`, input);
};

export const fetchChatMessages = (roomId, { latitude, longitude } = {}) => {
  if (!roomId) throw new Error('Room id is required to load messages');
  const params = new URLSearchParams();
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) params.set('latitude', String(latitude));
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) params.set('longitude', String(longitude));
  const query = params.toString();
  const path = query
    ? `/api/chats/rooms/${encodeURIComponent(roomId)}/messages?${query}`
    : `/api/chats/rooms/${encodeURIComponent(roomId)}/messages`;
  return apiGet(path);
};

export const updateChatMessageReaction = (roomId, messageId, emoji, { latitude, longitude } = {}) => {
  if (!roomId || !messageId) {
    throw new Error('Room id and message id are required to react to a message');
  }
  const body = { emoji };
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) body.latitude = latitude;
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) body.longitude = longitude;
  return apiPatch(
    `/api/chats/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/reactions`,
    body
  );
};

export const createProximityChatPresence = (input) => apiPost('/api/debug/chat-presence', input);

export const upsertChatPresence = (roomId, input = {}) => {
  if (!roomId) throw new Error('Room id is required to update presence');
  return apiPost(`/api/chats/rooms/${encodeURIComponent(roomId)}/presence`, input);
};

export const fetchChatPresence = (roomId, { latitude, longitude } = {}) => {
  if (!roomId) throw new Error('Room id is required to load presence');
  const params = new URLSearchParams();
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) params.set('latitude', String(latitude));
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) params.set('longitude', String(longitude));
  const query = params.toString();
  const path = query
    ? `/api/chats/rooms/${encodeURIComponent(roomId)}/presence?${query}`
    : `/api/chats/rooms/${encodeURIComponent(roomId)}/presence`;
  return apiGet(path);
};

export const previewChatGif = (query, { limit = 12 } = {}) => {
  const searchTerm = typeof query === 'string' ? query.trim() : '';
  if (!searchTerm) throw new Error('Enter a search term to preview a GIF.');
  const params = new URLSearchParams();
  params.set('q', searchTerm);
  if (Number.isFinite(limit)) params.set('limit', String(Math.max(1, Math.min(Math.trunc(limit), 20))));
  const path = `/api/chats/gif-search?${params.toString()}`;
  return apiGet(path);
};
