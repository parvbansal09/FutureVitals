import { startTransition, useEffect, useState } from 'react';

/**
 * Lets a long screen paint its top first. Returns false for the first frame,
 * then true: the parts below the fold render right after the first paint, in
 * a transition that a tap can interrupt. Pass `now` to render everything at
 * once (going back, so the scroll position can be restored).
 */
export function useSecondPass(now = false): boolean {
  const [on, setOn] = useState(now);
  useEffect(() => {
    if (on) return;
    let timer = 0;
    // A task queued from the next animation frame runs after that frame paints.
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(() => startTransition(() => setOn(true)), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [on]);
  return on;
}
