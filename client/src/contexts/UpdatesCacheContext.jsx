import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };
// Keep updates cached for the entire session (no expiry)
const DEFAULT_TTL_MS = Number.POSITIVE_INFINITY;

const UpdatesCacheContext = createContext(null);

export function UpdatesCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      get: (userId) => {
        if (!userId) return null;
        const entry = cacheRef.current.get(userId);
        if (entry) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[updates-cache] hit', { userId, stats: { ...cacheStats } });
          }
          return entry.data;
        }
        cacheStats.misses += 1;
        return null;
      },
      set: (userId, data, ttlMs = DEFAULT_TTL_MS) => {
        if (!userId || !Array.isArray(data)) return;
        cacheRef.current.set(userId, { data, ts: Date.now(), ttl: ttlMs });
      },
      clear: (userId) => {
        if (!userId) return;
        cacheRef.current.delete(userId);
      }
    }),
    []
  );

  return (
    <UpdatesCacheContext.Provider value={api}>{children}</UpdatesCacheContext.Provider>
  );
}

export function useUpdatesCache() {
  const ctx = useContext(UpdatesCacheContext);
  if (!ctx) {
    throw new Error('useUpdatesCache must be used within an UpdatesCacheProvider');
  }
  return ctx;
}

export default UpdatesCacheContext;
