import { apiGet, apiPost } from '../httpClient';

export const insertLocationUpdate = (input) => apiPost('/api/locations', input);

export const fetchNearbyUsers = async () => {
  // Location sharing between users is disabled; return an empty list.
  return [];
};

export const fetchLocationHistory = (userId) => {
  if (!userId) throw new Error('User id is required to load location history');
  return apiGet(`/api/locations/history/${encodeURIComponent(userId)}`);
};
