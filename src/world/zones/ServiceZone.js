import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway, grille, conduit, outlet } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, stripLight, bulkhead, emergencyLight,
  handrail, stairFlight, boardMarks, plinth, steelColumn, drainChannel, cagedLadder,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import * as Mech from '../Machinery.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun, weather } from '../../render/geo.js';

/**
 * THE SERVICE SPINE — the building's back-of-house.
 *
 * Everything else in the Annex connects through here, so it has two jobs and
 * they pull against each other: it must be legible enough to navigate from
 * memory, and it must be the coldest, least hospitable place in the game.
 *
 * It solves that by being HONEST CONSTRUCTION. No suspended ceiling, no
 * wallcovering — board-formed concrete with the shutter marks and snap-tie
 * holes still in it, painted blockwork infill, a soffit you can read the
 * formwork off, downstand beams every 4.2 m and every service in the building
 * running along the ceiling in full view: cable tray, conduit bank, insulated
 * heating flow and return, a copper cold-water main. Those pipes leave at the
 * east end and arrive in the Plant; the same run drops through the stairwell
 * and arrives in the Cistern. Follow the pipes and you can find your way.
 *
 * Composition: one 57 m corridor is the longest sightline in the game. It is
 * deliberately interrupted — beams overhead, a scaffold tower, a barricade,
 * two doorways spilling light across the floor — and it terminates on a flight
 * of steps up to a lit lobby with the Plant's double doors at the top. The eye
 * always has somewhere to go, and it is always further in.
 */

const CEIL = KIT.ceilingService;          // 2.95
const HW = 1.35;                          // corridor half-width
const X0 = -32, X1 = 25.2;                // spine extent
const STEP_X0 = 25.2, STEP_X1 = 26.6;
const LOBBY_Y = 0.74;
const LOBBY = [26.6, -3.2, 31.5, 3.2];
const LOBBY_CEIL = 3.62;

const PLANTROOM = [-30, -12.5, -21, -HW];
const STORE = [-14, HW, -9.6, 5.8];
const STACKLOBBY = [-18.6, -5.2, -15.6, -HW];
const SAFELOBBY = [-3.6, HW, -0.6, 4.6];
const RESLOBBY = [3.4, -5.2, 6.4, -HW];
const BREAKER = [9, -9.2, 16.2, -HW];
const STAIRHALL = [17.2, HW, 23.8, 10.4];
const STAIR_BOTTOM = -3.15;

// ---------------------------------------------------------------------------

/** Flat soffit slab facing down, plus a ceiling collider. */
function soffit(b, rect, y, { key = 'boardConcrete', shade = 0.66, collide = true, sub = 2.4 } = {}) {
  const [x0, z0, x1, z1] = rect;
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / sub)), Math.max(1, Math.round(d / sub)));
  g.rotateX(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  worldUV(g, 1.4);
  vertexShade(g, (x, _y, z) => {
    const ex = 1 - clamp01((Math.abs(x - (x0 + x1) / 2) / (w / 2)) ** 2);
    const ez = 1 - clamp01((Math.abs(z - (z0 + z1) / 2) / (d / 2)) ** 2);
    return shade * (0.82 + 0.18 * Math.min(ex, ez));
  });
  b.add(key, g);
  if (collide) b.addColliderAt((x0 + x1) / 2, y + 0.3, (z0 + z1) / 2, w, 0.6, d, { tag: 'ceiling' });
}

/** Downstand concrete beam across the corridor. */
function downstand(b, x, z0, z1, y, { depth = 0.34, width = 0.30 } = {}) {
  const g = box(width, depth, Math.abs(z1 - z0) + 0.32, 0.012, 1);
  g.translate(x, y - depth / 2, (z0 + z1) / 2);
  worldUV(g, 0.9);
  vertexShade(g, (px, py, pz, nx, ny) => (ny < -0.5 ? 0.52 : 0.74));
  b.add('boardConcrete', g);
}

