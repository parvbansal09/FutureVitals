#!/usr/bin/env node
// Renders the logo (src/components/logo.json, traced from resources/logo.jpg)
// to the images the web app and the native app need, using the Edge or Chrome
// already on this machine.
//   public/icons/icon.svg, mark.svg   tab icon; the mark on the boot screen
//   public/icons/icon-192.png, icon-512.png   web manifest
//   resources/icon.png (1024), splash.png (2732)
//     sources for `npx @capacitor/assets generate`
//   android/app/src/main/res/...   launcher icons (legacy, round, adaptive)
//     and splash screens, when the Android project exists
//   ios/App/App/Assets.xcassets/...   App Store icon and launch image, when
//     the iOS project exists
// The app opens in light mode whatever the phone's setting, so every splash
// is light; dark versions left from earlier runs are removed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
if (!exe) throw new Error('No Edge or Chrome found.');

const logo = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/components/logo.json'), 'utf8'));
const { teal, pink } = logo.colors;
const PAPER = '#E5F1EE'; // the app's background, so the splash hands over without a flash
const WHITE = '#FFFFFF'; // icons sit on white, as the logo does

// The mark in a 100-unit square, and the lettering in the same unit.
const mark = `<path d="${logo.mark.teal}" fill="${teal}"/><path d="${logo.mark.pink}" fill="${pink}"/><path d="${logo.mark.stethoscope}" fill="${pink}"/>`;
const word = `<g fill="${teal}" fill-rule="evenodd">${logo.word.glyphs.map((d) => `<path d="${d}"/>`).join('')}</g>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${body}</svg>`;
const at = (x, y, s) => `transform="translate(${x} ${y}) scale(${s})"`;

// A full-bleed square icon: stores round or square it off themselves. At 0.72
// the mark stays inside the circle a maskable icon may be cut to.
const icon = () => svg(100, 100, `<rect width="100" height="100" fill="${WHITE}"/><g ${at(14, 14, 0.72)}>${mark}</g>`);

// Pre-shaped icons for launchers older than Android 8: rounded square, circle.
const shaped = (shape) => svg(100, 100, `${shape === 'round' ? `<circle cx="50" cy="50" r="48.5" fill="${WHITE}"/>` : `<rect x="1.5" y="1.5" width="97" height="97" rx="20" fill="${WHITE}"/>`}
  <g ${at(17, 17, 0.66)}>${mark}</g>`);

// Adaptive icon foreground: 108 units, the mark (53 units at its farthest from
// its centre) inside the 66-unit safe circle.
const foreground = () => svg(108, 108, `<g ${at(24, 24, 0.6)}>${mark}</g>`);

// A splash of any size: the full logo, mark over lettering, centred. The
// square iOS launch image is cropped to the phone's shape, so it keeps the
// logo small and in the middle third.
const splash = (w, h) => {
  const m = Math.min(w, h);
  const L = logo.lockup;
  const s = (m * (w === h ? 0.24 : 0.36)) / L.h;
  const x = w / 2 - (L.w * s) / 2, y = h / 2 - (L.h * s) / 2;
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${PAPER}"/>
  <g ${at(x, y, s)}><g transform="translate(${L.mark.x} ${L.mark.y})">${mark}</g><g transform="translate(${L.word.x} ${L.word.y})">${word}</g></g>`);
};

// The vector tab icon, and the bare mark the boot screen shows while the app loads.
fs.writeFileSync(path.join(ROOT, 'public/icons/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${WHITE}"/>
  <g ${at(9, 9, 0.82)}>${mark}</g>
</svg>
`);
fs.writeFileSync(path.join(ROOT, 'public/icons/mark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${mark}</svg>\n`);

const jobs = [
  ['public/icons/icon-192.png', 192, 192, icon()],
  ['public/icons/icon-512.png', 512, 512, icon()],
  ['resources/icon.png', 1024, 1024, icon()],
  ['resources/splash.png', 2732, 2732, splash(2732, 2732)],
];
const stale = ['resources/splash-dark.png'];

const RES = path.join(ROOT, 'android/app/src/main/res');
if (fs.existsSync(RES)) {
  const dpis = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [dpi, k] of Object.entries(dpis)) {
    jobs.push([`android/app/src/main/res/mipmap-${dpi}/ic_launcher.png`, 48 * k, 48 * k, shaped('square'), true]);
    jobs.push([`android/app/src/main/res/mipmap-${dpi}/ic_launcher_round.png`, 48 * k, 48 * k, shaped('round'), true]);
    jobs.push([`android/app/src/main/res/mipmap-${dpi}/ic_launcher_foreground.png`, 108 * k, 108 * k, foreground(), true]);
  }
  const port = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  jobs.push(['android/app/src/main/res/drawable/splash.png', 480, 320, splash(480, 320)]);
  stale.push('android/app/src/main/res/drawable-night/splash.png');
  for (const [dpi, [w, h]] of Object.entries(port)) {
    jobs.push([`android/app/src/main/res/drawable-port-${dpi}/splash.png`, w, h, splash(w, h)]);
    jobs.push([`android/app/src/main/res/drawable-land-${dpi}/splash.png`, h, w, splash(h, w)]);
    stale.push(`android/app/src/main/res/drawable-port-night-${dpi}/splash.png`, `android/app/src/main/res/drawable-land-night-${dpi}/splash.png`);
  }
}

// iOS: the App Store icon (no transparency allowed) and the launch image.
const XC = path.join(ROOT, 'ios/App/App/Assets.xcassets');
if (fs.existsSync(XC)) {
  jobs.push(['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, icon()]);
  const images = [];
  for (const scale of ['1x', '2x', '3x']) {
    const filename = `splash-2732x2732-${scale}.png`;
    jobs.push([`ios/App/App/Assets.xcassets/Splash.imageset/${filename}`, 2732, 2732, splash(2732, 2732)]);
    images.push({ idiom: 'universal', filename, scale });
  }
  const set = path.join(XC, 'Splash.imageset');
  for (const f of fs.readdirSync(set)) if (f.endsWith('.png')) fs.unlinkSync(path.join(set, f));
  fs.writeFileSync(path.join(set, 'Contents.json'), JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
}

for (const out of stale) {
  const file = path.join(ROOT, out);
  if (!fs.existsSync(file)) continue;
  fs.unlinkSync(file);
  if (!fs.readdirSync(path.dirname(file)).length) fs.rmdirSync(path.dirname(file));
  console.log(`${out}  removed`);
}

const browser = await chromium.launch({ executablePath: exe, headless: true });
for (const [out, w, h, image, transparent] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent;width:${w}px;height:${h}px">${image}</body></html>`);
  const file = path.join(ROOT, out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h }, omitBackground: !!transparent });
  await page.close();
  console.log(`${out}  ${w}x${h}`);
}
await browser.close();
