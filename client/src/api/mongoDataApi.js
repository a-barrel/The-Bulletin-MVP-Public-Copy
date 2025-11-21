import { auth } from '../firebase';
import runtimeConfig from '../config/runtime';
import { normalizeReportOffenses } from '../constants/reportOffenseOptions';

const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const DEFAULT_NEARBY_DISTANCE_MILES = Number.isFinite(runtimeConfig.defaultNearbyRadius)
  ? runtimeConfig.defaultNearbyRadius
  : 10;
const API_ERROR_EXPIRY_MS = 30 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetriableNetworkError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if (error.name === 'AbortError' || error.isApiError) {
    return false;
  }
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (error.name && error.name.toLowerCase() === 'typeerror') {
    return true;
  }
  return message.includes('failed to fetch') || message.includes('network request failed');
}

async function withNetworkRetry(fn, { retries = DEFAULT_RETRY_ATTEMPTS, delayMs = DEFAULT_RETRY_DELAY_MS } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < retries && isRetriableNetworkError(error);
      if (!shouldRetry) {
        throw error;
      }
      const backoff = delayMs * Math.max(1, attempt + 1);
      await sleep(backoff);
    }
  }
  throw lastError;
}

function resolveApiBaseUrl() {
  // In dev we rely on Vite's proxy to avoid CORS and absolute origins.
  if (import.meta.env.DEV) {
    return '';
  }

  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  return '';
}

async function resolveAuthToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    return await currentUser.getIdToken();
  } catch (error) {
    const errorCode = typeof error?.code === 'string' ? error.code : '';
    const shouldForceLogout =
      errorCode === 'auth/id-token-revoked' || errorCode === 'auth/user-token-expired';

    if (shouldForceLogout) {
      if (typeof window !== 'undefined') {
        auth.signOut().catch(() => {});
      }
      const sessionError = new Error('Your session expired. Please sign in again.');
      sessionError.isAuthError = true;
      throw sessionError;
    }

    throw error;
  }
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

function parseFilenameFromContentDisposition(headerValue, fallback = 'bookmarks.csv') {
  if (!headerValue) {
    return fallback;
  }

  const match = headerValue.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
  if (!match || !match[1]) {
    return fallback;
  }

  let filename = match[1].trim();
  if (filename.startsWith('"') && filename.endsWith('"')) {
    filename = filename.slice(1, -1);
  }

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename || fallback;
  }
}

function createApiError(response, payload, fallbackMessage) {
  const statusCode = response?.status;
  const defaultMessage =
    fallbackMessage || (statusCode ? `Request failed with status ${statusCode}` : 'Request failed');
  const message =
    (payload && typeof payload === 'object' && payload.message) || defaultMessage;
  const normalizedMessage = String(message || '').toLowerCase();

  const error = new Error(message);
  if (typeof statusCode === 'number') {
    error.status = statusCode;
  }
  if (response?.statusText) {
    error.statusText = response.statusText;
  }
  if (response?.url) {
    error.url = response.url;
  }
  if (payload && typeof payload === 'object') {
    error.payload = payload;
    if (payload.issues) {
      error.issues = payload.issues;
    }
  }
  error.isApiError = true;

  const tokenRevoked =
    normalizedMessage.includes('token') &&
    (normalizedMessage.includes('revoked') ||
      normalizedMessage.includes('expired') ||
      normalizedMessage.includes('invalid'));

  if ((statusCode === 401 || statusCode === 403) && tokenRevoked) {
    error.isAuthError = true;
    error.message = 'Your session expired. Please sign in again.';
    if (typeof window !== 'undefined') {
      auth.signOut().catch(() => {});
    }
  }

  const accountSuspended =
    statusCode === 403 &&
    (payload?.code === 'ACCOUNT_SUSPENDED' || normalizedMessage.includes('suspend'));

  if (accountSuspended) {
    error.isAuthError = true;
    error.code = payload?.code || 'ACCOUNT_SUSPENDED';
    error.message =
      payload?.message || 'Your account has been suspended. Please contact support for help.';
    if (typeof window !== 'undefined') {
      auth.signOut().catch(() => {});
    }
  }

  return error;
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
  // Location sharing between users is disabled; return an empty list.
  return [];
}

