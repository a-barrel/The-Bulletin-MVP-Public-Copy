import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };

const ReplyCacheContext = createContext(null);

export function ReplyCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      getReplies: (pinId) => {
        if (!pinId) return null;
        const value = cacheRef.current.get(pinId) || null;
        if (value) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[reply-cache] hit', { pinId, stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return value;
      },
      setReplies: (pinId, replies) => {
        if (!pinId || !Array.isArray(replies)) return;
        cacheRef.current.set(pinId, { ts: Date.now(), replies });
      },
      clear: (pinId) => {
        if (!pinId) return;
        cacheRef.current.delete(pinId);
      }
    }),
    []
  );

  return <ReplyCacheContext.Provider value={api}>{children}</ReplyCacheContext.Provider>;
}

export function useReplyCache() {
  const ctx = useContext(ReplyCacheContext);
  if (!ctx) {
    throw new Error('useReplyCache must be used within a ReplyCacheProvider');
  }
  return ctx;
}

export default ReplyCacheContext;
