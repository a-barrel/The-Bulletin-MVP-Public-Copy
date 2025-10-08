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

async function buildHeaders(extra = {}) {
  const token = await resolveAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
