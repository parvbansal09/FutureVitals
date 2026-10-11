// The risk score. For each cancer: published relative risks for the factors
// a person answered, multiplied (the Harvard Cancer Risk Index arithmetic)
// into a score, a multiple of average, read first as a band in words.
// Parameters live in content/risk.json.
//
// Rules that hold everywhere:
//  1. A skipped answer returns null: "not counted", never 1.0.
//  2. Age is the baseline, not a factor. The screen says so.
//  3. A known gene change, a symptom for that cancer, or long-term hepatitis
//     (liver) replaces the score. A cancer with no proven factor shows none.
//  4. No probability, no lifetime percentage, no ordering of cancers by value.
import { risk, type RiskFactorDef } from './content';
import {
  activityIndex, ageRange, alcoholGrams, bmi, famAnswered, famHas, famYoungYes, heightInches,
  hist, histAnswered, isFemale, isList, isMale, packBucket, smokeIndex, symptomForCancer,
} from './answers';
import type { DiarySummary } from './diary';
import { PNTS, type Answers, type CancerKey } from './types';

export type BandKey = 'lower' | 'about' | 'somewhat' | 'higher' | 'much';
export type RiskState = 'band' | 'gene' | 'symptom' | 'thin' | 'surveil';

export interface FactorResult {
  id: string;
  rr: number | null;
  mod: boolean;
  src: string;
  /** 'family-distant': a relative was named but not a close one; not counted as first-degree. */
  note?: 'family-distant';
  fromDiary: boolean;
}

export interface Lever {
  id: string;
  toBand: BandKey;
  toMultiple: number;
  /** The answers that make the change, for "Try this change". Null when the diary sets the value. */
  patch: Partial<Answers> | null;
}

export interface RiskCard {
  key: CancerKey;
  state: RiskState;
  band: BandKey | null;
  /** The score: a multiple of average, rounded to one decimal. */
  multiple: number | null;
  answered: number;
  total: number;
  factors: FactorResult[];
  lever: Lever | null;
  src?: string;
}

export const rrDose = (perUnit: number, dose: number, unit: number) => Math.pow(perUnit, Math.max(0, dose) / unit);

export function bandOf(x: number): BandKey {
  for (const b of risk.bands) if (b.below === null || x < b.below) return b.key as BandKey;
  return 'much';
}

/** Position on the bar, 0..1, on a log scale from 0.5x to 16x. Average (1x) sits at 0.2. */
export const barPosition = (x: number) => {
  const lo = Math.log(0.5), hi = Math.log(16);
  return Math.min(1, Math.max(0, (Math.log(Math.max(0.5, x)) - lo) / (hi - lo)));
};

interface Ctx {
  a: Answers;
  diary: DiarySummary;
}

const freqScale = (v: Answers['procMeat'], full: number): number | null =>
  v === 'most' ? full : v === 'some' ? 1 + (full - 1) * 0.5 : v === 'rarely' ? 1 : null;

