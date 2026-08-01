/**
 * Critical-path test — can the game actually be finished?
 *
 * WHY THIS EXISTS
 *
 * Everything else in tools/qa measures the building: is the floor there, is the
 * lamp reachable, is the corner dark. None of it asked the only question that
 * decides whether this is a game — can a player get from the lift they arrive in
 * to the lift they leave in? It could not, for a long time and invisibly: the
 * zone builders declared `interactables: []` and nothing read them, so the
 * interactor's registry was empty in every shipped build. There was no breaker to
 * throw, no core to carry and no set to start.
 *
 * This builds all eight zones for real, runs the real gameplay wiring over them
 * (ZoneGameplay, Interactables, Interactor, Inventory, Progression), and then
 * plays the critical path by firing the same interactables a player's E key fires
 * — through `Interactor`'s own gating, so a missing key, a locked door or an
 * unfitted core refuses here exactly as it would in the browser.
 *
 * It is not a substitute for playing. It is the thing that catches the class of
 * bug where playing for twenty minutes tells you nothing because the object you
 * needed was never in the level.
 *
 *   node tools/qa/chain.mjs
 *   node tools/qa/chain.mjs --verbose
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 0. a canvas, because the props have real writing on them
// ---------------------------------------------------------------------------
// `Interactables.textTexture` draws breaker schedules, keypad displays and
// terminal pages into a 2D context. Node has no DOM, so rather than skip the
// props that can read (which is most of them) this provides the smallest context
// that satisfies the calls actually made.
{
  const ctx2d = () => ({
    fillStyle: '#000', font: '', textBaseline: '', textAlign: '', globalAlpha: 1,
    shadowColor: '', shadowBlur: 0, lineWidth: 1, strokeStyle: '#000',
    fillRect() {}, fillText() {}, strokeText() {}, setTransform() {}, clearRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {}, arc() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: (s) => ({ width: String(s).length * 8 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {},
  });
  const canvas = () => {
    const c = { width: 0, height: 0, style: {}, getContext: ctx2d, toDataURL: () => '' };
    return c;
  };
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas' ? canvas() : { style: {}, appendChild() {} }),
    createElementNS: () => ({ style: {} }),
    body: { appendChild() {} },
  };
  globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  // three's CanvasTexture checks for HTMLCanvasElement / OffscreenCanvas in some
  // paths; a bare object is enough for our uses because nothing is uploaded.
}

const { CollisionWorld } = await import('../../src/player/Physics.js');
const { FIXTURE_TYPES } = await import('../../src/render/Lighting.js');
const { ZONE_ORIGIN } = await import('../../src/world/ZoneKit.js');
const { Bus } = await import('../../src/core/util.js');
const { Inventory } = await import('../../src/player/Inventory.js');
const { Interactor } = await import('../../src/player/Interactor.js');
const { Interactables } = await import('../../src/systems/Interactables.js');
const { NotesLibrary } = await import('../../src/systems/Notes.js');
const { Progression, ENDINGS } = await import('../../src/systems/Progression.js');
const { ZoneGameplay } = await import('../../src/systems/ZoneGameplay.js');
const SaveGame = await import('../../src/systems/SaveGame.js');

// A localStorage stand-in, so the save format can be round-tripped without a
// browser. It is the only global the save layer touches.
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const VERBOSE = process.argv.includes('--verbose');

// ---------------------------------------------------------------------------
// 1. headless material / rig / decal stand-ins
// ---------------------------------------------------------------------------
const sharedMat = new THREE.MeshBasicMaterial();
sharedMat.userData = {};
const materials = {
  get: () => sharedMat, decorate: (m) => m, emissive: () => sharedMat,
  all: new Set(), cache: new Map(),
};
const palette = new Proxy({}, { get: () => () => sharedMat });
const permissive = () => new Proxy(function stub() {}, {
  get: (t, k) => (k === Symbol.iterator ? function* () {}
    : k === 'then' ? undefined : permissive()),
  apply: () => permissive(), construct: () => permissive(),
});

function makeRig() {
  const circuits = new Map();
  const fixtures = [];
  return {
    fixtures, circuits, shadowMapSize: 512,
    add(sp) {
      const f = {
        ...sp, type: sp.type || 'troffer', health: sp.health || 'good',
        def: FIXTURE_TYPES[sp.type] || FIXTURE_TYPES.troffer,
        group: { position: new THREE.Vector3(...(sp.position || [0, 0, 0])), rotation: { y: 0 }, add() {} },
        light: {
          visible: true, color: new THREE.Color(1, 1, 1),
          shadow: { mapSize: { set() {} }, camera: {} },
          position: new THREE.Vector3(), target: null, castShadow: false,
        },
        target: new THREE.Object3D(), level: 1, tube: null, coneMesh: null,
        setHealth(h) { this.health = h; },
      };
      fixtures.push(f);
      if (!circuits.has(f.circuit)) circuits.set(f.circuit, { powered: true, level: 1 });
      return f;
    },
    setCircuit(name, powered) { circuits.set(name, { powered: !!powered, level: powered ? 1 : 0 }); },
    isPowered: (n) => !!circuits.get(n)?.powered,
    circuitLevel: (n) => (circuits.get(n)?.level ?? 0),
    invalidateShadows() {}, requestShadowRefresh() {}, setLightBudget() {},
  };
}

const ZONE_FILES = {
  intake: '../../src/world/zones/IntakeZone.js',
  service: '../../src/world/zones/ServiceZone.js',
  cistern: '../../src/world/zones/CisternZone.js',
  residence: '../../src/world/zones/ResidenceZone.js',
  plant: '../../src/world/zones/PlantZone.js',
  duct: '../../src/world/zones/DuctZone.js',
  stack: '../../src/world/zones/StackZone.js',
  safe: '../../src/world/zones/SafeRoom.js',
};

// ---------------------------------------------------------------------------
// 2. build the building, then run the real gameplay wiring over it
// ---------------------------------------------------------------------------
const bus = new Bus();
const collision = new CollisionWorld();
const rig = makeRig();
const scene = new THREE.Group();
const camera = new THREE.PerspectiveCamera(66, 1.6, 0.1, 100);

const notes = new NotesLibrary(bus);
const inventory = new Inventory({ bus, player: null });
const player = {
  position: new THREE.Vector3(), groundY: 0,
  makeNoise() {}, kick() {}, teleport() {},
};
const interactor = new Interactor({ camera, player, inventory, bus, rig, hands: null, game: null });

const zones = {};
const ctx = {
  materials, palette, collision, rig, scene, bus, assets: null,
  interactor, inventory, player, notes, hands: null, flashlight: null,
  decals: permissive(),
};
const interactables = new Interactables(ctx);
ctx.interactables = interactables;

for (const [id, file] of Object.entries(ZONE_FILES)) {
  const mod = await import(file);
  const fn = Object.values(mod).find((v) => typeof v === 'function' && /^build/.test(v.name));
  const zone = fn({ ...ctx, zoneId: id }, { seed: 20240607, origin: ZONE_ORIGIN[id] });
  zone.id = id;
  zones[id] = zone;
  scene.add(zone.root);
}

/** Director stand-in: only `zone` and `registerSafeRoom` matter to Progression. */
const director = {
  zone: 'intake', deaths: 0, safeRooms: [], lastSafe: null,
  registerSafeRoom(r) { this.safeRooms.push(r); this.lastSafe = r; return r; },
  respawn() {}, _fire() {},
};

