/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Emits sw.js with the exact list of files this build produced, so the web
// version works in airplane mode after its first load. The native app does
// not need it (its files ship inside the app), and the worker is only
// registered on the web. The OCR engine is large and optional, so it is cached
// the first time someone uses the ingredient photo, not up front.
/** Chunks made from content/products: p-00 … p-99 by barcode, and the names index. */
const PRODUCT_CHUNK = /^assets\/(p-\d\d|names)-[\w-]+\.js$/;

function offlineWorker(): Plugin {
  const publicDir = path.resolve(__dirname, 'public');
  const listPublic = (dir: string, base = ''): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const rel = base ? `${base}/${e.name}` : e.name;
          if (e.isDirectory()) return rel === 'ocr' ? [] : listPublic(path.join(dir, e.name), rel);
          return [rel];
        })
      : [];
  return {
    name: 'fv-offline-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // The built-in product list (content/products, about 30 MB) is left out
      // too: each of its files is cached the first time a look-up needs it.
      const files = ['./', 'index.html', ...Object.keys(bundle), ...listPublic(publicDir)]
        .filter((f) => !f.endsWith('.map') && f !== 'sw.js' && !PRODUCT_CHUNK.test(f));
      const version = new Date().toISOString();
      const source = fs
        .readFileSync(path.resolve(__dirname, 'src/platform/sw-template.js'), 'utf8')
        .replace('__PRECACHE__', JSON.stringify([...new Set(files)]))
        .replace('__VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), offlineWorker()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['motion/react'],
        },
      },
    },
  },
  // The native projects and build folders hold copies of the built app. Left
  // alone, the dev server scans their HTML for dependencies, trips over the
  // bundled code and skips preparing the app's own, which can leave a blank page.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    port: 5173,
    host: true,
    watch: { ignored: ['**/android/**', '**/ios/**', '**/dist/**', '**/dist-artifact/**', '**/screenshots/**', '**/parked/**'] },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
