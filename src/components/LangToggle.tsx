import { motion } from 'motion/react';
import { useApp } from '../state/store';
import { useT } from '../app/i18n';
import { spring } from '../motion/presets';

/** EN / ES switch. Applies instantly and is remembered on this phone. */
export function LangToggle() {
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const { t } = useT();
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
      aria-label={t('app.langSwitchLabel')}
      lang={lang === 'en' ? 'es' : 'en'}
    >
      <motion.span className="lang-thumb" layout transition={spring} style={{ left: lang === 'en' ? 3 : 'calc(50% + 1px)' }} aria-hidden />
      <span className={lang === 'en' ? 'on' : ''} aria-hidden>EN</span>
      <span className={lang === 'es' ? 'on' : ''} aria-hidden>ES</span>
    </button>
  );
}
