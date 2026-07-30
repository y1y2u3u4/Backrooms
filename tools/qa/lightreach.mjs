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
  };
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
