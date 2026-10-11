#!/usr/bin/env node
// Checks every link and phone number in /content.
//   URLs     must answer (2xx or 3xx) within 20 seconds.
//   Numbers  must be dialable: 10 digits (optionally with a leading 1), or a
//            three-digit service line (211, 911).
//
//   node scripts/check-links.mjs          exit 1 if any link or number fails
//   node scripts/check-links.mjs --urls   URLs only
// Some sites block automated requests (HTTP 403/429). Those are reported as
// "blocked" so a person can open them by hand; they do not fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'content');
const urlsOnly = process.argv.includes('--urls');

const urls = new Map();
const phones = new Map();
function walk(o, where) {
  if (typeof o === 'string') {
    if (/^https?:\/\//.test(o)) urls.set(o, (urls.get(o) || []).concat(where));
    return;
  }
  if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${where}[${i}]`)); return; }
  if (o && typeof o === 'object') {
    if (o.type === 'tel' && typeof o.value === 'string') phones.set(o.value, (phones.get(o.value) || []).concat(where));
    if (typeof o.phone === 'string') phones.set(o.phone, (phones.get(o.phone) || []).concat(`${where}.phone`));
    for (const [k, v] of Object.entries(o)) walk(v, `${where}.${k}`);
  }
}
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'va-zips.json')) {
  walk(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), f);
}

let failed = 0;

if (!urlsOnly) {
  console.log(`Phone numbers (${phones.size})`);
  for (const [num, where] of phones) {
    const d = num.replace(/\D/g, '');
    const ok = d.length === 10 || (d.length === 11 && d.startsWith('1')) || ['211', '911'].includes(d);
    if (!ok) { failed++; console.log(`  FAIL ${num}  (${where[0]})`); }
  }
  if (!failed) console.log('  all dialable');
}

console.log(`\nLinks (${urls.size})`);
const UA = 'Mozilla/5.0 (FutureVitals link check)';
async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
      clearTimeout(timer);
      if (res.ok) return { status: res.status, kind: 'ok' };
      if (method === 'HEAD' && [403, 405, 400, 404, 501].includes(res.status)) continue; // many servers refuse HEAD
      if ([401, 403, 429].includes(res.status)) return { status: res.status, kind: 'blocked' };
      return { status: res.status, kind: 'fail' };
    } catch (e) {
      if (method === 'GET') return { status: e.name === 'AbortError' ? 'timeout' : e.message, kind: 'fail' };
    }
  }
  return { status: '?', kind: 'fail' };
}

const list = [...urls.keys()];
const results = [];
const LIMIT = 6;
for (let i = 0; i < list.length; i += LIMIT) {
  const batch = list.slice(i, i + LIMIT);
  results.push(...(await Promise.all(batch.map(async (u) => ({ url: u, ...(await check(u)) })))));
}
let blocked = 0;
for (const r of results) {
  if (r.kind === 'fail') { failed++; console.log(`  FAIL ${r.status}  ${r.url}\n        used in ${urls.get(r.url)[0]}`); }
  if (r.kind === 'blocked') { blocked++; console.log(`  BLOCKED ${r.status}  ${r.url}  (check by hand)`); }
}
console.log(`  ${results.filter((r) => r.kind === 'ok').length} ok, ${blocked} blocked by the site, ${results.filter((r) => r.kind === 'fail').length} failed`);
process.exit(failed ? 1 : 0);
