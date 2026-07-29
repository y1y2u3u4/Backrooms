import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Assets } from './core/Assets.js';
import { Bus, clamp01, damp } from './core/util.js';
import { TextureForge } from './render/TextureForge.js';
import { MaterialLibrary, updateMaterialGlobals, setWetness, materialGlobals } from './render/Materials.js';
import { LightRig } from './render/Lighting.js';
import { FOG_PROFILES } from './render/AtmosphereFog.js';
import { CollisionWorld } from './player/Physics.js';
import { Player } from './player/Player.js';
import { buildPalette } from './world/Palette.js';
import { buildIntake } from './world/zones/IntakeZone.js';

/**
 * Game — the integrator.
 *
 * Owns boot order, the frame loop and the wiring between subsystems that are
 * authored independently (world, audio, gameplay, UI/cinematics). Every one of
 * those is loaded through `optional()`: if a module is not present yet, or
 * throws on construction, the game logs it once and runs without it. That is
 * what lets the build stay playable and screenshot-able while several parts of
 * it are still being written.
 *
 * The QA harness drives this object directly through `window.ANNEX`.
 */

/**
 * Registry of every module that actually exists in the subsystem directories.
 *
 * A bare `import('./world/World.js')` fails the *build* when the file is not
 * there — rollup resolves dynamic imports statically. `import.meta.glob` only
 * matches files present at build time, so a subsystem that has not been written
 * yet simply does not appear in the map and the game runs without it.
 */
const MODULES = {
  ...import.meta.glob('./world/**/*.js'),
  ...import.meta.glob('./audio/**/*.js'),
  ...import.meta.glob('./ui/**/*.js'),
  ...import.meta.glob('./cinematics/**/*.js'),
  ...import.meta.glob('./systems/**/*.js'),
  ...import.meta.glob('./entities/**/*.js'),
  ...import.meta.glob('./player/**/*.js'),
};

async function optional(name, path) {
  const loader = MODULES['./' + path];
  if (!loader) {
    console.info(`[game] optional subsystem "${name}" not present (${path})`);
    return null;
  }
  try {
    return await loader();
  } catch (e) {
    console.warn(`[game] optional subsystem "${name}" failed to load`, e);
    return null;
  }
}

export class Game {
  constructor({ canvas, uiRoot }) {
    this.bus = new Bus();
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this._last = performance.now();
    this.running = false;
    this.time = 0;
    this.paused = false;
    this.ready = false;
    this.state = 'boot';        // boot | menu | play | cine | dead | ended
    this.qa = new URLSearchParams(location.search).get('qa') === '1';
    this.subsystems = {};
  }

  // -------------------------------------------------------------------------

