import { useCallback, useEffect, useState } from 'react';

export default function usePushPromptDismissal(storageKey, permission) {
  const readInitial = () => {
    if (typeof window === 'undefined' || !storageKey) {
      return false;
    }
    try {
      return window.localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  };

  const [dismissed, setDismissed] = useState(readInitial);

  const persistValue = useCallback((next) => {
    setDismissed(next);
    if (typeof window === 'undefined' || !storageKey) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, next ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  useEffect(() => {
    if (permission === 'granted' && !dismissed) {
      persistValue(true);
    }
  }, [dismissed, permission, persistValue]);

  const dismiss = useCallback(() => {
    persistValue(true);
  }, [persistValue]);

  return [dismissed, dismiss];
}
