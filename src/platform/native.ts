// Bridges between the web app and the phone. In the native app (Capacitor)
// these use the OS: the system browser for links, the OS location prompt,
// the share sheet and app storage that iOS will not evict. On the web they
// fall back to the browser's own APIs. Nothing here sends data anywhere.

import { IN_ARTIFACT } from './env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cap = (): any => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
export const isNative = (): boolean => !!cap()?.isNativePlatform?.();

/** Opens a link outside the app. The app passes nothing with it. */
export async function openExternal(url: string): Promise<void> {
  if (url.startsWith('tel:') || url.startsWith('mailto:')) {
    window.location.href = url;
    return;
  }
  if (isNative()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      /* fall through */
    }
  }
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) window.location.href = url;
}

export type GeoResult = { ok: true; lat: number; lng: number } | { ok: false; reason: 'denied' | 'unavailable' };

/** Asks the phone for its position once. The result is never stored. */
export async function getPosition(): Promise<GeoResult> {
  if (isNative()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') return { ok: false, reason: 'denied' };
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
      return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return { ok: false, reason: 'denied' };
    }
  }
  if (!('geolocation' in navigator)) return { ok: false, reason: 'unavailable' };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => resolve({ ok: false, reason: e.code === 1 ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Shares plain text (the plan's questions). Returns false if nothing could share it. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    } catch {
      /* fall through */
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/**
 * Copies text: the clipboard API first, then the older copy command, which
 * still works where the API is blocked (some embedded viewers).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* try the older way */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Printing works in a browser tab, not in the phone app or an embedded preview. */
export const canPrint = () => !isNative() && !IN_ARTIFACT && typeof window.print === 'function';

/** Android's back button walks the app's own history instead of closing it. */
export async function wireBackButton(onBack: () => boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      if (!onBack()) App.exitApp();
    });
  } catch {
    /* not available */
  }
}

export async function setStatusBar(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? '#0D1715' : '#E5F1EE' }).catch(() => undefined);
  } catch {
    /* iOS has no background color; ignore */
  }
}

export function haptic(ms = 12): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* no vibration motor */
  }
}
