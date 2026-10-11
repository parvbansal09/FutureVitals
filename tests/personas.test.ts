// Forty test personas. Each expectation is written from the guideline itself
// (USPSTF colorectal 2021, breast 2024, cervical 2018, prostate 2018, skin
// 2023; ACS lung 2023; AASLD 2023), not from the code, so a rule change that
// breaks a guideline fails here. The clinical reviewer signs these off.
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../src/engine/plan';
import { summarize } from '../src/engine/diary';
import { emptyAnswers, type Answers } from '../src/engine/types';

const base = (): Answers => ({
  ...emptyAnswers(),
  symptoms: 'none',
  age: '50-54',
  sex: 'female',
  famCancers: 'none',
  history: 'none',
  hpv: 'yes',
  smoke: 'never',
  alcohol: 'none',
  activity: '150to299',
  heightFt: 5,
  heightIn: 5,
  weightLb: 140,
  procMeat: 'rarely',
  redMeat: 'rarely',
  plants: 'most',
  radon: 'low',
  sun: 'always',
});

interface Expect {
  now?: string[];
  yourCall?: string[];
  next?: string[];
  symptoms?: string[];
  emergency?: string[];
  genetic?: boolean;
  quiet?: boolean;
  why?: Record<string, string[]>;
  asks?: Record<string, string[]>;
  dueAge?: Record<string, number>;
  conditional?: string[];
  notAnswered?: string[];
}

