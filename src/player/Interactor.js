import * as THREE from 'three';
import { clamp01, damp, lerp, smoothstep } from '../core/util.js';

/**
 * Interactor — the raycast interaction layer, and the home of door physics.
 *
 * Design constraints this satisfies:
 *
 *  * **One prompt, always honest.** The reticle either offers something or it
 *    does not. If an action is gated on an item the player does not have, the
 *    prompt still appears but reads as a *refusal with a reason* — "Locked.
 *    Needs the warden's card" — because a silent non-response is a bug report.
 *  * **Holds are physical.** A valve is not a button with a timer; the progress
 *    value is exposed so the UI, the hands and the audio can all be driven from
 *    the same number, and releasing early *unwinds* rather than resetting.
 *  * **Doors are pushed, not toggled.** A door swings away from the face that
 *    pushed it, on its real hinge, with weight. Every swing makes noise, and
 *    noise is what the Surveyor navigates by, so opening a door is a tactical
 *    act rather than a traversal formality.
 */

const MAX_RANGE = 3.2;
const _pw = new THREE.Vector3();

// ---------------------------------------------------------------------------

/**
 * DoorLatch — animation, collision and state for one `Kit.doorway()` group.
 *
 * `Kit.doorway()` gives us `grp.userData.door = {pivot, hinge, width, height}`.
 * The leaf's free edge moves toward local +Z for a positive pivot rotation when
 * `hinge === +1`, which is the only fact the swing-direction maths needs.
 */
export class DoorLatch {
  /**
   * @param {THREE.Group} grp
   * @param {object} opts
   */
  constructor(grp, {
    id = 'door', bus = null, rig = null, collision = null,
    locked = false, jammed = false, chained = false, welded = false,
    oneWay = 0,                    // 0 = both ways; ±1 = only opens toward that local-Z side
    requires = null,               // inventory id that unlocks it
    requiresTool = null,           // 'pry_bar' for jammed doors
    maxAngle = 1.78,
    label = 'Door',
    autoClose = 0,                 // seconds; 0 = stays where it is put
    weight = 1,
  } = {}) {
    this.grp = grp;
    this.id = id;
    this.bus = bus;
    this.rig = rig;
    this.collision = collision;
    this.door = grp.userData.door;
    this.locked = locked;
    this.jammed = jammed;
    this.chained = chained;
    this.welded = welded;
    this.oneWay = oneWay;
    this.requires = requires;
    this.requiresTool = requiresTool;
    this.maxAngle = maxAngle;
    this.label = label;
    this.autoClose = autoClose;
    this.weight = weight;

    this.angle = this.door?.open ?? 0;
    this.target = this.angle;
    this.vel = 0;
    this._autoT = 0;
    this._lastReported = this.angle;
    this._settled = true;

    // Collider for the leaf. `Kit.wallRun` leaves the opening walkable, so a
    // shut door needs its own box or the player walks through it.
    this._collider = null;
    if (collision && this.door) {
      grp.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      grp.getWorldPosition(p);
      const w = this.door.width, h = this.door.height;
      const rot = grp.rotation.y;
      const sx = Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * 0.06;
      const sz = Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * 0.06;
      this._collider = collision.addBoxAt(p.x, p.y + h / 2, p.z, sx, h, sz, { tag: 'door', id });
      this._collider.enabled = Math.abs(this.angle) < 0.25;
    }
  }

  get isOpen() { return Math.abs(this.angle) > 0.22; }
  get openFraction() { return clamp01(Math.abs(this.angle) / this.maxAngle); }

  /** Why this door will not open, or null. */
  refusal(inventory) {
    if (this.welded) return 'Welded shut. There is a bead all the way round.';
    if (this.chained) return 'Chained on the far side. It gives 60 mm and stops.';
    if (this.jammed) {
      if (inventory?.has(this.requiresTool || 'pry_bar')) return null;
      return 'Jammed in the frame. It needs levering.';
    }
    if (this.locked) {
      if (this.requires && inventory?.has(this.requires)) return null;
      if (!this.requires) return 'Locked. No keyway on this side.';
      const name = inventory?.def?.(this.requires)?.name || this.requires;
      return `Locked. Needs ${name}.`;
    }
    return null;
  }