// Each kind returns [rr, best] where best is the value if the person made the
// change (not always 1.0: quitting does not make anyone a never-smoker).
function evaluate(f: RiskFactorDef, c: Ctx): { rr: number | null; best: number | null; fromDiary: boolean; note?: FactorResult['note'] } {
  const { a, diary } = c;
  const n = (k: string) => f[k] as number;
  switch (f.kind) {
    case 'diet-dose': {
      const food = f.food as 'proc' | 'red' | 'grain';
      if (diary.useDiary) {
        let v = rrDose(n('perUnit'), diary.grams[food], n('unit'));
        if (typeof f.floor === 'number') v = Math.max(f.floor as number, v);
        return { rr: v, best: n('best'), fromDiary: true };
      }
      const answer = food === 'proc' ? a.procMeat : food === 'red' ? a.redMeat : a.plants;
      return { rr: freqScale(answer, n('survey')), best: n('best'), fromDiary: false };
    }
    case 'diet-threshold': {
      const food = f.food as 'plants' | 'dairy';
      if (diary.useDiary) {
        const amount = food === 'plants' ? diary.fruitVeg : diary.dairy;
        return { rr: amount >= n('diaryAtLeast') ? n('rr') : 1, best: n('best'), fromDiary: true };
      }
      // Dairy has no check question: it only counts once the diary is in use.
      if (food === 'dairy') return { rr: null, best: null, fromDiary: false };
      return { rr: freqScale(a.plants, n('survey')), best: n('best'), fromDiary: false };
    }
    case 'alcohol-dose': {
      const g = alcoholGrams(a);
      return { rr: g === null ? null : rrDose(n('perUnit'), g, n('unit')), best: n('best'), fromDiary: false };
    }
    case 'bmi-dose': {
      const b = bmi(a);
      const age = ageRange(a);
      if (b === null) return { rr: null, best: null, fromDiary: false };
      // Body fat acts the other way on breast cancer before menopause.
      if (typeof f.minAge === 'number' && (!age || age.lo < (f.minAge as number))) return { rr: null, best: null, fromDiary: false };
      const rr = rrDose(n('perUnit'), b - 23, 5);
      // In the healthy range there is no weight change to suggest.
      return { rr, best: b < 25 ? rr : rrDose(n('perUnit'), b - 28, 5), fromDiary: false };
    }
    case 'activity': {
      const i = activityIndex(a);
      const table = f.table as number[];
      return { rr: i === null ? null : table[i], best: n('best'), fromDiary: false };
    }
    case 'smoking-status': {
      const i = smokeIndex(a);
      const table = f.table as number[];
      if (i === null) return { rr: null, best: null, fromDiary: false };
      return { rr: table[i], best: i === 3 ? table[2] : table[i], fromDiary: false };
    }
    case 'smoking-lung': {
      const i = smokeIndex(a);
      if (i === null) return { rr: null, best: null, fromDiary: false };
      if (i === 0) return { rr: 1, best: 1, fromDiary: false };
      const status = f.status as number[];
      const packs = f.packs as number[];
      const pb = packBucket(a);
      const mult = pb === null ? 1 : packs[pb];
      return { rr: status[i] * mult, best: (i === 3 ? status[2] : status[i]) * mult, fromDiary: false };
    }
    case 'answer': {
      // One answer read through a table of relative risks; an answer not in
      // the table ("Not sure", skipped) is not counted.
      const table = f.table as Record<string, number>;
      const v = a[f.key as keyof Answers];
      const rr = typeof v === 'string' && v in table ? table[v] : null;
      return { rr, best: rr === null ? null : typeof f.best === 'number' ? Math.min(rr, n('best')) : rr, fromDiary: false };
    }
    case 'radon': {
      const table = f.table as Record<string, number>;
      const v = a.radon && a.radon !== PNTS ? table[a.radon] : undefined;
      return { rr: v === undefined ? null : v, best: n('best'), fromDiary: false };
    }
    case 'family': {
      if (!famAnswered(a)) return { rr: null, best: null, fromDiary: false };
      const list = f.cancers as string[];
      if (!list.some((cn) => famHas(a, cn))) return { rr: 1, best: null, fromDiary: false };
      // The published figures are for a parent, sibling or child.
      if (a.famClose === 'no') return { rr: 1, best: null, fromDiary: false, note: 'family-distant' };
      const young = famYoungYes(a) && typeof f.rrYoung === 'number';
      return { rr: young ? n('rrYoung') : n('rr'), best: null, fromDiary: false };
    }
    case 'family-breast': {
      if (!famAnswered(a)) return { rr: null, best: null, fromDiary: false };
      if (!(famHas(a, 'breast') || famHas(a, 'ovarian'))) return { rr: 1, best: null, fromDiary: false };
      if (a.famClose === 'no') return { rr: 1, best: null, fromDiary: false, note: 'family-distant' };
      const age = ageRange(a);
      // Collaborative Group 2001: familial risk is steepest when both women are young.
      if (!famYoungYes(a)) return { rr: age && age.lo >= 65 ? 1.5 : 1.8, best: null, fromDiary: false };
      return { rr: !age ? 2.4 : age.lo < 45 ? 3.5 : age.lo < 65 ? 2.4 : 1.8, best: null, fromDiary: false };
    }
    case 'history': {
      if (!histAnswered(a)) return { rr: null, best: null, fromDiary: false };
      return { rr: hist(a, f.key as string) ? n('rr') : 1, best: null, fromDiary: false };
    }
    default:
      return { rr: null, best: null, fromDiary: false };
  }
}

