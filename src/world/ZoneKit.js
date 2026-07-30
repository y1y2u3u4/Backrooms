import * as THREE from 'three';
import { Builder } from './Builder.js';
import { attachPalette } from './Palette.js';
import { KIT } from './Kit.js';
import { box, cyl, lathe, merge, worldUV, vertexShade, whiteColors, pipeRun, weather, plane } from '../render/geo.js';
import { makeLightCone } from '../render/Lighting.js';
import { makeRng, clamp01, lerp, smoothstep, hash2, TAU } from '../core/util.js';

/**
 * ZoneKit — the plumbing every zone shares.
 *
 *  * ZONE ORIGINS. Each zone is authored in its own local coordinate space with
 *    the origin at a sensible datum, and placed into a distinct patch of world
 *    space by a Builder subclass that offsets geometry, colliders, objects and
 *    light fixtures on the way in. Zone code therefore never carries an offset
 *    around, and two zones can be built by two different rules without ever
 *    colliding.
 *
 *  * STRUCTURE. Stairs, gantries, handrails, rolled-steel sections, plinths and
 *    bulkheads — the load-bearing vocabulary that makes Service, Plant, Cistern
 *    and the Stack read as one building rather than four art styles.
 *
 *  * FIXTURES. Bulkhead, high-bay, pendant and emergency lights, each a real
 *    housing plus a rig entry, matching the calibration in Lighting.js.
 */

// ---------------------------------------------------------------------------
// zone placement
// ---------------------------------------------------------------------------

/**
 * Where each zone lives in world space. Zones are 400 m apart, which is well
 * beyond the camera's far plane and the fog's useful range, so nothing from one
 * zone is ever visible in another even though they share one collision world.
 */
export const ZONE_ORIGIN = {
  intake: [0, 0, 0],
  service: [400, 0, 0],
  cistern: [800, 0, 0],
  residence: [0, 0, 400],
  plant: [400, 0, 400],
  duct: [800, 0, 400],
  stack: [0, 0, 800],
  safe: [400, 0, 800],
};

/** Builder that transparently offsets everything into the zone's world patch. */
export class ZoneBuilder extends Builder {
  constructor(materials, collision, { name = 'chunk', origin = [0, 0, 0] } = {}) {
    super(materials, collision, { name });
    this.origin = origin;
    this._records = { boxes: [], floors: [] };
  }
  add(key, geo, factory) {
    const list = Array.isArray(geo) ? geo : [geo];
    const [ox, oy, oz] = this.origin;
    for (const g of list) if (g) g.translate(ox, oy, oz);
    return super.add(key, list, factory);
  }
  addCollider(min, max, meta) {
    const [ox, oy, oz] = this.origin;
    const b = super.addCollider(
      [min[0] + ox, min[1] + oy, min[2] + oz],
      [max[0] + ox, max[1] + oy, max[2] + oz], meta);
    this._records.boxes.push(b);
    return b;
  }
  addColliderAt(cx, cy, cz, sx, sy, sz, meta) {
    const [ox, oy, oz] = this.origin;
    const b = this.collision.addBoxAt(cx + ox, cy + oy, cz + oz, sx, sy, sz, meta);
    this._records.boxes.push(b);
    return b;
  }
  addFloor(rect, y, meta) {
    const [ox, oy, oz] = this.origin;
    const f = this.collision.addFloor(
      [rect[0] + ox, rect[1] + oz, rect[2] + ox, rect[3] + oz], y + oy, meta);
    this._records.floors.push(f);
    return f;
  }
  addObject(obj) {
    const [ox, oy, oz] = this.origin;
    obj.position.x += ox; obj.position.y += oy; obj.position.z += oz;
    return super.addObject(obj);
  }
}

/** Rig proxy that offsets fixture positions into the zone's world patch. */
export function rigProxy(rig, origin, sink) {
  const [ox, oy, oz] = origin;
  return {
    real: rig,
    add(opts) {
      const p = opts.position;
      const f = rig.add({ ...opts, position: [p[0] + ox, p[1] + oy, p[2] + oz] });
      sink?.push(f);
      return f;
    },
    setCircuit: (...a) => rig.setCircuit(...a),
  };
}

/** Make `n` chunk builders for a zone, palette attached. */
export function makeBuilders(ctx, zoneId, names) {
  const origin = ZONE_ORIGIN[zoneId] || [0, 0, 0];
  return names.map((n) => attachPalette(
    new ZoneBuilder(ctx.materials, ctx.collision, { name: `${zoneId}:${n}`, origin }), ctx.palette));
}

/** Detach every collider a zone registered (used when streaming out). */
export function detachColliders(collision, builders) {
  const boxes = new Set(), floors = new Set();
  for (const b of builders) {
    for (const x of b._records?.boxes || []) boxes.add(x);
    for (const x of b._records?.floors || []) floors.add(x);
  }
  if (!boxes.size && !floors.size) return;
  collision.boxes = collision.boxes.filter((x) => !boxes.has(x));
  collision.floors = collision.floors.filter((x) => !floors.has(x));
  for (const [k, arr] of collision.hash) {
    const f = arr.filter((x) => !boxes.has(x));
    if (f.length) collision.hash.set(k, f); else collision.hash.delete(k);
  }
  for (const [k, arr] of collision.floorHash) {
    const f = arr.filter((x) => !floors.has(x));
    if (f.length) collision.floorHash.set(k, f); else collision.floorHash.delete(k);
  }
  collision.version++;
}

