import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, bulkhead, stripLight, emergencyLight,
  handrail, gantry, steelColumn, iBeam, channel, cagedLadder, stairFlight,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun } from '../../render/geo.js';

/**
 * THE STACK — the impossible one.
 *
 * A square light-well with a perimeter gantry, and identical office floors
 * going up and down past the limit of sight. It is the only place in the game
 * that admits, without a line of dialogue, that the building is not a building.
 *
 * How it is made honest without brute force:
 *
 *  * 15 REAL LEVELS on a 3.4 m rhythm, ±7 from the player's. The three nearest
 *    in each direction are fully detailed — deck, kickplate, handrail, mullions,
 *    door openings, a couple of lit offices. Beyond that the levels drop to a
 *    silhouette: deck edge, parapet band, mullion rhythm and a scatter of lit
 *    panes. At the distances involved that is all the eye can resolve anyway.
 *  * FOG DOES THE REST. The `stack` profile is thin and almost height-neutral
 *    with its base 20 m down, so extinction accumulates with pure distance up
 *    and down the shaft. Level 7 sits at ~24 m, deep enough that it is already
 *    half-dissolved; the last visible thing is a rhythm of lit panes with no
 *    edges, which reads as "more of this, forever".
 *  * THE VOID IS EMPTY, on purpose. One cable bundle hangs the full height and
 *    gives the eye something to fall along, and there is a single lit fixture a
 *    long way down. Nothing else. Vertigo needs an uninterrupted drop.
 */

const LEVEL = 3.40;
const VOID = 9.0;              // half-width of the open shaft
const OUTER = 11.4;            // half-width to the office facade
const UP = 7, DOWN = 7;

/** One office-facade band between two decks. */
function facade(b, y, { detail = 2, seed = 1, lit = 0.18 } = {}) {
  const parts = [], mull = [], glow = [];
  const h = LEVEL;
  const sides = [
    ['n', -OUTER, -OUTER, OUTER, -OUTER, 1],
    ['s', OUTER, OUTER, -OUTER, OUTER, 1],
    ['e', OUTER, -OUTER, OUTER, OUTER, 1],
    ['w', -OUTER, OUTER, -OUTER, -OUTER, 1],
  ];
  for (const [tag, ax, az, bx, bz] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);      // inward normal
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    // Spandrel band (solid) low, glazing above.
    const spandrel = box(0.16, 1.02, len, 0.008, 1);
    spandrel.rotateY(yaw); spandrel.translate(cx, y + 0.51, cz);
    parts.push(spandrel);
    const head = box(0.16, 0.34, len, 0.008, 1);
    head.rotateY(yaw); head.translate(cx, y + h - 0.17, cz);
    parts.push(head);
    // Recessed dark glazing.
    const glass = box(0.06, h - 1.36, len - 0.02, 0.004, 1);
    glass.rotateY(yaw);
    glass.translate(cx - nx * 0.07, y + 1.02 + (h - 1.36) / 2, cz - nz * 0.07);
    glow.push({ geo: glass, dark: true });
    // Mullions.
    const n = Math.round(len / 1.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
      const m = box(0.10, h - 1.36, 0.09, 0.004, 1);
      m.rotateY(yaw); m.translate(px, y + 1.02 + (h - 1.36) / 2, pz);
      mull.push(m);
      if (detail > 1 && i < n) {
        const tr = box(0.09, 0.055, len / n - 0.09, 0.003, 1);
        tr.rotateY(yaw);
        tr.translate(lerp(ax, bx, (i + 0.5) / n), y + 2.10, lerp(az, bz, (i + 0.5) / n));
        mull.push(tr);
      }
    }
    // Lit panes: the only colour in the shaft.
    for (let i = 0; i < n; i++) {
      if (hash2(Math.round(y * 3) + i, Math.round(ax + i * 7)) > lit) continue;
      const t = (i + 0.5) / n;
      const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
      const p = box(0.02, h - 1.6, len / n - 0.16, 0.003, 1);
      p.rotateY(yaw);
      p.translate(px - nx * 0.09, y + 1.10 + (h - 1.6) / 2, pz - nz * 0.09);
      glow.push({ geo: p, dark: false });
    }
  }
  const g = merge(parts); worldUV(g, 1.1); vertexShade(g, () => 0.44);
  b.add('concreteWall', g);
  const mg = merge(mull); worldUV(mg, 0.5); vertexShade(mg, () => 0.5);
  b.add('machinePaint', mg);
  const dark = glow.filter((q) => q.dark).map((q) => q.geo);
  const brightGeos = glow.filter((q) => !q.dark).map((q) => q.geo);
  if (dark.length) {
    const dg = merge(dark); worldUV(dg, 1.0); vertexShade(dg, () => 0.30);
    b.add('glassDark', dg);
  }
  if (brightGeos.length) {
    const bg = merge(brightGeos);
    b.add('stackGlow', bg, () => b.materials.emissive(0xffe0ae, 0.55));
  }
}

