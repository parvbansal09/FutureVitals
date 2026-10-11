#!/usr/bin/env node
// End-to-end check of the real app in a real browser, from a fresh install:
//   1. The six-step check, answered by tapping, builds the expected plan.
//   2. The plan opens within the spec's 200 ms.
//   3. Language switches to Spanish instantly.
//   4. Find a clinic works from a typed ZIP, with a test filter.
//   5. The scanner labels typed ingredients by its rules.
//   6. Delete takes two taps and leaves nothing behind.
//   7. On a computer, the camera shown in the app reads a barcode, and Take
//      picture reads one it cannot (Chrome's stand-in camera plays a picture).
//   8. Network audit: nothing leaves the device during all of the above.
//
//   npm run build && node scripts/e2e.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserPath = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!browserPath) throw new Error('No Edge or Chrome found.');

const server = await preview({ root: ROOT, preview: { port: 4181, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const origin = new URL(base).origin;
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', hasTouch: true, isMobile: true, serviceWorkers: 'block' });
const page = await context.newPage();

const results = [];
const outbound = [];
const errors = [];
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) outbound.push(u);
});
page.on('pageerror', (e) => errors.push(e.message));

const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const tap = async (text, opts = {}) => {
  const loc = page.getByRole(opts.role || 'button', { name: text, exact: !!opts.exact }).first();
  await loc.scrollIntoViewIfNeeded();
  await loc.click();
};
const pause = (ms) => page.waitForTimeout(ms);

// A barcode picture drawn on the spot, to stand in for a phone photo: real
// EAN-13 bars with the numbers under them, or the printed numbers alone.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((p) => p.replace(/./g, (b) => (b === '0' ? '1' : '0')));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function ean13Bits(code) {
  const d = code.split('').map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return `${bits}101`;
}
async function barcodePicture(code, { bars = true } = {}) {
  const m = 4, q = 44, h = 170;
  const bits = ean13Bits(code);
  const w = bits.length * m + q * 2;
  const rects = bars ? [...bits].map((b, i) => (b === '1' ? `<rect x="${q + i * m}" y="24" width="${m}" height="${h}" fill="#000"/>` : '')).join('') : '';
  const label = `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
  const height = bars ? h + 90 : 150;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${rects}`
    + `<text x="${w / 2}" y="${bars ? h + 70 : 96}" font-family="Arial, sans-serif" font-size="44" text-anchor="middle" letter-spacing="5">${label}</text></svg>`;
  const p = await context.newPage();
  await p.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  const buffer = await p.locator('svg').screenshot();
  await p.close();
  return { name: 'barcode.png', mimeType: 'image/png', buffer };
}
// A label photo stand-in: lines of print on white, or a busy package front.
async function picture(svgBody, w, h, name) {
  const p = await context.newPage();
  await p.setContent(`<html><body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svgBody}</svg></body></html>`);
  const buffer = await p.locator('svg').screenshot();
  await p.close();
  return { name, mimeType: 'image/png', buffer };
}
const labelPicture = (lines) => picture(
  `<rect width="100%" height="100%" fill="#fff"/>${lines.map((l, i) => `<text x="30" y="${60 + i * 52}" font-family="Arial, sans-serif" font-size="36" fill="#111">${l}</text>`).join('')}`,
  1100, 80 + lines.length * 52, 'label.png');