// ---------------------------------------------------------------------------
// portals
// ---------------------------------------------------------------------------

/**
 * A portal. `position` is LOCAL to the zone; World converts to world space when
 * it needs to teleport. `arrive` is the local point a player is placed at when
 * they come through, one step clear of the leaf so the door can swing.
 */
export function portal(id, zone, position, yaw, target, kind = 'door', extra = {}) {
  return {
    id, zone, position, yaw, target, kind, locked: false,
    arrive: extra.arrive || [
      position[0] - Math.sin(yaw) * 1.1, position[1], position[2] - Math.cos(yaw) * 1.1],
    arriveYaw: extra.arriveYaw ?? yaw + Math.PI,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// rolled steel
// ---------------------------------------------------------------------------

/** Universal beam section (an I), length along X, centred at origin. */
export function iBeam(len, depth = 0.30, flange = 0.16, web = 0.011, tf = 0.017) {
  const parts = [];
  const w = box(len, tf, flange, 0.003, 1); w.translate(0, depth / 2 - tf / 2, 0);
  const w2 = box(len, tf, flange, 0.003, 1); w2.translate(0, -depth / 2 + tf / 2, 0);
  const wb = box(len, depth - tf * 2, web, 0.002, 1);
  parts.push(w, w2, wb);
  return merge(parts);
}

/** Channel section (a C), length along X, opening toward +Z. */
export function channel(len, depth = 0.15, flange = 0.075, t = 0.008) {
  const parts = [];
  const web = box(len, depth, t, 0.002, 1); web.translate(0, 0, -flange / 2);
  const f1 = box(len, t, flange, 0.002, 1); f1.translate(0, depth / 2 - t / 2, 0);
  const f2 = box(len, t, flange, 0.002, 1); f2.translate(0, -depth / 2 + t / 2, 0);
  parts.push(web, f1, f2);
  return merge(parts);
}

/** Angle section (an L). */
export function angle(len, leg = 0.06, t = 0.006) {
  const a = box(len, t, leg, 0.0015, 1); a.translate(0, 0, leg / 2);
  const b = box(len, leg, t, 0.0015, 1); b.translate(0, leg / 2, 0);
  return merge([a, b]);
}

/** Square hollow-section column with a base plate and bolts. */
export function steelColumn(b, x, y, z, h, { size = 0.20, key = 'machinePaint', base = true, cap = true } = {}) {
  const parts = [];
  const col = box(size, h, size, 0.008, 1); col.translate(x, y + h / 2, z);
  parts.push(col);
  if (base) {
    const bp = box(size * 2.0, 0.024, size * 2.0, 0.004, 1); bp.translate(x, y + 0.012, z);
    parts.push(bp);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bolt = cyl(0.016, 0.016, 0.028, 6);
      bolt.translate(x + sx * size * 0.75, y + 0.036, z + sz * size * 0.75);
      parts.push(bolt);
    }
    // Haunch stiffeners.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const st = box(dx ? 0.16 : 0.008, 0.22, dz ? 0.16 : 0.008, 0.002, 1);
      st.translate(x + dx * (size / 2 + 0.07), y + 0.13, z + dz * (size / 2 + 0.07));
      parts.push(st);
    }
  }
  if (cap) {
    const cp = box(size * 1.35, 0.02, size * 1.35, 0.004, 1); cp.translate(x, y + h - 0.01, z);
    parts.push(cp);
  }
  const g = merge(parts);
  worldUV(g, 0.8);
  vertexShade(g, (px, py) => 0.62 + clamp01((py - y) / Math.max(h, 0.5)) * 0.34);
  b.add(key, g);
  b.addColliderAt(x, y + h / 2, z, size, h, size, { tag: 'column' });
  return g;
}

// ---------------------------------------------------------------------------
// handrail / balustrade
// ---------------------------------------------------------------------------

/**
 * Tubular handrail along a polyline of [x,z] points at height `y`.
 * Emits top rail, mid rail, stanchions and (optionally) a toeplate. This is the
 * single most important detail in an industrial space: an edge without a rail
 * reads as a hole in the level, an edge with one reads as architecture.
 */
export function handrail(b, points, y, {
  h = 1.10, key = 'machinePaint', spacing = 1.5, mid = true, toe = true,
  toeH = 0.12, r = 0.021, closed = false,
} = {}) {
  const parts = [];
  const pts = closed ? [...points, points[0]] : points;
  let posts = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const ang = Math.atan2(bx - ax, bz - az);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    for (const railY of mid ? [h, h * 0.52] : [h]) {
      const g = cyl(r, r, len, 8); g.rotateZ(Math.PI / 2); g.rotateY(ang - Math.PI / 2);
      g.translate(cx, y + railY, cz);
      parts.push(g);
    }
    if (toe) {
      const t = box(0.008, toeH, len, 0.002, 1); t.rotateY(ang);
      t.translate(cx, y + toeH / 2 + 0.004, cz);
      parts.push(t);
    }
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= n; k++) {
      if (k === n && i < pts.length - 1) continue;   // shared post at the joint
      const t = k / n;
      posts.push([lerp(ax, bx, t), lerp(az, bz, t)]);
    }
  }
  for (const [px, pz] of posts) {
    const p = cyl(r * 1.1, r * 1.1, h + 0.03, 8); p.translate(px, y + (h + 0.03) / 2, pz);
    const base = box(0.08, 0.012, 0.08, 0.002, 1); base.translate(px, y + 0.006, pz);
    parts.push(p, base);
  }
  const g = merge(parts);
  worldUV(g, 0.6);
  vertexShade(g, (x, yy) => 0.68 + clamp01((yy - y) / (h + 0.1)) * 0.30);
  b.add(key, g);
  return g;
}

