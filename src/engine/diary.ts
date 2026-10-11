// Food diary arithmetic. A day holds servings per food, kept under its own
// date (YYYY-MM-DD, the phone's local date). The diary is the last 7 days,
// ending today: older days drop off and no future day can be logged, so last
// month's Monday never counts as this week's. Per-day amounts divide by the
// days actually logged, not by seven, so a half-filled week is not read as a
// light one. Below foods.minDays (3) the diary is too thin to stand for a
// diet, and the check answers are used instead.
import { foods } from './content';
import type { FoodLog } from './types';

export interface DiarySummary {
  daysLogged: number;
  useDiary: boolean;
  /** Total servings this week, per food id. */
  week: Record<string, number>;
  /** Average servings per logged day, per food id. */
  perDay: Record<string, number>;
  /** Grams per logged day for the foods the evidence is written in grams. */
  grams: { proc: number; red: number; grain: number };
  /** Fruit and vegetable servings per day (lung factor). */
  fruitVeg: number;
  /** Fruit, vegetables, whole grains and beans, servings per day (compare row). */
  plants: number;
  dairy: number;
  salted: number;
}

export const SERVING_CAP = 12;

const pad = (n: number) => String(n).padStart(2, '0');
/** A local date as YYYY-MM-DD. */
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = (now = new Date()) => dateKey(now);
/** A YYYY-MM-DD key back to a local date (noon, so no time-zone edge flips the day). */
export const keyDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** The diary's 7 days, oldest first, ending with today. */
export function lastSevenDays(today = todayKey()): string[] {
  const end = keyDate(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (6 - i));
    return dateKey(d);
  });
}

/** Monday = 0 ... Sunday = 6, for a date key or a date. */
export const weekdayIndex = (key: string) => (keyDate(key).getDay() + 6) % 7;

/**
 * The log with only the last 7 days in it. Days saved by an older version
 * under a weekday number (Monday = 0) move to the latest date with that
 * weekday, so nothing logged this week is lost in the change.
 */
export function tidyLog(log: FoodLog, today = todayKey()): FoodLog {
  const days = lastSevenDays(today);
  const out: FoodLog = {};
  for (const [key, day] of Object.entries(log || {})) {
    const at = /^[0-6]$/.test(key) ? days.find((k) => weekdayIndex(k) === Number(key))! : key;
    if (!days.includes(at)) continue;
    const merged = { ...(out[at] || {}) };
    for (const [id, n] of Object.entries(day || {})) {
      const total = Math.min(SERVING_CAP, (merged[id] || 0) + (Number(n) || 0));
      if (total > 0) merged[id] = total;
    }
    if (Object.keys(merged).length) out[at] = merged;
  }
  return out;
}

export function loggedDays(log: FoodLog, today = todayKey()): number {
  const days = lastSevenDays(today);
  return Object.entries(log).filter(([k, day]) => days.includes(k) && day && Object.values(day).some((n) => n > 0)).length;
}

export function summarize(log: FoodLog, today = todayKey()): DiarySummary {
  const days = lastSevenDays(today);
  const daysLogged = loggedDays(log, today);
  const week: Record<string, number> = {};
  for (const f of foods.foods) week[f.id] = 0;
  for (const [key, day] of Object.entries(log)) {
    if (!days.includes(key)) continue;
    for (const [id, n] of Object.entries(day || {})) week[id] = (week[id] || 0) + (Number(n) || 0);
  }
  const perDay: Record<string, number> = {};
  for (const id of Object.keys(week)) perDay[id] = daysLogged ? week[id] / daysLogged : 0;
  const g = (id: string) => perDay[id] * (foods.foods.find((f) => f.id === id)?.grams ?? 0);
  return {
    daysLogged,
    useDiary: daysLogged >= foods.minDays,
    week,
    perDay,
    grams: { proc: g('proc'), red: g('red'), grain: g('fiber') + g('legume') },
    fruitVeg: perDay.veg + perDay.fruit,
    plants: perDay.veg + perDay.fruit + perDay.fiber + perDay.legume,
    dairy: perDay.dairy,
    salted: perDay.salted,
  };
}

/**
 * Adds (or removes, with a negative delta) servings on a day of the last 7;
 * keeps each count in 0..SERVING_CAP and drops days older than 7.
 */
export function bump(log: FoodLog, key: string, id: string, delta: number, today = todayKey()): FoodLog {
  if (!lastSevenDays(today).includes(key)) return tidyLog(log, today);
  const current = { ...(log[key] || {}) };
  const next = Math.max(0, Math.min(SERVING_CAP, (current[id] || 0) + delta));
  if (next === 0) delete current[id];
  else current[id] = next;
  return tidyLog({ ...log, [key]: current }, today);
}
