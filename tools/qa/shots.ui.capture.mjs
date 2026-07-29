#!/usr/bin/env node
/** Screenshots every UI harness state. Pure DOM — no WebGL needed. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const OUT = args.out || 'docs/captures/ui/r1';
const W = parseInt(args.width || '1280', 10);
const H = parseInt(args.height || '720', 10);
const PORT = parseInt(args.port || '5304', 10);
const ONLY = args.only ? String(args.only).split(',') : null;

const shots = JSON.parse(await readFile('tools/qa/shots.ui.json', 'utf8'));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

await page.goto(`http://127.0.0.1:${PORT}/src/ui/harness.html?bare=1`, { waitUntil: 'load' });
await page.waitForFunction('window.UIH_READY === true', { timeout: 30000 });

for (const s of shots) {
  if (ONLY && !ONLY.includes(s.name)) continue;
  await page.evaluate((n) => window.UIH.set(n), s.state);
  await page.waitForTimeout(s.settle ?? 900);
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
  console.log('  ✓', s.name);
}

await writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errs.length) { console.log('\n⚠ errors:\n' + errs.slice(0, 20).join('\n')); }
await browser.close();
console.log(`\nWrote ${OUT}`);
