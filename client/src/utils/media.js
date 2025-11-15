import runtimeConfig from '../config/runtime';

const DEFAULT_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const FALLBACK_TEXTURE_PATH = '/images/UNKNOWN_TEXTURE.jpg';

const LEGACY_PROFILE_IMAGE_REGEX = /(\/images\/profile\/profile-\d+)\.png$/i;

export const DEFAULT_PROFILE_IMAGE_REGEX = /\/images\/profile\/profile-\d+\.(?:png|jpg)$/i;

const isAbsoluteUrl = (value) => /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith('data:');

export const normalizeProfileImagePath = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  return value.replace(LEGACY_PROFILE_IMAGE_REGEX, '$1.jpg');
};

const resolveFromObject = (candidate, fallback, options) => {
  if (!candidate) {
    return null;
  }

  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const resolved = resolveAssetUrl(entry, options);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  if (typeof candidate === 'object') {
    const keysToTry = options?.keys ?? ['thumbnailUrl', 'previewUrl', 'url', 'path'];
    for (const key of keysToTry) {
      if (candidate[key]) {
        const resolved = resolveAssetUrl(candidate[key], options);
        if (resolved) {
          return resolved;
        }
      }
    }
    return null;
  }

  return null;
};

export function resolveAssetUrl(asset, options) {
  const optionProvided = arguments.length >= 2;
  const normalizedOptions =
    options && typeof options === 'object' && !Array.isArray(options)
      ? options
      : optionProvided
      ? { fallback: options }
      : {};

  const {
    fallback,
    baseUrl = DEFAULT_BASE_URL,
    keys
  } = normalizedOptions;
  const hasCustomFallback = Object.prototype.hasOwnProperty.call(normalizedOptions, 'fallback');

  const shouldReturnRelativeOffline = (path) =>
    runtimeConfig.isOffline &&
    typeof path === 'string' &&
    (path.startsWith('/images/') || path.startsWith('/sounds/'));

  const fallbackSrc = hasCustomFallback ? fallback : fallbackTextureFallback();

  if (!asset && asset !== 0) {
    return fallbackSrc;
  }

  if (typeof asset === 'string') {
    const trimmed = normalizeProfileImagePath(asset.trim());
    if (!trimmed) {
      return fallbackSrc;
    }

    if (isAbsoluteUrl(trimmed)) {
      if (runtimeConfig.isOffline) {
        try {
          const url = new URL(trimmed);
          const offlineHosts = new Set(['localhost:5000', '127.0.0.1:5000', 'localhost:8000', '127.0.0.1:8000']);
          if (offlineHosts.has(url.host) && shouldReturnRelativeOffline(url.pathname)) {
            return url.pathname;
          }
        } catch {
          // noop – fall back to absolute URL behaviour
        }
      }
      return trimmed;
    }

    const normalized = normalizeProfileImagePath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
    if (shouldReturnRelativeOffline(normalized)) {
      return normalized;
    }
    return baseUrl ? `${baseUrl}${normalized}` : normalized;
  }

  const resolved = resolveFromObject(asset, fallbackSrc, normalizedOptions);
  return resolved ?? fallbackSrc;
}

export default resolveAssetUrl;

function fallbackTextureFallback() {
  if (runtimeConfig.isOffline) {
    return FALLBACK_TEXTURE_PATH;
  }
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  return base ? `${base}${FALLBACK_TEXTURE_PATH}` : FALLBACK_TEXTURE_PATH;
}
