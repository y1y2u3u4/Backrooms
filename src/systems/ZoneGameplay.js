import * as THREE from 'three';
import { DoorLatch } from '../player/Interactor.js';

/**
 * ZoneGameplay — the missing join between the world and the game.
 *
 * WHY THIS FILE EXISTS
 *
 * Every zone builder in `src/world/zones/` ends with
 *
 *     return { root, chunks, builders, portals, interactables, ... };
 *
 * and every one of them returned `interactables: []`. `Builder` even carries an
 * `interactables` array of its own. Nothing ever pushed to any of them, and
 * nothing ever read them: `installGameplay` only populated the world when
 * `seedDemo` was true, which is `!subsystems.world` — the bare Intake fallback.
 * So in the shipped game, with all eight zones built, the interactor's registry
 * was EMPTY. No breaker, no valve, no keypad, no card reader, no terminal, no
 * generator, no goods lift, no hiding place, no pickup, and no door that could
 * be opened or that stopped you walking through it. The three-supply-core
 * objective chain and both endings were unreachable, and `Progression` sat there
 * for the whole session with its first objective active and no way to advance it.
 *
 * This module closes that. It runs once per zone, the first time the zone is
 * built, and does four things:
 *
 *   1. ADOPTS EVERY DOOR. `Kit.doorway()` deliberately leaves the wall opening
 *      walkable and hangs a leaf in it with NO collider, because the collider
 *      belongs to `DoorLatch` (which knows when the leaf is out of the way).
 *      Nothing constructed those latches, so every shut door in the building was
 *      a hole you walked through — including the ~20 Residence doors whose rooms
 *      are never built, where walking through meant falling out of the world.
 *   2. SPAWNS THE PROPS the zone declares, offsetting local coordinates into the
 *      zone's world patch.
 *   3. REGISTERS THE PORTALS with `Progression`, grouped by where they lead, so
 *      the critical path can lock "the way into the Stack" once rather than
 *      hunting for two independently-authored door ids.
 *   4. HANDS THE DIRECTOR its safe room and the Attendant its candidate floors.
 *
 * PROPS ARE NEVER DESPAWNED. The world streams zone *geometry* in and out, and
 * it would be easy to tear props down with it — but a breaker you threw, a valve
 * you turned and three cores you fitted are the player's progress, and cheap
 * serialisation of that state is a much larger and more fragile thing than the
 * memory it would save. Zones live 400 m apart, past the far plane, so a
 * resident prop from an unloaded zone is invisible, is culled, and sits in
 * collision hash cells no query ever touches. There are a few dozen props in the
 * whole building. Keeping them costs nothing that matters.
 */

const _p = new THREE.Vector3();

/**
 * Which gate group a portal belongs to, from where it leads. Authored here
 * rather than in the zone files so that adding a second way into a wing cannot
 * silently bypass a lock.
 */
function groupFor(portal) {
  if (portal.isExit) return 'portal_lift';
  // A portal a zone file declares `locked: true` is an authored dead end — the
  // bolted pipe hatch out of the Service Spine, the sluice hatch out of the
  // Cistern chamber. Those are scenery, not gates, and joining them to their
  // destination's group would have `installDefaultGates()` throw them open.
  if (portal.locked) return null;
  const z = portal.target?.zone;
  if (!z) return null;
  return `portal_${z}`;
}

export class ZoneGameplay {
  /**
   * @param {object} opts
   * @param {import('../world/World.js').World} opts.world
   * @param {object} opts.gameplay the object `installGameplay` is building
   */
  constructor({ world, gameplay, ctx }) {
    this.world = world;
    this.g = gameplay;
    this.ctx = ctx;
    this.bus = ctx.bus;
    this.done = new Set();
    this._unsub = [];
    this.doorCount = 0;
    this.propCount = 0;
  }

  attach() {
    // Zones already built before the gameplay layer existed — always at least
    // the start zone, because Game boots the world first.
    for (const id of Object.keys(this.world.zones)) this.install(id);
    this._unsub.push(this.bus.on('zone:build', (e) => { if (e?.zone) this.install(e.zone); }));
    return this;
  }

  dispose() { for (const u of this._unsub) u(); this._unsub.length = 0; }

