import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

const STORAGE_KEY = 'nomadtable.theme.dark';
const STORAGE_KEY_WALLPAPER = 'nomadtable.theme.wallpaper';

export type ThemeColors = {
  background: string;
  card: string;
  text: string;
  accent: string;
  /** Muted/secondary text */
  textMuted: string;
  /** Border or divider */
  border: string;
};

const LIGHT_COLORS: ThemeColors = {
  background: '#FFF5F0',
  card: '#FFFFFF',
  text: '#2D1B3D',
  accent: '#FF9F66',
  textMuted: '#6E6E73',
  border: 'rgba(45,27,61,0.08)',
};

const DARK_COLORS: ThemeColors = {
  background: '#1A1A2E',
  card: '#252542',
  text: '#FFFFFF',
  accent: '#FF9F66',
  textMuted: '#B0B0B8',
  border: 'rgba(255,255,255,0.1)',
};

export type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
  /** Custom background image URI, or null for solid color */
  wallpaperUri: string | null;
  setWallpaper: (uri: string | null) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = React.useState(false);
  const [wallpaperUri, setWallpaperState] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(STORAGE_KEY_WALLPAPER),
    ])
      .then(([darkValue, wallpaperValue]) => {
        setIsDark(darkValue === 'true');
        setWallpaperState(wallpaperValue || null);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, isDark ? 'true' : 'false').catch(() => {});
  }, [isDark, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (wallpaperUri) {
      AsyncStorage.setItem(STORAGE_KEY_WALLPAPER, wallpaperUri).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY_WALLPAPER).catch(() => {});
    }
  }, [wallpaperUri, hydrated]);

  const toggleTheme = React.useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const setWallpaper = React.useCallback((uri: string | null) => {
    setWallpaperState(uri);
  }, []);

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value: ThemeContextValue = React.useMemo(
    () => ({ isDark, toggleTheme, colors, wallpaperUri, setWallpaper }),
    [isDark, toggleTheme, colors, wallpaperUri, setWallpaper]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export { LIGHT_COLORS, DARK_COLORS };
