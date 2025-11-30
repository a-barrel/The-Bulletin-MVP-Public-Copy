import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };
// Keep geocode results for the entire session (no expiry)
let defaultTtlMs = Number.POSITIVE_INFINITY;

export const setGeocodeDefaultTtlMs = (ttlMs) => {
  if (Number.isFinite(ttlMs) && ttlMs > 0) {
    defaultTtlMs = ttlMs;
  }
};

const GeocodeCacheContext = createContext(null);

export function GeocodeCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      get: (key) => {
        if (!key) return null;
        const entry = cacheRef.current.get(key);
        if (entry) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[geocode-cache] hit', { key, stats: { ...cacheStats } });
          }
          return entry.value;
        }
        cacheStats.misses += 1;
        return null;
      },
      set: (key, value, ttlMs = defaultTtlMs) => {
        if (!key || value === undefined) return;
        cacheRef.current.set(key, { value, ts: Date.now(), ttl: ttlMs });
      },
      clear: (key) => {
        if (!key) return;
        cacheRef.current.delete(key);
      }
    }),
    []
  );

  return <GeocodeCacheContext.Provider value={api}>{children}</GeocodeCacheContext.Provider>;
}

export function useGeocodeCache() {
  const ctx = useContext(GeocodeCacheContext);
  if (!ctx) {
    throw new Error('useGeocodeCache must be used within a GeocodeCacheProvider');
  }
  return ctx;
}

export default GeocodeCacheContext;
