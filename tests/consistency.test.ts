import { describe, expect, it } from 'vitest';
import { check } from '../src/engine/content';
import { bmi, drinks, famAny, hist, isFemale, isMale, smokes, tidyAnswers } from '../src/engine/answers';
import { buildPlan } from '../src/engine/plan';
import { buildCompare } from '../src/engine/compare';
import { buildRisk, leverPatch } from '../src/engine/risk';
import { appliesToYou } from '../src/engine/prevention';
import { prevention } from '../src/engine/content';
import { summarize } from '../src/engine/diary';
import { emptyAnswers, PNTS, type Answers } from '../src/engine/types';

// Every screen must agree with what the person said. A tester answered "never
// smoked" in the risk calculator and then saw "Smokes now" on their plan: the
// calculator kept its own copy of the answers. These checks run thousands of
// random answer sets, made the way the app makes them (every change goes
// through tidyAnswers), through the plan, How you compare, the risk scores and
// the prevention library, and fail on any screen that says something the
// answers do not.

// A small seeded random generator, so a failure can be replayed.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const ids = (list: { id: string }[]) => list.map((o) => o.id);

function randomAnswers(r: () => number): Answers {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  // Each answer: one of its options, "Prefer not to say", or not answered.
  const one = <T extends string>(xs: T[]) => pick<T | typeof PNTS | null>([...xs, PNTS, null]);
  const some = (xs: string[], extra: string[] = []) => {
    const roll = r();
    if (roll < 0.15) return null;
    if (roll < 0.25) return pick([PNTS, ...extra]);
    return xs.filter(() => r() < 0.25);
  };
  const a: Answers = {
    ...emptyAnswers(),
    emergencies: r() < 0.05 ? [pick(ids(check.emergencies))] : [],
    symptoms: r() < 0.2 ? [pick(ids(check.symptoms))] : pick(['none', PNTS, null]),
    age: one(ids(check.ages)),
    sex: one(['female', 'male']),
    famCancers: some(ids(check.familyCancers), ['none', 'unsure']) as Answers['famCancers'],
    famClose: one(['yes', 'no', 'unsure']),
    famYoung: one(['yes', 'no', 'unsure']),
    history: some(ids(check.history), ['none']) as Answers['history'],
    hpv: one(['yes', 'some', 'no', 'unsure']),
    smoke: one(['never', 'former', 'current']),
    // Follow-ups are set whatever the smoking answer, as if the person had
    // first said they smoke and then changed their mind.
    packsPerDay: r() < 0.8 ? pick(check.packsPerDay.map((o) => o.value)) : PNTS,
    yearsSmoked: r() < 0.8 ? Math.floor(r() * 50) : PNTS,
    quit: one(['lt5', '5to15', 'gt15']),
    alcohol: one(['none', 'le1', '2to7', '8to14', '15plus']),
    activity: one(['lt60', '60to149', '150to299', '300plus']),
    heightFt: r() < 0.8 ? 4 + Math.floor(r() * 3) : null,
    heightIn: r() < 0.8 ? Math.floor(r() * 12) : null,
    weightLb: r() < 0.8 ? 100 + Math.floor(r() * 200) : null,
    bodySkip: r() < 0.15,
    procMeat: one(['most', 'some', 'rarely']),
    redMeat: one(['most', 'some', 'rarely']),
    plants: one(['most', 'some', 'rarely']),
    radon: one(['low', 'fixed', 'high', 'never', 'unsure']),
    sun: one(['always', 'sometimes', 'rarely']),
  };
  return tidyAnswers(a);
}

const diary = summarize({});
const RUNS = 4000;
const people = (() => {
  const r = rng(20261004);
  return Array.from({ length: RUNS }, () => randomAnswers(r));
})();

/** Every way a screen could say something about smoking. */
function smokingClaims(a: Answers) {
  const plan = buildPlan(a, { diary });
  const items = [...plan.now, ...plan.yourCall, ...plan.next];
  const tobacco = buildCompare(a, diary).find((row) => row.id === 'tobacco')!;
  const cards = buildRisk(a, diary);
  return { items, tobacco, cards };
}

