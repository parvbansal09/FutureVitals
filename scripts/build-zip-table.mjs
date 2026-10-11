#!/usr/bin/env node
// Builds content/va-zips.json: every Virginia ZIP code area (ZCTA) with its
// center point, from the U.S. Census Bureau Gazetteer (public domain).
//
// Why: the clinic finder has to turn a typed ZIP into a place without
// sending it anywhere. The previous version looked ZIPs up on a web service,
// which meant a person's location left the phone. With this table the lookup
// happens on the device and works in airplane mode.
//
//   node scripts/build-zip-table.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'content', 'va-zips.json');
const YEARS = ['2024', '2023', '2020'];
const url = (y) => `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${y}_Gazetteer/${y}_Gaz_zcta_national.zip`;

// Virginia's ZIP ranges. 201xx sits inside the DC block but is Northern
// Virginia (Loudoun, Prince William, western Fairfax).
const isVirginia = (z) => {
  const n = Number(z);
  return (n >= 20101 && n <= 20199) || n === 20598 || (n >= 22001 && n <= 24699);
};

// Minimal ZIP reader: finds each file through the central directory and
// inflates it. Enough for the single text file inside the Gazetteer archive.
function unzipFirstText(buf) {
  const EOCD = 0x06054b50;
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== EOCD) e--;
  if (e < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.txt$/i.test(name)) continue;
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    return (method === 0 ? data : zlib.inflateRawSync(data)).toString('utf8');
  }
  throw new Error('no .txt file in archive');
}

let text = null;
let used = null;
for (const y of YEARS) {
  try {
    const res = await fetch(url(y));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = unzipFirstText(Buffer.from(await res.arrayBuffer()));
    used = y;
    break;
  } catch (err) {
    console.warn(`gazetteer ${y}: ${err.message}`);
  }
}
if (!text) {
  console.error('Could not download any Census gazetteer. The app falls back to regional centers.');
  process.exit(1);
}

const lines = text.split(/\r?\n/).filter(Boolean);
const head = lines.shift().split('\t').map((h) => h.trim());
const iZ = head.indexOf('GEOID');
const iLat = head.indexOf('INTPTLAT');
const iLng = head.indexOf('INTPTLONG');
const zips = {};
for (const line of lines) {
  const c = line.split('\t').map((v) => v.trim());
  const z = c[iZ];
  if (!z || !isVirginia(z)) continue;
  zips[z] = [Number(Number(c[iLat]).toFixed(4)), Number(Number(c[iLng]).toFixed(4))];
}

const body = {
  source: `U.S. Census Bureau, ${used} Gazetteer Files, ZIP Code Tabulation Areas (public domain)`,
  sourceUrl: url(used),
  built: new Date().toISOString().slice(0, 10),
  count: Object.keys(zips).length,
  zips,
};
fs.writeFileSync(OUT, JSON.stringify(body));
console.log(`content/va-zips.json: ${body.count} Virginia ZIP areas from the ${used} gazetteer`);
