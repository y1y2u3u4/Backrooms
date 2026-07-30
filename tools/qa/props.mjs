/**
 * Prop placement audit — every declared interactable, checked against geometry.
 *
 * WHY THIS EXISTS
 *
 * The zone builders now declare their gameplay props as data
 * (`return { interactables: [...] }`) and the gameplay layer builds them. Those
 * coordinates are written by hand against each zone's own constants, and a wrong
 * one does not throw: the breaker ends up inside the wall, the core ends up
 * 400 mm under the floor, the locker ends up somewhere the player cannot walk to.
 * None of that is visible in a screenshot of the room it is NOT in.
 *
 * So this measures, browser-free, in about a second:
 *
 *   FLOOR      is there a walkable surface under the prop, and how far below?
 *   STAND      is there somewhere a player can stand within the prop's own
 *              interaction range, whose eye height has line of sight to it?
 *   BURIED     is the prop's own anchor point inside a solid collider?
 *   HEADROOM   is there 1.75 m of clearance where the player has to stand?
 *
 * The STAND test is the one that matters: a prop is only in the game if a player
 * standing on a floor can put the reticle on it from inside its range. It samples
 * a ring of candidate positions and reports the best one, so a failure comes with
 * the coordinate to fix.
 *
 *   node tools/qa/props.mjs             # every zone
 *   node tools/qa/props.mjs plant       # one zone, verbose
 */
import * as THREE from 'three';
import { CollisionWorld } from '../../src/player/Physics.js';
import { FIXTURE_TYPES } from '../../src/render/Lighting.js';
import { ZONE_ORIGIN } from '../../src/world/ZoneKit.js';

// ---------------------------------------------------------------------------
// the same headless zone-build harness floorgaps.mjs uses
// ---------------------------------------------------------------------------

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
    setCircuit() {}, circuitLevel: () => 1, requestShadowRefresh() {}, invalidateShadows() {},
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

/**
 * Reach for each factory, matching the `range` each one passes to
 * `Interactor.add`. A prop the player can see but not reach is not in the game,
 * and these are the numbers that decide it.
 */
const REACH = {
  breaker: 1.5, breakerPanel: 1.5,
  valve: 1.9,
  lift: 1.6, goodsLift: 1.6,        // the inside buttons; the outer call is 1.9
  keypad: 1.6,
  cardReader: 1.6,
  terminal: 1.4,
  generator: 1.8,
  door: 2.0,
  pickup: 2.0,
  hide: 2.0, hidingPlace: 2.0,
};

/**
 * Where each factory's actual hit target sits, in the prop's OWN local frame
 * (x = right, y = up, z = the way the prop faces). Everything is anchored at the
 * base of its geometry, and most of these are read straight off the factory:
 * `breakerPanel` puts its dolly row at H * 0.56, `valve` puts the handwheel at
 * +0.40, `generator` puts the socket bank at (1.05, 1.35, 0.62).
 */
const HIT = {
  breaker: [0, 0.38, 0.04], breakerPanel: [0, 0.38, 0.04],
  valve: [0, 0.40, 0],
  lift: [0, 1.15, 1.30], goodsLift: [0, 1.15, 1.30],     // the outer call station
  keypad: [0, 0, 0.03],
  cardReader: [0, 0, 0.03],
  terminal: [0, 0.30, 0.10],
  generator: [1.05, 1.35, 0.62],
  door: [0, 1.05, 0],
  pickup: [0, 0.04, 0],
  hide: [0, 1.10, 0.22], hidingPlace: [0, 1.10, 0.22],
};

/**
 * Props that provide their own walkable surface, so "no floor beneath" is not a
 * fault. The lift car registers a moving collision floor of its own.
 */
const SELF_FLOOR = new Set(['lift', 'goodsLift']);

/** Props that are MEANT to be inside a wall: only their front face is reachable. */
const WALL_MOUNTED = new Set([
  'breaker', 'breakerPanel', 'keypad', 'cardReader', 'door', 'lift', 'goodsLift',
]);

const EYE = 1.62;          // standing eye height
const EYE_CROUCH = 1.02;   // crouched eye height
const HEAD = 1.75;         // clearance a standing body needs
const CROUCH = 1.10;       // clearance a crouching body needs
const EYE_CRAWL = 0.52;    // eye height on hands and knees
const CRAWL = 0.70;        // clearance a crawling body needs (the Ductwork is 0.80)

