import { motion } from 'motion/react';
import {
  AArrowDown, AArrowUp, ArrowRight, BookOpen, Check, Database, EyeOff, FileText, HandHelping, History, Mail,
  Send, ShieldCheck, Stethoscope, Trash, UserRound,
} from 'lucide-react';
import { Screen } from '../components/Screen';
import { LogoMark } from '../components/Brand';
import { Button, Card, Item, Stagger, cx } from '../components/ui';
import { ExtLink, LinkButton, Segmented, toast, TwoTap } from '../components/widgets';
import { useT } from '../app/i18n';
import { navigate } from '../app/router';
import { useApp, type Theme } from '../state/store';
import { meta } from '../engine/content';
import { formatDate } from '../engine/format';
import { bouncy, rise, spring, stagger } from '../motion/presets';

function SettingsTabs({ value }: { value: string }) {
  const { t } = useT();
  return (
    <div className="plan-tabs">
      <Segmented group="settings" label={t('app.privacyIcon')} value={value} onChange={(id) => navigate(`/${id}`, { replace: true })}
        items={[{ id: 'privacy', label: t('privacy.segPrivacy') }, { id: 'language', label: t('privacy.segLanguage') }, { id: 'about', label: t('privacy.segAbout') }]} />
    </div>
  );
}

