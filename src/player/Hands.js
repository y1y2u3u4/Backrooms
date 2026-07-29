import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, smoothstep, wobble, makeRng, TAU } from '../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, whiteColors } from '../render/geo.js';

/**
 * Hands — the first-person viewmodel.
 *
 * Renders into `Engine.overlayScene` through `overlayCamera`, which is drawn
 * after the world with a cleared depth buffer. That means the hands can never
 * clip a wall, and it also means they get no world lighting for free — so this
 * file owns three small lights of its own and drives them from the player's
 * actual illumination. Hands that stay lit in a dark room are the single
 * loudest tell that a game's viewmodel is a sticker.
 *
 * Motion rules:
 *
 *  * **Nothing snaps.** Every pose target goes through a critically-damped
 *    spring. A hand that arrives instantly weighs nothing.
 *  * **The hands lag the camera, then overshoot slightly and settle.** Inertia
 *    is the difference between holding a torch and having one grafted to you.
 *  * **Walk sway is driven by `player.bobPhase`, not a timer**, so hands, head
 *    and footstep audio are one mechanism at every speed.
 *  * **Weight is expressed by frequency, not amplitude.** The fuse core pose
 *    is not a bigger sway; it is a slower, lower one that fights the stride.
 */

// ---------------------------------------------------------------------------

/** Critically-damped vector spring. */
class Spring3 {
  constructor(stiffness = 90, x = 0, y = 0, z = 0) {
    this.k = stiffness;
    this.c = 2 * Math.sqrt(stiffness) * 1.0;
    this.value = new THREE.Vector3(x, y, z);
    this.target = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
  }
  set(x, y, z) { this.target.set(x, y, z); return this; }
  snap(x, y, z) { this.value.set(x, y, z); this.target.set(x, y, z); this.vel.set(0, 0, 0); return this; }
  kick(x, y, z) { this.vel.x += x; this.vel.y += y; this.vel.z += z; return this; }
  step(dt) {
    // Sub-step so a long frame cannot make a stiff spring explode.
    const n = dt > 1 / 45 ? 2 : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.vel.x += ((this.target.x - this.value.x) * this.k - this.vel.x * this.c) * h;
      this.vel.y += ((this.target.y - this.value.y) * this.k - this.vel.y * this.c) * h;
      this.vel.z += ((this.target.z - this.value.z) * this.k - this.vel.z * this.c) * h;
      this.value.addScaledVector(this.vel, h);
    }
    return this.value;
  }
}

// ---------------------------------------------------------------------------

const SKIN = 0xa8836a;
const SKIN_DARK = 0x6d4f3d;
const SLEEVE = 0x39322a;

/**
 * A stylised hand. Not anatomical — squared-off, slightly oversized knuckles,
 * a heavy forearm in a rolled Meridian donkey-jacket sleeve. Built as a small
 * bone hierarchy so fingers can curl around whatever is being held.
 */
