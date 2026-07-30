import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway, grille } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, bulkhead, emergencyLight, handrail, stairFlight,
  gantry, boardMarks, cagedLadder, drainChannel, hollowBox, steelColumn,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import { WaterSurface } from '../Water.js';
import * as Props from '../Props.js';
import * as Mech from '../Machinery.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun, weather } from '../../render/geo.js';

/**
 * THE CISTERN — drowned maintenance tunnels.
 *
 * Everything here is decided by the water. It is 420 mm deep, which is exactly
 * the depth that is worse than either shallower or deeper: you cannot walk
 * quietly, you cannot see the floor, and you cannot swim. The Surveyor hunts by
 * sound, so this is the zone where the player's own movement is the threat.
 *
 * The water is a real surface (see Water.js) rather than a blue plane: two
 * scrolling normal layers, Beer-Lambert absorption against a per-vertex bed
 * height, a Fresnel reflection of an analytic interior, foam baked against the
 * walls, and expanding rings injected on every `player:step`. The bulkhead
 * lamps are fed to it as point highlights, so the corridor of lamps has a
 * corridor of glints running away underneath it, which is what makes the space
 * read as flooded from the first frame.
 *
 * Structure: the same 4.2 m grid, the same pipes that left the Service Spine,
 * arriving here down the stairwell and continuing east to the Plant. Corroded
 * steel, silt tide-lines at the old water level 300 mm above the current one,
 * a valve chamber with a penstock, and a stair that goes down into the water
 * and does not come back out.
 */

const WATER = 0.42;
const CEIL = 3.05;
const ARRIVE_Y = 2.60;

// Regions: [x0, z0, x1, z1, bedY]
const R_STAIRHALL = [-27.0, -3.6, -19.0, 3.6, 0.0];
const R_TUNNEL = [-19.0, -1.9, 10.0, 1.9, 0.0];
const R_CHAMBER = [10.0, -7.2, 20.4, 7.2, -0.32];
const R_GALLERY = [-7.4, 1.9, -3.0, 11.6, 0.16];
const R_SUMP = [-19.0, -6.4, -12.0, -1.9, -0.55];
const REGIONS = [R_STAIRHALL, R_TUNNEL, R_CHAMBER, R_GALLERY, R_SUMP];

const inside = (x, z, r) => x > r[0] && x < r[2] && z > r[1] && z < r[3];
function bedAt(x, z) {
  let best = 2.0;
  for (const r of REGIONS) if (inside(x, z, r)) best = Math.min(best, r[4]);
  return best;
}
function solidAt(x, z) {
  for (const r of REGIONS) if (inside(x, z, r)) return false;
  return true;
}

/** Concrete tunnel soffit. */
function soffit(b, rect, y, key = 'boardConcrete') {
  const [x0, z0, x1, z1] = rect;
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 2.6)), Math.max(1, Math.round(d / 2.6)));
  g.rotateX(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  worldUV(g, 1.3);
  vertexShade(g, () => 0.44);
  b.add(key, g);
  b.addColliderAt((x0 + x1) / 2, y + 0.3, (z0 + z1) / 2, w, 0.6, d, { tag: 'ceiling' });
}

/** Corroded steel liner ribs — the tunnels were relined once and it failed. */
function liner(b, x0, x1, z0, z1, y, h, { every = 2.1, seed = 1 } = {}) {
  const parts = [];
  for (let x = x0 + every * 0.5; x < x1; x += every) {
    for (const sz of [z0, z1]) {
      const rib = box(0.10, h, 0.055, 0.006, 1);
      rib.translate(x, y + h / 2, sz + (sz === z0 ? 0.04 : -0.04));
      parts.push(rib);
    }
    const arch = box(0.10, 0.055, Math.abs(z1 - z0), 0.006, 1);
    arch.translate(x, y + h - 0.03, (z0 + z1) / 2);
    parts.push(arch);
    for (const sz of [z0, z1]) {
      for (const hy of [y + 0.5, y + h - 0.35]) {
        const bolt = cyl(0.016, 0.016, 0.03, 6);
        bolt.rotateX(Math.PI / 2);
        bolt.translate(x, hy, sz + (sz === z0 ? 0.07 : -0.07));
        parts.push(bolt);
      }
    }
  }
  const g = merge(parts);
  worldUV(g, 0.55);
  vertexShade(g, (px, py) => 0.52 + clamp01((py - y) / h) * 0.34);
  b.add('rust', g);
}

