// The risk score calculator. Scores: one card per cancer, each a multiple of
// average built from published relative risks, with every factor and its
// source. Change answers: the same factors as a form, saved as the person's
// answers, with a live strip of scores that moves as the answers change.
// "Try this change" on a card is the one what-if: shown as such, until kept.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useInView } from 'motion/react';
import {
  ArrowDown, ArrowRight, ArrowUp, Calculator, Check, ChevronDown, CircleSlash, Dna, Equal, ExternalLink, FlaskConical,
  Gauge, Hourglass, Info, Lightbulb, NotebookPen, RotateCcw, ShieldAlert, SlidersHorizontal, TriangleAlert, Utensils,
} from 'lucide-react';
import { Screen } from '../components/Screen';
import { EmptyState, SymptomFirst } from '../components/PlanBits';
import { Badge, Banner, Button, Card, Item, Stagger, VisuallyHidden, cx } from '../components/ui';
import { Disclosure, ExtLink, Segmented, toast } from '../components/widgets';
import { useT } from '../app/i18n';
import { navigate } from '../app/router';
import { useDiary, useReady, useRisk, useRiskFor } from '../app/derived';
import { risk as riskContent } from '../engine/content';
import { barPosition, type RiskCard } from '../engine/risk';
import { formatScore } from '../engine/format';
import type { Answers, Lang } from '../engine/types';
import { useApp } from '../state/store';
import { draftChanged, useCalc, useDraft } from '../state/calc';
import { bouncy, softSpring, spring, stagger, rise } from '../motion/presets';
import { startCheck } from './Welcome';
import { RiskCalculator } from './RiskCalculator';

type View = 'scores' | 'answers';
const setView = (v: View) => navigate(v === 'answers' ? '/risk?view=answers' : '/risk', { replace: true });

/** The score as it changes: the new value rolls in from the side it moved. */
function Score({ value, lang, className }: { value: number; lang: Lang; className?: string }) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 1 : -1;
  useEffect(() => { prev.current = value; }, [value]);
  return (
    <span className={cx('score', className)} aria-hidden>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} className="score-num" initial={{ y: dir * -14, opacity: 0, scale: 1.25 }}
          animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: dir * 14, opacity: 0 }} transition={bouncy}>
          {formatScore(value, lang)}
        </motion.span>
      </AnimatePresence>
      <span className="score-x">×</span>
    </span>
  );
}

function BandBar({ card }: { card: RiskCard }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true });
  const pos = card.multiple !== null ? barPosition(card.multiple) : 0;
  const avg = barPosition(1);
  return (
    <div className="bandbar" ref={ref} aria-hidden>
      <div className="bandbar-track">
        <motion.div className={cx('bandbar-fill', `band-${card.band}`)} initial={{ scaleX: 0 }} animate={{ scaleX: seen ? pos : 0 }} transition={{ ...softSpring, delay: 0.1 }} />
        <span className="bandbar-avg" style={{ left: `${avg * 100}%` }}>
          <span className="bandbar-avg-label">{t('risk.average')}</span>
        </span>
        <motion.span className={cx('bandbar-dot', `band-${card.band}`)} initial={{ left: '0%', scale: 0 }}
          animate={seen ? { left: `${pos * 100}%`, scale: 1 } : { left: '0%', scale: 0 }} transition={{ ...softSpring, delay: 0.1 }} />
      </div>
    </div>
  );
}

function FactorRow({ f, lang }: { f: RiskCard['factors'][number]; lang: Lang }) {
  const { t } = useT();
  const meta = riskContent.labels[lang][f.id] || { label: f.id, why: '' };
  const src = riskContent.sources[f.src];
  const dir = f.rr === null ? 'none' : f.rr > 1.005 ? 'up' : f.rr < 0.995 ? 'down' : 'flat';
  const pct = (rr: number) => (rr >= 2 ? `×${formatScore(rr, lang)}` : `${Math.round(Math.abs(rr - 1) * 100)}%`);
  return (
    <motion.li className={cx('factor', `factor-${dir}`)} variants={rise}>
      <span className="factor-icon" aria-hidden>
        {dir === 'up' ? <ArrowUp size={16} /> : dir === 'down' ? <ArrowDown size={16} /> : dir === 'flat' ? <Equal size={16} /> : <CircleSlash size={16} />}
      </span>
      <div className="factor-main">
        <p className="factor-top">
          <strong>{meta.label}</strong>
          <span className="factor-dir">
            {dir === 'up' ? `${t('risk.raises')} ${pct(f.rr!)}` : dir === 'down' ? `${t('risk.lowers')} ${pct(f.rr!)}` : dir === 'flat' ? t('risk.noChange') : t('risk.notCounted')}
          </span>
        </p>
        <p className="factor-why">{meta.why}</p>
        {src && (
          <ExtLink href={src.url} className="factor-src link link-target">
            {src.name} <ExternalLink size={11} aria-hidden />
          </ExtLink>
        )}
        {f.fromDiary && <Badge tone="ok" icon={<NotebookPen size={12} aria-hidden />}>{t('prevent.tabFood')}</Badge>}
      </div>
    </motion.li>
  );
}

