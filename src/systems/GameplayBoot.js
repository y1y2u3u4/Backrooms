import * as THREE from 'three';
import { Inventory } from '../player/Inventory.js';
import { Flashlight } from '../player/Flashlight.js';
import { Hands } from '../player/Hands.js';
import { Interactor } from '../player/Interactor.js';
import { Interactables } from './Interactables.js';
import { ZoneGameplay } from './ZoneGameplay.js';
import { Surveyor, STATE as SURVEYOR_STATE } from '../entities/Surveyor.js';
import { Attendant } from '../entities/Attendant.js';
import { Director } from './Director.js';
import { Progression } from './Progression.js';
import { NotesLibrary } from './Notes.js';

/**
 * GameplayBoot — one call for the integrator, one call per frame.
 *
 * Everything the gameplay agent owns is constructed, wired and stepped from
 * here, so `main.js` never has to know the internal order of operations (which
 * matters: the flashlight must update before the Surveyor samples light, and
 * the interactor must update before the hands read its reach state).
 *
 *   const gameplay = await installGameplay(game, { seedDemo: true });
 *   // in Game.step(dt):
 *   gameplay.update(dt, this.input);
 *
 * `seedDemo` populates the Intake zone with one of everything so the systems
 * can be exercised before the other zones exist. Zone builders should pass
 * `seedDemo: false` and register their own props through `gameplay.spawn()`.
 */

