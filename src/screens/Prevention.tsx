import type { ReactElement } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BookmarkCheck, CalendarCheck, ChevronRight, CircleCheck, ExternalLink, Footprints, HeartPulse, Microscope, Ribbon, Sparkles, TriangleAlert } from 'lucide-react';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Badge, Banner, Button, Card, Item, Kicker, SectionTitle, Stagger, cx } from '../components/ui';
import { Disclosure, ExtLink, Segmented, SourceQuote } from '../components/widgets';
import { useT } from '../app/i18n';
import { navigate, useRoute } from '../app/router';
import { useReady } from '../app/derived';
import { useApp } from '../state/store';
import { prevention, screening } from '../engine/content';
import { libraryStale, sortedEntries } from '../engine/prevention';
import { formatDate } from '../engine/format';
import { pop, rise, spring, stagger } from '../motion/presets';
import { startCheck } from './Welcome';

export function PreventTabs() {
  const { t } = useT();
  const { route } = useRoute();
  const value = route.path.startsWith('/learn') ? 'learn' : route.path.startsWith('/food') ? 'food' : route.path.startsWith('/scan') ? 'scan' : 'prevention';
  return (
    <div className="plan-tabs">
      <Segmented group="prevent" label={t('nav.prevent')} value={value}
        onChange={(id) => navigate(`/${id}`, { replace: true })}
        items={[
          { id: 'prevention', label: t('prevent.tabLibrary') },
          { id: 'learn', label: t('prevent.tabLearn') },
          { id: 'food', label: t('prevent.tabFood') },
          { id: 'scan', label: t('prevent.tabScan') },
        ]} />
    </div>
  );
}

const CANCER_ICON: Record<string, ReactElement> = {
  breast: <Ribbon size={22} />, cervical: <HeartPulse size={22} />, colorectal: <Microscope size={22} />,
  lung: <Footprints size={22} />, prostate: <Ribbon size={22} />, skin: <Sparkles size={22} />,
};

export function PreventionScreen() {
  const { t, tx, lang } = useT();
  const answers = useApp((s) => s.answers);
  const ready = useReady();
  const entries = sortedEntries(ready ? answers : null, lang);
  const stale = libraryStale();

  return (
    <Screen id="prevention" kicker={t('prevent.kicker')} title={t('prevent.headline')} top={<PreventTabs />}>
      <Stagger className="stack">
        {stale && <Item><Banner tone="warn" icon={<TriangleAlert size={20} />}>{t('prevent.stale')}</Banner></Item>}

        <Item>
          <Card tone="accent" className="screening-para">
            <p className="mini-label"><CalendarCheck size={14} aria-hidden /> {tx(prevention.screening.title)}</p>
            <p>{tx(prevention.screening.body)}</p>
          </Card>
        </Item>

        {ready && (
          <Item>
            <Button full shine onClick={() => navigate('/compare')} iconRight={<ArrowRight size={20} aria-hidden />}>{t('prevent.seeApplies')}</Button>
          </Item>
        )}

        <Item><p className="list-meta">{ready ? t('prevent.sortedForYou') : t('prevent.sortedAz')}</p></Item>

        <motion.div className="stack" variants={stagger(0.06)}>
          {entries.map(({ entry, applies }) => (
            <motion.article key={entry.id} layout className={cx('entry', applies && 'entry-applies')} variants={rise} transition={spring}>
              <Disclosure
                icon={<span className="entry-icon"><Icon name={entry.icon} size={22} /></span>}
                summary={
                  <span className="entry-head">
                    <strong>{tx(entry.title)}</strong>
                    {applies && <Badge tone="accent" icon={<CircleCheck size={13} aria-hidden />}>{t('prevent.applies')}</Badge>}
                  </span>
                }
              >
                <p>{tx(entry.body)}</p>
                <SourceQuote quote={entry.quote} quoteEs={entry.quoteEs} source={entry.source.org} url={entry.source.url} />
                <div className="first-step">
                  <p className="mini-label">{t('prevent.firstStep')}</p>
                  <p className="first-step-text">{tx(entry.firstStep)}</p>
                </div>
                <p className="small muted">{t('common.reviewed', { date: formatDate(entry.reviewed, lang) })}</p>
              </Disclosure>
            </motion.article>
          ))}
        </motion.div>

        <Item>
          <SectionTitle title={t('prevent.cancersTitle')} icon={<Ribbon size={20} />} />
        </Item>
        <motion.div className="cancer-grid" variants={stagger(0.05)}>
          {prevention.cancers.map((c) => (
            <motion.button key={c.id} type="button" className="cancer-tile" variants={pop} whileTap={{ scale: 0.96 }} whileHover={{ y: -3 }}
              transition={spring} onClick={() => navigate(`/prevention/${c.id}`)}>
              <span className="cancer-tile-icon" aria-hidden>{CANCER_ICON[c.id]}</span>
              <strong>{tx(c.name)}</strong>
              <span className="cancer-tile-blurb">{tx(c.blurb)}</span>
              <span className={cx('screen-flag', `flag-${c.screening}`)}>
                {c.screening === 'yes' ? t('prevent.screenYes') : c.screening === 'choice' ? t('prevent.screenChoice') : t('prevent.screenNo')}
              </span>
            </motion.button>
          ))}
        </motion.div>
        <Item><p className="small muted">{t('app.disclaimer')}</p></Item>
      </Stagger>
    </Screen>
  );
}

