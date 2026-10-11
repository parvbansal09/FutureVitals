// Reads a product barcode from a photo, or from the camera shown in the app
// on a computer. Uses the browser's own BarcodeDetector where it exists
// (Chrome on Android), and otherwise the ZXing decoder bundled with the app,
// loaded only when the scanner opens. Pictures are read in memory and never
// saved or sent.

export type ScanStop = () => void;
export type StartResult = { ok: true; stop: ScanStop } | { ok: false; reason: 'denied' | 'nocamera' };

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // As many pixels as the camera gives, up to full HD: a barcode held back
    // from a webcam is small in the frame.
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  // Keep refocusing where the camera can, so a barcode brought close turns sharp.
  const track = stream.getVideoTracks()[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caps = (track?.getCapabilities?.() || {}) as any;
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  await video.play();
  return stream;
}

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

export async function startBarcodeScan(video: HTMLVideoElement, onCode: (code: string) => void): Promise<StartResult> {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'nocamera' };
  let stream: MediaStream | null = null;
  try {
    stream = await openCamera(video);
  } catch (e) {
    const name = (e as Error)?.name;
    return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'nocamera' };
  }

  let stopped = false;
  let done = false;
  const finish = (code: string) => {
    if (done || stopped) return;
    done = true;
    onCode(code);
  };

  // 1. The platform's own detector.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BD = (window as any).BarcodeDetector;
  if (BD) {
    try {
      const supported: string[] = (await BD.getSupportedFormats?.()) || FORMATS;
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new BD({ formats });
        let raf = 0;
        const tick = async () => {
          if (stopped || done) return;
          try {
            const codes = await detector.detect(video);
            if (codes?.[0]?.rawValue) { finish(codes[0].rawValue); return; }
          } catch { /* frame not ready */ }
          raf = window.setTimeout(tick, 120);
        };
        tick();
        return { ok: true, stop: () => { stopped = true; clearTimeout(raf); stopStream(stream); } };
      }
    } catch { /* fall back to ZXing */ }
  }

  // 2. ZXing, bundled, loaded on demand.
  try {
    const [{ BrowserMultiFormatOneDReader }, lib] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
    const hints = new Map();
    hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.UPC_E]);
    hints.set(lib.DecodeHintType.TRY_HARDER, true);
    // Grocery barcodes are all one-dimensional, so the 1D reader is enough and faster.
    const reader = new BrowserMultiFormatOneDReader(hints, { delayBetweenScanAttempts: 120 });
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result) finish(result.getText());
    });
    return { ok: true, stop: () => { stopped = true; controls.stop(); stopStream(stream); } };
  } catch {
    stopStream(stream);
    return { ok: false, reason: 'nocamera' };
  }
}

/** A photo, upright as the phone took it (the camera's turn flag applied). */
export async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

/**
 * Reads a barcode from a photo: the phone camera's picture, one taken from
 * the camera shown in the app, or one chosen from the device. The photo is
 * tried at a few sizes and turns, since a phone photo is large, often
 * sideways, and rarely square to the bars. Returns the number, or null when
 * no barcode could be read.
 */
