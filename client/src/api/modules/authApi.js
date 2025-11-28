import { apiDelete, apiGet, apiPatch, apiPost } from '../httpClient';

export const revokeCurrentSession = () => apiPost('/api/auth/logout');

export const fetchCurrentUserProfile = () => apiGet('/api/users/me', { cache: 'no-store' });

export const updateCurrentUserProfile = (input) => apiPatch('/api/users/me', input);

export const registerPushToken = (token, options = {}) => {
  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  if (!normalizedToken) {
    throw new Error('Push token is required.');
  }
  const platform =
    typeof options?.platform === 'string' && options.platform.trim()
      ? options.platform.trim()
      : undefined;
  return apiPost('/api/users/me/push-tokens', {
    token: normalizedToken,
    ...(platform ? { platform } : {})
  });
};

export const requestDataExport = ({ reason } = {}) => apiPost('/api/users/me/data-export', reason ? { reason } : {});

export const requestAccountDeletion = () => apiPost('/api/users/me/delete-account');

export const fetchUsers = ({ search, limit } = {}) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.toString();
  return apiGet(query ? `/api/users?${query}` : '/api/users');
};

export const fetchUserProfile = (userId) => {
  if (!userId) throw new Error('User id is required');
  return apiGet(`/api/users/${encodeURIComponent(userId)}`, { cache: 'no-store' });
};

export const createUserProfile = (input) => apiPost('/api/debug/users', input);

export const updateUserProfile = (userId, input) => {
  if (!userId) throw new Error('User id is required to update a profile');
  return apiPatch(`/api/debug/users/${encodeURIComponent(userId)}`, input);
};

export const fetchApiTokens = () => apiGet('/api/users/me/api-tokens');

export const createApiToken = ({ label } = {}) =>
  apiPost('/api/users/me/api-tokens', label ? { label } : {});

export const revokeApiToken = (tokenId) => {
  if (!tokenId) throw new Error('Token id is required to revoke a token');
  return apiDelete(`/api/users/me/api-tokens/${encodeURIComponent(tokenId)}`);
};

export const fetchBlockedUsers = () => apiGet('/api/users/me/blocked');

export const blockUser = (userId) => {
  if (!userId) throw new Error('User id is required to block a user');
  return apiPost('/api/users/me/blocked', { userId });
};

export const unblockUser = (userId) => {
  if (!userId) throw new Error('User id is required to unblock a user');
  return apiDelete(`/api/users/me/blocked/${encodeURIComponent(userId)}`);
};

export const fetchDebugAuthAccounts = async () => {
  const payload = await apiGet('/api/debug/auth/accounts');
  return Array.isArray(payload?.accounts) ? payload.accounts : [];
};

export const requestAccountSwap = async (uid) => {
  if (!uid) throw new Error('Firebase UID is required to swap accounts');
  const payload = await apiPost('/api/debug/auth/swap', { uid });
  if (!payload?.token) throw new Error('Server did not return a custom token');
  return payload.token;
};