function buildHand(side = 1, materials) {
  const root = new THREE.Group();
  root.name = side > 0 ? 'hand_R' : 'hand_L';

  const skinMat = materials.skin;
  const sleeveMat = materials.sleeve;

  // ---- forearm + rolled sleeve ----
  const armParts = [];
  const arm = cyl(0.037, 0.045, 0.30, 10);
  arm.rotateX(Math.PI / 2);
  arm.translate(0, 0, 0.19);
  armParts.push(arm);
  const armGeo = merge(armParts);
  worldUV(armGeo, 0.3);
  vertexShade(armGeo, (x, y, z) => 0.55 + clamp01((z + 0.1) / 0.4) * 0.15);
  const armMesh = new THREE.Mesh(armGeo, sleeveMat);
  root.add(armMesh);

  const cuff = cyl(0.049, 0.043, 0.052, 12);
  cuff.rotateX(Math.PI / 2);
  cuff.translate(0, 0, 0.056);
  worldUV(cuff, 0.2);
  whiteColors(cuff);
  root.add(new THREE.Mesh(cuff, sleeveMat));

  // ---- wrist + palm ----
  const palmParts = [];
  const wrist = box(0.062, 0.040, 0.052, 0.012, 2);
  wrist.translate(0, 0, 0.030);
  palmParts.push(wrist);
  const palm = box(0.076, 0.034, 0.082, 0.014, 2);
  palm.translate(side * 0.004, 0, -0.028);
  palmParts.push(palm);
  // Thenar pad — the lump at the base of the thumb. Without it a hand reads
  // as a mitten.
  const thenar = box(0.030, 0.030, 0.048, 0.013, 2);
  thenar.translate(-side * 0.030, -0.004, -0.016);
  palmParts.push(thenar);
  // Knuckle ridge.
  for (let i = 0; i < 4; i++) {
    const k = box(0.017, 0.016, 0.016, 0.007, 2);
    k.translate(side * (-0.027 + i * 0.018), 0.012, -0.066);
    palmParts.push(k);
  }
  const palmGeo = merge(palmParts);
  worldUV(palmGeo, 0.16);
  vertexShade(palmGeo, (x, y) => 0.72 + clamp01((y + 0.02) / 0.05) * 0.28);
  const palmMesh = new THREE.Mesh(palmGeo, skinMat);
  root.add(palmMesh);

  // ---- fingers ----
  // Each finger is proximal -> distal, pivoting at the knuckle and the middle
  // joint. Curl is a single 0..1 per finger, distributed unevenly across the
  // joints so a closed fist looks like a fist and not a folded ruler.
  const fingers = [];
  const lengths = [0.046, 0.050, 0.047, 0.040];
  for (let i = 0; i < 4; i++) {
    const prox = new THREE.Group();
    prox.position.set(side * (-0.027 + i * 0.018), 0.006, -0.070);
    const L1 = lengths[i], L2 = lengths[i] * 0.72;

    const g1 = box(0.0155, 0.0165, L1, 0.006, 2);
    g1.translate(0, 0, -L1 / 2);
    worldUV(g1, 0.12); whiteColors(g1);
    prox.add(new THREE.Mesh(g1, skinMat));

    const dist = new THREE.Group();
    dist.position.set(0, 0, -L1);
    const g2 = box(0.0135, 0.0145, L2, 0.0055, 2);
    g2.translate(0, 0, -L2 / 2);
    worldUV(g2, 0.12); whiteColors(g2);
    dist.add(new THREE.Mesh(g2, skinMat));
    // Nail plate, a flat facet on top of the tip. Reads at torch range.
    const nail = box(0.010, 0.004, 0.012, 0.0015, 1);
    nail.translate(0, 0.008, -L2 * 0.72);
    whiteColors(nail);
    dist.add(new THREE.Mesh(nail, materials.nail));
    prox.add(dist);

    root.add(prox);
    fingers.push({ prox, dist, curl: 0, curlTarget: 0, vel: 0 });
  }

  // Thumb: two segments, splayed out and rotated toward the palm.
  const thumbProx = new THREE.Group();
  thumbProx.position.set(-side * 0.036, -0.002, -0.020);
  thumbProx.rotation.set(0, side * 0.62, side * 0.28);
  const t1 = box(0.019, 0.019, 0.044, 0.007, 2);
  t1.translate(0, 0, -0.022);
  worldUV(t1, 0.12); whiteColors(t1);
  thumbProx.add(new THREE.Mesh(t1, skinMat));
  const thumbDist = new THREE.Group();
  thumbDist.position.set(0, 0, -0.044);
  const t2 = box(0.017, 0.017, 0.034, 0.006, 2);
  t2.translate(0, 0, -0.017);
  worldUV(t2, 0.12); whiteColors(t2);
  thumbDist.add(new THREE.Mesh(t2, skinMat));
  thumbProx.add(thumbDist);
  root.add(thumbProx);
  const thumb = { prox: thumbProx, dist: thumbDist, curl: 0, curlTarget: 0, vel: 0, base: thumbProx.rotation.clone() };

  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });

  return { root, fingers, thumb, side };
}

// ---------------------------------------------------------------------------

