import { apiPost } from '../httpClient';
import { auth } from '../../firebase';

const clientEventCache = new Map();
const CLIENT_EVENT_TTL_MS = 10_000;

export const logClientEvent = async ({
  category = 'client-errors',
  severity = 'error',
  message,
  stack,
  context,
  timestamp
} = {}) => {
  if (import.meta.env.DEV) return;
  if (!message) return;
  if (!auth?.currentUser) return;

  const dedupeKey = `${category || 'client'}:${message || ''}`;
  const now = Date.now();
  const lastLogged = clientEventCache.get(dedupeKey);
  if (lastLogged && now - lastLogged < CLIENT_EVENT_TTL_MS) return;

  try {
    await apiPost('/api/dev-logs', {
      category,
      severity,
      message,
      stack,
      context,
      timestamp: timestamp ?? new Date().toISOString()
    });
    clientEventCache.set(dedupeKey, now);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to send client log event', error);
    }
  }
};
