import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Assets } from './core/Assets.js';
import { Bus, clamp01, damp } from './core/util.js';
import { TextureForge } from './render/TextureForge.js';
import { MaterialLibrary, updateMaterialGlobals, setWetness } from './render/Materials.js';
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
    this.applyZoneProfile(this.world.currentZone || 'intake');

    // ---- optional subsystems ---------------------------------------------
    await this._bootAudio(P);
    await this._bootGameplay(P);
    await this._bootUI(P);

    // ---- finish -----------------------------------------------------------
    this.engine.renderer.shadowMap.needsUpdate = true;
    P(0.97, 'compiling shaders');
    this.engine.renderer.compile(this.engine.scene, this.engine.camera);

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

    const cine = await optional('cinematics', 'cinematics/index.js');
    if (cine?.createSequencer) {
      try {
        this.sequencer = cine.createSequencer({
          bus: this.bus, engine: this.engine, player: this.player,
          game: this, ui: this.ui, rig: this.rig,
        });
        cine.installCinematics?.(this.sequencer);
        this.subsystems.cinematics = true;
      } catch (e) { console.error('[game] cinematics failed to construct', e); }
    }

    // The UI is the only thing that knows what the player clicked; route its
    // actions into game state here rather than letting it drive the game
    // directly, so there is one place that owns the state machine.
    this.bus.on('ui:action', (e) => this._onUiAction(e));
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
    this.player.teleport(point[0], point[1], point[2], this.world?.spawnYaw || 0);
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
    const amb = z?.ambient || AMBIENT_PROFILES[zoneKey] || AMBIENT_PROFILES.intake;
    this.rig.setAmbient(amb.sky, amb.ground, amb.intensity);
    this.audio?.setZone?.(z?.reverb || zoneKey);
    this.currentZone = zoneKey;
  }

  togglePause() {
    if (this.state !== 'play' && this.state !== 'paused') return;
    this.paused = !this.paused;
    this.state = this.paused ? 'paused' : 'play';
    if (this.paused) this.input.exitLock(); else this.input.requestLock();
    this.ui?.show?.(this.paused ? 'pause' : null);
    this.audio?.duck?.(this.paused ? 0.6 : 0, 0.3);
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

  _frame() {
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.time += dt;
    if (!this.paused) this.step(dt);
    else this.ui?.update?.(dt);
    this.engine.render(dt);
    this.input.endFrame();
  }

  /** One logic step. Split out so the QA harness can advance deterministically. */
  step(dt) {
    updateMaterialGlobals(dt);

    // Order is load-bearing and is asserted by the gameplay layer:
    //   1. cinematics may move or lock the camera
    //   2. player integrates motion and emits noise/step events
    //   3. gameplay reads the FINAL camera matrix (flashlight aim, interaction
    //      raycast), then steps props, entities, director and hands
    //   4. the world streams against the settled player position
    //   5. the light rig runs last so it sees any circuit change made this frame
    this.sequencer?.update?.(dt);
    this.player.update(dt, this.input);
    this.gameplay?.update?.(dt, this.input);
    this.world?.update?.(dt, this.player.position);
    this.rig.update(dt, this.engine.camera, this.engine.renderer);
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

  look(x, y, z, yaw = 0, pitch = 0) {
    this.player.teleport(x, y, z, yaw);
    this.player.pitch = pitch;
    this.player.bobAmount = 0;
    this.player.velocity.set(0, 0, 0);
    this.engine.exposure.reset();
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
    };
  }
}

/**
 * Per-zone bounce fill. See LightRig.setAmbient — this stands in for the
 * inter-reflection a real room would have and is the main lever on how open or
 * how oppressive a zone feels before any fixture is placed.
 */
export const AMBIENT_PROFILES = {
  intake:    { sky: 0x342b1c, ground: 0x5e5138, intensity: 0.78 },
  service:   { sky: 0x161a1e, ground: 0x24262a, intensity: 0.26 },
  cistern:   { sky: 0x0d1416, ground: 0x18211f, intensity: 0.20 },
  residence: { sky: 0x241c14, ground: 0x40311e, intensity: 0.38 },
  plant:     { sky: 0x141820, ground: 0x2a2620, intensity: 0.30 },
  duct:      { sky: 0x0e0d0c, ground: 0x131211, intensity: 0.10 },
  stack:     { sky: 0x1a1a20, ground: 0x2a2a30, intensity: 0.34 },
  safe:      { sky: 0x2a2116, ground: 0x4a3a20, intensity: 0.46 },
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
