const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const FALLBACK_TOKEN = import.meta.env.VITE_API_ACCESS_TOKEN ?? 'demo-token'; //unsure if this exsists in the .env or what this is suppost to be at all :(

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

function resolveAuthToken() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('pinpointAuthToken');
    if (stored) {
      return stored;
    }
  }

  return FALLBACK_TOKEN;
}

function buildHeaders(extra = {}) {
  const token = resolveAuthToken();
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
    headers: buildHeaders(),
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
    headers: buildHeaders()
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
    headers: buildHeaders(),
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
    headers: buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load pin');
  }

  return payload;
}