export async function decodeBarcodeImage(file: Blob): Promise<string | null> {
  const bitmap = await loadImage(file);
  const w = bitmap.width;
  const h = bitmap.height;

  // 1. The platform's own detector, where there is one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BD = (window as any).BarcodeDetector;
  if (BD) {
    try {
      const codes = await new BD({ formats: FORMATS }).detect(bitmap);
      if (codes?.[0]?.rawValue) return codes[0].rawValue;
    } catch { /* fall through to ZXing */ }
  }

  // 2. ZXing, at three sizes and four turns.
  const [{ BrowserMultiFormatOneDReader }, lib] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.UPC_E]);
  hints.set(lib.DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatOneDReader(hints);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // A 12- or 13-digit read is trusted at once. A short 8-digit one is easy to
  // find by chance in a busy picture, so it must be read twice, at two sizes
  // or turns, before it counts.
  const shortSeen = new Set<string>();
  const accept = (code: string) => {
    if (code.length >= 12) return true;
    if (shortSeen.has(code)) return true;
    shortSeen.add(code);
    return false;
  };
  for (const size of [1600, 1000, 640]) {
    const s = Math.min(1, size / Math.max(w, h));
    const sw = Math.round(w * s);
    const sh = Math.round(h * s);
    for (const turn of [0, 90, 270, 180]) {
      const side = turn === 90 || turn === 270;
      canvas.width = side ? sh : sw;
      canvas.height = side ? sw : sh;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((turn * Math.PI) / 180);
      ctx.drawImage(bitmap, -sw / 2, -sh / 2, sw, sh);
      try {
        const code = reader.decodeFromCanvas(canvas).getText();
        if (accept(code)) return code;
      } catch { /* not at this size and turn */ }
      // Let the screen breathe between attempts.
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return null;
}

/** A part of a camera frame, in the camera's own pixels. */
export type Area = { x: number; y: number; w: number; h: number };

/**
 * The part of the camera picture behind an element on screen (the box the
 * barcode is lined up in), with `pad` of its size added on every side, since
 * a barcode held by hand is rarely squarely inside. The video fills its space
 * like object-fit: cover, so its edges may be cut off the screen.
 */
export function areaBehind(video: HTMLVideoElement, el: Element, pad = 0.35): Area | undefined {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return undefined;
  const v = video.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const scale = Math.max(v.width / vw, v.height / vh);
  const ox = v.left + (v.width - vw * scale) / 2;
  const oy = v.top + (v.height - vh * scale) / 2;
  const x0 = Math.max(0, Math.floor((b.left - b.width * pad - ox) / scale));
  const y0 = Math.max(0, Math.floor((b.top - b.height * pad - oy) / scale));
  const x1 = Math.min(vw, Math.ceil((b.right + b.width * pad - ox) / scale));
  const y1 = Math.min(vh, Math.ceil((b.bottom + b.height * pad - oy) / scale));
  return x1 - x0 > 32 && y1 - y0 > 32 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : undefined;
}

/** How sharp part of a frame is: the change from each pixel to the next, summed. */
function sharpness(ctx: CanvasRenderingContext2D, a: Area): number {
  const { data } = ctx.getImageData(a.x, a.y, a.w, a.h);
  let sum = 0;
  for (let y = 0; y < a.h; y += 2) {
    for (let x = 1; x < a.w; x++) {
      const i = (y * a.w + x) * 4 + 1;
      const d = data[i] - data[i - 4];
      sum += d * d;
    }
  }
  return sum;
}

/**
 * Takes a picture from the live camera for the photo reader. A few frames are
 * taken a moment apart and the sharpest is kept: a hand-held barcode shakes,
 * and a webcam's focus drifts. Returns two pictures to read, best first: the
 * part inside `area` (where the box on screen is), where the barcode is large
 * enough to read, and the whole frame in case it was held outside the box.
 * Returns none if the camera has no picture yet.
 */
export async function takePicture(video: HTMLVideoElement, area?: Area, frames = 4): Promise<Blob[]> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return [];
  const a = area ?? { x: Math.round(w * 0.2), y: Math.round(h * 0.3), w: Math.round(w * 0.6), h: Math.round(h * 0.4) };
  let best: HTMLCanvasElement | null = null;
  let bestScore = -1;
  for (let i = 0; i < frames; i++) {
    if (i) await new Promise((r) => setTimeout(r, 110));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(video, 0, 0, w, h);
    const score = sharpness(ctx, a);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  if (!best) return [];
  const part = document.createElement('canvas');
  part.width = a.w;
  part.height = a.h;
  part.getContext('2d')?.drawImage(best, a.x, a.y, a.w, a.h, 0, 0, a.w, a.h);
  const jpeg = (c: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
  return (await Promise.all([jpeg(part), jpeg(best)])).filter((b): b is Blob => !!b);
}

export async function openCameraOnly(video: HTMLVideoElement): Promise<StartResult> {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'nocamera' };
  try {
    const stream = await openCamera(video);
    return { ok: true, stop: () => stopStream(stream) };
  } catch (e) {
    const name = (e as Error)?.name;
    return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'nocamera' };
  }
}
