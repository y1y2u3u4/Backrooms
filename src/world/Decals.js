import * as THREE from 'three';
import { merge, worldUV, vertexShade, whiteColors } from '../render/geo.js';
import { makeRng, clamp01, lerp, smoothstep, hash2, hash3, tileFbm, tileWorley, TAU } from '../core/util.js';

/**
 * Decals — the layer of evidence.
 *
 * Architecture: ONE procedurally-generated atlas holds every stamp (stains,
 * scuffs, mould, tape, footprints, arrows, hazard stripes, torn posters), so a
 * hundred decals in a chunk cost one draw call after the Builder merges them.
 * Per-instance variation comes from vertex colour (tint + strength), rotation,
 * scale and mirroring rather than from unique textures.
 *
 * They are real geometry, not camera-facing sprites: a quad lifted 6 mm off the
 * surface with a negative polygon offset, so it never z-fights and it takes the
 * scene lighting like the wall it is on. That matters — a decal that ignores
 * the light is the fastest way to make a room look like a texture demo.
 *
 * A second, separately-packed atlas renders TEXT to canvas, which is how the
 * building gets real signage: room numbers in the house format `7/L-nnn`, door
 * legends, warning notices, and the numbers stencilled on plant.
 */

const CELLS = 8;                 // atlas is CELLS x CELLS stamps
const CELL_PX = 128;

/** Stamp index by name. Position in the atlas is (i % CELLS, floor(i / CELLS)). */
export const STAMP = {
  waterRing: 0, waterBloom: 1, dripShort: 2, dripLong: 3,
  scuffArc: 4, scuffScrape: 5, tapeResidue: 6, tapeStrip: 7,
  mould: 8, mouldEdge: 9, rustRun: 10, grimeCorner: 11,
  handSmear: 12, splash: 13, puddle: 14, crack: 15,
  footL: 16, footR: 17, bootL: 18, bootR: 19,
  arrow: 20, arrowSmall: 21, sprayX: 22, sprayRing: 23,
  hazard: 24, hazardChevron: 25, tornPoster: 26, tornPaper: 27,
  dustEdge: 28, scratchSet: 29, dropletSet: 30, sootPlume: 31,
  plateBlank: 32, tally: 33, wearPath: 34, glue: 35,
};

// ---------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = (typeof document !== 'undefined')
    ? document.createElement('canvas')
    : { width: w, height: h, getContext: () => null };
  c.width = w; c.height = h;
  return c;
}

/** fBm helper in canvas space. */
function fbm(x, y, seed, oct = 4) {
  let a = 1, s = 0, n = 0, fx = x, fy = y;
  for (let i = 0; i < oct; i++) {
    s += a * valNoise(fx, fy, seed + i * 97);
    n += a; a *= 0.5; fx *= 2.03; fy *= 2.01;
  }
  return s / n;
}
function valNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed);
  const c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

// ---------------------------------------------------------------------------
// stamp painters — each returns [r, g, b, a] in 0..1 for uv in 0..1
// ---------------------------------------------------------------------------

const R2 = (u, v) => Math.hypot(u - 0.5, v - 0.5) * 2;

