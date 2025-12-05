const memoryLocks = new Set();

const buildKey = (uid) => `pinpoint:map-teleport-lock:${uid || 'anonymous'}`;

const setMemoryLock = (key) => {
  if (!key) return;
  memoryLocks.add(key);
};

const clearMemoryLock = (key) => {
  if (!key) return;
  memoryLocks.delete(key);
};

const hasMemoryLock = (key) => memoryLocks.has(key);

const safeSessionStorage = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
};

export const setTeleportLockForUser = (uid) => {
  const key = buildKey(uid);
  const storage = safeSessionStorage();
  if (storage) {
    try {
      storage.setItem(key, '1');
    } catch {
      setMemoryLock(key);
      return;
    }
  }
  setMemoryLock(key);
};

export const clearTeleportLockForUser = (uid) => {
  const key = buildKey(uid);
  const storage = safeSessionStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
  clearMemoryLock(key);
};

export const isTeleportLockedForUser = (uid) => {
  const key = buildKey(uid);
  const storage = safeSessionStorage();
  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        setMemoryLock(key);
        return true;
      }
    } catch {
      // fall back to memory lock
    }
  }
  return hasMemoryLock(key);
};

export default {
  setTeleportLockForUser,
  clearTeleportLockForUser,
  isTeleportLockedForUser
};
