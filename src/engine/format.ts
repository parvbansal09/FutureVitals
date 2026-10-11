import type { Lang } from './types';

/** Fills {name} placeholders. */
export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));

const locale = (lang: Lang) => (lang === 'es' ? 'es-US' : 'en-US');

// Building an Intl formatter is slow (the first one loads locale data, tens of
// milliseconds on a phone), so each one is built once and reused.
const dateFormats = new Map<Lang, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function dateFormat(lang: Lang): Intl.DateTimeFormat {
  let f = dateFormats.get(lang);
  if (!f) {
    f = new Intl.DateTimeFormat(locale(lang), { year: 'numeric', month: 'long', day: 'numeric' });
    dateFormats.set(lang, f);
  }
  return f;
}

function numberFormat(lang: Lang, digits: number): Intl.NumberFormat {
  const key = `${lang}:${digits}`;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    numberFormats.set(key, f);
  }
  return f;
}

export function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return iso;
  return dateFormat(lang).format(d);
}

export function formatNumber(n: number, lang: Lang, digits = 0): string {
  return numberFormat(lang, digits).format(n);
}

const scoreFormats = new Map<Lang, Intl.NumberFormat>();
/** A risk score, always with one decimal: 1.0, 3.3 (1,0 and 3,3 in Spanish). */
export function formatScore(n: number, lang: Lang): string {
  let f = scoreFormats.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(locale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    scoreFormats.set(lang, f);
  }
  return f.format(n);
}

/** Builds the formatters while the phone is idle, so no tap waits for them. */
export function warmFormatters() {
  for (const lang of ['en', 'es'] as Lang[]) {
    dateFormat(lang);
    numberFormat(lang, 0);
    numberFormat(lang, 1);
    formatScore(1, lang);
  }
}

/** "about 25" style rounding for pack-years and miles. */
export const about = (n: number) => (n < 10 ? Math.round(n * 2) / 2 : Math.round(n));
