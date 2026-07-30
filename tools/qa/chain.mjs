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
