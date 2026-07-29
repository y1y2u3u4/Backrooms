import * as THREE from 'three';
import { box, cyl, lathe, merge, worldUV, vertexShade, whiteColors, pipeRun, weather, plane } from '../render/geo.js';
import { makeRng, clamp01, lerp, smoothstep, hash2, TAU } from '../core/util.js';

/**
 * Props — the set-dressing library.
 *
 * A room is not made of walls. A room is made of the things people left in it.
 * Everything here is procedural, chamfered, measured in real metres, and built
 * to be varied per instance: a filing cabinet can have a drawer hanging open, a
 * missing plinth, a dent in one side and a different label on every drawer, all
 * from the same call with a different seed.
 *
 * Contract
 * --------
 *   prop(b, x, y, z, opts) -> { acc, bounds, height, ... }
 *
 * `b` is a Builder with the palette attached. Props author geometry in LOCAL
 * space with the origin at the FLOOR, centred on the footprint, facing +Z, then
 * `emitProp` rotates/scales/positions it, projects world UVs, bakes a vertical
 * grounding gradient into vertex colours and pushes it into the builder's
 * material buckets. Colliders are registered in the same call, rotated with the
 * prop, and only where a body would actually be blocked.
 *
 * Every prop takes `seed`; every prop that could believably be damaged takes
 * `damage` (0..1). Nothing is placed twice identically.
 */

// ---------------------------------------------------------------------------
// core
// ---------------------------------------------------------------------------

/** Chamfered panel — the atom of nearly every prop here. */
export const P = (w, h, d, r = 0.005) => box(w, h, d, Math.min(r, Math.min(w, h, d) * 0.45), 1);

export class Acc {
  constructor(seed = 1) {
    this.m = new Map();
    this.cols = [];
    this.objs = [];
    this.rng = makeRng((seed >>> 0) || 1);
    this.height = 1;
    this.footprint = [0.4, 0.4];
  }
  /** Queue local-space geometry under a palette key. */
  g(key, ...geos) {
    let a = this.m.get(key);
    if (!a) { a = []; this.m.set(key, a); }
    for (const gg of geos) if (gg) a.push(gg);
    return this;
  }
  /** Local-space collider (centre + size). */
  col(cx, cy, cz, sx, sy, sz, tag = 'prop') {
    this.cols.push([cx, cy, cz, sx, sy, sz, tag]);
    return this;
  }
  obj(o) { this.objs.push(o); return this; }
}

const A = (seed) => new Acc(seed);

/**
 * Place an accumulated prop into the world.
 * Local +Z is the prop's "front".
 */
export function emitProp(b, acc, {
  x = 0, y = 0, z = 0, yaw = 0, scale = 1, tilt = 0, roll = 0,
  uv = 0.7, shade = true, shadeBase = 0, shadeTop = null, shadeLow = 0.62,
  collide = true, tag = 'prop',
} = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const top = shadeTop ?? Math.max(0.5, acc.height);
  for (const [key, geos] of acc.m) {
    if (!geos.length) continue;
    let g = merge(geos);
    if (scale !== 1) g.scale(scale, scale, scale);
    if (shade) {
      vertexShade(g, (px, py, pz, nx, ny, nz) => {
        const up = clamp01((py - shadeBase) / Math.max(0.02, top - shadeBase));
        // Undersides never catch the ceiling fixtures; tops always do.
        return lerp(shadeLow, 1.0, up * up * 0.6 + up * 0.4) * (1 - clamp01(-ny) * 0.22) + clamp01(ny) * 0.05;
      });
    }
    if (tilt) g.rotateX(tilt);
    if (roll) g.rotateZ(roll);
    g.rotateY(yaw);
    g.translate(x, y, z);
    worldUV(g, uv);
    b.add(key, g);
  }
  if (collide) {
    for (const [cx, cy, cz, sx, sy, sz, ctag] of acc.cols) {
      const wx = x + (cx * c + cz * s) * scale;
      const wz = z + (-cx * s + cz * c) * scale;
      const ex = (Math.abs(sx * c) + Math.abs(sz * s)) * scale;
      const ez = (Math.abs(sx * s) + Math.abs(sz * c)) * scale;
      b.addColliderAt(wx, y + cy * scale, wz, ex, sy * scale, ez, { tag: ctag === 'prop' ? tag : ctag });
    }
  }
  for (const o of acc.objs) {
    o.position.applyAxisAngle(UP, yaw).multiplyScalar(scale).add(new THREE.Vector3(x, y, z));
    o.rotation.y += yaw;
    b.addObject(o);
  }
  return { acc, x, y, z, yaw, scale, height: acc.height * scale };
}

const UP = new THREE.Vector3(0, 1, 0);

/** A tube frame leg/rail: a chamfered square section along an axis. */
function tube(len, r = 0.018, axis = 'y') {
  const g = axis === 'y' ? P(r * 2, len, r * 2, r * 0.55)
    : axis === 'x' ? P(len, r * 2, r * 2, r * 0.55)
      : P(r * 2, r * 2, len, r * 0.55);
  return g;
}

/** Round tube (chairs, trolleys, ladders). */
function rtube(len, r = 0.016, axis = 'y', seg = 8) {
  const g = cyl(r, r, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

/** Castor wheel with a swivel yoke. */
function castor(acc, x, z, key = 'plasticGrey', r = 0.026) {
  const yoke = P(0.03, 0.05, 0.05, 0.006); yoke.translate(x, r + 0.03, z);
  const w = cyl(r, r, 0.016, 10); w.rotateZ(Math.PI / 2); w.translate(x, r, z);
  acc.g(key, yoke, w);
}

/** Recessed drawer front with a pull, used by cabinets and desks. */
function drawerFront(w, h, d, pull = 'bar') {
  const parts = [];
  const f = P(w, h, 0.018, 0.004); f.translate(0, 0, d / 2 + 0.009);
  parts.push(f);
  if (pull === 'bar') {
    const bar = P(w * 0.42, 0.014, 0.026, 0.005); bar.translate(0, -h * 0.02, d / 2 + 0.03);
    const s1 = P(0.012, 0.03, 0.02, 0.003); s1.translate(-w * 0.19, 0, d / 2 + 0.024);
    const s2 = s1.clone(); s2.translate(w * 0.38, 0, 0);
    parts.push(bar, s1, s2);
  } else {
    const cup = P(w * 0.20, h * 0.30, 0.012, 0.004); cup.translate(0, 0, d / 2 + 0.014);
    parts.push(cup);
  }
  // Label holder — every filing drawer in a 1970s office had one.
  const lab = P(w * 0.34, 0.038, 0.006, 0.002); lab.translate(0, h * 0.30, d / 2 + 0.021);
  parts.push(lab);
  return merge(parts);
}

// ---------------------------------------------------------------------------
// office
// ---------------------------------------------------------------------------

/**
 * Desk: laminate top on a steel underframe, optional drawer pedestal, optional
 * modesty panel. Damage pulls the laminate up at one corner and rusts the legs.
 */
export function desk(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.52, d = 0.72, h = 0.725, pedestal = 'right', modesty = true, damage = 0 } = o;
  const a = A(seed); a.height = h;
  const rng = a.rng;

  const topT = 0.034;
  const top = P(w, topT, d, 0.006); top.translate(0, h - topT / 2, 0);
  if (damage > 0.4) weather(top, 0.004 * damage, 0.4, seed);
  a.g('laminate', top);
  // Edge banding, slightly proud — a laminate desk always shows its lipping.
  for (const sgn of [-1, 1]) {
    const eb = P(w + 0.006, topT * 0.55, 0.008, 0.002); eb.translate(0, h - topT / 2, sgn * (d / 2 + 0.002));
    a.g('woodDark', eb);
  }

  // Underframe.
  const legX = w / 2 - 0.075;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = tube(h - topT, 0.021); leg.translate(sx * legX, (h - topT) / 2, sz * (d / 2 - 0.08));
      a.g('steelCabinet', leg);
      const foot = cyl(0.026, 0.03, 0.012, 8); foot.translate(sx * legX, 0.006, sz * (d / 2 - 0.08));
      a.g('rubber', foot);
    }
    const rail = tube(d - 0.16, 0.016, 'z'); rail.translate(sx * legX, h - 0.12, 0);
    a.g('steelCabinet', rail);
  }
  const spine = tube(w - 0.15, 0.018, 'x'); spine.translate(0, 0.12, -(d / 2 - 0.08));
  a.g('steelCabinet', spine);

  if (modesty) {
    const mp = P(w - 0.20, 0.36, 0.014, 0.004); mp.translate(0, h - 0.30, -(d / 2 - 0.055));
    a.g('laminate', mp);
  }

  if (pedestal !== 'none') {
    const px = (pedestal === 'left' ? -1 : 1) * (w / 2 - 0.24);
    const pw = 0.40, pd = d - 0.08, ph = h - topT - 0.03;
    const body = P(pw, ph, pd, 0.006); body.translate(px, ph / 2 + 0.03, 0);
    a.g('steelCabinet', body);
    const plinth = P(pw - 0.04, 0.03, pd - 0.04, 0.004); plinth.translate(px, 0.018, 0);
    a.g('rubber', plinth);
    const n = 3;
    const openIdx = rng.chance(0.35) ? rng.int(0, n - 1) : -1;
    for (let i = 0; i < n; i++) {
      const dh = (ph - 0.03) / n;
      const dy = 0.03 + dh * (i + 0.5);
      const outp = i === openIdx ? rng.range(0.10, 0.26) : 0;
      const f = drawerFront(pw - 0.02, dh - 0.008, pd, 'bar');
      f.translate(px, dy, outp);
      a.g('steelCabinet', f);
      if (outp > 0.02) {
        // The visible drawer box and whatever is filed in it.
        const bx = P(pw - 0.06, dh - 0.04, outp + 0.02, 0.003);
        bx.translate(px, dy, pd / 2 - (outp + 0.02) / 2 + outp);
        a.g('steelCabinet', bx);
        for (let k = 0; k < 4; k++) {
          const fl = P(0.006, dh - 0.09, outp * 0.7, 0.001);
          fl.translate(px + (k - 1.5) * 0.032, dy + 0.012, pd / 2 - outp * 0.35 + outp);
          fl.rotateX(rng.range(-0.05, 0.05));
          a.g('paper', fl);
        }
      }
    }
    a.col(px, ph / 2, 0, pw, ph, pd);
  }

  a.col(0, h - 0.14, 0, w, 0.30, d);
  a.footprint = [w, d];
  return emitProp(b, a, { x, y, z, yaw, uv: 0.6, shadeTop: h, ...o });
}

/** Task chair: 5-star base, castors, gas lift, upholstered seat and back. */
export function officeChair(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, seatH = 0.46, damage = 0, arms = true } = o;
  const a = A(seed); a.height = seatH + 0.55;
  const rng = a.rng;
  const spread = 0.30;
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * TAU + 0.3;
    const ax = Math.sin(ang), az = Math.cos(ang);
    const arm = P(0.052, 0.03, spread, 0.008);
    arm.translate(0, 0.075, spread / 2);
    arm.rotateY(ang);
    a.g('plasticGrey', arm);
    castor(a, ax * spread, az * spread, 'plasticGrey', 0.028);
  }
  const col = cyl(0.026, 0.033, seatH - 0.10, 10); col.translate(0, 0.09 + (seatH - 0.10) / 2, 0);
  a.g('chrome', col);
  const mech = P(0.16, 0.05, 0.20, 0.008); mech.translate(0, seatH - 0.045, 0);
  a.g('plasticGrey', mech);

  const lean = rng.range(-0.06, 0.10) * (1 + damage);
  const seat = P(0.46, 0.075, 0.44, 0.024); seat.translate(0, seatH + 0.037, 0.01);
  const backTilt = -0.16 - lean;
  const back = P(0.44, 0.50, 0.075, 0.024);
  back.rotateX(backTilt); back.translate(0, seatH + 0.30, -0.19);
  a.g('fabric', seat, back);
  const stem = P(0.05, 0.16, 0.04, 0.01); stem.rotateX(backTilt); stem.translate(0, seatH + 0.06, -0.16);
  a.g('plasticGrey', stem);
  if (arms) {
    for (const sgn of [-1, 1]) {
      const ar = P(0.032, 0.19, 0.036, 0.008); ar.translate(sgn * 0.245, seatH + 0.11, -0.03);
      const pad = P(0.055, 0.026, 0.20, 0.011); pad.translate(sgn * 0.245, seatH + 0.21, 0.0);
      a.g('plasticGrey', ar); a.g('rubber', pad);
    }
  }
  a.col(0, seatH * 0.6, 0, 0.5, seatH * 1.2, 0.5);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: seatH + 0.5, ...o });
}

