export const MODERATION_ACTION_OPTIONS = [
  { value: 'warn', label: 'Warn user' },
  { value: 'report', label: 'Report user (rate limited)' },
  { value: 'mute', label: 'Mute user' },
  { value: 'unmute', label: 'Unmute user' },
  { value: 'block', label: 'Block user' },
  { value: 'unblock', label: 'Unblock user' },
  { value: 'ban', label: 'Ban (suspend)' },
  { value: 'unban', label: 'Unban (reactivate)' }
];

export const QUICK_MODERATION_ACTIONS = ['warn', 'mute', 'block', 'ban'];

export default MODERATION_ACTION_OPTIONS;
