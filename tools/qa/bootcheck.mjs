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
if (warnings.length) {
  console.log('');
  console.log(`  ${warnings.length} console warning(s); first few:`);
  for (const w of warnings.slice(0, 5)) console.log(`    ${w.split('\n')[0].slice(0, 150)}`);
}

console.log('');
const failed = checks.filter((c) => !c.pass);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