/** Stacking polypropylene chair. */
export function plasticChair(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, seatH = 0.44, collide = true } = o;
  const a = A(seed); a.height = seatH + 0.44;
  const seat = P(0.42, 0.026, 0.40, 0.014); seat.translate(0, seatH, 0.02);
  const back = P(0.40, 0.36, 0.026, 0.014); back.rotateX(-0.13); back.translate(0, seatH + 0.22, -0.17);
  a.g('plasticGrey', seat, back);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = rtube(seatH, 0.013); l.rotateX(sz * 0.05); l.rotateZ(-sx * 0.05);
    l.translate(sx * 0.17, seatH / 2, sz * 0.16 + 0.02);
    a.g('chrome', l);
  }
  for (const sx of [-1, 1]) {
    const r = rtube(0.34, 0.012, 'z'); r.translate(sx * 0.17, seatH - 0.10, 0.02);
    a.g('chrome', r);
  }
  if (collide) a.col(0, 0.32, 0, 0.44, 0.64, 0.44);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: seatH + 0.4, ...o });
}

/** A stack of plastic chairs — one call, believable nesting. */
export function chairStack(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, count = 6 } = o;
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    plasticChair(b, x + rng.range(-0.02, 0.02), y + i * 0.085, z + i * 0.012 + rng.range(-0.02, 0.02), {
      seed: seed + i * 17, yaw: yaw + rng.range(-0.05, 0.05), collide: i === 0,
    });
  }
  b.addColliderAt(x, y + 0.45 + count * 0.04, z, 0.5, 0.9 + count * 0.085, 0.5, { tag: 'prop' });
}

/**
 * Filing cabinet. `drawers` 2..4. One drawer may hang open with files in it,
 * one side may be dented, the plinth may be missing so it sits skewed.
 */
export function filingCabinet(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, drawers = 4, w = 0.47, d = 0.62, damage = 0 } = o;
  const a = A(seed); const rng = a.rng;
  const dh = 0.305;
  const h = 0.09 + drawers * dh;
  a.height = h;
  const body = P(w, h - 0.06, d, 0.008); body.translate(0, 0.06 + (h - 0.06) / 2, -0.006);
  if (damage > 0.3 && rng.chance(0.6)) weather(body, 0.006 * damage, 0.35, seed + 3);
  a.g('steelCabinet', body);
  const plinth = P(w - 0.04, 0.06, d - 0.05, 0.004); plinth.translate(0, 0.03, -0.006);
  a.g('rubber', plinth);
  const topRail = P(w + 0.01, 0.012, d + 0.006, 0.003); topRail.translate(0, h - 0.006, -0.006);
  a.g('steelCabinet', topRail);

  const openIdx = rng.chance(0.45) ? rng.int(0, drawers - 1) : -1;
  for (let i = 0; i < drawers; i++) {
    const dy = 0.06 + dh * (i + 0.5);
    const out = i === openIdx ? rng.range(0.12, 0.42) : 0;
    const f = drawerFront(w - 0.018, dh - 0.008, d, 'bar');
    f.translate(0, dy, out);
    a.g('steelCabinet', f);
    if (out > 0.02) {
      const bx = P(w - 0.06, dh - 0.05, out, 0.003);
      bx.translate(0, dy - 0.01, d / 2 - out / 2 + out);
      a.g('steelCabinet', bx);
      const nf = rng.int(5, 11);
      for (let k = 0; k < nf; k++) {
        const fl = P(0.005, dh - 0.10, Math.min(out * 0.8, 0.26), 0.001);
        fl.rotateX(rng.range(-0.08, 0.03));
        fl.translate(rng.range(-0.16, 0.16), dy + 0.02, d / 2 - Math.min(out * 0.4, 0.13) + out);
        a.g('paper', fl);
      }
    }
  }
  a.col(0, h / 2, 0, w, h, d);
  a.footprint = [w, d];
  return emitProp(b, a, { x, y, z, yaw, uv: 0.55, shadeTop: h, ...o });
}

/**
 * Bolted angle-iron shelving. `contents` fills the bays with boxes, files or
 * paint tins; `damage` bows the shelves and removes one.
 */
export function shelving(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.20, d = 0.46, h = 2.00, bays = 5, contents = 0.7, damage = 0 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  // Uprights: a real slotted angle, two thin webs meeting at the corner.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ax = P(0.042, h, 0.006, 0.002); ax.translate(sx * (w / 2 - 0.021), h / 2, sz * (d / 2 - 0.003));
    const az = P(0.006, h, 0.042, 0.002); az.translate(sx * (w / 2 - 0.003), h / 2, sz * (d / 2 - 0.021));
    a.g('steelCabinet', ax, az);
    const foot = P(0.07, 0.006, 0.07, 0.002); foot.translate(sx * (w / 2 - 0.03), 0.003, sz * (d / 2 - 0.03));
    a.g('steelCabinet', foot);
  }
  const missing = damage > 0.5 && rng.chance(0.5) ? rng.int(1, bays - 1) : -1;
  for (let i = 0; i < bays; i++) {
    const sy = 0.08 + (h - 0.20) * (i / (bays - 1));
    if (i === missing) continue;
    const segs = damage > 0.25 ? 4 : 1;
    const sh = new THREE.BoxGeometry(w - 0.02, 0.016, d - 0.01, segs, 1, 1);
    if (damage > 0.25) {
      const pos = sh.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const t = 1 - Math.abs(pos.getX(vi)) / ((w - 0.02) / 2);
        pos.setY(vi, pos.getY(vi) - t * t * 0.02 * damage * (0.4 + rng() * 0.6));
      }
      pos.needsUpdate = true;
    }
    sh.translate(0, sy, 0);
    a.g('steelCabinet', sh);
    // Front lip.
    const lip = P(w - 0.02, 0.026, 0.006, 0.002); lip.translate(0, sy + 0.012, d / 2 - 0.004);
    a.g('steelCabinet', lip);

    if (contents > 0 && rng() < contents) {
      const kind = rng.pick(['files', 'boxes', 'tins', 'files']);
      const bayH = (h - 0.20) / (bays - 1);
      if (kind === 'files') {
        let cx = -w / 2 + 0.05;
        while (cx < w / 2 - 0.10) {
          const bw = rng.range(0.05, 0.09);
          const bh = Math.min(bayH - 0.06, rng.range(0.24, 0.30));
          const lean = rng.chance(0.15) ? rng.range(0.1, 0.3) : 0;
          const fb = P(bw, bh, d - 0.10, 0.004);
          fb.rotateZ(lean);
          fb.translate(cx + bw / 2, sy + 0.012 + bh / 2, -0.01);
          a.g(rng.chance(0.5) ? 'cardboard' : 'paper', fb);
          cx += bw + rng.range(0.004, 0.02);
          if (rng.chance(0.12)) cx += rng.range(0.05, 0.16);
        }
      } else if (kind === 'boxes') {
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) {
          const bw = rng.range(0.24, 0.34), bd = rng.range(0.22, 0.34);
          const bh = Math.min(bayH - 0.05, rng.range(0.18, 0.26));
          const g = P(bw, bh, bd, 0.007);
          g.rotateY(rng.range(-0.2, 0.2));
          g.translate(-w / 2 + 0.2 + k * 0.38, sy + 0.012 + bh / 2, rng.range(-0.03, 0.03));
          a.g('cardboard', g);
        }
      } else {
        const n = rng.int(2, 5);
        for (let k = 0; k < n; k++) {
          const r = rng.range(0.05, 0.08);
          const g = cyl(r, r, r * 2.2, 10);
          g.translate(-w / 2 + 0.12 + k * 0.21, sy + 0.012 + r * 1.1, rng.range(-0.06, 0.06));
          a.g(rng.chance(0.5) ? 'machinePaint' : 'steelCabinet', g);
        }
      }
    }
  }
  a.col(0, h / 2, 0, w, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.55, shadeTop: h, ...o });
}

/**
 * Cardboard box. `state`: 'closed' | 'open' | 'collapsed' | 'soaked'.
 * Soaked boxes sag outward and sit lower; collapsed ones are flat with a fold.
 */
export function cardboardBox(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.42, d = 0.34, h = 0.30, state = 'closed', collide = false } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  if (state === 'collapsed') {
    const g = P(w * 1.2, 0.02, d * 1.7, 0.004);
    g.rotateZ(rng.range(-0.03, 0.03));
    g.translate(0, 0.012, 0);
    const fold = P(w * 1.15, 0.016, 0.03, 0.003); fold.translate(0, 0.024, rng.range(-0.1, 0.1));
    a.g('cardboard', g, fold);
    a.height = 0.03;
    return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: 0.4, ...o });
  }
  const sag = state === 'soaked' ? 1 : 0;
  const hh = h * (1 - sag * 0.18);
  const bodyG = new THREE.BoxGeometry(w, hh, d, 2, 2, 2);
  if (sag) {
    const pos = bodyG.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const t = 1 - Math.abs(py) / (hh / 2);
      pos.setXYZ(i, px * (1 + t * 0.09), py, pz * (1 + t * 0.09));
    }
    pos.needsUpdate = true;
  }
  bodyG.translate(0, hh / 2, 0);
  weather(bodyG, sag ? 0.008 : 0.003, 0.3, seed);
  a.g('cardboard', bodyG);
  // Flaps.
  if (state === 'open') {
    for (const [sx, sz, ang] of [[0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1]]) {
      const fw = ang ? d - 0.02 : w - 0.02;
      const f = P(fw, 0.012, (ang ? w : d) / 2 - 0.01, 0.003);
      if (ang) f.rotateY(Math.PI / 2);
      const lean = rng.range(0.6, 1.25);
      const dirZ = sz || 0, dirX = sx || 0;
      f.rotateX(-dirZ * lean); f.rotateZ(dirX * lean);
      f.translate(dirX * (w / 2), hh + ((ang ? w : d) / 4) * Math.sin(lean), dirZ * (d / 2));
      a.g('cardboard', f);
    }
  } else {
    const seam = P(w - 0.01, 0.008, 0.045, 0.002); seam.translate(0, hh + 0.002, 0);
    a.g('cardboard', seam);
    if (rng.chance(0.55)) {
      const tapeW = 0.05;
      const t1 = P(w + 0.004, 0.004, tapeW, 0.001); t1.translate(0, hh + 0.008, 0);
      a.g('plasticGrey', t1);
    }
  }
  if (collide) a.col(0, hh / 2, 0, w, hh, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: h, ...o });
}

/** An untidy pile of boxes — never the same twice. */
export function boxStack(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, count = 4, soakBase = 0.4 } = o;
  const rng = makeRng(seed);
  let cy = y;
  let last = [0.44, 0.36];
  for (let i = 0; i < count; i++) {
    const w = last[0] * rng.range(0.78, 1.0);
    const d = last[1] * rng.range(0.78, 1.0);
    const h = rng.range(0.22, 0.36);
    const state = (i === 0 && rng() < soakBase) ? 'soaked' : rng.chance(0.18) ? 'open' : 'closed';
    cardboardBox(b, x + rng.range(-0.05, 0.05), cy, z + rng.range(-0.05, 0.05), {
      seed: seed + i * 31, yaw: yaw + rng.range(-0.35, 0.35), w, d, h, state,
    });
    cy += h * (state === 'soaked' ? 0.86 : 1) + 0.004;
    last = [w, d];
  }
  b.addColliderAt(x, y + (cy - y) / 2, z, 0.52, cy - y, 0.44, { tag: 'prop' });
}

// ---------------------------------------------------------------------------
// janitorial
// ---------------------------------------------------------------------------

/** Mop bucket with wringer, on castors, optionally with a mop in it. */
export function mopBucket(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, mop = true, water = 0.5 } = o;
  const a = A(seed); a.height = 0.9; const rng = a.rng;
  const bw = 0.40, bd = 0.30, bh = 0.28;
  const body = new THREE.BoxGeometry(bw, bh, bd, 1, 2, 1);
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01((pos.getY(i) + bh / 2) / bh);
    pos.setX(i, pos.getX(i) * lerp(0.84, 1, t));
    pos.setZ(i, pos.getZ(i) * lerp(0.84, 1, t));
  }
  pos.needsUpdate = true;
  body.translate(0, 0.06 + bh / 2, 0);
  a.g('hazardYellow', body);
  const rim = P(bw + 0.012, 0.016, bd + 0.012, 0.004); rim.translate(0, 0.06 + bh, 0);
  a.g('hazardYellow', rim);
  if (water > 0) {
    const wsurf = P(bw - 0.03, 0.004, bd - 0.03, 0.001);
    wsurf.translate(0, 0.06 + bh * water, 0);
    a.g('glassDark', wsurf);
  }
  // Wringer.
  const wr = P(0.20, 0.22, bd - 0.02, 0.008); wr.translate(bw / 2 - 0.02, 0.06 + bh + 0.10, 0);
  const lev = P(0.05, 0.03, 0.30, 0.008); lev.rotateX(0.4); lev.translate(bw / 2 + 0.03, 0.06 + bh + 0.24, -0.10);
  a.g('plasticGrey', wr); a.g('hazardYellow', lev);
  const frame = P(bw + 0.02, 0.06, bd + 0.02, 0.006); frame.translate(0, 0.05, 0);
  a.g('plasticGrey', frame);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(a, sx * (bw / 2 - 0.05), sz * (bd / 2 - 0.05), 'plasticGrey', 0.024);
  if (mop) {
    const lean = rng.range(0.18, 0.30);
    const handle = rtube(1.42, 0.014); handle.rotateX(lean); handle.translate(0.02, 0.06 + 0.72 * Math.cos(lean), -0.72 * Math.sin(lean));
    a.g('woodDark', handle);
    const head = P(0.14, 0.20, 0.10, 0.03); head.translate(0.02, 0.16, 0.02);
    a.g('fabric', head);
    a.height = 1.5;
  }
  a.col(0, 0.22, 0, bw + 0.06, 0.44, bd + 0.06);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: 0.7, ...o });
}

