import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BookOpen, CircleCheck, Clock, ExternalLink, Lightbulb, RefreshCw } from 'lucide-react';
import { Screen } from '../components/Screen';
import { Button, Card, Item, SectionTitle, Stagger, cx } from '../components/ui';
import { CountUp, ExtLink } from '../components/widgets';
import { useT } from '../app/i18n';
import { navigate } from '../app/router';
import { useReady } from '../app/derived';
import { learn, type Chapter } from '../engine/content';
import { bouncy, ease, pop, rise, spring, stagger } from '../motion/presets';
import { PreventTabs } from './Prevention';
import { startCheck } from './Welcome';

function MythCard({ myth, fact }: { myth: string; fact: string }) {
  const { t } = useT();
  const [flipped, setFlipped] = useState(false);
  return (
    <motion.button type="button" className="myth" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}
      aria-label={`${t('learn.mythLabel')}: ${myth}. ${flipped ? `${t('learn.factLabel')}: ${fact}` : t('learn.flip')}`} variants={rise} whileTap={{ scale: 0.98 }}>
      <motion.div className="myth-inner" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}>
        <div className="myth-face myth-front" aria-hidden={flipped}>
          <p className="mini-label">{t('learn.mythLabel')}</p>
          <p className="myth-text">“{myth}”</p>
          <p className="myth-hint"><RefreshCw size={14} aria-hidden /> {t('learn.flip')}</p>
        </div>
        <div className="myth-face myth-back" aria-hidden={!flipped}>
          <p className="mini-label"><CircleCheck size={14} aria-hidden /> {t('learn.factLabel')}</p>
          <p className="myth-text">{fact}</p>
          <p className="myth-hint"><RefreshCw size={14} aria-hidden /> {t('learn.flipBack')}</p>
        </div>
      </motion.div>
    </motion.button>
  );
}

export function LearnScreen() {
  const { t, tx } = useT();
  return (
    <Screen id="learn" title={t('learn.title')} lead={t('learn.lead')} top={<PreventTabs />}>
      <Stagger className="stack">
        <Item><SectionTitle title={t('learn.chapters')} icon={<BookOpen size={20} />} count={learn.chapters.length} /></Item>
        <motion.ol className="chapters" variants={stagger(0.05)}>
          {learn.chapters.map((c, i) => (
            <motion.li key={c.id} variants={rise}>
              <motion.button type="button" className="chapter-card" onClick={() => navigate(`/learn/${c.id}`)} whileTap={{ scale: 0.98 }} whileHover={{ x: 4 }} transition={spring}>
                <span className="chapter-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                <span className="chapter-text">
                  <span className="kicker">{tx(c.kicker)}</span>
                  <strong>{tx(c.title)}</strong>
                  <span className="chapter-blurb">{tx(c.blurb)}</span>
                  <span className="chapter-mins"><Clock size={13} aria-hidden /> {t('learn.minutes', { n: c.minutes })}</span>
                </span>
                <ArrowRight size={20} className="chapter-arrow" aria-hidden />
              </motion.button>
            </motion.li>
          ))}
        </motion.ol>

        <Item><SectionTitle title={t('learn.mythsTitle')} icon={<Lightbulb size={20} />} /></Item>
        <motion.div className="myths" variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
          {learn.myths.map((m) => <MythCard key={m.id} myth={tx(m.myth)} fact={tx(m.fact)} />)}
        </motion.div>
        <Item>
          <p className="small muted">{t('common.source')}: <ExtLink href={learn.mythsSource.url} className="link">{learn.mythsSource.org} <ExternalLink size={11} aria-hidden /></ExtLink></p>
        </Item>
      </Stagger>
    </Screen>
  );
}