const PAINTERS = {
  /** Concentric tide marks — the signature of a leak that dried repeatedly. */
  [STAMP.waterRing]: (u, v, s) => {
    const w = fbm(u * 3.4, v * 3.4, s) * 0.22;
    const r = R2(u, v) + w - 0.11;
    if (r > 1) return null;
    let a = smoothstep(1.0, 0.62, r) * 0.55;
    // Tide lines.
    for (const [rr, k] of [[0.78, 0.05], [0.60, 0.045], [0.44, 0.035]]) {
      a += Math.exp(-((r - rr) ** 2) / (k * k)) * 0.55;
    }
    a *= 0.55 + fbm(u * 9, v * 9, s + 11) * 0.7;
    const dark = 0.30 + fbm(u * 5, v * 5, s + 3) * 0.22;
    return [dark * 1.15, dark * 1.02, dark * 0.78, clamp01(a)];
  },
  /** Diffuse ceiling bloom, brown centre fading to nothing. */
  [STAMP.waterBloom]: (u, v, s) => {
    const w = fbm(u * 2.2, v * 2.2, s) * 0.34;
    const r = R2(u, v) + w - 0.16;
    if (r > 1) return null;
    const a = smoothstep(1.0, 0.1, r) * (0.45 + fbm(u * 6, v * 6, s + 5) * 0.55);
    const t = clamp01(1 - r);
    return [lerp(0.45, 0.30, t), lerp(0.40, 0.23, t), lerp(0.28, 0.13, t), clamp01(a * 0.85)];
  },
  [STAMP.dripShort]: (u, v, s) => dripPainter(u, v, s, 3, 0.55),
  [STAMP.dripLong]: (u, v, s) => dripPainter(u, v, s, 5, 0.95),
  /** Arc of black rubber left by a trolley or a chair leg. */
  [STAMP.scuffArc]: (u, v, s) => {
    const cx = 0.5, cy = 1.25, rad = 0.85;
    const d = Math.abs(Math.hypot(u - cx, v - cy) - rad);
    const th = 0.02 + fbm(u * 10, v * 10, s) * 0.035;
    let a = smoothstep(th, 0, d) * (0.35 + fbm(u * 18, v * 6, s + 2) * 0.85);
    a *= smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
    if (a < 0.01) return null;
    return [0.10, 0.10, 0.11, clamp01(a * 0.8)];
  },
  [STAMP.scuffScrape]: (u, v, s) => {
    let a = 0;
    for (let i = 0; i < 5; i++) {
      const y0 = 0.2 + i * 0.15 + hash2(i, s) * 0.05;
      const d = Math.abs(v - y0 - Math.sin(u * 3 + i) * 0.02);
      a = Math.max(a, smoothstep(0.012, 0, d) * (0.4 + hash2(i * 3, s) * 0.6));
    }
    a *= smoothstep(0, 0.12, u) * smoothstep(1, 0.88, u) * (0.4 + fbm(u * 22, v * 8, s) * 0.9);
    if (a < 0.015) return null;
    return [0.13, 0.12, 0.12, clamp01(a * 0.7)];
  },
  /** Sun-yellowed adhesive where a notice used to be. */
  [STAMP.tapeResidue]: (u, v, s) => {
    const inR = u > 0.08 && u < 0.92 && v > 0.08 && v < 0.92;
    if (!inR) return null;
    const edge = Math.min(u - 0.08, 0.92 - u, v - 0.08, 0.92 - v);
    const n = fbm(u * 12, v * 12, s);
    let a = smoothstep(0.0, 0.05, edge) * (0.30 + n * 0.45);
    a *= 0.5 + fbm(u * 30, v * 30, s + 7) * 0.9;
    return [0.62, 0.55, 0.33, clamp01(a * 0.55)];
  },
  [STAMP.tapeStrip]: (u, v, s) => {
    if (v < 0.36 || v > 0.64) return null;
    const n = fbm(u * 16, v * 26, s);
    const edge = Math.min(v - 0.36, 0.64 - v);
    let a = smoothstep(0, 0.03, edge) * (0.55 + n * 0.5);
    a *= smoothstep(0, 0.04, u) * smoothstep(1, 0.96, u);
    return [0.72, 0.68, 0.55, clamp01(a * 0.7)];
  },
  /** Black spot mould — clusters, always denser toward one corner. */
  [STAMP.mould]: (u, v, s) => {
    const grad = clamp01(1 - Math.hypot(u - 0.25, v - 0.75) * 1.15);
    const w = tileWorley(u * 7, v * 7, 7, s);
    const spot = smoothstep(0.34, 0.02, w.f1) * (0.4 + w.id * 0.8);
    const n = fbm(u * 16, v * 16, s + 4);
    let a = spot * grad * (0.4 + n * 0.9);
    a += smoothstep(0.55, 1.0, grad) * n * 0.28;
    if (a < 0.02) return null;
    const g = 0.10 + n * 0.10;
    return [g * 0.9, g, g * 0.78, clamp01(a)];
  },
  [STAMP.mouldEdge]: (u, v, s) => {
    const grad = clamp01(1 - v * 1.7);
    const w = tileWorley(u * 9, v * 9, 9, s + 3);
    let a = smoothstep(0.30, 0.0, w.f1) * grad * (0.4 + fbm(u * 20, v * 20, s) * 1.0);
    if (a < 0.02) return null;
    return [0.11, 0.12, 0.10, clamp01(a)];
  },
  /** Rust bleeding down from a fixing. */
  [STAMP.rustRun]: (u, v, s) => {
    const cx = 0.5 + Math.sin(v * 4 + s) * 0.03;
    const wdt = lerp(0.05, 0.16, v) * (0.6 + fbm(u * 4, v * 12, s) * 0.9);
    const d = Math.abs(u - cx);
    let a = smoothstep(wdt, wdt * 0.2, d) * smoothstep(0.0, 0.12, v) * (1 - v * 0.35);
    a *= 0.35 + fbm(u * 24, v * 40, s + 9) * 1.0;
    if (v < 0.10) a = Math.max(a, smoothstep(0.10, 0.02, Math.hypot(u - 0.5, v - 0.06) * 3));
    if (a < 0.02) return null;
    return [0.42, 0.22, 0.09, clamp01(a * 0.85)];
  },
  /** Dirt wedge that collects where a floor meets a wall. */
  [STAMP.grimeCorner]: (u, v, s) => {
    const grad = clamp01(1 - v * 1.4) ** 1.6;
    const n = fbm(u * 6, v * 10, s);
    const a = grad * (0.35 + n * 0.75) * 0.85;
    if (a < 0.02) return null;
    return [0.14, 0.13, 0.11, clamp01(a)];
  },
  /** Greasy hand smear at door-push height. */
  [STAMP.handSmear]: (u, v, s) => {
    let a = 0;
    for (let i = 0; i < 4; i++) {
      const fx = 0.28 + i * 0.15, fy = 0.42 + Math.sin(i * 1.7 + s) * 0.10;
      const d = Math.hypot((u - fx) * 2.6, (v - fy) * 1.0);
      a = Math.max(a, smoothstep(0.55, 0.05, d) * (0.5 + hash2(i, s) * 0.5));
    }
    const palm = smoothstep(0.55, 0.05, Math.hypot((u - 0.5) * 1.6, (v - 0.75) * 1.9));
    a = Math.max(a, palm * 0.8);
    a *= 0.4 + fbm(u * 26, v * 26, s) * 0.9;
    if (a < 0.02) return null;
    return [0.22, 0.20, 0.17, clamp01(a * 0.45)];
  },
  [STAMP.splash]: (u, v, s) => {
    let a = 0;
    for (let i = 0; i < 26; i++) {
      const ang = hash2(i, s) * TAU;
      const rr = hash2(i + 40, s) ** 0.6 * 0.48;
      const px = 0.5 + Math.sin(ang) * rr, py = 0.5 + Math.cos(ang) * rr;
      const sz = lerp(0.10, 0.02, rr / 0.48) * (0.5 + hash2(i + 90, s));
      a = Math.max(a, smoothstep(sz, 0, Math.hypot(u - px, v - py)));
    }
    if (a < 0.03) return null;
    return [0.20, 0.19, 0.16, clamp01(a * 0.7)];
  },
  /** Shallow standing water — dark, with a bright rim. */
  [STAMP.puddle]: (u, v, s) => {
    const w = fbm(u * 2.6, v * 2.6, s) * 0.38;
    const r = R2(u, v) + w - 0.19;
    if (r > 1) return null;
    const body = smoothstep(1.0, 0.86, r);
    const rim = Math.exp(-((r - 0.92) ** 2) / 0.0022) * 0.5;
    const a = clamp01(body * 0.75 + rim);
    return [0.05, 0.055, 0.06, a];
  },
  [STAMP.crack]: (u, v, s) => {
    let a = 0;
    let x = 0.5, y = 0.0;
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      x += (hash2(i, s) - 0.5) * 0.06;
      y = t;
      const d = Math.hypot(u - x, v - y);
      a = Math.max(a, smoothstep(0.012 * (1 - t * 0.5), 0, d));
      if (i % 11 === 5) {
        for (let j = 0; j < 8; j++) {
          const bx = x + (hash2(i + j, s) - 0.5) * 0.22 * (j / 8);
          const by = y + (hash2(i + j + 50, s) - 0.5) * 0.16 * (j / 8);
          a = Math.max(a, smoothstep(0.007, 0, Math.hypot(u - bx, v - by)));
        }
      }
    }
    if (a < 0.02) return null;
    return [0.08, 0.08, 0.08, clamp01(a * 0.9)];
  },
  [STAMP.footL]: (u, v, s) => footPainter(u, v, s, -1, false),
  [STAMP.footR]: (u, v, s) => footPainter(u, v, s, 1, false),
  [STAMP.bootL]: (u, v, s) => footPainter(u, v, s, -1, true),
  [STAMP.bootR]: (u, v, s) => footPainter(u, v, s, 1, true),
  /** Stencilled directional arrow — the building's own wayfinding. */
  [STAMP.arrow]: (u, v, s) => arrowPainter(u, v, s, 0.24),
  [STAMP.arrowSmall]: (u, v, s) => arrowPainter(u, v, s, 0.16),
  /** Somebody's spray-painted cross. Not the building's. */
  [STAMP.sprayX]: (u, v, s) => {
    const d1 = Math.abs((u - 0.5) - (v - 0.5)) / Math.SQRT2;
    const d2 = Math.abs((u - 0.5) + (v - 0.5)) / Math.SQRT2;
    const within = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) < 0.36;
    let a = within ? Math.max(smoothstep(0.035, 0.004, d1), smoothstep(0.035, 0.004, d2)) : 0;
    a *= 0.55 + fbm(u * 30, v * 30, s) * 0.8;
    // Overspray halo.
    a += (within ? 1 : 0) * smoothstep(0.11, 0.03, Math.min(d1, d2)) * fbm(u * 55, v * 55, s + 3) * 0.30;
    if (a < 0.03) return null;
    return [0.62, 0.14, 0.10, clamp01(a * 0.95)];
  },
  [STAMP.sprayRing]: (u, v, s) => {
    const d = Math.abs(R2(u, v) - 0.66);
    let a = smoothstep(0.10, 0.01, d) * (0.5 + fbm(u * 28, v * 28, s) * 0.9);
    a += smoothstep(0.24, 0.06, d) * fbm(u * 50, v * 50, s + 5) * 0.22;
    if (a < 0.03) return null;
    return [0.60, 0.16, 0.11, clamp01(a * 0.9)];
  },
  /** Diagonal hazard stripes, drawn to tile horizontally. */
  [STAMP.hazard]: (u, v, s) => {
    const t = (u * 2 + v) % 1;
    const yellow = t < 0.5;
    const wear = 0.55 + fbm(u * 14, v * 14, s) * 0.75;
    const a = clamp01(wear) * 0.95;
    return yellow ? [0.66, 0.50, 0.09, a] : [0.09, 0.085, 0.08, a];
  },
  [STAMP.hazardChevron]: (u, v, s) => {
    const t = ((Math.abs(v - 0.5) * 1.6 + u * 2)) % 1;
    const yellow = t < 0.5;
    const a = clamp01(0.5 + fbm(u * 12, v * 12, s) * 0.8) * 0.95;
    return yellow ? [0.64, 0.48, 0.08, a] : [0.08, 0.08, 0.075, a];
  },
  /** What is left of a poster after somebody tore it off. */
  [STAMP.tornPoster]: (u, v, s) => {
    const tear = 0.30 + fbm(u * 5.5, 0.5, s) * 0.42;
    if (v > tear) return null;
    const edge = smoothstep(0.0, 0.03, tear - v);
    const paperN = fbm(u * 22, v * 22, s + 3);
    const ink = smoothstep(0.45, 0.55, fbm(u * 3.2, v * 3.2, s + 8));
    const base = 0.60 + paperN * 0.16;
    const col = lerp(base, 0.22, ink * 0.7);
    return [col * 1.02, col * 0.98, col * 0.85, clamp01(edge * (0.85 + paperN * 0.2))];
  },
  [STAMP.tornPaper]: (u, v, s) => {
    const l = 0.12 + fbm(0.5, v * 6, s) * 0.16;
    const r = 0.88 - fbm(1.5, v * 6, s + 2) * 0.16;
    const t = 0.10 + fbm(u * 6, 0.5, s + 4) * 0.12;
    const bo = 0.90 - fbm(u * 6, 1.5, s + 6) * 0.12;
    if (u < l || u > r || v < t || v > bo) return null;
    const n = fbm(u * 30, v * 30, s + 9);
    const c = 0.66 + n * 0.18;
    // A couple of printed rules so it reads as a form, not a blank.
    let ink = 0;
    for (let i = 1; i < 7; i++) ink = Math.max(ink, smoothstep(0.008, 0, Math.abs(v - (t + i * (bo - t) / 7))) * 0.55);
    return [lerp(c, 0.28, ink), lerp(c * 0.98, 0.28, ink), lerp(c * 0.84, 0.26, ink), 0.95];
  },
  /** Clean rectangle where something stood for twenty years. */
  [STAMP.dustEdge]: (u, v, s) => {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const a = (1 - smoothstep(0.0, 0.16, edge)) * (0.4 + fbm(u * 9, v * 9, s) * 0.6);
    if (a < 0.02) return null;
    return [0.30, 0.28, 0.24, clamp01(a * 0.5)];
  },
  [STAMP.scratchSet]: (u, v, s) => {
    let a = 0;
    for (let i = 0; i < 9; i++) {
      const ang = hash2(i, s) * 0.7 - 0.35;
      const off = hash2(i + 20, s);
      const d = Math.abs((u - off) * Math.cos(ang) - (v - 0.5) * Math.sin(ang));
      a = Math.max(a, smoothstep(0.004, 0, d) * (0.4 + hash2(i + 5, s) * 0.6));
    }
    if (a < 0.02) return null;
    return [0.55, 0.53, 0.48, clamp01(a * 0.5)];
  },
  [STAMP.dropletSet]: (u, v, s) => {
    let a = 0;
    for (let i = 0; i < 40; i++) {
      const px = hash2(i, s), py = hash2(i + 60, s);
      const sz = 0.006 + hash2(i + 120, s) * 0.02;
      a = Math.max(a, smoothstep(sz, sz * 0.3, Math.hypot(u - px, v - py)));
    }
    if (a < 0.03) return null;
    return [0.07, 0.075, 0.08, clamp01(a * 0.6)];
  },
  [STAMP.sootPlume]: (u, v, s) => {
    const grad = clamp01(1 - Math.abs(u - 0.5) * 2.2) * clamp01(1 - v);
    const a = grad ** 1.5 * (0.35 + fbm(u * 7, v * 5, s) * 0.8);
    if (a < 0.02) return null;
    return [0.06, 0.06, 0.06, clamp01(a * 0.8)];
  },
  /** Blank enamel plate — the base for a room number. */
  [STAMP.plateBlank]: (u, v, s) => {
    const n = fbm(u * 14, v * 14, s);
    const edge = Math.min(u, 1 - u, v, 1 - v);
    if (edge < 0.02) return null;
    return [0.30 + n * 0.06, 0.32 + n * 0.06, 0.31 + n * 0.05, 0.98];
  },
  /** Tally marks. Counting what, exactly. */
  [STAMP.tally]: (u, v, s) => {
    let a = 0;
    const groups = 5;
    for (let g = 0; g < groups; g++) {
      const gx = 0.08 + g * 0.185;
      for (let i = 0; i < 4; i++) {
        const x0 = gx + i * 0.028;
        const lean = (hash2(g * 7 + i, s) - 0.5) * 0.06;
        const d = Math.abs((u - x0) - (v - 0.5) * lean);
        a = Math.max(a, smoothstep(0.006, 0.001, d) * smoothstep(0.86, 0.80, v) * smoothstep(0.14, 0.20, v));
      }
      const d2 = Math.abs((v - 0.5) - (u - gx - 0.05) * 1.5);
      const inX = u > gx - 0.03 && u < gx + 0.13;
      if (inX) a = Math.max(a, smoothstep(0.008, 0.001, d2));
    }
    a *= 0.6 + fbm(u * 40, v * 40, s) * 0.7;
    if (a < 0.03) return null;
    return [0.12, 0.11, 0.10, clamp01(a * 0.9)];
  },
  /** Polished traffic path — brighter, not darker. */
  [STAMP.wearPath]: (u, v, s) => {
    const w = 0.30 + fbm(0.5, v * 3, s) * 0.14;
    const d = Math.abs(u - 0.5 - Math.sin(v * 2.4 + s) * 0.05);
    const a = smoothstep(w, w * 0.2, d) * (0.4 + fbm(u * 8, v * 8, s + 2) * 0.6);
    if (a < 0.02) return null;
    return [0.55, 0.52, 0.45, clamp01(a * 0.30)];
  },
  [STAMP.glue]: (u, v, s) => {
    const n = fbm(u * 8, v * 8, s);
    const a = smoothstep(0.42, 0.72, n) * 0.7;
    if (a < 0.03) return null;
    return [0.50, 0.44, 0.28, clamp01(a * 0.6)];
  },
};