/** Folding A-frame wet-floor sign. */
export function wetFloorSign(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, fallen = false } = o;
  const a = A(seed); a.height = 0.62;
  const open = 0.19;
  for (const sgn of [-1, 1]) {
    const panel = new THREE.BoxGeometry(0.30, 0.60, 0.012);
    // Taper toward the top like a real folding sign.
    const pos = panel.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = clamp01((pos.getY(i) + 0.30) / 0.60);
      pos.setX(i, pos.getX(i) * lerp(1, 0.62, t));
    }
    pos.needsUpdate = true;
    panel.rotateX(sgn * open);
    panel.translate(0, 0.30 * Math.cos(open), sgn * (0.30 * Math.sin(open) + 0.006));
    a.g('hazardYellow', panel);
  }
  const hinge = cyl(0.012, 0.012, 0.28, 8); hinge.rotateZ(Math.PI / 2); hinge.translate(0, 0.60 * Math.cos(open) - 0.01, 0);
  a.g('hazardYellow', hinge);
  a.col(0, 0.30, 0, 0.30, 0.60, 0.24);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, shadeTop: 0.6, roll: fallen ? Math.PI / 2.1 : 0, ...o });
}

/** Waste bin — mesh, plastic or pedal, chosen by `kind`. */
export function wasteBin(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, kind = 'mesh', full = 0.5 } = o;
  const a = A(seed); a.height = 0.34; const rng = a.rng;
  const r = 0.145, h = 0.32;
  if (kind === 'mesh') {
    const shell = cyl(r, r * 0.86, h, 14, false); shell.translate(0, h / 2, 0);
    a.g('grilleMetal', shell);
    for (const yy of [0.02, h / 2, h - 0.01]) {
      const ring = new THREE.TorusGeometry(r * (yy > h * 0.6 ? 1 : 0.93), 0.006, 5, 16);
      ring.rotateX(Math.PI / 2); ring.translate(0, yy, 0);
      a.g('grilleMetal', ring);
    }
  } else {
    const shell = cyl(r, r * 0.8, h, 16); shell.translate(0, h / 2, 0);
    a.g('plasticGrey', shell);
    const rim = new THREE.TorusGeometry(r, 0.008, 5, 18); rim.rotateX(Math.PI / 2); rim.translate(0, h, 0);
    a.g('plasticGrey', rim);
  }
  if (full > 0) {
    const n = Math.round(full * 6) + 1;
    for (let i = 0; i < n; i++) {
      const s = rng.range(0.05, 0.11);
      const g = P(s, s * 0.6, s * 0.9, 0.008);
      g.rotateY(rng() * TAU); g.rotateX(rng.range(-0.5, 0.5));
      g.translate(rng.range(-0.07, 0.07), h - 0.03 + i * 0.012, rng.range(-0.07, 0.07));
      a.g('paper', g);
    }
  }
  a.col(0, h / 2, 0, r * 2, h, r * 2);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, shadeTop: 0.35, ...o });
}

// ---------------------------------------------------------------------------
// logistics
// ---------------------------------------------------------------------------

/** Standard 1200 x 1000 timber pallet. */
export function pallet(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.2, d = 1.0, damage = 0 } = o;
  const a = A(seed); a.height = 0.145; const rng = a.rng;
  const bearerH = 0.075;
  for (let i = 0; i < 3; i++) {
    const bz = (i - 1) * (d / 2 - 0.06);
    const bg = P(w, bearerH, 0.10, 0.005); bg.translate(0, 0.035 + bearerH / 2 - 0.035, bz);
    bg.translate(0, 0.035, 0);
    a.g('woodDark', bg);
    const bot = P(w, 0.022, 0.10, 0.004); bot.translate(0, 0.011, bz);
    a.g('woodDark', bot);
  }
  const nb = 7;
  for (let i = 0; i < nb; i++) {
    if (damage > 0.4 && rng.chance(damage * 0.35)) continue;
    const bz = -d / 2 + 0.05 + (i / (nb - 1)) * (d - 0.10);
    const bd = P(w, 0.020, d / nb * 0.72, 0.004);
    bd.translate(0, 0.135, bz);
    if (damage > 0.3) bd.rotateZ(rng.range(-0.01, 0.01) * damage);
    a.g('woodDark', bd);
  }
  a.col(0, 0.07, 0, w, 0.145, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: 0.16, ...o });
}

/** Cable drum, upright or on its side. */
export function cableDrum(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, r = 0.46, wdt = 0.44, onSide = false, cable = 0.7 } = o;
  const a = A(seed);
  a.height = onSide ? r * 2 : r * 2;
  const flange = (off) => {
    const g = cyl(r, r, 0.028, 20); g.rotateZ(Math.PI / 2); g.translate(off, 0, 0);
    return g;
  };
  a.g('woodDark', flange(-wdt / 2), flange(wdt / 2));
  const hub = cyl(r * 0.42, r * 0.42, wdt - 0.02, 16); hub.rotateZ(Math.PI / 2);
  a.g('woodDark', hub);
  if (cable > 0) {
    const cr = lerp(r * 0.45, r * 0.9, cable);
    const coil = cyl(cr, cr, wdt - 0.08, 18); coil.rotateZ(Math.PI / 2);
    a.g('rubber', coil);
    for (let i = 0; i < 5; i++) {
      const t = new THREE.TorusGeometry(cr - 0.004, 0.012, 5, 18);
      t.rotateY(Math.PI / 2); t.translate(-wdt / 2 + 0.06 + i * ((wdt - 0.12) / 4), 0, 0);
      a.g('rubber', t);
    }
  }
  const acc = a;
  // Reposition: upright means the axis is horizontal at hub height r.
  for (const [key, geos] of acc.m) {
    for (const g of geos) {
      if (onSide) { g.rotateZ(Math.PI / 2); g.translate(0, wdt / 2, 0); }
      else g.translate(0, r, 0);
    }
  }
  if (onSide) a.col(0, wdt / 2, 0, r * 2, wdt, r * 2);
  else a.col(0, r, 0, wdt, r * 2, r * 2);
  a.height = onSide ? wdt : r * 2;
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: a.height, ...o });
}

/** 205 litre oil drum with rolling hoops. */
export function oilDrum(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, fallen = false, open = false, rustKey = 'rust' } = o;
  const a = A(seed); const r = 0.286, h = 0.88;
  a.height = fallen ? r * 2 : h;
  const shell = cyl(r, r, h, 20); shell.translate(0, h / 2, 0);
  a.g(rustKey, shell);
  for (const hy of [h * 0.30, h * 0.70]) {
    const hoop = cyl(r + 0.014, r + 0.014, 0.05, 20); hoop.translate(0, hy, 0);
    a.g(rustKey, hoop);
  }
  const rim1 = cyl(r + 0.008, r + 0.008, 0.022, 20); rim1.translate(0, h - 0.011, 0);
  const rim2 = cyl(r + 0.008, r + 0.008, 0.022, 20); rim2.translate(0, 0.011, 0);
  a.g(rustKey, rim1, rim2);
  if (!open) {
    for (const [bx, bz] of [[r * 0.55, 0], [-r * 0.4, r * 0.35]]) {
      const bung = cyl(0.032, 0.032, 0.014, 10); bung.translate(bx, h - 0.004, bz);
      a.g('chrome', bung);
    }
  } else {
    const inner = cyl(r - 0.02, r - 0.02, 0.02, 18); inner.translate(0, h - 0.18, 0);
    a.g('glassDark', inner);
  }
  if (fallen) {
    for (const [key, geos] of a.m) for (const g of geos) { g.rotateX(Math.PI / 2); g.translate(0, r, -h / 2 + r); }
    a.col(0, r, 0, r * 2, r * 2, h);
  } else a.col(0, h / 2, 0, r * 2, h, r * 2);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.55, shadeTop: a.height, ...o });
}

/** 20 litre steel jerry can. */
export function jerryCan(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0 } = o;
  const a = A(seed); a.height = 0.47;
  const body = P(0.34, 0.44, 0.165, 0.022); body.translate(0, 0.22, 0);
  a.g('machinePaint', body);
  // The three pressed X-ribs on the face.
  for (const sz of [-1, 1]) {
    for (const ang of [0.72, -0.72]) {
      const rib = P(0.36, 0.026, 0.012, 0.004);
      rib.rotateZ(ang); rib.translate(0, 0.22, sz * 0.085);
      a.g('machinePaint', rib);
    }
  }
  for (let i = 0; i < 3; i++) {
    const hx = (i - 1) * 0.095;
    const hb = P(0.024, 0.028, 0.10, 0.008); hb.translate(hx, 0.455, -0.02);
    a.g('machinePaint', hb);
  }
  const hbar = P(0.24, 0.02, 0.024, 0.008); hbar.translate(0, 0.468, -0.02);
  a.g('machinePaint', hbar);
  const cap = cyl(0.036, 0.04, 0.03, 10); cap.translate(0.10, 0.455, 0.04);
  a.g('chrome', cap);
  a.col(0, 0.22, 0, 0.34, 0.44, 0.17);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, shadeTop: 0.47, ...o });
}

/** Two-tier steel trolley on castors. */
export function trolley(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.86, d = 0.50, load = 0.6 } = o;
  const a = A(seed); a.height = 0.98; const rng = a.rng;
  const decks = [0.24, 0.80];
  for (const dy of decks) {
    const deck = P(w, 0.018, d, 0.005); deck.translate(0, dy, 0);
    a.g('steelCabinet', deck);
    for (const sz of [-1, 1]) {
      const lip = P(w, 0.026, 0.008, 0.002); lip.translate(0, dy + 0.014, sz * (d / 2 - 0.004));
      a.g('steelCabinet', lip);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = rtube(0.86, 0.014); post.translate(sx * (w / 2 - 0.03), 0.12 + 0.43, sz * (d / 2 - 0.03));
    a.g('chrome', post);
    castor(a, sx * (w / 2 - 0.03), sz * (d / 2 - 0.03), 'plasticGrey', 0.038);
  }
  const hb = rtube(w - 0.06, 0.016, 'x'); hb.translate(0, 0.98, -(d / 2 - 0.03));
  a.g('chrome', hb);
  if (load > 0) {
    const n = Math.round(load * 4);
    for (let i = 0; i < n; i++) {
      const bw = rng.range(0.20, 0.30);
      cardboardBoxLocal(a, rng.range(-w / 2 + 0.2, w / 2 - 0.2), 0.25, rng.range(-0.1, 0.1), bw, bw * 0.8, rng.range(0.14, 0.22), rng);
    }
  }
  a.col(0, 0.5, 0, w, 1.0, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: 1.0, ...o });
}

function cardboardBoxLocal(a, cx, cy, cz, w, d, h, rng) {
  const g = P(w, h, d, 0.006);
  g.rotateY(rng.range(-0.3, 0.3));
  g.translate(cx, cy + h / 2, cz);
  a.g('cardboard', g);
}

// ---------------------------------------------------------------------------
// building services
// ---------------------------------------------------------------------------

/** Fire extinguisher on a wall bracket (or on the floor if `bracket` is false). */
export function fireExtinguisher(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, bracket = true, missing = false } = o;
  const a = A(seed); a.height = 0.62;
  if (bracket) {
    const bk = P(0.10, 0.16, 0.05, 0.006); bk.translate(0, 0.30, -0.03);
    const strap = P(0.16, 0.03, 0.05, 0.006); strap.translate(0, 0.34, 0.02);
    a.g('warningRed', bk, strap);
    const plate = P(0.13, 0.19, 0.008, 0.003); plate.translate(0, 0.62, -0.05);
    a.g('warningRed', plate);
  }
  if (!missing) {
    const r = 0.075;
    const body = cyl(r, r, 0.42, 14); body.translate(0, 0.21, 0);
    const dome = lathe([[0, 0], [r * 0.98, 0.005], [r * 0.9, 0.05], [r * 0.55, 0.10], [0.02, 0.12], [0, 0.12]], 14);
    dome.translate(0, 0.42, 0);
    const bot = lathe([[0, 0.02], [r * 0.6, 0], [r * 0.98, -0.005], [r, 0.02]], 14);
    a.g('warningRed', body, dome, bot);
    const neck = cyl(0.022, 0.022, 0.05, 10); neck.translate(0, 0.555, 0);
    const valve = P(0.05, 0.05, 0.09, 0.01); valve.translate(0, 0.585, 0.01);
    const lever = P(0.07, 0.012, 0.02, 0.004); lever.translate(0, 0.615, 0.02);
    const gauge = cyl(0.019, 0.019, 0.014, 10); gauge.rotateX(Math.PI / 2); gauge.translate(0.02, 0.585, 0.055);
    a.g('chrome', neck, valve, lever, gauge);
    const hose = pipeRun([[0.03, 0.56, 0.03], [0.10, 0.44, 0.05], [0.085, 0.22, 0.02], [0.05, 0.14, -0.02]], 0.011, 6, 5);
    a.g('rubber', hose);
    const label = P(0.10, 0.13, 0.004, 0.001); label.translate(0, 0.26, r);
    a.g('paper', label);
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.35, shadeTop: 0.7, collide: false, ...o });
}

