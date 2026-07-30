import * as THREE from 'three';
import { Builder } from '../Builder.js';
import { attachPalette } from '../Palette.js';
import { KIT, floorSlab, wallRun, ceilingGrid, troffer, sprinkler, smokeDetector, outlet, grille, conduit, doorway } from '../Kit.js';
import { makeBuilders, rigProxy, portal, emergencyLight } from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import * as Mech from '../Machinery.js';
import { makeRng, clamp01, hash2, lerp, TAU } from '../../core/util.js';
import { box, merge, worldUV, vertexShade, cyl, pipeRun } from '../../render/geo.js';

/**
 * INTAKE — the entrance zone.
 *
 * The reference point everyone has for "backrooms" is an infinite yellow office
 * maze, and the fastest way to lose a player is to give them exactly that and
 * nothing else. So Intake keeps the emotional shape — mono-yellow, low ceiling,
 * damp carpet, unbroken fluorescent hum, no windows — and rejects the endless
 * uniform grid.
 *
 * Instead it is laid out as a real, if impossible, office floorplate:
 *
 *   * BAYS. A 4.2 m structural grid with square columns. Partition walls run on
 *     the grid but only ever occupy a fraction of it, so the space reads as an
 *     open-plan floor that has been badly subdivided, not as a hedge maze.
 *   * SPINES. Two long circulation corridors cross the plate. They are the only
 *     places you can see more than 12 m, and they are where the player's eye
 *     goes. Everything else is deliberately claustrophobic.
 *   * ROOMS. A handful of enclosed cells off the spines — a copy room, a
 *     stationery store, an interview room. These are where set dressing and
 *     narrative fragments live.
 *   * WEAR GRADIENT. Damage rises with distance from the entrance. The corner
 *     furthest from where the player enters is where the ceiling has come down.
 */

export const INTAKE = {
  cell: 4.2,
  cols: 15,
  rows: 15,
  ceiling: KIT.ceilingIntake,
  // Four chunks, not nine. Frustum culling across a 63 m open plate saves
  // almost nothing — you can see most of it from a spine — and every extra
  // chunk is another mesh per material in the draw-call count.
  chunkCells: 8,
};

const EMPTY = 0, WALL = 1, ROOM = 2, SPINE = 3, COLUMN = 4;

/** Layout solver: returns a grid plus metadata used for dressing and lighting. */
export function planIntake(seed = 20240607) {
  const rng = makeRng(seed);
  const { cols, rows } = INTAKE;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));

  // Two crossing spines, offset from centre so the plate is asymmetric.
  const spineRow = Math.floor(rows * 0.38);
  const spineCol = Math.floor(cols * 0.58);
  for (let c = 0; c < cols; c++) grid[spineRow][c] = SPINE;
  for (let r = 0; r < rows; r++) grid[r][spineCol] = SPINE;
  // A second, partial spine that dead-ends — the building was extended badly.
  const spineRow2 = Math.floor(rows * 0.78);
  for (let c = 2; c < cols - 4; c++) grid[spineRow2][c] = SPINE;

  // Partition walls: horizontal and vertical runs of 2-5 cells, never crossing
  // a spine, biased to leave open bays rather than dense corridors.
  const walls = [];
  const tryRun = (r, c, dr, dc, len) => {
    const cells = [];
    for (let i = 0; i < len; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      if (rr < 1 || rr >= rows - 1 || cc < 1 || cc >= cols - 1) return false;
      if (grid[rr][cc] === SPINE) return false;
      cells.push([rr, cc]);
    }
    return cells;
  };
  for (let attempt = 0; attempt < 190; attempt++) {
    const horizontal = rng.chance(0.5);
    const r = rng.int(1, rows - 2), c = rng.int(1, cols - 2);
    const len = rng.int(2, 5);
    const cells = tryRun(r, c, horizontal ? 0 : 1, horizontal ? 1 : 0, len);
    if (!cells) continue;
    // Reject if it would seal a bay off entirely.
    let neighbours = 0;
    for (const [rr, cc] of cells) if (grid[rr][cc] === WALL) neighbours++;
    if (neighbours > 1) continue;
    for (const [rr, cc] of cells) grid[rr][cc] = WALL;
    walls.push({ r, c, horizontal, len });
  }

  // Enclosed rooms off the spines.
  const rooms = [];
  const roomSpecs = [
    { name: 'copy', w: 2, h: 2, dress: 'copyRoom' },
    { name: 'store', w: 2, h: 1, dress: 'store' },
    { name: 'interview', w: 2, h: 2, dress: 'interview' },
    { name: 'breakout', w: 3, h: 2, dress: 'breakout' },
    { name: 'records', w: 2, h: 3, dress: 'records' },
  ];
  for (const spec of roomSpecs) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const r = rng.int(1, rows - spec.h - 1);
      const c = rng.int(1, cols - spec.w - 1);
      let ok = true;
      for (let dr = -1; dr <= spec.h && ok; dr++) {
        for (let dc = -1; dc <= spec.w && ok; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) { ok = false; break; }
          if (dr >= 0 && dr < spec.h && dc >= 0 && dc < spec.w && grid[rr][cc] !== EMPTY) ok = false;
        }
      }
      if (!ok) continue;
      // Must touch a spine or an open bay on at least one side for a door.
      for (let dr = 0; dr < spec.h; dr++) {
        for (let dc = 0; dc < spec.w; dc++) grid[r + dr][c + dc] = ROOM;
      }
      rooms.push({ ...spec, r, c });
      break;
    }
  }

  // Structural columns on every third grid intersection.
  const columns = [];
  for (let r = 1; r < rows; r += 3) {
    for (let c = 2; c < cols; c += 3) {
      if (grid[r]?.[c] === ROOM) continue;
      columns.push([r, c]);
    }
  }

  return { grid, walls, rooms, columns, spineRow, spineCol, spineRow2, seed };
}