const personas: [string, Partial<Answers>, Expect][] = [
  ['01 woman 50-54, average risk', {}, { now: ['colorectal', 'breast', 'cervical'], yourCall: [], next: [] }],
  ['02 woman 45-49: colorectal now starts at 45', { age: '45-49' }, { now: ['colorectal', 'breast', 'cervical'] }],
  ['03 woman 40-44: colorectal is next, at 45', { age: '40-44' }, { now: ['breast', 'cervical'], next: ['colorectal'], dueAge: { colorectal: 45 } }],
  ['04 woman 35-39: mammogram next, at 40', { age: '35-39' }, { now: ['cervical'], next: ['breast'], dueAge: { breast: 40 } }],
  ['05 woman 21-24: Pap every 3 years', { age: '21-24' }, { now: ['cervical'], why: { cervical: ['young', 'note'] } }],
  ['06 woman 18-20: cervical next, at 21', { age: '18-20' }, { now: [], next: ['cervical'], dueAge: { cervical: 21 } }],
  ['07 woman 25-29 with a BRCA change', { age: '25-29', history: ['brca'] }, { now: ['breast', 'cervical'], why: { breast: ['brca'] }, genetic: true }],
  ['08 woman 65-69: cervical becomes her call', { age: '65-69' }, { now: ['colorectal', 'breast'], yourCall: ['cervical'] }],
  ['09 woman 70-74', { age: '70-74' }, { now: ['colorectal', 'breast'], yourCall: [] }],
  ['10 woman 75-79: both are her call', { age: '75-79' }, { now: [], yourCall: ['colorectal', 'breast'] }],
  ['11 woman 80-84', { age: '80-84' }, { now: [], yourCall: ['colorectal', 'breast'] }],
  ['12 woman 85+: colorectal stops', { age: '85+' }, { now: [], yourCall: ['breast'] }],
  ['13 man 50-54: PSA choice is next, at 55', { sex: 'male' }, { now: ['colorectal'], next: ['prostate'], dueAge: { prostate: 55 } }],
  ['14 man 55-59: PSA is his call', { sex: 'male', age: '55-59' }, { now: ['colorectal'], yourCall: ['prostate'] }],
  ['15 man 70-74: no PSA from 70', { sex: 'male', age: '70-74' }, { now: ['colorectal'], yourCall: [], next: [] }],
  ['16 man 45-49, father had prostate cancer', { sex: 'male', age: '45-49', famCancers: ['prostate'], famClose: 'yes', famYoung: 'no' }, { now: ['colorectal'], yourCall: ['prostate'], why: { prostate: ['early', 'black'] }, genetic: true }],
  ['17 man 45-49, no family history', { sex: 'male', age: '45-49' }, { now: ['colorectal'], next: ['prostate'], why: { prostate: ['next', 'black'] } }],
  ['18 man 60-64, smokes now, 30 pack-years', { sex: 'male', age: '60-64', smoke: 'current', packsPerDay: 1, yearsSmoked: 30 }, { now: ['colorectal'], yourCall: ['lung', 'prostate'], asks: { lung: ['due', 'quit'] } }],
  ['19 man 60-64, quit over 15 years ago, 20 pack-years', { sex: 'male', age: '60-64', smoke: 'former', packsPerDay: 1, yearsSmoked: 20, quit: 'gt15' }, { yourCall: ['lung', 'prostate'], why: { lung: ['eligible', 'quitLong'] } }],
  ['20 woman 55-59, 15 pack-years: under the lung threshold', { age: '55-59', smoke: 'former', packsPerDay: 0.5, yearsSmoked: 30, quit: '5to15' }, { now: ['colorectal', 'breast', 'cervical'], yourCall: [] }],
  ['21 woman 55-59, smokes, amount not given', { age: '55-59', smoke: 'current', packsPerDay: 'pnts', yearsSmoked: 'pnts' }, { yourCall: ['lung'], why: { lung: ['unknownAmount'] } }],
  ['22 man 45-49, 25 pack-years: lung next, at 50', { sex: 'male', age: '45-49', smoke: 'current', packsPerDay: 1, yearsSmoked: 25 }, { now: ['colorectal'], next: ['lung', 'prostate'], dueAge: { lung: 50 } }],
  ['23 woman 50-54, blood in stool', { symptoms: ['sym_bowel'] }, { symptoms: ['sym_bowel'], now: ['breast', 'cervical'] }],
  ['24 woman 50-54, sudden weakness (call 911)', { emergencies: ['em_stroke'], symptoms: [] }, { emergency: ['em_stroke'], now: ['colorectal', 'breast', 'cervical'] }],
  ['25 woman 40-44, new breast lump', { age: '40-44', symptoms: ['sym_breast'] }, { symptoms: ['sym_breast'], now: ['cervical'], next: ['colorectal'] }],
  ['26 woman 30-34, past polyps', { age: '30-34', history: ['polyps'] }, { now: ['colorectal', 'cervical'], why: { colorectal: ['polyps'] } }],
  ['27 man 35-39 with colitis', { sex: 'male', age: '35-39', history: ['ibd'] }, { now: ['colorectal'], why: { colorectal: ['ibd'] } }],
  ['28 woman 30-34, abnormal Pap before', { age: '30-34', history: ['pap'] }, { now: ['cervical'], why: { cervical: ['abnormal'] } }],
  ['29 woman 35-39, parent had colorectal cancer young', { age: '35-39', famCancers: ['colorectal'], famClose: 'yes', famYoung: 'yes' }, { now: ['colorectal', 'cervical'], next: ['breast'], why: { colorectal: ['familyYoung'] }, genetic: true }],
  ['30 woman 35-39, parent had colorectal cancer after 50', { age: '35-39', famCancers: ['colorectal'], famClose: 'yes', famYoung: 'no' }, { now: ['cervical'], next: ['colorectal', 'breast'], dueAge: { colorectal: 40, breast: 40 } }],
  ['31 woman 40-44, parent had colorectal cancer', { age: '40-44', famCancers: ['colorectal'], famClose: 'yes', famYoung: 'no' }, { now: ['colorectal', 'breast', 'cervical'], why: { colorectal: ['family'] } }],
  ['32 woman 30-34, mother had breast cancer', { age: '30-34', famCancers: ['breast'], famClose: 'yes', famYoung: 'no' }, { now: ['breast', 'cervical'], why: { breast: ['family'] }, genetic: true }],
  ['33 woman 45-49, chest radiation before 30', { age: '45-49', history: ['chestrad'] }, { now: ['colorectal', 'breast', 'cervical'], why: { breast: ['chestrad'] } }],
  ['34 man 40-44 with hepatitis B', { sex: 'male', age: '40-44', history: ['hep'] }, { now: ['liver'], next: ['colorectal'] }],
  ['35 woman 50-54, family melanoma', { famCancers: ['melanoma'], famClose: 'yes', famYoung: 'no' }, { now: ['colorectal', 'breast', 'cervical'], yourCall: ['skin'] }],
  ['36 50-54, sex not given: sex-specific items kept, worded conditionally', { sex: 'pnts' }, { now: ['colorectal', 'breast', 'cervical'], next: ['prostate'], conditional: ['breast', 'cervical', 'prostate'] }],
  ['37 age not given: nothing age-based is invented', { age: 'pnts' }, { quiet: true, notAnswered: ['age'] }],
  ['38 every question "Prefer not to say": still a plan', {
    symptoms: 'pnts', age: 'pnts', sex: 'pnts', famCancers: 'pnts', history: 'pnts', hpv: 'pnts', smoke: 'pnts',
    alcohol: 'pnts', activity: 'pnts', heightFt: null, heightIn: null, weightLb: null, bodySkip: true,
    procMeat: 'pnts', redMeat: 'pnts', plants: 'pnts', radon: 'pnts', sun: 'pnts',
  }, { quiet: true, notAnswered: ['symptoms', 'age', 'sex', 'family', 'history', 'hpv', 'smoke', 'alcohol', 'activity', 'body', 'procMeat', 'redMeat', 'plants', 'radon', 'sun'] }],
  ['39 woman 60-64, changing mole and family melanoma', { age: '60-64', symptoms: ['sym_mole'], famCancers: ['melanoma'], famClose: 'yes', famYoung: 'no' }, { symptoms: ['sym_mole'], yourCall: [] }],
  ['40 man 55-59 with Lynch syndrome', { sex: 'male', age: '55-59', history: ['lynch'] }, { now: ['colorectal'], yourCall: ['prostate'], why: { colorectal: ['lynch'] }, genetic: true }],
  // A BRCA change is not Lynch: no early colonoscopy. And the other way round.
  ['41 woman 25-29 with Lynch syndrome', { age: '25-29', history: ['lynch'] }, { now: ['colorectal', 'cervical'], why: { colorectal: ['lynch'] }, genetic: true }],
  ['42 man 45-49 with a BRCA change, no family history', { sex: 'male', age: '45-49', history: ['brca'] }, { now: ['colorectal'], yourCall: ['prostate'], why: { prostate: ['gene', 'black'] }, genetic: true }],
  ['43 woman 30-34, past skin cancer', { age: '30-34', history: ['skincancer'] }, { now: ['cervical'], yourCall: ['skin'], why: { skin: ['history'] } }],
  ['44 woman 30-34, past cancer that was not skin cancer', { age: '30-34', history: ['cancer'] }, { now: ['cervical'], yourCall: [] }],
];