async function audit(id) {
  const mod = await import(ZONES[id]);
  const fn = Object.values(mod).find((v) => typeof v === 'function' && /^build/.test(v.name));
  if (!fn) return { id, error: 'no builder' };

  const collision = new CollisionWorld();
  const ctx = {
    materials, collision, rig: makeRig(), palette, scene: new THREE.Group(),
    bus: { on() { return () => {}; }, emit() {} }, assets: null,
    engine: { q: { textureQuality: 1, lights: 14 }, envMap: null },
    zoneId: id, decals: permissive(),
  };
  let zone;
  try { zone = fn(ctx, { seed: 20240607, origin: ZONE_ORIGIN[id] }); } catch (e) {
    return { id, error: `build threw: ${e.stack?.split('\n').slice(0, 3).join(' | ')}` };
  }

  const [ox, oy, oz] = ZONE_ORIGIN[id] || [0, 0, 0];

  /**
   * Segment test that skips the thing the prop is resting on or mounted to.
   *
   * `collision.segmentBlocked` cannot express that: a note lying on a desk is by
   * definition on the surface of the desk's collider, so a ray from eye height
   * down to it always clips the desk and every pickup in the building reads as
   * unreachable. The box that CONTAINS the hit point is the support, not an
   * obstruction, so it is excluded — along with ceilings, which the player's own
   * head is already under.
   */
  const sightBlocked = (ax, ay, az, bx, by, bz) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const steps = Math.max(4, Math.ceil(len / 0.10));
    for (const box of collision.boxes) {
      if (!box.enabled || !box.solid || !box.blocksSight) continue;
      if (box.tag === 'ceiling') continue;
      // The support / the wall the prop is screwed to.
      if (bx >= box.minX - 0.06 && bx <= box.maxX + 0.06
        && bz >= box.minZ - 0.06 && bz <= box.maxZ + 0.06
        && by >= box.minY - 0.06 && by <= box.maxY + 0.06) continue;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
        if (x > box.minX && x < box.maxX && y > box.minY && y < box.maxY && z > box.minZ && z < box.maxZ) {
          return box.tag || 'world';
        }
      }
    }
    return null;
  };

  const out = [];
  for (const spec of zone.interactables || []) {
    const kind = spec.kind;
    const rot = spec.rotation || 0;
    const px = spec.position[0] + ox, py = spec.position[1] + oy, pz = spec.position[2] + oz;
    const reach = REACH[kind] ?? 1.9;
    const [lx, ly, lz] = HIT[kind] || [0, 0.05, 0];
    // Rotate the local hit offset into world space: local +Z is the facing.
    const c = Math.cos(rot), sn = Math.sin(rot);
    const hx = px + lx * c + lz * sn;
    const hy = py + ly;
    const hz = pz - lx * sn + lz * c;
    const name = spec.id || `${kind}:${spec.item || spec.noteId || spec.tapeId || ''}`;

    // ---- SUPPORT: is the prop resting on something? ------------------------
    // Not just the floor: a note on a desk, a core on a shelf and a cassette on a
    // bench are all supported by the top of a prop collider. Measuring only to the
    // floor made every item placed on furniture read as "floating", which is how a
    // check that is wrong in the safe direction still wastes an afternoon.
    const under = collision.sampleFloor(px, pz, py + 0.5, 4.0);
    let supportY = under ? under.y : -Infinity;
    for (const b of collision.boxes) {
      if (!b.enabled || !b.solid || b.tag === 'ceiling') continue;
      if (px < b.minX - 0.05 || px > b.maxX + 0.05) continue;
      if (pz < b.minZ - 0.05 || pz > b.maxZ + 0.05) continue;
      // Furniture colliders are single boxes from the floor to the top of the
      // carcass, so an item ON a shelf is INSIDE the rack's box rather than on top
      // of it. That box is still what is holding it up.
      if (py > b.minY && py < b.maxY) { supportY = Math.max(supportY, py); continue; }
      if (b.maxY > py + 0.08) continue;           // above the prop: not a support
      if (b.maxY > supportY) supportY = b.maxY;
    }
    const drop = Number.isFinite(supportY) ? py - supportY : null;

    // ---- BURIED: is the HIT POINT inside something solid? ------------------
    // Tested at the hit point, not the anchor, and skipped for anything that is
    // supposed to be screwed to a wall — the anchor of a breaker panel is inside
    // the wall by design; what matters is that its face is not.
    // Depth matters, not mere containment. A note on a shelf is inside the rack's
    // bounding box by 100 mm and that is what a shelf IS; a note 400 mm inside a
    // workbench is in the workbench. Anything more than DEEP from the nearest face
    // of a box it is inside is buried.
    const DEEP = 0.30;
    let buried = null;
    if (!WALL_MOUNTED.has(kind)) {
      for (const b of collision.boxes) {
        if (!b.enabled || !b.solid) continue;
        if (b.tag === 'ceiling') continue;
        if (hy <= b.minY || hy >= b.maxY) continue;
        if (hx <= b.minX || hx >= b.maxX) continue;
        if (hz <= b.minZ || hz >= b.maxZ) continue;
        const depth = Math.min(
          hx - b.minX, b.maxX - hx, hy - b.minY, b.maxY - hy, hz - b.minZ, b.maxZ - hz);
        if (depth < DEEP) continue;
        buried = `${b.tag} (${depth.toFixed(2)} m in)`; break;
      }
    }

    // ---- STAND: somewhere to be, from which the prop is reachable ---------
    // Ring search out to the prop's own range. Standing is preferred; a crawl
    // space that only allows a crouch is recorded rather than failed, because the
    // player can crouch and the Ductwork is 800 mm square by design.
    let stand = null;
    const RINGS = [0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1];
    for (const r of RINGS) {
      if (r > reach + 0.2) break;
      for (let a = 0; a < 32 && !stand; a++) {
        const th = (a / 32) * Math.PI * 2;
        const sx = px + Math.cos(th) * r, sz = pz + Math.sin(th) * r;
        const fl = collision.sampleFloor(sx, sz, py + 1.2, 3.2);
        if (!fl) continue;
        if (Math.abs(fl.y - (under ? under.y : py)) > 1.3) continue;
        const ceil = collision.ceilingAbove(sx, sz, fl.y + 0.05, 0.26);
        const clear = ceil === null ? 99 : ceil - fl.y;
        if (clear < CRAWL) continue;
        const crawled = clear < CROUCH;
        const crouched = clear < HEAD;
        const eye = fl.y + (crawled ? EYE_CRAWL : crouched ? EYE_CROUCH : EYE);
        // Not standing inside a wall. Posture picks the capsule height.
        const res = collision.resolveCapsule(sx, fl.y, sz, 0.30, crawled ? 0.62 : crouched ? 1.02 : 1.70);
        if (Math.hypot(res.x - sx, res.z - sz) > 0.16) continue;
        const hit = sightBlocked(sx, eye, sz, hx, hy, hz);
        if (hit) continue;
        const d = Math.hypot(hx - sx, hz - sz, hy - eye);
        if (d > reach) continue;
        stand = { x: +sx.toFixed(2), y: +fl.y.toFixed(2), z: +sz.toFixed(2), d: +d.toFixed(2), posture: crawled ? 'crawling' : crouched ? 'crouched' : 'standing' };
      }
      if (stand) break;
    }

    const problems = [];
    // Wall-mounted kit is SUPPOSED to be up the wall; only free-standing props and
    // pickups have to be resting on something.
    if (!under && !SELF_FLOOR.has(kind)) problems.push('no floor beneath');
    else if (under && !WALL_MOUNTED.has(kind) && drop > 1.25) problems.push(`floating ${drop.toFixed(2)} m above the floor`);
    else if (under && drop < -0.25) problems.push(`sunk ${(-drop).toFixed(2)} m below the floor`);
    if (buried) problems.push(`hit point inside a "${buried}" collider`);
    if (!stand) problems.push(`unreachable — nowhere to stand within ${reach} m with line of sight`);

    out.push({
      zone: id, name, kind,
      at: [+px.toFixed(2), +py.toFixed(2), +pz.toFixed(2)],
      local: spec.position.map((v) => +v.toFixed(2)),
      drop: drop === null ? null : +drop.toFixed(2),
      stand, problems,
    });
  }

  return { id, props: out, portals: (zone.portals || []).length, safe: !!zone.safe };
}

