// Product scanner rules. A label comes from rules in content/ingredients.json,
// never from a score, a grade, or a count of flagged ingredients:
//
//   Worth limiting      an IARC Group 1 or 2A item, or NOVA 4 with added sugar
//                       or salt above the WHO (PAHO) thresholds
//   Fine in moderation  NOVA 3 or 4 with no Group 1/2A item, or a Group 2B
//                       additive, or a WCRF-listed risk item
//   No cancer evidence  nothing in it is on the IARC or WCRF risk lists
//
// Protective WCRF items are listed separately and never change the label.
// Rules marked "lead" (protective foods, alcohol) only count a word among the
// first three ingredients: a trace of milk powder is not a dairy serving.
//
// Beside the label, every product gets an ingredient grade, A to F (see
// gradeProduct below). The grade is a count; the label stays rule-based.
import { foods, ingredients, type Evidence, type FoodDef, type Grade, type IngredientRule } from './content';

export type { Evidence, Grade };

export interface ProductInput {
  code?: string;
  name?: string;
  brand?: string;
  ingredientsText: string;
  ingredientTags?: string[];
  additiveTags?: string[];
  categoryTags?: string[];
  nova?: number | null;
  nutriments?: { kcal?: number | null; sugars?: number | null; sodium?: number | null; fiber?: number | null; alcohol?: number | null };
  /** off: looked up online; local: the built-in list; cache: looked up online before. */
  source: 'off' | 'local' | 'cache' | 'ocr' | 'typed';
}

export type ScanLabel = 'limit' | 'moderation' | 'none';
export type ScanReason = 'group1' | 'nova4' | 'processed' | 'group2b' | 'wcrf' | 'clean';

export interface ScanResult {
  label: ScanLabel;
  /** The ingredient grade, or null when there was nothing to read (no ingredient list). */
  grade: ProductGrade | null;
  reasons: ScanReason[];
  nova: number | null;
  novaEstimated: boolean;
  hazards: IngredientRule[];
  protective: IngredientRule[];
  sugarHigh: boolean;
  saltHigh: boolean;
  diary: string | null;
}

/** Lower case, accents removed, tags turned into words ("en:hot-dogs" -> "hot dogs"). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[_*•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The first few ingredients of a list, without their bracketed sub-ingredients:
 * "Sugar, palm oil, hazelnuts (13%), skimmed milk powder" -> "Sugar, palm oil, hazelnuts".
 * Starts after an "Ingredients:" heading when a photo caught one, and never
 * splits a number ("6,6%" or "13.5%").
 */
export function leadIngredients(text: string, n = 3): string {
  const heading = /ingredient(?:e)?s\s*:/i.exec(text);
  const s = heading ? text.slice(heading.index + heading[0].length) : text;
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length && parts.length < n; i++) {
    const ch = s[i];
    if ('([{'.includes(ch)) { depth++; continue; }
    if (')]}'.includes(ch)) { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const inNumber = (ch === ',' || ch === '.') && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '');
    if (!inNumber && (ch === ',' || ch === ';' || ch === '.' || ch === '\n')) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (parts.length < n && cur.trim()) parts.push(cur.trim());
  return parts.join(', ');
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text: string, word: string) =>
  new RegExp(`(?:^|[^a-z0-9])${escape(normalize(word))}(?:[^a-z0-9]|$)`).test(text);
const anyWord = (text: string, words: string[] = []) => words.some((w) => hasWord(text, w));
const stripPhrases = (text: string, phrases: string[] = []) =>
  phrases.reduce((t, p) => t.replace(new RegExp(escape(normalize(p)), 'g'), ' '), text);

const tagWords = (tags: string[] = []) => tags.map((t) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).join(', ');

// Meat words that make a nitrite or nitrate a sign of cured (processed) meat.
const MEAT_CONTEXT = ['beef', 'pork', 'chicken', 'turkey', 'meat', 'mechanically separated', 'res', 'cerdo', 'pollo', 'pavo', 'carne'];

