import { createContext, useContext, useMemo, useRef } from 'react';

const IS_DEV = import.meta.env.DEV;
const cacheStats = { hits: 0, misses: 0 };
const DEFAULT_KEY = 'rooms';

const ChatRoomCacheContext = createContext(null);

export function ChatRoomCacheProvider({ children }) {
  const cacheRef = useRef(new Map());

  const api = useMemo(
    () => ({
      getRooms: (key = DEFAULT_KEY) => {
        const entry = cacheRef.current.get(key);
        if (entry) {
          cacheStats.hits += 1;
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[chat-room-cache] hit', { key, stats: { ...cacheStats } });
          }
        } else {
          cacheStats.misses += 1;
        }
        return entry || null;
      },
      setRooms: (key = DEFAULT_KEY, data) => {
        if (!data) return;
        cacheRef.current.set(key, { ...data, ts: Date.now() });
      },
      clear: (key = DEFAULT_KEY) => {
        cacheRef.current.delete(key);
      }
    }),
    []
  );

  return (
    <ChatRoomCacheContext.Provider value={api}>{children}</ChatRoomCacheContext.Provider>
  );
}

export function useChatRoomCache() {
  const ctx = useContext(ChatRoomCacheContext);
  if (!ctx) {
    throw new Error('useChatRoomCache must be used within a ChatRoomCacheProvider');
  }
  return ctx;
}

export default ChatRoomCacheContext;