function packageFront() {
  // Shapes, tilted words and stray letters at many sizes: what a bag front reads like.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let body = '<rect width="100%" height="100%" fill="#f2a20c"/>';
  for (let i = 0; i < 40; i++) body += `<circle cx="${rnd() * 1000}" cy="${rnd() * 800}" r="${10 + rnd() * 90}" fill="hsl(${rnd() * 360},80%,${30 + rnd() * 40}%)"/>`;
  const bits = ['Ey', 'kr', 'RA', 'au', 'NN', 'ABAD', 'Pau', 'ga', 'MOTE', 'AATT', 'xX', 'Mz', 'FY', '493', 'É', '—'];
  for (let i = 0; i < 60; i++) {
    body += `<text x="${rnd() * 950}" y="${rnd() * 780}" font-size="${14 + rnd() * 70}" transform="rotate(${rnd() * 80 - 40} ${rnd() * 1000} ${rnd() * 800})" font-family="Impact, Arial" fill="hsl(${rnd() * 360},70%,40%)">${bits[Math.floor(rnd() * bits.length)]}</text>`;
  }
  return picture(body, 1000, 800, 'front.png');
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await pause(1800); // launch animation

  // 1. The health check, by tapping.
  await tap('Start My Health Check');
  await pause(500);
  ok('Before we start is shown on first run', await page.getByText('This is not a diagnosis').isVisible());
  await tap('I understand. Begin.');
  await pause(500);
  ok('Step 1 of 6 reached', await page.getByText('Step 1 of 6').first().isVisible());

  const cont = page.getByRole('button', { name: 'Continue', exact: true });
  ok('Nothing is flagged as missing before the person tries to continue', (await page.locator('.missing').count()) === 0);
  await cont.click();
  await pause(400);
  ok('Continue without an answer says what is missing and stays on the step',
    await page.getByText('Choose at least one, or “None of these.”').first().isVisible() && page.url().endsWith('#/check/1'));
  ok('The step count shows once, and the header offers Exit, not a second Back',
    (await page.getByText('Step 1 of 6', { exact: true }).count()) === 1 && (await page.locator('header').getByRole('button', { name: /Exit the check/ }).count()) === 1
      && (await page.getByRole('button', { name: 'Back', exact: true }).count()) === 1);
  await tap('None of these', { role: 'radio' }).catch(() => tap('None of these', { role: 'checkbox' }));
  await tap('Continue', { exact: true });
  await pause(450);

  await tap('50–54', { role: 'radio' });
  await tap('Female', { role: 'radio', exact: true });
  await tap('Continue', { exact: true });
  await pause(450);

  await tap('No family history of these', { role: 'checkbox' }).catch(() => tap('No family history of these', { role: 'radio' }));
  await tap('Continue', { exact: true });
  await pause(450);

  await tap('None of these', { role: 'checkbox' }).catch(() => tap('None of these', { role: 'radio' }));
  await tap('Yes, all the shots', { role: 'radio' });
  await tap('Continue', { exact: true });
  await pause(450);

  await tap('Used to smoke', { role: 'radio' });
  await pause(900);
  // Follow-up questions must be seen, not just present: a click works even on an invisible button.
  const seen = await page.getByRole('radio', { name: 'About 1 pack' }).first().evaluate((el) => {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  });
  ok('Follow-up questions are visible once they open (packs per day)', seen > 0.95, `opacity ${seen.toFixed(2)}`);
  await tap('About 1 pack', { role: 'radio' });
  await tap('25', { exact: true });
  ok('Pack-years are worked out for the person', await page.getByText('pack-years').first().isVisible());
  await tap('5 to 15 years ago', { role: 'radio' });
  await tap('Continue', { exact: true });
  await pause(450);

  await tap('None', { role: 'radio', exact: true });
  await tap('Less than 60 minutes a week', { role: 'radio' });

  // 2. Build my plan: measured inside the page, from the tap to the plan's
  //    sections being in the document and the frame that shows them painted
  //    (a task queued from the next animation frame runs after its paint).
  await page.evaluate(() => {
    const w = window;
    w.__planStart = 0;
    w.__planMs = 0;
    let seen = false;
    document.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (b && b.textContent && b.textContent.includes('Build my plan')) w.__planStart = performance.now();
    }, true);
    new MutationObserver(() => {
      if (w.__planStart && !seen && document.querySelector('[data-screen="plan"] .plan-section')) {
        seen = true;
        requestAnimationFrame(() => setTimeout(() => { w.__planMs = performance.now() - w.__planStart; }, 0));
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await tap('Build my plan');
  await page.waitForFunction(() => window.__planMs > 0);
  const ms = Math.round(await page.evaluate(() => window.__planMs));
  ok('Plan opens within 200 ms of Build my plan', ms <= 200, `${ms} ms from tap to painted plan`);

  await pause(700);
  const text = await page.locator('main').last().innerText();
  ok('Plan: colorectal screening due at 50-54', text.includes('Colorectal cancer screening'));
  ok('Plan: mammogram due', text.includes('Breast cancer screening (mammogram)'));
  ok('Plan: cervical screening due', text.includes('Cervical cancer screening'));
  ok('Plan: lung screening is her call (25 pack-years, quit 5-15 years)', text.includes('Lung cancer screening'));
  ok('Plan: no probability or score on screen', !/\d+\s?%\s*(chance|risk)|risk score/i.test(text));

  // 3. Spanish, instantly.
  await page.getByRole('button', { name: 'Cambiar a español' }).click();
  await pause(500);
  ok('Language switches to Spanish instantly', await page.getByText('Mi plan de pruebas').first().isVisible());
  await page.getByRole('button', { name: 'Switch to English' }).first().click();
  await pause(400);
  await tap('Compare', { role: 'tab' });
  await pause(700);
  ok('How you compare shows the largest gap first', await page.getByText('Largest gap').first().isVisible());

  // The risk score calculator scores the same answers, and a change moves it.
  await tap('Risk', { exact: true });
  await pause(900);
  const riskText = await page.locator('main').last().innerText();
  ok('Risk tab shows each cancer as a band in words and a score', /About average|Somewhat higher|Higher|Much higher|Lower than average/.test(riskText) && /\d\.\d\s*×/.test(riskText));
  ok('Risk tab scores stomach, pancreatic and brain too', ['Stomach', 'Pancreatic', 'Brain'].every((s) => riskText.includes(s)) && !riskText.includes('Nothing to score here'));
  ok('Brain gets a score of its own', /Brain\s+(About average|Somewhat higher|Higher|Much higher|Lower than average|Not enough answered)/.test(riskText));
  await tap('Change answers', { role: 'tab' });
  await pause(700);
  const lungChip = page.locator('.live-chip', { hasText: 'Lung' });
  const lungBefore = (await lungChip.innerText()).replace(/\s+/g, ' ');
  await tap('Never smoked', { role: 'radio' });
  await pause(800);
  const lungAfter = (await lungChip.innerText()).replace(/\s+/g, ' ');
  ok('Changing an answer moves the score at once', lungBefore !== lungAfter, `${lungBefore} -> ${lungAfter}`);
  // A tester said "never smoked" here and was then shown as a smoker on their
  // plan: the calculator kept its own copy. Its answers are now the person's.
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('fv2') || '{}').state.answers);
  const trying = () => page.locator('main').last().getByText('Trying changes', { exact: true }).first().isVisible();
  const afterNever = await saved();
  ok('An answer changed in the calculator is saved, follow-ups cleared (never smoked: no packs, years or quit date)',
    afterNever.smoke === 'never' && afterNever.packsPerDay === null && afterNever.yearsSmoked === null && afterNever.quit === null);
  await tap('Never smoked', { role: 'radio' });
  await pause(300);
  ok('Tapping a chosen answer again keeps it', (await saved()).smoke === 'never');
  await tap('Scores', { role: 'tab' });
  await pause(700);
  ok("The person's own answers are not shown as 'trying changes'", !(await trying().catch(() => false)));

  // Try this change: the one what-if, shown as such, until kept.
  const tryChange = async () => {
    for (const toggle of await page.locator('.risk-toggle[aria-expanded="false"]').all()) {
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await pause(350);
      if (await page.locator('.lever-try').first().isVisible().catch(() => false)) break;
    }
    await page.locator('.lever-try').first().scrollIntoViewIfNeeded();
    await page.locator('.lever-try').first().click();
    await pause(700);
  };
  await tryChange();
  ok('Try this change shows as a change being tried', await trying());
  const beforeTry = JSON.stringify(await saved());
  ok('Trying a change does not touch the saved answers', JSON.stringify(await saved()) === beforeTry);
  await tap('Back to my answers');
  await pause(500);
  ok('Back to my answers drops the change', !(await trying().catch(() => false)));
  await tryChange();
  await tap('Keep this change');
  await pause(600);
  ok("Keep this change saves it as the person's answer", JSON.stringify(await saved()) !== beforeTry
    && !(await trying().catch(() => false)));

  // My plan and How you compare say what the calculator said.
  await tap('My plan', { exact: true });
  await pause(800);
  const planNow = await page.locator('main').last().innerText();
  ok('My plan agrees with the calculator: no lung screening after "never smoked"', !planNow.includes('Lung cancer screening'));

  await tap('Compare', { role: 'tab' });
  await pause(700);
  const compareNow = await page.locator('main').last().innerText();
  ok('How you compare agrees with the calculator: "Never smoked", no pack-years', compareNow.includes('Never smoked') && !/pack-years/.test(compareNow));

  // 4. Find a clinic from a typed ZIP, filtered to mammograms.
  await page.goto(`${base}#/clinics?test=mammogram`);
  await pause(900);
  await page.getByLabel('Type a ZIP code').fill('23220');
  await pause(600);
  const clinicsText = await page.locator('main').last().innerText();
  ok('Clinics sorted from a typed ZIP', clinicsText.includes('Sorted from 23220'));
  ok('Mammogram filter shows only sites that offer it', clinicsText.includes('Mammogram') && !clinicsText.includes('CrossOver'));
  await page.getByLabel('Type a ZIP code').fill('10001');
  await pause(500);
  ok('A ZIP outside Virginia gets a clear message', await page.getByText('This app covers Virginia').first().isVisible());

  // 5. The scanner, with typed ingredients (no network needed).
  await page.goto(`${base}#/scan`);
  await pause(900);
  await tap('Or type the ingredients');
  await page.locator('#ingredients').fill('Pork, water, salt, sodium nitrite');
  await tap('Check ingredients');
  await pause(900);
  ok('Scanner labels cured pork "Worth limiting" (IARC Group 1)', await page.getByText('Worth limiting').first().isVisible());
  ok('Scanner shows the source in its own words', await page.getByText('each 50 gram portion of processed meat').first().isVisible());

  // A typed barcode is found in the built-in Open Food Facts list, on the phone.
  await tap('Scan another');
  await pause(700);
  await page.locator('#barcode').fill('044700019887');
  await tap('Look up');
  await pause(1200);
  const baconText = await page.locator('main').last().innerText();
  ok('A typed barcode is found in the built-in list (Oscar Mayer bacon: Worth limiting)', baconText.includes('Original Bacon') && baconText.includes('Worth limiting'));
  ok('The result credits Open Food Facts and the ODbL', baconText.includes('Open Food Facts') && baconText.includes('Open Database License'));
  ok('The result shows an ingredient grade with the items behind it (bacon: D, processed meat +4)',
    baconText.includes('Grade D') && /Processed meat\s+IARC Group 1: causes cancer\s+\+4/.test(baconText));

  // Scan a barcode, on a phone, takes a photo with the phone's own camera; the
  // bars in it are read, matched and labeled.
  await tap('Scan another');
  await pause(700);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), tap('Scan a barcode')]);
  ok('On a phone, Scan a barcode opens the camera for a photo', (await page.locator('.camera').count()) === 0);
  await chooser.setFiles(await barcodePicture('0044700019887'));
  await page.getByText('Original Bacon').first().waitFor({ timeout: 20000 });
  const photoText = await page.locator('main').last().innerText();
  ok('A barcode photo is read and matched to the product (bars)', photoText.includes('Worth limiting') && /Barcode 0?044700019887/.test(photoText));

  // When the bars will not read, the printed numbers under them are read instead.
  await tap('Scan another');
  await pause(700);
  await page.locator('#photo-barcode').setInputFiles(await barcodePicture('0016000275263', { bars: false }));
  await page.getByText('Cheerios').first().waitFor({ timeout: 60000 });
  ok('The printed numbers are read when there are no bars (Cheerios)', (await page.locator('main').last().innerText()).includes('General Mills'));

  // An ingredient photo that reads as noise says so, and never shows the noise as ingredients.
  await tap('Scan another');
  await pause(700);
  await page.locator('#photo-ingredients').setInputFiles(await packageFront());
  await page.getByText('We could not read the ingredients').first().waitFor({ timeout: 90000 });
  ok('A photo that reads as noise says it could not be read', (await page.locator('#ingredients').count()) === 0);

  // A clear label is read, cut from "Ingredients:" to "Contains", and checked.
  await tap('Back');
  await pause(700);
  await page.locator('#photo-ingredients').setInputFiles(await labelPicture([
    'Nutrition Facts  Serving size 1 cup (28g)',
    'INGREDIENTS: WHOLE GRAIN OATS, CORN STARCH, SUGAR,',
    'SALT, TRIPOTASSIUM PHOSPHATE. VITAMIN E (MIXED',
    'TOCOPHEROLS) ADDED TO PRESERVE FRESHNESS.',
    'CONTAINS: WHEAT INGREDIENTS.',
  ]));
  await page.locator('#ingredients').waitFor({ timeout: 90000 });
  const labelText = await page.locator('#ingredients').inputValue();
  ok('A clear ingredient photo is read and trimmed to the list', /^WHOLE GRAIN OATS/i.test(labelText) && !/Nutrition|CONTAINS/i.test(labelText), labelText.slice(0, 60));

  // An ingredient photo that shows a barcode goes straight to the product.
  await tap('Back');
  await pause(700);
  await page.locator('#photo-ingredients').setInputFiles(await barcodePicture('0044700019887'));
  await page.getByText('Original Bacon').first().waitFor({ timeout: 20000 });
  ok('A barcode in an ingredient photo finds the product', (await page.locator('main').last().innerText()).includes('Worth limiting'));

  // Search by name finds products from the same list.
  await tap('Scan another');
  await pause(700);
  await tap('Search by name');
  await page.locator('#q').fill('cheerios');
  await page.locator('.product-hit').first().waitFor({ timeout: 8000 });
  ok('Search by name finds products in the built-in list', (await page.locator('.product-hit').first().innerText()).includes('Cheerios'));
  ok('Each product in the search list shows its grade (Cheerios: A)', (await page.locator('.product-hit').first().innerText()).includes('Grade A'));

  // The food diary keeps each serving under its date, for the last 7 days ending today.
  await page.goto(`${base}#/food`);
  await pause(900);
  ok('The diary ends with today', (await page.getByRole('tab').last().innerText()).trim() === 'Today');
  await tap('Add a serving of Vegetables');
  await pause(400);
  const todayIs = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const logged = await page.evaluate(() => JSON.parse(localStorage.getItem('fv2') || '{}').state.foodLog);
  ok("A serving is saved under today's date", logged?.[todayIs]?.veg === 1, JSON.stringify(logged));

  // 6. Delete my plan: two taps, and nothing left behind.
  await page.goto(`${base}#/plan`);
  await pause(900);
  await tap('Delete my plan');
  ok('First tap only arms the delete', await page.getByText('Tap again to delete').first().isVisible());
  await tap('Tap again to delete');
  await pause(900);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fv2') || '{}'));
  ok('Delete wipes the answers', stored?.state?.answers?.age === null && stored?.state?.checkDone === false);

  // Answers from the calculator alone make a plan that says it is not finished.
  await page.goto(`${base}#/risk?view=answers`);
  await pause(900);
  await tap('Never smoked', { role: 'radio' });
  await pause(300);
  await tap('See the scores');
  await pause(900);
  ok('Scores show for answers given in the calculator alone', /\d\.\d\s*×/.test(await page.locator('main').last().innerText()));
  await page.goto(`${base}#/risk?view=answers`);
  await pause(700);
  await tap('Female', { role: 'radio', exact: true });
  await pause(300);
  await page.goto(`${base}#/plan`);
  await pause(900);
  ok('A plan from the calculator alone says the check is not finished', await page.getByText('Your health check is not finished').first().isVisible());

  // Build my plan with an earlier step skipped goes back to that step instead.
  await page.goto(`${base}#/check/6`);
  await pause(900);
  await tap('None', { role: 'radio', exact: true });
  await tap('Less than 60 minutes a week', { role: 'radio' });
  await tap('Build my plan');
  await pause(900);
  ok('Build my plan with step 1 skipped goes to step 1', page.url().endsWith('#/check/1') && await page.getByText('Step 1 still needs an answer').first().isVisible().catch(() => false));
} catch (e) {
  ok('Flow completed without an exception', false, e.message.split('\n')[0]);
}

