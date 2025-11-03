import runtimeConfig from '../config/runtime';

const DEFAULT_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');

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

export function resolveAssetUrl(asset, options = {}) {
  const normalizedOptions =
    options && typeof options === 'object' && !Array.isArray(options)
      ? options
      : { fallback: options };

  const {
    fallback = null,
    baseUrl = DEFAULT_BASE_URL,
    keys
  } = normalizedOptions;

  if (!asset && asset !== 0) {
    return fallback;
  }

  if (typeof asset === 'string') {
    const trimmed = normalizeProfileImagePath(asset.trim());
    if (!trimmed) {
      return fallback;
    }
    if (isAbsoluteUrl(trimmed)) {
      return trimmed;
    }
    const normalized = normalizeProfileImagePath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
    return baseUrl ? `${baseUrl}${normalized}` : normalized;
  }

  const resolved = resolveFromObject(asset, fallback, { baseUrl, keys });
  return resolved ?? fallback;
}

export default resolveAssetUrl;
