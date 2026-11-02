#!/usr/bin/env node
// Traces the brand logo (resources/logo.jpg) into the vector paths in
// src/components/logo.json. The app (Brand.tsx), the icons and splash screens
// (make-icons.mjs) and the boot screen (index.html) all draw from that file.
// Each pixel is unmixed into background, teal and pink, so the JPEG's soft
// edges become exact coverage; each colour is then traced with potrace.
// Run again only if the logo changes:
//   npm i --no-save potrace@2.1.8 && node scripts/trace-logo.mjs && npm run icons
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const potrace = await import('potrace').catch(() => {
  console.error('The tracer is not installed. Run: npm i --no-save potrace@2.1.8');
  process.exit(1);
});
const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
if (!exe) throw new Error('No Edge or Chrome found.');

const SCALE = 4; // trace at 4x the source, so curves fit the edge, not the pixels
const b64 = fs.readFileSync(path.join(ROOT, 'resources/logo.jpg')).toString('base64');
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setContent(`<img id="logo" src="data:image/jpeg;base64,${b64}">`);
await page.waitForFunction(() => document.getElementById('logo').complete);
const found = await page.evaluate((S) => {
  const img = document.getElementById('logo');
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const median = (test) => {
    const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) for (let k = 0; k < 3; k++) ch[k].push(d[i + k]);
    return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
  };
  const bg = median((r, g2, b) => r > 235 && g2 > 235 && b > 235);
  const teal = median((r, g2, b) => r < 60 && g2 > 80 && b > 70 && g2 < 140);
  const pink = median((r, g2, b) => r > 200 && r - g2 > 40 && b > g2);
  // Least squares: pixel = bg + a (teal - bg) + b (pink - bg).
  const A = teal.map((v, k) => v - bg[k]), B = pink.map((v, k) => v - bg[k]);
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const aa = dot(A, A), bb = dot(B, B), ab = dot(A, B), det = aa * bb - ab * ab;
  const cover = { teal: new Float32Array(W * H), pink: new Float32Array(W * H) };
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const p = [d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]];
    const pa = dot(p, A), pb = dot(p, B);
    cover.teal[j] = Math.max(0, Math.min(1, (pa * bb - pb * ab) / det));
    cover.pink[j] = Math.max(0, Math.min(1, (pb * aa - pa * ab) / det));
  }
  // The colours to draw with: the mean of the pixels fully inside each shape.
  const solid = (m) => {
    const s = [0, 0, 0]; let n = 0;
    for (let j = 0; j < m.length; j++) if (m[j] > 0.97) { for (let k = 0; k < 3; k++) s[k] += d[j * 4 + k]; n++; }
    return s.map((v) => Math.round(v / n));
  };
  const mask = (m) => {
    const small = document.createElement('canvas'); small.width = W; small.height = H;
    const sg = small.getContext('2d'); const out = sg.createImageData(W, H);
    for (let j = 0; j < m.length; j++) {
      out.data[j * 4] = out.data[j * 4 + 1] = out.data[j * 4 + 2] = Math.round(255 * (1 - m[j]));
      out.data[j * 4 + 3] = 255;
    }
    sg.putImageData(out, 0, 0);
    const big = document.createElement('canvas'); big.width = W * S; big.height = H * S;
    const bgx = big.getContext('2d'); bgx.imageSmoothingQuality = 'high';
    // A light blur irons out JPEG ripple along the edges without rounding corners.
    bgx.filter = `blur(${S * 0.6}px)`;
    bgx.drawImage(small, 0, 0, W * S, H * S);
    return big.toDataURL('image/png').split(',')[1];
  };
  return { W, H, teal: solid(cover.teal), pink: solid(cover.pink), masks: { teal: mask(cover.teal), pink: mask(cover.pink) } };
}, SCALE);
await browser.close();

