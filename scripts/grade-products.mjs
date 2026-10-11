#!/usr/bin/env node
// Works out the ingredient grade (A to F) of every product in the built-in
// list and stores it in content/products/names.json, so the scanner's search
// can show a grade beside each name without loading every product file. The
// grade comes from the app's own engine (src/engine/scanner.ts, loaded
// through Vite), so it is the grade the result screen shows.
//
// Run after changing content/ingredients.json or the scanner rules.
// scripts/build-products.mjs runs it after a new product list.
//
//   npm run grades
//
// tests/products.test.ts fails while the stored grades are out of date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { rulesStamp } from './grade-stamp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'content/products');

const vite = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { evaluateProduct } = await vite.ssrLoadModule('/src/engine/scanner.ts');
  const { toProduct } = await vite.ssrLoadModule('/src/platform/products.ts');

  const started = Date.now();
  const grades = new Map();
  for (let i = 0; i < 100; i++) {
    const shard = JSON.parse(fs.readFileSync(path.join(OUT, `p-${String(i).padStart(2, '0')}.json`), 'utf8'));
    for (const [code, row] of Object.entries(shard)) grades.set(code, evaluateProduct(toProduct(code, row)).grade?.grade ?? '');
  }

  const names = JSON.parse(fs.readFileSync(path.join(OUT, 'names.json'), 'utf8'));
  const graded = names.map(([code, name, brand]) => [code, name, brand, grades.get(code) ?? '']);
  fs.writeFileSync(path.join(OUT, 'names.json'), JSON.stringify(graded));

  const metaFile = path.join(OUT, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  meta.grades = { rules: rulesStamp(ROOT), note: 'names.json rows end with the ingredient grade, from scripts/grade-products.mjs; rules is a fingerprint of content/ingredients.json at that time.' };
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');

  const count = {};
  for (const [, , , g] of graded) count[g || 'none'] = (count[g || 'none'] || 0) + 1;
  const share = (n) => `${((n / graded.length) * 100).toFixed(1)}%`;
  console.log(`Graded ${graded.length.toLocaleString()} products in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  for (const g of ['A', 'B', 'C', 'D', 'F', 'none']) if (count[g]) console.log(`  ${g.padEnd(4)} ${String(count[g]).padStart(6)}  ${share(count[g])}`);
} finally {
  await vite.close();
}
