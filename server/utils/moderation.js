const runtime = require('../config/runtime');
const { viewerHasDeveloperAccess } = require('./roles');

const DEFAULT_MODERATION_ROLES = ['admin', 'moderator', 'super-admin', 'system-admin'];

const resolveAllowedModerationRoles = () => {
  if (runtime.roles?.elevatedRoles instanceof Set && runtime.roles.elevatedRoles.size > 0) {
    return Array.from(runtime.roles.elevatedRoles);
  }
  return DEFAULT_MODERATION_ROLES;
};

const canViewerModeratePins = (viewer) => {
  const checksEnabled = runtime.moderation?.roleChecksEnabled !== false;
  if (!checksEnabled) {
    return true;
  }
  return viewerHasDeveloperAccess(viewer);
};

module.exports = {
  canViewerModeratePins,
  resolveAllowedModerationRoles,
  DEFAULT_MODERATION_ROLES
};