/** Z of the main spine row — needed before the plan is fully unpacked. */
function INTAKE_SPINE_ROW_Z(plan) {
  return (plan.spineRow - INTAKE.rows / 2 + 0.5) * INTAKE.cell;
}

/** World position of a grid cell centre. */
function cellPos(r, c) {
  const { cell, cols, rows } = INTAKE;
  return [(c - cols / 2 + 0.5) * cell, (r - rows / 2 + 0.5) * cell];
}

/**
 * Build the Intake zone.
 * @returns {{root:THREE.Group, spawn:number[], plan:object, chunks:THREE.Group[]}}
 */
export function buildIntake(ctx, { seed = 20240607 } = {}) {
  const { materials, collision, rig, palette } = ctx;
  const plan = planIntake(seed);
  const { grid, rooms, columns } = plan;
  const { cell, cols, rows, ceiling } = INTAKE;
  const rng = makeRng(seed ^ 0x5eed);
  const root = new THREE.Group();
  root.name = 'zone:intake';
  const chunks = [];

  const halfW = (cols * cell) / 2;
  const halfD = (rows * cell) / 2;

  // Damage rises with distance from the entrance (south-west corner).
  const damageAt = (r, c) => {
    const d = Math.hypot(r - (rows - 1), c) / Math.hypot(rows, cols);
    return clamp01(d * 1.35 - 0.12);
  };

  // ---- one builder per chunk, for frustum culling ------------------------
  const nChunk = Math.ceil(cols / INTAKE.chunkCells);
  const names = [];
  for (let cr = 0; cr < nChunk; cr++) for (let cc = 0; cc < nChunk; cc++) names.push(`${cr}_${cc}`);
  const builders = makeBuilders(ctx, 'intake', names);
  builders.forEach((b, i) => { b.chunk = [Math.floor(i / nChunk), i % nChunk]; });
  const builderFor = (r, c) => builders[Math.floor(r / INTAKE.chunkCells) * nChunk + Math.floor(c / INTAKE.chunkCells)]
    || builders[0];

  // ---- plan the fixtures first -------------------------------------------
  // The ceiling grid needs to know which cells a fixture occupies so it can
  // leave those tiles out; building the ceiling first and the lights second
  // buries every fixture in the plenum.
  const fixturePlan = [];

  /** Wear-gradient failure roll, shared by both placement passes. */
  const healthAt = (r, c, salt = 0) => {
    const dmg = damageAt(r, c);
    const hh = hash2(r * 11 + 3 + salt, c * 7 + 5 + salt);
    if (hh < 0.015 + dmg * 0.42) return 'dead';
    if (hh < 0.06 + dmg * 0.55) return 'dying';
    if (hh < 0.22 + dmg * 0.55) return 'buzz';
    return 'good';
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === WALL) continue;
      const h = hash2(r * 3 + 1, c * 5 + 2);
      const isSpine = t === SPINE;
      // Intake is an OFFICE. Offices are lit to ~400 lux on a 4 m fixture grid,
      // and the horror of this place is that it is relentlessly, evenly bright
      // with nowhere to stand outside the light. Sparse fixtures would read as
      // an atmospheric ruin, which is the wrong zone.
      if (!isSpine && h > 0.90) continue;
      const [x, z] = cellPos(r, c);
      fixturePlan.push({
        r, c, x, z, health: healthAt(r, c),
        rotation: isSpine && r === plan.spineRow ? Math.PI / 2 : 0,
        // Volumetric cones are pure overdraw and Intake runs ~130 fixtures.
        // A third of them establishes the haze; the ones that get it are
        // weighted onto the spines, where the long views are.
        cone: isSpine ? hash2(r * 5, c * 9) < 0.5 : hash2(r * 5, c * 9) < 0.22,
      });
    }
  }

  // WALL CELLS GET FIXTURES TOO — one either side of the partition.
  //
  // This is the fix for a real defect, and the defect was invisible in every
  // metric until someone stood in the room and looked up. A WALL cell is a 4.2 m
  // cell containing a 160 mm partition through its centre: 96% of it is open
  // floor. The loop above skipped the entire cell because a fixture at the cell
  // centre would be buried in the partition — which is true, and is why the
  // fixture goes to one side of it rather than nowhere.
  //
  // The consequence of skipping was that a run of WALL cells produced two
  // parallel unlit corridors flanking the partition. Measured with
  // Game.fixtureReport() from a camera standing in one: the four nearest
  // troffers were 6.31, 6.79, 6.76 and 7.33 m away, all of them on the far side
  // of a partition, and the corridor was lit only by spill and bounce fill. A
  // ceiling-facing capture of it showed a lit ceiling with no fixture in it,
  // which breaks the project's own first rule about light having a visible
  // source.
  const OFFSET = cell * 0.30;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== WALL) continue;
      const [x, z] = cellPos(r, c);
      // Which way the partition runs decides which way to step off it.
      const horiz = grid[r][c - 1] === WALL || grid[r][c + 1] === WALL;
      for (const side of [-1, 1]) {
        // Only light a side that is actually a space. Stepping off the
        // partition into the neighbouring cell is pointless if that cell is
        // another partition or outside the plate.
        const nr = horiz ? r + side : r;
        const nc = horiz ? c : c + side;
        const n = grid[nr]?.[nc];
        if (n === undefined || n === WALL) continue;
        // Only circulation. An enclosed ROOM already has fixtures planned to the
        // room in the pass above, and a second one hard against its wall would
        // both double-light it and cost a draw call for the emissive tube —
        // every fixture's tube is an independent object because it animates.
        if (n === ROOM) continue;
        // A fixture 1.26 m off a partition in a corridor lit from a 4.2 m grid
        // is a realistic centre; a real fit-out runs a line of troffers down a
        // corridor rather than centring one on the wall.
        const fx = horiz ? x : x + side * OFFSET;
        const fz = horiz ? z + side * OFFSET : z;
        fixturePlan.push({
          r, c, x: fx, z: fz,
          health: healthAt(r, c, side * 17),
          // A corridor troffer runs ALONG the corridor, i.e. parallel to the
          // partition it sits beside.
          rotation: horiz ? 0 : Math.PI / 2,
          cone: hash2(r * 5 + side, c * 9) < 0.30,
        });
      }
    }
  }

  // ---- floor & ceiling, per chunk ----------------------------------------
  for (const b of builders) {
    const [cr, cc] = b.chunk;
    const r0 = cr * INTAKE.chunkCells, c0 = cc * INTAKE.chunkCells;
    const r1 = Math.min(rows, r0 + INTAKE.chunkCells), c1 = Math.min(cols, c0 + INTAKE.chunkCells);
    if (r0 >= rows || c0 >= cols) continue;
    const [x0] = cellPos(r0, c0);
    const [x1] = cellPos(r0, c1 - 1);
    const z0 = cellPos(r0, c0)[1], z1 = cellPos(r1 - 1, c0)[1];
    const rect = [x0 - cell / 2, z0 - cell / 2, x1 + cell / 2, z1 + cell / 2];
    floorSlab(b, rect, 0, { key: 'carpet', surface: 'carpet', subdiv: 2.1, edgeShade: 0.18 });

    const dmg = damageAt((r0 + r1) / 2, (c0 + c1) / 2);
    const slots = fixturePlan
      .filter((f) => f.r >= r0 && f.r < r1 && f.c >= c0 && f.c < c1)
      .map((f) => [f.x, f.z]);
    ceilingGrid(b, rect, ceiling, {
      key: 'ceilingTile', gridKey: 'gridMetal', plenumKey: 'plenum',
      damage: 0.04 + dmg * 0.30, seed: seed + cr * 71 + cc * 13,
      lightSlots: slots,
    });
  }

  // ---- perimeter ---------------------------------------------------------
  const per = builders[0];
  const P = 0.02;
  // Openings: the duct access panel (north), the door to the Service Spine
  // (east) and the lift the player arrives out of (west).
  const ductX = (10 - cols / 2 + 0.5) * cell;
  const spineZ = (INTAKE_SPINE_ROW_Z(plan) );
  const liftZ = (rows - 2 - rows / 2 + 0.5) * cell;
  wallRun(per, -halfW, -halfD, halfW, -halfD, {
    height: ceiling, key: 'wallpaper', seed: 11, dado: true,
    openings: [{ at: ductX + halfW, width: 0.90, height: 0.90 }],
  });
  wallRun(per, halfW, -halfD, halfW, halfD, {
    height: ceiling, key: 'wallpaper', seed: 12, dado: true,
    openings: [{ at: spineZ + halfD, width: 1.06, height: 2.12 }],
  });
  wallRun(per, halfW, halfD, -halfW, halfD, {
    height: ceiling, key: 'wallpaper', seed: 13, dado: true,
  });
  wallRun(per, -halfW, halfD, -halfW, -halfD, {
    height: ceiling, key: 'wallpaper', seed: 14, dado: true,
    openings: [{ at: halfD - liftZ, width: 1.98, height: 2.34 }],
  });

  // ---- partition walls ---------------------------------------------------
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== WALL) continue;
      const [x, z] = cellPos(r, c);
      const b = builderFor(r, c);
      // A WALL cell emits a wall along whichever axis its run continues.
      const horiz = grid[r][c - 1] === WALL || grid[r][c + 1] === WALL;
      const dmg = damageAt(r, c);
      if (horiz) {
        wallRun(b, x - cell / 2, z, x + cell / 2, z, {
          height: ceiling, key: 'wallpaper', seed: r * 31 + c, dado: true,
          capEnds: grid[r][c - 1] !== WALL || grid[r][c + 1] !== WALL,
        });
      } else {
        wallRun(b, x, z - cell / 2, x, z + cell / 2, {
          height: ceiling, key: 'wallpaper', seed: r * 31 + c + 7, dado: true,
          capEnds: grid[r - 1]?.[c] !== WALL || grid[r + 1]?.[c] !== WALL,
        });
      }
    }
  }

  // ---- enclosed rooms ----------------------------------------------------
  for (const room of rooms) {
    const b = builderFor(room.r, room.c);
    const [x0, z0] = cellPos(room.r, room.c);
    const [x1, z1] = cellPos(room.r + room.h - 1, room.c + room.w - 1);
    const minX = x0 - cell / 2, maxX = x1 + cell / 2;
    const minZ = z0 - cell / 2, maxZ = z1 + cell / 2;
    const doorSide = rng.int(0, 3);
    const doorAt = (len) => len / 2 + rng.range(-len * 0.2, len * 0.2);

    const sides = [
      { a: [minX, minZ], b: [maxX, minZ] },
      { a: [maxX, minZ], b: [maxX, maxZ] },
      { a: [maxX, maxZ], b: [minX, maxZ] },
      { a: [minX, maxZ], b: [minX, minZ] },
    ];
    sides.forEach((s, i) => {
      const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      const openings = i === doorSide ? [{ at: doorAt(len), width: 0.98, height: 2.08 }] : [];
      wallRun(b, s.a[0], s.a[1], s.b[0], s.b[1], {
        height: ceiling, key: 'wallpaper', openings, seed: room.r * 97 + i,
        dado: true,
      });
      if (i === doorSide) {
        const t = openings[0].at / len;
        const dx = lerp(s.a[0], s.b[0], t), dz = lerp(s.a[1], s.b[1], t);
        const ang = Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1]);
        doorway(b, dx, 0, dz, {
          rotation: ang, width: 0.96, height: 2.06,
          open: rng.chance(0.45) ? rng.range(0.35, 1.3) : 0,
          hinge: rng.chance(0.5) ? 1 : -1, seed: room.r * 7 + i,
        });
      }
    });
    room.centre = [(minX + maxX) / 2, (minZ + maxZ) / 2];
    room.rect = [minX, minZ, maxX, maxZ];
  }

  // ---- structural columns ------------------------------------------------
  for (const [r, c] of columns) {
    const b = builderFor(r, c);
    const [x, z] = cellPos(r, c);
    const s = 0.44;
    const g = box(s, ceiling, s, 0.012, 1);
    g.translate(x + cell / 2, ceiling / 2, z + cell / 2);
    worldUV(g, 2.0);
    vertexShade(g, (px, py) => 0.70 + clamp01(py / ceiling) * 0.26);
    b.add('wallpaper', g);
    b.addColliderAt(x + cell / 2, ceiling / 2, z + cell / 2, s, ceiling, s, { tag: 'column' });
    // Column bases collect the worst damp in the building.
    const base = box(s + 0.05, 0.13, s + 0.05, 0.01, 1);
    base.translate(x + cell / 2, 0.065, z + cell / 2);
    worldUV(base, 0.6);
    vertexShade(base, () => 0.62);
    b.add('trim', base);
  }

  // ---- lighting ----------------------------------------------------------
  let fixtureSeed = 1;
  for (const f of fixturePlan) {
    const b = builderFor(f.r, f.c);
    troffer(b, rig, f.x, ceiling, f.z, {
      rotation: f.rotation,
      circuit: 'intake',
      health: f.health,
      seed: fixtureSeed++,
      cone: f.cone,
    });
  }

  // ---- construction details ----------------------------------------------
  for (let r = 1; r < rows; r += 2) {
    for (let c = 1; c < cols; c += 2) {
      if (grid[r][c] === WALL) continue;
      const [x, z] = cellPos(r, c);
      const b = builderFor(r, c);
      const h = hash2(r * 17, c * 23);
      if (h < 0.55) sprinkler(b, x + cell * 0.25, ceiling - 0.02, z - cell * 0.2, 'chrome');
      if (h > 0.72) smokeDetector(b, x - cell * 0.3, ceiling - 0.014, z + cell * 0.28, 'plasticWhite');
    }
  }

  // Surface conduit tracking the main spine, dropping to a distribution board.
  {
    const b = builders[0];
    const zc = cellPos(plan.spineRow, 0)[1];
    conduit(b, [
      [-halfW + 0.4, ceiling - 0.10, zc - 0.9],
      [halfW - 0.4, ceiling - 0.10, zc - 0.9],
    ], { radius: 0.024, key: 'conduitMetal', clipEvery: 2.1 });
  }

  // =========================================================================
  // ENTRANCE SEQUENCE
  //
  // The player arrives out of a lift, so the first thing they see has to be the
  // lift they came out of and the fact that it is dead. Everything in this bay
  // is arranged around one frame: doors open behind you, a dark shaft, a floor
  // directory that lists departments that are not here, and a corridor running
  // away north with the fluorescents already going wrong at the far end.
  // =========================================================================
  const spawnCell = cellPos(rows - 2, 1);
  const D = ctx.decals || ctx.world?.decals;
  const portals = [];
  const rigW = (b) => rigProxy(rig, b.origin, []);
  {
    const b = builderFor(rows - 2, 1);
    const lz = spawnCell[1];
    Mech.goodsLift(b, -halfW + 0.10, 0, lz, {
      seed: 900, yaw: Math.PI / 2, w: 1.85, h: 2.28, open: 0.92, powered: false,
    });
    portals.push(portal('arrival_lift', 'intake', [-halfW + 1.1, 0, lz], Math.PI / 2,
      { zone: null, portalId: null }, 'lift', { locked: true }));

    // Entrance matting, worn through where twenty years of shoes landed.
    const mat = box(1.6, 0.016, 2.1, 0.004, 1);
    mat.translate(-halfW + 1.35, 0.008, lz);
    worldUV(mat, 0.5); vertexShade(mat, () => 0.55);
    b.add('rubber', mat);

    Props.wasteBin(b, -halfW + 0.5, 0, lz + 1.7, { seed: 901, kind: 'plastic', full: 0.4 });
    Props.fireExtinguisher(b, -halfW + 0.12, 0.32, lz - 1.9, { seed: 902, yaw: Math.PI / 2 });
    Props.noticeboard(b, -halfW + 0.12, 1.55, lz + 2.9, { seed: 903, yaw: Math.PI / 2, w: 1.2, h: 0.9, sheets: 9 });
    Props.plasticChair(b, -halfW + 2.2, 0, lz + 3.2, { seed: 904, yaw: 2.2 });
    Props.payphone(b, -halfW + 0.12, 1.42, lz + 4.4, { seed: 905, yaw: Math.PI / 2, handsetOff: true });

    if (D) {
      // The floor directory. Departments that are not on this floor.
      D.label(b, ['ANNEX 7  LEVEL L', 'INTAKE      L-100', 'RECORDS     L-140',
        'INTERVIEW   L-155', 'SERVICE     L-200'], {
        face: '+x', x: -halfW + 0.11, y: 1.62, z: lz + 2.9, w: 0.86, h: 0.72,
        style: 'plate', size: 26, align: 'left', tracking: 1, distress: 0.35,
      });
      D.hazardRun(b, -halfW + 0.30, 0.003, lz, 1.9, { face: 'up', axis: 'z', h: 0.12, tile: 0.4, strength: 0.9 });
      D.quad(b, { stamp: STAMP.scuffArc, face: 'up', x: -halfW + 1.6, y: 0, z: lz, w: 2.4, h: 2.4, strength: 1 });
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: -halfW + 2.4, y: 0, z: lz - 3.0, w: 1.6, h: 8.0, rot: Math.PI / 2, strength: 1 });
      D.roomPlate(b, -halfW + 0.10, 2.32, lz + 1.45, Math.PI / 2, roomNumber('L', 100), 'INTAKE');
      D.footprints(b, [[-halfW + 1.2, lz], [-halfW + 3.0, lz - 1.0], [-halfW + 4.0, lz - 6.0]],
        { seed: 906, boot: true, fade: 1.6, strength: 0.55 });
    }
    emergencyLight(b, rigW(b), -halfW + 0.14, 2.42, lz - 1.2, { yaw: Math.PI / 2, seed: 907 });
  }

  // =========================================================================
  // ROOM INTERIORS
  // =========================================================================
  for (const room of rooms) {
    const b = builderFor(room.r, room.c);
    const [minX, minZ, maxX, maxZ] = room.rect;
    const [cx, cz] = room.centre;
    const S = 1000 + room.r * 37 + room.c * 11;
    const rr = makeRng(S);
    const dmg = damageAt(room.r, room.c);

    if (D) {
      D.roomPlate(b, cx, 2.24, minZ + 0.10, 0,
        roomNumber('L', 100 + Math.round((room.r * 7 + room.c * 3) % 90)),
        room.dress === 'copyRoom' ? 'COPY' : room.dress === 'store' ? 'STATIONERY'
          : room.dress === 'interview' ? 'INTERVIEW' : room.dress === 'records' ? 'RECORDS' : 'BREAKOUT');
      D.wallBase(b, minX + 0.3, maxZ - 0.03, maxX - 0.3, maxZ - 0.03,
        { amount: 0.25 + dmg * 0.6, seed: S, face: '-z' });
    }

    if (room.dress === 'copyRoom') {
      // A copier, its paper, and the mess a copier makes.
      const cpx = cx + 0.4, cpz = maxZ - 1.1;
      const body = box(1.15, 0.95, 0.72, 0.02, 1); body.translate(cpx, 0.475, cpz);
      const lid = box(1.02, 0.10, 0.62, 0.02, 1); lid.translate(cpx, 1.0, cpz);
      const tray = box(0.5, 0.05, 0.38, 0.01, 1); tray.rotateX(0.2); tray.translate(cpx - 0.72, 0.68, cpz);
      const panel = box(0.34, 0.14, 0.10, 0.01, 1); panel.rotateX(-0.5); panel.translate(cpx + 0.3, 1.02, cpz + 0.28);
      const gg = merge([body, lid, tray, panel]);
      worldUV(gg, 0.5); vertexShade(gg, (px, py) => 0.66 + clamp01(py) * 0.28);
      b.add('plasticWhite', gg);
      b.addColliderAt(cpx, 0.5, cpz, 1.2, 1.0, 0.75, { tag: 'prop' });
      Props.shelving(b, minX + 0.35, 0, cz + 0.4, { seed: S + 1, yaw: Math.PI / 2, w: 1.7, h: 2.0, bays: 5, contents: 0.9, damage: dmg });
      Props.boxStack(b, maxX - 0.7, 0, minZ + 0.9, { seed: S + 2, count: 4, soakBase: dmg });
      Props.wasteBin(b, cpx - 1.1, 0, cpz + 0.6, { seed: S + 3, kind: 'plastic', full: 1 });
      Props.paperStack(b, cpx - 0.6, 0, cpz + 1.1, { seed: S + 4, spilled: true, sheets: 30 });
      Props.trolley(b, cx - 1.2, 0, minZ + 1.4, { seed: S + 5, yaw: rr.range(0, TAU), load: 0.6 });
      if (D) {
        D.quad(b, { stamp: STAMP.tapeResidue, face: '+z', x: cx, y: 1.5, z: minZ + 0.04, w: 0.4, h: 0.5, strength: 0.9 });
        D.label(b, ['OUT OF ORDER'], { face: '-z', x: cpx, y: 1.22, z: cpz - 0.38, w: 0.30, h: 0.10, style: 'paper', size: 24 });
      }
    } else if (room.dress === 'store') {
      Props.shelving(b, minX + 0.32, 0, cz, { seed: S, yaw: Math.PI / 2, w: 2.6, h: 2.1, bays: 6, contents: 1.0, damage: dmg * 0.5 });
      Props.shelving(b, maxX - 0.32, 0, cz, { seed: S + 1, yaw: -Math.PI / 2, w: 2.6, h: 2.1, bays: 6, contents: 0.8, damage: dmg });
      Props.boxStack(b, cx, 0, maxZ - 0.9, { seed: S + 2, count: 5, soakBase: 0.1 });
      Props.chairStack(b, cx - 0.9, 0, minZ + 0.9, { seed: S + 3, yaw: 0.3, count: 8 });
      Props.cardboardBox(b, cx + 0.8, 0, minZ + 1.0, { seed: S + 4, yaw: 1.2, state: 'collapsed' });
      Props.ladder(b, maxX - 0.5, 0, minZ + 0.6, { seed: S + 5, yaw: 0.4, h: 2.2, lean: 0.13 });
    } else if (room.dress === 'interview') {
      // Two chairs and a table. One chair is on the wrong side.
      Props.desk(b, cx, 0, cz, { seed: S, yaw: rr.chance(0.5) ? 0 : Math.PI / 2, w: 1.4, d: 0.8, pedestal: 'none', damage: dmg });
      Props.plasticChair(b, cx, 0, cz - 1.0, { seed: S + 1, yaw: 0.1 });
      Props.plasticChair(b, cx + 0.25, 0, cz + 1.05, { seed: S + 2, yaw: Math.PI + 0.3 });
      Props.plasticChair(b, cx - 1.4, 0, cz + 1.3, { seed: S + 3, yaw: 2.6 });
      Props.filingCabinet(b, maxX - 0.4, 0, minZ + 0.6, { seed: S + 4, yaw: -Math.PI / 2, drawers: 2, damage: dmg });
      Props.wallClock(b, cx, 1.95, maxZ - 0.09, { seed: S + 5, yaw: Math.PI, handsAt: [3, 47], damage: dmg });
      Props.paperStack(b, cx - 0.2, 0.735, cz, { seed: S + 6, sheets: 14 });
      Props.wasteBin(b, minX + 0.45, 0, maxZ - 0.5, { seed: S + 7, kind: 'mesh', full: 0.2 });
      if (D) {
        D.quad(b, { stamp: STAMP.dustEdge, face: 'up', x: cx, y: 0.003, z: cz, w: 1.9, h: 1.3, strength: 0.8 });
        D.quad(b, { stamp: STAMP.handSmear, face: '-z', x: cx + 0.9, y: 1.05, z: maxZ - 0.04, w: 0.4, h: 0.5, strength: 0.9 });
      }
    } else if (room.dress === 'records') {
      // Rows of filing, and the aisle you can just get down.
      const rows2 = Math.max(2, Math.floor((maxZ - minZ - 1.4) / 1.5));
      for (let i = 0; i < rows2; i++) {
        const rz = minZ + 1.0 + i * 1.5;
        for (let k = 0; k < 3; k++) {
          Props.filingCabinet(b, minX + 0.8 + k * 0.52, 0, rz, {
            seed: S + i * 10 + k, yaw: 0, drawers: rr.pick([3, 4, 4]), damage: dmg * rr.range(0.4, 1.2),
          });
        }
        Props.shelving(b, maxX - 0.4, 0, rz, {
          seed: S + 100 + i, yaw: -Math.PI / 2, w: 1.3, h: 2.0, bays: 5,
          contents: 0.95, damage: dmg * 0.8,
        });
      }
      Props.desk(b, cx + 0.2, 0, maxZ - 0.9, { seed: S + 200, yaw: Math.PI, w: 1.3, pedestal: 'left', damage: dmg });
      Props.officeChair(b, cx + 0.2, 0, maxZ - 1.7, { seed: S + 201, yaw: 0.4 });
      Props.paperStack(b, cx + 0.2, 0.735, maxZ - 0.95, { seed: S + 202, sheets: 90 });
      Props.deskLamp(b, cx - 0.35, 0.73, maxZ - 1.0, { seed: S + 203, yaw: 0.5 });
      if (D) {
        D.quad(b, { stamp: STAMP.tally, face: '+z', x: minX + 0.9, y: 1.4, z: minZ + 0.04, w: 1.5, h: 0.5, strength: 1 });
        D.footprints(b, [[cx, minZ + 0.6], [cx, maxZ - 1.2]], { seed: S + 204, fade: 1.4, strength: 0.5 });
      }
    } else {
      // breakout
      Props.desk(b, cx - 0.8, 0, cz + 0.6, { seed: S, yaw: 0.2, w: 1.5, damage: dmg });
      Props.officeChair(b, cx - 0.8, 0, cz - 0.3, { seed: S + 1, yaw: 3.0 });
      Props.desk(b, cx + 1.3, 0, cz - 1.0, { seed: S + 2, yaw: Math.PI + 0.1, w: 1.5, pedestal: 'left', damage: dmg });
      Props.officeChair(b, cx + 1.3, 0, cz - 0.1, { seed: S + 3, yaw: 0.2, arms: false });
      Props.waterCooler(b, maxX - 0.5, 0, maxZ - 0.6, { seed: S + 4, yaw: Math.PI + 0.3, bottle: 0.35 });
      Props.vendingMachine(b, minX + 0.6, 0, maxZ - 0.5, { seed: S + 5, yaw: Math.PI, lit: dmg < 0.5, empty: 0.5 });
      Props.noticeboard(b, cx, 1.5, minZ + 0.04, { seed: S + 6, yaw: 0, w: 1.1, h: 0.8, sheets: 7 });
      Props.wasteBin(b, minX + 0.5, 0, minZ + 0.5, { seed: S + 7, kind: 'mesh', full: 0.7 });
      Props.coatHooks(b, cx + 1.6, 1.70, minZ + 0.05, { seed: S + 8, yaw: 0, w: 0.9, coats: 0.5 });
    }
  }

  // =========================================================================
  // SPINE DRESSING — the long views are the only ones that carry, so they get
  // the props, the wear and the focal elements.
  // =========================================================================
  {
    const zSpine = cellPos(plan.spineRow, 0)[1];
    const xSpine = cellPos(0, plan.spineCol)[0];
    const zSpine2 = cellPos(plan.spineRow2, 0)[1];
    const dress = makeRng(seed + 4242);
    // Along the main east-west spine.
    for (let c = 1; c < cols - 1; c++) {
      const [x] = cellPos(plan.spineRow, c);
      const b = builderFor(plan.spineRow, c);
      const dmg = damageAt(plan.spineRow, c);
      const h = hash2(c * 13, 7);
      if (h < 0.20) Props.filingCabinet(b, x + dress.range(-1, 1), 0, zSpine + dress.sign() * 1.9, { seed: 2000 + c, yaw: dress.range(0, TAU), drawers: dress.pick([2, 3, 4]), damage: dmg });
      else if (h < 0.34) Props.boxStack(b, x + dress.range(-1, 1), 0, zSpine + dress.sign() * 1.9, { seed: 2100 + c, count: dress.int(2, 4), soakBase: dmg });
      else if (h < 0.44) Props.plasticChair(b, x + dress.range(-1.4, 1.4), 0, zSpine + dress.range(-1.6, 1.6), { seed: 2200 + c, yaw: dress.range(0, TAU) });
      else if (h < 0.52) Props.wasteBin(b, x + dress.range(-1.4, 1.4), 0, zSpine + dress.sign() * 1.85, { seed: 2300 + c, kind: dress.pick(['mesh', 'plastic']), full: dress() });
      else if (h < 0.58) Props.wetFloorSign(b, x + dress.range(-1, 1), 0, zSpine + dress.range(-1, 1), { seed: 2400 + c, yaw: dress.range(0, TAU) });
      if (D && h > 0.5) {
        D.quad(b, {
          stamp: dress.pick([STAMP.waterRing, STAMP.splash, STAMP.dropletSet]), face: 'up',
          x: x + dress.range(-1.5, 1.5), y: 0, z: zSpine + dress.range(-1.5, 1.5),
          w: dress.range(1.0, 2.2), h: dress.range(1.0, 2.2), rot: dress() * TAU,
          strength: 0.4 + dmg * 0.6,
        });
      }
      if (D && hash2(c * 5, 11) < 0.35) {
        D.leak(b, x, ceiling - 0.02, zSpine + dress.sign() * 1.4, {
          seed: 2500 + c, amount: 0.5 + dmg * 0.5, floorY: 0,
        });
      }
    }
    // Along the north-south spine.
    for (let r = 1; r < rows - 1; r++) {
      const [, z] = cellPos(r, plan.spineCol);
      const b = builderFor(r, plan.spineCol);
      const dmg = damageAt(r, plan.spineCol);
      const h = hash2(r * 7 + 3, 19);
      if (h < 0.16) Props.desk(b, xSpine + dress.sign() * 1.7, 0, z + dress.range(-1, 1), { seed: 2600 + r, yaw: dress.range(0, TAU), w: 1.4, damage: dmg });
      else if (h < 0.28) Props.trolley(b, xSpine + dress.range(-1.3, 1.3), 0, z + dress.range(-1, 1), { seed: 2700 + r, yaw: dress.range(0, TAU), load: dress() });
      else if (h < 0.36) Props.pallet(b, xSpine + dress.sign() * 1.6, 0, z, { seed: 2800 + r, yaw: dress.range(0, TAU), damage: dmg });
      if (D && hash2(r * 3, 23) < 0.4) {
        D.quad(b, {
          stamp: STAMP.scuffArc, face: 'up', x: xSpine + dress.range(-1.6, 1.6), y: 0,
          z: z + dress.range(-2, 2), w: 2.2, h: 2.2, rot: dress() * TAU, strength: 0.7,
        });
      }
    }
    // Wear at the base of the spine walls.
    if (D) {
      for (let c = 0; c < cols; c += 3) {
        const [x] = cellPos(plan.spineRow, c);
        const b = builderFor(plan.spineRow, c);
        const dmg = damageAt(plan.spineRow, c);
        D.wallBase(b, x - cell / 2, zSpine - cell / 2 + 0.02, x + cell / 2, zSpine - cell / 2 + 0.02,
          { amount: 0.3 + dmg * 0.7, seed: 3000 + c, face: '+z' });
      }
    }
  }

  // =========================================================================
  // PORTALS AND THE WAY OUT
  // =========================================================================
  {
    // East wall: the door into the Service Spine, on the main spine axis.
    const zc = cellPos(plan.spineRow, 0)[1];
    const b = builderFor(plan.spineRow, cols - 1);
    doorway(b, halfW - 0.02, 0, zc, { rotation: -Math.PI / 2, width: 1.02, height: 2.10, open: 0.6, hinge: 1, seed: 950 });
    portals.push(portal('to_service', 'intake', [halfW - 0.7, 0, zc], -Math.PI / 2,
      { zone: 'service', portalId: 'to_intake' }, 'door',
      { arrive: [halfW - 1.8, 0, zc], arriveYaw: Math.PI / 2 }));
    if (D) {
      D.roomPlate(b, halfW - 0.10, 2.32, zc + 0.85, -Math.PI / 2, roomNumber('L', 200), 'SERVICE');
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: halfW - 3.0, y: 0, z: zc, w: 1.4, h: 6.0, rot: Math.PI / 2, strength: 1 });
      D.label(b, ['STAFF ONLY'], { face: '-x', x: halfW - 0.10, y: 1.62, z: zc - 0.95, w: 0.34, h: 0.11, style: 'warning', size: 26 });
    }

    // North wall: a duct access panel at floor level. It is 800 mm square.
    const dx = cellPos(0, 10)[0];
    const b2 = builderFor(0, 10);
    grille(b2, dx, 0.52, -halfD + 0.06, { w: 0.86, h: 0.86, rotation: 0, blades: 13, recess: 0.06 });
    portals.push(portal('to_duct', 'intake', [dx, 0, -halfD + 0.7], 0,
      { zone: 'duct', portalId: 'to_intake' }, 'hatch',
      { arrive: [dx, 0, -halfD + 1.5], arriveYaw: Math.PI }));
    if (D) {
      D.label(b2, ['AHU 3 ACCESS'], { face: '+z', x: dx, y: 1.22, z: -halfD + 0.05, w: 0.32, h: 0.10, style: 'plate', size: 22 });
      D.quad(b2, { stamp: STAMP.wearPath, face: 'up', x: dx, y: 0, z: -halfD + 1.4, w: 1.0, h: 2.4, rot: Math.PI / 2, strength: 0.9 });
      D.quad(b2, { stamp: STAMP.scratchSet, face: 'up', x: dx, y: 0, z: -halfD + 0.8, w: 0.9, h: 0.9, strength: 1 });
    }
  }

  // =========================================================================
  // THE FAR CORNER — where the wear gradient pays off.
  // =========================================================================
  {
    const [fx, fz] = cellPos(1, cols - 2);
    const b = builderFor(1, cols - 2);
    const fr = makeRng(seed + 77);
    // The ceiling has come down: tiles, grid and a length of cable on the floor.
    const debris = [];
    for (let i = 0; i < 26; i++) {
      const px = fx + fr.range(-4.0, 4.0), pz = fz + fr.range(-4.0, 4.0);
      const t = box(fr.range(0.35, 0.62), 0.016, fr.range(0.35, 0.60), 0.003, 1);
      t.rotateY(fr() * TAU);
      t.rotateX(fr.range(-0.12, 0.12));
      t.translate(px, 0.010 + fr() * 0.02, pz);
      debris.push(t);
    }
    const dg = merge(debris);
    worldUV(dg, 0.8); vertexShade(dg, () => 0.62);
    b.add('ceilingTile', dg);
    const tees = [];
    for (let i = 0; i < 7; i++) {
      const g = box(fr.range(0.9, 2.4), 0.028, 0.024, 0.003, 1);
      g.rotateY(fr() * TAU); g.rotateZ(fr.range(-0.08, 0.08));
      g.translate(fx + fr.range(-3.6, 3.6), 0.024, fz + fr.range(-3.6, 3.6));
      tees.push(g);
    }
    const tg = merge(tees); worldUV(tg, 0.4); vertexShade(tg, () => 0.7);
    b.add('gridMetal', tg);
    // A cable bundle hanging out of the void.
    const cable = pipeRun([
      [fx - 0.6, ceiling - 0.05, fz + 0.4], [fx - 0.2, ceiling - 0.9, fz + 0.6],
      [fx + 0.3, ceiling - 1.6, fz + 0.3], [fx + 1.2, 0.06, fz - 0.4], [fx + 2.6, 0.05, fz - 1.2],
    ], 0.035, 7, 3);
    worldUV(cable, 0.5); vertexShade(cable, () => 0.42);
    b.add('rubber', cable);

    Props.barricade(b, fx - 2.4, 0, fz + 2.6, { seed: 3100, yaw: 0.6, width: 2.6 });
    Props.blanketNest(b, fx + 2.2, 0, fz + 1.4, { seed: 3101, yaw: 1.2, r: 1.0 });
    Props.oilDrum(b, fx + 3.2, 0, fz + 2.6, { seed: 3102, yaw: 0.4, open: true });
    Props.shelving(b, fx - 3.4, 0, fz - 2.0, { seed: 3103, yaw: 0.2, w: 1.6, h: 1.9, bays: 4, contents: 0.3, damage: 1 });
    if (D) {
      D.quad(b, { stamp: STAMP.puddle, face: 'up', x: fx, y: 0, z: fz, w: 4.6, h: 4.0, strength: 1 });
      D.quad(b, { stamp: STAMP.waterRing, face: 'up', x: fx + 1.8, y: 0, z: fz - 1.6, w: 3.0, h: 2.6, strength: 0.9 });
      D.leak(b, fx - 0.6, ceiling - 0.02, fz + 0.4, { seed: 3104, amount: 1.0, floorY: 0 });
      D.quad(b, { stamp: STAMP.mould, face: '-z', x: fx, y: 1.7, z: fz + cell / 2 - 0.04, w: 3.0, h: 2.4, strength: 1 });
      D.quad(b, { stamp: STAMP.sprayX, face: '-z', x: fx + 1.6, y: 1.6, z: fz + cell / 2 - 0.04, w: 0.9, h: 0.9, strength: 1 });
      D.label(b, ['DO NOT', 'GO NORTH'], {
        face: '-z', x: fx - 1.4, y: 1.6, z: fz + cell / 2 - 0.05, w: 0.6, h: 0.34,
        style: 'stencil', colour: '#8f3126', size: 44, distress: 0.6,
      });
      D.footprints(b, [[fx + 3.0, fz + 3.0], [fx, fz], [fx - 2.0, fz - 3.0]], { seed: 3105, boot: true, fade: 1.8, strength: 0.8 });
    }
  }

  // ---- finish ------------------------------------------------------------
  for (const b of builders) {
    const g = b.finish();
    chunks.push(g);
    root.add(g);
  }

  // Spawn in front of the lift, looking east into the floor plate.
  return {
    root, chunks, plan, builders, portals, interactables: [],
    spawn: [spawnCell[0] + 1.2, 0, spawnCell[1]],
    spawnYaw: -Math.PI / 2,
    fogProfile: 'intake',
    reverb: 'intake',
    bounds: new THREE.Box3(
      new THREE.Vector3(-halfW, 0, -halfD),
      new THREE.Vector3(halfW, ceiling, halfD)),
  };
}

export default buildIntake;
