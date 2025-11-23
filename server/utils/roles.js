const runtime = require('../config/runtime');

const BASE_USER_ROLE = (runtime.roles?.baseUserRole || 'user').toLowerCase();
const DEVELOPER_ROLE = (runtime.roles?.developerRoleName || 'developer').toLowerCase();
const ALWAYS_ADMIN_USER_IDS =
  runtime.roles?.alwaysAdminUserIds instanceof Set
    ? runtime.roles.alwaysAdminUserIds
    : new Set();
const ALWAYS_ADMIN_EMAILS =
  runtime.roles?.alwaysAdminEmails instanceof Set
    ? runtime.roles.alwaysAdminEmails
    : new Set();

const normalizeRole = (role) =>
  typeof role === 'string' ? role.trim().toLowerCase() : '';

const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) {
    return [];
  }
  const deduped = new Set();
  for (const role of roles) {
    const normalized = normalizeRole(role);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return [...deduped];
};

const hasElevatedRole = (roles) =>
  normalizeRoles(roles).some((role) => role && role !== BASE_USER_ROLE);

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : null;

const isAlwaysAdminUser = (user) => {
  if (!user) {
    return false;
  }
  const firebaseUid =
    typeof user.firebaseUid === 'string'
      ? user.firebaseUid
      : typeof user.firebaseUID === 'string'
      ? user.firebaseUID
      : undefined;
  if (firebaseUid && ALWAYS_ADMIN_USER_IDS.has(firebaseUid)) {
    return true;
  }
  const email = normalizeEmail(user.email || user.primaryEmail || user.username);
  if (email && ALWAYS_ADMIN_EMAILS.has(email)) {
    return true;
  }
  return false;
};

const viewerHasDeveloperAccess = (viewer, { offlineOverride } = {}) => {
  if (offlineOverride === undefined ? runtime.isOffline : offlineOverride) {
    return true;
  }
  if (!viewer) {
    return false;
  }
  if (isAlwaysAdminUser(viewer)) {
    return true;
  }
  return hasElevatedRole(viewer.roles);
};

async function ensurePersistentDeveloperRole(user) {
  if (!user || !isAlwaysAdminUser(user)) {
    return user;
  }
  const roles = normalizeRoles(user.roles);
  if (!roles.includes(DEVELOPER_ROLE)) {
    roles.push(DEVELOPER_ROLE);
    user.roles = roles;
    try {
      await user.save();
    } catch (error) {
      console.warn('Failed to persist developer role for always-admin user', error);
    }
  }
  return user;
}

const getEffectiveRoleLabel = (viewer, options) =>
  viewerHasDeveloperAccess(viewer, options) ? DEVELOPER_ROLE : BASE_USER_ROLE;

module.exports = {
  normalizeRoles,
  hasElevatedRole,
  viewerHasDeveloperAccess,
  ensurePersistentDeveloperRole,
  getEffectiveRoleLabel,
  BASE_USER_ROLE,
  DEVELOPER_ROLE,
  isAlwaysAdminUser
};