export async function installGameplay(game, {
  seedDemo = false,
  surveyor = true,
  assets = null,
  quality = 'high',
} = {}) {
  const bus = game.bus;
  const scene = game.engine.scene;
  const camera = game.engine.camera;
  const player = game.player;
  const collision = game.collision;
  const rig = game.rig;
  const palette = game.palette;
  const materials = game.materials;

  // ---- player-side systems --------------------------------------------------
  const notes = new NotesLibrary(bus);
  const inventory = new Inventory({ bus, player });
  const flashlight = new Flashlight({
    scene, camera, player, inventory, collision, bus,
    castShadow: quality === 'high',
  });
  const hands = new Hands({
    overlayScene: game.engine.overlayScene,
    overlayCamera: game.engine.overlayCamera,
    player, inventory, flashlight, rig, bus,
  });
  const interactor = new Interactor({ camera, player, inventory, bus, rig, hands, game });

  // ---- world-side systems ---------------------------------------------------
  const ctx = {
    materials, palette, collision, rig, scene, bus, assets,
    interactor, inventory, player, notes, hands, flashlight,
  };
  const interactables = new Interactables(ctx);
  ctx.interactables = interactables;

  const entity = surveyor
    ? new Surveyor({ scene, collision, rig, player, flashlight, bus, palette })
    : null;
  const attendant = new Attendant({ scene, camera, player, collision, bus, palette });

  const director = new Director({
    player, rig, bus, surveyor: entity, attendant, flashlight, inventory, interactor,
  });
  const progression = new Progression({
    bus, inventory, notes, interactables, interactor, director, player,
  });

  // Blender hero assets are optional at every step.
  if (assets) {
    await Promise.all([
      flashlight.loadModel(assets).catch(() => false),
      hands.loadModel(assets).catch(() => false),
      entity ? entity.loadModel(assets).catch(() => false) : Promise.resolve(false),
    ]);
  }

  if (seedDemo) seedIntakeDemo(ctx, { director, progression, attendant, entity });

  const gameplay = {
    notes, inventory, flashlight, hands, interactor, interactables,
    surveyor: entity, attendant, director, progression, ctx,
    zoneGameplay: null,

    /** Build and register a prop. See `Interactables.FACTORIES` for kinds. */
    spawn(kind, opts) { return interactables.spawn(kind, opts); },

    /** One logic step. Order matters; see the file header. */
    update(dt, input) {
      flashlight.update(dt, input);
      interactor.update(dt, input);
      interactables.update(dt);
      if (entity) entity.update(dt);
      attendant.update(dt);
      director.update(dt);
      progression.update(dt);
      hands.update(dt, input);
    },

    /** Aggregated debug for the HUD and the QA harness. */
    debugState() {
      return {
        surveyor: entity?.debugState() ?? null,
        attendant: attendant.debugState(),
        director: director.debugState(),
        progression: progression.debugState(),
        interactor: interactor.debugState(),
        flashlight: flashlight.debugState(),
        hands: hands.debugState(),
        inventory: inventory.snapshot(),
      };
    },

    /** Deterministic hooks for the capture harness. */
    qa: {
      SURVEYOR_STATE,
      /** Put the Surveyor somewhere and force a state, without any animation blend. */
      surveyorTo(x, z, heading = 0, state = null) {
        if (!entity) return null;
        const floor = collision.sampleFloor(x, z, 4, 6);
        entity.spawnAt(x, floor ? floor.y : 0, z, heading);
        if (state) { entity.state = state; entity.stateTime = 0; }
        entity.root.visible = true;
        return entity.debugState();
      },
      /** Advance the entity by `seconds` of simulated time at a fixed step. */
      step(seconds, dt = 1 / 60) {
        const n = Math.round(seconds / dt);
        for (let i = 0; i < n; i++) {
          flashlight.update(dt, null);
          if (entity) entity.update(dt);
          interactables.update(dt);
        }
        return entity?.debugState() ?? null;
      },
      /** Force the gait phase, so a "frozen mid-stride" shot is reproducible. */
      pose(gait, headYaw = 0) {
        if (!entity) return;
        entity.gait = gait;
        entity.headYaw = headYaw;
        entity.headYawTarget = headYaw;
        entity.speed = 0.85;
        entity._animate(1 / 60);
        entity._applyTransform(1 / 60);
      },
      measure(hold = 6) {
        if (!entity) return;
        entity._beginMeasuring();
        entity.measureHold = hold;
        entity.armReach = 1;
        for (let i = 0; i < 30; i++) entity.update(1 / 60);
      },
      lamp(on, battery = null) {
        flashlight.isOn = on;
        if (battery !== null) flashlight.setBattery(battery);
        for (let i = 0; i < 30; i++) flashlight.update(1 / 60, null);
      },
      circuits(on) {
        for (const name of rig.circuits.keys()) rig.setCircuit(name, on);
        rig.invalidateShadows();
      },
      give(id, n = 1) { return inventory.add(id, n); },
      beat(name) { director._fire(name); },
      attendantAct(kind) { return attendant.act(kind || null); },
    },

    dispose() {
      gameplay.zoneGameplay?.dispose();
      director.dispose(); progression.dispose();
      entity?.dispose(); interactables.dispose();
      hands.dispose(); flashlight.dispose(); interactor.clear();
    },
  };

  // The real world, if there is one. This is what makes the game a game: the
  // zone builders' declared props, doors and portals only become interactive
  // here. See ZoneGameplay.js for why it was previously dead code.
  if (game.world) {
    gameplay.zoneGameplay = new ZoneGameplay({ world: game.world, gameplay, ctx }).attach();
    const s = gameplay.zoneGameplay.debugState();
    console.info(`[gameplay] ${s.doors} doors, ${s.props} props across ${s.zones.length} zone(s)`);
  }

  // Gates, always. This used to live inside `seedIntakeDemo`, so with the world
  // built the critical path had no locks on it at all — and, more to the point,
  // no objective list was ever announced to the HUD.
  progression.installDefaultGates();

  game.gameplay = gameplay;
  return gameplay;
}

// ---------------------------------------------------------------------------

/**
 * A working bench of every mechanism, laid along the clear southern strip of
 * the Intake plate (row 14 of the grid carries no partitions). This exists so
 * the systems are playable and photographable before the Cistern, the
 * Residence, the Stack and the Plant are built.
 */
