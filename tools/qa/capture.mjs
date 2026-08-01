#!/usr/bin/env node
/**
 * QA capture harness.
 *
 * Boots the build in headless Chromium, waits for the game to report ready,
 * then drives `window.ANNEX` to specific camera setups and grabs frames.
 *
 * Usage:
 *   node tools/qa/capture.mjs                       # default shot list
 *   node tools/qa/capture.mjs --shots free          # free-roam sampling
 *   node tools/qa/capture.mjs --out docs/captures/r2
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const OUT = args.out || 'docs/captures/latest';
const WIDTH = parseInt(args.width || '1600', 10);
const HEIGHT = parseInt(args.height || '900', 10);
const PORT = parseInt(args.port || '4173', 10);
const SHOTS = (args.shots || 'default');
const QUALITY = args.quality || 'high';
const TIMEOUT = parseInt(args.timeout || '180000', 10);
// 150 frames, not 14.
//
// The eye adaptation deliberately falls slowly into darkness — a 1.8 s time
// constant, which is 109 frames — because that is what an eye does. A capture
// that settles 14 frames after jumping from a bright zone to a dark one
// photographs the exposure of the zone it just left, and every Cistern and
// Ductwork frame taken that way read as 95% black and was wrongly diagnosed as
// the zone being too dark. Frames are cheap here (single-digit milliseconds in
// steady state); it is the first-frame shader compile that costs, and that is
// paid once per shot either way.
const SETTLE = parseInt(args.settle || '150', 10);

async function waitForServer(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  let server = null;
  const url = `http://127.0.0.1:${PORT}/`;
  if (!(await waitForServer(url, 1200))) {
    if (!existsSync('dist/index.html')) {
      console.error('No dist/ build and no server on :' + PORT + '. Run `npm run build` first.');
      process.exit(1);
    }
    server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
      stdio: 'ignore', detached: false,
    });
    if (!(await waitForServer(url, 45000))) {
      console.error('preview server did not come up');
      process.exit(1);
    }
  }

  // `--gpu` drops the SwiftShader flags and lets the machine's real GPU render.
  // This tool has always forced a CPU rasteriser, which is right on a headless
  // box with no GPU and wrong on a laptop with one — the frames are the same
  // picture either way but they arrive one to two orders of magnitude faster,
  // and any timing printed alongside them means something.
  const browser = await chromium.launch({
    args: [
      ...(args.gpu ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
      '--disable-gpu-sandbox', '--no-sandbox',
      '--ignore-gpu-blocklist', '--enable-webgl',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

  console.log('→ loading', url);
  // `--prewarm 0` skips the per-zone shader pre-warm. It exists for the same
  // reason perf.mjs has it: on this environment's CPU rasteriser the pre-warm
  // costs about 190 seconds per zone, so a five-shot run across four zones does
  // not finish. It changes nothing about what the shots LOOK like — only whether
  // the first frame after a zone change stutters, which a still cannot show.
  const q = `quality=${QUALITY}&qa=1${args.prewarm === '0' ? '&prewarm=0' : ''}`;
  await page.goto(`${url}?${q}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR', { timeout: TIMEOUT });
  } catch (e) {
    await writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
    await grabCanvas(page, path.join(OUT, 'FAILED.png')).catch(() => {});
    console.error('Timed out waiting for ANNEX_READY.');
    console.error(logs.slice(-40).join('\n'));
    await browser.close();
    if (server) server.kill();
    process.exit(2);
  }

  const err = await page.evaluate('window.ANNEX_ERROR || null');
  if (err) {
    await writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
    console.error('Boot error:\n' + err);
    await grabCanvas(page, path.join(OUT, 'FAILED.png')).catch(() => {});
    await browser.close();
    if (server) server.kill();
    process.exit(3);
  }

  // Let the exposure adaptation and light flicker settle.
  await page.evaluate((n) => {
    const g = window.ANNEX;
    for (let i = 0; i < n; i++) g.renderOnce(1 / 60);
  }, SETTLE);

  const shotList = await loadShots(page, SHOTS);
  const manifest = [];

  for (const shot of shotList) {
    const t0 = Date.now();
    await page.evaluate(async (s) => {
      const g = window.ANNEX;
      g.engine.frameTime.clear();
      if (s.setup) { /* eslint-disable no-new-func */ new Function('g', s.setup)(g); }
      const frames = s.settle;
      for (let i = 0; i < frames; i++) g.renderOnce(1 / 60);
    }, { ...shot, settle: shot.settle ?? SETTLE });
    const file = path.join(OUT, `${shot.name}.png`);
    await grabCanvas(page, file);
    const stats = await page.evaluate(() => {
      const g = window.ANNEX;
      return { ...g.engine.stats, lights: g.rig?.stats, probe: g.lightProbe?.() ?? null };
    });
    const wall = ((Date.now() - t0) / 1000).toFixed(1);
    manifest.push({ ...shot, file, stats });
    // WHICH CIRCUITS WERE LIVE IS PART OF THE EVIDENCE.
    //
    // Most of this building starts with its power off — that is the premise of
    // the game, and `board_c` ships with the stack, cistern, residence and duct
    // ways open. A capture that teleports into one of those zones photographs a
    // powered-down room, and a frame measuring 1.000 crushed then reads as a
    // catastrophic lighting defect when it is in fact correct behaviour. That
    // very nearly caused a lighting change to be made to fix a game state.
    //
    // So every shot now records the zone's live circuits and its direct
    // illumination at head height alongside the pixels. A dark frame with
    // `stack: 0` is a game state; a dark frame with `stack: 1` is a defect.
    const p = stats.probe;
    const live = p ? Object.entries(p.circuits).filter(([, v]) => v > 0.02).map(([k]) => k) : [];
    const power = p ? `  [${p.zone} lit ${p.zoneFixtures.lit}/${p.zoneFixtures.total}`
      + ` head ${p.directAtHead} exp ${p.exposure} live:${live.join(',') || 'none'}]` : '';
    console.log(`  ✓ ${shot.name}  ${stats.res} ${stats.calls} calls ${(stats.tris / 1000).toFixed(0)}k tris  ${stats.ms.toFixed(1)}ms/f  (${wall}s)${power}`);
  }

  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(OUT, 'console.log'), logs.join('\n'));

  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) {
    console.log('\n⚠ console errors:');
    console.log(errors.slice(0, 20).join('\n'));
  }

  await browser.close();
  if (server) server.kill();
  console.log(`\nWrote ${manifest.length} frames to ${OUT}`);
}

/**
 * Read the frame straight out of the WebGL canvas rather than asking Playwright
 * for a screenshot.
 *
 * `page.screenshot()` waits for a compositor commit. When every frame takes
 * seconds — which it does on a CPU rasteriser under load — that wait times out
 * even though the renderer is working perfectly. The context is created with
 * `preserveDrawingBuffer: true`, so the last rendered frame is still readable
 * and `toDataURL` returns it immediately with no compositor involved.
 */
async function grabCanvas(page, file) {
  const dataUrl = await page.evaluate(() => {
    const c = document.getElementById('view');
    return c.toDataURL('image/png');
  });
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  await writeFile(file, Buffer.from(b64, 'base64'));
}

async function loadShots(page, name) {
  const file = `tools/qa/shots.${name}.json`;
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  // Fall back to a generic sweep the game itself proposes.
  return page.evaluate(() => {
    const g = window.ANNEX;
    if (g.qaShots) return g.qaShots();
    return [{ name: 'spawn', setup: '', settle: 30 }];
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
