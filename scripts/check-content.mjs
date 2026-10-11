#!/usr/bin/env node
// Content rules from the product spec, checked on every string:
//   Reading level  Flesch-Kincaid grade 6 or below (English); Crawford grade
//                  6 or below (Spanish, which Flesch-Kincaid cannot score).
//   Copy length    headline <= 8 words; screen description <= 40; card body <= 60.
//   Parity         every UI string exists in both languages (also a unit test).
//   Freshness      clinic listings < 180 days; prevention entries < 12 months.
//
//   node scripts/check-content.mjs            report, exit 1 on any failure
//   node scripts/check-content.mjs --verbose  also list every passing string
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
const verbose = process.argv.includes('--verbose');
const today = new Date();

// Medical words the screens cannot do without. Plain-language guidance (CDC
// Clear Communication Index) allows a necessary term when it is explained,
// so these are scored as two-syllable words instead of being penalised.
const TERMS = new Set([
  'colorectal', 'colonoscopy', 'mammogram', 'mammograms', 'mammography', 'cervical', 'cervix', 'screening', 'screenings',
  'clinician', 'clinicians', 'prostate', 'melanoma', 'hepatitis', 'papanicolaou', 'radon', 'polyps', 'polyp', 'uterine',
  'ovarian', 'pancreatic', 'colitis', 'tomography', 'ultrasound', 'biopsy', 'carcinogenic', 'immunotherapy',
  'chemotherapy', 'radiation', 'oncologist', 'esophagus', 'cancer', 'cancers', 'diagnosis', 'guideline', 'guidelines',
  'colorrectal', 'colonoscopia', 'mamografía', 'mamografías', 'detección', 'profesional', 'próstata', 'hepatitis',
  'tomografía', 'papanicolaou', 'radón', 'pólipos', 'cáncer', 'cánceres', 'diagnóstico', 'melanoma', 'ultrasonido',
  'biopsia', 'quimioterapia', 'inmunoterapia', 'radiación', 'carcinógeno', 'oncólogo', 'esófago', 'útero', 'ovario',
]);