// ---------------------------------------------------------------------------
// stairs
// ---------------------------------------------------------------------------

/**
 * A straight flight. Local +Z is the direction of ascent.
 *
 * Emits treads (with a nosing), risers or open strings, two stringers, a
 * landing at the top, handrails on both sides and a stepped collider stack so
 * the player physically walks up it.
 */
export function stairFlight(b, x, y, z, {
  yaw = 0, steps = 14, rise = 0.185, going = 0.265, width = 1.20,
  treadKey = 'tread', stringKey = 'machinePaint', open = true,
  rails = true, railKey = 'machinePaint', landing = 1.2, landingKey = null,
  collide = true, seed = 1,
} = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const toWorld = (u, v, h) => [x + u * c + v * s, y + h, z - u * s + v * c];
  const parts = [], strings = [];
  const totalRun = steps * going;
  const totalRise = steps * rise;

  for (let i = 0; i < steps; i++) {
    const v = (i + 0.5) * going;
    const hy = (i + 1) * rise;
    const t = box(width, 0.035, going + 0.028, 0.004, 1);
    t.rotateY(yaw);
    const [wx, wy, wz] = toWorld(0, v, hy - 0.0175);
    t.translate(wx, wy, wz);
    parts.push(t);
    if (!open) {
      const r = box(width - 0.01, rise - 0.03, 0.014, 0.002, 1);
      r.rotateY(yaw);
      const [rx, ry, rz] = toWorld(0, v - going / 2 - 0.007, hy - rise / 2 - 0.01);
      r.translate(rx, ry, rz);
      parts.push(r);
    }
    if (collide) {
      const [cx2, cy2, cz2] = toWorld(0, v, hy - rise / 2);
      b.addColliderAt(cx2, cy2 - rise * 0.5 + 0.001, cz2, width * Math.abs(c) + (going + 0.03) * Math.abs(s),
        0.02, width * Math.abs(s) + (going + 0.03) * Math.abs(c), { tag: 'stair', solid: false });
      // Walkable surface for the floor sampler.
      const hw = width / 2, hg = (going + 0.03) / 2;
      const corners = [[-hw, -hg], [hw, -hg], [hw, hg], [-hw, hg]].map(([u, vv]) =>
        [x + (u * c + (v + vv) * s), z - u * s + (v + vv) * c]);
      const minX = Math.min(...corners.map((p) => p[0])), maxX = Math.max(...corners.map((p) => p[0]));
      const minZ = Math.min(...corners.map((p) => p[1])), maxZ = Math.max(...corners.map((p) => p[1]));
      b.addFloor([minX, minZ, maxX, maxZ], y + hy, { surface: 'metal', tag: 'stair' });
    }
  }

  // Stringers: a channel running under the treads on each side.
  for (const sx of [-1, 1]) {
    const len = Math.hypot(totalRun, totalRise);
    const st = box(0.028, 0.26, len, 0.004, 1);
    st.rotateX(-Math.atan2(totalRise, totalRun));
    st.rotateY(yaw);
    const [wx, wy, wz] = toWorld(sx * (width / 2 + 0.014), totalRun / 2, totalRise / 2 - 0.10);
    st.translate(wx, wy, wz);
    strings.push(st);
  }

  // Landing.
  if (landing > 0) {
    const lg = box(width + 0.06, 0.045, landing, 0.005, 1);
    lg.rotateY(yaw);
    const [lx, ly, lz] = toWorld(0, totalRun + landing / 2, totalRise - 0.02);
    lg.translate(lx, ly, lz);
    parts.push(lg);
    if (collide) {
      const hw = (width + 0.06) / 2, hl = landing / 2;
      const cs = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([u, vv]) =>
        [x + (u * c + (totalRun + landing / 2 + vv) * s), z - u * s + (totalRun + landing / 2 + vv) * c]);
      const minX = Math.min(...cs.map((p) => p[0])), maxX = Math.max(...cs.map((p) => p[0]));
      const minZ = Math.min(...cs.map((p) => p[1])), maxZ = Math.max(...cs.map((p) => p[1]));
      b.addFloor([minX, minZ, maxX, maxZ], y + totalRise, { surface: 'metal', tag: 'landing' });
    }
  }

  const tg = merge(parts);
  worldUV(tg, 0.55);
  vertexShade(tg, (px, py) => 0.60 + clamp01((py - y) / Math.max(totalRise, 1)) * 0.34);
  b.add(treadKey, tg);
  if (strings.length) {
    const sg = merge(strings);
    worldUV(sg, 0.7);
    vertexShade(sg, () => 0.66);
    b.add(stringKey, sg);
  }

  if (rails) {
    for (const sx of [-1, 1]) {
      const railPts = [];
      const n = 4;
      for (let k = 0; k <= n; k++) {
        const v = (k / n) * totalRun;
        railPts.push([x + (sx * (width / 2 - 0.04)) * c + v * s, z - (sx * (width / 2 - 0.04)) * s + v * c]);
      }
      // Rails climb with the flight, so build them as a set of short segments.
      const parts2 = [];
      for (let k = 1; k <= n; k++) {
        const v0 = ((k - 1) / n) * totalRun, v1 = (k / n) * totalRun;
        const h0 = y + ((k - 1) / n) * totalRise + 1.0, h1 = y + (k / n) * totalRise + 1.0;
        const p0 = toWorld(sx * (width / 2 - 0.04), v0, 0), p1 = toWorld(sx * (width / 2 - 0.04), v1, 0);
        for (const off of [0, -0.5]) {
          const seg = pipeRun([[p0[0], h0 + off * 0.55, p0[2]], [p1[0], h1 + off * 0.55, p1[2]]], 0.021, 7, 3);
          parts2.push(seg);
        }
        const post = cyl(0.023, 0.023, 1.06, 8);
        post.translate(p1[0], y + (k / n) * totalRise + 0.5, p1[2]);
        parts2.push(post);
      }
      const rg = merge(parts2);
      worldUV(rg, 0.6);
      vertexShade(rg, () => 0.78);
      b.add(railKey, rg);
    }
  }
  const topLocal = [0, totalRise, totalRun + landing * 0.5];
  return {
    top: toWorld(0, totalRun + landing * 0.5, totalRise),
    totalRise, totalRun,
  };
}

