import { describe, expect, it } from 'vitest';
import { bandOf, buildRisk, leverPatch, rrDose } from '../src/engine/risk';
import { buildCompare } from '../src/engine/compare';
import { bump, lastSevenDays, summarize, tidyLog } from '../src/engine/diary';
import { bmi, bmiBand, packYears, notAnswered, tidyAnswers } from '../src/engine/answers';
import { emptyAnswers, type Answers, type FoodLog } from '../src/engine/types';

const base = (): Answers => ({
  ...emptyAnswers(),
  symptoms: 'none', age: '50-54', sex: 'female', famCancers: 'none', history: 'none', hpv: 'yes',
  smoke: 'never', alcohol: 'none', activity: '150to299', heightFt: 5, heightIn: 5, weightLb: 140,
  procMeat: 'rarely', redMeat: 'rarely', plants: 'most', radon: 'low', sun: 'always',
});
const noDiary = summarize({});
/** The diary date n days ago (0 = today). */
const ago = (n: number) => lastSevenDays()[6 - n];
const card = (a: Answers, key: string, d = noDiary) => buildRisk(a, d).find((c) => c.key === key)!;

describe('derived answers', () => {
  it('works out pack-years on the device', () => {
    expect(packYears({ ...base(), smoke: 'current', packsPerDay: 1, yearsSmoked: 25 })).toBe(25);
    expect(packYears({ ...base(), smoke: 'former', packsPerDay: 0.5, yearsSmoked: 30 })).toBe(15);
    expect(packYears({ ...base(), smoke: 'current', packsPerDay: 'pnts', yearsSmoked: 20 })).toBeNull();
  });
  it('shows BMI as a band and treats a skip as unknown, not healthy', () => {
    expect(bmiBand(base())).toBe('healthy');
    expect(bmiBand({ ...base(), weightLb: 200 })).toBe('obese');
    expect(bmiBand({ ...base(), bodySkip: true })).toBeNull();
    expect(notAnswered({ ...base(), bodySkip: true })).toContain('body');
  });
});

