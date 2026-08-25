#!/usr/bin/env node
/**
 * Draw-call attribution.
 *
 * `perf.mjs` says the number and never says who. When the twelve-scenario run
 * put the worst frame at 268 against a budget of 180, the only way to act on it
 * was to guess, and the first guess — that the three-zone resident set was
 * paying for geometry in zones 400 m away — turned out to be wrong: hiding the
 * entire non-resident Intake changed the count by zero, because frustum culling
 * was already doing its job.
 *
 * So this counts the submissions themselves. `WebGLRenderer.renderBufferDirect`
 * is called once per draw, with the object and material in hand, so wrapping it
 * for one frame gives exact attribution rather than a bisect and a hypothesis.
 *
 *   node tools/qa/drawcalls.mjs                  # every scenario in perf-scenarios.json
 *   node tools/qa/drawcalls.mjs --scenario plant_hall
 */
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4173', 10);
const QUALITY = args.quality || 'low';
const OUT = args.out || 'docs/verification/drawcalls.json';

async function up(url, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const url = `http://127.0.0.1:${PORT}/`;
let server = null;
if (!(await up(url, 1500))) {
  if (!existsSync('dist/index.html')) {
    const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(1);
  }
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await up(url))) { console.error('server failed'); process.exit(1); }
}

const scenarios = JSON.parse(await readFile('tools/qa/perf-scenarios.json', 'utf8'));
const wanted = args.scenario ? scenarios.filter((s) => s.name === args.scenario) : scenarios;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`${url}?quality=${QUALITY}&qa=1&prewarm=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR', null,
  { timeout: 600000, polling: 500 });

const results = [];
for (const sc of wanted) {
  const r = await page.evaluate(async (s) => {
    const g = window.ANNEX;
    new Function('g', s.setup)(g);
    for (let i = 0; i < 14; i++) g.renderOnce(1 / 60);

    const renderer = g.engine.renderer;
    const orig = renderer.renderBufferDirect.bind(renderer);
    const tally = new Map();
    let total = 0;
    renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      total++;
      // Attribute to the coarsest thing that a fix could act on: the material,
      // and the nearest named ancestor, which for this project's builders is
      // either the zone chunk or the prop.
      let a = object, tag = '';
      while (a) { if (a.name) { tag = a.name; break; } a = a.parent; }
      const key = `${(tag || '?').split(':')[0]} | ${material?.name || '(unnamed)'}`;
      const e = tally.get(key) || { calls: 0, tris: 0 };
      e.calls++;
      e.tris += (geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0) / 3;
      tally.set(key, e);
      return orig(camera, scene, geometry, material, object, group);
    };
    g.renderOnce(1 / 60);
    renderer.renderBufferDirect = orig;

    return {
      name: s.name,
      reported: g.engine.stats.calls,
      counted: total,
      top: [...tally.entries()]
        .map(([k, v]) => ({ what: k, calls: v.calls, tris: Math.round(v.tris) }))
        .sort((a, b) => b.calls - a.calls).slice(0, 14),
    };
  }, sc);
  results.push(r);
  console.log(`\n${r.name} — ${r.reported} reported, ${r.counted} counted`);
  for (const t of r.top) {
    console.log(`  ${String(t.calls).padStart(4)}  ${String(Math.round(t.tris / 1000) + 'k').padStart(6)}  ${t.what}`);
  }
}

await browser.close();
if (server) server.kill();
await writeFile(OUT, JSON.stringify({ quality: QUALITY, results }, null, 2));
console.log(`\nwrote ${OUT}`);
console.log('A row worth acting on is one with many calls and few triangles:');
console.log('that is a batching failure. Many calls AND many triangles is content.');