describe('every screen agrees with the answers (4,000 random people)', () => {
  it('a follow-up the person took back is gone', () => {
    for (const a of people) {
      if (!smokes(a)) expect([a.packsPerDay, a.yearsSmoked, a.quit]).toEqual([null, null, null]);
      if (a.smoke === 'current') expect(a.quit).toBeNull();
      if (!famAny(a)) expect([a.famClose, a.famYoung]).toEqual([null, null]);
      // Cleaning twice changes nothing.
      expect(tidyAnswers(a)).toEqual(a);
    }
  });

  it('someone who did not say they smoke is never shown as a smoker', () => {
    for (const a of people) {
      if (smokes(a)) continue;
      const { items, tobacco, cards } = smokingClaims(a);
      // My plan: no lung screening (that is for people who smoked) and no "quit" question.
      expect(items.filter((i) => i.cancer === 'lung')).toEqual([]);
      expect(items.some((i) => i.asks.includes('quit'))).toBe(false);
      // How you compare: the status said back is the one given, with no pack-years.
      if (a.smoke === 'never') expect(tobacco.said).toEqual({ kind: 'smoke', status: 'never', packYears: null });
      else expect(tobacco.said).toEqual({ kind: 'skipped' });
      // Risk: smoking never raises a score, and no card offers to "quit".
      for (const c of cards) {
        for (const f of c.factors.filter((x) => x.id === 'smoking')) expect(f.rr === null || f.rr <= 1).toBe(true);
        expect(c.lever?.id).not.toBe('smoking');
      }
      // Prevention: tobacco entries are not marked "Applies to you".
      for (const e of prevention.entries.filter((x) => /smokes/i.test(x.appliesIf))) expect(appliesToYou(e, a)).toBe(false);
    }
  });

  it('someone who smokes is shown with the status they gave', () => {
    for (const a of people) {
      if (!smokes(a)) continue;
      const { tobacco } = smokingClaims(a);
      expect(tobacco.said).toMatchObject({ kind: 'smoke', status: a.smoke });
      // "Quit" questions only for someone who smokes now.
      const { items } = smokingClaims(a);
      if (a.smoke !== 'current') expect(items.some((i) => i.asks.includes('quit'))).toBe(false);
      // Quitting is offered only to someone who smokes now, and lands on "quit within 5 years".
      const patch = leverPatch('smoking', a);
      if (a.smoke === 'current') expect(patch).toEqual({ smoke: 'former', quit: 'lt5' });
      else expect(patch).toBeNull();
    }
  });

  it('screening and scores match the sex given', () => {
    for (const a of people) {
      const plan = buildPlan(a, { diary });
      const cancers = [...plan.now, ...plan.yourCall, ...plan.next].map((i) => i.cancer);
      const scored = buildRisk(a, diary).map((c) => c.key);
      if (isMale(a)) {
        expect(cancers).not.toContain('cervical');
        expect(cancers).not.toContain('breast');
        expect(scored).not.toContain('cervical');
        expect(scored).not.toContain('breast');
      }
      if (isFemale(a)) {
        expect(cancers).not.toContain('prostate');
        expect(scored).not.toContain('prostate');
      }
    }
  });

  it('family history counts only when a relative was named', () => {
    for (const a of people) {
      if (famAny(a)) continue;
      expect(buildPlan(a, { diary }).context.family).toEqual([]);
      for (const c of buildRisk(a, diary)) {
        for (const f of c.factors.filter((x) => x.id === 'family')) expect(f.rr === null || f.rr === 1).toBe(true);
      }
    }
  });

  it('drinking, weight and hepatitis are only used when the person said so', () => {
    for (const a of people) {
      const cards = buildRisk(a, diary);
      const factors = cards.flatMap((c) => c.factors);
      if (!drinks(a)) {
        for (const f of factors.filter((x) => x.id === 'alcohol')) expect(f.rr === null || f.rr <= 1).toBe(true);
        for (const e of prevention.entries.filter((x) => /drinks/i.test(x.appliesIf))) expect(appliesToYou(e, a)).toBe(false);
      }
      if (bmi(a) === null) {
        for (const f of factors.filter((x) => x.id === 'weight')) expect(f.rr).toBeNull();
        expect(buildCompare(a, diary).find((row) => row.id === 'weight')!.said).toEqual({ kind: 'skipped' });
      }
      if (!hist(a, 'hep')) expect(cards.find((c) => c.key === 'liver')?.state).not.toBe('surveil');
    }
  });

  it('How you compare repeats each answer as given', () => {
    const groups = { alcohol: 'alcohol', activity: 'activity', radon: 'radon', sun: 'sun' } as const;
    for (const a of people) {
      const rows = buildCompare(a, diary);
      for (const [row, key] of Object.entries(groups)) {
        const said = rows.find((x) => x.id === row)?.said;
        const value = a[key];
        if (value === null || value === PNTS) expect(said).toEqual({ kind: 'skipped' });
        else expect(said).toMatchObject({ kind: 'option', id: value });
      }
    }
  });
});