/** Wall-mounted first-aid box. */
export function firstAidBox(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, open = false } = o;
  const a = A(seed); a.height = 0.3;
  const body = P(0.30, 0.24, 0.11, 0.008); body.translate(0, 0, -0.055);
  a.g('plasticWhite', body);
  const door = P(0.29, 0.23, 0.014, 0.004);
  if (open) { door.translate(0.145, 0, 0.007); door.rotateY(-1.2); door.translate(-0.145, 0, 0); }
  else door.translate(0, 0, 0.006);
  a.g('plasticWhite', door);
  const cv = P(0.035, 0.11, 0.004, 0.001), ch = P(0.11, 0.035, 0.004, 0.001);
  for (const g of [cv, ch]) {
    if (open) { g.translate(0.145, 0, 0.012); g.rotateY(-1.2); g.translate(-0.145, 0, 0); }
    else g.translate(0, 0, 0.014);
    a.g('hazardYellow', g);
  }
  if (open) {
    const shelf = P(0.27, 0.006, 0.09, 0.002); shelf.translate(0, 0, -0.055);
    a.g('plasticWhite', shelf);
    for (let i = 0; i < 3; i++) {
      const it = P(0.05, 0.03, 0.06, 0.006); it.translate(-0.08 + i * 0.08, 0.02, -0.05);
      a.g('paper', it);
    }
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.3, collide: false, shade: false, ...o });
}

/** Stopped wall clock. `handsAt` is [hour, minute]; it never moves. */
export function wallClock(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, handsAt = [3, 47], r = 0.15, damage = 0 } = o;
  const a = A(seed); a.height = r * 2;
  const case_ = lathe([[0, -0.02], [r, -0.02], [r, 0.03], [r - 0.012, 0.035], [0, 0.035]], 22);
  case_.rotateX(Math.PI / 2);
  a.g('plasticWhite', case_);
  const face = cyl(r - 0.013, r - 0.013, 0.004, 22); face.rotateX(Math.PI / 2); face.translate(0, 0, 0.028);
  a.g('paper', face);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU;
    const m = P(i % 3 === 0 ? 0.011 : 0.006, 0.022, 0.003, 0.001);
    m.translate(0, r - 0.028, 0.031); m.rotateZ(ang);
    a.g('rubber', m);
  }
  const hourAng = -((handsAt[0] % 12) / 12 + handsAt[1] / 720) * TAU;
  const minAng = -(handsAt[1] / 60) * TAU;
  const hh = P(0.010, r * 0.52, 0.003, 0.001); hh.translate(0, r * 0.26, 0.033); hh.rotateZ(hourAng);
  const mh = P(0.008, r * 0.78, 0.003, 0.001); mh.translate(0, r * 0.39, 0.036); mh.rotateZ(minAng);
  a.g('rubber', hh, mh);
  const pin = cyl(0.008, 0.008, 0.006, 8); pin.rotateX(Math.PI / 2); pin.translate(0, 0, 0.038);
  a.g('chrome', pin);
  if (damage > 0.4) {
    for (let i = 0; i < 3; i++) {
      const crack = P(0.002, r * 1.4, 0.002, 0.0005);
      crack.rotateZ(i * 1.1 + 0.4); crack.translate(0.01, 0, 0.033);
      a.g('rubber', crack);
    }
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.25, collide: false, shade: false, ...o });
}

/** Cork noticeboard with pinned paper at slight angles. */
export function noticeboard(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.20, h = 0.90, sheets = 7 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const cork = P(w - 0.04, h - 0.04, 0.016, 0.003); cork.translate(0, 0, -0.012);
  a.g('cardboard', cork);
  for (const [gw, gh, gx, gy] of [[w, 0.03, 0, h / 2 - 0.015], [w, 0.03, 0, -h / 2 + 0.015],
  [0.03, h, -w / 2 + 0.015, 0], [0.03, h, w / 2 - 0.015, 0]]) {
    const f = P(gw, gh, 0.026, 0.004); f.translate(gx, gy, -0.005);
    a.g('steelCabinet', f);
  }
  for (let i = 0; i < sheets; i++) {
    const sw = rng.range(0.14, 0.24), sh = rng.range(0.19, 0.31);
    const g = P(sw, sh, 0.0025, 0.0006);
    g.rotateZ(rng.range(-0.10, 0.10));
    g.translate(rng.range(-w / 2 + sw / 2 + 0.04, w / 2 - sw / 2 - 0.04),
      rng.range(-h / 2 + sh / 2 + 0.04, h / 2 - sh / 2 - 0.04), 0.0);
    a.g('paper', g);
    const pin = cyl(0.005, 0.005, 0.008, 6); pin.rotateX(Math.PI / 2);
    pin.translate(g.boundingBox ? 0 : 0, 0, 0);
    a.g('warningRed', pin);
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, collide: false, shade: false, ...o });
}

/** Coat hook rail. */
export function coatHooks(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.9, hooks = 5, coats = 0 } = o;
  const a = A(seed); a.height = 0.2; const rng = a.rng;
  const rail = P(w, 0.075, 0.022, 0.005); rail.translate(0, 0, -0.011);
  a.g('woodDark', rail);
  for (let i = 0; i < hooks; i++) {
    const hx = -w / 2 + (i + 0.5) * (w / hooks);
    const base = P(0.032, 0.032, 0.02, 0.005); base.translate(hx, 0, 0.01);
    const arm = P(0.014, 0.014, 0.062, 0.005); arm.translate(hx, -0.012, 0.045);
    const up = P(0.014, 0.03, 0.014, 0.005); up.translate(hx, 0.0, 0.07);
    a.g('chrome', base, arm, up);
    if (rng() < coats) {
      const cw = rng.range(0.24, 0.34);
      const coat = P(cw, rng.range(0.55, 0.85), 0.07, 0.03);
      coat.rotateZ(rng.range(-0.06, 0.06));
      coat.translate(hx, -0.36, 0.03);
      a.g('fabric', coat);
    }
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.3, collide: false, shade: false, ...o });
}

/** Column radiator with valves and tails to the floor. */
export function radiator(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.90, h = 0.60, cols = null } = o;
  const a = A(seed); a.height = h + 0.12;
  const n = cols ?? Math.max(6, Math.round(w / 0.07));
  const off = 0.12;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + (i + 0.5) * (w / n);
    const fin = P(w / n - 0.012, h, 0.075, 0.012); fin.translate(cx, off + h / 2, 0);
    a.g('plasticWhite', fin);
  }
  for (const yy of [off + 0.03, off + h - 0.03]) {
    const man = cyl(0.024, 0.024, w, 10); man.rotateZ(Math.PI / 2); man.translate(0, yy, 0);
    a.g('plasticWhite', man);
  }
  for (const sgn of [-1, 1]) {
    const brk = P(0.03, 0.10, 0.10, 0.004); brk.translate(sgn * (w / 2 - 0.10), off + h - 0.09, -0.05);
    a.g('steelCabinet', brk);
  }
  const v1 = pipeRun([[-w / 2 + 0.05, off + 0.03, 0], [-w / 2 + 0.05, 0.02, 0]], 0.014, 8, 6);
  const v2 = pipeRun([[w / 2 - 0.05, off + 0.03, 0], [w / 2 - 0.05, 0.02, 0]], 0.014, 8, 6);
  a.g('copper', v1, v2);
  for (const sgn of [-1, 1]) {
    const vb = lathe([[0, 0], [0.028, 0], [0.03, 0.035], [0.022, 0.045], [0.022, 0.07], [0, 0.07]], 10);
    vb.translate(sgn * (w / 2 - 0.05), off - 0.09, 0);
    a.g('chrome', vb);
  }
  a.col(0, off + h / 2, 0, w, h, 0.10);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, shadeTop: h + 0.12, ...o });
}

/** Water cooler with an inverted bottle. */
export function waterCooler(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, bottle = 0.6 } = o;
  const a = A(seed); a.height = 1.62;
  const cab = P(0.34, 0.98, 0.34, 0.014); cab.translate(0, 0.49, 0);
  a.g('plasticWhite', cab);
  const plinth = P(0.30, 0.05, 0.30, 0.006); plinth.translate(0, 0.025, 0);
  a.g('rubber', plinth);
  const recess = P(0.22, 0.20, 0.06, 0.008); recess.translate(0, 0.72, 0.15);
  a.g('glassDark', recess);
  for (const [tx, col] of [[-0.05, 'plasticGrey'], [0.05, 'warningRed']]) {
    const tap = P(0.035, 0.05, 0.06, 0.008); tap.translate(tx, 0.80, 0.17);
    const sp = cyl(0.008, 0.008, 0.05, 8); sp.translate(tx, 0.76, 0.19);
    a.g(col, tap); a.g('chrome', sp);
  }
  const tray = P(0.22, 0.012, 0.07, 0.003); tray.translate(0, 0.66, 0.17);
  a.g('grilleMetal', tray);
  const shoulder = lathe([[0.17, 0], [0.175, 0.03], [0.16, 0.06], [0, 0.075]], 16);
  shoulder.translate(0, 0.98, 0);
  a.g('plasticWhite', shoulder);
  if (bottle > 0) {
    const bh = 0.50;
    const bg = lathe([[0.02, 0], [0.14, 0.04], [0.155, 0.10], [0.155, bh - 0.10], [0.14, bh - 0.02], [0.11, bh]], 18);
    bg.translate(0, 1.03, 0);
    a.g('glassDark', bg);
    const water = cyl(0.148, 0.135, bh * bottle, 16); water.translate(0, 1.06 + (bh * bottle) / 2, 0);
    a.g('glassDark', water);
  }
  a.col(0, 0.55, 0, 0.36, 1.1, 0.36);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: 1.5, ...o });
}

/** Surface-mounted distribution board / consumer unit. */
export function distributionBoard(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.52, h = 0.68, open = false, ways = 12 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const encl = P(w, h, 0.115, 0.008); encl.translate(0, 0, -0.058);
  a.g('steelCabinet', encl);
  // Back plate + DIN rail + breakers, only worth building if it can be seen.
  const rail = P(w - 0.10, 0.035, 0.014, 0.002); rail.translate(0, h * 0.10, -0.03);
  a.g('chrome', rail);
  for (let i = 0; i < ways; i++) {
    const bx = -(w - 0.13) / 2 + (i + 0.5) * ((w - 0.13) / ways);
    const br = P((w - 0.13) / ways - 0.003, 0.078, 0.05, 0.004);
    br.translate(bx, h * 0.10 + 0.02, -0.012);
    a.g('plasticWhite', br);
    const tog = P(0.010, 0.022, 0.014, 0.003);
    tog.translate(bx, h * 0.10 + 0.02 + (rng.chance(0.2) ? -0.018 : 0.018), 0.014);
    a.g(rng.chance(0.2) ? 'warningRed' : 'rubber', tog);
  }
  const main = P(0.09, 0.09, 0.055, 0.005); main.translate(-(w / 2) + 0.075, h * 0.10 + 0.02, -0.012);
  a.g('plasticGrey', main);
  const door = P(w - 0.01, h - 0.01, 0.018, 0.005);
  if (open) { door.translate((w - 0.01) / 2, 0, 0.01); door.rotateY(-1.45); door.translate(-(w - 0.01) / 2, 0, 0); }
  else door.translate(0, 0, 0.008);
  a.g('steelCabinet', door);
  const lbl = P(0.16, 0.10, 0.003, 0.001);
  if (open) { lbl.translate((w - 0.01) / 2, h * 0.28, 0.021); lbl.rotateY(-1.45); lbl.translate(-(w - 0.01) / 2, 0, 0); }
  else lbl.translate(0, h * 0.28, 0.019);
  a.g('paper', lbl);
  for (const sgn of [-1, 1]) {
    const gland = cyl(0.018, 0.018, 0.03, 8); gland.translate(sgn * w * 0.28, h / 2 + 0.012, -0.05);
    a.g('chrome', gland);
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, collide: false, shade: false, ...o });
}

/** Small junction box with cable glands. */
export function junctionBox(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.14, h = 0.14, d = 0.07 } = o;
  const a = A(seed); a.height = h;
  const body = P(w, h, d, 0.007); body.translate(0, 0, -d / 2);
  const lid = P(w - 0.008, h - 0.008, 0.012, 0.003); lid.translate(0, 0, 0.005);
  a.g('plasticGrey', body, lid);
  for (const [gx, gy] of [[0, -h / 2], [0, h / 2], [-w / 2, 0]]) {
    const g = cyl(0.011, 0.013, 0.022, 8);
    if (gx) g.rotateZ(Math.PI / 2);
    g.translate(gx * 1.05, gy * 1.05, -d / 2);
    a.g('chrome', g);
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.25, collide: false, shade: false, ...o });
}

/**
 * Pipe run with flanges, brackets, valves and gauges.
 * `points` are LOCAL waypoints; pass world points and x/y/z = 0 for a global run.
 */