export function seedIntakeDemo(ctx, { director, progression, attendant, entity } = {}) {
  const { interactables, bus } = ctx;
  const Z = 30.4;          // hard against the southern perimeter
  const face = Math.PI;    // front faces -Z, into the room

  const board = interactables.spawn('breaker', {
    id: 'board_c', position: [-24.0, 1.16, Z], rotation: face, maxOn: 3,
  });

  interactables.spawn('terminal', {
    id: 'terminal_record', position: [-19.4, 0.78, Z - 0.55], rotation: face,
    puzzleCode: '2130',
  });

  interactables.spawn('keypad', {
    id: 'keypad_store', position: [-15.6, 1.28, Z - 0.05], rotation: face,
    code: '2130', label: 'the store-room keypad', hintNote: 'nb_5',
  });

  interactables.spawn('cardReader', {
    id: 'reader_r207', position: [-13.8, 1.28, Z - 0.05], rotation: face,
    requires: 'card_warden', label: 'the R-207 reader',
    onOpen: () => progression?.gate('portal_residence', false, ''),
  });

  interactables.spawn('valve', {
    id: 'penstock_1', position: [-10.6, 1.05, Z - 0.35], rotation: face,
    turns: 5, label: 'penstock 1', action: 'drain', targetZone: 'cistern',
  });

  interactables.spawn('hide', {
    id: 'locker_1', position: [-27.4, 0, Z - 0.30], rotation: face, kind: 'locker',
  });

  const gen = interactables.spawn('generator', {
    id: 'set_2', position: [-4.6, 0, Z - 1.6], rotation: face,
  });

  interactables.spawn('lift', {
    id: 'lift_2', position: [6.2, 0, Z - 1.4], rotation: face,
    floors: [{ name: 'INTAKE', y: 0 }, { name: 'PLANT', y: -6.8 }],
    powered: false,
  });

  interactables.spawn('door', {
    id: 'door_jammed', position: [11.6, 0, Z - 0.1], rotation: face,
    variant: 'jammed', label: 'a jammed door',
  });
  interactables.spawn('door', {
    id: 'door_chained', position: [14.0, 0, Z - 0.1], rotation: face,
    variant: 'chained', label: 'a chained door',
  });

  // ---- pickups ----
  const drops = [
    { item: 'pry_bar', at: [-26.2, 0.02, Z - 1.4] },
    { item: 'battery_cell', at: [-22.0, 0.02, Z - 1.4] },
    { item: 'card_warden', at: [-17.6, 0.02, Z - 1.4] },
    { item: 'fuse_core', at: [-8.2, 0.02, Z - 1.4] },
    { item: 'fuse_core', at: [-7.0, 0.02, Z - 1.4] },
    { item: 'fuse_core', at: [-5.8, 0.02, Z - 2.6] },
  ];
  for (const d of drops) {
    interactables.spawn('pickup', { item: d.item, position: d.at, rotation: Math.random() * 6.28 });
  }
  const papers = ['nb_1', 'nb_2', 'nb_3', 'note_board_c', 'note_generator_start', 'note_open_day'];
  papers.forEach((n, i) => {
    interactables.spawn('pickup', {
      item: 'note', noteId: n, position: [-25 + i * 3.4, 0.02, Z - 2.2],
      rotation: (i * 1.31) % 3.14,
    });
  });

  // ---- director / progression setup ----
  director?.registerSafeRoom({ id: 'office_of_record', position: [-25.2, 0, 25.2], yaw: 0, zone: 'safe' });
  progression?.installDefaultGates();

  // ---- attendant candidates ----
  attendant?.registerFloor('intake_sw', [-31, 18, -12, 30], 0);
  attendant?.registerFloor('intake_se', [2, 18, 28, 30], 0);
  attendant?.adopt(interactables);

  // ---- the Surveyor, dormant, well away from the bench ----
  entity?.spawnAt(-25.2, 0, -8.4, 0);

  return { board, gen };
}

export default installGameplay;
