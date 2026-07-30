import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway, outlet, smokeDetector } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, pendant, bulkhead, emergencyLight,
  handrail, stairFlight,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun, weather } from '../../render/geo.js';

/**
 * THE RESIDENCE — a wing of the building that should not exist.
 *
 * Annex 7 is an office block. It has a residential floor with numbered doors, a
 * runner carpet, a communal bathroom and pendant lamps, and nobody in Meridian
 * ever wrote it down. The horror here is domestic rather than industrial: this
 * is a corridor you have stayed in, on a night you cannot place.
 *
 * The art direction is deliberately the inverse of every other zone. Warm
 * light, low ceiling (2.62 m), soft materials, mouldings — dado rail, picture
 * rail, deep skirting — and a wear gradient that runs east: at the west end the
 * paper is merely faded, and by the far end it has come off the wall in sheets.
 *
 * Composition: eighteen doors on a 3.6 m rhythm down a 36 m corridor, each with
 * its plate, most of them shut. The pendants pick out the runner. At the far
 * end, exactly on the corridor axis, there is a full-length mirror.
 */

/**
 * Fixture output scales.
 *
 * `FIXTURE_TYPES.pendant` is calibrated for a small warm room, and one pendant
 * every 3.6 m in a 37 m corridor put 2.1 units of direct light at head height
 * against the Intake's 19 — which the artifact analyser measured as 61 % of the
 * frame crushed to pure black, the thing the brief explicitly forbids.
 *
 * Neither of the two obvious fixes works. The bounce fill is written by
 * `AMBIENT_PROFILES` and raising it was measured and moves nothing. The grade
 * cannot rescue it either: its eye adaptation clamps the correction it will
 * apply to 1.55x (`GradePass`, `autoGain`), so an under-lit frame stays
 * under-lit. What is left is the source, and the constraint on the source is the
 * rig's active-light budget — the 10 nearest live fixtures at the shipping
 * medium tier, ranked by distance to the camera with no knowledge of walls. Over
 * five of those ten used to be pendants in rooms the player could not see into.
 *
 * So: a fitting per door bay rather than one per two bays, each one dimmer than
 * a rated pendant, which is both how a real corridor is lit and what wins the
 * budget. The zone stays warm, low and intimate; it is lit to about two thirds
 * of the Intake, not to match it.
 */
const OUT = { corridor: 0.86, room: 1.45, hall: 1.30 };

const CEIL = 2.62;
const HW = 1.15;                        // corridor half width
const X0 = -19.4, X1 = 18.2;
const ROOM_D = 4.4;                     // room depth off the corridor
const BAY = 3.6;
const DADO = 0.94;

/** Dado and picture rails, both faces of a wall run. */
function mouldings(b, ax, az, bx, bz, { y = 0, dado = DADO, picture = CEIL - 0.24, key = 'trim', sides = [-1, 1] } = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.2) return;
  const yaw = Math.atan2(bx - ax, bz - az);
  const parts = [];
  for (const s of sides) {
    if (dado) {
      const g = box(0.030, 0.058, len, 0.005, 1);
      g.rotateY(yaw);
      g.translate((ax + bx) / 2 + Math.cos(yaw) * s * 0.093, y + dado, (az + bz) / 2 - Math.sin(yaw) * s * 0.093);
      parts.push(g);
      const cap = box(0.038, 0.014, len, 0.004, 1);
      cap.rotateY(yaw);
      cap.translate((ax + bx) / 2 + Math.cos(yaw) * s * 0.096, y + dado + 0.036, (az + bz) / 2 - Math.sin(yaw) * s * 0.096);
      parts.push(cap);
    }
    if (picture) {
      const g = box(0.022, 0.036, len, 0.004, 1);
      g.rotateY(yaw);
      g.translate((ax + bx) / 2 + Math.cos(yaw) * s * 0.089, y + picture, (az + bz) / 2 - Math.sin(yaw) * s * 0.089);
      parts.push(g);
    }
  }
  const g = merge(parts);
  worldUV(g, 0.5);
  vertexShade(g, (px, py) => 0.74 + clamp01((py - y) / CEIL) * 0.22);
  b.add(key, g);
}

