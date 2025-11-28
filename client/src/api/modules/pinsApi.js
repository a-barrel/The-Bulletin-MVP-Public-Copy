import runtimeConfig from '../../config/runtime';
import { apiDelete, apiFetch, apiGet, apiPatch, apiPost } from '../httpClient';

const DEFAULT_NEARBY_DISTANCE_MILES = Number.isFinite(runtimeConfig.defaultNearbyRadius)
  ? runtimeConfig.defaultNearbyRadius
  : 10;

const serializeList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((entry) => entry.trim());
  return [];
};

const buildBookmarkParams = ({ userId, page, limit, sort, hideFullEvents } = {}) => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (Number.isFinite(page)) params.set('page', String(page));
  if (limit !== undefined && limit !== null) {
    const numericLimit = Number(limit);
    if (Number.isFinite(numericLimit)) {
      const constrained = Math.min(100, Math.max(1, Math.trunc(numericLimit)));
      params.set('limit', String(constrained));
    }
  }
  if (typeof sort === 'string' && sort.trim()) params.set('sort', sort.trim());
  if (typeof hideFullEvents === 'boolean') params.set('hideFullEvents', hideFullEvents ? 'true' : 'false');
  return params;
};

const parseFilenameFromContentDisposition = (headerValue, fallback = 'bookmarks.csv') => {
  if (!headerValue) return fallback;
  const match = headerValue.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
  if (!match || !match[1]) return fallback;
  let filename = match[1].trim();
  if (filename.startsWith('"') && filename.endsWith('"')) {
    filename = filename.slice(1, -1);
  }
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename || fallback;
  }
};

export const fetchPins = (query = {}) => {
  const params = new URLSearchParams();
  const fields = [
    'offset',
    'page',
    'latitude',
    'longitude',
    'search',
    'startDate',
    'endDate',
    'type'
  ];
  fields.forEach((key) => {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value).trim());
    }
  });
  const typeList = serializeList(query.types);
  if (typeList.length) params.set('types', typeList.join(','));
  const categoryList = serializeList(query.categories);
  if (categoryList.length) params.set('categories', categoryList.join(','));
  const queryString = params.toString();
  return apiGet(queryString ? `/api/pins?${queryString}` : '/api/pins');
};

export const listPins = (query = {}) => {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  if (query.creatorId) params.set('creatorId', query.creatorId);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status) params.set('status', query.status);
  if (query.sort) params.set('sort', query.sort);
  if (query.latitude !== undefined && query.latitude !== null) params.set('latitude', String(query.latitude));
  if (query.longitude !== undefined && query.longitude !== null) params.set('longitude', String(query.longitude));
  if (typeof query.search === 'string' && query.search.trim()) params.set('search', query.search.trim());

  const typeList = serializeList(query.types);
  if (query.type) params.set('type', query.type);
  if (typeList.length) params.set('types', typeList.join(','));

  const categoryList = serializeList(query.categories);
  if (categoryList.length) params.set('categories', categoryList.join(','));
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);

  const queryString = params.toString();
  const path = queryString ? `/api/pins?${queryString}` : '/api/pins';
  return apiGet(path);
};

export const fetchPinsNearby = ({
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
  hideFullEvents,
  signal
} = {}) => {
  if (latitude === undefined || longitude === undefined) {
    throw new Error('Latitude and longitude are required');
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

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    distanceMiles: String(effectiveDistance)
  });

  if (limit !== undefined) params.set('limit', String(limit));
  if (typeof search === 'string' && search.trim()) params.set('search', search.trim());

  const typeList = serializeList(types).map((entry) => entry.trim()).filter(Boolean);
  if (typeList.length) params.set('types', typeList.join(','));

  const categoryList = serializeList(categories).map((entry) => entry.trim()).filter(Boolean);
  if (categoryList.length) params.set('categories', categoryList.join(','));

  const friendEngagementList = serializeList(friendEngagements).map((entry) => entry.trim()).filter(Boolean);
  if (friendEngagementList.length) params.set('friendEngagements', friendEngagementList.join(','));

  if (status) params.set('status', status);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (typeof hideFullEvents === 'boolean') params.set('hideFullEvents', hideFullEvents ? 'true' : 'false');

  return apiGet(`/api/pins/nearby?${params.toString()}`, { signal });
};

export const fetchPinsSortedByExpiration = ({ limit = 20, status = 'active' } = {}) =>
  listPins({ limit, sort: 'expiration', status });

export const fetchPinsSortedByDistance = ({ latitude, longitude, limit = 20 } = {}) => {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    throw new Error('Latitude and longitude are required to sort pins by distance');
  }
  return listPins({ limit, sort: 'distance', latitude, longitude });
};

export const fetchExpiredPins = ({ limit = 20 } = {}) => listPins({ limit, sort: 'expiration', status: 'expired' });

export const fetchPinCategories = () => apiGet('/api/pins/categories');

export const fetchPinById = (pinId, { signal, previewMode, retryAttempts = 0, retryDelayMs = 0 } = {}) => {
  if (!pinId) throw new Error('Pin id is required');
  const params = new URLSearchParams();
  if (typeof previewMode === 'string' && previewMode.trim()) {
    params.set('preview', previewMode.trim().toLowerCase());
  }
  const query = params.toString();
  const path = query ? `/api/pins/${encodeURIComponent(pinId)}?${query}` : `/api/pins/${encodeURIComponent(pinId)}`;
  return apiGet(path, { signal, retries: retryAttempts, retryDelayMs });
};

export const fetchPinAttendees = (pinId) => {
  if (!pinId) throw new Error('Pin id is required');
  return apiGet(`/api/pins/${encodeURIComponent(pinId)}/attendees`, { cache: 'no-store' });
};

