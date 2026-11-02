// App state, kept on the phone only. What is stored matches what the privacy
// screen promises: answers, plan date, "I'll try this" choices, saved places,
// the food diary, a typed ZIP code, and display settings. A GPS position is
// never stored. There is no account and no server.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { appStorage } from '../platform/storage';
import { clearProductCache } from '../platform/off';
import { bump, tidyLog, todayKey } from '../engine/diary';
import { emptyAnswers, type Answers, type FoodLog, type Lang } from '../engine/types';
import { tidyAnswers } from '../engine/answers';

export type Theme = 'system' | 'light' | 'dark';

export interface AppState {
  lang: Lang;
  theme: Theme;
  textScale: number;
  seenIntro: boolean;
  helper: boolean;
  answers: Answers;
  step: number;
  checkDone: boolean;
  planUpdated: string | null;
  tryThis: string[];
  foodLog: FoodLog;
  /** The diary day on screen (YYYY-MM-DD); not saved, so the app opens on today. */
  foodDay: string;
  favorites: string[];
  zip: string;
  hydrated: boolean;

  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setTextScale: (n: number) => void;
  setHelper: (on: boolean) => void;
  markIntroSeen: () => void;
  resetIntro: () => void;
  setAnswers: (patch: Partial<Answers>) => void;
  setStep: (n: number) => void;
  finishCheck: () => void;
  deletePlan: () => void;
  deleteAll: () => void;
  toggleTry: (id: string) => void;
  bumpFood: (day: string, id: string, delta: number) => void;
  setFoodDay: (d: string) => void;
  clearWeek: () => void;
  toggleFavorite: (id: string) => void;
  setZip: (zip: string) => void;
}

const initialLang = (): Lang =>
  typeof navigator !== 'undefined' && /^es\b/i.test(navigator.language || '') ? 'es' : 'en';

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: initialLang(),
      // Light unless the person picks Dark or "Same as phone" in Settings.
      theme: 'light',
      textScale: 1,
      seenIntro: false,
      helper: false,
      answers: emptyAnswers(),
      step: 1,
      checkDone: false,
      planUpdated: null,
      tryThis: [],
      foodLog: {},
      foodDay: todayKey(),
      favorites: [],
      zip: '',
      hydrated: false,

      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setTextScale: (n) => set({ textScale: Math.min(2, Math.max(0.9, Math.round(n * 10) / 10)) }),
      setHelper: (helper) => set({ helper }),
      markIntroSeen: () => set({ seenIntro: true }),
      resetIntro: () => set({ seenIntro: false }),
      setAnswers: (patch) =>
        set((s) => ({
          answers: tidyAnswers({ ...s.answers, ...patch }),
          // Changing any answer after the plan exists re-dates the plan; the
          // plan itself is recomputed from answers on every render.
          planUpdated: s.checkDone ? new Date().toISOString() : s.planUpdated,
        })),
      setStep: (step) => set({ step }),
      finishCheck: () => set({ checkDone: true, planUpdated: new Date().toISOString(), step: 1 }),
      // "Delete my plan": the plan and every answer behind it, nothing else.
      deletePlan: () => set({ answers: emptyAnswers(), checkDone: false, planUpdated: null, tryThis: [], step: 1 }),
      // "Delete my answers from this device": everything personal.
      deleteAll: () => {
        clearProductCache();
        set({
          answers: emptyAnswers(), checkDone: false, planUpdated: null, tryThis: [], step: 1,
          foodLog: {}, favorites: [], zip: '', helper: false,
        });
      },
      toggleTry: (id) => set((s) => ({ tryThis: s.tryThis.includes(id) ? s.tryThis.filter((x) => x !== id) : [...s.tryThis, id] })),
      bumpFood: (day, id, delta) => set((s) => ({ foodLog: bump(s.foodLog, day, id, delta) })),
      setFoodDay: (foodDay) => set({ foodDay }),
      clearWeek: () => set({ foodLog: {} }),
      toggleFavorite: (id) => set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })),
      setZip: (zip) => set({ zip }),
    }),
    {
      name: 'fv2',
      version: 2,
      storage: createJSONStorage(appStorage),
      // Version 1 started on "Same as phone"; the app now starts light, so a
      // saved "system" from then (almost always the untouched default) becomes light.
      migrate: (persisted, version) => {
        const p = (persisted || {}) as Partial<AppState>;
        return version < 2 && p.theme === 'system' ? { ...p, theme: 'light' } : p;
      },
      partialize: (s) => ({
        lang: s.lang, theme: s.theme, textScale: s.textScale, seenIntro: s.seenIntro, helper: s.helper,
        answers: s.answers, step: s.step, checkDone: s.checkDone, planUpdated: s.planUpdated,
        tryThis: s.tryThis, foodLog: s.foodLog, favorites: s.favorites, zip: s.zip,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<AppState>;
        return { ...current, ...p, answers: tidyAnswers({ ...emptyAnswers(), ...(p.answers || {}) }), foodLog: tidyLog(p.foodLog || {}) };
      },
    },
  ),
);

// Screens wait for saved answers to load, so a returning person never sees an
// empty plan flash first. Web storage loads during create(), before useApp
// exists, so this is wired up afterwards rather than in onRehydrateStorage.
const markHydrated = () => useApp.setState({ hydrated: true });
if (useApp.persist.hasHydrated()) markHydrated();
else useApp.persist.onFinishHydration(markHydrated);
