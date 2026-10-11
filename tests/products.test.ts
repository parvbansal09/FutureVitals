import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import names from '../content/products/names.json';
import { barcodeFromText, barcodeKeys, evaluateProduct, expandUpcE, validCheckDigit } from '../src/engine/scanner';
import { localProduct, productsMeta, searchProducts } from '../src/platform/products';

// These read the real built-in list (content/products, from Open Food Facts).
// The products are among the most scanned in the US, so a rebuild keeps them.
describe('built-in product list', () => {
  it('reads every printed form of a barcode as one key', () => {
    expect(barcodeKeys('016000275263')).toEqual(['0016000275263']); // UPC-A, as printed on US packs
    expect(barcodeKeys('0016000275263')).toEqual(['0016000275263']); // EAN-13
    expect(barcodeKeys('00016000275263')).toEqual(['0016000275263']); // GTIN-14
    expect(barcodeKeys('0 16000 27526 3')).toEqual(['0016000275263']);
    expect(barcodeKeys('123')).toEqual([]);
  });

  it('trusts a barcode number only when its check digit holds', () => {
    expect(validCheckDigit('0044700019887')).toBe(true); // EAN-13
    expect(validCheckDigit('044700019887')).toBe(true); // UPC-A
    expect(validCheckDigit('96385074')).toBe(true); // EAN-8
    expect(validCheckDigit('044700019886')).toBe(false); // one digit off
    expect(validCheckDigit('04470001988')).toBe(false); // wrong length
  });

  it('finds the printed barcode number in text read off a photo', () => {
    expect(barcodeFromText('0 44700 01988 7')).toBe('044700019887');
    expect(barcodeFromText('Net wt 12 oz\n0 16000 27526 3\nBest by 2027')).toBe('016000275263');
    expect(barcodeFromText('O 44700 0l988 7')).toBe('044700019887'); // O read for 0, l for 1
    expect(barcodeFromText('0 44700 01988 6')).toBeNull(); // misread: check digit fails
    expect(barcodeFromText('Call 1 800 555 0199')).toBeNull();
  });

  it('writes a short UPC-E code out in full, as small cans carry', () => {
    expect(expandUpcE('04965802')).toBe('049000006582'); // Diet Coke can
    expect(barcodeKeys('04965802')).toEqual(['04965802', '0049000006582']);
    expect(expandUpcE('96385074')).toBeNull(); // an EAN-8, not a UPC-E
  });

  it('finds a product by barcode on the phone, in any barcode form', async () => {
    const p = await localProduct('016000275263');
    expect(p?.name).toMatch(/Cheerios/);
    expect(p?.brand).toBe('General Mills');
    expect(p?.source).toBe('local');
    expect((await localProduct('00016000275263'))?.code).toBe('0016000275263');
    expect(await localProduct('0000000000000')).toBeNull();
  });

  it('labels real products the way the rules say', async () => {
    const bacon = evaluateProduct((await localProduct('044700019887'))!); // Oscar Mayer Original Bacon
    expect(bacon.label).toBe('limit');
    expect(bacon.hazards[0].id).toBe('processed-meat');
    expect(bacon.diary).toBe('proc');

    const diet = evaluateProduct((await localProduct('04965802'))!); // Diet Coke, by its UPC-E code
    expect(diet.hazards.map((h) => h.id)).toContain('aspartame');
    expect(diet.label).toBe('moderation');

    const spread = evaluateProduct((await localProduct('009800895007'))!); // Nutella
    expect(spread.nova).toBe(4);
    expect(spread.protective.map((r) => r.id)).not.toContain('dairy');
  });

  it('grades real products by the items linked to cancer in them', async () => {
    const of = async (code: string) => evaluateProduct((await localProduct(code))!).grade?.grade;
    expect(await of('044700019887')).toBe('D'); // Oscar Mayer bacon: processed meat
    expect(await of('04965802')).toBe('C'); // Diet Coke: aspartame and caramel color
    expect(await of('016000275263')).toBe('A'); // Cheerios: nothing on the lists
    expect(await of('0078742040370')).toBe('A'); // Great Value water
  });

  it('search shows each product with its grade', async () => {
    const hit = (await searchProducts('oscar mayer bacon')).find((h) => h.code === '0044700019887');
    expect(hit?.grade).toBe('D');
  });

  // The grades in names.json are worked out ahead (npm run grades). If this
  // fails, the scanner rules changed since: run npm run grades.
  it('stored grades are up to date with the scanner rules', async () => {
    const rules = readFileSync('content/ingredients.json', 'utf8').replace(/\r\n/g, '\n');
    expect(productsMeta.grades?.rules, 'run npm run grades').toBe(createHash('sha256').update(rules).digest('hex').slice(0, 16));
    const rows = names as unknown as [string, string, string, string][];
    expect(rows.every((r) => r.length === 4)).toBe(true);
    // Every 50th product, graded again by the engine, matches what is stored.
    const off: string[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const [code, , , stored] = rows[i];
      const now = evaluateProduct((await localProduct(code))!).grade?.grade ?? '';
      if (now !== stored) off.push(`${code} stored ${stored} now ${now}`);
    }
    expect(off, 'run npm run grades').toEqual([]);
  }, 60000);

  it('searches names and brands by the start of each word, most scanned first', async () => {
    expect((await searchProducts('cheerios'))[0].name).toMatch(/Cheerios/i);
    expect((await searchProducts('cheer'))[0].name).toMatch(/Cheerios/i);
    expect((await searchProducts('oscar mayer bacon')).map((h) => h.code)).toContain('0044700019887');
    expect(await searchProducts('a')).toEqual([]);
    expect(await searchProducts('zzzqxv')).toEqual([]);
  });

  it('carries its source and license with it', () => {
    expect(productsMeta.count).toBeGreaterThan(50000);
    expect(productsMeta.license).toMatch(/Open Database License/);
  });
});
