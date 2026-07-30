/**
 * Geometry and draw-call census — browser-free, three seconds.
 *
 * WHY THIS EXISTS
 *
 * `tools/qa/perf.mjs` measures the real thing and is the authority, but it needs a
 * browser, and in this environment it needs a browser running WebGL on a CPU
 * rasteriser: at the high tier, with 4x MSAA, a four-scenario run does not finish
 * in a useful time. So the question "did the content I just added blow the budget"
 * had no cheap answer, and the honest consequence is that content gets added
 * without one.
 *
 * The parts of that question which do NOT need a GPU, or even a canvas:
 *
 *   TRIANGLES        a property of the geometry, full stop.
 *   MERGED MESHES    `Builder` collapses thousands of authored pieces into one
 *                    mesh per material per chunk, and that count IS the static
 *                    draw-call count for the zone — the whole reason the Builder
 *                    exists. Independent objects (doors, machines, props) add one
 *                    each on top.
 *   COLLIDERS        CPU cost of every capsule resolve and sight ray.
 *   FIXTURES         each one is a housing mesh, a light, and optionally a cone.
 *
 * What it cannot tell you: how many of those are in frame at once. Frustum culling
 * is per chunk and depends on where the player stands, so the numbers here are the
 * ZONE TOTAL — an upper bound on what one frame can submit, which is the useful
 * direction to be wrong in.
 *
 *   node tools/qa/geobudget.mjs
 *   node tools/qa/geobudget.mjs plant
 */
import * as THREE from 'three';
import { CollisionWorld } from '../../src/player/Physics.js';
import { FIXTURE_TYPES } from '../../src/render/Lighting.js';
import { ZONE_ORIGIN } from '../../src/world/ZoneKit.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Budgets, and the reasoning for each — because a number picked out of the air is
 * worse than no number. The first version of this file asserted 130 meshes per
 * zone, the Intake reported 300, and the "failure" carried no information at all:
 * a zone's total mesh count is not its draw-call count, because `Builder` splits
 * the plate into chunks precisely so that most of them are frustum-culled.
 *
 * So only quantities whose cost does NOT depend on where the player is standing
 * get a hard budget here:
 *
 *   triangles   the merged chunk you are standing in is submitted whole, so a
 *               zone's triangle count is a real per-frame cost. `perf.mjs` allows
 *               1.2 M for the entire frame including the entity, hands, motes and
 *               water; 900 k leaves room for those.
 *   colliders   every capsule resolve and every sight ray walks the spatial hash.
 *               Cost is per query, not per frame position.
 *
 * Mesh count is REPORTED and diffed against a baseline, not asserted. In-frame
 * draw calls are `perf.mjs`'s job and it is the authority.
 *
 * FIXTURE COUNT IS A TRIPWIRE, NOT A BUDGET, and it is worth being precise about
 * why: the rig drives at most 6 / 10 / 14 real lights by tier, and it walks the
 * full fixture list only on its throttled re-sort at about 5.5 Hz. Five hundred
 * fixtures would be 2 750 distance computations a second, which is nothing. What a
 * fixture actually costs is its housing mesh, and that is already counted in
 * `meshes` and `triangles`. So this number exists to catch somebody adding four
 * hundred lamps by accident, not because 300 would be slow.
 */
const BUDGETS = {
  triangles: 900_000,
  colliders: 3_200,
  fixtures: 320,        // tripwire; see above
};

/** Where the last recorded census lives, for the regression diff. */
const BASELINE = 'docs/captures/geobudget.json';

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
    fixtures, shadowMapSize: 512, circuits: new Map(),
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
    setCircuit() {}, circuitLevel: () => 1, invalidateShadows() {}, requestShadowRefresh() {},
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

/** Count meshes and triangles in a built subtree. */
function census(root) {
  let meshes = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry;
    const idx = g.getIndex();
    const pos = g.getAttribute('position');
    if (idx) tris += idx.count / 3;
    else if (pos) tris += pos.count / 3;
  });
  return { meshes, tris: Math.round(tris) };
}