  async boot(onProgress = () => {}) {
    const P = (v, m) => onProgress(v, m);

    P(0.02, 'initialising renderer');
    this.engine = new Engine(this.canvas, { quality: detectQuality() });
    this.input = new Input(this.canvas);

    P(0.05, 'forging surfaces');
    this.forge = new TextureForge({ quality: this.engine.q.textureQuality });
    await this.forge.forgeAll((p, name) => P(0.05 + p * 0.50, `forging ${name}`));

    P(0.56, 'mixing materials');
    this.materials = new MaterialLibrary(this.forge, { envMap: this.engine.envMap });
    materialGlobals.uStochastic.value = this.engine.q.stochastic;
    this.palette = buildPalette(this.materials);

    P(0.58, 'unpacking assets');
    this.assets = new Assets({ materials: this.materials, palette: this.palette });
    await this.assets.loadManifest();
    const manifestNames = (this.assets.manifest?.assets || []).map((a) =>
      (a.file || a.name || '').replace(/\.glb$/, '')).filter(Boolean);
    if (manifestNames.length) {
      await this.assets.loadAll(manifestNames, (p, n) => P(0.58 + p * 0.10, `loading ${n}`));
    }

    P(0.69, 'raising structure');
    this.collision = new CollisionWorld();
    this.rig = new LightRig(this.engine.scene, {
      maxShadows: this.engine.q.maxShadows,
      shadowMapSize: this.engine.q.shadowMap,
    });

    this.ctx = {
      materials: this.materials,
      collision: this.collision,
      rig: this.rig,
      palette: this.palette,
      scene: this.engine.scene,
      bus: this.bus,
      assets: this.assets,
      engine: this.engine,
    };

    // ---- world ------------------------------------------------------------
    const worldMod = await optional('world', 'world/World.js');
    if (worldMod?.createWorld) {
      // A half-finished world must not take the whole build down with it.
      try {
        this.world = worldMod.createWorld(this.ctx);
        await this.world.boot?.((p, m) => P(0.69 + p * 0.16, m));
        this.subsystems.world = true;
      } catch (e) {
        console.error('[game] world failed to build; falling back to Intake', e);
        this.world = null;
        this.subsystems.worldError = String(e.message || e);
      }
    }
    if (!this.world) {
      // Fallback: the Intake zone alone. Always keeps the build runnable.
      const intake = buildIntake(this.ctx, {});
      this.engine.scene.add(intake.root);
      this.world = makeSingleZoneWorld(intake, this.engine);
    }
    P(0.86, 'settling dust');

    // ---- player -----------------------------------------------------------
    this.player = new Player({
      collision: this.collision,
      camera: this.engine.camera,
      bus: this.bus,
    });
    const spawn = this.world.spawn || [0, 0, 0];
    this.player.teleport(spawn[0], spawn[1], spawn[2], this.world.spawnYaw || 0);
    // World.enter() needs to move the body when a portal is used.
    this.world.attachPlayer?.(this.player);
    this.applyZoneProfile(this.world.currentZone || 'intake', { immediate: true });

    // ---- optional subsystems ---------------------------------------------
    await this._bootAudio(P);
    await this._bootGameplay(P);
    await this._bootUI(P);

    // ---- finish -----------------------------------------------------------
    this.engine.renderer.shadowMap.needsUpdate = true;
    P(0.97, 'compiling shaders');
    this.engine.renderer.compile(this.engine.scene, this.engine.camera);

    this.menuCamera = this._makeMenuCamera();

    this.canvas.addEventListener('click', () => {
      if (this.ready && this.state === 'play') this.input.requestLock();
    });
    this.input.on('press:cancel', () => this.togglePause());

    this.ready = true;
    this.state = this.qa ? 'play' : 'menu';
    P(1, 'ready');
    return this;
  }

  async _bootAudio(P) {
    P(0.88, 'tuning the hum');
    const mod = await optional('audio', 'audio/index.js');
    if (!mod?.createAudio) return;
    try {
      this.audio = mod.createAudio({
        bus: this.bus, collision: this.collision,
        camera: this.engine.camera, rig: this.rig,
        options: { quality: this.engine.qualityName },
      });
      this.audio.bindPlayer?.(this.player);
      this.subsystems.audio = true;
      // AudioContext needs a gesture; arm it on the first interaction.
      const arm = () => { this.audio.init?.(); window.removeEventListener('pointerdown', arm); window.removeEventListener('keydown', arm); };
      window.addEventListener('pointerdown', arm);
      window.addEventListener('keydown', arm);
    } catch (e) { console.warn('[game] audio failed to construct', e); }
  }

  /**
   * The gameplay layer installs itself as one unit — see
   * docs/INTEGRATION_REQUESTS_GAMEPLAY.md. It owns the flashlight, hands,
   * inventory, interactor, entities, director and progression, and asserts its
   * own internal update order, so this must not try to step the parts.
   */
  async _bootGameplay(P) {
    P(0.91, 'winding the clock');
    const mod = await optional('gameplay', 'systems/GameplayBoot.js');
    if (!mod?.installGameplay) return;
    try {
      this.gameplay = await mod.installGameplay(this, {
        // Zone builders emit their own props; the demo seeding is only for
        // running the gameplay layer against the bare Intake fallback.
        seedDemo: !this.subsystems.world,
        surveyor: true,
        assets: this.assets ?? null,
        quality: this.engine.qualityName,
      });
      // Convenience aliases so QA and cinematics do not have to know the shape.
      this.flashlight = this.gameplay.flashlight;
      this.hands = this.gameplay.hands;
      this.inventory = this.gameplay.inventory;
      this.interactor = this.gameplay.interactor;
      this.entities = this.gameplay.surveyor ? { surveyor: this.gameplay.surveyor } : null;
      this.director = this.gameplay.director;
      this.progression = this.gameplay.progression;
      this.subsystems.gameplay = true;
    } catch (e) {
      console.error('[game] gameplay failed to install', e);
      this.subsystems.gameplayError = String(e.message || e);
    }
  }

