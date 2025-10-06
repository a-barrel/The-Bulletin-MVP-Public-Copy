import { auth } from '../firebase';
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function resolveApiBaseUrl() {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  // In development we proxy to the local server.
  if (import.meta.env.DEV) {
    return '';
  }

  return '';
}

async function resolveAuthToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  // TODO: Should we cache this token and refresh it in the background?
  return currentUser.getIdToken();
}

async function buildHeaders(extra = {}) {
  const token = await resolveAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

export function isMongoDataApiConfigured() {
  if (!API_BASE_URL && !import.meta.env.DEV) {
    console.warn('Using relative API base URL. Set VITE_API_BASE_URL to your Render backend when deploying.');
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

export async function createPin(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to create pin');
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