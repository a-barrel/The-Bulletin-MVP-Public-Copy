import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemePreferenceContext = createContext({
  theme: 'light',
  resolvedMode: 'light',
  setTheme: () => {},
  cycleTheme: () => {},
  themeOrder: ['light', 'dark']
});

const THEME_ORDER = ['light', 'dark', 'neon', 'sunset', 'forest', 'ocean', 'candy', 'glitch', 'plasma', 'rainbow', 'aurora', 'rainbow-animated'];
const STORAGE_KEY = 'pinpoint:themePreference';

const normalizeThemeValue = (value) => (THEME_ORDER.includes(value) ? value : 'light');

export function ThemePreferenceProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && THEME_ORDER.includes(stored)) {
        return stored;
      }
    } catch {
      // ignore storage failures
    }
    return 'light';
  });

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
      const isAlternateHotkey = !event.ctrlKey && !event.metaKey && event.altKey && (event.key === '`' || event.code === 'Backquote');
      if (isThemeHotkey) {
        event.preventDefault();
        cycleTheme();
      } else if (isAlternateHotkey) {
        event.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleTheme]);

  const resolvedMode = theme;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const classes = THEME_ORDER.map((t) => `theme-${t}`);
    root.classList.remove(...classes);
    root.classList.add(`theme-${resolvedMode}`);
  }, [resolvedMode]);

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
