// Bilingual parity and content integrity. "Zero untranslated keys" is a
// release rule, so it is a test.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import en from '../content/strings/en.json';
import es from '../content/strings/es.json';
import { translate } from '../src/app/i18n';

const CONTENT = path.resolve(__dirname, '../content');

function keys(o: unknown, prefix = ''): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((v, i) => keys(v, `${prefix}[${i}]`))];
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

// Every {en, es} pair anywhere in the content files must have both halves.
function pairs(o: unknown, where: string, out: string[] = []): string[] {
  if (Array.isArray(o)) o.forEach((v, i) => pairs(v, `${where}[${i}]`, out));
  else if (o && typeof o === 'object') {
    const rec = o as Record<string, unknown>;
    if ('en' in rec && !('es' in rec)) out.push(`${where}: missing es`);
    if ('es' in rec && !('en' in rec)) out.push(`${where}: missing en`);
    if (typeof rec.en === 'string' && !rec.en.trim()) out.push(`${where}: empty en`);
    if (typeof rec.es === 'string' && !rec.es.trim()) out.push(`${where}: empty es`);
    if (Array.isArray(rec.en) && Array.isArray(rec.es) && rec.en.length !== rec.es.length) out.push(`${where}: list lengths differ`);
    for (const [k, v] of Object.entries(rec)) pairs(v, `${where}.${k}`, out);
  }
  return out;
}

describe('bilingual parity', () => {
  it('English and Spanish UI strings have exactly the same keys', () => {
    expect(keys(es)).toEqual(keys(en));
  });

  it('no Spanish string is left in English', () => {
    const flat = (o: unknown, p = ''): [string, string][] =>
      o && typeof o === 'object'
        ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k))
        : typeof o === 'string' ? [[p, o]] : [];
    const esMap = new Map(flat(es));
    // Brand names, program names, codes and single words that are the same in both languages.
    const sameOk = /^(app\.name|app\.langSwitch.*|common\.no|plan\.segPlan|clinics\.costEwl|clinics\.kinds\.(massey|hospital)|language\.(english|spanish)|cancers\..*|compare\.bmiRange|food\.days.*)$/;
    const untranslated = flat(en).filter(([k, v]) => v.length > 3 && esMap.get(k) === v && !sameOk.test(k)).map(([k]) => k);
    expect(untranslated).toEqual([]);
  });

  it('every bilingual pair in the content files has both languages', () => {
    const problems: string[] = [];
    for (const file of fs.readdirSync(CONTENT).filter((f) => f.endsWith('.json') && f !== 'va-zips.json')) {
      pairs(JSON.parse(fs.readFileSync(path.join(CONTENT, file), 'utf8')), file, problems);
    }
    expect(problems).toEqual([]);
  });

  it('every string the code asks for exists in both languages, including keys built from data', () => {
    const get = (d: unknown, k: string) => k.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined), d);
    const need = new Set<string>();
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
    for (const file of walk(path.resolve(__dirname, '../src'))) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/\b(?:t|th|list|raw)\(\s*'([a-zA-Z0-9_.]+)'/g)) need.add(m[1]);
    }
    const read = (f: string) => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));
    // Keys the screens build from data: `scan.reasons.${r}`, `risk.levers.${id}` and so on.
    for (const s of read('clinics.json').sites) {
      need.add(`clinics.kinds.${s.type}`);
      for (const x of s.tests || []) need.add(`clinics.tests.${x}`);
    }
    const risk = read('risk.json');
    for (const b of risk.bands) need.add(`risk.bands.${b.key}`);
    for (const [cancer, c] of Object.entries<{ factors?: { id: string; mod?: boolean; src: string }[]; surveil?: string; gene?: string[]; src?: string }>(risk.cancers)) {
      need.add(`cancers.${cancer}`);
      for (const f of c.factors || []) if (f.mod) need.add(`risk.levers.${f.id}`);
      if (c.surveil) { need.add(`risk.surveilTitle.${cancer}`); need.add(`risk.surveilBody.${cancer}`); }
      // Every factor has its words in both languages and a named source.
      for (const f of c.factors || []) {
        expect(risk.labels.en[f.id], `${cancer}.${f.id} label`).toBeTruthy();
        expect(risk.labels.es[f.id], `${cancer}.${f.id} label es`).toBeTruthy();
        expect(risk.sources[f.src], `${cancer}.${f.id} source`).toBeTruthy();
      }
      if (c.src) expect(risk.sources[c.src], `${cancer} source`).toBeTruthy();
      // Gene and watch answers must be real options in the check.
      const historyIds = read('check.json').history.map((h: { id: string }) => h.id);
      for (const g of c.gene || []) expect(historyIds, `${cancer} gene ${g}`).toContain(g);
      if (c.surveil) expect(historyIds, `${cancer} surveil`).toContain(c.surveil);
    }
    for (const n of [1, 2, 3, 4]) need.add(`scan.novaNames.${n}`);
    for (const l of ['limit', 'moderation', 'none']) need.add(`scan.labels.${l}`);
    for (const r of ['group1', 'nova4', 'processed', 'group2b', 'wcrf', 'clean']) need.add(`scan.reasons.${r}`);
    for (const g of ['A', 'B', 'C', 'D', 'F']) need.add(`scan.grade.meaning.${g}`);
    for (const e of ['iarc1', 'iarc2A', 'wcrf', 'iarc2B', 'weight', 'limited']) need.add(`scan.grade.evidence.${e}`);
    for (const g of ['below', 'above']) need.add(`compare.gaps.${g}`);
    for (const b of ['Under', 'Healthy', 'Over', 'Obese']) need.add(`check.s6.bmi${b}`);
    for (const x of ['risk', 'scan', 'diary', 'learn']) need.add(`welcome.tools.${x}`);
    const missing = [...need].filter((k) => get(en, k) === undefined || get(es, k) === undefined);
    expect(missing).toEqual([]);
    expect(need.size).toBeGreaterThan(400); // the scan found the screens' keys
  });
});

