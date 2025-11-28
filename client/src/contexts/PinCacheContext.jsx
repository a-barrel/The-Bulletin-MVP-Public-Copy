import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };

const PinCacheContext = createContext(null);

export function PinCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      getPin: (pinId) => {
        if (!pinId) return null;
        const value = cacheRef.current.get(pinId) || null;
        if (value) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[pin-cache] hit', { pinId, stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return value;
      },
      setPins: (pins) => {
        if (!Array.isArray(pins)) {
          return;
        }
        pins.forEach((pin) => {
          const id = pin?._id || pin?.id || pin?.pinId;
          if (id) {
            cacheRef.current.set(id, pin);
          }
        });
      },
      upsertPin: (pin) => {
        const id = pin?._id || pin?.id || pin?.pinId;
        if (!id) return;
        cacheRef.current.set(id, pin);
      }
    }),
    []
  );

  return <PinCacheContext.Provider value={api}>{children}</PinCacheContext.Provider>;
}

export function usePinCache() {
  const ctx = useContext(PinCacheContext);
  if (!ctx) {
    throw new Error('usePinCache must be used within a PinCacheProvider');
  }
  return ctx;
}

export default PinCacheContext;
