// Derived facts. Every rule reads answers through these helpers, and each one
// returns null when the question was skipped or answered "Prefer not to say".
// A null is never read as a healthy answer: that is what keeps a skipped
// question from turning into a green check.
import { check } from './content';
import { PNTS, type Answers } from './types';

export const isList = (v: unknown): v is string[] => Array.isArray(v);

/** The age band as numbers, or null when unknown. */
export function ageRange(a: Answers): { lo: number; hi: number } | null {
  if (!a.age || a.age === PNTS) return null;
  const band = check.ages.find((b) => b.id === a.age);
  return band ? { lo: band.lo, hi: band.hi } : null;
}

/** True when the whole band sits inside [lo, hi]. */
export const bandWithin = (r: { lo: number; hi: number } | null, lo: number, hi: number) =>
  !!r && r.lo >= lo && r.hi <= hi;

/** True when any part of the band touches [lo, hi]. */
export const bandTouches = (r: { lo: number; hi: number } | null, lo: number, hi: number) =>
  !!r && r.hi >= lo && r.lo <= hi;

export const isFemale = (a: Answers) => a.sex === 'female';
export const isMale = (a: Answers) => a.sex === 'male';
/** Sex not given: sex-specific items stay in the plan, worded "if this applies to your body". */
export const sexUnknown = (a: Answers) => a.sex === null || a.sex === PNTS;

// ── family ────────────────────────────────────────────────────────────────
export const famAnswered = (a: Answers) => isList(a.famCancers) || a.famCancers === 'none';
export const famHas = (a: Answers, id: string) => isList(a.famCancers) && a.famCancers.includes(id);
export const famAny = (a: Answers) => isList(a.famCancers) && a.famCancers.length > 0;
export const famCloseYes = (a: Answers) => a.famClose === 'yes';
export const famYoungYes = (a: Answers) => a.famYoung === 'yes';

// ── history ───────────────────────────────────────────────────────────────
export const histAnswered = (a: Answers) => isList(a.history) || a.history === 'none';
export const hist = (a: Answers, id: string) => isList(a.history) && a.history.includes(id);

// ── symptoms ──────────────────────────────────────────────────────────────
export const symptomList = (a: Answers): string[] => (isList(a.symptoms) ? a.symptoms : []);
export const hasSymptom = (a: Answers, id: string) => symptomList(a).includes(id);
export const hasAnySymptom = (a: Answers) => symptomList(a).length > 0 || a.emergencies.length > 0;
export const hasEmergency = (a: Answers) => a.emergencies.length > 0;
/** Which cancer a flagged symptom points at, from content/check.json. */
export function symptomForCancer(a: Answers, cancer: string): boolean {
  return symptomList(a).some((id) => check.symptoms.find((s) => s.id === id)?.cancer === cancer);
}
export const symptomsAnswered = (a: Answers) =>
  isList(a.symptoms) || a.symptoms === 'none' || a.symptoms === PNTS || a.emergencies.length > 0;

// ── body ──────────────────────────────────────────────────────────────────
export function heightInches(a: Answers): number | null {
  const ft = a.heightFt ?? 0;
  const inch = a.heightIn ?? 0;
  const total = ft * 12 + inch;
  return total >= 48 && total <= 96 ? total : null;
}

/** BMI, worked out on the device. Never shown as a number: see bmiBand. */
export function bmi(a: Answers): number | null {
  if (a.bodySkip) return null;
  const h = heightInches(a);
  const w = a.weightLb;
  if (!h || !w || w < 60 || w > 800) return null;
  return (703 * w) / (h * h);
}

export type BmiBand = 'under' | 'healthy' | 'over' | 'obese';
export function bmiBand(a: Answers): BmiBand | null {
  const b = bmi(a);
  if (b === null) return null;
  if (b < 18.5) return 'under';
  if (b < 25) return 'healthy';
  if (b < 30) return 'over';
  return 'obese';
}
export const bodyAnswered = (a: Answers) => bmi(a) !== null;

// ── smoking ───────────────────────────────────────────────────────────────
export const smokes = (a: Answers) => a.smoke === 'former' || a.smoke === 'current';

/**
 * Answers with every follow-up that no longer applies cleared: how much and
 * how long someone smoked once they say they never smoked (or skip it), when
 * they quit once they say they smoke now, and the family follow-ups once no
 * relative is named. Every change goes through this, from the check, the risk
 * calculator or a kept "Try this change", and so do answers saved by an older
 * version. So no screen can show an answer the person took back, such as
 * pack-years for someone who said they never smoked.
 */
