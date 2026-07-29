import * as THREE from 'three';
import { setWetness } from '../render/Materials.js';
import { FOG_PROFILES } from '../render/AtmosphereFog.js';
import { disposeTree } from '../render/geo.js';
import { ZONE_ORIGIN, detachColliders } from './ZoneKit.js';
import { Decals } from './Decals.js';

/**
 * World — the zone graph and the streaming manager.
 *
 * The Annex is eight zones that each cost several hundred thousand triangles to
 * build. They are never all resident. This holds a graph of zones connected by
 * portals, builds a zone the first time it is needed, keeps the two or three
 * most recently used in memory, and tears the rest down — geometry, colliders
 * and light fixtures alike.
 *
 * Zones live in disjoint patches of world space (see ZONE_ORIGIN), 400 m apart,
 * which is past the far plane. That means one collision world, one light rig
 * and one scene can hold several zones at once with no interaction between
 * them, and a portal transition is a teleport the player never sees because it
 * happens behind a closing door.
 *
 * Contract with Game.js:
 *   createWorld(ctx) -> { root, spawn, spawnYaw, currentZone, zones,
 *                         boot(onProgress), update(dt, playerPos),
 *                         enter(zoneId, portalId) }
 */

/**
 * `import.meta.glob` so a zone that has not been written yet simply does not
 * appear, and the world still builds with whatever exists.
 */
const ZONE_MODULES = import.meta.glob('./zones/*.js');

/** Zone registry. `fn` names the export the module is expected to provide. */
export const ZONE_DEFS = {
  intake: { file: 'IntakeZone.js', fn: ['buildIntake', 'default'], fog: 'intake', reverb: 'intake', letter: 'L' },
  service: { file: 'ServiceZone.js', fn: ['buildService', 'default'], fog: 'service', reverb: 'service', letter: 'S' },
  cistern: { file: 'CisternZone.js', fn: ['buildCistern', 'default'], fog: 'cistern', reverb: 'cistern', letter: 'C' },
  residence: { file: 'ResidenceZone.js', fn: ['buildResidence', 'default'], fog: 'residence', reverb: 'residence', letter: 'R' },
  plant: { file: 'PlantZone.js', fn: ['buildPlant', 'default'], fog: 'plant', reverb: 'plant', letter: 'P' },
  duct: { file: 'DuctZone.js', fn: ['buildDuct', 'default'], fog: 'duct', reverb: 'duct', letter: 'D' },
  stack: { file: 'StackZone.js', fn: ['buildStack', 'default'], fog: 'stack', reverb: 'stack', letter: 'K' },
  safe: { file: 'SafeRoom.js', fn: ['buildSafeRoom', 'default'], fog: 'safe', reverb: 'safe', letter: 'O' },
};

/**
 * The zone graph, authored rather than derived, so the building has a shape.
 * Portals are matched by id: a portal in A targeting {zone:'B', portalId:'x'}
 * arrives at B's portal 'x'. Each pair is declared once here as documentation
 * and checked at build time.
 */
export const ZONE_GRAPH = {
  intake: ['service', 'duct'],
  service: ['intake', 'cistern', 'residence', 'plant', 'safe', 'stack'],
  cistern: ['service', 'plant'],
  residence: ['service', 'stack'],
  plant: ['service', 'cistern', 'duct'],
  duct: ['intake', 'plant'],
  stack: ['service', 'residence'],
  safe: ['service'],
};

export class World {
  constructor(ctx, { maxResident = 3, startZone = 'intake', seed = 20240607 } = {}) {
    this.ctx = ctx;
    this.seed = seed;
    this.maxResident = maxResident;
    this.root = new THREE.Group();
    this.root.name = 'world';
    ctx.scene.add(this.root);

    this.zones = {};          // id -> built zone object
    this.modules = {};        // id -> module namespace
    this.lastUsed = {};       // id -> monotonic counter
    this._tick = 0;
    this.currentZone = startZone;
    this.spawn = [0, 0, 0];
    this.spawnYaw = 0;
    this.player = null;
    this._transitionCooldown = 0;

    // One decal atlas for the whole building, shared by every zone.
    this.decals = new Decals(ctx.materials, { seed: seed ^ 0x0dec }).build();
    ctx.decals = this.decals;
    ctx.world = this;
  }

  // -- boot ---------------------------------------------------------------

  async boot(onProgress = () => {}) {
    onProgress(0.05, 'reading the schedule');
    // Import every zone module up front (code only — nothing is built yet).
    const ids = Object.keys(ZONE_DEFS);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const loader = ZONE_MODULES['./zones/' + ZONE_DEFS[id].file];
      if (!loader) continue;
      try {
        this.modules[id] = await loader();
      } catch (e) {
        console.warn(`[world] zone "${id}" failed to load`, e);
      }
      onProgress(0.05 + (i / ids.length) * 0.25, `reading ${id}`);
    }