export function pipework(b, points, o = {}) {
  const {
    seed = 1, radius = 0.06, key = 'copper', valves = [], gauges = [],
    bracketEvery = 2.4, lagged = false, x = 0, y = 0, z = 0,
  } = o;
  const a = A(seed); const rng = a.rng;
  const pipe = pipeRun(points, radius, 10, 4);
  a.g(lagged ? 'plasticWhite' : key, pipe);
  // Flanges at each interior waypoint.
  for (let i = 1; i < points.length - 1; i++) {
    const f = cyl(radius * 1.55, radius * 1.55, radius * 0.5, 12);
    const pv = new THREE.Vector3(...points[i]);
    const dir = new THREE.Vector3(...points[i + 1]).sub(new THREE.Vector3(...points[i - 1])).normalize();
    orientTo(f, dir);
    f.translate(pv.x, pv.y, pv.z);
    a.g(key, f);
  }
  // Brackets along each straight.
  for (let i = 1; i < points.length; i++) {
    const p0 = new THREE.Vector3(...points[i - 1]), p1 = new THREE.Vector3(...points[i]);
    const len = p0.distanceTo(p1);
    const dir = p1.clone().sub(p0).normalize();
    for (let dd = bracketEvery * 0.5; dd < len; dd += bracketEvery) {
      const p = p0.clone().addScaledVector(dir, dd);
      const clamp_ = cyl(radius * 1.35, radius * 1.35, 0.026, 12);
      orientTo(clamp_, dir); clamp_.translate(p.x, p.y, p.z);
      a.g('steelCabinet', clamp_);
      // Drop rod up to the soffit if the run is horizontal.
      if (Math.abs(dir.y) < 0.4) {
        const rod = cyl(0.008, 0.008, 0.30, 6); rod.translate(p.x, p.y + radius + 0.15, p.z);
        a.g('steelCabinet', rod);
      }
    }
  }
  for (const v of valves) {
    const pv = new THREE.Vector3(...v.at);
    const bodyG = cyl(radius * 1.7, radius * 1.7, radius * 2.0, 12); bodyG.translate(pv.x, pv.y, pv.z);
    a.g('machinePaint', bodyG);
    const stem = cyl(0.014, 0.014, radius * 2.6, 8); stem.translate(pv.x, pv.y + radius * 2.3, pv.z);
    a.g('chrome', stem);
    const wheelR = v.wheel ?? radius * 2.4;
    const wheel = new THREE.TorusGeometry(wheelR, 0.014, 6, 18);
    wheel.rotateX(Math.PI / 2); wheel.translate(pv.x, pv.y + radius * 3.4, pv.z);
    a.g('warningRed', wheel);
    for (let s = 0; s < 4; s++) {
      const sp = P(wheelR * 2, 0.012, 0.016, 0.004);
      sp.rotateY((s / 4) * Math.PI); sp.translate(pv.x, pv.y + radius * 3.4, pv.z);
      a.g('warningRed', sp);
    }
  }
  for (const gp of gauges) {
    const pv = new THREE.Vector3(...gp.at);
    const stem = cyl(0.01, 0.01, 0.10, 8); stem.translate(pv.x, pv.y + 0.05, pv.z);
    const face = cyl(0.055, 0.055, 0.026, 14); face.rotateX(Math.PI / 2);
    face.rotateY(gp.yaw || 0); face.translate(pv.x, pv.y + 0.13, pv.z);
    a.g('chrome', stem, face);
    const dial = cyl(0.046, 0.046, 0.004, 14); dial.rotateX(Math.PI / 2);
    dial.translate(pv.x, pv.y + 0.13, pv.z + 0.015);
    a.g('paper', dial);
  }
  return emitProp(b, a, { x, y, z, uv: 0.6, shade: false, collide: false, ...o });
}

function orientTo(geo, dir) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  geo.applyQuaternion(q);
  return geo;
}

/** Leaning or fixed ladder. */
export function ladder(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, h = 2.6, w = 0.42, lean = 0.18, key = 'chrome' } = o;
  const a = A(seed); a.height = h * Math.cos(lean);
  for (const sgn of [-1, 1]) {
    const st = P(0.032, h, 0.058, 0.008);
    st.rotateX(lean);
    st.translate(sgn * w / 2, h / 2 * Math.cos(lean), -h / 2 * Math.sin(lean));
    a.g(key, st);
  }
  const n = Math.floor(h / 0.28);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const r = P(w, 0.024, 0.036, 0.006);
    r.translate(0, h * t * Math.cos(lean), -h * t * Math.sin(lean));
    a.g(key, r);
  }
  a.col(0, h * 0.35, -h * 0.18, w + 0.08, h * 0.7, 0.4);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, shadeTop: h, ...o });
}

/** Mobile scaffold tower with a boarded deck and toeboards. */
export function scaffoldTower(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.35, d = 0.75, deckH = 2.1 } = o;
  const a = A(seed); a.height = deckH + 1.05;
  const H = deckH + 1.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = rtube(H, 0.024); post.translate(sx * w / 2, H / 2, sz * d / 2);
    a.g('chrome', post);
    castor(a, sx * w / 2, sz * d / 2, 'plasticGrey', 0.055);
  }
  for (const hy of [0.55, 1.3, deckH, deckH + 0.5, deckH + 1.0]) {
    for (const sz of [-1, 1]) {
      const led = rtube(w, 0.019, 'x'); led.translate(0, hy, sz * d / 2);
      a.g('chrome', led);
    }
    for (const sx of [-1, 1]) {
      const led = rtube(d, 0.019, 'z'); led.translate(sx * w / 2, hy, 0);
      a.g('chrome', led);
    }
  }
  for (const sz of [-1, 1]) {
    const brace = rtube(Math.hypot(w, deckH - 0.55), 0.016);
    brace.rotateZ(Math.atan2(w, deckH - 0.55));
    brace.translate(0, (0.55 + deckH) / 2, sz * d / 2);
    a.g('chrome', brace);
  }
  const nb = 4;
  for (let i = 0; i < nb; i++) {
    const bd = P(w - 0.03, 0.032, d / nb - 0.012, 0.005);
    bd.translate(0, deckH + 0.016, -d / 2 + (i + 0.5) * (d / nb));
    a.g('woodDark', bd);
  }
  for (const sz of [-1, 1]) {
    const tb = P(w, 0.14, 0.022, 0.004); tb.translate(0, deckH + 0.10, sz * (d / 2 - 0.02));
    a.g('woodDark', tb);
  }
  a.col(0, 1.0, 0, w + 0.1, 2.0, d + 0.1);
  a.col(0, deckH + 0.05, 0, w, 0.1, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: H, ...o });
}

/** Pegboard tool board with a few tools and their painted shadows. */
export function toolBoard(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.2, h = 0.9, tools = 0.6 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const board = P(w, h, 0.014, 0.004); board.translate(0, 0, -0.007);
  a.g('cardboard', board);
  const cols = Math.floor(w / 0.05), rows = Math.floor(h / 0.05);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (hash2(i * 7, j * 13) > 0.5) continue;
    const hole = cyl(0.004, 0.004, 0.02, 5); hole.rotateX(Math.PI / 2);
    hole.translate(-w / 2 + (i + 0.5) * (w / cols), -h / 2 + (j + 0.5) * (h / rows), -0.006);
    a.g('rubber', hole);
  }
  const kinds = ['hammer', 'spanner', 'saw', 'pliers', 'screwdriver', 'spanner'];
  for (let i = 0; i < 8; i++) {
    const tx = -w / 2 + 0.12 + (i % 4) * (w - 0.24) / 3;
    const ty = h / 2 - 0.18 - Math.floor(i / 4) * 0.32;
    const kind = rng.pick(kinds);
    if (rng() > tools) continue;
    if (kind === 'hammer') {
      const hd = P(0.10, 0.035, 0.032, 0.006); hd.translate(tx, ty + 0.10, 0.022);
      const hh = P(0.022, 0.24, 0.022, 0.006); hh.translate(tx, ty - 0.02, 0.02);
      a.g('chrome', hd); a.g('woodDark', hh);
    } else if (kind === 'saw') {
      const bl = P(0.34, 0.09, 0.004, 0.001); bl.rotateZ(-0.2); bl.translate(tx, ty, 0.016);
      const hn = P(0.09, 0.10, 0.02, 0.008); hn.translate(tx - 0.19, ty + 0.05, 0.02);
      a.g('chrome', bl); a.g('woodDark', hn);
    } else if (kind === 'spanner') {
      const sh = P(0.024, 0.24, 0.010, 0.004); sh.rotateZ(rng.range(-0.2, 0.2)); sh.translate(tx, ty, 0.018);
      const j1 = P(0.05, 0.05, 0.012, 0.008); j1.translate(tx, ty + 0.12, 0.018);
      a.g('chrome', sh, j1);
    } else if (kind === 'pliers') {
      for (const s of [-1, 1]) {
        const l = P(0.014, 0.20, 0.010, 0.004); l.rotateZ(s * 0.08); l.translate(tx + s * 0.012, ty, 0.018);
        a.g('chrome', l);
      }
    } else {
      const sh = P(0.012, 0.17, 0.012, 0.005); sh.translate(tx, ty, 0.017);
      const hd = P(0.026, 0.08, 0.026, 0.010); hd.translate(tx, ty - 0.11, 0.018);
      a.g('chrome', sh); a.g('warningRed', hd);
    }
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, collide: false, shade: false, ...o });
}

/** Heavy workbench with a vice and an under-shelf. */
export function workbench(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.9, d = 0.72, h = 0.88, vice = true } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const top = P(w, 0.055, d, 0.006); top.translate(0, h - 0.027, 0);
  weather(top, 0.003, 0.3, seed);
  a.g('woodDark', top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = P(0.075, h - 0.055, 0.075, 0.008);
    leg.translate(sx * (w / 2 - 0.09), (h - 0.055) / 2, sz * (d / 2 - 0.09));
    a.g('woodDark', leg);
  }
  for (const sx of [-1, 1]) {
    const rail = P(0.05, 0.10, d - 0.20, 0.006); rail.translate(sx * (w / 2 - 0.09), 0.20, 0);
    a.g('woodDark', rail);
  }
  const shelf = P(w - 0.20, 0.024, d - 0.22, 0.004); shelf.translate(0, 0.26, 0);
  a.g('woodDark', shelf);
  if (vice) {
    const vx = -w / 2 + 0.30;
    const base = P(0.13, 0.09, 0.13, 0.008); base.translate(vx, h + 0.045, d / 2 - 0.10);
    const jaw1 = P(0.15, 0.09, 0.035, 0.006); jaw1.translate(vx, h + 0.10, d / 2 - 0.02);
    const jaw2 = P(0.15, 0.09, 0.035, 0.006); jaw2.translate(vx, h + 0.10, d / 2 - 0.10);
    const screw = cyl(0.014, 0.014, 0.24, 8); screw.rotateX(Math.PI / 2); screw.translate(vx, h + 0.075, d / 2 + 0.03);
    const hbar = cyl(0.010, 0.010, 0.22, 6); hbar.rotateZ(Math.PI / 2); hbar.translate(vx, h + 0.075, d / 2 + 0.13);
    a.g('machinePaint', base, jaw1, jaw2); a.g('chrome', screw, hbar);
  }
  for (let i = 0; i < 4; i++) {
    if (!rng.chance(0.6)) continue;
    const s = rng.range(0.05, 0.13);
    const it = P(s, s * 0.4, s * 0.7, 0.008);
    it.rotateY(rng() * TAU);
    it.translate(rng.range(-w / 2 + 0.4, w / 2 - 0.2), h + s * 0.2, rng.range(-0.2, 0.2));
    a.g(rng.chance(0.5) ? 'chrome' : 'cardboard', it);
  }
  a.col(0, h / 2, 0, w, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.55, shadeTop: h, ...o });
}

// ---------------------------------------------------------------------------
// residential
// ---------------------------------------------------------------------------

