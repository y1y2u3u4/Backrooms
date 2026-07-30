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
  const live = rig.fixtures.filter((f) => f.health !== 'dead');
  const pts = walkablePoints(collision);
  if (!pts.length) return { id, error: 'no floor rects registered' };
  if (!live.length) return { id, fixtures: 0, live: 0, points: pts.length, error: 'no live fixtures' };

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

const only = process.argv[2];
const ids = only ? [only] : Object.keys(ZONES);
const rows = [];
for (const id of ids) rows.push(await audit(id));

console.log('');
console.log('light reach — horizontal distance from a walkable point to the nearest live fixture');
console.log('');
console.log('zone        fixt  live   pts   mean  worst   >5m   worst position');
for (const r of rows) {
  if (r.error && r.worst === undefined) {
    console.log(`${r.id.padEnd(11)} ${String(r.error)}`);
    continue;
  }
  console.log(
    `${r.id.padEnd(11)} ${String(r.fixtures).padStart(4)}  ${String(r.live).padStart(4)}`
    + ` ${String(r.points).padStart(5)}  ${r.mean.toFixed(2).padStart(5)}`
    + `  ${r.worst.toFixed(2).padStart(5)}` + `  ${(r.fracOver5m * 100).toFixed(0).padStart(3)}%`
    + `   [${r.worstAt}]`);
}
console.log('');
console.log('A corridor lit to a 4 m fixture grid should show a worst case near 3 m.');
console.log('Anything over about 6 m is somewhere the player can stand with no lamp above them.');
