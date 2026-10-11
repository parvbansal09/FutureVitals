import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useApp } from '../state/store';
import { useT } from '../app/i18n';
import { haptic } from '../platform/native';
import { bouncy } from '../motion/presets';

const darkQuery = () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** Whether the screen is dark right now: the person's pick, or else the phone's (or the preview's) own. */
export function useIsDark(): boolean {
  const theme = useApp((s) => s.theme);
  const [system, setSystem] = useState(() => !!darkQuery()?.matches);
  useEffect(() => {
    const mq = darkQuery();
    if (!mq) return;
    const on = () => setSystem(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  if (theme !== 'system') return theme === 'dark';
  // In the claude.ai preview the viewer may have picked light or dark itself.
  const host = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
  return host ? host === 'dark' : system;
}

/**
 * Light or dark in one tap, from any screen. The pick is remembered on this
 * phone; Settings also offers "Same as phone". Colors fade across rather than
 * jump, unless the phone asks for less motion.
 */
export function ThemeToggle() {
  const { t } = useT();
  const dark = useIsDark();
  const setTheme = useApp((s) => s.setTheme);
  const label = t(dark ? 'app.themeToLight' : 'app.themeToDark');
  const toggle = () => {
    haptic(8);
    const root = document.documentElement;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-fade');
      window.setTimeout(() => root.classList.remove('theme-fade'), 450);
    }
    setTheme(dark ? 'light' : 'dark');
  };
  return (
    <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label={label} title={label}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={dark ? 'sun' : 'moon'} className="theme-icon" aria-hidden
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }} transition={bouncy}>
          {dark ? <Sun size={21} strokeWidth={1.9} /> : <Moon size={20} strokeWidth={1.9} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