describe('counts read naturally', () => {
  it('uses the "One" form for exactly one, in both languages', () => {
    expect(translate('en', 'clinics.count', { n: 1 })).toBe('1 place');
    expect(translate('en', 'clinics.count', { n: 3 })).toBe('3 places');
    expect(translate('es', 'clinics.filtersOn', { n: 1 })).toBe('1 filtro activo');
    expect(translate('es', 'clinics.distance', { n: 1 })).not.toMatch(/millas/);
  });
});

describe('content integrity', () => {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));

  it('every clinic has a phone, a verified date and real coordinates in Virginia', () => {
    for (const s of read('clinics.json').sites) {
      expect(s.phone, s.id).toMatch(/\d{3}.*\d{4}/);
      expect(s.verified, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.lat, s.id).toBeGreaterThan(36.5);
      expect(s.lat, s.id).toBeLessThan(39.5);
      expect(s.lng, s.id).toBeGreaterThan(-83.7);
      expect(s.lng, s.id).toBeLessThan(-75.2);
    }
  });

  it('clinic ids are unique', () => {
    const ids = read('clinics.json').sites.map((s: { id: string }) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every compare row, prevention entry and scanner rule names a source', () => {
    for (const r of read('compare.json').rows) expect(r.source.url, r.id).toMatch(/^https:\/\//);
    for (const e of read('prevention.json').entries) expect(e.source.url, e.id).toMatch(/^https:\/\//);
    const ing = read('ingredients.json');
    for (const r of [...ing.hazards, ...ing.protective]) expect(r.source.url, r.id).toMatch(/^https:\/\//);
  });

  it('prevention entries stay under 150 words, chapters under 600', () => {
    const words = (s: string) => s.trim().split(/\s+/).length;
    for (const e of read('prevention.json').entries) {
      expect(words(e.body.en), e.id).toBeLessThanOrEqual(150);
      expect(words(e.body.es), e.id).toBeLessThanOrEqual(150);
    }
    for (const c of read('learn.json').chapters) {
      const all = (lang: 'en' | 'es') => c.sections.map((s: { h: Record<string, string>; p: Record<string, string> }) => `${s.h[lang]} ${s.p[lang]}`).join(' ') + ' ' + c.takeaway[lang];
      expect(words(all('en')), c.id).toBeLessThanOrEqual(600);
      expect(words(all('es')), c.id).toBeLessThanOrEqual(600);
    }
  });
});