  /**
   * Push the door. Returns `{ok, reason}`.
   * The swing direction is decided by which side of the leaf the player stands
   * on, so the door always opens *away* from the face being pushed.
   */
  use(player, inventory = null) {
    const reason = this.refusal(inventory);
    if (reason) {
      // Still make a sound. Rattling a locked door is a real thing to do and a
      // real mistake to make.
      this.vel += 2.2;
      player?.makeNoise?.(this.chained ? 9 : 6);
      this.bus?.emit('door:refused', { id: this.id, reason, position: this.worldPosition() });
      return { ok: false, reason };
    }
    if (this.jammed && inventory?.has(this.requiresTool || 'pry_bar')) {
      this.jammed = false;
      this.bus?.emit('door:pried', { id: this.id, position: this.worldPosition() });
      player?.makeNoise?.(16);           // a pry bar in a steel frame is enormous
      player?.kick?.(0.05, 0, 0.03, -0.05);
    }
    if (this.locked) this.locked = false;   // unlocked for good once opened

    if (this.isOpen) {
      this.target = 0;
      this.vel -= Math.sign(this.angle) * 2.4 * this.weight;
      player?.makeNoise?.(5);
      this._emit('closing');
      return { ok: true, reason: null };
    }

    // Which local-Z side is the player on?
    this.grp.updateMatrixWorld(true);
    const doorPos = this.worldPosition();
    const rot = this.grp.rotation.y;
    const localZx = Math.sin(rot), localZz = Math.cos(rot);
    const px = (player?.position.x ?? 0) - doorPos.x;
    const pz = (player?.position.z ?? 0) - doorPos.z;
    let side = Math.sign(px * localZx + pz * localZz) || 1;

    // A one-way door refuses from the wrong side, loudly.
    if (this.oneWay && side === this.oneWay) {
      this.vel += 2.0;
      player?.makeNoise?.(6);
      this.bus?.emit('door:refused', {
        id: this.id, reason: 'No handle this side.', position: doorPos,
      });
      return { ok: false, reason: 'No handle this side.' };
    }

    const hinge = this.door?.hinge ?? 1;
    this.target = -side * hinge * this.maxAngle;
    this.vel += -side * hinge * 3.6 / this.weight;
    this._autoT = this.autoClose;
    player?.makeNoise?.(7);
    this._emit('opening');
    return { ok: true, reason: null };
  }

  worldPosition(out = new THREE.Vector3()) {
    this.grp.getWorldPosition(out);
    return out;
  }

  update(dt) {
    if (!this.door) return;
    // Second-order swing with a stiff end-stop: a door does not ease into its
    // frame, it arrives and bangs.
    const k = 26 / this.weight, c = 2 * Math.sqrt(26 / this.weight) * 0.78;
    this.vel += ((this.target - this.angle) * k - this.vel * c) * dt;
    let a = this.angle + this.vel * dt;

    const lim = this.maxAngle;
    if (a > lim) { a = lim; this.vel *= -0.18; }
    if (a < -lim) { a = -lim; this.vel *= -0.18; }
    if (this.chained) a = clamp01(Math.abs(a) / 0.18) * 0.18 * Math.sign(a || 1);

    // Slam: crossing zero with speed makes a bang and a noise event.
    if (Math.sign(a) !== Math.sign(this.angle) && Math.abs(this.vel) > 1.2 && Math.abs(this.target) < 0.05) {
      a = 0; this.vel *= -0.12;
      this.bus?.emit('door:slam', { id: this.id, position: this.worldPosition(), force: 1 });
      this.bus?.emit('player:noise', { position: this.worldPosition(), radius: 12 });
    }
    this.angle = a;
    this.door.pivot.rotation.y = a;
    this.door.open = a;

    if (this.autoClose > 0 && this._autoT > 0) {
      this._autoT -= dt;
      if (this._autoT <= 0) { this.target = 0; this._emit('closing'); }
    }

    // Collider + shadows only change on a real state transition.
    const shouldBlock = Math.abs(a) < 0.25;
    if (this._collider && this._collider.enabled !== shouldBlock) {
      this._collider.enabled = shouldBlock;
    }
    if (Math.abs(a - this._lastReported) > 0.09) {
      this._lastReported = a;
      this.rig?.invalidateShadows();
      this._settled = false;
    } else if (!this._settled && Math.abs(this.vel) < 0.05) {
      this._settled = true;
      this._emit(this.isOpen ? 'open' : 'closed');
      this.rig?.invalidateShadows();
    }
  }

  _emit(state) {
    this.bus?.emit('door:state', {
      id: this.id, state, angle: this.angle,
      open: this.isOpen, position: this.worldPosition(),
    });
  }

  /** Force a state without a push — used by the Attendant and cinematics. */
  setOpen(fraction, { silent = false } = {}) {
    const hinge = this.door?.hinge ?? 1;
    this.target = hinge * this.maxAngle * clamp01(fraction);
    if (!silent) this._emit(fraction > 0.2 ? 'opening' : 'closing');
  }
}