function dripPainter(u, v, s, count, len) {
  let a = 0;
  for (let i = 0; i < count; i++) {
    const cx = (i + 0.5) / count + (hash2(i, s) - 0.5) * 0.12;
    const l = len * (0.4 + hash2(i + 30, s) * 0.9);
    if (v > l) continue;
    const w = lerp(0.030, 0.008, v / l) * (0.6 + hash2(i + 7, s) * 0.8);
    const d = Math.abs(u - cx - Math.sin(v * 7 + i) * 0.008);
    let aa = smoothstep(w, 0, d) * smoothstep(l, l * 0.75, v);
    // A bead at the end of the run.
    aa = Math.max(aa, smoothstep(0.022, 0.004, Math.hypot(u - cx, (v - l * 0.97) * 1.4)) * 0.9);
    a = Math.max(a, aa);
  }
  const head = smoothstep(0.10, 0.0, v) * (0.4 + fbm(u * 8, v * 8, s) * 0.7);
  a = Math.max(a, head * 0.7);
  a *= 0.5 + fbm(u * 20, v * 34, s + 2) * 0.8;
  if (a < 0.02) return null;
  return [0.26, 0.23, 0.17, clamp01(a * 0.9)];
}

function footPainter(u, v, s, side, boot) {
  const uu = side < 0 ? 1 - u : u;
  // Ball of the foot.
  const ball = smoothstep(0.30, 0.02, Math.hypot((uu - 0.46) * 2.5, (v - 0.34) * 1.55));
  // Heel.
  const heel = smoothstep(0.26, 0.02, Math.hypot((uu - 0.52) * 2.9, (v - 0.78) * 2.1));
  let a = Math.max(ball, heel * 0.95);
  if (boot) {
    const tread = ((v * 16) % 1 < 0.55) ? 1 : 0.35;
    a *= tread;
  } else {
    for (let i = 0; i < 5; i++) {
      const tx = 0.30 + i * 0.085, ty = 0.16 - i * 0.012;
      a = Math.max(a, smoothstep(0.055 - i * 0.006, 0.0, Math.hypot(uu - tx, v - ty)) * 0.85);
    }
  }
  a *= 0.55 + fbm(u * 22, v * 22, s) * 0.75;
  if (a < 0.03) return null;
  return [0.16, 0.17, 0.17, clamp01(a * 0.7)];
}