// ---------------------------------------------------------------------------
// gantry / walkway
// ---------------------------------------------------------------------------

/**
 * An open steel walkway. `rect` = [x0,z0,x1,z1] at height y. Emits an open-mesh
 * deck, edge channels, cross bearers, hangers or props, and handrails on the
 * sides listed in `rails` ('n','s','e','w').
 */
export function gantry(b, rect, y, {
  deckKey = 'tread', steelKey = 'machinePaint', rails = ['n', 's', 'e', 'w'],
  railKey = 'machinePaint', bearerEvery = 1.4, hangers = false, hangTo = null,
  collide = true, toe = true,
} = {}) {
  const [x0, z0, x1, z1] = rect;
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const parts = [], steel = [];
  const deck = box(w, 0.030, d, 0.004, 1); deck.translate(cx, y - 0.015, cz);
  parts.push(deck);
  // Edge channels.
  for (const sx of [-1, 1]) {
    const g = channel(d, 0.16, 0.07, 0.008); g.rotateY(Math.PI / 2);
    g.translate(cx + sx * (w / 2 + 0.035), y - 0.10, cz);
    steel.push(g);
  }
  for (const sz of [-1, 1]) {
    const g = channel(w, 0.16, 0.07, 0.008);
    g.translate(cx, y - 0.10, cz + sz * (d / 2 + 0.035));
    steel.push(g);
  }
  // Cross bearers.
  const along = w >= d;
  const n = Math.max(1, Math.round((along ? w : d) / bearerEvery));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const g = along ? channel(d, 0.13, 0.06, 0.007) : channel(w, 0.13, 0.06, 0.007);
    if (along) g.rotateY(Math.PI / 2);
    g.translate(along ? lerp(x0, x1, t) : cx, y - 0.10, along ? cz : lerp(z0, z1, t));
    steel.push(g);
  }
  if (hangers && hangTo !== null) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const rod = cyl(0.016, 0.016, hangTo - y, 6);
      rod.translate(cx + sx * (w / 2 - 0.1), (y + hangTo) / 2, cz + sz * (d / 2 - 0.1));
      steel.push(rod);
    }
  }
  const dg = merge(parts);
  worldUV(dg, 0.5);
  vertexShade(dg, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.95 : 0.5));
  b.add(deckKey, dg);
  const sg = merge(steel);
  worldUV(sg, 0.7);
  vertexShade(sg, () => 0.62);
  b.add(steelKey, sg);

  const railMap = {
    n: [[x0, z0], [x1, z0]], s: [[x1, z1], [x0, z1]],
    e: [[x1, z0], [x1, z1]], w: [[x0, z1], [x0, z0]],
  };
  for (const side of rails) {
    const pts = railMap[side];
    if (pts) handrail(b, pts, y, { key: railKey, toe, spacing: 1.6 });
  }
  if (collide) {
    b.addFloor([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], y,
      { surface: 'metal', tag: 'gantry' });
    // A rail is a real obstacle: register a thin wall where there is one.
    const th = 0.10;
    for (const side of rails) {
      if (side === 'n') b.addColliderAt(cx, y + 0.55, z0, w, 1.1, th, { tag: 'rail' });
      if (side === 's') b.addColliderAt(cx, y + 0.55, z1, w, 1.1, th, { tag: 'rail' });
      if (side === 'e') b.addColliderAt(x1, y + 0.55, cz, th, 1.1, d, { tag: 'rail' });
      if (side === 'w') b.addColliderAt(x0, y + 0.55, cz, th, 1.1, d, { tag: 'rail' });
    }
  }
}

