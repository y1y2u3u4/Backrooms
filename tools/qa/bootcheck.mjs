#!/usr/bin/env node
/**
 * Boot check — does the built game come up clean?
 *
 * The cheapest possible browser test, and the one that was missing. Everything in
 * tools/qa/ either needs no browser at all (and so cannot catch a boot-time
 * exception in the UI or the integrator) or drives a full session at several
 * minutes of CPU per run. A typo in a subscription added to `createUI` sits
 * between those two: invisible to `npm run audit`, and expensive to find with
 * `playthrough`.
 *
 * This loads the page, waits for `window.ANNEX.ready`, and reports what the
 * console said and which subsystems came up. Nothing is driven and nothing is
 * measured — a pass means "it starts", which is a low bar the project has
 * nonetheless been unable to check in under ten minutes until now.
 *
 *   npm run build && node tools/qa/bootcheck.mjs --port 4241
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4241', 10);
const QUALITY = args.quality || 'low';
const TIMEOUT = parseInt(args.timeout || '420000', 10);

async function up(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const url = `http://127.0.0.1:${PORT}/`;
let server = null;
if (!(await up(url, 1200))) {
  if (!existsSync('dist/index.html')) {
    console.error('No dist/ build. Run `npm run build` first.');
    process.exit(1);
  }
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await up(url, 60000))) { console.error('preview server did not come up'); process.exit(1); }
}

const browser = await chromium.launch({
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox', '--ignore-gpu-blocklist',
    '--enable-webgl', '--disable-dev-shm-usage',
  ],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });

const errors = [];
const warnings = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  else if (m.type() === 'warning') warnings.push(t);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const t0 = Date.now();
// `prewarm=0`: this is a boot check, not a shader-compile benchmark. See Game.js.
await page.goto(`${url}?quality=${QUALITY}&qa=1&prewarm=0`, { waitUntil: 'domcontentloaded', timeout: 90000 });
let ok = true;
try {
  // `ANNEX_READY` is what main.js sets once boot resolves in qa mode; `ready` on
  // the game object flips slightly earlier, at the end of boot(). Waiting for the
  // former means a pass covers main.js's post-boot path too, which is where the UI
  // is shown and where a broken subscription would throw.
  await page.waitForFunction(
    () => window.ANNEX_READY === true || (window.ANNEX && window.ANNEX.ready === true),
    null, { timeout: TIMEOUT, polling: 500 });
} catch (e) {
  ok = false;
  errors.push(`never became ready: ${e.message}`);
}
const bootMs = Date.now() - t0;

const status = ok ? await page.evaluate(() => {
  const g = window.ANNEX;
  return {
    subsystems: g.status?.().subsystems ?? null,
    zone: g.world?.currentZone ?? null,
    fixtures: g.rig?.fixtures?.length ?? 0,
    interactables: g.interactor?.items?.length ?? 0,
    doors: g.interactor?.doors?.length ?? 0,
    objective: g.gameplay?.progression?.current?.id ?? null,
    props: g.gameplay?.interactables?.props?.length ?? 0,
    ui: !!g.ui,
  };
}) : null;

/**
 * LIVE AUDIO INTEGRATION.
 *
 * `audiowiring.mjs` proves statically that every mechanism event has a handler
 * and that every sound name resolves, and `audio-probe.mjs` proves every
 * registered sound renders with real energy and no clipping. Neither proves the
 * middle: that firing the event actually reaches the engine and spawns a voice.
 * A handler that throws, a sound denied by the voice budget, or a `playAt` with a
 * position the panner rejects all read as silence, and silence in a horror game
 * looks like intent.
 *
 * So: start the audio, fire each event on the real bus, and count voices.
 */
