import { describe, expect, it } from 'vitest';
import {
  evaluateProduct, gradeFood, gradeOf, gradeRule, ingredientsFromOcr, leadIngredients, searchLocal, validBarcode, type ProductInput,
} from '../src/engine/scanner';
import { foods, ingredients } from '../src/engine/content';
import { coverageOf, resolveZip } from '../src/engine/geo';
import { findClinics, noFilters } from '../src/engine/clinics';

const product = (p: Partial<ProductInput>): ProductInput => ({ ingredientsText: '', source: 'typed', ...p });

describe('product scanner labels (rules, not a score)', () => {
  it('hot dogs: processed meat is worth limiting, logged as processed meat', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Mechanically separated chicken, pork, water, salt, corn syrup, sodium nitrite', nova: 4 }));
    expect(r.label).toBe('limit');
    expect(r.hazards.map((h) => h.id)).toContain('processed-meat');
    expect(r.hazards.map((h) => h.id)).not.toContain('red-meat');
    expect(r.diary).toBe('proc');
  });

  it('turkey cured with celery powder counts as processed meat', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Turkey, water, sea salt, cultured celery powder' }));
    expect(r.hazards.map((h) => h.id)).toContain('processed-meat');
  });

  it('diet soda: aspartame (2B) and ultra-processed, fine in moderation', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Carbonated water, caramel color, phosphoric acid, aspartame, natural flavors', nova: 4, nutriments: { kcal: 0, sugars: 0, sodium: 0.01 } }));
    expect(r.label).toBe('moderation');
    expect(r.reasons).toEqual(expect.arrayContaining(['processed', 'group2b']));
  });

  it('sugary soda over the WHO sugar limit is worth limiting', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Carbonated water, high fructose corn syrup, caramel color, natural flavors', nova: 4, nutriments: { kcal: 42, sugars: 10.6, sodium: 0.004 }, categoryTags: ['en:sodas'] }));
    expect(r.label).toBe('limit');
    expect(r.reasons).toEqual(['nova4']);
    expect(r.sugarHigh).toBe(true);
    expect(r.diary).toBe('sugary');
  });

  it('plain oats: no cancer evidence, with whole grains listed as protective', () => {
    const r = evaluateProduct(product({ ingredientsText: '100% whole grain rolled oats', nova: 1 }));
    expect(r.label).toBe('none');
    expect(r.protective.map((p) => p.id)).toContain('whole-grains');
    expect(r.diary).toBe('fiber');
  });

  it('wine vinegar, root beer and sugar alcohols are not alcohol', () => {
    expect(evaluateProduct(product({ ingredientsText: 'red wine vinegar, water' })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'root beer flavor, sugar alcohol (erythritol)' })).hazards).toHaveLength(0);
  });

  it('beer is alcohol, Group 1', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Water, barley malt, hops', categoryTags: ['en:beers'] }));
    expect(r.label).toBe('limit');
    expect(r.diary).toBe('alcohol');
  });

  it('estimates NOVA 4 from ultra-processing markers when the database has none, and says so', () => {
    const r = evaluateProduct(product({ ingredientsText: 'enriched flour, sugar, soybean oil, dextrose, natural flavor, soy lecithin' }));
    expect(r.nova).toBe(4);
    expect(r.novaEstimated).toBe(true);
  });

  // Cases found by running real Open Food Facts records through the rules.
  it('a trace of milk powder in a sweet spread is not a dairy serving', () => {
    const r = evaluateProduct(product({
      ingredientsText: 'Sugar, vegetable fat (palm), hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa powder (7.4%), emulsifier: lecithins (soya), flavouring (vanillin).',
      ingredientTags: ['en:sugar', 'en:skimmed-milk-powder', 'en:milk-powder', 'en:dairy'],
      nova: 4, nutriments: { kcal: 539, sugars: 56.3, sodium: 0.043 },
    }));
    expect(r.label).toBe('limit');
    expect(r.protective).toHaveLength(0);
    expect(r.diary).toBeNull();
  });

  it('protective foods count when they lead the list', () => {
    expect(evaluateProduct(product({ ingredientsText: 'Cultured pasteurized nonfat milk, pectin' })).protective.map((p) => p.id)).toEqual(['dairy']);
    expect(evaluateProduct(product({ ingredientsText: 'Water, black beans, salt' })).protective.map((p) => p.id)).toEqual(['legumes']);
    expect(evaluateProduct(product({ ingredientsText: 'Enriched corn meal, vegetable oil, cheese seasoning (whey, cheddar cheese)' })).protective).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: '100% arabica coffee beans' })).protective).toHaveLength(0);
  });

  it('reads the lead ingredients without splitting numbers or counting sub-ingredients', () => {
    expect(leadIngredients('Sucre, huile de palme, NOISETTES 13,5%, LAIT 6,6%')).toBe('Sucre, huile de palme, NOISETTES 13,5%');
    expect(leadIngredients('Nutrition Facts ... INGREDIENTS: enriched flour (wheat flour, niacin), sugar, milk')).toBe('enriched flour, sugar, milk');
  });

  it('goat cheese, lard and broth are not red meat; veggie sausage is not processed meat', () => {
    expect(evaluateProduct(product({ ingredientsText: 'Pasteurized goat milk, salt, cultures' })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'Flour, water, manteca de cerdo, sal' })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'Water, noodles, beef broth, salt' })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'Pea protein, coconut oil, spices', categoryTags: ['en:meat-analogues', 'en:sausages'] })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'Soy chorizo (soy protein, chile)' })).hazards).toHaveLength(0);
  });

  it('wine cooked into a sauce is not alcohol; a drink led by wine or rum is', () => {
    expect(evaluateProduct(product({ ingredientsText: 'Tomatoes, onions, olive oil, garlic, red wine, basil, salt' })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'Vanilla wafers, sugar, natural rum flavor' })).hazards).toHaveLength(0);
    expect(evaluateProduct(product({ ingredientsText: 'Wine, sugar, natural flavors' })).hazards.map((h) => h.id)).toEqual(['alcohol']);
    expect(evaluateProduct(product({ ingredientsText: 'Carbonated water, sugar', nutriments: { alcohol: 4.5 } })).hazards.map((h) => h.id)).toEqual(['alcohol']);
  });

  it('salt-preserved fish is a WCRF risk item, fine in moderation, with its own reason', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Salted cod' }));
    expect(r.label).toBe('moderation');
    expect(r.reasons).toEqual(['wcrf']);
    expect(r.diary).toBe('salted');
  });

  it('search by name runs on the device and finds rules and foods', () => {
    expect(searchLocal('hot dogs').some((h) => h.kind === 'rule' && h.rule.id === 'processed-meat')).toBe(true);
    expect(searchLocal('ginger ale').some((h) => h.kind === 'rule' && h.rule.id === 'alcohol')).toBe(false);
    expect(searchLocal('soda').some((h) => h.kind === 'food' && h.food.id === 'sugary')).toBe(true);
  });

  it('accepts food barcodes only', () => {
    expect(validBarcode('049000028904')).toBe(true);
    expect(validBarcode('12345')).toBe(false);
  });
});

