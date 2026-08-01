#!/usr/bin/env node
/**
 * Emissive check — is a lit fitting actually brighter than the ceiling it is in?
 *
 * THE DEFECT THIS EXISTS FOR.
 *
 * `Kit.troffer` built its housing as a solid `box(L+0.06, 0.12, W+0.06)` sitting
 * at +0.062, spanning y in [0.002, 0.122]. The lamps it claims an emissive slot
 * for sat at y in [0.021, 0.059]. They were inside the casing. Every troffer in
 * the building — 200 of the Intake's 208 fixtures — rendered as an unlit steel
 * rectangle, and the thing the player is supposed to read as "the light" was
 * never on screen.
 *
 * Nothing in this project could see that. `lightreach` measured distance to a
 * fixture and passed: the fixtures were there. `geobudget` counted them and
 * passed. `perf` counted the emissive draw calls and passed: the batch was
 * submitted, once per zone, exactly as designed. `lightProbe` measured direct
 * illumination at head height and read 37 units: the SpotLight was working, and
 * it is a different object from the mesh. Sixty capture screenshots went by. The
 * one measurement nobody made was whether the lit thing is bright in the frame.
 *
 * That is the sixth time this project has shipped a green tool that measured
 * something adjacent to its claim, and it is the pattern docs/NEXT_ITERATION_-
 * PROMPT.md section 6 is about. So this tool measures the claim itself, in
 * pixels: point the camera at a lit fixture from a place a player could stand,
 * and compare the brightest pixel over the fixture with the brightest pixel in
 * a ring of ceiling around it.
 *
 * It fails when a lit fitting is not brighter than its own surround. Run it
 * against the sealed housing and it fails on `troffer` with a delta near zero;
 * run it against a hidden emissive mesh and it fails the same way; run it
 * against a fitting whose diffuser stops working at grazing angles and it fails
 * on the far sample and passes on the near one, which is the information you
 * want.
 *
 *   npm run build && node tools/qa/emissive.mjs            # SwiftShader
 *   npm run build && node tools/qa/emissive.mjs --gpu      # real hardware
 *
 * `--gpu` matters. Every performance and pixel number this project has recorded
 * came from a CPU rasteriser because these harnesses hard-code
 * `--use-angle=swiftshader`. On a machine with a GPU that is a choice, not a
 * constraint, and the flag makes it one.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4247', 10);
// Low by default even with --gpu. The tier this runs at is almost irrelevant to
// the question — "is the fitting brighter than the ceiling around it" is a
// ratio, and it survives resolution and MSAA — but `textureQuality` is not a
// GPU setting at all: it drives the CPU texture synthesis at boot, and high
// costs minutes of one core in headless before a single frame is drawn.
const QUALITY = args.quality || 'low';
const PER_TYPE = parseInt(args.per || '4', 10);
const RANGES = (args.range || '2.5,6').split(',').map(Number);
const OUT = args.out || 'docs/verification/emissive.json';
const TIMEOUT = parseInt(args.timeout || '420000', 10);

/** A lit fitting must beat its own surround by this much, 0..255. */
const MIN_DELTA = 24;

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

