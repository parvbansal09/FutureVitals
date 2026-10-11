// The screening plan: guideline matching, not scoring. Each rule below is a
// direct reading of a published criterion, named in content/screening.json.
// Nothing here produces a probability, a score, or a ranking of cancers.
//
// Order is fixed by the spec: Get this checked, Raise now, Your call, For your
// next visit, Context for your clinician, What you can change, Not answered.
// Within a section items keep one clinical order, never a "most likely" order.
import {
  ageRange, bandTouches, bandWithin, famCloseYes, famHas, famYoungYes, hasSymptom, hist, isFemale,
  isList, isMale, notAnswered, packYears, sexUnknown, smokes, symptomForCancer, type QuestionKey,
} from './answers';
import { buildCompare, type CompareRow } from './compare';
import type { DiarySummary } from './diary';
import type { Answers, ClinicTest } from './types';

export type Section = 'now' | 'yourCall' | 'next';
export type PlanCancer = 'colorectal' | 'breast' | 'cervical' | 'lung' | 'prostate' | 'skin' | 'liver';

export interface PlanItem {
  cancer: PlanCancer;
  section: Section;
  /** Keys into screening.items[cancer].why, shown in order. */
  why: string[];
  /** Key into screening.items[cancer].options, or null for none. */
  options: string | null;
  /** Keys into screening.items[cancer].asks; the questions are merged, max 3. */
  asks: string[];
  /** "Your call" items show both sides in two sentences. */
  sides: boolean;
  dueAge?: number;
  /** Sex was not given, so the card is worded "if this applies to your body". */
  conditional: boolean;
  guideline: string;
  altGuideline?: string;
  /** The test to pre-set in Find a clinic. */
  test: ClinicTest | null;
}

export interface Plan {
  emergency: string[];
  symptoms: string[];
  now: PlanItem[];
  yourCall: PlanItem[];
  next: PlanItem[];
  context: {
    family: string[];
    close: boolean;
    young: boolean;
    genetic: boolean;
    history: string[];
  };
  levers: CompareRow[];
  tried: CompareRow[];
  notAnswered: QuestionKey[];
  /** Screenings this person is due for or deciding on, for the clinic filter. */
  tests: ClinicTest[];
  /** True when nothing at all is in Raise now / Your call / Next. */
  quiet: boolean;
}

const ORDER: PlanCancer[] = ['colorectal', 'breast', 'cervical', 'lung', 'prostate', 'skin', 'liver'];

// Cancers in a close relative that point to an inherited pattern worth a
// genetics conversation (USPSTF BRCA 2019; NCCN familial risk criteria).
const GENETIC_FAMILY = ['breast', 'ovarian', 'colorectal', 'uterine', 'prostate', 'pancreatic'];

