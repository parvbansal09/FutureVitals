import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, CircleCheck, CircleQuestionMark as CircleHelp, Minus, NotebookPen, Plus, Scale as Scale3d } from 'lucide-react';
import { Screen } from '../components/Screen';
import { PlanTabs, EmptyState, SymptomFirst } from '../components/PlanBits';
import { Badge, Banner, Button, Card, Item, Stagger, cx } from '../components/ui';
import { ActionButton, SourceQuote } from '../components/widgets';
import { useT } from '../app/i18n';
import { useApp } from '../state/store';
import { saidText, useCompare, useDiary, useReady } from '../app/derived';
import { rowDef, type CompareRow } from '../engine/compare';
import { bouncy, rise, spring, stagger } from '../motion/presets';
import { haptic } from '../platform/native';
import { startCheck } from './Welcome';

function GapMeter({ row }: { row: CompareRow }) {
  const level = row.status === 'gap' ? Math.max(1, Math.min(4, Math.round(row.gap))) : 0;
  return (
    <span className={cx('gapmeter', row.direction && `gap-${row.direction}`)} aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <motion.span key={i} className={cx('gapseg', i <= level && 'on')}
          initial={{ scaleY: 0.3, opacity: 0.4 }} whileInView={{ scaleY: 1, opacity: 1 }} viewport={{ once: true }} transition={{ ...bouncy, delay: 0.05 * i }} />
      ))}
    </span>
  );
}

function RowCard({ row }: { row: CompareRow }) {
  const { t, th, tx, lang, helper } = useT();
  const def = rowDef(row.id);
  const tryThis = useApp((s) => s.tryThis);
  const toggleTry = useApp((s) => s.toggleTry);
  const [open, setOpen] = useState(row.largest);
  const trying = tryThis.includes(row.id);
  const gapLabel = row.largest ? t('compare.gaps.largest')
    : row.status === 'gap' ? t(`compare.gaps.${row.direction === 'below' ? 'below' : 'above'}`)
      : row.status === 'unknown' ? t('compare.gaps.unknown')
        : row.status === 'meets' ? t('compare.gaps.meets') : t('compare.gaps.na');
  const tone = row.largest ? 'danger' : row.status === 'gap' ? 'warn' : row.status === 'meets' ? 'ok' : 'quiet';

  return (
    <motion.div layout transition={spring} className={cx('cmp', `cmp-${row.status}`, row.largest && 'cmp-largest', open && 'cmp-open')} variants={rise}>
      <button type="button" className="cmp-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="cmp-title">
          {row.status === 'meets' && <CircleCheck size={20} className="ok-icon" aria-hidden />}
          {row.status === 'unknown' && <CircleHelp size={20} className="muted-icon" aria-hidden />}
          <strong>{tx(def.title)}</strong>
        </span>
        <Badge tone={tone}>{gapLabel}</Badge>
        {row.status === 'gap' && <GapMeter row={row} />}
        <motion.span className="cmp-chev" animate={{ rotate: open ? 180 : 0 }} transition={spring} aria-hidden><ChevronDown size={20} /></motion.span>
      </button>

      <dl className="cmp-grid">
        <div><dt>{helper ? t('compare.theySaid') : t('compare.youSaid')}</dt><dd>{saidText(row.said, t, lang)}{row.source === 'diary' && <NotebookPen size={13} className="diary-mark" aria-label={t('prevent.tabFood')} />}</dd></div>
        <div><dt>{t('compare.advice')}</dt><dd>{tx(def.rec)}</dd></div>
        <div><dt>{t('common.source')}</dt><dd>{def.source.org}</dd></div>
      </dl>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="cmp-more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            <p className="mini-label">{t('compare.howActs')}</p>
            <p>{tx(def.acts)}</p>
            <SourceQuote quote={def.quote} quoteEs={def.quoteEs} source={def.source.name} url={def.source.url} />
            {row.status !== 'na' && (
              <div className="first-step">
                <p className="mini-label">{row.status === 'meets' ? t('compare.gaps.meets') : t('compare.firstStep')}</p>
                <p className="first-step-text">{tx(def.firstStep.text)}</p>
                <div className="stack-sm">
                  {def.firstStep.actions.map((a, i) => <ActionButton key={i} action={a} />)}
                </div>
                {row.status !== 'meets' && (
                  <motion.button type="button" className={cx('try', trying && 'try-on')} aria-pressed={trying}
                    onClick={() => { haptic(trying ? 6 : 16); toggleTry(row.id); }} whileTap={{ scale: 0.95 }} transition={bouncy}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={String(trying)} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={bouncy} aria-hidden>
                        {trying ? <Check size={18} /> : <Plus size={18} />}
                      </motion.span>
                    </AnimatePresence>
                    {trying ? t('compare.trying') : t('compare.tryThis')}
                    {trying && <span className="burst" aria-hidden>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}</span>}
                  </motion.button>
                )}
              </div>
            )}
            {row.status === 'na' && <p className="muted small"><Minus size={14} aria-hidden /> {th('compare.gaps.na')}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CompareScreen() {
  const { t, th } = useT();
  const compare = useCompare();
  const ready = useReady();
  const diary = useDiary();

  if (!ready) {
    return (
      <Screen id="compare" title={t('compare.title')} top={<PlanTabs />}>
        <EmptyState icon={<Scale3d size={44} />} title={t('compare.noAnswersTitle')} body={t('compare.noAnswersBody')}
          action={<Button size="lg" shine onClick={startCheck} iconRight={<ArrowRight size={20} aria-hidden />}>{t('welcome.start')}</Button>} />
      </Screen>
    );
  }

  return (
    <Screen id="compare" title={t('compare.title')} lead={th('compare.lead')} top={<PlanTabs />}>
      <Stagger className="stack">
        <Item><SymptomFirst /></Item>
        {diary.useDiary && (
          <Item><Banner tone="ok" icon={<NotebookPen size={20} />}>{t('compare.fromDiary', { n: diary.daysLogged })}</Banner></Item>
        )}
        <LayoutGroup>
          <motion.div className="stack" variants={stagger(0.06)}>
            {compare.map((row) => <RowCard key={row.id} row={row} />)}
          </motion.div>
        </LayoutGroup>
        <Item><Card tone="quiet"><p className="small">{t('app.disclaimer')}</p></Card></Item>
      </Stagger>
    </Screen>
  );
}