export async function fetchPinsNearby({
  latitude,
  longitude,
  distanceMiles,
  limit,
  search,
  types,
  categories,
  status,
  startDate,
  endDate,
  friendEngagements,
  hideFullEvents
}) {
  if (latitude === undefined || longitude === undefined) {
    const error = new Error('Latitude and longitude are required');
    await logClientEvent({
      category: 'client-api-errors',
      message: error.message,
      severity: 'warn',
      context: { endpoint: '/api/pins/nearby', missingCoordinates: true }
    });
    throw error;
  }

  const numericDistance =
    typeof distanceMiles === 'number'
      ? distanceMiles
      : distanceMiles !== undefined && distanceMiles !== null
      ? Number(distanceMiles)
      : null;
  const effectiveDistance =
    Number.isFinite(numericDistance) && numericDistance > 0
      ? numericDistance
      : DEFAULT_NEARBY_DISTANCE_MILES;

  if (!Number.isFinite(numericDistance) || numericDistance <= 0) {
    await logClientEvent({
      category: 'client-api-errors',
      severity: 'warn',
      message: 'Using default distance for nearby pins request.',
      context: {
        endpoint: '/api/pins/nearby',
        providedDistance: distanceMiles,
        fallback: effectiveDistance
      }
    });
  }

  const serializeArray = (value) =>
    Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
  const typeList = serializeArray(types);
  const categoryList = serializeArray(categories);
  const friendEngagementList = serializeArray(friendEngagements);

  try {
    const baseUrl = resolveApiBaseUrl();
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      distanceMiles: String(effectiveDistance)
    });

    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    if (typeof search === 'string' && search.trim()) {
      params.set('search', search.trim());
    }

    if (typeList.length) {
      params.set('types', typeList.join(','));
    }

    if (categoryList.length) {
      params.set('categories', categoryList.join(','));
    }

    if (friendEngagementList.length) {
      params.set('friendEngagements', friendEngagementList.join(','));
    }

    if (status) {
      params.set('status', status);
    }

    if (startDate) {
      params.set('startDate', startDate);
    }

    if (endDate) {
      params.set('endDate', endDate);
    }

    if (typeof hideFullEvents === 'boolean') {
      params.set('hideFullEvents', hideFullEvents ? 'true' : 'false');
    }

    const response = await fetch(`${baseUrl}/api/pins/nearby?${params.toString()}`, {
      method: 'GET',
      headers: await buildHeaders()
    });

    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      const message = payload?.message || 'Failed to load nearby pins';
      const error = new Error(message);
      await logApiError('/api/pins/nearby', error, {
        status: response.status,
        params: Object.fromEntries(params.entries()),
        friendEngagements: friendEngagementList,
        issues: payload?.issues
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/nearby', error, {
        latitude,
        longitude,
        limit,
        status,
        friendEngagements: friendEngagementList,
        distanceMiles: effectiveDistance
      });
    }
    throw error;
  }
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
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.sort) {
    params.set('sort', query.sort);
  }
  if (query.latitude !== undefined && query.latitude !== null) {
    params.set('latitude', String(query.latitude));
  }
  if (query.longitude !== undefined && query.longitude !== null) {
    params.set('longitude', String(query.longitude));
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    params.set('search', query.search.trim());
  }
  const typeList = Array.isArray(query.types)
    ? query.types
    : typeof query.types === 'string'
    ? query.types.split(',').map((entry) => entry.trim())
    : [];
  if (query.type) {
    params.set('type', query.type);
  }
  if (typeList.length) {
    params.set('types', typeList.join(','));
  }
  const categoryList = Array.isArray(query.categories)
    ? query.categories
    : typeof query.categories === 'string'
    ? query.categories.split(',').map((entry) => entry.trim())
    : [];
  if (categoryList.length) {
    params.set('categories', categoryList.join(','));
  }
  if (query.startDate) {
    params.set('startDate', query.startDate);
  }
  if (query.endDate) {
    params.set('endDate', query.endDate);
  }

  const queryString = params.toString();
  const url = queryString ? `${baseUrl}/api/pins?${queryString}` : `${baseUrl}/api/pins`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: await buildHeaders()
    });

    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      const error = new Error(payload?.message || 'Failed to load pins');
      await logApiError('/api/pins', error, {
        status: response.status,
        params: Object.fromEntries(params.entries())
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins', error, { query });
    }
    throw error;
  }
}

