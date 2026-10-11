#!/usr/bin/env node
// Renders the vector brand mark to the PNGs the web app and the native app
// need, using the Edge or Chrome already on this machine.
//   public/icons/icon-192.png, icon-512.png   web manifest
//   resources/icon.png (1024), splash.png and splash-dark.png (2732)
//     sources for `npx @capacitor/assets generate`
//   android/app/src/main/res/...   launcher icons (legacy, round, adaptive)
//     and light and dark splash screens, when the Android project exists
//   ios/App/App/Assets.xcassets/...   App Store icon and light and dark
//     launch images, when the iOS project exists
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

const PAPER = '#E5F1EE';
const NIGHT = '#0D1715';
// Brand pair from the logo: teal #285F5A and pink #EBC3D7 (a lighter teal on dark).
const LIGHT = { bg: PAPER, teal: '#285F5A', rose: '#EBC3D7', ink: '#16211F' };
const DARK = { bg: NIGHT, teal: '#7DBDB3', rose: '#EBC3D7', ink: '#EEF3F1' };

// The mark: the same paths as src/components/Brand.tsx (MARK).
const mark = (teal, rose) => `
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 24V14a8 8 0 0 1 16 0v10h10a8 8 0 0 1 0 16H40" stroke="${teal}" stroke-width="4.6"/>
    <path d="M24 24H14a8 8 0 0 0 0 16h10v10a8 8 0 0 0 16 0V40" stroke="${rose}" stroke-width="4.6"/>
    <path d="M9 6c0 7 2 11 5 14c3-3 5-7 5-14M14 20v4" stroke="${rose}" stroke-width="3.4"/>
    <circle cx="9" cy="5.5" r="2" fill="${rose}"/><circle cx="19" cy="5.5" r="2" fill="${rose}"/>
    <path d="M14 32h7c4 0 6 6 10 6s6-6 10-6h4" stroke="${rose}" stroke-width="3"/>
    <circle cx="50" cy="32" r="4.4" fill="${rose}" stroke="${teal}" stroke-width="2.6"/>
  </g>`;

// A full-bleed square icon: stores round or square it off themselves.
const icon = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <rect width="64" height="64" fill="${bg}"/>
  <g transform="translate(9.6 9.6) scale(0.7)">${mark(LIGHT.teal, LIGHT.rose)}</g></svg>`;

// Pre-shaped icons for launchers older than Android 8: rounded square, circle.
const shaped = (shape) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  ${shape === 'round' ? `<circle cx="32" cy="32" r="31" fill="${PAPER}"/>` : `<rect x="1" y="1" width="62" height="62" rx="13" fill="${PAPER}"/>`}
  <g transform="translate(12.8 12.8) scale(0.6)">${mark(LIGHT.teal, LIGHT.rose)}</g></svg>`;

// Adaptive icon foreground: 108 units, the mark inside the 66-unit safe circle.
const foreground = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="100%" height="100%">
  <g transform="translate(20.4 20.4) scale(1.05)">${mark(LIGHT.teal, LIGHT.rose)}</g></svg>`;

// A splash of any size: the mark and the wordmark, centred. The square iOS
// launch image is cropped to the phone's shape, so it keeps both small and
// in the middle third.
const splash = (w, h, c) => {
  const m = Math.min(w, h);
  const square = w === h;
  const s = (m * (square ? 0.2 : 0.3)) / 64;
  const cy = h / 2 - m * (square ? 0.045 : 0.07);
  const font = m * (square ? 0.05 : 0.07);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
  <rect width="${w}" height="${h}" fill="${c.bg}"/>
  <g transform="translate(${w / 2 - 32 * s} ${cy - 32 * s}) scale(${s})">${mark(c.teal, c.rose)}</g>
  <text x="${w / 2}" y="${cy + 32 * s + font * 1.45}" text-anchor="middle" font-family="Times New Roman, Times, serif" font-weight="700" font-size="${font}" fill="${c.ink}">Future<tspan fill="${c.teal}">Vitals</tspan></text>
</svg>`;
};

// The vector tab icon for the web version.
fs.writeFileSync(path.join(ROOT, 'public/icons/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="${PAPER}"/>
  <g transform="translate(6.4 6.4) scale(0.8)">${mark(LIGHT.teal, LIGHT.rose)}</g>
</svg>
`);

const jobs = [
  ['public/icons/icon-192.png', 192, 192, icon(PAPER)],
  ['public/icons/icon-512.png', 512, 512, icon(PAPER)],
  ['resources/icon.png', 1024, 1024, icon(PAPER)],
  ['resources/splash.png', 2732, 2732, splash(2732, 2732, LIGHT)],
  ['resources/splash-dark.png', 2732, 2732, splash(2732, 2732, DARK)],
];

const RES = path.join(ROOT, 'android/app/src/main/res');
if (fs.existsSync(RES)) {
  const dpis = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [dpi, k] of Object.entries(dpis)) {
    jobs.push([`android/app/src/main/res/mipmap-${dpi}/ic_launcher.png`, 48 * k, 48 * k, shaped('square'), true]);
    jobs.push([`android/app/src/main/res/mipmap-${dpi}/ic_launcher_round.png`, 48 * k, 48 * k, shaped('round'), true]);
    jobs.push([`android/app/src/main/res/mipmap-${dpi}/ic_launcher_foreground.png`, 108 * k, 108 * k, foreground(), true]);
  }
  const port = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [night, c] of [['', LIGHT], ['-night', DARK]]) {
    jobs.push([`android/app/src/main/res/drawable${night}/splash.png`, 480, 320, splash(480, 320, c)]);
    for (const [dpi, [w, h]] of Object.entries(port)) {
      jobs.push([`android/app/src/main/res/drawable-port${night}-${dpi}/splash.png`, w, h, splash(w, h, c)]);
      jobs.push([`android/app/src/main/res/drawable-land${night}-${dpi}/splash.png`, h, w, splash(h, w, c)]);
    }
  }
}

// iOS: the App Store icon (no transparency allowed) and the launch image,
// with a dark version the system picks in dark mode.
const XC = path.join(ROOT, 'ios/App/App/Assets.xcassets');
if (fs.existsSync(XC)) {
  jobs.push(['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, icon(PAPER)]);
  const images = [];
  for (const [dark, c] of [[false, LIGHT], [true, DARK]]) {
    for (const scale of ['1x', '2x', '3x']) {
      const filename = `splash-2732x2732${dark ? '-dark' : ''}-${scale}.png`;
      jobs.push([`ios/App/App/Assets.xcassets/Splash.imageset/${filename}`, 2732, 2732, splash(2732, 2732, c)]);
      images.push({ idiom: 'universal', filename, scale, ...(dark ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] } : {}) });
    }
  }
  const set = path.join(XC, 'Splash.imageset');
  for (const f of fs.readdirSync(set)) if (f.endsWith('.png')) fs.unlinkSync(path.join(set, f));
  fs.writeFileSync(path.join(set, 'Contents.json'), JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
}

const browser = await chromium.launch({ executablePath: exe, headless: true });
for (const [out, w, h, svg, transparent] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent;width:${w}px;height:${h}px">${svg}</body></html>`);
  const file = path.join(ROOT, out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h }, omitBackground: !!transparent });
  await page.close();
  console.log(`${out}  ${w}x${h}`);
}
await browser.close();
