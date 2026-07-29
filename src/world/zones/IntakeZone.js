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
  chunkCells: 5,
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
      const dmg = damageAt(r, c);
      // Failure rate follows the wear gradient: near the entrance almost
      // everything works, and the far corner is where the ceiling came down.
      let health = 'good';
      const hh = hash2(r * 11 + 3, c * 7 + 5);
      if (hh < 0.015 + dmg * 0.42) health = 'dead';
      else if (hh < 0.06 + dmg * 0.55) health = 'dying';
      else if (hh < 0.22 + dmg * 0.55) health = 'buzz';
      fixturePlan.push({
        r, c, x, z, health,
        rotation: isSpine && r === plan.spineRow ? Math.PI / 2 : 0,
      });
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
  wallRun(per, -halfW, -halfD, halfW, -halfD, { height: ceiling, key: 'wallpaper', seed: 11 });
  wallRun(per, halfW, -halfD, halfW, halfD, { height: ceiling, key: 'wallpaper', seed: 12 });
  wallRun(per, halfW, halfD, -halfW, halfD, { height: ceiling, key: 'wallpaper', seed: 13 });
  wallRun(per, -halfW, halfD, -halfW, -halfD, { height: ceiling, key: 'wallpaper', seed: 14 });

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
          height: ceiling, key: 'wallpaper', seed: r * 31 + c,
          capEnds: grid[r][c - 1] !== WALL || grid[r][c + 1] !== WALL,
        });
      } else {
        wallRun(b, x, z - cell / 2, x, z + cell / 2, {
          height: ceiling, key: 'wallpaper', seed: r * 31 + c + 7,
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
      cone: true,
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

  // ---- finish ------------------------------------------------------------
  for (const b of builders) {
    const g = b.finish();
    chunks.push(g);
    root.add(g);
  }

  // Spawn on the south-west spine looking north.
  const spawnCell = cellPos(rows - 2, 1);
  return {
    root, chunks, plan,
    spawn: [spawnCell[0], 0, spawnCell[1]],
    spawnYaw: 0,
    bounds: new THREE.Box3(
      new THREE.Vector3(-halfW, 0, -halfD),
      new THREE.Vector3(halfW, ceiling, halfD)),
  };
}

export default buildIntake;