export async function fetchPinsSortedByExpiration({ limit = 20, status = 'active' } = {}) {
  return listPins({
    limit,
    sort: 'expiration',
    status
  });
}

export async function fetchPinCategories() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins/categories`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load pin categories');
  }
  return payload;
}

export async function fetchPinsSortedByDistance({ latitude, longitude, limit = 20 } = {}) {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    throw new Error('Latitude and longitude are required to sort pins by distance');
  }

  return listPins({
    limit,
    sort: 'distance',
    latitude,
    longitude
  });
}

export async function fetchExpiredPins({ limit = 20 } = {}) {
  return listPins({
    limit,
    sort: 'expiration',
    status: 'expired'
  });
}

export async function createPin(input) {
  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/pins`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(input)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallbackBase = 'Failed to create pin';
      const details = Array.isArray(payload?.issues)
        ? `: ${payload.issues
            .map((issue) => `${issue.path?.join('.') ?? ''} ${issue.message}`.trim())
            .join('; ')}`
        : '';
      const error = createApiError(response, payload, `${fallbackBase}${details}`);
      await logApiError('/api/pins', error, { status: response.status });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins', error, { inputSummary: { type: input?.type, title: input?.title } });
    }
    throw error;
  }
}

export async function revokeCurrentSession(options = {}) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: await buildHeaders({}, { skipJson: true, ...options })
  });

  if (response.status === 204) {
    return;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to revoke session.');
  }

  return payload;
}

export async function fetchPinById(pinId, options = {}) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const { signal, previewMode, retryAttempts = DEFAULT_RETRY_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS } =
    options;
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (typeof previewMode === 'string' && previewMode.trim().length > 0) {
    params.set('preview', previewMode.trim().toLowerCase());
  }
  const query = params.toString();
  const url = query
    ? `${baseUrl}/api/pins/${encodeURIComponent(pinId)}?${query}`
    : `${baseUrl}/api/pins/${encodeURIComponent(pinId)}`;

  const executeRequest = async () => {
    const response = await fetch(url, {
      method: 'GET',
      headers: await buildHeaders(),
      signal,
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = createApiError(response, payload, 'Failed to load pin');
      await logApiError('/api/pins/:pinId', error, {
        status: response.status,
        pinId,
        previewMode: previewMode ?? null
      });
      throw error;
    }

    return payload;
  };

  try {
    return await withNetworkRetry(executeRequest, { retries: retryAttempts, delayMs: retryDelayMs });
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/:pinId', error, { pinId, previewMode: previewMode ?? null });
    }
    throw error;
  }
}

export async function fetchPinAttendees(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}/attendees`, {
      method: 'GET',
      headers: await buildHeaders(),
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      const error = new Error(payload?.message || 'Failed to load attendees');
      await logApiError('/api/pins/:pinId/attendees', error, {
        status: response.status,
        pinId
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/:pinId/attendees', error, { pinId });
    }
    throw error;
  }
}

export async function updatePinAttendance(pinId, { attending }) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }
  if (typeof attending !== 'boolean') {
    throw new Error('Attendance flag must be a boolean.');
  }

  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}/attendance`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ attending })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || 'Failed to update attendance');
      await logApiError('/api/pins/:pinId/attendance', error, {
        status: response.status,
        pinId,
        attending
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/:pinId/attendance', error, { pinId, attending });
    }
    throw error;
  }
}

