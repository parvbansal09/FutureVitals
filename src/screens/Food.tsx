import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ExternalLink, Lock, Minus, PartyPopper, Plus, ScanBarcode, ShieldCheck, Trash } from 'lucide-react';
import { Screen } from '../components/Screen';
import { Button, Card, Item, SectionTitle, Stagger, cx } from '../components/ui';
import { ExtLink, toast, TwoTap } from '../components/widgets';
import { useT } from '../app/i18n';
import { navigate } from '../app/router';
import { useApp } from '../state/store';
import { foods, type FoodDef } from '../engine/content';
import { lastSevenDays, summarize, todayKey, weekdayIndex, SERVING_CAP } from '../engine/diary';
import { bouncy, pop, rise, spring, stagger } from '../motion/presets';
import { haptic } from '../platform/native';
import { PreventTabs } from './Prevention';

function Counter({ food, day }: { food: FoodDef; day: string }) {
  const { t, tx } = useT();
  const n = useApp((s) => s.foodLog[day]?.[food.id] || 0);
  const bumpFood = useApp((s) => s.bumpFood);
  const [dir, setDir] = useState(1);
  const name = tx(food.name);
  const change = (d: number) => { setDir(d); haptic(d > 0 ? 10 : 6); bumpFood(day, food.id, d); };
  return (
    <motion.div className={cx('food', `food-${food.group}`, n > 0 && 'food-on')} variants={rise} layout transition={spring}>
      <div className="food-text">
        <strong>{name}</strong>
        <span className="food-ex">{tx(food.examples)}</span>
        <span className="food-serving">{tx(food.serving)}</span>
      </div>
      <div className="counter" role="group" aria-label={name}>
        <motion.button type="button" className="counter-btn" onClick={() => change(-1)} disabled={n === 0} aria-label={t('food.remove', { food: name })} whileTap={{ scale: 0.82 }}>
          <Minus size={18} aria-hidden />
        </motion.button>
        <span className="counter-n" aria-live="polite" aria-label={n === 1 ? t('food.servingOne') : t('food.servings', { n })}>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.span key={n} initial={{ y: dir * 16, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: dir * -16, opacity: 0 }} transition={bouncy}>{n}</motion.span>
          </AnimatePresence>
        </span>
        <motion.button type="button" className="counter-btn counter-add" onClick={() => change(1)} disabled={n >= SERVING_CAP} aria-label={t('food.add', { food: name })} whileTap={{ scale: 0.82 }}>
          <Plus size={18} aria-hidden />
        </motion.button>
      </div>
    </motion.div>
  );
}

