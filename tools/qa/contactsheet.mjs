#!/usr/bin/env node
/**
 * Compose a directory of capture PNGs into a labelled contact sheet.
 *
 * Uses Playwright to lay the frames out in HTML and screenshot the result, so
 * it needs no image library beyond what the QA harness already depends on.
 *
 *   node tools/qa/contactsheet.mjs --in docs/captures/r2 --out docs/captures/r2/_sheet.png --cols 4
 */
import { chromium } from '@playwright/test';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const IN = args.in || 'docs/captures/latest';
const OUT = args.out || path.join(IN, '_sheet.png');
const COLS = parseInt(args.cols || '4', 10);
const CELL = parseInt(args.cell || '520', 10);
const TITLE = args.title || path.basename(IN);

const files = (await readdir(IN))
  .filter((f) => f.endsWith('.png') && !f.startsWith('_'))
  .sort();

if (!files.length) { console.error('no PNGs in ' + IN); process.exit(1); }

let stats = {};
try {
  const m = JSON.parse(await readFile(path.join(IN, 'manifest.json'), 'utf8'));
  for (const s of m) stats[path.basename(s.file)] = s.stats;
} catch { /* optional */ }

const cells = await Promise.all(files.map(async (f) => {
  const b64 = (await readFile(path.join(IN, f))).toString('base64');
  const st = stats[f];
  const meta = st ? `${st.res} · ${st.calls} calls · ${(st.tris / 1000).toFixed(0)}k tris · ${st.ms?.toFixed(1)}ms` : '';
  return `<figure>
    <img src="data:image/png;base64,${b64}">
    <figcaption><b>${f.replace('.png', '')}</b><span>${meta}</span></figcaption>
  </figure>`;
}));

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; background:#111; color:#cfc8b4;
         font:400 12px/1.5 ui-monospace, Menlo, monospace; }
  h1 { font-size:15px; letter-spacing:.28em; text-transform:uppercase;
       color:#d8b45a; padding:18px 20px 6px; margin:0; font-weight:400; }
  .grid { display:grid; grid-template-columns:repeat(${COLS}, ${CELL}px); gap:12px; padding:12px 20px 24px; }
  figure { margin:0; background:#0a0a0a; border:1px solid #262421; }
  img { width:100%; display:block; }
  figcaption { display:flex; justify-content:space-between; gap:8px; padding:6px 8px; font-size:10px; }
  figcaption span { color:#7a7364; }
</style>
<h1>${TITLE} — ${files.length} frames</h1>
<div class="grid">${cells.join('')}</div>`;

await mkdir(path.dirname(OUT), { recursive: true });
const tmp = path.join(path.dirname(OUT), '_sheet.html');
await writeFile(tmp, html);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: COLS * (CELL + 12) + 40, height: 1200 } });
await page.goto('file://' + path.resolve(tmp));
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log('wrote ' + OUT);
