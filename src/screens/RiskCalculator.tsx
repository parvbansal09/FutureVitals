// The calculator's answers: every factor the scores read, on one page, so a
// change shows at once in the live strip above. These are the person's own
// answers, saved like the check's; only "Try this change" on the scores is a
// what-if (see state/calc.ts).
import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, Scale } from 'lucide-react';
import { Button, Item, Stagger, cx } from '../components/ui';
import { Stepper } from '../components/widgets';
import { useT } from '../app/i18n';
import { check, type Option } from '../engine/content';
import { bmiBand, isList } from '../engine/answers';
import { PNTS, type Answers } from '../engine/types';
import { useApp } from '../state/store';
import { haptic } from '../platform/native';
import { bouncy, rise } from '../motion/presets';

type Set = (patch: Partial<Answers>) => void;
interface Choice { id: string; label: string }

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.fieldset className="calc-group" variants={rise}>
      <legend className="calc-legend">{title}</legend>
      <div className="calc-fields">{children}</div>
    </motion.fieldset>
  );
}

/** A native select: compact, and the phone's own picker opens on tap. */
function Select({ label, options, value, onChange }: {
  label: string; options: Choice[]; value: string | null | undefined; onChange: (id: string | null) => void;
}) {
  const { t } = useT();
  const v = value && value !== PNTS ? value : '';
  return (
    <label className="field calc-field">
      <span>{label}</span>
      <div className="select-wrap">
        <select className={cx('input select', !v && 'select-empty')} value={v} onChange={(e) => { haptic(6); onChange(e.target.value || null); }}>
          <option value="">{t('risk.notAnswered')}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <ChevronDown size={18} className="select-chev" aria-hidden />
      </div>
    </label>
  );
}

