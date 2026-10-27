import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from './engine/session';

export interface UserProfile {
  name: string;
  guest: boolean;
  createdAt: string;
}

export interface Settings {
  darkTheme: boolean;
  highContrast: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  aimAssist: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  darkTheme: false,
  highContrast: false,
  haptics: true,
  reducedMotion: false,
  aimAssist: false,
};

export interface Stats {
  played: number;
  bestShare: number;
  totalWords: number;
  lastDaily: string | null;
  streak: number;
}

export const DEFAULT_STATS: Stats = { played: 0, bestShare: 0, totalWords: 0, lastDaily: null, streak: 0 };

const KEYS = {
  user: 'ld.user',
  settings: 'ld.settings',
  stats: 'ld.stats',
  daily: (date: string) => `ld.daily.${date}`,
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failures should never block play.
  }
}

export const storage = {
  loadUser: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.user);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  },
  saveUser: (u: UserProfile) => write(KEYS.user, u),
  clearUser: () => AsyncStorage.removeItem(KEYS.user).catch(() => undefined),
  loadSettings: () => read(KEYS.settings, DEFAULT_SETTINGS),
  saveSettings: (s: Settings) => write(KEYS.settings, s),
  loadStats: () => read(KEYS.stats, DEFAULT_STATS),
  saveStats: (s: Stats) => write(KEYS.stats, s),
  loadDaily: async (date: string): Promise<Session | null> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.daily(date));
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  saveDaily: (s: Session) => write(KEYS.daily(s.dateKey), s),
};
