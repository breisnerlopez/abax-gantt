import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/* eslint-disable react-refresh/only-export-components */

type Theme = 'light' | 'dark';
type Density = 'comfortable' | 'compact' | 'dense';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  density: Density;
  setDensity: (d: Density) => void;
}

const ThemeContext = createContext<ThemeState>({
  theme: 'light',
  toggle: () => {},
  density: 'compact',
  setDensity: () => {},
});

function readStoredDensity(): Density {
  const stored = localStorage.getItem('abax.density');
  if (stored === 'comfortable' || stored === 'compact' || stored === 'dense') return stored;
  return 'compact';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('abax.theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [density, setDensityState] = useState<Density>(() => readStoredDensity());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('abax.theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('abax.density', density);
  }, [density]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const setDensity = useCallback((d: Density) => setDensityState(d), []);

  const value = useMemo<ThemeState>(
    () => ({ theme, toggle, density, setDensity }),
    [theme, toggle, density, setDensity],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