export async function fetchPinAnalytics(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}/analytics`, {
      method: 'GET',
      headers: await buildHeaders(),
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = createApiError(response, payload, payload?.message || 'Failed to load analytics');
      await logApiError('/api/pins/:pinId/analytics', error, { status: response.status, pinId });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/:pinId/analytics', error, { pinId });
    }
    throw error;
  }
}

export async function createPinBookmark(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/bookmarks`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ pinId })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || 'Failed to create bookmark');
      await logApiError('/api/bookmarks', error, { status: response.status, pinId });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/bookmarks', error, { pinId });
    }
    throw error;
  }
}

export async function sharePin(pinId, { platform, method } = {}) {
  if (!pinId) {
    throw new Error('pinId is required to share a pin');
  }

  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}/share`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        platform: platform ?? undefined,
        method: method ?? undefined
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = createApiError(response, payload, payload?.message || 'Failed to share pin');
      await logApiError('/api/pins/:pinId/share', error, {
        status: response.status,
        pinId,
        platform: platform ?? null,
        method: method ?? null
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/:pinId/share', error, {
        pinId,
        platform: platform ?? null,
        method: method ?? null
      });
    }
    throw error;
  }
}

export async function deletePinBookmark(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/bookmarks/${encodeURIComponent(pinId)}`, {
      method: 'DELETE',
      headers: await buildHeaders()
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || 'Failed to remove bookmark');
      await logApiError('/api/bookmarks/:pinId', error, { status: response.status, pinId });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/bookmarks/:pinId', error, { pinId });
    }
    throw error;
  }
}

export async function logClientEvent({
  category = 'client-errors',
  severity = 'error',
  message,
  stack,
  context,
  timestamp
} = {}) {
  if (!message) {
    return;
  }
  try {
    const baseUrl = resolveApiBaseUrl();
    await fetch(`${baseUrl}/api/dev-logs`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        category,
        severity,
        message,
        stack,
        context,
        timestamp: timestamp ?? new Date().toISOString()
      })
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to send client log event', error);
    }
  }
}

const API_ERROR_LOG_FLAG = Symbol('clientApiErrorLogged');
const apiErrorCache = new Map();

const buildDedupeKey = (endpoint, context = {}) => {
  try {
    return `${endpoint}|${JSON.stringify(context)}`;
  } catch {
    return `${endpoint}|fallback`;
  }
};

function markApiErrorLogged(error, key) {
  if (error && typeof error === 'object') {
    error[API_ERROR_LOG_FLAG] = true;
  }
  if (key) {
    apiErrorCache.set(key, Date.now());
  }
}

function hasApiErrorBeenLogged(error) {
  return Boolean(error && error[API_ERROR_LOG_FLAG]);
}

async function logApiError(endpoint, error, context = {}) {
  const key = buildDedupeKey(endpoint, context);
  const now = Date.now();
  const lastLogged = apiErrorCache.get(key);
  if (lastLogged && now - lastLogged < API_ERROR_EXPIRY_MS) {
    markApiErrorLogged(error, key);
    return;
  }
  try {
    await logClientEvent({
      category: 'client-api-errors',
      message: error?.message || `Request failed: ${endpoint}`,
      stack: error?.stack,
      context: { endpoint, ...context }
    });
    markApiErrorLogged(error, key);
  } catch {
    // noop – logging failures should never surface to callers
  }
}

