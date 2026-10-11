#!/usr/bin/env node
// Copies the on-device OCR engine into public/ocr so the product scanner can
// read an ingredient list with the radio off. Tesseract.js would otherwise
// fetch its worker, its WebAssembly core and its language data from a CDN,
// which breaks the offline rule and the "only the barcode leaves the device"
// network audit. Runs after every install; safe to run again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'public', 'ocr');

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return fs.statSync(to).size;
};

// Walks a package folder and returns files whose name matches `test`.
function find(dir, test, depth = 4) {
  if (!exists(dir) || depth < 0) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...find(full, test, depth - 1));
    else if (test(entry.name, full)) out.push(full);
  }
  return out;
}

if (!exists(path.join(NM, 'tesseract.js'))) {
  console.log('ocr assets: tesseract.js not installed yet, skipping');
  process.exit(0);
}

let bytes = 0;
let files = 0;

// 1. The worker script.
const worker = find(path.join(NM, 'tesseract.js', 'dist'), (n) => n === 'worker.min.js')[0];
if (worker) { bytes += copy(worker, path.join(OUT, 'worker.min.js')); files++; }

// 2. The WebAssembly core. Given a folder, Tesseract.js loads one of two
//    files: the SIMD build where the phone supports it, the plain build where
//    it does not, both LSTM-only (its default engine). Each .wasm.js carries
//    its WebAssembly inline, so the separate .wasm files and the legacy-engine
//    builds would be 20 MB that nothing ever loads.
const coreDir = path.join(NM, 'tesseract.js-core');
fs.rmSync(path.join(OUT, 'core'), { recursive: true, force: true });
for (const name of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) {
  const f = path.join(coreDir, name);
  if (exists(f)) { bytes += copy(f, path.join(OUT, 'core', name)); files++; }
  else console.warn(`ocr assets: missing ${name}`);
}

// 3. Language data. The @tesseract.js-data packages hold several builds;
//    best_int is the accuracy/size middle ground Tesseract.js itself defaults to.
for (const lang of ['eng', 'spa']) {
  const pkg = path.join(NM, '@tesseract.js-data', lang);
  const all = find(pkg, (n) => n === `${lang}.traineddata.gz`);
  const pick = all.find((p) => /best_int/.test(p)) || all.find((p) => /4\.0\.0/.test(p)) || all[0];
  if (pick) { bytes += copy(pick, path.join(OUT, 'lang', `${lang}.traineddata.gz`)); files++; }
  else console.warn(`ocr assets: no ${lang}.traineddata.gz found in ${pkg}`);
}

console.log(`ocr assets: ${files} files, ${(bytes / 1048576).toFixed(1)} MB -> public/ocr`);