  /** Idempotent. */
  install(zoneId) {
    if (this.done.has(zoneId)) return false;
    const zone = this.world.zones[zoneId];
    if (!zone) return false;
    this.done.add(zoneId);
    const origin = this.world.origin(zoneId);
    try { this._doors(zone, zoneId, origin); } catch (e) { console.error(`[zonegameplay:${zoneId}] doors`, e); }
    try { this._props(zone, zoneId, origin); } catch (e) { console.error(`[zonegameplay:${zoneId}] props`, e); }
    try { this._portals(zone); } catch (e) { console.error(`[zonegameplay:${zoneId}] portals`, e); }
    try { this._markers(zone, zoneId, origin); } catch (e) { console.error(`[zonegameplay:${zoneId}] markers`, e); }
    return true;
  }

  // -- 1. doors ---------------------------------------------------------------

  /**
   * Turn every `Kit.doorway()` group in the zone into a working door.
   *
   * A door is only made openable if there is walkable floor on BOTH sides of it
   * at roughly the leaf's own level. That single test does two jobs at once: it
   * is the diegetic reason most doors in the Residence are locked ("no keyway on
   * this side" — there is nothing behind them), and it is what stops the player
   * opening a door into a room that was never built and falling 28 m into the
   * respawn net. A door onto nothing keeps its collider forever.
   */
  _doors(zone, zoneId, origin) {
    const { interactor, collision, bus, rig } = this.ctx;
    if (!interactor) return;

    // A PORTAL DOOR IS ALWAYS PASSABLE. The floor-on-both-sides test cannot see
    // through one: the far side of the Plant's Service door is the Service Spine,
    // which lives in a world patch 400 m away, so the sample finds nothing and the
    // door reads as a dead end. That locked the only way into the Cistern, the
    // Plant, the Stack and the Office of Record — every zone whose sole doorway is
    // a portal — and `World.update` now refuses to fire a portal it cannot see
    // past, so the building would have sealed itself shut.
    const [ox, oy, oz] = origin || [0, 0, 0];
    const portalPts = (zone.portals || []).map((p) => [
      p.position[0] + ox, p.position[1] + oy, p.position[2] + oz]);
    const nearPortal = (x, y, z) => portalPts.some(
      (q) => Math.hypot(q[0] - x, q[2] - z) < 1.6 && Math.abs(q[1] - y) < 2.2);

    let n = 0;
    for (const b of zone.builders || []) {
      for (const obj of b.objects || []) {
        const d = obj.userData?.door;
        if (!d || obj.userData._latch) continue;
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(_p);
        const id = `${zoneId}_door${n++}`;

        // Which way is "through"? The leaf lies in the plane of the wall, so the
        // wall normal is the group's local +Z rotated into world space.
        const rot = obj.rotation.y;
        const nx = Math.sin(rot), nz = Math.cos(rot);
        const REACH = 0.85;                 // clear of the leaf and its frame
        // The threshold's own level. A door on a walkway can overhang the floor
        // below it — the Plant's Service doors sit at 0.74 m with the hall slab
        // 6.7 m under them — so a floor sample that lands a long way down is the
        // wrong storey and the leaf's own Y is the truth.
        const here = collision?.sampleFloor(_p.x, _p.z, _p.y + 1.2, 3.0);
        const base = here && Math.abs(here.y - _p.y) < 1.2 ? here.y : _p.y;
        // TWO PROBES A SIDE, NOT ONE. A STRIDE, NOT A THRESHOLD.
        //
        // This sampled once at 0.85 m — clear of the leaf and its frame, which
        // is what it was chosen for — so a doorway with floor for the first
        // metre and nothing after it passed the test and stayed openable. An
        // exploration bot walked through `service_door3`, took one more step and
        // fell out of the world at (380.5, -23.3, -6.1); it then respawned into
        // the void and looped there for the remaining 106 s of the session.
        // Neither `floorgaps` nor any scripted playthrough had ever been through
        // that door, because the scripted runs change zone by teleport.
        //
        // A door is passable when there is somewhere to put both feet on the
        // other side, so probe the far side at a stride as well as at the
        // threshold.
        const REACH2 = 1.9;
        const sides = [1, -1].flatMap((s) => [REACH, REACH2].map((r) => collision?.sampleFloor(
          _p.x + nx * r * s, _p.z + nz * r * s, base + 1.2, 2.0)));
        const isPortal = nearPortal(_p.x, base, _p.z);
        const passable = isPortal
          || sides.every((f) => f && Math.abs(f.y - base) < 0.45);

        if (!passable) {
          // A door standing ajar onto a room that was never built is a hole with
          // a leaf next to it: `DoorLatch` disables its collider whenever the leaf
          // is more than 0.25 rad open, so an ajar impassable door would be walked
          // straight through into the respawn net. Shut it BEFORE the latch is
          // constructed, because the latch reads `door.open` for its initial angle
          // and decides the collider's enabled state from that.
          d.open = 0;
          d.target = 0;
          d.pivot.rotation.y = 0;
        }

        const latch = new DoorLatch(obj, {
          id, bus, rig, collision,
          locked: !passable,
          label: 'the door',
          maxAngle: 1.62,
          weight: 1,
        });
        // `requires` stays null either way: a door with nothing behind it refuses
        // with "Locked. No keyway on this side.", which is the truth.
        obj.userData._latch = latch;
        interactor.addDoor(latch);
        interactor.add({
          id: `${id}_use`,
          object: obj,
          kind: 'door',
          verb: 'Open',
          label: 'the door',
          range: 1.9,
          cullRadius: 1.2,
          refusal: () => latch.refusal(this.ctx.inventory),
          onUse: () => latch.use(this.ctx.player, this.ctx.inventory),
          onRefused: () => latch.use(this.ctx.player, this.ctx.inventory),
        });
      }
    }
    this.doorCount += n;
  }

