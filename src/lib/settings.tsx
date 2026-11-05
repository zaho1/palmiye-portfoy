import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

// Bu cihazda tutulan kişisel ayarlar. Sheets'e yazılmaz.
export interface Settings {
  theme: ThemeChoice;
  staleDays: number;
  defaultView: 'list' | 'grid';
  phone: string;
  shareSignature: string;
  sidebarRegions: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  staleDays: 30,
  defaultView: 'list',
  phone: '',
  shareSignature: 'Palmiye Yatırım · Yalova',
  sidebarRegions: true,
};

const KEY = 'palmiye_settings';
const FAV_KEY = 'palmiye_favorites';

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readFavorites(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama kapalıysa ayar yalnızca bu oturumda geçerli */
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  resolvedTheme: 'light' | 'dark';
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [sysDark, setSysDark] = useState<boolean>(systemDark);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolvedTheme: 'light' | 'dark' = settings.theme === 'system' ? (sysDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#0e0f0d' : '#f7f7f5');
  }, [resolvedTheme]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      write(KEY, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    write(KEY, DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      write(FAV_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ settings, update, reset, resolvedTheme, favorites, toggleFavorite }),
    [settings, update, reset, resolvedTheme, favorites, toggleFavorite],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings, SettingsProvider içinde kullanılmalı');
  return ctx;
}