const audio = ok ? await page.evaluate(async () => {
  const g = window.ANNEX;
  if (!g.audio) return { skipped: 'no audio subsystem' };
  try { await g.audio.init(); } catch (e) { return { skipped: String(e.message || e) }; }
  const eng = g.audio.engine;
  if (!eng?.available) return { skipped: `context ${eng?.ctx?.state || 'absent'}` };

  const here = { x: g.player.position.x, y: g.player.position.y + 1.6, z: g.player.position.z };
  // One representative payload per mechanism event. `position` is the listener's
  // own spot so nothing is culled for distance — this asks whether the voice is
  // created, not whether it is audible from across the building.
  const CASES = [
    ['door:state', { id: 'x', state: 'opening', position: here }],
    ['door:state', { id: 'x', state: 'closing', position: here }],
    ['door:refused', { id: 'x', reason: 'Locked.', position: here }],
    ['door:pried', { id: 'x', position: here }],
    ['door:slam', { id: 'x', position: here }],
    ['sfx:breaker', { position: here, heavy: false }],
    ['sfx:breaker', { position: here, heavy: true }],
    ['light:overload', { board: 'board_c', tripped: 'intake' }],
    ['sfx:valve', { id: 'p1', position: here }],
    ['valve:complete', { id: 'p1', open: false, position: here }],
    ['sfx:detent', { id: 't', value: 3 }],
    ['sfx:keypad', { id: 'k' }],
    ['keypad:reject', { id: 'k' }],
    ['keypad:unlock', { id: 'k' }],
    ['reader:unlock', { id: 'r' }],
    ['terminal:reject', { id: 't' }],
    ['terminal:solved', { id: 't' }],
    ['lift:call', { id: 'l', position: here }],
    ['lift:travel', { id: 'l', position: here }],
    ['lift:arrive', { id: 'l', position: here }],
    ['lift:power', { id: 'l', on: true }],
    ['gen:core', { id: 'g', cores: 1, required: 3 }],
    ['gen:fuel', { id: 'g', open: true }],
    ['gen:prime', { id: 'g', strokes: 12, firm: true }],
    ['gen:fail', { id: 'g', reason: 'starter overheated' }],
    ['hide:enter', { id: 'h', kind: 'locker', position: here }],
    ['hide:exit', { id: 'h', kind: 'locker' }],
    ['lamp:toggle', { on: true }],
    ['lamp:swap', {}],
    ['attendant:act', { kind: 'chair', position: here }],
    ['attendant:act', { kind: 'locker', position: here }],
    ['attendant:act', { kind: 'door', position: here }],
    ['attendant:act', { kind: 'kettle', position: here }],
    ['kettle:on', { position: here }],
    ['ui:hover', {}],
    ['ui:screen', { screen: 'journal', open: true }],
    ['item:pickup', { id: 'fuse_core' }],
    ['story:note', { id: 'nb_1', title: 'x', body: 'y' }],
    ['light:circuit', { circuit: 'intake', powered: true, position: here }],
  ];

  // COUNT SPAWNS, NOT POOL GROWTH.
  //
  // `_budget` STEALS when the global or per-name cap is reached: it kills the
  // oldest instance and reaps it, so a successful spawn leaves `voices.length`
  // exactly where it was. Measuring the delta made every event after the pool
  // filled up look silent — the first version of this check reported `item:pickup`,
  // `story:note` and `light:circuit` as broken purely because they happened to be
  // last in the list. Wrapping the engine's own `_spawn` counts what actually
  // happened, and the wrapper is removed again afterwards.
  const spawnedNames = [];
  const real = eng._spawn.bind(eng);
  eng._spawn = (name, position, opts, loop) => {
    const v = real(name, position, opts, loop);
    if (v) spawnedNames.push(name);
    return v;
  };

  const rows = [];
  try {
    for (const [name, payload] of CASES) {
      const before = spawnedNames.length;
      const deniedBefore = eng.stats.denied;
      let threw = null;
      try { g.bus.emit(name, payload); } catch (e) { threw = String(e.message || e); }
      rows.push({
        name,
        spawned: spawnedNames.length - before,
        sounds: spawnedNames.slice(before),
        denied: eng.stats.denied - deniedBefore,
        threw,
      });
    }
  } finally {
    eng._spawn = real;
  }
  return { rows, registered: eng.registry.size, total: spawnedNames.length };
}) : { skipped: 'boot failed' };

await browser.close();
server?.kill();

console.log('');
console.log(`boot check — ${(bootMs / 1000).toFixed(1)} s`);
console.log('');
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: !!pass });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

check('the game reaches ready', ok);
check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
if (status) {
  const s = status.subsystems || {};
  check('world built', s.world === true, `zone ${status.zone}, ${status.fixtures} fixtures`);
  check('gameplay installed', s.gameplay === true, s.gameplayError || '');
  check('UI constructed', status.ui === true);
  check('audio constructed', s.audio === true);
  check('checkpoint saves armed', s.save === true);
  check('interactables are in the world', status.props > 0 && status.interactables > 0,
    `${status.props} props, ${status.interactables} interactor items, ${status.doors} doors`);
  check('an objective is active', !!status.objective, status.objective || 'none');
}
if (audio?.rows) {
  const threw = audio.rows.filter((r) => r.threw);
  const silent = audio.rows.filter((r) => !r.threw && r.spawned <= 0 && r.denied <= 0);
  const denied = audio.rows.filter((r) => r.denied > 0 && r.spawned <= 0);
  check('no audio handler throws', threw.length === 0,
    threw.map((r) => `${r.name}: ${r.threw}`).join(' | '));
  check('every mechanism event spawns a voice', silent.length === 0,
    silent.length ? silent.map((r) => r.name).join(', ')
      : `${audio.rows.length} events, ${audio.total} voices from ${
        new Set(audio.rows.flatMap((r) => r.sounds || [])).size} distinct sounds`);
  if (denied.length) {
    console.log(`       (${denied.length} denied by the voice budget rather than missing: ${denied.map((r) => r.name).join(', ')})`);
  }
} else if (audio?.skipped) {
  console.log(`  --   live audio not exercised — ${audio.skipped}`);
}

if (warnings.length) {
  console.log('');
  console.log(`  ${warnings.length} console warning(s); first few:`);
  for (const w of warnings.slice(0, 5)) console.log(`    ${w.split('\n')[0].slice(0, 150)}`);
}

console.log('');
const failed = checks.filter((c) => !c.pass);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
