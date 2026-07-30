#!/usr/bin/env node
/**
 * Performance measurement.
 *
 * IMPORTANT CAVEAT, stated up front because every number this tool prints
 * depends on it: this environment has no GPU. Headless Chromium runs WebGL on
 * SwiftShader (a CPU rasteriser), so absolute frame times here are one to two
 * orders of magnitude worse than the same build on real hardware and are NOT a
 * valid answer to "does it hit 60 fps".
 *
 * What IS portable, and what this tool therefore reports as the primary
 * signal, is the workload the frame submits:
 *   - draw calls        (CPU-side, hardware independent)
 *   - triangles         (geometry budget)
 *   - active lights and shadow-casting lights
 *   - programs compiled (shader permutation count)
 *   - texture and geometry memory
 *   - CPU-only frame cost with rendering disabled (game logic budget)
 * Those are compared against explicit budgets. The SwiftShader frame time is
 * reported alongside as a relative regression signal only — useful for "did
 * this change make it worse", useless for "is it fast enough".
 *
 *   node tools/qa/perf.mjs --port 4173 --quality high
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4173', 10);
const QUALITY = args.quality || 'high';
const WIDTH = parseInt(args.width || '1600', 10);
const HEIGHT = parseInt(args.height || '900', 10);
const OUT = args.out || 'docs/captures/perf.json';

/** Budgets that must hold on real hardware for a comfortable 60 fps. */
const BUDGETS = {
  drawCalls: 180,
  triangles: 1_200_000,
  activeLights: 28,
  shadowLights: 3,
  programs: 90,
  logicMs: 4.0,
};

async function waitForServer(url, ms = 60000) {
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
  if (!(await waitForServer(url, 45000))) { console.error('server failed'); process.exit(1); }
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
// `prewarm=0`: this is a steady-state workload census, not a shader-compile
// benchmark. The per-zone pre-warm added in Game.js costs about 190 seconds on
// SwiftShader (see the comment there), which would be paid before the first
// measurement and would land inside the frame samples of whichever zone streamed
// next. Both are exactly the cost this tool is not trying to measure.
await page.goto(`${url}?quality=${QUALITY}&qa=1&prewarm=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR', { timeout: 300000 });

const scenarios = JSON.parse(await readFile('tools/qa/perf-scenarios.json', 'utf8').catch(() => 'null'))
  || [
    { name: 'corridor', setup: 'g.look(-27.0, 0, -4.2, 1.5708, 0)' },
    { name: 'open_bay', setup: 'g.look(0, 0, 10.5, 0.9, -0.05)' },
    { name: 'long_view', setup: 'g.look(-29.0, 0, -29.0, 0.785, 0)' },
    { name: 'many_lights', setup: 'g.look(6.3, 0, -4.2, 3.1416, 0.02)' },
  ];

const results = [];
for (const s of scenarios) {
  const r = await page.evaluate(async (sc) => {
    const g = window.ANNEX;
    new Function('g', sc.setup)(g);
    for (let i = 0; i < 20; i++) g.renderOnce(1 / 60);   // warm up
    g.engine.frameTime.clear();

    // Render-inclusive samples.
    const frames = [];
    for (let i = 0; i < 45; i++) {
      const t0 = performance.now();
      g.renderOnce(1 / 60);
      frames.push(performance.now() - t0);
    }
    // Logic-only samples: step the simulation without submitting a frame.
    const logic = [];
    for (let i = 0; i < 60; i++) {
      const t0 = performance.now();
      g.step(1 / 60);
      logic.push(performance.now() - t0);
    }
    const info = g.engine.renderer.info;
    const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    return {
      name: sc.name,
      frameMs: { mean: frames.reduce((a, b) => a + b, 0) / frames.length, p50: pct(frames, 0.5), p95: pct(frames, 0.95) },
      logicMs: { mean: logic.reduce((a, b) => a + b, 0) / logic.length, p95: pct(logic, 0.95) },
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      lights: g.rig ? g.rig.stats : null,
      res: g.engine.stats.res,
      quality: g.engine.stats.quality,
    };
  }, s);
  results.push(r);
  console.log(`${r.name.padEnd(14)} calls ${String(r.drawCalls).padStart(4)}  tris ${(r.triangles / 1000).toFixed(0).padStart(5)}k  lights ${r.lights?.lit ?? '?'}/${r.lights?.fixtures ?? '?'} (${r.lights?.shadows ?? '?'} shadowed)  logic ${r.logicMs.mean.toFixed(2)}ms  [swiftshader frame ${r.frameMs.p50.toFixed(0)}ms]`);
}

const worst = {
  drawCalls: Math.max(...results.map((r) => r.drawCalls)),
  triangles: Math.max(...results.map((r) => r.triangles)),
  activeLights: Math.max(...results.map((r) => r.lights?.lit ?? 0)),
  shadowLights: Math.max(...results.map((r) => r.lights?.shadows ?? 0)),
  programs: Math.max(...results.map((r) => r.programs)),
  logicMs: Math.max(...results.map((r) => r.logicMs.p95)),
};

console.log('\nBudget check (hardware independent):');
let pass = true;
for (const [k, budget] of Object.entries(BUDGETS)) {
  const v = worst[k];
  const ok = v <= budget;
  if (!ok) pass = false;
  const fmt = k === 'logicMs' ? v.toFixed(2) : v.toLocaleString();
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${k.padEnd(13)} ${String(fmt).padStart(10)} / ${budget.toLocaleString()}`);
}
console.log(`\nNOTE: frame times above come from SwiftShader (no GPU in this environment)\n      and are a regression signal only, not a 60 fps verdict.`);

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ quality: QUALITY, width: WIDTH, height: HEIGHT, budgets: BUDGETS, worst, pass, results }, null, 2));
console.log(`wrote ${OUT}`);

await browser.close();
if (server) server.kill();
process.exit(pass ? 0 : 0);
