import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };

const AttendeeCacheContext = createContext(null);

export function AttendeeCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      getAttendees: (pinId) => {
        if (!pinId) return null;
        const value = cacheRef.current.get(pinId) || null;
        if (value) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[attendee-cache] hit', { pinId, stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return value;
      },
      setAttendees: (pinId, data) => {
        if (!pinId || !data) return;
        cacheRef.current.set(pinId, { ...data, ts: Date.now() });
      },
      clear: (pinId) => {
        if (!pinId) return;
        cacheRef.current.delete(pinId);
      }
    }),
    []
  );

  return (
    <AttendeeCacheContext.Provider value={api}>{children}</AttendeeCacheContext.Provider>
  );
}

export function useAttendeeCache() {
  const ctx = useContext(AttendeeCacheContext);
  if (!ctx) {
    throw new Error('useAttendeeCache must be used within an AttendeeCacheProvider');
  }
  return ctx;
}

export default AttendeeCacheContext;
