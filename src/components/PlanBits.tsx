import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { navigate, useRoute } from '../app/router';
import { useT } from '../app/i18n';
import { usePlan, useReady } from '../app/derived';
import { Segmented } from './widgets';
import { Banner, Button } from './ui';
import { pop, rise, stagger } from '../motion/presets';

/** Plan · Risk · Compare. The three personal views of one set of answers. */
export function PlanTabs() {
  const { t } = useT();
  const { route } = useRoute();
  const value = route.path.slice(1) || 'plan';
  return (
    <div className="plan-tabs">
      <Segmented
        group="plan"
        label={t('nav.plan')}
        value={value}
        onChange={(id) => navigate(`/${id}`, { replace: true })}
        items={[
          { id: 'plan', label: t('plan.segPlan') },
          { id: 'compare', label: t('plan.segCompare') },
        ]}
      />
    </div>
  );
}

/** True when the answers flag a symptom or an emergency sign. */
export function useSymptomFlag(): 'none' | 'symptom' | 'emergency' {
  const plan = usePlan();
  const ready = useReady();
  if (!ready) return 'none';
  return plan.emergency.length ? 'emergency' : plan.symptoms.length ? 'symptom' : 'none';
}

/**
 * Symptom first: any screen that shows the plan opens with the appointment
 * instruction when a symptom was flagged.
 */
export function SymptomFirst() {
  const { t } = useT();
  const flag = useSymptomFlag();
  if (flag === 'none') return null;
  return (
    <Banner tone={flag === 'emergency' ? 'danger' : 'warn'} icon={<TriangleAlert size={20} />} title={t('plan.symptomFirstTitle')}
      action={<Button size="sm" variant="ghost" onClick={() => navigate('/plan')} iconRight={<ArrowRight size={16} aria-hidden />}>{t('plan.symptomFirstOpen')}</Button>}>
      {flag === 'emergency' ? t('plan.symptomFirst911') : t('plan.symptomFirstBody')}
    </Banner>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div className="empty" variants={stagger(0.08, 0.05)} initial="hidden" animate="show">
      <motion.div className="empty-icon" variants={pop} aria-hidden>{icon}</motion.div>
      <motion.h2 variants={rise}>{title}</motion.h2>
      <motion.p variants={rise}>{body}</motion.p>
      {action && <motion.div variants={rise}>{action}</motion.div>}
    </motion.div>
  );
}