/** Named poses. Position/rotation are in overlay (view) space. */
const POSES = {
  idle_R: { p: [0.235, -0.255, -0.375], r: [-0.18, -0.24, 0.10], curl: [0.30, 0.32, 0.34, 0.38], thumb: 0.25 },
  idle_L: { p: [-0.245, -0.300, -0.430], r: [-0.10, 0.30, -0.14], curl: [0.22, 0.24, 0.26, 0.30], thumb: 0.18 },
  lamp_R: { p: [0.215, -0.230, -0.330], r: [-0.06, -0.10, 0.06], curl: [0.86, 0.90, 0.92, 0.94], thumb: 0.70 },
  reach_R: { p: [0.140, -0.130, -0.560], r: [-0.42, -0.06, 0.02], curl: [0.10, 0.10, 0.12, 0.16], thumb: 0.10 },
  reach_L: { p: [-0.210, -0.250, -0.480], r: [-0.18, 0.24, -0.10], curl: [0.24, 0.26, 0.28, 0.32], thumb: 0.20 },
  carry_R: { p: [0.195, -0.320, -0.395], r: [0.62, -0.30, -0.30], curl: [0.72, 0.76, 0.78, 0.80], thumb: 0.55 },
  carry_L: { p: [-0.195, -0.320, -0.395], r: [0.62, 0.30, 0.30], curl: [0.72, 0.76, 0.78, 0.80], thumb: 0.55 },
  cover_L: { p: [0.150, -0.150, -0.320], r: [-0.30, 0.55, -0.35], curl: [0.16, 0.18, 0.18, 0.22], thumb: 0.10 },
  stow_R: { p: [0.300, -0.520, -0.300], r: [-0.60, -0.30, 0.20], curl: [0.55, 0.58, 0.60, 0.62], thumb: 0.45 },
  stow_L: { p: [-0.320, -0.540, -0.300], r: [-0.60, 0.30, -0.20], curl: [0.50, 0.52, 0.54, 0.56], thumb: 0.40 },
  pry_R: { p: [0.230, -0.290, -0.360], r: [-0.24, -0.16, 0.22], curl: [0.88, 0.92, 0.94, 0.95], thumb: 0.78 },
};

export class Hands {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.overlayScene
   * @param {THREE.Camera} opts.overlayCamera
   * @param {import('./Player.js').Player} opts.player
   * @param {import('./Inventory.js').Inventory} opts.inventory
   * @param {import('./Flashlight.js').Flashlight} opts.flashlight
   * @param {import('../render/Lighting.js').LightRig} opts.rig
   * @param {import('../core/util.js').Bus} opts.bus
   */
  constructor({ overlayScene, overlayCamera, player, inventory, flashlight, rig, bus }) {
    this.scene = overlayScene;
    this.camera = overlayCamera;
    this.player = player;
    this.inventory = inventory;
    this.flashlight = flashlight;
    this.rig = rig;
    this.bus = bus;
    this.rng = makeRng(0x517a);
    this.visible = true;

    this.root = new THREE.Group();
    this.root.name = 'viewmodel';
    this.root.frustumCulled = false;
    overlayScene.add(this.root);

    this._buildLights();
    this._buildMaterials();

    this.right = buildHand(1, this.mats);
    this.left = buildHand(-1, this.mats);
    this.root.add(this.right.root, this.left.root);

    // Held-item mount inside the right fist.
    this.itemMountR = new THREE.Group();
    this.itemMountR.position.set(0, 0.012, -0.052);
    this.right.root.add(this.itemMountR);
    this.itemMountL = new THREE.Group();
    this.itemMountL.position.set(0, 0.012, -0.052);
    this.left.root.add(this.itemMountL);

    if (flashlight?.model) {
      flashlight.model.rotation.set(0.10, 0, 0);
      flashlight.model.position.set(0, 0.004, -0.028);
      this.itemMountR.add(flashlight.model);
    }
    this.carried = null;   // two-handed prop mesh (fuse core)

    // ---- springs ----
    this.posR = new Spring3(110).snap(...POSES.idle_R.p);
    this.rotR = new Spring3(96).snap(...POSES.idle_R.r);
    this.posL = new Spring3(102).snap(...POSES.idle_L.p);
    this.rotL = new Spring3(90).snap(...POSES.idle_L.r);
    this.swayS = new Spring3(58);          // whole-viewmodel inertia
    this.rootRot = new Spring3(52);

    this._breath = 0;
    this._lastYaw = player?.yaw ?? 0;
    this._lastPitch = player?.pitch ?? 0;
    this.reach = 0;         // 0..1 reach-out blend
    this._reachHold = 0;
    this.startle = 0;
    this.exposure = 0;      // ambient light on the hands

    this._unsub = [];
    if (bus) {
      this._unsub.push(bus.on('player:startle', (e) => this.recoil(e?.strength ?? 1)));
      this._unsub.push(bus.on('entity:state', (e) => {
        if (e?.state === 'CAPTURING' || e?.state === 'APPROACHING') this.recoil(0.55);
      }));
      this._unsub.push(bus.on('item:pickup', () => this.pulse(0.45)));
    }
  }

