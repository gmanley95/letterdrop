import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { summarize } from '../engine/results';
import type { Session } from '../engine/session';
import { DEFAULT_SETTINGS, DEFAULT_STATS, storage, type Settings, type Stats, type UserProfile } from '../storage';
import { DARK, LIGHT, withHighContrast, type Theme } from '../theme';

interface AppState {
  ready: boolean;
  user: UserProfile | null;
  settings: Settings;
  stats: Stats;
  theme: Theme;
  signIn: (name: string, guest: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  recordFinished: (s: Session) => void;
  haptic: (kind?: 'light' | 'success' | 'error') => void;
}

const Ctx = createContext<AppState | null>(null);

function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);

  useEffect(() => {
    Promise.all([storage.loadUser(), storage.loadSettings(), storage.loadStats()]).then(([u, s, st]) => {
      setUser(u);
      setSettings(s);
      setStats(st);
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async (name: string, guest: boolean) => {
    const u: UserProfile = { name: name.trim() || 'Guest', guest, createdAt: new Date().toISOString() };
    setUser(u);
    await storage.saveUser(u);
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    await storage.clearUser();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storage.saveSettings(next);
      return next;
    });
  }, []);

  const recordFinished = useCallback((s: Session) => {
    setStats((prev) => {
      if (s.mode === 'daily' && prev.lastDaily === s.dateKey) return prev;
      const r = summarize(s);
      const next: Stats = {
        played: prev.played + 1,
        bestShare: Math.max(prev.bestShare, r.shareScore),
        totalWords: prev.totalWords + s.words.length,
        lastDaily: s.mode === 'daily' ? s.dateKey : prev.lastDaily,
        streak: s.mode === 'daily' ? (prev.lastDaily === prevDay(s.dateKey) ? prev.streak + 1 : 1) : prev.streak,
      };
      storage.saveStats(next);
      return next;
    });
  }, []);

  const haptic = useCallback(
    (kind: 'light' | 'success' | 'error' = 'light') => {
      if (!settings.haptics || Platform.OS === 'web') return;
      if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    },
    [settings.haptics],
  );

  const theme = useMemo(() => {
    const base = settings.darkTheme ? DARK : LIGHT;
    return settings.highContrast ? withHighContrast(base) : base;
  }, [settings.darkTheme, settings.highContrast]);

  const value = useMemo(
    () => ({ ready, user, settings, stats, theme, signIn, signOut, updateSettings, recordFinished, haptic }),
    [ready, user, settings, stats, theme, signIn, signOut, updateSettings, recordFinished, haptic],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
