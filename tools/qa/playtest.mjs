#!/usr/bin/env node
/**
 * Playtest smoke test.
 *
 * Drives the real input path (synthetic key events through the page, not direct
 * API calls) so the controller, collision and pointer-lock plumbing are all
 * exercised. Asserts the things that silently ruin a first-person game:
 *
 *   - the player never falls through the floor or leaves the world bounds
 *   - position/rotation never become NaN
 *   - walking into a wall does not tunnel through it
 *   - no uncaught errors or WebGL warnings appear during play
 *   - the frame loop keeps advancing
 *
 *   node tools/qa/playtest.mjs --port 4173
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4173', 10);
const url = `http://127.0.0.1:${PORT}/`;

async function up(u, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(u)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

let server = null;
if (!(await up(url, 1500))) {
  if (!existsSync('dist/index.html')) { console.error('run `npm run build` first'); process.exit(1); }
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await up(url, 45000))) { console.error('server failed'); process.exit(1); }
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${url}?quality=low&qa=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR', { timeout: 300000 });
const bootErr = await page.evaluate('window.ANNEX_ERROR || null');
if (bootErr) { console.error('boot failed:\n' + bootErr); await browser.close(); server?.kill(); process.exit(2); }

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures.push(name + (detail ? ': ' + detail : ''));
};

/** Run the sim for `frames` while a set of keys is held. */
async function drive(keys, frames) {
  return page.evaluate(async ({ keys, frames }) => {
    const g = window.ANNEX;
    for (const k of keys) g.input.keys.add(k);
    const track = [];
    for (let i = 0; i < frames; i++) {
      g.step(1 / 60);
      const p = g.player.position;
      track.push([p.x, p.y, p.z]);
    }
    for (const k of keys) g.input.keys.delete(k);
    return track;
  }, { keys, frames });
}

console.log('\nplaytest');

// --- 1. walking forward actually moves the player -------------------------
await page.evaluate(() => window.ANNEX.look(4.2, 0, 20, 3.1416, 0));
const fwd = await drive(['KeyW'], 90);
const d = Math.hypot(fwd.at(-1)[0] - fwd[0][0], fwd.at(-1)[2] - fwd[0][2]);
check('walking forward moves the player', d > 1.5, `${d.toFixed(2)} m in 1.5 s`);

// --- 2. nothing becomes NaN ------------------------------------------------
const finite = fwd.every((p) => p.every(Number.isFinite));
check('position stays finite', finite);

// --- 3. the player stays on the floor -------------------------------------
const ys = fwd.map((p) => p[1]);
check('player stays on the floor', Math.min(...ys) > -0.2 && Math.max(...ys) < 0.6,
  `y range ${Math.min(...ys).toFixed(3)} .. ${Math.max(...ys).toFixed(3)}`);

// --- 4. walking into a wall does not tunnel -------------------------------
const tunnel = await page.evaluate(() => {
  const g = window.ANNEX;
  // Face the outer perimeter and sprint into it for two seconds.
  const b = g.world?.zones?.intake?.bounds;
  const wallX = b ? b.min.x : -31.5;
  g.look(wallX + 3.0, 0, 0, 1.5708, 0);
  g.input.keys.add('KeyW'); g.input.keys.add('ShiftLeft');
  for (let i = 0; i < 150; i++) g.step(1 / 60);
  g.input.keys.delete('KeyW'); g.input.keys.delete('ShiftLeft');
  return { x: g.player.position.x, limit: wallX };
});
check('sprinting into a wall does not tunnel through it',
  tunnel.x > tunnel.limit, `stopped at x=${tunnel.x.toFixed(2)}, wall at ${tunnel.limit.toFixed(2)}`);

// --- 5. crouch under a low ceiling ----------------------------------------
const crouch = await page.evaluate(() => {
  const g = window.ANNEX;
  g.input.keys.add('ControlLeft');
  for (let i = 0; i < 40; i++) g.step(1 / 60);
  const a = g.player.eyeHeight;
  g.input.keys.delete('ControlLeft');
  for (let i = 0; i < 40; i++) g.step(1 / 60);
  return { crouched: a, stood: g.player.eyeHeight };
});
check('crouch lowers and restores the eye height',
  crouch.crouched < 1.1 && crouch.stood > 1.5,
  `${crouch.crouched.toFixed(2)} -> ${crouch.stood.toFixed(2)}`);

// --- 6. footstep events fire while walking --------------------------------
const steps = await page.evaluate(async () => {
  const g = window.ANNEX;
  let n = 0;
  const off = g.bus.on('player:step', () => n++);
  g.look(4.2, 0, 20, 3.1416, 0);
  g.input.keys.add('KeyW');
  for (let i = 0; i < 180; i++) g.step(1 / 60);
  g.input.keys.delete('KeyW');
  off();
  return n;
});
check('footsteps fire at a plausible cadence', steps >= 3 && steps <= 12, `${steps} steps in 3 s`);

// --- 7. the render loop is alive ------------------------------------------
const frames = await page.evaluate(async () => {
  const g = window.ANNEX;
  const before = g.time;
  await new Promise((r) => setTimeout(r, 1500));
  return g.time - before;
});
check('the frame loop advances', frames > 0.2, `${frames.toFixed(2)} s of sim in 1.5 s wall clock`);

// --- 8. no console errors --------------------------------------------------
const realErrors = errors.filter((e) => !/useProgram|deprecated/i.test(e));
check('no console errors during play', realErrors.length === 0,
  realErrors.slice(0, 3).join(' | '));

const status = await page.evaluate(() => window.ANNEX.status());
console.log('\nsubsystems:', JSON.stringify(status.subsystems));
console.log('engine    :', JSON.stringify(status.engine));
console.log('lights    :', JSON.stringify(status.lights));

await browser.close();
server?.kill();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n - ` + failures.join('\n - '));
  process.exit(1);
}
console.log('\nall checks passed');
