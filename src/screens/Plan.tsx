import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, BookmarkCheck, CalendarClock, ClipboardList, Dna, ExternalLink, HandHelping, MapPin, MessageCircleQuestion,
  Pencil, Phone, Printer, RotateCcw, Scale, Share2, Siren, Sparkles, Stethoscope, Trash, TriangleAlert, Users,
} from 'lucide-react';
import { Screen } from '../components/Screen';
import { PlanTabs, EmptyState } from '../components/PlanBits';
import { Badge, Banner, Button, Card, Item, SectionTitle, Stagger, cx } from '../components/ui';
import { Disclosure, ExtLink, LinkButton, toast, TwoTap } from '../components/widgets';
import { useT } from '../app/i18n';
import { navigate, useRoute } from '../app/router';
import { useSecondPass } from '../app/progressive';
import { useApp } from '../state/store';
import { questionLabel, saidText, stepOf, usePlan, useReady } from '../app/derived';
import { check, screening, compare as compareContent } from '../engine/content';
import type { PlanItem, Plan } from '../engine/plan';
import { formatDate } from '../engine/format';
import { bouncy, pop, rise, stagger } from '../motion/presets';
import { canPrint, shareText } from '../platform/native';
import { onIdle } from '../platform/idle';
import { startCheck } from './Welcome';
import type { Lang } from '../engine/types';

function GuidelineChip({ k }: { k: string }) {
  const g = screening.guidelines[k];
  if (!g) return null;
  return (
    <ExtLink href={g.url} className="guide-chip" aria-label={`${g.org}, ${g.year}`}>
      <BookmarkCheck size={14} aria-hidden /> {g.short} {g.year} <ExternalLink size={12} aria-hidden />
    </ExtLink>
  );
}

