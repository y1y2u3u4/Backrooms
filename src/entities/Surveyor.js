import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, smoothstep, makeRng, wobble, TAU } from '../core/util.js';
import { box, cyl, lathe, merge, worldUV, vertexShade, whiteColors } from '../render/geo.js';

/**
 * THE SURVEYOR.
 *
 * One entity is fully realised; everything else in the Annex is evidence. This
 * file is the whole of it — perception, decision, locomotion and animation —
 * because the thing that makes it frightening is that all four agree with each
 * other, and splitting them across files is how they stop agreeing.
 *
 * ---------------------------------------------------------------------------
 * THE BEHAVIOURAL LANGUAGE (DESIGN.md §2) — and where each rule lives
 * ---------------------------------------------------------------------------
 *
 * 1. IT ONLY MOVES IN LIGHT.  `_sampleLight()` + `speedScale`.
 *    Movement speed is a direct function of the illumination on its own torso,
 *    summing the light rig and the player's lamp. In darkness the number is
 *    zero and *everything* stops — including the gait phase, so it freezes
 *    mid-stride with one foot off the floor rather than dropping to an idle.
 *    That frozen pose is the single most important frame in the game: it is how
 *    the player learns the rule without being told it. Pointing your lamp at it
 *    to see it better makes it walk. Good.
 *
 * 2. IT IS BLIND.  There is no line-of-sight test anywhere in this file. It
 *    never checks whether it can see the player, because it cannot.
 *
 * 3. IT NAVIGATES BY SOUND.  `hear()` turns a `player:noise` event into a
 *    *belief*: a position, deliberately wrong by a metre or so, plus a
 *    confidence that decays. It walks to where it believes the sound was, not
 *    to where the player is. Standing still after making a noise works.
 *
 * 4. IT MEASURES.  When confidence runs out it stops and holds a blade against
 *    the nearest wall for 4-9 seconds. This is the player's window, and it is
 *    long enough to cross a room and short enough to be terrifying.
 *
 * 5. IT ANNOUNCES ITSELF.  ROUSED is a real state with a real duration (3.5 s)
 *    during which it does not move. `entity:state` fires on entry so the audio
 *    agent has its full transformer-whine lead-in before anything appears.
 *
 * 6. IT DOES NOT CHASE FAR.  Steering is committed: the heading turns at
 *    0.85 rad/s maximum and re-plans four times a second. It cannot corner
 *    sharply, it cannot backtrack quickly, and breaking line-of-sound plus
 *    killing the lights loses it reliably.
 *
 * NEVER: no sprint-from-off-screen, no teleport into frame, no scream on
 * contact. Capture is a slow close and an arm coming round.
 */

export const STATE = {
  DORMANT: 'DORMANT',
  ROUSED: 'ROUSED',
  SEEKING: 'SEEKING',
  MEASURING: 'MEASURING',
  APPROACHING: 'APPROACHING',
  CAPTURING: 'CAPTURING',
  RETREATING: 'RETREATING',
};

const HEIGHT = 2.90;
const BODY_RADIUS = 0.30;
/** Rest height of the pelvis bone. The stoop solver works back from this. */
const PELVIS_Y = 1.42;
/** Illumination (in LightRig units) at which it is fully mobile. */
const LIGHT_FULL = 2.4;
/** Below this it is stone. */
const LIGHT_DEAD = 0.30;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

// ---------------------------------------------------------------------------
// procedural stand-in
// ---------------------------------------------------------------------------

/**
 * Build the body when `surveyor.glb` is absent.
 *
 * This is a real character, not a capsule with a label. Silhouette per the
 * bible: 2.9 m, extremely narrow, a square louvred ceiling-diffuser plate for
 * a head on a long neck, a torso of stacked offset plates, arms with one too
 * many segments ending in flat measuring blades, legs reversed at the knee.
 *
 * Returns a bone map with the same names the GLB uses, so the animation code
 * below never learns which one it is driving.
 */