async function audit(id) {
  const mod = await import(ZONES[id]);
  const fn = Object.values(mod).find((v) => typeof v === 'function' && /^build/.test(v.name));
  if (!fn) return { id, error: 'no builder' };

  const collision = new CollisionWorld();
  const rig = makeRig();
  const scene = new THREE.Group();
  const ctx = {
    materials, collision, rig, palette, scene,
    bus: { on() { return () => {}; }, emit() {} }, assets: null,
    engine: { q: { textureQuality: 1, lights: 14 }, envMap: null },
    zoneId: id, decals: permissive(),
  };
  let zone;
  try { zone = fn(ctx, { seed: 20240607, origin: ZONE_ORIGIN[id] }); } catch (e) {
    return { id, error: `build threw: ${e.message}` };
  }

  const c = census(zone.root);
  return {
    id,
    meshes: c.meshes,
    triangles: c.tris,
    chunks: (zone.chunks || []).length,
    colliders: collision.boxes.length,
    floors: collision.floors.length,
    fixtures: rig.fixtures.length,
    props: (zone.interactables || []).length,
    portals: (zone.portals || []).length,
  };
}

const only = process.argv[2];
const ids = only ? [only] : Object.keys(ZONES);
const rows = [];
for (const id of ids) rows.push(await audit(id));

console.log('');
console.log('geometry census — per zone TOTAL, an upper bound on one frame');
console.log('');
console.log('zone         meshes  chunks   triangles  colliders  floors  fixtures  props  portals');
for (const r of rows) {
  if (r.error) { console.log(`${r.id.padEnd(12)} ${r.error}`); continue; }
  console.log(
    `${r.id.padEnd(12)} ${String(r.meshes).padStart(6)}  ${String(r.chunks).padStart(6)}`
    + `  ${r.triangles.toLocaleString().padStart(10)}  ${String(r.colliders).padStart(9)}`
    + `  ${String(r.floors).padStart(6)}  ${String(r.fixtures).padStart(8)}`
    + `  ${String(r.props).padStart(5)}  ${String(r.portals).padStart(7)}`);
}

console.log('');
console.log('worst zone against budget:');
const ok = [];
for (const [k, budget] of Object.entries(BUDGETS)) {
  const worst = rows.filter((r) => !r.error).reduce((a, r) => (r[k] > (a?.[k] ?? -1) ? r : a), null);
  const v = worst?.[k] ?? 0;
  const pass = v <= budget;
  ok.push(pass);
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${k.padEnd(10)} ${String(v.toLocaleString()).padStart(9)} / ${budget.toLocaleString()}`
    + `   (${worst?.id})`);
}

// ---- regression diff -----------------------------------------------------
// The question content work actually raises is not "is this under an absolute
// number", it is "what did my change cost". Absolute budgets cannot answer that;
// a recorded baseline can.
{
  let base = null;
  try { base = JSON.parse(await readFile(BASELINE, 'utf8')); } catch { /* first run */ }
  if (base?.zones && !only) {
    const keys = ['meshes', 'triangles', 'colliders', 'fixtures', 'props'];
    const moved = [];
    for (const r of rows) {
      if (r.error) continue;
      const b = base.zones[r.id];
      if (!b) { moved.push(`${r.id}: new zone`); continue; }
      for (const k of keys) {
        const d = (r[k] ?? 0) - (b[k] ?? 0);
        if (d !== 0) moved.push(`${r.id} ${k} ${d > 0 ? '+' : ''}${d.toLocaleString()}`);
      }
    }
    console.log('');
    if (!moved.length) console.log(`unchanged since the baseline of ${base.at}`);
    else {
      console.log(`changed since the baseline of ${base.at}:`);
      for (const m of moved) console.log(`  ${m}`);
    }
  }
  if (!only) {
    const zones = {};
    for (const r of rows) if (!r.error) zones[r.id] = r;
    await mkdir(path.dirname(BASELINE), { recursive: true });
    await writeFile(BASELINE, `${JSON.stringify({ at: new Date().toISOString(), zones }, null, 2)}\n`);
    console.log(`(baseline written to ${BASELINE})`);
  }
}

const totals = rows.filter((r) => !r.error).reduce((a, r) => ({
  meshes: a.meshes + r.meshes, triangles: a.triangles + r.triangles,
  props: a.props + r.props, fixtures: a.fixtures + r.fixtures,
}), { meshes: 0, triangles: 0, props: 0, fixtures: 0 });
console.log('');
console.log(`whole building: ${totals.meshes} meshes, ${totals.triangles.toLocaleString()} triangles, `
  + `${totals.fixtures} fixtures, ${totals.props} gameplay props.`);
console.log('Three zones are resident at once, never all eight — see World.maxResident.');
console.log('');
console.log('This is the cheap half of the answer. tools/qa/perf.mjs measures the real');
console.log('frame in a browser and is the authority on draw calls actually submitted.');
process.exit(ok.every(Boolean) ? 0 : 1);
