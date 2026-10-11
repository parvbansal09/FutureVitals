// Product lookup. A barcode is looked for first in the phone's cache, then
// in the built-in list (part of Open Food Facts, see products.ts), and only
// then on Open Food Facts itself, one request per real scan as its rules ask.
// That request is the only one the app makes with anything a person typed or
// scanned, and it carries the barcode number and nothing else: no cookies, no
// referrer, no answers, no location. In the phone app the request names the
// app (FutureVitals/2.0, set in capacitor.config.json), as Open Food Facts
// asks; a browser does not let a page set that. Results are cached on the
// phone so a product looked up once works offline.
import { fromOpenFoodFacts, OFF_FIELDS, type ProductInput } from '../engine/scanner';
import { localCache } from './storage';
import { localProduct } from './products';
import { IN_ARTIFACT } from './env';

const CACHE_KEY = 'fv2-products';
const CACHE_MAX = 60;

type Cache = Record<string, { p: ProductInput; at: number }>;

export type Lookup =
  | { status: 'found'; product: ProductInput; cached: boolean }
  /** builtInOnly: only the built-in list could be checked (the preview cannot go online). */
  | { status: 'notFound'; builtInOnly?: boolean }
  | { status: 'offline' }
  | { status: 'error' };

export function cachedProduct(code: string): ProductInput | null {
  const hit = localCache.get<Cache>(CACHE_KEY, {})[code];
  return hit ? { ...hit.p, source: 'cache' } : null;
}

function remember(code: string, p: ProductInput) {
  const cache = localCache.get<Cache>(CACHE_KEY, {});
  cache[code] = { p, at: Date.now() };
  const keys = Object.keys(cache).sort((a, b) => cache[b].at - cache[a].at);
  for (const k of keys.slice(CACHE_MAX)) delete cache[k];
  localCache.set(CACHE_KEY, cache);
}

export const clearProductCache = () => localCache.remove(CACHE_KEY);

export async function lookupBarcode(raw: string): Promise<Lookup> {
  const code = raw.replace(/\D/g, '');
  const cached = cachedProduct(code);
  if (cached) return { status: 'found', product: cached, cached: true };
  const local = await localProduct(code);
  if (local) return { status: 'found', product: local, cached: false };
  if (IN_ARTIFACT) return { status: 'notFound', builtInOnly: true };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status === 404) return { status: 'notFound' };
    if (!res.ok) return { status: 'error' };
    const json = await res.json();
    if (json?.status !== 1 || !json.product) return { status: 'notFound' };
    const product = fromOpenFoodFacts(json.product, code);
    if (!product.ingredientsText && !(product.ingredientTags || []).length) return { status: 'notFound' };
    remember(code, product);
    return { status: 'found', product, cached: false };
  } catch {
    return navigator.onLine === false ? { status: 'offline' } : { status: 'error' };
  }
}
