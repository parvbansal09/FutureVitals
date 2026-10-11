// Reads text from a photo, on the phone: an ingredient list, or the numbers
// printed under a barcode. Tesseract.js and its language data ship inside the
// app (public/ocr), so nothing is fetched from the internet and the photo
// never leaves the device. The claude.ai preview cannot serve the compressed
// language files, so there they ship as base64 text (scripts/build-artifact.mjs)
// and are put where the engine looks before downloading anything: its own
// cache in IndexedDB. (Handing the engine the data directly would be simpler,
// but tesseract.js 6.0.1 then uses the data as the language's name and fails.)
import { barcodeFromText, ingredientsFromOcr, type OcrIngredients } from '../engine/scanner';
import { loadImage } from './barcode';
import { IN_ARTIFACT } from './env';

type Progress = (p: number) => void;

const base = () => new URL('./ocr/', document.baseURI).href;

// The engine's cache: idb-keyval's default store, keyed "./<lang>.traineddata".
const DB = 'keyval-store';
const STORE = 'keyval';
function cache<T>(run: (store: IDBObjectStore) => IDBRequest<T>, write = false): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = run(db.transaction(STORE, write ? 'readwrite' : 'readonly').objectStore(STORE));
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); reject(req.error); };
    };
  });
}

/** In the preview: makes sure each language is in the engine's cache, from the base64 copy. */
async function stockLanguages(codes: string[]) {
  if (!IN_ARTIFACT) return;
  await Promise.all(codes.map(async (code) => {
    const key = `./${code}.traineddata`;
    if ((await cache((s) => s.count(key))) > 0) return;
    const res = await fetch(`${base()}lang/${code}.traineddata.gz.txt`);
    if (!res.ok) throw new Error(`No ${code} language data`);
    const bin = atob((await res.text()).trim());
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    await cache((s) => s.put(data, key), true);
  }));
}

async function worker(codes: string[], onProgress?: Progress) {
  const { createWorker } = await import('tesseract.js');
  const b = base();
  await stockLanguages(codes);
  return createWorker(codes, 1, {
    workerPath: b + 'worker.min.js',
    corePath: b + 'core',
    langPath: b + 'lang',
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });
}

/**
 * A photo made easier to read: upright, grey, its contrast stretched so pale
 * print on a shiny bag stands out, and resized so small print is large enough
 * but a 12-megapixel photo does not take a minute. `turn` rotates it.
 */
async function prepare(image: Blob, turn: 0 | 90 | 270): Promise<HTMLCanvasElement> {
  const src = await loadImage(image);
  const long = Math.max(src.width, src.height);
  const s = long > 2200 ? 2200 / long : long < 1200 ? Math.min(2, 1600 / long) : 1;
  const w = Math.round(src.width * s);
  const h = Math.round(src.height * s);
  const canvas = document.createElement('canvas');
  const side = turn !== 0;
  canvas.width = side ? h : w;
  canvas.height = side ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  const grey = new Uint8ClampedArray(px.length / 4);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    grey[j] = g;
    hist[grey[j]]++;
  }
  // Stretch the middle 96% of the greys across the full range.
  const cut = grey.length * 0.02;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < cut) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) < cut) hi--;
  const span = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = ((grey[j] - lo) * 255) / span;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Reads an ingredient list from a photo. When the first reading is noise it
 * tries the photo turned a quarter each way (a bag shot sideways), and keeps
 * the best reading. `readable` says whether that best is an ingredient list.
 */
export async function readIngredients(image: Blob, onProgress?: Progress, onTurn?: (turn: number) => void): Promise<OcrIngredients> {
  const w = await worker(['eng', 'spa'], onProgress);
  try {
    let best: OcrIngredients | null = null;
    for (const turn of [0, 90, 270] as const) {
      onTurn?.(turn);
      const { data } = await w.recognize(await prepare(image, turn));
      const read = ingredientsFromOcr(data.text || '', data.confidence);
      if (!best || read.score > best.score) best = read;
      if (read.readable) break;
    }
    return best!;
  } finally {
    await w.terminate();
  }
}

/**
 * The barcode number printed under the bars, read as text when the bars
 * themselves will not decode. Only digits are looked for, and the number is
 * kept only when its check digit holds.
 */
export async function readBarcodeDigits(image: Blob, onProgress?: Progress): Promise<string | null> {
  const w = await worker(['eng'], onProgress);
  try {
    await w.setParameters({ tessedit_char_whitelist: '0123456789 ' });
    const { data } = await w.recognize(image);
    return barcodeFromText(data.text || '');
  } finally {
    await w.terminate();
  }
}
