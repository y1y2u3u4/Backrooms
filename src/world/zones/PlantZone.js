import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway, grille, conduit } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, stripLight, bulkhead, highbay, emergencyLight,
  handrail, stairFlight, gantry, steelColumn, iBeam, channel, angle, plinth,
  cagedLadder, ductRun, drainChannel, boardMarks,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import * as Mech from '../Machinery.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun, weather } from '../../render/geo.js';

/**
 * THE PLANT — the landmark.
 *
 * This is the one shot the game is remembered by, so it is composed rather than
 * filled. The player comes through a pair of steel doors from the Service Spine
 * and steps straight onto a walkway 6.7 m above the floor of a 14 m generator
 * hall. Everything is arranged around that first frame:
 *
 *   FOREGROUND  the walkway handrail and a column, cutting the bottom third
 *   MIDGROUND   two generator sets, side-lit by high-bay sodium, their exhaust
 *               stacks rising the full height of the hall and giving the eye a
 *               vertical to measure the volume against
 *   BACKGROUND  the goods lift at the far end — the only warm, saturated,
 *               unambiguous light in the room, and the way out
 *
 * The volume is legible because it is structured: a steel frame on the same
 * 4.2 m grid as the rest of the building, lattice trusses spanning the 23 m,
 * purlins, and a second walkway high on the south wall that gives the roof
 * something to be measured against.
 */

const FLOOR = -6.0;                 // hall floor, relative to the Service datum
const ROOF = 8.4;                   // underside of the roof deck
const G1 = 0.74;                    // entry walkway (matches the Service lobby)
const G2 = 4.40;                    // upper walkway
const HX0 = -17.4, HX1 = 17.4;
const HZ0 = -11.6, HZ1 = 11.6;
const BAY = 4.2;

/** Lattice roof truss spanning Z at a given X. */
function truss(b, x, z0, z1, y, { depth = 1.05, key = 'machinePaint', panels = 12 } = {}) {
  const parts = [];
  const span = Math.abs(z1 - z0);
  const top = iBeam(span, 0.20, 0.13, 0.009, 0.013); top.rotateY(Math.PI / 2);
  top.translate(x, y - 0.10, (z0 + z1) / 2);
  const bot = iBeam(span, 0.18, 0.12, 0.008, 0.012); bot.rotateY(Math.PI / 2);
  bot.translate(x, y - depth, (z0 + z1) / 2);
  parts.push(top, bot);
  const step = span / panels;
  for (let i = 0; i <= panels; i++) {
    const z = z0 + i * step;
    const v = box(0.075, depth - 0.18, 0.075, 0.004, 1);
    v.translate(x, y - depth / 2 - 0.05, z);
    parts.push(v);
    if (i < panels) {
      const d = Math.hypot(step, depth - 0.18);
      const dg = box(0.055, d, 0.055, 0.004, 1);
      dg.rotateX((i % 2 ? 1 : -1) * Math.atan2(step, depth - 0.18));
      dg.translate(x, y - depth / 2 - 0.05, z + step / 2);
      parts.push(dg);
    }
  }
  const g = merge(parts);
  worldUV(g, 0.7);
  vertexShade(g, () => 0.58);
  b.add(key, g);
}

