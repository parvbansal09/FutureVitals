// On-device storage. In the native app this is Capacitor Preferences
// (UserDefaults / SharedPreferences), which iOS does not evict under storage
// pressure the way it can evict a web view's localStorage. On the web it is
// localStorage. Every call is wrapped: a private window or blocked storage
// must never break the app, only stop it remembering.
import type { StateStorage } from 'zustand/middleware';
import { isNative } from './native';

const memory = new Map<string, string>();

const web: StateStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return memory.get(k) ?? null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { memory.set(k, v); }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { memory.delete(k); }
  },
};

const native: StateStorage = {
  getItem: async (k) => {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      return (await Preferences.get({ key: k })).value ?? null;
    } catch { return web.getItem(k); }
  },
  setItem: async (k, v) => {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: k, value: v });
    } catch { web.setItem(k, v); }
  },
  removeItem: async (k) => {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: k });
    } catch { web.removeItem(k); }
  },
};

export const appStorage = (): StateStorage => (isNative() ? native : web);

/** Small synchronous key-value store for caches (the scanner's product cache). */
export const localCache = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* blocked */ }
  },
};