function Privacy() {
  const { t, lang } = useT();
  const deleteAll = useApp((s) => s.deleteAll);
  const rows = [
    { icon: <Database size={22} />, title: t('privacy.storedTitle'), body: t('privacy.storedBody') },
    { icon: <EyeOff size={22} />, title: t('privacy.neverTitle'), body: t('privacy.neverBody') },
    { icon: <Send size={22} />, title: t('privacy.sentTitle'), body: t('privacy.sentBody') },
    { icon: <Trash size={22} />, title: t('privacy.deleteTitle'), body: t('privacy.deleteBody') },
  ];
  return (
    <Stagger className="stack">
      <Item className="privacy-hero">
        <motion.span className="privacy-shield" aria-hidden initial={{ scale: 0.5, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={bouncy}>
          <ShieldCheck size={44} strokeWidth={1.6} />
        </motion.span>
        <h1 className="screen-title">{t('privacy.headline')}</h1>
      </Item>
      {rows.map((r, i) => (
        <Item key={i}>
          <Card className="privacy-row">
            <span className="privacy-icon" aria-hidden>{r.icon}</span>
            <div><h2>{r.title}</h2><p>{r.body}</p></div>
          </Card>
        </Item>
      ))}
      <Item>
        <TwoTap label={t('privacy.deleteAll')} armedLabel={t('privacy.deleteArmed')} icon={<Trash size={18} aria-hidden />}
          onConfirm={() => { deleteAll(); toast(t('privacy.deleted')); }} />
      </Item>
      <Item>
        <Button full variant="secondary" icon={<FileText size={20} aria-hidden />} onClick={() => navigate('/policy')} iconRight={<ArrowRight size={18} aria-hidden />}>
          {t('privacy.policy')}
        </Button>
        <p className="small muted center">{t('privacy.policyUpdated', { date: formatDate(meta.contentUpdated, lang) })}</p>
      </Item>
    </Stagger>
  );
}

function Language() {
  const { t } = useT();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  return (
    <Stagger className="stack">
      <Item><h1 className="screen-title">{t('language.headline')}</h1></Item>
      <Item>
        <div className="lang-cards" role="radiogroup" aria-label={t('language.choose')}>
          {(['en', 'es'] as const).map((l) => (
            <motion.button key={l} type="button" role="radio" aria-checked={lang === l} lang={l} className={cx('lang-card', lang === l && 'lang-card-on')}
              onClick={() => setLang(l)} whileTap={{ scale: 0.97 }} transition={spring}>
              <span className="lang-code">{l.toUpperCase()}</span>
              <span className="lang-name">{l === 'en' ? t('language.english') : t('language.spanish')}</span>
              {lang === l && <motion.span layoutId="lang-check" className="lang-check" transition={spring}><Check size={18} aria-hidden /></motion.span>}
            </motion.button>
          ))}
        </div>
      </Item>
      <Item>
        <Card tone={meta.spanish.status === 'reviewed' ? 'ok' : 'warn'}>
          <p className="mini-label">{t('language.coverageTitle')}</p>
          <p>{meta.spanish.status === 'reviewed' ? t('language.coverageReviewed') : t('language.coverageDraft')}</p>
          <p className="small muted">{t('language.quotesNote')}</p>
        </Card>
      </Item>
    </Stagger>
  );
}

function About() {
  const { t, lang } = useT();
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const textScale = useApp((s) => s.textScale);
  const setTextScale = useApp((s) => s.setTextScale);
  const helper = useApp((s) => s.helper);
  const setHelper = useApp((s) => s.setHelper);
  const resetIntro = useApp((s) => s.resetIntro);
  const r = meta.clinicalReviewer;
  return (
    <Stagger className="stack">
      <Item className="about-hero">
        <LogoMark size={64} animate />
        <h1 className="screen-title">{t('about.headline')}</h1>
      </Item>

      <Item>
        <Card>
          <dl className="detail-list">
            <div><dt>{t('about.version')}</dt><dd>{meta.appVersion}</dd></div>
            <div><dt>{t('about.contentVersion')}</dt><dd>{meta.contentVersion}</dd></div>
            <div><dt><Stethoscope size={15} aria-hidden /> {t('about.reviewer')}</dt>
              <dd>{r.name ? <>{r.name}{r.credentials ? `, ${r.credentials}` : ''}{r.reviewedOn && <span className="basis">{t('about.reviewedOn', { date: formatDate(r.reviewedOn, lang) })}</span>}</> : <span className="pending">{t('about.reviewerPending')}</span>}</dd>
            </div>
          </dl>
        </Card>
      </Item>

      <Item>
        <Card>
          <p className="mini-label">{t('about.appearance')}</p>
          <Segmented group="theme" label={t('about.appearance')} value={theme} onChange={(v) => setTheme(v as Theme)}
            items={[{ id: 'system', label: t('about.themeSystem') }, { id: 'light', label: t('about.themeLight') }, { id: 'dark', label: t('about.themeDark') }]} />
          <p className="mini-label">{t('about.textSize')}</p>
          <div className="text-size">
            <motion.button type="button" className="icon-btn big" onClick={() => setTextScale(textScale - 0.1)} disabled={textScale <= 0.9} aria-label={t('about.textSmaller')} whileTap={{ scale: 0.88 }}><AArrowDown size={22} /></motion.button>
            <div className="text-size-track" aria-hidden><motion.span animate={{ scaleX: (textScale - 0.9) / 1.1 }} transition={spring} /></div>
            <motion.button type="button" className="icon-btn big" onClick={() => setTextScale(textScale + 0.1)} disabled={textScale >= 2} aria-label={t('about.textLarger')} whileTap={{ scale: 0.88 }}><AArrowUp size={22} /></motion.button>
            <span className="text-size-value">{Math.round(textScale * 100)}%</span>
          </div>
          <p className="mini-label">{t('about.helper')}</p>
          <button type="button" role="switch" aria-checked={helper} className={cx('switch-row')} onClick={() => setHelper(!helper)}>
            <HandHelping size={20} aria-hidden />
            <span>{t('about.helperNote')}</span>
            <span className={cx('switch', helper && 'switch-on')} aria-hidden><motion.span layout transition={spring} /></span>
          </button>
        </Card>
      </Item>

      <Item>
        <Card>
          <p className="mini-label"><BookOpen size={14} aria-hidden /> {t('about.orgs')}</p>
          <motion.ul className="orgs" variants={stagger(0.03)} initial="hidden" animate="show">
            {meta.guidelineOrgs.map((o) => (
              <motion.li key={o.name} variants={rise}><ExtLink href={o.url} className="link link-target">{o.name}</ExtLink></motion.li>
            ))}
          </motion.ul>
        </Card>
      </Item>

      <Item>
        <Card>
          <p className="mini-label"><Database size={14} aria-hidden /> {t('about.dataTitle')}</p>
          <p>{t('about.dataBody')}</p>
          <ul className="orgs">
            <li><ExtLink href={meta.productData.url} className="link link-target">{meta.productData.name}</ExtLink></li>
            <li><ExtLink href={meta.productData.licenseUrl} className="link link-target">{meta.productData.license}</ExtLink></li>
          </ul>
        </Card>
      </Item>

      <Item>
        <Card>
          <p className="mini-label"><History size={14} aria-hidden /> {t('about.changelog')}</p>
          <ol className="changelog">
            {meta.changelog.map((c, i) => <li key={i}><span className="muted">{formatDate(c.date, lang)}</span> {c[lang]}</li>)}
          </ol>
        </Card>
      </Item>

      <Item>
        <Card tone="quiet">
          <p className="mini-label">{t('about.disclaimerTitle')}</p>
          <p>{t('about.disclaimerBody')}</p>
        </Card>
      </Item>

      <Item className="stack-sm">
        <LinkButton href={`mailto:${meta.feedbackEmail}?subject=FutureVitals%20feedback`} value={meta.feedbackEmail} full variant="secondary" icon={<Mail size={20} aria-hidden />}>{t('about.feedback')}</LinkButton>
        <p className="small muted center">{t('about.feedbackNote')}</p>
        <Button full variant="ghost" icon={<UserRound size={20} aria-hidden />} onClick={() => { resetIntro(); navigate('/start'); }}>{t('about.beforeStart')}</Button>
      </Item>
    </Stagger>
  );
}

export function SettingsScreen({ section }: { section: 'privacy' | 'language' | 'about' }) {
  return (
    <Screen id={`settings-${section}`} back="/" top={<SettingsTabs value={section} />}>
      <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        {section === 'privacy' ? <Privacy /> : section === 'language' ? <Language /> : <About />}
      </motion.div>
    </Screen>
  );
}

export function PolicyScreen() {
  const { t, raw, lang } = useT();
  const sections = (raw('policy.sections') as { h: string; p: string }[]) || [];
  return (
    <Screen id="policy" back="/privacy" title={t('privacy.policy')} lead={t('privacy.policyUpdated', { date: formatDate(meta.contentUpdated, lang) })} readingProgress>
      <Stagger className="stack chapter">
        <Item><p>{t('policy.intro')}</p></Item>
        {sections.map((s, i) => (
          <Item key={i} className="chapter-section"><h2>{s.h}</h2><p>{s.p}</p></Item>
        ))}
        <Item><p className="small muted">{meta.feedbackEmail}</p></Item>
      </Stagger>
    </Screen>
  );
}
