import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, smoothstep, makeRng, wobble } from '../core/util.js';
import { box, cyl, merge, lathe, worldUV, vertexShade, whiteColors } from '../render/geo.js';

/**
 * Flashlight — the inspection lamp.
 *
 * This is the most important object the player owns and the most dangerous. The
 * Surveyor moves in light, so the lamp is simultaneously the only way to see
 * and the only way to feed it. Every property here exists to make that trade
 * legible in the hand:
 *
 *  * **It lags.** The beam is held in a fist at hip-to-chest height, not welded
 *    to the eye. Whip the camera round and the light arrives a beat later. That
 *    beat is where the game lives — you look somewhere before you light it.
 *  * **It browns out before it dies.** Battery decay is not a linear dimmer: the
 *    colour drops toward orange, the cone narrows a little as the filament
 *    fails, and restrike flicker starts long before the light actually goes.
 *    The player should get scared of the *colour*, not of a number.
 *  * **It can be covered, not just switched.** The switch clicks. The Surveyor
 *    hears clicks. Covering the lens with a palm kills the light in silence and
 *    is the correct answer under pressure; switching off is the panic answer
 *    and it costs you a noise event.
 *
 * The light itself lives in the world scene. The lamp *body* is built here but
 * handed to `Hands` for rendering in the overlay scene, so the two can never
 * disagree about the battery state.
 */

const RANGE = 15.0;
const ANGLE_OUTER = 0.50;      // radians, half-angle
const ANGLE_INNER = 0.26;
/** Tuned so a surface 4 m down the beam reads comparably to a live troffer. */
const ILLUM_GAIN = 8.2;

export class Flashlight {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene     world scene (the light lives here)
   * @param {THREE.Camera} opts.camera
   * @param {import('./Player.js').Player} opts.player
   * @param {import('./Inventory.js').Inventory} opts.inventory
   * @param {import('./Physics.js').CollisionWorld} opts.collision
   * @param {import('../core/util.js').Bus} opts.bus
   */
  constructor({ scene, camera, player, inventory, collision, bus, castShadow = false }) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.inventory = inventory;
    this.collision = collision;
    this.bus = bus;
    this.rng = makeRng(0x1a3b);

    // ---- state ----
    this.isOn = true;
    this.battery = 1.0;          // 0..1 charge in the fitted cell
    this.beamStrength = 0;       // 0..1 actual output this frame, post-flicker
    this.covered = 0;            // 0..1 how much the palm is over the lens
    this.enabled = true;         // false while the lamp is stowed (both hands full)
    this.drainRate = 1 / 420;    // full cell ≈ 7 minutes of continuous burn
    this.swapping = 0;           // seconds remaining in a cell swap

    this._health = 1;            // brown-out multiplier
    this._flick = 1;
    this._restrikeT = this.rng.range(4, 20);
    this._restrikeLen = 0;
    this._toggleCooldown = 0;

    // ---- light ----
    this.light = new THREE.SpotLight(0xffe9c4, 0, RANGE, ANGLE_OUTER, 0.55, 1.7);
    this.light.castShadow = castShadow;
    this.light.shadow.bias = -0.0018;
    this.light.shadow.normalBias = 0.03;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.camera.near = 0.15;
    this.light.shadow.camera.far = RANGE;
    this.target = new THREE.Object3D();
    this.light.target = this.target;
    scene.add(this.light, this.target);

    // A very short, very dim fill at the lens so the player's own hands and the
    // first metre of floor are not black. Real torches spill.
    this.spill = new THREE.PointLight(0xffdcae, 0, 2.1, 2);
    scene.add(this.spill);

    // ---- aim ----
    this.origin = new THREE.Vector3();
    this.aim = new THREE.Vector3(0, 0, -1);
    this._camFwd = new THREE.Vector3();
    this._wristVel = new THREE.Vector2();  // yaw/pitch lag springs
    this._wrist = new THREE.Vector2();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();