/** Steel-tube bed frame with a stained mattress and optional bedding. */
export function bed(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.92, len = 1.95, damage = 0.4, bedding = true, mattress: hasMat = true } = o;
  const a = A(seed); a.height = 0.62; const rng = a.rng;
  const frameH = 0.28;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = rtube(frameH, 0.016); leg.translate(sx * (w / 2 - 0.03), frameH / 2, sz * (len / 2 - 0.04));
    a.g('chrome', leg);
  }
  for (const sx of [-1, 1]) {
    const r = rtube(len - 0.05, 0.018, 'z'); r.translate(sx * (w / 2 - 0.03), frameH, 0);
    a.g('chrome', r);
  }
  for (const sz of [-1, 1]) {
    const r = rtube(w - 0.05, 0.018, 'x'); r.translate(0, frameH, sz * (len / 2 - 0.04));
    a.g('chrome', r);
  }
  // Headboard.
  const hbH = 0.52;
  for (const sx of [-1, 1]) {
    const p = rtube(hbH, 0.016); p.translate(sx * (w / 2 - 0.03), frameH + hbH / 2, -(len / 2 - 0.04));
    a.g('chrome', p);
  }
  const hbTop = rtube(w - 0.05, 0.016, 'x'); hbTop.translate(0, frameH + hbH, -(len / 2 - 0.04));
  a.g('chrome', hbTop);
  for (let i = 0; i < 5; i++) {
    const v = rtube(hbH - 0.04, 0.008); v.translate(-w / 2 + 0.10 + i * ((w - 0.20) / 4), frameH + hbH / 2, -(len / 2 - 0.04));
    a.g('chrome', v);
  }
  const ns = 9;
  for (let i = 0; i < ns; i++) {
    const sl = P(w - 0.10, 0.014, 0.06, 0.003);
    sl.translate(0, frameH - 0.01, -len / 2 + 0.10 + i * ((len - 0.20) / (ns - 1)));
    a.g('woodDark', sl);
  }
  if (hasMat) {
    const mh = 0.15;
    const mg = new THREE.BoxGeometry(w - 0.04, mh, len - 0.06, 3, 2, 6);
    const pos = mg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = clamp01((pos.getY(i) + mh / 2) / mh);
      const s = Math.abs(pos.getZ(i)) / (len / 2);
      pos.setY(i, pos.getY(i) - (1 - s) * 0.018 * (1 + damage) * t);
    }
    pos.needsUpdate = true;
    weather(mg, 0.006, 0.25, seed + 5);
    mg.translate(0, frameH + mh / 2, 0);
    a.g('mattress', mg);
    if (bedding) {
      const bl = new THREE.BoxGeometry(w - 0.02, 0.06, len * rng.range(0.42, 0.62), 3, 1, 4);
      weather(bl, 0.02, 0.2, seed + 9);
      bl.translate(rng.range(-0.03, 0.03), frameH + mh + 0.03, rng.range(0.1, 0.35));
      a.g('fabric', bl);
      const pil = new THREE.BoxGeometry(w * 0.5, 0.09, 0.34, 2, 1, 2);
      weather(pil, 0.012, 0.2, seed + 11);
      pil.rotateY(rng.range(-0.3, 0.3));
      pil.translate(rng.range(-0.15, 0.15), frameH + mh + 0.05, -len / 2 + 0.28);
      a.g('mattress', pil);
    }
  }
  a.col(0, 0.24, 0, w, 0.48, len);
  a.col(0, frameH + hbH / 2 + 0.1, -(len / 2 - 0.04), w, hbH, 0.08);
  a.height = frameH + hbH;
  return emitProp(b, a, { x, y, z, yaw, uv: 0.6, shadeTop: 0.8, ...o });
}

/** Veneered wardrobe with a cornice, plinth and one door ajar. */
export function wardrobe(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.02, d = 0.56, h = 1.96, ajar = null } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const carc = P(w, h - 0.16, d, 0.008); carc.translate(0, 0.08 + (h - 0.16) / 2, -0.01);
  a.g('woodDark', carc);
  const plinth = P(w - 0.03, 0.08, d - 0.03, 0.005); plinth.translate(0, 0.04, -0.01);
  a.g('rubber', plinth);
  const corn = P(w + 0.05, 0.075, d + 0.04, 0.008); corn.translate(0, h - 0.038, -0.01);
  a.g('woodDark', corn);
  const openAmt = ajar ?? (rng.chance(0.4) ? rng.range(0.25, 0.95) : 0);
  for (const sgn of [-1, 1]) {
    const dw = w / 2 - 0.01;
    const door = P(dw - 0.006, h - 0.20, 0.022, 0.005);
    const panel = P(dw - 0.10, h - 0.34, 0.008, 0.003);
    const hx = sgn * (w / 2 - 0.01);
    const rot = sgn > 0 ? -openAmt : 0;
    for (const g of [door, panel]) {
      g.translate(-sgn * dw / 2, 0, g === panel ? 0.016 : 0.011);
      g.rotateY(rot);
      g.translate(hx, 0.08 + (h - 0.16) / 2, d / 2 - 0.01);
      a.g('woodDark', g);
    }
    const hnd = P(0.018, 0.10, 0.024, 0.006);
    hnd.translate(-sgn * (dw - 0.06), 0, 0.03); hnd.rotateY(rot);
    hnd.translate(hx, 0.08 + (h - 0.16) / 2, d / 2 - 0.01);
    a.g('chrome', hnd);
  }
  if (openAmt > 0.4) {
    const rail = cyl(0.012, 0.012, w - 0.08, 8); rail.rotateZ(Math.PI / 2); rail.translate(0, h - 0.30, -0.01);
    a.g('chrome', rail);
    const nh = rng.int(0, 4);
    for (let i = 0; i < nh; i++) {
      const hg = P(0.03, 0.08, 0.03, 0.006); hg.translate(-w / 2 + 0.15 + i * 0.12, h - 0.34, -0.01);
      const cl = P(0.36, 0.62, 0.06, 0.02); cl.rotateY(rng.range(-0.2, 0.2));
      cl.translate(-w / 2 + 0.15 + i * 0.12, h - 0.72, -0.02);
      a.g('chrome', hg); a.g('fabric', cl);
    }
  }
  a.col(0, h / 2, 0, w, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.6, shadeTop: h, ...o });
}

/** Bedside table with a drawer and a shelf. */
export function bedsideTable(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.42, d = 0.36, h = 0.56 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const top = P(w, 0.026, d, 0.005); top.translate(0, h - 0.013, 0);
  a.g('woodDark', top);
  const body = P(w - 0.04, h - 0.18, d - 0.03, 0.006); body.translate(0, 0.10 + (h - 0.18) / 2, -0.01);
  a.g('woodDark', body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = P(0.028, 0.11, 0.028, 0.006); leg.translate(sx * (w / 2 - 0.035), 0.055, sz * (d / 2 - 0.035));
    a.g('woodDark', leg);
  }
  const out = rng.chance(0.3) ? rng.range(0.04, 0.14) : 0;
  const df = drawerFront(w - 0.06, 0.14, d - 0.03, 'cup'); df.translate(0, h - 0.13, out);
  a.g('woodDark', df);
  a.col(0, h / 2, 0, w, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: h, ...o });
}

/** Hard-shell suitcase, standing or flat, latches and all. */
export function suitcase(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, standing = false, w = 0.62, h = 0.44, d = 0.19, open = false } = o;
  const a = A(seed);
  const shell = P(w, h, d, 0.024); shell.translate(0, h / 2, 0);
  a.g('plasticGrey', shell);
  for (let i = 0; i < 4; i++) {
    const rib = P(0.014, h + 0.004, d + 0.004, 0.004);
    rib.translate(-w / 2 + 0.10 + i * ((w - 0.20) / 3), h / 2, 0);
    a.g('plasticGrey', rib);
  }
  const seam = P(w + 0.006, 0.012, d + 0.006, 0.003); seam.translate(0, h * 0.52, 0);
  a.g('rubber', seam);
  const hd = P(0.14, 0.022, 0.028, 0.008); hd.translate(0, h + 0.03, 0);
  const h1 = P(0.02, 0.05, 0.02, 0.005); h1.translate(-0.06, h + 0.012, 0);
  const h2 = h1.clone(); h2.translate(0.12, 0, 0);
  a.g('rubber', hd); a.g('plasticGrey', h1, h2);
  for (const sx of [-1, 1]) {
    const l = P(0.05, 0.035, d + 0.008, 0.006); l.translate(sx * 0.16, h * 0.52, 0);
    a.g('chrome', l);
  }
  a.height = standing ? h : d;
  if (!standing) {
    for (const [key, geos] of a.m) for (const g of geos) { g.rotateX(Math.PI / 2); g.translate(0, d / 2, 0); }
    a.col(0, d / 2, 0, w, d, h);
  } else a.col(0, h / 2, 0, w, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: a.height, ...o });
}

/** Dead CRT television. */
export function television(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.60, h = 0.46, d = 0.48 } = o;
  const a = A(seed); a.height = h;
  const body = new THREE.BoxGeometry(w, h, d, 1, 1, 2);
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01((pos.getZ(i) + d / 2) / d);
    const k = lerp(0.62, 1, t);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i));
  }
  pos.needsUpdate = true;
  body.translate(0, h / 2, 0);
  a.g('plasticGrey', body);
  const bezel = P(w - 0.02, h - 0.02, 0.03, 0.014); bezel.translate(0, h / 2, d / 2 + 0.006);
  a.g('plasticGrey', bezel);
  const scr = new THREE.SphereGeometry(0.60, 12, 8, 0, TAU, 0, 0.42);
  scr.scale(1, 1, 0.10); scr.rotateX(Math.PI / 2);
  scr.scale((w - 0.11) / 0.5, (h - 0.11) / 0.5, 1);
  scr.translate(0, h / 2, d / 2 + 0.012);
  a.g('glassDark', scr);
  for (let i = 0; i < 4; i++) {
    const bt = cyl(0.010, 0.010, 0.014, 8); bt.rotateX(Math.PI / 2);
    bt.translate(w / 2 - 0.06, h * 0.16 + i * 0.045, d / 2 + 0.018);
    a.g('plasticGrey', bt);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = P(0.05, 0.016, 0.05, 0.004); f.translate(sx * (w / 2 - 0.08), 0.008, sz * (d / 2 - 0.10));
    a.g('rubber', f);
  }
  a.col(0, h / 2, 0, w, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.45, shadeTop: h, ...o });
}

// ---------------------------------------------------------------------------
// sanitary
// ---------------------------------------------------------------------------

/** Wall-hung basin with pillar taps and a bottle trap. */
export function sink(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.52, d = 0.42, h = 0.82, taps = 2 } = o;
  const a = A(seed); a.height = h;
  const bowl = new THREE.BoxGeometry(w, 0.16, d, 2, 1, 2);
  const pos = bowl.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01((pos.getY(i) + 0.08) / 0.16);
    pos.setXYZ(i, pos.getX(i) * lerp(0.78, 1, t), pos.getY(i), pos.getZ(i) * lerp(0.78, 1, t));
  }
  pos.needsUpdate = true;
  bowl.translate(0, h - 0.08, 0);
  a.g('enamel', bowl);
  const back = P(w, 0.20, 0.06, 0.012); back.translate(0, h - 0.02, -d / 2 + 0.03);
  a.g('enamel', back);
  const inner = P(w - 0.13, 0.05, d - 0.13, 0.02); inner.translate(0, h - 0.045, 0.02);
  a.g('glassDark', inner);
  for (let i = 0; i < taps; i++) {
    const tx = taps === 1 ? 0 : (i - 0.5) * 0.16;
    const base = cyl(0.023, 0.026, 0.05, 10); base.translate(tx, h + 0.03, -d / 2 + 0.08);
    const spout = pipeRun([[tx, h + 0.06, -d / 2 + 0.08], [tx, h + 0.13, -d / 2 + 0.09], [tx * 0.4, h + 0.12, -d / 2 + 0.19]], 0.012, 8, 6);
    const hnd = P(0.055, 0.014, 0.014, 0.004); hnd.translate(tx, h + 0.075, -d / 2 + 0.075);
    a.g('chrome', base, spout, hnd);
  }
  const trap = pipeRun([[0, h - 0.16, 0.02], [0, h - 0.30, 0.02], [0, h - 0.34, -0.05], [0, h - 0.30, -d / 2 + 0.06]], 0.019, 8, 6);
  a.g('chrome', trap);
  for (const sx of [-1, 1]) {
    const br = P(0.035, 0.16, 0.10, 0.006); br.translate(sx * (w / 2 - 0.07), h - 0.16, -d / 2 + 0.05);
    a.g('steelCabinet', br);
  }
  a.col(0, h - 0.1, 0, w, 0.25, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.4, shadeTop: h, ...o });
}

/** Cracked mirror over a basin. */
export function mirror(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.56, h = 0.72, cracked = true } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const frame = P(w + 0.05, h + 0.05, 0.028, 0.006); frame.translate(0, 0, -0.014);
  a.g('chrome', frame);
  const glass = P(w, h, 0.010, 0.002); glass.translate(0, 0, 0.004);
  a.g('glassDark', glass);
  if (cracked) {
    const ox = rng.range(-w * 0.2, w * 0.2), oy = rng.range(-h * 0.2, h * 0.2);
    const n = rng.int(5, 9);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + rng.range(-0.3, 0.3);
      const len = rng.range(h * 0.3, h * 0.9);
      const cr = P(0.0035, len, 0.004, 0.0008);
      cr.translate(0, len / 2, 0); cr.rotateZ(ang); cr.translate(ox, oy, 0.010);
      a.g('rubber', cr);
    }
    for (let i = 0; i < 2; i++) {
      const rr = rng.range(0.05, 0.14);
      const ring = new THREE.TorusGeometry(rr, 0.0025, 4, 12);
      ring.translate(ox, oy, 0.010);
      a.g('rubber', ring);
    }
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.35, collide: false, shade: false, ...o });
}