/** Plaster soffit. */
function ceilingPlaster(b, rect, y, { key = 'plaster', rose = null } = {}) {
  const [x0, z0, x1, z1] = rect;
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
  g.rotateX(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  worldUV(g, 1.5);
  vertexShade(g, () => 0.70);
  b.add(key, g);
  b.addColliderAt((x0 + x1) / 2, y + 0.3, (z0 + z1) / 2, w, 0.6, d, { tag: 'ceiling' });
}

/** Cornice at the wall/ceiling junction — the detail the whole zone rests on. */
function cornice(b, rect, y, { key = 'trim' } = {}) {
  const [x0, z0, x1, z1] = rect;
  const parts = [];
  const run = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const g = box(0.075, 0.075, len, 0.008, 1);
    g.rotateX(0); g.rotateY(yaw);
    g.translate((ax + bx) / 2 + Math.cos(yaw) * 0.037, y - 0.037, (az + bz) / 2 - Math.sin(yaw) * 0.037);
    parts.push(g);
  };
  run(x0, z0, x1, z0); run(x1, z1, x0, z1);
  run(x1, z0, x1, z1); run(x0, z1, x0, z0);
  const g = merge(parts);
  worldUV(g, 0.45);
  vertexShade(g, () => 0.82);
  b.add(key, g);
}