const trace = (png) => new Promise((resolve, reject) => {
  const p = new potrace.Potrace({ turdSize: 800, optTolerance: 1, alphaMax: 1, threshold: 128, blackOnWhite: true });
  p.loadImage(Buffer.from(png, 'base64'), (err) => (err ? reject(err) : resolve(p.getPathTag().match(/ d="([^"]+)"/)[1])));
});

// One closed outline per entry, with its bounding box in source pixels.
const outlines = (d) => d.split(/(?=M)/).map((s) => s.trim()).filter(Boolean).map((s) => {
  const n = s.match(/-?\d+(\.\d+)?/g).map((v) => Number(v) / SCALE);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return { s, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
});
const box = (list) => ({ x0: Math.min(...list.map((o) => o.x0)), x1: Math.max(...list.map((o) => o.x1)), y0: Math.min(...list.map((o) => o.y0)), y1: Math.max(...list.map((o) => o.y1)) });
const inside = (a, b) => a !== b && a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;

const teal = outlines(await trace(found.masks.teal));
const pink = outlines(await trace(found.masks.pink));
// The mark is the teal outline with the largest box; everything teal below it
// is the lettering. Pink holds the left half of the cross and the stethoscope.
const area = (o) => (o.x1 - o.x0) * (o.y1 - o.y0);
const crossTeal = teal.reduce((a, b) => (area(b) > area(a) ? b : a));
const letters = teal.filter((o) => o.y0 > crossTeal.y1);
const pinkBig = pink.filter((o) => area(o) > area(crossTeal) / 4).sort((a, b) => b.y1 - a.y1);
if (pinkBig.length !== 2) throw new Error(`Expected two pink shapes, found ${pinkBig.length}.`);
const [crossPink, stethoscope] = pinkBig;
const markBox = box([crossTeal, crossPink, stethoscope]);
const wordBox = box(letters);

// Mark space: a 100 x 100 square with the mark centred in it. The lettering
// uses the same unit, from its own top left corner.
const k = 100 / Math.max(markBox.x1 - markBox.x0, markBox.y1 - markBox.y0);
const markOff = { x: (100 - (markBox.x1 - markBox.x0) * k) / 2, y: (100 - (markBox.y1 - markBox.y0) * k) / 2 };
const r2 = (v) => String(Math.round(v * 100) / 100);
const move = (s, ox, oy, dx = 0, dy = 0) => {
  let i = 0;
  return s.replace(/-?\d+(\.\d+)?/g, (v) => {
    const n = Number(v) / SCALE;
    return r2(i++ % 2 === 0 ? (n - ox) * k + dx : (n - oy) * k + dy);
  }).replace(/\s*,\s*/g, ' ').replace(/\s*([MCLZ])\s*/g, '$1').trim();
};
const inMark = (o) => move(o.s, markBox.x0, markBox.y0, markOff.x, markOff.y);
const inWord = (o) => move(o.s, wordBox.x0, wordBox.y0);

// Letters left to right, each with its counters (the holes in A and R).
const glyphs = letters.filter((o) => !letters.some((p) => inside(o, p))).sort((a, b) => a.x0 - b.x0)
  .map((g) => [g, ...letters.filter((o) => inside(o, g))].map(inWord).join(''));

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const word = { w: Number(r2((wordBox.x1 - wordBox.x0) * k)), h: Number(r2((wordBox.y1 - wordBox.y0) * k)) };
// The full logo as drawn in the source: the mark above, the lettering below.
const lockup = {
  w: Number(r2(Math.max(markBox.x1, wordBox.x1) * k - Math.min(markBox.x0, wordBox.x0) * k)),
  h: Number(r2((wordBox.y1 - markBox.y0) * k)),
  mark: { x: Number(r2((markBox.x0 - Math.min(markBox.x0, wordBox.x0)) * k - markOff.x)), y: Number(r2(-markOff.y)) },
  word: { x: Number(r2((wordBox.x0 - Math.min(markBox.x0, wordBox.x0)) * k)), y: Number(r2((wordBox.y0 - markBox.y0) * k)) },
};
const out = {
  source: 'resources/logo.jpg, traced by scripts/trace-logo.mjs',
  colors: { teal: hex(found.teal), pink: hex(found.pink) },
  mark: { teal: inMark(crossTeal), pink: inMark(crossPink), stethoscope: inMark(stethoscope) },
  word: { ...word, glyphs },
  lockup,
};
fs.writeFileSync(path.join(ROOT, 'src/components/logo.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`colors ${out.colors.teal} ${out.colors.pink}; ${glyphs.length} letters; ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
