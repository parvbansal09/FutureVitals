import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ChevronLeft, ShieldCheck, X } from 'lucide-react';
import { goBack, navigate, useRoute } from '../app/router';
import { useT } from '../app/i18n';
import { LogoMark, Wordmark } from './Brand';
import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';
import { IconButton, Kicker, cx } from './ui';
import { rise, stagger } from '../motion/presets';

// Remembers where each screen was scrolled to, so going back lands where you left.
const scrollMemory = new Map<string, number>();

export interface ScreenProps {
  id: string;
  title?: ReactNode;
  kicker?: ReactNode;
  lead?: ReactNode;
  compactTitle?: string;
  back?: boolean | string;
  hero?: ReactNode;
  top?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  hideChrome?: boolean;
  tabPad?: boolean;
  /** Shows a thin bar under the header that fills as the reader scrolls. */
  readingProgress?: boolean;
  /**
   * The header button leaves for Home instead of going back, with this label
   * (the health check, whose own Back button walks the steps).
   */
  exit?: { label: string; hint: string };
}

export function Screen({ id, title, kicker, lead, compactTitle, back, hero, top, headerRight, children, className, hideChrome, tabPad = true, readingProgress, exit }: ScreenProps) {
  const { t } = useT();
  const { direction } = useRoute();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY, scrollYProgress } = useScroll({ container: ref });
  const compactOpacity = useTransform(scrollY, [30, 70], [0, 1]);
  const compactY = useTransform(scrollY, [30, 70], [6, 0]);
  const brandOpacity = useTransform(scrollY, [24, 60], [1, 0]);
  const shadow = useTransform(scrollY, [0, 12], ['0 0 0 0 rgba(0,0,0,0)', 'var(--shadow-1)']);
  const titleScale = useTransform(scrollY, [-80, 0], [1.06, 1]);

  useLayoutEffect(() => {
    // Going back returns to where the person was. A new screen already starts
    // at the top, and writing scrollTop anyway would force a layout mid-tap.
    const y = direction === -1 ? scrollMemory.get(id) ?? 0 : 0;
    if (y > 0 && ref.current) ref.current.scrollTop = y;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const save = () => scrollMemory.set(id, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [id]);

  const onBack = () => (typeof back === 'string' ? goBack(back) : goBack('/'));

  return (
    <div className={cx('screen', className)} ref={ref} data-screen={id}>
      {!hideChrome && (
        <motion.header className={cx('topbar', !back && 'topbar-root')} style={{ boxShadow: shadow }}>
          <div className="topbar-left">
            {exit ? (
              <motion.button type="button" className="back-btn" onClick={() => navigate('/')} whileTap={{ scale: 0.92 }} aria-label={exit.hint}>
                <X size={22} aria-hidden />
                <span>{exit.label}</span>
              </motion.button>
            ) : back ? (
              <motion.button type="button" className="back-btn" onClick={onBack} whileTap={{ scale: 0.92, x: -2 }}>
                <ChevronLeft size={24} aria-hidden />
                <span>{t('common.back')}</span>
              </motion.button>
            ) : (
              <button type="button" className="brand-btn" onClick={() => navigate('/')} aria-label={t('nav.home')}>
                <LogoMark size={28} detail={false} />
                {/* As the big title scrolls away, the screen's name takes the wordmark's place. */}
                <span className="brand-swap">
                  <motion.span style={{ opacity: brandOpacity }}><Wordmark /></motion.span>
                  <motion.span className="brand-compact" style={{ opacity: compactOpacity, y: compactY }} aria-hidden>
                    {compactTitle || (typeof title === 'string' ? title : '')}
                  </motion.span>
                </span>
              </button>
            )}
          </div>
          {back && !exit && (
            <motion.div className="topbar-title" style={{ opacity: compactOpacity, y: compactY }} aria-hidden>
              {compactTitle || (typeof title === 'string' ? title : '')}
            </motion.div>
          )}
          <div className="topbar-right">
            {headerRight}
            <LangToggle />
            <ThemeToggle />
            <IconButton label={t('app.privacyIcon')} onClick={() => navigate('/privacy')} className="shield-btn">
              <ShieldCheck size={22} strokeWidth={1.8} aria-hidden />
            </IconButton>
          </div>
          {readingProgress && <motion.div className="reading-progress" style={{ scaleX: scrollYProgress }} aria-hidden />}
        </motion.header>
      )}

      <main className={cx('screen-body', tabPad && 'tab-pad')} id="main" tabIndex={-1}>
        {hero}
        {(title || kicker || lead) && (
          <motion.div className="screen-head" variants={stagger(0.06, 0.02)} initial="hidden" animate="show" style={{ scale: titleScale, transformOrigin: 'left bottom' }}>
            {kicker && <motion.div variants={rise}><Kicker>{kicker}</Kicker></motion.div>}
            {title && <motion.h1 variants={rise} className="screen-title">{title}</motion.h1>}
            {lead && <motion.p variants={rise} className="screen-lead">{lead}</motion.p>}
          </motion.div>
        )}
        {top}
        {children}
      </main>
    </div>
  );
}