export function FoodScreen() {
  const { t, tx, list, lang } = useT();
  const foodLog = useApp((s) => s.foodLog);
  const picked = useApp((s) => s.foodDay);
  const setDay = useApp((s) => s.setFoodDay);
  const clearWeek = useApp((s) => s.clearWeek);
  const today = todayKey();
  const summary = summarize(foodLog, today);
  const short = list('food.days');
  const long = list('food.daysLong');
  // The last 7 days, ending today. A day picked before midnight that has since
  // left the window falls back to today.
  const window7 = lastSevenDays(today);
  const day = window7.includes(picked) ? picked : today;
  const toGo = Math.max(0, foods.minDays - summary.daysLogged);

  // Celebrate the moment the diary starts feeding How you compare.
  const prev = useRef(summary.daysLogged);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (prev.current < foods.minDays && summary.daysLogged >= foods.minDays) {
      setCelebrate(true);
      haptic(30);
      toast(t('food.unlockTitle'));
      setTimeout(() => setCelebrate(false), 2400);
    }
    prev.current = summary.daysLogged;
  }, [summary.daysLogged, t]);

  const groups: { key: 'limit' | 'choose'; title: string }[] = [
    { key: 'limit', title: t('food.limit') },
    { key: 'choose', title: t('food.choose') },
  ];
  const maxWeek = Math.max(1, ...Object.values(summary.week));

  return (
    <Screen id="food" title={t('food.title')} lead={t('food.lead')} top={<PreventTabs />}>
      <Stagger className="stack">
        <Item>
          <div className="days" role="tablist" aria-label={t('food.week')}>
            {window7.map((k) => {
              const on = k === day;
              const isToday = k === today;
              const w = weekdayIndex(k);
              const logged = Object.values(foodLog[k] || {}).some((n) => n > 0);
              return (
                <button key={k} type="button" role="tab" aria-selected={on} aria-label={isToday ? `${t('food.today')}, ${long[w]}` : long[w]}
                  className={cx('day', on && 'day-on', isToday && 'day-today')} onClick={() => { haptic(6); setDay(k); }}>
                  {on && <motion.span layoutId="day-pill" className="day-pill" transition={spring} />}
                  <span className="day-label">{isToday ? t('food.today') : short[w]}</span>
                  <AnimatePresence>{logged && <motion.span className="day-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={bouncy} aria-hidden />}</AnimatePresence>
                </button>
              );
            })}
          </div>
          <p className="small muted serving-guide">{tx(foods.servingGuide)}</p>
        </Item>

        <AnimatePresence mode="wait">
          <motion.div key={day} className="stack" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={spring}>
            {groups.map((g) => (
              <div key={g.key} className="stack-sm">
                <h2 className={cx('group-h', `group-${g.key}`)}>{g.title}</h2>
                <motion.div className="stack-sm" variants={stagger(0.035)} initial="hidden" animate="show">
                  {foods.foods.filter((f) => f.group === g.key).map((f) => <Counter key={f.id} food={f} day={day} />)}
                </motion.div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        <Item>
          <Button variant="secondary" full icon={<ScanBarcode size={20} aria-hidden />} onClick={() => navigate('/scan')}>{t('scan.title')}</Button>
        </Item>

        <Item>
          <SectionTitle title={t('food.week')} />
          {toGo > 0 ? (
            <Card tone="quiet" className="locked">
              <div className="lock-ring" aria-hidden>
                {Array.from({ length: foods.minDays }, (_, i) => (
                  <motion.span key={i} className={cx('lock-seg', i < summary.daysLogged && 'on')} initial={false} animate={{ scale: i < summary.daysLogged ? 1 : 0.85 }} transition={bouncy} />
                ))}
                <Lock size={18} />
              </div>
              <p>{toGo === 1 ? t('food.weekLockedOne') : t('food.weekLocked', { n: toGo })}</p>
            </Card>
          ) : (
            <motion.div className="stack-sm" variants={stagger(0.04)} initial="hidden" animate="show">
              <Card tone="ok" className={cx('unlock', celebrate && 'celebrate')} variants={pop}>
                <PartyPopper size={22} aria-hidden />
                <div>
                  <p className="alert-title">{t('food.unlockTitle')}</p>
                  <p>{t('food.unlockBody')}</p>
                  <Button size="sm" variant="ghost" onClick={() => navigate('/compare')} iconRight={<ArrowRight size={16} aria-hidden />}>{t('compare.title')}</Button>
                </div>
                {celebrate && <span className="confetti" aria-hidden>{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}</span>}
              </Card>
              {foods.foods.map((f) => {
                const total = summary.week[f.id] || 0;
                return (
                  <motion.div key={f.id} className={cx('week-row', `food-${f.group}`)} variants={rise}>
                    <div className="week-top">
                      <strong>{tx(f.name)}</strong>
                      <span className="muted">{t('food.perWeek', { n: total })}</span>
                    </div>
                    <div className="week-bar" aria-hidden>
                      <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: total / maxWeek }} transition={{ ...spring, delay: 0.1 }} />
                    </div>
                    <p className="small"><strong>{t('food.linkedTo')}:</strong> {f.cancers[lang].join(', ')} · {tx(f.level)}{' '}
                      <ExtLink href={f.source.url} className="link">{f.source.org} <ExternalLink size={11} aria-hidden /></ExtLink>
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </Item>

        <Item className="stack-sm">
          <TwoTap label={t('food.clear')} armedLabel={t('food.clearArmed')} icon={<Trash size={18} aria-hidden />} onConfirm={() => { clearWeek(); toast(t('food.cleared')); }} />
          <p className="small muted"><ShieldCheck size={14} aria-hidden /> {t('food.stored')}</p>
          <p className="small muted">{t('food.disclaimer')}</p>
        </Item>
      </Stagger>
    </Screen>
  );
}