  async _bootUI(P) {
    P(0.94, 'printing the docket');
    const mod = await optional('ui', 'ui/UI.js');
    if (mod?.createUI) {
      try {
        this.ui = mod.createUI({
          bus: this.bus, root: this.uiRoot, engine: this.engine,
          player: this.player, game: this, input: this.input, rig: this.rig,
        });
        this.subsystems.ui = true;
      } catch (e) { console.error('[game] UI failed to construct', e); }
    }

    // createUI already builds a fully-wired sequencer with every sequence
    // registered and exposes it as `ui.cine`. Constructing a second one here
    // would put two sequencers on the same camera in the same frame, and
    // whichever ran last would win non-deterministically.
    this.sequencer = this.ui?.cine || null;
    this.subsystems.cinematics = !!this.sequencer;

    // The UI is the only thing that knows what the player clicked; route its
    // actions into game state here rather than letting it drive the game
    // directly, so there is one place that owns the state machine.
    this.bus.on('ui:action', (e) => this._onUiAction(e));
    // World.enter() emits this. Without it the bounce fill and the light budget
    // stay on whatever the boot zone set, so walking into the Cistern keeps
    // Intake's bright office fill and walking into Intake from the Cistern
    // keeps its dark one.
    this.bus.on('zone:enter', (e) => {
      const key = e?.zone || e?.id;
      if (key) this.applyZoneProfile(key, { immediate: !!e?.immediate });
    });
    this.bus.on('ui:settings', (st) => {
      if (st && typeof st.motion === 'number') this.player.motionScale = st.motion;
      if (st && typeof st.fov === 'number') this.player.fovBase = st.fov;
      if (st && typeof st.sensitivity === 'number') this.input.sensitivity = st.sensitivity;
      if (st && typeof st.invertY === 'boolean') this.input.invertY = st.invertY;
      if (st && st.quality) this.engine.setQuality(st.quality);
    });
  }

  _onUiAction({ action, ...data } = {}) {
    switch (action) {
      case 'begin':
      case 'continue':
        this.startRun({ fresh: action === 'begin' });
        break;
      case 'resume':
        if (this.paused) this.togglePause();
        break;
      case 'abandon':
        this.state = 'menu';
        this.paused = false;
        this.input.exitLock();
        this.ui?.show?.('title');
        break;
      case 'retry':
      case 'respawn':
        this.respawn(data);
        break;
      case 'ending:done':
        this.state = 'menu';
        this.ui?.show?.('title');
        break;
      default: break;
    }
  }

  /** Enter play. Runs the intro sequence if cinematics are available. */
  startRun({ fresh = true } = {}) {
    // Put the body back where the menu camera drifted away from.
    const spawn = this.world?.spawn || [0, 0, 0];
    if (fresh) this.player.teleport(spawn[0], spawn[1], spawn[2], this.world?.spawnYaw || 0);
    this.state = 'play';
    this.paused = false;
    this.ui?.show?.(null);
    this.input.requestLock();
    this.audio?.init?.();
    if (fresh && this.sequencer?.play) {
      this.sequencer.play('intro');
    }
  }

  /** Death -> respawn. The world is expected to have shifted slightly. */
  respawn() {
    this.progression?.respawn?.();
    const point = this.progression?.lastSafePoint?.() || this.world?.spawn || [0, 0, 0];
    const yaw = this.progression?.lastSafeYaw?.() ?? this.world?.spawnYaw ?? 0;
    this.player.teleport(point[0], point[1], point[2], yaw);
    this.player.controlEnabled = true;
    this.player.lookEnabled = true;
    this.player.frozen = false;
    this.engine.exposure.reset();
    this.state = 'play';
    this.ui?.show?.(null);
    if (this.sequencer?.play) this.sequencer.play('respawn');
  }

  // -------------------------------------------------------------------------

  /** Apply a zone's atmosphere, wetness and reverb in one place. */
  applyZoneProfile(zoneKey, { immediate = false } = {}) {
    const profile = FOG_PROFILES[zoneKey] || FOG_PROFILES.intake;
    this.engine.atmosphere.set(profile, immediate);
    const z = this.world?.zones?.[zoneKey];
    setWetness(z?.waterLine ?? -999, z?.wetness ?? 0);
    const amb = AMBIENT_PROFILES[zoneKey] || AMBIENT_PROFILES.intake;
    this.rig.setAmbient(amb.sky, amb.ground, amb.intensity);
    if (immediate) this.rig.snapAmbient();
    // The zone asks for a budget; the quality tier caps it.
    this.rig.setLightBudget(Math.min(
      z?.lightBudget ?? DEFAULT_LIGHT_BUDGET, this.engine.q.lights));
    // Hands live in a separate scene, so they need the zone's mood pushed to
    // them explicitly or they read as a flat cut-out pasted over the world.
    this._zoneAmbient = amb;
    this.audio?.setZone?.(z?.reverb || zoneKey);
    this.currentZone = zoneKey;
  }

