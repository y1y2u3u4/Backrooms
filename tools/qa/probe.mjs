#!/usr/bin/env node
/** Minimal boot probe: reports how far the build gets and what it logs. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const PORT = 4173;
const url = `http://127.0.0.1:${PORT}/?quality=low&qa=1`;

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 400)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')));

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const s = await page.evaluate(() => ({
    ready: window.ANNEX_READY || false,
    err: window.ANNEX_ERROR || null,
    msg: document.getElementById('load-msg')?.textContent || '',
    bar: document.getElementById('load-bar')?.style.width || '',
  })).catch((e) => ({ evalErr: String(e).slice(0, 200) }));
  console.log(`t+${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(s));
  if (s.ready || s.err) break;
}
try {
  await page.screenshot({ path: 'docs/captures/probe.png', timeout: 60000 });
  console.log('screenshot ok');
} catch (e) { console.log('screenshot failed:', e.message.slice(0, 200)); }
await browser.close();
server.kill();
process.exit(0);