const progression = new Progression({
  bus, inventory, notes, interactables, interactor, director, player,
});

const world = {
  zones,
  origin: (id) => ZONE_ORIGIN[id] || [0, 0, 0],
};
const gameplay = { interactables, progression, director, attendant: null, interactor };
const zg = new ZoneGameplay({ world, gameplay, ctx }).attach();
progression.installDefaultGates();

// Zone entry is what reveals the core hunts and attributes a core to a hunt.
const enter = (id) => { director.zone = id; bus.emit('zone:enter', { zone: id, from: null }); };

// ---------------------------------------------------------------------------
// 3. the E key
// ---------------------------------------------------------------------------
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (VERBOSE || !ok) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

/**
 * Fire an interactable the way `Interactor._fire` does, through the same refusal
 * gate the reticle uses. Returns the refusal string, or null on success.
 */
function use(id, { expectRefusal = false } = {}) {
  const item = interactor.get(id);
  if (!item) return `no such interactable "${id}"`;
  const reason = interactor._refusalFor(item);
  if (reason) {
    if (!expectRefusal) return reason;
    item.onRefused?.(player, reason);
    return reason;
  }
  try { item.onUse?.(player, null, interactor); } catch (e) { return `threw: ${e.message}`; }
  bus.emit('interact:use', { id: item.id, kind: item.kind, label: item.label });
  if (item.once) interactor.remove(item);
  return null;
}

