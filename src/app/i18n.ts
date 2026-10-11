// Strings. English and Spanish files have identical keys (a test enforces it).
// th() picks the helper-mode version of a string ("their age") when a helper
// is answering for someone else.
import en from '../../content/strings/en.json';
import es from '../../content/strings/es.json';
import type { Bi, Lang } from '../engine/types';
import { fill } from '../engine/format';
import { useApp } from '../state/store';

type Dict = Record<string, unknown>;
const DICTS: Record<Lang, Dict> = { en: en as Dict, es: es as Dict };

function lookup(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Dict)[k] : undefined), dict);
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  // One of something: "1 place", not "1 places". A key + "One" string, where
  // there is one, is used when the count n is exactly 1.
  const one = vars && Number(vars.n) === 1 ? lookup(DICTS[lang], key + 'One') : undefined;
  const v = (typeof one === 'string' ? one : undefined) ?? lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
  if (typeof v !== 'string') return key;
  return vars ? fill(v, vars) : v;
}

export function useT() {
  const lang = useApp((s) => s.lang);
  const helper = useApp((s) => s.helper);
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  /** Helper-aware: uses `key + "Helper"` when a helper is answering and that string exists. */
  const th = (key: string, vars?: Record<string, string | number>) =>
    helper && typeof lookup(DICTS[lang], key + 'Helper') === 'string' ? t(key + 'Helper', vars) : t(key, vars);
  const list = (key: string): string[] => {
    const v = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
    return Array.isArray(v) ? (v as string[]) : [];
  };
  const raw = (key: string): unknown => lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
  const tx = (b: Bi | undefined | null) => (b ? b[lang] || b.en : '');
  return { t, th, list, raw, tx, lang, helper };
}
