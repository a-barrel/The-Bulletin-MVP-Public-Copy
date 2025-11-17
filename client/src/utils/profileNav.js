import runtimeConfig from '../config/runtime';
import { routes } from '../routes';

export default function resolveProfileNavTarget({ currentPath } = {}) {
  const profileBase = routes.profile.base.replace(/^\/+/, '');
  const profilePattern = profileBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const profileMe = routes.profile.me;

  if (!runtimeConfig.isOffline) {
    return profileMe;
  }

  if (typeof window === 'undefined') {
    return profileMe;
  }

  const input = window.prompt(
    'Enter a profile ID (leave blank for your profile, type "me" or cancel to stay put):'
  );
  if (input === null) {
    return currentPath ?? null;
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed.toLowerCase() === 'me') {
    return profileMe;
  }
  const sanitized = trimmed.replace(/^\/+/, '');
  if (new RegExp(`^${profilePattern}/.+`, 'i').test(sanitized)) {
    return `/${sanitized}`;
  }
  if (new RegExp(`^/${profilePattern}/.+`, 'i').test(trimmed)) {
    return trimmed;
  }
  return `${routes.profile.base}/${sanitized}`;
}
