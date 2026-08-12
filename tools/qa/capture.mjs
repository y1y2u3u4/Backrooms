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
 *
 * THIS TOOL IS SLOW AND USED TO BE SILENT ABOUT IT, WHICH READ AS A HANG.
 *
 * Three separate capture runs were abandoned as hung after 35, 20 and 15 minutes
 * with no frame written and no output past "→ loading". None of them was hung.
 * Measured on the machine they were abandoned on, at the default 1600x900 and
 * quality high:
 *
 *   steady-state frame            1.28 s
 *   150-frame settle              192 s
 *   a cross-zone `world.goto`     453 s
 *   first frames after that goto  25 s each
 *
 * So a three-shot list that changes zone costs half an hour, and the old code
 * printed its first line of progress only when a shot had already finished. The
 * numbers are what they are — this environment has no GPU (see below) — but a
 * tool that will take 38 minutes has to say "38 minutes" in the first ten
 * seconds, or nobody will ever let it finish.
 *
 * So, before any shot runs, this now prints the renderer it actually got, the
 * measured cost of one frame, and a projection for the whole list; and it prints
 * each shot's name BEFORE rendering it rather than after.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readdir } from 'node:fs/promises';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const OUT = args.out || 'docs/captures/latest';
const WIDTH = parseInt(args.width || '1600', 10);
const HEIGHT = parseInt(args.height || '900', 10);
const PORT = parseInt(args.port || '4173', 10);
const SHOTS = (args.shots || 'default');
const QUALITY = args.quality || 'high';
/**
 * How long to wait for the game to say it is ready.
 *
 * This was 180 s, and boot on a software rasteriser does not fit in it. The page
 * says so in as many words, and the tool was throwing the evidence away:
 *
 *   [game] pre-warmed intake shaders in 65111 ms
 *   THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported.
 *
 * 161 shader permutations compiled one at a time, because the extension that
 * makes `compileAsync` actually asynchronous is not there. One zone is a minute;
 * a boot that streams more than one does not finish inside three. The run then
 * failed with "Timed out waiting for ANNEX_READY", which reads like the game is
 * broken rather than like the clock is too short.
 *
 * `--prewarm 0` does not avoid the cost, it relocates it: boot drops to 2 s and
 * the first `world.goto` in a shot then takes 453 s, measured. Compilation gets
 * paid either way; the only choice is whether it is paid somewhere the tool is
 * watching. Ten minutes, and the page's own progress lines are now echoed while
 * we wait so the wait is legible.
 */