// ---------------------------------------------------------------------------

/**
 * An interactable, as seen by this system. Zone builders produce the shape
 * described in DESIGN.md §5; everything else is filled in here.
 *
 * @typedef {{
 *   id: string, object: THREE.Object3D, label: string, verb: string,
 *   range?: number, enabled?: boolean, requires?: string|string[],
 *   hold?: number, refusal?: (inv, player) => (string|null),
 *   onFocus?: Function, onBlur?: Function, onUse?: Function,
 *   onHold?: (t:number, dt:number) => void, onRelease?: Function,
 *   kind?: string, once?: boolean, priority?: number,
 * }} Interactable
 */

export class Interactor {
  /**
   * @param {object} opts
   * @param {THREE.Camera} opts.camera
   * @param {import('./Player.js').Player} opts.player
   * @param {import('./Inventory.js').Inventory} opts.inventory
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {import('../render/Lighting.js').LightRig} [opts.rig]
   * @param {import('./Hands.js').Hands} [opts.hands]
   */
  constructor({ camera, player, inventory, bus, rig = null, hands = null, game = null }) {
    this.camera = camera;
    this.player = player;
    this.inventory = inventory;
    this.bus = bus;
    this.rig = rig;
    this.hands = hands;
    this.game = game;

    /** @type {Interactable[]} */
    this.items = [];
    /** @type {DoorLatch[]} */
    this.doors = [];
    this._byObject = new Map();

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_RANGE;
    this.raycaster.near = 0.02;

    /**
     * The prompt contract the UI renders. Stable object — never reallocated, so
     * the UI can hold a reference.
     */
    this.focus = {
      target: null,       // the Interactable
      id: null,
      label: '',
      verb: '',
      blocked: false,
      reason: null,
      progress: 0,        // 0..1 for hold actions
      hold: 0,            // total hold seconds, 0 = instant
      distance: 0,
    };

    this.enabled = true;
    this._holding = false;
    this._holdT = 0;
    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._hits = [];
  }

  // -- registry ----------------------------------------------------------------

  /** @param {Interactable} item */
  add(item) {
    if (!item || !item.object) return null;
    item.range = item.range ?? 2.2;
    item.enabled = item.enabled !== false;
    item.hold = item.hold ?? 0;
    item.priority = item.priority ?? 0;
    item.object.userData.interactable = item;
    this.items.push(item);
    this._byObject.set(item.object, item);
    return item;
  }

