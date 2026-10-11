import { Fragment, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, BookOpen, Calculator, ChevronDown, ClipboardList, Clock, HandHelping, Lock, MapPin, NotebookPen, Phone,
  ScanBarcode, Smartphone, TriangleAlert, type LucideIcon,
} from 'lucide-react';
import { useSymptomFlag } from '../components/PlanBits';
import { Screen } from '../components/Screen';
import { Ambient } from '../components/Brand';
import { Button, Card, Item, Stagger, cx } from '../components/ui';
import { useT } from '../app/i18n';
import { navigate } from '../app/router';
import { useApp } from '../state/store';
import { formatDate } from '../engine/format';
import { resolveZip } from '../engine/geo';
import { nearestScreening, telHref } from '../engine/clinics';
import { ease, pop, rise, stagger } from '../motion/presets';
import { ExtLink } from '../components/widgets';

/** Splits a headline into words that rise in one at a time behind a mask. */
function RevealWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <motion.h1 className={className} variants={stagger(0.07, 0.1)} initial="hidden" animate="show" aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i + w}>
          <span className="word-mask" aria-hidden>
            <motion.span
              className="word"
              variants={{ hidden: { y: '45%', opacity: 0 }, show: { y: '0%', opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } } }}
            >
              {w}
            </motion.span>
          </span>
          {/* The space sits between the masks: inside one it would collapse. */}
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </motion.h1>
  );
}

/** Shortcuts in the hero's spare space, to the tools a first visit would not find. */
const TOOLS: { id: string; path: string; icon: LucideIcon; tone: 'teal' | 'pink' }[] = [
  { id: 'risk', path: '/risk', icon: Calculator, tone: 'teal' },
  { id: 'scan', path: '/scan', icon: ScanBarcode, tone: 'pink' },
  { id: 'diary', path: '/food', icon: NotebookPen, tone: 'teal' },
  { id: 'learn', path: '/learn', icon: BookOpen, tone: 'pink' },
];

export function startCheck() {
  const { seenIntro, checkDone, step } = useApp.getState();
  if (!seenIntro) navigate('/start');
  else navigate(`/check/${checkDone ? 1 : Math.max(1, step)}`);
}

