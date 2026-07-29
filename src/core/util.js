// Shared math, deterministic noise and small helpers.
// Everything here is dependency-free so it can be used by the texture forge,
// the world builders and the audio engine alike.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const remap = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Frame-rate independent exponential smoothing. `rate` = how much remains after 1s. */
export const damp = (current, target, rate, dt) =>
  target + (current - target) * Math.exp(-rate * dt);

/** Mulberry32 — small, fast, seedable PRNG. */
export function makeRng(seed = 1) {
  let a = seed >>> 0 || 1;
  const fn = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (lo, hi) => lo + fn() * (hi - lo);
  fn.int = (lo, hi) => Math.floor(lo + fn() * (hi - lo + 1));
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length) % arr.length];
  fn.chance = (p) => fn() < p;
  fn.sign = () => (fn() < 0.5 ? -1 : 1);
  /** Gaussian-ish via sum of uniforms; cheap and bounded. */
  fn.gauss = () => (fn() + fn() + fn() - 1.5) * 0.9428;
  fn.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(fn() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return fn;
}

/** Deterministic hash -> [0,1). Used for per-tile / per-instance variation. */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Value / gradient noise. Tileable variants are used for texture synthesis so
// materials wrap cleanly; the non-tiling variants are used for world layout.
// ---------------------------------------------------------------------------

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** Simplex-style 2D gradient noise in [-1,1]. */
export function noise2(x, y, seed = 0) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  let n = 0;
  const corner = (cx, cy, gi, gj) => {
    let t0 = 0.5 - cx * cx - cy * cy;
    if (t0 <= 0) return 0;
    const g = GRAD2[Math.floor(hash3(gi, gj, seed) * 8) & 7];
    t0 *= t0;
    return t0 * t0 * (g[0] * cx + g[1] * cy);
  };
  n += corner(x0, y0, i, j);
  n += corner(x1, y1, i + i1, j + j1);
  n += corner(x2, y2, i + 1, j + 1);
  return clamp(n * 70, -1, 1);
}

/** Tileable value noise over a `period`-sized lattice, output [0,1]. */
export function tileNoise(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = (a, b) => hash3(((a % period) + period) % period, ((b % period) + period) % period, seed);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Tileable fBm, output [0,1]. */
export function tileFbm(x, y, period, octaves = 5, seed = 0, gain = 0.5, lac = 2) {
  let amp = 1, sum = 0, norm = 0, p = period, fx = x, fy = y;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(fx, fy, p, seed + o * 131);
    norm += amp;
    amp *= gain;
    fx *= lac; fy *= lac; p *= lac;
  }
  return sum / norm;
}

/** Tileable ridged noise — good for fissures, cracks, plaster. */
export function tileRidge(x, y, period, octaves = 4, seed = 0) {
  let amp = 1, sum = 0, norm = 0, p = period, fx = x, fy = y;
  for (let o = 0; o < octaves; o++) {
    const n = Math.abs(tileNoise(fx, fy, p, seed + o * 977) * 2 - 1);
    sum += amp * (1 - n);
    norm += amp;
    amp *= 0.5;
    fx *= 2; fy *= 2; p *= 2;
  }
  return sum / norm;
}

/** Tileable Worley/cellular. Returns {f1, f2, id}. Used for aggregate, tiles, fibre. */
export function tileWorley(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      const px = cx + hash3(wx, wy, seed);
      const py = cy + hash3(wx, wy, seed + 71);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; id = hash3(wx, wy, seed + 13); }
      else if (d < f2) { f2 = d; }
    }
  }
  return { f1, f2, id };
}

// ---------------------------------------------------------------------------

/** Cheap deterministic 1D wobble used for flicker curves and idle motion. */
export function wobble(t, seed = 0) {
  return (
    Math.sin(t * 1.31 + seed * 12.9898) * 0.5 +
    Math.sin(t * 2.73 + seed * 78.233) * 0.3 +
    Math.sin(t * 5.17 + seed * 37.719) * 0.2
  );
}

/** Rolling average with a fixed window; used by the perf monitor. */
export class Rolling {
  constructor(n = 60) { this.n = n; this.buf = []; this.sum = 0; }
  push(v) {
    this.buf.push(v); this.sum += v;
    if (this.buf.length > this.n) this.sum -= this.buf.shift();
    return this.avg;
  }
  get avg() { return this.buf.length ? this.sum / this.buf.length : 0; }
  percentile(p) {
    if (!this.buf.length) return 0;
    const s = [...this.buf].sort((a, b) => a - b);
    return s[clamp(Math.floor(p * s.length), 0, s.length - 1)];
  }
  clear() { this.buf.length = 0; this.sum = 0; }
}

/** Tiny event bus. */
export class Bus {
  constructor() { this.map = new Map(); }
  on(k, fn) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k).add(fn);
    return () => this.off(k, fn);
  }
  once(k, fn) {
    const un = this.on(k, (...a) => { un(); fn(...a); });
    return un;
  }
  off(k, fn) { this.map.get(k)?.delete(fn); }
  emit(k, ...a) {
    const s = this.map.get(k);
    if (!s) return;
    for (const fn of [...s]) {
      try { fn(...a); } catch (e) { console.error(`[bus:${k}]`, e); }
    }
  }
}

/** Format seconds as m:ss for the journal / tape UI. */
export const mmss = (s) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};