const MEAT_RULES = new Set(['processed-meat', 'red-meat']);

/** `text` is the whole list plus tag words; `lead` is the first three ingredients. */
function matches(rule: IngredientRule, text: string, lead: string, tags: Set<string>): boolean {
  const t = stripPhrases(rule.lead ? lead : text, rule.exclude);
  if (anyWord(t, rule.words)) return true;
  if ((rule.tags || []).some((tag) => tags.has(tag))) return true;
  if (rule.curingWords) {
    const all = stripPhrases(text, rule.exclude);
    if (anyWord(all, rule.curingWords) && anyWord(all, MEAT_CONTEXT)) return true;
  }
  return false;
}

export function evaluateProduct(p: ProductInput): ScanResult {
  const tags = new Set([...(p.categoryTags || []), ...(p.additiveTags || []), ...(p.ingredientTags || [])]);
  const text = normalize(`${p.ingredientsText || ''}, ${tagWords(p.ingredientTags)}, ${tagWords(p.additiveTags)}`);
  const lead = normalize(leadIngredients(p.ingredientsText || ''));
  const nutr = p.nutriments || {};
  const meatFree = ingredients.meatFreeTags.some((tag) => tags.has(tag));

  let hazards = ingredients.hazards.filter((r) => !(meatFree && MEAT_RULES.has(r.id)) && matches(r, text, lead, tags));
  if (!hazards.some((h) => h.id === 'alcohol') && (nutr.alcohol ?? 0) > 0.5) {
    hazards.push(ingredients.hazards.find((h) => h.id === 'alcohol')!);
  }
  // Processed meat already covers the red meat inside it.
  if (hazards.some((h) => h.id === 'processed-meat')) hazards = hazards.filter((h) => h.id !== 'red-meat');
  const severity = (r: IngredientRule) => (r.iarc === '1' ? 0 : r.iarc === '2A' ? 1 : r.wcrf ? 2 : 3);
  hazards.sort((x, y) => severity(x) - severity(y));

  const protective = ingredients.protective.filter((r) => matches(r, text, lead, tags));

  // Processing level: the database's own NOVA group when it has one, otherwise
  // an estimate from ultra-processing markers (said as an estimate on screen).
  let nova: number | null = typeof p.nova === 'number' && p.nova >= 1 && p.nova <= 4 ? p.nova : null;
  let novaEstimated = false;
  if (nova === null && anyWord(text, ingredients.nova4Markers)) {
    nova = 4;
    novaEstimated = true;
  }

  const kcal = nutr.kcal ?? null;
  const addedSugar = anyWord(text, ingredients.addedSugarWords);
  const addedSalt = anyWord(text, ingredients.addedSaltWords);
  const th = ingredients.thresholds;
  const sugarHigh = addedSugar && !!kcal && kcal > 0 && typeof nutr.sugars === 'number'
    && (nutr.sugars * 4) / kcal >= th.freeSugarEnergyShare;
  const saltHigh = addedSalt && !!kcal && kcal > 0 && typeof nutr.sodium === 'number'
    && (nutr.sodium * 1000) / kcal >= th.sodiumMgPerKcal;

  const g1 = hazards.some((h) => h.iarc === '1' || h.iarc === '2A');
  const g2b = hazards.some((h) => h.iarc === '2B');
  const wcrfRisk = hazards.some((h) => !h.iarc && !!h.wcrf);

  let label: ScanLabel;
  const reasons: ScanReason[] = [];
  if (g1) {
    label = 'limit';
    reasons.push('group1');
  } else if (nova === 4 && (sugarHigh || saltHigh)) {
    label = 'limit';
    reasons.push('nova4');
  } else if (nova === 3 || nova === 4 || g2b || wcrfRisk) {
    label = 'moderation';
    if (nova === 3 || nova === 4) reasons.push('processed');
    if (g2b) reasons.push('group2b');
    if (wcrfRisk) reasons.push('wcrf');
  } else {
    label = 'none';
    reasons.push('clean');
  }

  // Nothing to grade without an ingredient list or category (an online record can lack both).
  const known = !!(p.ingredientsText || '').trim() || tags.size > 0 || (nutr.alcohol ?? 0) > 0;
  const grade = known ? gradeProduct(hazards, nova === 4 && (sugarHigh || saltHigh)) : null;

  return { label, grade, reasons, nova, novaEstimated, hazards, protective, sugarHigh, saltHigh, diary: diaryGroup(hazards, protective, tags, addedSugar) };
}

