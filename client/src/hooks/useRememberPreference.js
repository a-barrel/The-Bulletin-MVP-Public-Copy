import { useCallback, useEffect, useState } from 'react';

export default function useRememberPreference(storageKey, defaultValue = true) {
  const getInitialValue = () => {
    if (typeof window === 'undefined' || !storageKey) {
      return Boolean(defaultValue);
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) {
        return Boolean(defaultValue);
      }
      return stored === 'true';
    } catch {
      return Boolean(defaultValue);
    }
  };

  const [value, setValue] = useState(getInitialValue);

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, value ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  }, [storageKey, value]);

  const update = useCallback((next) => {
    setValue((prev) => {
      if (typeof next === 'function') {
        return Boolean(next(prev));
      }
      return Boolean(next);
    });
  }, []);

  return [value, update];
}