/**
 * The answers that make a lever's change, so the calculator can try it. Each
 * one lands on the value the lever's figure was worked out for: quitting is
 * "quit within 5 years", not "never smoked"; a weight change is 5 BMI units,
 * never below 23, the point the weight figures are measured from.
 */
export function leverPatch(id: string, a: Answers): Partial<Answers> | null {
  switch (id) {
    case 'procmeat': return { procMeat: 'rarely' };
    case 'redmeat': return { redMeat: 'rarely' };
    case 'alcohol': return { alcohol: 'none' };
    case 'grains': case 'fruitveg': return { plants: 'most' };
    case 'activity': return { activity: '150to299' };
    case 'smoking': return a.smoke === 'current' ? { smoke: 'former', quit: 'lt5' } : null;
    case 'radon': return a.radon === 'high' ? { radon: 'fixed' } : null;
    case 'sun': return a.sun === 'always' ? null : { sun: 'always' };
    case 'weight': {
      const b = bmi(a);
      const h = heightInches(a);
      if (b === null || h === null) return null;
      const target = Math.max(23, b - 5);
      return { weightLb: Math.round((target * h * h) / 703) };
    }
    default: return null;
  }
}

function appliesTo(key: CancerKey, a: Answers): boolean {
  if (key === 'prostate') return !isFemale(a);
  if (key === 'cervical') return !isMale(a);
  if (key === 'breast') return !isMale(a);
  return true;
}

export const RISK_ORDER: CancerKey[] = [
  'breast', 'cervical', 'colorectal', 'lung', 'prostate', 'skin', 'liver', 'pancreatic', 'stomach', 'bladder', 'brain',
];

export function buildRisk(a: Answers, diary: DiarySummary): RiskCard[] {
  const c: Ctx = { a, diary };
  const cards: RiskCard[] = [];
  for (const key of RISK_ORDER) {
    const def = risk.cancers[key];
    if (!def || !appliesTo(key, a)) continue;

    const evaluated = (def.factors || []).map((f) => ({ f, ...evaluate(f, c) }));
    const factors: FactorResult[] = evaluated.map((e) => ({
      id: e.f.id, rr: e.rr, mod: e.f.mod, src: e.f.src, fromDiary: e.fromDiary, ...(e.note ? { note: e.note } : {}),
    }));
    const known = evaluated.filter((e) => e.rr !== null);
    const product = known.reduce((p, e) => p * (e.rr as number), 1);
    const shown = Math.min(risk.displayCap, product);
    const total = evaluated.length;
    const enough = total > 0 && known.length / total >= risk.minCoverage;

    const symptom = symptomForCancer(a, key);
    const gene = (def.gene || []).some((g) => hist(a, g));
    const surveil = !!def.surveil && hist(a, def.surveil);

    // The single change with the most room in it: the ratio between where the
    // person is and where the change would take them.
    let lever: Lever | null = null;
    let bestGain = 1.005;
    for (const e of known) {
      if (!e.f.mod || e.best === null || !(e.best > 0)) continue;
      const gain = (e.rr as number) / e.best;
      if (gain <= bestGain) continue;
      bestGain = gain;
      const to = Math.min(risk.displayCap, product / gain);
      lever = {
        id: e.f.id, toBand: bandOf(to), toMultiple: Math.round(to * 10) / 10,
        patch: e.fromDiary ? null : leverPatch(e.f.id, a),
      };
    }

    const state: RiskState = symptom ? 'symptom' : gene ? 'gene' : surveil ? 'surveil' : !enough ? 'thin' : 'band';
    cards.push({
      key,
      state,
      band: state === 'band' ? bandOf(shown) : null,
      multiple: state === 'band' ? Math.round(shown * 10) / 10 : null,
      answered: known.length,
      total,
      factors,
      lever: state === 'band' ? lever : null,
      ...(def.src ? { src: def.src } : {}),
    });
  }
  return cards;
}

export const hasRiskAnswers = (a: Answers) => ageRange(a) !== null || isList(a.famCancers) || a.smoke !== null;