function buildStandIn(palette) {
  const mat = (k, fallback) => (palette?.[k]?.() || new THREE.MeshStandardMaterial({
    color: fallback, roughness: 0.62, metalness: 0.55, vertexColors: true,
  }));
  const plateMat = mat('machinePaint', 0x6f6c63);
  const galvMat = mat('ductMetal', 0x9d9a90);
  const bladeMat = mat('chrome', 0xb6b2a6);
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a19, roughness: 0.9, metalness: 0.1, vertexColors: true,
  });

  const bones = {};
  const root = new THREE.Group();
  root.name = 'surveyor';

  const add = (parent, name, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(0, y, z);
    parent.add(g);
    bones[name] = g;
    return g;
  };
  const mesh = (parent, geo, material, shade) => {
    worldUV(geo, 0.5);
    if (shade) vertexShade(geo, shade); else whiteColors(geo);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---- pelvis --------------------------------------------------------------
  const pelvis = add(root, 'pelvis', 1.42);
  {
    const parts = [];
    // A narrow cast hip block with a machined slot and two pivot bosses.
    const hip = box(0.34, 0.20, 0.22, 0.014, 2);
    parts.push(hip);
    const slot = box(0.30, 0.05, 0.24, 0.006, 1);
    slot.translate(0, -0.02, 0);
    parts.push(slot);
    for (const s of [-1, 1]) {
      const boss = cyl(0.055, 0.055, 0.09, 12);
      boss.rotateZ(Math.PI / 2);
      boss.translate(s * 0.16, -0.07, 0);
      parts.push(boss);
    }
    mesh(pelvis, merge(parts), plateMat, () => 0.62);
  }

  // ---- torso: stacked, offset plates ---------------------------------------
  const torso = add(pelvis, 'torso', 0.10);
  {
    // Nine plates of decreasing width, each rotated a few degrees off the last
    // and each with a visible gap — the reason its outline reads as "stack of
    // filing trays" rather than "chest".
    const parts = [];
    const n = 11;
    const pitch = 0.070;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const w = lerp(0.42, 0.30, t);
      const d = lerp(0.23, 0.165, t);
      const h = 0.050;
      const p = box(w, h, d, 0.006, 1);
      p.rotateY(Math.sin(i * 1.9) * 0.13);
      p.translate(Math.sin(i * 2.4) * 0.022, 0.06 + i * pitch, Math.cos(i * 1.7) * 0.016);
      parts.push(p);
      // Spacer columns between plates, offset front and back so the stack has
      // depth rather than reading as a ladder from the front.
      if (i < n - 1) {
        for (const s of [-1, 1]) {
          const sp = cyl(0.015, 0.015, pitch - 0.05, 6);
          sp.translate(s * (w * 0.34), 0.085 + i * pitch, Math.cos(i * 2.9) * 0.045);
          parts.push(sp);
        }
      }
    }
    // Shoulder yoke: a wide flat plate the arms visibly hang off, at the top of
    // the stack. Without it the arms read as detached.
    const yoke = box(0.46, 0.055, 0.14, 0.008, 1);
    yoke.translate(0, 0.06 + (n - 1) * pitch + 0.055, 0);
    parts.push(yoke);
    mesh(torso, merge(parts), plateMat, (x, y) => 0.52 + clamp01(y / 0.8) * 0.34);

    // Spine column visible through the gaps — dark, so the stack reads as open.
    const spine = cyl(0.038, 0.045, 0.80, 8);
    spine.translate(0, 0.44, -0.02);
    mesh(torso, spine, darkMat, () => 0.45);
  }

  // ---- neck ----------------------------------------------------------------
  const neck = add(torso, 'neck', 0.88);
  {
    const parts = [];
    // Three telescoping sections, like a surveyor's staff.
    const seg = [[0.040, 0.16], [0.033, 0.15], [0.027, 0.13]];
    let y = 0;
    for (const [r, h] of seg) {
      const s = cyl(r, r * 1.06, h, 10);
      s.translate(0, y + h / 2, 0);
      parts.push(s);
      const collar = cyl(r * 1.35, r * 1.35, 0.016, 12);
      collar.translate(0, y + h, 0);
      parts.push(collar);
      y += h;
    }
    mesh(neck, merge(parts), galvMat, (x, yy) => 0.6 + clamp01(yy / 0.45) * 0.3);
  }

  // ---- head: a square louvred ceiling-diffuser plate ------------------------
  const head = add(neck, 'head', 0.46);
  {
    const parts = [];
    // Frame: a 0.42 m square pan with a 22 mm return all round — exactly the
    // profile of an eggcrate diffuser lifted out of a ceiling grid.
    const S = 0.42, T = 0.055;
    const pan = box(S, T, S, 0.008, 1);
    parts.push(pan);
    for (const [ax, s] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
      const r = ax === 0 ? box(0.022, 0.085, S, 0.004, 1) : box(S, 0.085, 0.022, 0.004, 1);
      r.translate(ax === 0 ? s * (S / 2) : 0, -0.03, ax === 1 ? s * (S / 2) : 0);
      parts.push(r);
    }
    mesh(head, merge(parts), galvMat, () => 0.74);

    // The louvres themselves — a real 7 x 7 eggcrate, recessed and dark inside.
    const louvres = [];
    const N = 7;
    for (let i = 0; i <= N; i++) {
      const t = -S / 2 + 0.02 + (i / N) * (S - 0.04);
      const a = box(0.006, 0.062, S - 0.04, 0.001, 1);
      a.translate(t, -0.042, 0);
      louvres.push(a);
      const b = box(S - 0.04, 0.062, 0.006, 0.001, 1);
      b.translate(0, -0.042, t);
      louvres.push(b);
    }
    mesh(head, merge(louvres), darkMat, () => 0.30);

    // A single machined aperture on the front face. Not an eye — an instrument
    // port. It is off-centre, which is worse.
    const port = cyl(0.030, 0.030, 0.03, 12);
    port.rotateX(Math.PI / 2);
    port.translate(0.07, -0.01, S / 2);
    mesh(head, port, bladeMat, () => 0.9);
  }

  // ---- arms: four segments, ending in a measuring blade ---------------------
  for (const side of [-1, 1]) {
    const S = side < 0 ? 'L' : 'R';
    const shoulder = add(torso, `shoulder_${S}`, 0.79, 0);
    shoulder.position.x = side * 0.17;
    {
      const j = cyl(0.052, 0.052, 0.10, 10);
      j.rotateZ(Math.PI / 2);
      mesh(shoulder, j, galvMat, () => 0.7);
    }
    const upper = add(shoulder, `arm_upper_${S}`);
    {
      const parts = [];
      const a = box(0.062, 0.60, 0.062, 0.010, 1);
      a.translate(0, -0.30, 0);
      parts.push(a);
      // Cable guides down the outside of the segment.
      for (let i = 0; i < 3; i++) {
        const c = box(0.014, 0.020, 0.074, 0.002, 1);
        c.translate(side * 0.036, -0.13 - i * 0.17, 0);
        parts.push(c);
      }
      mesh(upper, merge(parts), plateMat, (x, y) => 0.58 + clamp01((y + 0.6) / 0.6) * 0.24);
    }
    const lower = add(upper, `arm_lower_${S}`, -0.60);
    {
      const parts = [];
      const j = cyl(0.046, 0.046, 0.085, 10);
      j.rotateZ(Math.PI / 2);
      parts.push(j);
      const a = box(0.050, 0.56, 0.050, 0.008, 1);
      a.translate(0, -0.28, 0);
      parts.push(a);
      mesh(lower, merge(parts), plateMat, () => 0.66);
    }
    // The extra segment. A human arm has two; this has three, and the eye
    // notices the wrongness long before it works out why.
    const wrist = add(lower, `arm_wrist_${S}`, -0.56);
    {
      const parts = [];
      const j = cyl(0.036, 0.036, 0.066, 8);
      j.rotateZ(Math.PI / 2);
      parts.push(j);
      const a = box(0.038, 0.34, 0.038, 0.006, 1);
      a.translate(0, -0.17, 0);
      parts.push(a);
      mesh(wrist, merge(parts), galvMat, () => 0.72);
    }
    const blade = add(wrist, `blade_${S}`, -0.34);
    {
      const parts = [];
      // A flat steel measuring blade with graduations milled into the edge.
      const b = box(0.095, 0.30, 0.007, 0.002, 1);
      b.translate(0, -0.15, 0);
      parts.push(b);
      const tip = box(0.055, 0.09, 0.005, 0.002, 1);
      tip.translate(0, -0.32, 0);
      parts.push(tip);
      for (let i = 0; i < 9; i++) {
        const g = box(i % 2 ? 0.030 : 0.048, 0.004, 0.009, 0.001, 1);
        g.translate(0.022, -0.045 - i * 0.030, 0);
        parts.push(g);
      }
      mesh(blade, merge(parts), bladeMat, () => 0.95);
    }
  }

  // ---- legs: reversed at the knee -------------------------------------------
  for (const side of [-1, 1]) {
    const S = side < 0 ? 'L' : 'R';
    const hip = add(pelvis, `hip_${S}`, -0.08);
    hip.position.x = side * 0.115;
    {
      const j = cyl(0.058, 0.058, 0.10, 10);
      j.rotateZ(Math.PI / 2);
      mesh(hip, j, galvMat, () => 0.68);
    }
    const upperLeg = add(hip, `leg_upper_${S}`);
    {
      const parts = [];
      const a = box(0.088, 0.66, 0.082, 0.012, 1);
      a.translate(0, -0.33, 0);
      parts.push(a);
      // Hydraulic ram down the front of the thigh.
      const ram = cyl(0.020, 0.020, 0.40, 8);
      ram.translate(0, -0.28, 0.058);
      parts.push(ram);
      mesh(upperLeg, merge(parts), plateMat, (x, y) => 0.54 + clamp01((y + 0.66) / 0.66) * 0.28);
    }
    // Knee joint. The shin runs *backwards* from here — digitigrade, like a
    // bird or a mechanical excavator, and it is why the walk looks wrong from
    // the first frame.
    const lowerLeg = add(upperLeg, `leg_lower_${S}`, -0.66);
    {
      const parts = [];
      const j = cyl(0.052, 0.052, 0.10, 10);
      j.rotateZ(Math.PI / 2);
      parts.push(j);
      const a = box(0.070, 0.62, 0.062, 0.010, 1);
      a.translate(0, -0.31, 0);
      parts.push(a);
      mesh(lowerLeg, merge(parts), plateMat, () => 0.62);
    }
    const foot = add(lowerLeg, `foot_${S}`, -0.62);
    {
      const parts = [];
      const ankle = cyl(0.038, 0.038, 0.075, 8);
      ankle.rotateZ(Math.PI / 2);
      parts.push(ankle);
      // A narrow pad, not a boot: it contacts the floor on a 90 mm strip.
      const pad = box(0.090, 0.036, 0.30, 0.008, 1);
      pad.translate(0, -0.045, 0.075);
      parts.push(pad);
      const heel = box(0.070, 0.030, 0.075, 0.006, 1);
      heel.translate(0, -0.045, -0.075);
      parts.push(heel);
      mesh(foot, merge(parts), galvMat, () => 0.58);
    }
  }

  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { root, bones, procedural: true };
}

