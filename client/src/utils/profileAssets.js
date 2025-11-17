import runtimeConfig from '../config/runtime';
import { normalizeProfileImagePath } from './media';

const FALLBACK_AVATAR = '/images/profile/profile-01.jpg';
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
const FALLBACK_BANNER = null;

const resolveAbsoluteAsset = (value) => {
  if (!value) {
    return null;
  }
  const trimmed = normalizeProfileImagePath(value.trim());
  if (!trimmed) {
    return null;
  }
  if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    if (runtimeConfig.isOffline) {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const url = new URL(trimmed, origin);
        const offlineHosts = new Set([
          'localhost:5000',
          '127.0.0.1:5000',
          'localhost:8000',
          '127.0.0.1:8000'
        ]);
        if (offlineHosts.has(url.host) && url.pathname.startsWith('/images/')) {
          const relative = normalizeProfileImagePath(url.pathname);
          const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
          return base ? `${base}${relative}` : relative;
        }
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  const normalized = normalizeProfileImagePath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  return base ? `${base}${normalized}` : normalized;
};

export const resolveProfileAvatarUrl = (avatar) => {
  if (!avatar) {
    return resolveAbsoluteAsset(FALLBACK_AVATAR) ?? FALLBACK_AVATAR;
  }
  if (typeof avatar === 'string') {
    const tf2Source = TF2_AVATAR_MAP[avatar.toLowerCase?.() || avatar];
    return (
      resolveAbsoluteAsset(tf2Source || avatar) ??
      resolveAbsoluteAsset(FALLBACK_AVATAR) ??
      FALLBACK_AVATAR
    );
  }
  if (typeof avatar === 'object') {
    const source = avatar.url ?? avatar.thumbnailUrl ?? avatar.path;
    const resolved = typeof source === 'string' ? resolveAbsoluteAsset(source) : null;
    if (resolved) {
      return resolved;
    }
  }
  return resolveAbsoluteAsset(FALLBACK_AVATAR) ?? FALLBACK_AVATAR;
};

export const resolveProfileBannerUrl = (banner) => {
  if (!banner) {
    return FALLBACK_BANNER ? resolveAbsoluteAsset(FALLBACK_BANNER) ?? FALLBACK_BANNER : null;
  }
  if (typeof banner === 'string') {
    return (
      resolveAbsoluteAsset(banner) ??
      (FALLBACK_BANNER ? resolveAbsoluteAsset(FALLBACK_BANNER) ?? FALLBACK_BANNER : null)
    );
  }
  if (typeof banner === 'object') {
    const source = banner.url ?? banner.thumbnailUrl ?? banner.path;
    const resolved = typeof source === 'string' ? resolveAbsoluteAsset(source) : null;
    if (resolved) {
      return resolved;
    }
  }
  return FALLBACK_BANNER ? resolveAbsoluteAsset(FALLBACK_BANNER) ?? FALLBACK_BANNER : null;
};

export { TF2_AVATAR_MAP };