export function tidyAnswers(a: Answers): Answers {
  let out = a;
  // Older versions asked one question, "A known BRCA or Lynch gene change".
  // It is now three (BRCA, Lynch, and syndromes linked to brain tumors); an old
  // yes is read as both of the genes it named, which a genetic counselor then sorts out.
  if (isList(out.history) && out.history.includes('gene')) {
    const rest = out.history.filter((h) => h !== 'gene');
    out = { ...out, history: [...rest, ...['brca', 'lynch'].filter((g) => !rest.includes(g))] };
  }
  if (!smokes(out) && (out.packsPerDay !== null || out.yearsSmoked !== null || out.quit !== null)) {
    out = { ...out, packsPerDay: null, yearsSmoked: null, quit: null };
  }
  if (out.smoke === 'current' && out.quit !== null) out = { ...out, quit: null };
  if (!famAny(out) && (out.famClose !== null || out.famYoung !== null)) out = { ...out, famClose: null, famYoung: null };
  return out;
}

/** Pack-years = packs per day x years smoked, or null if either is unknown. */
export function packYears(a: Answers): number | null {
  if (!smokes(a)) return a.smoke === 'never' ? 0 : null;
  if (typeof a.packsPerDay !== 'number' || typeof a.yearsSmoked !== 'number') return null;
  return Math.round(a.packsPerDay * a.yearsSmoked * 10) / 10;
}

/**
 * Smoking status as the risk tables index it:
 * 0 never, 1 quit more than 15 years ago, 2 quit within 15 years, 3 smokes now.
 * A former smoker who did not say when they quit is read as recent, the
 * cautious reading.
 */
export function smokeIndex(a: Answers): 0 | 1 | 2 | 3 | null {
  if (a.smoke === 'never') return 0;
  if (a.smoke === 'current') return 3;
  if (a.smoke === 'former') return a.quit === 'gt15' ? 1 : 2;
  return null;
}

/** Pack-year bucket used by the lung table: <10, 10-19, 20-29, 30+. */
export function packBucket(a: Answers): 0 | 1 | 2 | 3 | null {
  const py = packYears(a);
  if (py === null) return null;
  if (py < 10) return 0;
  if (py < 20) return 1;
  if (py < 30) return 2;
  return 3;
}

// ── habits ────────────────────────────────────────────────────────────────
/** Grams of alcohol per day, from the weekly band (one US drink = 14 g). */
export function alcoholGrams(a: Answers): number | null {
  if (!a.alcohol || a.alcohol === PNTS) return null;
  const opt = check.alcohol.find((o) => o.id === a.alcohol);
  return opt ? (opt.drinks * 14) / 7 : null;
}
export const drinks = (a: Answers) => !!a.alcohol && a.alcohol !== PNTS && a.alcohol !== 'none';

export function activityIndex(a: Answers): 0 | 1 | 2 | 3 | null {
  switch (a.activity) {
    case 'lt60': return 0;
    case '60to149': return 1;
    case '150to299': return 2;
    case '300plus': return 3;
    default: return null;
  }
}

export const freqKnown = (v: Answers['procMeat']) => v === 'most' || v === 'some' || v === 'rarely';

/** Every question the plan can list under "Not answered", in the order asked. */
export type QuestionKey =
  | 'symptoms' | 'age' | 'sex' | 'family' | 'famClose' | 'famYoung' | 'history' | 'hpv'
  | 'smoke' | 'packs' | 'years' | 'quit' | 'alcohol' | 'activity' | 'body'
  | 'procMeat' | 'redMeat' | 'plants' | 'radon' | 'sun';

export function notAnswered(a: Answers): QuestionKey[] {
  const out: QuestionKey[] = [];
  const skipped = (v: unknown) => v === null || v === PNTS;
  if (!symptomsAnswered(a) || a.symptoms === PNTS) out.push('symptoms');
  if (skipped(a.age)) out.push('age');
  if (skipped(a.sex)) out.push('sex');
  if (!famAnswered(a)) out.push('family');
  if (famAny(a)) {
    if (a.famClose !== 'yes' && a.famClose !== 'no') out.push('famClose');
    if (a.famYoung !== 'yes' && a.famYoung !== 'no') out.push('famYoung');
  }
  if (!histAnswered(a)) out.push('history');
  if (skipped(a.hpv) || a.hpv === 'unsure') out.push('hpv');
  if (skipped(a.smoke)) out.push('smoke');
  if (smokes(a)) {
    if (typeof a.packsPerDay !== 'number') out.push('packs');
    if (typeof a.yearsSmoked !== 'number') out.push('years');
    if (a.smoke === 'former' && skipped(a.quit)) out.push('quit');
  }
  if (skipped(a.alcohol)) out.push('alcohol');
  if (skipped(a.activity)) out.push('activity');
  if (!bodyAnswered(a)) out.push('body');
  if (!freqKnown(a.procMeat)) out.push('procMeat');
  if (!freqKnown(a.redMeat)) out.push('redMeat');
  if (!freqKnown(a.plants)) out.push('plants');
  if (skipped(a.radon) || a.radon === 'unsure') out.push('radon');
  if (skipped(a.sun)) out.push('sun');
  return out;
}

/** True once the check has enough to build anything at all. */
export const hasAnyAnswers = (a: Answers) => a.age !== null || a.sex !== null || symptomsAnswered(a);