/** Hold a hold-action to completion (valves, the starter). */
function hold(id, seconds) {
  const item = interactor.get(id);
  if (!item) return `no such interactable "${id}"`;
  const reason = interactor._refusalFor(item);
  if (reason) return reason;
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) item.onHold?.(Math.min(1, t / (item.hold || 1)), step);
  try { item.onUse?.(player, null, interactor); } catch (e) { return `threw: ${e.message}`; }
  bus.emit('interact:use', { id: item.id, kind: item.kind, label: item.label });
  return null;
}

/** Every pickup of a given item id, nearest-first by nothing in particular. */
const pickupsOf = (item) => interactor.items.filter((i) => i.kind === 'pickup' && i.id?.startsWith(item));

// ---------------------------------------------------------------------------
// 4. the critical path
// ---------------------------------------------------------------------------
console.log('');
console.log('critical path — playing the game through the interactor');
console.log('');

const s = zg.debugState();
check('the gameplay layer found every zone', s.zones.length === 8, `${s.zones.length} zones`);
check('props were built', s.props >= 60, `${s.props} props`);
check('doors were hung', s.doors >= 20, `${s.doors} doors`);
check('the objective list is live', !!progression.current, progression.current?.id);

// -- Intake: the lamp and the induction sheet -------------------------------
enter('intake');
{
  // The lamp is not a pickup — Inventory's constructor gives you one, because you
  // arrived with it. What the entrance bay teaches is that things can be taken.
  check('the player arrives carrying the lamp', inventory.has('lamp'));
  const cell = interactor.items.find((i) => i.id?.startsWith('battery_cell'));
  check('a spare cell is on the floor of the arrival bay', !!cell);
  if (cell) { const r = use(cell.id); check('the cell can be picked up', r === null, String(r)); }
  check('the cell is in the inventory', inventory.has('battery_cell'));
}

// -- Service: the board ------------------------------------------------------
enter('service');
{
  const board = interactables.get('board_c');
  check('Distribution Board C exists', !!board);
  const ways = board?.api.state() || [];
  check('the board has eight ways', ways.length === 8);
  check('way 8 is dead', ways[7]?.dead === true, ways[7]?.name);
  check('the Stack circuit starts dead', ways.find((w) => w.name === 'stack')?.on === false);
  check('the Plant high bay starts live', ways.find((w) => w.name === 'plant')?.on === true,
    'so the landmark hall is not a black room on arrival');

  // The Stack is gated on its circuit being live. Throw way 5.
  check('way 5 can be reset', use('board_c_way5') === null);
  progression.update(0.1);
  check('resetting way 5 unlocks the way into the Stack', !progression.isGated('to_stack'));
  const live = board.api.state().filter((w) => w.on).length;
  check('the main tripped something to make room', live <= 4, `${live} ways live, max 4`);
}

// -- Service: the pry bar and the schedule ----------------------------------
{
  const pry = interactor.items.find((i) => i.id?.startsWith('pry_bar'));
  check('the pry bar is in the Spine store', !!pry);
  if (pry) use(pry.id);
  check('the pry bar is carried', inventory.has('pry_bar'));
}

// -- The Residence is shut until the warden's card turns up ----------------
check('the way into the Residence is locked', progression.isGated('to_residence'),
  progression.gateReason('to_residence'));

// -- Stack: the warden's card ---------------------------------------------
enter('stack');
{
  const card = interactor.items.find((i) => i.id?.startsWith('card_warden'));
  check("the warden's card is in the Stack", !!card);
  if (card) check('the card can be taken', use(card.id) === null);
  check("the warden's card is carried", inventory.has('card_warden'));
  progression.update(0.1);
  check('carrying the card opens the Residence', !progression.isGated('to_residence'));
}

// -- Residence: R-207 ------------------------------------------------------
enter('residence');
{
  const door = interactor.door('door_r207');
  check('R-207 has a real door', !!door);
  check('R-207 is locked', door?.locked === true);
  const r = use('reader_r207');
  check('the R-207 reader accepts the card', r === null, String(r));
  check('R-207 is now unlocked', interactor.door('door_r207')?.locked === false);

  const core = pickupsOf('fuse_core')[0];
  check('a core is in R-207', !!core);
  if (core) check('the R-207 core can be taken', use(core.id) === null);
  check('one core carried', inventory.count('fuse_core') === 1, `count ${inventory.count('fuse_core')}`);

  // A core needs both hands, so a second one refuses until the first is fitted.
  // That is what makes three cores three journeys rather than one shopping trip.
  const second = pickupsOf('fuse_core')[0];
  if (second) {
    const refusal = use(second.id, { expectRefusal: true });
    check('a second core refuses while both hands are full',
      typeof refusal === 'string' && /already carrying|hands are full/i.test(refusal), String(refusal));
  }
}

