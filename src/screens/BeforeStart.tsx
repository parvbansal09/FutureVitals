import { motion } from 'motion/react';
import { ArrowRight, BookOpen, HandHelping, ShieldCheck, Stethoscope, User } from 'lucide-react';
import { Screen } from '../components/Screen';
import { Button, Item, Stagger, cx } from '../components/ui';
import { useT } from '../app/i18n';
import { navigate } from '../app/router';
import { useApp } from '../state/store';
import { bouncy, pop, rise, spring } from '../motion/presets';

export function BeforeStart() {
  const { t } = useT();
  const helper = useApp((s) => s.helper);
  const setHelper = useApp((s) => s.setHelper);
  const markIntroSeen = useApp((s) => s.markIntroSeen);

  const points = [
    { icon: <Stethoscope size={26} />, title: t('start.notDiagnosisTitle'), body: t('start.notDiagnosisBody') },
    { icon: <BookOpen size={26} />, title: t('start.guidelinesTitle'), body: t('start.guidelinesBody') },
    { icon: <ShieldCheck size={26} />, title: t('start.phoneTitle'), body: t('start.phoneBody') },
  ];

  const begin = () => {
    markIntroSeen();
    navigate('/check/1', { replace: true });
  };

  return (
    <Screen id="start" title={t('start.title')} back="/" tabPad={false}>
      <Stagger className="stack" step={0.09} delay={0.12}>
        {points.map((p, i) => (
          <Item key={i} className="promise">
            <motion.span className="promise-icon" aria-hidden initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...bouncy, delay: 0.2 + i * 0.12 }}>
              {p.icon}
            </motion.span>
            <div>
              <h2 className="promise-title">{p.title}</h2>
              <p className="promise-body">{p.body}</p>
            </div>
          </Item>
        ))}

        <Item variants={rise}>
          <fieldset className="who">
            <legend className="question-title">{t('start.whoTitle')}</legend>
            <div className="who-toggle" role="radiogroup" aria-label={t('start.whoTitle')}>
              {[{ on: !helper, set: false, icon: <User size={22} />, label: t('start.self') }, { on: helper, set: true, icon: <HandHelping size={22} />, label: t('start.helper') }].map((o) => (
                <button key={String(o.set)} type="button" role="radio" aria-checked={o.on} className={cx('who-opt', o.on && 'who-on')} onClick={() => setHelper(o.set)}>
                  {o.on && <motion.span layoutId="who-pill" className="who-pill" transition={spring} />}
                  <span className="who-icon" aria-hidden>{o.icon}</span>
                  <span className="who-label">{o.label}</span>
                </button>
              ))}
            </div>
            <motion.p className="question-note" initial={false} animate={{ opacity: helper ? 1 : 0, height: helper ? 'auto' : 0 }} transition={spring} aria-hidden={!helper}>
              {t('start.helperBody')}
            </motion.p>
          </fieldset>
        </Item>

        <Item variants={pop} className="sticky-cta">
          <Button size="lg" full shine onClick={begin} iconRight={<ArrowRight size={22} aria-hidden />}>{t('start.begin')}</Button>
        </Item>
      </Stagger>
    </Screen>
  );
}
