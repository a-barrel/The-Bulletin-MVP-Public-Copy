import { apiGet, apiPost } from '../httpClient';

export const fetchModerationOverview = () => apiGet('/api/debug/moderation/overview');

export const fetchModerationHistory = (userId) => {
  if (!userId) throw new Error('User id is required to fetch moderation history');
  return apiGet(`/api/debug/moderation/history/${encodeURIComponent(userId)}`);
};

export const submitModerationAction = (input) => apiPost('/api/debug/moderation/actions', input);

export const listContentReports = ({ status, limit } = {}) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return apiGet(query ? `/api/debug/moderation/reports?${query}` : '/api/debug/moderation/reports');
};

export const resolveContentReport = (reportId, input = {}) => {
  if (!reportId) throw new Error('reportId is required to resolve a report');
  return apiPost(`/api/debug/moderation/reports/${encodeURIComponent(reportId)}/resolve`, input);
};