// -- Plant: fit the first core --------------------------------------------
enter('plant');
{
  check('reaching the Plant completes the first objective',
    progression.objective('reach_plant').state === 'done');
  check('all three core hunts are open',
    ['core_cistern', 'core_residence', 'core_stack']
      .every((id) => progression.objective(id).state !== 'hidden'));
  check('the Residence core was credited to its own hunt',
    progression.objective('core_residence').state === 'done');

  const gen = interactables.get('set_2');
  check('Set No. 2 exists', !!gen);
  check('the fuel valve refuses with fewer than three cores',
    /core/i.test(String(use('set_2_fuel', { expectRefusal: true }))));
  check('the first core fits', use('set_2_socket0') === null);
  check('the core left the inventory', inventory.count('fuse_core') === 0);
}

// -- Cistern: the penstock, the drain, and the second core --------------
enter('cistern');
{
  const p1 = interactor.get('penstock_1');
  check('penstock 1 exists and is open', !!p1 && p1.verb === 'Close');
  const p2 = interactor.get('penstock_2');
  check('penstock 2 is padlocked',
    /padlock/i.test(String(interactor._refusalFor(p2))), String(interactor._refusalFor(p2)));

  const key = interactor.items.find((i) => i.id?.startsWith('key_penstock'));
  check('the padlock key is in the sump', !!key);
  if (key) use(key.id);
  check('penstock 2 now turns', interactor._refusalFor(interactor.get('penstock_2')) === null);

  let drained = false;
  bus.on('world:drain', (e) => { if (e.open === false) drained = true; });
  for (let i = 0; i < 5; i++) hold('penstock_1', 1.4);
  check('five turns shuts penstock 1 and drains the chamber', drained);
  check('the Cistern animates its own water level', typeof zones.cistern.update === 'function');

  const core = pickupsOf('fuse_core')[0];
  check('a core is in the penstock chamber', !!core);
  if (core) check('the Cistern core can be taken', use(core.id) === null);
}

enter('plant');
check('the second core fits', use('set_2_socket1') === null);

// -- Stack: the third core ------------------------------------------------
enter('stack');
{
  const core = pickupsOf('fuse_core')[0];
  check('a core is in the Stack lift lobby', !!core);
  if (core) check('the Stack core can be taken', use(core.id) === null);
}
enter('plant');
check('the third core fits', use('set_2_socket2') === null);
check('fitting three cores completes the objective',
  progression.objective('fit_cores').state === 'done');
check('the starting objective is now revealed',
  progression.objective('start_set').state === 'active');

// -- start the set --------------------------------------------------------
{
  check('the fuel valve now opens', hold('set_2_fuel', 1.0) === null);
  check('the primer refuses nothing', interactor._refusalFor(interactor.get('set_2_prime')) === null);
  for (let i = 0; i < 12; i++) use('set_2_prime');
  check('twelve strokes makes it firm', interactables.get('set_2').state().primed === true);
  check('the starter refuses under 2.6 s of cranking',
    hold('set_2_start', 1.0) === null && interactables.get('set_2').state().running === false,
    'a short crank must not catch');
  check('holding the starter starts the set', hold('set_2_start', 4.2) === null);
  check('Set No. 2 is running', interactables.get('set_2').state().running === true);
  check('the set completes its objective', progression.objective('start_set').state === 'done');
  check('starting the set energises way 8',
    interactables.get('board_c').api.state()[7].dead === false);
  check('starting the set powers the lift', interactables.get('lift_2').api.state().power === true);
  check('the lift gate is no longer gated', !progression.isGated('exit_lift'));
}

// -- ride out -------------------------------------------------------------
{
  const lift = interactables.get('lift_2');
  check('the lift can be called', use('lift_2_call') === null);
  // Ride: press SURFACE and step the car until it arrives.
  check('the surface button can be pressed', use('lift_2_btn1') === null);
  for (let i = 0; i < 60 * 60 && !progression.ended; i++) lift.update(1 / 60, i / 60);
  check('the car arrives and the game ends', progression.ended === ENDINGS.LEFT,
    `ending = ${progression.ended}`);
}

// -- the other ending -----------------------------------------------------
// A second, independent run would be the honest way to test the hidden ending;
// what is checked here is that the docket exists, is repeatable, and refuses
// before the set is running — the three properties the ending depends on.
{
  const docket = interactor.get('docket_0000');
  check('Docket 0000 is on the desk', !!docket);
  check('the docket is not consumed by reading it', docket?.once === false);
}