  togglePause() {
    if (this.state !== 'play' && this.state !== 'paused') return;
    this.paused = !this.paused;
    this.state = this.paused ? 'paused' : 'play';
    if (this.paused) this.input.exitLock(); else this.input.requestLock();
    this.ui?.show?.(this.paused ? 'pause' : null);
    // setDuck holds until released; duck() is a dip that recovers on its own,
    // which would let the world back in half a second into a pause.
    if (this.audio?.engine?.setDuck) this.audio.engine.setDuck(this.paused ? 0.6 : 0, 0.3);
    else this.audio?.duck?.(this.paused ? 0.6 : 0, 0.3);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const loop = () => {
      if (!this.running) return;
      this._frame();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this._raf); }

  /**
   * Menu camera.
   *
   * A static title plate says "this is a menu"; a camera that is *already*
   * inside the building, drifting, says "this place exists and you are about to
   * be in it". The move is deliberately almost imperceptible — a slow dolly
   * with a long lateral drift and a barely-there breath, so nothing in frame
   * ever quite settles.
   */
  _makeMenuCamera() {
    const cam = this.engine.camera;
    const spawn = this.world?.spawn || [0, 0, 0];
    const yaw0 = (this.world?.spawnYaw || 0) + 0.35;
    let t = 0;
    return {
      reset: () => { t = 0; },
      update: (dt) => {
        t += dt;
        const drift = Math.sin(t * 0.055) * 2.6;
        const dolly = Math.sin(t * 0.031 + 1.1) * 1.4;
        const yaw = yaw0 + Math.sin(t * 0.041) * 0.16;
        cam.position.set(
          spawn[0] + Math.cos(yaw0) * drift + Math.sin(yaw0) * dolly,
          spawn[1] + 1.58 + Math.sin(t * 0.21) * 0.012,
          spawn[2] - Math.sin(yaw0) * drift + Math.cos(yaw0) * dolly);
        cam.rotation.set(
          Math.sin(t * 0.037 + 2.2) * 0.035 - 0.02,
          yaw,
          Math.sin(t * 0.029) * 0.008,
          'YXZ');
        cam.updateMatrixWorld();
      },
    };
  }

  _frame() {
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.time += dt;
    if (!this.paused) {
      this.step(dt);
    } else {
      // The pause screen is a translucent scrim over a *living* room. Freezing
      // the whole step stops the light flicker and it reads as a screenshot.
      updateMaterialGlobals(dt);
      this.rig.update(dt, this.engine.camera, this.engine.renderer);
      this.ui?.update?.(dt);
    }
    this.engine.render(dt);
    this.input.endFrame();
  }

