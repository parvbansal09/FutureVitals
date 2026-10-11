import { useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { ArrowRight, ArrowUpRight, ChevronDown, Mail, Minus, Phone, Plus, X } from 'lucide-react';
import { create } from 'zustand';
import { navigate } from '../app/router';
import { useT } from '../app/i18n';
import type { Action } from '../engine/content';
import { telHref } from '../engine/clinics';
import { bouncy, ease, spring } from '../motion/presets';
import { haptic, isNative, openExternal, copyText } from '../platform/native';
import { IN_ARTIFACT } from '../platform/env';
import { cx } from './ui';

// ── Disclosure ────────────────────────────────────────────────────────────
export function Disclosure({ summary, children, defaultOpen = false, className, icon }: {
  summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cx('disclosure', open && 'disclosure-open', className)}>
      <button type="button" className="disclosure-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon && <span className="disclosure-icon" aria-hidden>{icon}</span>}
        <span className="disclosure-summary">{summary}</span>
        <motion.span className="disclosure-chev" animate={{ rotate: open ? 180 : 0 }} transition={spring} aria-hidden>
          <ChevronDown size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            className="disclosure-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: spring, opacity: { duration: 0.2, delay: 0.05 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.22, ease }, opacity: { duration: 0.12 } } }}
          >
            <div className="disclosure-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────
export function Segmented({ items, value, onChange, label, group }: {
  items: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string; group: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button key={it.id} type="button" role="tab" aria-selected={on} className={cx('seg', on && 'seg-on')}
            onClick={() => { if (!on) { haptic(6); onChange(it.id); } }}>
            {on && <motion.span layoutId={`seg-${group}`} className="seg-pill" transition={spring} />}
            <span className="seg-label">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Bottom sheet ──────────────────────────────────────────────────────────
export function Sheet({ open, onClose, title, children, labelledBy }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; labelledBy?: string;
}) {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  // Dragging starts only from the grip and header, so the body can scroll.
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => panel.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  const root = document.getElementById('sheet-root') || document.body;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-layer">
          <motion.div className="sheet-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div
            ref={panel}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.24, ease } }}
            transition={spring}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
          >
            <div className="sheet-handle" onPointerDown={(e) => controls.start(e)}>
              <div className="sheet-grip" aria-hidden />
              <div className="sheet-head">
                <div className="sheet-title">{title}</div>
                <button type="button" className="icon-btn sheet-close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label={t('common.close')}><X size={20} /></button>
              </div>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    root,
  );
}

// ── Toasts ────────────────────────────────────────────────────────────────
interface ToastMsg { id: number; text: string; tone: 'ok' | 'warn' | 'info' }
const useToasts = create<{ list: ToastMsg[]; push: (text: string, tone?: ToastMsg['tone']) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (text, tone = 'ok') => {
    const id = Date.now() + Math.random();
    set((s) => ({ list: [...s.list.slice(-2), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), 3200);
  },
  drop: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}));
export const toast = (text: string, tone?: ToastMsg['tone']) => useToasts.getState().push(text, tone);