/** Enamel bath with taps, standing on feet or panelled. */
export function bath(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.72, len = 1.70, h = 0.58, feet = true } = o;
  const a = A(seed); a.height = h;
  const shell = new THREE.BoxGeometry(w, h - 0.10, len, 2, 2, 3);
  const pos = shell.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01((pos.getY(i) + (h - 0.10) / 2) / (h - 0.10));
    const k = lerp(0.70, 1, t * t);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * lerp(0.88, 1, t));
  }
  pos.needsUpdate = true;
  shell.translate(0, 0.10 + (h - 0.10) / 2, 0);
  a.g('enamel', shell);
  const rim = P(w + 0.03, 0.04, len + 0.03, 0.014); rim.translate(0, h - 0.02, 0);
  a.g('enamel', rim);
  const inner = P(w - 0.14, 0.06, len - 0.18, 0.05); inner.translate(0, h - 0.08, 0);
  a.g('glassDark', inner);
  if (feet) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const f = lathe([[0, 0], [0.055, 0.01], [0.035, 0.05], [0.045, 0.10], [0.03, 0.11], [0, 0.11]], 10);
      f.translate(sx * (w / 2 - 0.12), 0, sz * (len / 2 - 0.22));
      a.g('chrome', f);
    }
  }
  for (const sx of [-1, 1]) {
    const t = cyl(0.024, 0.026, 0.09, 10); t.translate(sx * 0.09, h, -len / 2 + 0.11);
    const hn = P(0.05, 0.016, 0.016, 0.004); hn.translate(sx * 0.09, h + 0.07, -len / 2 + 0.11);
    a.g('chrome', t, hn);
  }
  const spout = pipeRun([[0, h + 0.03, -len / 2 + 0.11], [0, h + 0.12, -len / 2 + 0.12], [0, h + 0.10, -len / 2 + 0.24]], 0.014, 8, 6);
  a.g('chrome', spout);
  a.col(0, h / 2, 0, w, h, len);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: h, ...o });
}

/** WC cubicle partition run: `n` bays, panels, feet, doors with indicators. */
export function cubicles(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, n = 3, bay = 0.92, depth = 1.35, h = 2.0, floorGap = 0.16 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const totalW = n * bay;
  for (let i = 0; i <= n; i++) {
    const px = -totalW / 2 + i * bay;
    const div = P(0.026, h, depth, 0.006); div.translate(px, floorGap + h / 2, 0);
    a.g('laminate', div);
    for (const sz of [-1, 1]) {
      const foot = P(0.05, floorGap, 0.05, 0.008); foot.translate(px, floorGap / 2, sz * (depth / 2 - 0.12));
      a.g('chrome', foot);
    }
    a.col(px, floorGap + h / 2, 0, 0.04, h, depth);
  }
  const head = P(totalW + 0.04, 0.05, 0.05, 0.008); head.translate(0, floorGap + h, depth / 2 - 0.02);
  a.g('chrome', head);
  for (let i = 0; i < n; i++) {
    const px = -totalW / 2 + (i + 0.5) * bay;
    const open = rng.chance(0.45) ? rng.range(0.3, 1.4) : 0;
    const dw = bay - 0.08;
    const door = P(dw, h - 0.30, 0.024, 0.006);
    door.translate(dw / 2, 0, 0); door.rotateY(-open);
    door.translate(px - dw / 2, floorGap + 0.14 + (h - 0.30) / 2, depth / 2 - 0.012);
    a.g('laminate', door);
    const ind = P(0.05, 0.05, 0.012, 0.003);
    ind.translate(dw - 0.06, 0, 0.014); ind.rotateY(-open);
    ind.translate(px - dw / 2, floorGap + 1.05, depth / 2 - 0.012);
    a.g(open > 0.1 ? 'plasticGrey' : 'warningRed', ind);
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.6, shadeTop: h, ...o });
}

// ---------------------------------------------------------------------------
// public fittings
// ---------------------------------------------------------------------------

/** Bank of steel lockers. One is open, one is dented, one is padlocked. */
export function lockers(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, n = 4, bay = 0.31, d = 0.46, h = 1.82, tiers = 1, assets = null } = o;
  const glb = assets?.instance?.('locker');
  if (glb) {
    glb.position.set(x, y, z); glb.rotation.y = yaw;
    b.addObject(glb);
    b.addColliderAt(x, y + h / 2, z, n * bay, h, d, { tag: 'prop' });
    return { glb: true };
  }
  const a = A(seed); a.height = h; const rng = a.rng;
  const W = n * bay;
  const carc = P(W, h - 0.10, d, 0.006); carc.translate(0, 0.10 + (h - 0.10) / 2, -0.012);
  a.g('steelCabinet', carc);
  const plinth = P(W - 0.02, 0.10, d - 0.04, 0.004); plinth.translate(0, 0.05, -0.012);
  a.g('rubber', plinth);
  const topSlope = P(W + 0.01, 0.03, d, 0.004); topSlope.rotateX(-0.12); topSlope.translate(0, h - 0.01, -0.012);
  a.g('steelCabinet', topSlope);
  for (let i = 0; i <= n; i++) {
    const px = -W / 2 + i * bay;
    const div = P(0.012, h - 0.12, d, 0.002); div.translate(px, 0.10 + (h - 0.10) / 2, -0.012);
    a.g('steelCabinet', div);
  }
  for (let i = 0; i < n; i++) {
    const px = -W / 2 + (i + 0.5) * bay;
    for (let t = 0; t < tiers; t++) {
      const th = (h - 0.14) / tiers;
      const ty = 0.12 + th * (t + 0.5);
      const open = rng.chance(0.22) ? rng.range(0.5, 1.5) : 0;
      const dw = bay - 0.022;
      const door = P(dw, th - 0.012, 0.018, 0.004);
      if (open) {
        door.translate(dw / 2, 0, 0); door.rotateY(-open);
        door.translate(px - dw / 2, ty, d / 2 - 0.012);
      } else door.translate(px, ty, d / 2 - 0.003);
      if (rng.chance(0.25)) weather(door, 0.008, 0.2, seed + i);
      a.g('steelCabinet', door);
      // Louvres.
      for (let v = 0; v < 4; v++) {
        const lv = P(dw - 0.09, 0.008, 0.014, 0.002);
        lv.rotateX(-0.5);
        if (open) {
          lv.translate(dw / 2 - 0.0, th / 2 - 0.05 - v * 0.022, 0.012);
          lv.translate(-dw / 2 + dw / 2, 0, 0);
          lv.translate(dw / 2 - dw / 2, 0, 0);
          const tmp = lv;
          tmp.translate(dw / 2, 0, 0); tmp.rotateY(-open); tmp.translate(px - dw / 2, ty, d / 2 - 0.012);
        } else lv.translate(px, ty + th / 2 - 0.05 - v * 0.022, d / 2 + 0.006);
        a.g('steelCabinet', lv);
      }
      const hnd = P(0.016, 0.075, 0.022, 0.005);
      if (open) { hnd.translate(dw - 0.05, 0, 0.02); hnd.rotateY(-open); hnd.translate(px - dw / 2, ty - 0.05, d / 2 - 0.012); }
      else hnd.translate(px + bay * 0.30, ty - 0.05, d / 2 + 0.012);
      a.g('chrome', hnd);
      if (open > 0.2) {
        const shelf = P(dw - 0.02, 0.010, d - 0.05, 0.002); shelf.translate(px, ty + th / 2 - 0.30, -0.012);
        a.g('steelCabinet', shelf);
        if (rng.chance(0.5)) {
          const it = P(0.14, 0.20, 0.10, 0.02);
          it.rotateY(rng.range(-0.4, 0.4));
          it.translate(px, ty - th / 2 + 0.12, -0.05);
          a.g('fabric', it);
        }
      }
      const num = P(0.042, 0.026, 0.004, 0.001);
      if (!open) num.translate(px, ty + th / 2 - 0.05, d / 2 + 0.008);
      else { num.translate(dw - 0.10, th / 2 - 0.05, 0.012); num.rotateY(-open); num.translate(px - dw / 2, ty, d / 2 - 0.012); }
      a.g('paper', num);
    }
  }
  a.col(0, h / 2, 0, W, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: h, ...o });
}

/** Vending machine. Its header is the brightest thing in most rooms. */
export function vendingMachine(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 0.94, d = 0.78, h = 1.83, lit = true, empty = 0.4 } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const carc = P(w, h - 0.08, d, 0.010); carc.translate(0, 0.08 + (h - 0.08) / 2, -0.01);
  a.g('machinePaint', carc);
  const plinth = P(w - 0.03, 0.08, d - 0.04, 0.005); plinth.translate(0, 0.04, -0.01);
  a.g('rubber', plinth);
  // Glass front and its frame.
  const gw = w - 0.20, gh = h - 0.72;
  const glass = P(gw, gh, 0.012, 0.003); glass.translate(-0.05, 0.52 + gh / 2, d / 2 + 0.004);
  a.g('glassDark', glass);
  const fr = [[gw + 0.06, 0.05, -0.05, 0.52 - 0.025], [gw + 0.06, 0.05, -0.05, 0.52 + gh + 0.025],
  [0.05, gh + 0.10, -0.05 - gw / 2 - 0.025, 0.52 + gh / 2], [0.05, gh + 0.10, -0.05 + gw / 2 + 0.025, 0.52 + gh / 2]];
  for (const [fw, fh, fx, fy] of fr) {
    const g = P(fw, fh, 0.03, 0.005); g.translate(fx, fy, d / 2 + 0.006);
    a.g('machinePaint', g);
  }
  // Product spirals and stock.
  const rows = 5, cols = 6;
  for (let r = 0; r < rows; r++) {
    const sy = 0.60 + r * ((gh - 0.14) / rows);
    const sh = P(gw - 0.04, 0.008, d - 0.20, 0.002); sh.translate(-0.05, sy, 0.02);
    a.g('steelCabinet', sh);
    for (let c = 0; c < cols; c++) {
      const sx = -0.05 - gw / 2 + 0.06 + c * ((gw - 0.12) / (cols - 1));
      const coil = new THREE.TorusGeometry(0.028, 0.0035, 4, 10);
      for (let k = 0; k < 4; k++) {
        const t = coil.clone(); t.rotateX(Math.PI / 2); t.translate(sx, sy + 0.03, -0.14 + k * 0.09);
        a.g('chrome', t);
      }
      if (rng() > empty) {
        const pw = rng.range(0.045, 0.062);
        const pk = P(pw, rng.range(0.075, 0.11), 0.035, 0.008);
        pk.rotateY(rng.range(-0.2, 0.2));
        pk.translate(sx, sy + 0.06, d / 2 - 0.22 + rng.range(-0.02, 0.02));
        a.g(rng.chance(0.5) ? 'warningRed' : 'hazardYellow', pk);
      }
    }
  }
  // Header, keypad, coin slot, delivery flap.
  const hd = P(w - 0.06, 0.42, 0.05, 0.008); hd.translate(0, h - 0.26, d / 2 + 0.008);
  a.g(lit ? 'paper' : 'plasticGrey', hd);
  const kp = P(0.11, 0.34, 0.03, 0.006); kp.translate(w / 2 - 0.10, 1.10, d / 2 + 0.012);
  a.g('rubber', kp);
  for (let i = 0; i < 12; i++) {
    const bt = P(0.022, 0.018, 0.012, 0.003);
    bt.translate(w / 2 - 0.10 + ((i % 2) - 0.5) * 0.032, 0.98 + Math.floor(i / 2) * 0.045, d / 2 + 0.03);
    a.g('plasticGrey', bt);
  }
  const slot = P(0.06, 0.012, 0.02, 0.003); slot.translate(w / 2 - 0.10, 0.86, d / 2 + 0.026);
  a.g('chrome', slot);
  const flap = P(0.40, 0.20, 0.028, 0.008); flap.rotateX(0.18); flap.translate(-0.10, 0.28, d / 2 + 0.006);
  a.g('rubber', flap);
  a.col(0, h / 2, 0, w, h, d);
  const res = emitProp(b, a, { x, y, z, yaw, uv: 0.5, shadeTop: h, ...o });
  if (lit) {
    // The header panel is a real emissive surface, not a fake glow.
    const gG = P(w - 0.09, 0.36, 0.008, 0.003);
    gG.rotateY(yaw); gG.translate(x + Math.sin(yaw) * (d / 2 + 0.035), y + h - 0.26, z + Math.cos(yaw) * (d / 2 + 0.035));
    b.add('vendGlow', gG, () => b.materials.emissive(0xffd9a0, 1.5));
  }
  return res;
}

