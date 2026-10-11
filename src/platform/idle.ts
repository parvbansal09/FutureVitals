/**
 * Runs `fn` when the phone has a quiet moment, or after `timeout` ms at the
 * latest. Where there is no idle callback (older iOS web views) it waits a
 * short while instead. Returns a function that cancels it.
 */
export function onIdle(fn: () => void, timeout = 1500): () => void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, Math.min(timeout, 600));
  return () => clearTimeout(id);
}