/** One deck ring around the void. */
function deckRing(b, y, { detail = 2, rails = true, collide = true, gap = null } = {}) {
  const parts = [];
  const rects = [
    [-OUTER, -OUTER, OUTER, -VOID],
    [-OUTER, VOID, OUTER, OUTER],
    [-OUTER, -VOID, -VOID, VOID],
    [VOID, -VOID, OUTER, VOID],
  ];
  for (const [x0, z0, x1, z1] of rects) {
    const w = x1 - x0, d = z1 - z0;
    const deck = box(w, 0.075, d, 0.006, 1);
    deck.translate((x0 + x1) / 2, y - 0.038, (z0 + z1) / 2);
    parts.push(deck);
    if (collide) {
      b.addFloor([x0, z0, x1, z1], y, { surface: 'concrete', tag: 'deck' });
      b.addColliderAt((x0 + x1) / 2, y - 0.30, (z0 + z1) / 2, w, 0.5, d, { tag: 'deck' });
    }
  }
  // Edge nib around the void, so the drop has a lip and a shadow line.
  const ring = [
    [-VOID, -VOID, VOID, -VOID], [VOID, VOID, -VOID, VOID],
    [VOID, -VOID, VOID, VOID], [-VOID, VOID, -VOID, -VOID],
  ];
  for (const [ax, az, bx, bz] of ring) {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const nib = box(0.16, 0.30, len, 0.006, 1);
    nib.rotateY(yaw);
    nib.translate((ax + bx) / 2 - Math.cos(yaw) * 0.08, y - 0.15, (az + bz) / 2 + Math.sin(yaw) * 0.08);
    parts.push(nib);
  }
  const g = merge(parts);
  worldUV(g, 1.0);
  vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.88 : ny < -0.5 ? 0.34 : 0.58));
  b.add('concreteFloor', g);

  if (rails) {
    const r = VOID - 0.10;
    const opt = { h: 1.06, spacing: detail > 1 ? 1.6 : 3.2, mid: detail > 1, toe: detail > 1, key: 'machinePaint' };
    handrail(b, [[-r, -r], [r, -r]], y, opt);
    handrail(b, [[r, -r], [r, r]], y, opt);
    handrail(b, [[-r, r], [-r, -r]], y, opt);
    if (gap) {
      // Somebody removed a bay of handrail and never put it back.
      handrail(b, [[r, r], [gap[1], r]], y, opt);
      handrail(b, [[gap[0], r], [-r, r]], y, opt);
    } else {
      handrail(b, [[r, r], [-r, r]], y, opt);
    }
    if (collide) {
      b.addColliderAt(0, y + 0.55, -r, VOID * 2, 1.1, 0.12, { tag: 'rail' });
      b.addColliderAt(-r, y + 0.55, 0, 0.12, 1.1, VOID * 2, { tag: 'rail' });
      b.addColliderAt(r, y + 0.55, 0, 0.12, 1.1, VOID * 2, { tag: 'rail' });
      if (gap) {
        b.addColliderAt((r + gap[1]) / 2, y + 0.55, r, r - gap[1], 1.1, 0.12, { tag: 'rail' });
        b.addColliderAt((-r + gap[0]) / 2, y + 0.55, r, gap[0] + r, 1.1, 0.12, { tag: 'rail' });
      } else {
        b.addColliderAt(0, y + 0.55, r, VOID * 2, 1.1, 0.12, { tag: 'rail' });
      }
    }
  }
}