// ── Ingredient grade ──────────────────────────────────────────────────────
// A to F, from the items linked to cancer in a product. Each item adds points
// once, by how strong the evidence is that it can cause cancer (IARC group, or
// WCRF), with the points and bands in content/ingredients.json → grade. It
// counts items, not amounts: it cannot tell a trace from a main ingredient.
// Protective foods add nothing and take nothing away.

export interface GradeItem {
  evidence: Evidence;
  points: number;
  /** The rule that matched; none for ultra-processing or a diary food. */
  rule?: IngredientRule;
}
export interface ProductGrade { grade: Grade; points: number; items: GradeItem[] }

/** The evidence level of a scanner rule. */
export const ruleEvidence = (r: IngredientRule): Evidence =>
  r.iarc === '1' ? 'iarc1' : r.iarc === '2A' ? 'iarc2A' : r.iarc === '2B' ? 'iarc2B' : 'wcrf';

/** The grade for a point total: the last band whose lowest total it reaches. */
export function gradeOf(points: number): Grade {
  let grade: Grade = 'A';
  for (const [band, min] of ingredients.grade.bands) if (points >= min) grade = band;
  return grade;
}

const gradeItem = (evidence: Evidence, rule?: IngredientRule): GradeItem => ({ evidence, points: ingredients.grade.points[evidence], rule });

function totalGrade(items: GradeItem[]): ProductGrade {
  const points = items.reduce((sum, i) => sum + i.points, 0);
  return { grade: gradeOf(points), points, items };
}

/**
 * A product's grade from the items linked to cancer found in it (each counted
 * once, strongest first) and whether it is ultra-processed with added sugar or
 * salt over the WHO limits, which WCRF links to weight gain.
 */
export function gradeProduct(hazards: IngredientRule[], ultraHigh: boolean): ProductGrade {
  const items = hazards.map((h) => gradeItem(ruleEvidence(h), h));
  if (ultraHigh) items.push(gradeItem('weight'));
  return totalGrade(items);
}

/** The grade of one scanner rule on its own, as a product with only that item would get. */
export const gradeRule = (rule: IngredientRule): ProductGrade =>
  totalGrade(ingredients.hazards.includes(rule) ? [gradeItem(ruleEvidence(rule), rule)] : []);

/** The grade of a diary food on its own: foods to choose have no evidence, so grade A. */
export const gradeFood = (food: FoodDef): ProductGrade => totalGrade(food.evidence ? [gradeItem(food.evidence)] : []);

/** The food-diary group a product logs into, or null to ask the person. */
function diaryGroup(hazards: IngredientRule[], protective: IngredientRule[], tags: Set<string>, addedSugar: boolean): string | null {
  const has = (id: string) => hazards.some((h) => h.id === id);
  if (has('alcohol')) return 'alcohol';
  if (has('processed-meat')) return 'proc';
  if (has('red-meat')) return 'red';
  if (has('salted-food')) return 'salted';
  const groups = ingredients.categoryGroups;
  const inGroup = (g: string) => (groups[g] || []).some((t) => tags.has(t));
  if (addedSugar && inGroup('sugary')) return 'sugary';
  for (const g of ['fried', 'fiber', 'legume', 'dairy', 'fruit', 'veg']) if (inGroup(g)) return g;
  const prot = protective[0];
  return prot ? prot.diary : null;
}

