#!/usr/bin/env node
// Accessibility audit (spec: WCAG 2.2 AA, 44 px targets, axe-core clean).
// Opens every screen of the production build with a sample person and:
//   1. lists any button, link or control smaller than 44 x 44 px, at 100%
//      and 200% text (links inside a sentence are part of the text, and
//      WCAG exempts them);
//   2. runs axe-core's WCAG 2.0 to 2.2 A and AA rules, in light and dark.
//
//   npm run build && npm run a11y
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const MIN = 44;
const ROUTES = ['/', '/start', '/check/1', '/check/2', '/check/3', '/check/4', '/check/5', '/check/6', '/plan', '/risk', '/compare',
  '/prevention', '/prevention/colorectal', '/clinics', '/clinics/dp-grace', '/learn', '/learn/stages', '/food', '/scan', '/risk?view=answers',
  '/privacy', '/language', '/about', '/scan?result', '/scan?search'];
// Screens reached by doing something rather than by address: a product's
// result (with its grade and How the grade works open) and a search list.
const FLOWS = {
  '/scan?result': async (page) => {
    await page.locator('#barcode').fill('044700019887');
    await page.getByRole('button', { name: 'Look up' }).first().click();
    await page.locator('.grade-card').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'How the grade works' }).click();
  },
  '/scan?search': async (page) => {
    await page.getByRole('button', { name: 'Search by name' }).first().click();
    await page.locator('#q').fill('bacon');
    await page.locator('.product-hit').first().waitFor({ timeout: 15000 });
  },
};

const persona = {
  lang: 'en', theme: 'light', textScale: 1, seenIntro: true, helper: false,
  answers: {
    emergencies: [], symptoms: ['sym_cough'], age: '60-64', sex: 'female', gender: null,
    famCancers: ['colorectal', 'breast'], famClose: 'yes', famYoung: 'no', history: ['polyps'], hpv: 'unsure',
    smoke: 'current', packsPerDay: 1, yearsSmoked: 30, quit: null, alcohol: '8to14', activity: 'lt60',
    heightFt: 5, heightIn: 5, weightLb: 172, bodySkip: false, procMeat: 'some', redMeat: 'most', plants: 'some',
    radon: 'never', sun: 'sometimes',
  },
  step: 1, checkDone: true, planUpdated: '2026-09-28T15:00:00.000Z', tryThis: ['activity'],
  foodLog: { 0: { proc: 1, veg: 2 }, 1: { red: 1, fiber: 2 }, 2: { sugary: 1, legume: 1 } },
  favorites: ['dp-grace'], zip: '23220',
};

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

const server = await preview({ root: ROOT, preview: { port: 4193, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: exe, headless: true });
const small = new Map();
const axeFound = new Map();

for (const [scale, theme] of [[1, 'light'], [2, 'light'], [1, 'dark']]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, colorScheme: theme,
  });
  await context.addInitScript((s) => {
    try { localStorage.setItem('fv2', JSON.stringify({ state: s, version: 2 })); } catch { /* blocked */ }
  }, { ...persona, textScale: scale, theme });

  for (const route of ROUTES) {
    const page = await context.newPage();
    await page.goto(`${base}#${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    if (FLOWS[route]) {
      await FLOWS[route](page);
      await page.waitForTimeout(900);
    }

    const tooSmall = await page.evaluate((min) => {
      const out = [];
      const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=checkbox], [role=tab], [role=switch]';
      for (const el of document.querySelectorAll(sel)) {
        if (el.closest('[aria-hidden="true"], .print-only, #boot')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
        const parent = el.parentElement;
        const inline = (el.tagName === 'A' || el.classList.contains('link')) && parent
          && /^(P|LI|SPAN|FIGCAPTION|DD|SMALL|EM)$/.test(parent.tagName)
          && parent.textContent.trim().length > el.textContent.trim().length + 2;
        if (inline) continue;
        if (el.type === 'radio' || el.type === 'checkbox') continue; // the visible label is the target
        if (r.width < min - 0.5 || r.height < min - 0.5) {
          const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
          out.push({ key: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${name}"`, size: `${Math.round(r.width)}x${Math.round(r.height)}` });
        }
      }
      return out;
    }, MIN);
    for (const t of tooSmall) if (!small.has(t.key)) small.set(t.key, `${t.key} ${t.size}  [${route} @${scale * 100}%]`);

    if (scale === 1) {
      // Let entrance animations settle so colors are measured at rest.
      await page.waitForTimeout(1200);
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((v) => ({
          id: v.id,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + (n.any[0] && n.any[0].message ? ` (${n.any[0].message.slice(0, 100)})` : '')),
        }));
      });
      for (const v of violations) {
        const key = `${v.id} ${theme}`;
        if (!axeFound.has(key)) axeFound.set(key, { ...v, where: `${route} ${theme}` });
      }
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));

if (small.size) {
  console.log(`${small.size} controls under ${MIN} px:`);
  for (const v of small.values()) console.log(`  ${v}`);
  process.exitCode = 1;
} else {
  console.log(`Every control is at least ${MIN} x ${MIN} px on every screen, at 100% and 200% text.`);
}
if (axeFound.size) {
  console.log(`axe-core: ${axeFound.size} WCAG rule(s) failed:`);
  for (const v of axeFound.values()) {
    console.log(`  ${v.id} [${v.where}] ${v.help}`);
    for (const n of v.nodes) console.log(`    ${n}`);
  }
  process.exitCode = 1;
} else {
  console.log(`axe-core: no WCAG 2.2 A or AA violations on ${ROUTES.length} screens, light and dark.`);
}