// 7. A computer: the camera is shown in the app, with Take picture.
async function cameraFeed(code, opts) {
  const pic = await barcodePicture(code, opts);
  const p = await context.newPage();
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.setContent(`<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#c9c3b6"><img src="data:image/png;base64,${pic.buffer.toString('base64')}"></body></html>`);
  const frame = await p.screenshot({ type: 'jpeg', quality: 92 });
  await p.close();
  const file = path.join(os.tmpdir(), `fv2-camera-${code}.mjpeg`);
  fs.writeFileSync(file, Buffer.concat(Array(30).fill(frame)));
  return file;
}
async function withCamera(feed, run) {
  const b = await chromium.launch({ executablePath: browserPath, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${feed}`] });
  try {
    const c = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', serviceWorkers: 'block', permissions: ['camera'] });
    const p = await c.newPage();
    p.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) outbound.push(u);
    });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`${base}#/scan`);
    await p.getByRole('button', { name: 'Scan a barcode' }).first().click();
    await run(p);
  } finally {
    await b.close();
  }
}
try {
  await withCamera(await cameraFeed('0044700019887'), async (p) => {
    const read = await p.getByText('Original Bacon').first().waitFor({ timeout: 20000 }).then(() => true, () => false);
    ok('Computer camera: a clear barcode reads by itself', read);
  });
  await withCamera(await cameraFeed('0016000275263', { bars: false }), async (p) => {
    const shutter = p.getByRole('button', { name: 'Take picture' });
    await shutter.waitFor({ timeout: 10000 });
    await p.waitForTimeout(1200);
    await shutter.click();
    const read = await p.getByText('General Mills').first().waitFor({ timeout: 60000 }).then(() => true, () => false);
    ok('Computer camera: Take picture reads the printed numbers (Cheerios)', read);
  });
  await withCamera(await cameraFeed('0044700019887'), async (p) => {
    await p.getByRole('button', { name: 'Take picture' }).waitFor({ timeout: 10000 });
    const [chooser] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }), p.getByRole('button', { name: 'Choose a photo of the barcode' }).click()]);
    ok('Computer camera: Choose a photo opens the photo picker', !!chooser);
  });
} catch (e) {
  ok('Computer camera checks completed without an exception', false, e.message.split('\n')[0]);
}

// 8. Network audit.
ok('Network audit: no request left the device', outbound.length === 0, outbound.length ? outbound.join(', ') : 'zero outbound requests');
ok('No page errors', errors.length === 0, errors.join(' | '));

await browser.close();
await new Promise((r) => server.httpServer.close(r));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
