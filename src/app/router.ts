// A small hash router. Hash URLs work from a file, a web server and inside the
// native app alike, and the browser's own history gives the Android back button
// and the swipe-back gesture something real to walk. Each history entry
// carries an index, so a transition knows whether it is going forward or back.
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
  index: number;
}

export type TabKey = 'home' | 'plan' | 'risk' | 'clinics' | 'prevent' | null;

const parse = (): Route => {
  const raw = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = p.startsWith('/') ? p : `/${p}`;
  const index = typeof history !== 'undefined' && history.state && typeof history.state.idx === 'number' ? history.state.idx : 0;
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(q), index };
};

let current = parse();
let previous: Route | null = null;
const listeners = new Set<() => void>();

function emit() {
  previous = current;
  current = parse();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  if (!history.state || typeof history.state.idx !== 'number') history.replaceState({ idx: 0 }, '');
  current = parse();
  window.addEventListener('popstate', emit);
  window.addEventListener('hashchange', () => {
    if (parse().path !== current.path || parse().query.toString() !== current.query.toString()) emit();
  });
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`;
  const idx = (history.state?.idx ?? 0) + (opts.replace ? 0 : 1);
  if (opts.replace) history.replaceState({ idx }, '', target);
  else history.pushState({ idx }, '', target);
  emit();
}

/** Goes back in the app's own history, or to a fallback when there is none. */
export function goBack(fallback = '/') {
  if ((history.state?.idx ?? 0) > 0) history.back();
  else navigate(fallback, { replace: true });
}

export const canGoBack = () => (history.state?.idx ?? 0) > 0;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useRoute(): { route: Route; direction: 1 | -1 | 0; from: Route | null } {
  const route = useSyncExternalStore(subscribe, () => current, () => current);
  const from = previous;
  const direction: 1 | -1 | 0 = !from ? 0 : route.index > from.index ? 1 : route.index < from.index ? -1 : 0;
  return { route, direction, from };
}

export function tabOf(path: string): TabKey {
  if (path === '/' || path === '') return 'home';
  if (/^\/(plan|compare)/.test(path)) return 'plan';
  if (/^\/risk/.test(path)) return 'risk';
  if (/^\/clinics/.test(path)) return 'clinics';
  if (/^\/(prevention|learn|food|scan)/.test(path)) return 'prevent';
  return null;
}

/** Top-level screens: moving between two of these is a tab switch, not a push. */
export const isRootPath = (path: string) =>
  ['/', '/plan', '/risk', '/compare', '/clinics', '/prevention', '/learn', '/food', '/scan'].includes(path);
