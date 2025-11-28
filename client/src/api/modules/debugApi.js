import { apiGet, apiPost } from '../httpClient';

export const awardBadge = (badgeId) => {
  if (!badgeId) throw new Error('Badge id is required');
  return apiPost(`/api/users/me/badges/${encodeURIComponent(badgeId)}`);
};

export const debugListBadges = ({ userId } = {}) => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  const query = params.toString();
  return apiGet(query ? `/api/debug/badges?${query}` : '/api/debug/badges');
};

export const debugGrantBadge = ({ userId, badgeId }) => {
  if (!badgeId) throw new Error('Badge id is required to grant');
  return apiPost('/api/debug/badges/grant', { userId, badgeId });
};

export const debugRevokeBadge = ({ userId, badgeId }) => {
  if (!badgeId) throw new Error('Badge id is required to revoke');
  return apiPost('/api/debug/badges/revoke', { userId, badgeId });
};

export const debugResetBadges = ({ userId } = {}) => apiPost('/api/debug/badges/reset', { userId });

export const fetchUsersWithCussCount = () => apiGet('/api/debug/bad-users');

export const incrementUserCussCount = (userId) => {
  if (!userId) throw new Error('User id is required');
  return apiPost(`/api/debug/bad-users/${encodeURIComponent(userId)}/increment`);
};

export const resetUserCussCount = (userId) => {
  if (!userId) throw new Error('User id is required');
  return apiPost(`/api/debug/bad-users/${encodeURIComponent(userId)}/reset`);
};