export async function createPinReply(pinId, { message, parentReplyId } = {}) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }
  if (!message || typeof message !== 'string') {
    throw new Error('Reply message is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const body = {
    message: message,
    ...(parentReplyId ? { parentReplyId } : {})
  };

  try {
    const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}/replies`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = Array.isArray(payload?.issues)
        ? `: ${payload.issues
            .map((issue) => `${issue.path?.join('.') ?? ''} ${issue.message}`.trim())
            .join('; ')}`
        : '';
      const error = new Error((payload?.message || 'Failed to create reply') + details);
      await logApiError('/api/pins/:pinId/replies', error, {
        status: response.status,
        pinId,
        hasParent: Boolean(parentReplyId)
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/pins/:pinId/replies', error, { pinId, hasParent: Boolean(parentReplyId) });
    }
    throw error;
  }
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

export async function deletePin(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pins/${encodeURIComponent(pinId)}`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to delete pin');
  }

  return payload;
}

export async function flagPinForModeration(pinId, { reason } = {}) {
  if (!pinId) {
    throw new Error('Pin id is required to flag a pin');
  }
  const baseUrl = resolveApiBaseUrl();
  const body =
    typeof reason === 'string' && reason.trim()
      ? { reason: reason.trim() }
      : {};

  const response = await fetch(
    `${baseUrl}/api/pins/${encodeURIComponent(pinId)}/moderation/flag`,
    {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(body)
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to flag pin');
  }

  return payload;
}

async function uploadImageInternal(file) {
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
  try {
    const response = await fetch(`${baseUrl}/api/users/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: await buildHeaders(),
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = createApiError(response, payload, 'Failed to load user profile');
      await logApiError('/api/users/:id', error, {
        status: response.status,
        userId
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/users/:id', error, { userId });
    }
    throw error;
  }
}

export async function fetchCurrentUserProfile() {
  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/users/me`, {
      method: 'GET',
      headers: await buildHeaders(),
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = createApiError(response, payload, 'Failed to load current user profile');
      await logApiError('/api/users/me', error, {
        status: response.status
      });
      throw error;
    }

    return payload;
  } catch (error) {
    if (!hasApiErrorBeenLogged(error)) {
      await logApiError('/api/users/me', error);
    }
    throw error;
  }
}

export async function uploadImage(file) {
  return uploadImageInternal(file);
}

export async function uploadPinImage(file) {
  return uploadImageInternal(file);
}

export async function updateCurrentUserProfile(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me`, {
    method: 'PATCH',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to update current user profile');
  }

  return payload;
}

export async function registerPushToken(token, options = {}) {
  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  if (!normalizedToken) {
    throw new Error('Push token is required.');
  }

  const platform =
    typeof options?.platform === 'string' && options.platform.trim()
      ? options.platform.trim()
      : undefined;

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/push-tokens`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({
      token: normalizedToken,
      ...(platform ? { platform } : {})
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to register push token');
  }

  return payload;
}

export async function requestDataExport({ reason } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/data-export`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(reason ? { reason } : {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to request data export');
  }

  return payload;
}

export async function fetchApiTokens() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/api-tokens`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to load API tokens');
  }

  return payload;
}

export async function createApiToken({ label } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/api-tokens`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(label ? { label } : {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to create API token');
  }

  return payload;
}

export async function revokeApiToken(tokenId) {
  if (!tokenId) {
    throw new Error('Token id is required to revoke a token');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/api-tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to revoke API token');
  }

  return payload;
}

export async function fetchBlockedUsers() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/blocked`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load blocked users');
  }

  return payload;
}

export async function blockUser(userId) {
  if (!userId) {
    throw new Error('User id is required to block a user');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/blocked`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ userId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to block user');
  }

  return payload;
}

export async function unblockUser(userId) {
  if (!userId) {
    throw new Error('User id is required to unblock a user');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/blocked/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to unblock user');
  }

  return payload;
}

export async function fetchModerationOverview() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/moderation/overview`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to load moderation overview');
  }

  return payload;
}

export async function fetchModerationHistory(userId) {
  if (!userId) {
    throw new Error('User id is required to fetch moderation history');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/moderation/history/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to load moderation history');
  }

  return payload;
}

export async function submitModerationAction(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/moderation/actions`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to perform moderation action');
  }

  return payload;
}

export async function createContentReport({ contentType, contentId, reason, context, offenses }) {
  if (!contentType || !contentId) {
    throw new Error('contentType and contentId are required for reporting content');
  }

  const baseUrl = resolveApiBaseUrl();
  const offenseSelections = normalizeReportOffenses(offenses);
  const response = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({
      contentType,
      contentId,
      reason: reason ?? '',
      context: context ?? '',
      offenses: offenseSelections
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, payload?.message || 'Failed to submit report');
  }

  return payload;
}

export async function listContentReports({ status, limit } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  if (limit) {
    params.set('limit', String(limit));
  }
  const query = params.toString();

  const response = await fetch(
    `${baseUrl}/api/debug/moderation/reports${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: await buildHeaders()
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to load moderation reports');
  }

  return payload;
}

export async function resolveContentReport(reportId, input) {
  if (!reportId) {
    throw new Error('reportId is required to resolve a report');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/moderation/reports/${encodeURIComponent(reportId)}/resolve`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input || {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to update report');
  }

  return payload;
}

export async function submitAnonymousFeedback({ message, contact, category }) {
  if (!message || typeof message !== 'string') {
    throw new Error('Feedback message is required.');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({
      message,
      contact: contact ?? '',
      category: category ?? ''
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to send feedback');
  }

  return payload;
}

export async function fetchFriendOverview() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/friends/overview`, {
    method: 'GET',
      headers: await buildHeaders()
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw createApiError(response, payload, 'Failed to load friend overview');
    }

    return payload;
}

export async function sendFriendRequest({ targetUserId, message }) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/friends/request`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ targetUserId, message })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to send friend request');
  }

  return payload;
}

export async function respondToFriendRequest(requestId, decision) {
  if (!requestId) {
    throw new Error('requestId is required to respond to a friend request');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/debug/friends/requests/${encodeURIComponent(requestId)}/respond`,
    {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ decision })
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to resolve friend request');
  }

  return payload;
}

