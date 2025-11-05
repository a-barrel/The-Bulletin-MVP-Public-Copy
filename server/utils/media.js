const { toIdString: defaultToIdString } = require('./ids');
const { toIsoDateString } = require('./dates');
const runtime = require('../config/runtime');

const LEGACY_PROFILE_IMAGE_REGEX = /(\/images\/profile\/profile-\d+)\.png$/i;
const DEFAULT_PROFILE_IMAGE_REGEX = /\/images\/profile\/profile-\d+\.(?:png|jpg)$/i;

const isAbsoluteUrl = (value) => /^(?:[a-z]+:)?\/\//i.test(value);

const normalizeProfileImagePath = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  const hadLeadingSlash = value.startsWith('/');
  const normalizedSource = hadLeadingSlash ? value : `/${value}`;
  const replaced = normalizedSource.replace(LEGACY_PROFILE_IMAGE_REGEX, '$1.jpg');
  if (hadLeadingSlash) {
    return replaced;
  }
  return replaced.startsWith('/') ? replaced.slice(1) : replaced;
};

const OFFLINE_MEDIA_HOSTS = new Set(['localhost:5000', '127.0.0.1:5000', 'localhost:8000', '127.0.0.1:8000']);

const normalizeMediaUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^data:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (OFFLINE_MEDIA_HOSTS.has(parsed.host)) {
        const normalizedPath = normalizeProfileImagePath(parsed.pathname);
        if (runtime?.publicBaseUrl) {
          return `${runtime.publicBaseUrl}${normalizedPath}`;
        }
        return normalizedPath;
      }
    } catch (error) {
      // fall through to best-effort handling
    }
    return trimmed;
  }
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const resolvedPath = normalizeProfileImagePath(normalized);
  if (runtime?.publicBaseUrl) {
    return `${runtime.publicBaseUrl}${resolvedPath}`;
  }
  return resolvedPath;
};

const normalizeObject = (input) => (input && typeof input.toObject === 'function' ? input.toObject() : input);

function mapMediaAsset(asset, { toIdString = defaultToIdString } = {}) {
  if (!asset) {
    return undefined;
  }

  const doc = normalizeObject(asset);
  if (!doc) {
    return undefined;
  }

  const normalizedUrl = normalizeMediaUrl(doc.url) || normalizeMediaUrl(doc.thumbnailUrl) || normalizeMediaUrl(doc.path);
  if (!normalizedUrl) {
    return undefined;
  }

  const normalizedThumb = normalizeMediaUrl(doc.thumbnailUrl);

  const payload = {
    url: normalizedUrl,
    thumbnailUrl: normalizedThumb ?? undefined,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    mimeType: doc.mimeType || undefined,
    description: doc.description || undefined,
    uploadedAt: toIsoDateString(doc.uploadedAt),
    uploadedBy: toIdString ? toIdString(doc.uploadedBy) : undefined
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)
  );
}

const TF2_AVATAR_MAP = {
  tf2_scout: '/images/emulation/avatars/Scoutava.jpg',
  tf2_soldier: '/images/emulation/avatars/Soldierava.jpg',
  tf2_pyro: '/images/emulation/avatars/Pyroava.jpg',
  tf2_demoman: '/images/emulation/avatars/Demomanava.jpg',
  tf2_heavy: '/images/emulation/avatars/Heavyava.jpg',
  tf2_engineer: '/images/emulation/avatars/Engineerava.jpg',
  tf2_medic: '/images/emulation/avatars/Medicava.jpg',
  tf2_sniper: '/images/emulation/avatars/Sniperava.jpg',
  tf2_spy: '/images/emulation/avatars/Spyava.jpg'
};

function mapUserAvatar(userDoc, { toIdString = defaultToIdString } = {}) {
  if (!userDoc) {
    return undefined;
  }

  const doc = normalizeObject(userDoc);
  const avatarSource = doc?.avatar
    ? {
        ...doc.avatar,
        url: normalizeProfileImagePath(doc.avatar.url),
        thumbnailUrl: normalizeProfileImagePath(doc.avatar.thumbnailUrl),
        path: normalizeProfileImagePath(doc.avatar.path)
      }
    : undefined;
  const avatar = mapMediaAsset(avatarSource, { toIdString });

  const usernameKey = typeof doc?.username === 'string' ? doc.username.trim().toLowerCase() : null;
  const fallbackPath = usernameKey ? TF2_AVATAR_MAP[usernameKey] : null;

  const needsFallback = Boolean(
    fallbackPath && (!avatar?.url || DEFAULT_PROFILE_IMAGE_REGEX.test(avatar.url))
  );

  if (!needsFallback) {
    return avatar;
  }

  const normalized = normalizeMediaUrl(fallbackPath);
  if (!normalized) {
    return avatar;
  }

  return {
    url: normalized,
    thumbnailUrl: normalized,
    width: avatar?.width ?? 184,
    height: avatar?.height ?? 184,
    mimeType: 'image/jpeg'
  };
}

module.exports = {
  normalizeMediaUrl,
  mapMediaAsset,
  mapUserAvatar,
  normalizeProfileImagePath
};