const TIMEOUT = parseInt(args.timeout || '600000', 10);
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
  //
  // ASKING FOR THE GPU IS NOT GETTING IT. On the machine this comment was
  // written on — a Mac with a perfectly good GPU — `--gpu` produced
  //
  //   ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...), SwiftShader driver)
  //
  // because headless Chromium there has no GPU path at all and ANGLE falls back
  // silently. Dropping the flags is a request, not a guarantee, and a run that
  // believes it measured a GPU when it measured a CPU rasteriser is the same
  // class of error as measuring a stale bundle. The renderer string is now read
  // out of the page and printed, and `--gpu` says so when it did not get one.
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
  // The page narrates its own boot — zone builds, AO bakes, the shader pre-warm
  // and how many milliseconds each took. All of it used to be buffered and shown
  // only if something failed, so the one place a slow boot explains itself was
  // the one place nobody could see. Echo those lines live.
  let echo = true;
  page.on('console', (m) => {
    const line = `[${m.type()}] ${m.text()}`;
    logs.push(line);
    if (echo && /^\[(info|log)\] \[(game|world|audio)\]/.test(line)) {
      console.log(`     ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

  console.log('→ loading', url);
  // `--prewarm 0` skips the per-zone shader pre-warm. It exists for the same
  // reason perf.mjs has it: on this environment's CPU rasteriser the pre-warm
  // costs about 190 seconds per zone, so a five-shot run across four zones does
  // not finish. It changes nothing about what the shots LOOK like — only whether
  // the first frame after a zone change stutters, which a still cannot show.
  const q = `quality=${QUALITY}&qa=1${args.prewarm === '0' ? '&prewarm=0' : ''}`;
  await page.goto(`${url}?${q}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const tBoot = Date.now();
  try {
    // `polling: 'raf'` is Playwright's default and it is the wrong one here: a
    // synchronous shader compile blocks the frame callback, so the predicate is
    // not evaluated at all while the thing it is waiting for is happening, and a
    // boot that finished can still look unfinished. Poll on a timer instead.
    await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR',
      null, { timeout: TIMEOUT, polling: 500 });
  } catch (e) {
    const state = await page.evaluate(
      '({ ready: window.ANNEX_READY ?? null, err: window.ANNEX_ERROR ?? null, annex: !!window.ANNEX })',
    ).catch(() => null);
    await writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
    await grabCanvas(page, path.join(OUT, 'FAILED.png')).catch(() => {});
    console.error(`Gave up waiting for ANNEX_READY after ${((Date.now() - tBoot) / 1000).toFixed(0)} s`
      + ` (--timeout ${TIMEOUT} ms).`);
    console.error(`  page state: ${JSON.stringify(state)}`);
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

  // Boot is narrated; the shots have their own progress line. Stop echoing so
  // the per-frame chatter of a long run stays readable.
  echo = false;

  // ---- what are we actually rendering on, and how fast? -------------------
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const soft = /swiftshader|llvmpipe|software/i.test(renderer);
  console.log(`   renderer: ${renderer}`);
  if (args.gpu && soft) {
    console.log('   ⚠ --gpu was requested and this is a software rasteriser. Chromium');
    console.log('     fell back; the frames are correct and the timings are not a GPU verdict.');
  }

  // WHAT A SHOT COSTS IS NOT WHAT A FRAME COSTS.
  //
  // The first version of this block timed ten frames and multiplied by the settle
  // count. It reported "≈ 0.0 min" for a run that took eleven and a half, and it
  // did so with a straight face — the ten frames re-rendered a view that was
  // already compiled and already settled, at about 1 ms each, while the shots
  // that followed took 161 s, 138 s, 28 s and 162 s. Almost none of a shot's cost
  // is the frames: it is the shader compilation triggered when the camera moves
  // somewhere that puts new materials on screen, and no amount of re-rendering
  // the current view can predict it. An estimate that is three orders of
  // magnitude low is worse than no estimate, so the steady-state number is now
  // printed as what it is, and the projection comes from shots that have actually
  // finished.
  const shotList = await loadShots(page, SHOTS);
  const tProbe = Date.now();
  await page.evaluate((n) => {
    const g = window.ANNEX;
    for (let i = 0; i < n; i++) g.renderOnce(1 / 60);
  }, 10);
  const msPerFrame = (Date.now() - tProbe) / 10;
  const zoneHops = shotList.filter((s) => /world\.goto/.test(s.setup || '')).length;
  console.log(`   ${msPerFrame.toFixed(1)} ms per steady-state frame at ${WIDTH}x${HEIGHT} ${QUALITY}`
    + ` — this does NOT predict a shot; new materials compile on first sight.`);
  console.log(`   ${shotList.length} shots`
    + (zoneHops ? `, ${zoneHops} of them change zone (minutes each on a software rasteriser)` : '')
    + '. An ETA appears once the first one lands.');
  if (soft && WIDTH > 960) {
    console.log('   (viewport is the cheapest lever here: --width 960 --height 540)');
  }

  // Let the exposure adaptation and light flicker settle.
  await page.evaluate((n) => {
    const g = window.ANNEX;
    for (let i = 0; i < n; i++) g.renderOnce(1 / 60);
  }, SETTLE);

  const manifest = [];

  let shotN = 0, spent = 0;
  for (const shot of shotList) {
    const t0 = Date.now();
    // BEFORE, not after. The old line printed on completion, so a run that was
    // three minutes into its first shot looked identical to a run that had hung
    // during boot — and that is exactly how three of them came to be killed.
    process.stdout.write(`  · ${++shotN}/${shotList.length} ${shot.name} …`);
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
    spent += Date.now() - t0;
    const left = shotList.length - shotN;
    const eta = left ? `  ~${((spent / shotN * left) / 60000).toFixed(1)} min left` : '';
    console.log(`\r  ✓ ${shotN}/${shotList.length} ${shot.name}  ${stats.res} ${stats.calls} calls`
      + ` ${(stats.tris / 1000).toFixed(0)}k tris  ${stats.ms.toFixed(1)}ms/f  (${wall}s)${power}${eta}`);
  }

  // ---- frames that are not photographs of the room ------------------------
  //
  // `g.look` puts the camera exactly where it is told, and a camera told to stand
  // 40 cm from a partition photographs the partition: a full-frame wash of blown
  // wallpaper with nothing in it. `lookOpen` exists to avoid that and searches
  // for a sightline, but the search is expensive, so shot lists mix the two — and
  // the first list written after this harness was repaired contained exactly one
  // nose-to-wall frame, which went into the output directory looking like a
  // capture of a room.
  //
  // The tell is already in the manifest and needed no new measurement. The three
  // good frames of that run adapted to 0.047, 0.068 and 0.103; the wall adapted
  // to 2.19 — twenty to forty times its siblings, because the exposure system was
  // metering a surface at arm's length. The same test catches the opposite case,
  // a frame in a room that turned out to be dark.
  //
  // A ratio against the family median, not an absolute threshold: this game is
  // deliberately dim in some zones and bright in others, and an absolute bar
  // would flag the Cistern for being the Cistern.
  const adapted = manifest
    .map((m) => m.stats?.probe?.adaptation?.adapted)
    .filter((v) => typeof v === 'number' && v > 0)
    .sort((a, b) => a - b);
  if (adapted.length >= 3) {
    const median = adapted[Math.floor(adapted.length / 2)];
    const odd = manifest.filter((m) => {
      const a = m.stats?.probe?.adaptation?.adapted;
      return typeof a === 'number' && a > 0 && (a > median * 8 || a < median / 8);
    });
    for (const m of odd) {
      m.suspectFraming = true;
      const a = m.stats.probe.adaptation.adapted;
      console.log(`  ⚠ ${m.name}: adapted luminance ${a.toFixed(3)} against a median of`
        + ` ${median.toFixed(3)} — ${a > median ? 'the lens is probably against a surface'
          : 'this frame is probably dark'}, check it before using it`);
    }
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
  // A NAMED LIST THAT DOES NOT EXIST IS A MISTAKE, NOT A REQUEST FOR THE DEFAULT.
  //
  // The fallback below is for `--shots` being absent. When a name WAS given and
  // no such file exists, falling through to it silently shot the default twelve
  // frames and wrote them to the default directory — forty minutes of software
  // rendering that answered a question nobody asked, and the log looked like a
  // clean pass. The trigger was `--shots=ceil` instead of `--shots ceil`: this
  // parser splits on spaces, so the whole token became a key and `args.shots`
  // was undefined. Either way the tool should say so.
  if (name && name !== 'default') {
    console.error(`No such shot list: ${file}`);
    console.error(`Available: ${'\n  '}${
      (await readdir('tools/qa')).filter((f) => /^shots\..+\.json$/.test(f))
        .map((f) => f.slice(6, -5)).sort().join(', ')}`);
    console.error('Note: arguments are space-separated — `--shots ceil`, not `--shots=ceil`.');
    process.exit(2);
  }
  // Fall back to a generic sweep the game itself proposes.
  return page.evaluate(() => {
    const g = window.ANNEX;
    if (g.qaShots) return g.qaShots();
    return [{ name: 'spawn', setup: '', settle: 30 }];
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
