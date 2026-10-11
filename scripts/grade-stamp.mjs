// A fingerprint of the scanner rules (content/ingredients.json), stored with
// the product grades in content/products/meta.json. tests/products.test.ts
// compares it with the rules as they are now, so grades never go stale.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function rulesStamp(root) {
  const text = fs.readFileSync(path.join(root, 'content/ingredients.json'), 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}