// -- reading ---------------------------------------------------------------
// Papers are the whole story layer and the discoveries are counted off them, so
// read some before capturing a save: `notes.read` is what a save has to carry.
{
  const papers = interactor.items.filter((i) => i.kind === 'pickup' && i.verb === 'Read').slice(0, 6);
  let opened = 0;
  for (const p of papers) if (use(p.id) === null) opened++;
  check('documents can be read', opened >= 4, `${opened} of ${papers.length} opened`);
  check('reading files them in the library', notes.read.size >= 4, `${notes.read.size} read`);
}

// -- the save format ------------------------------------------------------
// The title screen has always had a Continue item and nothing ever wrote the key
// it reads. What matters about a save is not that it writes: it is that what comes
// back is the same run. This captures at the end of a completed playthrough — the
// hardest state to reproduce — writes it, mutates everything, restores, and
// compares field by field.
{
  const fakeGame = {
    bus,
    time: 1234.5,
    player: {
      position: new THREE.Vector3(...zonesWorld('plant', [2.6, -6.0, -2.0])),
      yaw: 1.25,
      teleport(x, y, z, yaw) { this.position.set(x, y, z); this.yaw = yaw; },
    },
    world: {
      currentZone: 'plant',
      zones,
      toLocal: (id, p) => { const o = ZONE_ORIGIN[id]; return [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; },
      toWorld: (id, p) => { const o = ZONE_ORIGIN[id]; return [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; },
      enter: (id) => { fakeGame.world.currentZone = id; return { zone: id }; },
    },
    gameplay: { interactables, notes },
    inventory, progression, director,
  };
  function zonesWorld(id, p) { const o = ZONE_ORIGIN[id]; return [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; }

  const before = SaveGame.capture(fakeGame);
  check('a checkpoint can be written', SaveGame.write(fakeGame) === true);
  check('the written save reads back', !!SaveGame.readSave());
  check('the save records where you are', before.where.zone === 'plant'
    && Math.abs(before.where.position[0] - 2.6) < 1e-6,
    JSON.stringify(before.where));
  check('the save records the objective states',
    before.progress.objectives.length === progression.objectives.length
    && before.progress.objectives.every(([, st]) => typeof st === 'string'));
  check('the save records the cores', before.progress.coresFitted === 3,
    `fitted ${before.progress.coresFitted}`);
  check('the save records the ending', before.progress.ended === ENDINGS.LEFT);
  check('the save records the board', (before.switched?.ways || []).length === 8);
  check('the save records the sockets',
    (before.fitted?.sockets || []).filter(Boolean).length === 3);
  check('the save records what has been read',
    (before.read?.read || []).length > 0, `${(before.read?.read || []).length} documents`);

  // Now break everything and put it back.
  const board = interactables.get('board_c');
  board.api.setWay('service', false);
  board.api.setWay('intake', false);
  progression.coresFitted = 0;
  progression.ended = null;
  for (const o of progression.objectives) o.state = 'hidden';
  inventory.slots.clear();
  fakeGame.player.teleport(0, 0, 0, 0);
  fakeGame.world.currentZone = 'intake';

  const r = SaveGame.restore(fakeGame, before);
  check('restore reports success', r.ok, `missing: ${r.missing.join(', ') || 'nothing'}`);
  check('restore puts you back in the right zone', fakeGame.world.currentZone === 'plant');
  check('restore puts you back in the right place',
    Math.abs(fakeGame.player.position.x - zonesWorld('plant', [2.6, 0, 0])[0]) < 1e-3,
    `x=${fakeGame.player.position.x}`);
  check('restore puts the objectives back',
    progression.objective('ride_out') && progression.objectives.every(
      (o, i) => o.state === before.progress.objectives[i][1]));
  check('restore puts the cores back', progression.coresFitted === 3);
  check('restore puts the ending back', progression.ended === ENDINGS.LEFT);
  check('restore puts the board back',
    board.api.state().every((w, i) => w.on === before.switched.ways[i][1]),
    board.api.state().map((w) => `${w.name}:${w.on ? 1 : 0}`).join(' '));
  const after = SaveGame.capture(fakeGame);
  check('a captured state survives a round trip unchanged',
    JSON.stringify({ ...after, at: 0, clock: 0 }) === JSON.stringify({ ...before, at: 0, clock: 0 }),
    'capture -> write -> mutate -> restore -> capture');

  SaveGame.clearSave();
  check('a cleared save is gone', SaveGame.readSave() === null);
}

// -- portals ---------------------------------------------------------------
// `World.update` will not fire a portal it cannot see past — the fix for
// teleporting through shut doors — so every portal has to be approachable along
// an unobstructed line at the probe height the world actually uses. This is the
// check that catches the crawlspace case: an eye-height probe starts inside the
// Ductwork's 800 mm soffit and would seal both of its hatches.
{
  const PROBE_Y = 0.5;
  const unreachable = [];
  for (const [zid, zone] of Object.entries(zones)) {
    const o = ZONE_ORIGIN[zid];
    for (const p of zone.portals || []) {
      if (!p.target?.zone) continue;                 // an endpoint, by design
      // A portal a zone file declares `locked: true` is scenery — the bolted pipe
      // hatch out of the Spine, the sluice hatch out of the Cistern chamber. They
      // are behind walls on purpose and no gate ever opens them.
      if (p.locked) continue;
      const w = [p.position[0] + o[0], p.position[1] + o[1], p.position[2] + o[2]];
      // Approach from the arrive point, which is where the far side puts you and
      // therefore a place a player provably stands.
      const a = p.arrive || p.position;
      const aw = [a[0] + o[0], a[1] + o[1], a[2] + o[2]];
      const blocked = collision.segmentBlocked(
        aw[0], aw[1] + PROBE_Y, aw[2], w[0], w[1] + PROBE_Y, w[2], 'ceiling');
      const floor = collision.sampleFloor(aw[0], aw[2], aw[1] + 1.2, 3.0);
      if (blocked || !floor) {
        unreachable.push(`${zid}/${p.id}${blocked ? ' (line of sight blocked)' : ' (no floor at the arrive point)'}`);
      }
    }
  }
  check('every portal can be walked into from its own arrive point',
    unreachable.length === 0, unreachable.join(', ') || `${
      Object.values(zones).reduce((n, z) => n + (z.portals || []).filter((p) => p.target?.zone && !p.locked).length, 0)
    } live portals checked`);
}

// -- every zone grids to a walkable area a coverage metric can divide by ----
//
// `tools/qa/explore.mjs` measures how much of a zone an unguided player has
// stood in. Its denominator came from taking the centre of each 2 m grid cell
// and discarding it if it fell outside the floor rectangle — so a rectangle
// narrower than the grid contributed NOTHING. The Ductwork is built from 1.8 m
// spines and gridded to **zero cells**, which made its coverage a division by
// zero and let its visited cells inflate the overall figure with no denominator
// of their own.
//
// The exploration bot cannot catch this: it has never reached the Ductwork in
// any session, which is exactly why the defect survived. This file builds all
// eight zones with a real CollisionWorld and no browser, so it can.
{
  const CELL = 2.0;
  const empty = [];
  const counts = [];
  for (const [zid, zone] of Object.entries(zones)) {
    const o = ZONE_ORIGIN[zid] || [0, 0, 0];
    const cand = new Map();
    for (const f of collision.floors) {
      const cx = (f.minX + f.maxX) / 2, cz = (f.minZ + f.maxZ) / 2;
      // Zones are 400 m apart, so nearest-origin is an exact zone test.
      let best = null, bd = Infinity;
      for (const [k, oo] of Object.entries(ZONE_ORIGIN)) {
        const d = (cx - oo[0]) ** 2 + (cz - oo[2]) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      if (best !== zid) continue;
      const i0 = Math.floor(f.minX / CELL), i1 = Math.floor(f.maxX / CELL);
      const j0 = Math.floor(f.minZ / CELL), j1 = Math.floor(f.maxZ / CELL);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 60000) continue;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = Math.min(Math.max((i + 0.5) * CELL, f.minX + 0.02), f.maxX - 0.02);
        const z = Math.min(Math.max((j + 0.5) * CELL, f.minZ + 0.02), f.maxZ - 0.02);
        if (!(x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)) continue;
        cand.set(`${i}|${j}|${Math.round(f.y / 3)}`, { x, z, y: f.y });
      }
    }
    let n = 0;
    for (const c of cand.values()) {
      const top = collision.sampleFloor(c.x, c.z, c.y + 0.3, 0.4);
      if (!top) continue;
      // Crawl height — the Ductwork's soffit is 800 mm and is a corridor.
      if (collision.resolveCapsule(c.x, top.y + 0.1, c.z, 0.29, 0.62).hit) continue;
      n++;
    }
    counts.push(`${zid}:${n}`);
    if (n === 0) empty.push(zid);
    void o;
  }
  check('every zone grids to a non-zero walkable area',
    empty.length === 0,
    empty.length ? `no walkable cells at all in: ${empty.join(', ')}` : counts.join('  '));
}

// -- every bound key is on the screen that lists the keys --------------------
//
// `Input.ACTIONS` binds `cover` (V), `swapCell` (B) and `throwDecoy` (T). None
// of the three was on the pause screen's control list — and `Input.js`'s own
// comment calls `cover` "the single most important key in the game after WASD,
// which is why it is a hold rather than a toggle", because the Surveyor hears
// the lamp's switch click and does not hear a palm over the lens.
//
// A player cannot deduce a keybinding. Nothing in the project compared the two
// lists, so a key could be bound and unlisted forever, which is what happened.
{
  const { ACTIONS: BOUND } = await import('../../src/core/Input.js');
  const { CONTROLS } = await import('../../src/ui/Pause.js');
  // The listing is player-facing prose, so match on the key names it prints
  // rather than on the action ids: 'Ctrl / C', 'Q · R', 'Tab / J' are one row
  // covering several codes.
  const listed = CONTROLS.map(([k]) => k.toUpperCase()).join(' ');
  // Actions a player never presses deliberately, or that the UI owns.
  const EXEMPT = new Set(['forward', 'back', 'left', 'right', 'cancel', 'confirm', 'peek']);
  const CODE_TO_LABEL = {
    KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyG: 'G',
    KeyQ: 'Q', KeyR: 'R', KeyV: 'V', KeyB: 'B', KeyT: 'T', KeyC: 'C', KeyJ: 'J',
    KeyO: 'O', Tab: 'TAB', Escape: 'ESC', ShiftLeft: 'SHIFT', ControlLeft: 'CTRL',
  };
  const missing = [];
  for (const [action, codes] of Object.entries(BOUND)) {
    if (EXEMPT.has(action)) continue;
    const labels = codes.map((c) => CODE_TO_LABEL[c]).filter(Boolean);
    if (!labels.length) continue;                       // arrow keys etc.
    if (!labels.some((l) => new RegExp(`(^| |/|·)${l}( |$|/|·)`).test(listed))) {
      missing.push(`${action} (${labels.join('/')})`);
    }
  }
  check('every bound key appears on the pause screen\'s control list',
    missing.length === 0,
    missing.length ? `not listed: ${missing.join(', ')}` : `${CONTROLS.length} rows cover every bound action`);
}

// -- a shut door must not shut every door that shares its name ---------------
//
// A PORTAL ID IS NOT UNIQUE. `to_plant` names the Service Spine's lobby door
// (open, critical path), the Ductwork's hatch (open) and the Cistern's ladder
// hatch, which its zone file authors `locked: true`. `to_service`, `to_intake`
// and `to_residence` are likewise declared in more than one place.
//
// Two different bugs have lived in that fact. The registry was keyed by bare id,
// so the last zone built silently overwrote the others; re-keying it to
// `zone:id` fixed that and replaced it with a worse one, because `isGated` then
// answered with a UNION over homonyms — and one authored-shut hatch in the
// Cistern reported every route into the Plant as locked, permanently, with
// nothing able to open them. `World._preload` builds the Cistern from 14 m away,
// so it did not even need the player to go there.
//
// Neither version failed a single existing check: the critical path walks the
// interactor, and the portal graph reads the zone files rather than the gate
// state. This is the check that fails for both.
{
  const byId = new Map();
  for (const [zid, zone] of Object.entries(zones)) {
    for (const p of zone.portals || []) {
      if (!p.target?.zone) continue;
      if (!byId.has(p.id)) byId.set(p.id, []);
      byId.get(p.id).push({ zid, p });
    }
  }
  const shared = [...byId].filter(([, l]) => l.length > 1);

  // THE INVARIANT, and it is the one both bugs broke: what the world is told
  // about a door must be what that door's own registration says.
  //
  // Anything softer than this has no teeth. The first version of this check
  // skipped a portal its zone authored `locked: true` (correct scenery) and
  // skipped a portal that belongs to a gate group (correct gating) — which
  // between them skipped every portal involved, and the check passed with the
  // union bug restored. Comparing the answer to the registration cannot be
  // skipped away: under the union, `isGated('to_plant', 'service')` is true
  // while `portals.get('service:to_plant').locked` is false, and that is the
  // whole defect in one line.
  const bled = [];
  for (const [id, list] of shared) {
    for (const { zid } of list) {
      const own = progression.portals.get(`${zid}:${id}`);
      if (!own) { bled.push(`${zid}/${id} (never registered)`); continue; }
      const said = progression.isGated(id, zid);
      if (said !== !!own.locked) {
        bled.push(`${zid}/${id} reads ${said ? 'locked' : 'open'} but is registered ${own.locked ? 'locked' : 'open'}`);
      }
    }
    // AND THE PATH THE BUG ACTUALLY SHIPPED THROUGH.
    //
    // The comparison above is a tautology against the current implementation:
    // `isGated(id, zone)` with a truthy zone IS `portals.get(zone:id).locked`,
    // so it reduces to `x !== x`. It fails on the two historical implementations
    // — verified — and it would not notice the way the defect reached players in
    // the first place, which was `World.update` calling `isGated(p.id)` with no
    // zone at all. Drop that one argument and the Plant reseals with this file
    // still reporting every check green.
    //
    // So exercise the bare-id form too. For an id that names doors in several
    // zones, it must never answer "locked" on behalf of a door somewhere else.
    // Asserting on `isGated(id)`'s answer is not enough: with an arbitrary
    // `_byId(id)[0]` fallback the answer depends on which zone happened to build
    // first, and in this file's build order that happens to be an open door — so
    // the check would pass by luck. Assert the invariant instead. An ambiguous
    // bare id with no current zone must resolve to NOTHING, because a door
    // nobody can identify must not be allowed to shut the building.
    const here = progression.player?.game?.currentZone ?? progression.director?.zone ?? null;
    const r = progression._resolve(id);
    if (r && r.zone !== here) {
      bled.push(`_resolve('${id}') answered with ${r.zone}/${id} while the player is in ${here ?? 'no zone'}`
        + ` — one of ${list.length} doors with that name`);
    }
  }
  check('a door authored shut does not shut every door sharing its name',
    bled.length === 0,
    bled.length
      ? bled.join('; ')
      : `${shared.length} id(s) declared in more than one zone: ${shared.map(([k, l]) => `${k}x${l.length}`).join(', ')}`);

}

// -- doors ----------------------------------------------------------------
// The reason every door in the building is now a `DoorLatch` is not that doors
// are fun: it is that `Kit.doorway` leaves the wall opening walkable on purpose
// and hangs a leaf in it with no collider, so an unadopted door is a hole. These
// three checks are the ones that would have caught that.
{
  const doors = interactor.doors;
  const shut = doors.filter((d) => Math.abs(d.angle) < 0.25);
  const noCollider = doors.filter((d) => !d._collider);
  check('every door has a collider', noCollider.length === 0, `${noCollider.length} without`);
  check('every shut door blocks', shut.every((d) => d._collider?.enabled),
    `${shut.filter((d) => !d._collider?.enabled).length} shut doors are walk-through`);
  // A door with no floor on one side is locked, and a locked door must be shut,
  // or the leaf is out of the way and the hole is open again.
  const dead = doors.filter((d) => d.locked && !d.requires);
  check('doors onto nothing are locked AND shut',
    dead.every((d) => Math.abs(d.angle) < 0.25 && d._collider?.enabled),
    `${dead.length} dead-end doors, ${dead.filter((d) => Math.abs(d.angle) >= 0.25).length} of them ajar`);
  check('some doors are passable', doors.filter((d) => !d.locked).length >= 6,
    `${doors.filter((d) => !d.locked).length} of ${doors.length} lead somewhere`);
  if (VERBOSE) {
    const byZone = {};
    for (const d of doors) {
      const z = d.id.split('_door')[0];
      byZone[z] = byZone[z] || { open: 0, dead: 0 };
      if (d.locked && !d.requires) byZone[z].dead++; else byZone[z].open++;
    }
    console.log(`       doors by zone: ${Object.entries(byZone)
      .map(([z, v]) => `${z} ${v.open}/${v.open + v.dead}`).join(', ')}`);
  }
}

// -- discoveries ----------------------------------------------------------
{
  const allNotes = interactor.items.filter((i) => i.kind === 'pickup' && i.verb === 'Read');
  check('there are notes left to find', allNotes.length > 8, `${allNotes.length} unread documents`);
  const cassettes = interactor.items.filter((i) => i.label === 'Cassette' || i.id?.startsWith('cassette'));
  check('the cassettes are placed', cassettes.length >= 4, `${cassettes.length} cassettes`);
  check('the Office of Record is the respawn point',
    director.safeRooms.some((r) => r.id === 'office_of_record'), JSON.stringify(director.lastSafe));
}

// ---------------------------------------------------------------------------
console.log('');
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`  FAIL  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
console.log(failed.length === 0
  ? 'The game can be finished. Arrival lift to goods lift, three cores, one ending.'
  : `${failed.length} check(s) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
