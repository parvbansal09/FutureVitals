// The built-in product list: part of the Open Food Facts database, made by
// scripts/build-products.mjs (products sold in the US that people have
// scanned). It is split into 100 files by the last two digits of the barcode,
// so a look-up loads one small file, and a names file for search. Everything
// here runs on the phone and sends nothing.
import { barcodeKeys, normalize, type Grade, type ProductInput } from '../engine/scanner';
import metaJson from '../../content/products/meta.json';

/** name, brand, ingredients, NOVA, additive codes, category tags, kcal, sugars, sodium, alcohol (per 100 g) */
type Row = [string, string, string, number | null, string, string, number | null, number | null, number | null, number | null];
/** The grade is worked out ahead by scripts/grade-products.mjs, so a search list can show it without loading every product. */
type NameRow = [code: string, name: string, brand: string, grade: Grade | ''];

export const productsMeta = metaJson as {
  count: number; exported: string; criteria: string; license: string; licenseUrl: string;
  /** What the stored grades were worked out from (see scripts/grade-products.mjs). */
  grades?: { rules: string };
};

const shards = import.meta.glob<Record<string, Row>>('../../content/products/p-*.json', { import: 'default' });
const loadNames = () => import('../../content/products/names.json').then((m) => m.default as unknown as NameRow[]);

/** Letters and digits only, as space-separated words: "Coca-Cola" -> "coca cola". */
const plain = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, ' ').trim();

const tags = (s: string) => (s ? s.split(' ').map((t) => `en:${t}`) : []);

export function toProduct(code: string, r: Row): ProductInput {
  return {
    code,
    name: r[0],
    brand: r[1],
    ingredientsText: r[2],
    nova: r[3],
    additiveTags: tags(r[4]),
    categoryTags: tags(r[5]),
    nutriments: { kcal: r[6], sugars: r[7], sodium: r[8], alcohol: r[9] },
    source: 'local',
  };
}

/** A barcode from the built-in list, or null when the list does not have it. */
export async function localProduct(raw: string): Promise<ProductInput | null> {
  for (const key of barcodeKeys(raw)) {
    const load = shards[`../../content/products/p-${key.slice(-2)}.json`];
    if (!load) continue;
    try {
      const row = (await load())[key];
      if (row) return toProduct(key, row);
    } catch {
      return null;
    }
  }
  return null;
}

export interface ProductHit { code: string; name: string; brand: string; grade: Grade | null }

let index: Promise<{ rows: NameRow[]; hay: string[] }> | null = null;
const getIndex = () => {
  index ??= loadNames().then((rows) => ({ rows, hay: rows.map(([, n, b]) => ` ${plain(`${n} ${b}`)}`) }));
  return index;
};

/**
 * Products whose name or brand has every typed word, each at the start of a
 * word ("cheer" finds Cheerios). The list is most scanned first, so the
 * familiar product comes up before a rare one.
 */
export async function searchProducts(query: string, limit = 12): Promise<ProductHit[]> {
  const words = plain(query).split(' ').filter(Boolean);
  if (!words.length || words.join('').length < 2) return [];
  const { rows, hay } = await getIndex();
  const out: ProductHit[] = [];
  for (let i = 0; i < rows.length && out.length < limit; i++) {
    if (words.every((w) => hay[i].includes(` ${w}`))) out.push({ code: rows[i][0], name: rows[i][1], brand: rows[i][2], grade: rows[i][3] || null });
  }
  return out;
}

/** Starts loading the names file, so the first search does not wait for it. */
export const warmProductSearch = () => { void getIndex(); };
