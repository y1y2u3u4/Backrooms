/**
 * Light-reach audit — how far a player can get from the nearest working fixture.
 *
 * WHY THIS EXISTS
 *
 * "Is this zone too dark?" was being answered from screenshots, and screenshots
 * turned out to answer a different question. Three separate wrong diagnoses came
 * out of them: that the rooms were lit by bounce fill rather than by their
 * fixtures, that the dark zones needed more fill, and that the Cistern was too
 * dark when it was actually a 14-frame exposure settle. Meanwhile the real defect
 * — an Intake corridor with no fixture within six metres of it — was invisible in
 * every metric the project had.
 *
 * This measures the thing that actually matters, in metres, with no browser, no
 * GPU and no exposure pipeline in the way: for every walkable point in a zone,
 * the distance to the nearest fixture that is not dead. A building where some
 * point of the circulation route is 7 m from the nearest lamp has a lighting
 * design problem, and that is true regardless of how any frame was exposed.
 *
 *   node tools/qa/lightreach.mjs            # every zone
 *   node tools/qa/lightreach.mjs intake     # one zone
 *   node tools/qa/lightreach.mjs intake --map   # ...and draw it in plan
 */
import * as THREE from 'three';

/** `--blackout`: pretend every switchable way at the board is tripped. */
const EMERGENCY_ONLY = process.argv.includes('--blackout');
/**
 * `--budget N`: compare the two ways of choosing which N fixtures the rig keeps.
 *
 * `LightRig` can only drive a handful of real lights at once (6 / 10 / 14 by
 * tier). It used to keep the N NEAREST, which sounds obviously right and is not:
 * irradiance falls as 1/d^2 but rated output spans 9 to 340 candela across
 * FIXTURE_TYPES, a factor of thirty-eight, so the output term is much the
 * stronger of the two. A 9 cd emergency bulkhead 2 m away outranked a 340 cd high
 * bay 5 m away and the Plant lost its key light to a green safety lamp.
 *
 * This measures both rankings at every walkable sample point: total estimated
 * irradiance delivered by the chosen N. Ranking by importance can never do worse
 * than ranking by distance at the same N — it is choosing the top N of the very
 * quantity being summed — so what this reports is HOW MUCH was being left on the
 * table, per zone.
 */
const BUDGET = (() => {
  const i = process.argv.indexOf('--budget');
  return i >= 0 ? parseInt(process.argv[i + 1] || '10', 10) : 0;
})();
/**
 * `--map`: draw the zone in plan, one character per metre, shaded by distance
 * to the nearest live fixture.
 *
 * A percentage cannot be acted on. "9 % of the Cistern is beyond 5 m" was true
 * for four iterations and told nobody WHERE, so the response each time was to
 * raise output on the lamps that already existed — which moves the mean and
 * leaves the hole exactly where it was, because the hole is a place with no
 * fitting over it rather than a place with a weak one. The single worst point
 * the summary prints is not enough either: it is one sample, and a lamp dropped
 * on it just relocates the worst point three metres away.
 *
 * This prints the shape of the dark, which is the thing a lighting plan is
 * drawn against.
 */
const MAP = process.argv.includes('--map');
import { CollisionWorld } from '../../src/player/Physics.js';
import { FIXTURE_TYPES } from '../../src/render/Lighting.js';

// ---- stubs ---------------------------------------------------------------
// Zone builders want a full engine context. They only ever ask the material
// library for an object to hang on a mesh, so a shared dummy is enough, and the
// light rig only has to record what was added.

const dummyMaterial = () => {
  const m = new THREE.MeshBasicMaterial();
  m.userData = {};
  return m;
};
const sharedMat = dummyMaterial();

const materials = {
  get: () => sharedMat,
  decorate: (m) => m,
  emissive: () => sharedMat,
  all: new Set(),
  cache: new Map(),
};

/** Palette entries are called as factories; every one returns the dummy. */
const palette = new Proxy({}, { get: () => () => sharedMat });

/**
 * A stub that tolerates any call shape.
 *
 * Zone builders talk to Decals, Props and Assets through wide, informally-typed
 * surfaces (`decals.label`, `decals.roomPlate`, `decals.hazardRun`, ...) and
 * enumerating them here would mean this audit broke every time a zone author
 * added a helper. Anything read off this returns a callable that accepts
 * anything, returns another one, and is also indexable — which is enough for a
 * builder that only wants to hang decoration on a mesh.
 */