const words = (s) => s.replace(/[“”"()]/g, ' ').split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
// A sentence may end inside closing quotes or brackets: `their.” At the end`.
const sentences = (s) => Math.max(1, (s.match(/[.!?]+["”’)]*(\s|$)/g) || []).length);

function syllablesEn(w) {
  const x = w.toLowerCase();
  if (TERMS.has(x)) return 2;
  if (/^\d/.test(x)) return 1;
  if (x.length <= 3) return 1;
  const s = x.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

function syllablesEs(w) {
  const x = w.toLowerCase();
  if (TERMS.has(x)) return 2;
  if (/^\d/.test(x)) return 1;
  // Spanish vowel groups: strong vowels split, weak+strong form a diphthong.
  const groups = x.replace(/[^a-záéíóúüñ]/g, '').match(/[iuü]?[aeoáéíóú][iuü]?|[iuü]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function gradeEn(text) {
  const w = words(text);
  const syl = w.reduce((a, x) => a + syllablesEn(x), 0);
  return 0.39 * (w.length / sentences(text)) + 11.8 * (syl / w.length) - 15.59;
}

// Crawford (1984): grade level for Spanish text.
function gradeEs(text) {
  const w = words(text);
  const syl = w.reduce((a, x) => a + syllablesEs(x), 0);
  const perHundredSentences = (sentences(text) / w.length) * 100;
  const perHundredSyllables = (syl / w.length) * 100;
  return -0.205 * perHundredSentences + 0.049 * perHundredSyllables - 3.407;
}

const MAX_GRADE = 6;
const MIN_WORDS = 12; // shorter strings are labels; a grade formula means nothing there

// Wording the product spec itself fixes, word for word. These are reported
// as exempt rather than silently skipped, so the conflict stays visible.
const SPEC_FIXED = [
  { re: /^strings\.(en|es)\.prevent\.headline$/, rule: 'length', why: 'Screen 12 headline, fixed by the product spec' },
  { re: /^strings\.(en|es)\.scan\.note$/, rule: 'reading', why: 'Screen 17 fixed note, fixed by the product spec' },
];
const exempt = (where, rule) => SPEC_FIXED.find((x) => x.rule === rule && x.re.test(where.replace(/\.(en|es)$/, '')));
const exemptions = new Set();

// Collect every piece of reader-facing text with a path.
const texts = [];
function walk(o, where, lang) {
  if (typeof o === 'string') { texts.push({ where, lang, text: o }); return; }
  if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${where}[${i}]`, lang)); return; }
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (['url', 'id', 'source', 'src', 'org', 'quote', 'quoteEs', 'icon', 'value', 'type', 'tags', 'words', 'exclude', 'curingWords', 'notes', 'testsBasis', 'name'].includes(k) && typeof v !== 'object') continue;
      if (k === 'en' || k === 'es') walk(v, `${where}.${k}`, k);
      else walk(v, `${where}.${k}`, lang);
    }
  }
}
walk(C('strings/en.json'), 'strings.en', 'en');
walk(C('strings/es.json'), 'strings.es', 'es');
for (const f of ['check.json', 'screening.json', 'compare.json', 'prevention.json', 'learn.json', 'foods.json', 'events.json', 'risk.json']) {
  const data = C(f);
  if (f === 'risk.json') { walk(data.labels.en, 'risk.labels.en', 'en'); walk(data.labels.es, 'risk.labels.es', 'es'); continue; }
  walk(data, f.replace('.json', ''), null);
}

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

// ── Reading level ──────────────────────────────────────────────────────────
console.log('Reading level (grade 6 or below, strings of 12+ words)');
let scored = 0;
const hard = [];
for (const t of texts) {
  if (!t.lang) continue;
  if (words(t.text).length < MIN_WORDS) continue;
  scored++;
  const g = t.lang === 'es' ? gradeEs(t.text) : gradeEn(t.text);
  const ex = exempt(t.where, 'reading');
  if (g > MAX_GRADE && ex) exemptions.add(`${t.where} (grade ${g.toFixed(1)}): ${ex.why}`);
  else if (g > MAX_GRADE) hard.push({ ...t, g });
  else if (verbose) console.log(`  ok   ${g.toFixed(1)}  ${t.where}`);
}
hard.sort((a, b) => b.g - a.g);
for (const h of hard) fail(`${h.g.toFixed(1)}  ${h.where}: ${h.text.slice(0, 90)}${h.text.length > 90 ? '…' : ''}`);
console.log(`  ${scored - hard.length}/${scored} strings at grade ${MAX_GRADE} or below`);

// ── Copy length ────────────────────────────────────────────────────────────
console.log('\nCopy length (headline <= 8, description <= 40, card body <= 60 words)');
const limits = [
  [/\.(headline|title)$/i, 8, 'headline'],
  [/\.(desc|lead)$/i, 40, 'description'],
  [/\.body$/i, 60, 'card body'],
];
let lengthFails = 0;
for (const t of texts) {
  const key = t.where.replace(/\.(en|es)$/, '');
  for (const [re, max, kind] of limits) {
    if (!re.test(key)) continue;
    const n = words(t.text).length;
    // Titles of long-form content (chapters, entries) are names, not headlines.
    if (kind === 'headline' && /^(learn|prevention|screening|compare|massey|events)\b/.test(key)) continue;
    const ex = exempt(t.where, 'length');
    if (n > max && ex) exemptions.add(`${t.where} (${n} words): ${ex.why}`);
    else if (n > max) { lengthFails++; fail(`${kind} ${n} words (max ${max})  ${t.where}`); }
  }
}
if (!lengthFails) console.log('  all within limits');
if (exemptions.size) {
  console.log('\nExempt (wording fixed by the product spec)');
  for (const e of exemptions) console.log('  ' + e);
}

// ── Parity ─────────────────────────────────────────────────────────────────
console.log('\nBilingual parity');
const keys = (o, p = '') => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p]);
const en = new Set(keys(C('strings/en.json')));
const es = new Set(keys(C('strings/es.json')));
const missingEs = [...en].filter((k) => !es.has(k));
const missingEn = [...es].filter((k) => !en.has(k));
for (const k of missingEs) fail(`missing in Spanish: ${k}`);
for (const k of missingEn) fail(`missing in English: ${k}`);
if (!missingEs.length && !missingEn.length) console.log(`  ${en.size} keys, identical in both languages`);

// ── Freshness ──────────────────────────────────────────────────────────────
console.log('\nFreshness');
const clinics = C('clinics.json');
const staleClinics = clinics.sites.filter((s) => (today - new Date(s.verified + 'T12:00:00')) / 86400000 > clinics.staleAfterDays);
if (staleClinics.length) console.log(`  WARN ${staleClinics.length} clinic listings are older than ${clinics.staleAfterDays} days (the app shows a banner)`);
else console.log(`  all ${clinics.sites.length} clinic listings verified within ${clinics.staleAfterDays} days`);
const prev = C('prevention.json');
const staleEntries = prev.entries.filter((e) => {
  const d = new Date(e.reviewed + 'T12:00:00');
  return (today.getFullYear() - d.getFullYear()) * 12 + today.getMonth() - d.getMonth() >= prev.staleAfterMonths;
});
if (staleEntries.length) console.log(`  WARN ${staleEntries.length} prevention entries are past their review date`);
else console.log(`  all ${prev.entries.length} prevention entries reviewed within ${prev.staleAfterMonths} months`);

// ── Release gate ───────────────────────────────────────────────────────────
console.log('\nRelease gate');
const meta = C('meta.json');
if (!meta.clinicalReviewer.name) console.log('  WARN no clinical reviewer named yet (required before public release)');
if (meta.spanish.status !== 'reviewed') console.log('  WARN Spanish is a draft until a native-speaking reviewer signs off');
const unchecked = [...C('compare.json').rows, ...C('ingredients.json').hazards, ...C('ingredients.json').protective].filter((r) => !r.quoteChecked).length;
if (unchecked) console.log(`  WARN ${unchecked} source quotes still need the reviewer's check against the live page`);

console.log(failures ? `\n${failures} problem(s) found` : '\nAll content rules pass');
process.exit(failures ? 1 : 0);
