import * as THREE from 'three';
import { clamp01 } from '../core/util.js';

/**
 * Decoy — the one verb that redirects the Surveyor instead of hiding from it.
 *
 * WHY THIS EXISTS.
 *
 * The player's action set was already richer than it looked: `cover` holds a
 * hand over the lamp (silent, where the switch clicks and the Surveyor hears
 * clicks), `crouch` and `crawl` drop the noise radius from 6 m to 2.2 and 3.4,
 * `drop` puts down the fuse core, `lean` and `peek` look round corners without
 * committing the body. And underneath all of it is the mechanic the whole
 * encounter is built on: `Surveyor._sampleLight` sums the fixed rig AND the
 * player's own lamp, and `_moveToward` freezes outright below `LIGHT_DEAD`
 * (0.30) — **the thing cannot move in the dark, and your torch is what feeds
 * it.**
 *
 * Every one of those is a way to lower your own signature. Not one of them puts
 * a signal somewhere else. So the whole encounter vocabulary was "be quieter,
 * be darker, be still", and the only outcomes available were "it finds you" and
 * "it gives up" — measured across five episodes in one session: two captures
 * and three losses, none of which the player caused.
 *
 * A thrown cell is the counter-verb. It is loud where it lands, not where you
 * are, and `Surveyor.hear` already localises `world:noise` with an error that
 * grows with distance and occlusion — so the belief it forms is genuinely
 * somewhere else, and SEEKING will walk it there.
 *
 * WHAT IT COSTS, AND WHY IT IS A CELL.
 *
 * A decoy with no cost is a win button. The cost has to be legible, has to bite
 * later rather than now, and must not need an inventory rework: a spare lantern
 * cell is a stackable consumable the player already manages (`ITEMS.battery_cell`,
 * `stack: 4`), and it is the only resource in the game that converts directly
 * into how long you can see. Spending one to move the Surveyor twelve metres is
 * a real trade against the thing you spend them on otherwise, and the game
 * already reports the battery in the HUD, so the price is visible before you
 * pay it.
 *
 * It is also the correct object physically. A 6 V lantern cell is a fist-sized
 * lump of zinc and carbon; it is exactly what somebody in this building would
 * throw.
 */
export class Decoy {
  /**
   * @param {object} opts
   * @param {import('./Player.js').Player} opts.player
   * @param {import('./Inventory.js').Inventory} opts.inventory
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {object} [opts.collision] CollisionWorld, for finding where it lands
   */
  constructor({ player, inventory, bus, collision = null }) {
    this.player = player;
    this.inventory = inventory;
    this.bus = bus;
    this.collision = collision || player?.collision || null;

    /** Seconds between throws. Long enough that it cannot be spammed into a
     *  continuous stream of false beliefs, short enough to use twice in a
     *  panic. */
    this.cooldown = 1.6;
    this._cool = 0;
    /** Metres. Beyond this a throw is not plausible and the belief it would
     *  create would be one the player could not have reasoned about. */
    this.maxRange = 14;
    /**
     * Audible radius where it lands. `Surveyor.hear` treats this as
     * `radius * 1.9 + 3` metres of reach.
     *
     * IT HAS TO BE LOUDER THAN YOU ARE. The first version used 7, which reaches
     * 16.3 m. A walking player is 6 (14.4 m) and a sprinting one is **11
     * (23.9 m)** — so the decoy was quieter than the thing it was supposed to
     * distract from, and measured in a session it did nothing at all: the cell
     * landed 34 m from the Surveyor and was inaudible while the player's own
     * sprint refreshed its belief every 0.3 s from 22 m. You cannot out-shout
     * yourself.
     *
     * 13 reached 27.7 m, which puts a thrown cell just above a sprint, and it
     * was still not enough — by one percent. `Surveyor.hear` only overwrites a
     * belief when `strength >= confidence * 0.72`, and a cell landing 8.1 m from
     * an entity that had just heard the player walk scores
     * `1 - 8.1/27.7 = 0.71` against a threshold of `1.0 * 0.72 = 0.72`. Measured,
     * in a delivered session: an unoccluded throw at a fair distance that moved
     * nothing.
     *
     * That is the wrong answer, because `nb_1` — the page the player is given in
     * the first room — promises exactly this: "It hears. Water, doors, boots,
     * anything dropped. It goes to the sound in a straight line and it commits
     * to it." A decoy that cannot take a belief from a player who was heard
     * walking thirty seconds ago is not the mechanic the fiction describes.
     *
     * 16 reaches 33.4 m, so the same throw scores 0.76 and takes it. It is also
     * still the right answer physically: a fist-sized lump of zinc dropped from
     * shoulder height onto a concrete floor in an empty building is louder than
     * boots on carpet, and it is a single sharp transient rather than a stream.
     */
    this.noiseRadius = 16;
    /** Set while the arm is swinging, so the hands rig can animate it. */
    this.throwing = 0;
    this.lastLanding = null;
    this.thrown = 0;
  }

