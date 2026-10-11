#!/usr/bin/env node
// Builds the scanner's built-in product list from the Open Food Facts food
// export (the nightly CSV), so a barcode or a product name is found on the
// phone, offline, without sending anything.
//
//   curl -L -o off.csv.gz https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
//   node scripts/build-products.mjs off.csv.gz [--max=80000] [--exported=2026-10-02] [--partial]
//
// Kept: products sold in the United States, with a name and an ingredient
// list, that people have scanned at least once on Open Food Facts, up to
// --max. US products come first: a US or Canadian barcode (GS1 prefixes 000
// to 139), or the US as the country where Open Food Facts saw the most scans
// of it in some year (popularity tag top-country-us-scans-YYYY). That keeps a
// French Coca-Cola or a Moroccan yogurt, tagged with the US among many
// countries but scanned elsewhere, from crowding out what is on US shelves.
// Within each group, most scanned first. Kept per product: name, first brand, ingredient
// text, NOVA group, additive codes, the category tags the scanner rules use
// (content/ingredients.json), and the four nutrients the rules read.
//
// Output, in content/products/:
//   p-00.json … p-99.json  products by the last two digits of the barcode
//   names.json             [barcode, name, brand, grade] for search, most scanned first
//                          (the ingredient grade is added by scripts/grade-products.mjs,
//                          which runs at the end)
//   meta.json              source, export date, count, license
//
// The data stays under the Open Database License (see content/products/LICENSE.md).
// Re-run after adding a category tag to a scanner rule, so products carry it.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'content/products');
const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${def}`).split('=')[1];
const MAX = Number(opt('max', 80000));
const EXPORTED = opt('exported', new Date().toISOString().slice(0, 10));
const MAX_TEXT = 1200;
if (!input || !fs.existsSync(input)) {
  console.error('Usage: node scripts/build-products.mjs <en.openfoodfacts.org.products.csv.gz> [--max=80000] [--exported=YYYY-MM-DD]');
  process.exit(1);
}

// The tags the scanner rules look for. Every other category tag is dropped.
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/ingredients.json'), 'utf8'));
const TAGS = new Set();
for (const r of [...rules.hazards, ...rules.protective]) for (const t of r.tags || []) TAGS.add(t);
for (const t of rules.meatFreeTags || []) TAGS.add(t);
for (const list of Object.values(rules.categoryGroups || {})) for (const t of list) TAGS.add(t);

/** The same barcode as UPC-A, EAN-13 or GTIN-14 becomes one 13-digit key. Mirrors barcodeKeys() in src/engine/scanner.ts. */
function canonical(raw) {
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) d = `0${d}`;
  return d.length === 8 || d.length === 13 ? d : null;
}
// Some records carry "�" (U+FFFD) from a broken text encoding upstream, or
// stray control characters; both are dropped rather than shown.
const clean = (s) => s
  .replace(/[�\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/_/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? `${s.slice(0, n).replace(/[\s,;]+\S*$/, '')}…` : s);
const num = (v) => {
  if (v === '' || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
};

// --partial reads a download that was cut off, up to where it stops. The
// export is sorted by barcode and US codes start with 0, so a cut late in the
// file loses no US product; the count printed at the end says what was read.
const PARTIAL = args.includes('--partial');
const gz = fs.createReadStream(input).pipe(zlib.createGunzip(PARTIAL ? { finishFlush: zlib.constants.Z_SYNC_FLUSH } : {}));
if (PARTIAL) gz.on('error', () => gz.emit('end'));
const rl = readline.createInterface({ input: gz, crlfDelay: Infinity });
let col = null;
let rows = 0;
let usWithIngredients = 0;
const best = new Map();
for await (const line of rl) {
  const c = line.split('\t');
  if (!col) { col = Object.fromEntries(c.map((h, i) => [h, i])); continue; }
  rows++;
  if (c.length < col.alcohol_100g + 1) continue;
  if (!c[col.countries_tags].split(',').includes('en:united-states')) continue;
  const code = canonical(c[col.code]);
  const name = clean(c[col.product_name] || '');
  const text = clean(c[col.ingredients_text] || '');
  if (!code || !name || !/[a-z]{3}/i.test(text)) continue;
  usWithIngredients++;
  const scans = Number(c[col.unique_scans_n]) || 0;
  if (scans < 1) continue;
  const prev = best.get(code);
  if (prev && prev.scans >= scans) continue;
  // The prefix test is for 13-digit codes only: an 8-digit code's first digits are not a country.
  const usFirst = (code.length === 13 && /^(0|1[0-3])/.test(code)) || (c[col.popularity_tags] || '').includes('top-country-us-scans');
  const kcal = num(c[col['energy-kcal_100g']]) ?? (num(c[col.energy_100g]) !== null ? Math.round(num(c[col.energy_100g]) / 4.184) : null);
  const nova = Number(c[col.nova_group]);
  best.set(code, {
    code,
    scans,
    usFirst,
    completeness: Number(c[col.completeness]) || 0,
    row: [
      cut(name, 90),
      cut(clean((c[col.brands] || '').split(',')[0] || ''), 40),
      cut(text, MAX_TEXT),
      nova >= 1 && nova <= 4 ? nova : null,
      (c[col.additives_tags] || '').split(',').filter((t) => /^en:e\d/.test(t)).map((t) => t.slice(3)).join(' '),
      (c[col.categories_tags] || '').split(',').filter((t) => TAGS.has(t)).map((t) => t.slice(3)).join(' '),
      kcal,
      num(c[col.sugars_100g]),
      num(c[col.sodium_100g]),
      num(c[col.alcohol_100g]),
    ],
  });
  if (rows % 500000 === 0) process.stdout.write(`  ${rows.toLocaleString()} rows read, ${best.size.toLocaleString()} kept so far\n`);
}

const kept = [...best.values()]
  .sort((a, b) => Number(b.usFirst) - Number(a.usFirst) || b.scans - a.scans || b.completeness - a.completeness || a.code.localeCompare(b.code))
  .slice(0, MAX);

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^p-\d\d\.json$/.test(f) || f === 'names.json') fs.unlinkSync(path.join(OUT, f));
const shards = Array.from({ length: 100 }, () => ({}));
for (const p of kept) shards[Number(p.code.slice(-2))][p.code] = p.row;
let bytes = 0;
shards.forEach((s, i) => {
  const out = JSON.stringify(s);
  bytes += out.length;
  fs.writeFileSync(path.join(OUT, `p-${String(i).padStart(2, '0')}.json`), out);
});
const names = JSON.stringify(kept.map((p) => [p.code, p.row[0], p.row[1]]));
fs.writeFileSync(path.join(OUT, 'names.json'), names);
const meta = {
  source: 'Open Food Facts',
  sourceUrl: 'https://world.openfoodfacts.org',
  export: 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz',
  exported: EXPORTED,
  license: 'Open Database License (ODbL) 1.0; individual contents: Database Contents License (DbCL) 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  count: kept.length,
  criteria: `Sold in the United States, with a product name and an ingredient list, scanned at least once on Open Food Facts. US products first (a US or Canadian barcode, or most scanned in the US), then by number of scans; at most ${MAX.toLocaleString('en-US')}.`,
  fields: ['name', 'brand', 'ingredients', 'nova', 'additives', 'categories', 'kcal_100g', 'sugars_100g', 'sodium_100g', 'alcohol_100g'],
};
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
console.log(`Read ${rows.toLocaleString()} products; ${usWithIngredients.toLocaleString()} sold in the US with ingredients.`);
const usCount = [...best.values()].filter((p) => p.usFirst).length;
console.log(`${best.size.toLocaleString()} scanned at least once; ${usCount.toLocaleString()} of them US first.`);
console.log(`Kept ${kept.length.toLocaleString()} (${kept.filter((p) => p.usFirst).length.toLocaleString()} US first): products ${mb(bytes)} in 100 files, names ${mb(names.length)}.`);

// The ingredient grade of each product, for the search list.
const graded = spawnSync(process.execPath, [path.join(ROOT, 'scripts/grade-products.mjs')], { stdio: 'inherit' });
if (graded.status !== 0) process.exit(graded.status ?? 1);