const diary = summarize({});
const ids = (list: { cancer: string }[]) => list.map((i) => i.cancer);

describe('screening plan personas', () => {
  it('has 44 personas', () => expect(personas).toHaveLength(44));

  for (const [name, overrides, exp] of personas) {
    it(name, () => {
      const plan = buildPlan({ ...base(), ...overrides }, { diary });
      if (exp.now) expect(ids(plan.now)).toEqual(exp.now);
      if (exp.yourCall) expect(ids(plan.yourCall)).toEqual(exp.yourCall);
      if (exp.next) expect(ids(plan.next)).toEqual(exp.next);
      if (exp.symptoms) expect(plan.symptoms).toEqual(exp.symptoms);
      if (exp.emergency) expect(plan.emergency).toEqual(exp.emergency);
      if (exp.genetic !== undefined) expect(plan.context.genetic).toBe(exp.genetic);
      if (exp.quiet !== undefined) expect(plan.quiet).toBe(exp.quiet);
      for (const [cancer, why] of Object.entries(exp.why || {})) {
        const item = [...plan.now, ...plan.yourCall, ...plan.next].find((i) => i.cancer === cancer);
        expect(item?.why, `${cancer} why`).toEqual(why);
      }
      for (const [cancer, asks] of Object.entries(exp.asks || {})) {
        const item = [...plan.now, ...plan.yourCall, ...plan.next].find((i) => i.cancer === cancer);
        expect(item?.asks, `${cancer} asks`).toEqual(asks);
      }
      for (const [cancer, age] of Object.entries(exp.dueAge || {})) {
        expect(plan.next.find((i) => i.cancer === cancer)?.dueAge, `${cancer} due age`).toBe(age);
      }
      for (const cancer of exp.conditional || []) {
        const item = [...plan.now, ...plan.yourCall, ...plan.next].find((i) => i.cancer === cancer);
        expect(item?.conditional, `${cancer} conditional`).toBe(true);
      }
      for (const q of exp.notAnswered || []) expect(plan.notAnswered).toContain(q);
    });
  }
});

describe('rules that apply to every plan', () => {
  it('a symptom never produces a screening card for the same cancer', () => {
    const plan = buildPlan({ ...base(), symptoms: ['sym_bowel', 'sym_breast', 'sym_vaginal'] }, { diary });
    expect(ids([...plan.now, ...plan.yourCall, ...plan.next])).not.toContain('colorectal');
    expect(ids([...plan.now, ...plan.yourCall, ...plan.next])).not.toContain('breast');
    expect(ids([...plan.now, ...plan.yourCall, ...plan.next])).not.toContain('cervical');
    expect(plan.symptoms).toHaveLength(3);
  });

  it('no prostate card for someone who answered female, no cervical card for male', () => {
    const f = buildPlan({ ...base(), age: '60-64' }, { diary });
    const m = buildPlan({ ...base(), sex: 'male', age: '60-64' }, { diary });
    expect(ids([...f.now, ...f.yourCall, ...f.next])).not.toContain('prostate');
    expect(ids([...m.now, ...m.yourCall, ...m.next])).not.toContain('cervical');
    expect(ids([...m.now, ...m.yourCall, ...m.next])).not.toContain('breast');
  });

  it('every item names a guideline', () => {
    const plan = buildPlan({ ...base(), sex: 'pnts', age: '60-64', smoke: 'current', packsPerDay: 1, yearsSmoked: 40, history: ['hep'], famCancers: ['melanoma'], famClose: 'yes' }, { diary });
    for (const item of [...plan.now, ...plan.yourCall, ...plan.next]) expect(item.guideline).toBeTruthy();
  });

  it('what you can change lists at most three levers, largest gap first', () => {
    const plan = buildPlan({ ...base(), smoke: 'current', packsPerDay: 1, yearsSmoked: 10, alcohol: '15plus', activity: 'lt60', procMeat: 'most', sun: 'rarely' }, { diary });
    expect(plan.levers.length).toBe(3);
    expect(plan.levers[0].id).toBe('tobacco');
  });

  it('an "I will try this" choice appears on the plan even if not a top lever', () => {
    const plan = buildPlan({ ...base(), smoke: 'current', packsPerDay: 1, yearsSmoked: 10, alcohol: '15plus', activity: 'lt60', sun: 'sometimes' }, { diary, tryThis: ['sun'] });
    expect(plan.tried.map((r) => r.id)).toContain('sun');
  });
});