function arrowPainter(u, v, s, thick) {
  const shaftHalf = thick * 0.5;
  const headStart = 0.42;
  let inside = false;
  if (v > headStart) {
    inside = Math.abs(u - 0.5) < shaftHalf && v < 0.94;
  } else {
    const t = clamp01((headStart - v) / headStart);
    inside = Math.abs(u - 0.5) < lerp(thick * 1.5, 0.0, t) && v > 0.06;
  }
  if (!inside) return null;
  const n = fbm(u * 20, v * 20, s);
  const a = 0.85 + n * 0.15;
  return [0.72, 0.70, 0.62, clamp01(a)];
}

// ---------------------------------------------------------------------------

export class Decals {
  /** @param {import('../render/Materials.js').MaterialLibrary} materials */
  constructor(materials, { seed = 4242 } = {}) {
    this.materials = materials;
    this.seed = seed;
    this._built = false;
    this._signCursor = { x: 2, y: 2, rowH: 0 };
    this._signCache = new Map();
  }

  build() {
    if (this._built) return this;
    this._built = true;
    const S = CELLS * CELL_PX;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    if (!ctx) return this;
    const img = ctx.createImageData(S, S);
    const d = img.data;
    for (let cy = 0; cy < CELLS; cy++) {
      for (let cx = 0; cx < CELLS; cx++) {
        const idx = cy * CELLS + cx;
        const painter = PAINTERS[idx];
        const seed = this.seed + idx * 131;
        for (let py = 0; py < CELL_PX; py++) {
          for (let px = 0; px < CELL_PX; px++) {
            const u = (px + 0.5) / CELL_PX, v = (py + 0.5) / CELL_PX;
            const o = ((cy * CELL_PX + py) * S + (cx * CELL_PX + px)) * 4;
            const res = painter ? painter(u, v, seed) : null;
            if (!res) { d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 0; continue; }
            d[o] = Math.round(clamp01(res[0]) * 255);
            d[o + 1] = Math.round(clamp01(res[1]) * 255);
            d[o + 2] = Math.round(clamp01(res[2]) * 255);
            d[o + 3] = Math.round(clamp01(res[3]) * 255);
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.atlas = tex;

    this.material = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, depthWrite: false, roughness: 0.94, metalness: 0,
      vertexColors: true, side: THREE.FrontSide, alphaTest: 0.012,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
      envMapIntensity: 0.2, fog: true,
    });
    this.material.name = 'decals';
    this.material.envMap = this.materials?.envMap ?? null;

    // ---- sign atlas ------------------------------------------------------
    const SC = makeCanvas(1024, 1024);
    const sctx = SC.getContext('2d');
    sctx.clearRect(0, 0, 1024, 1024);
    this._signCanvas = SC;
    this._signCtx = sctx;
    const stex = new THREE.CanvasTexture(SC);
    stex.colorSpace = THREE.SRGBColorSpace;
    stex.anisotropy = 8;
    stex.wrapS = stex.wrapT = THREE.ClampToEdgeWrapping;
    this.signTexture = stex;
    this.signMaterial = new THREE.MeshStandardMaterial({
      map: stex, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.05,
      vertexColors: true, alphaTest: 0.02,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
      envMapIntensity: 0.5, fog: true,
    });
    this.signMaterial.name = 'signs';
    this.signMaterial.envMap = this.materials?.envMap ?? null;
    return this;
  }

  /** Atlas UV rect for a stamp index. */
  uvRect(stamp) {
    const cx = stamp % CELLS, cy = Math.floor(stamp / CELLS);
    const k = 1 / CELLS, e = 0.5 / (CELLS * CELL_PX);
    return [cx * k + e, 1 - (cy + 1) * k + e, (cx + 1) * k - e, 1 - cy * k - e];
  }

  // -- text ---------------------------------------------------------------

  /**
   * Render a line (or lines) of text into the sign atlas and return its UV rect.
   * The Annex uses one typeface everywhere; `style` picks the plate treatment.
   */
  text(lines, {
    w = 256, h = 96, style = 'plate', size = 46, tracking = 2, colour = '#e8e5d8',
    bg = null, align = 'center', font = 'Helvetica Neue, Helvetica, Arial, sans-serif',
    weight = '600', rule = false, distress = 0.25,
  } = {}) {
    this.build();
    const key = JSON.stringify([lines, w, h, style, size, colour, bg, align, weight, rule]);
    if (this._signCache.has(key)) return this._signCache.get(key);
    const ctx = this._signCtx;
    if (!ctx) return [0, 0, 1, 1];

    // Row-packing cursor.
    const cur = this._signCursor;
    if (cur.x + w + 2 > 1024) { cur.x = 2; cur.y += cur.rowH + 2; cur.rowH = 0; }
    if (cur.y + h + 2 > 1024) { cur.x = 2; cur.y = 2; cur.rowH = 0; }  // wrap; oldest gets overwritten
    const x0 = cur.x, y0 = cur.y;
    cur.x += w + 2;
    cur.rowH = Math.max(cur.rowH, h);

    ctx.save();
    ctx.clearRect(x0, y0, w, h);
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    const styles = {
      plate: { bg: bg ?? '#4b4f4e', fg: colour, border: '#2c2f2e' },
      enamel: { bg: bg ?? '#20303a', fg: '#e6e9e4', border: '#0e161c' },
      paper: { bg: bg ?? '#cfc7ab', fg: '#2a2620', border: null },
      warning: { bg: bg ?? '#b89327', fg: '#17150e', border: '#17150e' },
      stencil: { bg: null, fg: colour, border: null },
      screen: { bg: bg ?? '#0a1410', fg: '#8fffb6', border: null },
    };
    const st = styles[style] || styles.plate;
    if (st.bg) { ctx.fillStyle = st.bg; ctx.fillRect(x0, y0, w, h); }
    if (st.border) {
      ctx.strokeStyle = st.border; ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 4.5, y0 + 4.5, w - 9, h - 9);
    }
    const arr = Array.isArray(lines) ? lines : [lines];
    ctx.fillStyle = st.fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
    const tx = align === 'left' ? x0 + 14 : align === 'right' ? x0 + w - 14 : x0 + w / 2;
    const lh = size * 1.14;
    const total = arr.length * lh;
    arr.forEach((line, i) => {
      const fs = i === 0 ? size : size * 0.78;
      ctx.font = `${weight} ${fs}px ${font}`;
      const ty = y0 + h / 2 - total / 2 + lh * (i + 0.5);
      if (tracking > 0) {
        // Manual tracking; canvas letterSpacing is not universally available.
        const chars = [...line];
        const widths = chars.map((ch) => ctx.measureText(ch).width);
        const totalW = widths.reduce((s, v) => s + v, 0) + tracking * (chars.length - 1);
        let cx2 = align === 'left' ? x0 + 14 : align === 'right' ? x0 + w - 14 - totalW : x0 + w / 2 - totalW / 2;
        const save = ctx.textAlign; ctx.textAlign = 'left';
        chars.forEach((ch, ci) => { ctx.fillText(ch, cx2, ty); cx2 += widths[ci] + tracking; });
        ctx.textAlign = save;
      } else {
        ctx.fillText(line, tx, ty);
      }
    });
    if (rule) {
      ctx.strokeStyle = st.fg; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 + 16, y0 + h * 0.62); ctx.lineTo(x0 + w - 16, y0 + h * 0.62); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Distress: knock holes in the paint so nothing looks freshly printed.
    if (distress > 0) {
      const rng = makeRng(hash2(x0, y0) * 1e6 | 0);
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < Math.round(distress * 90); i++) {
        ctx.globalAlpha = rng.range(0.10, 0.5);
        const rx = x0 + rng() * w, ry = y0 + rng() * h, rr = rng.range(0.6, 3.4);
        ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    this.signTexture.needsUpdate = true;
    const e = 0.5 / 1024;
    const rect = [x0 / 1024 + e, 1 - (y0 + h) / 1024 + e, (x0 + w) / 1024 - e, 1 - y0 / 1024 - e];
    this._signCache.set(key, rect);
    return rect;
  }

  // -- geometry -----------------------------------------------------------

  /**
   * A decal quad.
   * `face` is one of '+x','-x','+z','-z','up','down' — the surface normal.
   * `x,y,z` is the point ON the surface; the quad is lifted along the normal.
   */
  quad(b, {
    stamp = STAMP.waterRing, face = '+z', x = 0, y = 0, z = 0, w = 1, h = 1,
    rot = 0, lift = 0.007, tint = 0xffffff, strength = 1, flipU = false,
    uvRect = null, key = 'decal', material = null, seg = 1,
  } = {}) {
    this.build();
    const g = new THREE.PlaneGeometry(w, h, seg, seg);
    const uv = g.attributes.uv;
    const r = uvRect || this.uvRect(stamp);
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i);
      if (flipU) u = 1 - u;
      uv.setXY(i, lerp(r[0], r[2], u), lerp(r[1], r[3], uv.getY(i)));
    }
    uv.needsUpdate = true;
    if (rot) g.rotateZ(rot);
    const n = FACE_N[face] || FACE_N['+z'];
    if (face === 'up') g.rotateX(-Math.PI / 2);
    else if (face === 'down') g.rotateX(Math.PI / 2);
    else if (face === '+x') g.rotateY(Math.PI / 2);
    else if (face === '-x') g.rotateY(-Math.PI / 2);
    else if (face === '-z') g.rotateY(Math.PI);
    g.translate(x + n[0] * lift, y + n[1] * lift, z + n[2] * lift);

    const c = new THREE.Color(tint).multiplyScalar(1);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      col[i * 3] = c.r * strength; col[i * 3 + 1] = c.g * strength; col[i * 3 + 2] = c.b * strength;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    b.add(key, g, () => (material || (key === 'sign' ? this.signMaterial : this.material)));
    return g;
  }