export function buildService(ctx, opts = {}) {
  const { rig, bus, decals } = ctx;
  const seed = opts.seed ?? 5150;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bWest, bMid, bEast, bRooms, bPlantRoom] =
    makeBuilders(ctx, 'service', ['west', 'mid', 'east', 'rooms', 'plantroom']);
  const builders = [bWest, bMid, bEast, bRooms, bPlantRoom];
  const fixtures = [];
  const R = rigProxy(rig, [0, 0, 0], fixtures);   // ZoneBuilder already offsets objects
  const rigFor = (b) => rigProxy(rig, b.origin, fixtures);
  const portals = [];
  const interactables = [];

  const byX = (x) => (x < -12 ? bWest : x < 12 ? bMid : bEast);

  // =========================================================================
  // 1. the spine
  // =========================================================================
  for (const [x0, x1, b] of [[X0, -12, bWest], [-12, 12, bMid], [12, X1, bEast]]) {
    floorSlab(b, [x0, -HW, x1, HW], 0, {
      key: 'concreteFloor', surface: 'concrete', subdiv: 2.4, edgeShade: 0.30,
    });
    soffit(b, [x0, -HW, x1, HW], CEIL);
  }

  // Walls. Openings are cut where a room or lobby meets the corridor.
  const northOpenings = [
    { x: -11.8, w: 1.05 },            // store
    { x: -2.1, w: 1.05 },             // safe lobby
    { x: 20.5, w: 1.30 },             // stair hall
  ];
  const southOpenings = [
    { x: -25.5, w: 1.60 },            // plant room (a wide leaf)
    { x: -17.1, w: 1.05 },            // stack lobby
    { x: 4.9, w: 1.05 },              // residence lobby
    { x: 12.6, w: 1.05 },             // breaker room
  ];
  for (const [zSide, list] of [[HW, northOpenings], [-HW, southOpenings]]) {
    // The wall is built in three runs so it lands in the right chunk.
    for (const [x0, x1, b] of [[X0, -12, bWest], [-12, 12, bMid], [12, X1, bEast]]) {
      const ops = list.filter((o) => o.x - o.w / 2 > x0 + 0.05 && o.x + o.w / 2 < x1 - 0.05)
        .map((o) => ({ at: o.x - x0, width: o.w, height: 2.10 }));
      wallRun(b, x0, zSide, x1, zSide, {
        height: CEIL, key: 'boardConcrete', skirtKey: 'trim', angleKey: 'trim',
        openings: ops, seed: seed + x0 * 7 + zSide, perimeterAngle: false,
        capEnds: false,
      });
      boardMarks(b, x0, zSide, x1, zSide, 0, CEIL, {
        side: zSide > 0 ? 1 : -1, seed: seed + x0,
      });
    }
  }
  // West end wall with the door back to Intake.
  wallRun(bWest, X0, -HW - 0.16, X0, HW + 0.16, {
    height: CEIL, key: 'boardConcrete', openings: [{ at: HW + 0.16, width: 1.02, height: 2.10 }],
    seed: seed + 3, perimeterAngle: false,
  });
  doorway(bWest, X0, 0, 0, { rotation: Math.PI / 2, width: 1.0, height: 2.08, open: 0.55, hinge: 1, seed: 21 });
  portals.push(portal('to_intake', 'service', [X0 + 0.9, 0, 0], -Math.PI / 2,
    { zone: 'intake', portalId: 'to_service' }, 'door',
    { arrive: [X0 + 1.9, 0, 0], arriveYaw: -Math.PI / 2 }));

  // Downstand beams on the 4.2 m grid, and a column pair at each one.
  for (let x = X0 + 2.1; x < X1; x += 4.2) {
    const b = byX(x);
    downstand(b, x, -HW, HW, CEIL);
  }

  // =========================================================================
  // 2. services on the soffit — they run the whole length and leave both ends
  // =========================================================================
  {
    const trayPts = [[X0 + 0.4, CEIL - 0.30, HW - 0.42], [X1 - 0.4, CEIL - 0.30, HW - 0.42]];
    Mech.cableTray(bMid, trayPts, { seed: seed + 11, cables: 6, w: 0.34 });
    // Heating flow and return, lagged; and a copper cold main below them.
    Props.pipework(bMid, [[X0 + 0.3, CEIL - 0.24, -HW + 0.34], [X1 + 5.4, CEIL - 0.24, -HW + 0.34]], {
      seed: seed + 12, radius: 0.075, lagged: true, bracketEvery: 2.8, key: 'plasticWhite',
    });
    Props.pipework(bMid, [[X0 + 0.3, CEIL - 0.24, -HW + 0.56], [X1 + 5.4, CEIL - 0.24, -HW + 0.56]], {
      seed: seed + 13, radius: 0.075, lagged: true, bracketEvery: 2.8, key: 'plasticWhite',
    });
    Props.pipework(bMid, [[X0 + 0.3, CEIL - 0.52, -HW + 0.30], [X1 + 5.4, CEIL - 0.52, -HW + 0.30]], {
      seed: seed + 14, radius: 0.032, key: 'copper', bracketEvery: 2.2,
      valves: [{ at: [-6.0, CEIL - 0.52, -HW + 0.30] }, { at: [14.4, CEIL - 0.52, -HW + 0.30] }],
      gauges: [{ at: [-5.2, CEIL - 0.62, -HW + 0.30] }],
    });
    conduit(bMid, [[X0 + 0.3, CEIL - 0.16, HW - 0.16], [X1 - 0.3, CEIL - 0.16, HW - 0.16]],
      { radius: 0.026, key: 'conduitMetal', clipEvery: 2.4 });
    conduit(bMid, [[X0 + 0.3, CEIL - 0.16, HW - 0.24], [X1 - 0.3, CEIL - 0.16, HW - 0.24]],
      { radius: 0.020, key: 'conduitMetal', clipEvery: 2.4 });
  }

  // =========================================================================
  // 3. lighting — strips between the beams, failing toward the middle
  // =========================================================================
  let fseed = 1;
  for (let x = X0 + 4.2; x < X1 - 1; x += 4.2) {
    const b = byX(x);
    // Failure is worst in the middle of the run, where the damp gets in.
    const t = 1 - Math.abs(x - 2) / 32;
    const h = hash2(Math.round(x * 3), 17);
    let health = 'good';
    if (h < 0.10 + t * 0.22) health = 'dead';
    else if (h < 0.24 + t * 0.30) health = 'dying';
    else if (h < 0.5) health = 'buzz';
    stripLight(b, rigFor(b), x + 2.1, CEIL - 0.10, 0.12, {
      rotation: Math.PI / 2, circuit: 'service', health, seed: fseed++, cage: true,
    });
  }
  emergencyLight(bMid, rigFor(bMid), -6.3, 2.55, HW - 0.09, { yaw: Math.PI, seed: 2 });
  emergencyLight(bEast, rigFor(bEast), 18.9, 2.55, HW - 0.09, { yaw: Math.PI, seed: 3 });

  // =========================================================================
  // 4. spine dressing — wear, signage, evidence
  // =========================================================================
  if (D) {
    // Grime and damp climb the wall base; worse where the pipes drip.
    for (const [x0, x1, b] of [[X0, -12, bWest], [-12, 12, bMid], [12, X1, bEast]]) {
      D.wallBase(b, x0, HW - 0.02, x1, HW - 0.02, { amount: 0.5, seed: seed + x0, face: '-z' });
      D.wallBase(b, x0, -HW + 0.02, x1, -HW + 0.02, { amount: 0.68, seed: seed + x0 + 5, face: '+z' });
    }
    // Traffic polish down the middle of the corridor.
    for (let x = X0 + 3; x < X1; x += 6) {
      D.quad(byX(x), {
        stamp: STAMP.wearPath, face: 'up', x, y: 0, z: 0, w: 2.0, h: 6.2,
        rot: Math.PI / 2, strength: 0.9, lift: 0.004,
      });
    }
    // Three leaks under the pipe run, each with a puddle beneath it.
    for (const lx of [-19.4, -2.6, 15.8]) {
      D.leak(byX(lx), lx, CEIL - 0.02, -HW + 0.5, {
        seed: seed + lx * 3, amount: 0.9, face: '+z', wallZ: -HW + 0.03, floorY: 0,
      });
    }
    // Wayfinding: stencilled arrows and the house room-number plates.
    D.quad(bMid, { stamp: STAMP.arrow, face: 'up', x: 8.0, y: 0, z: 0.55, w: 0.5, h: 0.9, rot: -Math.PI / 2, strength: 0.8 });
    D.quad(bWest, { stamp: STAMP.arrow, face: 'up', x: -21.0, y: 0, z: -0.55, w: 0.5, h: 0.9, rot: Math.PI / 2, strength: 0.7 });
    D.label(bEast, ['PLANT', '→'], {
      face: '-z', x: 22.6, y: 2.30, z: HW - 0.02, w: 0.62, h: 0.24, style: 'enamel', size: 44,
    });
    D.label(bWest, ['← INTAKE'], {
      face: '+z', x: -28.0, y: 2.30, z: -HW + 0.02, w: 0.70, h: 0.20, style: 'enamel', size: 40,
    });
    // Somebody has been counting.
    D.quad(bMid, { stamp: STAMP.tally, face: '+z', x: -8.4, y: 1.45, z: -HW + 0.02, w: 1.5, h: 0.55, strength: 1 });
    D.quad(bMid, { stamp: STAMP.tally, face: '+z', x: -6.8, y: 1.45, z: -HW + 0.02, w: 1.5, h: 0.55, strength: 0.9, flipU: true });
    D.quad(bMid, { stamp: STAMP.sprayX, face: '+z', x: 1.6, y: 1.55, z: -HW + 0.02, w: 0.75, h: 0.75, strength: 1 });
    // Wet boots coming up from the Cistern and heading west.
    D.footprints(bEast, [[20.5, 2.4], [20.5, 0.2], [10, 0.0], [2, -0.2]], {
      seed: seed + 77, boot: true, fade: 2.4, strength: 0.9,
    });
  }

  // Drain channel and its grating, halfway along.
  drainChannel(bMid, 0.0, 0.0, 0, 2.6, { axis: 'z', w: 0.22, depth: 0.14 });

  // Props along the corridor, never two of a kind in one sightline.
  Props.fireExtinguisher(bWest, -29.2, 0.30, -HW + 0.10, { seed: 4, yaw: 0 });
  Props.noticeboard(bWest, -22.4, 1.55, HW - 0.03, { seed: 5, yaw: Math.PI, w: 1.1, h: 0.8, sheets: 6 });
  Props.wetFloorSign(bWest, -19.2, 0, -0.35, { seed: 6, yaw: 0.7 });
  Props.trolley(bWest, -14.6, 0, 0.55, { seed: 7, yaw: 1.9, load: 0.8 });
  Props.pallet(bMid, -6.2, 0, 0.62, { seed: 8, yaw: 0.15, damage: 0.5 });
  Props.boxStack(bMid, -6.4, 0.145, 0.55, { seed: 9, count: 3, soakBase: 0.9 });
  Props.wasteBin(bMid, 3.0, 0, 0.85, { seed: 10, kind: 'mesh', full: 0.8 });
  Props.scaffoldTower(bEast, 13.6, 0, 0.05, { seed: 11, yaw: 0.08, deckH: 2.0, w: 1.3, d: 0.7 });
  Props.oilDrum(bEast, 17.9, 0, -0.75, { seed: 12, yaw: 0.4, fallen: false, open: true });
  Props.oilDrum(bEast, 18.6, 0, -0.55, { seed: 13, yaw: 2.1, fallen: true });
  Props.ladder(bWest, -26.8, 0, HW - 0.30, { seed: 14, yaw: Math.PI, h: 2.4, lean: 0.14 });
  Props.jerryCan(bEast, 23.2, 0, -0.85, { seed: 15, yaw: 0.9 });
  Props.mopBucket(bMid, 6.4, 0, -0.80, { seed: 16, yaw: 2.4, mop: true });

  // Somebody built a barricade across the corridor and then went past it anyway.
  Props.barricade(bEast, 21.4, 0, 0.0, { seed: seed + 31, yaw: Math.PI / 2, width: 2.3 });

  // =========================================================================
  // 5. the steps and the east lobby — the terminal focal element
  // =========================================================================
  // Four steps up into the lobby, built in place so the colliders land right.
  {
    const b = bEast;
    for (let i = 0; i < 4; i++) {
      const y = (i + 1) * 0.185;
      const x = STEP_X0 + i * 0.35;
      const g = box(0.35 + 0.03, 0.185, 2.70, 0.008, 1);
      g.translate(x + 0.175, y - 0.0925, 0);
      worldUV(g, 0.8);
      vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.95 : 0.66));
      b.add('concreteFloor', g);
      b.addFloor([x, -1.35, x + 0.36, 1.35], y, { surface: 'concrete', tag: 'step' });
      b.addColliderAt(x + 0.175, y - 0.0925, 0, 0.36, 0.02, 2.70, { tag: 'step', solid: false });
      if (D) D.hazardRun(b, x + 0.17, y, 0, 2.6, { face: 'up', axis: 'z', h: 0.10, tile: 0.4, strength: 0.85 });
    }
    // Lobby.
    floorSlab(b, [LOBBY[0], LOBBY[1], LOBBY[2], LOBBY[3]], LOBBY_Y, {
      key: 'concreteFloor', surface: 'concrete', subdiv: 2.0, edgeShade: 0.26,
    });
    soffit(b, [LOBBY[0] - 0.2, LOBBY[1], LOBBY[2], LOBBY[3]], LOBBY_CEIL);
    // Return walls from the corridor width out to the lobby width.
    for (const sz of [-1, 1]) {
      wallRun(b, STEP_X1 - 0.4, sz * HW, STEP_X1 - 0.4, sz * 3.2, {
        y: LOBBY_Y, height: LOBBY_CEIL - LOBBY_Y, key: 'blockWall', seed: seed + sz, perimeterAngle: false,
      });
      wallRun(b, STEP_X1 - 0.4, sz * 3.2, LOBBY[2], sz * 3.2, {
        y: LOBBY_Y, height: LOBBY_CEIL - LOBBY_Y, key: 'blockWall', seed: seed + sz * 3, perimeterAngle: false,
      });
    }
    wallRun(b, LOBBY[2], -3.2, LOBBY[2], 3.2, {
      y: LOBBY_Y, height: LOBBY_CEIL - LOBBY_Y, key: 'boardConcrete', seed: seed + 9,
      openings: [{ at: 3.2 - 0.0, width: 1.90, height: 2.30 }], perimeterAngle: false,
    });
    // Double doors to the Plant, the brightest thing at the end of the corridor.
    for (const sgn of [-1, 1]) {
      doorway(b, LOBBY[2], LOBBY_Y, sgn * 0.47, {
        rotation: Math.PI / 2, width: 0.94, height: 2.28, open: sgn > 0 ? 0.28 : 0,
        hinge: sgn, seed: 41 + sgn,
      });
    }
    portals.push(portal('to_plant', 'service', [LOBBY[2] - 0.4, LOBBY_Y, 0], -Math.PI / 2,
      { zone: 'plant', portalId: 'to_service' }, 'door',
      { arrive: [LOBBY[2] - 1.6, LOBBY_Y, 0], arriveYaw: Math.PI / 2 }));

    bulkhead(b, rigFor(b), LOBBY[2] - 0.22, LOBBY_Y + 2.55, -1.9, { yaw: -Math.PI / 2, circuit: 'service', seed: 51, health: 'good' });
    bulkhead(b, rigFor(b), LOBBY[2] - 0.22, LOBBY_Y + 2.55, 1.9, { yaw: -Math.PI / 2, circuit: 'service', seed: 52, health: 'buzz' });
    stripLight(b, rigFor(b), 28.6, LOBBY_CEIL - 0.10, 0, { rotation: 0, circuit: 'service', health: 'good', seed: 53 });

    if (D) {
      D.hazardRun(b, LOBBY[2] - 0.12, LOBBY_Y + 0.001, 0, 2.4, { face: 'up', axis: 'z', h: 0.5, tile: 0.5, chevron: true, strength: 0.7 });
      D.roomPlate(b, LOBBY[2] - 0.09, LOBBY_Y + 2.05, 1.35, -Math.PI / 2, roomNumber('S', 101), 'PLANT ACCESS');
      D.label(b, ['AUTHORISED', 'PERSONS ONLY'], {
        face: '-x', x: LOBBY[2] - 0.09, y: LOBBY_Y + 1.62, z: -1.30, w: 0.34, h: 0.22, style: 'warning', size: 30,
      });
      D.quad(b, { stamp: STAMP.scuffArc, face: 'up', x: 28.8, y: LOBBY_Y, z: 0, w: 2.2, h: 2.2, strength: 0.8 });
    }
    Props.lockers(b, 27.9, LOBBY_Y, -2.85, { seed: 61, yaw: 0, n: 5, tiers: 1, assets: ctx.assets });
    Props.firstAidBox(b, 27.6, LOBBY_Y + 1.55, 3.15, { seed: 62, yaw: Math.PI, open: true });
    Props.coatHooks(b, 30.2, LOBBY_Y + 1.72, 3.15, { seed: 63, yaw: Math.PI, w: 1.0, coats: 0.4 });
    Props.wasteBin(b, 30.6, LOBBY_Y, -2.7, { seed: 64, kind: 'plastic', full: 0.3 });
  }

  // =========================================================================
  // 6. plant room
  // =========================================================================
  {
    const b = bPlantRoom;
    const [x0, z0, x1, z1] = PLANTROOM;
    const H = 3.9;
    floorSlab(b, [x0, z0, x1, z1], 0, { key: 'concreteFloor', surface: 'concrete', subdiv: 2.6, edgeShade: 0.34 });
    soffit(b, [x0, z0, x1, z1], H);
    const walls = [
      [x0, z0, x1, z0], [x1, z0, x1, z1], [x0, z1, x0, z0],
    ];
    for (const [ax, az, bx, bz] of walls) {
      wallRun(b, ax, az, bx, bz, { height: H, key: 'blockWall', seed: seed + ax * 3 + az, perimeterAngle: false });
    }
    // North wall is shared with the corridor; only the part outside the
    // corridor opening needs building (the corridor wall covers the rest).
    wallRun(b, x0, z1, -26.3, z1, { height: H, key: 'blockWall', seed: seed + 71, perimeterAngle: false });
    wallRun(b, -24.7, z1, x1, z1, { height: H, key: 'blockWall', seed: seed + 72, perimeterAngle: false });
    doorway(b, -25.5, 0, z1, { rotation: 0, width: 1.55, height: 2.10, open: 1.15, hinge: -1, seed: 73 });

    // Two pump sets on a plinth, piped to a tank and up into the soffit.
    plinth(b, [-29.2, -8.6, -25.6, -6.4], 0, 0.22);
    const p1 = Mech.pumpSet(b, -28.2, 0.22, -7.5, { seed: 81, yaw: 0, damage: 0.6 });
    const p2 = Mech.pumpSet(b, -26.6, 0.22, -7.5, { seed: 82, yaw: 0, damage: 0.2 });
    const t1 = Mech.tank(b, -23.4, 0, -10.2, { seed: 83, r: 0.72, h: 2.1, rusty: true });
    Props.pipework(b, [
      p1.ports.discharge, [-27.5, 2.6, -7.5], [-27.5, 2.6, -2.4], [-21.6, 2.6, -2.4], [-21.6, 2.9, -1.2],
    ], { seed: 84, radius: 0.062, key: 'copper', bracketEvery: 2.0, valves: [{ at: [-27.5, 2.6, -4.6] }] });
    Props.pipework(b, [
      p2.ports.suction, [-25.0, 0.54, -7.5], [-23.4, 0.54, -9.2], [-23.4, 0.9, -9.9],
    ], { seed: 85, radius: 0.062, key: 'machinePaint', bracketEvery: 2.4 });
    Mech.cableTray(b, [[-29.6, 3.5, -3.0], [-21.4, 3.5, -3.0]], { seed: 86, cables: 4 });

    Props.workbench(b, -22.6, 0, -4.6, { seed: 87, yaw: -Math.PI / 2, w: 1.8 });
    Props.toolBoard(b, -21.15, 1.55, -4.6, { seed: 88, yaw: -Math.PI / 2, w: 1.2, h: 0.85, tools: 0.7 });
    Props.shelving(b, -29.4, 0, -3.2, { seed: 89, yaw: Math.PI / 2, w: 1.6, h: 2.0, bays: 5, contents: 0.85, damage: 0.3 });
    Props.oilDrum(b, -27.0, 0, -11.4, { seed: 90, yaw: 0.3 });
    Props.oilDrum(b, -26.3, 0, -11.7, { seed: 91, yaw: 1.9 });
    Props.jerryCan(b, -25.4, 0, -11.5, { seed: 92, yaw: 0.6 });
    Props.pallet(b, -29.0, 0, -11.6, { seed: 93, yaw: 0.05 });
    Props.boxStack(b, -29.0, 0.145, -11.6, { seed: 94, count: 4, soakBase: 0.2 });
    Props.cableDrum(b, -23.0, 0, -3.4, { seed: 95, yaw: 0.9, r: 0.5, onSide: false });
    Props.distributionBoard(b, -21.0, 1.55, -8.4, { seed: 96, yaw: -Math.PI / 2, open: true, ways: 14 });
    Props.wasteBin(b, -21.6, 0, -11.6, { seed: 97, kind: 'mesh', full: 0.6 });
    cagedLadder(b, -22.2, 0, -12.2, 3.6, { yaw: 0, cage: false });

    for (const [lx, lz, hl] of [[-27.5, -5.0, 'good'], [-23.5, -5.0, 'buzz'], [-27.5, -10.5, 'dying'], [-23.5, -10.5, 'good']]) {
      stripLight(b, rigFor(b), lx, H - 0.10, lz, { rotation: 0, circuit: 'service', health: hl, seed: 100 + lx, cage: true });
    }
    if (D) {
      D.wallBase(b, x0 + 0.1, z0 + 0.1, x1 - 0.1, z0 + 0.1, { amount: 0.75, seed: 111, face: '+z' });
      D.leak(b, -24.0, H - 0.02, -6.0, { seed: 112, amount: 1.0, floorY: 0 });
      D.quad(b, { stamp: STAMP.splash, face: 'up', x: -28.2, y: 0, z: -6.1, w: 1.6, h: 1.6, strength: 0.9 });
      D.quad(b, { stamp: STAMP.rustRun, face: '+z', x: -23.4, y: 1.3, z: -12.4, w: 0.5, h: 1.6, strength: 0.9 });
      D.roomPlate(b, -25.5, 2.32, z1 + 0.09, 0, roomNumber('S', 114), 'PUMPS');
      D.label(b, ['NO NAKED', 'FLAME'], { face: '+z', x: -27.6, y: 1.85, z: z0 + 0.10, w: 0.30, h: 0.22, style: 'warning', size: 28 });
    }
    portals.push(portal('to_cistern_pipes', 'service', [-23.4, 0, -12.2], 0,
      { zone: 'cistern', portalId: 'to_service_pipes' }, 'hatch', { locked: true }));
  }

  // =========================================================================
  // 7. breaker room — the room where every chair faces one corner
  // =========================================================================
  {
    const b = bEast;
    const [x0, z0, x1, z1] = BREAKER;
    floorSlab(b, [x0, z0, x1, z1], 0, { key: 'linoFloor', surface: 'lino', subdiv: 2.2, edgeShade: 0.30 });
    soffit(b, [x0, z0, x1, z1], CEIL);
    wallRun(b, x0, z0, x1, z0, { height: CEIL, key: 'blockWall', seed: seed + 121, perimeterAngle: false });
    wallRun(b, x1, z0, x1, z1, { height: CEIL, key: 'blockWall', seed: seed + 122, perimeterAngle: false });
    wallRun(b, x0, z1, x0, z0, { height: CEIL, key: 'blockWall', seed: seed + 123, perimeterAngle: false });
    wallRun(b, x0, z1, 12.1, z1, { height: CEIL, key: 'blockWall', seed: seed + 124, perimeterAngle: false });
    wallRun(b, 13.1, z1, x1, z1, { height: CEIL, key: 'blockWall', seed: seed + 125, perimeterAngle: false });
    doorway(b, 12.6, 0, z1, { rotation: 0, width: 1.0, height: 2.08, open: 0.85, hinge: 1, seed: 126 });

    Mech.switchgear(b, 12.4, 0, z0 + 0.55, { seed: 131, yaw: Math.PI, bays: 4, lit: true });
    Props.distributionBoard(b, x1 - 0.10, 1.6, -4.2, { seed: 132, yaw: -Math.PI / 2, open: false, ways: 12 });
    Props.distributionBoard(b, x1 - 0.10, 1.6, -5.6, { seed: 133, yaw: -Math.PI / 2, open: true, ways: 10 });
    Props.junctionBox(b, x1 - 0.10, 2.3, -3.2, { seed: 134, yaw: -Math.PI / 2 });
    Mech.cableTray(b, [[x0 + 0.4, 2.6, -1.9], [x1 - 0.4, 2.6, -1.9]], { seed: 135, cables: 7 });
    Props.desk(b, 10.4, 0, -3.4, { seed: 136, yaw: 0.4, w: 1.35, pedestal: 'left', damage: 0.5 });
    Props.paperStack(b, 10.4, 0.73, -3.4, { seed: 137, yaw: 0.2, sheets: 40 });
    // Every chair in the room faces the same corner.
    for (let i = 0; i < 4; i++) {
      const cx = 10.2 + (i % 2) * 1.1, cz = -6.4 - Math.floor(i / 2) * 0.9;
      const yaw = Math.atan2((x1 - 0.5) - cx, (z0 + 0.5) - cz);
      Props.plasticChair(b, cx, 0, cz, { seed: 140 + i, yaw });
    }
    Props.wasteBin(b, 15.4, 0, -1.9, { seed: 145, kind: 'plastic', full: 0.9 });
    Props.fireExtinguisher(b, 9.25, 0.30, -2.2, { seed: 146, yaw: Math.PI / 2 });
    stripLight(b, rigFor(b), 12.6, CEIL - 0.10, -3.2, { rotation: Math.PI / 2, circuit: 'service', health: 'buzz', seed: 147, cage: true });
    stripLight(b, rigFor(b), 12.6, CEIL - 0.10, -7.0, { rotation: Math.PI / 2, circuit: 'service', health: 'dying', seed: 148, cage: true });
    if (D) {
      D.roomPlate(b, 12.6, 2.30, z1 + 0.09, 0, roomNumber('S', 132), 'SWITCHROOM');
      D.label(b, ['DANGER', '415V'], { face: '-x', x: x1 - 0.11, y: 1.95, z: -4.2, w: 0.26, h: 0.20, style: 'warning', size: 30 });
      D.quad(b, { stamp: STAMP.tally, face: '-x', x: x1 - 0.10, y: 1.35, z: -7.4, w: 1.5, h: 0.5, strength: 1 });
      D.quad(b, { stamp: STAMP.handSmear, face: '+z', x: 12.9, y: 1.05, z: z1 - 0.10, w: 0.4, h: 0.5, strength: 1 });
      D.wallBase(b, x0 + 0.1, z0 + 0.12, x1 - 0.1, z0 + 0.12, { amount: 0.4, seed: 150, face: '+z' });
    }
  }

  // =========================================================================
  // 8. store, lobbies, stack / residence / safe doors
  // =========================================================================
  const simpleRoom = (b, rect, { h = CEIL, doorAt, doorSide, key = 'blockWall', floorKey = 'concreteFloor', surface = 'concrete', sd = 0 } = {}) => {
    const [x0, z0, x1, z1] = rect;
    floorSlab(b, [x0, z0, x1, z1], 0, { key: floorKey, surface, subdiv: 2.0, edgeShade: 0.28 });
    soffit(b, [x0, z0, x1, z1], h);
    const sides = [
      [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0],
    ];
    sides.forEach((s, i) => {
      if (i === sd) return;               // this side opens onto the corridor
      wallRun(b, s[0], s[1], s[2], s[3], {
        height: h, key, seed: seed + s[0] * 11 + i, perimeterAngle: false,
        openings: (doorSide === i && doorAt !== undefined)
          ? [{ at: doorAt, width: 1.02, height: 2.10 }] : [],
      });
    });
  };

  // Store off the north side.
  {
    const b = bWest;
    const [x0, z0, x1, z1] = STORE;
    floorSlab(b, [x0, z0, x1, z1], 0, { key: 'concreteFloor', surface: 'concrete', subdiv: 2.0, edgeShade: 0.30 });
    soffit(b, [x0, z0, x1, z1], CEIL);
    wallRun(b, x0, z0, x0, z1, { height: CEIL, key: 'blockWall', seed: 201, perimeterAngle: false });
    wallRun(b, x1, z0, x1, z1, { height: CEIL, key: 'blockWall', seed: 202, perimeterAngle: false });
    wallRun(b, x0, z1, x1, z1, { height: CEIL, key: 'blockWall', seed: 203, perimeterAngle: false });
    doorway(b, -11.8, 0, z0, { rotation: 0, width: 1.0, height: 2.08, open: 1.35, hinge: -1, seed: 204 });
    Props.shelving(b, -13.4, 0, 3.6, { seed: 211, yaw: Math.PI / 2, w: 2.0, h: 2.2, bays: 5, contents: 0.9, damage: 0.2 });
    Props.shelving(b, -10.2, 0, 3.6, { seed: 212, yaw: -Math.PI / 2, w: 2.0, h: 2.2, bays: 5, contents: 0.6, damage: 0.6 });
    Props.boxStack(b, -11.9, 0, 5.2, { seed: 213, count: 5, soakBase: 0.1 });
    Props.chairStack(b, -12.9, 0, 1.95, { seed: 214, yaw: 0.4, count: 7 });
    Props.cardboardBox(b, -10.9, 0, 2.0, { seed: 215, yaw: 0.9, state: 'collapsed' });
    stripLight(b, rigFor(b), -11.8, CEIL - 0.10, 3.6, { rotation: 0, circuit: 'service', health: 'good', seed: 216, cage: true });
    if (D) D.roomPlate(b, -11.8, 2.30, z0 - 0.09, Math.PI, roomNumber('S', 108), 'STORE');
  }

  // Stack lobby (south).
  {
    const b = bWest;
    const [x0, z0, x1, z1] = STACKLOBBY;
    simpleRoom(b, STACKLOBBY, { sd: 2, doorSide: 0, doorAt: (x1 - x0) / 2 });
    doorway(b, (x0 + x1) / 2, 0, z0, { rotation: 0, width: 1.0, height: 2.08, open: 0, hinge: 1, seed: 221 });
    portals.push(portal('to_stack', 'service', [(x0 + x1) / 2, 0, z0 + 0.2], Math.PI,
      { zone: 'stack', portalId: 'to_service' }, 'door'));
    bulkhead(b, rigFor(b), x1 - 0.12, 2.35, (z0 + z1) / 2, { yaw: -Math.PI / 2, seed: 222, health: 'dying' });
    if (D) {
      D.roomPlate(b, (x0 + x1) / 2, 2.28, z0 + 0.10, 0, roomNumber('S', 121), null);
      D.quad(b, { stamp: STAMP.tapeResidue, face: '+z', x: (x0 + x1) / 2, y: 1.55, z: z0 + 0.03, w: 0.34, h: 0.44, strength: 1 });
    }
    Props.wasteBin(b, x0 + 0.5, 0, z0 + 0.5, { seed: 223, kind: 'mesh', full: 0.2 });
  }

  // Safe-room lobby (north). A domestic door in a concrete wall.
  {
    const b = bMid;
    const [x0, z0, x1, z1] = SAFELOBBY;
    simpleRoom(b, SAFELOBBY, { sd: 0, doorSide: 2, doorAt: (x1 - x0) / 2 });
    doorway(b, (x0 + x1) / 2, 0, z1, { rotation: 0, width: 1.0, height: 2.06, open: 0, hinge: 1, seed: 231, glazed: true });
    portals.push(portal('to_safe', 'service', [(x0 + x1) / 2, 0, z1 - 0.2], 0,
      { zone: 'safe', portalId: 'to_service' }, 'door'));
    bulkhead(b, rigFor(b), x0 + 0.12, 2.35, (z0 + z1) / 2, { yaw: Math.PI / 2, seed: 232, health: 'good' });
    Props.coatHooks(b, (x0 + x1) / 2, 1.70, z0 + 0.04, { seed: 233, yaw: 0, w: 0.7, coats: 0.5 });
    if (D) {
      D.roomPlate(b, (x0 + x1) / 2, 2.26, z1 - 0.10, Math.PI, roomNumber('S', 100), 'OFFICE OF RECORD');
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2, w: 0.9, h: 3.0, strength: 1 });
    }
  }

  // Residence lobby (south).
  {
    const b = bMid;
    const [x0, z0, x1, z1] = RESLOBBY;
    simpleRoom(b, RESLOBBY, { sd: 2, doorSide: 0, doorAt: (x1 - x0) / 2 });
    doorway(b, (x0 + x1) / 2, 0, z0, { rotation: 0, width: 1.0, height: 2.06, open: 0.4, hinge: -1, seed: 241 });
    portals.push(portal('to_residence', 'service', [(x0 + x1) / 2, 0, z0 + 0.2], Math.PI,
      { zone: 'residence', portalId: 'to_service' }, 'door'));
    bulkhead(b, rigFor(b), x0 + 0.12, 2.35, (z0 + z1) / 2, { yaw: Math.PI / 2, seed: 242, health: 'buzz' });
    Props.payphone(b, x1 - 0.10, 1.42, (z0 + z1) / 2 + 0.4, { seed: 243, yaw: -Math.PI / 2, handsetOff: true });
    Props.drinkingFountain(b, x1 - 0.10, 0.98, (z0 + z1) / 2 - 0.7, { seed: 244, yaw: -Math.PI / 2 });
    if (D) {
      D.roomPlate(b, (x0 + x1) / 2, 2.26, z0 + 0.10, 0, roomNumber('S', 126), 'RESIDENCE');
      D.quad(b, { stamp: STAMP.puddle, face: 'up', x: x1 - 0.55, y: 0, z: (z0 + z1) / 2 - 0.7, w: 0.9, h: 0.9, strength: 0.8 });
    }
  }

  // =========================================================================
  // 9. stair hall — down to the Cistern
  // =========================================================================
  {
    const b = bEast;
    const [x0, z0, x1, z1] = STAIRHALL;
    const H = 4.2;
    const cx = (x0 + x1) / 2;
    // Upper floor, void, lower landing.
    floorSlab(b, [x0, z0, x1, 4.4], 0, { key: 'concreteFloor', surface: 'concrete', subdiv: 2.0, edgeShade: 0.3 });
    floorSlab(b, [x0, 8.6, x1, z1], STAIR_BOTTOM, { key: 'concreteFloor', surface: 'concrete', subdiv: 2.0, edgeShade: 0.35 });
    soffit(b, [x0, z0, x1, z1], H);
    for (const [ax, az, bx, bz] of [[x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z1, x1, z1]]) {
      wallRun(b, ax, az, bx, bz, {
        y: STAIR_BOTTOM, height: H - STAIR_BOTTOM, key: 'boardConcrete',
        seed: seed + ax * 5 + az, perimeterAngle: false, skirting: false,
        openings: (az === z1 && bz === z1) ? [{ at: (bx - ax) / 2, width: 1.10, height: 2.10, sill: -STAIR_BOTTOM }] : [],
      });
    }
    // The corridor wall covers z0 between the door reveals; add the returns.
    wallRun(b, x0, z0, 19.85, z0, { height: H, key: 'boardConcrete', seed: 301, perimeterAngle: false });
    wallRun(b, 21.15, z0, x1, z0, { height: H, key: 'boardConcrete', seed: 302, perimeterAngle: false });
    doorway(b, 20.5, 0, z0, { rotation: 0, width: 1.26, height: 2.10, open: 1.1, hinge: 1, seed: 303 });

    // The flight itself: bottom at z=8.9 rising toward -Z to z=4.4.
    stairFlight(b, cx, STAIR_BOTTOM, 8.75, {
      yaw: Math.PI, steps: 17, rise: 0.1853, going: 0.265, width: 1.45,
      treadKey: 'tread', stringKey: 'machinePaint', rails: true, landing: 0.7,
      open: false, seed: 311,
    });
    // Balustrade around the void so the drop reads as a drop.
    handrail(b, [[x0 + 0.10, 4.4], [cx - 0.78, 4.4]], 0, { spacing: 1.2 });
    handrail(b, [[cx + 0.78, 4.4], [x1 - 0.10, 4.4]], 0, { spacing: 1.2 });
    b.addColliderAt((x0 + cx - 0.78) / 2, 0.55, 4.4, cx - 0.78 - x0, 1.1, 0.1, { tag: 'rail' });
    b.addColliderAt((cx + 0.78 + x1) / 2, 0.55, 4.4, x1 - cx - 0.78, 1.1, 0.1, { tag: 'rail' });

    // Services drop through the well and continue into the Cistern.
    Props.pipework(b, [
      [x1 - 0.55, 2.6, 2.2], [x1 - 0.55, 2.6, 6.0], [x1 - 0.55, STAIR_BOTTOM + 0.9, 8.0],
      [x1 - 0.55, STAIR_BOTTOM + 0.9, z1 + 0.4],
    ], { seed: 321, radius: 0.075, key: 'plasticWhite', lagged: true, bracketEvery: 2.2 });
    Props.pipework(b, [
      [x1 - 0.30, 2.35, 2.2], [x1 - 0.30, 2.35, 6.4], [x1 - 0.30, STAIR_BOTTOM + 0.7, 8.4],
      [x1 - 0.30, STAIR_BOTTOM + 0.7, z1 + 0.4],
    ], { seed: 322, radius: 0.036, key: 'copper', bracketEvery: 2.0, valves: [{ at: [x1 - 0.30, STAIR_BOTTOM + 0.7, 9.2] }] });

    doorway(b, cx, STAIR_BOTTOM, z1, { rotation: 0, width: 1.08, height: 2.08, open: 0.5, hinge: 1, seed: 331 });
    portals.push(portal('to_cistern', 'service', [cx, STAIR_BOTTOM, z1 - 0.3], 0,
      { zone: 'cistern', portalId: 'to_service' }, 'stair'));

    bulkhead(b, rigFor(b), x0 + 0.12, 2.2, 6.6, { yaw: Math.PI / 2, seed: 341, health: 'good' });
    bulkhead(b, rigFor(b), x1 - 0.12, STAIR_BOTTOM + 2.1, 9.4, { yaw: -Math.PI / 2, seed: 342, health: 'dying' });
    stripLight(b, rigFor(b), cx, H - 0.10, 2.9, { rotation: 0, circuit: 'service', health: 'good', seed: 343, cage: true });
    emergencyLight(b, rigFor(b), x0 + 0.12, 2.5, 4.9, { yaw: Math.PI / 2, seed: 344 });

    if (D) {
      D.roomPlate(b, 20.5, 2.30, z0 - 0.09, Math.PI, roomNumber('S', 140), 'STAIR C');
      D.hazardRun(b, cx, 0.002, 4.30, 5.4, { face: 'up', axis: 'x', h: 0.16, tile: 0.4, strength: 0.9 });
      D.footprints(b, [[cx, 9.6], [cx, 5.0], [cx, 2.0], [20.5, 1.0]], { seed: 345, boot: true, y: STAIR_BOTTOM + 0.003, fade: 0.9 });
      D.quad(b, { stamp: STAMP.mould, face: '+x', x: x0 + 0.04, y: STAIR_BOTTOM + 1.1, z: 9.0, w: 1.6, h: 1.9, strength: 1 });
      D.quad(b, { stamp: STAMP.waterRing, face: 'up', x: cx, y: STAIR_BOTTOM, z: 9.6, w: 2.4, h: 2.0, strength: 0.9 });
      D.label(b, ['LOWER LEVEL', 'FLOOD RISK'], {
        face: '-z', x: cx + 1.4, y: STAIR_BOTTOM + 1.7, z: z1 - 0.05, w: 0.36, h: 0.24, style: 'warning', size: 26,
      });
    }
    Props.wetFloorSign(b, cx - 1.5, STAIR_BOTTOM, 9.5, { seed: 351, yaw: 0.4 });
    Props.mopBucket(b, x0 + 0.7, STAIR_BOTTOM, 9.7, { seed: 352, yaw: 1.2 });
    Props.blanketNest(b, x1 - 1.1, STAIR_BOTTOM, 9.3, { seed: 353, yaw: 0.5, r: 0.8 });
  }

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:service';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables,
    spawn: [X0 + 2.4, 0, 0],
    spawnYaw: -Math.PI / 2,
    fogProfile: 'service',
    reverb: 'service',
    ambient: { sky: 0x161a1e, ground: 0x24262a, intensity: 0.26 },
    bounds: new THREE.Box3(
      new THREE.Vector3(-32, STAIR_BOTTOM, -13),
      new THREE.Vector3(32, 4.4, 11)),
  };
}

export default buildService;