/** Caged vertical ladder, the industrial standard. */
export function cagedLadder(b, x, y, z, h, { yaw = 0, key = 'machinePaint', cage = true, w = 0.42 } = {}) {
  const parts = [];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  for (const sx of [-1, 1]) {
    const [px, pz] = at(sx * w / 2, 0);
    const st = box(0.030, h, 0.055, 0.005, 1); st.rotateY(yaw); st.translate(px, y + h / 2, pz);
    parts.push(st);
  }
  const n = Math.floor(h / 0.28);
  for (let i = 1; i < n; i++) {
    const r = cyl(0.014, 0.014, w, 8); r.rotateZ(Math.PI / 2); r.rotateY(yaw);
    r.translate(x, y + i * (h / n), z);
    parts.push(r);
  }
  if (cage && h > 2.6) {
    for (let i = 0; i * 0.75 < h - 2.2; i++) {
      const hy = y + 2.2 + i * 0.75;
      if (hy > y + h - 0.2) break;
      const hoop = new THREE.TorusGeometry(0.36, 0.011, 5, 14, Math.PI * 1.35);
      hoop.rotateX(Math.PI / 2); hoop.rotateY(yaw + Math.PI * 0.83);
      const [hx, hz] = at(0, 0.30);
      hoop.translate(hx, hy, hz);
      parts.push(hoop);
    }
    for (const ang of [-0.9, 0, 0.9]) {
      const [bx, bz] = at(Math.sin(ang) * 0.36, 0.30 + Math.cos(ang) * 0.36);
      const bar = box(0.022, Math.max(0.1, h - 2.2), 0.010, 0.002, 1);
      bar.rotateY(yaw); bar.translate(bx, y + 2.2 + (h - 2.2) / 2, bz);
      parts.push(bar);
    }
  }
  const g = merge(parts);
  worldUV(g, 0.5);
  vertexShade(g, (px, py) => 0.62 + clamp01((py - y) / h) * 0.30);
  b.add(key, g);
  return g;
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

/** Surface strip light — the Service Spine's signature. */
/**
 * Surface strip fitting.
 *
 * `intensityScale` exists because a fixture's candela rating is only half of what
 * decides whether a room reads: the other half is how far the light has to travel.
 * The same 28 cd strip delivers roughly nine times more at the floor from a 2.8 m
 * corridor ceiling than from a 9 m gallery soffit, and the Annex uses these in
 * both. Measured: direct light at head height came out at 37.0 units in the Intake
 * against 4.5 in the Stack, using fittings of near-identical rating.
 */
export function stripLight(b, rig, x, y, z, { rotation = 0, circuit = 'service', health = 'good', seed = 1, cone = true, cage = false, intensityScale = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rotation;
  const bodyMat = b.mat('fixtureBodyStrip', () => b.materials.get('steelPainted', {
    repeat: [1.6, 1.6], color: 0xcfcdc4, metalness: 0.85, roughness: 0.5,
    dirtAmount: 0.35, detailStrength: 0.25, envMapIntensity: 0.8,
  }));
  const parts = [];
  const body = box(1.55, 0.075, 0.11, 0.008, 1); body.translate(0, 0.038, 0);
  parts.push(body);
  for (const sx of [-1, 1]) {
    const brk = box(0.10, 0.05, 0.13, 0.004, 1); brk.translate(sx * 0.6, 0.06, 0);
    parts.push(brk);
  }
  if (cage) {
    for (let i = 0; i < 7; i++) {
      const bar = cyl(0.005, 0.005, 0.20, 5); bar.rotateX(Math.PI / 2);
      bar.rotateZ(Math.PI / 2);
      bar.translate(-0.6 + i * 0.2, -0.03, 0);
      parts.push(bar);
    }
    for (const sz of [-1, 1]) {
      const bar = cyl(0.005, 0.005, 1.5, 5); bar.rotateZ(Math.PI / 2);
      bar.translate(0, -0.03, sz * 0.055);
      parts.push(bar);
    }
  }
  const hg = merge(parts);
  hg.rotateY(rotation); hg.translate(x, y, z);
  worldUV(hg, 0.9); whiteColors(hg);
  vertexShade(hg, (px, py, pz, nx, ny) => (ny < -0.4 ? 0.9 : 0.6));
  b.add('fixtureBodyStrip', hg, () => bodyMat);

  const t = new THREE.CylinderGeometry(0.019, 0.019, 1.44, 8, 1);
  t.rotateZ(Math.PI / 2); t.translate(0, 0.002, 0);
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff, fog: true, toneMapped: true });
  tubeMat.userData.baseColor = new THREE.Color(0xdfeaff);
  const tube = new THREE.Mesh(t, tubeMat);
  g.add(tube);

  const f = rig.add({ type: 'strip', position: [x, y, z], rotation, circuit, health, seed, intensityScale });
  f.tube = tube;
  b.addObject(g);
  if (cone) {
    const cn = makeLightCone(3.4, 1.5, 0xdfeaff);
    cn.position.set(0, -0.02, 0);
    f.group.add(cn); f.coneMesh = cn;
  }
  return f;
}