export function buildResidence(ctx, opts = {}) {
  const { rig, decals } = ctx;
  const seed = opts.seed ?? 6600;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bWest, bMid, bEast, bRooms] =
    makeBuilders(ctx, 'residence', ['west', 'mid', 'east', 'rooms']);
  const builders = [bWest, bMid, bEast, bRooms];
  const fixtures = [];
  const rigFor = (b) => rigProxy(rig, b.origin, fixtures);
  const portals = [];
  const byX = (x) => (x < -7 ? bWest : x < 7 ? bMid : bEast);

  /** Wear rises to the east. */
  const wear = (x) => clamp01((x - X0) / (X1 - X0) * 1.25 - 0.10);

  // =========================================================================
  // 1. corridor
  // =========================================================================
  for (const [x0, x1, b] of [[X0, -7, bWest], [-7, 7, bMid], [7, X1, bEast]]) {
    floorSlab(b, [x0, -HW, x1, HW], 0, { key: 'carpet', surface: 'carpet', subdiv: 2.0, edgeShade: 0.24 });
    // The runner: a separate, redder carpet down the middle with a visible edge.
    const r = new THREE.PlaneGeometry(x1 - x0, 1.42, Math.round((x1 - x0) / 1.5), 1);
    r.rotateX(-Math.PI / 2);
    r.translate((x0 + x1) / 2, 0.012, 0);
    worldUV(r, 1.1);
    vertexShade(r, (px, py, pz) => 0.80 + (1 - Math.abs(pz) / 0.71) * 0.22);
    b.add('carpetRunner', r);
    // Runner edge binding.
    for (const sz of [-1, 1]) {
      const e = box(x1 - x0, 0.016, 0.05, 0.004, 1);
      e.translate((x0 + x1) / 2, 0.010, sz * 0.71);
      worldUV(e, 0.4); vertexShade(e, () => 0.62);
      b.add('trim', e);
    }
    ceilingPlaster(b, [x0, -HW, x1, HW], CEIL);
  }

  // Doors: a 3.6 m rhythm, alternating sides, most of them shut.
  const doors = [];
  let roomNo = 201;
  for (let i = 0; ; i++) {
    const x = X0 + 2.4 + i * (BAY / 2);
    if (x > X1 - 2.0) break;
    const north = i % 2 === 0;
    doors.push({ x, north, no: roomNo++, i });
  }

  for (const [zSide, list] of [[HW, doors.filter((d) => d.north)], [-HW, doors.filter((d) => !d.north)]]) {
    for (const [x0, x1, b] of [[X0, -7, bWest], [-7, 7, bMid], [7, X1, bEast]]) {
      const ops = list.filter((d) => d.x - 0.55 > x0 + 0.05 && d.x + 0.55 < x1 - 0.05)
        .map((d) => ({ at: d.x - x0, width: 0.96, height: 2.02 }));
      wallRun(b, x0, zSide, x1, zSide, {
        height: CEIL, key: 'damask', skirtKey: 'trim', angleKey: 'trim',
        openings: ops, seed: seed + x0 * 3 + zSide, perimeterAngle: false,
      });
      mouldings(b, x0, zSide, x1, zSide, { sides: [zSide > 0 ? -1 : 1] });
    }
  }
  cornice(bMid, [X0, -HW, X1, HW], CEIL);

  // Door leaves and their plates.
  for (const d of doors) {
    const b = byX(d.x);
    const zSide = d.north ? HW : -HW;
    const open = rng.chance(0.22) ? rng.range(0.25, 1.1) : 0;
    doorway(b, d.x, 0, zSide, {
      rotation: d.north ? 0 : Math.PI, width: 0.94, height: 2.00,
      open, hinge: rng.chance(0.5) ? 1 : -1, seed: 400 + d.i,
    });
    d.open = open;
    if (D) {
      D.roomPlate(b, d.x + 0.62, 1.62, zSide + (d.north ? -0.10 : 0.10), d.north ? Math.PI : 0,
        roomNumber('R', d.no), null, { w: 0.20, h: 0.075 });
      if (rng.chance(0.35)) {
        D.quad(b, {
          stamp: STAMP.handSmear, face: d.north ? '-z' : '+z',
          x: d.x - 0.30, y: 1.02, z: zSide + (d.north ? -0.04 : 0.04),
          w: 0.36, h: 0.44, strength: 0.9,
        });
      }
    }
  }

  // Wall wear along the corridor.
  if (D) {
    for (const [x0, x1, b] of [[X0, -7, bWest], [-7, 7, bMid], [7, X1, bEast]]) {
      const w0 = wear((x0 + x1) / 2);
      D.wallBase(b, x0 + 0.2, HW - 0.02, x1 - 0.2, HW - 0.02, { amount: 0.35 + w0 * 0.5, seed: seed + x0, face: '-z' });
      D.wallBase(b, x0 + 0.2, -HW + 0.02, x1 - 0.2, -HW + 0.02, { amount: 0.3 + w0 * 0.55, seed: seed + x0 + 7, face: '+z' });
      const n = Math.round((x1 - x0) / 3);
      for (let i = 0; i < n; i++) {
        const px = lerp(x0 + 1, x1 - 1, (i + 0.5) / n);
        const w = wear(px);
        if (w > 0.25) {
          D.quad(b, {
            stamp: STAMP.tornPoster, face: hash2(i, 1) > 0.5 ? '-z' : '+z',
            x: px, y: 1.55, z: (hash2(i, 1) > 0.5 ? HW - 0.03 : -HW + 0.03),
            w: 0.7, h: 1.0, strength: clamp01(w * 1.2), flipU: hash2(i, 3) > 0.5,
          });
        }
        if (w > 0.5 && hash2(i, 5) > 0.4) {
          D.quad(b, {
            stamp: STAMP.mould, face: '-z', x: px + 0.6, y: 2.1, z: HW - 0.03,
            w: 1.2, h: 1.0, strength: w,
          });
        }
      }
      // Traffic polish along the runner.
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: (x0 + x1) / 2, y: 0.014, z: 0, w: 0.9, h: x1 - x0, rot: Math.PI / 2, strength: 0.85 });
    }
    D.leak(bEast, 13.4, CEIL - 0.02, 0.4, { seed: 51, amount: 1.0, face: '-z', wallZ: HW - 0.03, floorY: 0.014 });
    D.leak(bMid, -2.2, CEIL - 0.02, -0.5, { seed: 52, amount: 0.6, floorY: 0.014 });
  }

  // Pendants down the corridor: one per door bay, on the same 1.8 m rhythm as
  // the doors, so every point of the runner is within 0.9 m of a fitting.
  //
  // Warm, low, and some of them are out — but a DEAD pendant on a 3.6 m rhythm
  // was a 7.2 m hole in the only route through the zone, and the wear gradient
  // put most of the holes at the east end, which is where the mirror that the
  // whole composition points at lives. The gradient now runs through flicker
  // personality instead of absence: a dying lamp still emits, and a corridor of
  // buzzing and restriking lamps reads as more wrong than a corridor of dark
  // ones, because you can see what is wrong with it.
  let fs = 1;
  // Starts at X0 + 1.2, not X0 + 3.0: the first 3 m of the corridor is what you
  // see from the stair hall the moment you arrive in the zone, and it had no
  // fitting in it at all.
  for (let x = X0 + 1.2; x < X1 - 1.0; x += BAY / 2) {
    const b = byX(x);
    const w = wear(x);
    const h2 = hash2(Math.round(x * 5), 11);
    let health = 'good';
    if (h2 < 0.02 + w * 0.09) health = 'dead';
    else if (h2 < 0.20 + w * 0.45) health = 'dying';
    else if (h2 < 0.44) health = 'buzz';
    const f = pendant(b, rigFor(b), x, CEIL - 0.02, 0, {
      circuit: 'residence', health, seed: fs++, drop: 0.34,
      shade: hash2(Math.round(x), 2) > 0.5 ? 'cone' : 'globe',
      // A pendant's cone is a small soft shaft; at 1.8 m centres they overlap
      // into haze, so every other one is enough and it halves the overdraw.
      cone: fs % 2 === 0,
    });
    f.intensityScale = OUT.corridor;
    if (fs % 2 === 0) smokeDetector(b, x + 0.7, CEIL - 0.014, 0.5, 'plasticWhite');
  }
  emergencyLight(bEast, rigFor(bEast), X1 - 0.14, 2.28, 0.6, { yaw: Math.PI / 2, seed: 90 });

  // =========================================================================
  // 2. the end of the corridor — a mirror on the axis
  // =========================================================================
  {
    const b = bEast;
    wallRun(b, X1, -HW - 0.16, X1, HW + 0.16, {
      height: CEIL, key: 'damask', seed: 61, perimeterAngle: false,
      openings: [{ at: HW + 0.16 + 1.0, width: 0.96, height: 2.02 }],
    });
    // The door out to the Stack, off-axis so the mirror holds the centre.
    doorway(b, X1, 0, 1.0, { rotation: -Math.PI / 2, width: 0.94, height: 2.00, open: 0, hinge: 1, seed: 62 });
    portals.push(portal('to_stack', 'residence', [X1 - 0.5, 0, 1.0], -Math.PI / 2,
      { zone: 'stack', portalId: 'to_residence' }, 'door',
      { arrive: [X1 - 1.6, 0, 1.0], arriveYaw: Math.PI / 2 }));
    Props.mirror(b, X1 - 0.10, 1.38, -0.55, { seed: 63, yaw: Math.PI / 2, w: 0.72, h: 1.55, cracked: true });
    Props.bedsideTable(b, X1 - 0.32, 0, -0.55, { seed: 64, yaw: Math.PI / 2, w: 0.48, d: 0.34, h: 0.60 });
    Props.wallClock(b, X1 - 0.09, 2.16, 0.2, { seed: 65, yaw: Math.PI / 2, handsAt: [3, 47], r: 0.14, damage: 0.6 });
    if (D) {
      D.quad(b, { stamp: STAMP.tapeResidue, face: '-x', x: X1 - 0.08, y: 1.9, z: -1.0, w: 0.4, h: 0.5, strength: 0.9 });
      D.quad(b, { stamp: STAMP.dripLong, face: '-x', x: X1 - 0.07, y: 1.5, z: 0.5, w: 0.5, h: 1.6, strength: 0.7 });
    }
  }

  // =========================================================================
  // 3. west end — stair hall and the way back to Service
  // =========================================================================
  {
    const b = bWest;
    const sx0 = X0 - 4.6, sx1 = X0;
    floorSlab(b, [sx0, -3.2, sx1, 3.2], 0, { key: 'carpet', surface: 'carpet', subdiv: 2.0, edgeShade: 0.28 });
    ceilingPlaster(b, [sx0, -3.2, sx1, 3.2], CEIL + 1.4);
    for (const [ax, az, bx, bz, ops] of [
      [sx0, -3.2, sx1, -3.2, []],
      [sx1, -3.2, sx1, -HW, []],
      [sx1, HW, sx1, 3.2, []],
      [sx0, 3.2, sx1, 3.2, []],
      [sx0, 3.2, sx0, -3.2, [{ at: 3.2, width: 1.00, height: 2.04 }]],
    ]) {
      wallRun(b, ax, az, bx, bz, { height: CEIL + 1.4, key: 'plaster', openings: ops, seed: seed + ax + az, perimeterAngle: false });
    }
    doorway(b, sx0, 0, 0, { rotation: Math.PI / 2, width: 0.98, height: 2.02, open: 0.4, hinge: 1, seed: 71 });
    portals.push(portal('to_service', 'residence', [sx0 + 0.7, 0, 0], -Math.PI / 2,
      { zone: 'service', portalId: 'to_residence' }, 'door',
      { arrive: [sx0 + 1.8, 0, 0], arriveYaw: -Math.PI / 2 }));

    // A stair going up into a ceiling that is not there any more.
    stairFlight(b, sx0 + 2.3, 0, -2.6, {
      yaw: 0, steps: 9, rise: 0.176, going: 0.27, width: 1.15,
      treadKey: 'carpetRunner', stringKey: 'woodDark', railKey: 'woodDark',
      landing: 0.9, open: false, seed: 72,
    });
    // The flight stops at a blank plastered soffit. It never went anywhere.
    {
      const cap = box(1.6, 0.12, 1.2, 0.01, 1);
      cap.translate(sx0 + 2.3, 1.70, -0.10);
      worldUV(cap, 0.7); vertexShade(cap, () => 0.55);
      b.add('plaster', cap);
      b.addColliderAt(sx0 + 2.3, 1.76, -0.10, 1.6, 0.24, 1.2, { tag: 'ceiling' });
    }
    // The hall is where the player arrives in the zone, so it is the frame the
    // artifact analyser photographs — and it had exactly one buzzing globe in a
    // 4.6 x 6.4 m room 4 m to the ceiling, which measured 2.1 units of direct
    // light at head height. Three fittings: the main globe on its long drop over
    // the void, one over the foot of the flight, one at the mouth of the
    // corridor. They are the biggest lamps in the zone because it is the tallest
    // room in it, and they are still domestic pendants.
    for (const [px, pz, drop, hl, sc, sd] of [
      [sx0 + 2.3, 1.4, 0.85, 'buzz', OUT.hall * 1.08, 73],
      [sx0 + 1.2, -2.2, 0.50, 'good', OUT.hall, 78],
      [sx0 + 3.8, 0.0, 0.40, 'dying', OUT.hall * 0.92, 79],
    ]) {
      const f = pendant(b, rigFor(b), px, CEIL + 1.34, pz, {
        circuit: 'residence', health: hl, seed: sd, drop, shade: 'globe', cone: sd !== 79,
      });
      f.intensityScale = sc;
    }
    Props.coatHooks(b, sx0 + 2.4, 1.68, 3.14, { seed: 74, yaw: Math.PI, w: 1.1, coats: 0.7 });
    Props.suitcase(b, sx0 + 3.6, 0, 2.5, { seed: 75, yaw: 0.5, standing: false });
    Props.suitcase(b, sx0 + 3.9, 0, 2.1, { seed: 76, yaw: 1.9, standing: true });
    Props.wasteBin(b, sx0 + 0.6, 0, -2.7, { seed: 77, kind: 'plastic', full: 0.6 });
    if (D) {
      D.roomPlate(b, sx0 + 0.10, 2.20, -1.6, -Math.PI / 2, roomNumber('R', 200), 'RESIDENCE');
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: sx0 + 2.2, y: 0.006, z: 0, w: 1.0, h: 4.4, rot: Math.PI / 2, strength: 1 });
    }
  }

  // =========================================================================
  // 4. rooms
  // =========================================================================
  const makeRoom = (b, d, dress) => {
    const zSide = d.north ? HW : -HW;
    const zFar = d.north ? HW + ROOM_D : -HW - ROOM_D;
    const x0 = d.x - BAY / 2 + 0.08, x1 = d.x + BAY / 2 - 0.08;
    const rect = [x0, Math.min(zSide, zFar), x1, Math.max(zSide, zFar)];
    floorSlab(b, rect, 0, { key: 'carpet', surface: 'carpet', subdiv: 1.8, edgeShade: 0.30 });
    ceilingPlaster(b, rect, CEIL);
    for (const [ax, az, bx, bz] of [
      [x0, zFar, x1, zFar], [x1, zSide, x1, zFar], [x0, zFar, x0, zSide],
    ]) {
      wallRun(b, ax, az, bx, bz, {
        height: CEIL, key: hash2(Math.round(d.x), 1) > 0.5 ? 'damask' : 'plaster',
        seed: seed + d.i * 13 + ax, perimeterAngle: false,
      });
    }
    mouldings(b, x0, zFar, x1, zFar, { sides: [d.north ? -1 : 1] });
    cornice(b, rect, CEIL);
    const cx = (x0 + x1) / 2, cz = (rect[1] + rect[3]) / 2;
    // A stripped room's fitting used to be DEAD, which read as a hole rather
    // than as a room — nothing in it was visible at all, and a room you cannot
    // see is not a story. It restrikes instead: the lamp is the last thing left
    // in there and it is failing, which says the same thing and lets the frame
    // show the bare plaster it is meant to be about.
    const f = pendant(b, rigFor(b), cx, CEIL - 0.02, cz, {
      circuit: 'residence', health: dress === 'dark' ? 'dying' : hash2(d.i, 9) > 0.7 ? 'dying' : 'good',
      seed: 500 + d.i, drop: 0.30, shade: 'globe',
    });
    f.intensityScale = dress === 'dark' ? OUT.room * 0.7 : OUT.room;
    outlet(b, x1 - 0.12, 0.28, cz, { rotation: -Math.PI / 2 });
    const w = wear(d.x);
    if (D) {
      D.wallBase(b, x0 + 0.2, zFar + (d.north ? -0.03 : 0.03), x1 - 0.2, zFar + (d.north ? -0.03 : 0.03),
        { amount: 0.3 + w * 0.6, seed: seed + d.i, face: d.north ? '-z' : '+z' });
    }
    return { rect, cx, cz, zFar, x0, x1, w };
  };

  // Five dressed rooms, each telling a different story.
  const dressed = [
    { idx: 2, kind: 'bedroom' },
    { idx: 5, kind: 'nest' },
    { idx: 8, kind: 'corner' },
    { idx: 12, kind: 'stripped' },
    { idx: 15, kind: 'barricade' },
  ];
  for (const spec of dressed) {
    const d = doors[spec.idx];
    if (!d) continue;
    d.open = Math.max(d.open, 0.9);
    const b = byX(d.x);
    const r = makeRoom(b, d, spec.kind === 'stripped' ? 'dark' : 'lit');
    const face = d.north ? 1 : -1;
    const S = 900 + spec.idx * 17;

    if (spec.kind === 'bedroom') {
      Props.bed(b, r.cx - 0.55, 0, r.cz + face * 0.5, { seed: S, yaw: d.north ? 0 : Math.PI, damage: 0.5 });
      Props.bedsideTable(b, r.cx + 0.55, 0, r.cz + face * 1.4, { seed: S + 1, yaw: d.north ? 0 : Math.PI });
      Props.wardrobe(b, r.x1 - 0.32, 0, r.cz - face * 0.9, { seed: S + 2, yaw: -Math.PI / 2 });
      Props.television(b, r.x0 + 0.42, 0.60, r.cz - face * 1.2, { seed: S + 3, yaw: Math.PI / 2 });
      Props.bedsideTable(b, r.x0 + 0.42, 0, r.cz - face * 1.2, { seed: S + 4, yaw: Math.PI / 2, w: 0.6, d: 0.42, h: 0.60 });
      Props.suitcase(b, r.cx + 1.0, 0, r.zFar - face * 0.5, { seed: S + 5, yaw: 0.4, standing: false });
      if (D) {
        D.quad(b, { stamp: STAMP.dustEdge, face: 'up', x: r.cx - 0.55, y: 0.004, z: r.cz + face * 0.5, w: 1.2, h: 2.2, strength: 0.8 });
        D.quad(b, { stamp: STAMP.tornPaper, face: d.north ? '-z' : '+z', x: r.cx, y: 1.5, z: r.zFar - face * 0.04, w: 0.24, h: 0.32, strength: 1 });
      }
    } else if (spec.kind === 'nest') {
      Props.bed(b, r.cx - 0.5, 0, r.cz, { seed: S, yaw: d.north ? Math.PI : 0, damage: 0.9, bedding: false, mattress: false });
      Props.blanketNest(b, r.cx + 0.55, 0, r.cz + face * 0.4, { seed: S + 1, yaw: 0.6, r: 1.05 });
      Props.wasteBin(b, r.x1 - 0.35, 0, r.zFar - face * 0.4, { seed: S + 2, kind: 'plastic', full: 1 });
      Props.paperStack(b, r.cx - 0.2, 0, r.cz - face * 1.2, { seed: S + 3, spilled: true, sheets: 26 });
      Props.radio(b, r.cx + 1.1, 0, r.cz + face * 1.5, { seed: S + 4, yaw: 2.0 });
      if (D) {
        D.quad(b, { stamp: STAMP.tally, face: d.north ? '-z' : '+z', x: r.cx - 0.5, y: 1.2, z: r.zFar - face * 0.04, w: 1.5, h: 0.5, strength: 1 });
        D.quad(b, { stamp: STAMP.tally, face: d.north ? '-z' : '+z', x: r.cx + 0.8, y: 1.2, z: r.zFar - face * 0.04, w: 1.5, h: 0.5, strength: 0.9, flipU: true });
        D.quad(b, { stamp: STAMP.tally, face: d.north ? '-z' : '+z', x: r.cx + 0.1, y: 1.75, z: r.zFar - face * 0.04, w: 1.5, h: 0.5, strength: 0.8 });
      }
    } else if (spec.kind === 'corner') {
      // Every chair in the room faces the same corner. Nobody moved them.
      const tx = r.x0 + 0.5, tz = r.zFar - face * 0.5;
      for (let i = 0; i < 5; i++) {
        const px = r.x0 + 0.9 + (i % 3) * 0.85;
        const pz = r.cz + face * (0.4 + Math.floor(i / 3) * 0.9);
        Props.plasticChair(b, px, 0, pz, { seed: S + i, yaw: Math.atan2(tx - px, tz - pz) });
      }
      Props.desk(b, r.cx + 0.4, 0, r.zFar - face * 0.55, { seed: S + 9, yaw: d.north ? Math.PI : 0, w: 1.3, pedestal: 'none', damage: 0.6 });
      Props.wallClock(b, r.cx, 1.95, r.zFar - face * 0.06, { seed: S + 10, yaw: d.north ? Math.PI : 0, handsAt: [3, 47] });
      if (D) D.quad(b, { stamp: STAMP.dustEdge, face: 'up', x: tx, y: 0.004, z: tz, w: 1.0, h: 1.0, strength: 1 });
    } else if (spec.kind === 'stripped') {
      // The paper is off the walls and the fittings are gone.
      Props.wardrobe(b, r.cx, 0, r.zFar - face * 0.34, { seed: S, yaw: d.north ? Math.PI : 0, ajar: 1.2 });
      Props.cardboardBox(b, r.x0 + 0.5, 0, r.cz, { seed: S + 1, yaw: 0.7, state: 'open' });
      Props.cardboardBox(b, r.x0 + 0.95, 0, r.cz - face * 0.3, { seed: S + 2, yaw: 2.2, state: 'collapsed' });
      if (D) {
        for (let i = 0; i < 4; i++) {
          D.quad(b, {
            stamp: STAMP.tornPoster, face: d.north ? '-z' : '+z',
            x: r.x0 + 0.5 + i * 0.75, y: 1.5, z: r.zFar - face * 0.04,
            w: 0.8, h: 1.6, strength: 1, flipU: i % 2 === 0,
          });
        }
        D.quad(b, { stamp: STAMP.crack, face: '+x', x: r.x0 + 0.04, y: 1.5, z: r.cz, w: 1.4, h: 2.2, strength: 0.8 });
      }
    } else if (spec.kind === 'barricade') {
      Props.barricade(b, r.cx, 0, r.cz + face * 0.2, { seed: S, yaw: d.north ? 0 : Math.PI, width: 2.4 });
      Props.bed(b, r.cx, 0, r.zFar - face * 1.0, { seed: S + 7, yaw: d.north ? Math.PI : 0, damage: 1.0 });
      if (D) {
        D.quad(b, { stamp: STAMP.sprayX, face: d.north ? '-z' : '+z', x: r.cx, y: 1.7, z: r.zFar - face * 0.04, w: 1.0, h: 1.0, strength: 1 });
        D.footprints(b, [[r.cx, r.cz + face * 1.8], [r.cx, r.zFar - face * 0.6]], { seed: S + 8, fade: 0.8, strength: 0.7 });
      }
    }
  }

  // =========================================================================
  // 5. communal bathroom
  // =========================================================================
  {
    const b = bEast;
    const x0 = 11.2, x1 = 17.6, z0 = HW, z1 = HW + 5.4;
    floorSlab(b, [x0, z0, x1, z1], 0, { key: 'linoFloor', surface: 'tile', subdiv: 1.8, edgeShade: 0.3 });
    ceilingPlaster(b, [x0, z0, x1, z1], CEIL);
    for (const [ax, az, bx, bz, ops] of [
      [x0, z1, x1, z1, []], [x1, z0, x1, z1, []], [x0, z1, x0, z0, []],
    ]) {
      wallRun(b, ax, az, bx, bz, { height: CEIL, key: 'tileWall', openings: ops, seed: seed + ax * 5, perimeterAngle: false });
    }
    // Sinks and mirrors along the west wall, cubicles along the east.
    for (let i = 0; i < 3; i++) {
      const z = z0 + 1.1 + i * 1.35;
      Props.sink(b, x0 + 0.32, 0, z, { seed: 700 + i, yaw: -Math.PI / 2, w: 0.52, d: 0.42 });
      Props.mirror(b, x0 + 0.09, 1.42, z, { seed: 710 + i, yaw: -Math.PI / 2, w: 0.5, h: 0.66, cracked: i === 1 });
    }
    Props.cubicles(b, x1 - 1.5, 0, z0 + 2.4, { seed: 720, yaw: -Math.PI / 2, n: 3, bay: 0.92, depth: 1.3, h: 1.95 });
    Props.bath(b, (x0 + x1) / 2 + 0.6, 0, z1 - 1.0, { seed: 730, yaw: 0.0, w: 0.74, len: 1.7 });
    Props.radiator(b, (x0 + x1) / 2 - 0.4, 0, z1 - 0.10, { seed: 731, yaw: Math.PI, w: 0.9, h: 0.55 });
    Props.wasteBin(b, x0 + 0.4, 0, z1 - 0.5, { seed: 732, kind: 'plastic', full: 0.7 });
    Props.mopBucket(b, x1 - 0.6, 0, z1 - 0.6, { seed: 733, yaw: 2.1 });
    // Four globes on a 2 m grid over a 6.4 x 5.4 m wet room: two down the middle
    // left the sinks and the cubicles — the only two things in here worth
    // looking at — outside every light pool.
    for (const [px, pz, hl, sd] of [
      [x0 + 1.6, z0 + 1.5, 'dying', 740], [x1 - 1.6, z0 + 1.5, 'good', 741],
      [x0 + 1.6, z1 - 1.4, 'good', 742], [x1 - 1.6, z1 - 1.4, 'buzz', 743],
    ]) {
      const f = pendant(b, rigFor(b), px, CEIL - 0.02, pz, {
        circuit: 'residence', health: hl, seed: sd, drop: 0.26, shade: 'globe', cone: sd % 2 === 1,
      });
      f.intensityScale = OUT.room;
    }
    if (D) {
      D.roomPlate(b, 14.0, 1.90, z0 - 0.10, Math.PI, roomNumber('R', 230), 'BATHROOM');
      D.wallBase(b, x0 + 0.2, z1 - 0.03, x1 - 0.2, z1 - 0.03, { amount: 0.8, seed: 750, face: '-z' });
      D.quad(b, { stamp: STAMP.mould, face: '+x', x: x0 + 0.04, y: 2.0, z: z1 - 1.4, w: 1.8, h: 1.4, strength: 1 });
      D.quad(b, { stamp: STAMP.puddle, face: 'up', x: (x0 + x1) / 2, y: 0.002, z: z1 - 1.9, w: 2.0, h: 1.6, strength: 0.9 });
      D.footprints(b, [[(x0 + x1) / 2, z1 - 1.6], [13.6, z0 + 0.4], [13.0, -0.4]], { seed: 751, fade: 1.2, strength: 0.8 });
      D.quad(b, { stamp: STAMP.handSmear, face: '+x', x: x0 + 0.04, y: 1.4, z: z0 + 2.4, w: 0.4, h: 0.5, strength: 1 });
    }
    // The doorway into the bathroom, off the corridor.
    doorway(b, 14.0, 0, z0, { rotation: 0, width: 0.98, height: 2.02, open: 1.2, hinge: 1, seed: 760 });
  }

  // Corridor furniture — never two of a kind in one sightline.
  Props.radiator(bWest, X0 + 5.0, 0, -HW + 0.10, { seed: 801, yaw: 0, w: 0.85, h: 0.52 });
  Props.radiator(bEast, 9.4, 0, HW - 0.10, { seed: 802, yaw: Math.PI, w: 1.05, h: 0.60 });
  Props.wasteBin(bMid, -0.9, 0, HW - 0.35, { seed: 803, kind: 'plastic', full: 0.4 });
  Props.trolley(bMid, 3.2, 0, -HW + 0.42, { seed: 804, yaw: 1.55, load: 0.5 });
  Props.plasticChair(bWest, -13.4, 0, HW - 0.4, { seed: 805, yaw: 0.2 });
  Props.noticeboard(bWest, -16.0, 1.5, -HW + 0.03, { seed: 806, yaw: 0, w: 0.9, h: 0.66, sheets: 5 });
  Props.fireExtinguisher(bMid, 6.4, 0.3, -HW + 0.08, { seed: 807, yaw: 0 });
  Props.suitcase(bEast, 15.6, 0, -HW + 0.4, { seed: 808, yaw: 1.2, standing: true });
  Props.paperStack(bMid, -4.6, 0.014, 0.3, { seed: 809, spilled: true, sheets: 18 });

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:residence';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables: [],
    spawn: [X0 - 3.4, 0, 0],
    spawnYaw: -Math.PI / 2,
    fogProfile: 'residence',
    reverb: 'residence',
    ambient: { sky: 0x241c14, ground: 0x40311e, intensity: 0.38 },
    bounds: new THREE.Box3(
      new THREE.Vector3(X0 - 5, 0, -HW - ROOM_D - 1),
      new THREE.Vector3(X1 + 1, CEIL + 1.5, HW + ROOM_D + 6)),
  };
}

export default buildResidence;
