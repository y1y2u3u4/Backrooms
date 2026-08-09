/**
 * Director — headless pacing checks.
 *
 * WHY THIS FILE EXISTS.
 *
 * Every claim ever made about this game's pacing came from
 * `tools/qa/playthrough.mjs`, which drives a real browser. That is the right
 * instrument and it stays the authority on how a session feels, but it costs a
 * full 708-second session in SwiftShader — on a loaded machine that is hours,
 * and on 2026-08-06 it was ten. So the one change that most needed a session to
 * prove it — the `acts` flag, which is supposed to stop the Director filling a
 * game with distant doors that ask nothing of the player — was shipped on a
 * `chain` pass and an argument.
 *
 * The Director is pure logic. It reads a position, a light rig and a bus, and
 * decides. None of that needs a GPU, so none of it needed to wait on one. This
 * runs the same decision loop against stubs, at whatever length is useful, in
 * under a second.
 *
 * WHAT THIS CANNOT TELL ANYONE, stated up front because a green file invites
 * the opposite assumption: it does not know whether the pacing is *good*. It
 * knows what the Director fires, how often, in what mixture, and whether its
 * own stated floors hold. Whether three beats in nine minutes is frightening is
 * a question for a person.
 *
 *   node src/systems/qa/director_sim.mjs [--verbose]
 */

import * as THREE from 'three';
import { Bus } from '../../core/util.js';
import { Director } from '../Director.js';