  /** One logic step. Split out so the QA harness can advance deterministically. */
  step(dt) {
    updateMaterialGlobals(dt);

    // Order is load-bearing and is asserted by the gameplay and UI layers:
    //   1. player integrates motion and emits noise/step events
    //   2. gameplay reads the FINAL camera matrix (flashlight aim, interaction
    //      raycast), then steps props, entities, director and hands
    //   3. the world streams against the settled player position
    //   4. the light rig runs last so it sees any circuit change made this frame
    //   5. ui.update() runs the sequencer — which must come after the player,
    //      because Player._applyCamera writes the camera every frame even when
    //      frozen — and then composes the grade, before engine.render()
    if (this.state === 'menu') {
      // The title screen sits over a live world, not a plate. The player body
      // stays parked; only the camera drifts.
      this.menuCamera.update(dt);
    } else {
      this.player.update(dt, this.input);
    }
    this.gameplay?.update?.(dt, this.input);
    this.world?.update?.(dt, this.player.position);
    this.rig.update(dt, this.engine.camera, this.engine.renderer);

    // Overlay mood: the fill follows the zone, the key follows the lamp and the
    // light actually falling on the player, so hands darken when the player
    // walks out of a lit bay and brighten under a working fixture.
    {
      const amb = this._zoneAmbient || AMBIENT_PROFILES.intake;
      const p = this.player.position;
      const roomLight = clamp01(this.rig.illuminationAt(p.x, p.y + 1.2, p.z) * 0.6);
      const lamp = this.flashlight
        ? clamp01((this.flashlight.beamStrength ?? (this.flashlight.isOn ? 1 : 0)))
        : 0;
      this.engine.setOverlayLighting(
        amb.sky, amb.ground,
        0.35 + amb.intensity * 0.5 + roomLight * 0.9,
        0.5 + roomLight * 1.6 + lamp * 2.2);
    }

    this.audio?.update?.(dt, this.player.position);
    this.ui?.update?.(dt);

    // Fear feeds the grade and the player's breathing. Kept here so there is
    // exactly one writer, whatever combination of subsystems is present.
    const fear = clamp01(this.gameplay?.director?.fear ?? this.director?.fear ?? 0);
    this.player.fear = damp(this.player.fear, fear, 2.2, dt);
    if (!this.subsystems.cinematics) {
      this.engine.grade.uniforms.uDread.value =
        damp(this.engine.grade.uniforms.uDread.value, fear * 0.8, 1.6, dt);
    }
  }

  // ---- QA hooks -----------------------------------------------------------

  renderOnce(dt = 1 / 60) { this.step(dt); this.engine.render(dt); }

  /**
   * Place the camera for a capture.
   *
   * Resolves out of geometry and snaps to the floor first: a portal arrival
   * point sits in a doorway, and dropping the eye there puts it inside a 160 mm
   * wall, which then reads as a blown-out wash because at 200 mm from a surface
   * lit by a fixture 2.7 m up the inverse square law is merciless.
   */
  look(x, y, z, yaw = 0, pitch = 0) {
    const res = this.collision.resolveCapsule(
      x, y, z, this.player.radius + 0.08, this.player.height);
    const floor = this.collision.sampleFloor(res.x, res.z, y + 1.2, 2.5);
    this.player.teleport(res.x, floor ? floor.y : y, res.z, yaw);
    this.player.pitch = pitch;
    this.player.bobAmount = 0;
    this.player.velocity.set(0, 0, 0);
    this.engine.exposure.reset();
    this.player.update(1 / 60, null);
  }

