// The FutureVitals logo, drawn from vectors traced off the brand logo
// (resources/logo.jpg, by scripts/trace-logo.mjs): a rounded cross, teal
// across the top and right, pink down the left and bottom, with a pink
// stethoscope over it, and FUTURE VITALS lettered beneath. The same paths
// make the icons and splash screens (scripts/make-icons.mjs). Outlines can
// draw themselves in, which is what the launch animation does.
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ease } from '../motion/presets';
import logo from './logo.json';

const { mark, word, lockup } = logo;

export function LogoMark({ size = 40, animate = false, delay = 0 }: { size?: number; animate?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  const draw = animate && !reduce;
  // Each shape's outline draws in, then its color floods in behind it.
  const shape = (d: string, color: string, at: number) => (
    <motion.path d={d} fill={color} stroke={draw ? color : 'none'} strokeWidth={0.5}
      initial={draw ? { pathLength: 0, fillOpacity: 0 } : false}
      animate={{ pathLength: 1, fillOpacity: 1 }}
      transition={{ pathLength: { delay: delay + at, duration: 0.8, ease }, fillOpacity: { delay: delay + at + 0.45, duration: 0.4 } }} />
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="logo-mark">
      {shape(mark.teal, 'var(--mark-a)', 0)}
      {shape(mark.pink, 'var(--mark-b)', 0.15)}
      {shape(mark.stethoscope, 'var(--mark-b)', 0.4)}
    </svg>
  );
}

/** FUTURE VITALS in the logo's own lettering. Sized by the font size around it. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${word.w} ${word.h}`} className={`wordmark ${className || ''}`} role="img" aria-label="FutureVitals">
      <g fill="var(--mark-a)" fillRule="evenodd">{word.glyphs.map((d, i) => <path key={i} d={d} />)}</g>
    </svg>
  );
}

/**
 * Launch sequence: the mark draws itself, the letters rise one by one beneath
 * it, as in the logo, then the whole thing lifts away. About 1.4 s the first
 * time, 0.8 s after that, instant with reduced motion. A tap skips it.
 */
export function Splash({ quick, onDone }: { quick: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(!reduce);
  useEffect(() => {
    if (reduce) { onDone(); return; }
    const id = setTimeout(() => setShow(false), quick ? 820 : 1450);
    return () => clearTimeout(id);
  }, [quick, reduce, onDone]);
  const size = quick ? 104 : 128;
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
          <LogoMark size={size} animate delay={0.05} />
          {/* The lettering sits under the mark where the logo puts it. */}
          <svg className="splash-word" viewBox={`0 0 ${word.w} ${word.h}`} width={(size * word.w) / 100}
            style={{ marginTop: (size * (lockup.word.y - 100)) / 100 }}>
            <g fill="var(--mark-a)" fillRule="evenodd">
              {word.glyphs.map((d, i) => (
                <motion.path key={i} d={d}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (quick ? 0.25 : 0.55) + i * 0.04, type: 'spring', stiffness: 500, damping: 30 }} />
              ))}
            </g>
          </svg>
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