// ---------------------------------------------------------------------------

export class Surveyor {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {import('../player/Physics.js').CollisionWorld} opts.collision
   * @param {import('../render/Lighting.js').LightRig} opts.rig
   * @param {import('../player/Player.js').Player} opts.player
   * @param {import('../player/Flashlight.js').Flashlight} [opts.flashlight]
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {object} [opts.palette]
   */
  constructor({ scene, collision, rig, player, flashlight = null, bus, palette = null, seed = 0x51a2b3 }) {
    this.scene = scene;
    this.collision = collision;
    this.rig = rig;
    this.player = player;
    this.flashlight = flashlight;
    this.bus = bus;
    this.palette = palette;
    this.rng = makeRng(seed || 0x51a2b3);

    // ---- body ----
    const built = buildStandIn(palette);
    this.root = built.root;
    this.bones = built.bones;
    this.usingGlb = false;
    this.root.visible = false;
    scene.add(this.root);

    // ---- transform ----
    this.position = new THREE.Vector3(0, 0, 0);     // feet
    this.heading = 0;                               // radians, facing
    this.velocity = new THREE.Vector3();
    this.speed = 0;

    // ---- perception ----
    this.lastHeard = new THREE.Vector3();
    this.confidence = 0;          // 0..1 belief in `lastHeard`
    this.hearingRange = 34;       // metres at which a radius-1 noise is inaudible
    this.illumination = 0;
    this.lightScale = 0;          // 0..1 movement multiplier from light

    // ---- idle patrol (see STATE.DORMANT) ----
    /** Roughly how far from the player it is willing to drift while dormant. */
    this.wanderRadius = 26;
    this._wanderGoal = null;
    this._wanderT = 0;

    // ---- decision ----
    this.state = STATE.DORMANT;
    this.stateTime = 0;
    this.measureHold = 0;
    this.captureT = 0;
    this.patience = 0;            // seconds of silence tolerated before retreat
    this.active = false;
    this.aggression = 0;          // 0..1, raised by the director over the game

    // ---- steering ----
    this._probeT = 0;
    this._desired = 0;            // desired heading from the last probe
    this._commit = 0;             // seconds left on the current commitment
    this._stuck = 0;
    this._lastPos = new THREE.Vector3();

    // ---- animation ----
    this.gait = 0;                // gait phase, radians
    this.headYaw = 0;
    this.headYawTarget = 0;
    this.headTickT = 0;
    this.armReach = 0;            // 0..1 measuring-arm extension
    this.measureSide = 1;
    this.measureNormal = new THREE.Vector3(1, 0, 0);
    this.frozenPose = false;
    this.captureBlend = 0;
    this.stoop = 0;            // 0..1 how far it has folded to fit the ceiling

    this._shadowT = 0;
    this._noiseUnsub = [];
    if (bus) {
      // NOTE: it listens to `player:noise` and `world:noise` but emphatically
      // NOT to `entity:heard` — that is this entity's *output*, and subscribing
      // to your own output is an infinite loop with a stack trace at the end.
      this._noiseUnsub.push(bus.on('player:noise', (e) => this.hear(e?.position, e?.radius ?? 4)));
      this._noiseUnsub.push(bus.on('world:noise', (e) => this.hear(e?.position, e?.radius ?? 8)));
      this._noiseUnsub.push(bus.on('prop:noise', (e) => this.hear(e?.position, e?.radius ?? 6)));
    }
  }

  // -- asset ------------------------------------------------------------------

