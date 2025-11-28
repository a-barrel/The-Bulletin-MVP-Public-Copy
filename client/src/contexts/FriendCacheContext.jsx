import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };
const DEFAULT_KEY = 'friends';

const FriendCacheContext = createContext(null);

export function FriendCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      getRoster: (key = DEFAULT_KEY) => {
        const entry = cacheRef.current.get(key);
        if (entry) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[friend-cache] hit', { key, stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return entry || null;
      },
      setRoster: (key = DEFAULT_KEY, data) => {
        if (!data) return;
        cacheRef.current.set(key, { ...data, ts: Date.now() });
      },
      clear: (key = DEFAULT_KEY) => {
        cacheRef.current.delete(key);
      }
    }),
    []
  );

  return <FriendCacheContext.Provider value={api}>{children}</FriendCacheContext.Provider>;
}

export function useFriendCache() {
  const ctx = useContext(FriendCacheContext);
  if (!ctx) {
    throw new Error('useFriendCache must be used within a FriendCacheProvider');
  }
  return ctx;
}

export default FriendCacheContext;