function PlanItemCard({ item }: { item: PlanItem }) {
  const { t, tx } = useT();
  const def = screening.items[item.cancer];
  const asks = item.asks.flatMap((k) => def.asks[k] || []).slice(0, 3);
  const options = item.options ? def.options[item.options] || [] : [];
  const badge = item.section === 'now' ? <Badge tone="accent" icon={<Stethoscope size={14} aria-hidden />}>{t('plan.now')}</Badge>
    : item.section === 'yourCall' ? <Badge tone="quiet" icon={<Scale size={14} aria-hidden />}>{t('plan.yourCall')}</Badge>
      : <Badge tone="default" icon={<CalendarClock size={14} aria-hidden />}>{t('plan.atAge', { age: item.dueAge ?? '' })}</Badge>;

  return (
    <Card className={cx('plan-item', `plan-${item.section}`)} variants={rise} layout>
      <div className="plan-item-head">
        <h3>{tx(def.name)}</h3>
        {badge}
      </div>
      {item.conditional && <p className="conditional">{t('plan.ifApplies')}</p>}
      <div className="plan-why">
        <p className="mini-label">{t('plan.why')}</p>
        {item.why.map((w) => <p key={w}>{tx(def.why[w])}</p>)}
      </div>
      {options.length > 0 && (
        <div className="plan-options">
          <p className="mini-label">{t('plan.options')}</p>
          <ul>{options.map((o, i) => <li key={i}>{tx(o)}</li>)}</ul>
        </div>
      )}
      {item.sides && def.sides && (
        <div className="sides">
          <div className="side side-for"><p className="mini-label">{t('plan.forSide')}</p><p>{tx(def.sides.for)}</p></div>
          <div className="side side-against"><p className="mini-label">{t('plan.againstSide')}</p><p>{tx(def.sides.against)}</p></div>
        </div>
      )}
      {asks.length > 0 && (
        <Disclosure summary={t('plan.asks')} icon={<MessageCircleQuestion size={18} />} defaultOpen={item.section === 'now'}>
          <ol className="asks">{asks.map((a, i) => <li key={i}>{tx(a)}</li>)}</ol>
        </Disclosure>
      )}
      <div className="plan-item-foot">
        <span className="mini-label">{t('plan.guideline')}</span>
        <GuidelineChip k={item.guideline} />
        {item.altGuideline && <GuidelineChip k={item.altGuideline} />}
        {item.test && (
          <Button variant="ghost" size="sm" icon={<MapPin size={16} aria-hidden />} onClick={() => navigate(`/clinics?test=${item.test}`)}>
            {t('clinics.title')}
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * The print copy is built once the plan is on screen, so it never slows the
 * tap that opens the plan, or at once if printing starts before that.
 */
function usePrintReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const now = () => flushSync(() => setReady(true));
    window.addEventListener('beforeprint', now);
    const cancel = onIdle(() => setReady(true));
    return () => {
      window.removeEventListener('beforeprint', now);
      cancel();
    };
  }, []);
  return ready;
}

/** The one-page print version: plan items and questions only, never the answers behind them. */
function PrintSummary({ plan, lang }: { plan: Plan; lang: Lang }) {
  const { t, tx } = useT();
  const items = [...plan.now, ...plan.yourCall, ...plan.next];
  const sym = [...plan.emergency.map((id) => check.emergencies.find((o) => o.id === id)?.[lang]), ...plan.symptoms.map((id) => check.symptoms.find((o) => o.id === id)?.[lang])].filter(Boolean);
  // Rendered straight into <body> so the print stylesheet can show this and
  // hide everything else, whatever the screen's scroll and transforms are.
  return createPortal(
    <section className="print-only" aria-hidden>
      <h1>{t('plan.printTitle')}</h1>
      <p className="print-meta">{t('plan.printMade', { date: formatDate(new Date().toISOString(), lang) })}</p>
      {sym.length > 0 && (
        <div className="print-block">
          <h2>{t('plan.checked')}</h2>
          <ul>{sym.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {items.map((item) => {
        const def = screening.items[item.cancer];
        const asks = item.asks.flatMap((k) => def.asks[k] || []).slice(0, 3);
        const g = screening.guidelines[item.guideline];
        return (
          <div key={item.cancer} className="print-block">
            <h2>{tx(def.name)} <small>({item.section === 'now' ? t('plan.now') : item.section === 'yourCall' ? t('plan.yourCall') : t('plan.atAge', { age: item.dueAge ?? '' })} · {g.short} {g.year})</small></h2>
            <ul>{asks.map((a, i) => <li key={i}>{tx(a)}</li>)}</ul>
          </div>
        );
      })}
      {plan.context.genetic && <div className="print-block"><h2>{t('plan.geneticTitle')}</h2></div>}
      <p className="print-meta">{t('plan.printHelp')}</p>
      <p className="print-meta">{t('plan.disclaimer')}</p>
    </section>,
    document.body,
  );
}

function planAsText(plan: Plan, lang: Lang, t: (k: string, v?: Record<string, string | number>) => string): string {
  // The same as the printed page, in the same order: call-911 signs first.
  const lines = [t('plan.printTitle'), ''];
  for (const id of plan.emergency) lines.push(`• ${t('check.s1.call911Title')}: ${check.emergencies.find((o) => o.id === id)?.[lang]}`);
  for (const id of plan.symptoms) lines.push(`• ${t('plan.checked')}: ${check.symptoms.find((o) => o.id === id)?.[lang]}`);
  for (const item of [...plan.now, ...plan.yourCall, ...plan.next]) {
    const def = screening.items[item.cancer];
    lines.push('', def.name[lang]);
    for (const a of item.asks.flatMap((k) => def.asks[k] || []).slice(0, 3)) lines.push(`  – ${a[lang]}`);
  }
  if (plan.context.genetic) lines.push('', t('plan.geneticTitle'));
  lines.push('', t('plan.printHelp'), t('plan.disclaimer'));
  return lines.join('\n');
}

export function PlanScreen() {
  const { t, th, lang, tx, helper } = useT();
  const plan = usePlan();
  const ready = useReady();
  const checkDone = useApp((s) => s.checkDone);
  const planUpdated = useApp((s) => s.planUpdated);
  const deletePlan = useApp((s) => s.deletePlan);
  const setHelper = useApp((s) => s.setHelper);
  const printReady = usePrintReady();
  // What to raise now paints first; the rest follows a frame later.
  const { direction } = useRoute();
  const rest = useSecondPass(direction === -1);

  if (!ready) {
    return (
      <Screen id="plan" title={t('plan.title')} top={<PlanTabs />}>
        <EmptyState icon={<ClipboardList size={44} />} title={t('plan.emptyTitle')} body={t('plan.emptyBody')}
          action={<Button size="lg" shine onClick={startCheck} iconRight={<ArrowRight size={20} aria-hidden />}>{t('welcome.start')}</Button>} />
      </Screen>
    );
  }

  const hasSymptoms = plan.symptoms.length > 0 || plan.emergency.length > 0;
  const findHref = plan.tests.length ? `/clinics?test=${plan.tests.join(',')}` : '/clinics';

  const onShare = async () => {
    const r = await shareText(t('plan.shareText'), planAsText(plan, lang, t));
    if (r === 'copied') toast(t('common.copied'));
    else if (r === 'failed') toast(t('plan.shareFailed'), 'warn');
  };

  return (
    <Screen
      id="plan"
      title={t('plan.title')}
      lead={<>{th('plan.lead')}{planUpdated && checkDone && <span className="updated"> {t('plan.updated', { date: formatDate(planUpdated, lang) })}</span>}</>}
      top={<PlanTabs />}
    >
      {printReady && <PrintSummary plan={plan} lang={lang} />}

      <Stagger className="plan-sections" step={0.06}>
        {/* Answers can come from the risk calculator or a check left part way:
            say so, so a partial plan is never read as a full one. */}
        {!checkDone && (
          <Item>
            <Banner tone="warn" icon={<ClipboardList size={20} />} title={t('plan.unfinishedTitle')}
              action={<Button size="sm" variant="primary" onClick={startCheck} iconRight={<ArrowRight size={16} aria-hidden />}>{t('plan.unfinishedAction')}</Button>}>
              {th('plan.unfinishedBody')}
            </Banner>
          </Item>
        )}
        {/* 1. Get this checked. Always first, never below the fold. */}
        {hasSymptoms && (
          <Item className="plan-section">
            <SectionTitle title={t('plan.checked')} lead={t('plan.checkedLead')} icon={<TriangleAlert size={20} />} tone="warn" />
            {plan.emergency.length > 0 && (
              <Card tone="danger" className="emergency-card" variants={pop}>
                <span className="pulse-ring" aria-hidden><Siren size={24} /></span>
                <div>
                  <p className="alert-title">{t('check.s1.call911Title')}</p>
                  <ul className="plain">{plan.emergency.map((id) => <li key={id}>{check.emergencies.find((o) => o.id === id)?.[lang]}</li>)}</ul>
                  <LinkButton href={'tel:911'} value="911" variant="danger" icon={<Phone size={20} aria-hidden />}>{t('check.s1.call911')}</LinkButton>
                </div>
              </Card>
            )}
            <motion.div className="stack" variants={stagger(0.06)}>
              {plan.symptoms.map((id) => {
                const info = screening.symptoms[id];
                return (
                  <Card key={id} tone="warn" variants={rise} className="symptom-card">
                    <h3>{check.symptoms.find((o) => o.id === id)?.[lang]}</h3>
                    <p className="mini-label">{t('plan.whatItMeans')}</p>
                    <p>{tx(info?.what)}</p>
                    <p className="mini-label">{t('plan.whatToDo')}</p>
                    <p><strong>{tx(info?.do)}</strong></p>
                  </Card>
                );
              })}
            </motion.div>
            <Card tone="quiet" className="call911-note">
              <p className="mini-label"><Siren size={14} aria-hidden /> {t('plan.call911Title')}</p>
              <p>{t('plan.call911Body')}</p>
            </Card>
            <Button full icon={<MapPin size={20} aria-hidden />} onClick={() => navigate('/clinics')}>{t('plan.findClinic')}</Button>
          </Item>
        )}

        {/* 2. Raise now */}
        <Item className="plan-section">
          <SectionTitle title={t('plan.now')} lead={t('plan.nowLead')} icon={<Stethoscope size={20} />} count={plan.now.length} />
          {plan.now.length ? (
            <motion.div className="stack" variants={stagger(0.07)}>{plan.now.map((i) => <PlanItemCard key={i.cancer} item={i} />)}</motion.div>
          ) : <p className="muted">{t('plan.nothingNow')}</p>}
        </Item>

        {rest && <>
        {/* 3. Your call */}
        {plan.yourCall.length > 0 && (
          <Item className="plan-section">
            <SectionTitle title={t('plan.yourCall')} lead={t('plan.yourCallLead')} icon={<Scale size={20} />} count={plan.yourCall.length} />
            <motion.div className="stack" variants={stagger(0.07)}>{plan.yourCall.map((i) => <PlanItemCard key={i.cancer} item={i} />)}</motion.div>
          </Item>
        )}

        {/* 4. For your next visit */}
        {plan.next.length > 0 && (
          <Item className="plan-section">
            <SectionTitle title={t('plan.next')} lead={t('plan.nextLead')} icon={<CalendarClock size={20} />} count={plan.next.length} />
            <motion.div className="stack" variants={stagger(0.07)}>{plan.next.map((i) => <PlanItemCard key={i.cancer} item={i} />)}</motion.div>
          </Item>
        )}

        {/* 5. Context for your clinician */}
        {(plan.context.family.length > 0 || plan.context.history.length > 0 || plan.context.genetic) && (
          <Item className="plan-section">
            <SectionTitle title={t('plan.context')} lead={t('plan.contextLead')} icon={<Users size={20} />} />
            <Card className="context-card">
              {plan.context.family.length > 0 && (
                <>
                  <p className="mini-label">{t('plan.familyTitle')}</p>
                  <div className="chips-row">{plan.context.family.map((f) => <span key={f} className="chip chip-static">{check.familyCancers.find((o) => o.id === f)?.[lang]}</span>)}</div>
                  {plan.context.close && <p>{t('plan.closeYes')}</p>}
                  {plan.context.young && <p>{t('plan.youngYes')}</p>}
                </>
              )}
              {plan.context.history.length > 0 && (
                <>
                  <p className="mini-label">{t('plan.historyTitle')}</p>
                  <ul className="plain">{plan.context.history.map((h) => <li key={h}>{check.history.find((o) => o.id === h)?.[lang]}</li>)}</ul>
                </>
              )}
            </Card>
            {plan.context.genetic && (
              <Card tone="accent" className="genetic-card" variants={pop}>
                <motion.span className="genetic-icon" aria-hidden animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}><Dna size={26} /></motion.span>
                <div>
                  <p className="alert-title">{t('plan.geneticTitle')}</p>
                  <p>{t('plan.geneticBody')}</p>
                  <div className="genetic-links">
                    <ExtLink href={screening.guidelines.brca.url} className="link link-target">{screening.guidelines.brca.short} {screening.guidelines.brca.year}</ExtLink>
                  </div>
                </div>
              </Card>
            )}
          </Item>
        )}

        {/* 6. What you can change */}
        <Item className="plan-section">
          <SectionTitle title={t('plan.change')} lead={t('plan.changeLead')} icon={<Sparkles size={20} />} />
          {plan.levers.length + plan.tried.length === 0 ? <p className="muted">{t('plan.noLevers')}</p> : (
            <motion.div className="stack" variants={stagger(0.07)}>
              {[...plan.levers, ...plan.tried].map((row) => {
                const def = compareContent.rows.find((r) => r.id === row.id)!;
                const tried = plan.tried.includes(row);
                return (
                  <Card key={row.id} interactive variants={rise} className="lever" onClick={() => navigate('/compare')} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/compare'); }}>
                    <div className="lever-head">
                      <h3>{tx(def.title)}</h3>
                      {tried && <Badge tone="ok">{t('plan.trying')}</Badge>}
                    </div>
                    <p className="lever-said">{saidText(row.said, t, lang)}</p>
                    <p className="lever-step"><ArrowRight size={16} aria-hidden /> {tx(def.firstStep.text)}</p>
                  </Card>
                );
              })}
            </motion.div>
          )}
          <Button variant="ghost" onClick={() => navigate('/compare')} iconRight={<ArrowRight size={18} aria-hidden />}>{t('plan.seeCompare')}</Button>
        </Item>

        {/* 7. Not answered */}
        {plan.notAnswered.length > 0 && (
          <Item className="plan-section">
            <SectionTitle title={t('plan.notAnswered')} lead={t('plan.notAnsweredLead')} icon={<MessageCircleQuestion size={20} />} />
            <div className="chips-row">
              {plan.notAnswered.map((q) => (
                <motion.button key={q} type="button" className="chip chip-dashed" whileTap={{ scale: 0.95 }} transition={bouncy}
                  onClick={() => navigate(`/check/${stepOf(q)}`)} aria-label={`${questionLabel(q, t)}. ${t('plan.edit')}`}>
                  <Pencil size={13} aria-hidden /> {questionLabel(q, t)}
                </motion.button>
              ))}
            </div>
          </Item>
        )}

        {/* Actions */}
        <Item className="plan-actions">
          {helper && (
            <Card tone="accent" className="helper-card">
              <p><HandHelping size={18} aria-hidden /> {t('plan.clearNextNote')}</p>
              <Button full shine icon={<RotateCcw size={20} aria-hidden />} onClick={() => { deletePlan(); setHelper(true); navigate('/check/1', { replace: true }); }}>
                {t('plan.clearNext')}
              </Button>
            </Card>
          )}
          <div className="action-grid">
            {canPrint() && <Button variant="secondary" icon={<Printer size={20} aria-hidden />} onClick={() => window.print()}>{t('common.print')}</Button>}
            <Button variant="secondary" icon={<Share2 size={20} aria-hidden />} onClick={onShare}>{t('common.share')}</Button>
          </div>
          <Button full icon={<MapPin size={20} aria-hidden />} onClick={() => navigate(findHref)}>{t('plan.findClinic')}</Button>
          <Button full variant="secondary" icon={<RotateCcw size={20} aria-hidden />} onClick={() => navigate('/check/1')}>{t('plan.retake')}</Button>
          <TwoTap label={t('plan.delete')} armedLabel={t('plan.deleteArmed')} icon={<Trash size={18} aria-hidden />}
            onConfirm={() => { deletePlan(); toast(t('plan.deleted')); navigate('/', { replace: true }); }} />
          <p className="small muted">{t('plan.disclaimer')}</p>
        </Item>
        </>}
      </Stagger>
    </Screen>
  );
}