  /**
   * Replace the stand-in with `surveyor.glb` if the Blender agent has shipped
   * it. Bones are matched by name; anything missing simply stays unanimated,
   * so a half-finished export still works.
   */
  async loadModel(assets) {
    if (!assets) return false;
    const proto = await assets.load('surveyor');
    if (!proto) return false;
    const inst = assets.instance('surveyor') || proto.clone(true);
    const bones = {};
    const want = [
      'pelvis', 'torso', 'neck', 'head',
      'shoulder_L', 'shoulder_R', 'arm_upper_L', 'arm_upper_R',
      'arm_lower_L', 'arm_lower_R', 'arm_wrist_L', 'arm_wrist_R',
      'blade_L', 'blade_R', 'hand_L', 'hand_R',
      'hip_L', 'hip_R', 'leg_upper_L', 'leg_upper_R',
      'leg_lower_L', 'leg_lower_R', 'foot_L', 'foot_R',
    ];
    inst.traverse((o) => {
      const n = o.name;
      if (want.includes(n) && !bones[n]) bones[n] = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    });
    if (Object.keys(bones).length < 6) {
      console.info('[surveyor] surveyor.glb has too few named bones; keeping the stand-in');
      return false;
    }
    // Alias whatever the export actually called things. A rig that names the
    // last arm segment `hand_*` rather than `blade_*` is not a broken rig, and
    // the animation should not care.
    bones.blade_L = bones.blade_L || bones.hand_L;
    bones.blade_R = bones.blade_R || bones.hand_R;
    bones.arm_wrist_L = bones.arm_wrist_L || null;
    bones.arm_wrist_R = bones.arm_wrist_R || null;
    // Normalise scale to the bible's 2.9 m.
    const bboxHeight = new THREE.Box3().setFromObject(inst).getSize(_v).y;
    if (bboxHeight > 0.1) inst.scale.setScalar(HEIGHT / bboxHeight);

    this.scene.remove(this.root);
    this.root = inst;
    this.root.visible = this.active;
    this.bones = bones;
    this.usingGlb = true;
    this.scene.add(this.root);
    // Cache each bone's authored rest rotation so the animation is additive.
    for (const [k, b] of Object.entries(this.bones)) b.userData.rest = b.rotation.clone();
    return true;
  }

  // -- lifecycle ---------------------------------------------------------------

  /** Place it and leave it dormant. Nothing is emitted; nobody knows it is here. */
  spawnAt(x, y, z, heading = 0) {
    // Defensive: a QA hook calling this with an options object instead of a
    // heading used to poison `this.heading` and then crash debugState().
    if (typeof heading !== 'number' || !Number.isFinite(heading)) heading = 0;
    this.position.set(x, y, z);
    this.heading = heading;
    this._desired = heading;
    this.root.position.set(x, y, z);
    this.root.rotation.y = heading;
    this.active = true;
    this.root.visible = true;
    this._setState(STATE.DORMANT);
    return this;
  }

  despawn() {
    this.active = false;
    this.root.visible = false;
    this.confidence = 0;
    this._setState(STATE.DORMANT);
  }

  /**
   * Wake it up. `at` is where it believes the sound came from. ROUSED holds it
   * still for `lead` seconds — the announcement window the audio agent fills
   * with a rising transformer whine.
   */
  rouse(at = null, lead = 3.5) {
    if (!this.active) return;
    if (at) { this.lastHeard.copy(at); this.confidence = 1; }
    if (this.state === STATE.DORMANT || this.state === STATE.RETREATING) {
      this._rouseLead = lead;
      this._setState(STATE.ROUSED);
    }
  }

  /**
   * Hearing model. It is blind, so this is the only channel it has.
   *
   * A noise event carries an audible radius in metres. What it gets back is not
   * the position but a *belief* about the position: displaced by up to a metre
   * and more at range, weighted by how far the sound had to travel and how much
   * building was in the way. Two consequences the player can feel:
   *   - standing still after being heard works, because it walks to the belief;
   *   - a loud noise across the building is a genuine decoy.
   */
  hear(position, radius = 4) {
    if (!this.active || !position) return 0;
    if (this.state === STATE.CAPTURING) return 0;
    const dist = this.position.distanceTo(position);
    const audible = radius * 1.9 + 3;
    if (dist > audible) return 0;

    // Structure between it and the sound muffles it.
    let occl = 0;
    if (this.collision) {
      occl = this.collision.occlusion(
        this.position.x, this.position.y + 1.5, this.position.z,
        position.x, position.y + 1.0, position.z);
    }
    const strength = clamp01(1 - dist / audible) * lerp(1, 0.34, occl);
    if (strength < 0.06) return 0;

    // Localisation error grows with distance and with occlusion.
    const err = lerp(0.35, 2.6, clamp01(dist / audible)) * lerp(1, 1.9, occl);
    const a = this.rng() * TAU;
    const r = this.rng() * err;

    // Bearing it was already working on, sampled before the belief moves.
    const prevX = this.lastHeard.x - this.position.x;
    const prevZ = this.lastHeard.z - this.position.z;
    const prevConf = this.confidence;
    const prevState = this.state;

    // A stronger cue overwrites a weaker belief; a weaker one only refreshes it.
    if (strength >= this.confidence * 0.72) {
      this.lastHeard.set(position.x + Math.cos(a) * r, position.y, position.z + Math.sin(a) * r);
      this.confidence = clamp01(Math.max(this.confidence * 0.5, strength));
    } else {
      this.confidence = clamp01(this.confidence + strength * 0.25);
    }
    this.patience = 0;

    if (this.state === STATE.DORMANT || this.state === STATE.RETREATING) {
      this.rouse(this.lastHeard, 3.5);
    } else if (this.state === STATE.MEASURING && strength > 0.35) {
      // A loud noise cuts a measuring cycle short. Quiet ones do not.
      this.measureHold = Math.min(this.measureHold, 0.6);
    }
    // HOW FAR IT SWUNG. This is the player's only feedback that a decoy or a
    // switch worked, and until now nothing carried it: the event said where the
    // *sound* was, so the head tick played at the thrown cell thirty metres
    // away. The player heard their own can land — which they already knew — and
    // learned nothing about the thing they threw it to move.
    //
    // `turn` is the angle between the bearing it was already working on and the
    // bearing it now believes in, so a decoy that pulls it right round reads
    // differently from a correction of half a metre. It cannot lie: it is
    // computed from the belief that actually changed.
    const nx = this.lastHeard.x - this.position.x, nz = this.lastHeard.z - this.position.z;
    let turn = 0;
    // `prevState` and not `this.state`: a DORMANT entity is not working on a
    // bearing, and its stale belief can be four hundred metres away in another
    // zone, which would report a huge swing for simply waking up. That would
    // make the swing check pass on the one case it must not be satisfied by.
    if (prevState !== STATE.DORMANT && prevState !== STATE.RETREATING
        && prevConf > 0.08 && (prevX * prevX + prevZ * prevZ) > 0.25 && (nx * nx + nz * nz) > 0.25) {
      const d = (prevX * nx + prevZ * nz) / (Math.hypot(prevX, prevZ) * Math.hypot(nx, nz));
      turn = Math.acos(Math.min(1, Math.max(-1, d)));
    }
    this.bus?.emit('entity:heard', {
      entity: 'surveyor', position: this.lastHeard.clone(),
      // Where the LISTENER is, not where the sound was. The head plate is on
      // its head; that is the only place the tick can honestly come from.
      from: this.position.clone(),
      turn: +turn.toFixed(3),
      radius, strength: +strength.toFixed(3),
    });
    return strength;
  }

