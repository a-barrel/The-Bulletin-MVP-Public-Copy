import runtimeConfig from '../config/runtime';
import formatDateTime from './dates';
import { normalizeProfileImagePath, DEFAULT_PROFILE_IMAGE_REGEX } from './media';
import { metersToMiles, METERS_PER_MILE } from './geo';
import { routes } from '../routes';

export const DEFAULT_AVATAR_PATH = '/images/profile/profile-01.jpg';
export const DEFAULT_COVER_PATH = '/images/background/background-01.jpg';
const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');

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

export const resolveMediaAssetUrl = (asset, fallback) => {
  if (asset && typeof asset === 'object') {
    const source = asset.url ?? asset.thumbnailUrl ?? asset.path;
    if (typeof source === 'string' && source.trim().length > 0) {
      return resolveMediaAssetUrl(source.trim(), fallback);
    }
  }

  if (typeof asset === 'string' && asset.trim().length > 0) {
    const value = normalizeProfileImagePath(asset.trim());
    if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith('data:')) {
      if (!value.startsWith('data:')) {
        try {
          const parsed = new URL(value);
          const offlineHosts = new Set([
            'localhost:5000',
            '127.0.0.1:5000',
            'localhost:8000',
            '127.0.0.1:8000'
          ]);
          if (offlineHosts.has(parsed.host)) {
            if (API_BASE_URL) {
              return `${API_BASE_URL}${parsed.pathname}`;
            }
            if (typeof window !== 'undefined' && window.location?.origin) {
              return `${window.location.origin}${parsed.pathname}`;
            }
            return parsed.pathname;
          }
        } catch {
          // fall back to original absolute value
        }
      }
      return value;
    }
    const normalized = normalizeProfileImagePath(value.startsWith('/') ? value : `/${value}`);
    return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
  }

  if (fallback) {
    return resolveMediaAssetUrl(fallback);
  }

  return null;
};

export const resolveUserAvatarUrl = (user, fallback = DEFAULT_AVATAR_PATH) => {
  const candidates = [
    user?.avatar,
    user?.avatar?.url,
    user?.avatarUrl,
    user?.profile?.avatar,
    user?.profile?.avatar?.url
  ];

  for (const candidate of candidates) {
    const resolved = resolveMediaAssetUrl(candidate);
    if (resolved) {
      if (DEFAULT_PROFILE_IMAGE_REGEX.test(resolved ?? '') && user?.username) {
        const mapKey = String(user.username).trim().toLowerCase();
        const fallbackPath = TF2_AVATAR_MAP[mapKey];
        if (fallbackPath) {
          const mapped = resolveMediaAssetUrl(fallbackPath, fallback);
          if (mapped) {
            return mapped;
          }
        }
      }
      return resolved;
    }
  }

  if (user?.username) {
    const mapKey = String(user.username).trim().toLowerCase();
    const fallbackPath = TF2_AVATAR_MAP[mapKey];
    if (fallbackPath) {
      const mapped = resolveMediaAssetUrl(fallbackPath, fallback);
      if (mapped) {
        return mapped;
      }
    }
  }

  return resolveMediaAssetUrl(null, fallback);
};

export const formatPinDateTime = (value) =>
  formatDateTime(value, {
    fallback: null,
    options: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }
  });

export const formatEventRange = (start, end) => {
  const startLabel = formatPinDateTime(start);
  const endLabel = formatPinDateTime(end);
  if (startLabel && endLabel) {
    return `${startLabel} -> ${endLabel}`;
  }
  return startLabel ?? endLabel ?? null;
};

export const formatAddress = (address) => {
  if (!address) {
    return null;
  }
  const text = [
    address.precise?.line1 || address?.line1,
    address.precise?.line2 || address?.line2,
    address.precise?.city || address?.city,
    address.precise?.state || address?.state,
    address.precise?.postalCode || address?.postalCode
  ]
    .map((entry) => (entry ? String(entry).trim() : ''))
    .filter(Boolean)
    .join(', ');
  return text || null;
};

export const formatApproximateAddress = (input) => {
  if (!input) {
    return null;
  }
  const text = [input.city, input.state, input.country]
    .map((entry) => (entry ? String(entry).trim() : ''))
    .filter(Boolean)
    .join(', ');
  return text || null;
};

export const buildUserProfileLink = (user, returnPath) => {
  if (!user) {
    return null;
  }
  const targetId = user._id || user.id || user.uid || user.username || user.email;
  if (!targetId) {
    return null;
  }
  const pathname = routes.profile.byId(targetId);
  const link = { pathname };
  if (returnPath) {
    link.state = { returnTo: returnPath };
  }
  return link;
};

export const formatViewerDistanceLabel = (meters) => {
  if (meters === null || meters === undefined) {
    return null;
  }
  if (meters >= METERS_PER_MILE) {
    const miles = metersToMiles(meters);
    return miles === null ? null : `${miles.toFixed(1)} miles`;
  }
  if (meters >= 10) {
    return `${Math.round(meters)} meters`;
  }
  return `${meters.toFixed(1)} meters`;
};
