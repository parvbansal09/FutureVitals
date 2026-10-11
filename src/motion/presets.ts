// One motion vocabulary for the whole app. Springs for anything the hand
// moves; short eased fades for anything that just appears. Everything here is
// transform and opacity only, so it stays smooth on older phones, and
// MotionConfig reducedMotion="user" strips the movement for anyone who has
// asked their phone for less motion.
import type { Transition, Variants } from 'motion/react';

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };
export const softSpring: Transition = { type: 'spring', stiffness: 240, damping: 30, mass: 1 };
export const bouncy: Transition = { type: 'spring', stiffness: 560, damping: 22, mass: 0.8 };
export const snappy: Transition = { type: 'spring', stiffness: 700, damping: 45 };
export const ease = [0.22, 1, 0.36, 1] as const;
export const fade: Transition = { duration: 0.24, ease };

export const stagger = (step = 0.05, delay = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring },
};

export const riseSmall: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring },
};

/**
 * Follow-up questions that open below an answer. It must be a variant, not
 * plain initial/animate values: questions inside it use variants too, and they
 * only rise in when this block itself moves from "hidden" to "show". With plain
 * values they would stay hidden (opacity 0), because the step's own entrance
 * finished before they existed.
 */
export const reveal: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: { ...spring, staggerChildren: 0.06 } },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: bouncy },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: spring },
};

/** Screen transitions. kind: tab (cross-fade), push (forward), pop (back). */
export type NavKind = 'tab' | 'push' | 'pop' | 'none';

export const screenVariants: Variants = {
  enter: (k: NavKind) =>
    k === 'push' ? { x: '9%', opacity: 0 }
      : k === 'pop' ? { x: '-7%', opacity: 0 }
        : k === 'tab' ? { y: 12, opacity: 0, scale: 0.995 }
          : { opacity: 0 },
  center: { x: 0, y: 0, opacity: 1, scale: 1, transition: { ...spring, opacity: { duration: 0.2 } } },
  exit: (k: NavKind) =>
    k === 'push' ? { x: '-5%', opacity: 0, transition: { duration: 0.2, ease } }
      : k === 'pop' ? { x: '9%', opacity: 0, transition: { duration: 0.2, ease } }
        : { opacity: 0, transition: { duration: 0.14 } },
};

/** Check steps slide sideways in the direction of travel. */
export const stepVariants: Variants = {
  enter: (d: number) => ({ x: d >= 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: spring },
  exit: (d: number) => ({ x: d >= 0 ? -48 : 48, opacity: 0, transition: { duration: 0.18, ease } }),
};