const permissive = () => new Proxy(function stub() {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive || k === 'valueOf') return () => 0;
    if (k === Symbol.iterator) return function* () {};
    if (k === 'then') return undefined;             // never look like a Promise
    if (k === 'length') return 0;
    return permissive();
  },
  apply: () => permissive(),
  construct: () => permissive(),
});

function makeRig() {
  const fixtures = [];
  return {
    fixtures,
    shadowMapSize: 512,
    add(spec) {
      const f = {
        ...spec,
        type: spec.type || 'troffer',
        health: spec.health || 'good',
        // The real Fixture carries its FIXTURE_TYPES entry as `def`, and other
        // systems read it — the water surface takes a lamp's colour from it to
        // build reflections.
        def: FIXTURE_TYPES[spec.type] || FIXTURE_TYPES.troffer,
        group: { position: new THREE.Vector3(...(spec.position || [0, 0, 0])), rotation: { y: 0 }, add() {} },
        light: {
          visible: true, color: new THREE.Color(1, 1, 1),
          shadow: { mapSize: { set() {} }, camera: {} },
          position: new THREE.Vector3(), target: null, castShadow: false,
        },
        // Real fixtures own a target Object3D that aims the spot; the wall-mount
        // helpers re-aim it after construction, so the stub needs a real one.
        target: new THREE.Object3D(),
        level: 1,
        tube: null,
        coneMesh: null,
        setHealth(h) { this.health = h; },
      };
      fixtures.push(f);
      return f;
    },
    setCircuit() {}, circuitLevel: () => 1, requestShadowRefresh() {},
  };
}

const ZONES = {
  intake: ['../../src/world/zones/IntakeZone.js', ['buildIntake']],
  service: ['../../src/world/zones/ServiceZone.js', null],
  cistern: ['../../src/world/zones/CisternZone.js', null],
  residence: ['../../src/world/zones/ResidenceZone.js', null],
  plant: ['../../src/world/zones/PlantZone.js', null],
  duct: ['../../src/world/zones/DuctZone.js', null],
  stack: ['../../src/world/zones/StackZone.js', null],
  safe: ['../../src/world/zones/SafeRoom.js', null],
};

/** Sample walkable points off the zone's registered floor rectangles. */
function walkablePoints(collision, step = 1.5) {
  const pts = [];
  for (const f of collision.floors) {
    if (f.enabled === false) continue;
    const w = f.maxX - f.minX, d = f.maxZ - f.minZ;
    if (w < 0.6 || d < 0.6) continue;           // too small to stand in
    const nx = Math.max(1, Math.round(w / step));
    const nz = Math.max(1, Math.round(d / step));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        pts.push([
          f.minX + (i + 0.5) * (w / nx),
          f.y,
          f.minZ + (j + 0.5) * (d / nz),
        ]);
      }
    }
  }
  return pts;
}