describe('ingredient grade (A to F, a count of items linked to cancer)', () => {
  const grade = (p: Partial<ProductInput>) => evaluateProduct(product(p)).grade;
  const rule = (id: string) => [...ingredients.hazards, ...ingredients.protective].find((r) => r.id === id)!;
  const food = (id: string) => foods.foods.find((f) => f.id === id)!;

  it('turns points into grades by the bands in the content file', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 12].map(gradeOf).join('')).toBe('ABCCDDFF');
  });

  it('nothing linked to cancer is an A, and protective foods do not change it', () => {
    expect(grade({ ingredientsText: 'Water' })).toEqual({ grade: 'A', points: 0, items: [] });
    expect(grade({ ingredientsText: 'Whole grain oats, salt' })?.grade).toBe('A');
  });

  it('one strong link (IARC Group 1) is a D: hot dogs', () => {
    const g = grade({ ingredientsText: 'Pork, water, salt, sodium nitrite' })!;
    expect(g.items.map((i) => `${i.rule?.id}+${i.points}`)).toEqual(['processed-meat+4']);
    expect(g.grade).toBe('D');
  });

  it('counts every item: two Group 2B additives are a C', () => {
    const g = grade({ ingredientsText: 'Carbonated water, caramel color IV, aspartame, phosphoric acid' })!;
    expect(g.items.map((i) => i.evidence)).toEqual(['iarc2B', 'iarc2B']);
    expect(g.grade).toBe('C');
  });

  it('several strong links are an F', () => {
    const g = grade({ ingredientsText: 'Bacon, wine, onions, salt' })!;
    expect(g.items.map((i) => i.rule?.id)).toEqual(['processed-meat', 'alcohol']);
    expect(g.points).toBe(8);
    expect(g.grade).toBe('F');
  });

  it('ultra-processed with sugar over the WHO limit adds one point, and keeps its label', () => {
    const r = evaluateProduct(product({ ingredientsText: 'Sugar, corn syrup, natural flavor', nutriments: { kcal: 400, sugars: 60 } }));
    expect(r.label).toBe('limit');
    expect(r.grade).toMatchObject({ grade: 'B', points: 1, items: [{ evidence: 'weight', points: 1 }] });
  });

  it('gives no grade when there is no ingredient list to check', () => {
    expect(grade({ ingredientsText: '  ' })).toBeNull();
  });

  it('grades an ingredient or a diary food on its own, for the search list', () => {
    expect(gradeRule(rule('processed-meat')).grade).toBe('D');
    expect(gradeRule(rule('red-meat')).grade).toBe('C');
    expect(gradeRule(rule('aspartame')).grade).toBe('B');
    expect(gradeRule(rule('whole-grains')).grade).toBe('A');
    expect(['proc', 'alcohol', 'red', 'salted', 'sugary', 'veg'].map((id) => gradeFood(food(id)).grade).join('')).toBe('DDCCBA');
  });
});

