import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemePreferenceContext = createContext({
  theme: 'system',
  resolvedMode: 'light',
  setTheme: () => {},
  cycleTheme: () => {},
  themeOrder: ['system', 'light', 'dark']
});

const THEME_ORDER = ['system', 'light', 'dark'];
const STORAGE_KEY = 'pinpoint:themePreference';

const readSystemMode = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const normalizeThemeValue = (value) => (THEME_ORDER.includes(value) ? value : 'system');

export function ThemePreferenceProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && THEME_ORDER.includes(stored)) {
        return stored;
      }
    } catch {
      // ignore storage failures
    }
    return 'system';
  });

  const [systemMode, setSystemMode] = useState(readSystemMode);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (event) => {
        setSystemMode(event.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  const setTheme = useCallback((value) => {
    setThemeState(normalizeThemeValue(value));
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const current = normalizeThemeValue(prev);
      const idx = THEME_ORDER.indexOf(current);
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const isThemeHotkey =
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        (event.key === 't' || event.key === 'T');
      if (isThemeHotkey) {
        event.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleTheme]);

  const resolvedMode = theme === 'system' ? systemMode : theme;

  const value = useMemo(
    () => ({
      theme,
      resolvedMode,
      setTheme,
      cycleTheme,
      themeOrder: THEME_ORDER
    }),
    [theme, resolvedMode, setTheme, cycleTheme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export const useThemePreference = () => useContext(ThemePreferenceContext);

export default ThemePreferenceContext;
