import { AnimatePresence, motion } from 'motion/react';
import { Phone, Siren, TriangleAlert } from 'lucide-react';
import { MultiChoice, Question } from '../../components/Options';
import { useT } from '../../app/i18n';
import { useApp } from '../../state/store';
import { check } from '../../engine/content';
import { bouncy, spring, stagger } from '../../motion/presets';
import { PNTS } from '../../engine/types';
import { LinkButton } from '../../components/widgets';

export function StepSymptoms() {
  const { t, th, lang } = useT();
  const a = useApp((s) => s.answers);
  const setAnswers = useApp((s) => s.setAnswers);
  const symptomsOn = Array.isArray(a.symptoms) && a.symptoms.length > 0;
  const emergencyOn = a.emergencies.length > 0;

  return (
    <motion.div className="questions" variants={stagger(0.06)} initial="hidden" animate="show">
      <Question title={<span className="danger-text"><Siren size={18} aria-hidden /> {t('check.s1.emergencyGroup')}</span>}>
        <MultiChoice
          label={t('check.s1.emergencyGroup')}
          options={check.emergencies.map((o) => ({ id: o.id, label: o[lang], tone: 'danger' as const }))}
          value={a.emergencies}
          onChange={(v) => {
            const list = Array.isArray(v) ? v : [];
            // An emergency sign contradicts "None of these", so that answer is cleared.
            setAnswers({ emergencies: list, symptoms: list.length && !Array.isArray(a.symptoms) ? [] : a.symptoms });
          }}
        />
      </Question>

      <AnimatePresence>
        {emergencyOn && (
          <motion.div className="alert-card alert-danger" role="alert"
            initial={{ opacity: 0, height: 0, scale: 0.96 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0 }} transition={spring}>
            <div className="alert-inner">
              <span className="pulse-ring" aria-hidden><Siren size={24} /></span>
              <div>
                <p className="alert-title">{t('check.s1.call911Title')}</p>
                <p>{t('check.s1.call911Body')}</p>
                <LinkButton href={'tel:911'} value="911" variant="danger" icon={<Phone size={20} aria-hidden />}>{t('check.s1.call911')}</LinkButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Question title={t('check.s1.symptomGroup')} note={t('check.pick.symptoms')}>
        <MultiChoice
          label={t('check.s1.symptomGroup')}
          options={[
            ...check.symptoms.map((o) => ({ id: o.id, label: o[lang] })),
            { id: 'none', label: t('common.none'), exclusive: true },
            { id: PNTS, label: t('common.pnts'), exclusive: true, quiet: true },
          ]}
          value={a.symptoms}
          onChange={(v) => {
            const exclusive = v === 'none' || v === PNTS;
            setAnswers({ symptoms: v as typeof a.symptoms, emergencies: exclusive ? [] : a.emergencies });
          }}
        />
      </Question>

      <AnimatePresence>
        {symptomsOn && (
          <motion.div className="alert-card alert-warn" role="status"
            initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring}>
            <div className="alert-inner">
              <motion.span className="alert-icon" initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: [0, -12, 10, -6, 0], scale: 1 }} transition={{ ...bouncy, rotate: { duration: 0.6 } }} aria-hidden>
                <TriangleAlert size={24} />
              </motion.span>
              <div>
                <p className="alert-title">{t('check.s1.amberTitle')}</p>
                <p>{th('check.s1.amberBody')}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
