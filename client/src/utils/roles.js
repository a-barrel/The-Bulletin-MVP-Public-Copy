import runtimeConfig from '../config/runtime';

const BASE_USER_ROLE = (runtimeConfig.roles?.baseUserRole || 'user').toLowerCase();
const DEVELOPER_ROLE = (runtimeConfig.roles?.developerRoleName || 'developer').toLowerCase();
const ALWAYS_ADMIN_USER_IDS = new Set(runtimeConfig.roles?.alwaysAdminUserIds || []);
const ALWAYS_ADMIN_EMAILS = new Set(
  (runtimeConfig.roles?.alwaysAdminEmails || []).map((entry) => entry.toLowerCase())
);
const ROLE_OVERRIDE_STORAGE_KEY = 'pinpointRoleOverride';

const normalizeRole = (role) =>
  typeof role === 'string' ? role.trim().toLowerCase() : '';

export const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) {
    return [];
  }
  const deduped = new Set();
  roles.forEach((role) => {
    const normalized = normalizeRole(role);
    if (normalized) {
      deduped.add(normalized);
    }
  });
  return [...deduped];
};

export const hasElevatedRole = (roles) =>
  normalizeRoles(roles).some((role) => role && role !== BASE_USER_ROLE);

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : null;

const readStoredOverride = () => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return null;
  }
  const raw = window.localStorage.getItem(ROLE_OVERRIDE_STORAGE_KEY);
  return raw ? raw.trim().toLowerCase() : null;
};

const writeStoredOverride = (value) => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return;
  }
  if (!value) {
    window.localStorage.removeItem(ROLE_OVERRIDE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ROLE_OVERRIDE_STORAGE_KEY, value.trim().toLowerCase());
};

export const isAlwaysAdminViewer = (viewer) => {
  if (!viewer) {
    return false;
  }
  const firebaseUid =
    typeof viewer.firebaseUid === 'string'
      ? viewer.firebaseUid
      : typeof viewer.firebaseUID === 'string'
      ? viewer.firebaseUID
      : typeof viewer.authUid === 'string'
      ? viewer.authUid
      : undefined;
  if (firebaseUid && ALWAYS_ADMIN_USER_IDS.has(firebaseUid)) {
    return true;
  }
  const email =
    normalizeEmail(viewer.email) ||
    normalizeEmail(viewer.primaryEmail) ||
    normalizeEmail(viewer.username);
  if (email && ALWAYS_ADMIN_EMAILS.has(email)) {
    return true;
  }
  return false;
};

export const viewerHasDeveloperAccess = (viewer, { offlineOverride } = {}) => {
  const storedOverride = readStoredOverride();
  if (storedOverride === BASE_USER_ROLE) {
    return false;
  }
  if (storedOverride === DEVELOPER_ROLE) {
    return true;
  }
  if (!viewer) {
    return (offlineOverride === undefined ? runtimeConfig.isOffline : offlineOverride) || false;
  }
  if (isAlwaysAdminViewer(viewer)) {
    return true;
  }
  if (typeof viewer.debugRoleOverride === 'string') {
    return normalizeRole(viewer.debugRoleOverride) !== BASE_USER_ROLE;
  }
  if (offlineOverride === undefined ? runtimeConfig.isOffline : offlineOverride) {
    return true;
  }
  return hasElevatedRole(viewer.roles);
};

export const getEffectiveRoleLabel = (viewer, options) =>
  viewerHasDeveloperAccess(viewer, options) ? DEVELOPER_ROLE : BASE_USER_ROLE;

export const resolveStoredRoleOverride = () => readStoredOverride();

export const setStoredRoleOverride = (roleName) => {
  if (!roleName) {
    writeStoredOverride(null);
    return;
  }
  writeStoredOverride(roleName);
};

export default viewerHasDeveloperAccess;
