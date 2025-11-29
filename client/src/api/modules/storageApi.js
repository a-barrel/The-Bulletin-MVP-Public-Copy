import { apiGet } from '../httpClient';

export const fetchStorageObjects = ({ prefix, limit } = {}) => {
  const params = new URLSearchParams();
  if (typeof prefix === 'string') params.set('prefix', prefix);
  if (Number.isFinite(limit) && limit > 0) params.set('limit', String(limit));
  const queryString = params.toString();
  return apiGet(queryString ? `/api/storage/objects?${queryString}` : '/api/storage/objects');
};