export async function cancelFriendRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required to cancel a friend request');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/debug/friends/requests/${encodeURIComponent(requestId)}`,
    {
      method: 'DELETE',
      headers: await buildHeaders()
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to cancel friend request');
  }

  return payload;
}

export async function removeFriendRelationship(friendId) {
  if (!friendId) {
    throw new Error('friendId is required to remove a friend');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/friends/${encodeURIComponent(friendId)}`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to remove friend');
  }

  return payload;
}

export async function fetchDirectMessageThreads() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/direct-messages/threads`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to load direct message threads');
  }

  return payload;
}

export async function fetchDirectMessageThread(threadId) {
  if (!threadId) {
    throw new Error('threadId is required to load a direct message thread');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/debug/direct-messages/threads/${encodeURIComponent(threadId)}`,
    {
      method: 'GET',
      headers: await buildHeaders()
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to load direct message thread');
  }

  return payload;
}

export async function createDirectMessageThread({ participantIds, topic, initialMessage }) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/direct-messages/threads`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ participantIds, topic, initialMessage })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to create direct message thread');
  }

  return payload;
}

export async function sendDirectMessage(threadId, { body, attachments }) {
  if (!threadId) {
    throw new Error('threadId is required to send a direct message');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/debug/direct-messages/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ body, attachments })
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(response, payload, 'Failed to send direct message');
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

export async function fetchBookmarks({ userId, limit, hideFullEvents } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (userId) {
    params.set('userId', userId);
  }
  if (limit !== undefined && limit !== null) {
    const numericLimit = Number(limit);
    if (Number.isFinite(numericLimit)) {
      const constrained = Math.min(100, Math.max(1, Math.trunc(numericLimit)));
      params.set('limit', String(constrained));
    }
  }

  if (typeof hideFullEvents === 'boolean') {
    params.set('hideFullEvents', hideFullEvents ? 'true' : 'false');
  }

  const query = params.toString();
  const url = query ? `${baseUrl}/api/bookmarks?${query}` : `${baseUrl}/api/bookmarks`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    const details = payload?.issues ? `: ${JSON.stringify(payload.issues)}` : '';
    throw new Error((payload?.message || `Failed to load bookmarks (status ${response.status})`) + details);
  }

  return payload;
}

