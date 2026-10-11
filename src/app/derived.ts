// Everything the plan, risk and compare screens show is recomputed from the
// stored answers on every change, so editing one answer updates all three at
// once ("recomputes instantly when any answer is changed").
//
// Each result is computed only by the screens that show it, and once for the
// whole app: the store replaces its objects on every change, so the same
// objects mean the same result and a cached one is reused.
import { useApp } from '../state/store';
import { summarize, todayKey, type DiarySummary } from '../engine/diary';
import { buildPlan } from '../engine/plan';
import { buildCompare, type Said } from '../engine/compare';
import { buildRisk } from '../engine/risk';
import { check, type Option } from '../engine/content';
import { hasAnyAnswers, type QuestionKey } from '../engine/answers';
import type { Answers, Lang } from '../engine/types';

/** Remembers the last result, recomputing only when an argument is a different object. */
function lastCall<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let prev: A | null = null;
  let value: R;
  return (...args: A) => {
    if (!prev || args.some((x, i) => x !== prev![i])) {
      value = fn(...args);
      prev = args;
    }
    return value;
  };
}

const diaryOf = lastCall(summarize);
const planOf = lastCall((a: Answers, diary: DiarySummary, tryThis: string[]) => buildPlan(a, { diary, tryThis }));
const compareOf = lastCall(buildCompare);
const riskOf = lastCall(buildRisk);

// Today's date is an argument, so the summary moves on at midnight even if nothing new is logged.
export const useDiary = () => diaryOf(useApp((s) => s.foodLog), todayKey());

export function usePlan() {
  const answers = useApp((s) => s.answers);
  const tryThis = useApp((s) => s.tryThis);
  return planOf(answers, useDiary(), tryThis);
}

export const useCompare = () => compareOf(useApp((s) => s.answers), useDiary());
export const useRisk = () => riskOf(useApp((s) => s.answers), useDiary());

const draftRiskOf = lastCall(buildRisk);
/** The calculator's scores: from its draft when there is one, else from the saved answers. */
export function useRiskFor(draft: Answers | null) {
  const diary = useDiary();
  const saved = useRisk();
  return draft ? draftRiskOf(draft, diary) : saved;
}

/** True once there is something to show: a finished check, or any answer. */
export function useReady() {
  const answers = useApp((s) => s.answers);
  const checkDone = useApp((s) => s.checkDone);
  return checkDone || hasAnyAnswers(answers);
}

type T = (k: string, v?: Record<string, string | number>) => string;

const optLabel = (list: Option[], id: string | null | undefined, lang: Lang) => list.find((o) => o.id === id)?.[lang] ?? '';

/** The "You said" cell of How you compare, in words. */
export function saidText(said: Said, t: T, lang: Lang): string {
  switch (said.kind) {
    case 'skipped':
      return t('compare.skipped');
    case 'option': {
      const group = check[said.group] as Option[];
      return optLabel(group, said.id, lang);
    }
    case 'smoke': {
      const label = optLabel(check.smoke, said.status, lang);
      return said.packYears ? `${label} · ${t('compare.packYears', { n: Math.round(said.packYears) })}` : label;
    }
    case 'bmi':
      return t(`check.s6.bmi${said.band[0].toUpperCase()}${said.band.slice(1)}`);
    case 'meat': {
      const f = (v: string | null) => (v && v !== 'pnts' ? optLabel(check.frequency, v, lang) : t('compare.skipped'));
      return `${t('compare.procLabel')}: ${f(said.proc)} · ${t('compare.redLabel')}: ${f(said.red)}`;
    }
    case 'diaryMeat':
      return t('compare.diaryServings', { proc: said.procPerWeek, red: said.redPerWeek });
    case 'diaryPlants':
      return t('compare.diaryPlants', { n: said.perDay });
  }
}

/** A question's label, for the plan's "Not answered" list. */
export function questionLabel(q: QuestionKey, t: T): string {
  const map: Record<QuestionKey, string> = {
    symptoms: 'check.s1.symptomGroup', age: 'check.s2.age', sex: 'check.s2.sex', family: 'check.s3.title',
    famClose: 'check.s3.close', famYoung: 'check.s3.young', history: 'check.s4.title', hpv: 'check.s4.hpv',
    smoke: 'check.s5.title', packs: 'check.s5.packs', years: 'check.s5.years', quit: 'check.s5.quit',
    alcohol: 'check.s6.alcohol', activity: 'check.s6.activity', body: 'check.s6.body', procMeat: 'check.s6.procMeat',
    redMeat: 'check.s6.redMeat', plants: 'check.s6.plants', radon: 'check.s6.radon', sun: 'check.s6.sun',
  };
  return t(map[q]);
}

/** Step to open when someone wants to change the answer to a question. */
export const stepOf = (q: QuestionKey): number =>
  q === 'symptoms' ? 1 : ['age', 'sex'].includes(q) ? 2 : ['family', 'famClose', 'famYoung'].includes(q) ? 3
    : ['history', 'hpv'].includes(q) ? 4 : ['smoke', 'packs', 'years', 'quit'].includes(q) ? 5 : 6;