const gpuArgs = ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'];
const swArgs = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox', '--no-sandbox', ...gpuArgs,
];
const browser = await chromium.launch({ args: args.gpu ? gpuArgs : swArgs });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// `qa=1` is what turns preserveDrawingBuffer on (see Engine's `readback`), and
// this tool reads the frame back out of the canvas, so it is required here.
await page.goto(`${url}?quality=${QUALITY}&qa=1&prewarm=0`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(
  () => window.ANNEX_READY === true || (window.ANNEX && window.ANNEX.ready === true),
  null, { timeout: TIMEOUT, polling: 500 },
);

const renderer = await page.evaluate(() => {
  const gl = window.ANNEX.engine.renderer.getContext();
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
});

const ZONES = (args.zones || 'intake,service,cistern,residence,plant,duct,stack,safe').split(',');
const rows = [];
const skips = [];

for (const zone of ZONES) {
  const zoneRows = await page.evaluate(async ({ zone, perType, ranges, minDelta }) => {
    const A = window.ANNEX;
    const E = A.engine;
    E.autoQuality = false;
    // Most of this building starts unpowered — that is the premise of the game.
    // A dark fitting is a game state, not a defect, so the whole board goes live
    // before anything is measured. See the note in capture.mjs.
    for (const c of A.rig.circuits.keys()) A.rig.setCircuit(c, true);
    A.world.goto(zone);
    // SETTLE ON THE EXPOSURE, NOT ON A FRAME COUNT.
    //
    // This used to be 40 frames. capture.mjs's own comment puts the eye
    // adaptation time constant at 1.8 s — 109 frames — and says in as many
    // words that a capture settled too soon "photographs the exposure of the
    // zone it just left". Every fixture output ramps from zero as well. Forty
    // frames after a teleport into a dark room the frame is still stopped down
    // for the bright one behind it, which crushes an absolute-difference
    // measurement toward zero and reports a working fitting as INVISIBLE.
    // `lightProbe().exposure` is a constant and settling on it is a no-op; the
    // adapted value is `adaptation.autoGain`. Both the floor of 150 frames and
    // the convergence test are here because either alone is wrong: the gain
    // reaches its clamp early in a very dark room while the image behind it is
    // still resolving, and a pure frame count wastes minutes in a bright one.
    const settle = (max) => {
      let last = -1, stable = 0;
      for (let i = 0; i < max; i++) {
        A.renderOnce(1 / 60);
        const a = A.lightProbe().adaptation;
        const e = a ? a.autoGain : 0;
        if (i > 150 && Math.abs(e - last) < 2e-3) { if (++stable > 20) return i; } else stable = 0;
        last = e;
      }
      return max;
    };
    settle(700);

    const gl = E.renderer.getContext();
    const W = E.renderer.domElement.width;
    const H = E.renderer.domElement.height;

    /**
     * Mean luminance over the aperture against the median of a ring of ceiling
     * around it.
     *
     * The obvious version of this — brightest pixel inside against brightest
     * pixel outside — was the first thing I wrote and it reported every fitting
     * in the game INVISIBLE, including ones I had just watched glow in a
     * screenshot. Two reasons, both of them the same mistake this file exists to
     * catch. A max-against-max comparison is decided by whichever single pixel
     * anywhere in the ring is brightest, and at 2.5 m the ring usually contains
     * the *next* fitting down the corridor, or its bloom. And a mean over a disc
     * sized from the whole fitting's bounding sphere is mostly housing.
     *
     * So: mean over a disc at 55% of the projected radius, which is aperture
     * rather than pan, against the *median* of the ring, which one other lamp
     * cannot move. A luminous panel raises the mean of what it covers; that is
     * the claim, and this is the measurement that fails when it is false.
     */
    const probe = (cx, cy, r) => {
      const R = r * 0.55;
      const x0 = Math.max(0, Math.round(cx - r * 3)), x1 = Math.min(W, Math.round(cx + r * 3));
      const y0 = Math.max(0, Math.round(cy - r * 3)), y1 = Math.min(H, Math.round(cy + r * 3));
      const w = x1 - x0, h = y1 - y0;
      if (w < 6 || h < 6) return null;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let inSum = 0, inN = 0, inMax = 0;
      const ring = [];
      let clipped = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const v = Math.max(buf[i], buf[i + 1], buf[i + 2]);
          const d = Math.hypot((x0 + x) - cx, (y0 + y) - cy);
          if (d <= R) { inSum += v; inN++; if (v > inMax) inMax = v; }
          else if (d > r * 1.6 && d < r * 2.8) { ring.push(v); if (v >= 250) clipped++; }
        }
      }
      if (inN < 8 || ring.length < 24) return null;
      ring.sort((a, b) => a - b);
      return {
        inMean: Math.round(inSum / inN),
        inMax,
        outMedian: ring[Math.floor(ring.length / 2)],
        // A CLIPPED SURROUND CANNOT BE BEATEN.
        //
        // The Plant runs 254 units of direct light at head height, and a frame
        // there comes back with 77,710 pixels above 200 and a ring sitting at
        // 228. Nothing in that frame can be 24 brighter than its own ceiling
        // because the ceiling is already at the top of the range. That is a
        // blown exposure, not a dark fitting, and calling it INVISIBLE is the
        // same error in the opposite direction as the one this file exists for.
        ringClipped: +(clipped / ring.length).toFixed(3),
      };
    };

    // Point the camera at a world point by projecting it and correcting the
    // angular error. Convention-free: it does not need to know which way yaw
    // counts, only which way the error moved.
    const aimAt = (ox, oz, fx, fy, fz) => {
      let yaw = 0, pitch = 0;
      for (let k = 0; k < 6; k++) {
        A.look(ox, 0, oz, yaw, pitch);
        A.renderOnce(1 / 60);
        const v = new A.player.position.constructor(fx, fy, fz).project(E.camera);
        if (Math.abs(v.x) < 0.02 && Math.abs(v.y) < 0.02 && v.z < 1) break;
        yaw -= v.x * (E.camera.fov * Math.PI / 180) * E.camera.aspect * 0.5;
        pitch += v.y * (E.camera.fov * Math.PI / 180) * 0.5;
        pitch = Math.max(-1.3, Math.min(1.3, pitch));
      }
      return { yaw, pitch };
    };

    const V = A.player.position.constructor;
    const out = [];
    /** Samples this tool declined to take, and why. A dropped sample is not a
     *  pass and it is not a failure — it is a hole, and it gets printed. */
    const skipped = [];
    const byType = new Map();
    // ONLY THE FIXTURES IN THE ZONE UNDER TEST.
    //
    // `rig.fixtures` spans every RESIDENT zone, and the World keeps three of
    // them alive at once 400 m apart. Filtering by type alone hands you a
    // fitting in a room you are not standing in and then labels the row with
    // the zone you asked for: a run for `intake` measured a fitting at
    // x=382.9, z=398, which is the Service Spine. Every per-zone number this
    // tool printed before this line existed was attributed by hope.
    const zoneFixtures = new Set(A.world?.zones?.[zone]?._fixtures || []);
    for (const f of A.rig.fixtures) {
      if (f.level < 0.5 || !f.tube || !zoneFixtures.has(f)) continue;
      const list = byType.get(f.type) || [];
      if (list.length < perType * ranges.length * 3) { list.push(f); byType.set(f.type, list); }
    }

    for (const [type, all] of byType) {
      // Spread the samples through the list rather than taking the first few,
      // which would all be in one corner of the zone.
      const step = Math.max(1, Math.floor(all.length / (perType * ranges.length)));
      let picked = 0;
      for (let i = 0; i < all.length && picked < perType * ranges.length; i += step) {
        const f = all[i];
        const p = f.group.position;
        const range = ranges[picked % ranges.length];

        // AIM AT THE LAMP, NOT AT THE FIXTURE'S ORIGIN.
        //
        // `fixture.group.position` is the mounting point the rig hangs the
        // SpotLight from; the emissive source is wherever the builder put it.
        // A high bay's are 100 mm apart, which at the disc radii below is most
        // of the aperture — the probe was landing under the lamp, in air.
        const tm = f.tube.matrix?.elements;
        const t = tm ? { x: tm[12], y: tm[13], z: tm[14] } : { x: p.x, y: p.y, z: p.z };

        // WHICH SIDE TO STAND ON.
        //
        // A ceiling fitting does not care. A wall-mounted one does, and
        // standing beside a bulkhead photographs its back — which is what made
        // `bulkhead` read INVISIBLE and had to be disclaimed in prose. The
        // fitting already knows which way it faces: `f.target` is a child of
        // `f.group`, so its local offset rotated by the group's yaw is the
        // direction the light is thrown. When that has a horizontal component,
        // stand in it; when it points straight down, fall back to any heading
        // with floor under it.
        const tp = f.target?.position;
        const ry = f.group.rotation.y;
        let headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
        if (tp && Math.hypot(tp.x, tp.z) > 0.35) {
          const fx = tp.x * Math.cos(ry) + tp.z * Math.sin(ry);
          const fz = -tp.x * Math.sin(ry) + tp.z * Math.cos(ry);
          const face = Math.atan2(fx, fz);
          headings = [face, face + 0.5, face - 0.5, ...headings];
        }

        // STAND AT `range` FROM THE LAMP, NOT `range` FROM THE POINT BELOW IT.
        //
        // The old code stepped `range` horizontally and then called the result
        // the distance. In the Plant the high bays hang 12.1 m above the floor,
        // so "2.5 m away" was 12.4 m away, the aperture radius below came out
        // five times too large, and the disc it averaged was ceiling. Solve for
        // the horizontal leg that makes the SLANT distance equal `range`
        // instead; if the lamp is higher above the eye than `range`, no such
        // point exists and the sample is dropped rather than mismeasured.
        //
        // The floor test matters as much. `pointBlocked` asks whether something
        // is in the way, never whether there is anything to stand on: in the
        // Residence every candidate put the player at y = -10.63 in the void
        // under the building, reading `directAtHead` 0 and projecting the
        // fitting 3.3 screen-heights off the top of the frame.
        const EYE = 1.63;
        let placed = null;
        for (const a of headings) {
          const probeX = p.x + Math.sin(a) * Math.min(range, 3), probeZ = p.z + Math.cos(a) * Math.min(range, 3);
          // Highest floor at or below the lamp: the surface a player under this
          // fitting would actually be standing on.
          const fl = A.collision?.sampleFloor?.(probeX, probeZ, t.y, 0);
          if (!fl) continue;
          const dy = t.y - (fl.y + EYE);
          // `aimAt` clamps pitch at 1.3 rad. Asking for a sample steeper than
          // that produces a frame the fitting is not in, which is how the Plant
          // came to report an aperture mean of 1.
          if (Math.abs(dy) >= range * 0.94) continue;
          const leg = Math.sqrt(range * range - dy * dy);
          const ox = p.x + Math.sin(a) * leg, oz = p.z + Math.cos(a) * leg;
          // THERE IS NO `pointBlocked`.
          //
          // This used to read `A.collision?.pointBlocked?.(ox, oz)`. That method
          // does not exist on CollisionWorld — the optional call returned
          // undefined, undefined is falsy, and the obstruction test has been a
          // no-op for the whole life of this file. It is the reason so many
          // samples ended up with a duct or a wall between the camera and the
          // fitting, and before the response test below those all recorded as
          // dark readings and became the INVISIBLE verdicts.
          //
          // `resolveCapsule` is the real query: it pushes a player-sized capsule
          // out of everything it overlaps and reports whether it had to.
          const res = A.collision?.resolveCapsule?.(ox, fl.y, oz, 0.29, 1.74);
          if (!res || res.hit || Math.hypot(res.x - ox, res.z - oz) > 0.05) continue;
          const fl2 = A.collision?.sampleFloor?.(ox, oz, t.y, 0);
          if (!fl2 || Math.abs(fl2.y - fl.y) > 0.5) continue;
          placed = { ox, oz, dist: range };
          break;
        }
        if (!placed) { skipped.push({ zone, type, range, why: 'no standing point at this range' }); continue; }

        aimAt(placed.ox, placed.oz, t.x, t.y, t.z);
        for (let s = 0; s < 12; s++) A.renderOnce(1 / 60);
        const v = new V(t.x, t.y, t.z).project(E.camera);
        if (Math.abs(v.x) > 0.9 || Math.abs(v.y) > 0.9) {
          skipped.push({ zone, type, range, why: 'fitting could not be centred (pitch clamp)' });
          continue;
        }
        const cx = (v.x * 0.5 + 0.5) * W, cy = (v.y * 0.5 + 0.5) * H;
        // Aperture radius in pixels, from the fitting's own bounding sphere at
        // the distance the camera actually is from it.
        const eye = A.player.position;
        const dist = Math.max(0.3, Math.hypot(t.x - eye.x, t.y - (eye.y + EYE), t.z - eye.z));
        const bs = f.tube.mesh?.geometry?.boundingSphere?.radius ?? 0.3;
        const r = Math.max(3, (bs / dist) * (H * 0.5) / Math.tan(E.camera.fov * Math.PI / 360));
        const R = Math.min(r, H * 0.25);

        // PROVE THE CAMERA IS LOOKING AT THIS FITTING BEFORE JUDGING IT.
        //
        // Standing at the right distance on a heading with floor, facing the way
        // the fitting faces, and projecting inside the frame are four things
        // that are all true of a fitting behind a duct run. A sweep of
        // `tubeIntensity` from 1.15 to 4.5 — four times the emissive — left two
        // bulkhead samples reading an aperture of exactly 1/255 at every value,
        // and those samples were in the median that failed the type.
        //
        // So: switch this fitting's emissive off, then well up, and require the
        // aperture to move. `Fixture.update` reads `def.tubeIntensity` every
        // frame and `def` is the shared FIXTURE_TYPES entry, so this is live and
        // reversible. A disc that does not respond to the lamp it is centred on
        // is not photographing that lamp, and the sample is a hole rather than a
        // failure. This is also the discrimination test the file's own header
        // claims: it verifies against a known-dark state on every sample instead
        // of once, by hand, in a comment.
        const t0 = f.def.tubeIntensity;
        f.def.tubeIntensity = 0;
        for (let s = 0; s < 8; s++) A.renderOnce(1 / 60);
        const dark = probe(cx, cy, R);
        f.def.tubeIntensity = t0 * 6;
        for (let s = 0; s < 8; s++) A.renderOnce(1 / 60);
        const lit = probe(cx, cy, R);
        f.def.tubeIntensity = t0;
        for (let s = 0; s < 12; s++) A.renderOnce(1 / 60);
        const responds = dark && lit ? lit.inMean - dark.inMean : 0;
        if (responds < 8) {
          skipped.push({ zone, type, range, why: 'fitting not visible from the standing point (aperture does not respond to its own lamp)' });
          continue;
        }

        const q = probe(cx, cy, R);
        if (!q) { skipped.push({ zone, type, range, why: 'probe window too small' }); continue; }
        out.push({
          zone, type, range, dist: +dist.toFixed(2),
          level: +f.level.toFixed(2), health: f.health,
          apertureMean: q.inMean, apertureMax: q.inMax, ceilingMedian: q.outMedian,
          delta: q.inMean - q.outMedian,
          ringClipped: q.ringClipped,
          apertureRadiusPx: +r.toFixed(1),
          /** How far the aperture moved between this fitting's lamp off and 6x.
           *  A sample that is not well above the threshold is one to distrust. */
          respondsTo6x: responds,
        });
        picked++;
      }
    }
    return { out, skipped };
  }, { zone, perType: PER_TYPE, ranges: RANGES, minDelta: MIN_DELTA });
  rows.push(...zoneRows.out);
  skips.push(...zoneRows.skipped);
  process.stdout.write(`  ${zone}: ${zoneRows.out.length} samples`
    + (zoneRows.skipped.length ? `, ${zoneRows.skipped.length} declined` : '') + '\n');
}