  /** Text quad — same as `quad` but into the sign atlas. */
  label(b, lines, opts = {}) {
    const rect = this.text(lines, opts);
    return this.quad(b, { ...opts, uvRect: rect, key: 'sign', stamp: STAMP.plateBlank });
  }

  /**
   * A room-number plate: a real chamfered plate in the sign material, with the
   * house number format `7/L-nnn` and an optional room name under it.
   */
  roomPlate(b, x, y, z, yaw, number, name = null, opts = {}) {
    const { w = 0.30, h = name ? 0.13 : 0.095, style = 'plate' } = opts;
    const face = yawFace(yaw);
    const n = FACE_N[face];
    this.label(b, name ? [number, name] : [number], {
      w: 256, h: name ? 112 : 84, size: name ? 40 : 46, style,
      face, x, y, z, w, h, lift: 0.012, strength: 1,
    });
    // The plate itself, so it has thickness and a shadow.
    const plate = new THREE.BoxGeometry(w + 0.014, h + 0.014, 0.006);
    if (face === '+x') plate.rotateY(Math.PI / 2);
    else if (face === '-x') plate.rotateY(-Math.PI / 2);
    else if (face === '-z') plate.rotateY(Math.PI);
    plate.translate(x + n[0] * 0.004, y + n[1] * 0.004, z + n[2] * 0.004);
    worldUV(plate, 0.4);
    b.add('signPlate', plate);
    return { number, name };
  }

