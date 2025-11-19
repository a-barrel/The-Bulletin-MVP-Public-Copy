import runtimeConfig from '../config/runtime';

const DEFAULT_ADMIN_ROLES = ['admin', 'moderator', 'super-admin', 'system-admin'];

const normalizeRole = (role) =>
  typeof role === 'string' ? role.trim().toLowerCase() : '';

const resolveAllowedRoles = () => {
  const configured = Array.isArray(runtimeConfig.moderation?.allowedRoles)
    ? runtimeConfig.moderation.allowedRoles
    : DEFAULT_ADMIN_ROLES;
  return configured
    .map(normalizeRole)
    .filter(Boolean);
};

export const resolveModerationRoleChecksEnabled = () =>
  runtimeConfig.moderation?.roleChecksEnabled !== false;

export function canAccessModerationTools(viewer) {
  const checksEnabled = resolveModerationRoleChecksEnabled();
  if (runtimeConfig.isOffline || !checksEnabled) {
    return true;
  }
  if (!viewer) {
    return false;
  }
  const roles = Array.isArray(viewer.roles) ? viewer.roles : [];
  if (!roles.length) {
    return false;
  }
  const allowedRoles = resolveAllowedRoles();
  return roles.some((role) => allowedRoles.includes(normalizeRole(role)));
}

export default canAccessModerationTools;