  // -- construction ------------------------------------------------------------

  _buildLights() {
    // The overlay scene is empty, so it needs its own three-point rig. All three
    // are driven from the world's actual illumination every frame.
    this.keyLight = new THREE.DirectionalLight(0xffe3bb, 0);
    this.keyLight.position.set(0.4, 0.5, 0.6);
    this.fillLight = new THREE.DirectionalLight(0x8fa4c0, 0);
    this.fillLight.position.set(-0.8, -0.1, 0.35);
    this.ambLight = new THREE.HemisphereLight(0x4a4438, 0x121110, 0);
    // A dedicated lamp-bounce light: when the torch is on, the near hand catches
    // spill off the reflector.
    this.lampBounce = new THREE.PointLight(0xffd9a2, 0, 1.4, 2);
    this.lampBounce.position.set(0.20, -0.22, -0.44);
    this.scene.add(this.keyLight, this.fillLight, this.ambLight, this.lampBounce);
  }

  _buildMaterials() {
    this.mats = {
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.86, metalness: 0, vertexColors: true }),
      sleeve: new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.95, metalness: 0, vertexColors: true }),
      nail: new THREE.MeshStandardMaterial({ color: 0xcbb6a4, roughness: 0.5, metalness: 0, vertexColors: true }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8b877c, roughness: 0.45, metalness: 0.85, vertexColors: true }),
      ceramic: new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.7, metalness: 0, vertexColors: true }),
    };
  }

  /** Replace the procedural hands with `hands_lowpoly.glb` if it exists. */
  async loadModel(assets) {
    if (!assets) return false;
    const proto = await assets.load('hands_lowpoly');
    if (!proto) return false;
    const findSide = (name) => {
      const inst = proto.getObjectByName(name);
      return inst ? inst.clone(true) : null;
    };
    const R = findSide('hand_R') || findSide('Hand_R');
    const L = findSide('hand_L') || findSide('Hand_L');
    if (!R || !L) return false;
    // Keep the procedural bone hierarchy if the GLB has no finger nodes: the
    // animation is the point, the mesh is only skin.
    const rebind = (glbRoot, hand) => {
      for (const m of hand.root.children.slice()) {
        if (m.isMesh) hand.root.remove(m);
      }
      glbRoot.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      hand.root.add(glbRoot);
    };
    rebind(R, this.right);
    rebind(L, this.left);
    this.usingGlbHands = true;
    return true;
  }

  // -- external triggers --------------------------------------------------------

  /** Reach toward whatever is being interacted with. `hold` keeps it extended. */
  setReaching(on, hold = false) {
    this._reachWant = on ? 1 : 0;
    this._reachHold = hold ? 1 : 0;
  }

  /** A short forward pulse, e.g. on pickup. */
  pulse(strength = 0.5) {
    this.posR.kick(0, 0.2 * strength, -0.9 * strength);
    this.rotR.kick(-1.6 * strength, 0, 0);
  }

  /** Startle: both hands snap in and up, then settle. */
  recoil(strength = 1) {
    const s = clamp01(strength);
    this.startle = Math.max(this.startle, s);
    this.posR.kick(0.5 * s, 0.9 * s, 1.6 * s);
    this.posL.kick(-0.5 * s, 0.9 * s, 1.6 * s);
    this.rotR.kick(2.4 * s, 1.2 * s, -1.4 * s);
    this.rotL.kick(2.4 * s, -1.2 * s, 1.4 * s);
    this.swayS.kick(0, 0.4 * s, 0.8 * s);
  }

  /** Show/hide the whole viewmodel (cinematics, hiding places). */
  setVisible(v) {
    this.visible = v;
    this.root.visible = v;
  }

  // -- carried props -------------------------------------------------------------

  /**
   * Two-handed carry prop. Built here rather than in the world so the held
   * version and the world version can differ (the held one has no collider and
   * far more detail on the faces you can actually see).
   */
  _buildFuseCore() {
    const g = new THREE.Group();
    const parts = [];
    // Ceramic body with a stepped waist and moulded ribs.
    const body = cyl(0.062, 0.062, 0.185, 16);
    parts.push(body);
    for (let i = 0; i < 3; i++) {
      const rib = cyl(0.070, 0.070, 0.012, 16);
      rib.translate(0, -0.05 + i * 0.05, 0);
      parts.push(rib);
    }
    const bodyGeo = merge(parts);
    worldUV(bodyGeo, 0.22);
    vertexShade(bodyGeo, (x, y) => 0.66 + clamp01((y + 0.1) / 0.2) * 0.3);
    g.add(new THREE.Mesh(bodyGeo, this.mats.ceramic));

    // Silvered end caps with a tag lug and a fixing hole.
    const caps = [];
    for (const s of [-1, 1]) {
      const c = cyl(0.058, 0.058, 0.030, 16);
      c.translate(0, s * 0.104, 0);
      caps.push(c);
      const lug = box(0.052, 0.010, 0.030, 0.003, 1);
      lug.translate(0, s * 0.124, 0);
      caps.push(lug);
    }
    const capGeo = merge(caps);
    worldUV(capGeo, 0.2);
    whiteColors(capGeo);
    g.add(new THREE.Mesh(capGeo, this.mats.metal));

    g.rotation.set(0, 0, Math.PI / 2);
    g.position.set(0, -0.02, -0.10);
    g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    return g;
  }

  _syncCarried() {
    const want = this.inventory?.handsFull ?? false;
    if (want && !this.carried) {
      this.carried = this._buildFuseCore();
      this.root.add(this.carried);
    } else if (!want && this.carried) {
      this.root.remove(this.carried);
      this.carried = null;
    }
    // A core in both hands physically stows the lamp.
    if (this.flashlight?.model) this.flashlight.model.visible = !want;
  }

  // -- per frame -----------------------------------------------------------------

  update(dt, input) {
    if (!this.visible) return;
    const p = this.player;
    this._syncCarried();

    // ---- what pose are we in -------------------------------------------------
    const carrying = this.inventory?.handsFull ?? false;
    const covering = (this.flashlight?.covered ?? 0) > 0.35;
    const held = this.inventory?.heldId ?? null;
    const reaching = (this._reachWant ?? 0) > 0.5;

    this.reach = damp(this.reach, this._reachWant ?? 0, reaching ? 16 : 9, dt);
    this.startle = damp(this.startle, 0, 2.6, dt);

    let poseR, poseL;
    if (carrying) { poseR = POSES.carry_R; poseL = POSES.carry_L; }
    else if (this.flashlight?.swapping > 0) { poseR = POSES.stow_R; poseL = POSES.reach_L; }
    else if (held === 'pry_bar') { poseR = POSES.pry_R; poseL = POSES.idle_L; }
    else if (held === 'lamp' && this.flashlight?.enabled) { poseR = POSES.lamp_R; poseL = POSES.idle_L; }
    else { poseR = POSES.idle_R; poseL = POSES.idle_L; }

    if (covering && !carrying) poseL = POSES.cover_L;
    if (this.reach > 0.02 && !carrying) {
      poseR = blendPose(poseR, POSES.reach_R, this.reach);
      if (!covering) poseL = blendPose(poseL, POSES.reach_L, this.reach * 0.55);
    }

    // ---- breathing / stride --------------------------------------------------
    const fear = p?.fear ?? 0;
    const exertion = p?.exertion ?? 0;
    const breathRate = lerp(0.70, 2.4, clamp01(exertion * 0.7 + fear * 0.8));
    this._breath += dt * breathRate * TAU * 0.5;
    const breathAmp = lerp(0.0035, 0.0125, clamp01(exertion + fear * 0.9)) * (carrying ? 1.9 : 1);
    const breathY = Math.sin(this._breath) * breathAmp;
    const breathZ = Math.sin(this._breath * 0.5) * breathAmp * 0.55;

    const bobA = (p?.bobAmount ?? 0) * (carrying ? 1.45 : 1);
    const phase = p?.bobPhase ?? 0;
    // Carrying halves the sway frequency and doubles its drop — a heavy object
    // fights the stride instead of riding it.
    const f = carrying ? 0.5 : 1;
    const swayX = Math.sin(phase * f) * 0.028 * bobA;
    const swayY = Math.sin(phase * 2 * f + 0.5) * 0.024 * bobA - bobA * 0.010;
    const swayZ = Math.sin(phase * f + 1.1) * 0.014 * bobA;

    // ---- camera inertia ------------------------------------------------------
    const yaw = p?.yaw ?? 0, pitch = p?.pitch ?? 0;
    let dYaw = yaw - this._lastYaw;
    while (dYaw > Math.PI) dYaw -= TAU;
    while (dYaw < -Math.PI) dYaw += TAU;
    const dPitch = pitch - this._lastPitch;
    this._lastYaw = yaw; this._lastPitch = pitch;
    const rate = dt > 1e-5 ? 1 / dt : 60;
    // Clamp so a mouse flick cannot throw the hands out of frame.
    const inertX = clamp(dYaw * rate * 0.020, -0.13, 0.13);
    const inertY = clamp(-dPitch * rate * 0.016, -0.10, 0.10);
    this.swayS.set(inertX, inertY, 0);
    this.rootRot.set(inertY * 0.9, -inertX * 0.8, inertX * 1.5);

    // ---- drive the springs ---------------------------------------------------
    const idleDriftR = wobble(performance.now() * 0.00043, 3) * 0.004;
    const idleDriftL = wobble(performance.now() * 0.00039, 11) * 0.004;

    this.posR.set(
      poseR.p[0] + swayX + idleDriftR,
      poseR.p[1] + swayY + breathY,
      poseR.p[2] + swayZ + breathZ);
    this.rotR.set(
      poseR.r[0] + swayY * 1.4 + breathY * 2.2,
      poseR.r[1] - swayX * 0.9,
      poseR.r[2] + swayX * 1.2);

    this.posL.set(
      poseL.p[0] - swayX * 0.8 + idleDriftL,
      poseL.p[1] + swayY * 0.9 + breathY * 0.85,
      poseL.p[2] + swayZ * 0.8 + breathZ * 0.9);
    this.rotL.set(
      poseL.r[0] + swayY * 1.2 + breathY * 2.0,
      poseL.r[1] + swayX * 0.9,
      poseL.r[2] - swayX * 1.1);

    this.posR.step(dt); this.rotR.step(dt);
    this.posL.step(dt); this.rotL.step(dt);
    this.swayS.step(dt); this.rootRot.step(dt);

    this.root.position.set(this.swayS.value.x, this.swayS.value.y, this.swayS.value.z);
    this.root.rotation.set(this.rootRot.value.x, this.rootRot.value.y, this.rootRot.value.z);

    this.right.root.position.copy(this.posR.value);
    this.right.root.rotation.set(this.rotR.value.x, this.rotR.value.y, this.rotR.value.z);
    this.left.root.position.copy(this.posL.value);
    this.left.root.rotation.set(this.rotL.value.x, this.rotL.value.y, this.rotL.value.z);

    if (this.carried) {
      // The core hangs between the hands and lags them both.
      this.carried.position.set(
        (this.posR.value.x + this.posL.value.x) * 0.5,
        (this.posR.value.y + this.posL.value.y) * 0.5 + 0.055,
        (this.posR.value.z + this.posL.value.z) * 0.5 - 0.055);
      this.carried.rotation.z = Math.PI / 2 + swayX * 0.8;
      this.carried.rotation.x = swayY * 1.5;
    }

    // ---- fingers -------------------------------------------------------------
    this._curlHand(this.right, poseR, dt);
    this._curlHand(this.left, poseL, dt);

    this._updateLights(dt);
  }

  _curlHand(hand, pose, dt) {
    for (let i = 0; i < hand.fingers.length; i++) {
      const fg = hand.fingers[i];
      fg.curlTarget = pose.curl[i];
      // Second-order so fingers settle rather than click into place.
      const k = 190, c = 2 * Math.sqrt(190) * 0.9;
      fg.vel += ((fg.curlTarget - fg.curl) * k - fg.vel * c) * dt;
      fg.curl = clamp01(fg.curl + fg.vel * dt);
      // 55% of the curl at the knuckle, 45% at the middle joint.
      fg.prox.rotation.x = fg.curl * 1.45;
      fg.dist.rotation.x = fg.curl * 1.25;
      // Fingers converge slightly as they close — a real fist is not a comb.
      fg.prox.rotation.y = hand.side * fg.curl * (i - 1.5) * 0.035;
    }
    const th = hand.thumb;
    th.curlTarget = pose.thumb;
    const k = 150, c = 2 * Math.sqrt(150) * 0.9;
    th.vel += ((th.curlTarget - th.curl) * k - th.vel * c) * dt;
    th.curl = clamp01(th.curl + th.vel * dt);
    th.prox.rotation.set(th.base.x + th.curl * 0.35, th.base.y - hand.side * th.curl * 0.30, th.base.z);
    th.dist.rotation.x = th.curl * 0.75;
  }

  /**
   * Light the hands from the world. Sampling the rig at the player's chest and
   * adding the lamp's own spill means the viewmodel darkens with the room, and
   * catches a warm rim when the torch is on — for free, with no shadow cost.
   */
  _updateLights(dt) {
    const p = this.player;
    let world = 0;
    if (this.rig && p) {
      world = this.rig.illuminationAt(p.position.x, p.position.y + 1.4, p.position.z);
    }
    const lampSpill = (this.flashlight?.beamStrength ?? 0) * (this.flashlight?.enabled ? 1 : 0);
    // The rig's units run roughly 0..7; map that onto a sane exposure.
    const target = clamp01(world / 5.2);
    this.exposure = damp(this.exposure, target, 3.2, dt);

    const amb = 0.045 + this.exposure * 0.55;
    this.ambLight.intensity = amb;
    this.keyLight.intensity = 0.15 + this.exposure * 1.55;
    this.fillLight.intensity = 0.05 + this.exposure * 0.42;
    this.lampBounce.intensity = lampSpill * 1.25;
    this.lampBounce.visible = lampSpill > 0.01;
    if (this.flashlight) this.lampBounce.color.copy(this.flashlight.light.color);

    // In near-total darkness the hands should read as silhouette, not vanish.
    const floor = 0.028;
    this.ambLight.intensity = Math.max(this.ambLight.intensity, floor);
  }

  dispose() {
    for (const u of this._unsub) u();
    this.root.removeFromParent();
    for (const l of [this.keyLight, this.fillLight, this.ambLight, this.lampBounce]) l.removeFromParent();
  }

  debugState() {
    return {
      visible: this.visible,
      carrying: !!this.carried,
      reach: +this.reach.toFixed(2),
      startle: +this.startle.toFixed(2),
      exposure: +this.exposure.toFixed(2),
    };
  }
}

function blendPose(a, b, t) {
  return {
    p: [lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t)],
    r: [lerp(a.r[0], b.r[0], t), lerp(a.r[1], b.r[1], t), lerp(a.r[2], b.r[2], t)],
    curl: a.curl.map((c, i) => lerp(c, b.curl[i], t)),
    thumb: lerp(a.thumb, b.thumb, t),
  };
}

export default Hands;