/** Vapour-tight bulkhead. Wall or ceiling mounted, with a wire guard. */
/** Vapour-tight bulkhead. See stripLight for why `intensityScale` is needed. */
export function bulkhead(b, rig, x, y, z, { yaw = 0, circuit = 'service', health = 'good', seed = 1, mount = 'wall', cone = true, intensityScale = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = yaw;
  const mat = b.mat('bulkheadBody', () => b.materials.get('steelPainted', {
    repeat: [2, 2], color: 0x8d8a80, metalness: 0.6, roughness: 0.62,
    dirtAmount: 0.6, dirtBase: -0.2, detailStrength: 0.3, envMapIntensity: 0.6,
  }));
  const parts = [];
  const back = box(0.34, 0.22, 0.06, 0.008, 1); back.translate(0, 0, -0.03);
  parts.push(back);
  const ring = new THREE.TorusGeometry(0.135, 0.016, 6, 16);
  ring.scale(1.15, 0.85, 1); ring.translate(0, 0, 0.035);
  parts.push(ring);
  for (let i = 0; i < 5; i++) {
    const bar = box(0.006, 0.24, 0.006, 0.001, 1);
    bar.rotateZ((i / 5) * Math.PI);
    bar.translate(0, 0, 0.045);
    parts.push(bar);
  }
  const gd = merge(parts);
  gd.rotateY(yaw); gd.translate(x, y, z);
  worldUV(gd, 0.4); whiteColors(gd);
  vertexShade(gd, () => 0.7);
  b.add('bulkheadBody', gd, () => mat);

  const glass = new THREE.SphereGeometry(0.115, 12, 8, 0, TAU, 0, Math.PI / 2);
  glass.scale(1.25, 0.9, 0.55); glass.rotateX(Math.PI / 2); glass.translate(0, 0, 0.02);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffe3b4, fog: true, toneMapped: true });
  glassMat.userData.baseColor = new THREE.Color(0xffe3b4);
  const lens = new THREE.Mesh(glass, glassMat);
  g.add(lens);

  const f = rig.add({ type: 'bulkhead', position: [x, y, z], rotation: yaw, circuit, health, seed, intensityScale });
  f.tube = lens;
  // A wall bulkhead throws light outward and slightly down.
  f.target.position.set(0, -1.0, 2.4);
  if (mount === 'ceiling') f.target.position.set(0, -3, 0);
  b.addObject(g);
  if (cone) {
    const cn = makeLightCone(2.6, 1.5, 0xffd8a0);
    cn.rotation.x = mount === 'ceiling' ? 0 : -1.15;
    f.group.add(cn); f.coneMesh = cn;
  }
  return f;
}

/** High-bay sodium lamp on a drop rod — the Plant's ceiling. */
export function highbay(b, rig, x, y, z, { circuit = 'plant', health = 'good', seed = 1, drop = 0.7, cone = true, intensityScale = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mat = b.mat('highbayBody', () => b.materials.get('steelPainted', {
    repeat: [1.4, 1.4], color: 0x6f6b60, metalness: 0.8, roughness: 0.55,
    dirtAmount: 0.65, dirtBase: -1, detailStrength: 0.3, envMapIntensity: 0.7,
  }));
  const parts = [];
  const rod = cyl(0.016, 0.016, drop, 6); rod.translate(0, drop / 2, 0);
  parts.push(rod);
  const gear = box(0.30, 0.16, 0.22, 0.01, 1); gear.translate(0, 0.02, 0);
  parts.push(gear);
  const reflector = lathe([[0.035, 0], [0.14, -0.10], [0.30, -0.26], [0.325, -0.29], [0.315, -0.30], [0.28, -0.26], [0.12, -0.10], [0.03, -0.01]], 18);
  reflector.translate(0, -0.06, 0);
  parts.push(reflector);
  // Ribs on the reflector, so it catches a highlight instead of reading smooth.
  for (let i = 0; i < 8; i++) {
    const rib = box(0.006, 0.02, 0.30, 0.001, 1);
    rib.rotateX(-0.72); rib.rotateY((i / 8) * TAU);
    rib.translate(0, -0.22, 0);
    parts.push(rib);
  }
  const hg = merge(parts);
  hg.translate(x, y, z);
  worldUV(hg, 0.6); whiteColors(hg);
  vertexShade(hg, () => 0.66);
  b.add('highbayBody', hg, () => mat);

  const lamp = lathe([[0, 0], [0.045, -0.03], [0.05, -0.10], [0.03, -0.15], [0, -0.16]], 12);
  lamp.translate(0, -0.10, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffca80, fog: true, toneMapped: true });
  lampMat.userData.baseColor = new THREE.Color(0xffca80);
  const bulb = new THREE.Mesh(lamp, lampMat);
  g.add(bulb);

  const f = rig.add({ type: 'highbay', position: [x, y - 0.2, z], circuit, health, seed, intensityScale });
  f.tube = bulb;
  b.addObject(g);
  if (cone) {
    const cn = makeLightCone(9.5, 4.6, 0xffb45c);
    cn.position.set(0, -0.25, 0);
    f.group.add(cn); f.coneMesh = cn;
  }
  return f;
}