describe('location on the device', () => {
  it('resolves a Richmond ZIP from the Census table', () => {
    const r = resolveZip('23220');
    expect(r.status).toBe('ok');
  });
  it('says outside Virginia rather than showing an empty list', () => {
    expect(resolveZip('20001')).toEqual({ status: 'outside', state: 'District of Columbia' });
    expect(resolveZip('90210').status).toBe('outside');
  });
  it('falls back to the ZIP prefix for a Virginia ZIP with no area of its own', () => {
    const r = resolveZip('23298');
    expect(r.status).toBe('ok');
  });
  it('treats a GPS reading far from Virginia as outside coverage', () => {
    expect(coverageOf([40.71, -74.0])).toBe('outside');
    expect(coverageOf([37.54, -77.43])).toBe('inside');
  });
  it('sorts Richmond clinics by distance and never matches a filter on an unknown', () => {
    const hits = findClinics([37.554, -77.457], { ...noFilters(), tests: ['mammogram'] });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.site.tests).toContain('mammogram');
    const sorted = [...hits].sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0));
    expect(Math.round(hits[0].miles!)).toBe(Math.round(sorted[0].miles!));
    const bus = findClinics(null, { ...noFilters(), bus: true });
    for (const h of bus) expect(h.site.bus).toBe(true);
  });
});

describe('reading an ingredient photo', () => {
  // What a phone photo of a chip bag gave the text reader (reported by the user).
  const noise = `; E y e kr Y Fa < 1 A Ey : : E + ; “ua , E r Aa RA. au De a . 3 4 . pt Ie FF y A 4 - É o A. Cl N E —;— LN NN ABAD bl ) \ EA Jen DA 7 In poccurE a 4 - E Es. A N RENO E Ue Pau UN 1 Ep of dh Te o ga. N e”, E A 2 E » - > : 5 is ye ; ps ; Ya 7 Are A e - le. 7 7/7 ra i ua a a y : “493 ~ Ba en o E a 3 he 3 3 yh AGT ce Ping > : - : Be d a Ca a Na” E Pr e A Es HEE ; TE. 4 e >. : E. ; e E ty MOTE f00 AF Ter E —— E © i of call St ME a — a as As - => Xx A Se aes > Bo . 351 AATT > A = .. E E le: q o: MINERAL y A) GU ARAN = etl PA EST xX o Ul>3400"70006 1 M| w >» ¿ 200053410 S1L-DORI-E25 < i el 3 - £ Lo YE er a sm — 2 i a a J i a á i J f a i i Me A Mica: if ETA - "7 ” p x L 2% e E y , ; La - » - | E Á PLA bos a 4 ho ho. a Mz. ; FY ae ua d Fi — j é = y 4.`;

  it('says a noisy reading could not be read, instead of showing it as ingredients', () => {
    expect(ingredientsFromOcr(noise, 38).readable).toBe(false);
    expect(ingredientsFromOcr(noise, 90).readable).toBe(false); // even if the reader was sure of itself
  });

  it('keeps a real label, cut from "Ingredients:" to "Contains"', () => {
    const label = 'Nutrition Facts  Serving size 1 oz\n| INGREDIENTS: WHOLE GRAIN OATS, CORN STARCH, SUGAR,\nSALT, TRIPOTASSIUM PHOSPHATE. VITAMIN E (MIXED\nTOCOPHEROLS) ADDED TO PRESERVE FRESHNESS. ~ 3 #\nCONTAINS: WHEAT INGREDIENTS.\n© 2026 General Mills';
    const r = ingredientsFromOcr(label, 81);
    expect(r.readable).toBe(true);
    expect(r.text.startsWith('WHOLE GRAIN OATS')).toBe(true);
    expect(r.text).not.toMatch(/CONTAINS|Nutrition|General Mills/);
  });

  it('reads a Spanish label too', () => {
    const r = ingredientsFromOcr('Ingredientes: harina de trigo, azucar, aceite vegetal, sal, leche en polvo.\nContiene: trigo, leche.', 77);
    expect(r.readable).toBe(true);
    expect(r.text).toMatch(/^harina de trigo/);
  });
});