    onProgress(0.35, `raising ${this.currentZone}`);
    const z = this.build(this.currentZone);
    if (!z) {
      // Nothing to build at all — degrade to an empty world rather than throw.
      console.error('[world] no zones available');
      return this;
    }
    this.spawn = this.toWorld(this.currentZone, z.spawn || [0, 0, 0]);
    this.spawnYaw = z.spawnYaw || 0;
    this.applyProfile(this.currentZone, true);
    onProgress(1, 'ready');
    return this;
  }

  // -- coordinates --------------------------------------------------------

  origin(id) { return ZONE_ORIGIN[id] || [0, 0, 0]; }
  toWorld(id, p) {
    const o = this.origin(id);
    return [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
  }
  toLocal(id, p) {
    const o = this.origin(id);
    return [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  }

  // -- building -----------------------------------------------------------

  /** Build (or fetch) a zone. Synchronous — modules are already imported. */
  build(id) {
    if (this.zones[id]) { this.lastUsed[id] = ++this._tick; return this.zones[id]; }
    const def = ZONE_DEFS[id];
    const mod = this.modules[id];
    if (!def || !mod) { console.warn(`[world] zone "${id}" unavailable`); return null; }
    const fn = def.fn.map((n) => mod[n]).find((f) => typeof f === 'function');
    if (!fn) { console.warn(`[world] zone "${id}" exports no builder`); return null; }

    const t0 = performance.now();
    const fixturesBefore = this.ctx.rig.fixtures.length;
    let zone;
    try {
      zone = fn({ ...this.ctx, zoneId: id, decals: this.decals }, {
        seed: this.seed ^ hashId(id), origin: this.origin(id), world: this,
      });
    } catch (e) {
      console.error(`[world] zone "${id}" threw while building`, e);
      return null;
    }
    if (!zone || !zone.root) { console.warn(`[world] zone "${id}" returned nothing`); return null; }

    zone.id = id;
    zone.origin = this.origin(id);
    zone.fogProfile = zone.fogProfile || def.fog;
    zone.reverb = zone.reverb || def.reverb;
    zone.portals = zone.portals || [];
    zone._fixtures = this.ctx.rig.fixtures.slice(fixturesBefore);
    zone.root.position.set(0, 0, 0);   // zones bake their own origin in
    this.root.add(zone.root);
    this.zones[id] = zone;
    this.lastUsed[id] = ++this._tick;

    zone.tris = zone.root.userData?.tris ?? 0;
    console.info(`[world] built ${id} in ${(performance.now() - t0).toFixed(0)} ms` +
      (zone.tris ? ` (${(zone.tris / 1000).toFixed(0)}k tris)` : ''));
    this.evict();
    return zone;
  }

  /** Tear a zone down completely. */
  unload(id) {
    const z = this.zones[id];
    if (!z || id === this.currentZone) return;
    this.root.remove(z.root);
    disposeTree(z.root, false);
    if (z._fixtures) for (const f of z._fixtures) this.ctx.rig.remove(f);
    if (z.builders) detachColliders(this.ctx.collision, z.builders);
    z.dispose?.();
    delete this.zones[id];
    delete this.lastUsed[id];
    this.ctx.bus?.emit('zone:unload', { zone: id });
  }

  /** Keep only the N most recently used zones. */
  evict() {
    const ids = Object.keys(this.zones);
    if (ids.length <= this.maxResident) return;
    ids.sort((a, b) => (this.lastUsed[a] || 0) - (this.lastUsed[b] || 0));
    for (const id of ids) {
      if (Object.keys(this.zones).length <= this.maxResident) break;
      if (id === this.currentZone) continue;
      this.unload(id);
    }
  }

  // -- transitions --------------------------------------------------------

  /** Look up a portal by id in a built (or buildable) zone. */
  portalIn(zoneId, portalId) {
    const z = this.build(zoneId);
    if (!z) return null;
    return (z.portals || []).find((p) => p.id === portalId) || null;
  }

  /**
   * Move to `zoneId`, arriving at `portalId` if given, otherwise the zone's
   * spawn. Builds the zone, swaps atmosphere, wetness and bounce fill, and
   * teleports the player if one is attached. Returns the arrival point.
   */
  enter(zoneId, portalId = null) {
    const from = this.currentZone;
    const z = this.build(zoneId);
    if (!z) return null;

    let localPos = z.spawn || [0, 0, 0];
    let yaw = z.spawnYaw || 0;
    if (portalId) {
      const p = (z.portals || []).find((q) => q.id === portalId);
      if (p) { localPos = p.arrive || p.position; yaw = p.arriveYaw ?? p.yaw; }
    }
    const world = this.toWorld(zoneId, localPos);

    if (from !== zoneId) this.ctx.bus?.emit('zone:leave', { zone: from });
    this.currentZone = zoneId;
    this.lastUsed[zoneId] = ++this._tick;
    this.applyProfile(zoneId, false);
    this.spawn = world;
    this.spawnYaw = yaw;

    if (this.player) this.player.teleport(world[0], world[1], world[2], yaw);
    this.ctx.bus?.emit('world:teleport', { position: world, yaw, zone: zoneId });
    if (from !== zoneId) this.ctx.bus?.emit('zone:enter', { zone: zoneId, from });
    this._transitionCooldown = 0.75;
    this.evict();
    return { position: world, yaw, zone: zoneId };
  }

  /** QA / debug: jump straight to a zone's spawn and return the camera setup. */
  goto(zoneId, portalId = null) { return this.enter(zoneId, portalId); }

  attachPlayer(p) { this.player = p; return this; }

  /** Atmosphere, wetness and bounce fill for a zone. */
  applyProfile(zoneId, immediate = false) {
    const z = this.zones[zoneId];
    const key = z?.fogProfile || ZONE_DEFS[zoneId]?.fog || 'intake';
    const profile = FOG_PROFILES[key] || FOG_PROFILES.intake;
    this.ctx.engine?.atmosphere?.set(profile, immediate);
    setWetness(z?.waterLine ?? -999, z?.wetness ?? 0);
    if (z?.ambient && this.ctx.rig.setAmbient) {
      this.ctx.rig.setAmbient(z.ambient.sky, z.ambient.ground, z.ambient.intensity);
    }
  }

  // -- frame --------------------------------------------------------------

  update(dt, playerPos) {
    this._transitionCooldown = Math.max(0, this._transitionCooldown - dt);
    // Which zone patch is the player standing in? Zones are 400 m apart, so a
    // nearest-origin test is exact and costs nothing.
    if (playerPos) {
      let best = this.currentZone, bd = Infinity;
      for (const id of Object.keys(this.zones)) {
        const o = this.origin(id);
        const d = (playerPos.x - o[0]) ** 2 + (playerPos.z - o[2]) ** 2;
        if (d < bd) { bd = d; best = id; }
      }
      if (best !== this.currentZone && bd < 200 * 200 && this._transitionCooldown <= 0) {
        const from = this.currentZone;
        this.currentZone = best;
        this.lastUsed[best] = ++this._tick;
        this.applyProfile(best, false);
        this.ctx.bus?.emit('zone:leave', { zone: from });
        this.ctx.bus?.emit('zone:enter', { zone: best, from });
        this.evict();
      }
    }

    const local = playerPos ? this.toLocal(this.currentZone, [playerPos.x, playerPos.y, playerPos.z]) : null;
    for (const id of Object.keys(this.zones)) {
      const z = this.zones[id];
      if (!z.update) continue;
      // Only the zone the player is in gets a live update; the others idle.
      if (id === this.currentZone) z.update(dt, local, playerPos);
      else z.updateIdle?.(dt);
    }

    // Pre-build the neighbour a nearby portal leads to, so the transition
    // itself never stalls the frame.
    this._preload(dt, playerPos);
  }

  _preload(dt, playerPos) {
    this._preloadTimer = (this._preloadTimer || 0) - dt;
    if (this._preloadTimer > 0 || !playerPos) return;
    this._preloadTimer = 1.0;
    const z = this.zones[this.currentZone];
    if (!z?.portals?.length) return;
    if (Object.keys(this.zones).length >= this.maxResident) return;
    const o = this.origin(this.currentZone);
    for (const p of z.portals) {
      const wx = p.position[0] + o[0], wz = p.position[2] + o[2];
      const d = Math.hypot(playerPos.x - wx, playerPos.z - wz);
      if (d < 14 && p.target?.zone && !this.zones[p.target.zone]) {
        this.build(p.target.zone);
        return;
      }
    }
  }

  // -- introspection ------------------------------------------------------

  get stats() {
    const resident = Object.keys(this.zones);
    return {
      current: this.currentZone,
      resident,
      tris: resident.reduce((s, id) => s + (this.zones[id].tris || 0), 0),
      fixtures: this.ctx.rig.fixtures.length,
    };
  }

  /** Every portal in every built zone, for debugging the graph. */
  get portals() {
    const out = [];
    for (const id of Object.keys(this.zones)) {
      for (const p of this.zones[id].portals || []) out.push({ ...p, zone: id });
    }
    return out;
  }

  dispose() {
    for (const id of Object.keys(this.zones)) { this.currentZone = null; this.unload(id); }
    this.root.removeFromParent();
  }
}

function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function createWorld(ctx, opts = {}) {
  return new World(ctx, opts);
}

export default createWorld;
