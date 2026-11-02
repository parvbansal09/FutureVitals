#!/usr/bin/env node
// Screenshots of every screen, for design review and store listings. Serves
// the production build and drives the Microsoft Edge (or Chrome) already on
// this machine through playwright-core, so no browser download is needed.
//
//   npm run build && npm run shots
//   node scripts/screenshots.mjs --dark --es --only=plan,risk
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'screenshots');
const args = process.argv.slice(2);
const dark = args.includes('--dark');
const es = args.includes('--es');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const scrolls = Number((args.find((a) => a.startsWith('--scrolls=')) || '--scrolls=2').slice(10));
const fresh = args.includes('--fresh');

// A sample person: 60, smokes, family history, a few habits to change.
const persona = {
  lang: es ? 'es' : 'en', theme: dark ? 'dark' : 'light', textScale: 1, seenIntro: true, helper: false,
  answers: {
    emergencies: [], symptoms: ['sym_cough'], age: '60-64', sex: 'female', gender: null,
    famCancers: ['colorectal', 'breast'], famClose: 'yes', famYoung: 'no', history: ['polyps'], hpv: 'unsure',
    smoke: 'current', packsPerDay: 1, yearsSmoked: 30, quit: null, alcohol: '8to14', activity: 'lt60',
    heightFt: 5, heightIn: 5, weightLb: 172, bodySkip: false, procMeat: 'some', redMeat: 'most', plants: 'some',
    radon: 'never', sun: 'sometimes',
  },
  step: 1, checkDone: true, planUpdated: '2026-09-28T15:00:00.000Z', tryThis: ['activity'],
  foodLog: { 0: { proc: 1, veg: 2, fruit: 1 }, 1: { red: 1, fiber: 2 }, 2: { sugary: 1, veg: 1, legume: 1 } },
  favorites: ['dp-grace'], zip: '23220',
};

const ROUTES = [
  ['welcome', '/'],
  ['start', '/start'],
  ['check-1', '/check/1'],
  ['check-2', '/check/2'],
  ['check-5', '/check/5'],
  ['check-6', '/check/6'],
  ['plan', '/plan'],
  ['risk', '/risk'],
  ['risk-calculator', '/risk?view=answers'],
  ['compare', '/compare'],
  ['prevention', '/prevention'],
  ['cancer', '/prevention/colorectal'],
  ['clinics', '/clinics'],
  ['clinic-detail', '/clinics/dp-grace'],
  ['learn', '/learn'],
  ['chapter', '/learn/stages'],
  ['food', '/food'],
  ['scan', '/scan'],
  ['privacy', '/privacy'],
  ['language', '/language'],
  ['about', '/about'],
];

function findBrowser() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

const server = await preview({ root: ROOT, preview: { port: 4179, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const executablePath = findBrowser();
if (!executablePath) throw new Error('No Edge or Chrome found for screenshots.');
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: dark ? 'dark' : 'light',
  locale: es ? 'es-US' : 'en-US',
  hasTouch: true,
  isMobile: true,
});
if (!fresh) {
  await context.addInitScript((state) => {
    try { localStorage.setItem('fv2', JSON.stringify({ state, version: 2 })); } catch { /* ignore */ }
  }, persona);
}
fs.mkdirSync(OUT, { recursive: true });
const suffix = `${dark ? '-dark' : ''}${es ? '-es' : ''}${fresh ? '-fresh' : ''}`;
const errors = [];

for (const [name, route] of ROUTES) {
  if (only.length && !only.includes(name)) continue;
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(`${base}#${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2300);
  await page.screenshot({ path: path.join(OUT, `${name}${suffix}.png`) });
  for (let i = 1; i <= scrolls; i++) {
    const moved = await page.evaluate((n) => {
      const el = [...document.querySelectorAll('.screen')].pop();
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTo({ top: n * (el.clientHeight - 140), behavior: 'instant' });
      return el.scrollTop !== before;
    }, i);
    if (!moved) break;
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${name}${suffix}-${i}.png`) });
  }
  await page.close();
  process.stdout.write(`${name} `);
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(`\nscreenshots -> ${path.relative(ROOT, OUT)}`);
if (errors.length) {
  console.log('\nPage errors:');
  for (const e of [...new Set(errors)]) console.log('  ' + e);
}