export async function fetchBookmarkHistory() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/bookmarks/history`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load bookmark history');
  }
  return payload;
}

export async function clearBookmarkHistory() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/bookmarks/history`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to clear bookmark history');
  }
  return payload;
}

export async function removeBookmark(pinId) {
  if (!pinId) {
    throw new Error('Pin id is required to remove a bookmark');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/bookmarks/${encodeURIComponent(pinId)}`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to remove bookmark');
  }

  return payload;
}

export async function exportBookmarks({ userId } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (userId) {
    params.set('userId', userId);
  }

  const query = params.toString();
  const url = query ? `${baseUrl}/api/bookmarks/export?${query}` : `${baseUrl}/api/bookmarks/export`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders({ Accept: 'text/csv' }, { skipJson: true })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    try {
      const payload = errorText ? JSON.parse(errorText) : {};
      throw new Error(payload?.message || 'Failed to export bookmarks');
    } catch {
      throw new Error(errorText || 'Failed to export bookmarks');
    }
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = parseFilenameFromContentDisposition(disposition);

  return { blob, filename };
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
  const baseUrl = resolveApiBaseUrl();
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const response = await fetch(`${baseUrl}/api/bookmarks/collections${params}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load bookmark collections');
  }

  return payload;
}

export async function awardBadge(badgeId) {
  if (!badgeId) {
    throw new Error('Badge id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/me/badges/${encodeURIComponent(badgeId)}`, {
    method: 'POST',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to award badge');
  }

  return payload;
}

export async function debugListBadges({ userId } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (userId) {
    params.set('userId', userId);
  }
  const query = params.toString();
  const url = query ? `${baseUrl}/api/debug/badges?${query}` : `${baseUrl}/api/debug/badges`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load badges');
  }

  return payload;
}

export async function debugGrantBadge({ userId, badgeId }) {
  if (!badgeId) {
    throw new Error('Badge id is required to grant');
  }
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/badges/grant`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ userId, badgeId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to grant badge');
  }

  return payload;
}

export async function debugRevokeBadge({ userId, badgeId }) {
  if (!badgeId) {
    throw new Error('Badge id is required to revoke');
  }
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/badges/revoke`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ userId, badgeId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to revoke badge');
  }

  return payload;
}

export async function debugResetBadges({ userId } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/badges/reset`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ userId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to reset badges');
  }

  return payload;
}

export async function fetchUsersWithCussCount() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/bad-users`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load cuss stats');
  }

  return payload;
}

