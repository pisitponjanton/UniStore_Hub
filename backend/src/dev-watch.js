'use strict';

// Docker Desktop bind mounts sometimes deliver file contents before the fs-watch
// event. Poll file metadata so source changes reliably reload the dev server.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const intervalMs = 1200;
let worker = null;
let lastSignature = signature();
let restarting = false;
let shuttingDown = false;
let nextStart = null;

function signature() {
  const entries = [];
  function visit(dir) {
    let children;
    try { children = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const child of children) {
      const file = path.join(dir, child.name);
      if (child.isDirectory()) { visit(file); continue; }
      if (!child.isFile() || !/\.(cjs|js|json)$/.test(child.name)) continue;
      try {
        const stat = fs.statSync(file);
        entries.push(`${file}:${stat.mtimeMs}:${stat.size}`);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  visit(root);
  return entries.sort().join('|');
}

function start() {
  if (shuttingDown) return;
  restarting = false;
  worker = spawn(process.execPath, [path.join(root, 'local.js')], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  worker.on('error', error => console.error('[dev-watch] backend process error:', error));
  worker.on('exit', (code, signal) => {
    worker = null;
    if (shuttingDown) return;
    if (!restarting) console.error(`[dev-watch] backend exited (${code ?? signal}); restarting`);
    clearTimeout(nextStart);
    nextStart = setTimeout(start, restarting ? 100 : 500);
  });
}

const poll = setInterval(() => {
  if (shuttingDown) return;
  let current;
  try { current = signature(); }
  catch (error) { console.error('[dev-watch] failed scanning sources:', error); return; }
  if (current === lastSignature) return;
  lastSignature = current;
  console.log('[dev-watch] Source changed; reloading backend');
  if (worker && !restarting) {
    restarting = true;
    worker.kill('SIGTERM');
  } else if (!worker && !nextStart) {
    nextStart = setTimeout(start, 100);
  }
}, intervalMs);
poll.unref();

function shutdown() {
  shuttingDown = true;
  clearInterval(poll);
  clearTimeout(nextStart);
  if (worker) worker.kill('SIGTERM');
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
start();