// ---------------------------------------------------------------------------

const only = process.argv[2];
const ids = only ? [only] : Object.keys(ZONES);
console.log('');
console.log('prop placement — declared interactables measured against zone geometry');
console.log('');
console.log('zone         props   ok   floating/sunk   buried   unreachable');
let bad = 0, total = 0;
const detail = [];
for (const id of ids) {
  const r = await audit(id);
  if (r.error) { console.log(`${id.padEnd(12)} ${r.error}`); bad++; continue; }
  const fail = r.props.filter((p) => p.problems.length);
  const nFloat = r.props.filter((p) => p.problems.some((s) => /floating|sunk|no floor/.test(s))).length;
  const nBuried = r.props.filter((p) => p.problems.some((s) => /inside a/.test(s))).length;
  const nReach = r.props.filter((p) => p.problems.some((s) => /unreachable/.test(s))).length;
  total += r.props.length;
  bad += fail.length;
  console.log(
    `${id.padEnd(12)} ${String(r.props.length).padStart(5)}`
    + ` ${String(r.props.length - fail.length).padStart(4)}`
    + `   ${String(nFloat).padStart(13)}`
    + `   ${String(nBuried).padStart(6)}`
    + `   ${String(nReach).padStart(11)}`);
  if (fail.length || only) detail.push(r);
}

for (const r of detail) {
  const show = only ? r.props : r.props.filter((p) => p.problems.length);
  if (!show.length) continue;
  console.log('');
  console.log(`  ${r.id} —`);
  for (const p of show) {
    const tag = p.problems.length ? 'FAIL' : ' ok ';
    console.log(`    ${tag} ${p.name.padEnd(28)} local [${p.local.join(', ')}]`
      + (p.stand ? `  stand @ ${p.stand.d} m${p.stand.posture === 'standing' ? '' : ` (${p.stand.posture})`}` : '')
      + (p.problems.length ? `\n           ${p.problems.join('; ')}` : ''));
  }
}

console.log('');
console.log(bad === 0
  ? `All ${total} declared props are on a floor, out of the walls, and reachable.`
  : `${bad} of ${total} props have a placement problem.`);
process.exit(bad === 0 ? 0 : 1);
