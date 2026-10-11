import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, animate, motion } from 'motion/react';
import { canGoBack, goBack, isRootPath, tabOf, useRoute, type Route } from './app/router';
import { useApp } from './state/store';
import { translate } from './app/i18n';
import { screenVariants, type NavKind } from './motion/presets';
import { Splash } from './components/Brand';
import { TabBar } from './components/TabBar';
import { PhoneStatusBar } from './components/PhoneFrame';
import { Toasts } from './components/widgets';
import { setStatusBar, wireBackButton } from './platform/native';
import { Welcome } from './screens/Welcome';
import { BeforeStart } from './screens/BeforeStart';
import { CheckFlow } from './screens/check/CheckFlow';
import { PlanScreen } from './screens/Plan';
import { RiskScreen } from './screens/Risk';
import { CompareScreen } from './screens/Compare';
import { CancerPage, PreventionScreen } from './screens/Prevention';
import { ChapterScreen, LearnScreen } from './screens/Learn';
import { FoodScreen } from './screens/Food';
import { ScannerScreen } from './screens/Scanner';
import { ClinicsScreen } from './screens/Clinics';
import { PolicyScreen, SettingsScreen } from './screens/Settings';
import { IN_ARTIFACT } from './platform/env';

/** The embedded viewer's own theme attribute, kept while the app overrides it. */
let hostTheme: string | null | undefined;

function screenFor(r: Route): { key: string; node: ReactNode } {
  const [a, b] = r.parts;
  switch (a) {
    case undefined: return { key: 'home', node: <Welcome /> };
    case 'start': return { key: 'start', node: <BeforeStart /> };
    case 'check': return { key: 'check', node: <CheckFlow step={Number(b) || 1} /> };
    case 'plan': return { key: 'plan', node: <PlanScreen /> };
    case 'risk': return { key: 'risk', node: <RiskScreen view={r.query.get('view') === 'answers' ? 'answers' : 'scores'} /> };
    case 'compare': return { key: 'compare', node: <CompareScreen /> };
    case 'prevention': return b ? { key: `cancer-${b}`, node: <CancerPage id={b} /> } : { key: 'prevention', node: <PreventionScreen /> };
    case 'learn': return b ? { key: `learn-${b}`, node: <ChapterScreen id={b} /> } : { key: 'learn', node: <LearnScreen /> };
    case 'food': return { key: 'food', node: <FoodScreen /> };
    case 'scan': return { key: 'scan', node: <ScannerScreen /> };
    // The clinic detail opens as a sheet over the list, so both share one key.
    case 'clinics': return { key: 'clinics', node: <ClinicsScreen openId={b} query={r.query} /> };
    case 'privacy': case 'language': case 'about': return { key: `settings-${a}`, node: <SettingsScreen section={a} /> };
    case 'policy': return { key: 'policy', node: <PolicyScreen /> };
    default: return { key: 'home', node: <Welcome /> };
  }
}

function navKind(route: Route, from: Route | null, direction: number): NavKind {
  if (!from) return 'none';
  const sameTab = tabOf(route.path) === tabOf(from.path);
  if (isRootPath(route.path) && isRootPath(from.path) && (!sameTab || direction === 0)) return 'tab';
  if (direction === 0) return 'tab';
  return direction > 0 ? 'push' : 'pop';
}

export default function App() {
  const { route, direction, from } = useRoute();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const textScale = useApp((s) => s.textScale);
  const seenIntro = useApp((s) => s.seenIntro);
  const hydrated = useApp((s) => s.hydrated);
  const [splashDone, setSplashDone] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const firstLang = useRef(true);

  // Theme, language and text size.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    if (theme !== 'system') {
      // Inside an embedded preview the viewer may have chosen light or dark
      // itself; remember that choice so "Same as phone" can give it back.
      if (IN_ARTIFACT && hostTheme === undefined) hostTheme = root.getAttribute('data-theme');
      root.setAttribute('data-theme', theme);
    } else if (!IN_ARTIFACT) {
      root.removeAttribute('data-theme');
    } else if (hostTheme !== undefined) {
      if (hostTheme) root.setAttribute('data-theme', hostTheme);
      else root.removeAttribute('data-theme');
      hostTheme = undefined;
    }
    root.style.setProperty('--text-scale', String(textScale));
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setStatusBar(dark);
    document.title = translate(lang, 'app.name');
  }, [lang, theme, textScale]);

  // A switch of language gives the whole screen a quick soft fade, so the
  // change of every word at once reads as intended rather than as a glitch.
  useEffect(() => {
    if (firstLang.current) { firstLang.current = false; return; }
    if (shell.current) animate(shell.current, { opacity: [0.35, 1] }, { duration: 0.35 });
  }, [lang]);

  useEffect(() => {
    wireBackButton(() => {
      if (!canGoBack()) return false;
      goBack('/');
      return true;
    });
  }, []);

  const onSplashDone = useCallback(() => setSplashDone(true), []);
  const { key, node } = screenFor(route);
  const kind = navKind(route, from, direction);
  const showTabs = !/^\/(check|start|policy)/.test(route.path);

  return (
    <MotionConfig reducedMotion="user">
      <div className="stage">
        {/* On a desktop the app sits in a drawn phone; on a phone these wrappers vanish (display: contents). */}
        <div className="phone">
          <div className="phone-glass">
            <PhoneStatusBar />
            <div className="device" ref={shell}>
              <a className="skip-link" href="#main">{translate(lang, 'app.skip')}</a>
              <div className="screens">
                {hydrated && (
                  <AnimatePresence initial={false} custom={kind}>
                    <motion.div key={key} className="screen-wrap" custom={kind} variants={screenVariants} initial="enter" animate="center" exit="exit">
                      {node}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
              <AnimatePresence>{showTabs && hydrated && <TabBar key="tabs" />}</AnimatePresence>
              <Toasts />
              <div id="sheet-root" />
              {!splashDone && <Splash quick={seenIntro} onDone={onSplashDone} />}
            </div>
            <div className="phone-home" aria-hidden />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