export function CancerPage({ id }: { id: string }) {
  const { t, tx, lang } = useT();
  const ready = useReady();
  const c = prevention.cancers.find((x) => x.id === id) || prevention.cancers[0];
  const g = screening.guidelines[c.guideline];
  const block = (title: string, items: string[], icon: ReactElement, tone?: string) => (
    <Item>
      <Card className={cx('cancer-block', tone && `cancer-${tone}`)}>
        <p className="mini-label">{icon} {title}</p>
        <motion.ul className="bullets" variants={stagger(0.04)} initial="hidden" whileInView="show" viewport={{ once: true }}>
          {items.map((s, i) => <motion.li key={i} variants={rise}>{s}</motion.li>)}
        </motion.ul>
      </Card>
    </Item>
  );
  return (
    <Screen id={`cancer-${c.id}`} back="/prevention" kicker={t('prevent.cancersTitle')} title={tx(c.name)} lead={tx(c.blurb)}>
      <Stagger className="stack">
        <Item>
          <Card tone={c.screening === 'yes' ? 'accent' : 'quiet'}>
            <Kicker>{c.screening === 'yes' ? t('prevent.screenYes') : c.screening === 'choice' ? t('prevent.screenChoice') : t('prevent.screenNo')}</Kicker>
            <p>{tx(c.screeningText)}</p>
            {g && (
              <ExtLink href={g.url} className="guide-chip">
                <BookmarkCheck size={14} aria-hidden /> {g.short} {g.year} <ExternalLink size={12} aria-hidden />
              </ExtLink>
            )}
          </Card>
        </Item>
        {block(t('prevent.raises'), c.raises[lang], <TriangleAlert size={14} aria-hidden />)}
        {block(t('prevent.change'), c.change[lang], <CircleCheck size={14} aria-hidden />, 'change')}
        {block(t('prevent.signs'), c.signs[lang], <HeartPulse size={14} aria-hidden />, 'signs')}
        <Item>
          {ready
            ? <Button full shine onClick={() => navigate('/plan')} iconRight={<ChevronRight size={20} aria-hidden />}>{t('learn.seeApplies')}</Button>
            : <Button full shine onClick={startCheck} iconRight={<ChevronRight size={20} aria-hidden />}>{t('welcome.start')}</Button>}
        </Item>
        <Item><p className="small muted">{t('app.disclaimer')}</p></Item>
      </Stagger>
    </Screen>
  );
}