/** Wall payphone with a handset on an armoured cord. */
export function payphone(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, handsetOff = false } = o;
  const a = A(seed); a.height = 0.6;
  const body = P(0.26, 0.52, 0.15, 0.010); body.translate(0, 0, -0.075);
  a.g('steelCabinet', body);
  const hood = P(0.28, 0.06, 0.19, 0.010); hood.rotateX(-0.2); hood.translate(0, 0.26, -0.06);
  a.g('steelCabinet', hood);
  const kp = P(0.11, 0.16, 0.02, 0.004); kp.translate(0.03, 0.02, 0.012);
  a.g('rubber', kp);
  for (let i = 0; i < 12; i++) {
    const bt = P(0.022, 0.016, 0.008, 0.002);
    bt.translate(0.03 + ((i % 3) - 1) * 0.032, 0.07 - Math.floor(i / 3) * 0.038, 0.025);
    a.g('plasticGrey', bt);
  }
  const slot = P(0.05, 0.014, 0.014, 0.003); slot.translate(0.03, 0.19, 0.022);
  a.g('chrome', slot);
  const cradle = P(0.055, 0.10, 0.05, 0.010); cradle.translate(-0.095, 0.11, 0.026);
  a.g('steelCabinet', cradle);
  const hy = handsetOff ? -0.55 : 0.11;
  const hz = handsetOff ? 0.02 : 0.055;
  const hs = P(0.05, handsetOff ? 0.21 : 0.21, 0.05, 0.018);
  hs.rotateZ(handsetOff ? 0.25 : 0);
  hs.translate(-0.095, hy, hz);
  a.g('rubber', hs);
  const cordPts = handsetOff
    ? [[-0.095, 0.05, 0.03], [-0.13, -0.16, 0.08], [-0.10, -0.42, 0.04]]
    : [[-0.095, 0.03, 0.03], [-0.13, -0.06, 0.07], [-0.095, 0.02, 0.05]];
  const cord = pipeRun(cordPts, 0.011, 6, 8);
  a.g('chrome', cord);
  const shelf = P(0.30, 0.02, 0.16, 0.004); shelf.translate(0, -0.28, -0.02);
  a.g('steelCabinet', shelf);
  const book = P(0.16, 0.05, 0.12, 0.008); book.rotateY(0.2); book.translate(0.02, -0.245, -0.02);
  a.g('paper', book);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.35, collide: false, shade: false, ...o });
}

/** Wall-mounted drinking fountain. */
export function drinkingFountain(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0 } = o;
  const a = A(seed); a.height = 0.3;
  const bowl = new THREE.BoxGeometry(0.36, 0.13, 0.32, 2, 1, 2);
  const pos = bowl.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01((pos.getY(i) + 0.065) / 0.13);
    pos.setXYZ(i, pos.getX(i) * lerp(0.8, 1, t), pos.getY(i), pos.getZ(i) * lerp(0.8, 1, t));
  }
  pos.needsUpdate = true;
  bowl.translate(0, 0, 0.10);
  a.g('enamel', bowl);
  const basin = P(0.26, 0.04, 0.22, 0.02); basin.translate(0, 0.045, 0.10);
  a.g('glassDark', basin);
  const back = P(0.36, 0.30, 0.06, 0.008); back.translate(0, 0.09, -0.04);
  a.g('enamel', back);
  const bub = pipeRun([[0, 0.03, -0.02], [0, 0.09, -0.01], [0.0, 0.085, 0.03]], 0.009, 6, 8);
  a.g('chrome', bub);
  const btn = cyl(0.016, 0.016, 0.02, 8); btn.rotateX(Math.PI / 2); btn.translate(0.11, 0.10, -0.005);
  a.g('chrome', btn);
  const trap = pipeRun([[0, -0.02, 0.08], [0, -0.20, 0.08], [0, -0.22, -0.02]], 0.016, 8, 6);
  a.g('chrome', trap);
  a.col(0, 0, 0.06, 0.38, 0.3, 0.34);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.35, shade: false, ...o });
}

// ---------------------------------------------------------------------------
// small objects and story pieces
// ---------------------------------------------------------------------------

/** Anglepoise-ish desk lamp. Returns the bulb mesh position for a light. */
export function deskLamp(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, on = true } = o;
  const a = A(seed); a.height = 0.48;
  const base = lathe([[0, 0], [0.085, 0], [0.088, 0.012], [0.05, 0.02], [0.03, 0.025], [0, 0.025]], 14);
  a.g('machinePaint', base);
  const arm1 = P(0.016, 0.30, 0.016, 0.005); arm1.rotateX(0.30); arm1.translate(0, 0.17, -0.045);
  const joint = cyl(0.018, 0.018, 0.03, 8); joint.rotateZ(Math.PI / 2); joint.translate(0, 0.315, -0.09);
  const arm2 = P(0.016, 0.24, 0.016, 0.005); arm2.rotateX(-0.55); arm2.translate(0, 0.40, -0.03);
  a.g('machinePaint', arm1, arm2); a.g('chrome', joint);
  const shade = lathe([[0.02, 0], [0.085, -0.085], [0.088, -0.09], [0.024, -0.005]], 14);
  shade.rotateX(0.7); shade.translate(0, 0.47, 0.055);
  a.g('machinePaint', shade);
  a.col(0, 0.02, 0, 0.18, 0.05, 0.18);
  const res = emitProp(b, a, { x, y, z, yaw, uv: 0.3, shadeTop: 0.5, ...o });
  res.bulb = [x + Math.sin(yaw) * 0.05, y + 0.44, z + Math.cos(yaw) * 0.05];
  return res;
}

/** Electric kettle. */
export function kettle(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0 } = o;
  const a = A(seed); a.height = 0.25;
  const base = lathe([[0, 0], [0.085, 0], [0.088, 0.018], [0.075, 0.022], [0, 0.022]], 14);
  a.g('plasticGrey', base);
  const body = lathe([[0, 0.024], [0.078, 0.026], [0.082, 0.10], [0.070, 0.18], [0.060, 0.195], [0, 0.20]], 16);
  a.g('plasticWhite', body);
  const lid = lathe([[0, 0.205], [0.056, 0.20], [0.058, 0.212], [0.02, 0.222], [0, 0.222]], 14);
  a.g('plasticWhite', lid);
  const handle = pipeRun([[-0.07, 0.05, 0], [-0.13, 0.11, 0], [-0.12, 0.19, 0], [-0.06, 0.20, 0]], 0.011, 6, 8);
  a.g('rubber', handle);
  const spout = P(0.035, 0.04, 0.05, 0.014); spout.rotateX(-0.4); spout.translate(0.075, 0.17, 0);
  a.g('plasticWhite', spout);
  const win = P(0.014, 0.10, 0.03, 0.004); win.translate(-0.055, 0.11, 0.05);
  a.g('glassDark', win);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.25, collide: false, shadeTop: 0.25, ...o });
}

/** Bakelite transistor radio. */
export function radio(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, on = false } = o;
  const a = A(seed); a.height = 0.16;
  const body = P(0.26, 0.15, 0.09, 0.014); body.translate(0, 0.075, 0);
  a.g('woodDark', body);
  const grille_ = P(0.13, 0.10, 0.012, 0.004); grille_.translate(-0.05, 0.078, 0.045);
  a.g('fabric', grille_);
  for (let i = 0; i < 7; i++) {
    const sl = P(0.115, 0.004, 0.006, 0.001); sl.translate(-0.05, 0.115 - i * 0.013, 0.052);
    a.g('rubber', sl);
  }
  const dial = P(0.075, 0.045, 0.008, 0.003); dial.translate(0.065, 0.10, 0.046);
  a.g('paper', dial);
  const needle = P(0.003, 0.04, 0.005, 0.0008); needle.translate(0.05, 0.10, 0.05);
  a.g('warningRed', needle);
  for (const kx of [0.04, 0.09]) {
    const k = cyl(0.017, 0.019, 0.014, 10); k.rotateX(Math.PI / 2); k.translate(kx, 0.04, 0.05);
    a.g('rubber', k);
  }
  const ant = cyl(0.0035, 0.0035, 0.34, 6); ant.rotateZ(-0.35); ant.translate(0.10, 0.28, -0.03);
  a.g('chrome', ant);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.25, collide: false, shadeTop: 0.16, ...o });
}

/** A stack of carbon-copy forms, or a spill of loose paper. */
export function paperStack(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, sheets = 30, spilled = false, w = 0.21, d = 0.297 } = o;
  const a = A(seed); const rng = a.rng;
  if (spilled) {
    for (let i = 0; i < sheets; i++) {
      const g = P(w, 0.0012, d, 0.0004);
      g.rotateY(rng() * TAU);
      const r = rng() * rng.range(0.1, 0.9);
      const ang = rng() * TAU;
      g.rotateX(rng.range(-0.02, 0.02));
      g.translate(Math.sin(ang) * r, 0.001 + i * 0.0004, Math.cos(ang) * r);
      a.g('paper', g);
    }
    a.height = 0.02;
  } else {
    const h = sheets * 0.00011 + 0.004;
    const g = P(w, h, d, 0.001); g.translate(0, h / 2, 0);
    a.g('paper', g);
    for (let i = 0; i < 3; i++) {
      const s = P(w, 0.0012, d, 0.0004);
      s.rotateY(rng.range(-0.06, 0.06));
      s.translate(rng.range(-0.01, 0.01), h + 0.0012 * (i + 1), rng.range(-0.01, 0.01));
      a.g('paper', s);
    }
    a.height = h;
  }
  return emitProp(b, a, { x, y, z, yaw, uv: 0.3, collide: false, shadeTop: 0.05, ...o });
}

/**
 * A nest: blankets, a sleeping bag, tins, a torch. Somebody lived here for a
 * while and then did not.
 */
export function blanketNest(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, r = 0.9 } = o;
  const a = A(seed); a.height = 0.3; const rng = a.rng;
  for (let i = 0; i < 6; i++) {
    const bw = rng.range(0.5, 1.1), bd = rng.range(0.4, 0.9);
    const g = new THREE.BoxGeometry(bw, rng.range(0.05, 0.12), bd, 3, 1, 3);
    weather(g, 0.03, 0.25, seed + i * 7);
    g.rotateY(rng() * TAU);
    const ang = rng() * TAU, rr = rng() * r * 0.55;
    g.translate(Math.sin(ang) * rr, 0.04 + i * 0.022, Math.cos(ang) * rr);
    a.g(i % 2 ? 'fabric' : 'mattress', g);
  }
  for (let i = 0; i < 5; i++) {
    const rr = rng.range(0.035, 0.05);
    const tin = cyl(rr, rr, rng.range(0.05, 0.11), 12);
    const ang = rng() * TAU, dd = rng.range(r * 0.5, r);
    tin.rotateZ(rng.chance(0.4) ? Math.PI / 2 : 0);
    tin.translate(Math.sin(ang) * dd, 0.035, Math.cos(ang) * dd);
    a.g('chrome', tin);
  }
  const torch = cyl(0.026, 0.03, 0.16, 10); torch.rotateZ(Math.PI / 2); torch.rotateY(0.7);
  torch.translate(r * 0.4, 0.028, -r * 0.35);
  a.g('machinePaint', torch);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.5, collide: false, shadeTop: 0.35, ...o });
}

/**
 * A barricade: somebody dragged furniture across an opening. Composed of other
 * props so it inherits their damage vocabulary.
 */
export function barricade(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, width = 2.2 } = o;
  const rng = makeRng(seed);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  /** Local (across, out) -> world (x, z), with the barricade facing +v. */
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  const p1 = at(-width * 0.34, 0.05);
  filingCabinet(b, p1[0], y, p1[1], { seed: seed + 1, yaw: yaw + rng.range(-0.3, 0.3), drawers: 4, damage: 0.7 });
  const p2 = at(width * 0.12, -0.10);
  desk(b, p2[0], y, p2[1], { seed: seed + 2, yaw: yaw + Math.PI / 2 + rng.range(-0.2, 0.2), damage: 0.8, pedestal: 'none' });
  const p3 = at(width * 0.40, 0.18);
  shelving(b, p3[0], y, p3[1], { seed: seed + 3, yaw: yaw + rng.range(-0.4, 0.4), h: 1.2, bays: 3, damage: 0.8, contents: 0.3 });
  const p4 = at(-width * 0.05, 0.30);
  boxStack(b, p4[0], y, p4[1], { seed: seed + 4, count: 3 });
  for (let i = 0; i < 4; i++) {
    const p = at(rng.range(-width / 2, width / 2), rng.range(-0.35, 0.35));
    plasticChair(b, p[0], y + rng.range(0, 0.5), p[1], {
      seed: seed + 10 + i, yaw: rng() * TAU, collide: false,
    });
  }
}

/**
 * A row of identical objects with per-instance variation, using an
 * InstancedMesh so 60 of them cost one draw call. `make` returns [geo, key].
 */
export function instancedScatter(b, key, geo, placements, materialFactory = null) {
  const mat = materialFactory ? b.mat(key, materialFactory) : b.mat(key);
  const m = new THREE.InstancedMesh(geo, mat, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.rotation.set(p[3] || 0, p[4] || 0, p[5] || 0);
    const s = p[6] ?? 1;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = true; m.receiveShadow = true;
  m.computeBoundingSphere();
  b.addObject(m);
  return m;
}

export default {
  desk, officeChair, plasticChair, chairStack, filingCabinet, shelving,
  cardboardBox, boxStack, mopBucket, wetFloorSign, wasteBin, pallet, cableDrum,
  oilDrum, jerryCan, trolley, fireExtinguisher, firstAidBox, wallClock,
  noticeboard, coatHooks, radiator, waterCooler, distributionBoard, junctionBox,
  pipework, ladder, scaffoldTower, toolBoard, workbench, bed, wardrobe,
  bedsideTable, suitcase, television, sink, mirror, bath, cubicles, lockers,
  vendingMachine, payphone, drinkingFountain, deskLamp, kettle, radio,
  paperStack, blanketNest, barricade, emitProp, Acc, instancedScatter,
};
