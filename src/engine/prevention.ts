// "Applies to you" for the prevention library. Each rule name comes from the
// entry's appliesIf field in content/prevention.json.
import { ageRange, bmiBand, drinks, smokes } from './answers';
import { prevention, type PreventionEntry } from './content';
import type { Answers, Lang } from './types';

const RULES: Record<string, (a: Answers) => boolean> = {
  smokes: (a) => smokes(a),
  drinks: (a) => drinks(a),
  smokesAndDrinks: (a) => smokes(a) && drinks(a),
  weightAbove: (a) => bmiBand(a) === 'over' || bmiBand(a) === 'obese',
  lowActivity: (a) => a.activity === 'lt60' || a.activity === '60to149',
  dietGap: (a) => a.procMeat === 'most' || a.procMeat === 'some' || a.redMeat === 'most' || a.plants === 'some' || a.plants === 'rarely',
  hpvGap: (a) => {
    const age = ageRange(a);
    return (a.hpv === 'no' || a.hpv === 'some' || a.hpv === 'unsure') && (!age || age.lo < 45);
  },
  sunGap: (a) => a.sun === 'sometimes' || a.sun === 'rarely',
  radonUnknown: (a) => a.radon === 'never' || a.radon === 'unsure' || a.radon === 'high',
};

export const appliesToYou = (e: PreventionEntry, a: Answers) => !!RULES[e.appliesIf]?.(a);

const collators = new Map<Lang, Intl.Collator>();

/** With a completed check: entries that apply float to the top. Without: A to Z. */
export function sortedEntries(a: Answers | null, lang: Lang): { entry: PreventionEntry; applies: boolean }[] {
  const list = prevention.entries.map((entry) => ({ entry, applies: a ? appliesToYou(entry, a) : false }));
  let collator = collators.get(lang);
  if (!collator) collators.set(lang, (collator = new Intl.Collator(lang === 'es' ? 'es' : 'en')));
  list.sort((x, y) => (a ? Number(y.applies) - Number(x.applies) : 0) || collator.compare(x.entry.title[lang], y.entry.title[lang]));
  return list;
}

/** True when any entry's review date is older than the stale limit. */
export function libraryStale(now = new Date()): boolean {
  const limit = prevention.staleAfterMonths;
  return prevention.entries.some((e) => {
    const d = new Date(e.reviewed + 'T12:00:00');
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    return months >= limit;
  });
}
