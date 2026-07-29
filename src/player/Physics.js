import * as THREE from 'three';

/**
 * CollisionWorld — a broadphase-hashed set of axis-aligned boxes plus floor
 * rectangles.
 *
 * The Annex is orthogonal architecture, so an AABB soup is both exact and
 * extremely cheap; there is no need for a general mesh collider. Builders push
 * boxes as they emit geometry, which keeps collision and visuals in lockstep.
 * Anything non-orthogonal (angled ramps, the Stack's spiral) registers as a
 * stepped stack of boxes.
 */

const CELL = 4;
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.floors = [];
    this.hash = new Map();
    this.floorHash = new Map();
    this.version = 0;
  }

  clear() {
    this.boxes.length = 0;
    this.floors.length = 0;
    this.hash.clear();
    this.floorHash.clear();
    this.version++;
  }

  _insert(map, item, minX, minZ, maxX, maxZ) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        let arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        arr.push(item);
      }
    }
  }

  /**
   * @param {number[]} min [x,y,z]
   * @param {number[]} max [x,y,z]
   * @param {object} [meta] {tag, id, solid:boolean, blocksSight:boolean}
   */
  addBox(min, max, meta = {}) {
    const b = {
      minX: Math.min(min[0], max[0]), minY: Math.min(min[1], max[1]), minZ: Math.min(min[2], max[2]),
      maxX: Math.max(min[0], max[0]), maxY: Math.max(min[1], max[1]), maxZ: Math.max(min[2], max[2]),
      solid: meta.solid !== false,
      blocksSight: meta.blocksSight !== false,
      tag: meta.tag || 'world',
      id: meta.id ?? this.boxes.length,
      enabled: true,
    };
    this.boxes.push(b);
    this._insert(this.hash, b, b.minX, b.minZ, b.maxX, b.maxZ);
    return b;
  }

  /** Convenience: box from a centre + size. */
  addBoxAt(cx, cy, cz, sx, sy, sz, meta) {
    return this.addBox([cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], meta);
  }

  /** Walkable surface. @param rect [minX, minZ, maxX, maxZ] */
  addFloor(rect, y, meta = {}) {
    const f = {
      minX: rect[0], minZ: rect[1], maxX: rect[2], maxZ: rect[3], y,
      surface: meta.surface || 'carpet',
      water: meta.water || 0,
      tag: meta.tag || 'floor',
    };
    this.floors.push(f);
    this._insert(this.floorHash, f, f.minX, f.minZ, f.maxX, f.maxZ);
    return f;
  }

  _query(map, x, z, out) {
    out.length = 0;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const arr = map.get(key(cx + dx, cz + dz));
        if (!arr) continue;
        for (const b of arr) if (!out.includes(b)) out.push(b);
      }
    }
    return out;
  }

  /** Highest floor at (x,z) at or below `fromY + tolerance`. */
  sampleFloor(x, z, fromY, tolerance = 0.6) {
    const cands = this._query(this.floorHash, x, z, _floorScratch);
    let best = null;
    for (const f of cands) {
      if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
      if (f.y > fromY + tolerance) continue;
      if (!best || f.y > best.y) best = f;
    }
    return best;
  }

  /**
   * Push a vertical capsule out of every overlapping box.
   * @returns {{x:number,z:number,hit:boolean,normalX:number,normalZ:number}}
   */
  resolveCapsule(x, y, z, radius, height) {
    const cands = this._query(this.hash, x, z, _boxScratch);
    let hit = false, nx = 0, nz = 0;
    const top = y + height, bottom = y + 0.06;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of cands) {
        if (!b.enabled || !b.solid) continue;
        if (b.maxY <= bottom || b.minY >= top) continue;
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let dx = x - cx, dz = z - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-5) {
          // Deep inside: escape along the shallowest axis.
          const toLeft = x - b.minX, toRight = b.maxX - x;
          const toBack = z - b.minZ, toFront = b.maxZ - z;
          const m = Math.min(toLeft, toRight, toBack, toFront);
          dx = m === toLeft ? -1 : m === toRight ? 1 : 0;
          dz = m === toBack ? -1 : m === toFront ? 1 : 0;
          d = 0.0001;
        } else { dx /= d; dz /= d; }
        const push = radius - d;
        x += dx * push; z += dz * push;
        nx += dx; nz += dz;
        hit = true; moved = true;
      }
      if (!moved) break;
    }
    const nl = Math.hypot(nx, nz);
    if (nl > 0) { nx /= nl; nz /= nl; }
    return { x, z, hit, normalX: nx, normalZ: nz };
  }

  /** Ceiling height above (x,z) for a body standing at y. */
  ceilingAbove(x, z, y, radius = 0.28) {
    const cands = this._query(this.hash, x, z, _boxScratch);
    let ceil = Infinity;
    for (const b of cands) {
      if (!b.enabled || !b.solid) continue;
      if (b.minY < y + 0.1) continue;
      if (x + radius < b.minX || x - radius > b.maxX) continue;
      if (z + radius < b.minZ || z - radius > b.maxZ) continue;
      if (b.minY < ceil) ceil = b.minY;
    }
    return ceil;
  }

  /** Segment-vs-box occlusion test; used for audio occlusion and entity sight. */
  segmentBlocked(ax, ay, az, bx, by, bz, ignoreTag = null) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return false;
    const steps = Math.min(48, Math.max(4, Math.ceil(len / 1.2)));
    const seen = new Set();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = ax + dx * t, pz = az + dz * t;
      const cands = this._query(this.hash, px, pz, _boxScratch);
      for (const b of cands) {
        if (!b.enabled || !b.blocksSight) continue;
        if (ignoreTag && b.tag === ignoreTag) continue;
        if (seen.has(b)) continue;
        seen.add(b);
        if (rayBox(ax, ay, az, dx, dy, dz, b, len)) return true;
      }
    }
    return false;
  }

  /** Fraction of the segment obstructed, 0..1 — a soft occlusion estimate. */
  occlusion(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return 0;
    let blocked = 0;
    const N = 6;
    // Three offset probes: a single ray through a doorway reads as fully open
    // when it is in fact a 0.9 m slot in a 4 m wall.
    const offs = [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.5], [0, -0.5]];
    for (const [ox, oy] of offs) {
      if (this.segmentBlocked(ax + ox, ay + oy, az, bx + ox, by + oy, bz)) blocked++;
    }
    return blocked / offs.length;
  }
}

const _boxScratch = [];
const _floorScratch = [];

function rayBox(ox, oy, oz, dx, dy, dz, b, maxLen) {
  let tmin = 0, tmax = 1;
  const slab = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-8) return o >= lo && o <= hi;
    let t0 = (lo - o) / d, t1 = (hi - o) / d;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
    tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
    return tmax >= tmin;
  };
  if (!slab(ox, dx, b.minX, b.maxX)) return false;
  if (!slab(oy, dy, b.minY, b.maxY)) return false;
  if (!slab(oz, dz, b.minZ, b.maxZ)) return false;
  return tmax >= tmin && tmin <= 1;
}

export default CollisionWorld;