export const updatePinAttendance = (pinId, { attending }) => {
  if (!pinId) throw new Error('Pin id is required');
  if (typeof attending !== 'boolean') throw new Error('Attendance flag must be a boolean.');
  return apiPost(`/api/pins/${encodeURIComponent(pinId)}/attendance`, { attending });
};

export const fetchPinAnalytics = async (
  pinId,
  { enabled = true, suppressLogStatuses = [], timeoutMs = 12000 } = {}
) => {
  if (!pinId) throw new Error('Pin id is required');
  if (!enabled) return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId =
    controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const result = await apiGet(`/api/pins/${encodeURIComponent(pinId)}/analytics`, {
      signal: controller?.signal,
      cache: 'no-store'
    });
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Attendance analytics request timed out');
      timeoutError.status = 'timeout';
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    if (error?.status && suppressLogStatuses.includes(error.status)) {
      const suppressed = new Error(error.message || 'Failed to load analytics');
      suppressed.skipClientLog = true;
      throw suppressed;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const createPin = async (input) => {
  try {
    return await apiPost('/api/pins', input);
  } catch (error) {
    const details = Array.isArray(error?.payload?.issues)
      ? `: ${error.payload.issues
          .map((issue) => `${issue.path?.join('.') ?? ''} ${issue.message}`.trim())
          .join('; ')}`
      : '';
    const err = new Error(error?.payload?.message || `Failed to create pin${details}`);
    err.status = error?.status;
    err.payload = error?.payload;
    throw err;
  }
};

export const updatePin = (pinId, input) => {
  if (!pinId) throw new Error('Pin id is required');
  return apiPatch(`/api/pins/${encodeURIComponent(pinId)}`, input);
};

export const deletePin = (pinId) => {
  if (!pinId) throw new Error('Pin id is required');
  return apiDelete(`/api/pins/${encodeURIComponent(pinId)}`);
};

export const createPinReply = (pinId, { message, parentReplyId } = {}) => {
  if (!pinId) throw new Error('Pin id is required');
  if (!message || typeof message !== 'string') throw new Error('Reply message is required');
  const body = { message, ...(parentReplyId ? { parentReplyId } : {}) };
  return apiPost(`/api/pins/${encodeURIComponent(pinId)}/replies`, body);
};

export const createReply = (input) => apiPost('/api/debug/replies', input);

export const fetchReplies = async (pinId) => {
  if (!pinId) throw new Error('Pin id is required to load replies');
  try {
    return await apiGet(`/api/pins/${encodeURIComponent(pinId)}/replies`, { cache: 'no-store' });
  } catch (error) {
    const message = error?.payload?.message || error?.message || 'Failed to load replies';
    const err = new Error(message);
    err.status = error?.status;
    throw err;
  }
};

export const createPinBookmark = (pinId) => {
  if (!pinId) throw new Error('Pin id is required');
  return apiPost('/api/bookmarks', { pinId });
};

export const deletePinBookmark = (pinId) => {
  if (!pinId) throw new Error('Pin id is required');
  return apiDelete(`/api/bookmarks/${encodeURIComponent(pinId)}`);
};

export const sharePin = (pinId, { platform, method } = {}) => {
  if (!pinId) throw new Error('pinId is required to share a pin');
  return apiPost(`/api/pins/${encodeURIComponent(pinId)}/share`, {
    platform: platform ?? undefined,
    method: method ?? undefined
  });
};

export const fetchBookmarks = (options = {}) => {
  const params = buildBookmarkParams(options);
  const query = params.toString();
  const path = query ? `/api/bookmarks?${query}` : '/api/bookmarks';
  return apiGet(path);
};

export const fetchPinBookmarks = (opts = {}) => fetchBookmarks(opts);

export const fetchBookmarkHistory = () => apiGet('/api/bookmarks/history');

export const clearBookmarkHistory = () => apiDelete('/api/bookmarks/history');

export const removeBookmark = (pinId) => deletePinBookmark(pinId);

export const exportBookmarks = async ({ userId } = {}) => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  const query = params.toString();
  const path = query ? `/api/bookmarks/export?${query}` : '/api/bookmarks/export';
  const response = await apiFetch(path, {
    method: 'GET',
    headers: { Accept: 'text/csv' },
    rawResponse: true
  });
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = parseFilenameFromContentDisposition(disposition);
  return { blob, filename };
};

export const createBookmark = (input) => apiPost('/api/debug/bookmarks', input);

export const createBookmarkCollection = (input) => apiPost('/api/debug/bookmark-collections', input);

export const fetchBookmarkCollections = (userId) => {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiGet(`/api/bookmarks/collections${params}`);
};

export const submitAnonymousFeedback = ({ message, contact, category }) => {
  if (!message || typeof message !== 'string') throw new Error('Feedback message is required.');
  return apiPost('/api/feedback', {
    message,
    contact: contact ?? '',
    category: category ?? ''
  });
};

export const flagPinForModeration = (pinId, { reason } = {}) => {
  if (!pinId) throw new Error('Pin id is required to flag a pin');
  const body = typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {};
  return apiPost(`/api/pins/${encodeURIComponent(pinId)}/moderation/flag`, body);
};

export const getPinCheckIns = (pinId) => {
  if (!pinId) throw new Error('pinId is required to fetch check-ins');
  return apiGet(`/api/pins/${encodeURIComponent(pinId)}/check-ins`);
};

export const updatePinCheckIn = (pinId, { checkedIn }) => {
  if (!pinId) throw new Error('pinId is required to update check-in');
  return apiPost(`/api/pins/${encodeURIComponent(pinId)}/check-ins`, { checkedIn });
};