/** Domestic pendant with a shade — the Residence and the Office of Record. */
export function pendant(b, rig, x, y, z, { circuit = 'residence', health = 'good', seed = 1, drop = 0.42, shade = 'cone', cone = true, intensityScale = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mat = b.mat('pendantBody', () => b.materials.get('doorPaint', {
    repeat: [2, 2], color: 0xd6c8a4, metalness: 0.05, roughness: 0.55,
    dirtAmount: 0.55, dirtBase: -1, detailStrength: 0.25, envMapIntensity: 0.5,
  }));
  const parts = [];
  const rose = lathe([[0, 0], [0.055, -0.005], [0.058, -0.022], [0.02, -0.03], [0, -0.03]], 12);
  parts.push(rose);
  const flex = cyl(0.004, 0.004, drop, 5); flex.translate(0, -drop / 2 - 0.02, 0);
  parts.push(flex);
  if (shade === 'cone') {
    const sh = lathe([[0.03, 0], [0.055, -0.02], [0.145, -0.19], [0.150, -0.20], [0.140, -0.20], [0.048, -0.02], [0.026, 0]], 16);
    sh.translate(0, -drop - 0.02, 0);
    parts.push(sh);
  } else {
    const sh = new THREE.SphereGeometry(0.115, 14, 10);
    sh.scale(1, 0.85, 1); sh.translate(0, -drop - 0.10, 0);
    parts.push(sh);
  }
  const hg = merge(parts);
  hg.translate(x, y, z);
  worldUV(hg, 0.35); whiteColors(hg);
  vertexShade(hg, () => 0.74);
  b.add('pendantBody', hg, () => mat);

  const bulbG = new THREE.SphereGeometry(0.033, 10, 8);
  bulbG.translate(0, -drop - 0.09, 0);
  const bm = new THREE.MeshBasicMaterial({ color: 0xffd08a, fog: true, toneMapped: true });
  bm.userData.baseColor = new THREE.Color(0xffd08a);
  const bulb = new THREE.Mesh(bulbG, bm);
  g.add(bulb);

  const f = rig.add({ type: 'pendant', position: [x, y - drop - 0.08, z], circuit, health, seed, intensityScale });
  f.tube = bulb;
  b.addObject(g);
  if (cone) {
    const cn = makeLightCone(2.4, 1.25, 0xffb964);
    cn.position.set(0, -drop - 0.14, 0);
    f.group.add(cn); f.coneMesh = cn;
  }
  return f;
}

/** Battery emergency light with two spot heads. */
export function emergencyLight(b, rig, x, y, z, { yaw = 0, circuit = 'emergency', seed = 1, health = 'good' } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = yaw;
  const mat = b.mat('emergBody', () => b.materials.get('doorPaint', {
    repeat: [2.5, 2.5], color: 0xcfcabb, metalness: 0, roughness: 0.5,
    dirtAmount: 0.5, detailStrength: 0.2, envMapIntensity: 0.5,
  }));
  const parts = [];
  const body = box(0.26, 0.10, 0.09, 0.008, 1); body.translate(0, 0, -0.045);
  parts.push(body);
  for (const sx of [-1, 1]) {
    const head = cyl(0.032, 0.036, 0.05, 10); head.rotateX(Math.PI / 2);
    head.rotateY(sx * 0.35);
    head.translate(sx * 0.075, 0.005, 0.02);
    parts.push(head);
  }
  const hg = merge(parts);
  hg.rotateY(yaw); hg.translate(x, y, z);
  worldUV(hg, 0.3); whiteColors(hg);
  b.add('emergBody', hg, () => mat);
  const lensG = [];
  for (const sx of [-1, 1]) {
    const l = cyl(0.026, 0.026, 0.006, 10); l.rotateX(Math.PI / 2);
    l.rotateY(sx * 0.35); l.translate(sx * 0.075, 0.005, 0.045);
    lensG.push(l);
  }
  const lm = new THREE.MeshBasicMaterial({ color: 0x9dffbe, fog: true, toneMapped: true });
  lm.userData.baseColor = new THREE.Color(0x9dffbe);
  const lens = new THREE.Mesh(merge(lensG), lm);
  g.add(lens);
  const f = rig.add({ type: 'emergency', position: [x, y, z], rotation: yaw, circuit, health, seed });
  f.tube = lens;
  f.target.position.set(0, -0.8, 2.5);
  b.addObject(g);
  return f;
}

// ---------------------------------------------------------------------------
// misc structure
// ---------------------------------------------------------------------------

/** Board-formed concrete wall face: horizontal board marks and tie holes. */
export function boardMarks(b, ax, az, bx, bz, y, h, { key = 'boardConcrete', board = 0.225, side = 1, seed = 1 } = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.2) return;
  const yaw = Math.atan2(bx - ax, bz - az);
  const rng = makeRng(seed);
  const parts = [];
  const n = Math.floor(h / board);
  for (let i = 1; i < n; i++) {
    const g = box(0.008, 0.006, len - 0.02, 0.0015, 1);
    g.rotateY(yaw);
    g.translate((ax + bx) / 2 + Math.cos(yaw) * side * 0.083, y + i * board, (az + bz) / 2 - Math.sin(yaw) * side * 0.083);
    parts.push(g);
  }
  // Snap-tie holes on a 0.9 m grid.
  const cols = Math.floor(len / 0.9);
  for (let i = 0; i <= cols; i++) {
    for (let j = 1; j < Math.floor(h / 0.9); j++) {
      const t = cols ? i / cols : 0.5;
      const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
      const hole = cyl(0.016, 0.013, 0.014, 8);
      hole.rotateZ(Math.PI / 2); hole.rotateY(yaw + Math.PI / 2);
      hole.translate(px + Math.cos(yaw) * side * 0.083, y + j * 0.9, pz - Math.sin(yaw) * side * 0.083);
      parts.push(hole);
    }
  }
  const g = merge(parts);
  worldUV(g, 0.5);
  vertexShade(g, () => 0.72);
  b.add(key, g);
}

