/**
 * Floor-coverage audit — every place a player can stand on nothing.
 *
 * WHY THIS EXISTS
 *
 * A continuous playthrough reported the player spending 1 248 consecutive frames
 * with no walkable surface under them. I found the cause with a hand-written
 * probe that walked due east from the Cistern's spawn, fixed what it showed, and
 * re-ran: the failure got WORSE — 2 612 frames, worst run 1 524. The probe had
 * only ever sampled one line, and the remaining gap was not on it.
 *
 * That is the fourth time in this project a too-narrow measurement has read as a
 * green light. A test that does not cover the failing case is not a test, so this
 * replaces the line with a dense grid over every zone, and — the part that
 * matters — it reports the COORDINATES of what it finds, so a fix can be aimed
 * rather than guessed at.
 *
 * The test is exactly the one the playthrough harness applies per frame:
 *   sampleFloor(x, z, y + 1.2, 3.0), fail if nothing found or the drop exceeds
 *   2.5 m. Same predicate, so a pass here means the playthrough assertion cannot
 *   fire at that position.
 *
 *   node tools/qa/floorgaps.mjs            # every zone
 *   node tools/qa/floorgaps.mjs cistern    # one zone, with a coordinate list
 */
import * as THREE from 'three';
import { CollisionWorld } from '../../src/player/Physics.js';
import { FIXTURE_TYPES } from '../../src/render/Lighting.js';

const sharedMat = new THREE.MeshBasicMaterial();
sharedMat.userData = {};
const materials = {
  get: () => sharedMat, decorate: (m) => m, emissive: () => sharedMat,
  all: new Set(), cache: new Map(),
};
const palette = new Proxy({}, { get: () => () => sharedMat });
const permissive = () => new Proxy(function stub() {}, {
  get: (t, k) => (k === Symbol.iterator ? function* () {}
    : k === 'then' ? undefined : permissive()),
  apply: () => permissive(), construct: () => permissive(),
});
function makeRig() {
  const fixtures = [];
  return {
    fixtures, shadowMapSize: 512,
    add(sp) {
      const f = {
        ...sp, type: sp.type || 'troffer', health: sp.health || 'good',
        def: FIXTURE_TYPES[sp.type] || FIXTURE_TYPES.troffer,
        group: { position: new THREE.Vector3(...(sp.position || [0, 0, 0])), rotation: { y: 0 }, add() {} },
        light: {
          visible: true, color: new THREE.Color(1, 1, 1),
          shadow: { mapSize: { set() {} }, camera: {} },
          position: new THREE.Vector3(), target: null, castShadow: false,
        },
        target: new THREE.Object3D(), level: 1, tube: null, coneMesh: null,
        setHealth(h) { this.health = h; },
      };
      fixtures.push(f); return f;
    },
    setCircuit() {}, circuitLevel: () => 1, requestShadowRefresh() {},
  };
}

const ZONES = {
  intake: '../../src/world/zones/IntakeZone.js',
  service: '../../src/world/zones/ServiceZone.js',
  cistern: '../../src/world/zones/CisternZone.js',
  residence: '../../src/world/zones/ResidenceZone.js',
  plant: '../../src/world/zones/PlantZone.js',
  duct: '../../src/world/zones/DuctZone.js',
  stack: '../../src/world/zones/StackZone.js',
  safe: '../../src/world/zones/SafeRoom.js',
};

/** The playthrough harness's per-frame predicate, verbatim. */
function standsOnFloor(collision, x, y, z) {
  const fl = collision.sampleFloor(x, z, y + 1.2, 3.0);
  if (!fl) return { ok: false, why: 'no floor within 3 m below' };
  if (y - fl.y > 2.5) return { ok: false, why: `drop ${(y - fl.y).toFixed(2)} m to y=${fl.y.toFixed(2)}` };
  return { ok: true, fl };
}

