import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import useNetworkStatus from '../hooks/useNetworkStatus';

const DEFAULT_VALUE = {
  isOnline: true,
  isOffline: false,
  autoIsOnline: true,
  overrideMode: null,
  isOverrideEnabled: false,
  setNetworkOverride: () => {},
  clearNetworkOverride: () => {}
};

const NetworkStatusContext = createContext(DEFAULT_VALUE);

const STORAGE_KEY = 'pinpoint:network-override';

const readStoredOverride = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'online' || stored === 'offline' ? stored : null;
  } catch {
    return null;
  }
};

const persistOverride = (mode) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (mode === 'online' || mode === 'offline') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
};

export function NetworkStatusProvider({ children }) {
  const browserStatus = useNetworkStatus();
  const [overrideMode, setOverrideMode] = useState(readStoredOverride);

  const applyOverride = useCallback((mode) => {
    setOverrideMode(() => {
      const normalized = mode === 'online' || mode === 'offline' ? mode : null;
      persistOverride(normalized);
      return normalized;
    });
  }, []);

  const setNetworkOverride = useCallback(
    (mode) => {
      applyOverride(mode);
    },
    [applyOverride]
  );

  const clearNetworkOverride = useCallback(() => {
    applyOverride(null);
  }, [applyOverride]);

  const effectiveIsOnline =
    overrideMode === 'online'
      ? true
      : overrideMode === 'offline'
      ? false
      : browserStatus.isOnline;

  const contextValue = useMemo(
    () => ({
      isOnline: effectiveIsOnline,
      isOffline: !effectiveIsOnline,
      autoIsOnline: browserStatus.isOnline,
      overrideMode,
      isOverrideEnabled: overrideMode !== null,
      setNetworkOverride,
      clearNetworkOverride
    }),
    [browserStatus.isOnline, clearNetworkOverride, effectiveIsOnline, overrideMode, setNetworkOverride]
  );

  return <NetworkStatusContext.Provider value={contextValue}>{children}</NetworkStatusContext.Provider>;
}

export const useNetworkStatusContext = () => useContext(NetworkStatusContext);

export default NetworkStatusContext;