export function buildPlant(ctx, opts = {}) {
  const { rig, decals } = ctx;
  const seed = opts.seed ?? 8080;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bShell, bRoof, bWest, bEast, bDeck] =
    makeBuilders(ctx, 'plant', ['shell', 'roof', 'west', 'east', 'deck']);
  const builders = [bShell, bRoof, bWest, bEast, bDeck];
  const fixtures = [];
  const rigFor = (b) => rigProxy(rig, b.origin, fixtures);
  const portals = [];
  const interactables = [];

  // =========================================================================
  // 1. shell
  // =========================================================================
  floorSlab(bShell, [HX0, HZ0, HX1, HZ1], FLOOR, {
    key: 'concreteFloor', surface: 'concrete', subdiv: 3.0, edgeShade: 0.34,
  });
  {
    // Roof deck: a profiled soffit rather than a flat plane, so the ceiling of
    // a 14 m room still has scale cues in it.
    const w = HX1 - HX0, d = HZ1 - HZ0;
    const g = new THREE.PlaneGeometry(w, d, Math.round(w / 3), Math.round(d / 3));
    g.rotateX(Math.PI / 2);
    g.translate((HX0 + HX1) / 2, ROOF, (HZ0 + HZ1) / 2);
    worldUV(g, 1.6);
    vertexShade(g, () => 0.34);
    bRoof.add('ductMetal', g);
    bRoof.addColliderAt(0, ROOF + 0.5, 0, w, 1.0, d, { tag: 'ceiling' });
  }

  const H = ROOF - FLOOR;
  const wallSides = [
    [HX0, HZ0, HX1, HZ0], [HX1, HZ0, HX1, HZ1], [HX1, HZ1, HX0, HZ1], [HX0, HZ1, HX0, HZ0],
  ];
  wallSides.forEach((s, i) => {
    const openings = [];
    if (i === 3) {
      // West wall: the door in from Service, at walkway level.
      const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
      openings.push({ at: len / 2, width: 1.95, height: 2.30, sill: G1 - FLOOR });
    }
    if (i === 1) {
      // East wall: the goods-lift opening.
      const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
      openings.push({ at: len / 2, width: 2.60, height: 2.90 });
    }
    wallRun(bShell, s[0], s[1], s[2], s[3], {
      y: FLOOR, height: H, key: i % 2 ? 'boardConcrete' : 'blockWall',
      openings, seed: seed + i * 31, perimeterAngle: false, skirting: true,
      shadeFloorY: FLOOR,
    });
    if (i % 2) boardMarks(bShell, s[0], s[1], s[2], s[3], FLOOR, H, { side: i === 1 ? -1 : 1, seed: seed + i });
  });

  // =========================================================================
  // 2. steel frame and roof
  // =========================================================================
  const colX = [];
  for (let x = -14.7; x <= 14.8; x += BAY) colX.push(+x.toFixed(2));
  for (const x of colX) {
    for (const z of [HZ0 + 0.55, HZ1 - 0.55]) {
      steelColumn(bShell, x, FLOOR, z, ROOF - FLOOR - 1.15, { size: 0.26, key: 'machinePaint' });
    }
    truss(bRoof, x, HZ0 + 0.55, HZ1 - 0.55, ROOF - 0.12, { panels: 10 });
  }
  // Purlins.
  for (let z = HZ0 + 1.6; z < HZ1 - 1.0; z += 1.9) {
    const g = box(HX1 - HX0 - 4.0, 0.10, 0.16, 0.004, 1);
    g.translate(0, ROOF - 0.30, z);
    worldUV(g, 0.6); vertexShade(g, () => 0.46);
    bRoof.add('machinePaint', g);
  }
  // Crane rail brackets on the columns — implied machinery beyond the frame.
  for (const z of [HZ0 + 0.9, HZ1 - 0.9]) {
    const g = channel(HX1 - HX0 - 3.0, 0.28, 0.11, 0.010);
    g.translate(0, FLOOR + 9.2, z);
    worldUV(g, 0.7); vertexShade(g, () => 0.52);
    bRoof.add('machinePaint', g);
  }

  // =========================================================================
  // 3. walkways
  // =========================================================================
  // Entry landing, projecting into the hall so the first frame has depth.
  gantry(bDeck, [HX0 + 0.16, -2.35, HX0 + 4.3, 2.35], G1, {
    rails: ['n', 's', 'e'], bearerEvery: 1.6, hangers: false,
  });
  // West run, north and south from the landing.
  gantry(bDeck, [HX0 + 0.16, 2.35, HX0 + 2.1, 10.0], G1, { rails: ['e', 's'], bearerEvery: 1.6 });
  gantry(bDeck, [HX0 + 0.16, -10.0, HX0 + 2.1, -2.35], G1, { rails: ['e', 'n'], bearerEvery: 1.6 });
  // Long north run, all the way to the lift end.
  gantry(bDeck, [HX0 + 2.1, 8.05, 13.6, 10.0], G1, { rails: ['n', 's'], bearerEvery: 1.7 });
  // Spur out over the machines — the best viewpoint in the hall.
  gantry(bDeck, [-3.0, 2.6, -1.2, 8.05], G1, { rails: ['e', 'w'], bearerEvery: 1.5, hangers: true, hangTo: ROOF - 0.4 });

  // Hangers for the long runs, back up to the trusses.
  {
    const rods = [];
    for (let x = -13; x < 13; x += 3.4) {
      for (const z of [8.4, 9.7]) {
        const r = cyl(0.014, 0.014, ROOF - 0.5 - G1, 6);
        r.translate(x, (G1 + ROOF - 0.5) / 2, z);
        rods.push(r);
      }
    }
    const g = merge(rods); worldUV(g, 0.4); vertexShade(g, () => 0.5);
    bDeck.add('machinePaint', g);
  }

  // Upper walkway on the south wall, reached by a caged ladder.
  gantry(bDeck, [-13.0, HZ0 + 0.9, 12.0, HZ0 + 2.5], G2, { rails: ['s', 'n'], bearerEvery: 1.8 });
  cagedLadder(bDeck, 11.2, G1, HZ0 + 3.4, G2 - G1 + 1.0, { yaw: Math.PI, cage: true });

  // Stair down from the west walkway to the hall floor.
  stairFlight(bDeck, HX0 + 1.1, FLOOR, -9.6, {
    yaw: 0, steps: 19, rise: 0.3547, going: 0.30, width: 1.30,
    treadKey: 'tread', stringKey: 'machinePaint', landing: 1.0, seed: 5,
  });
  // Stair down at the lift end.
  stairFlight(bDeck, 12.6, FLOOR, 7.0, {
    yaw: Math.PI, steps: 19, rise: 0.3547, going: 0.30, width: 1.30,
    treadKey: 'tread', stringKey: 'machinePaint', landing: 1.0, seed: 6,
  });

  // Door in from Service, on the landing.
  doorway(bDeck, HX0 + 0.08, G1, -0.48, { rotation: Math.PI / 2, width: 0.94, height: 2.28, open: 0.35, hinge: -1, seed: 71 });
  doorway(bDeck, HX0 + 0.08, G1, 0.48, { rotation: Math.PI / 2, width: 0.94, height: 2.28, open: 0, hinge: 1, seed: 72 });
  portals.push(portal('to_service', 'plant', [HX0 + 0.5, G1, 0], Math.PI / 2,
    { zone: 'service', portalId: 'to_plant' }, 'door',
    { arrive: [HX0 + 2.2, G1, 0], arriveYaw: -Math.PI / 2 }));

  // =========================================================================
  // 4. the machines
  // =========================================================================
  // Two generator sets on plinths, one of them stripped for parts.
  plinth(bWest, [-10.6, -6.4, -4.2, -2.0], FLOOR, 0.30);
  const gen1 = Mech.generatorSet(bWest, -7.4, FLOOR + 0.30, -4.2, {
    seed: 101, yaw: 0, len: 5.6, w: 1.9, stackTo: ROOF - FLOOR - 0.5,
  });
  plinth(bEast, [-0.6, -6.4, 5.8, -2.0], FLOOR, 0.30);
  const gen2 = Mech.generatorSet(bEast, 2.6, FLOOR + 0.30, -4.2, {
    seed: 102, yaw: 0, len: 5.6, w: 1.9, stackTo: ROOF - FLOOR - 0.5,
  });
  // Exhaust stacks continuing to the roof, with guy brackets on the frame.
  for (const gx of [-8.0, 3.2]) {
    const st = cyl(0.16, 0.16, 3.0, 14);
    st.translate(gx, ROOF - 1.5, -3.6);
    const cowl = cyl(0.22, 0.16, 0.24, 14);
    cowl.translate(gx, ROOF - 0.16, -3.6);
    const g = merge([st, cowl]); worldUV(g, 0.6); vertexShade(g, () => 0.62);
    bRoof.add('rust', g);
    for (const s of [-1, 1]) {
      const brk = box(0.05, 0.05, 1.2, 0.004, 1);
      brk.translate(gx, ROOF - 2.0, -3.6 + s * 0.7);
      worldUV(brk, 0.4);
      bRoof.add('machinePaint', brk);
    }
  }

  // Transformer bay, fenced off with hazard chevrons on the floor.
  Mech.transformer(bWest, -12.4, FLOOR, 5.4, { seed: 103, yaw: Math.PI / 2, w: 2.0, d: 1.3, h: 2.0 });
  plinth(bWest, [-14.0, 3.6, -10.8, 7.2], FLOOR, 0.16);
  handrail(bWest, [[-14.6, 2.9], [-10.2, 2.9]], FLOOR + 0.16, { h: 1.05, spacing: 1.5, toe: false, key: 'hazardYellow' });

  // Switchgear line-up facing the hall.
  Mech.switchgear(bEast, 1.0, FLOOR, 6.4, { seed: 104, yaw: Math.PI, bays: 6, bay: 0.82, lit: true });
  Mech.cableTray(bEast, [[-2.6, FLOOR + 2.6, 6.9], [8.0, FLOOR + 2.6, 6.9], [8.0, FLOOR + 2.6, 0.0]], {
    seed: 105, cables: 8, w: 0.40, tiers: 2,
  });

  // Air-handling plant and its ducting, disappearing through the roof.
  Mech.airHandler(bEast, 10.6, FLOOR, 4.0, { seed: 106, yaw: Math.PI / 2, len: 4.2, w: 1.6, h: 2.0 });
  ductRun(bEast, 10.6, FLOOR + 3.4, 1.2, 3.6, { axis: 'z', w: 1.1, h: 1.1, hangers: true, hangTo: FLOOR + 5.2 });
  ductRun(bEast, 10.6, FLOOR + 3.4, -2.2, 3.4, { axis: 'x', w: 1.1, h: 1.1, hangers: true, hangTo: FLOOR + 5.2 });
  {
    const riser = box(1.1, ROOF - (FLOOR + 3.9), 1.1, 0.010, 1);
    riser.translate(12.6, (ROOF + FLOOR + 3.9) / 2, -2.2);
    worldUV(riser, 0.55); vertexShade(riser, () => 0.6);
    bEast.add('ductMetal', riser);
    bEast.addColliderAt(12.6, FLOOR + 2.0, -2.2, 1.15, 4.0, 1.15, { tag: 'duct' });
  }

  // Tanks and the pipework that ties the whole building together.
  Mech.tank(bWest, -14.6, FLOOR, -8.4, { seed: 107, r: 0.78, h: 2.4, rusty: true });
  Mech.tank(bWest, -12.4, FLOOR, -8.4, { seed: 108, r: 0.78, h: 2.4 });
  Props.pipework(bWest, [
    [HX0 + 0.2, G1 - 0.3, -1.0], [-9.0, G1 - 0.3, -1.0], [-9.0, G1 - 0.3, -8.0],
    [-13.4, G1 - 0.3, -8.0], [-13.4, FLOOR + 2.5, -8.4],
  ], { seed: 109, radius: 0.075, key: 'plasticWhite', lagged: true, bracketEvery: 3.0 });
  Props.pipework(bEast, [
    [-9.0, G1 - 0.62, -0.6], [8.6, G1 - 0.62, -0.6], [8.6, G1 - 0.62, 3.2], [10.6, G1 - 0.62, 3.2],
  ], {
    seed: 110, radius: 0.036, key: 'copper', bracketEvery: 2.6,
    valves: [{ at: [1.4, G1 - 0.62, -0.6] }], gauges: [{ at: [2.6, G1 - 0.72, -0.6] }],
  });

  // Floor services.
  drainChannel(bWest, -7.4, FLOOR, 0.6, 9.0, { axis: 'x', w: 0.26, depth: 0.14 });
  drainChannel(bEast, 4.0, FLOOR, 0.6, 9.0, { axis: 'x', w: 0.26, depth: 0.14 });

  // =========================================================================
  // 5. the goods lift — the exit, and the brightest thing in the hall
  // =========================================================================
  {
    const b = bEast;
    const lift = Mech.goodsLift(b, HX1 - 0.12, FLOOR, 0, {
      seed: 121, yaw: -Math.PI / 2, w: 2.4, h: 2.8, open: 0, powered: false,
    });
    portals.push(portal('exit_lift', 'plant', [HX1 - 1.6, FLOOR, 0], -Math.PI / 2,
      { zone: null, portalId: null }, 'lift', { locked: true, isExit: true }));
    // Approach: a hazard-striped apron and a pair of bollards.
    if (D) {
      D.hazardRun(b, HX1 - 1.9, FLOOR + 0.002, 0, 3.4, { face: 'up', axis: 'z', h: 0.30, tile: 0.5, strength: 0.85 });
      D.label(b, ['GOODS LIFT', roomNumber('P', 1)], {
        face: '-x', x: HX1 - 0.30, y: FLOOR + 3.30, z: 0, w: 1.10, h: 0.34, style: 'enamel', size: 40,
      });
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: HX1 - 3.4, y: FLOOR, z: 0, w: 3.0, h: 5.0, rot: Math.PI / 2, strength: 1 });
      D.quad(b, { stamp: STAMP.scuffArc, face: 'up', x: HX1 - 3.0, y: FLOOR, z: 1.4, w: 2.6, h: 2.6, strength: 0.9 });
    }
    for (const sz of [-1.8, 1.8]) {
      const bol = cyl(0.09, 0.10, 0.9, 12); bol.translate(HX1 - 1.7, FLOOR + 0.45, sz);
      const cap = cyl(0.10, 0.09, 0.06, 12); cap.translate(HX1 - 1.7, FLOOR + 0.92, sz);
      const g = merge([bol, cap]); worldUV(g, 0.4);
      vertexShade(g, (px, py) => 0.6 + clamp01((py - FLOOR) / 1.0) * 0.3);
      b.add('hazardYellow', g);
      b.addColliderAt(HX1 - 1.7, FLOOR + 0.45, sz, 0.22, 0.9, 0.22, { tag: 'prop' });
    }
    // A pallet of fuse cores that never got fitted.
    Props.pallet(b, HX1 - 3.6, FLOOR, -2.6, { seed: 122, yaw: 0.1 });
    Props.boxStack(b, HX1 - 3.6, FLOOR + 0.145, -2.6, { seed: 123, count: 3, soakBase: 0 });
    Props.trolley(b, HX1 - 2.4, FLOOR, 2.9, { seed: 124, yaw: 1.4, load: 0.4 });
  }

  // =========================================================================
  // 6. lighting
  // =========================================================================
  let fs = 1;
  const bayLights = [
    [-12.6, -5.6, 'good'], [-12.6, 4.2, 'buzz'], [-4.2, -5.6, 'good'], [-4.2, 4.2, 'good'],
    [4.2, -5.6, 'dying'], [4.2, 4.2, 'good'], [12.6, -5.6, 'good'], [12.6, 4.2, 'dead'],
  ];
  for (const [x, z, health] of bayLights) {
    const b = x < 0 ? bWest : bEast;
    highbay(b, rigFor(b), x, ROOF - 0.55, z, { circuit: 'plant', health, seed: fs++, drop: 0.55 });
  }
  // Walkway lighting so the gantries read as a route.
  for (const [x, z, yaw, health] of [
    [HX0 + 0.35, 0, -Math.PI / 2, 'good'], [HX0 + 0.35, 7.4, -Math.PI / 2, 'buzz'],
    [-6.0, 10.2, Math.PI, 'good'], [4.0, 10.2, Math.PI, 'dying'], [12.0, 10.2, Math.PI, 'good'],
  ]) {
    const b = x < 0 ? bWest : bEast;
    bulkhead(b, rigFor(b), x, G1 + 2.25, z, { yaw, circuit: 'plant', health, seed: 40 + fs++ });
  }
  bulkhead(bEast, rigFor(bEast), HX1 - 0.3, FLOOR + 3.4, -2.4, { yaw: -Math.PI / 2, circuit: 'plant', health: 'good', seed: 60 });
  bulkhead(bEast, rigFor(bEast), HX1 - 0.3, FLOOR + 3.4, 2.4, { yaw: -Math.PI / 2, circuit: 'plant', health: 'good', seed: 61 });
  emergencyLight(bDeck, rigFor(bDeck), HX0 + 0.30, G1 + 2.5, -2.0, { yaw: -Math.PI / 2, seed: 62 });
  emergencyLight(bEast, rigFor(bEast), 12.0, FLOOR + 2.6, HZ0 + 0.4, { yaw: 0, seed: 63 });

  // =========================================================================
  // 7. dressing and evidence
  // =========================================================================
  if (D) {
    // Painted plant outlines and bay numbers on the slab.
    for (let i = 0; i < 4; i++) {
      D.label(bWest, [`${i + 1}`], {
        face: 'up', x: -14.2 + i * BAY * 2, y: FLOOR, z: -9.8, w: 0.8, h: 0.8,
        style: 'stencil', size: 90, colour: '#8d8a72', rot: Math.PI, distress: 0.5,
      });
    }
    D.quad(bWest, { stamp: STAMP.dustEdge, face: 'up', x: -7.4, y: FLOOR + 0.301, z: -4.2, w: 6.2, h: 4.2, strength: 0.9 });
    for (const [ox, oz] of [[-7.4, -1.2], [2.6, -1.2], [-12.4, 3.2]]) {
      D.quad(bWest, { stamp: STAMP.splash, face: 'up', x: ox, y: FLOOR, z: oz, w: 2.4, h: 2.0, strength: 0.7, rot: hash2(ox, oz) * TAU });
    }
    D.wallBase(bShell, HX0 + 0.1, HZ0 + 0.14, HX1 - 0.1, HZ0 + 0.14, { amount: 0.7, seed: 201, face: '+z', y: FLOOR, height: 0.8 });
    D.wallBase(bShell, HX0 + 0.1, HZ1 - 0.14, HX1 - 0.1, HZ1 - 0.14, { amount: 0.55, seed: 202, face: '-z', y: FLOOR, height: 0.8 });
    D.quad(bShell, { stamp: STAMP.sootPlume, face: '+z', x: -8.0, y: FLOOR + 5.0, z: HZ0 + 0.10, w: 3.4, h: 6.0, strength: 0.8 });
    D.quad(bShell, { stamp: STAMP.rustRun, face: '+z', x: 6.0, y: FLOOR + 4.0, z: HZ0 + 0.10, w: 1.0, h: 4.0, strength: 0.9 });
    D.label(bShell, ['PLANT', roomNumber('P', 10)], {
      face: '+z', x: -2.0, y: FLOOR + 3.6, z: HZ0 + 0.10, w: 2.4, h: 0.8, style: 'stencil',
      size: 74, colour: '#9c9585', distress: 0.55,
    });
    D.label(bDeck, ['MIND THE STEP'], {
      face: '-x', x: HX0 + 4.24, y: G1 + 1.2, z: 0, w: 0.5, h: 0.14, style: 'warning', size: 26,
    });
    D.footprints(bEast, [[6.0, -8.0], [10.0, -6.0], [14.0, -1.0], [15.4, 0.0]], {
      seed: 210, boot: true, y: FLOOR + 0.003, fade: 2.0, strength: 0.6,
    });
  }

  // Floor-level clutter: enough to be a working plant, arranged so it never
  // blocks the long axis of the hall.
  Props.workbench(bWest, -15.6, FLOOR, -2.0, { seed: 301, yaw: Math.PI / 2, w: 2.0 });
  Props.toolBoard(bWest, HX0 + 0.12, FLOOR + 1.6, -2.0, { seed: 302, yaw: Math.PI / 2, tools: 0.5 });
  Props.oilDrum(bWest, -15.2, FLOOR, 0.6, { seed: 303, yaw: 0.4 });
  Props.oilDrum(bWest, -14.5, FLOOR, 0.9, { seed: 304, yaw: 2.0, open: true });
  Props.oilDrum(bWest, -15.0, FLOOR, 1.7, { seed: 305, yaw: 1.1, fallen: true });
  Props.jerryCan(bWest, -13.7, FLOOR, 0.4, { seed: 306, yaw: 0.9 });
  Props.cableDrum(bEast, 8.4, FLOOR, -8.6, { seed: 307, yaw: 0.7, r: 0.62, onSide: true });
  Props.cableDrum(bEast, 9.9, FLOOR, -8.2, { seed: 308, yaw: 2.2, r: 0.48 });
  Props.scaffoldTower(bEast, 6.6, FLOOR, 9.4, { seed: 309, yaw: 0.05, deckH: 2.6, w: 1.4, d: 0.8 });
  Props.shelving(bEast, 14.0, FLOOR, 8.8, { seed: 310, yaw: -Math.PI / 2, w: 1.8, h: 2.2, bays: 5, contents: 0.7 });
  Props.pallet(bWest, -11.0, FLOOR, 9.4, { seed: 311, yaw: 0.2, damage: 0.6 });
  Props.pallet(bWest, -9.4, FLOOR, 9.3, { seed: 312, yaw: -0.1 });
  Props.boxStack(bWest, -9.4, FLOOR + 0.145, 9.3, { seed: 313, count: 4, soakBase: 0.3 });
  Props.fireExtinguisher(bShell, HX0 + 0.12, FLOOR + 0.35, -6.0, { seed: 314, yaw: Math.PI / 2 });
  Props.fireExtinguisher(bEast, HX1 - 0.12, FLOOR + 0.35, -5.0, { seed: 315, yaw: -Math.PI / 2 });
  Props.wasteBin(bEast, 8.0, FLOOR, 8.2, { seed: 316, kind: 'mesh', full: 0.4 });
  Props.ladder(bEast, 13.2, FLOOR, -9.6, { seed: 317, yaw: 0.2, h: 3.2, lean: 0.16 });
  Props.wetFloorSign(bWest, -5.2, FLOOR, 2.2, { seed: 318, yaw: 1.1 });
  Props.trolley(bWest, -3.4, FLOOR, -8.4, { seed: 319, yaw: 0.6, load: 0.9 });
  // Somebody's camp under the west stair.
  Props.blanketNest(bWest, -15.4, FLOOR, -7.4, { seed: 320, yaw: 0.4, r: 1.0 });
  Props.oilDrum(bWest, -16.4, FLOOR, -6.2, { seed: 321, yaw: 0.9, open: true });
  Props.plasticChair(bWest, -14.4, FLOOR, -6.4, { seed: 322, yaw: 2.5 });

  // Deck-level clutter — read from the entry frame as foreground silhouettes.
  Props.oilDrum(bDeck, HX0 + 3.4, G1, 1.6, { seed: 331, yaw: 0.3 });
  Props.cardboardBox(bDeck, HX0 + 3.3, G1, -1.5, { seed: 332, yaw: 0.6, state: 'soaked', w: 0.5, d: 0.4, h: 0.34 });
  Props.wasteBin(bDeck, HX0 + 1.0, G1, 5.4, { seed: 333, kind: 'plastic', full: 0.5 });
  Props.filingCabinet(bDeck, 9.0, G1, 9.4, { seed: 334, yaw: Math.PI, drawers: 3, damage: 0.6 });

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:plant';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables,
    spawn: [HX0 + 2.2, G1, 0],
    spawnYaw: -Math.PI / 2,
    fogProfile: 'plant',
    reverb: 'plant',
    ambient: { sky: 0x141820, ground: 0x2a2620, intensity: 0.30 },
    bounds: new THREE.Box3(
      new THREE.Vector3(HX0, FLOOR, HZ0), new THREE.Vector3(HX1, ROOF, HZ1)),
  };
}

export default buildPlant;
