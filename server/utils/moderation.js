const runtime = require('../config/runtime');

const DEFAULT_MODERATION_ROLES = ['admin', 'moderator', 'super-admin', 'system-admin'];

const normalizeRole = (role) =>
  typeof role === 'string' ? role.trim().toLowerCase() : '';

const resolveAllowedModerationRoles = () => {
  const configured = Array.isArray(runtime.moderation?.allowedRoles)
    ? runtime.moderation.allowedRoles
    : DEFAULT_MODERATION_ROLES;
  return configured.map(normalizeRole).filter(Boolean);
};

const canViewerModeratePins = (viewer) => {
  const checksEnabled = runtime.moderation?.roleChecksEnabled !== false;
  if (runtime.isOffline || !checksEnabled) {
    return true;
  }
  if (!viewer) {
    return false;
  }
  const viewerRoles = Array.isArray(viewer.roles) ? viewer.roles : [];
  if (!viewerRoles.length) {
    return false;
  }
  const allowed = resolveAllowedModerationRoles();
  return viewerRoles.map(normalizeRole).some((role) => allowed.includes(role));
};

module.exports = {
  canViewerModeratePins,
  resolveAllowedModerationRoles,
  DEFAULT_MODERATION_ROLES
};