async function audit(id) {
  const [path] = ZONES[id];
  let mod;
  try { mod = await import(path); } catch (e) {
    return { id, error: `import failed: ${e.message}` };
  }
  const fn = Object.values(mod).find((v) => typeof v === 'function' && /^build/.test(v.name))
    || mod.default;
  if (typeof fn !== 'function') return { id, error: 'no builder export' };

  const collision = new CollisionWorld();
  const rig = makeRig();
  const scene = new THREE.Group();
  const ctx = {
    materials, collision, rig, palette, scene,
    bus: { on() {}, emit() {} },
    assets: permissive(),
    engine: { q: { textureQuality: 1, lights: 14 }, envMap: null },
    zoneId: id,
    decals: permissive(),
  };

  let zone;
  try { zone = fn(ctx, { seed: 20240607, origin: [0, 0, 0] }); } catch (e) {
    if (process.env.LR_TRACE) {
      console.log(`\n[${id}] ${e.message}`);
      console.log((e.stack || '').split('\n').slice(1, 9).join('\n'));
    }
    return { id, error: `build threw: ${e.message}` };
  }

  // Only fixtures that emit light count. A dead tube is a prop.
  // BLACKOUT MODE. Distribution Board C carries eight ways and lets four be live
  // at once, so a player CHOOSES which parts of the building go dark — and the
  // parts that go dark are supposed to still be navigable on the always-powered
  // 'emergency' circuit plus a flashlight. Measuring only the fully-lit case says
  // nothing about that, and the Stack turned out to have no emergency lighting at
  // all: tripping its way from inside it left the player in total darkness on a
  // deck ring above a 47 m shaft.
  const live = rig.fixtures.filter((f) => f.health !== 'dead'
    && (!EMERGENCY_ONLY || f.circuit === 'emergency'));
  const pts = walkablePoints(collision);
  if (!pts.length) return { id, error: 'no floor rects registered' };
  if (!live.length) return { id, fixtures: 0, live: 0, points: pts.length, error: 'no live fixtures' };

  // ---- budget-ranking comparison ----------------------------------------
  if (BUDGET > 0) {
    const irr = (f, p) => {
      const q = f.group.position;
      const d2 = (q.x - p[0]) ** 2 + (q.y - (p[1] + 1.6)) ** 2 + (q.z - p[2]) ** 2;
      return ((f.def?.intensity ?? 20) * (f.intensityScale ?? 1)) / (1 + d2);
    };
    let byDist = 0, byImp = 0, worseAt = null, worstRatio = 1;
    for (const p of pts) {
      const scored = live.map((f) => ({
        f,
        d: Math.hypot(f.group.position.x - p[0], f.group.position.y - (p[1] + 1.6), f.group.position.z - p[2]),
        i: irr(f, p),
      }));
      const nearest = [...scored].sort((a, b) => a.d - b.d).slice(0, BUDGET);
      const best = [...scored].sort((a, b) => b.i - a.i).slice(0, BUDGET);
      const sN = nearest.reduce((a, x) => a + x.i, 0);
      const sB = best.reduce((a, x) => a + x.i, 0);
      byDist += sN; byImp += sB;
      const ratio = sN > 0 ? sB / sN : 1;
      if (ratio > worstRatio) { worstRatio = ratio; worseAt = p.map((v) => +v.toFixed(1)); }
    }
    return {
      id, fixtures: rig.fixtures.length, live: live.length, points: pts.length,
      budget: {
        byDist: byDist / pts.length, byImp: byImp / pts.length,
        gain: byDist > 0 ? byImp / byDist : 1,
        worstRatio, worseAt,
      },
    };
  }

  let worst = 0, worstAt = null, sum = 0;
  const over5 = [];
  const samples = [];
  for (const p of pts) {
    let best = Infinity;
    for (const f of live) {
      const q = f.group.position;
      // Horizontal distance: a fixture is on the ceiling and the metric people
      // care about is "how far do I walk to get under a light".
      const d = Math.hypot(q.x - p[0], q.z - p[2]);
      if (d < best) best = d;
    }
    sum += best;
    if (best > worst) { worst = best; worstAt = p; }
    if (best > 5) over5.push(best);
    if (MAP) samples.push([p[0], p[2], best]);
  }

  return {
    id,
    fixtures: rig.fixtures.length,
    live: live.length,
    points: pts.length,
    worst: +worst.toFixed(2),
    worstAt: worstAt ? worstAt.map((v) => +v.toFixed(1)) : null,
    mean: +(sum / pts.length).toFixed(2),
    fracOver5m: +(over5.length / pts.length).toFixed(3),
    map: MAP ? {
      samples,
      lamps: live.map((f) => [f.group.position.x, f.group.position.z]),
      // Dead fittings are drawn separately. "There is no lamp here" and "there is
      // a lamp here and it is dead" call for opposite fixes — one is a hole in
      // the lighting plan, the other is a wear roll that landed badly — and a
      // map that shows only live lamps cannot tell them apart.
      dead: rig.fixtures.filter((f) => !live.includes(f))
        .map((f) => [f.group.position.x, f.group.position.z]),
    } : null,
  };
}

/**
 * Plan view, one cell per metre. A cell takes the WORST distance of the walkable
 * samples that land in it, because a plan drawn from the best sample in each cell
 * is a plan that hides the gap it is being drawn to find.
 */
