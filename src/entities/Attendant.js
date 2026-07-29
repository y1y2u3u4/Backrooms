import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, makeRng, TAU } from '../core/util.js';
import { box, merge, worldUV, whiteColors } from '../render/geo.js';
import { textTexture, updateTextTexture } from '../systems/Interactables.js';

/**
 * THE ATTENDANT.
 *
 * The second presence. It has no model and it never will. It is a *director of
 * evidence*: a system whose entire output is small differences in rooms the
 * player is not currently looking at.
 *
 * The rules are absolute, because breaking any one of them turns it from a
 * presence into a jump-scare generator:
 *
 *  1. **It never acts inside the view frustum.** Every candidate is tested
 *     against the camera's frustum with a generous margin, and against a
 *     minimum distance, before anything is touched. If the player might catch
 *     the motion, the act is cancelled, not delayed-and-forced.
 *  2. **It never repeats.** Each trick has its own long cooldown and the same
 *     trick is never played twice inside `repeatInterval`. Once the player can
 *     predict it, it is worse than nothing.
 *  3. **Subtle beats loud, always.** A chair turned to face a door is the top
 *     of the range. There is no trick in here that makes a noise the player is
 *     meant to hear happen.
 *  4. **It leaves the evidence in place.** Nothing it does ever reverts. A
 *     locker that closed stays closed. The player must be able to go back and
 *     confirm they were not imagining it, because being able to confirm it is
 *     what makes it land.
 *
 * The Director decides *when*; this class decides *whether it is allowed* and
 * *what*.
 */

export class Attendant {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {THREE.Camera} opts.camera
   * @param {import('../player/Player.js').Player} opts.player
   * @param {import('../player/Physics.js').CollisionWorld} opts.collision
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {object} [opts.palette]
   */
  constructor({ scene, camera, player, collision, bus, palette = null, seed = 0xa77e2d }) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.collision = collision;
    this.bus = bus;
    this.palette = palette;
    this.rng = makeRng(seed);

    /** @type {Array<{id:string,kind:string,object:THREE.Object3D,data:object,used:boolean}>} */
    this.targets = [];
    this.minDistance = 9.0;      // never act closer than this
    this.maxDistance = 42.0;     // or further than this (nobody will find it)
    this.frustumMargin = 1.6;    // metres of slop around the view volume
    this.repeatInterval = 260;   // seconds before a trick kind may recur
    this.globalCooldown = 0;
    this.minGap = 55;            // seconds between any two acts

    this.history = [];           // {kind, t, position}
    this.time = 0;
    this.actCount = 0;
    this.enabled = true;

    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._sphere = new THREE.Sphere(new THREE.Vector3(), 1);

