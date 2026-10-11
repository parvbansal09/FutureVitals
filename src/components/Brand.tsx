// The FutureVitals mark, redrawn as vectors from the brand logo: a rounded
// cross, teal across the top and right, pink down the left and bottom, with a
// pink stethoscope: earpieces at the top left, the tube across the middle and
// the chest piece in the right arm. Brand colors: teal #285F5A, pink #EBC3D7.
// Vector strokes can draw themselves in, which is what the launch animation does.
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ease } from '../motion/presets';

// Shared with scripts/make-icons.mjs and index.html; keep them in step.
export const MARK = {
  teal: 'M24 24V14a8 8 0 0 1 16 0v10h10a8 8 0 0 1 0 16H40',
  pink: 'M24 24H14a8 8 0 0 0 0 16h10v10a8 8 0 0 0 16 0V40',
  ears: 'M9 6c0 7 2 11 5 14c3-3 5-7 5-14M14 20v4',
  tube: 'M14 32h7c4 0 6 6 10 6s6-6 10-6h4',
  chest: { cx: 50, cy: 32, r: 4.4 },
  tips: [{ cx: 9, cy: 5.5 }, { cx: 19, cy: 5.5 }],
};

export function LogoMark({ size = 40, animate = false, delay = 0, detail = true }: { size?: number; animate?: boolean; delay?: number; detail?: boolean }) {
  const reduce = useReducedMotion();
  const draw = animate && !reduce;
  const t = (d: number, dur = 0.9) => ({ pathLength: { delay: delay + d, duration: dur, ease }, opacity: { delay: delay + d, duration: 0.01 } });
  const line = (d: string, color: string, width: number, at: number, dur?: number) => (
    <motion.path d={d} stroke={color} strokeWidth={width}
      initial={draw ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 1 }} transition={t(at, dur)} />
  );
  const pop = (at: number) => ({ initial: draw ? { scale: 0 } : false, animate: { scale: 1 }, transition: { delay: delay + at, type: 'spring' as const, stiffness: 420, damping: 18 } });
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="logo-mark">
      {line(MARK.teal, 'var(--mark-a)', 4.6, 0)}
      {line(MARK.pink, 'var(--mark-b)', 4.6, 0.18)}
      {line(MARK.ears, 'var(--mark-b)', 3.4, 0.5, 0.6)}
      {MARK.tips.map((p, i) => <motion.circle key={i} {...p} r={2} fill="var(--mark-b)" style={{ transformOrigin: `${p.cx}px ${p.cy}px` }} {...pop(0.95)} />)}
      {detail && line(MARK.tube, 'var(--mark-b)', 3, 0.7, 0.6)}
      <motion.circle {...MARK.chest} fill="var(--mark-b)" stroke="var(--mark-a)" strokeWidth={2.6}
        style={{ transformOrigin: `${MARK.chest.cx}px ${MARK.chest.cy}px` }} {...pop(1.05)} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className || ''}`}>
      Future<span className="wordmark-accent">Vitals</span>
    </span>
  );
}

/**
 * Launch sequence: the mark draws itself, the name rises letter by letter,
 * then the whole thing lifts away. About 1.4 s the first time, 0.8 s after
 * that, instant with reduced motion. A tap skips it.
 */
export function Splash({ quick, onDone }: { quick: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(!reduce);
  useEffect(() => {
    if (reduce) { onDone(); return; }
    const id = setTimeout(() => setShow(false), quick ? 820 : 1450);
    return () => clearTimeout(id);
  }, [quick, reduce, onDone]);
  const letters = 'FutureVitals'.split('');
  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          className="splash"
          onClick={() => setShow(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.42, ease }}
          aria-hidden
        >
          <div className="splash-glow" />
          <LogoMark size={quick ? 76 : 92} animate delay={0.05} />
          <div className="splash-word" aria-label="FutureVitals">
            {letters.map((ch, i) => (
              <motion.span
                key={i}
                className={i >= 6 ? 'wordmark-accent' : undefined}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (quick ? 0.25 : 0.55) + i * 0.035, type: 'spring', stiffness: 500, damping: 30 }}
              >
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.div className="splash-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: quick ? 0.35 : 0.8, duration: 0.5, ease }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Soft drifting color behind the welcome screen. CSS-animated, stilled for reduced motion. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <span className="blob blob-a" />
      <span className="blob blob-b" />
      <span className="blob blob-c" />
      <span className="grain" />
    </div>
  );
}
