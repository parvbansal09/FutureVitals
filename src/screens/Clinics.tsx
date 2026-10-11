import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  Bus, CalendarDays, Car, Check, Clock, Globe, Languages, LocateFixed, MapPin, Navigation, Phone,
  SearchX, ShieldCheck, SlidersHorizontal, Star, TriangleAlert, Truck, Wallet, X,
} from 'lucide-react';
import { Screen } from '../components/Screen';
import { Badge, Banner, Button, Card, Item, Stagger, cx } from '../components/ui';
import { ActionButton, CountUp, LinkButton, Sheet } from '../components/widgets';
import { useT } from '../app/i18n';
import { goBack, navigate } from '../app/router';
import { useApp } from '../state/store';
import { events, type Clinic } from '../engine/content';
import { anyStale, clinicById, filterCount, findClinics, isStale, mapsHref, noFilters, telHref, type ClinicFilters } from '../engine/clinics';
import { coverageOf, resolveZip, type LatLng } from '../engine/geo';
import { formatDate } from '../engine/format';
import type { ClinicTest } from '../engine/types';
import { bouncy, pop, rise, spring, stagger } from '../motion/presets';
import { getPosition, haptic } from '../platform/native';
import { IN_ARTIFACT } from '../platform/env';

const TESTS: ClinicTest[] = ['mammogram', 'colonoscopy', 'fit', 'ldct', 'pap', 'skin'];

function StarButton({ id, name }: { id: string; name: string }) {
  const { t } = useT();
  const on = useApp((s) => s.favorites.includes(id));
  const toggle = useApp((s) => s.toggleFavorite);
  return (
    <motion.button type="button" className={cx('star', on && 'star-on')} aria-pressed={on} aria-label={`${on ? t('clinics.saved') : t('clinics.save')}: ${name}`}
      onClick={(e) => { e.stopPropagation(); haptic(on ? 6 : 18); toggle(id); }} whileTap={{ scale: 0.8 }}>
      <motion.span key={String(on)} initial={on ? { scale: 0.4, rotate: -40 } : false} animate={{ scale: 1, rotate: 0 }} transition={bouncy}>
        <Star size={22} fill={on ? 'currentColor' : 'none'} aria-hidden />
      </motion.span>
      {on && <span className="burst" aria-hidden>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}</span>}
    </motion.button>
  );
}

function costLine(s: Clinic, t: (k: string) => string): string {
  const bits: string[] = [];
  if (s.cost.uninsured) bits.push(t('clinics.costUninsured'));
  if (s.cost.slidingScale) bits.push(t('clinics.costSliding'));
  if (s.cost.ewl) bits.push(t('clinics.costEwl'));
  if (s.cost.medicaid) bits.push(t('clinics.costMedicaid'));
  return bits.length ? bits.join(' · ') : t('common.callToAsk');
}

function langLine(s: Clinic, t: (k: string) => string, tx: (b: { en: string; es: string } | undefined) => string): string {
  if (s.languageNote) return tx(s.languageNote);
  const bits: string[] = [];
  if (s.language.spanish) bits.push(t('clinics.spanishYes'));
  if (s.language.interpreter) bits.push(t('clinics.interpreterYes'));
  return bits.length ? bits.join(' · ') : t('common.callToAsk');
}

