import { apiDelete, apiGet, apiPatch, apiPost } from '../httpClient';

export const createUpdate = async (input) => {
  try {
    return await apiPost('/api/debug/updates', input);
  } catch (error) {
    const issueText = Array.isArray(error?.payload?.issues)
      ? `: ${error.payload.issues
          .map((issue) => `${issue.path?.join('.') ?? ''} ${issue.message}`.trim())
          .join('; ')}`
      : '';
    const err = new Error(`${error?.payload?.message || 'Failed to create update'}${issueText}`);
    err.status = error?.status;
    err.payload = error?.payload;
    throw err;
  }
};

export const fetchUpdates = ({ userId, limit } = {}) => {
  if (!userId) {
    throw new Error('User id is required to load updates');
  }
  const params = new URLSearchParams({ userId });
  if (limit !== undefined) params.set('limit', String(limit));
  return apiGet(`/api/updates?${params.toString()}`);
};

export const markUpdateRead = (updateId) => {
  if (!updateId) throw new Error('Update id is required');
  return apiPatch(`/api/updates/${encodeURIComponent(updateId)}/read`);
};

export const markAllUpdatesRead = () => apiPatch('/api/updates/mark-all-read');

export const deleteUpdate = (updateId) => {
  if (!updateId) throw new Error('Update id is required to delete an update');
  return apiDelete(`/api/updates/${encodeURIComponent(updateId)}`);
};