/** Concrete upstand / plinth under machinery. */
export function plinth(b, rect, y, h, { key = 'concreteFloor', chamfer = 0.02 } = {}) {
  const [x0, z0, x1, z1] = rect;
  const g = box(Math.abs(x1 - x0), h, Math.abs(z1 - z0), chamfer, 1);
  g.translate((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  worldUV(g, 0.8);
  vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.92 : 0.66));
  b.add(key, g);
  b.addColliderAt((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2, Math.abs(x1 - x0), h, Math.abs(z1 - z0), { tag: 'plinth' });
  b.addFloor([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], y + h, { surface: 'concrete', tag: 'plinth' });
}

/** Rectangular galvanised duct run along an axis, with seams and hangers. */
export function ductRun(b, x, y, z, len, {
  axis = 'x', w = 0.8, h = 0.8, key = 'ductMetal', seamEvery = 1.2,
  hangers = true, hangTo = null, collide = true, inside = false, rivets = true,
} = {}) {
  const parts = [];
  const along = axis === 'x';
  const body = inside
    ? hollowBox(along ? len : w, h, along ? w : len)
    : box(along ? len : w, h, along ? w : len, 0.010, 1);
  body.translate(x, y, z);
  parts.push(body);
  const n = Math.max(1, Math.round(len / seamEvery));
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + (i / n) * len;
    const fw = along ? 0.022 : w + 0.05;
    const fd = along ? w + 0.05 : 0.022;
    const f = box(fw, h + 0.05, fd, 0.004, 1);
    f.translate(x + (along ? t : 0), y, z + (along ? 0 : t));
    parts.push(f);
    if (rivets) {
      for (let k = 0; k < 6; k++) {
        const u = -0.5 + k / 5;
        const rv = cyl(0.006, 0.006, 0.012, 5);
        rv.rotateX(along ? Math.PI / 2 : 0);
        rv.rotateZ(along ? 0 : Math.PI / 2);
        rv.translate(x + (along ? t : u * w), y + h / 2 + 0.026, z + (along ? u * w : t));
        parts.push(rv);
      }
    }
  }
  if (hangers && hangTo !== null) {
    const hn = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= hn; i++) {
      const t = -len / 2 + (i / hn) * len;
      const px = x + (along ? t : 0), pz = z + (along ? 0 : t);
      for (const s of [-1, 1]) {
        const rod = cyl(0.008, 0.008, hangTo - y - h / 2, 5);
        rod.translate(px + (along ? 0 : s * (w / 2 + 0.03)), (y + h / 2 + hangTo) / 2, pz + (along ? s * (w / 2 + 0.03) : 0));
        parts.push(rod);
      }
      const strap = box(along ? 0.03 : w + 0.10, 0.026, along ? w + 0.10 : 0.03, 0.003, 1);
      strap.translate(px, y - h / 2 - 0.014, pz);
      parts.push(strap);
    }
  }
  const g = merge(parts);
  worldUV(g, 0.55);
  vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.4 ? 0.95 : ny < -0.4 ? 0.5 : 0.78));
  b.add(key, g);
  if (collide && !inside) {
    b.addColliderAt(x, y, z, along ? len : w + 0.05, h + 0.05, along ? w + 0.05 : len, { tag: 'duct' });
  }
  return g;
}

/** Inward-facing box — for anything the player is inside of. */
export function hollowBox(w, h, d, chamfer = 0.006) {
  const g = box(w, h, d, chamfer, 1);
  g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
    idx.needsUpdate = true;
  }
  g.computeVertexNormals();
  return g;
}

/** A shallow concrete channel / drain in a floor slab, with a grating. */
export function drainChannel(b, x, y, z, len, { axis = 'x', w = 0.24, depth = 0.12, grate = true } = {}) {
  const along = axis === 'x';
  const parts = [];
  const trough = hollowBox(along ? len : w, depth, along ? w : len, 0.004);
  trough.translate(x, y - depth / 2, z);
  parts.push(trough);
  const g = merge(parts);
  worldUV(g, 0.5); vertexShade(g, () => 0.42);
  b.add('concreteFloor', g);
  if (grate) {
    const bars = [];
    const n = Math.round(len / 0.06);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (i + 0.5) * (len / n);
      const bar = box(along ? 0.022 : w, 0.014, along ? w : 0.022, 0.002, 1);
      bar.translate(x + (along ? t : 0), y - 0.008, z + (along ? 0 : t));
      bars.push(bar);
    }
    const gg = merge(bars);
    worldUV(gg, 0.4); vertexShade(gg, () => 0.7);
    b.add('grilleMetal', gg);
  }
}

export default {
  ZONE_ORIGIN, ZoneBuilder, makeBuilders, rigProxy, detachColliders, portal,
  iBeam, channel, angle, steelColumn, handrail, stairFlight, gantry,
  cagedLadder, stripLight, bulkhead, highbay, pendant, emergencyLight,
  boardMarks, plinth, ductRun, hollowBox, drainChannel,
};
