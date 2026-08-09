import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Assets } from './core/Assets.js';
import { Bus, clamp01, damp } from './core/util.js';
import { TextureForge } from './render/TextureForge.js';
import { MaterialLibrary, updateMaterialGlobals, setWetness, materialGlobals } from './render/Materials.js';
import { LightRig } from './render/Lighting.js';
import { AOVolume } from './render/AOVolume.js';
import { Motes } from './render/Motes.js';
import { FOG_PROFILES } from './render/AtmosphereFog.js';
import { CollisionWorld } from './player/Physics.js';
import { Player } from './player/Player.js';
import { buildPalette } from './world/Palette.js';
import { buildIntake } from './world/zones/IntakeZone.js';
import * as SaveGame from './systems/SaveGame.js';

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
    // `readback` is only wanted by the QA harnesses, which pull frames out of
    // the canvas with toDataURL. It maps to preserveDrawingBuffer, which asks
    // the driver to keep the back buffer alive after presentation and costs a
    // full-frame copy on tile-based GPUs. Players do not need it.
    this.engine = new Engine(this.canvas, { quality: detectQuality(), readback: this.qa });
    this.input = new Input(this.canvas);

    // THE BAR WAS WEIGHTED BY GUESS, AND THE GUESS WAS BACKWARDS.
    //
    // Texture synthesis was allotted half the bar. Timed on the deployed build
    // at the high tier: the fourteen surfaces take **0.85 s of a 9.5 s boot**,
    // about 9%, while the two phases that actually dominate — the hero assets
    // at 2.4 s and raising the first zone at 2.9 s — were given 10% and 16%
    // between them. A player watched the bar rush to 55% and then sit there for
    // most of the wait, which is the shape that reads as "it has hung".
    //
    // The weights below are the measured proportions, rounded. They are a
    // measurement and they will drift; `tools/qa/boot.mjs` is how to re-take
    // them rather than re-guess.
    P(0.04, 'forging surfaces');
    this.forge = new TextureForge({ quality: this.engine.q.textureQuality });
    await this.forge.forgeAll((p, name) => P(0.04 + p * 0.10, `forging ${name}`));

    P(0.15, 'mixing materials');
    this.materials = new MaterialLibrary(this.forge, { envMap: this.engine.envMap });
    materialGlobals.uStochastic.value = this.engine.q.stochastic;
    this.palette = buildPalette(this.materials);

    P(0.17, 'unpacking assets');
    this.assets = new Assets({ materials: this.materials, palette: this.palette });
    await this.assets.loadManifest();
    const manifestNames = (this.assets.manifest?.assets || []).map((a) =>
      (a.file || a.name || '').replace(/\.glb$/, '')).filter(Boolean);
    if (manifestNames.length) {
      await this.assets.loadAll(manifestNames, (p, n) => P(0.17 + p * 0.24, `loading ${n}`));
    }

    P(0.42, 'raising structure');
    this.collision = new CollisionWorld();
    this.rig = new LightRig(this.engine.scene, {
      maxShadows: this.engine.q.maxShadows,
      shadowMapSize: this.engine.q.shadowMap,
    });

    // Airborne dust. Cheap — one draw call, no per-frame CPU work beyond a few
    // uniforms — and it is what stops a room reading as an empty volume with
    // surfaces at the far end. See Motes.js.
    this.motes = new Motes({ count: this.engine.q.motes ?? 2600 }).addTo(this.engine.scene);

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
    // SHADER PRE-WARM PER ZONE.
    //
    // Boot compiles the start zone's programs (see the end of this method), and
    // nothing compiled the other seven. Every zone introduces materials the
    // renderer has not seen — the Cistern's water, the Stack's spandrel glow, the
    // Plant's high-bay cones — so the FIRST FRAME after a transition compiled
    // them all, and a continuous session recorded that as an 11-second frame with
    // a p99 of 7 ms either side of it. On a real GPU it is a hitch rather than a
    // stall, but it is the same hitch, and it lands on the one frame the player
    // is looking at a room they have never seen.
    //
    // Compiling at BUILD time moves it to where the build already is: either the
    // loading screen, or `World._preload`, which raises a neighbour a portal
    // leads to while the player is still walking toward it. The zone's own root
    // is the target and the scene supplies the lights, so this compiles the new
    // material set and not the whole building again.
    // `compileAsync` rather than `compile`, and awaited by nobody on purpose.
    // Where `KHR_parallel_shader_compile` exists — every current desktop and
    // mobile GPU driver — three links the programs off the main thread and the
    // promise resolves when they are ready, so the work leaves the frame entirely.
    // Where it does not, it degrades to the synchronous path.
    //
    // Measured here: on a software rasteriser (SwiftShader, no GPU, which is what
    // this environment has) compiling the start zone costs about 190 seconds. That
    // is not a number a real GPU produces, but it is a fair indication of how much
    // work was landing on one frame after every transition. `?prewarm=0` turns it
    // off, which is how the CPU-bound QA harness stays runnable.
    this._prewarm = new URLSearchParams(location.search).get('prewarm') !== '0';
    this.bus.on('zone:build', (e) => {
      if (!this._prewarm) return;
      const z = this.world?.zones?.[e?.zone];
      if (!z?.root || !this.engine?.renderer) return;
      const t0 = performance.now();
      const done = () => {
        const ms = performance.now() - t0;
        if (ms > 40) console.info(`[game] pre-warmed ${e.zone} shaders in ${ms.toFixed(0)} ms`);
      };
      try {
        const r = this.engine.renderer;
        if (r.compileAsync) r.compileAsync(z.root, this.engine.camera, this.engine.scene).then(done, done);
        else { r.compile(z.root, this.engine.camera, this.engine.scene); done(); }
      } catch (err) {
        console.warn('[game] shader pre-warm failed for', e?.zone, err);
      }
    });

    const worldMod = await optional('world', 'world/World.js');
    if (worldMod?.createWorld) {
      // A half-finished world must not take the whole build down with it.
      try {
        this.world = worldMod.createWorld(this.ctx);
        await this.world.boot?.((p, m) => P(0.42 + p * 0.42, m));
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
    P(0.85, 'settling dust');

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
      // World.update() asks Progression whether a door is gated before firing it.
      // The world is built before gameplay exists, so the reference is handed
      // over here rather than passed in at construction.
      this.ctx.progression = this.progression;
      // Checkpoint saves. The title screen has always had a Continue item and
      // nothing in the project ever wrote the key it reads, so it was permanently
      // greyed out and every session began at the arrival lift.
      // Where a death goes before the Office of Record has ever been found. The
      // Director owns respawning and has no business knowing about the streamer,
      // so it asks.
      if (this.director) {
        this.director.fallbackSpawn = () => (this.world
          ? { position: this.world.spawn, yaw: this.world.spawnYaw ?? 0 } : null);
      }
      this._saveOff = SaveGame.installAutosave(this);
      this.subsystems.save = true;
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
    // Falling out of the world is now possible, because the player controller no
    // longer pretends there is a floor under every ledge. This is the net, and it
    // belongs here rather than in the controller: only the game knows where the
    // last safe point was.
    this.bus.on('player:fell', (e) => {
      console.warn(`[game] player left the world (${(e?.drop ?? 0).toFixed(1)} m); respawning`);
      // FALLING TWICE IN A ROW MEANS THE RESPAWN POINT IS THE PROBLEM.
      //
      // Measured: a free-roaming bot fell through a hole in the Service Spine,
      // respawned onto a point that was itself in the void, fell again six
      // seconds later, and repeated it for the remaining 106 s of the session
      // with `controlEnabled` false the whole time. Retrying the same coordinates
      // is not a recovery, it is a loop, and the player is a spectator to it.
      const t = this._now ?? 0;
      // A hard floor on how often this can run at all. `teleport` re-arms the
      // fall detector, so without a cooldown a destination that does not hold
      // turns the recovery into a per-frame loop instead of a recovery.
      if (t - (this._lastRecoverAt ?? -99) < 0.75) return;
      this._lastRecoverAt = t;
      const repeat = t - (this._lastFellAt ?? -99) < 12;
      this._lastFellAt = t;
      if (repeat) {
        const p = this._anyFloorNear(this.player.position.x, this.player.position.z);
        if (p) {
          console.warn('[game] fell again straight after a respawn; placing on the nearest built floor');
          this.player.teleport(p[0], p[1], p[2], this.player.yaw);
          this.player.controlEnabled = true;
          this.player.lookEnabled = true;
          this.player.frozen = false;
          this.state = 'play';
          this.ui?.show?.(null);
          this._respawnSettle = 0;
          this._respawnAt = null;
          return;
        }
      }
      this.respawn();
    });

    // THE TWO ENDS OF THE GAME. Neither was connected.
    //
    // `Surveyor` emits `game:death` when a capture completes and `Progression`
    // emits `game:ending` when the lift arrives at the surface. The Director
    // listened for the first (to freeze the body and run the death cinematic) and
    // NOTHING listened for either at the level that owns the screens — so being
    // caught froze the player in place with no screen and no way back, and
    // finishing the game after forty minutes showed nothing at all. Both screens
    // exist in `src/ui/EndScreens.js`; the UI harness was the only thing that had
    // ever opened them.
    this.bus.on('game:death', (e) => {
      if (this.state === 'dead' || this.state === 'ended') return;
      this.state = 'dead';
      this.input.exitLock();
      // The Director's own timer would put the player back by itself, which would
      // respawn the world behind the modal screen and again when the button was
      // pressed. With a UI present, the player chooses.
      if (this.director) this.director.autoRespawn = !this.ui;
      // The death cinematic runs first; the screen comes up behind it. The
      // Director's respawn delay is the beat the sequence is written against.
      const at = e?.position;
      const zone = this.world?.currentZone || '';
      this._deathData = {
        cause: e?.cause || 'unknown',
        location: at ? `${zone} ${at.x.toFixed(0)}, ${at.z.toFixed(0)}` : zone,
        elapsed: this.time,
        deaths: this.director?.deaths ?? 1,
      };
    });
    // The Director's death sequence has finished its cinematic and changed the
    // world; only now does the screen make sense as a decision rather than an
    // interruption. Without a UI the Director respawns on its own and this never
    // fires.
    this.bus.on('death:settled', () => {
      if (this.state !== 'dead') return;
      this.ui?.show?.('death', this._deathData || {});
    });
    this.bus.on('game:ending', (e) => {
      this.state = 'ended';
      this.input.exitLock();
      this.ui?.show?.('ending', {
        ending: e?.ending || 'left',
        time: e?.time ?? this.time,
        deaths: e?.deaths ?? 0,
        objectives: e?.objectives ?? 0,
        discoveries: e?.discoveries ?? [],
        notes: e?.notes ?? null,
      });
      // The run is over; a checkpoint pointing at the inside of a departed lift is
      // worse than none.
      SaveGame.clearSave();
      this.ui?.setHasSave?.(false);
    });
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
        // "Report to the Office of Record" — the death screen's only other
        // option. It has to put the state machine back to `play` and re-take the
        // pointer, or the player comes back to a live world they cannot look at.
        this.state = 'play';
        this.ui?.show?.(null);
        this.input.requestLock();
        this.respawn(data);
        break;
      case 'menu':
        // The death screen's "Abandon shift". There was no handler, so the button
        // did nothing and a dead player had exactly one working option.
        this.state = 'menu';
        this.paused = false;
        this.input.exitLock();
        this.ui?.show?.('title');
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
    if (fresh) {
      SaveGame.clearSave();
      this.player.teleport(spawn[0], spawn[1], spawn[2], this.world?.spawnYaw || 0);
    } else {
      const r = SaveGame.restore(this);
      if (!r.ok) {
        // Continue with nothing to continue. Start instead of stranding them.
        this.player.teleport(spawn[0], spawn[1], spawn[2], this.world?.spawnYaw || 0);
      } else if (r.missing.length) {
        console.warn('[save] restored with gaps:', r.missing.join(', '));
      }
    }
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
  /**
   * Put the player back at the last safe point.
   *
   * TWO THINGS THIS DID NOT DO, AND A SESSION THAT ENDED BECAUSE OF IT.
   *
   * The safe point is `{id, position, yaw, zone}` and this read three of those
   * four fields. Zones are 400 m apart and streamed, so respawning into a zone
   * that is not resident teleports the player to the right coordinates in an
   * empty world — no floor, no colliders. And `teleport` was given the stored Y
   * verbatim with no floor snap, where every other placement path in this file
   * goes through `collision.sampleFloor` first.
   *
   * Observed: the player fell out of the Service Spine, the `player:fell` net
   * called this, this dropped them into the Safe Room at y = -28.04, they fell
   * again, and it looped — seven falls and fifteen respawns, `controlEnabled`
   * false for the last minute of the session. The net that exists to catch a
   * fall was the thing causing them.
   */
  respawn() {
    this.progression?.respawn?.();
    const safe = this.gameplay?.director?.lastSafe || null;
    const point = this.progression?.lastSafePoint?.() || this.world?.spawn || [0, 0, 0];
    const yaw = this.progression?.lastSafeYaw?.() ?? this.world?.spawnYaw ?? 0;

    // The zone has to be resident before the coordinates in it mean anything.
    if (safe?.zone && this.world?.goto && this.currentZone !== safe.zone) {
      try { this.world.goto(safe.zone); } catch { /* streaming will catch up */ }
    }

    const y = this._floorYAt(point[0], point[2], point[1]);
    this.player.teleport(point[0], y ?? point[1], point[2], yaw);
    // No floor yet — the zone is still building. Hold the body and keep trying
    // rather than letting gravity have it. See `_settleRespawn`.
    this._respawnSettle = y === null ? 2.0 : 0;
    this._respawnAt = [point[0], point[2], point[1]];
    this.player.controlEnabled = true;
    this.player.lookEnabled = true;
    this.player.frozen = false;
    this.engine.exposure.reset();
    this.state = 'play';
    this.ui?.show?.(null);
    if (this.sequencer?.play) this.sequencer.play('respawn');
  }

  /** Highest floor at (x,z) at or below `fromY` plus a generous reach, or null. */
  _floorYAt(x, z, fromY) {
    const fl = this.collision?.sampleFloor?.(x, z, (fromY ?? 0) + 2.5, 6);
    return fl ? fl.y : null;
  }

  /**
   * Finish a respawn that landed before its zone had colliders. Runs from
   * `step`; holds the body still and re-places it the moment a floor appears.
   */
  _settleRespawn(dt) {
    if (!(this._respawnSettle > 0) || !this._respawnAt) return;
    this._respawnSettle -= dt;
    const [x, z, y0] = this._respawnAt;
    const y = this._floorYAt(x, z, y0);
    if (y !== null) {
      this.player.teleport(x, y, z, this.player.yaw);
      this._respawnSettle = 0;
      this._respawnAt = null;
      return;
    }
    // Still nothing under it. Do not let it accelerate into the void while we
    // wait, and if the wait runs out put it on any floor that actually exists.
    this.player.position.y = y0;
    if (this.player.velocity) this.player.velocity.y = 0;
    if (this._respawnSettle <= 0) {
      const p = this._anyFloorNear(x, z) || this._anyFloorNear(...(this.world?.spawn || [0, 0, 0]));
      if (p) {
        this.player.teleport(p[0], p[1], p[2], this.player.yaw);
        console.warn('[game] respawn point had no floor; placed on the nearest built floor instead');
      } else {
        console.error('[game] respawn found no floor anywhere in the resident world');
      }
      this._respawnAt = null;
    }
  }

  /**
   * The centre of the nearest floor rectangle a body fits on, anywhere in the
   * resident world. The last-resort respawn.
   *
   * THIS EXISTS BECAUSE THE SAFETY NET HAD NO NET UNDER IT. An exploration bot
   * walked through `service_door3` into a hole in the Service Spine, fell, and
   * then respawned into somewhere with no floor — and did it again every six
   * seconds for the remaining 106 seconds of the session, `controlEnabled` false
   * throughout. `Director.respawn` teleports to `lastSafe`, `Game.respawn`
   * teleports to the same point with a floor snap, and the previous fallback
   * from here was `world.spawn` — which is the INTAKE's spawn, and the Intake is
   * not resident when you are in the Service Spine, so it had no floor either.
   * Three fallbacks, all of which could be in a zone that is not loaded.
   *
   * `collision.floors` is the set of rectangles the streamer has actually built.
   * If that is empty there is no game to respawn into; if it is not, this cannot
   * fail.
   */
  _anyFloorNear(x, z) {
    const col = this.collision;
    const floors = col?.floors;
    if (!floors?.length) return null;
    // Nearest first, then PROVE each candidate before handing it back.
    //
    // The first version returned a rectangle's centre and trusted it. It does
    // not follow that a body fits there: a rect centre can be under a machine,
    // inside a wall return, or on a lip the capsule gets pushed off. Handing
    // back an unstandable point is worse than handing back nothing, because
    // `Player.teleport` sets `_fellOut = false` — it re-arms the fall detector —
    // so a bad destination makes `player:fell` fire again next frame, and the
    // recovery becomes a 60 Hz loop. Measured: 5 992 `player:fell` events in one
    // 106 s stretch.
    const cands = [];
    for (const f of floors) {
      if (f.tag === 'void' || (f.water ?? 0) > 0.8) continue;
      if (f.maxX - f.minX < 1.2 || f.maxZ - f.minZ < 1.2) continue;
      const cx = (f.minX + f.maxX) / 2, cz = (f.minZ + f.maxZ) / 2;
      cands.push({ d: (cx - x) ** 2 + (cz - z) ** 2, cx, cz, y: f.y });
    }
    cands.sort((a, b) => a.d - b.d);
    const r = this.player?.radius ?? 0.29;
    const h = this.player?.height ?? 1.74;
    for (const c of cands.slice(0, 40)) {
      const fl = col.sampleFloor?.(c.cx, c.cz, c.y + 0.5, 1.0);
      if (!fl) continue;
      const res = col.resolveCapsule?.(c.cx, fl.y, c.cz, r, h);
      if (res && (res.hit || Math.hypot(res.x - c.cx, res.z - c.cz) > 0.25)) continue;
      const head = col.ceilingAbove?.(c.cx, c.cz, fl.y + 0.05, r);
      if (Number.isFinite(head) && head - fl.y < h) continue;
      return [c.cx, fl.y, c.cz];
    }
    return null;
  }

  // -------------------------------------------------------------------------

  /** Apply a zone's atmosphere, wetness and reverb in one place. */
  applyZoneProfile(zoneKey, { immediate = false } = {}) {
    const profile = FOG_PROFILES[zoneKey] || FOG_PROFILES.intake;
    this.engine.atmosphere.set(profile, immediate);
    const z = this.world?.zones?.[zoneKey];
    setWetness(z?.waterLine ?? -999, z?.wetness ?? 0);
    const amb = AMBIENT_PROFILES[zoneKey] || AMBIENT_PROFILES.intake;
    // The AO volume has to be bound before the fill is written, because it is
    // what says how much the fill needs scaling up to keep the zone at the
    // exposure it was authored at. See AOVolume.fillCompensation.
    this._zoneAmbient = amb;
    const aoComp = this._bindAOVolume(zoneKey, z);
    this.rig.setAmbient(amb.sky, amb.ground, amb.intensity * aoComp);
    if (immediate) this.rig.snapAmbient();
    // The zone asks for a budget; the quality tier caps it.
    this.rig.setLightBudget(Math.min(
      z?.lightBudget ?? DEFAULT_LIGHT_BUDGET, this.engine.q.lights));
    this.motes?.setProfile({
      opacity: (amb.motes ?? 0.7) * (this.engine.q.moteScale ?? 1),
      size: amb.moteSize ?? 1,
      extent: amb.moteExtent ?? 16,
    });
    this.audio?.setZone?.(z?.reverb || zoneKey);
    this.currentZone = zoneKey;
  }

  /**
   * Point the baked-AO uniforms at this zone's volume, baking it if this is the
   * first visit.
   *
   * The volume is what gives the room's corners, reveals and column bases their
   * darkening; the hemisphere bounce fill reaches everywhere equally and GTAO's
   * radius is far too small to know about a room's shape. See AOVolume.js.
   *
   * Baked volumes are kept for the whole session even after the zone streams
   * out. They are a fraction of a megabyte each and the bake is the expensive
   * part — re-entering the Intake through a door should not cost a hitch, and a
   * zone rebuilt from the same seed has identical colliders anyway.
   *
   * Only ONE volume is bound at a time even though up to three zones are
   * resident. That is correct rather than a compromise: resident zones sit 400 m
   * apart, so the other two sample outside the bound volume, and the sampler
   * returns a neutral 1.0 for anything outside it. They are also past the far
   * plane and therefore never on screen.
   */
  _bindAOVolume(zoneKey, zone) {
    if (!this._aoVolumes) this._aoVolumes = new Map();
    const strength = this.engine.q.aoVolume ?? 0.9;
    const off = () => { materialGlobals.uAOStrength.value = 0; return 1; };
    if (strength <= 0) return off();

    let vol = this._aoVolumes.get(zoneKey);
    if (!vol) {
      // Local bounds; the colliders themselves are already in world space
      // because ZoneBuilder bakes the zone's origin into everything it emits.
      const local = zone?.bounds;
      if (!local) return off();
      const [ox, oy, oz] = zone.origin || [0, 0, 0];
      const box = local.clone().translate(new THREE.Vector3(ox, oy, oz));
      vol = new AOVolume({ cell: this.engine.q.aoCell ?? 0.5 });
      try {
        vol.build(this.collision, box);
      } catch (e) {
        console.warn('[game] AO volume bake failed', e);
        return off();
      }
      this._aoVolumes.set(zoneKey, vol);
      console.info(`[game] AO volume "${zoneKey}"`, vol.stats());
    }
    vol.writeUniforms(materialGlobals);
    materialGlobals.uAOStrength.value = strength;
    return vol.fillCompensation(strength, materialGlobals.uAOFloor.value);
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
      this.motes?.update(dt, this.engine.camera, this.rig);
      this.ui?.update?.(dt);
    }
    this.engine.render(dt);
    this.input.endFrame();
  }

  /** One logic step. Split out so the QA harness can advance deterministically. */
  step(dt) {
    /** Seconds of simulated time since boot. Only the fall-loop guard reads it. */
    this._now = (this._now ?? 0) + dt;
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
      // Immediately after integration, so a respawn that landed before its zone
      // had colliders cannot accumulate a frame of fall.
      this._settleRespawn(dt);
    }
    this.gameplay?.update?.(dt, this.input);
    this.world?.update?.(dt, this.player.position);
    this.rig.update(dt, this.engine.camera, this.engine.renderer);
    // After the rig, so a mote lit by a flickering tube flickers with it.
    // gl_PointSize is in render-target pixels, not CSS pixels, and the player's
    // FOV moves with sprint and lean — so the projection scale has to be
    // refreshed whenever either changes or motes grow and shrink with the zoom.
    this._refreshMoteScale();
    this.motes?.update(dt, this.engine.camera, this.rig);

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

  _refreshMoteScale() {
    if (!this.motes) return;
    const h = this.engine.renderHeight, f = this.engine.camera.fov;
    if (h === this._moteH && f === this._moteFov) return;
    this._moteH = h; this._moteFov = f;
    this.motes.resize(this.engine.camera, h);
  }

  /** QA: override the baked-AO strength so an A/B pair can be captured. */
  setAO(v) { materialGlobals.uAOStrength.value = v; return v; }

  /**
   * QA: isolate one contributor at a time.
   *
   * When a defect appears on a surface there are four plausible sources — the
   * screen-space AO pass, the shadow maps, the injected detail normal, and the
   * bounce fill — and guessing between them costs a capture run each. These let
   * one run answer the question.
   */
  setGTAO(on) { this.engine.gtao.enabled = !!on; return !!on; }
  /**
   * QA: force the MSAA sample count for this session.
   *
   * Not a gameplay setting. Resolving a multisampled half-float target is
   * fixed-function on hardware and pure software on a CPU rasteriser, where it
   * costs orders of magnitude more than everything else in the frame put
   * together — 80 minutes of CPU for six frames it never finished, measured.
   * Without a way to turn it off, the headless harness cannot verify anything
   * else at a tier above the lowest.
   */
  setMSAA(n) {
    const e = this.engine;
    e.q = { ...e.q, msaa: Math.max(0, Math.min(8, n | 0)) };
    for (const rt of [e.composer.renderTarget1, e.composer.renderTarget2]) {
      if (rt && rt.samples !== e.q.msaa) { rt.samples = e.q.msaa; rt.dispose(); }
    }
    e.resize();
    return e.q.msaa;
  }
  setShadows(on) {
    this.engine.renderer.shadowMap.enabled = !!on;
    this.rig.invalidateShadows();
    this.engine.renderer.shadowMap.needsUpdate = true;
    // Every material has the shadow path compiled in; toggling the renderer
    // flag changes the program, so they all have to be recompiled.
    for (const m of this.materials.all) m.needsUpdate = true;
    return !!on;
  }
  setDetailNormal(v) {
    // uDetailStrength is per-material, not one of the shared globals, so this
    // has to walk the library and reach into each compiled program's uniforms.
    let n = 0;
    for (const m of this.materials.all) {
      const u = m.userData.shader?.uniforms;
      if (u?.uDetailStrength) { u.uDetailStrength.value = v; n++; }
    }
    return n;
  }
  /** QA: scale the zone's bounce fill without editing the profile table. */
  setFill(scale) {
    const amb = this._zoneAmbient || AMBIENT_PROFILES.intake;
    this.rig.setAmbient(amb.sky, amb.ground, amb.intensity * scale);
    this.rig.snapAmbient();
    return amb.intensity * scale;
  }
  /**
   * QA: the nearest fixtures and whether their visible parts are actually there.
   *
   * The project's own rule is that light comes from visible sources only, and
   * ceiling-facing captures of the Intake showed a lit ceiling with no fixture in
   * it. Four things have to be true for a troffer to read, and this reports all
   * four rather than leaving it to inference: the rig has the fixture, its tube
   * mesh exists, the mesh is in the scene graph and visible, and its emissive
   * colour is not black.
   */
  fixtureReport(n = 6) {
    const cam = this.engine.camera.position;
    const list = this.rig.fixtures
      .map((f) => {
        const p = f.group.position;
        return { f, d: Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, n)
      .map(({ f, d }) => {
        // `tube` is a slot in a batched instanced mesh; what matters for the
        // "why is this zone black" question it was written to answer is whether
        // the batch reached the scene and whether the slot is lit within it.
        const t = f.tube;
        let inScene = false;
        for (let o = t?.mesh; o; o = o.parent) if (o === this.engine.scene) { inScene = true; break; }
        let visibleChain = !!t?.visible;
        for (let o = t?.mesh; o && visibleChain; o = o.parent) if (!o.visible) { visibleChain = false; break; }
        const c = t?.color;
        return {
          type: f.type,
          d: +d.toFixed(2),
          at: [+f.group.position.x.toFixed(2), +f.group.position.y.toFixed(2), +f.group.position.z.toFixed(2)],
          level: +f.level.toFixed(2),
          lightVisible: f.light.visible,
          tube: !!t,
          tubeInScene: inScene,
          tubeVisible: visibleChain,
          tubeLum: c ? +(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b).toFixed(3) : null,
        };
      });
    return { camera: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)], nearest: list };
  }

  /** QA: what is actually lighting the point in front of the camera. */
  lightProbe() {
    const p = this.player.position;
    const amb = this._zoneAmbient || AMBIENT_PROFILES.intake;
    const lum = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
    const skyL = lum(amb.sky), grL = lum(amb.ground);
    return {
      zone: this.currentZone,
      directAtHead: +this.rig.illuminationAt(p.x, p.y + 1.6, p.z).toFixed(3),
      directAtFloor: +this.rig.illuminationAt(p.x, p.y + 0.1, p.z).toFixed(3),
      fillUp: +(skyL * this.rig.ambient.intensity).toFixed(3),
      fillDown: +(grL * this.rig.ambient.intensity).toFixed(3),
      fixtures: this.rig.stats,
      // Circuit state, because "the zone is too dark" and "the zone's power is
      // off" are indistinguishable in a screenshot and the game's whole premise
      // is that the power is out until the player restores it. Without this the
      // two get conflated and a lighting change gets made to fix a game state.
      circuits: Object.fromEntries([...this.rig.circuits].map(
        ([k, c]) => [k, +(c.level ?? 0).toFixed(2)])),
      // Fixtures belonging to the CURRENT zone only. rig.stats counts every
      // resident zone, and zones sit 400 m apart, so a dark zone next to a lit
      // one reports over a hundred lit fixtures none of which it can see.
      zoneFixtures: (() => {
        const z = this.world?.zones?.[this.currentZone];
        const list = z?._fixtures || [];
        return { total: list.length, lit: list.filter((f) => f.level > 0.05).length };
      })(),
      // The AUTHORED exposure multiplier — a constant, and named badly enough
      // that three harnesses waited on it for an eye adaptation it has nothing
      // to do with. Kept under its old name so nothing that reads it breaks.
      exposure: +this.engine.grade.uniforms.uExposure.value.toFixed(3),
      // What the eye has actually adapted to. `adaptation.autoGain` is the
      // multiplier the grade applies, clamped by AUTO_EXPOSURE to about 1.6
      // stops end to end — so a room four stops darker than the one before it
      // stays four stops darker, by design. This is the number to settle on.
      adaptation: this.engine.exposure?.read?.() ?? null,
    };
  }

  /**
   * QA: hold the frame still.
   *
   * An A/B pair captured across two settle runs is not comparable — flickering
   * fixtures, the drifting exposure and the dust drift all move between the two
   * frames, and the difference between them swamps whatever is being tested. This
   * makes every fixture healthy and steady at full output and pins the exposure,
   * so a second capture with one thing changed differs only by that thing.
   */
  qaSteady() {
    for (const f of this.rig.fixtures) {
      f.setHealth('good');
      f.health = 'good';
      f._dead = false;
      f.level = 1;
      f._burstLen = 0;
    }
    if (this.motes) this.motes.uniforms.uTime.value = 12.0;
    this.engine.exposure?.unlock?.();
    return true;
  }
  aoStats() {
    const out = {};
    for (const [k, v] of this._aoVolumes || []) out[k] = v.stats();
    return out;
  }

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
  lookOpen(pos, prefer = 0, pitch = 0, {
    samples = 16, advance = 1.6, maxRange = 24, minClear = 3.0,
  } = {}) {
    const [x0, y0, z0] = pos;

    /**
     * Best heading from a candidate standing position, and how far it sees.
     * Returns null if the candidate has no floor under it — a camera in a void
     * is worse than a camera against a wall.
     */
    const evaluate = (px, pz) => {
      const r = this.collision.resolveCapsule(
        px, y0, pz, this.player.radius + 0.08, this.player.height);
      const fl = this.collision.sampleFloor(r.x, r.z, y0 + 1.2, 2.5);
      if (!fl) return null;
      // Headroom. Without this a capture aimed at a zone with a mezzanine can
      // put the eye inside a soffit, which the player controller's own ceiling
      // probe would never allow — the frame then shows the inside of a slab and
      // says nothing about the zone. 1.75 m is the standing eye height plus a
      // little; anything less is somewhere the player cannot stand.
      const ceil = this.collision.ceilingAbove(r.x, r.z, fl.y + 0.05);
      if (ceil != null && ceil - fl.y < 1.75) return null;
      const ey = fl.y + 1.6;
      let yaw = prefer, score = -1, clearAt = 0;
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2;
        const ax = -Math.sin(a), az = -Math.cos(a);
        let clear = 0;
        // Half-metre steps, not one-metre. At a one-metre stride a wall 0.4 m
        // away and a wall 0.9 m away both score zero, which is what let a
        // candidate with its nose against a wall win by default.
        for (let d = 0.5; d <= maxRange; d += 0.5) {
          if (this.collision.segmentBlocked(r.x, ey, r.z,
            r.x + ax * d, ey, r.z + az * d, 'ceiling')) break;
          clear = d;
        }
        // A shot pointing the way the designer meant is worth a few metres of
        // depth, so the authored heading gets a bonus rather than a veto.
        const delta = Math.abs(((a - prefer + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const s = clear + Math.max(0, 1 - delta / Math.PI) * 6;
        if (s > score) { score = s; yaw = a; clearAt = clear; }
      }
      return { x: r.x, z: r.z, y: fl.y, yaw, score, clear: clearAt };
    };

    let best = evaluate(x0, z0);

    // If the authored point has no open sightline, go and find one. Without this
    // the camera stays wherever resolveCapsule left it, which in the Cistern put
    // a wet wall 40 cm from the lens across the whole frame — a shot that says
    // nothing about the zone and blows the auto-exposure while it does so.
    if (!best || best.clear < minClear) {
      for (const radius of [1.5, 3, 5, 7.5, 10, 14]) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const cand = evaluate(x0 + Math.cos(a) * radius, z0 + Math.sin(a) * radius);
          if (cand && (!best || cand.score > best.score)) best = cand;
        }
        if (best && best.clear >= minClear) break;
      }
    }
    if (!best) best = { x: x0, z: z0, y: y0, yaw: prefer, score: 0, clear: 0 };

    const res = { x: best.x, z: best.z };
    const y = best.y;
    const eye = y + 1.6;
    const bestYaw = best.yaw;
    const bestScore = best.score;

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
    // `degenerate` is reported so a capture manifest records that a frame was
    // shot from a position with no open sightline rather than silently
    // presenting it as a view of the zone.
    return {
      position: [cx, y, cz], yaw: bestYaw, clearance: bestScore,
      clear: +best.clear.toFixed(1), degenerate: best.clear < 1.5,
      moved: +Math.hypot(cx - pos[0], cz - pos[2]).toFixed(1),
    };
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
  //
  // `motes` is the airborne dust density, `moteSize` its particle scale. Air is
  // one of the things that distinguishes these rooms from each other: the Intake
  // is a sealed office plate whose filters still half work, the Duct is where
  // thirty years of it settled, and the Cistern's air is too wet to hold any.
  //
  // NOTE ON COLOUR TEMPERATURE. The sky and ground colours are deliberately
  // pushed APART on the warm/cool axis rather than being two shades of the same
  // hue, which is what they used to be. A HemisphereLight is the only tool here
  // that can put two colour temperatures in one frame: everything facing up
  // takes the sky colour, everything facing down takes the ground colour. Every
  // reference photograph of a lit interior has that split — bounce off a warm lit
  // floor going up under the desks and shelves, cooler light from the tube's own
  // colour and the grey ceiling coming down — and its absence was why frames
  // read as monochrome washes of a single hue no matter how good the albedo was.
  // Sky and ground luminance are kept close so the exposure does not move.
  //
  // NOTE ON THE CISTERN AND THE STACK, which were the two zones that would not
  // read. Measured with lightProbe() AFTER a settled frame — the timing matters,
  // see below — direct light at head height came out at 37.0 units in the Intake,
  // 4.5 in the Stack and 1.0 in the Cistern, and the Cistern's bounce fill was
  // 0.048 against the Intake's 0.56. A twelve-to-one difference in fill and a
  // thirty-seven-to-one difference in direct light is not an atmospheric choice,
  // it is two stops past "grim" into "unreadable", and no amount of AO, fog or
  // material work was ever going to recover it. Both are raised here.
  //
  // THE PROBE MUST BE TAKEN AFTER A SETTLED FRAME. Fixture output ramps from zero
  // and circuits ramp with it, so a probe read in a capture's setup — before any
  // frame has been stepped — reports every fixture in the building as unlit and
  // every zone as receiving zero direct light. That artefact cost real time here:
  // it produced a confident and completely wrong conclusion that the zones' power
  // circuits were switched off. Probe in a second shot with settle: 1.
  intake:    { sky: 0x7f8a99, ground: 0xbfa87c, intensity: 2.05, motes: 0.55, moteSize: 0.85 },
  service:   { sky: 0x525f70, ground: 0x776d5e, intensity: 0.70, motes: 0.85, moteSize: 1.00 },
  cistern:   { sky: 0x5c7885, ground: 0x7d8068, intensity: 1.45, motes: 0.30, moteSize: 1.35 },
  residence: { sky: 0x6e7480, ground: 0x9a8258, intensity: 1.05, motes: 0.75, moteSize: 0.95 },
  plant:     { sky: 0x4c5a6b, ground: 0x74684f, intensity: 0.75, motes: 0.62, moteSize: 1.10, moteExtent: 26 },
  duct:      { sky: 0x2e343c, ground: 0x443c2c, intensity: 0.30, motes: 1.45, moteSize: 1.15, moteExtent: 11 },
  stack:     { sky: 0x8e9cb4, ground: 0xb0a48b, intensity: 2.30, motes: 0.90, moteSize: 1.05, moteExtent: 24 },
  safe:      { sky: 0x7e8290, ground: 0xa88a55, intensity: 1.30, motes: 0.60, moteSize: 0.90, moteExtent: 12 },
  void:      { sky: 0x000000, ground: 0x000000, intensity: 0.0,  motes: 0.0,  moteSize: 1.00 },
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