// ── Open Food Facts → ProductInput ────────────────────────────────────────
export const OFF_FIELDS = [
  'code', 'product_name', 'product_name_en', 'product_name_es', 'brands',
  'ingredients_text', 'ingredients_text_en', 'ingredients_text_es',
  'ingredients_tags', 'additives_tags', 'categories_tags', 'nova_group', 'nutriments',
].join(',');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromOpenFoodFacts(prod: any, code: string): ProductInput {
  const n = prod?.nutriments || {};
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : null);
  const kcal = num(n['energy-kcal_100g']) ?? (num(n.energy_100g) !== null ? (num(n.energy_100g) as number) / 4.184 : null);
  return {
    code,
    name: prod?.product_name_en || prod?.product_name || prod?.product_name_es || '',
    brand: typeof prod?.brands === 'string' ? prod.brands.split(',')[0].trim() : '',
    ingredientsText: prod?.ingredients_text_en || prod?.ingredients_text || prod?.ingredients_text_es || '',
    ingredientTags: Array.isArray(prod?.ingredients_tags) ? prod.ingredients_tags : [],
    additiveTags: Array.isArray(prod?.additives_tags) ? prod.additives_tags : [],
    categoryTags: Array.isArray(prod?.categories_tags) ? prod.categories_tags : [],
    nova: num(prod?.nova_group),
    nutriments: { kcal, sugars: num(n.sugars_100g), sodium: num(n.sodium_100g), fiber: num(n.fiber_100g), alcohol: num(n.alcohol_100g) },
    source: 'off',
  };
}

/** Barcodes on food: EAN-8, UPC-E, UPC-A, EAN-13, and 14-digit GTIN. */
export const validBarcode = (s: string) => /^\d{8}$|^\d{12,14}$/.test(s.replace(/\s/g, ''));

/**
 * True when the last digit of an EAN-8, UPC-A, EAN-13 or GTIN-14 is the right
 * check digit for the rest (weights 3 and 1 from the right). A misread digit
 * almost always breaks it, so a number read off a photo is trusted only when it holds.
 */