  addAll(list) { for (const i of list || []) this.add(i); return this; }

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    this._byObject.delete(item.object);
    if (item.object) delete item.object.userData.interactable;
    if (this.focus.target === item) this._clearFocus();
  }

  removeById(id) {
    const it = this.items.find((x) => x.id === id);
    if (it) this.remove(it);
    return !!it;
  }

  get(id) { return this.items.find((x) => x.id === id) || null; }

  /** @param {DoorLatch} latch */
  addDoor(latch) { this.doors.push(latch); return latch; }
  door(id) { return this.doors.find((d) => d.id === id) || null; }

  clear() {
    for (const it of this.items) if (it.object) delete it.object.userData.interactable;
    this.items.length = 0;
    this.doors.length = 0;
    this._byObject.clear();
    this._clearFocus();
  }

  // -- gating ------------------------------------------------------------------

  /** Resolve `requires` plus any custom refusal into a message, or null. */
  _refusalFor(item) {
    if (item.enabled === false) return item.disabledReason || 'It will not move.';
    if (item.requires) {
      const list = Array.isArray(item.requires) ? item.requires : [item.requires];
      for (const id of list) {
        if (!this.inventory?.has(id)) {
          const name = this.inventory?.def?.(id)?.name || id.replace(/_/g, ' ');
          return item.requiresMessage || `Needs ${name}.`;
        }
      }
    }
    if (item.refusal) {
      const r = item.refusal(this.inventory, this.player);
      if (r) return r;
    }
    // A fuse core in both hands means you literally cannot do most things.
    if (this.inventory?.handsFull && item.kind !== 'socket' && item.kind !== 'door' && item.kind !== 'hide') {
      return 'Both hands are full.';
    }
    return null;
  }

  // -- per frame ---------------------------------------------------------------

  update(dt, input) {
    for (const d of this.doors) d.update(dt);
    if (!this.enabled) { this._clearFocus(); return; }

    const found = this._pick();
    const prev = this.focus.target;

    if (found !== prev) {
      if (prev) { try { prev.onBlur?.(this.player); } catch (e) { console.error(e); } }
      this._holding = false;
      this._holdT = 0;
      if (found) { try { found.onFocus?.(this.player); } catch (e) { console.error(e); } }
    }

    if (!found) { this._clearFocus(); this.hands?.setReaching(false); return; }

    const reason = this._refusalFor(found);
    this.focus.target = found;
    this.focus.id = found.id;
    this.focus.verb = found.verb || 'Use';
    this.focus.label = found.label || '';
    this.focus.blocked = !!reason;
    this.focus.reason = reason;
    this.focus.hold = found.hold || 0;

    // ---- input ---------------------------------------------------------------
    const down = !!input?.down?.('interact');
    const pressed = !!input?.pressed?.('interact');

    if (reason) {
      if (pressed) {
        this.bus?.emit('ui:refuse', { id: found.id, reason });
        this.hands?.pulse(0.3);
        found.onRefused?.(this.player, reason);
      }
      this.focus.progress = 0;
      this.hands?.setReaching(false);
      return;
    }

    if (found.hold > 0) {
      if (down) {
        this._holding = true;
        this._holdT = Math.min(found.hold, this._holdT + dt);
        this.hands?.setReaching(true, true);
        try { found.onHold?.(this._holdT / found.hold, dt); } catch (e) { console.error(e); }
        if (this._holdT >= found.hold) {
          this._holdT = 0;
          this._holding = false;
          this._fire(found);
        }
      } else if (this._holdT > 0) {
        // Unwind rather than snap to zero — a valve you let go of spins back.
        this._holdT = Math.max(0, this._holdT - dt * 1.6);
        try { found.onHold?.(this._holdT / found.hold, -dt); } catch (e) { console.error(e); }
        this.hands?.setReaching(false);
      } else {
        this.hands?.setReaching(false);
      }
      this.focus.progress = found.hold > 0 ? this._holdT / found.hold : 0;
    } else {
      this.focus.progress = 0;
      this.hands?.setReaching(down, false);
      if (pressed) this._fire(found);
    }
  }

  _fire(item) {
    this.hands?.pulse(item.kind === 'pickup' ? 0.55 : 0.4);
    try {
      item.onUse?.(this.player, this.game, this);
    } catch (e) { console.error(`[interact:${item.id}]`, e); }
    this.bus?.emit('interact:use', { id: item.id, kind: item.kind, label: item.label });
    if (item.once) this.remove(item);
  }

  /** Nearest interactable under the reticle, respecting each item's own range. */
  _pick() {
    const cam = this.camera;
    cam.getWorldDirection(this._dir);
    this._origin.copy(cam.position);
    this.raycaster.set(this._origin, this._dir);

    // Cheap distance pre-filter. three's raycaster culls by bounding sphere
    // against the *infinite* ray, not against `far`, so without this every
    // merged machine in the zone gets a full triangle test whenever the player
    // happens to be looking down a corridor at it.
    const roots = [];
    for (const it of this.items) {
      if (it.enabled === false && it.hideWhenDisabled) continue;
      if (!it.object.visible) continue;
      it.object.getWorldPosition(_pw);
      const reach = (it.range ?? 2.2) + (it.cullRadius ?? 3.0);
      if (_pw.distanceToSquared(this._origin) > reach * reach) continue;
      roots.push(it.object);
    }
    if (!roots.length) return null;

    this._hits.length = 0;
    const hits = this.raycaster.intersectObjects(roots, true, this._hits);
    for (const h of hits) {
      let o = h.object;
      let item = null;
      while (o && !item) { item = this._byObject.get(o) || o.userData?.interactable || null; o = o.parent; }
      if (!item) continue;
      if (h.distance > (item.range ?? 2.2)) continue;
      this.focus.distance = h.distance;
      return item;
    }
    return null;
  }

  _clearFocus() {
    const f = this.focus;
    if (f.target) { try { f.target.onBlur?.(this.player); } catch (e) { console.error(e); } }
    f.target = null; f.id = null; f.label = ''; f.verb = '';
    f.blocked = false; f.reason = null; f.progress = 0; f.hold = 0; f.distance = 0;
  }

  /** Convenience for the UI: a single line, already resolved. */
  prompt() {
    const f = this.focus;
    if (!f.target) return null;
    return {
      text: f.blocked ? f.reason : `${f.verb} ${f.label}`.trim(),
      blocked: f.blocked,
      progress: f.progress,
      hold: f.hold > 0,
      key: 'E',
    };
  }

  debugState() {
    return {
      focus: this.focus.id, blocked: this.focus.blocked, reason: this.focus.reason,
      progress: +this.focus.progress.toFixed(2),
      items: this.items.length, doors: this.doors.length,
    };
  }
}

export default Interactor;
