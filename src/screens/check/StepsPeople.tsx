import { AnimatePresence, motion } from 'motion/react';
import { MultiChoice, Question, SingleChoice } from '../../components/Options';
import { useT } from '../../app/i18n';
import { useApp } from '../../state/store';
import { check } from '../../engine/content';
import { reveal, stagger } from '../../motion/presets';
import { PNTS, type Answers, type YesNo } from '../../engine/types';

const pnts = (t: (k: string) => string) => ({ id: PNTS, label: t('common.pnts'), quiet: true });

export function StepAbout() {
  const { t, th, lang } = useT();
  const a = useApp((s) => s.answers);
  const setAnswers = useApp((s) => s.setAnswers);
  const ageLabel = (lo: number, hi: number) => (hi >= 120 ? (lang === 'es' ? `${lo} o más` : `${lo} or older`) : `${lo}–${hi}`);
  return (
    <motion.div className="questions" variants={stagger(0.07)} initial="hidden" animate="show">
      <Question title={th('check.s2.age')}>
        <SingleChoice compact columns={3} label={th('check.s2.age')}
          options={[...check.ages.map((b) => ({ id: b.id, label: ageLabel(b.lo, b.hi) })), pnts(t)]}
          value={a.age} onChange={(v) => setAnswers({ age: v })} />
      </Question>
      <Question title={th('check.s2.sex')}>
        <SingleChoice columns={1} label={th('check.s2.sex')}
          options={[...check.sexes.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.sex} onChange={(v) => setAnswers({ sex: v as Answers['sex'] })} />
      </Question>
      <Question title={th('check.s2.gender')} note={t('check.s2.genderNote')}>
        <SingleChoice columns={2} label={th('check.s2.gender')}
          options={[...check.genders.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.gender} onChange={(v) => setAnswers({ gender: a.gender === v ? null : v })} />
      </Question>
    </motion.div>
  );
}

export function StepFamily() {
  const { t, th, lang } = useT();
  const a = useApp((s) => s.answers);
  const setAnswers = useApp((s) => s.setAnswers);
  const named = Array.isArray(a.famCancers) && a.famCancers.length > 0;
  const yn = [...check.yesNo.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)];
  return (
    <motion.div className="questions" variants={stagger(0.07)} initial="hidden" animate="show">
      <Question title={t('check.s3.cancers')}>
        <MultiChoice label={th('check.s3.title')} columns={2}
          options={[
            ...check.familyCancers.map((o) => ({ id: o.id, label: o[lang] })),
            { id: 'none', label: t('check.s3.noHistory'), exclusive: true },
            { id: 'unsure', label: t('check.s3.unsure'), exclusive: true },
            { id: PNTS, label: t('common.pnts'), exclusive: true, quiet: true },
          ]}
          value={a.famCancers}
          onChange={(v) => {
            const list = Array.isArray(v) && v.length > 0;
            setAnswers({ famCancers: v as Answers['famCancers'], ...(list ? {} : { famClose: null, famYoung: null }) });
          }} />
      </Question>
      <AnimatePresence>
        {named && (
          <motion.div key="follow" className="followups" variants={reveal} initial="hidden" animate="show" exit="hidden">
            <Question title={t('check.s3.close')} note={t('check.s3.why')}>
              <SingleChoice columns={2} label={t('check.s3.close')} options={yn} value={a.famClose} onChange={(v) => setAnswers({ famClose: v as YesNo })} />
            </Question>
            <Question title={t('check.s3.young')}>
              <SingleChoice columns={2} label={t('check.s3.young')} options={yn} value={a.famYoung} onChange={(v) => setAnswers({ famYoung: v as YesNo })} />
            </Question>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function StepHistory() {
  const { t, th, lang } = useT();
  const a = useApp((s) => s.answers);
  const setAnswers = useApp((s) => s.setAnswers);
  return (
    <motion.div className="questions" variants={stagger(0.07)} initial="hidden" animate="show">
      <Question title={th('check.s4.history')}>
        <MultiChoice label={th('check.s4.history')}
          options={[
            ...check.history.map((o) => ({ id: o.id, label: o[lang] })),
            { id: 'none', label: t('common.none'), exclusive: true },
            { id: PNTS, label: t('common.pnts'), exclusive: true, quiet: true },
          ]}
          value={a.history} onChange={(v) => setAnswers({ history: v as Answers['history'] })} />
      </Question>
      <Question title={th('check.s4.hpv')}>
        <SingleChoice columns={2} label={th('check.s4.hpv')}
          options={[...check.hpvVaccine.map((o) => ({ id: o.id, label: o[lang] })), pnts(t)]}
          value={a.hpv} onChange={(v) => setAnswers({ hpv: v as Answers['hpv'] })} />
      </Question>
    </motion.div>
  );
}