  /** Can the player throw right now, and if not, why not. */
  refusal() {
    if (this._cool > 0) return null;                      // silent, not a refusal
    if (this.inventory?.handsFull) return 'Both hands are full.';
    if (!(this.inventory?.count?.('battery_cell') > 0)) return 'Nothing to throw.';
    return null;
  }

  canThrow() {
    return this._cool <= 0
      && !this.inventory?.handsFull
      && (this.inventory?.count?.('battery_cell') ?? 0) > 0;
  }

  /**
   * Where the cell would land: forward along the aim, stopped by whatever is in
   * the way, then dropped to the floor.
   *
   * Stepped rather than swept because the collision world is a box hash with no
   * ray query, and a 0.5 m step over 14 m is 28 probes of a spatial hash — far
   * cheaper than it looks, and it only runs on the frame of the throw.
   */
  _landingPoint() {
    const p = this.player.position;
    const yaw = this.player.yaw ?? 0;
    const pitch = clamp01((this.player.pitch ?? 0) * 0 + 0);   // aim flat; a lobbed cell is not a rifle
    // FORWARD IS `(-sin(yaw), -cos(yaw))` — see `Player.forward()`. This had the
    // signs the other way round, so every throw went over the player's own
    // shoulder, directly away from whatever they were looking at. In the first
    // instrumented session the cell landed 34 m from the Surveyor on the far
    // side of the player, which is the worst possible place for a decoy and is
    // why that run's redirect check failed. The acceptance test could not catch
    // it either: it compares the belief the Surveyor formed against the landing
    // point the Decoy itself reports, and both come from this vector, so a throw
    // aimed backwards agrees with itself perfectly.
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    const eye = p.y + 1.5;
    let hit = null;
    let dist = 0;
    for (let d = 0.5; d <= this.maxRange; d += 0.5) {
      const x = p.x + dx * d, z = p.z + dz * d;
      const res = this.collision?.resolveCapsule?.(x, p.y, z, 0.16, 0.4);
      if (res && (res.hit || Math.hypot(res.x - x, res.z - z) > 0.05)) break;
      hit = { x, z }; dist = d;
    }
    if (!hit) return null;                       // nose against a wall
    const fl = this.collision?.sampleFloor?.(hit.x, hit.z, eye, 8);
    const y = fl ? fl.y : p.y;
    void pitch;
    return { x: hit.x, y, z: hit.z, dist };
  }

  /**
   * Throw one cell. Returns the landing point, or null with a reason on the bus.
   * @returns {{x:number,y:number,z:number,dist:number}|null}
   */
  throwCell() {
    if (this._cool > 0) return null;
    const why = this.refusal();
    if (why) { this.bus?.emit('ui:refuse', { action: 'throw', reason: why }); return null; }

    const land = this._landingPoint();
    if (!land) {
      this.bus?.emit('ui:refuse', { action: 'throw', reason: 'No room to throw.' });
      return null;
    }
    // `use` on a BATTERY takes one from the stack and returns false if the slot
    // was already empty — the refusal above should have caught that, and this
    // is the belt to its braces.
    if (!this.inventory.use?.('battery_cell')) {
      this.bus?.emit('ui:refuse', { action: 'throw', reason: 'Nothing to throw.' });
      return null;
    }

    this._cool = this.cooldown;
    this.throwing = 0.35;
    this.thrown++;
    this.lastLanding = land;

    const pos = new THREE.Vector3(land.x, land.y, land.z);
    // The sound of it landing, for the mix.
    this.bus?.emit('sfx:distant', { kind: 'clatter', position: pos.clone() });
    // AND the thing that makes this a mechanic rather than a sound effect:
    // every entity that listens for a noise in the world hears it HERE.
    this.bus?.emit('world:noise', { position: pos.clone(), radius: this.noiseRadius });
    this.bus?.emit('decoy:thrown', {
      position: pos.toArray(),
      distance: +land.dist.toFixed(1),
      remaining: this.inventory.count?.('battery_cell') ?? 0,
    });
    return land;
  }

  update(dt, input) {
    this._cool = Math.max(0, this._cool - dt);
    this.throwing = Math.max(0, this.throwing - dt);
    if (!input) return;
    // `throwDecoy` is in ACTIONS; the raw code is also read so the mechanic
    // works against an older binding map, the same way Flashlight reads KeyV.
    if (input.pressed?.('throwDecoy') || input.pressedThisFrame?.has('KeyT')) {
      this.throwCell();
    }
  }

  debugState() {
    return {
      cells: this.inventory?.count?.('battery_cell') ?? 0,
      cooldown: +this._cool.toFixed(2),
      thrown: this.thrown,
      canThrow: this.canThrow(),
      lastLanding: this.lastLanding
        ? [+this.lastLanding.x.toFixed(1), +this.lastLanding.y.toFixed(1), +this.lastLanding.z.toFixed(1)]
        : null,
    };
  }
}

export default Decoy;