    /** Lamp body for the overlay scene; `Hands` parents this into a hand. */
    this.model = this._buildBody();
    this.lens = this.model.userData.lens;
    this.usingGlbBody = false;
  }

  // -- asset ------------------------------------------------------------------

  /**
   * Swap the procedural body for the Blender hero asset if it exists.
   * Safe to call with `assets === null`, or when the GLB is absent.
   */
  async loadModel(assets) {
    if (!assets) return false;
    const proto = await assets.load('handheld_lamp');
    if (!proto) return false;
    const inst = assets.instance('handheld_lamp') || proto.clone(true);
    // Blender exports at real scale; normalise to a ~220 mm inspection lamp so
    // the viewmodel framing does not depend on the export's unit setup.
    const size = new THREE.Box3().setFromObject(inst).getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (longest > 0.02) inst.scale.setScalar(0.22 / longest);

    // Whatever the export called the glowing part.
    let lens = null;
    inst.traverse((o) => {
      if (!lens && /lens|glass|emissive|bulb|filament/i.test(o.name)) lens = o;
      if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; }
    });
    if (lens) {
      lens.material = new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false, toneMapped: true });
      lens.material.userData.baseColor = new THREE.Color(0xfff0d0);
    }
    const old = this.model;
    const parent = old.parent;
    this.model = inst;
    this.lens = lens;
    this.usingGlbBody = true;
    if (parent) { parent.remove(old); parent.add(inst); }
    return true;
  }

  /**
   * Procedural lamp: a rubber-armoured Meridian inspection lamp. Built out of
   * a lathe for the reflector bowl, a chamfered barrel with real grip ribs, a
   * moulded switch boss and a hooked hanger loop, because a torch that is a
   * cylinder reads as a prop from 1998.
   */
  _buildBody() {
    const g = new THREE.Group();
    g.name = 'lamp';

    // Barrel with grip ribs.
    const parts = [];
    const barrel = cyl(0.031, 0.034, 0.185, 14);
    barrel.rotateX(Math.PI / 2);
    barrel.translate(0, 0, 0.02);
    parts.push(barrel);
    for (let i = 0; i < 7; i++) {
      const r = cyl(0.0355, 0.0355, 0.0075, 14);
      r.rotateX(Math.PI / 2);
      r.translate(0, 0, -0.045 + i * 0.019);
      parts.push(r);
    }
    // Tail cap with a lanyard eye.
    const cap = cyl(0.030, 0.026, 0.022, 14);
    cap.rotateX(Math.PI / 2);
    cap.translate(0, 0, 0.122);
    parts.push(cap);
    const eye = new THREE.TorusGeometry(0.011, 0.0035, 5, 10);
    eye.rotateY(Math.PI / 2);
    eye.translate(0, 0, 0.140);
    parts.push(eye);

    const bodyGeo = merge(parts);
    worldUV(bodyGeo, 0.22);
    vertexShade(bodyGeo, (x, y) => 0.68 + clamp01((y + 0.04) / 0.08) * 0.22);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2c, roughness: 0.78, metalness: 0.12, vertexColors: true,
    });
    g.add(new THREE.Mesh(bodyGeo, bodyMat));

    // Head: a bezel ring plus a lathed reflector bowl.
    const headParts = [];
    const bezel = lathe([
      [0.036, 0], [0.052, 0.004], [0.056, 0.016], [0.054, 0.026], [0.040, 0.030], [0.036, 0.028],
    ], 18);
    bezel.rotateX(-Math.PI / 2);
    bezel.translate(0, 0, -0.098);
    headParts.push(bezel);
    const collar = cyl(0.040, 0.034, 0.030, 16);
    collar.rotateX(Math.PI / 2);
    collar.translate(0, 0, -0.082);
    headParts.push(collar);
    const headGeo = merge(headParts);
    worldUV(headGeo, 0.2);
    whiteColors(headGeo);
    // Deliberately not shiny. A polished bezel 400 mm from the eye, lit by its
    // own bulb, is a white hole in the middle of every frame.
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x6a675f, roughness: 0.62, metalness: 0.55, vertexColors: true,
    });
    g.add(new THREE.Mesh(headGeo, headMat));

    // Reflector + lens. The lens is the piece that reports battery state.
    const refl = lathe([[0.004, 0], [0.016, 0.010], [0.028, 0.020], [0.036, 0.026]], 16);
    refl.rotateX(-Math.PI / 2);
    refl.translate(0, 0, -0.096);
    const reflMesh = new THREE.Mesh(refl, new THREE.MeshStandardMaterial({
      color: 0xb8b4aa, roughness: 0.34, metalness: 0.9,
    }));
    g.add(reflMesh);

    const lensGeo = new THREE.CircleGeometry(0.037, 18);
    lensGeo.rotateY(Math.PI);
    lensGeo.translate(0, 0, -0.1005);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false, toneMapped: true });
    lensMat.userData.baseColor = new THREE.Color(0xfff0d0);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    g.add(lens);

    // Switch boss — a rubber slide with a raised nib, on the top of the barrel.
    const sw = box(0.019, 0.011, 0.034, 0.003, 1);
    sw.translate(0, 0.033, -0.012);
    const nib = box(0.011, 0.006, 0.010, 0.002, 1);
    nib.translate(0, 0.039, -0.018);
    const swGeo = merge([sw, nib]);
    worldUV(swGeo, 0.1);
    whiteColors(swGeo);
    g.add(new THREE.Mesh(swGeo, new THREE.MeshStandardMaterial({
      color: 0xb2452c, roughness: 0.62, metalness: 0, vertexColors: true,
    })));

    g.userData.lens = lens;
    g.userData.reflector = reflMesh;
    return g;
  }

  // -- actions -----------------------------------------------------------------

  /** Hard toggle. Audible: the switch clicks and the Surveyor hears clicks. */
  toggle(silent = false) {
    if (!this.enabled || this._toggleCooldown > 0) return this.isOn;
    this.isOn = !this.isOn;
    this._toggleCooldown = 0.18;
    if (!silent) {
      this.player?.makeNoise?.(3.4);
      this.bus?.emit('lamp:toggle', { on: this.isOn });
    }
    return this.isOn;
  }

  /** Silent. `amount` 0..1 — the palm over the lens. */
  setCover(amount) { this._coverWant = clamp01(amount); }

  /**
   * Fit a fresh cell. Takes 1.5 s during which the lamp is dark and the hands
   * are busy, which is a genuine decision under pressure.
   */
  swapBattery() {
    if (this.swapping > 0) return false;
    if (this.battery > 0.55) return false;         // no reason to waste one
    if (!this.inventory?.has('battery_cell')) {
      this.bus?.emit('ui:refuse', { reason: 'No spare cell.' });
      return false;
    }
    this.inventory.use('battery_cell');
    this.swapping = 1.5;
    this.bus?.emit('lamp:swap', { start: true });
    this.player?.makeNoise?.(2.0);
    return true;
  }

  /** Only used by the director when the lamp is destroyed / drained by a beat. */
  setBattery(v) { this.battery = clamp01(v); }

  // -- per frame ---------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {import('../core/Input.js').Input} input
   */
  update(dt, input) {
    this._toggleCooldown = Math.max(0, this._toggleCooldown - dt);

    // Both hands full: the lamp is clipped to the belt, pointing at the floor.
    this.enabled = !this.inventory?.handsFull;

    // ---- input -------------------------------------------------------------
    if (input) {
      if (input.pressed?.('flashlight')) this.toggle();
      // `cover` and `swap` have no entry in ACTIONS yet (see the integration
      // request); read the raw codes so the mechanic is playable today.
      const coverDown = input.keys?.has('KeyV') || input.mouse?.rightDown;
      this.setCover(coverDown ? 1 : 0);
      if (input.pressedThisFrame?.has('KeyB')) this.swapBattery();
    }
    this.covered = damp(this.covered, this._coverWant ?? 0, 16, dt);

    // ---- swap --------------------------------------------------------------
    if (this.swapping > 0) {
      this.swapping -= dt;
      if (this.swapping <= 0) {
        this.swapping = 0;
        this.battery = 1;
        this._restrikeT = this.rng.range(6, 20);
        this.bus?.emit('lamp:swap', { start: false });
      }
    }

    // ---- battery -----------------------------------------------------------
    const burning = this.isOn && this.enabled && this.swapping <= 0;
    if (burning) {
      // Covering the lens does not save the cell — the bulb is still lit. That
      // matters: covering is a stealth tool, not a conservation tool.
      this.battery = clamp01(this.battery - this.drainRate * dt);
    }

    // Brown-out curve. Flat until 30%, then a knee, then a cliff.
    const b = this.battery;
    this._health = b > 0.30 ? lerp(0.90, 1.0, smoothstep(0.30, 0.72, b))
      : b > 0.08 ? lerp(0.34, 0.90, smoothstep(0.08, 0.30, b))
        : lerp(0.0, 0.34, smoothstep(0.0, 0.08, b));

    // Restrike flicker — rare and short when healthy, constant when nearly dead.
    const sick = 1 - smoothstep(0.05, 0.42, b);
    this._restrikeT -= dt * (0.4 + sick * 5.5);
    if (this._restrikeT <= 0) {
      this._restrikeLen = lerp(0.05, 0.45, this.rng()) * (0.4 + sick);
      this._restrikeT = lerp(22, 1.1, sick) * this.rng.range(0.5, 1.5);
    }
    if (this._restrikeLen > 0) {
      this._restrikeLen -= dt;
      const t = performance.now() * 0.001;
      const f = (Math.sin(t * 47) * 0.5 + 0.5) * (Math.sin(t * 19.3) * 0.5 + 0.5);
      this._flick = clamp01(0.18 + f * 1.4) * (this.rng() > 0.05 ? 1 : 0.05);
    } else {
      this._flick = damp(this._flick, 1, 12, dt);
    }

    // ---- output ------------------------------------------------------------
    const want = burning ? this._health * this._flick * lerp(1, 0.018, this.covered) : 0;
    // Filaments fall faster than they rise.
    this.beamStrength = damp(this.beamStrength, want, want > this.beamStrength ? 24 : 30, dt);

    this._updateAim(dt);
    this._applyLight();
  }

  /**
   * The lamp is a hand, not an eye. The aim direction chases the camera with a
   * spring whose stiffness rises with the size of the error, so slow looks are
   * followed loosely and a hard 180 is caught up on within a beat rather than
   * trailing embarrassingly.
   */
  _updateAim(dt) {
    const cam = this.camera;
    cam.getWorldDirection(this._camFwd);

    const camYaw = Math.atan2(-this._camFwd.x, -this._camFwd.z);
    const camPitch = Math.asin(clamp(this._camFwd.y, -1, 1));

    if (this._wristInit === undefined) { this._wrist.set(camYaw, camPitch); this._wristInit = 1; }

    // Shortest-arc yaw error.
    let dy = camYaw - this._wrist.x;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const dp = camPitch - this._wrist.y;

    const err = Math.hypot(dy, dp);
    const stiff = lerp(46, 260, clamp01(err / 1.2));
    const dampC = 2 * Math.sqrt(stiff) * 0.92;
    this._wristVel.x += (dy * stiff - this._wristVel.x * dampC) * dt;
    this._wristVel.y += (dp * stiff - this._wristVel.y * dampC) * dt;
    this._wrist.x += this._wristVel.x * dt;
    this._wrist.y = clamp(this._wrist.y + this._wristVel.y * dt, -1.5, 1.5);

    // Walk shake: the beam bounces with the stride, more than the head does.
    const p = this.player;
    const bob = p ? p.bobAmount : 0;
    const shakeY = p ? Math.sin(p.bobPhase * 2 + 0.7) * 0.028 * bob : 0;
    const shakeX = p ? Math.sin(p.bobPhase + 0.3) * 0.040 * bob : 0;
    const idle = wobble(performance.now() * 0.0006, 4) * 0.008;

    const yaw = this._wrist.x + shakeX + idle;
    const pitch = this._wrist.y + shakeY - 0.055;   // held slightly low

    this.aim.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)).normalize();

    // Emitter position: out of the fist, down-right of the eye.
    const right = this._tmp.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    this.origin.copy(cam.position)
      .addScaledVector(right, 0.19)
      .add(this._tmp2.set(0, -0.20, 0))
      .addScaledVector(this._camFwd, 0.12);
  }

  _applyLight() {
    const s = this.beamStrength;
    this.light.position.copy(this.origin);
    this.target.position.copy(this.origin).addScaledVector(this.aim, 4);
    this.light.intensity = 21 * s;
    this.light.visible = s > 0.004;
    // As the cell dies the arc shrinks and reddens; a dying torch does not just
    // get dimmer, it gets *smaller*.
    this.light.angle = lerp(ANGLE_OUTER * 0.72, ANGLE_OUTER, clamp01(this.battery * 1.6));
    this.light.color.setRGB(1, lerp(0.72, 0.914, clamp01(this.battery * 1.4)), lerp(0.36, 0.768, clamp01(this.battery * 1.5)));

    this.spill.position.copy(this.origin).addScaledVector(this.aim, 0.25);
    this.spill.intensity = 0.55 * s;
    this.spill.visible = s > 0.01;
    this.spill.color.copy(this.light.color);

    if (this.lens) {
      // Kept just under 1.0 at full output. The lens is a 74 mm disc a hand's
      // length from the eye; pushed above white it blooms into a hole in the
      // middle of the frame and eats the picture.
      const m = this.lens.material;
      const base = m.userData.baseColor || new THREE.Color(0xfff0d0);
      m.color.copy(base).multiplyScalar(0.05 + s * 0.82);
    }
  }

  // -- queries -----------------------------------------------------------------

  /**
   * How much light this lamp is putting on a world point, in the same units as
   * `LightRig.illuminationAt`. The entity system adds the two together, which
   * is the whole reason the player's own torch can feed the Surveyor.
   *
   * @param {number} x @param {number} y @param {number} z
   * @param {boolean} [occlude] test line of sight through the collision world
   */
  illuminationAt(x, y, z, occlude = true) {
    const s = this.beamStrength;
    if (s < 0.01) return 0;
    const dx = x - this.origin.x, dy = y - this.origin.y, dz = z - this.origin.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > RANGE || dist < 1e-4) return 0;
    const cosA = (dx * this.aim.x + dy * this.aim.y + dz * this.aim.z) / dist;
    const cosOuter = Math.cos(this.light.angle);
    if (cosA <= cosOuter) return 0;
    const cone = smoothstep(cosOuter, Math.cos(ANGLE_INNER), cosA);
    const atten = (1 - dist / RANGE) ** 2;
    if (occlude && this.collision?.segmentBlocked(
      this.origin.x, this.origin.y, this.origin.z, x, y, z)) return 0;
    return s * cone * atten * ILLUM_GAIN;
  }

  /** Is `obj`'s world position inside the beam at all? Cheap, no occlusion. */
  isAiming(x, y, z) { return this.illuminationAt(x, y, z, false) > 0.05; }

  dispose() {
    this.light.dispose();
    this.spill.dispose();
    this.light.removeFromParent();
    this.target.removeFromParent();
    this.spill.removeFromParent();
  }

  debugState() {
    return {
      on: this.isOn, battery: +this.battery.toFixed(3),
      beam: +this.beamStrength.toFixed(3), covered: +this.covered.toFixed(2),
      swapping: this.swapping > 0, enabled: this.enabled,
    };
  }
}

export default Flashlight;