  // -- 2. props ---------------------------------------------------------------

  _props(zone, zoneId, origin) {
    const list = zone.interactables || [];
    if (!list.length) return;
    const [ox, oy, oz] = origin;
    for (const spec of list) {
      if (!spec || !spec.kind) continue;
      // `variant` rather than `kind` for a factory's own sub-type, because the
      // descriptor's `kind` already means "which factory". `hidingPlace` and
      // `annexDoor` both take one.
      const { kind, variant, unlocks, position = [0, 0, 0], ...rest } = spec;
      if (variant !== undefined) rest.variant = variant;
      // `unlocks` is how a data descriptor gets a closure: a keypad or a reader
      // names the door it releases, and the door is found by id at the moment it
      // is opened rather than at spawn time — which matters, because the reader
      // is usually declared before the leaf it controls.
      if (unlocks) {
        rest.onOpen = () => {
          const latch = this.ctx.interactor?.door(unlocks);
          if (!latch) { console.warn(`[zonegameplay] "${unlocks}" is not a door`); return; }
          latch.locked = false;
          latch.jammed = false;
          this.bus?.emit('door:unlocked', { id: unlocks });
        };
      }
      const handle = this.g.interactables.spawn(kind, {
        ...rest,
        ...(variant !== undefined && (kind === 'hide' || kind === 'hidingPlace')
          ? { kind: variant } : {}),
        position: [position[0] + ox, position[1] + oy, position[2] + oz],
        zone: zoneId,
      });
      if (handle) { handle.zone = zoneId; this.propCount++; }
    }
    // The Attendant only ever appears in a place the player has already looked
    // away from, and a locker is its best one. It has to be told which lockers
    // exist, and they only exist once this zone's props are up.
    this.g.attendant?.adopt(this.g.interactables);
  }

  // -- 3. portals -------------------------------------------------------------

  _portals(zone) {
    const prog = this.g.progression;
    if (!prog) return;
    for (const p of zone.portals || []) {
      prog.registerPortal(p, {
        locked: !!p.locked,
        reason: p.reason || '',
        group: groupFor(p),
      });
    }
  }

  // -- 4. director / attendant markers ---------------------------------------

  _markers(zone, zoneId, origin) {
    const [ox, oy, oz] = origin;
    if (zone.safe) {
      const s = zone.safe;
      this.g.director?.registerSafeRoom({
        id: s.id || `${zoneId}_safe`,
        position: [s.position[0] + ox, s.position[1] + oy, s.position[2] + oz],
        yaw: s.yaw || 0,
        zone: zoneId,
      });
    }
    for (const f of zone.attendantFloors || []) {
      this.g.attendant?.registerFloor(
        `${zoneId}_${f.id || 'floor'}`,
        [f.rect[0] + ox, f.rect[1] + oz, f.rect[2] + ox, f.rect[3] + oz],
        (f.y || 0) + oy);
    }
  }

  debugState() {
    return { zones: [...this.done], doors: this.doorCount, props: this.propCount };
  }
}

export default ZoneGameplay;
