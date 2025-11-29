import { auth } from '../firebase';
import runtimeConfig from '../config/runtime';

let didForceSignOut = false;

const triggerForcedSignOut = () => {
  if (didForceSignOut) return;
  didForceSignOut = true;
  try {
    auth.signOut().catch(() => {});
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    // Redirect to login to avoid infinite error loops with stale tokens.
    window.setTimeout(() => {
      try {
        window.location.assign('/login');
      } catch {
        // ignore navigation errors
      }
    }, 0);
  }
};

const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetriableNetworkError = (error) => {
  if (!error || typeof error !== 'object') return false;
  if (error.name === 'AbortError' || error.isApiError) return false;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (error.name && error.name.toLowerCase() === 'typeerror') return true;
  return message.includes('failed to fetch') || message.includes('network request failed');
};

async function resolveAuthToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
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

const resolveApiBaseUrl = () => {
  if (import.meta.env.DEV) return '';
  if (API_BASE_URL) return API_BASE_URL;
  return '';
};

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

export async function apiFetch(
  path,
  {
    method = 'GET',
    body,
    headers = {},
    retries,
    retryDelayMs,
    signal,
    cache,
    rawResponse = false,
    parseAs
  } = {}
) {
  const baseUrl = resolveApiBaseUrl();
  const token = await resolveAuthToken();

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer;
  const isSearchParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;

  const shouldSerializeBody =
    body !== undefined &&
    body !== null &&
    !isFormData &&
    !isBlob &&
    !isArrayBuffer &&
    !isSearchParams &&
    typeof body !== 'string';

  const defaultHeaders =
    shouldSerializeBody || body === undefined
      ? { 'Content-Type': 'application/json' }
      : {};

  const fetchHeaders = {
    ...defaultHeaders,
    ...headers
  };
  if (token && !headers.Authorization) {
    fetchHeaders.Authorization = `Bearer ${token}`;
  }

  const requestBody = shouldSerializeBody ? JSON.stringify(body) : body;

  const exec = async () => {
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: fetchHeaders,
        body: requestBody,
        signal,
        cache
      });
    } catch (fetchError) {
      if (fetchError?.name === 'AbortError') {
        // Treat aborts as benign: return null so callers can bail quietly.
        return null;
      }
      throw fetchError;
    }
    if (!res.ok) {
      const error = new Error(res.statusText || 'Request failed');
      error.status = res.status;
      error.isApiError = true;
      try {
        const hasHeaders = typeof res.headers?.get === 'function';
        const contentType = hasHeaders ? res.headers.get('content-type') || '' : '';
        if (contentType.includes('application/json') && typeof res.json === 'function') {
          error.payload = await res.json();
        } else if (typeof res.json === 'function') {
          try {
            error.payload = await res.json();
          } catch {
            // ignore JSON parse failures and try text next
          }
        }
        if (!error.payload && typeof res.text === 'function') {
          const text = await res.text();
          if (text) {
            error.payload = { message: text };
          }
        }
      } catch {
        // ignore
      }
      if (error.status === 401 || error.status === 403) {
        error.isAuthError = true;
        triggerForcedSignOut();
      }
      throw error;
    }
    if (rawResponse) return res;
    if (parseAs === 'blob') return res.blob();
    if (parseAs === 'text') return res.text();
    if (res.status === 204) return null;
    return res.json();
  };

  return withNetworkRetry(exec, { retries, delayMs: retryDelayMs });
}

export async function apiGet(path, options = {}) {
  return apiFetch(path, { ...options, method: 'GET' });
}

export async function apiPost(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'POST', body });
}

export async function apiPatch(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'PATCH', body });
}

export async function apiDelete(path, options = {}) {
  return apiFetch(path, { ...options, method: 'DELETE' });
}