function ClinicCard({ site, miles }: { site: Clinic; miles: number | null }) {
  const { t, tx, lang } = useT();
  return (
    <motion.article layout className="clinic" variants={rise} transition={spring}>
      <button type="button" className="clinic-main" onClick={() => navigate(`/clinics/${site.id}`)}>
        <div className="clinic-top">
          <span className="clinic-kind">{t(`clinics.kinds.${site.type}`)}{site.nci && <Badge tone="accent">{t('clinics.nci')}</Badge>}</span>
          {miles !== null && <span className="clinic-miles"><Car size={14} aria-hidden /> {t('clinics.distance', { n: Math.max(1, Math.round(miles)) })}</span>}
        </div>
        <h3>{site.name}</h3>
        <p className="clinic-addr">{site.address}, {site.city}</p>
        {site.tests.length > 0 && (
          <div className="chips-row">{site.tests.map((x) => <span key={x} className="chip chip-static chip-test">{t(`clinics.tests.${x}`)}</span>)}</div>
        )}
        <p className="clinic-line"><Wallet size={14} aria-hidden /> {costLine(site, t)}</p>
        <p className="clinic-line"><Languages size={14} aria-hidden /> {langLine(site, t, tx)}</p>
        {site.hours && <p className="clinic-line"><Clock size={14} aria-hidden /> {tx(site.hours)}</p>}
        <p className={cx('clinic-verified', isStale(site) && 'stale')}>{t('clinics.lastVerified', { date: formatDate(site.verified, lang) })}</p>
      </button>
      <div className="clinic-actions">
        <LinkButton href={telHref(site.phone)} value={site.phone} size="sm" icon={<Phone size={16} aria-hidden />} aria-label={`${t('common.call')} ${site.name}, ${site.phone}`}>{t('common.call')}</LinkButton>
        <LinkButton href={mapsHref(site)} size="sm" variant="secondary" icon={<Navigation size={16} aria-hidden />}>{t('common.directions')}</LinkButton>
        <StarButton id={site.id} name={site.name} />
      </div>
    </motion.article>
  );
}

function ClinicDetail({ site }: { site: Clinic }) {
  const { t, tx, lang } = useT();
  const referral = site.referral === true ? t('clinics.referralYes') : site.referral === false ? t('clinics.referralNo') : site.referral === 'some' ? t('clinics.referralSome') : t('clinics.referralUnknown');
  return (
    <motion.div className="detail" variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.p variants={rise} className="clinic-kind">{t(`clinics.kinds.${site.type}`)}{site.nci && <Badge tone="accent">{t('clinics.nci')}</Badge>}</motion.p>
      <motion.h2 variants={rise} id="clinic-title" className="detail-title">{site.name}</motion.h2>
      <motion.div variants={rise} className="detail-actions">
        <LinkButton href={telHref(site.phone)} value={site.phone} icon={<Phone size={18} aria-hidden />}>{site.phone}</LinkButton>
        <LinkButton href={mapsHref(site)} variant="secondary" icon={<Navigation size={18} aria-hidden />}>{t('common.directions')}</LinkButton>
        <StarButton id={site.id} name={site.name} />
      </motion.div>
      {site.phoneNote && <motion.p variants={rise} className="small muted">{tx(site.phoneNote)}</motion.p>}
      <motion.dl variants={rise} className="detail-list">
        <div><dt><MapPin size={15} aria-hidden /> {t('clinics.detailAddress')}</dt><dd>{site.address}, {site.city}, VA {site.zip}</dd></div>
        <div><dt><Check size={15} aria-hidden /> {t('clinics.detailTests')}</dt><dd>
          {site.tests.length ? site.tests.map((x) => t(`clinics.tests.${x}`)).join(', ') : t('clinics.testsAsk')}
          {site.testsBasis && <span className="basis">{t('clinics.testsBasis')}: {site.testsBasis}</span>}
        </dd></div>
        <div><dt><Wallet size={15} aria-hidden /> {t('clinics.costLine')}</dt><dd>{costLine(site, t)}{site.costNote && <span className="basis">{tx(site.costNote)}</span>}</dd></div>
        <div><dt><Languages size={15} aria-hidden /> {t('clinics.languageLine')}</dt><dd>{langLine(site, t, tx)}</dd></div>
        <div><dt><Clock size={15} aria-hidden /> {t('clinics.hoursLine')}</dt><dd>{site.hours ? tx(site.hours) : t('common.callToAsk')}</dd></div>
        <div><dt><Bus size={15} aria-hidden /> {t('clinics.accessBus')}</dt><dd>{site.bus === true ? t('common.yes') : site.bus === false ? t('common.no') : t('common.callToAsk')}</dd></div>
        <div><dt><ShieldCheck size={15} aria-hidden /> {t('clinics.detailReferral')}</dt><dd>{referral}{site.referralNote && <span className="basis">{tx(site.referralNote)}</span>}</dd></div>
        <div><dt><Check size={15} aria-hidden /> {t('clinics.detailBring')}</dt><dd>{site.bring ? tx(site.bring) : t('clinics.bringDefault')}</dd></div>
      </motion.dl>
      {site.website && (
        <motion.div variants={rise}>
          <ActionButton action={{ type: 'url', value: site.website }} label={t('common.website')} />
        </motion.div>
      )}
      <motion.p variants={rise} className={cx('clinic-verified', isStale(site) && 'stale')}>{t('clinics.lastVerified', { date: formatDate(site.verified, lang) })}</motion.p>
      <motion.div variants={rise}><Banner tone="quiet" icon={<TriangleAlert size={18} />}>{t('clinics.confirm')}</Banner></motion.div>
    </motion.div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button type="button" className={cx('chip', on && 'chip-on')} aria-pressed={on} onClick={() => { haptic(6); onClick(); }} whileTap={{ scale: 0.93 }} layout transition={spring}>
      <AnimatePresence initial={false}>{on && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="chip-check"><Check size={14} aria-hidden /></motion.span>}</AnimatePresence>
      {children}
    </motion.button>
  );
}