export async function incrementUserCussCount(userId) {
  if (!userId) {
    throw new Error('User id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/debug/bad-users/${encodeURIComponent(userId)}/increment`,
    {
      method: 'POST',
      headers: await buildHeaders()
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to increment cuss count');
  }

  return payload;
}

export async function resetUserCussCount(userId) {
  if (!userId) {
    throw new Error('User id is required');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/debug/bad-users/${encodeURIComponent(userId)}/reset`,
    {
      method: 'POST',
      headers: await buildHeaders()
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to reset cuss count');
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

export async function createChatRoom(input) {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/chats/rooms`, {
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

export async function fetchChatRooms({
  pinId,
  ownerId,
  latitude,
  longitude,
  includeBookmarked = true,
  adminView
} = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (pinId) {
    params.set('pinId', pinId);
  }
  if (ownerId) {
    params.set('ownerId', ownerId);
  }
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) {
    params.set('latitude', String(latitude));
  }
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) {
    params.set('longitude', String(longitude));
  }
  if (!includeBookmarked) {
    params.set('includeBookmarked', 'false');
  }
  if (adminView) {
    params.set('adminView', 'true');
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
    const details = payload?.issues ? `: ${JSON.stringify(payload.issues)}` : '';
    throw new Error((payload?.message || 'Failed to create chat message') + details);
  }

  return payload;
}

export async function createChatMessage(roomId, input) {
  if (!roomId) {
    throw new Error('Room id is required to create a chat message');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/messages`, {
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

export async function previewChatGif(query, { limit = 12 } = {}) {
  const searchTerm = typeof query === 'string' ? query.trim() : '';
  if (!searchTerm) {
    throw new Error('Enter a search term to preview a GIF.');
  }

  const params = new URLSearchParams();
  params.set('q', searchTerm);
  if (Number.isFinite(limit)) {
    params.set('limit', String(Math.max(1, Math.min(Math.trunc(limit), 20))));
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/chats/gif-search?${params.toString()}`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to preview GIFs.');
  }

  return payload;
}

export async function fetchChatMessages(roomId, { latitude, longitude } = {}) {
  if (!roomId) {
    throw new Error('Room id is required to load messages');
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) {
    params.set('latitude', String(latitude));
  }
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) {
    params.set('longitude', String(longitude));
  }
  const query = params.toString();
  const url = query
    ? `${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/messages?${query}`
    : `${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/messages`;

  const response = await fetch(url, {
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

export async function upsertChatPresence(roomId, input = {}) {
  if (!roomId) {
    throw new Error('Room id is required to update presence');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/presence`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to update chat presence');
  }

  return payload;
}

export async function fetchChatPresence(roomId, { latitude, longitude } = {}) {
  if (!roomId) {
    throw new Error('Room id is required to load presence');
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  if (latitude !== undefined && latitude !== null && !Number.isNaN(latitude)) {
    params.set('latitude', String(latitude));
  }
  if (longitude !== undefined && longitude !== null && !Number.isNaN(longitude)) {
    params.set('longitude', String(longitude));
  }

  const query = params.toString();
  const url = query
    ? `${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/presence?${query}`
    : `${baseUrl}/api/chats/rooms/${encodeURIComponent(roomId)}/presence`;

  const response = await fetch(url, {
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
    const details = Array.isArray(payload?.issues)
      ? `: ${payload.issues
          .map((issue) => {
            const path = Array.isArray(issue?.path) ? issue.path.join('.') : '';
            return `${path} ${issue?.message ?? ''}`.trim();
          })
          .filter(Boolean)
          .join('; ')}`
      : '';
    throw new Error((payload?.message || 'Failed to create update') + details);
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

export async function markUpdateRead(updateId) {
  if (!updateId) {
    throw new Error('Update id is required to mark an update as read');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/updates/${encodeURIComponent(updateId)}/read`, {
    method: 'PATCH',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to mark update as read');
  }

  return payload;
}

export async function markAllUpdatesRead() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/updates/mark-all-read`, {
    method: 'PATCH',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to mark all updates as read');
  }

  return payload;
}

export async function deleteUpdate(updateId) {
  if (!updateId) {
    throw new Error('Update id is required to delete an update');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/updates/${encodeURIComponent(updateId)}`, {
    method: 'DELETE',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to delete update');
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
    headers: await buildHeaders(),
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load replies');
  }

  return payload;
}

export async function fetchStorageObjects({ prefix, limit } = {}) {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();

  if (typeof prefix === 'string') {
    params.set('prefix', prefix);
  }

  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(limit));
  }

  const queryString = params.toString();
  const response = await fetch(
    `${baseUrl}/api/storage/objects${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers: await buildHeaders()
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load Firebase Storage objects');
  }

  return payload;
}

export async function fetchDebugAuthAccounts() {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/auth/accounts`, {
    method: 'GET',
    headers: await buildHeaders()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to load Firebase accounts');
  }

  return Array.isArray(payload?.accounts) ? payload.accounts : [];
}

export async function requestAccountSwap(uid) {
  if (!uid) {
    throw new Error('Firebase UID is required to swap accounts');
  }

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/debug/auth/swap`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ uid })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to request account swap');
  }

  if (!payload?.token) {
    throw new Error('Server did not return a custom token');
  }

  return payload.token;
}
