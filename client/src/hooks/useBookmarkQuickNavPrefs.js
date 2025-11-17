import { useCallback, useEffect, useRef, useState } from 'react';

const QUICK_NAV_STORAGE_KEY = 'pinpoint:bookmarkQuickNavPrefs';
const QUICK_NAV_STORAGE_VERSION = 1;
const QUICK_NAV_EVENT = 'pinpoint:bookmarkQuickNavPrefsChanged';
const DEFAULT_PREFS = { hidden: [] };

function readStoredPrefs() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PREFS;
  }
  try {
    const stored = window.localStorage.getItem(QUICK_NAV_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFS;
    }
    const parsed = JSON.parse(stored);
    const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden : [];
    const version = typeof parsed?.version === 'number' ? parsed.version : 0;
    if (version !== QUICK_NAV_STORAGE_VERSION) {
      window.localStorage.setItem(
        QUICK_NAV_STORAGE_KEY,
        JSON.stringify({
          version: QUICK_NAV_STORAGE_VERSION,
          hidden
        })
      );
    }
    return { hidden };
  } catch (error) {
    console.warn('Failed to parse bookmark quick nav prefs', error);
    return DEFAULT_PREFS;
  }
}

export default function useBookmarkQuickNavPrefs() {
  const [hiddenKeys, setHiddenKeys] = useState(() => readStoredPrefs().hidden);
  const [highlightedKey, setHighlightedKey] = useState(null);
  const highlightTimerRef = useRef(null);

  const persistHiddenKeys = useCallback((nextHidden) => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(
        QUICK_NAV_STORAGE_KEY,
        JSON.stringify({
          version: QUICK_NAV_STORAGE_VERSION,
          hidden: nextHidden
        })
      );
      window.dispatchEvent(new Event(QUICK_NAV_EVENT));
    } catch (error) {
      console.warn('Failed to persist bookmark quick nav prefs', error);
    }
  }, []);

  const setCollectionPinned = useCallback(
    (collectionKey, pinned) => {
      if (!collectionKey) {
        return;
      }
      setHiddenKeys((prev) => {
        const hiddenSet = new Set(prev);
        if (pinned) {
          hiddenSet.delete(collectionKey);
        } else {
          hiddenSet.add(collectionKey);
        }
        const nextHidden = Array.from(hiddenSet);
        persistHiddenKeys(nextHidden);
        return nextHidden;
      });
    },
    [persistHiddenKeys]
  );

  const isCollectionPinned = useCallback(
    (collectionKey) => !hiddenKeys.includes(collectionKey),
    [hiddenKeys]
  );

  const clearHighlight = useCallback(() => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightedKey(null);
  }, []);

  const highlightCollection = useCallback(
    (collectionKey, duration = 2200) => {
      if (!collectionKey) {
        return;
      }
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      setHighlightedKey(collectionKey);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedKey((prev) => (prev === collectionKey ? null : prev));
        highlightTimerRef.current = null;
      }, duration);
    },
    []
  );

  useEffect(() => () => clearHighlight(), [clearHighlight]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncFromStorage = () => {
      setHiddenKeys(readStoredPrefs().hidden);
    };

    const handleStorage = (event) => {
      if (event?.key && event.key !== QUICK_NAV_STORAGE_KEY) {
        return;
      }
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(QUICK_NAV_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(QUICK_NAV_EVENT, syncFromStorage);
    };
  }, []);

  return {
    hiddenKeys,
    highlightedKey,
    isCollectionPinned,
    setCollectionPinned,
    highlightCollection,
    clearHighlight
  };
}

export { QUICK_NAV_STORAGE_KEY, QUICK_NAV_STORAGE_VERSION };
