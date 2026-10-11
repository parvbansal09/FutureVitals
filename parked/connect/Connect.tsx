import { LayoutGroup, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Badge, Item, Stagger, cx } from '../components/ui';
import { ActionButton } from '../components/widgets';
import { useT } from '../app/i18n';
import { usePlan, useReady } from '../app/derived';
import { useApp } from '../state/store';
import { orderConnect } from '../engine/connect';
import { bouncy, rise, spring, stagger } from '../motion/presets';

export function ConnectScreen() {
  const { t, tx } = useT();
  const plan = usePlan();
  const ready = useReady();
  const smokes = useApp((s) => s.answers.smoke === 'current');
  const blocks = orderConnect(ready ? plan : null, smokes);

  return (
    <Screen id="connect" title={t('connect.title')} lead={t('connect.lead')}>
      <Stagger className="stack">
        <Item><p className="small muted">{t('connect.note')}</p></Item>
        <LayoutGroup>
          <motion.div className="stack" variants={stagger(0.06)}>
            {blocks.map(({ block, suggested }, i) => (
              <motion.article key={block.id} layout transition={spring} variants={rise} className={cx('connect', suggested && 'connect-suggested')}>
                <div className="connect-head">
                  <motion.span className="connect-icon" aria-hidden initial={{ scale: 0.4, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...bouncy, delay: 0.1 + i * 0.05 }}>
                    <Icon name={block.icon} size={24} />
                  </motion.span>
                  <div>
                    {suggested && <Badge tone="accent" className="connect-badge" icon={<Sparkles size={12} aria-hidden />}>{t('connect.suggested')}</Badge>}
                    <h2>{tx(block.title)}</h2>
                    <p className="small">{tx(block.desc)}</p>
                  </div>
                </div>
                {block.body && <p className="connect-body">{tx(block.body)}</p>}
                <div className={cx('connect-actions', block.actions.length > 3 && 'connect-grid')}>
                  {block.actions.map((a, j) => (
                    <ActionButton key={j} action={a} variant={j === 0 && suggested ? 'primary' : 'secondary'} compact={block.actions.length > 3} />
                  ))}
                </div>
              </motion.article>
            ))}
          </motion.div>
        </LayoutGroup>
        <Item><p className="small muted">{t('app.disclaimer')}</p></Item>
      </Stagger>
    </Screen>
  );
}
