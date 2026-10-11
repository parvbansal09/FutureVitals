#!/usr/bin/env node
// Starts the FutureVitals dev server at http://localhost:5173, or reports that
// it is already running there. VS Code's Run (F5) and "Open FutureVitals.cmd"
// use this, so:
//   - it runs with node itself, not npm, which Windows PowerShell can refuse
//     to run ("running scripts is disabled on this system");
//   - a second Run reuses the server instead of failing on a busy port.
//
//   node scripts/dev.mjs           start, or reuse a running server
//   node scripts/dev.mjs --open    the same, then open the app in the browser
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5173;
const URL = `http://localhost:${PORT}/`;
const open = process.argv.includes('--open');

/** 'ours' when FutureVitals answers on the port, 'other' when something else does, 'free' when nothing does. */
const probe = () => new Promise((resolve) => {
  const req = http.get(URL, { timeout: 1500 }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => resolve(body.includes('<title>FutureVitals') ? 'ours' : 'other'));
  });
  req.on('timeout', () => { req.destroy(); resolve('other'); });
  req.on('error', () => resolve('free'));
});

const openBrowser = () => {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', URL]]
    : process.platform === 'darwin' ? ['open', [URL]] : ['xdg-open', [URL]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' }).unref();
};

const state = await probe();
if (state === 'ours') {
  // The words "VITE" and "ready in" are what VS Code's task waits for.
  console.log(`VITE: FutureVitals is already running, ready in 0 ms at ${URL}`);
  if (open) openBrowser();
  process.exit(0);
}
if (state === 'other') {
  console.error(`Port ${PORT} is used by another program. Close it, then run this again.`);
  process.exit(1);
}

const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const args = [vite, '--port', String(PORT), '--strictPort', ...(open ? ['--open'] : [])];
const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