  /**
   * QA hook: place the camera somewhere with an actual sightline.
   *
   * A doorway faces a wall as often as it faces a room — the first
   * zone-coverage capture produced a dozen frames of blown-out wallpaper 40 cm
   * from the lens. This probes the collision world for the clearest direction,
   * biases it toward the requested heading so shots stay roughly authored
   * rather than arbitrary, and steps into the open space.
   *
   * @param {number[]} pos [x, y, z] starting point (usually a portal arrival)
   * @param {number} prefer preferred yaw in radians
   */
  lookOpen(pos, prefer = 0, pitch = 0, { samples = 16, advance = 1.6, maxRange = 24 } = {}) {
    const [x0, y0, z0] = pos;
    const res = this.collision.resolveCapsule(
      x0, y0, z0, this.player.radius + 0.08, this.player.height);
    const floor = this.collision.sampleFloor(res.x, res.z, y0 + 1.2, 2.5);
    const y = floor ? floor.y : y0;
    const eye = y + 1.6;

    let bestYaw = prefer, bestScore = -1;
    for (let i = 0; i < samples; i++) {
      const yaw = (i / samples) * Math.PI * 2;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      let clear = 0;
      for (let d = 1; d <= maxRange; d += 1) {
        if (this.collision.segmentBlocked(res.x, eye, res.z,
          res.x + fx * d, eye, res.z + fz * d, 'ceiling')) break;
        clear = d;
      }
      // A shot pointing the way the designer meant is worth a few metres of
      // depth, so the authored heading gets a bonus rather than a veto.
      const delta = Math.abs(((yaw - prefer + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const score = clear + Math.max(0, 1 - delta / Math.PI) * 6;
      if (score > bestScore) { bestScore = score; bestYaw = yaw; }
    }

    const fx = -Math.sin(bestYaw), fz = -Math.cos(bestYaw);
    let step = 0;
    for (let d = 0.4; d <= advance; d += 0.4) {
      if (this.collision.segmentBlocked(res.x, eye, res.z,
        res.x + fx * (d + 0.6), eye, res.z + fz * (d + 0.6), 'ceiling')) break;
      step = d;
    }
    let cx = res.x + fx * step, cz = res.z + fz * step;

    // Centre laterally. Standing against a side wall puts a brightly-lit
    // surface across half the frame at 0.4 m, which is both a bad composition
    // and the thing most likely to fool the auto-exposure.
    const rx = Math.cos(bestYaw), rz = -Math.sin(bestYaw);
    const clearSide = (sign) => {
      let c = 0;
      for (let d = 0.5; d <= 8; d += 0.5) {
        if (this.collision.segmentBlocked(cx, eye, cz,
          cx + rx * sign * d, eye, cz + rz * sign * d, 'ceiling')) break;
        c = d;
      }
      return c;
    };
    const left = clearSide(-1), right = clearSide(1);
    const shift = Math.max(-1.4, Math.min(1.4, (right - left) * 0.5));
    cx += rx * shift; cz += rz * shift;

    this.look(cx, y, cz, bestYaw, pitch);
    return { position: [cx, y, cz], yaw: bestYaw, clearance: bestScore };
  }

  walkTo(x, z, seconds = 1) {
    const p = this.player;
    const steps = Math.max(1, Math.round(seconds * 60));
    const sx = p.position.x, sz = p.position.z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      p.position.x = sx + (x - sx) * t;
      p.position.z = sz + (z - sz) * t;
      this.renderOnce(1 / 60);
    }
  }

  /** Report which optional subsystems actually loaded. */
  status() {
    return {
      state: this.state,
      zone: this.currentZone,
      subsystems: { ...this.subsystems },
      engine: this.engine.stats,
      lights: this.rig.stats,
      entity: this.gameplay?.surveyor?.debugState?.() ?? null,
      gameplay: this.gameplay?.debugState?.() ?? null,
      // A stuck AudioContext is the most likely audio failure in the field and
      // is completely invisible without this.
      audio: this.audio?.stats ?? null,
    };
  }
}

/**
 * Per-zone bounce fill. See LightRig.setAmbient — this stands in for the
 * inter-reflection a real room would have and is the main lever on how open or
 * how oppressive a zone feels before any fixture is placed.
 */
/** Simultaneous dynamic lights outside the two big-volume zones. */
export const DEFAULT_LIGHT_BUDGET = 12;

export const AMBIENT_PROFILES = {
  // NOTE ON UNITS. A HemisphereLight's intensity is irradiance, and it is
  // multiplied by the colour — so what matters is colour x intensity, and it
  // has to land in the same range as a real fixture's irradiance to register at
  // all. A troffer 2.7 m up delivers roughly 5 units at the floor; a fill of
  // 0.14 (which is what a dark brown at intensity 1.3 gives) is 36x below the
  // direct light and reads as pure black next to it. These values are chosen so
  // an unlit wall face sits about two stops under a lit one, which is what a
  // real room with white ceilings actually does.
  intake:    { sky: 0x8e897a, ground: 0xa39c8a, intensity: 1.75 },
  service:   { sky: 0x5e646c, ground: 0x6c7178, intensity: 0.70 },
  cistern:   { sky: 0x46545a, ground: 0x4e5e5e, intensity: 0.50 },
  residence: { sky: 0x7e7462, ground: 0x8e806a, intensity: 1.05 },
  plant:     { sky: 0x565e66, ground: 0x666861, intensity: 0.75 },
  duct:      { sky: 0x34322d, ground: 0x3c3a34, intensity: 0.30 },
  stack:     { sky: 0x8a8c98, ground: 0x9a9ca6, intensity: 1.55 },
  safe:      { sky: 0x8e7e62, ground: 0x9c8862, intensity: 1.30 },
  void:      { sky: 0x000000, ground: 0x000000, intensity: 0.0 },
};

/** Minimal World shim used when `src/world/World.js` is not present. */
function makeSingleZoneWorld(zone, engine) {
  return {
    root: zone.root,
    spawn: zone.spawn,
    spawnYaw: zone.spawnYaw,
    currentZone: 'intake',
    zones: { intake: zone },
    update() {},
    enter() {},
  };
}

function detectQuality() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');
  if (forced && ['low', 'medium', 'high'].includes(forced)) return forced;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 2) return 'low';
  if (mem <= 8 && cores <= 4) return 'medium';
  return 'high';
}

export default Game;