  // -- light -------------------------------------------------------------------

  /**
   * Illumination on the torso, summing the fixed rig and the player's lamp.
   * Sampled at chest height rather than at the feet because it is 2.9 m tall
   * and the interesting case is a ceiling fixture lighting its top half while
   * its legs are in shadow — which is exactly when it advances.
   */
  _sampleLight() {
    const x = this.position.x, z = this.position.z;
    const yChest = this.position.y + 1.7;
    let lum = this.rig ? this.rig.illuminationAt(x, yChest, z) : 0;
    // The head is 1.2 m higher and much closer to a troffer.
    if (this.rig) lum = Math.max(lum, this.rig.illuminationAt(x, this.position.y + 2.6, z) * 0.85);
    if (this.flashlight) {
      lum += this.flashlight.illuminationAt(x, yChest, z, true);
    }
    this.illumination = lum;
    this.lightScale = smoothstep(LIGHT_DEAD, LIGHT_FULL, lum);
    return this.lightScale;
  }

  // -- steering ----------------------------------------------------------------

  /**
   * Navmesh-free steering.
   *
   * Fires a fan of probes through the collision world, scores each direction by
   * how far it runs clear and how well it points at the goal, and turns toward
   * the winner at a hard-limited rate. There is no path — there is a
   * commitment, which is what rule 6 asks for. Wall-following falls out of the
   * scoring for free: when the goal direction is blocked, the best-scoring
   * clear direction is the one that grazes the wall.
   */
  _probeDirections(goalX, goalZ) {
    const N = 16;
    const step = 0.75;
    const maxSteps = 7;
    const gx = goalX - this.position.x, gz = goalZ - this.position.z;
    const goalDist = Math.hypot(gx, gz);
    const goalDir = goalDist > 1e-4 ? Math.atan2(gx, gz) : this.heading;

    let best = this.heading, bestScore = -Infinity;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const dx = Math.sin(a), dz = Math.cos(a);

      // How far can it walk this way before something stops it?
      let clearDist = step * maxSteps;
      for (let s = 1; s <= maxSteps; s++) {
        const d = s * step;
        const px = this.position.x + dx * d, pz = this.position.z + dz * d;
        const res = this.collision.resolveCapsule(px, this.position.y, pz, BODY_RADIUS, 1.9);
        if (res.hit) { clearDist = (s - 1) * step; break; }
        // A hole in the floor is also a wall to something that walks.
        const f = this.collision.sampleFloor(px, pz, this.position.y + 0.5, 0.9);
        if (!f) { clearDist = (s - 1) * step; break; }
      }
      if (clearDist < step) continue;

      // Score: alignment with the goal, dominated by clearance, with a strong
      // bonus for simply carrying on. It should look stubborn.
      let da = a - goalDir;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      let dh = a - this.heading;
      while (dh > Math.PI) dh -= TAU;
      while (dh < -Math.PI) dh += TAU;

      const align = Math.cos(da);
      const inertia = Math.cos(dh);
      const openness = clearDist / (step * maxSteps);
      const score = align * 2.4 + openness * 1.9 + inertia * 1.25
        - (Math.abs(dh) > 2.2 ? 2.0 : 0);   // it very rarely turns around
      if (score > bestScore) { bestScore = score; best = a; }
    }
    this._desired = best;
    return best;
  }

  _moveToward(dt, goalX, goalZ, baseSpeed) {
    // The freeze is absolute and immediate. Not a deceleration — the light goes
    // out and the machine stops between one frame and the next, with whatever
    // limb was in the air still in the air. Damping this would be a nicer curve
    // and a much worse game.
    if (this.lightScale <= 0.02) { this.speed = 0; return; }

    this._probeT -= dt;
    if (this._probeT <= 0) {
      this._probeT = 0.25;
      this._probeDirections(goalX, goalZ);
    }

    // Turn rate is the whole personality: 0.85 rad/s is deliberate, unhurried
    // and completely unable to corner after a player who has just sprinted.
    let dh = this._desired - this.heading;
    while (dh > Math.PI) dh -= TAU;
    while (dh < -Math.PI) dh += TAU;
    const turn = clamp(dh, -0.85 * dt, 0.85 * dt);
    this.heading += turn;

    // Speed drops while turning hard — no skating round corners.
    const turnPenalty = 1 - clamp01(Math.abs(dh) / 1.4) * 0.55;
    const s = baseSpeed * this.lightScale * turnPenalty;
    this.speed = damp(this.speed, s, 3.4, dt);

    const dx = Math.sin(this.heading) * this.speed * dt;
    const dz = Math.cos(this.heading) * this.speed * dt;
    const res = this.collision.resolveCapsule(
      this.position.x + dx, this.position.y, this.position.z + dz, BODY_RADIUS, 1.9);
    this.position.x = res.x;
    this.position.z = res.z;

    const floor = this.collision.sampleFloor(this.position.x, this.position.z, this.position.y + 0.6, 1.2);
    if (floor) this.position.y = damp(this.position.y, floor.y, 12, dt);

    // Stuck detection: if it has not covered ground while trying to, force a
    // re-probe and bias away from the current heading.
    const moved = this.position.distanceTo(this._lastPos);
    this._lastPos.copy(this.position);
    if (this.speed > 0.15 && moved < 0.004) {
      this._stuck += dt;
      if (this._stuck > 0.6) {
        this._stuck = 0;
        this.heading += this.rng.sign() * 0.8;
        this._probeT = 0;
      }
    } else this._stuck = 0;
  }

  // -- state machine -------------------------------------------------------------

  _setState(s) {
    if (this.state === s) return;
    const from = this.state;
    this.state = s;
    this.stateTime = 0;
    // EVERY CAPTURE IS A NEW CAPTURE.
    //
    // `captureT` was initialised once in the constructor and only ever
    // incremented; `_killed` was set true on the first kill and reset nowhere in
    // the file. Neither `despawn()` nor `spawnAt()` touched them, and
    // `Director.respawn()` calls both. So after the Surveyor caught the player
    // once, `captureT` stayed above the 1.35 s threshold and `_killed` stayed
    // true forever — the guard at the bottom of STATE.CAPTURING could never pass
    // again, `game:death` was never emitted again, and the entity simply stood
    // on the player.
    //
    // **It could kill exactly once per page load.** Measured in a delivered
    // session: five threat episodes, two of which reached CAPTURING, and one
    // `game:death` in the whole log. The second capture did nothing and the
    // entity sat in CAPTURING for 41.7 s while the player walked around it.
    if (s === STATE.CAPTURING) {
      this.captureT = 0;
      this.captureBlend = 0;
      this._killed = false;
    }
    this.bus?.emit('entity:state', {
      entity: 'surveyor', state: s, from,
      position: this.position.clone(),
      confidence: +this.confidence.toFixed(3),
      illumination: +this.illumination.toFixed(3),
    });
  }

  update(dt) {
    if (!this.active) return;
    this.stateTime += dt;
    this._sampleLight();

    const p = this.player;
    const toPlayer = _v.set(
      p.position.x - this.position.x, 0, p.position.z - this.position.z);
    const playerDist = toPlayer.length();

    // Belief decays. In darkness it decays *slower*, because it has nothing to
    // do but remember — that is why killing the lights does not simply erase
    // you, it only stops it walking.
    const decay = lerp(0.030, 0.085, this.lightScale);
    this.confidence = clamp01(this.confidence - decay * dt);

    const baseSpeed = lerp(0.82, 1.24, this.aggression);

    switch (this.state) {
      // -------------------------------------------------------------- DORMANT
      case STATE.DORMANT: {
        // IT DRIFTS. A DORMANT SURVEYOR THAT NEVER MOVES IS SCENERY.
        //
        // This used to damp to a stop and hold its pose until something made a
        // noise inside its hearing radius — walking is audible at 14 m, so a
        // player who never comes within 14 m of the exact spot it was placed
        // will not meet it in an hour. Traced through a session: it sat at one
        // point for five minutes while the player's distance to it wandered
        // between 22 and 56 m purely because the *player* was moving.
        //
        // So it patrols, slowly, and not toward the player: `wanderGoal` is a
        // point picked in the player's rough half of the room, far enough away
        // that this is not stalking. What it produces is a distance that
        // changes, which is what makes an encounter possible by geometry rather
        // than only by the Director deciding one should happen.
        this._wanderT -= dt;
        if (this._wanderT <= 0 || !this._wanderGoal) {
          this._wanderT = 9 + this.rng() * 11;
          const a = this.rng() * TAU;
          const r = this.wanderRadius * (0.45 + this.rng() * 0.55);
          this._wanderGoal = {
            x: p.position.x + Math.cos(a) * r,
            z: p.position.z + Math.sin(a) * r,
          };
        }
        // A quarter of seeking speed: audible if you are close, invisible on a
        // distance plot, and never fast enough to be a chase.
        this._moveToward(dt, this._wanderGoal.x, this._wanderGoal.z, baseSpeed * 0.26);
        if (this.confidence > 0.25) this.rouse(this.lastHeard);
        break;
      }

      // --------------------------------------------------------------- ROUSED
      case STATE.ROUSED: {
        // The announcement window. It does not move. The whine is already
        // playing; the player has 3-4 seconds to act on it.
        this.speed = damp(this.speed, 0, 8, dt);
        // The head comes round to the belief first — the only motion in ROUSED.
        this.headYawTarget = this._headingTo(this.lastHeard) - this.heading;
        if (this.stateTime >= (this._rouseLead ?? 3.5)) this._setState(STATE.SEEKING);
        break;
      }

      // -------------------------------------------------------------- SEEKING
      case STATE.SEEKING: {
        const d = Math.hypot(this.lastHeard.x - this.position.x, this.lastHeard.z - this.position.z);
        this._moveToward(dt, this.lastHeard.x, this.lastHeard.z, baseSpeed);

        // A belief that is both fresh and close becomes a commitment. Checked
        // before the measure test, or a player making noise at 2 m would watch
        // it stop and take a reading instead of arriving.
        if (playerDist < 6.5 && this.confidence > 0.55) { this._setState(STATE.APPROACHING); break; }

        // Close enough to the belief, or the belief has faded: measure.
        if (d < 1.7 || this.confidence <= 0.02) {
          this._beginMeasuring();
          break;
        }
        if (this.stateTime > 55) this._setState(STATE.RETREATING);
        break;
      }

      // ------------------------------------------------------------ MEASURING
      case STATE.MEASURING: {
        this.speed = damp(this.speed, 0, 9, dt);
        this.measureHold -= dt * (0.35 + this.lightScale * 0.65);
        this.armReach = damp(this.armReach, 1, 3.2, dt);
        if (this.measureHold <= 0) {
          this.armReach = 0;
          this.patience += 1;
          if (this.confidence > 0.12) {
            this._setState(STATE.SEEKING);
          } else if (this.patience >= 3) {
            this._setState(STATE.RETREATING);
          } else {
            // Wander a short way and measure again. It is surveying, not
            // hunting; the player benefits from that difference.
            const a = this.heading + this.rng.range(-1.1, 1.1);
            this.lastHeard.set(
              this.position.x + Math.sin(a) * this.rng.range(4, 9), this.position.y,
              this.position.z + Math.cos(a) * this.rng.range(4, 9));
            this.confidence = 0.30;
            this._setState(STATE.SEEKING);
          }
        }
        break;
      }

      // ----------------------------------------------------------- APPROACHING
      case STATE.APPROACHING: {
        // Still not a chase: it walks at the belief, which it refreshes only
        // when the player makes noise. A silent player watches it walk past.
        this._moveToward(dt, this.lastHeard.x, this.lastHeard.z, baseSpeed * 1.12);
        if (playerDist < 1.15 && this.lightScale > 0.02) {
          this._setState(STATE.CAPTURING);
          break;
        }
        // It arrived where it believed the sound was, and the sound is not
        // there. This is the notebook's "it went past me and put its hand on
        // the wall behind me" — the single most important non-lethal outcome
        // in the game, and the reward for going quiet after being heard.
        const dBelief = Math.hypot(this.lastHeard.x - this.position.x, this.lastHeard.z - this.position.z);
        if (dBelief < 1.2 && playerDist > 1.6) { this._beginMeasuring(); break; }
        if (this.confidence < 0.10) this._beginMeasuring();
        if (this.stateTime > 26) this._beginMeasuring();
        break;
      }

      // ------------------------------------------------------------ CAPTURING
      case STATE.CAPTURING: {
        // No lunge. It closes the last metre at walking pace, the arms come
        // round, and then the frame is somebody else's problem.
        this.captureT += dt;
        this.captureBlend = clamp01(this.captureT / 1.35);
        const face = Math.atan2(toPlayer.x, toPlayer.z);
        let dh = face - this.heading;
        while (dh > Math.PI) dh -= TAU;
        while (dh < -Math.PI) dh += TAU;
        this.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
        if (playerDist > 0.85) {
          this.position.x += Math.sin(this.heading) * 0.55 * dt;
          this.position.z += Math.cos(this.heading) * 0.55 * dt;
        }
        this.speed = 0.2;
        if (this.captureT > 1.35 && !this._killed) {
          this._killed = true;
          this.bus?.emit('game:death', { cause: 'surveyor', position: this.position.clone() });
        }
        // AND IT MUST BE ABLE TO LET GO.
        //
        // CAPTURING had no exit of its own: it ended only when something outside
        // the entity changed its state, which in practice meant the death →
        // respawn → `despawn()` chain. Any run where that chain did not complete
        // left the Surveyor standing on the player indefinitely. A capture that
        // has not resolved in six seconds has failed; it goes back to looking.
        if (this.stateTime > 6) { this.confidence = 0.35; this._setState(STATE.SEEKING); }
        break;
      }

      // ------------------------------------------------------------ RETREATING
      case STATE.RETREATING: {
        // Walks away from where it last believed anything was, then sleeps.
        const away = _v2.set(
          this.position.x - this.lastHeard.x, 0, this.position.z - this.lastHeard.z);
        if (away.lengthSq() < 0.01) away.set(Math.sin(this.heading), 0, Math.cos(this.heading));
        away.normalize().multiplyScalar(14);
        this._moveToward(dt, this.position.x + away.x, this.position.z + away.z, baseSpeed * 0.8);
        if (this.stateTime > 18) { this.confidence = 0; this._setState(STATE.DORMANT); }
        break;
      }
      default: break;
    }

    this._animate(dt);
    this._applyTransform(dt);
  }

  _beginMeasuring() {
    this.measureHold = this.rng.range(4, 9);
    this.measureSide = this.rng.sign();
    // Find the nearest wall to put a blade on, so the pose has a real target.
    let bestD = 9e9;
    this.measureNormal.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const dx = Math.sin(a), dz = Math.cos(a);
      for (let d = 0.6; d <= 3.2; d += 0.4) {
        const res = this.collision.resolveCapsule(
          this.position.x + dx * d, this.position.y, this.position.z + dz * d, BODY_RADIUS, 1.9);
        if (res.hit) {
          if (d < bestD) { bestD = d; this.measureNormal.set(dx, 0, dz); }
          break;
        }
      }
    }
    this.measureWallDist = bestD < 9e9 ? bestD : 1.6;
    this._setState(STATE.MEASURING);
  }

  _headingTo(v) { return Math.atan2(v.x - this.position.x, v.z - this.position.z); }

  // -- animation ------------------------------------------------------------------

  /**
   * Procedural animation.
   *
   * Everything here is driven by `lightScale`, so when the light goes out the
   * *phase itself* stops advancing. That is not a stylistic choice — it is the
   * literal implementation of "frozen mid-stride". No idle loop ever plays.
   */
  _animate(dt) {
    const bones = this.bones;
    const moving = this.speed > 0.04 && this.lightScale > 0.02;
    this.frozenPose = this.lightScale <= 0.02;

    // ---- ceiling fit ---------------------------------------------------------
    // It is 2.9 m and the Intake ceiling is 2.78 m. Rather than clip through the
    // grid — or shrink it, which would throw away the one number the bible is
    // most specific about — it folds. The knees go over, the pelvis drops and
    // the neck cranes forward under the tee grid. A machine that has to stoop to
    // get through an office is worse than one that fits, and it is the reason
    // its head is always closer to you than its feet are.
    if (this.collision) {
      const ceil = this.collision.ceilingAbove(this.position.x, this.position.z, this.position.y, 0.45);
      const headroom = isFinite(ceil) ? ceil - this.position.y : 99;
      this.stoop = damp(this.stoop, clamp01((HEIGHT + 0.06 - headroom) / 0.85), 6, dt);
    }
    const stoop = this.stoop;

    // The gait phase only advances while it is genuinely walking in light.
    if (moving) {
      // Long stride: 1.55 m at full speed for a 2.9 m body reads as unhurried.
      this.gait += (this.speed / 1.55) * Math.PI * dt;
    }
    const g = this.gait;
    const amp = clamp01(this.speed / 0.9);

    const rest = (b) => (b.userData.rest || null);
    const setRot = (name, x, y, z) => {
      const b = bones[name];
      if (!b) return;
      const r = rest(b);
      if (r) b.rotation.set(r.x + x, r.y + y, r.z + z);
      else b.rotation.set(x, y, z);
    };

    // ---- pelvis: far too much travel ----
    // A human pelvis rises ~25 mm per step and rolls ~5 degrees. This does
    // 70 mm and 16 degrees, and that single exaggeration is most of why the
    // walk is unpleasant to watch.
    const hipY = Math.sin(g * 2) * 0.070 * amp - amp * 0.035 - stoop * 0.42;
    const hipX = Math.sin(g) * 0.075 * amp;
    const hipYaw = Math.sin(g) * 0.28 * amp;
    const hipRoll = Math.sin(g) * 0.16 * amp;
    if (bones.pelvis) {
      bones.pelvis.position.y = PELVIS_Y + hipY;
      bones.pelvis.position.x = hipX;
      setRot('pelvis', Math.sin(g * 2 + 1.1) * 0.05 * amp, hipYaw, hipRoll);
      this._rootBob = 0; this._rootSway = 0; this._rootRoll = 0;
    } else {
      // A GLB rig with no pelvis node still has to have the hip travel — it is
      // the single most recognisable thing about the walk. Drive the whole
      // root instead, which is visually equivalent from any distance.
      this._rootBob = hipY;
      this._rootSway = hipX;
      this._rootRoll = hipRoll * 0.6;
    }

    // ---- torso: counter-rotates, and lags ----
    setRot('torso',
      0.055 + stoop * 0.30 + Math.sin(g * 2 + 0.6) * 0.030 * amp,
      -Math.sin(g - 0.5) * 0.20 * amp,
      -Math.sin(g - 0.4) * 0.06 * amp);

    // ---- neck + head ----
    // The head plate TICKS. It never sweeps: it holds an angle, then snaps to
    // the next one in a couple of frames. Between ticks it is dead still, even
    // while the body walks under it, which is the read that makes it read as
    // an instrument rather than a face.
    if (!this.frozenPose) {
      this.headTickT -= dt;
      if (this.headTickT <= 0) {
        this.headTickT = this.rng.range(0.55, 2.1) * (this.state === STATE.MEASURING ? 2.2 : 1);
        const quantum = Math.PI / 12;                 // 15 degree detents
        let want;
        if (this.state === STATE.CAPTURING) want = 0;
        else if (this.state === STATE.ROUSED || this.confidence > 0.4) {
          // Bias toward the believed sound, snapped to a detent.
          let d = this._headingTo(this.lastHeard) - this.heading;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          want = Math.round(d / quantum) * quantum + (this.rng.chance(0.3) ? quantum * this.rng.sign() : 0);
        } else {
          want = Math.round(this.rng.range(-4, 4)) * quantum;
        }
        this.headYawTarget = clamp(want, -1.9, 1.9);
        this.bus?.emit('entity:tick', { entity: 'surveyor', position: this.position.clone() });
      }
    }
    // Snap, do not sweep: 45 rad/s is effectively instantaneous at 60 fps but
    // still resolves as motion rather than a teleport.
    const dyaw = this.headYawTarget - this.headYaw;
    const maxStep = 26 * dt;
    this.headYaw += clamp(dyaw, -maxStep, maxStep);

    setRot('neck', -0.04 + stoop * 0.46 + Math.sin(g * 2 + 2.0) * 0.018 * amp, this.headYaw * 0.28, 0);
    setRot('head', -stoop * 0.30 + Math.sin(g * 2 + 2.4) * 0.010 * amp - this.captureBlend * 0.35,
      this.headYaw * 0.72, Math.sin(g) * 0.02 * amp);

    // ---- arms ----
    // They trail. The shoulder leads, every segment below it arrives late, and
    // nothing is ever fully straight.
    const measuring = this.state === STATE.MEASURING;
    const reach = this.armReach;
    for (const S of ['L', 'R']) {
      const side = S === 'L' ? -1 : 1;
      const ph = g + (side > 0 ? Math.PI : 0);
      const trail1 = Math.sin(ph) * 0.42 * amp;
      const trail2 = Math.sin(ph - 0.55) * 0.34 * amp;
      const trail3 = Math.sin(ph - 1.05) * 0.26 * amp;

      let upX = -0.10 + trail1;
      let upZ = side * (0.16 + Math.abs(Math.sin(ph)) * 0.05);
      let loX = 0.30 + trail2;
      let wrX = 0.18 + trail3;
      let blX = 0.10 + Math.sin(ph - 1.5) * 0.16 * amp;
      let upY = 0;

      if (measuring && side === this.measureSide) {
        // The measuring pose: the arm comes up and out, and the blade goes flat
        // against the wall. Held rigid — the only still thing in the building.
        let wallAngle = Math.atan2(this.measureNormal.x, this.measureNormal.z) - this.heading;
        while (wallAngle > Math.PI) wallAngle -= TAU;
        while (wallAngle < -Math.PI) wallAngle += TAU;
        upX = lerp(upX, -1.28, reach);
        upY = lerp(0, clamp(wallAngle, -1.2, 1.2), reach);
        upZ = lerp(upZ, side * 0.42, reach);
        loX = lerp(loX, 0.44, reach);
        wrX = lerp(wrX, 0.30, reach);
        blX = lerp(blX, 0.16, reach);
      }
      if (this.captureBlend > 0) {
        // Capture: the arms come *around*, not down. Both, slowly, at chest
        // height, closing on the player.
        const c = this.captureBlend;
        upX = lerp(upX, -1.45, c);
        upZ = lerp(upZ, side * 0.95, c);
        upY = lerp(upY, -side * 0.55, c);
        loX = lerp(loX, 0.95, c);
        wrX = lerp(wrX, 0.70, c);
        blX = lerp(blX, 0.30, c);
      }

      setRot(`arm_upper_${S}`, upX, upY, upZ);
      setRot(`arm_lower_${S}`, loX, 0, 0);
      setRot(`arm_wrist_${S}`, wrX, 0, 0);
      setRot(`blade_${S}`, blX, 0, side * 0.10);
    }

    // ---- legs: reversed knee ----
    for (const S of ['L', 'R']) {
      const side = S === 'L' ? -1 : 1;
      const ph = g + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.sin(ph + Math.PI / 2));
      // Thigh swings forward; shin swings the *wrong* way, which is what a
      // reversed knee is. The foot then over-corrects to stay flat.
      const thigh = swing * 0.62 * amp + stoop * 0.34;
      const shin = -0.30 - lift * 0.85 * amp - stoop * 0.52;
      const foot = 0.24 + lift * 0.55 * amp - swing * 0.20 * amp + stoop * 0.20;
      setRot(`leg_upper_${S}`, thigh, 0, side * 0.03);
      setRot(`leg_lower_${S}`, shin, 0, 0);
      setRot(`foot_${S}`, foot, 0, 0);
    }
  }

  _applyTransform(dt) {
    this.root.position.set(
      this.position.x + Math.cos(this.heading) * (this._rootSway || 0),
      this.position.y + (this._rootBob || 0),
      this.position.z - Math.sin(this.heading) * (this._rootSway || 0));
    this.root.rotation.set(0, this.heading, this._rootRoll || 0);

    // Shadows: it is 2.9 m of steel and it must throw one, but re-rendering the
    // whole shadow atlas every frame is not affordable. Refresh at 4 Hz, and
    // only when it is both moving and near enough for the shadow to be read.
    this._shadowT -= dt;
    if (this._shadowT <= 0) {
      this._shadowT = 0.25;
      const d = this.position.distanceTo(this.player.position);
      if (this.speed > 0.05 && d < 16) this.rig?.invalidateShadows();
    }
  }

  // -- debug -----------------------------------------------------------------------

  /** Contract used by the QA harness and the debug HUD. Keep the keys stable. */
  debugState() {
    return {
      entity: 'surveyor',
      state: this.state,
      stateTime: +this.stateTime.toFixed(2),
      position: [+this.position.x.toFixed(2), +this.position.y.toFixed(2), +this.position.z.toFixed(2)],
      heading: +this.heading.toFixed(3),
      target: [+this.lastHeard.x.toFixed(2), +this.lastHeard.y.toFixed(2), +this.lastHeard.z.toFixed(2)],
      confidence: +this.confidence.toFixed(3),
      illumination: +this.illumination.toFixed(3),
      lightScale: +this.lightScale.toFixed(3),
      speed: +this.speed.toFixed(3),
      frozen: this.frozenPose,
      stoop: +this.stoop.toFixed(2),
      measureHold: +Math.max(0, this.measureHold).toFixed(2),
      distToPlayer: +this.position.distanceTo(this.player.position).toFixed(2),
      usingGlb: this.usingGlb,
    };
  }

  dispose() {
    for (const u of this._noiseUnsub) u();
    this.root.removeFromParent();
  }
}

export default Surveyor;