export function buildCistern(ctx, opts = {}) {
  const { rig, bus, decals } = ctx;
  const seed = opts.seed ?? 3300;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bStair, bTunnel, bChamber, bGallery] =
    makeBuilders(ctx, 'cistern', ['stair', 'tunnel', 'chamber', 'gallery']);
  const builders = [bStair, bTunnel, bChamber, bGallery];
  const fixtures = [];
  const rigFor = (b) => rigProxy(rig, b.origin, fixtures);
  const portals = [];
  const waterFixtures = [];

  // =========================================================================
  // 1. shells
  // =========================================================================
  /**
   * Floors are registered with their standing water depth, which is what makes a
   * footstep loud. `drainedFloors` keeps the handles so that opening the penstock
   * can take the depth back out of them — otherwise the water visibly drops and
   * the player still wades noisily through a dry chamber.
   */
  const drainedFloors = [];
  const shell = (b, r, { h = CEIL, key = 'concreteWall', floorKey = 'silt', sub = 2.4 } = {}) => {
    const [x0, z0, x1, z1, y] = r;
    const g = floorSlab(b, [x0, z0, x1, z1], y, {
      key: floorKey, surface: 'water', water: WATER - y, subdiv: sub, edgeShade: 0.36,
    });
    if (g.userData.floor) drainedFloors.push({ floor: g.userData.floor, bedY: y });
    soffit(b, [x0, z0, x1, z1], y + h);
  };

  shell(bStair, R_STAIRHALL, { h: 4.2 });
  shell(bTunnel, R_TUNNEL, { h: CEIL });
  shell(bChamber, R_CHAMBER, { h: 4.9 });
  shell(bGallery, R_GALLERY, { h: 2.55 });
  shell(bStair, R_SUMP, { h: CEIL + 0.55 });

  // Walls. Each region's perimeter, minus the segments where regions meet.
  const wallFor = (b, r, h, openings = {}) => {
    const [x0, z0, x1, z1, y] = r;
    const sides = [
      ['n', x0, z0, x1, z0], ['e', x1, z0, x1, z1], ['s', x1, z1, x0, z1], ['w', x0, z1, x0, z0],
    ];
    for (const [tag, ax, az, bx, bz] of sides) {
      const spec = openings[tag];
      if (spec === 'skip') continue;
      wallRun(b, ax, az, bx, bz, {
        y, height: h, key: 'concreteWall', seed: seed + ax * 7 + az,
        perimeterAngle: false, skirting: false, shadeFloorY: y,
        openings: Array.isArray(spec) ? spec : [],
      });
    }
  };

  // Sides are named by the edge they sit on: 'n' = z0, 'e' = x1, 's' = z1,
  // 'w' = x0. Openings are measured along the run from its first point.
  //
  // Stair hall: open east into the tunnel; the west wall is built separately
  // because it carries the door back up to the Service Spine.
  wallFor(bStair, R_STAIRHALL, 4.2, {
    w: 'skip',
    e: [{ at: 0 - R_STAIRHALL[1], width: 3.8, height: 3.05 }],
  });
  // Tunnel: open at both ends; a pocket off the north side (the sump) and the
  // silt gallery off the south.
  wallFor(bTunnel, R_TUNNEL, CEIL, {
    w: 'skip', e: 'skip',
    n: [{ at: (R_SUMP[0] + R_SUMP[2]) / 2 - R_TUNNEL[0], width: R_SUMP[2] - R_SUMP[0], height: CEIL }],
    s: [{ at: R_TUNNEL[2] - (R_GALLERY[0] + R_GALLERY[2]) / 2, width: R_GALLERY[2] - R_GALLERY[0], height: 2.45 }],
  });
  // Chamber: open on the west to the tunnel, with a sill because its floor is
  // 320 mm lower — the tunnel drains into it.
  wallFor(bChamber, R_CHAMBER, 4.9, {
    w: [{ at: R_CHAMBER[3] - 0, width: 3.8, height: 3.05, sill: 0.32 }],
  });
  wallFor(bGallery, R_GALLERY, 2.55, { n: 'skip' });
  wallFor(bStair, R_SUMP, CEIL + 0.55, { s: 'skip' });

  liner(bTunnel, R_TUNNEL[0], R_TUNNEL[2], R_TUNNEL[1], R_TUNNEL[3], 0, CEIL, { every: 2.1, seed: 7 });
  liner(bGallery, R_GALLERY[0] + 0.4, R_GALLERY[2] - 0.4, R_GALLERY[1], R_GALLERY[3], 0.16, 2.55, { every: 1.9, seed: 9 });
  boardMarks(bChamber, R_CHAMBER[0], R_CHAMBER[1], R_CHAMBER[2], R_CHAMBER[1], -0.32, 4.9, { side: 1, seed: 11 });

  // =========================================================================
  // 2. the drowned stair and the door back to Service
  // =========================================================================
  {
    const b = bStair;
    // Landing at the door, dry, 2.6 m above the water, CONTINUING as a gallery
    // to the head of the stair.
    //
    // It used to stop at x = -24.6 while the stair down into the water started at
    // x = -22.6, z = -2.2 — two metres further east and half a metre outside the
    // landing's z range. So a player walking straight out of the door reached the
    // edge after 1.4 m and stepped into a 2.6 m drop with nothing under them. A
    // continuous playthrough caught the consequence without ever seeing it: the
    // player spent 1 248 consecutive frames (about 21 seconds) with no walkable
    // surface beneath them, standing in mid-air over the water for the whole
    // visit, because the controller holds y at the last floor it knew about.
    //
    // The fix is the thing the architecture needed anyway: an arrival gallery.
    // You come through a door onto a raised walkway above the flood, follow it,
    // and take the stair down into the water — which is a far better first thirty
    // seconds of this zone than being deposited on a 2.4 m square.
    const lx0 = -27.0, lx1 = -22.2;
    floorSlab(b, [lx0, -1.7, lx1, 1.7], ARRIVE_Y, {
      key: 'concreteFloor', surface: 'concrete', subdiv: 1.6, edgeShade: 0.3,
    });
    wallRun(b, lx0, -3.6, lx0, 3.6, {
      y: 0, height: 4.2, key: 'concreteWall', perimeterAngle: false, skirting: false,
      openings: [{ at: 3.6, width: 1.10, height: 2.10, sill: ARRIVE_Y }], seed: 31,
    });
    doorway(b, lx0 + 0.02, ARRIVE_Y, 0, { rotation: Math.PI / 2, width: 1.06, height: 2.08, open: 0.7, hinge: 1, seed: 32 });
    portals.push(portal('to_service', 'cistern', [lx0 + 0.7, ARRIVE_Y, 0], -Math.PI / 2,
      { zone: 'service', portalId: 'to_cistern' }, 'stair',
      { arrive: [lx0 + 1.6, ARRIVE_Y, 0], arriveYaw: -Math.PI / 2 }));

    // The stair goes down into the water and keeps going.
    // Head aligned to the gallery's z band so the route is continuous. It used to
    // sit at z = -2.2, outside the landing entirely, which is why nothing joined.
    stairFlight(b, -22.6, 0, -1.15, {
      yaw: Math.PI, steps: 14, rise: 0.1857, going: 0.28, width: 1.45,
      treadKey: 'tread', stringKey: 'rust', rails: true, railKey: 'rust',
      landing: 1.2, open: false, seed: 33,
    });
    // Rail the OPEN edges — the two long sides of the gallery and its far end —
    // rather than the middle of the route. The old rail sat across x = -24.6,
    // which is where the walkway now runs, and would have fenced the player in.
    handrail(b, [[-24.6, -1.7], [lx1, -1.7]], ARRIVE_Y, { key: 'rust', spacing: 1.2, toe: true });
    handrail(b, [[-24.6, 1.7], [lx1, 1.7]], ARRIVE_Y, { key: 'rust', spacing: 1.2, toe: true });
    handrail(b, [[lx1, -1.7], [lx1, 1.7]], ARRIVE_Y, { key: 'rust', spacing: 1.2, toe: true });
    for (const [cx, cz, dx, dz] of [
      [(-24.6 + lx1) / 2, -1.7, Math.abs(lx1 + 24.6), 0.1],
      [(-24.6 + lx1) / 2, 1.7, Math.abs(lx1 + 24.6), 0.1],
      [lx1, 0, 0.1, 3.4],
    ]) {
      b.addColliderAt(cx, ARRIVE_Y + 0.55, cz, dx, 1.1, dz, { tag: 'rail' });
    }

    bulkhead(b, rigFor(b), lx0 + 0.14, ARRIVE_Y + 1.9, 0, { yaw: -Math.PI / 2, circuit: 'cistern', health: 'good', seed: 34 });
    emergencyLight(b, rigFor(b), lx0 + 0.14, ARRIVE_Y + 2.3, 1.4, { yaw: -Math.PI / 2, seed: 35 });
    if (D) {
      D.roomPlate(b, lx0 + 0.10, ARRIVE_Y + 2.28, 0, -Math.PI / 2, roomNumber('C', 2), 'CISTERN');
      D.quad(b, { stamp: STAMP.waterRing, face: 'up', x: -25.6, y: ARRIVE_Y, z: 0, w: 2.0, h: 2.4, strength: 0.7 });
      D.footprints(b, [[-25.9, 0.4], [-24.4, 0.2]], { seed: 36, boot: true, y: ARRIVE_Y + 0.003, fade: 0.5 });
    }
  }

  // =========================================================================
  // 3. tunnel services and lighting
  // =========================================================================
  Props.pipework(bTunnel, [
    [-26.0, CEIL - 0.42, R_TUNNEL[3] - 0.36], [19.0, CEIL - 0.42, R_TUNNEL[3] - 0.36],
  ], { seed: 41, radius: 0.075, key: 'rust', bracketEvery: 2.6, valves: [{ at: [-2.0, CEIL - 0.42, R_TUNNEL[3] - 0.36] }] });
  Props.pipework(bTunnel, [
    [-26.0, CEIL - 0.68, R_TUNNEL[3] - 0.28], [19.0, CEIL - 0.68, R_TUNNEL[3] - 0.28],
  ], { seed: 42, radius: 0.034, key: 'copper', bracketEvery: 2.4 });
  Mech.cableTray(bTunnel, [[-18.0, CEIL - 0.30, R_TUNNEL[1] + 0.34], [9.6, CEIL - 0.30, R_TUNNEL[1] + 0.34]], {
    seed: 43, cables: 4, w: 0.26,
  });

  let fs = 1;
  for (let x = -17.4; x < 9.5; x += 4.2) {
    const h = hash2(Math.round(x), 3);
    let health = 'good';
    if (h < 0.14) health = 'dead'; else if (h < 0.34) health = 'dying'; else if (h < 0.62) health = 'buzz';
    const side = (fs % 2) ? R_TUNNEL[3] - 0.10 : R_TUNNEL[1] + 0.10;
    const f = bulkhead(bTunnel, rigFor(bTunnel), x, 2.30, side, {
      yaw: (fs % 2) ? Math.PI : 0, circuit: 'cistern', health, seed: 50 + fs,
      // See the chamber block below: this zone measured 1.0 unit of direct light
      // at head height against the Intake's 37.
      intensityScale: 3.0,
    });
    if (health !== 'dead') waterFixtures.push(f);
    fs++;
  }
  // Vapour-tight bulkheads around the chamber perimeter on roughly 6 m centres.
  //
  // Three of these used to light a chamber about 12 x 14 m, which left its
  // south-east quarter 8.67 m from the nearest lamp — measured with
  // tools/qa/lightreach.mjs, 19 % of the zone's walkable area beyond 5 m. That
  // is a lighting-design gap rather than an atmospheric choice: a flooded plant
  // room has a fitting at every corner because someone has to be able to wade
  // round it. Health is still mostly failing, so the room does not become bright
  // — it becomes a room with a plausible number of half-dead lamps in it.
  for (const [x, z, yaw, health] of [
    [11.0, -6.9, 0, 'good'], [19.9, 3.0, -Math.PI / 2, 'buzz'], [15.0, 6.9, Math.PI, 'dying'],
    [19.6, -6.9, 0, 'buzz'], [11.4, 4.4, Math.PI, 'dying'], [15.2, -2.0, 0, 'buzz'],
    [19.9, -1.6, -Math.PI / 2, 'good'],
  ]) {
    // intensityScale 3.0. Direct light at head height in this zone measured 1.0
    // unit against the Intake corridor's 37 — a wall bulkhead is rated at 20 cd
    // against a troffer's 31, but it is also mounted on the wall of a chamber
    // several times the size, and inverse-square does the rest. Raising the bounce
    // fill was tried and measured first: it lifted fill from 0.048 to 0.296 and
    // moved the frame's crushed-pixel fraction from 0.911 to 0.904, i.e. not at
    // all. Direct light is the lever in this zone, and this is it.
    const f = bulkhead(bChamber, rigFor(bChamber), x, 2.10, z, { yaw, circuit: 'cistern', health, seed: 70 + fs++, intensityScale: 3.0 });
    waterFixtures.push(f);
  }
  bulkhead(bGallery, rigFor(bGallery), R_GALLERY[0] + 0.12, 2.05, 7.6, { yaw: Math.PI / 2, circuit: 'cistern', health: 'dying', seed: 90 });

  // =========================================================================
  // 4. valve chamber — the sluice, the pumps, the walkway
  // =========================================================================
  {
    const b = bChamber;
    Mech.sluiceGate(b, 19.9, -0.32, -3.6, { seed: 101, yaw: -Math.PI / 2, w: 1.3, h: 1.5, openAmt: 0.18 });
    // A walkway above the water so the chamber has a second level to read.
    gantry(b, [12.4, 2.2, 19.4, 4.0], 1.62, { rails: ['n', 's'], bearerEvery: 1.6, deckKey: 'tread', steelKey: 'rust', railKey: 'rust' });
    stairFlight(b, 11.6, -0.32, 1.2, {
      yaw: 0, steps: 10, rise: 0.194, going: 0.27, width: 1.0,
      treadKey: 'tread', stringKey: 'rust', railKey: 'rust', landing: 0.8, seed: 102,
    });
    Mech.pumpSet(b, 17.4, 1.62, 3.1, { seed: 103, yaw: Math.PI, damage: 0.8 });
    Props.pipework(b, [
      [17.4, 1.94, 2.4], [17.4, 3.6, 2.4], [17.4, 3.6, -1.0], [19.9, 3.6, -1.0], [19.9, 2.0, -2.9],
    ], { seed: 104, radius: 0.062, key: 'rust', bracketEvery: 2.0, gauges: [{ at: [17.4, 3.2, 2.0] }] });
    // Valve stands in the water.
    Props.pipework(b, [[11.6, -0.1, -5.4], [19.4, -0.1, -5.4]], {
      seed: 105, radius: 0.11, key: 'rust', bracketEvery: 2.4,
      valves: [{ at: [14.0, -0.1, -5.4], wheel: 0.34 }, { at: [17.2, -0.1, -5.4], wheel: 0.28 }],
    });
    steelColumn(b, 14.6, -0.32, 0.6, 4.8, { size: 0.24, key: 'rust' });
    Mech.tank(b, 12.4, -0.32, -5.6, { seed: 106, r: 0.66, h: 1.8, rusty: true });

    if (D) {
      D.label(b, ['PENSTOCK 3', 'DO NOT OPERATE'], {
        face: '-x', x: 19.5, y: 1.7, z: -1.9, w: 0.42, h: 0.26, style: 'warning', size: 26,
      });
      D.quad(b, { stamp: STAMP.rustRun, face: '+z', x: 16.0, y: 2.6, z: R_CHAMBER[1] + 0.06, w: 1.2, h: 3.2, strength: 1 });
      D.quad(b, { stamp: STAMP.rustRun, face: '+z', x: 13.2, y: 2.2, z: R_CHAMBER[1] + 0.06, w: 0.8, h: 2.6, strength: 0.8 });
      D.quad(b, { stamp: STAMP.mould, face: '-z', x: 15.0, y: 1.6, z: R_CHAMBER[3] - 0.06, w: 3.0, h: 3.0, strength: 1 });
      D.hazardRun(b, 15.9, 1.63, 2.2, 6.6, { face: 'up', axis: 'x', h: 0.12, tile: 0.45, strength: 0.7 });
    }
    portals.push(portal('to_plant', 'cistern', [19.6, -0.32, 5.8], -Math.PI / 2,
      { zone: 'plant', portalId: 'to_cistern' }, 'hatch', { locked: true }));
    cagedLadder(b, 19.9, 1.62, 5.8, 3.2, { yaw: -Math.PI / 2, cage: true, key: 'rust' });
  }

  // Emergency lighting down the tunnel and in the chamber. With the Cistern way
  // tripped, the blackout measurement put the worst walkable point 47 m from the
  // only burning lamp — in 420 mm of water, in the dark, with a thing in it that
  // hunts by sound. Three more, on the always-powered circuit, along the route.
  for (const [ex, ey, ez, eyaw] of [
    [-13.0, 2.20, R_TUNNEL[1] + 0.12, 0],
    [-1.0, 2.20, R_TUNNEL[3] - 0.12, Math.PI],
    [12.4, 2.40, R_CHAMBER[1] + 0.12, 0],
  ]) {
    const b = ex < -12 ? bStair : ex < 10 ? bTunnel : bChamber;
    emergencyLight(b, rigFor(b), ex, ey, ez, { yaw: eyaw, seed: 36 + ex, circuit: 'emergency' });
  }

  // =========================================================================
  // 5. silt, tide lines, debris
  // =========================================================================
  if (D) {
    // The old water line, 300 mm above today's — the building has been drying.
    for (const r of [R_TUNNEL, R_CHAMBER, R_STAIRHALL]) {
      for (const [ax, az, bx, bz, face] of [
        [r[0], r[1], r[2], r[1], '+z'], [r[0], r[3], r[2], r[3], '-z'],
      ]) {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.round(len / 2.0));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
          D.quad(bTunnel, {
            stamp: STAMP.waterRing, face, x: px, y: WATER + 0.16, z: pz,
            w: len / n * 1.1, h: 0.72, strength: 0.85, lift: 0.008,
          });
          if (hash2(i, r[0]) < 0.5) {
            D.quad(bTunnel, {
              stamp: STAMP.mouldEdge, face, x: px, y: WATER + 0.85, z: pz,
              w: len / n, h: 1.1, strength: 0.9, flipU: hash2(i, 3) > 0.5,
            });
          }
        }
      }
    }
    D.quad(bTunnel, { stamp: STAMP.sprayRing, face: '+z', x: -12.0, y: 1.9, z: R_TUNNEL[1] + 0.05, w: 1.1, h: 1.1, strength: 1 });
    D.label(bTunnel, [roomNumber('C', 14)], {
      face: '+z', x: -8.0, y: 2.15, z: R_TUNNEL[1] + 0.05, w: 0.5, h: 0.16, style: 'stencil', colour: '#b9b0a0', size: 34,
    });
    D.quad(bTunnel, { stamp: STAMP.arrow, face: '+z', x: 4.2, y: 1.9, z: R_TUNNEL[1] + 0.05, w: 0.34, h: 0.6, rot: Math.PI / 2, strength: 0.8 });
  }

  // Floating and half-sunk debris. Nothing is level, nothing is repeated.
  const debris = makeRng(seed + 909);
  for (let i = 0; i < 26; i++) {
    const x = debris.range(-18, 19);
    const z = debris.range(-1.6, 1.6) + (x > 10 ? debris.range(-5, 5) : 0);
    if (solidAt(x, z)) continue;
    const kind = debris.pick(['plank', 'plank', 'box', 'can', 'tin', 'panel']);
    const b = x < -12 ? bStair : x < 10 ? bTunnel : bChamber;
    const yaw = debris() * TAU;
    if (kind === 'plank') {
      const g = box(debris.range(0.9, 2.4), 0.035, debris.range(0.10, 0.20), 0.004, 1);
      g.rotateZ(debris.range(-0.04, 0.04)); g.rotateY(yaw);
      g.translate(x, WATER - 0.012, z);
      worldUV(g, 0.5); vertexShade(g, () => 0.55);
      b.add('woodDark', g);
    } else if (kind === 'box') {
      Props.cardboardBox(b, x, WATER - 0.14, z, {
        seed: 200 + i, yaw, state: 'soaked', w: debris.range(0.30, 0.5), d: debris.range(0.26, 0.44), h: 0.30,
      });
    } else if (kind === 'can') {
      Props.jerryCan(b, x, WATER - 0.30, z, { seed: 210 + i, yaw });
    } else if (kind === 'tin') {
      const g = cyl(0.05, 0.05, 0.11, 10); g.rotateZ(Math.PI / 2); g.rotateY(yaw);
      g.translate(x, WATER - 0.03, z);
      worldUV(g, 0.3); b.add('chrome', g);
    } else {
      const g = box(debris.range(0.5, 1.0), 0.022, debris.range(0.4, 0.8), 0.003, 1);
      g.rotateZ(debris.range(-0.06, 0.06)); g.rotateY(yaw);
      g.translate(x, WATER - 0.008, z);
      worldUV(g, 0.5); vertexShade(g, () => 0.5);
      b.add('rust', g);
    }
  }
  // Big pieces, half-submerged, that break the tunnel's symmetry.
  Props.oilDrum(bTunnel, -14.6, WATER - 0.86, 1.1, { seed: 301, yaw: 0.6, fallen: false, rustKey: 'rust' });
  Props.oilDrum(bTunnel, 2.4, WATER - 0.28, -1.2, { seed: 302, yaw: 1.9, fallen: true, rustKey: 'rust' });
  Props.trolley(bTunnel, -6.0, 0, 0.6, { seed: 303, yaw: 2.4, load: 0.2 });
  Props.ladder(bTunnel, 6.4, 0, R_TUNNEL[1] + 0.3, { seed: 304, yaw: 0.1, h: 2.6, lean: 0.10, key: 'rust' });
  Props.pallet(bGallery, -5.6, 0.16, 6.4, { seed: 305, yaw: 0.3, damage: 0.8 });
  Props.shelving(bGallery, -3.4, 0.16, 9.0, { seed: 306, yaw: -Math.PI / 2, w: 1.4, h: 1.9, bays: 4, contents: 0.5, damage: 0.9 });
  Props.blanketNest(bGallery, -5.4, 0.16, 10.4, { seed: 307, yaw: 0.9, r: 0.9 });
  Props.wasteBin(bGallery, -6.6, 0.16, 9.6, { seed: 308, kind: 'mesh', full: 0.3 });
  Props.fireExtinguisher(bTunnel, -10.0, 1.05, R_TUNNEL[1] + 0.08, { seed: 309, yaw: 0 });

  // Silt banks in the gallery — the water shallows out and the floor appears.
  {
    const b = bGallery;
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.SphereGeometry(debris.range(0.5, 1.3), 8, 5);
      g.scale(1, debris.range(0.12, 0.24), 1);
      g.translate(debris.range(R_GALLERY[0] + 0.6, R_GALLERY[2] - 0.6), 0.17, debris.range(R_GALLERY[1] + 0.6, R_GALLERY[3] - 0.6));
      parts.push(g);
    }
    const g = merge(parts);
    worldUV(g, 0.9);
    vertexShade(g, (px, py, pz, nx, ny) => 0.6 + clamp01(ny) * 0.35);
    b.add('silt', g);
  }

  // =========================================================================
  // 6. the water
  // =========================================================================
  const water = new WaterSurface({
    rect: [-27.0, -7.4, 20.6, 11.8],
    level: WATER,
    bedAt, solidAt,
    res: 0.62,
    shallow: 0x33413a, deep: 0x050b0b, sky: 0x6a5330, horizon: 0x0e1513,
    absorb: 1.5, chop: 1.0, foam: 1.0,
    origin: bTunnel.origin,
  });
  water.setLamps(waterFixtures);
  water.listen(bus, (p) => ({ x: (p.x ?? p[0]) - bTunnel.origin[0], z: (p.z ?? p[2]) - bTunnel.origin[2] }));
  bTunnel.root.add(water.mesh);

  // =========================================================================
  // 7. gameplay — the penstocks and the first core
  //
  // The isolation notice says Penstock 1 is open and must stay open, Penstock 2
  // is padlocked, and "there is no configuration in which you may leave and
  // neither of them matter". It is lying by omission: shutting 1 drains this
  // floor, which is the thing the player wants, and the notice's own logic gives
  // them every reason not to. The padlock on 2 is real — it needs the key from
  // the sump — and turning 2 does nothing but make noise.
  // =========================================================================
  const interactables = [
    // Both handwheels stand on the chamber walkway, 1.05 m above its deck.
    {
      kind: 'valve', id: 'penstock_1', position: [14.6, 2.27, 3.05], rotation: 0,
      turns: 5, label: 'penstock 1', action: 'drain', targetZone: 'cistern', startOpen: true,
    },
    {
      kind: 'valve', id: 'penstock_2', position: [16.4, 2.27, 3.05], rotation: 0,
      turns: 5, label: 'penstock 2', action: 'flood', targetZone: 'cistern',
      requires: 'key_penstock', requiresMessage: 'Padlocked. Brass tag, stamped P2.',
    },
    // The first core: on the chamber bed, in the deepest and loudest water in the
    // zone, behind the tank. Wading to it is the price if the penstock stays open.
    { kind: 'pickup', item: 'fuse_core', position: [12.5, -0.26, -6.3], rotation: 0.6 },
    // The padlock key, in the sump, where a thing that has been in water a long
    // time would be.
    { kind: 'pickup', item: 'key_penstock', position: [-17.4, -0.50, -4.9], rotation: 1.4 },
    // The notice that explains the penstocks, cable-tied where you come in.
    { kind: 'pickup', item: 'note', noteId: 'note_cistern_isolation', position: [-24.4, ARRIVE_Y + 0.02, -1.2], rotation: 0.2 },
    { kind: 'pickup', item: 'note', noteId: 'note_wading', position: [-10.0, 1.02, R_TUNNEL[1] + 0.30], rotation: 0 },
    { kind: 'pickup', item: 'note', noteId: 'note_silt_log', position: [-3.5, 0.34, 8.95], rotation: -0.4 },
    { kind: 'pickup', item: 'cassette', tapeId: 'tape_cistern', position: [-5.3, 0.20, 10.3], rotation: 0.9 },
    { kind: 'pickup', item: 'battery_cell', position: [-3.5, 0.34, 9.4], rotation: 2.1 },
    // The gallery shallows out and has a nest in it. It is the only quiet corner
    // of the zone, so it is where the hiding place belongs.
    { kind: 'hide', id: 'locker_cistern', position: [-6.9, 0.16, 6.6], rotation: -Math.PI / 2 },
  ];

  // Draining. `world:drain` comes from the valve; the level animates down over
  // half a minute, and the standing-water depth comes out of every floor record
  // as it goes so that footsteps stop being loud at the same rate the water
  // stops being visible.
  let drainTarget = WATER;
  let drainLevel = WATER;
  const unsub = [
    bus?.on('world:drain', (e) => {
      if (e?.zone !== 'cistern') return;
      // `open === false` is the valve reaching SHUT, which is what drains the floor.
      drainTarget = e.open ? WATER : -0.60;
    }),
    bus?.on('world:flood', (e) => { if (e?.zone === 'cistern') drainTarget = WATER + 0.28; }),
  ].filter(Boolean);

  const applyLevel = (y) => {
    water.setLevel(y);
    for (const { floor, bedY } of drainedFloors) floor.water = Math.max(0, y - bedY);
  };

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:cistern';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables,
    spawn: [-26.0, ARRIVE_Y, 0],
    spawnYaw: -Math.PI / 2,
    fogProfile: 'cistern',
    reverb: 'cistern',
    waterLine: WATER,
    wetness: 0.9,
    ambient: { sky: 0x101a1c, ground: 0x243029, intensity: 0.30 },
    water,
    get waterLevel() { return drainLevel; },
    update(dt, local, worldPos) {
      if (Math.abs(drainTarget - drainLevel) > 0.001) {
        drainLevel += Math.sign(drainTarget - drainLevel) * Math.min(Math.abs(drainTarget - drainLevel), dt * 0.035);
        applyLevel(drainLevel);
      }
      water.update(dt, worldPos);
    },
    updateIdle(dt) { water.update(dt * 0.25, null); },
    dispose() { for (const u of unsub) u(); water.dispose(); },
    bounds: new THREE.Box3(
      new THREE.Vector3(-27, -1, -8), new THREE.Vector3(21, 5, 12)),
  };
}

export default buildCistern;
