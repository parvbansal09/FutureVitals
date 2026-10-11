import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CircleAlert, HandHelping, Info, Sparkles } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui';
import { Progress, toast } from '../../components/widgets';
import { useT } from '../../app/i18n';
import { goBack, navigate, useRoute } from '../../app/router';
import { useApp } from '../../state/store';
import { spring, stepVariants } from '../../motion/presets';
import { symptomsAnswered } from '../../engine/answers';
import { haptic } from '../../platform/native';
import { PNTS, type Answers } from '../../engine/types';
import { StepSymptoms } from './StepSymptoms';
import { StepAbout, StepFamily, StepHistory } from './StepsPeople';
import { StepSmoking, StepLife } from './StepsHabits';

/** What is still missing on a step, as a strings key, or null when it can continue. */
export function missingFor(step: number, a: Answers): string | null {
  switch (step) {
    case 1: return symptomsAnswered(a) ? null : 'check.missing.symptoms';
    case 2: return a.age === null ? 'check.missing.age' : a.sex === null ? 'check.missing.sex' : null;
    case 3:
      if (a.famCancers === null) return 'check.missing.family';
      if (Array.isArray(a.famCancers) && a.famCancers.length) {
        if (a.famClose === null) return 'check.missing.close';
        if (a.famYoung === null) return 'check.missing.young';
      }
      return null;
    case 4: return a.history === null ? 'check.missing.history' : a.hpv === null ? 'check.missing.hpv' : null;
    case 5:
      if (a.smoke === null) return 'check.missing.smoke';
      if (a.smoke === 'former' || a.smoke === 'current') {
        if (a.packsPerDay === null) return 'check.missing.packs';
        if (a.yearsSmoked === null) return 'check.missing.years';
        if (a.smoke === 'former' && a.quit === null) return 'check.missing.quit';
      }
      return null;
    case 6: return a.alcohol === null ? 'check.missing.alcohol' : a.activity === null ? 'check.missing.activity' : null;
    default: return null;
  }
}

const TITLES = ['check.s1.title', 'check.s2.title', 'check.s3.title', 'check.s4.title', 'check.s5.title', 'check.s6.title'];
const WHYS = ['check.s1.why', 'check.s2.why', 'check.s3.why', 'check.s4.why', 'check.s5.why', 'check.s6.why'];

export function CheckFlow({ step: raw }: { step: number }) {
  const step = Math.min(6, Math.max(1, raw || 1));
  const { t, th, helper } = useT();
  const { direction } = useRoute();
  const answers = useApp((s) => s.answers);
  const setStep = useApp((s) => s.setStep);
  const finishCheck = useApp((s) => s.finishCheck);
  const setHelper = useApp((s) => s.setHelper);
  const missing = missingFor(step, answers);
  // What is missing shows only after a try to continue, not before anything is tapped.
  const [tried, setTried] = useState(false);
  useEffect(() => setTried(false), [step]);

  useEffect(() => {
    setStep(step);
    const el = document.querySelector('[data-screen="check"]');
    el?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, setStep]);

  const next = () => {
    if (missing) {
      setTried(true);
      haptic(20);
      return;
    }
    if (step < 6) navigate(`/check/${step + 1}`);
    else {
      // Every step must be answered, not just this one: a link, or a check
      // picked up again later, can reach step 6 with an earlier step skipped,
      // and step 1 (symptoms) is the one a plan must never go without.
      const gap = [1, 2, 3, 4, 5].find((s) => missingFor(s, answers));
      if (gap) {
        toast(t('check.stepMissing', { n: gap }), 'warn');
        navigate(`/check/${gap}`);
        return;
      }
      finishCheck();
      navigate('/plan');
    }
  };

  const body = [<StepSymptoms key={1} />, <StepAbout key={2} />, <StepFamily key={3} />, <StepHistory key={4} />, <StepSmoking key={5} />, <StepLife key={6} />][step - 1];

  return (
    <Screen
      id="check"
      back="/"
      exit={{ label: t('check.exit'), hint: t('check.exitHint') }}
      tabPad={false}
      top={
        <div className="check-top">
          <div className="check-meta">
            <AnimatePresence mode="popLayout" initial={false}>
              {/* Seen once here; screen readers hear it from the progress bar. */}
              <motion.span key={step} className="step-of" aria-hidden initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={spring}>
                {t('check.stepOf', { n: step })}
              </motion.span>
            </AnimatePresence>
            {helper && (
              <button type="button" className="helper-chip" onClick={() => setHelper(false)} title={t('welcome.helperOff')}>
                <HandHelping size={16} aria-hidden /> {t('check.helperChip')}
              </button>
            )}
          </div>
          <Progress step={step} total={6} label={t('check.stepOf', { n: step })} />
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.section key={step} className="check-step" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" aria-labelledby={`step-title-${step}`}>
          <h1 className="step-title" id={`step-title-${step}`}>{th(TITLES[step - 1])}</h1>
          <p className="why"><Info size={18} aria-hidden /><span><strong>{t('check.whyWeAsk')}: </strong>{th(WHYS[step - 1])}</span></p>
          {body}
        </motion.section>
      </AnimatePresence>

      <div className="check-footer">
        <AnimatePresence>
          {missing && tried && (
            <motion.p className="missing" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={spring}>
              <CircleAlert size={16} aria-hidden /> {t(missing)}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="check-buttons">
          <Button variant="secondary" icon={<ArrowLeft size={20} aria-hidden />} onClick={() => goBack('/')} aria-label={t('common.back')}>
            {t('common.back')}
          </Button>
          <Button
            variant="primary"
            onClick={next}
            shine={step === 6 && !missing}
            iconRight={step === 6 ? <Sparkles size={20} aria-hidden /> : <ArrowRight size={20} aria-hidden />}
          >
            {step === 6 ? t('check.buildPlan') : t('common.continue')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}

export const pntsOpt = (t: (k: string) => string) => ({ id: PNTS, label: t('common.pnts'), exclusive: true, quiet: true });