describe('risk picture', () => {
  it('uses bands in words', () => {
    expect(bandOf(0.8)).toBe('lower');
    expect(bandOf(1.0)).toBe('about');
    expect(bandOf(1.4)).toBe('somewhat');
    expect(bandOf(2.2)).toBe('higher');
    expect(bandOf(9)).toBe('much');
  });

  it('a never-smoker with healthy answers is about average for lung', () => {
    expect(card(base(), 'lung').band).toBe('about');
  });

  it('a heavy current smoker is much higher for lung, and quitting is the biggest change', () => {
    const c = card({ ...base(), smoke: 'current', packsPerDay: 1.5, yearsSmoked: 30 }, 'lung');
    expect(c.band).toBe('much');
    expect(c.lever?.id).toBe('smoking');
  });

  it('never counts a skipped answer as healthy', () => {
    const c = card({ ...base(), alcohol: 'pnts', activity: 'pnts' }, 'colorectal');
    const skipped = c.factors.filter((f) => f.rr === null).map((f) => f.id);
    expect(skipped).toEqual(expect.arrayContaining(['alcohol', 'activity']));
    expect(c.answered).toBeLessThan(c.total);
  });

  it('shows "not enough answered" below half the factors', () => {
    const a: Answers = { ...emptyAnswers(), age: '50-54', sex: 'female', symptoms: 'none' };
    expect(card(a, 'colorectal').state).toBe('thin');
  });

  it('a gene change replaces the band only for the cancers that gene affects', () => {
    const brca = { ...base(), history: ['brca'] };
    expect(['breast', 'colorectal', 'prostate', 'pancreatic', 'stomach', 'brain'].map((k) => card(brca, k)?.state ?? '-'))
      .toEqual(['gene', 'band', '-', 'gene', 'band', 'band']); // a woman: no prostate card
    const lynch = { ...base(), history: ['lynch'] };
    expect(['breast', 'colorectal', 'pancreatic', 'stomach', 'brain'].map((k) => card(lynch, k).state))
      .toEqual(['band', 'gene', 'gene', 'gene', 'gene']);
    const syndrome = { ...base(), history: ['syndrome'] };
    expect(['breast', 'colorectal', 'brain'].map((k) => card(syndrome, k).state)).toEqual(['band', 'band', 'gene']);
    expect(card(brca, 'lung').state).toBe('band');
  });

  it('an old "BRCA or Lynch" answer is read as both genes', () => {
    const a = tidyAnswers({ ...base(), history: ['gene', 'polyps'] });
    expect(a.history).toEqual(['polyps', 'brca', 'lynch']);
  });

  it('a symptom replaces the band for that cancer only', () => {
    const a = { ...base(), symptoms: ['sym_bowel'] };
    expect(card(a, 'colorectal').state).toBe('symptom');
    expect(card(a, 'breast').state).toBe('band');
  });

  it('long-term hepatitis takes liver off the average scale; other liver factors still score', () => {
    const smoker = { ...base(), smoke: 'current' as const, packsPerDay: 1, yearsSmoked: 20 };
    const liver = card(smoker, 'liver');
    expect(liver.state).toBe('band');
    expect(liver.factors.find((f) => f.id === 'smoking')?.rr).toBe(1.51);
    const hep = card({ ...smoker, history: ['hep'] }, 'liver');
    expect(hep.state).toBe('surveil');
    expect(hep.multiple).toBeNull();
    expect(hep.lever).toBeNull();
  });

  it('scores the cancers the old app had: pancreatic, stomach, and bladder from smoking', () => {
    const a: Answers = { ...base(), smoke: 'current', packsPerDay: 1, yearsSmoked: 20, famCancers: ['stomach'], famClose: 'yes', famYoung: 'no' };
    expect(card(a, 'pancreatic').factors.find((f) => f.id === 'smoking')?.rr).toBe(2.2);
    const stomach = card(a, 'stomach');
    expect(stomach.factors.find((f) => f.id === 'family')?.rr).toBe(2.35);
    expect(stomach.multiple).toBeCloseTo(1.53 * 2.35, 1);
    expect(card(a, 'bladder').multiple).toBe(4.1);
    expect(card({ ...a, smoke: 'never' }, 'bladder').multiple).toBe(1);
  });

  it('brain is scored from family history, radiation to the head and weight; smoking and alcohol do not count', () => {
    const plain = card({ ...base(), smoke: 'current', alcohol: '15plus' }, 'brain');
    expect(plain.factors.map((f) => f.id)).toEqual(['family', 'headrad', 'weight']);
    expect(plain.multiple).toBe(1);
    const fam = card({ ...base(), famCancers: ['brain'], famClose: 'yes', famYoung: 'no' }, 'brain');
    expect(fam.multiple).toBe(1.8);
    const rad = card({ ...base(), history: ['headrad'] }, 'brain');
    expect(rad.factors.find((f) => f.id === 'headrad')!.rr).toBe(6.8);
    expect(rad.band).toBe('much');
    // Obesity: about 1.5 (Niedermaier 2015, meningioma).
    const heavy = card({ ...base(), heightFt: 5, heightIn: 6, weightLb: 200 }, 'brain');
    expect(heavy.factors.find((f) => f.id === 'weight')!.rr).toBeGreaterThan(1.4);
    expect(heavy.lever?.id).toBe('weight');
    // A relative named but not close counts as no close family history.
    expect(card({ ...base(), famCancers: ['brain'], famClose: 'no' }, 'brain').multiple).toBe(1);
  });

  it('skin uses sun protection and a past skin cancer, not any past cancer', () => {
    expect(card({ ...base(), sun: 'always' }, 'skin').factors.find((f) => f.id === 'sun')!.rr).toBe(0.5);
    expect(card({ ...base(), sun: 'rarely' }, 'skin').lever?.patch).toEqual({ sun: 'always' });
    expect(card({ ...base(), history: ['skincancer'] }, 'skin').factors.find((f) => f.id === 'skincancer')!.rr).toBe(4.28);
    expect(card({ ...base(), history: ['cancer'] }, 'skin').factors.find((f) => f.id === 'skincancer')!.rr).toBe(1);
  });

  it('cervical uses the HPV vaccine, and an abnormal Pap or HPV test sets a follow-up instead of a score', () => {
    expect(card({ ...base(), hpv: 'yes' }, 'cervical').factors.find((f) => f.id === 'hpv')!.rr).toBe(0.47);
    expect(card({ ...base(), hpv: 'unsure' }, 'cervical').factors.find((f) => f.id === 'hpv')!.rr).toBeNull();
    const pap = card({ ...base(), history: ['pap'] }, 'cervical');
    expect(pap.state).toBe('surveil');
    expect(pap.multiple).toBeNull();
  });

  it('bladder counts a close relative with bladder cancer', () => {
    const c = card({ ...base(), smoke: 'never', famCancers: ['bladder'], famClose: 'yes' }, 'bladder');
    expect(c.factors.find((f) => f.id === 'family')!.rr).toBe(2.72);
  });

  it('keeps a fixed order: no ranking of cancers by value', () => {
    const order = buildRisk({ ...base(), smoke: 'current', packsPerDay: 2, yearsSmoked: 40 }, noDiary).map((c) => c.key);
    expect(order).toEqual(['breast', 'cervical', 'colorectal', 'lung', 'skin', 'liver', 'pancreatic', 'stomach', 'bladder', 'brain']);
    const men = buildRisk({ ...base(), sex: 'male' }, noDiary).map((c) => c.key);
    expect(men).toEqual(['colorectal', 'lung', 'prostate', 'skin', 'liver', 'pancreatic', 'stomach', 'bladder', 'brain']);
  });

  it('dose-response never runs backwards', () => {
    expect(rrDose(1.18, -20, 50)).toBe(1);
  });
});

