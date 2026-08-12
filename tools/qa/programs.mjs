#!/usr/bin/env node
/**
 * Shader permutation census.
 *
 * `programs` is the only budget in this project that fails: 162 against 140. It
 * has been read as a load-time nicety, and it is not. `KHR_parallel_shader_compile`
 * is unavailable on a software rasteriser, so every one of those programs is
 * compiled serially on the main thread, and they are paid again on every boot,
 * every zone transition, and every camera move that reveals a material not seen
 * yet. Measured in the pass that repaired `capture.mjs`: 66 s of pre-warm for one
 * zone, 453 s for a cross-zone `world.goto`, 700 s for a single capture frame.
 * The permutation count IS the capture harness's speed.
 *
 * A count alone is not actionable — 162 of what? So this dumps three.js's own
 * program cache keys, works out which parameters actually vary across them, and
 * reports the axes in order of how much they multiply. The biggest axis is where
 * a fix would come from.
 *
 *   node tools/qa/programs.mjs                 # the starting zone
 *   node tools/qa/programs.mjs --zones all     # stream every zone first
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4173', 10);
const QUALITY = args.quality || 'low';
const OUT = args.out || 'docs/verification/programs.json';

async function waitForServer(url, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const url = `http://127.0.0.1:${PORT}/`;
let server = null;
if (!(await waitForServer(url, 1500))) {
  if (!existsSync('dist/index.html')) { console.error('run `npm run build` first'); process.exit(1); }
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await waitForServer(url))) { console.error('server failed'); process.exit(1); }
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
// `prewarm=0` deliberately: the point is to count the programs the game actually
// reaches, and the pre-warm's own compile time is what this tool exists to explain.
await page.goto(`${url}?quality=${QUALITY}&qa=1&prewarm=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR',
  null, { timeout: 600000, polling: 500 });

if (args.zones === 'all') {
  const ids = ['intake', 'service', 'cistern', 'residence', 'plant', 'duct', 'stack', 'safe'];
  for (const id of ids) {
    process.stdout.write(`  streaming ${id} …`);
    const t = Date.now();
    await page.evaluate((z) => {
      const g = window.ANNEX;
      g.world.goto(z);
      for (let i = 0; i < 8; i++) g.renderOnce(1 / 60);
    }, id);
    console.log(` ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }
}

const data = await page.evaluate(() => {
  const g = window.ANNEX;
  const r = g.engine.renderer;
  return {
    count: r.info.programs.length,
    keys: r.info.programs.map((p) => p.cacheKey),
  };
});

await browser.close();
if (server) server.kill();

/**
 * three.js builds a cache key by concatenating every parameter that changes the
 * generated source. Splitting on the separator and comparing position by position
 * shows which parameters are constant across the whole cache (they cost nothing)
 * and which ones vary (they multiply).
 */
const rows = data.keys.map((k) => k.split(','));
const width = Math.max(...rows.map((r) => r.length));
const axes = [];
for (let i = 0; i < width; i++) {
  const vals = new Map();
  for (const r of rows) vals.set(r[i], (vals.get(r[i]) || 0) + 1);
  if (vals.size > 1) axes.push({ i, distinct: vals.size, values: [...vals.entries()].sort((a, b) => b[1] - a[1]) });
}
axes.sort((a, b) => b.distinct - a.distinct);

console.log('');
console.log(`shader programs compiled: ${data.count}   (budget 140, tools/qa/perf.mjs)`);
console.log('');
console.log(`${rows.length} cache keys, ${width} parameters each, ${axes.length} of them varying.`);
console.log('A parameter that never varies costs nothing. These are the ones that multiply:');
console.log('');
console.log('  field   distinct   commonest values');
for (const a of axes.slice(0, 14)) {
  const top = a.values.slice(0, 4)
    // Keys are not all the same length, so a short one yields `undefined` at a
    // position a longer one fills. That is itself a difference and is named.
    .map(([v, n]) => `${(v === undefined ? '<absent>' : v === '' ? '""' : String(v)).slice(0, 22)}x${n}`)
    .join('  ');
  console.log(`  ${String(a.i).padStart(5)}   ${String(a.distinct).padStart(8)}   ${top}`);
}
console.log('');
console.log('Multiply the distinct counts of the independent axes and you have the cache.');
console.log('The cheapest reduction is whichever axis is both wide and not load-bearing.');

await writeFile(OUT, JSON.stringify({ count: data.count, axes, keys: data.keys }, null, 2));
console.log(`\nwrote ${OUT}`);
