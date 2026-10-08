#!/usr/bin/env node
/**
 * Measured sweep of a fixture type's emissive level.
 *
 * `FIXTURE_TYPES[type].tubeIntensity` drives one thing and one thing only: how
 * bright the lens/tube/diffuser in the emissive batch is drawn. It does not
 * touch the SpotLight, so it changes how a fitting READS without changing what
 * it lights — which makes it the right knob for "the fitting is not visibly the
 * source" and the wrong one for "the room is too dark".
 *
 * `Fixture.def` is the shared FIXTURE_TYPES entry and `setLevel` reads
 * `def.tubeIntensity` every update, so assigning it at runtime is live. This
 * stands in the same places emissive.mjs does, at each candidate value, and
 * prints the delta and the clipping so the number is chosen rather than argued.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));
const PORT = parseInt(args.port || '4281', 10);
const TYPE = args.type || 'bulkhead';
const VALUES = (args.values || '1.15,1.6,2.2,3.0,4.0').split(',').map(Number);
const ZONES = (args.zones || 'cistern,duct,service,plant').split(',');
const RANGE = parseFloat(args.range || '2.5');
const url = `http://127.0.0.1:${PORT}/`;

const up = async (u, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(u)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};
let server = null;
if (!(await up(url, 1500))) {
  if (!existsSync('dist/index.html')) { console.error('run `npm run build` first'); process.exit(1); }
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await up(url, 60000))) { console.error('no preview server'); process.exit(1); }
}
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${url}?quality=low&qa=1&prewarm=0`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.ANNEX_READY === true || (window.ANNEX && window.ANNEX.ready === true),
  null, { timeout: 600000, polling: 500 });

const rows = [];
for (const zone of ZONES) {
  const zr = await page.evaluate(({ zone, type, values, range }) => {
    const A = window.ANNEX, E = A.engine;
    E.autoQuality = false;
    for (const c of A.rig.circuits.keys()) A.rig.setCircuit(c, true);
    A.world.goto(zone);
    const cine = A.ui && A.ui.cine;
    let n = 0;
    while (cine && cine.active && n < 4000) { A.renderOnce(1 / 60); n++; }
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
    if (A.flashlight) { A.flashlight.isOn = false; A.flashlight.on = false; }

    const gl = E.renderer.getContext();
    const W = E.renderer.domElement.width, H = E.renderer.domElement.height;
    const V = A.player.position.constructor;
    const EYE = 1.63;

    const probe = (cx, cy, r) => {
      const R = r * 0.55;
      const x0 = Math.max(0, Math.round(cx - r * 3)), x1 = Math.min(W, Math.round(cx + r * 3));
      const y0 = Math.max(0, Math.round(cy - r * 3)), y1 = Math.min(H, Math.round(cy + r * 3));
      const w = x1 - x0, h = y1 - y0;
      if (w < 6 || h < 6) return null;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let inSum = 0, inN = 0, inMax = 0, inClip = 0;
      const ring = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const v = Math.max(buf[i], buf[i + 1], buf[i + 2]);
          const d = Math.hypot((x0 + x) - cx, (y0 + y) - cy);
          if (d <= R) { inSum += v; inN++; if (v > inMax) inMax = v; if (v >= 250) inClip++; }
          else if (d > r * 1.6 && d < r * 2.8) ring.push(v);
        }
      }
      if (inN < 8 || ring.length < 24) return null;
      ring.sort((a, b) => a - b);
      return { inMean: Math.round(inSum / inN), inMax, inClip: +(inClip / inN).toFixed(3), outMedian: ring[Math.floor(ring.length / 2)] };
    };

    const aimAt = (ox, oz, fx, fy, fz) => {
      let yaw = 0, pitch = 0;
      for (let k = 0; k < 8; k++) {
        A.look(ox, 0, oz, yaw, pitch);
        A.renderOnce(1 / 60);
        const v = new V(fx, fy, fz).project(E.camera);
        if (Math.abs(v.x) < 0.02 && Math.abs(v.y) < 0.02 && v.z < 1) break;
        yaw -= v.x * (E.camera.fov * Math.PI / 180) * E.camera.aspect * 0.5;
        pitch += v.y * (E.camera.fov * Math.PI / 180) * 0.5;
        pitch = Math.max(-1.3, Math.min(1.3, pitch));
      }
    };

    const zoneFixtures = new Set(A.world?.zones?.[zone]?._fixtures || []);
    const all = A.rig.fixtures.filter((f) => f.type === type && f.tube && f.level >= 0.5 && zoneFixtures.has(f));
    const out = [];
    const step = Math.max(1, Math.floor(all.length / 3));
    for (let i = 0, picked = 0; i < all.length && picked < 3; i += step) {
      const f = all[i];
      const p = f.group.position;
      const tm = f.tube.matrix.elements;
      const t = { x: tm[12], y: tm[13], z: tm[14] };
      const tp = f.target?.position, ry = f.group.rotation.y;
      let headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4];
      if (tp && Math.hypot(tp.x, tp.z) > 0.35) {
        const fx = tp.x * Math.cos(ry) + tp.z * Math.sin(ry);
        const fz = -tp.x * Math.sin(ry) + tp.z * Math.cos(ry);
        const face = Math.atan2(fx, fz);
        headings = [face, face + 0.5, face - 0.5, ...headings];
      }
      let placed = null;
      for (const a of headings) {
        const px = p.x + Math.sin(a) * Math.min(range, 3), pz = p.z + Math.cos(a) * Math.min(range, 3);
        const fl = A.collision?.sampleFloor?.(px, pz, t.y, 0);
        if (!fl) continue;
        const dy = t.y - (fl.y + EYE);
        if (Math.abs(dy) >= range * 0.94) continue;
        const leg = Math.sqrt(range * range - dy * dy);
        const ox = p.x + Math.sin(a) * leg, oz = p.z + Math.cos(a) * leg;
        if (A.collision?.pointBlocked?.(ox, oz)) continue;
        const fl2 = A.collision?.sampleFloor?.(ox, oz, t.y, 0);
        if (!fl2 || Math.abs(fl2.y - fl.y) > 0.5) continue;
        placed = { ox, oz }; break;
      }
      if (!placed) continue;
      aimAt(placed.ox, placed.oz, t.x, t.y, t.z);
      const v0 = new V(t.x, t.y, t.z).project(E.camera);
      if (Math.abs(v0.x) > 0.9 || Math.abs(v0.y) > 0.9) continue;

      const eye = A.player.position;
      const dist = Math.max(0.3, Math.hypot(t.x - eye.x, t.y - (eye.y + EYE), t.z - eye.z));
      const bs = f.tube.mesh?.geometry?.boundingSphere?.radius ?? 0.3;
      const r = Math.max(3, (bs / dist) * (H * 0.5) / Math.tan(E.camera.fov * Math.PI / 360));

      const per = {};
      for (const val of values) {
        f.def.tubeIntensity = val;              // shared FIXTURE_TYPES entry
        for (let s = 0; s < 30; s++) A.renderOnce(1 / 60);
        const v = new V(t.x, t.y, t.z).project(E.camera);
        const q = probe((v.x * 0.5 + 0.5) * W, (v.y * 0.5 + 0.5) * H, Math.min(r, H * 0.25));
        per[val] = q ? { ap: q.inMean, peak: q.inMax, ring: q.outMedian, delta: q.inMean - q.outMedian, clip: q.inClip } : null;
      }
      out.push({ zone, i, dist: +dist.toFixed(2), rpx: +r.toFixed(1), per });
      picked++;
    }
    return out;
  }, { zone, type: TYPE, values: VALUES, range: RANGE });
  rows.push(...zr);
  process.stdout.write(`  ${zone}: ${zr.length} samples\n`);
}

console.log(`\n${TYPE} — emissive level sweep at ${RANGE} m\n`);
console.log('sample'.padEnd(16) + VALUES.map((v) => `t=${v}`.padStart(24)).join(''));
console.log('─'.repeat(16 + VALUES.length * 24));
for (const r of rows) {
  let line = `${r.zone}#${r.i}`.padEnd(16);
  for (const v of VALUES) {
    const p = r.per[v];
    line += (p ? `${p.ap}/${p.ring} d${p.delta} c${p.clip}` : '—').padStart(24);
  }
  console.log(line);
}
console.log('\nmedian delta by value:');
for (const v of VALUES) {
  const ds = rows.map((r) => r.per[v]?.delta).filter((d) => d != null).sort((a, b) => a - b);
  const cs = rows.map((r) => r.per[v]?.clip).filter((d) => d != null).sort((a, b) => a - b);
  if (!ds.length) continue;
  console.log(`  ${String(v).padStart(5)}  delta ${String(ds[Math.floor(ds.length / 2)]).padStart(5)}`
    + `   aperture clipped ${(cs[Math.floor(cs.length / 2)] * 100).toFixed(1)}%`
    + (ds[Math.floor(ds.length / 2)] >= 24 ? '   <- clears 24' : ''));
}

await browser.close();
if (server) server.kill();
