import runtimeConfig from '../config/runtime';
import { viewerHasDeveloperAccess } from './roles';

export const resolveModerationRoleChecksEnabled = () =>
  runtimeConfig.moderation?.roleChecksEnabled !== false;

export function canAccessModerationTools(viewer) {
  const checksEnabled = resolveModerationRoleChecksEnabled();
  if (!checksEnabled) {
    return true;
  }
  return viewerHasDeveloperAccess(viewer);
}

export default canAccessModerationTools;