export function Toasts() {
  const list = useToasts((s) => s.list);
  const drop = useToasts((s) => s.drop);
  return (
    <div className="toasts" aria-live="polite" role="status">
      <AnimatePresence>
        {list.map((m) => (
          <motion.button
            key={m.id}
            type="button"
            className={`toast toast-${m.tone}`}
            onClick={() => drop(m.id)}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={bouncy}
          >
            {m.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Count up ──────────────────────────────────────────────────────────────
export function CountUp({ to, decimals = 0, duration = 0.9, className }: { to: number; decimals?: number; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? to : 0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    if (reduce) { mv.set(to); return; }
    const c = animate(mv, to, { duration, ease });
    return () => c.stop();
  }, [to, duration, mv, reduce]);
  return <motion.span className={className}>{text}</motion.span>;
}

// ── Links out: web pages, phone numbers, email ────────────────────────────
// Every way out of the app is a real link, so it can be long-pressed, copied
// and read by a screen reader as a link. In the phone app it opens through the
// phone (system browser, dialer). In an embedded preview, where calls and
// email cannot open, it copies the number or address and shows it instead.
const isWeb = (href: string) => /^https?:/i.test(href);

function useLinkClick(href: string, value?: string) {
  const { t } = useT();
  return (e: MouseEvent<HTMLAnchorElement>) => {
    haptic(8);
    if (isNative()) {
      e.preventDefault();
      openExternal(href);
      return;
    }
    if (IN_ARTIFACT && /^(tel|mailto):/i.test(href)) {
      e.preventDefault();
      const email = href.startsWith('mailto:');
      const shown = value || href.replace(/^(tel|mailto):/i, '').split('?')[0];
      const done = () => toast(t(email ? 'common.copiedEmail' : 'common.copiedNumber', { value: shown }));
      const failed = () => toast(t(email ? 'common.writeEmail' : 'common.callNumber', { value: shown }));
      copyText(shown).then((ok) => (ok ? done() : failed()), failed);
    }
  };
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  /** What to show if the link cannot open here: the number as printed, or the address. */
  value?: string;
};

/** A plain text link out of the app. */
export function ExtLink({ href, value, className, children, onClick, ...rest }: LinkProps) {
  const click = useLinkClick(href, value);
  return (
    <a href={href} className={className} target={isWeb(href) ? '_blank' : undefined} rel={isWeb(href) ? 'noopener noreferrer' : undefined}
      onClick={(e) => { onClick?.(e); click(e); }} {...rest}>
      {children}
    </a>
  );
}

/** A link out of the app that looks like a button (Call, Directions, Call 911). */
export function LinkButton({ href, value, variant = 'primary', size = 'md', icon, iconRight, full, className, children, 'aria-label': ariaLabel }: {
  href: string; value?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode; iconRight?: ReactNode; full?: boolean; className?: string; children?: ReactNode; 'aria-label'?: string;
}) {
  const click = useLinkClick(href, value);
  return (
    <motion.a href={href} target={isWeb(href) ? '_blank' : undefined} rel={isWeb(href) ? 'noopener noreferrer' : undefined}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full', className)} aria-label={ariaLabel}
      whileTap={{ scale: 0.965 }} whileHover={{ y: -1 }} transition={spring} onClick={click}>
      {icon}
      {children !== undefined && <span className="btn-label">{children}</span>}
      {iconRight}
    </motion.a>
  );
}

// ── Action links: tel / url / email / in-app route ─────────────────────────
export function ActionButton({ action, label, variant = 'secondary', compact }: {
  action: Action; label?: string; variant?: 'primary' | 'secondary' | 'quiet'; compact?: boolean;
}) {
  const { tx, t } = useT();
  const text = label || tx(action.label) || action.value;
  const icon = action.type === 'tel' ? <Phone size={18} aria-hidden /> : action.type === 'email' ? <Mail size={18} aria-hidden />
    : action.type === 'route' ? <ArrowRight size={18} aria-hidden /> : <ArrowUpRight size={18} aria-hidden />;
  const href = action.type === 'tel' ? telHref(action.value) : action.type === 'email' ? `mailto:${action.value}` : action.value;
  const click = useLinkClick(href, action.value);
  const hint = action.type === 'url' ? t('common.opensBrowser') : action.type !== 'route' && action.value !== text ? action.value : undefined;
  const body = (
    <>
      <span className="action-icon">{icon}</span>
      <span className="action-text">
        <span className="action-label">{text}</span>
        {hint && !compact && <span className="action-hint">{hint}</span>}
      </span>
    </>
  );
  const cls = cx('action', `action-${variant}`, compact && 'action-compact');
  if (action.type === 'route') {
    return (
      <motion.button type="button" className={cls} onClick={() => { haptic(8); navigate(action.value); }} whileTap={{ scale: 0.97 }} transition={spring} aria-label={text}>
        {body}
      </motion.button>
    );
  }
  return (
    <motion.a href={href} className={cls} target={isWeb(href) ? '_blank' : undefined} rel={isWeb(href) ? 'noopener noreferrer' : undefined}
      onClick={click} whileTap={{ scale: 0.97 }} transition={spring} aria-label={hint ? `${text}. ${hint}` : text}>
      {body}
    </motion.a>
  );
}

// ── Progress bar for the check ────────────────────────────────────────────
export function Progress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={label}>
      <div className="progress-track">
        <motion.div className="progress-fill" initial={false} animate={{ scaleX: step / total }} transition={spring} />
      </div>
      <div className="progress-dots" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <motion.span key={i} className={cx('progress-dot', i < step && 'on')} animate={{ scale: i === step - 1 ? 1.25 : 1 }} transition={bouncy} />
        ))}
      </div>
    </div>
  );
}