export function buildPlan(a: Answers, opts: { diary: DiarySummary; tryThis?: string[] }): Plan {
  const items: PlanItem[] = [];
  const age = ageRange(a);
  const conditional = sexUnknown(a);
  const canCervix = !isMale(a);
  const canProstate = !isFemale(a);
  const canBreast = !isMale(a);
  const brca = hist(a, 'brca');
  const lynch = hist(a, 'lynch');

  const add = (item: Omit<PlanItem, 'conditional' | 'sides'> & { sides?: boolean; conditional?: boolean }) =>
    items.push({ sides: false, conditional: false, ...item });

  // ── Colorectal (USPSTF 2021: 45 to 75; 76 to 85 selective) ───────────────
  if (!symptomForCancer(a, 'colorectal')) {
    const polyps = hist(a, 'polyps');
    const ibd = hist(a, 'ibd');
    const famCrc = famHas(a, 'colorectal') && famCloseYes(a);
    if (polyps || ibd) {
      // Follow-up track: the routine options would be the wrong test.
      add({ cancer: 'colorectal', section: 'now', why: [polyps ? 'polyps' : 'ibd'], options: 'colonoscopy', asks: ['surveil'], guideline: 'colorectal', test: 'colonoscopy' });
    } else if (lynch && age && age.lo >= 20) {
      add({ cancer: 'colorectal', section: 'now', why: ['lynch'], options: 'colonoscopy', asks: ['family'], guideline: 'colorectal', test: 'colonoscopy' });
    } else if (famCrc && age && age.lo >= 40 && age.hi <= 74) {
      add({ cancer: 'colorectal', section: 'now', why: ['family'], options: 'colonoscopy', asks: ['family'], guideline: 'colorectal', test: 'colonoscopy' });
    } else if (famCrc && famYoungYes(a) && age && age.lo >= 25 && age.hi <= 39) {
      add({ cancer: 'colorectal', section: 'now', why: ['familyYoung'], options: 'colonoscopy', asks: ['family'], guideline: 'colorectal', test: 'colonoscopy' });
    } else if (famCrc && bandWithin(age, 35, 39)) {
      add({ cancer: 'colorectal', section: 'next', why: ['nextFamily'], options: null, asks: ['family'], dueAge: 40, guideline: 'colorectal', test: null });
    } else if (bandWithin(age, 45, 74)) {
      add({ cancer: 'colorectal', section: 'now', why: ['due'], options: 'average', asks: ['due'], guideline: 'colorectal', test: 'fit' });
    } else if (bandWithin(age, 75, 84)) {
      add({ cancer: 'colorectal', section: 'yourCall', why: ['older'], options: 'average', asks: ['older'], sides: true, guideline: 'colorectal', test: 'colonoscopy' });
    } else if (bandWithin(age, 40, 44)) {
      add({ cancer: 'colorectal', section: 'next', why: ['next'], options: null, asks: ['due'], dueAge: 45, guideline: 'colorectal', test: null });
    }
  }

  // ── Breast (USPSTF 2024: every 2 years, 40 to 74; 75+ insufficient) ──────
  if (canBreast && !hasSymptom(a, 'sym_breast')) {
    const famBr = (famHas(a, 'breast') || famHas(a, 'ovarian')) && famCloseYes(a);
    if (brca && age && age.lo >= 25) {
      add({ cancer: 'breast', section: 'now', why: ['brca'], options: 'high', asks: ['high'], guideline: 'breast', test: 'mammogram', conditional });
    } else if (hist(a, 'chestrad') && age && age.lo >= 25) {
      add({ cancer: 'breast', section: 'now', why: ['chestrad'], options: 'high', asks: ['high'], guideline: 'breast', test: 'mammogram', conditional });
    } else if (bandWithin(age, 40, 74)) {
      add({ cancer: 'breast', section: 'now', why: famBr ? ['due', 'family'] : ['due'], options: 'average', asks: famBr ? ['due', 'high'] : ['due'], guideline: 'breast', test: 'mammogram', conditional });
    } else if (famBr && age && age.lo >= 25 && age.hi <= 39) {
      add({ cancer: 'breast', section: 'now', why: ['family'], options: 'average', asks: ['high'], guideline: 'breast', test: 'mammogram', conditional });
    } else if (bandWithin(age, 35, 39)) {
      add({ cancer: 'breast', section: 'next', why: ['next'], options: null, asks: ['due'], dueAge: 40, guideline: 'breast', test: null, conditional });
    } else if (age && age.lo >= 75) {
      add({ cancer: 'breast', section: 'yourCall', why: ['older'], options: 'average', asks: ['older'], sides: true, guideline: 'breast', test: 'mammogram', conditional });
    }
  }

  // ── Cervical (USPSTF 2018: 21 to 29 Pap every 3; 30 to 65 choice) ───────
  if (canCervix && !hasSymptom(a, 'sym_vaginal')) {
    if (hist(a, 'pap') && age && age.lo >= 21) {
      add({ cancer: 'cervical', section: 'now', why: ['abnormal'], options: 'followup', asks: ['followup'], guideline: 'cervical', test: 'pap', conditional });
    } else if (bandWithin(age, 21, 29)) {
      add({ cancer: 'cervical', section: 'now', why: ['young', 'note'], options: 'young', asks: ['due'], guideline: 'cervical', test: 'pap', conditional });
    } else if (bandWithin(age, 30, 64)) {
      add({ cancer: 'cervical', section: 'now', why: ['adult', 'note'], options: 'adult', asks: ['due'], guideline: 'cervical', test: 'pap', conditional });
    } else if (bandWithin(age, 65, 69)) {
      add({ cancer: 'cervical', section: 'yourCall', why: ['older'], options: 'adult', asks: ['older'], sides: true, guideline: 'cervical', test: 'pap', conditional });
    } else if (bandWithin(age, 18, 20)) {
      add({ cancer: 'cervical', section: 'next', why: ['next'], options: null, asks: ['due'], dueAge: 21, guideline: 'cervical', test: null, conditional });
    }
  }

  // ── Lung (ACS 2023: 50 to 80, 20+ pack-years, smoking now or before) ────
  // Low-dose CT is a shared decision (a counseling visit comes before the
  // first scan), so an eligible person sees it under "Your call".
  if (smokes(a) && !hasSymptom(a, 'sym_cough')) {
    const py = packYears(a);
    const inAge = !!age && age.lo >= 50 && age.lo <= 80;
    if (inAge && py !== null && py >= 20) {
      const why = ['eligible'];
      if (a.smoke === 'former' && a.quit === 'gt15') why.push('quitLong');
      if (age && age.lo === 80) why.push('age80');
      add({ cancer: 'lung', section: 'yourCall', why, options: 'average', asks: a.smoke === 'current' ? ['due', 'quit'] : ['due'], sides: true, guideline: 'lung', altGuideline: 'lungAlt', test: 'ldct' });
    } else if (inAge && py === null) {
      add({ cancer: 'lung', section: 'yourCall', why: ['unknownAmount'], options: 'average', asks: a.smoke === 'current' ? ['due', 'quit'] : ['due'], sides: true, guideline: 'lung', altGuideline: 'lungAlt', test: 'ldct' });
    } else if (bandWithin(age, 45, 49) && (py === null || py >= 20)) {
      add({ cancer: 'lung', section: 'next', why: ['next'], options: null, asks: a.smoke === 'current' ? ['quit'] : ['due'], dueAge: 50, guideline: 'lung', test: null });
    }
  }

  // ── Prostate (USPSTF 2018: 55 to 69 individual decision; not from 70) ──
  if (canProstate) {
    const famEarly = famHas(a, 'prostate') && famCloseYes(a);
    const geneEarly = brca || lynch;
    if ((famEarly || geneEarly) && bandWithin(age, 45, 54)) {
      // Say which reason applies: a gene change is not "a father or brother who had it".
      add({ cancer: 'prostate', section: 'yourCall', why: [famEarly ? 'early' : 'gene', 'black'], options: 'average', asks: ['decide'], sides: true, guideline: 'prostate', test: null, conditional });
    } else if (bandWithin(age, 55, 69)) {
      add({ cancer: 'prostate', section: 'yourCall', why: ['decide'], options: 'average', asks: ['decide'], sides: true, guideline: 'prostate', test: null, conditional });
    } else if (bandWithin(age, 45, 54)) {
      add({ cancer: 'prostate', section: 'next', why: ['next', 'black'], options: null, asks: ['decide'], dueAge: 55, guideline: 'prostate', test: null, conditional });
    }
  }

  // ── Skin (USPSTF 2023: evidence insufficient for routine checks) ────────
  if (!hasSymptom(a, 'sym_mole') && (famHas(a, 'melanoma') || hist(a, 'skincancer'))) {
    add({ cancer: 'skin', section: 'yourCall', why: ['history'], options: 'average', asks: ['history'], sides: true, guideline: 'skin', test: 'skin' });
  }

  // ── Liver (AASLD 2023: surveillance for some with hepatitis B or C) ─────
  if (hist(a, 'hep')) {
    add({ cancer: 'liver', section: 'now', why: ['hep'], options: 'average', asks: ['hep'], guideline: 'liver', test: null });
  }

  const bySection = (s: Section) =>
    items.filter((i) => i.section === s).sort((x, y) => ORDER.indexOf(x.cancer) - ORDER.indexOf(y.cancer));

  // ── Context for the clinician ────────────────────────────────────────────
  const family = isList(a.famCancers) ? [...a.famCancers] : [];
  const close = famCloseYes(a);
  const young = famYoungYes(a);
  const genetic = brca || lynch || hist(a, 'syndrome') || young || (close && family.some((c) => GENETIC_FAMILY.includes(c)));
  const history = isList(a.history) ? [...a.history] : [];

  // ── What you can change: the three largest gaps, plus anything tried ────
  const rows = buildCompare(a, opts.diary);
  const levers = rows.filter((r) => r.status === 'gap').slice(0, 3);
  const tried = (opts.tryThis || [])
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is CompareRow => !!r && !levers.includes(r));

  const now = bySection('now');
  const yourCall = bySection('yourCall');
  const next = bySection('next');
  const tests = [...now, ...yourCall].map((i) => i.test).filter((t): t is ClinicTest => !!t);

  return {
    emergency: [...a.emergencies],
    symptoms: isList(a.symptoms) ? [...a.symptoms] : [],
    now,
    yourCall,
    next,
    context: { family, close, young, genetic, history },
    levers,
    tried,
    notAnswered: notAnswered(a),
    tests: [...new Set(tests)],
    quiet: now.length + yourCall.length + next.length === 0,
  };
}

/** Is a band inside a guideline range? Exposed for the personas test. */
export const _internal = { bandWithin, bandTouches };
