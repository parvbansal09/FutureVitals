import { AnimatePresence, motion } from 'motion/react';
import { Scale } from 'lucide-react';
import { Question, SingleChoice } from '../../components/Options';
import { CountUp, Stepper } from '../../components/widgets';
import { cx } from '../../components/ui';
import { useT } from '../../app/i18n';
import { useApp } from '../../state/store';
import { check } from '../../engine/content';
import { bmiBand, packYears } from '../../engine/answers';
import { bouncy, reveal, stagger } from '../../motion/presets';
import { PNTS, type Answers } from '../../engine/types';

const pnts = (t: (k: string) => string) => ({ id: PNTS, label: t('common.pnts'), quiet: true });
const QUICK_YEARS = [5, 10, 15, 20, 25, 30, 40];

export function StepSmoking() {
  const { t, th, lang } = useT();
  const a = useApp((s) => s.answers);
  const setAnswers = useApp((s) => s.setAnswers);
  const smoker = a.smoke === 'former' || a.smoke === 'current';
  const py = packYears(a);
  const yearsValue = typeof a.yearsSmoked === 'number' ? a.yearsSmoked : null;

  return (
    <motion.div className="questions" variants={stagger(0.07)} initial="hidden" animate="show">
      <Question title={th('check.s5.status')}>
        <SingleChoice label={th('check.s5.status')}
          options={[...check.smoke.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.smoke}
          onChange={(v) => {
            const s = v as Answers['smoke'];
            const keep = s === 'former' || s === 'current';
            setAnswers({ smoke: s, ...(keep ? {} : { packsPerDay: null, yearsSmoked: null, quit: null }), ...(s === 'current' ? { quit: null } : {}) });
          }} />
      </Question>

      <AnimatePresence>
        {smoker && (
          <motion.div key="amount" className="followups" variants={reveal} initial="hidden" animate="show" exit="hidden">
            <Question title={t('check.s5.packs')}>
              <SingleChoice columns={2} label={t('check.s5.packs')}
                options={[...check.packsPerDay.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
                value={a.packsPerDay === null ? null : a.packsPerDay === PNTS ? PNTS : String(a.packsPerDay)}
                onChange={(v) => setAnswers({ packsPerDay: v === PNTS ? PNTS : Number(v) })} />
            </Question>

            <Question title={t('check.s5.years')}>
              <div className="years">
                <Stepper value={yearsValue} min={0} max={80} label={t('check.s5.years')} unit={t('check.s5.yearsUnit')}
                  decLabel={t('check.s5.fewer')} incLabel={t('check.s5.more')}
                  onChange={(n) => setAnswers({ yearsSmoked: n })} />
                <div className="quick-chips" role="group" aria-label={t('check.s5.years')}>
                  {QUICK_YEARS.map((y) => (
                    <motion.button key={y} type="button" className={cx('chip', yearsValue === y && 'chip-on')} whileTap={{ scale: 0.92 }}
                      onClick={() => setAnswers({ yearsSmoked: y })} aria-pressed={yearsValue === y}>
                      {y}
                    </motion.button>
                  ))}
                  <button type="button" className={cx('chip chip-quiet', a.yearsSmoked === PNTS && 'chip-on')} aria-pressed={a.yearsSmoked === PNTS}
                    onClick={() => setAnswers({ yearsSmoked: a.yearsSmoked === PNTS ? null : PNTS })}>
                    {t('common.pnts')}
                  </button>
                </div>
              </div>
            </Question>

            {a.smoke === 'former' && (
              <Question title={th('check.s5.quit')}>
                <SingleChoice label={th('check.s5.quit')}
                  options={[...check.quitYears.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
                  value={a.quit} onChange={(v) => setAnswers({ quit: v as Answers['quit'] })} />
              </Question>
            )}

            <AnimatePresence>
              {py !== null && py > 0 && (
                <motion.div className="calc-card" initial={{ opacity: 0, scale: 0.92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={bouncy} aria-live="polite">
                  <p className="calc-big">
                    {t('check.s5.packYearsPre')}{' '}
                    <CountUp to={Math.round(py)} className="calc-num" />
                    {' '}{t('check.s5.packYearsPost')}
                  </p>
                  <p className="calc-note">{t('check.s5.packYearsNote')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const num = (s: string, max: number): number | null => {
  const d = s.replace(/\D/g, '').slice(0, 3);
  if (!d) return null;
  return Math.min(max, Number(d));
};

export function StepLife() {
  const { t, th, lang } = useT();
  const a = useApp((s) => s.answers);
  const setAnswers = useApp((s) => s.setAnswers);
  const band = bmiBand(a);
  const bandKey = band === 'under' ? 'bmiUnder' : band === 'healthy' ? 'bmiHealthy' : band === 'over' ? 'bmiOver' : band === 'obese' ? 'bmiObese' : null;
  const partial = !a.bodySkip && (a.heightFt !== null || a.weightLb !== null) && !band;

  const freq = (key: 'procMeat' | 'redMeat', title: string) => (
    <Question title={title}>
      <SingleChoice columns={1} label={title}
        options={[...check.frequency.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
        value={a[key]} onChange={(v) => setAnswers({ [key]: v } as Partial<Answers>)} />
    </Question>
  );

  return (
    <motion.div className="questions" variants={stagger(0.06)} initial="hidden" animate="show">
      <Question title={t('check.s6.alcohol')} note={t('check.s6.alcoholNote')}>
        <SingleChoice label={t('check.s6.alcohol')} options={[...check.alcohol.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.alcohol} onChange={(v) => setAnswers({ alcohol: v as Answers['alcohol'] })} />
      </Question>

      <Question title={t('check.s6.activity')} note={t('check.s6.activityNote')}>
        <SingleChoice label={t('check.s6.activity')} options={[...check.activity.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.activity} onChange={(v) => setAnswers({ activity: v as Answers['activity'] })} />
      </Question>

      <Question title={t('check.s6.body')} note={t('check.s6.bodyNote')}>
        <div className={cx('body-inputs', a.bodySkip && 'is-skipped')}>
          <label className="field">
            <span>{t('check.s6.feet')}</span>
            <input className="input" inputMode="numeric" maxLength={1} value={a.heightFt ?? ''} disabled={a.bodySkip}
              onChange={(e) => setAnswers({ heightFt: num(e.target.value, 8) })} />
          </label>
          <label className="field">
            <span>{t('check.s6.inches')}</span>
            <input className="input" inputMode="numeric" maxLength={2} value={a.heightIn ?? ''} disabled={a.bodySkip}
              onChange={(e) => setAnswers({ heightIn: num(e.target.value, 11) })} />
          </label>
          <label className="field">
            <span>{t('check.s6.pounds')}</span>
            <input className="input" inputMode="numeric" maxLength={3} value={a.weightLb ?? ''} disabled={a.bodySkip}
              onChange={(e) => setAnswers({ weightLb: num(e.target.value, 800) })} />
          </label>
        </div>
        <button type="button" className={cx('chip chip-quiet chip-wide', a.bodySkip && 'chip-on')} aria-pressed={a.bodySkip}
          onClick={() => setAnswers({ bodySkip: !a.bodySkip })}>
          {t('common.pnts')}
        </button>
        <AnimatePresence mode="popLayout">
          {bandKey && (
            <motion.p key={bandKey} className={cx('bmi-pill', `bmi-${band}`)} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={bouncy} aria-live="polite">
              <Scale size={18} aria-hidden /> {t(`check.s6.${bandKey}`)}
            </motion.p>
          )}
          {a.bodySkip && (
            <motion.p key="skip" className="field-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t('check.s6.bmiSkipped')}</motion.p>
          )}
          {partial && (
            <motion.p key="partial" className="field-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t('check.s6.bmiIncomplete')}</motion.p>
          )}
        </AnimatePresence>
      </Question>

      {freq('procMeat', t('check.s6.procMeat'))}
      {freq('redMeat', t('check.s6.redMeat'))}

      <Question title={t('check.s6.plants')}>
        <SingleChoice label={t('check.s6.plants')} options={[...check.plants.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.plants} onChange={(v) => setAnswers({ plants: v as Answers['plants'] })} />
      </Question>

      <Question title={t('check.s6.radon')}>
        <SingleChoice label={t('check.s6.radon')} options={[...check.radon.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.radon} onChange={(v) => setAnswers({ radon: v as Answers['radon'] })} />
      </Question>

      <Question title={t('check.s6.sun')}>
        <SingleChoice label={t('check.s6.sun')} options={[...check.sun.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.sun} onChange={(v) => setAnswers({ sun: v as Answers['sun'] })} />
      </Question>

      <p className="why subtle">{th('check.s6.why')}</p>
    </motion.div>
  );
}