  /** Stencilled hazard stripe run along X or Z, e.g. at a level change. */
  hazardRun(b, x, y, z, len, { face = 'up', axis = 'x', h = 0.22, tile = 0.45, chevron = false, strength = 1 } = {}) {
    const n = Math.max(1, Math.round(len / tile));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const o = -len / 2 + (i + 0.5) * step;
      this.quad(b, {
        stamp: chevron ? STAMP.hazardChevron : STAMP.hazard,
        face, w: step, h,
        x: x + (axis === 'x' ? o : 0), y, z: z + (axis === 'z' ? o : 0),
        rot: axis === 'z' && face === 'up' ? Math.PI / 2 : 0,
        strength, lift: 0.006,
      });
    }
  }

  /**
   * A trail of footprints along a polyline. They fade out — whoever it was
   * walked out of the water and kept going until their soles dried.
   */
  footprints(b, points, { seed = 1, stride = 0.62, spread = 0.16, fade = 1, boot = false, y = 0.002, strength = 1 } = {}) {
    const rng = makeRng(seed);
    let carry = 0, index = 0;
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      const ux = dx / len, uz = dz / len;
      const yaw = Math.atan2(ux, uz);
      for (let d = carry; d < len; d += stride) {
        const t = d / len;
        const side = index % 2 === 0 ? 1 : -1;
        const px = ax + dx * t - uz * side * spread * 0.5;
        const pz = az + dz * t + ux * side * spread * 0.5;
        const frac = clamp01(1 - (index * stride) / (fade * 9));
        if (frac <= 0.02) { index++; continue; }
        this.quad(b, {
          stamp: boot ? (side > 0 ? STAMP.bootR : STAMP.bootL) : (side > 0 ? STAMP.footR : STAMP.footL),
          face: 'up', x: px, y, z: pz, w: 0.16, h: 0.30,
          rot: -yaw + rng.range(-0.10, 0.10),
          strength: strength * frac, lift: 0.005,
        });
        index++;
      }
      carry = (carry - len) % stride;
      if (carry < 0) carry += stride;
    }
  }

  /**
   * Damp gradient at the base of a wall run: grime wedge, a couple of drips and
   * some mould, all correlated with `amount` so damage reads as one cause.
   */
  wallBase(b, ax, az, bx, bz, { amount = 0.5, seed = 1, face = null, y = 0, height = 0.55 } = {}) {
    const rng = makeRng(seed);
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.4) return;
    const yaw = Math.atan2(bx - ax, bz - az);
    const f = face || yawFace(yaw + Math.PI / 2);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
      const a = amount * rng.range(0.55, 1.2);
      if (a < 0.12) continue;
      this.quad(b, {
        stamp: STAMP.grimeCorner, face: f, x: px, y: y + height / 2, z: pz,
        w: len / n * 1.05, h: height, strength: clamp01(a * 0.9), lift: 0.006,
      });
      if (rng() < amount * 0.55) {
        this.quad(b, {
          stamp: rng.chance(0.5) ? STAMP.mouldEdge : STAMP.mould, face: f,
          x: px + rng.range(-0.4, 0.4), y: y + rng.range(0.15, 0.85), z: pz,
          w: rng.range(0.4, 0.9), h: rng.range(0.4, 1.0),
          strength: clamp01(a), lift: 0.007, flipU: rng.chance(0.5),
        });
      }
    }
  }

  /** A leak: a bloom on the ceiling, runs down the wall, a puddle beneath. */
  leak(b, x, ceilY, z, { seed = 1, amount = 0.8, face = '+z', wallX = null, wallZ = null, floorY = 0 } = {}) {
    const rng = makeRng(seed);
    this.quad(b, {
      stamp: STAMP.waterBloom, face: 'down', x, y: ceilY, z,
      w: rng.range(0.9, 1.9), h: rng.range(0.9, 1.9), rot: rng() * TAU,
      strength: amount, lift: 0.008,
    });
    if (wallX !== null || wallZ !== null) {
      const wx = wallX ?? x, wz = wallZ ?? z;
      const hh = rng.range(1.0, 1.8);
      this.quad(b, {
        stamp: STAMP.dripLong, face, x: wx, y: ceilY - hh / 2 - 0.02, z: wz,
        w: rng.range(0.5, 1.0), h: hh, strength: amount, lift: 0.007,
      });
    }
    this.quad(b, {
      stamp: STAMP.puddle, face: 'up', x: x + rng.range(-0.3, 0.3), y: floorY, z: z + rng.range(-0.3, 0.3),
      w: rng.range(0.8, 1.7), h: rng.range(0.8, 1.7), rot: rng() * TAU,
      strength: amount * 0.9, lift: 0.004,
    });
    this.quad(b, {
      stamp: STAMP.dropletSet, face: 'up', x, y: floorY, z,
      w: 2.2, h: 2.2, rot: rng() * TAU, strength: amount * 0.5, lift: 0.003,
    });
  }
}

const FACE_N = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0], '+z': [0, 0, 1], '-z': [0, 0, -1],
  up: [0, 1, 0], down: [0, -1, 0],
};

/** Nearest cardinal face for a yaw (used when placing on an arbitrary wall). */
export function yawFace(yaw) {
  const a = ((yaw % TAU) + TAU) % TAU;
  if (a < Math.PI / 4 || a >= Math.PI * 7 / 4) return '+z';
  if (a < Math.PI * 3 / 4) return '+x';
  if (a < Math.PI * 5 / 4) return '-z';
  return '-x';
}

/** Convenience: the standard Annex room number for a zone letter and index. */
export function roomNumber(letter, n) {
  return `7/${letter}-${String(n).padStart(3, '0')}`;
}

export default Decals;