describe('risk score calculator', () => {
  const smoker = (): Answers => ({ ...base(), smoke: 'current', packsPerDay: 1.5, yearsSmoked: 30, activity: 'lt60', alcohol: '15plus' });

  it('"Try this change" lands on the score the biggest-change line promised', () => {
    for (const key of ['lung', 'colorectal', 'bladder', 'pancreatic', 'breast', 'liver']) {
      const a = smoker();
      const before = card(a, key);
      expect(before.lever, key).not.toBeNull();
      expect(before.lever!.patch, key).not.toBeNull();
      const after = card({ ...a, ...before.lever!.patch }, key);
      expect(after.multiple, key).toBeCloseTo(before.lever!.toMultiple, 1);
      expect(after.multiple!, key).toBeLessThan(before.multiple!);
    }
  });

  it('quitting moves a smoker to "quit within 5 years", never to never-smoked', () => {
    expect(leverPatch('smoking', smoker())).toEqual({ smoke: 'former', quit: 'lt5' });
    expect(leverPatch('smoking', { ...smoker(), smoke: 'never' })).toBeNull();
  });

  it('a weight change is 5 BMI units, never below 23, and none is offered in the healthy range', () => {
    const heavy = { ...base(), weightLb: 220 }; // 5 ft 5 in: BMI about 36.6
    const patch = leverPatch('weight', heavy)!;
    expect(bmi({ ...heavy, ...patch })).toBeCloseTo(31.6, 0);
    expect(leverPatch('weight', { ...base(), weightLb: 150 })!.weightLb).toBe(138); // BMI 25 -> 23
    const healthy = card({ ...base(), weightLb: 140, smoke: 'never', alcohol: 'none', activity: '300plus' }, 'colorectal');
    expect(healthy.lever?.id).not.toBe('weight');
  });

  it('a diet change cannot be tried while the food diary sets the amounts', () => {
    let log: FoodLog = {};
    for (const day of [0, 1, 2]) log = bump(log, ago(day), 'proc', 3);
    const c = card({ ...base(), smoke: 'never' }, 'colorectal', summarize(log));
    expect(c.lever?.id).toBe('procmeat');
    expect(c.lever?.patch).toBeNull();
  });

  it('a skipped answer can be filled in and the score appears', () => {
    const blank: Answers = { ...emptyAnswers(), age: '50-54', sex: 'female', symptoms: 'none' };
    expect(card(blank, 'bladder').state).toBe('thin');
    expect(card({ ...blank, smoke: 'current' }, 'bladder').multiple).toBe(4.1);
  });
});