    this.footprintRoot = new THREE.Group();
    this.footprintRoot.name = 'attendant:evidence';
    scene.add(this.footprintRoot);
    this._bootTex = null;
  }

  // -- registration -------------------------------------------------------------

  /**
   * Offer the Attendant something it may quietly alter.
   * @param {{id:string, kind:string, object:THREE.Object3D, data?:object}} entry
   *   kind: 'chair' | 'locker' | 'radio' | 'whiteboard' | 'door' | 'prop'
   */
  register(entry) {
    if (!entry?.object) return null;
    const e = { used: false, data: {}, ...entry };
    this.targets.push(e);
    return e;
  }

  /** Convenience: adopt everything an Interactables registry has built. */
  adopt(interactables) {
    for (const p of interactables?.props || []) {
      if (!p.root) continue;
      if (p.id?.startsWith('locker') || p.root.name?.startsWith('hide:')) {
        this.register({ id: p.id, kind: 'locker', object: p.root, data: { handle: p } });
      }
    }
    return this;
  }

  /** Register a floor rectangle the Attendant may put footprints on. */
  registerFloor(id, rect, y = 0) {
    this.targets.push({ id, kind: 'floor', object: null, data: { rect, y }, used: false });
  }

  // -- visibility gate ------------------------------------------------------------

  _refreshFrustum() {
    this.camera.updateMatrixWorld();
    this._m.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._m);
  }

  /**
   * True only if this point is safely out of sight *and* out of reach.
   * The margin is deliberately generous: a chair that turns at the very edge of
   * the frame is a bug the player will never forgive.
   */
  isSafe(position, radius = 1.0) {
    const d = this.player.position.distanceTo(position);
    if (d < this.minDistance || d > this.maxDistance) return false;
    this._sphere.center.copy(position);
    this._sphere.radius = radius + this.frustumMargin;
    if (this._frustum.intersectsSphere(this._sphere)) return false;
    // Behind a wall is even better, but not required — round a corner is fine.
    return true;
  }

  _canPlay(kind) {
    if (this.globalCooldown > 0) return false;
    for (const h of this.history) {
      if (h.kind === kind && this.time - h.t < this.repeatInterval) return false;
    }
    return true;
  }

  _record(kind, position) {
    this.history.push({ kind, t: this.time, position: position?.clone?.() ?? null });
    if (this.history.length > 40) this.history.shift();
    this.globalCooldown = this.minGap;
    this.actCount++;
    this.bus?.emit('attendant:act', { kind, position: position?.clone?.() ?? null, index: this.actCount });
  }

  // -- the tricks -------------------------------------------------------------------

  /**
   * Try to do exactly one thing. Returns the kind played, or null.
   * The Director calls this; it is never automatic unless `autonomous` is set.
   */
  act(preferred = null) {
    if (!this.enabled) return null;
    this._refreshFrustum();

    const order = preferred ? [preferred] : this.rng.shuffle([
      'chair', 'locker', 'footprints', 'radio', 'whiteboard', 'door', 'prop',
    ]);
    for (const kind of order) {
      if (!this._canPlay(kind)) continue;
      const fn = this[`_do_${kind}`];
      if (!fn) continue;
      const res = fn.call(this);
      if (res) { this._record(kind, res); return kind; }
    }
    return null;
  }

  _pick(kind) {
    const cands = this.targets.filter((t) => t.kind === kind && !t.used);
    this.rng.shuffle(cands);
    for (const c of cands) {
      const p = c.object ? c.object.getWorldPosition(new THREE.Vector3()) : this._floorCentre(c);
      if (!p) continue;
      if (!this.isSafe(p, 1.2)) continue;
      return { entry: c, position: p };
    }
    return null;
  }

  _floorCentre(entry) {
    const r = entry.data?.rect;
    if (!r) return null;
    return new THREE.Vector3((r[0] + r[2]) / 2, entry.data.y || 0, (r[1] + r[3]) / 2);
  }

  /** A chair, turned to face the door the player is about to come through. */
  _do_chair() {
    const hit = this._pick('chair');
    if (!hit) return null;
    const { entry, position } = hit;
    // Face the nearest registered door, or failing that the way the player
    // will arrive from.
    let facing = null;
    let best = 1e9;
    for (const t of this.targets) {
      if (t.kind !== 'door' && t.kind !== 'doorway') continue;
      const p = t.object.getWorldPosition(new THREE.Vector3());
      const d = p.distanceTo(position);
      if (d < best) { best = d; facing = p; }
    }
    if (!facing) facing = this.player.position.clone();
    const yaw = Math.atan2(facing.x - position.x, facing.z - position.z);
    entry.object.rotation.y = yaw;
    // And pulled out from the desk, very slightly, as if someone had just left.
    entry.object.position.x += Math.sin(yaw) * 0.18;
    entry.object.position.z += Math.cos(yaw) * 0.18;
    entry.used = true;
    return position;
  }

  /** A locker that was open is now shut. Nothing else in the room changed. */
  _do_locker() {
    const hit = this._pick('locker');
    if (!hit) return null;
    const { entry, position } = hit;
    const handle = entry.data?.handle;
    if (handle?.api?.setPeek) handle.api.setPeek(0);
    const st = handle?.state?.();
    if (st && st.inside) return null;      // never while the player is in it
    if (handle) { handle.api?.setPeek?.(0); }
    // Drive the door group directly if we have one.
    const pivot = entry.object.children.find((c) => c.type === 'Group');
    if (pivot) pivot.rotation.y = 0;
    if (handle) { handle.state && (handle.root.userData.attendantShut = true); }
    entry.used = true;
    return position;
  }

  /**
   * Wet footprints that start in the middle of the room.
   *
   * The first print has no print before it. That is the whole trick: not that
   * something walked through, but that it started existing four metres from
   * the door and then walked.
   */
  _do_footprints() {
    const hit = this._pick('floor');
    if (!hit) return null;
    const { entry, position } = hit;
    const rect = entry.data.rect;
    const y = entry.data.y || 0;

    // Start well inside the room, walk toward the nearest edge.
    const cx = lerp(rect[0], rect[2], this.rng.range(0.35, 0.65));
    const cz = lerp(rect[1], rect[3], this.rng.range(0.35, 0.65));
    const start = new THREE.Vector3(cx, y, cz);
    if (!this.isSafe(start, 2.0)) return null;

    const edges = [
      new THREE.Vector3(rect[0], y, cz), new THREE.Vector3(rect[2], y, cz),
      new THREE.Vector3(cx, y, rect[1]), new THREE.Vector3(cx, y, rect[3]),
    ];
    edges.sort((a, b) => a.distanceTo(start) - b.distanceTo(start));
    const end = edges[0];
    const dir = end.clone().sub(start).setY(0).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const dist = start.distanceTo(end);
    const n = clamp(Math.floor(dist / 0.62), 4, 12);

    if (!this._bootTex) this._bootTex = makeBootTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: this._bootTex, transparent: true, opacity: 0.0,
      depthWrite: false, color: 0x2a2b2c, blending: THREE.NormalBlending, fog: true,
    });

    const grp = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const side = i % 2 ? 1 : -1;
      const p = start.clone().addScaledVector(dir, i * 0.62).addScaledVector(perp, side * 0.10);
      const g = new THREE.PlaneGeometry(0.16, 0.31);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.copy(p);
      m.position.y = y + 0.004 + i * 0.0002;   // no z-fighting between prints
      m.rotation.y = Math.atan2(dir.x, dir.z) + this.rng.range(-0.12, 0.12);
      // They dry out as they go. The last two are barely there.
      m.userData.fade = lerp(1, 0.18, t);
      m.renderOrder = 2;
      grp.add(m);
    }
    grp.userData.fadeIn = 0;
    this.footprintRoot.add(grp);
    entry.used = true;
    this.bus?.emit('story:evidence', { kind: 'footprints', position: start.clone() });
    return start;
  }

  /** A radio, on, somewhere behind you. Quiet — the audio agent decides how. */
  _do_radio() {
    const hit = this._pick('radio');
    if (!hit) return null;
    const { entry, position } = hit;
    entry.used = true;
    entry.data.on = true;
    // A tiny dial lamp, if the prop has one.
    const lamp = entry.object.getObjectByName?.('dial');
    if (lamp?.material) lamp.material.color?.set(0xd8a24a);
    this.bus?.emit('attendant:radio', { id: entry.id, position: position.clone(), on: true });
    return position;
  }

  /** Something written on a whiteboard that was blank. */
  _do_whiteboard() {
    const hit = this._pick('whiteboard');
    if (!hit) return null;
    const { entry, position } = hit;
    const mesh = entry.object.getObjectByName?.('surface') || entry.object;
    const lines = this.rng.pick([
      ['ROUND 3', 'SPINE SOUTH — 14 DOORS', 'SPINE SOUTH — 14 DOORS', 'SPINE SOUTH — 15 DOORS'],
      ['SIGN IN', 'SIGN OUT', '', '41 / 40'],
      ['DO NOT PROP DOORS'],
      ['THANK YOU FOR', 'YOUR ATTENDANCE'],
      ['TUESDAYS INSTEAD'],
      ['E.M. 1971'],
    ]);
    const tex = mesh.material?.map?.userData?.canvas
      ? updateTextTexture(mesh.material.map, lines, {
        bg: '#e8e7e0', fg: '#2c3f6a', lineHeight: 46, pad: 26,
        font: '500 38px "Comic Sans MS", "Segoe Print", cursive',
      })
      : textTexture(lines, {
        w: 512, h: 256, bg: '#e8e7e0', fg: '#2c3f6a', lineHeight: 46, pad: 26,
        font: '500 38px "Comic Sans MS", "Segoe Print", cursive',
      });
    if (mesh.material) { mesh.material.map = tex; mesh.material.needsUpdate = true; }
    entry.used = true;
    this.bus?.emit('story:evidence', { kind: 'whiteboard', position: position.clone(), lines });
    return position;
  }

  /** A door that was shut is standing 200 mm open. No sound was made. */
  _do_door() {
    const hit = this._pick('door');
    if (!hit) return null;
    const { entry, position } = hit;
    const latch = entry.data?.latch;
    if (!latch || latch.welded || latch.locked) return null;
    if (latch.isOpen) latch.setOpen(0, { silent: true });
    else latch.setOpen(0.14, { silent: true });
    latch.angle = latch.target;               // no swing — it is simply like that now
    latch.vel = 0;
    if (latch.door) latch.door.pivot.rotation.y = latch.angle;
    entry.used = true;
    return position;
  }

  /** A prop that has moved half a metre and is now facing the wrong way. */
  _do_prop() {
    const hit = this._pick('prop');
    if (!hit) return null;
    const { entry, position } = hit;
    entry.object.rotation.y += this.rng.range(1.2, 2.6) * this.rng.sign();
    entry.object.position.x += this.rng.range(-0.5, 0.5);
    entry.object.position.z += this.rng.range(-0.5, 0.5);
    entry.used = true;
    return position;
  }

  // -- per frame ---------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    if (this.globalCooldown > 0) this.globalCooldown -= dt;

    // Footprints soak in over a few seconds rather than popping into being —
    // if the player turns round at the wrong moment they see nothing appear.
    for (const grp of this.footprintRoot.children) {
      if (grp.userData.fadeIn >= 1) continue;
      grp.userData.fadeIn = clamp01(grp.userData.fadeIn + dt * 0.55);
      for (const m of grp.children) {
        m.material.opacity = grp.userData.fadeIn * (m.userData.fade ?? 1) * 0.62;
      }
    }
  }

  /** Wipe everything — used by the Director on respawn to re-seed the world. */
  reset({ keepHistory = true } = {}) {
    for (const t of this.targets) t.used = false;
    if (!keepHistory) this.history.length = 0;
    for (const g of [...this.footprintRoot.children]) this.footprintRoot.remove(g);
  }

  debugState() {
    return {
      entity: 'attendant',
      acts: this.actCount,
      cooldown: +Math.max(0, this.globalCooldown).toFixed(1),
      targets: this.targets.length,
      unused: this.targets.filter((t) => !t.used).length,
      last: this.history.slice(-3).map((h) => h.kind),
    };
  }
}

/** A wet boot sole: a heel, a waist and a tread block, with soft edges. */
function makeBootTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 128);
  g.fillStyle = '#ffffff';
  const blob = (x, y, w, h) => {
    g.beginPath();
    g.ellipse(x, y, w / 2, h / 2, 0, 0, TAU);
    g.fill();
  };
  blob(32, 34, 40, 52);      // ball of the foot
  blob(32, 100, 30, 34);     // heel
  g.fillRect(24, 56, 16, 30); // waist
  // Tread: a few horizontal bars knocked out of the sole.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) g.fillRect(10, 18 + i * 10, 44, 3);
  g.fillRect(16, 92, 32, 3);
  g.fillRect(16, 104, 32, 3);
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export default Attendant;
