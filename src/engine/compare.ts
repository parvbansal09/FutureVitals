// How you compare: each habit next to its evidence-based recommendation.
// Rows are sorted by the size of the gap, largest first, then the rows that
// could not be judged, then the ones already on track. A "gap" is an ordinal
// distance from the recommendation, used only for ordering. It is never
// shown as a number and never combined into a score.
import { compare } from './content';
import { ageRange, bmiBand, freqKnown, type BmiBand } from './answers';
import type { DiarySummary } from './diary';
import { PNTS, type Answers, type Freq } from './types';

export type RowId = 'tobacco' | 'alcohol' | 'activity' | 'weight' | 'meat' | 'plants' | 'radon' | 'sun' | 'hpv';
export type RowStatus = 'gap' | 'meets' | 'unknown' | 'na';

export type Said =
  | { kind: 'skipped' }
  | { kind: 'option'; group: 'smoke' | 'alcohol' | 'activity' | 'plants' | 'radon' | 'sun' | 'hpvVaccine'; id: string }
  | { kind: 'smoke'; status: 'never' | 'former' | 'current'; packYears: number | null }
  | { kind: 'bmi'; band: BmiBand }
  | { kind: 'meat'; proc: Freq; red: Freq }
  | { kind: 'diaryMeat'; procPerWeek: number; redPerWeek: number }
  | { kind: 'diaryPlants'; perDay: number };

export interface CompareRow {
  id: RowId;
  status: RowStatus;
  gap: number;
  direction: 'above' | 'below' | null;
  largest: boolean;
  said: Said;
  source: 'check' | 'diary';
}

const ORDER: RowId[] = ['tobacco', 'alcohol', 'activity', 'weight', 'meat', 'plants', 'radon', 'sun', 'hpv'];
const skipped = (v: unknown) => v === null || v === undefined || v === PNTS;
const round1 = (n: number) => Math.round(n * 10) / 10;

function row(id: RowId, status: RowStatus, said: Said, gap = 0, direction: 'above' | 'below' | null = null, source: 'check' | 'diary' = 'check'): CompareRow {
  return { id, status, gap, direction, largest: false, said, source };
}

function tobacco(a: Answers): CompareRow {
  if (skipped(a.smoke)) return row('tobacco', 'unknown', { kind: 'skipped' });
  const status = a.smoke as 'never' | 'former' | 'current';
  const py = typeof a.packsPerDay === 'number' && typeof a.yearsSmoked === 'number' ? round1(a.packsPerDay * a.yearsSmoked) : null;
  const said: Said = { kind: 'smoke', status, packYears: status === 'never' ? null : py };
  // Quitting meets the recommendation: the advice to a former smoker is to stay quit.
  return status === 'current' ? row('tobacco', 'gap', said, 4, 'above') : row('tobacco', 'meets', said);
}

function alcohol(a: Answers): CompareRow {
  if (skipped(a.alcohol)) return row('alcohol', 'unknown', { kind: 'skipped' });
  const said: Said = { kind: 'option', group: 'alcohol', id: a.alcohol as string };
  const gap = { none: 0, le1: 1, '2to7': 1.5, '8to14': 2.5, '15plus': 3.5 }[a.alcohol as string] ?? 0;
  return gap === 0 ? row('alcohol', 'meets', said) : row('alcohol', 'gap', said, gap, 'above');
}

function activity(a: Answers): CompareRow {
  if (skipped(a.activity)) return row('activity', 'unknown', { kind: 'skipped' });
  const said: Said = { kind: 'option', group: 'activity', id: a.activity as string };
  const gap = { lt60: 2.5, '60to149': 1.5, '150to299': 0, '300plus': 0 }[a.activity as string] ?? 0;
  return gap === 0 ? row('activity', 'meets', said) : row('activity', 'gap', said, gap, 'below');
}

function weight(a: Answers): CompareRow {
  const band = bmiBand(a);
  if (!band) return row('weight', 'unknown', { kind: 'skipped' });
  const said: Said = { kind: 'bmi', band };
  if (band === 'healthy') return row('weight', 'meets', said);
  if (band === 'under') return row('weight', 'gap', said, 1, 'below');
  return row('weight', 'gap', said, band === 'obese' ? 2.5 : 1.5, 'above');
}

