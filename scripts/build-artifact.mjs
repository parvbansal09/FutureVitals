#!/usr/bin/env node
// Builds the version of the app published as a claude.ai Artifact, into
// dist-artifact/. It is the same app in `--mode artifact` (see
// src/platform/env.ts), shaped for the page contract of that viewer:
//
//   - index.html becomes page content only (the viewer adds the doctype,
//     head and body), with the title first;
//   - the viewer pads the page clear of the phone's bars, so the app fills
//     that box (height: 100%) and its own safe-area padding is set to 0;
//   - the Tinos font files are inlined into the CSS, since the viewer may
//     only load fonts it is handed directly;
//   - no service worker, web manifest or tab icons (the viewer has its own);
//   - the text reader's .gz language files, a type the viewer does not
//     serve, ship as base64 .txt. The viewer refuses the live camera, so
//     the preview scanner reads barcodes and labels from photos instead.
//
//   npm run artifact      then publish dist-artifact/index.html with the
//                         files listed in dist-artifact/files.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-artifact');

await build({ root: ROOT, mode: 'artifact', logLevel: 'warn', build: { outDir: OUT, emptyOutDir: true } });

// 1. Files the viewer does not use.
for (const f of ['sw.js', 'manifest.webmanifest', 'icons', 'fonts']) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });

// The text reader's language data is gzip, a file type the viewer does not
// serve. It ships as base64 text instead, and src/platform/ocr.ts decodes it.
const langDir = path.join(OUT, 'ocr/lang');
for (const f of fs.existsSync(langDir) ? fs.readdirSync(langDir) : []) {
  if (!f.endsWith('.gz')) continue;
  fs.writeFileSync(path.join(langDir, `${f}.txt`), fs.readFileSync(path.join(langDir, f)).toString('base64'));
  fs.unlinkSync(path.join(langDir, f));
}

// 2. CSS: fonts inlined, the app's own safe-area padding set to 0.
const fontData = (name) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'public/fonts', name)).toString('base64')})`;
const assets = path.join(OUT, 'assets');
for (const f of fs.readdirSync(assets).filter((n) => n.endsWith('.css'))) {
  const file = path.join(assets, f);
  const css = fs.readFileSync(file, 'utf8')
    .replace(/url\((['"]?)[^)'"]*fonts\/(tinos-[\w-]+\.woff2)\1\)/g, (_, q, name) => fontData(name))
    .replace(/env\(safe-area-inset-(?:top|right|bottom|left)(?:,[^)]*)?\)/g, '0px');
  fs.writeFileSync(file, css);
}

// 3. The page itself: content only, title first.
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const styles = pick(/<link rel="stylesheet"[^>]*>/g);
const preloads = pick(/<link rel="modulepreload"[^>]*>/g);
const scripts = pick(/<script type="module"[^>]*><\/script>/g);
// The boot screen's mark comes inline, since the icons folder is not shipped.
const bootMark = fs.readFileSync(path.join(ROOT, 'public/icons/mark.svg'), 'utf8').trim();
const root = html.match(/<div id="root">[\s\S]*?<\/div>\s*<\/div>/)?.map((r) => r.replace(/<img src="\.\/icons\/mark\.svg"[^>]*>/, bootMark));
if (!styles.length || !scripts.length || !root) throw new Error('index.html did not have the expected stylesheet, script and root');

const page = `<title>FutureVitals</title>
<style>
  /* Paints before the app loads. The app opens light whatever the viewer's theme. */
  html, body { margin: 0; height: 100%; background: var(--paper, #E5F1EE); }
  #boot { position: fixed; inset: 0; display: grid; place-items: center; background: #E5F1EE; }
  #boot svg { width: 88px; height: 88px; opacity: .9; }
</style>
${styles.join('\n')}
<style>
  /* The viewer pads the page clear of the phone's bars; the app fills that box. */
  #root { height: 100%; }
  .stage { min-height: 0; height: 100%; }
  .device { height: 100%; }
  @media (min-width: 720px) {
    .stage { display: flex; align-items: center; justify-content: center; }
    .device { height: min(932px, 100%); }
  }
</style>
${preloads.join('\n')}
${scripts.join('\n')}
${root[0]}
<noscript>FutureVitals needs JavaScript to run.</noscript>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), page);

// 4. Every other file, for the publish call.
const list = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const rel = base ? `${base}/${e.name}` : e.name;
  return e.isDirectory() ? list(path.join(dir, e.name), rel) : [rel];
});
const files = list(OUT).filter((f) => f !== 'index.html' && f !== 'files.json');
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files, null, 2) + '\n');
const size = (f) => fs.statSync(path.join(OUT, f)).size;
const total = files.reduce((n, f) => n + size(f), 0) + size('index.html');
console.log(`dist-artifact: index.html + ${files.length} files, ${(total / 1e6).toFixed(1)} MB`);
for (const f of files) console.log(`  ${f}  ${(size(f) / 1024).toFixed(0)} KB`);
