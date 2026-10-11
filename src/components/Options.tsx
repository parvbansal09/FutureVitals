import { useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { bouncy, spring, stagger, riseSmall } from '../motion/presets';
import { haptic } from '../platform/native';
import { cx } from './ui';

export interface Opt {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Exclusive options clear everything else (None of these, Prefer not to say). */
  exclusive?: boolean;
  quiet?: boolean;
  tone?: 'danger';
}

interface Ripple { id: number; x: number; y: number }

function OptionButton({ opt, on, multi, onPick, compact }: { opt: Opt; on: boolean; multi: boolean; onPick: () => void; compact?: boolean }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const n = useRef(0);
  return (
    <motion.button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      className={cx('opt', compact && 'opt-compact', on && 'opt-on', opt.quiet && 'opt-quiet', opt.tone === 'danger' && 'opt-danger')}
      variants={riseSmall}
      whileTap={{ scale: 0.975 }}
      transition={spring}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const id = ++n.current;
        setRipples((list) => [...list, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
        setTimeout(() => setRipples((list) => list.filter((x) => x.id !== id)), 600);
        haptic(8);
        onPick();
      }}
    >
      {ripples.map((rp) => (
        <span key={rp.id} className="ripple" style={{ left: rp.x, top: rp.y }} aria-hidden />
      ))}
      {!compact && (
        <span className={cx('opt-mark', multi ? 'opt-box' : 'opt-radio')} aria-hidden>
          <AnimatePresence>
            {on && (multi ? (
              <motion.svg viewBox="0 0 24 24" width="18" height="18" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={bouncy}>
                <motion.path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, delay: 0.04 }} />
              </motion.svg>
            ) : (
              <motion.span className="opt-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={bouncy} />
            ))}
          </AnimatePresence>
        </span>
      )}
      <span className="opt-text">
        <span className="opt-label">{opt.label}</span>
        {opt.hint && <span className="opt-hint">{opt.hint}</span>}
      </span>
    </motion.button>
  );
}

/** Single choice. value is the chosen id or null. */
export function SingleChoice({ options, value, onChange, label, columns = 1, compact }: {
  options: Opt[]; value: string | null | undefined; onChange: (id: string) => void; label: string; columns?: 1 | 2 | 3; compact?: boolean;
}) {
  return (
    <motion.div role="radiogroup" aria-label={label} className={cx('opts', `opts-${columns}`)} variants={stagger(0.03, 0)} initial="hidden" animate="show">
      {options.map((o) => (
        <OptionButton key={o.id} opt={o} on={value === o.id} multi={false} compact={compact} onPick={() => onChange(o.id)} />
      ))}
    </motion.div>
  );
}

/**
 * Multiple choice with exclusive options. value is a list of ids, or a single
 * exclusive id (like "none" or "pnts"), or null when unanswered.
 */
export function MultiChoice({ options, value, onChange, label, columns = 1 }: {
  options: Opt[]; value: string[] | string | null | undefined; onChange: (v: string[] | string | null) => void; label: string; columns?: 1 | 2;
}) {
  const list = Array.isArray(value) ? value : [];
  const isOn = (o: Opt) => (o.exclusive ? value === o.id : list.includes(o.id));
  const pick = (o: Opt) => {
    if (o.exclusive) {
      onChange(value === o.id ? null : o.id);
      return;
    }
    const next = list.includes(o.id) ? list.filter((x) => x !== o.id) : [...list, o.id];
    onChange(next.length ? next : null);
  };
  return (
    <motion.div role="group" aria-label={label} className={cx('opts', `opts-${columns}`)} variants={stagger(0.03, 0)} initial="hidden" animate="show">
      {options.map((o) => (
        <OptionButton key={o.id} opt={o} on={isOn(o)} multi={!o.exclusive} onPick={() => pick(o)} />
      ))}
    </motion.div>
  );
}

export function Question({ title, note, children, id }: { title: ReactNode; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <motion.fieldset className="question" variants={riseSmall} id={id}>
      <legend className="question-title">{title}</legend>
      {note && <p className="question-note">{note}</p>}
      {children}
    </motion.fieldset>
  );
}