/** Small animated drawings that carry each chapter's main idea. */
function Visual({ c }: { c: Chapter }) {
  const { tx, lang } = useT();
  if (c.visual === 'cells') {
    return (
      <div className="visual visual-cells" aria-hidden>
        <svg viewBox="0 0 320 120" width="100%" height="120">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.circle key={i} cx={40 + i * 56} cy={60} r={18} className="cell"
              initial={{ scale: 0 }} animate={{ scale: [0, 1.08, 1] }} transition={{ delay: 0.2 + i * 0.12, duration: 0.6, ease }} />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.circle key={`b${i}`} cx={264 + (i % 3) * 16 - 16} cy={44 + Math.floor(i / 3) * 30} r={9} className="cell-bad"
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1 + i * 0.18, ...bouncy }} />
          ))}
        </svg>
      </div>
    );
  }
  if (c.visual === 'stages' && c.ladder) {
    return (
      <motion.ol className="ladder" variants={stagger(0.12, 0.2)} initial="hidden" whileInView="show" viewport={{ once: true }}>
        {c.ladder.map((s, i) => (
          <motion.li key={i} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: spring } }}>
            <strong>{tx(s.s)}</strong>
            {/* Each rung's bar reaches further: how far the cancer has spread. */}
            <span className="ladder-track" aria-hidden>
              <motion.span className="ladder-bar" style={{ width: `${20 + i * 20}%` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ ...spring, delay: 0.25 + i * 0.12 }} />
            </span>
            <span className="ladder-text">{tx(s.d)}</span>
          </motion.li>
        ))}
      </motion.ol>
    );
  }
  if (c.visual === 'numbers' && c.stats) {
    return (
      <motion.div className="stats" variants={stagger(0.08, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true }}>
        {c.stats.map((s, i) => {
          const m = s.n.match(/^(\d+)(.*)$/);
          return (
            <motion.div key={i} className="stat" variants={pop}>
              <span className="stat-n">{m ? <><CountUp to={Number(m[1])} />{m[2]}</> : s.n}</span>
              <span className="stat-l">{tx(s.l)}</span>
            </motion.div>
          );
        })}
      </motion.div>
    );
  }
  if (c.visual === 'signs' && c.list) {
    return (
      <motion.ul className="signs" variants={stagger(0.05, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true }}>
        {c.list[lang].map((s, i) => <motion.li key={i} variants={rise}><CircleCheck size={16} aria-hidden /> {s}</motion.li>)}
      </motion.ul>
    );
  }
  return null;
}

export function ChapterScreen({ id }: { id: string }) {
  const { t, tx } = useT();
  const ready = useReady();
  const idx = Math.max(0, learn.chapters.findIndex((c) => c.id === id));
  const c = learn.chapters[idx];
  const next = learn.chapters[idx + 1];
  return (
    <Screen id={`learn-${c.id}`} back="/learn" kicker={tx(c.kicker)} title={tx(c.title)} lead={tx(c.blurb)} readingProgress>
      <Stagger className="stack chapter">
        <Item><Visual c={c} /></Item>
        {c.sections.map((s, i) => (
          <Item key={i} className="chapter-section">
            <h2>{tx(s.h)}</h2>
            <p>{tx(s.p)}</p>
          </Item>
        ))}
        {c.glossary && (
          <Item>
            <Card>
              <p className="mini-label">{t('learn.glossary')}</p>
              <dl className="glossary">
                {c.glossary.map((g, i) => (
                  <div key={i}><dt>{tx(g.w)}</dt><dd>{tx(g.d)}</dd></div>
                ))}
              </dl>
            </Card>
          </Item>
        )}
        <Item>
          <motion.div className="takeaway" initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={bouncy}>
            <p className="mini-label"><Lightbulb size={15} aria-hidden /> {t('learn.takeaway')}</p>
            <p className="takeaway-text">{tx(c.takeaway)}</p>
          </motion.div>
        </Item>
        <Item>
          <p className="small muted">{t('common.source')}: <ExtLink href={c.source.url} className="link">{c.source.org} <ExternalLink size={11} aria-hidden /></ExtLink></p>
        </Item>
        <Item className="stack-sm">
          {ready
            ? <Button full shine onClick={() => navigate('/plan')} iconRight={<ArrowRight size={20} aria-hidden />}>{t('learn.seeApplies')}</Button>
            : <Button full shine onClick={startCheck} iconRight={<ArrowRight size={20} aria-hidden />}>{t('welcome.start')}</Button>}
          {next && <Button full variant="secondary" onClick={() => navigate(`/learn/${next.id}`, { replace: true })} iconRight={<ArrowRight size={20} aria-hidden />}>{t('learn.next')}: {tx(next.title)}</Button>}
          <Button full variant="ghost" onClick={() => navigate('/learn')}>{t('learn.all')}</Button>
        </Item>
        <Item><p className={cx('small muted')}>{t('app.disclaimer')}</p></Item>
      </Stagger>
    </Screen>
  );
}
