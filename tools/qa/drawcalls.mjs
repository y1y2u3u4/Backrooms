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
import { ensureFreshBuild } from './freshbuild.mjs';

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

// Before the port check, for the reason written out in freshbuild.mjs: a
// preview server left listening from an earlier run is the likeliest way to
// attribute last week's draw calls.
await ensureFreshBuild({ skip: args['no-build'] === true, reason: 'attributing' });

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
    const passes = {};
    let total = 0;
    renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      total++;
      // Attribute to the coarsest thing that a fix could act on: the material,
      // and the nearest named ancestor, which for this project's builders is
      // either the zone chunk or the prop.
      let a = object, tag = '';
      while (a) { if (a.name) { tag = a.name; break; } a = a.parent; }
      // WITH NO NAMED ANCESTOR, SAY SOMETHING USEFUL RATHER THAN '?'.
      //
      // The residence attribution had a 47-call row labelled `? | (unnamed)`,
      // which names neither the thing nor its material and so cannot be acted
      // on. Fall back to the object's own type and its material's type, which
      // together are enough to recognise motes, a sprite batch or an overlay.
      if (!tag) tag = `<${object?.type || 'Object3D'}>`;
      const mat = material?.name || `(${material?.type || 'unnamed'})`;
      const pass = material?.isMeshNormalMaterial ? 'gtao-normal'
        : (material?.isMeshDepthMaterial || material?.isMeshDistanceMaterial) ? 'shadow'
          : 'colour';
      passes[pass] = (passes[pass] || 0) + 1;
      const key = `${tag.split(':')[0]} | ${mat}`;
      const e = tally.get(key) || { calls: 0, tris: 0, mats: new Set(), geos: new Set() };
      e.calls++;
      e.tris += (geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0) / 3;
      // DISTINCT MATERIALS IS THE DIAGNOSIS, NOT THE CALL COUNT.
      //
      // Many calls over few triangles says a batching failure; how many
      // DISTINCT materials those calls used says whether it is fixable by
      // merging geometry (one material, many meshes) or needs the materials
      // collapsed first (one material per mesh, which is what a keypad that
      // builds a fresh MeshStandardMaterial per key does).
      if (material?.uuid) e.mats.add(material.uuid);
      if (geometry?.uuid) e.geos.add(geometry.uuid);
      tally.set(key, e);
      return orig(camera, scene, geometry, material, object, group);
    };
    g.renderOnce(1 / 60);
    renderer.renderBufferDirect = orig;

    return {
      name: s.name,
      reported: g.engine.stats.calls,
      counted: total,
      // WHICH PASS THE CALL BELONGED TO.
      //
      // A frame is not drawn once. three's GTAOPass renders the whole scene a
      // second time through a MeshNormalMaterial to fill its normal buffer, and
      // every shadow-casting light renders it again through a depth material.
      // The draw-call budget of 180 was written against a single pass and then
      // compared against a total that contains three, which is why four zones
      // looked 2.4x over: 40 % of the calls in the Residence are the AO prepass
      // redrawing geometry that the colour pass then draws properly.
      //
      // Classified by material type, which is exactly how three swaps them.
      passes,
      top: [...tally.entries()]
        .map(([k, v]) => ({ what: k, calls: v.calls, tris: Math.round(v.tris),
          mats: v.mats.size, geos: v.geos.size }))
        .sort((a, b) => b.calls - a.calls).slice(0, 14),
    };
  }, sc);
  results.push(r);
  const ps = r.passes || {};
  const pass = ['colour', 'gtao-normal', 'shadow'].filter((k) => ps[k])
    .map((k) => `${k} ${ps[k]}`).join(', ');
  console.log(`\n${r.name} — ${r.reported} reported, ${r.counted} counted   (${pass})`);
  for (const t of r.top) {
    console.log(`  ${String(t.calls).padStart(4)}  ${String(Math.round(t.tris / 1000) + 'k').padStart(6)}`
      + `  ${String(t.mats).padStart(4)} mat ${String(t.geos).padStart(4)} geo  ${t.what}`);
  }
}

await browser.close();
if (server) server.kill();
await writeFile(OUT, JSON.stringify({ quality: QUALITY, results }, null, 2));
console.log(`\nwrote ${OUT}`);
console.log('`mat` and `geo` count the DISTINCT materials and geometries those calls used.');
console.log('calls == mat means every mesh has its own material, and the geometry cannot be');
console.log('merged until those are collapsed first — which is what a keypad that builds a');
console.log('fresh MeshStandardMaterial per key looks like. calls >> mat means one material');
console.log('over many meshes, which merges directly.');
console.log('');
console.log('A row worth acting on is one with many calls and few triangles:');
console.log('that is a batching failure. Many calls AND many triangles is content.');