describe('genes, brain, skin and cervical follow the answers (4,000 random people)', () => {
  const GENE: Record<string, string[]> = { brca: ['breast', 'prostate', 'pancreatic'], lynch: ['colorectal', 'prostate', 'pancreatic', 'stomach', 'brain'], syndrome: ['brain'] };

  it('a gene change sets only the cancers that gene affects', () => {
    for (const a of people) {
      const genes = Object.keys(GENE).filter((g) => hist(a, g));
      const affected = new Set(genes.flatMap((g) => GENE[g]));
      for (const c of buildRisk(a, diary)) {
        if (c.state === 'gene') expect(affected.has(c.key), `${c.key} with ${genes.join('+') || 'no gene'}`).toBe(true);
      }
      // The plan's gene reasons name the right gene.
      const items = (() => { const p = buildPlan(a, { diary }); return [...p.now, ...p.yourCall, ...p.next]; })();
      if (!hist(a, 'brca')) expect(items.some((i) => i.why.includes('brca'))).toBe(false);
      if (!hist(a, 'lynch')) expect(items.some((i) => i.why.includes('lynch'))).toBe(false);
      if (!hist(a, 'brca') && !hist(a, 'lynch')) expect(items.some((i) => i.cancer === 'prostate' && i.why.includes('gene'))).toBe(false);
    }
  });

  it('brain counts a relative, head radiation and weight only when the person said so', () => {
    for (const a of people) {
      const brain = buildRisk(a, diary).find((c) => c.key === 'brain')!;
      const f = (id: string) => brain.factors.find((x) => x.id === id)!;
      if (!(Array.isArray(a.famCancers) && a.famCancers.includes('brain') && a.famClose !== 'no')) expect(f('family').rr === null || f('family').rr === 1).toBe(true);
      if (!hist(a, 'headrad')) expect(f('headrad').rr === null || f('headrad').rr === 1).toBe(true);
      if (bmi(a) === null) expect(f('weight').rr).toBeNull();
    }
  });

  it('a flagged symptom always replaces the score of the cancer it points to', () => {
    for (const s of check.symptoms) {
      if (!s.cancer) continue;
      for (const sex of ['female', 'male'] as const) {
        const a = tidyAnswers({ ...emptyAnswers(), age: '50-54', sex, symptoms: [s.id], smoke: 'never' });
        const card = buildRisk(a, diary).find((c) => c.key === s.cancer);
        if (card) expect(card.state, `${s.id} -> ${s.cancer} (${sex})`).toBe('symptom');
      }
    }
  });

  it('skin counts a past skin cancer, never any other past cancer, and cervical waits on an abnormal Pap', () => {
    for (const a of people) {
      const cards = buildRisk(a, diary);
      const skin = cards.find((c) => c.key === 'skin')!;
      const past = skin.factors.find((x) => x.id === 'skincancer')!;
      if (!hist(a, 'skincancer')) expect(past.rr === null || past.rr === 1).toBe(true);
      const cervical = cards.find((c) => c.key === 'cervical');
      if (cervical && cervical.state === 'surveil') expect(hist(a, 'pap')).toBe(true);
    }
  });
});