async function audit(id, { step = 0.5, verbose = false } = {}) {
  const mod = await import(ZONES[id]);
  const fn = Object.values(mod).find((v) => typeof v === 'function' && /^build/.test(v.name));
  if (!fn) return { id, error: 'no builder' };

  const collision = new CollisionWorld();
  const ctx = {
    materials, collision, rig: makeRig(), palette, scene: new THREE.Group(),
    bus: { on() {}, emit() {} }, assets: permissive(),
    engine: { q: { textureQuality: 1, lights: 14 }, envMap: null },
    zoneId: id, decals: permissive(),
  };
  let zone;
  try { zone = fn(ctx, { seed: 20240607, origin: [0, 0, 0] }); } catch (e) {
    return { id, error: `build threw: ${e.message}` };
  }

  // Sample ON each registered floor rect, at that rect's own height. This is
  // where a player provably can be: they walked onto this surface. Any point of
  // a walkable rectangle that fails the standing test is a hole in the world.
  const bad = [];
  let tested = 0;
  for (const f of collision.floors) {
    if (f.enabled === false) continue;
    const w = f.maxX - f.minX, d = f.maxZ - f.minZ;
    if (w < 0.4 || d < 0.4) continue;
    const nx = Math.max(1, Math.round(w / step));
    const nz = Math.max(1, Math.round(d / step));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = f.minX + (i + 0.5) * (w / nx);
        const z = f.minZ + (j + 0.5) * (d / nz);
        tested++;
        const r = standsOnFloor(collision, x, f.y, z);
        if (!r.ok) bad.push({ x: +x.toFixed(2), y: +f.y.toFixed(2), z: +z.toFixed(2), why: r.why, tag: f.tag });
      }
    }
  }

  // And the gaps BETWEEN rects: a player walking off the edge of one surface
  // toward another at a similar height should not pass through a hole. Sample a
  // ring just outside every rect at that rect's height.
  const edge = [];
  for (const f of collision.floors) {
    if (f.enabled === false) continue;
    const w = f.maxX - f.minX, d = f.maxZ - f.minZ;
    if (w < 0.4 || d < 0.4) continue;
    const R = 0.45;                       // roughly a player radius past the lip
    const pts = [];
    for (let x = f.minX; x <= f.maxX; x += step) pts.push([x, f.minZ - R], [x, f.maxZ + R]);
    for (let z = f.minZ; z <= f.maxZ; z += step) pts.push([f.minX - R, z], [f.maxX + R, z]);
    for (const [x, z] of pts) {
      // Only care if the player could actually get there: something has to be
      // walkable within a stride, otherwise it is simply outside the room.
      const near = collision.sampleFloor(x, z, f.y + 1.2, 3.0);
      if (!near) continue;
      const r = standsOnFloor(collision, x, f.y, z);
      if (!r.ok) edge.push({ x: +x.toFixed(2), y: +f.y.toFixed(2), z: +z.toFixed(2), why: r.why });
    }
  }

  // Cluster so a single hole is reported once rather than forty times.
  const cluster = (list, radius = 1.6) => {
    const out = [];
    for (const p of list) {
      const hit = out.find((c) => Math.hypot(c.x - p.x, c.z - p.z) < radius && Math.abs(c.y - p.y) < 0.6);
      if (hit) { hit.n++; continue; }
      out.push({ ...p, n: 1 });
    }
    return out.sort((a, b) => b.n - a.n);
  };

  return {
    id, tested, floors: collision.floors.length,
    onSurface: cluster(bad), offEdge: cluster(edge),
    badPts: bad.length, edgePts: edge.length,
  };
}

const only = process.argv[2];
const ids = only ? [only] : Object.keys(ZONES);
console.log('');
console.log('floor coverage — points on a walkable rect that fail the playthrough stand test');
console.log('');
console.log('zone         rects   sampled   on-surface failures   just-off-edge failures');
let total = 0;
const detail = [];
for (const id of ids) {
  const r = await audit(id, { step: only ? 0.35 : 0.6 });
  if (r.error) { console.log(`${id.padEnd(12)} ${r.error}`); continue; }
  total += r.badPts;
  console.log(
    `${r.id.padEnd(12)} ${String(r.floors).padStart(5)}   ${String(r.tested).padStart(7)}`
    + `   ${String(r.badPts).padStart(6)} pts / ${String(r.onSurface.length).padStart(3)} sites`
    + `      ${String(r.edgePts).padStart(6)} pts / ${String(r.offEdge.length).padStart(3)} sites`);
  if (r.onSurface.length || r.offEdge.length) detail.push(r);
}

for (const r of detail) {
  if (!r.onSurface.length && !r.offEdge.length) continue;
  console.log('');
  console.log(`  ${r.id} —`);
  for (const c of r.onSurface.slice(0, 8)) {
    console.log(`    ON SURFACE  [${c.x}, ${c.y}, ${c.z}] x${c.n}  tag=${c.tag}  ${c.why}`);
  }
  for (const c of r.offEdge.slice(0, 8)) {
    console.log(`    OFF EDGE    [${c.x}, ${c.y}, ${c.z}] x${c.n}  ${c.why}`);
  }
}
console.log('');
console.log(total === 0
  ? 'No point of any walkable rectangle fails the stand test.'
  : `${total} sampled points stand on nothing. Each ON SURFACE site is a hole a player can walk into.`);
process.exit(total === 0 ? 0 : 1);