function SourceLink({ id }: { id?: string }) {
  const s = id ? riskContent.sources[id] : undefined;
  if (!s) return null;
  return <ExtLink href={s.url} className="factor-src link link-target">{s.name} <ExternalLink size={11} aria-hidden /></ExtLink>;
}

function RiskCardView({ card, was, onTry }: { card: RiskCard; was: number | null; onTry: (patch: Partial<Answers>, label: string) => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const name = t(`cancers.${card.key}`);
  const bandText = card.band ? t(`risk.bands.${card.band}`) : '';
  const special = card.state === 'gene' ? { icon: <Dna size={20} />, title: t('risk.geneTitle'), body: t('risk.geneBody'), tone: 'accent' as const }
    : card.state === 'symptom' ? { icon: <TriangleAlert size={20} />, title: t('risk.symptomTitle'), body: t('risk.symptomBody'), tone: 'warn' as const }
      : card.state === 'surveil' ? { icon: <ShieldAlert size={20} />, title: t(`risk.surveilTitle.${card.key}`), body: t(`risk.surveilBody.${card.key}`), tone: 'warn' as const }
          : card.state === 'thin' ? { icon: <Hourglass size={20} />, title: t('risk.thinTitle'), body: t('risk.thinBody'), tone: 'quiet' as const }
            : null;
  const moved = card.multiple !== null && was !== null && was !== card.multiple;
  const spoken = card.multiple !== null ? `${bandText}. ${t('risk.times', { x: formatScore(card.multiple, lang) })}.` : '';

  return (
    <Card className={cx('risk-card', open && 'risk-open')} variants={rise} layout transition={spring}>
      <button type="button" className="risk-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <div className="risk-head">
          <div className="risk-name">
            <h3>{name}</h3>
            {special ? <Badge tone={special.tone}>{special.title}</Badge> : <span className={cx('band-word', `band-text-${card.band}`)}>{bandText}</span>}
          </div>
          {card.multiple !== null && (
            <div className={cx('risk-score', `band-text-${card.band}`)}>
              <VisuallyHidden>{spoken}</VisuallyHidden>
              <Score value={card.multiple} lang={lang} />
              <AnimatePresence>
                {moved && (
                  <motion.span className={cx('risk-was', card.multiple! < was! ? 'risk-was-down' : 'risk-was-up')}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
                    {card.multiple! < was! ? <ArrowDown size={13} aria-hidden /> : <ArrowUp size={13} aria-hidden />}
                    {t('risk.was', { x: formatScore(was!, lang) })}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
          <motion.span className="risk-chev" animate={{ rotate: open ? 180 : 0 }} transition={spring} aria-hidden><ChevronDown size={20} /></motion.span>
        </div>
        {card.state === 'band' ? <BandBar card={card} /> : null}
        {card.total > 0 && card.state !== 'surveil' && <p className="risk-coverage">{t('risk.builtFrom', { a: card.answered, b: card.total })}</p>}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="risk-more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            {special && (
              <div className={cx('risk-special', `tone-${special.tone}`)}>
                <span aria-hidden>{special.icon}</span>
                <p>{special.body}</p>
              </div>
            )}
            {card.state === 'surveil' && <SourceLink id={card.src} />}
            {card.state === 'band' && card.multiple !== null && (
              <p className="risk-multiple"><Gauge size={18} aria-hidden /> {t('risk.times', { x: formatScore(card.multiple, lang) })}</p>
            )}
            {card.factors.length > 0 && card.state !== 'surveil' && (
              <>
                <p className="mini-label">{t('risk.factors')}</p>
                <motion.ul className="factors" variants={stagger(0.05)} initial="hidden" animate="show">
                  {card.factors.map((f) => <FactorRow key={f.id} f={f} lang={lang} />)}
                </motion.ul>
              </>
            )}
            {card.state === 'thin' && (
              <Button size="sm" variant="secondary" className="risk-fill" icon={<SlidersHorizontal size={16} aria-hidden />} onClick={() => setView('answers')}>
                {t('risk.viewAnswers')}
              </Button>
            )}
            {card.state === 'band' && (
              card.lever ? (
                <motion.div className="lever-box" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }}>
                  <p className="mini-label"><Lightbulb size={14} aria-hidden /> {t('risk.biggest')}</p>
                  <p>{t('risk.biggestBody', {
                    action: t(`risk.levers.${card.lever.id}`), a: formatScore(card.multiple!, lang),
                    b: formatScore(card.lever.toMultiple, lang), band: t(`risk.bands.${card.lever.toBand}`),
                  })}</p>
                  {card.lever.patch && (
                    <Button size="sm" variant="primary" className="lever-try" icon={<FlaskConical size={16} aria-hidden />}
                      onClick={() => onTry(card.lever!.patch!, t(`risk.levers.${card.lever!.id}`))}>
                      {t('risk.tryIt')}
                    </Button>
                  )}
                </motion.div>
              ) : <p className="muted small">{t('risk.noLever')}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** The scores in one row, kept in view above the form. Screen readers hear what moved. */
function LiveScores({ cards, base }: { cards: RiskCard[]; base: Map<string, number | null> }) {
  const { t, lang } = useT();
  const last = useRef<Map<string, number | null>>(new Map(cards.map((c) => [c.key, c.multiple])));
  const [said, setSaid] = useState('');
  useEffect(() => {
    const moved = cards.filter((c) => last.current.get(c.key) !== c.multiple);
    last.current = new Map(cards.map((c) => [c.key, c.multiple]));
    if (!moved.length) return;
    setSaid(moved.map((c) => `${t(`cancers.${c.key}`)}: ${c.multiple === null ? t('risk.noScore') : t('risk.times', { x: formatScore(c.multiple, lang) })}`).join('. '));
  }, [cards, t, lang]);
  return (
    <div className="live">
      {/* Focusable so a keyboard can scroll the row sideways. */}
      <ul className="live-strip chips-scroll" aria-label={t('risk.live')} tabIndex={0}>
        {cards.map((c) => {
          const was = base.get(c.key) ?? null;
          const dir = c.multiple === null || was === null || was === c.multiple ? null : c.multiple < was ? 'down' : 'up';
          return (
            <li key={c.key} className={cx('live-chip', c.band ? `live-${c.band}` : 'live-none')}>
              <span className="live-name">{t(`cancers.${c.key}`)}</span>
              {c.multiple !== null ? (
                <>
                  <VisuallyHidden>{t('risk.times', { x: formatScore(c.multiple, lang) })}</VisuallyHidden>
                  <Score value={c.multiple} lang={lang} className="live-score" />
                </>
              ) : <span className="live-dash">{t('risk.noScore')}</span>}
              {dir && (dir === 'down' ? <ArrowDown size={13} className="live-dir live-dir-down" aria-hidden /> : <ArrowUp size={13} className="live-dir live-dir-up" aria-hidden />)}
            </li>
          );
        })}
      </ul>
      <VisuallyHidden aria-live="polite">{said}</VisuallyHidden>
    </div>
  );
}

export function RiskScreen({ view }: { view: View }) {
  const { t, th, list, lang } = useT();
  const saved = useApp((s) => s.answers);
  const ready = useReady();
  const diary = useDiary();
  const draft = useDraft();
  const changed = draftChanged(draft, saved);
  const cards = useRiskFor(changed ? draft : null);
  const baseCards = useRisk();
  const base = new Map(baseCards.map((c) => [c.key as string, c.multiple]));
  const edit = useCalc((s) => s.edit);
  const reset = useCalc((s) => s.reset);
  const setAnswers = useApp((s) => s.setAnswers);
  // Scores show once any factor is answered: the calculator can be filled in
  // without the check, and age and sex are not in the scores.
  const has = ready || changed || cards.some((c) => c.answered > 0);

  // The calculator shows and saves the person's own answers, so a change being
  // tried on the scores ends when it opens. Its strip shows which way each
  // score moved since it opened.
  const [opened, setOpened] = useState(base);
  useEffect(() => {
    if (view !== 'answers') return;
    reset();
    setOpened(new Map(baseCards.map((c) => [c.key as string, c.multiple])));
    // Only on opening: later answer changes are what the strip measures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Keep this change: the tried answers become the person's answers.
  const keep = () => {
    if (!draft) return;
    setAnswers(draft);
    reset();
    toast(t('risk.kept'), 'ok');
  };

  const onTry = (patch: Partial<Answers>, label: string) => {
    edit(saved, patch);
    toast(`${t('risk.tryingTitle')}: ${label}`, 'ok');
  };

  const top = (
    <div className="plan-tabs risk-tabs">
      <Segmented group="risk" label={t('risk.views')} value={view} onChange={(v) => setView(v as View)}
        items={[{ id: 'scores', label: t('risk.viewScores') }, { id: 'answers', label: t('risk.viewAnswers') }]} />
      <AnimatePresence initial={false}>
        {view === 'answers' && (
          <motion.div key="live" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            <LiveScores cards={baseCards} base={opened} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <Screen id="risk" title={t('risk.title')} lead={th('risk.lead')} top={top}>
      {view === 'answers' ? (
        <RiskCalculator onDone={() => setView('scores')} />
      ) : (
        <Stagger className="stack">
          <Item><SymptomFirst /></Item>
          {changed && (
            <Item>
              <Banner tone="accent" icon={<FlaskConical size={20} />} title={t('risk.tryingTitle')}
                action={
                  <div className="trying-actions">
                    <Button size="sm" variant="secondary" icon={<Check size={16} aria-hidden />} onClick={keep}>{t('risk.keep')}</Button>
                    <Button size="sm" variant="ghost" icon={<RotateCcw size={16} aria-hidden />} onClick={reset}>{t('risk.backToMine')}</Button>
                  </div>
                }>
                {t('risk.tryingBody')}
              </Banner>
            </Item>
          )}
          {has ? (
            <>
              <Item>
                <Banner tone={diary.useDiary ? 'ok' : 'quiet'} icon={<Utensils size={20} />}
                  action={!diary.useDiary && <Button size="sm" variant="ghost" onClick={() => navigate('/food')} iconRight={<ArrowRight size={16} aria-hidden />}>{t('risk.openDiary')}</Button>}>
                  {diary.useDiary ? t('risk.diaryOn', { n: diary.daysLogged }) : t('risk.diaryOff')}
                </Banner>
              </Item>
              <Item>
                <Card tone="quiet" className="age-note">
                  <p className="mini-label"><Info size={14} aria-hidden /> {t('risk.ageTitle')}</p>
                  <p>{t('risk.ageBody')}</p>
                </Card>
              </Item>
              <LayoutGroup>
                <motion.div className="stack" variants={stagger(0.07)}>
                  {cards.map((c) => <RiskCardView key={c.key} card={c} was={changed ? base.get(c.key) ?? null : null} onTry={onTry} />)}
                </motion.div>
              </LayoutGroup>
            </>
          ) : (
            <Item>
              <EmptyState icon={<Calculator size={44} />} title={t('risk.startTitle')} body={t('risk.startBody')}
                action={
                  <div className="empty-actions">
                    <Button size="lg" full shine onClick={startCheck} iconRight={<ArrowRight size={20} aria-hidden />}>{t('welcome.start')}</Button>
                    <Button size="lg" full variant="secondary" icon={<SlidersHorizontal size={20} aria-hidden />} onClick={() => setView('answers')}>{t('risk.fillIn')}</Button>
                  </div>
                } />
            </Item>
          )}
          <Item className="stack">
            <Disclosure summary={t('risk.methodTitle')}><p>{t('risk.methodBody')}</p></Disclosure>
            <Disclosure summary={t('risk.readTitle')}><ul className="bullets">{list('risk.readNotes').map((w, i) => <li key={i}>{w}</li>)}</ul></Disclosure>
            <Disclosure summary={t('risk.sourcesTitle')}>
              <ul className="sources">
                {Object.values(riskContent.sources).map((s) => (
                  <li key={s.url + s.name}><ExtLink href={s.url} className="link link-target">{s.name} <ExternalLink size={12} aria-hidden /></ExtLink></li>
                ))}
              </ul>
            </Disclosure>
            <p className="small muted" lang={lang}>{t('risk.disclaimer')}</p>
          </Item>
        </Stagger>
      )}
    </Screen>
  );
}