/** Two or three choices as chips. Tapping the chosen one again clears it. */
function Chips({ label, options, value, onChange }: {
  label: string; options: Choice[]; value: string | null | undefined; onChange: (id: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="field calc-field">
      <span id={id}>{label}</span>
      <div className="chips-row" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => {
          const on = value === o.id;
          return (
            <motion.button key={o.id} type="button" role="radio" aria-checked={on} className={cx('chip', on && 'chip-on')}
              whileTap={{ scale: 0.94 }} transition={bouncy} onClick={() => { haptic(6); if (!on) onChange(o.id); }}>
              {o.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/** Several choices plus an exclusive "none". An empty list means not answered. */
function MultiChips({ label, options, value, noneLabel, onChange }: {
  label: string; options: Choice[]; value: string[] | string | null | undefined; noneLabel: string; onChange: (v: string[] | 'none' | null) => void;
}) {
  const id = useId();
  const list = isList(value) ? value : [];
  const toggle = (id: string) => {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    onChange(next.length ? next : null);
  };
  return (
    <div className="field calc-field">
      <span id={id}>{label}</span>
      <div className="chips-row" role="group" aria-labelledby={id}>
        {options.map((o) => {
          const on = list.includes(o.id);
          return (
            <motion.button key={o.id} type="button" role="checkbox" aria-checked={on} className={cx('chip', on && 'chip-on')}
              whileTap={{ scale: 0.94 }} transition={bouncy} onClick={() => { haptic(6); toggle(o.id); }}>
              {o.label}
            </motion.button>
          );
        })}
        <motion.button type="button" role="checkbox" aria-checked={value === 'none'} className={cx('chip chip-quiet', value === 'none' && 'chip-on')}
          whileTap={{ scale: 0.94 }} transition={bouncy} onClick={() => { haptic(6); onChange(value === 'none' ? null : 'none'); }}>
          {noneLabel}
        </motion.button>
      </div>
    </div>
  );
}

const digits = (s: string, max: number): number | null => {
  const d = s.replace(/\D/g, '').slice(0, 3);
  return d ? Math.min(max, Number(d)) : null;
};

// The person's own answers: a change here is saved, the same as in the check,
// so the plan, How you compare and the scores all say the same thing.
export function RiskCalculator({ onDone }: { onDone: () => void }) {
  const { t, lang } = useT();
  const a = useApp((s) => s.answers);
  const set: Set = useApp((s) => s.setAnswers);
  const opts = (list: Option[]): Choice[] => list.map((o) => ({ id: o.id, label: o[lang] }));
  const yesNo: Choice[] = [{ id: 'yes', label: t('common.yes') }, { id: 'no', label: t('common.no') }];
  const smoker = a.smoke === 'former' || a.smoke === 'current';
  const famNamed = isList(a.famCancers) && a.famCancers.length > 0;
  const band = bmiBand(a);
  const bandKey = band && `bmi${band[0].toUpperCase()}${band.slice(1)}`;

  return (
    <Stagger className="stack calc">
      <Item className="calc-note">
        <p className="small muted">{t('risk.editNote')}</p>
      </Item>

      <Group title={t('risk.groups.you')}>
        <Chips label={t('check.s2.sex')} options={opts(check.sexes)} value={a.sex} onChange={(v) => set({ sex: v as Answers['sex'] })} />
        <Select label={t('check.s2.age')} options={check.ages.map((b) => ({ id: b.id, label: b.id.replace('-', '–') }))}
          value={a.age} onChange={(v) => set({ age: v })} />
      </Group>

      <Group title={t('risk.groups.smoking')}>
        <Chips label={t('check.s5.status')} options={opts(check.smoke)} value={a.smoke} onChange={(v) => set({ smoke: v as Answers['smoke'] })} />
        <AnimatePresence initial={false}>
          {smoker && (
            <motion.div key="smoke-more" className="calc-more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {a.smoke === 'former' && (
                <Select label={t('check.s5.quit')} options={opts(check.quitYears)} value={a.quit} onChange={(v) => set({ quit: v as Answers['quit'] })} />
              )}
              <Select label={t('check.s5.packs')} options={opts(check.packsPerDay)}
                value={typeof a.packsPerDay === 'number' ? String(a.packsPerDay) : null}
                onChange={(v) => set({ packsPerDay: v === null ? null : Number(v) })} />
              <div className="field calc-field">
                <span>{t('check.s5.years')}</span>
                <Stepper value={typeof a.yearsSmoked === 'number' ? a.yearsSmoked : null} onChange={(n) => set({ yearsSmoked: n })}
                  min={0} max={70} label={t('check.s5.years')} unit={t('check.s5.yearsUnit')} decLabel={t('check.s5.fewer')} incLabel={t('check.s5.more')} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <Group title={t('risk.groups.habits')}>
        <Select label={t('check.s6.alcohol')} options={opts(check.alcohol)} value={a.alcohol} onChange={(v) => set({ alcohol: v as Answers['alcohol'] })} />
        <Select label={t('check.s6.activity')} options={opts(check.activity)} value={a.activity} onChange={(v) => set({ activity: v as Answers['activity'] })} />
      </Group>

      <Group title={t('risk.groups.body')}>
        <div className={cx('body-inputs', a.bodySkip && 'is-skipped')}>
          <label className="field">
            <span>{t('check.s6.feet')}</span>
            <input className="input" inputMode="numeric" maxLength={1} value={a.heightFt ?? ''}
              onChange={(e) => set({ heightFt: digits(e.target.value, 8), bodySkip: false })} />
          </label>
          <label className="field">
            <span>{t('check.s6.inches')}</span>
            <input className="input" inputMode="numeric" maxLength={2} value={a.heightIn ?? ''}
              onChange={(e) => set({ heightIn: digits(e.target.value, 11), bodySkip: false })} />
          </label>
          <label className="field">
            <span>{t('check.s6.pounds')}</span>
            <input className="input" inputMode="numeric" maxLength={3} value={a.weightLb ?? ''}
              onChange={(e) => set({ weightLb: digits(e.target.value, 800), bodySkip: false })} />
          </label>
        </div>
        <AnimatePresence mode="popLayout">
          {bandKey && (
            <motion.p key={bandKey} className={cx('bmi-pill', `bmi-${band}`)} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={bouncy}>
              <Scale size={18} aria-hidden /> {t(`check.s6.${bandKey}`)}
            </motion.p>
          )}
        </AnimatePresence>
      </Group>

      <Group title={t('risk.groups.food')}>
        <Select label={t('check.s6.procMeat')} options={opts(check.frequency)} value={a.procMeat} onChange={(v) => set({ procMeat: v as Answers['procMeat'] })} />
        <Select label={t('check.s6.redMeat')} options={opts(check.frequency)} value={a.redMeat} onChange={(v) => set({ redMeat: v as Answers['redMeat'] })} />
        <Select label={t('check.s6.plants')} options={opts(check.plants)} value={a.plants} onChange={(v) => set({ plants: v as Answers['plants'] })} />
      </Group>

      <Group title={t('risk.groups.home')}>
        <Select label={t('check.s6.radon')} options={opts(check.radon)} value={a.radon} onChange={(v) => set({ radon: v as Answers['radon'] })} />
      </Group>

      <Group title={t('risk.groups.family')}>
        <MultiChips label={t('check.s3.cancers')} options={opts(check.familyCancers)} value={a.famCancers} noneLabel={t('check.s3.noHistory')}
          onChange={(v) => set({ famCancers: v })} />
        <AnimatePresence initial={false}>
          {famNamed && (
            <motion.div key="fam-more" className="calc-more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <Chips label={t('check.s3.close')} options={yesNo} value={a.famClose} onChange={(v) => set({ famClose: v as Answers['famClose'] })} />
              <Chips label={t('check.s3.young')} options={yesNo} value={a.famYoung} onChange={(v) => set({ famYoung: v as Answers['famYoung'] })} />
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <Group title={t('risk.groups.history')}>
        <MultiChips label={t('check.s4.history')} options={opts(check.history)} value={a.history} noneLabel={t('common.none')}
          onChange={(v) => set({ history: v })} />
      </Group>

      <Item>
        <Button size="lg" full shine onClick={onDone} iconRight={<ArrowRight size={20} aria-hidden />}>{t('risk.seeScores')}</Button>
      </Item>
    </Stagger>
  );
}
