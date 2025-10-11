import { auth } from '../firebase';
import runtimeConfig from '../config/runtime';

const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');

function resolveApiBaseUrl() {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  // In offline/dev mode we proxy to the local server.
  if (runtimeConfig.isOffline || import.meta.env.DEV) {
    return '';
  }

  return '';
}

async function resolveAuthToken() {
  if (runtimeConfig.isOffline) {
    return runtimeConfig.fallbackToken;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  return currentUser.getIdToken();
}

async function buildHeaders(extra = {}, options = {}) {
  const token = await resolveAuthToken();
  const headers = {};

  if (!options.skipJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    ...headers,
    ...extra
  };
}

export function isMongoDataApiConfigured() {
  if (!API_BASE_URL && runtimeConfig.isOnline) {
    console.warn(
      'Using relative API base URL while in online mode. Set VITE_API_BASE_URL (or legacy VITE_API_URL) to your Render backend when deploying.'
    );
  }
  return true;
}

export async function insertLocationUpdate(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/locations`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to update location');
  }

  return payload;
}

export async function fetchNearbyUsers(query) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams({
    longitude: String(query.longitude),
    latitude: String(query.latitude)
  });

  if (query.maxDistance !== undefined) {
    params.set('maxDistance', String(query.maxDistance));
  }

  const response = await fetch(`${baseUrl}/api/locations/nearby?${params.toString()}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load nearby users');
  }

  return payload;
}

export async function fetchPinsNearby({ latitude, longitude, distanceMiles, limit }) {
  if (latitude === undefined || longitude === undefined) {
    throw new Error('Latitude and longitude are required');
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    distanceMiles: String(distanceMiles)
  });

  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const response = await fetch(`${baseUrl}/api/pins/nearby?${params.toString()}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load nearby pins');
  }

  return payload;
}

export async function listPins(query = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();

  if (query.type) {
    params.set('type', query.type);
  }
  if (query.creatorId) {
    params.set('creatorId', query.creatorId);
  }
  if (query.limit) {
    params.set('limit', String(query.limit));
  }

  const queryString = params.toString();
  const url = queryString ? `${baseUrl}/api/pins?${queryString}` : `${baseUrl}/api/pins`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load pins');
  }

  return payload;
}

export async function createPin(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload?.issues)
      ? `: ${payload.issues.map((issue) => `${issue.path?.join('.') ?? ''} ${issue.message}`.trim()).join('; ')}`
      : '';
    throw new Error((payload?.message || 'Failed to create pin') + details);
  }

  return payload;
}

export async function fetchPinById(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load pin');
  }

  return payload;
}

export async function updatePin(pinId, input) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}`, {
    method: 'PUT',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload?.issues)
      ? `: ${payload.issues.map((issue) => `${issue.path?.join('.') ?? ''} ${issue.message}`.trim()).join('; ')}`
      : '';
    throw new Error((payload?.message || 'Failed to update pin') + details);
  }

  return payload;
}

export async function uploadPinImage(file) {
  if (!file) {
    throw new Error('Image file is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${baseUrl}/api/media/images`, {
    method: 'POST',
    headers: await buildHeaders({}, { skipJson: true }),
    body: formData
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to upload image');
  }

  return payload;
}

export async function fetchLocationHistory(userId) {
  if (!userId) {
    throw new Error('User id is required to load location history');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/locations/history/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load location history');
  }

  return payload;
}

export async function createUserProfile(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/users`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create user');
  }

  return payload;
}

export async function updateUserProfile(userId, input) {
  if (!userId) {
    throw new Error('User id is required to update a profile');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to update user');
  }

  return payload;
}

export async function fetchUsers({ search, limit } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (search) {
    params.set('search', search);
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const url = query ? `${baseUrl}/api/users?${query}` : `${baseUrl}/api/users`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load users');
  }

  return payload;
}

export async function fetchUserProfile(userId) {
  if (!userId) {
    throw new Error('User id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load user profile');
  }

  return payload;
}

export async function createBookmark(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/bookmarks`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create bookmark');
  }

  return payload;
}

export async function fetchBookmarks({ userId, limit } = {}) {
  if (!userId) {
    throw new Error('User id is required to load bookmarks');
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams({
    userId: userId
  });
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const response = await fetch(`${baseUrl}/api/bookmarks?${params.toString()}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load bookmarks');
  }

  return payload;
}

export async function createBookmarkCollection(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/bookmark-collections`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create bookmark collection');
  }

  return payload;
}

export async function fetchBookmarkCollections(userId) {
  if (!userId) {
    throw new Error('User id is required to load bookmark collections');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/bookmarks/collections?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load bookmark collections');
  }

  return payload;
}

export async function createProximityChatRoom(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/chat-rooms`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create chat room');
  }

  return payload;
}

export async function fetchChatRooms({ pinId, ownerId } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (pinId) {
    params.set('pinId', pinId);
  }
  if (ownerId) {
    params.set('ownerId', ownerId);
  }

  const query = params.toString();
  const url = query ? `${baseUrl}/api/chats/rooms?${query}` : `${baseUrl}/api/chats/rooms`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load chat rooms');
  }

  return payload;
}

export async function createProximityChatMessage(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/chat-messages`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create chat message');
  }

  return payload;
}

export async function fetchChatMessages(roomId) {
  if (!roomId) {
    throw new Error('Room id is required to load messages');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load chat messages');
  }

  return payload;
}

export async function createProximityChatPresence(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/chat-presence`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to record chat presence');
  }

  return payload;
}

export async function fetchChatPresence(roomId) {
  if (!roomId) {
    throw new Error('Room id is required to load presence');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/presence`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load chat presence');
  }

  return payload;
}

export async function createUpdate(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/updates`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create update');
  }

  return payload;
}

export async function fetchUpdates({ userId, limit } = {}) {
  if (!userId) {
    throw new Error('User id is required to load updates');
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams({
    userId: userId
  });
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const response = await fetch(`${baseUrl}/api/updates?${params.toString()}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load updates');
  }

  return payload;
}

export async function createReply(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/replies`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create reply');
  }

  return payload;
}

export async function fetchReplies(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required to load replies');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}/replies`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load replies');
  }

  return payload;
}