function drawMap(r) {
  const { samples, lamps, dead } = r.map;
  if (!samples.length) return;
  const CELL = 1.0;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of samples) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cols = Math.floor((x1 - x0) / CELL) + 1;
  const rows = Math.floor((z1 - z0) / CELL) + 1;
  const cx = (x) => Math.min(cols - 1, Math.max(0, Math.floor((x - x0) / CELL)));
  const cz = (z) => Math.min(rows - 1, Math.max(0, Math.floor((z - z0) / CELL)));
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (const [x, z, d] of samples) {
    const j = cz(z), i = cx(x);
    if (grid[j][i] === null || d > grid[j][i]) grid[j][i] = d;
  }
  // Lamps are drawn only where they sit over floor the player can reach; a
  // fitting on the far side of a wall is not lighting this room.
  const inBox = (x, z) => !(x < x0 - CELL || x > x1 + CELL || z < z0 - CELL || z > z1 + CELL);
  const lampCells = new Set();
  for (const [x, z] of lamps) if (inBox(x, z)) lampCells.add(`${cz(z)},${cx(x)}`);
  const deadCells = new Set();
  for (const [x, z] of dead) if (inBox(x, z)) deadCells.add(`${cz(z)},${cx(x)}`);
  const glyph = (d) => (d === null ? ' ' : d < 2 ? '.' : d < 3 ? ':' : d < 4 ? '-' : d < 5 ? '+' : d < 6 ? '#' : '@');

  console.log('');
  console.log(`  ${r.id} — plan, 1 m per character, north (−z) at the top`);
  console.log(`  x ${x0.toFixed(1)} .. ${x1.toFixed(1)}   z ${z0.toFixed(1)} .. ${z1.toFixed(1)}`);
  console.log('  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one');
  console.log('  Levels are flattened into one plan and each cell shows its WORST sample,');
  console.log('  so a dark lower deck is not hidden by a lit walkway above it.');
  console.log('');
  for (let j = 0; j < rows; j++) {
    let line = '';
    for (let i = 0; i < cols; i++) {
      const k = `${j},${i}`;
      line += lampCells.has(k) ? '*' : deadCells.has(k) ? 'x' : glyph(grid[j][i]);
    }
    console.log(`  z=${(z0 + j * CELL).toFixed(0).padStart(5)} |${line}|`);
  }
  console.log(`         ${' '.repeat(1)} x=${x0.toFixed(0)} → x=${x1.toFixed(0)}`);
}

// `--budget N` consumes the token after it, so a positional zone name has to be
// found by skipping flag values rather than by "the first thing without dashes".
const only = (() => {
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--budget') { i++; continue; }
    if (a[i].startsWith('--')) continue;
    return a[i];
  }
  return undefined;
})();
const ids = only ? [only] : Object.keys(ZONES);
const rows = [];
for (const id of ids) rows.push(await audit(id));

console.log('');
if (BUDGET > 0) {
  console.log(`light budget — irradiance delivered by the ${BUDGET} fixtures the rig keeps,`);
  console.log('ranked the two possible ways. Importance can never lose; this is the margin.');
  console.log('');
  console.log('zone        live   pts   nearest-N   best-N    gain   worst point');
} else {
  console.log(EMERGENCY_ONLY
    ? 'light reach, BLACKOUT — every switchable way tripped; emergency circuit only'
    : 'light reach — horizontal distance from a walkable point to the nearest live fixture');
  console.log('');
  console.log('zone        fixt  live   pts   mean  worst   >5m   worst position');
}
for (const r of rows) {
  if (r.error && r.worst === undefined && !r.budget) {
    console.log(`${r.id.padEnd(11)} ${String(r.error)}`);
    continue;
  }
  if (r.budget) {
    const b = r.budget;
    console.log(
      `${r.id.padEnd(11)} ${String(r.live).padStart(4)} ${String(r.points).padStart(5)}`
      + `   ${b.byDist.toFixed(2).padStart(9)} ${b.byImp.toFixed(2).padStart(8)}`
      + `   ${`${((b.gain - 1) * 100).toFixed(1)}%`.padStart(6)}`
      + `   x${b.worstRatio.toFixed(2)} @ [${(b.worseAt || []).join(',')}]`);
    continue;
  }
  console.log(
    `${r.id.padEnd(11)} ${String(r.fixtures).padStart(4)}  ${String(r.live).padStart(4)}`
    + ` ${String(r.points).padStart(5)}  ${r.mean.toFixed(2).padStart(5)}`
    + `  ${r.worst.toFixed(2).padStart(5)}` + `  ${(r.fracOver5m * 100).toFixed(0).padStart(3)}%`
    + `   [${r.worstAt}]`);
  if (r.map) drawMap(r);
}
console.log('');
if (BUDGET > 0) {
  console.log('A gain near zero means distance and output happened to agree in that zone.');
  console.log('The Plant is where they do not: 340 cd high bays against 20 cd bulkheads.');
  process.exit(0);
} else if (EMERGENCY_ONLY) {
  console.log('In a blackout the bar is different: somewhere to walk TOWARD, not a lit room.');
  console.log('A zone with no emergency fixture at all reports "no live fixtures" and is a trap.');
} else console.log('A corridor lit to a 4 m fixture grid should show a worst case near 3 m.');
console.log('Anything over about 6 m is somewhere the player can stand with no lamp above them.');