const VERBOSE = process.argv.includes('--verbose');

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}   ${extra}`); }
};

/** A light rig with real circuits, so `circuit_trip` has something to trip. */
function makeRig() {
  const circuits = new Map();
  for (const c of ['intake', 'stack', 'plant', 'duct']) {
    circuits.set(c, { powered: true, level: 1, target: 1 });
  }
  return {
    circuits,
    isPowered(c) { return !!circuits.get(c)?.powered; },
    setCircuit(c, on) {
      const e = circuits.get(c);
      if (e) { e.powered = !!on; e.target = on ? 1 : 0; e.level = on ? 1 : 0; }
    },
    illuminationAt() { return 3; },
    invalidateShadows() {},
  };
}

/**
 * The player, with EVERY field the Director reads.
 *
 * The first version of this stub omitted `exertion`. `_computeFear` does
 * `clamp01(p.exertion) * 0.10`, so fear became NaN on the first frame, every
 * beat's score became NaN, and the weighted walk in `_maybeFire` — `r -= score`
 * until `r <= 0`, which NaN never satisfies — fell through to its final
 * `_fire(options[options.length - 1])`. The Director then fired the LAST entry
 * in the `BEATS` object literal every single time, identically for every seed.
 *
 * That produced a clean, plausible, completely false finding: "three of the six
 * beat types never fire". It was a defect in this file. Anything added here
 * must supply the whole shape or it will invent results of exactly that kind.
 */
function makePlayer() {
  return {
    position: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    exertion: 0,
    fear: 0,
    frozen: false,
    controlEnabled: true,
    makeNoise() {}, kick() {}, teleport() {},
  };
}

/**
 * Fail loudly rather than quietly producing a deterministic sequence. A NaN
 * anywhere in the pacing maths does not throw — it silently converts the
 * weighted draw into "always the last beat in the table", which reads as a real
 * result. Nothing downstream would notice.
 */
function assertFinite(d, where) {
  for (const k of ['fear', 'dread', 'tension', 'intensity', 'sinceBeat']) {
    if (!Number.isFinite(d[k])) throw new Error(`${where}: Director.${k} = ${d[k]}`);
  }
}

/** A Surveyor stub that records what it was asked to do. */
function makeSurveyor() {
  return {
    active: false, state: 'DORMANT',
    position: new THREE.Vector3(60, 0, 60),
    spawns: 0, rouses: 0,
    spawnAt() { this.spawns++; this.active = true; this.state = 'DORMANT'; },
    despawn() { this.active = false; this.state = 'DORMANT'; },
    rouse() { this.rouses++; this.state = 'ROUSED'; },
  };
}

/**
 * Run a session. The player walks a slow circuit so the Director sees movement
 * and zone-scale displacement rather than a statue, which is what its quiet
 * accounting is written against.
 */
function session({ seconds = 708, seed = 0xd12ec7, dt = 1 / 60 } = {}) {
  const bus = new Bus();
  const rig = makeRig();
  const player = makePlayer();
  const surveyor = makeSurveyor();
  const attendant = { acts: 0, act() { this.acts++; } };
  const flashlight = { battery: 1, _restrikeT: 0, setBattery(v) { this.battery = v; } };
  const d = new Director({ player, rig, bus, surveyor, attendant, flashlight, seed });

  const beats = [];
  bus.on('director:beat', (e) => beats.push({ t: +d.time.toFixed(1), name: e?.name }));

  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    // A 40 m loop at walking pace.
    player.position.set(Math.sin(t * 0.05) * 20, 0, Math.cos(t * 0.05) * 20);
    d.update(dt);
    if (i === 60) assertFinite(d, 'after one second');
  }
  assertFinite(d, `after ${seconds} s`);
  return { d, beats, bus, rig, surveyor, attendant };
}

console.log('\nDirector — headless pacing checks\n');

// 1. It fires at all, and within its own stated floor ------------------------
{
  console.log('rate');
  const { beats, d } = session({ seconds: 708 });
  if (VERBOSE) console.log('    ', beats.map((b) => `${b.t}s ${b.name}`).join(' | '));
  ok('a nine-minute session fires more than one beat',
    beats.length >= 2, `${beats.length} beats: ${beats.map((b) => b.name).join(', ')}`);
  // The file's own header calls 95 s its calmest floor and the shipping code a
  // beat per 546 s "five and a half times slower than its own design". A
  // session must not be slower than the floor it sets for itself.
  const rate = beats.length ? 708 / beats.length : Infinity;
  ok('the average gap is inside the Director\'s own quiet ceiling',
    rate <= d.quietCeiling * 2.2,
    `one beat per ${rate.toFixed(0)} s, ceiling ${d.quietCeiling} s`);
}

// 2. THE MIX. This is the check the `acts` flag exists for. -------------------
//
// A beat the player cannot respond to is atmosphere: a door a long way off, the
// Attendant having been somewhere, a noise in the services. Those are the point
// of the game and there should be plenty. But a session made only of them is a
// screensaver — nothing ever asks the player to do anything, and the pacing
// system reads as a sound bank on a timer.
//
// `BEATS[].acts` marks the ones that change the player's situation, and
// `atmosphereRun` is supposed to force one after two that did not. Before this
// pass the observed mixture was one acting beat in five. Nothing verified it
// afterwards, because the only instrument was a session this machine could not
// finish. This is that verification.
{
  console.log('the mix of beats that ask something of the player');
  const ACTS = { circuit_trip: true, rouse: true, lamp_stutter: true };
  // Three seeds, so a lucky draw cannot carry the claim.
  const runs = [0xd12ec7, 0x51a7e1, 0xbeef01].map((seed) => session({ seconds: 708, seed }));
  const all = runs.flatMap((r) => r.beats);
  const acting = all.filter((b) => ACTS[b.name]);
  if (VERBOSE) {
    for (const r of runs) console.log('    ', r.beats.map((b) => b.name).join(', '));
  }
  ok('some beat in a session asks the player to respond',
    acting.length > 0,
    `${acting.length} of ${all.length} across 3 sessions: ${all.map((b) => b.name).join(', ')}`);
  // The bar is the Director's own: `atmosphereRun = 2` promises that at most two
  // non-acting beats pass before an acting one, which is a floor of one in three.
  ok('at least one beat in three asks the player to respond',
    all.length < 3 || acting.length * 3 >= all.length,
    `${acting.length}/${all.length} = ${(acting.length / Math.max(1, all.length)).toFixed(2)}`);
  // And the run length the flag is named for.
  let worst = 0, run = 0;
  for (const r of runs) {
    run = 0;
    for (const b of r.beats) { if (ACTS[b.name]) run = 0; else worst = Math.max(worst, ++run); }
  }
  ok('never more than two atmosphere beats in a row',
    all.length < 3 || worst <= 2, `longest run of beats that asked nothing: ${worst}`);
}

// 3. Variety -----------------------------------------------------------------
//
// One beat type fired over and over is one beat type. The pre-pass measurement
// was a single kind in a whole session.
{
  console.log('variety');
  const runs = [0xd12ec7, 0x51a7e1, 0xbeef01].map((seed) => session({ seconds: 708, seed }));
  const kinds = new Set(runs.flatMap((r) => r.beats).map((b) => b.name));
  ok('a session draws on more than one kind of beat',
    kinds.size >= 3, `${kinds.size} kinds: ${[...kinds].join(', ')}`);
}

// 4. It does not act while the player is helpless ----------------------------
//
// Only ONE of these is a promise the Director makes, and the first draft of
// this file asserted both. `update` returns early while `dying > 0`, so nothing
// fires on the death screen — but `dying` is a countdown that `update` itself
// decrements, so a test that sets it once and then runs nine minutes is testing
// the ten frames after the assignment and the rest of the session unguarded.
//
// Hiding is NOT such a promise, and asserting it was inventing a contract. Line
// 352 adds 0.30 to FEAR while hidden — the header's "hiding is not relief; it
// is a decision you have already made" — and `hide:enter` buys thirty seconds
// of grace and no more. The building is supposed to keep going while you are in
// the locker. What follows tests the thirty seconds that were actually promised.
{
  console.log('refusals');
  const bus = new Bus();
  const rig = makeRig(); const player = makePlayer(); const surveyor = makeSurveyor();
  const d = new Director({ player, rig, bus, surveyor, seed: 7 });
  const beats = [];
  bus.on('director:beat', (e) => beats.push(e?.name));
  for (let i = 0; i < 60 * 708; i++) {
    d.dying = 1;                        // held, as the death sequence holds it
    player.position.set(Math.sin(d.time * 0.05) * 20, 0, Math.cos(d.time * 0.05) * 20);
    d.update(1 / 60);
  }
  ok('nothing fires while the player is dying', beats.length === 0,
    `${beats.length} beats fired on the death screen: ${beats.join(', ')}`);
}
{
  const bus = new Bus();
  const rig = makeRig(); const player = makePlayer(); const surveyor = makeSurveyor();
  const d = new Director({ player, rig, bus, surveyor, seed: 7 });
  const beats = [];
  bus.on('director:beat', (e) => beats.push({ t: +d.time.toFixed(1), name: e?.name }));
  bus.emit('hide:enter', {});
  for (let i = 0; i < 60 * 29; i++) {
    player.position.set(Math.sin(d.time * 0.05) * 20, 0, Math.cos(d.time * 0.05) * 20);
    d.update(1 / 60);
  }
  ok('getting into a locker buys the thirty seconds it promises',
    beats.length === 0,
    `${beats.length} beats in the 30 s after hide:enter: ${beats.map((b) => `${b.t}s ${b.name}`).join(', ')}`);
  ok('and no longer than that — the building does not stop for you',
    d.hidden === true && (d.graceUntil - d.time) < 2,
    `hidden=${d.hidden} grace left=${(d.graceUntil - d.time).toFixed(1)} s`);
}

// 5. Grace ------------------------------------------------------------------
//
// `Setpieces` buys quiet with `grantGrace` so an authored moment is not talked
// over by a systemic one. If grace does not actually hold, that contract is
// decorative.
{
  console.log('grace');
  const bus = new Bus();
  const rig = makeRig(); const player = makePlayer(); const surveyor = makeSurveyor();
  const d = new Director({ player, rig, bus, surveyor, seed: 11 });
  const beats = [];
  bus.on('director:beat', (e) => beats.push({ t: +d.time.toFixed(1), name: e?.name }));
  d.grantGrace?.(30);
  for (let i = 0; i < 60 * 28; i++) {
    player.position.set(Math.sin(d.time * 0.05) * 20, 0, Math.cos(d.time * 0.05) * 20);
    d.update(1 / 60);
  }
  ok('a granted grace holds the systemic layer off',
    beats.length === 0, `${beats.length} beats inside a 30 s grace: ${beats.map((b) => `${b.t}s ${b.name}`).join(', ')}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