// ── Stepper with rolling digits ───────────────────────────────────────────
export function Stepper({ value, onChange, min = 0, max = 80, label, unit, decLabel, incLabel }: {
  value: number | null; onChange: (n: number) => void; min?: number; max?: number; label: string; unit?: string; decLabel: string; incLabel: string;
}) {
  const v = value ?? 0;
  const [dir, setDir] = useState(1);
  const set = (n: number) => { setDir(n > v ? 1 : -1); haptic(6); onChange(Math.max(min, Math.min(max, n))); };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <motion.button type="button" className="stepper-btn" onClick={() => set(v - 1)} disabled={v <= min} aria-label={decLabel} whileTap={{ scale: 0.86 }}>
        <Minus size={22} aria-hidden />
      </motion.button>
      <div className="stepper-value" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span key={v} custom={dir}
            initial={{ y: dir * 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: dir * -18, opacity: 0 }} transition={spring}>
            {value === null ? '–' : v}
          </motion.span>
        </AnimatePresence>
        {unit && <small>{unit}</small>}
      </div>
      <motion.button type="button" className="stepper-btn" onClick={() => set(v + 1)} disabled={v >= max} aria-label={incLabel} whileTap={{ scale: 0.86 }}>
        <Plus size={22} aria-hidden />
      </motion.button>
    </div>
  );
}

// ── Quote in the source's own words ───────────────────────────────────────
export function SourceQuote({ quote, quoteEs, source, url }: { quote: string; quoteEs?: string; source: string; url: string }) {
  const { t, lang } = useT();
  const translated = lang === 'es' && !!quoteEs;
  return (
    <figure className="quote">
      <span className="quote-mark" aria-hidden>“</span>
      <blockquote lang={translated ? 'es' : 'en'}>{translated ? quoteEs : quote}</blockquote>
      <figcaption>
        <span>{t('common.sourceWords')}: </span>
        <ExtLink href={url} className="link">{source}</ExtLink>
        {translated && <em className="quote-note"> · {t('common.translated')}</em>}
      </figcaption>
      {translated && <p className="quote-original" lang="en">“{quote}”</p>}
    </figure>
  );
}

// ── Armed two-tap button (delete) with a countdown ring ───────────────────
export function TwoTap({ label, armedLabel, onConfirm, icon }: { label: string; armedLabel: string; onConfirm: () => void; icon?: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <motion.button
      type="button"
      className={cx('btn btn-md btn-full', armed ? 'btn-danger' : 'btn-quiet danger-text')}
      onClick={() => { haptic(armed ? 30 : 10); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
      animate={armed ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.38 }}
      whileTap={{ scale: 0.97 }}
    >
      {icon}
      <span className="btn-label">{armed ? armedLabel : label}</span>
      {armed && (
        <svg className="countdown" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
          <motion.circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            initial={{ pathLength: 1 }} animate={{ pathLength: 0 }} transition={{ duration: 5, ease: 'linear' }} style={{ rotate: -90, transformOrigin: 'center' }} />
        </svg>
      )}
    </motion.button>
  );
}