export function buildStack(ctx, opts = {}) {
  const { rig, decals } = ctx;
  const seed = opts.seed ?? 7700;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bHere, bNear, bFar] = makeBuilders(ctx, 'stack', ['here', 'near', 'far']);
  const builders = [bHere, bNear, bFar];
  const fixtures = [];
  const rigFor = (b) => rigProxy(rig, b.origin, fixtures);
  const portals = [];

  // =========================================================================
  // levels
  // =========================================================================
  for (let i = -DOWN; i <= UP; i++) {
    const y = i * LEVEL;
    const dist = Math.abs(i);
    const detail = dist === 0 ? 3 : dist <= 2 ? 2 : 1;
    const b = dist === 0 ? bHere : dist <= 2 ? bNear : bFar;
    deckRing(b, y, { detail, rails: true, collide: dist === 0, gap: dist === 0 ? [1.4, 3.8] : null });
    facade(b, y, { detail, seed: seed + i * 31, lit: dist === 0 ? 0.22 : 0.16 });
    // Structure: columns at the four corners of the void, every level.
    if (detail >= 2) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const g = box(0.30, LEVEL - 0.08, 0.30, 0.008, 1);
        g.translate(sx * (VOID + 1.1), y + LEVEL / 2, sz * (VOID + 1.1));
        worldUV(g, 0.9); vertexShade(g, (px, py) => 0.5 + clamp01((py - y) / LEVEL) * 0.3);
        b.add('concreteWall', g);
        if (dist === 0) b.addColliderAt(sx * (VOID + 1.1), y + LEVEL / 2, sz * (VOID + 1.1), 0.30, LEVEL, 0.30, { tag: 'column' });
      }
    }
    // Level number stencilled on the parapet, facing the void.
    if (D && dist <= 3) {
      D.label(b, [`${(i + 24).toString().padStart(2, '0')}`], {
        face: '-z', x: 0, y: y + 0.55, z: -VOID + 0.02, w: 0.66, h: 0.52,
        style: 'stencil', size: 96, colour: '#9a9384', distress: 0.5,
      });
    }
    // A strip light under every deck soffit — the rhythm that makes it infinite.
    if (dist <= 4) {
      for (const [lx, lz, rot] of [[0, -VOID - 1.2, 0], [0, VOID + 1.2, 0], [-VOID - 1.2, 0, Math.PI / 2], [VOID + 1.2, 0, Math.PI / 2]]) {
        const health = hash2(i * 7 + lx, lz) < 0.18 ? 'dead' : hash2(i * 3, lz) < 0.32 ? 'buzz' : 'good';
        stripLight(b, rigFor(b), lx, y + LEVEL - 0.10, lz, {
          rotation: rot, circuit: 'stack', health, seed: 100 + i * 5 + lx,
          cage: false, cone: dist <= 1,
        });
      }
    }
  }

  // =========================================================================
  // the player's level
  // =========================================================================
  {
    const b = bHere;
    // Doors: in from Service on the north face, out to the Residence on the east.
    wallRun(b, -OUTER, -OUTER, OUTER, -OUTER, {
      y: 0, height: 1.02, key: 'concreteWall', seed: 11, perimeterAngle: false, skirting: false, collide: false,
    });
    doorway(b, -3.2, 0, -OUTER + 0.08, { rotation: 0, width: 1.0, height: 2.06, open: 0.5, hinge: 1, seed: 12 });
    portals.push(portal('to_service', 'stack', [-3.2, 0, -OUTER + 0.7], 0,
      { zone: 'service', portalId: 'to_stack' }, 'door',
      { arrive: [-3.2, 0, -OUTER + 1.7], arriveYaw: Math.PI }));
    doorway(b, OUTER - 0.08, 0, 3.6, { rotation: -Math.PI / 2, width: 1.0, height: 2.06, open: 0, hinge: 1, seed: 13 });
    portals.push(portal('to_residence', 'stack', [OUTER - 0.7, 0, 3.6], -Math.PI / 2,
      { zone: 'residence', portalId: 'to_stack' }, 'door',
      { arrive: [OUTER - 1.8, 0, 3.6], arriveYaw: Math.PI / 2 }));

    // The gantry the player walks is dressed: this level has been used.
    Props.filingCabinet(b, -8.2, 0, -10.4, { seed: 201, yaw: 0.1, drawers: 4, damage: 0.5 });
    Props.filingCabinet(b, -7.7, 0, -10.4, { seed: 202, yaw: -0.05, drawers: 3, damage: 0.2 });
    Props.desk(b, 6.0, 0, -10.2, { seed: 203, yaw: Math.PI, w: 1.4, pedestal: 'right', damage: 0.3 });
    Props.officeChair(b, 6.0, 0, -9.3, { seed: 204, yaw: 0.3 });
    Props.paperStack(b, 6.2, 0.73, -10.3, { seed: 205, sheets: 55 });
    Props.wasteBin(b, 5.1, 0, -10.4, { seed: 206, kind: 'mesh', full: 0.5 });
    Props.boxStack(b, -10.2, 0, 5.6, { seed: 207, count: 4, soakBase: 0.1 });
    Props.trolley(b, -10.0, 0, -4.0, { seed: 208, yaw: 1.6, load: 0.4 });
    Props.plasticChair(b, 9.9, 0, -6.0, { seed: 209, yaw: 2.4 });
    Props.chairStack(b, 10.2, 0, 8.0, { seed: 210, yaw: 0.6, count: 5 });
    Props.wetFloorSign(b, 2.0, 0, -10.0, { seed: 211, yaw: 0.9 });
    Props.fireExtinguisher(b, -OUTER + 0.14, 0.32, 6.4, { seed: 212, yaw: Math.PI / 2 });
    Props.noticeboard(b, 0.0, 1.55, -OUTER + 0.10, { seed: 213, yaw: 0, w: 1.2, h: 0.85, sheets: 8 });

    // A bay of handrail is missing (see deckRing's `gap`), and there is a chair
    // pushed up to the edge of it, facing out over the drop.
    {
      Props.officeChair(b, 2.6, 0, VOID - 1.0, { seed: 214, yaw: Math.PI, arms: false, damage: 0.8 });
      if (D) {
        D.quad(b, { stamp: STAMP.dustEdge, face: 'up', x: 2.6, y: 0.004, z: VOID - 1.0, w: 1.2, h: 1.2, strength: 1 });
        D.quad(b, { stamp: STAMP.sprayX, face: 'up', x: 2.6, y: 0.004, z: VOID - 2.2, w: 1.0, h: 1.0, strength: 0.8 });
      }
    }

    if (D) {
      D.roomPlate(b, -2.0, 2.05, -OUTER + 0.10, 0, roomNumber('K', 24), 'STACK');
      D.hazardRun(b, 0, 0.004, -VOID + 0.45, 17.0, { face: 'up', axis: 'x', h: 0.16, tile: 0.5, strength: 0.8 });
      D.hazardRun(b, 0, 0.004, VOID - 0.45, 17.0, { face: 'up', axis: 'x', h: 0.16, tile: 0.5, strength: 0.8 });
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: 0, y: 0.004, z: -VOID - 1.0, w: 1.4, h: 18, rot: Math.PI / 2, strength: 0.9 });
      D.footprints(b, [[-3.2, -10.4], [-3.2, -6.0], [4.0, -6.0], [9.6, -1.0]], { seed: 215, fade: 2.6, strength: 0.5 });
    }
  }

  // =========================================================================
  // the void: one cable bundle, and one light a long way down
  // =========================================================================
  {
    const b = bNear;
    const top = UP * LEVEL, bot = -DOWN * LEVEL;
    for (let k = 0; k < 5; k++) {
      const ox = -VOID + 0.55 + k * 0.06, oz = -VOID + 0.62 + (k % 2) * 0.05;
      const pts = [];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const y = lerp(top, bot, t);
        pts.push([ox + Math.sin(t * 5 + k) * 0.12, y, oz + Math.cos(t * 4 + k) * 0.12]);
      }
      const cable = pipeRun(pts, 0.018 + k * 0.004, 6, 1);
      worldUV(cable, 0.6); vertexShade(cable, () => 0.4);
      b.add('rubber', cable);
    }
    // Bracket clamps at each level, so the bundle is fixed to the building.
    for (let i = -DOWN; i <= UP; i += 2) {
      const g = box(0.34, 0.05, 0.05, 0.004, 1);
      g.rotateY(0.7); g.translate(-VOID + 0.45, i * LEVEL + 0.4, -VOID + 0.55);
      worldUV(g, 0.4); b.add('machinePaint', g);
    }
    // One bulkhead burning far below. It is the bottom of the frame's interest.
    bulkhead(bFar, rigFor(bFar), -VOID - 1.4, -DOWN * LEVEL + 2.2, -VOID - 0.6, {
      yaw: 0.8, circuit: 'stack', health: 'good', seed: 301,
    });
  }

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:stack';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables: [],
    spawn: [-3.2, 0, -OUTER + 1.7],
    spawnYaw: Math.PI,
    fogProfile: 'stack',
    reverb: 'stack',
    ambient: { sky: 0x1a1a20, ground: 0x2a2a30, intensity: 0.34 },
    bounds: new THREE.Box3(
      new THREE.Vector3(-OUTER, -DOWN * LEVEL, -OUTER),
      new THREE.Vector3(OUTER, UP * LEVEL, OUTER)),
  };
}

export default buildStack;
