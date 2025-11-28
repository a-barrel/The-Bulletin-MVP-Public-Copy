import runtimeConfig from '../config/runtime';

const DEFAULT_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const FALLBACK_TEXTURE_PATH = '/images/UNKNOWN_TEXTURE.jpg';
const MEDIA_CACHE_LIMIT = 500;

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

const mediaCache = new Map();

const buildCacheKey = (asset, options) => {
  try {
    return JSON.stringify({
      asset,
      keys: options?.keys,
      fallback: options?.fallback,
      baseUrl: options?.baseUrl ?? DEFAULT_BASE_URL,
      offline: runtimeConfig.isOffline
    });
  } catch {
    return null;
  }
};

export function resolveAssetUrl(asset, options) {
  const optionProvided = arguments.length >= 2;
  const normalizedOptions =
    options && typeof options === 'object' && !Array.isArray(options)
      ? options
      : optionProvided
      ? { fallback: options }
      : {};

  const { fallback, baseUrl = DEFAULT_BASE_URL } = normalizedOptions;
  const hasCustomFallback = Object.prototype.hasOwnProperty.call(normalizedOptions, 'fallback');

  const shouldReturnRelativeOffline = (path) =>
    runtimeConfig.isOffline &&
    typeof path === 'string' &&
    (path.startsWith('/images/') || path.startsWith('/sounds/'));

  const fallbackSrc = hasCustomFallback ? fallback : fallbackTextureFallback();

  const cacheKey = buildCacheKey(asset, normalizedOptions);
  if (cacheKey && mediaCache.has(cacheKey)) {
    return mediaCache.get(cacheKey);
  }

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
  const finalValue = resolved ?? fallbackSrc;

  if (cacheKey) {
    mediaCache.set(cacheKey, finalValue);
    if (mediaCache.size > MEDIA_CACHE_LIMIT) {
      const firstKey = mediaCache.keys().next().value;
      mediaCache.delete(firstKey);
    }
  }

  return finalValue;
}

export default resolveAssetUrl;

export const resolveThumbnailUrl = (asset) =>
  resolveAssetUrl(asset, {
    keys: ['thumbnailUrl', 'previewUrl', 'url', 'path', 'src'],
    fallback: null
  });

function fallbackTextureFallback() {
  if (runtimeConfig.isOffline) {
    return FALLBACK_TEXTURE_PATH;
  }
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  return base ? `${base}${FALLBACK_TEXTURE_PATH}` : FALLBACK_TEXTURE_PATH;
}