function meat(a: Answers, d: DiarySummary): CompareRow {
  if (d.useDiary) {
    const procPerWeek = round1(d.perDay.proc * 7);
    const redPerWeek = round1(d.perDay.red * 7);
    // WCRF: "little, if any" processed meat; red meat up to about 3 portions a week.
    const procGap = procPerWeek >= 5 ? 3 : procPerWeek >= 2 ? 2 : procPerWeek > 0 ? 1 : 0;
    const redGap = redPerWeek > 5 ? 2 : redPerWeek > 3 ? 1 : 0;
    const gap = Math.max(procGap, redGap);
    const said: Said = { kind: 'diaryMeat', procPerWeek, redPerWeek };
    return gap === 0 ? row('meat', 'meets', said, 0, null, 'diary') : row('meat', 'gap', said, gap, 'above', 'diary');
  }
  const procKnown = freqKnown(a.procMeat);
  const redKnown = freqKnown(a.redMeat);
  if (!procKnown && !redKnown) return row('meat', 'unknown', { kind: 'skipped' });
  const procGap = procKnown ? ({ most: 3, some: 2, rarely: 0 }[a.procMeat as string] ?? 0) : 0;
  const redGap = redKnown ? ({ most: 2, some: 0.5, rarely: 0 }[a.redMeat as string] ?? 0) : 0;
  const gap = Math.max(procGap, redGap);
  const said: Said = { kind: 'meat', proc: a.procMeat, red: a.redMeat };
  if (gap > 0) return row('meat', 'gap', said, gap, 'above');
  // Only call it on track when both halves were answered.
  return procKnown && redKnown ? row('meat', 'meets', said) : row('meat', 'unknown', said);
}

function plants(a: Answers, d: DiarySummary): CompareRow {
  if (d.useDiary) {
    const perDay = round1(d.plants);
    const said: Said = { kind: 'diaryPlants', perDay };
    if (perDay >= 5) return row('plants', 'meets', said, 0, null, 'diary');
    return row('plants', 'gap', said, perDay >= 3 ? 1 : 2, 'below', 'diary');
  }
  if (!freqKnown(a.plants)) return row('plants', 'unknown', { kind: 'skipped' });
  const said: Said = { kind: 'option', group: 'plants', id: a.plants as string };
  const gap = { most: 0, some: 1.5, rarely: 2.5 }[a.plants as string] ?? 0;
  return gap === 0 ? row('plants', 'meets', said) : row('plants', 'gap', said, gap, 'below');
}

function radon(a: Answers): CompareRow {
  if (skipped(a.radon)) return row('radon', 'unknown', { kind: 'skipped' });
  const said: Said = { kind: 'option', group: 'radon', id: a.radon as string };
  if (a.radon === 'low' || a.radon === 'fixed') return row('radon', 'meets', said);
  if (a.radon === 'high') return row('radon', 'gap', said, 3, 'above');
  // Never tested, or not sure: the level is unknown, and testing is the first step.
  return row('radon', 'unknown', said);
}

function sun(a: Answers): CompareRow {
  if (skipped(a.sun)) return row('sun', 'unknown', { kind: 'skipped' });
  const said: Said = { kind: 'option', group: 'sun', id: a.sun as string };
  const gap = { always: 0, sometimes: 1, rarely: 2 }[a.sun as string] ?? 0;
  return gap === 0 ? row('sun', 'meets', said) : row('sun', 'gap', said, gap, 'below');
}

function hpv(a: Answers): CompareRow {
  const age = ageRange(a);
  if (skipped(a.hpv) && !age) return row('hpv', 'unknown', { kind: 'skipped' });
  const said: Said = skipped(a.hpv) ? { kind: 'skipped' } : { kind: 'option', group: 'hpvVaccine', id: a.hpv as string };
  if (a.hpv === 'yes') return row('hpv', 'meets', said);
  // CDC: routine through 26; 27 to 45 a shared decision; not advised after 45.
  if (age && age.lo >= 45) return row('hpv', 'na', said);
  if (skipped(a.hpv) || a.hpv === 'unsure') return row('hpv', 'unknown', said);
  const routine = !age || age.lo <= 26;
  if (routine) return row('hpv', 'gap', said, a.hpv === 'some' ? 1.5 : 2, 'below');
  return row('hpv', 'gap', said, 0.5, 'below');
}

export function buildCompare(a: Answers, d: DiarySummary): CompareRow[] {
  const rows = [tobacco(a), alcohol(a), activity(a), weight(a), meat(a, d), plants(a, d), radon(a), sun(a), hpv(a)];
  const rank: Record<RowStatus, number> = { gap: 0, unknown: 1, meets: 2, na: 3 };
  rows.sort((x, y) =>
    rank[x.status] - rank[y.status]
    || y.gap - x.gap
    || ORDER.indexOf(x.id) - ORDER.indexOf(y.id));
  const first = rows.find((r) => r.status === 'gap');
  if (first) first.largest = true;
  return rows;
}

/** The content definition for a row: recommendation, source, quote, first step. */
export const rowDef = (id: string) => compare.rows.find((r) => r.id === id)!;