export function ClinicsScreen({ openId, query }: { openId?: string; query: URLSearchParams }) {
  const { t, tx, lang } = useT();
  const zip = useApp((s) => s.zip);
  const setZip = useApp((s) => s.setZip);
  const favorites = useApp((s) => s.favorites);
  const [draft, setDraft] = useState(zip);
  const [gps, setGps] = useState<LatLng | null>(null);
  const [locState, setLocState] = useState<'idle' | 'busy' | 'denied' | 'outside'>('idle');
  const [filters, setFilters] = useState<ClinicFilters>(() => {
    const f = noFilters();
    const q = (query.get('test') || '').split(',').filter((x): x is ClinicTest => (TESTS as string[]).includes(x));
    return { ...f, tests: q };
  });
  const fromPlan = !!query.get('test');
  const [sheet, setSheet] = useState(false);
  const [savedOnly, setSavedOnly] = useState(query.get('saved') === '1');

  useEffect(() => setDraft(zip), [zip]);

  const zipResult = useMemo(() => resolveZip(zip), [zip]);
  const origin: LatLng | null = gps ?? (zipResult.status === 'ok' ? zipResult.coords : null);
  const blocked = !gps && (zipResult.status === 'outside' || zipResult.status === 'invalid');
  const hits = useMemo(() => (blocked ? [] : findClinics(origin, filters, savedOnly ? favorites : undefined)), [origin, filters, savedOnly, favorites, blocked]);
  const detail = openId ? clinicById(openId) : undefined;
  const count = filterCount(filters);
  const upcoming = events.events.filter((e) => e.date >= new Date().toISOString().slice(0, 10));

  const locate = async () => {
    setLocState('busy');
    const r = await getPosition();
    if (!r.ok) { setLocState('denied'); return; }
    const c: LatLng = [r.lat, r.lng];
    if (coverageOf(c) === 'outside') { setLocState('outside'); setGps(null); return; }
    setGps(c); // used in memory only, never stored
    setLocState('idle');
  };

  const toggleTest = (x: ClinicTest) => setFilters((f) => ({ ...f, tests: f.tests.includes(x) ? f.tests.filter((y) => y !== x) : [...f.tests, x] }));
  const flip = (k: keyof Omit<ClinicFilters, 'tests'>) => setFilters((f) => ({ ...f, [k]: !f[k] }));

  return (
    <Screen id="clinics" title={t('clinics.title')} lead={t('clinics.lead')}>
      <Stagger className="stack">
        <Item>
          <Card className="locator">
            <form className="zip-row" onSubmit={(e) => { e.preventDefault(); if (/^\d{5}$/.test(draft)) { setGps(null); setZip(draft); } }}>
              <label className="sr-only" htmlFor="zip">{t('clinics.zipLabel')}</label>
              <span className="input-icon"><MapPin size={18} aria-hidden /></span>
              <input id="zip" className="input input-with-icon" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder={t('clinics.zip')}
                value={draft} onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setDraft(v);
                  if (v.length === 5) { setGps(null); setZip(v); }
                }} />
              {draft && <button type="button" className="icon-btn input-clear" aria-label={t('common.close')} onClick={() => { setDraft(''); setZip(''); }}><X size={16} /></button>}
            </form>
            {!IN_ARTIFACT && (
              <>
                <Button variant="secondary" full loading={locState === 'busy'} icon={<LocateFixed size={18} aria-hidden />} onClick={locate}>
                  {locState === 'busy' ? t('clinics.locating') : t('clinics.useLocation')}
                </Button>
                <p className="small muted">{t('clinics.locationNote')}</p>
              </>
            )}
            <AnimatePresence mode="popLayout">
              {locState === 'denied' && <motion.p key="d" className="field-note warn-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t('clinics.locDenied')}</motion.p>}
              {gps && <motion.p key="g" className="field-note ok-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><LocateFixed size={14} aria-hidden /> {t('clinics.sortedFrom', { place: t('clinics.yourLocation') })}</motion.p>}
              {!gps && zipResult.status === 'ok' && <motion.p key="z" className="field-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t('clinics.sortedFrom', { place: zip })}</motion.p>}
              {!gps && !zip && <motion.p key="n" className="field-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t('clinics.sortedDefault')}</motion.p>}
            </AnimatePresence>
          </Card>
        </Item>

        {(zipResult.status === 'outside' && !gps) || locState === 'outside' ? (
          <Item><Banner tone="warn" icon={<Globe size={20} />} title={t('clinics.outsideTitle')}>{t('clinics.outsideBody')}</Banner></Item>
        ) : null}
        {zipResult.status === 'invalid' && !gps && <Item><Banner tone="warn" icon={<TriangleAlert size={20} />}>{t('clinics.unknownZip')}</Banner></Item>}

        <Item>
          <div className="filter-bar">
            <div className="chips-scroll" role="group" aria-label={t('clinics.fTest')}>
              <LayoutGroup>
                {TESTS.map((x) => <FilterChip key={x} on={filters.tests.includes(x)} onClick={() => toggleTest(x)}>{t(`clinics.tests.${x}`)}</FilterChip>)}
              </LayoutGroup>
            </div>
            <Button size="sm" variant={count ? 'primary' : 'secondary'} icon={<SlidersHorizontal size={16} aria-hidden />} onClick={() => setSheet(true)}>
              {count ? t('clinics.filtersOn', { n: count }) : t('clinics.filters')}
            </Button>
          </div>
          {fromPlan && <p className="field-note ok-text"><Check size={14} aria-hidden /> {t('clinics.fromPlan')}</p>}
        </Item>

        <Item className="results-head">
          <p className="count" aria-live="polite">
            <CountUp key={hits.length} to={hits.length} duration={0.4} /> {hits.length === 1 ? t('clinics.placeWord') : t('clinics.placesWord')}
          </p>
          <button type="button" className="link link-target" onClick={() => setSavedOnly((v) => !v)}>
            <Star size={14} aria-hidden fill={savedOnly ? 'currentColor' : 'none'} /> {savedOnly ? t('clinics.showAll') : t('clinics.showSaved')}
          </button>
        </Item>

        {anyStale() && <Item><Banner tone="quiet" icon={<Clock size={18} />}>{t('clinics.stale')}</Banner></Item>}

        {hits.length === 0 && !blocked ? (
          <Item>
            <Card className="empty-card">
              <motion.span className="empty-icon" initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={bouncy} aria-hidden><SearchX size={36} /></motion.span>
              <h2>{savedOnly && !favorites.length ? t('clinics.savedTitle') : t('clinics.noneTitle')}</h2>
              <p>{savedOnly && !favorites.length ? t('clinics.savedEmpty') : t('clinics.noneBody')}</p>
              {count > 0 && <Button variant="secondary" onClick={() => setFilters(noFilters())}>{t('clinics.clearAll')}</Button>}
            </Card>
          </Item>
        ) : (
          <motion.div className="stack" variants={stagger(0.05)} initial="hidden" animate="show" key={`${filters.tests.join()}-${count}-${savedOnly}-${zip}-${!!gps}`}>
            {hits.slice(0, 40).map((h) => <ClinicCard key={h.site.id} site={h.site} miles={h.miles} />)}
          </motion.div>
        )}

        <Item>
          <h2 className="section-h"><Truck size={20} aria-hidden /> {t('clinics.eventsTitle')}</h2>
        </Item>
        {upcoming.length === 0 && <Item><p className="small muted">{t('clinics.eventsNone')}</p></Item>}
        {upcoming.map((e) => (
          <Item key={e.id}>
            <Card className="event">
              <p className="event-date"><CalendarDays size={16} aria-hidden /> {formatDate(e.date, lang)} {e.time && `· ${tx(e.time)}`}</p>
              <h3>{tx(e.title)}</h3>
              <p>{e.place}{e.address ? `, ${e.address}` : ''}</p>
              <ActionButton action={{ type: e.register.type, value: e.register.value, label: e.register.label }} />
            </Card>
          </Item>
        ))}
        {events.programs.map((p) => (
          <Item key={p.id}>
            <Card className="program" variants={pop}>
              <h3>{tx(p.name)}</h3>
              <p>{tx(p.desc)}</p>
              <p className="small"><strong>{t('clinics.areas')}:</strong> {tx(p.areas)}</p>
              <p className="small"><strong>{t('clinics.howToJoin')}:</strong> {tx(p.howTo)}</p>
              <div className="stack-sm">
                {p.contact.map((c, i) => <ActionButton key={i} action={{ type: c.type, value: c.value, label: c.label }} compact />)}
              </div>
            </Card>
          </Item>
        ))}
        <Item><p className="small muted">{t('clinics.confirm')} {t('app.disclaimer')}</p></Item>
      </Stagger>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t('clinics.filters')}>
        <div className="filter-sheet">
          <p className="mini-label">{t('clinics.fTest')}</p>
          <div className="chips-row">{TESTS.map((x) => <FilterChip key={x} on={filters.tests.includes(x)} onClick={() => toggleTest(x)}>{t(`clinics.tests.${x}`)}</FilterChip>)}</div>
          <p className="mini-label">{t('clinics.fCost')}</p>
          <div className="chips-row">
            <FilterChip on={filters.uninsured} onClick={() => flip('uninsured')}>{t('clinics.costUninsured')}</FilterChip>
            <FilterChip on={filters.sliding} onClick={() => flip('sliding')}>{t('clinics.costSliding')}</FilterChip>
            <FilterChip on={filters.ewl} onClick={() => flip('ewl')}>{t('clinics.costEwl')}</FilterChip>
            <FilterChip on={filters.medicaid} onClick={() => flip('medicaid')}>{t('clinics.costMedicaid')}</FilterChip>
          </div>
          <p className="mini-label">{t('clinics.fLanguage')}</p>
          <div className="chips-row"><FilterChip on={filters.spanish} onClick={() => flip('spanish')}>{t('clinics.langSpanish')}</FilterChip></div>
          <p className="mini-label">{t('clinics.fAccess')}</p>
          <div className="chips-row">
            <FilterChip on={filters.bus} onClick={() => flip('bus')}>{t('clinics.accessBus')}</FilterChip>
            <FilterChip on={filters.hours} onClick={() => flip('hours')}>{t('clinics.accessHours')}</FilterChip>
          </div>
          <div className="sheet-actions">
            <Button variant="secondary" onClick={() => setFilters(noFilters())}>{t('clinics.clearAll')}</Button>
            <Button onClick={() => setSheet(false)}>{t('clinics.count', { n: hits.length })}</Button>
          </div>
        </div>
      </Sheet>

      <Sheet open={!!detail} onClose={() => goBack('/clinics')} labelledBy="clinic-title">
        {detail && <ClinicDetail site={detail} />}
      </Sheet>
    </Screen>
  );
}
