import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };

const ME_KEY = '__me__';

const UserCacheContext = createContext(null);

export function UserCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      getUser: (userId) => {
        if (!userId) {
          return null;
        }
        const value = cacheRef.current.get(userId) || null;
        if (value) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[user-cache] hit', { userId, stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return value;
      },
      getMe: () => {
        const value = cacheRef.current.get(ME_KEY) || null;
        if (value) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[user-cache] hit (me)', { stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return value;
      },
      setUsers: (users) => {
        if (!Array.isArray(users)) {
          return;
        }
        users.forEach((user) => {
          const id = user?._id || user?.id || user?.uid;
          if (id) {
            cacheRef.current.set(id, user);
          }
        });
      },
      upsertUser: (user) => {
        const id = user?._id || user?.id || user?.uid;
        if (!id) return;
        cacheRef.current.set(id, user);
      },
      setMe: (user) => {
        if (user) {
          cacheRef.current.set(ME_KEY, user);
          const id = user?._id || user?.id || user?.uid;
          if (id) {
            cacheRef.current.set(id, user);
          }
        }
      },
      clearAll: () => {
        cacheRef.current = new Map();
      }
    }),
    []
  );

  return <UserCacheContext.Provider value={api}>{children}</UserCacheContext.Provider>;
}

export function useUserCache() {
  const ctx = useContext(UserCacheContext);
  if (!ctx) {
    throw new Error('useUserCache must be used within a UserCacheProvider');
  }
  return ctx;
}

export default UserCacheContext;
