import { motion } from 'motion/react';
import { Calculator, ClipboardList, House, Leaf, MapPin, type LucideIcon } from 'lucide-react';
import { navigate, tabOf, useRoute, type TabKey } from '../app/router';
import { useT } from '../app/i18n';
import { useApp } from '../state/store';
import { bouncy, spring } from '../motion/presets';
import { haptic } from '../platform/native';

const TABS: { key: Exclude<TabKey, null>; path: string; icon: LucideIcon; label: string }[] = [
  { key: 'home', path: '/', icon: House, label: 'nav.home' },
  { key: 'plan', path: '/plan', icon: ClipboardList, label: 'nav.plan' },
  { key: 'risk', path: '/risk', icon: Calculator, label: 'nav.risk' },
  { key: 'clinics', path: '/clinics', icon: MapPin, label: 'nav.clinics' },
  { key: 'prevent', path: '/prevention', icon: Leaf, label: 'nav.prevent' },
];

export function TabBar() {
  const { route } = useRoute();
  const { t } = useT();
  const hasPlan = useApp((s) => s.checkDone);
  const active = tabOf(route.path);
  return (
    <motion.nav
      className="tabbar"
      aria-label={t('nav.main')}
      initial={{ y: 90 }}
      animate={{ y: 0 }}
      exit={{ y: 90 }}
      transition={spring}
    >
      {TABS.map(({ key, path, icon: I, label }) => {
        const on = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`tab ${on ? 'tab-on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              if (!on) { haptic(6); navigate(path); }
            }}
          >
            {on && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring} />}
            <motion.span className={`tab-icon tab-icon-${key}`} animate={on ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }} transition={bouncy}>
              <I size={23} strokeWidth={on ? 2.1 : 1.7} aria-hidden />
              {key === 'plan' && hasPlan && !on && <span className="tab-dot" aria-hidden />}
            </motion.span>
            <span className="tab-label">{t(label)}</span>
          </button>
        );
      })}
    </motion.nav>
  );
}
