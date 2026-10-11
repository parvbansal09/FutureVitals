// "Try this change" on the risk scores: a copy of the answers with the change
// in it, to see the scores move. It lives in memory only, so trying a change
// never touches the person's answers or plan until they choose Keep this
// change. It is dropped as soon as the saved answers change (an answer
// changed in the calculator or the check, a delete), so it can never show a
// stale mix of old and new. Answers changed in the calculator itself are the
// person's own answers and are saved, so every screen agrees.
import { create } from 'zustand';
import { useApp } from './store';
import type { Answers } from '../engine/types';
import { tidyAnswers } from '../engine/answers';

interface CalcState {
  /** The saved answers the draft was made from. */
  from: Answers | null;
  draft: Answers | null;
  edit: (saved: Answers, patch: Partial<Answers>) => void;
  reset: () => void;
}

export const useCalc = create<CalcState>((set) => ({
  from: null,
  draft: null,
  edit: (saved, patch) =>
    set((s) => ({ from: saved, draft: tidyAnswers({ ...(s.from === saved && s.draft ? s.draft : saved), ...patch }) })),
  reset: () => set({ from: null, draft: null }),
}));

/** The draft, or null when there is none for the current saved answers. */
export function useDraft(): Answers | null {
  const saved = useApp((s) => s.answers);
  const { from, draft } = useCalc();
  return draft && from === saved ? draft : null;
}

/** Whether a draft differs from the saved answers at all. */
export const draftChanged = (draft: Answers | null, saved: Answers) =>
  !!draft && (Object.keys(saved) as (keyof Answers)[]).some((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]));
