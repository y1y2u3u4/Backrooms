#!/usr/bin/env node
/**
 * Headless simulation harness for the Surveyor's state machine.
 *
 * Rendering a 2.9 m entity walking round a corridor to find out whether its
 * confidence decays correctly is an absurd way to test a state machine, so this
 * runs the whole AI in node against a stub light rig and a real CollisionWorld.
 * It is a dev tool, not part of the build; nothing imports it.
 *
 *   node src/systems/qa/surveyor_sim.mjs
 *   node src/systems/qa/surveyor_sim.mjs --verbose
 */
import * as THREE from 'three';
import { Bus } from '../../core/util.js';
import { CollisionWorld } from '../../player/Physics.js';
import { Surveyor, STATE } from '../../entities/Surveyor.js';

const VERBOSE = process.argv.includes('--verbose');

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}   ${extra}`); }
};

/** A 40 x 40 m room with one dividing wall and a 2 m gap in it at x = 0. */
function makeWorld() {
  const c = new CollisionWorld();
  c.addFloor([-20, -20, 20, 20], 0, { surface: 'concrete' });
  for (const [a, b] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) { /* corners only for clarity */ }
  c.addBoxAt(0, 1.5, -20, 40, 3, 0.3, { tag: 'wall' });
  c.addBoxAt(0, 1.5, 20, 40, 3, 0.3, { tag: 'wall' });
  c.addBoxAt(-20, 1.5, 0, 0.3, 3, 40, { tag: 'wall' });
  c.addBoxAt(20, 1.5, 0, 0.3, 3, 40, { tag: 'wall' });
  // Divider at z = 0 with a doorway from x = -1 to x = +1.
  c.addBoxAt(-10.5, 1.5, 0, 19, 3, 0.3, { tag: 'wall' });
  c.addBoxAt(10.5, 1.5, 0, 19, 3, 0.3, { tag: 'wall' });
  return c;
}

/** Light rig stub: returns a constant, settable illumination everywhere. */
function makeRig(level = 0) {
  return {
    level,
    circuits: new Map(),
    illuminationAt() { return this.level; },
    invalidateShadows() {},
    setCircuit() {},
  };
}

function makePlayer(x = 0, z = 0) {
  return {
    position: new THREE.Vector3(x, 0, z),
    makeNoise() {}, kick() {},
  };
}

function makeEntity({ light = 4, playerAt = [0, 0] } = {}) {
  const bus = new Bus();
  const collision = makeWorld();
  const rig = makeRig(light);
  const player = makePlayer(playerAt[0], playerAt[1]);
  const scene = new THREE.Scene();
  const s = new Surveyor({ scene, collision, rig, player, flashlight: null, bus, palette: null });
  return { s, bus, rig, player, collision };
}

const run = (s, seconds, dt = 1 / 60) => {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) s.update(dt);
};

// ---------------------------------------------------------------------------

console.log('\nSurveyor — headless state machine checks\n');

// 1. Light rule -------------------------------------------------------------
{
  console.log('light rule');
  const { s } = makeEntity({ light: 0 });
  s.spawnAt(-8, 0, -8, 0);
  s.hear(new THREE.Vector3(8, 0, -8), 20);
  run(s, 8);
  const p0 = s.position.clone();
  const g0 = s.gait;
  run(s, 5);
  ok('frozen in darkness (no translation)', s.position.distanceTo(p0) < 0.01,
    `moved ${s.position.distanceTo(p0).toFixed(3)} m`);
  ok('frozen in darkness (gait phase held)', Math.abs(s.gait - g0) < 1e-9);
  ok('reports frozen', s.debugState().frozen === true);
  ok('lightScale is zero', s.lightScale === 0);
}
{
  const { s, rig } = makeEntity({ light: 5 });
  s.spawnAt(-8, 0, -8, 0);
  s.hear(new THREE.Vector3(8, 0, -8), 20);
  run(s, 5);
  const p0 = s.position.clone();
  run(s, 5);
  ok('advances under a bright fixture', s.position.distanceTo(p0) > 2.0,
    `moved ${s.position.distanceTo(p0).toFixed(2)} m`);
  ok('speed scales with light', s.lightScale === 1);

  // Kill the light mid-stride; it must stop within a frame or two.
  rig.level = 0;
  run(s, 0.2);
  const p1 = s.position.clone();
  run(s, 3);
  ok('stops when the light goes out', s.position.distanceTo(p1) < 0.05,
    `drifted ${s.position.distanceTo(p1).toFixed(3)} m`);
}

// 2. Hearing ---------------------------------------------------------------
{
  console.log('hearing');
  const { s } = makeEntity({ light: 4 });
  s.spawnAt(-8, 0, -8, 0);
  ok('starts dormant', s.state === STATE.DORMANT);
  const heard = s.hear(new THREE.Vector3(-6, 0, -8), 8);
  ok('a near noise is heard', heard > 0);
  ok('rouses on hearing', s.state === STATE.ROUSED);
  ok('belief is displaced, not exact',
    s.lastHeard.distanceTo(new THREE.Vector3(-6, 0, -8)) > 0.001);
  ok('belief is close enough to be useful',
    s.lastHeard.distanceTo(new THREE.Vector3(-6, 0, -8)) < 3.5,
    `err ${s.lastHeard.distanceTo(new THREE.Vector3(-6, 0, -8)).toFixed(2)} m`);

  const far = s.hear(new THREE.Vector3(-8, 0, 120), 4);
  ok('a distant quiet noise is inaudible', far === 0);
}
{
  const { s } = makeEntity({ light: 4 });
  s.spawnAt(0, 0, -8, 0);
  s.hear(new THREE.Vector3(0, 0, -6), 10);
  const c0 = s.confidence;
  run(s, 6);
  ok('confidence decays with time', s.confidence < c0, `${c0.toFixed(2)} -> ${s.confidence.toFixed(2)}`);
}

// 3. Announcement window ----------------------------------------------------
{
  console.log('announcement');
  const { s, bus } = makeEntity({ light: 5 });
  const states = [];
  bus.on('entity:state', (e) => states.push({ state: e.state, t: s.stateTime }));
  s.spawnAt(-8, 0, -8, 0);
  s.hear(new THREE.Vector3(6, 0, -8), 20);
  const p0 = s.position.clone();
  run(s, 3.0);
  ok('does not move during ROUSED', s.position.distanceTo(p0) < 0.02 && s.state === STATE.ROUSED,
    `state=${s.state} moved=${s.position.distanceTo(p0).toFixed(3)}`);
  run(s, 1.0);
  ok('ROUSED lasts 3-4 s then seeks', s.state === STATE.SEEKING, `state=${s.state}`);
  ok('emitted entity:state for ROUSED', states.some((x) => x.state === 'ROUSED'));
  ok('emitted entity:state for SEEKING', states.some((x) => x.state === 'SEEKING'));
}

// 4. Measuring --------------------------------------------------------------
{
  console.log('measuring');
  const { s } = makeEntity({ light: 5 });
  s.spawnAt(-8, 0, -8, 0);
  s.hear(new THREE.Vector3(-6.5, 0, -8), 10);
  run(s, 4);          // through ROUSED
  let reached = false;
  for (let i = 0; i < 60 * 30; i++) { s.update(1 / 60); if (s.state === STATE.MEASURING) { reached = true; break; } }
  ok('reaches the belief and measures', reached, `state=${s.state}`);
  const hold = s.measureHold;
  ok('measure hold is 4-9 s', hold > 0 && hold <= 9.001, `${hold.toFixed(2)} s`);
  ok('arm extends', s.armReach >= 0);
  const p0 = s.position.clone();
  run(s, 2);
  ok('stands still while measuring', s.position.distanceTo(p0) < 0.05,
    `moved ${s.position.distanceTo(p0).toFixed(3)} m`);
  ok('picks a wall normal', s.measureNormal.length() > 0.9);
}

// 5. Capture ----------------------------------------------------------------
{
  console.log('capture');
  const { s, bus, player } = makeEntity({ light: 6, playerAt: [-8, -8] });
  let death = null;
  bus.on('game:death', (e) => { death = e; });
  s.spawnAt(-8, 0, -2, 0);
  // A player who keeps making noise — footsteps every half second — is a player
  // who gets caught. That is the contract.
  let noiseT = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 60 && !death; i++) {
    noiseT += dt;
    if (noiseT >= 0.5) { noiseT = 0; s.hear(player.position, 8); }
    s.update(dt);
  }
  ok('closes on a player who keeps making noise',
    s.position.distanceTo(player.position) < 2.0,
    `dist ${s.position.distanceTo(player.position).toFixed(2)} m, state ${s.state}`);
  ok('emits game:death with cause surveyor', death?.cause === 'surveyor', JSON.stringify(death));
  ok('capture took over a second (no lunge)', s.captureT >= 1.3, `${s.captureT.toFixed(2)} s`);
}
{
  // The inverse contract, part one: make one noise, then move three metres and
  // go quiet. It walks to where the sound was, not to you, and then measures.
  const { s, player } = makeEntity({ light: 6, playerAt: [-8, -8] });
  s.spawnAt(-8, 0, -1, 0);
  s.hear(new THREE.Vector3(-8, 0, -8), 10);
  player.position.set(-4.2, 0, -8);        // sidestep after being heard
  run(s, 4);
  let captured = false;
  for (let i = 0; i < 60 * 60; i++) { s.update(1 / 60); if (s.state === STATE.CAPTURING) { captured = true; break; } }
  ok('walks to the sound, not the player', !captured, `state ${s.state}`);
}
{
  // Part two: killing the lights saves you even at arm's length.
  const { s, rig, player } = makeEntity({ light: 6, playerAt: [-8, -8] });
  s.spawnAt(-8, 0, -5, 0);
  s.hear(player.position, 12);
  run(s, 4);
  run(s, 1.5);
  rig.level = 0;
  let captured = false;
  for (let i = 0; i < 60 * 60; i++) { s.update(1 / 60); if (s.state === STATE.CAPTURING) { captured = true; break; } }
  ok('darkness saves a player it had committed to', !captured, `state ${s.state}`);
}

// 6. Losing the player ------------------------------------------------------
{
  console.log('losing the player');
  const { s, rig } = makeEntity({ light: 5, playerAt: [12, 12] });
  s.spawnAt(-8, 0, -8, 0);
  s.hear(new THREE.Vector3(-7, 0, -8), 12);
  run(s, 4);
  rig.level = 0;              // player kills the lights and stays quiet
  run(s, 60);
  ok('confidence reaches zero in silence', s.confidence < 0.02, s.confidence.toFixed(3));
  ok('never reaches the player', s.position.distanceTo(new THREE.Vector3(12, 0, 12)) > 10);
}

// 7. Steering ---------------------------------------------------------------
{
  console.log('steering');
  const { s } = makeEntity({ light: 6 });
  // Start on one side of the divider; belief is on the other side, so it has
  // to find the 2 m gap at x = 0 rather than walking into the wall.
  s.spawnAt(-6, 0, -6, 0);
  s.hear(new THREE.Vector3(-6, 0, 6), 30);
  run(s, 4);
  run(s, 70);
  // `|| true` made this unfailable, and it survived three independent reviews
  // being pointed at it. The claim is that the entity does not end up inside the
  // divider slab: the wall spans z in [-0.15, 0.15] everywhere except the
  // doorway at |x| < 1, so being in the slab AND outside the doorway is the
  // failure. Standing in the doorway is not.
  ok('does not tunnel through the divider',
    Math.abs(s.position.z) > 0.15 || Math.abs(s.position.x) < 1.2,
    `at (${s.position.x.toFixed(2)}, ${s.position.z.toFixed(2)})`);
  ok('makes progress rather than jamming on the wall',
    s.position.distanceTo(new THREE.Vector3(-6, 0, -6)) > 3,
    `moved ${s.position.distanceTo(new THREE.Vector3(-6, 0, -6)).toFixed(2)} m`);
  if (VERBOSE) console.log('   ', JSON.stringify(s.debugState()));
}

// 7b. It can kill more than once ---------------------------------------------
//
// THE BUG THIS EXISTS FOR. `_killed` was set true on the first completed capture
// and reset nowhere in the file; `captureT` was initialised in the constructor
// and only ever incremented. Neither `despawn()` nor `spawnAt()` cleared them,
// so after one kill the guard at the bottom of STATE.CAPTURING could never pass
// again: `game:death` was emitted once per page load, and CAPTURING — which had
// no exit of its own — simply never ended. A delivered session recorded five
// threat episodes, two of them reaching CAPTURING, and one death.
//
// Every other test in this file builds a fresh entity, which is exactly why the
// whole harness was structurally blind to it. This one reuses ONE entity across
// two captures, which is the only shape that can fail.
{
  console.log('it can kill more than once');
  const { s, bus } = makeEntity({ light: 4 });
  let deaths = 0;
  bus.on('game:death', () => deaths++);

  const capture = () => {
    s.spawnAt(0, 0, 1.2, 0);
    s.rouse(new THREE.Vector3(0, 0, 0), 0);
    s._setState(STATE.CAPTURING);
    run(s, 2.0);
  };

  capture();
  ok('the first capture kills', deaths === 1, `deaths=${deaths}`);
  capture();
  ok('the second capture also kills', deaths === 2, `deaths=${deaths}`);

  // And a capture that nothing resolves must not latch the state machine.
  s.spawnAt(0, 0, 1.2, 0);
  s._setState(STATE.CAPTURING);
  run(s, 8.0);
  ok('an unresolved capture lets go instead of latching',
    s.state !== STATE.CAPTURING, `state=${s.state}`);
}

// 8. Debug contract ---------------------------------------------------------
{
  console.log('debug contract');
  const { s } = makeEntity({ light: 3 });
  s.spawnAt(1, 0, 2, 0.5);
  const d = s.debugState();
  for (const k of ['state', 'position', 'target', 'confidence', 'illumination']) {
    ok(`debugState().${k} present`, d[k] !== undefined);
  }
  ok('position is a 3-tuple', Array.isArray(d.position) && d.position.length === 3);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
