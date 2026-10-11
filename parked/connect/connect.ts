// Connect block order. A flagged symptom puts "Make an appointment"
// first; a screening that is due moves the screening block up, with that
// program's own link first; a current smoker sees prevention services next.
import { massey, type ConnectBlock } from './content';
import type { Plan } from './plan';

export interface OrderedBlock {
  block: ConnectBlock;
  suggested: boolean;
}

const TEST_TO_ACTION: Record<string, string> = {
  mammogram: 'breast', fit: 'colorectal', colonoscopy: 'colorectal', ldct: 'lung', pap: 'cervical', skin: 'skin',
};

export function orderConnect(plan: Plan | null, currentSmoker: boolean): OrderedBlock[] {
  const blocks = massey.blocks.map((b) => ({ ...b, actions: [...b.actions] }));
  const score = new Map<string, number>(blocks.map((b, i) => [b.id, i]));
  const suggested = new Set<string>();

  if (plan) {
    const symptom = plan.symptoms.length > 0 || plan.emergency.length > 0;
    const due = plan.now.length + plan.yourCall.length > 0;
    if (symptom) { score.set('appointment', -30); suggested.add('appointment'); }
    if (due) {
      score.set('screening', symptom ? -20 : -30);
      suggested.add('screening');
      // The screening block leads with the programs this person is due for.
      const wanted = new Set(plan.tests.map((t) => TEST_TO_ACTION[t]).filter(Boolean));
      if (plan.yourCall.some((i) => i.cancer === 'prostate')) wanted.add('prostate');
      const sb = blocks.find((b) => b.id === 'screening');
      if (sb) sb.actions.sort((x, y) => Number(wanted.has(y.id || '')) - Number(wanted.has(x.id || '')));
    }
  }
  if (currentSmoker) {
    score.set('prevention', -10);
    suggested.add('prevention');
    const pb = blocks.find((b) => b.id === 'prevention');
    if (pb) pb.actions.sort((x, y) => Number(['quit', 'quitline', 'quitlineEs'].includes(y.id || '')) - Number(['quit', 'quitline', 'quitlineEs'].includes(x.id || '')));
  }

  return blocks
    .sort((a, b) => (score.get(a.id) ?? 0) - (score.get(b.id) ?? 0))
    .map((block) => ({ block, suggested: suggested.has(block.id) }));
}