export function Welcome() {
  const { t, lang } = useT();
  const symptomFlag = useSymptomFlag();
  const checkDone = useApp((s) => s.checkDone);
  const planUpdated = useApp((s) => s.planUpdated);
  const step = useApp((s) => s.step);
  const answers = useApp((s) => s.answers);
  const helper = useApp((s) => s.helper);
  const setHelper = useApp((s) => s.setHelper);
  const zip = useApp((s) => s.zip);
  const setZip = useApp((s) => s.setZip);
  const [draft, setDraft] = useState(zip);

  const inProgress = !checkDone && (step > 1 || answers.symptoms !== null);
  const place = useMemo(() => resolveZip(zip), [zip]);
  const nearest = place.status === 'ok' ? nearestScreening(place.coords, 2) : [];

  const hero = (
    <section className="hero">
      <Ambient />
      <div className="hero-inner">
        <RevealWords text={t('welcome.headline')} className="hero-title" />
        <motion.p className="hero-desc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5, ease }}>
          {t('welcome.desc')}
        </motion.p>

        <Stagger className="hero-actions" step={0.07} delay={0.55}>
          {checkDone && planUpdated && (
            <Item variants={pop}>
              <Card tone="accent" interactive className="plan-card" onClick={() => navigate('/plan')} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/plan'); }}>
                <span className="plan-card-icon" aria-hidden><ClipboardList size={24} /></span>
                <span className="plan-card-text">
                  <strong>{t('welcome.planTitle')}</strong>
                  <span>{t('welcome.planUpdated', { date: formatDate(planUpdated, lang) })}</span>
                  {symptomFlag !== 'none' && (
                    <span className="plan-card-alert"><TriangleAlert size={15} aria-hidden /> {symptomFlag === 'emergency' ? t('plan.symptomFirst911') : t('plan.symptomFirstBody')}</span>
                  )}
                </span>
                <span className="plan-card-open">{t('welcome.planOpen')} <ArrowRight size={18} aria-hidden /></span>
              </Card>
            </Item>
          )}
          {helper && (
            <Item variants={rise}>
              <div className="helper-strip">
                <HandHelping size={20} aria-hidden />
                <span>{t('welcome.helperOn')}</span>
                <button type="button" className="link link-target" onClick={() => setHelper(false)}>{t('welcome.helperOff')}</button>
              </div>
            </Item>
          )}
          <Item variants={pop}>
            <Button size="lg" full shine onClick={startCheck} iconRight={<ArrowRight size={22} aria-hidden />}>
              {inProgress ? t('welcome.continueCheck') : t('welcome.start')}
            </Button>
          </Item>
        </Stagger>

        <motion.ul className="trust" variants={stagger(0.08, 0.9)} initial="hidden" animate="show">
          {[
            { icon: <Clock size={18} />, text: t('welcome.trustTime') },
            { icon: <Lock size={18} />, text: t('welcome.trustAccount') },
            { icon: <Smartphone size={18} />, text: t('welcome.trustPhone') },
          ].map((x, i) => (
            <motion.li key={i} variants={rise}>
              <span aria-hidden>{x.icon}</span>
              {x.text}
            </motion.li>
          ))}
        </motion.ul>

        <motion.section className="tools" aria-labelledby="tools-title" variants={stagger(0.07, 1.05)} initial="hidden" animate="show">
          <motion.h2 id="tools-title" className="tools-title" variants={rise}>{t('welcome.toolsTitle')}</motion.h2>
          <motion.div className="tools-row" variants={stagger(0.06)}>
            {TOOLS.map(({ id, path, icon: I, tone }) => (
              <motion.button key={id} type="button" className={cx('tool', `tool-${tone}`)} variants={pop}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }} onClick={() => navigate(path)}>
                <span className="tool-icon" aria-hidden><I size={22} /></span>
                <span className="tool-label">{t(`welcome.tools.${id}`)}</span>
              </motion.button>
            ))}
          </motion.div>
        </motion.section>

        <motion.div className="scroll-hint" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 1.4 }, y: { delay: 1.4, duration: 1.6, repeat: Infinity, ease: 'easeInOut' } }}>
          <ChevronDown size={20} />
        </motion.div>
      </div>
    </section>
  );

  return (
    <Screen id="home" hero={hero}>
      <Stagger className="stack home-below" inView>
        <Item>
          <Card className="nearest">
            <div className="nearest-head">
              <h2><MapPin size={20} aria-hidden /> {t('welcome.nearestTitle')}</h2>
              {place.status === 'ok' && (
                <span className="nearest-for muted">
                  {t('welcome.nearestFor', { place: zip })}
                  <button type="button" className="link link-target" onClick={() => { setZip(''); setDraft(''); }}>{t('welcome.changeZip')}</button>
                </span>
              )}
            </div>
            {nearest.length > 0 ? (
              <motion.ul className="nearest-list" variants={stagger(0.08)} initial="hidden" animate="show">
                {nearest.map(({ site, miles }) => (
                  <motion.li key={site.id} variants={rise} className="nearest-item">
                    <button type="button" className="nearest-main" onClick={() => navigate(`/clinics/${site.id}`)}>
                      <strong>{site.name}</strong>
                      <span>{site.address}, {site.city}</span>
                      {miles !== null && <span className="muted">{t('clinics.distance', { n: Math.max(1, Math.round(miles)) })}</span>}
                    </button>
                    <ExtLink className="round-call" href={telHref(site.phone)} value={site.phone}
                      aria-label={`${t('common.call')} ${site.name}, ${site.phone}`}>
                      <Phone size={20} aria-hidden />
                    </ExtLink>
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <form className="zip-inline" onSubmit={(e) => { e.preventDefault(); if (/^\d{5}$/.test(draft)) setZip(draft); }}>
                <p className="muted">{t('welcome.nearestNeedZip')}</p>
                <div className="zip-row">
                  <label className="sr-only" htmlFor="home-zip">{t('clinics.zipLabel')}</label>
                  <input id="home-zip" className={cx('input', place.status === 'invalid' && 'input-bad')} inputMode="numeric" autoComplete="postal-code"
                    maxLength={5} placeholder={t('clinics.zip')} value={draft}
                    onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 5))} />
                  <Button type="submit" variant="primary" disabled={draft.length !== 5}>{t('welcome.nearestShow')}</Button>
                </div>
                {zip && place.status === 'outside' && <p className="field-note warn-text">{t('clinics.outsideBody')}</p>}
                {zip && place.status === 'invalid' && <p className="field-note warn-text" role="status">{t('clinics.unknownZip')}</p>}
              </form>
            )}
            <Button variant="ghost" full onClick={() => navigate('/clinics')} iconRight={<ArrowRight size={18} aria-hidden />}>{t('welcome.nearestAll')}</Button>
          </Card>
        </Item>

        <Item><p className="disclaimer-line">{t('app.disclaimer')}</p></Item>
      </Stagger>
    </Screen>
  );
}