export function validCheckDigit(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * The barcode number printed under the bars, from text read off a photo. The
 * digits come in groups ("0 44700 01988 7"), so runs of digits and spaces are
 * joined. A run that is itself a 13-, 12- or 8-digit code with a valid check
 * digit wins; otherwise the first valid 13 or 12 digits inside a longer run.
 * An 8-digit code is never taken from inside a longer number, where a phone
 * number would pass by chance one time in ten. Letters a reader often
 * mistakes for digits next to digits (O for 0, l, I and | for 1) are fixed first.
 */
export function barcodeFromText(text: string): string | null {
  // Only a letter standing among digits, never one inside a word ("Call 1 800…").
  const lone = (letters: string) =>
    new RegExp(`(?<![A-Za-z])[${letters}](?![A-Za-z])(?= ?\\d)|(?<=\\d ?)(?<![A-Za-z])[${letters}](?![A-Za-z])`, 'g');
  const fixed = text.replace(lone('Oo'), '0').replace(lone('lI|'), '1');
  const runs = (fixed.match(/\d[\d \t]{6,24}\d/g) || []).map((r) => r.replace(/\D/g, ''));
  for (const d of runs) if ([13, 12, 8].includes(d.length) && validCheckDigit(d)) return d;
  for (const d of runs) {
    for (const len of [13, 12]) {
      for (let i = 0; i + len <= d.length; i++) {
        const c = d.slice(i, i + len);
        if (validCheckDigit(c)) return c;
      }
    }
  }
  return null;
}

// Words that show up on ingredient labels, to tell a real reading from noise.
// The scanner rules and food groups add their own words to these.
const LABEL_WORDS = [
  'ingredients', 'ingredient', 'contains', 'less', 'than', 'water', 'sugar', 'salt', 'oil', 'flour', 'wheat', 'corn',
  'rice', 'oats', 'whole', 'grain', 'enriched', 'niacin', 'iron', 'thiamine', 'riboflavin', 'folic', 'acid', 'citric',
  'malic', 'lactic', 'ascorbic', 'sodium', 'potassium', 'calcium', 'phosphate', 'chloride', 'bicarbonate', 'natural',
  'artificial', 'flavor', 'flavors', 'flavoring', 'color', 'colors', 'extract', 'syrup', 'fructose', 'dextrose',
  'maltodextrin', 'starch', 'modified', 'soy', 'soybean', 'lecithin', 'canola', 'sunflower', 'palm', 'vegetable',
  'cheese', 'cheddar', 'milk', 'whey', 'cream', 'butter', 'eggs', 'egg', 'yeast', 'cultures', 'enzymes', 'spices',
  'spice', 'garlic', 'onion', 'powder', 'tomato', 'paprika', 'vinegar', 'cocoa', 'chocolate', 'vanilla', 'peanuts',
  'almonds', 'gum', 'xanthan', 'guar', 'pectin', 'gelatin', 'vitamin', 'mixed', 'tocopherols', 'preserve', 'freshness',
  'added', 'dried', 'concentrate', 'juice', 'honey', 'molasses', 'cane', 'brown', 'beef', 'pork', 'chicken', 'turkey',
  'nitrite', 'nitrate', 'erythorbate', 'benzoate', 'sorbate', 'caramel', 'aspartame', 'sucralose', 'monoglycerides',
  'diglycerides', 'protein', 'isolate', 'fiber', 'beans', 'peas', 'lentils', 'agua', 'azucar', 'sal', 'aceite',
  'harina', 'trigo', 'maiz', 'leche', 'queso', 'sabor', 'natural', 'acido', 'citrico', 'almidon', 'contiene',
];
let vocab: Set<string> | null = null;
function labelVocab(): Set<string> {
  if (vocab) return vocab;
  vocab = new Set(LABEL_WORDS);
  for (const r of [...ingredients.hazards, ...ingredients.protective]) {
    for (const w of r.words) for (const part of normalize(w).split(/[^a-z]+/)) if (part.length >= 4) vocab.add(part);
  }
  for (const f of foods.foods) {
    for (const w of `${f.examples.en},${f.examples.es}`.split(/[^\p{L}]+/u)) if (w.length >= 4) vocab.add(normalize(w));
  }
  return vocab;
}

export interface OcrIngredients {
  /** The ingredient list, cleaned: from "Ingredients:" to "Contains…" when the label has them. */
  text: string;
  /** False when the reading is mostly noise, so it is not shown as an ingredient list. */
  readable: boolean;
  /** For comparing two readings of the same photo (a turned one, say). */
  score: number;
}

/**
 * Turns what the text reader saw into an ingredient list, or says it could
 * not. A photo of a package front, a glossy curve or a blur reads as noise:
 * short fragments, mixed case, few real words. That is caught here rather
 * than shown to the person as if it were their ingredients.
 */
export function ingredientsFromOcr(raw: string, confidence = 100): OcrIngredients {
  const tokens = (s: string) => s.split(/[\s,;:().[\]{}"“”*•|/\\]+/).filter(Boolean);
  // A word: three or more letters, a vowel, and one consistent case.
  const wordlike = (t: string) => /^\p{L}[\p{L}'’-]{2,}$/u.test(t) && /[aeiouyáéíóú]/i.test(t)
    && (t === t.toLowerCase() || t === t.toUpperCase() || /^\p{Lu}[\p{Ll}'’-]+$/u.test(t));
  const share = (s: string) => { const t = tokens(s); return t.length ? t.filter(wordlike).length / t.length : 0; };

  const lines = raw.replace(/\r/g, '').replace(/-\n/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let text = lines.filter((l) => share(l) >= 0.5).join(' ').replace(/\s{2,}/g, ' ').trim();
  const start = text.match(/\b(ingredients?|ingredientes)\b\s*[:.]?\s*(.*)/i);
  if (start && start[2].length > 10) text = start[2];
  const stop = text.search(/\b(contains|contiene|distributed by|distribuido por|manufactured|allergen|nutrition facts)\b/i);
  if (stop > 20) text = text.slice(0, stop);
  text = text.replace(/^[^\p{L}]+/u, '').replace(/[\s,;:]+$/, '').trim();

  const all = tokens(raw);
  const words = all.filter(wordlike);
  const v = labelVocab();
  const known = new Set(words.map((w) => normalize(w).replace(/[^a-z]/g, '')).filter((w) => v.has(w))).size;
  const ratio = all.length ? words.length / all.length : 0;
  const readable = confidence >= 45 && words.length >= 4 && text.length >= 12 && (known >= 3 || (known >= 1 && ratio >= 0.6));
  return { text, readable, score: known * 3 + words.length * ratio };
}

/** A short UPC-E code (on small packs) written out as its full 12-digit UPC-A. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [s, a, b, c, d, e, f, check] = code;
  const body = f <= '2' ? `${a}${b}${f}0000${c}${d}${e}`
    : f === '3' ? `${a}${b}${c}00000${d}${e}`
      : f === '4' ? `${a}${b}${c}${d}00000${e}`
        : `${a}${b}${c}${d}${e}0000${f}`;
  return `${s}${body}${check}`;
}

/**
 * The keys the built-in product list may hold a barcode under. UPC-A, EAN-13
 * and GTIN-14 forms of one code share a 13-digit key; an 8-digit code is
 * tried as EAN-8 and, written out, as UPC-E. Mirrors scripts/build-products.mjs.
 */
export function barcodeKeys(raw: string): string[] {
  let d = raw.replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) d = `0${d}`;
  if (d.length === 13) return [d];
  if (d.length !== 8) return [];
  const upc = expandUpcE(d);
  return upc ? [d, `0${upc}`] : [d];
}

// ── Search by name, on the device ─────────────────────────────────────────
export type LocalHit =
  | { kind: 'rule'; rule: IngredientRule; label: ScanLabel }
  | { kind: 'food'; food: FoodDef };

/** Matches a typed name against the app's own ingredient and food lists. Sends nothing. */
export function searchLocal(query: string): LocalHit[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const hits: LocalHit[] = [];
  // Whole-word matches only, so "ginger ale" never matches "gin"; a plural
  // form is tried too, so "hot dogs" finds "hot dog".
  const forms = [...new Set([q, q.replace(/([a-z]{3,})s\b/g, '$1')])];
  const hit = (words: string[]) => words.some((w) => {
    const nw = normalize(w);
    if (!nw) return false;
    return forms.some((f) => hasWord(f, nw) || hasWord(nw, f) || (f.length >= 4 && nw.startsWith(f)));
  });
  for (const rule of ingredients.hazards) {
    if (hit([...rule.words, rule.label.en, rule.label.es])) {
      const label: ScanLabel = rule.iarc === '1' || rule.iarc === '2A' ? 'limit' : 'moderation';
      hits.push({ kind: 'rule', rule, label });
    }
  }
  for (const rule of ingredients.protective) {
    if (hit([...rule.words, rule.label.en, rule.label.es])) hits.push({ kind: 'rule', rule, label: 'none' });
  }
  for (const food of foods.foods) {
    const words = [food.name.en, food.name.es, ...food.examples.en.split(','), ...food.examples.es.split(',')];
    if (hit(words.map((w) => w.trim()).filter(Boolean))) hits.push({ kind: 'food', food });
  }
  return hits.slice(0, 8);
}