describe('every answer in the check is used', () => {
  // Turning one answer on, against a person with every other answer set,
  // must change something a screen shows: the plan, a risk card or How you
  // compare. An answer that changes nothing is a question asked for nothing.
  const someone: Answers = tidyAnswers({
    ...emptyAnswers(), symptoms: 'none', age: '50-54', sex: 'female', famCancers: 'none', history: 'none', hpv: 'no',
    smoke: 'never', alcohol: 'none', activity: '150to299', heightFt: 5, heightIn: 6, weightLb: 140,
    procMeat: 'rarely', redMeat: 'rarely', plants: 'most', radon: 'low', sun: 'sometimes',
  });
  // What a screen decides from the answers. The plan's "Context for your
  // clinician" lists every history answer as given, so it is left out here:
  // repeating an answer is not using it.
  const shown = (a: Answers) => {
    const p = buildPlan(a, { diary });
    return JSON.stringify([p.now, p.yourCall, p.next, p.context.genetic, buildRisk(a, diary), buildCompare(a, diary)]);
  };
  const before = shown(someone);
  const men = { ...someone, sex: 'male' as const };
  // The only answers that inform the clinician without changing a result:
  // a past cancer other than skin (second-cancer risk depends on which cancer
  // and treatment, which one answer cannot say), and an abnormal Pap for a man.
  const CONTEXT_ONLY = new Set(['female history cancer', 'male history cancer', 'male history pap']);

  it('each past illness, gene change and treatment changes a result, for each sex it applies to', () => {
    for (const { id } of check.history) {
      for (const base of [someone, men]) {
        const key = `${base.sex} history ${id}`;
        if (CONTEXT_ONLY.has(key)) continue;
        expect(shown(tidyAnswers({ ...base, history: [id] })) !== shown(base), key).toBe(true);
      }
    }
  });

  it('each cancer in the family changes a result, for each sex', () => {
    for (const { id } of check.familyCancers) {
      for (const base of [someone, men]) {
        const a = tidyAnswers({ ...base, famCancers: [id], famClose: 'yes', famYoung: 'no' });
        expect(shown(a) !== shown(base), `${base.sex} family ${id}`).toBe(true);
      }
    }
  });

  it('each habit and exposure answer', () => {
    const fields: [keyof Answers, string[]][] = [
      ['smoke', ['former', 'current']], ['alcohol', ['le1', '15plus']], ['activity', ['lt60']], ['procMeat', ['most']],
      ['redMeat', ['most']], ['plants', ['rarely']], ['radon', ['high']], ['sun', ['always', 'rarely']], ['hpv', ['yes']],
    ];
    for (const [key, values] of fields) {
      for (const v of values) expect(shown(tidyAnswers({ ...someone, [key]: v })) !== before, `${key}: ${v}`).toBe(true);
    }
  });
});

describe('the reported case: never smoked, after once saying otherwise', () => {
  it('changing "smokes now" to "never smoked" clears the pack-years everywhere', () => {
    const before: Answers = { ...emptyAnswers(), age: '60-64', sex: 'male', smoke: 'current', packsPerDay: 1, yearsSmoked: 30 };
    const after = tidyAnswers({ ...before, smoke: 'never' });
    expect(after).toMatchObject({ smoke: 'never', packsPerDay: null, yearsSmoked: null, quit: null });
    const { items, tobacco } = smokingClaims(after);
    expect(items.some((i) => i.cancer === 'lung')).toBe(false);
    expect(tobacco.said).toEqual({ kind: 'smoke', status: 'never', packYears: null });
  });
});