describe('food diary dates', () => {
  it('counts only the last 7 days, ending today', () => {
    const today = '2026-10-05'; // a Monday
    const log: FoodLog = { '2026-10-05': { proc: 1 }, '2026-09-29': { proc: 1 }, '2026-09-28': { proc: 5 }, '2026-08-01': { red: 9 } };
    const s = summarize(log, today);
    expect(lastSevenDays(today)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(s.daysLogged).toBe(2);
    expect(s.week.proc).toBe(2);
    expect(s.week.red).toBe(0);
  });

  it('drops old days when logging, and never logs a day outside the 7', () => {
    const today = '2026-10-05';
    let log: FoodLog = { '2026-09-01': { veg: 3 } };
    log = bump(log, '2026-10-05', 'veg', 1, today);
    expect(log).toEqual({ '2026-10-05': { veg: 1 } });
    expect(bump(log, '2026-10-09', 'veg', 1, today)).toEqual(log); // a future day
    expect(bump(log, '2026-09-20', 'veg', 1, today)).toEqual(log); // too old
  });

  it('moves days saved by the old weekday version to their latest date', () => {
    // Monday = 0. On Wednesday 2026-10-07, Monday is 10-05 and Thursday (3) is last week's 10-01.
    expect(tidyLog({ 0: { proc: 1 }, 3: { veg: 2 } }, '2026-10-07')).toEqual({ '2026-10-05': { proc: 1 }, '2026-10-01': { veg: 2 } });
  });
});

describe('how you compare', () => {
  it('sorts by gap, largest first, then unknown, then on track', () => {
    const rows = buildCompare({ ...base(), smoke: 'current', packsPerDay: 1, yearsSmoked: 25, activity: 'lt60', radon: 'never', sun: 'sometimes' }, noDiary);
    expect(rows[0].id).toBe('tobacco');
    expect(rows[0].largest).toBe(true);
    expect(rows[1].id).toBe('activity');
    const statuses = rows.map((r) => r.status);
    expect(statuses.indexOf('unknown')).toBeGreaterThan(statuses.lastIndexOf('gap'));
    expect(statuses.lastIndexOf('unknown')).toBeLessThan(statuses.indexOf('meets'));
  });

  it('shows "Prefer not to say" rows as unknown, not counted', () => {
    const rows = buildCompare({ ...base(), alcohol: 'pnts' }, noDiary);
    expect(rows.find((r) => r.id === 'alcohol')?.status).toBe('unknown');
  });

  it('HPV vaccine is not advised after 45', () => {
    const rows = buildCompare({ ...base(), hpv: 'no', age: '55-59' }, noDiary);
    expect(rows.find((r) => r.id === 'hpv')?.status).toBe('na');
  });

  it('switches the diet rows from check answers to the food diary at 3 logged days', () => {
    // The check says processed meat rarely and plants at most meals...
    const a = { ...base(), procMeat: 'rarely' as const, plants: 'most' as const };
    // ...but the diary shows a hot dog every day and no fruit or vegetables.
    let log: FoodLog = {};
    log = bump(log, ago(0), 'proc', 1);
    log = bump(log, ago(1), 'proc', 1);
    const twoDays = summarize(log);
    expect(twoDays.useDiary).toBe(false);
    let rows = buildCompare(a, twoDays);
    expect(rows.find((r) => r.id === 'meat')?.source).toBe('check');
    expect(rows.find((r) => r.id === 'meat')?.status).toBe('meets');

    log = bump(log, ago(2), 'proc', 1);
    const threeDays = summarize(log);
    expect(threeDays.useDiary).toBe(true);
    rows = buildCompare(a, threeDays);
    const meat = rows.find((r) => r.id === 'meat')!;
    const plants = rows.find((r) => r.id === 'plants')!;
    expect(meat.source).toBe('diary');
    expect(meat.status).toBe('gap');
    expect(meat.said).toEqual({ kind: 'diaryMeat', procPerWeek: 7, redPerWeek: 0 });
    expect(plants.source).toBe('diary');
    expect(plants.status).toBe('gap');
  });

  it('the risk picture switches its diet factors to the diary at the same point', () => {
    let log: FoodLog = {};
    for (const day of [0, 1, 2]) log = bump(log, ago(day), 'proc', 2);
    const c = card(base(), 'colorectal', summarize(log));
    expect(c.factors.find((f) => f.id === 'procmeat')?.fromDiary).toBe(true);
    expect(c.factors.find((f) => f.id === 'procmeat')?.rr).toBeCloseTo(Math.pow(1.18, 2), 5);
  });
});