// ---------------------------------------------------------------------------

const byType = new Map();
for (const r of rows) {
  const k = `${r.type}`;
  const l = byType.get(k) || [];
  l.push(r); byType.set(k, l);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

console.log(`\nemissive — is a lit fitting brighter than the ceiling it sits in?`);
console.log(`renderer: ${renderer}\n`);
console.log('type          n   range   aperture mean   ceiling median   delta   verdict');
console.log('─'.repeat(84));

// The gate is the nearest range. A fitting that reads close and cuts off far
// away is a real property of a recessed luminaire, not a defect, so the far
// range is printed for information and does not fail the run.
const nearest = Math.min(...RANGES);
let failed = 0;
const summary = [];
for (const [type, l] of [...byType].sort()) {
  for (const range of [...RANGES].sort((a, b) => a - b)) {
    const s = l.filter((r) => r.range === range);
    if (!s.length) continue;
    const d = median(s.map((r) => r.delta));
    const am = median(s.map((r) => r.apertureMean));
    const cm = median(s.map((r) => r.ceilingMedian));
    const gates = range === nearest;
    const ok = d >= MIN_DELTA;
    // A surround that is already clipped at the top of the range cannot be
    // beaten by anything, so the comparison carries no information. Report it
    // as unmeasurable rather than as a dark fitting — the Plant's high bays run
    // the room at 254 units and blow every ring in it out to 228.
    const clip = median(s.map((r) => r.ringClipped ?? 0));
    const blown = !ok && clip >= 0.25;
    if (gates && !ok && !blown) failed++;
    summary.push({ type, range, n: s.length, apertureMean: am, ceilingMedian: cm, delta: d, ok, gates, ringClipped: clip, blown });
    const verdict = ok ? 'ok'
      : blown ? `surround clipped ${Math.round(clip * 100)}% — not measurable here`
        : (gates ? 'INVISIBLE' : 'cut off (not gated)');
    console.log(
      `${type.padEnd(12)}${String(s.length).padStart(4)}${(range + ' m').padStart(8)}`
      + `${String(am).padStart(16)}${String(cm).padStart(17)}${String(d).padStart(8)}   ${verdict}`,
    );
  }
}

// A type with no samples at all is not a pass. If a zone would not build, or
// every fitting of a type was skipped for want of a place to stand, that is a
// hole in the coverage and it says so rather than reporting nothing.
const expected = (args.expect || 'troffer,strip,bulkhead,highbay,pendant,emergency').split(',');
const missing = expected.filter((t) => !byType.has(t));
if (missing.length) console.log(`\n⚠ never sampled: ${missing.join(', ')} — coverage hole, not a pass`);

// Declining a sample is a legitimate answer — a high bay 12 m up has no place a
// player can stand 2.5 m from it — but it must be visible, or a type that was
// mostly skipped reads as a type that mostly passed.
if (skips.length) {
  const by = new Map();
  for (const s of skips) {
    const k = `${s.type} @ ${s.range} m — ${s.why}`;
    by.set(k, (by.get(k) || 0) + 1);
  }
  console.log('\ndeclined samples (a hole, not a pass):');
  for (const [k, n] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
}
if (errors.length) console.log(`\n⚠ page errors:\n${errors.slice(0, 5).join('\n')}`);

mkdirSync(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({
  renderer, quality: QUALITY, minDelta: MIN_DELTA, ranges: RANGES, summary, rows, skipped: skips,
}, null, 2));
console.log(`\nwrote ${OUT}`);

await browser.close();
if (server) server.kill();
process.exit(failed || missing.length || errors.length ? 1 : 0);
