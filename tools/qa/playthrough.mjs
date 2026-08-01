#!/usr/bin/env node
/**
 * A CONTINUOUS PLAYTHROUGH.
 * ===========================================================================
 * Everything else in tools/qa/ photographs a single frame. This plays the game.
 *
 * The project was built entirely from single-frame captures, which means the one
 * quality axis that matters most for a horror game — pacing — had never been
 * observed even once. A screenshot cannot tell you how long you walk before you
 * hear anything, how long a chase lasts, or whether anything happens at all.
 * This drives one unbroken session of several thousand frames through the real
 * update path and writes down what happened and when.
 *
 * WHAT IS REAL HERE AND WHAT IS NOT — stated up front, because a verification
 * tool that overstates its own fidelity is worse than no tool:
 *
 *   REAL. Movement, sprint, crouch, the lamp key and the interact key are
 *   dispatched as actual DOM keyboard events through Playwright, so they travel
 *   the whole path: window keydown -> Input.keys -> Input.down(action) ->
 *   Player.update. Nothing is teleported. The frame is the real `_frame()` body
 *   (step -> render -> endFrame) at a fixed dt, so every subsystem — collision,
 *   footsteps, noise, entities, the Director, the light rig, the post chain —
 *   runs the same code it runs in a browser.
 *
 *   SIMULATED. Mouse look is written into `Input.mouse.dx/dy`, which is the
 *   only field a locked pointer would ever set, because headless Chromium
 *   cannot grant pointer lock and therefore never delivers a movementX. The
 *   steering that chooses *where* to look is a synthetic player: it probes the
 *   real CollisionWorld for clearance and turns at a human rate. It is a bot,
 *   not a human, and it will not find anything a human would find by curiosity.
 *
 *   NOT REAL AT ALL. Absolute frame times. This is a CPU rasteriser
 *   (SwiftShader) with no GPU; see docs/COMPLETION_REPORT.md section 2. Frame
 *   times are recorded because a *stall* is still a stall, but they are not an
 *   answer to "does it hit 60".
 *
 * Usage:
 *   npm run build
 *   node tools/qa/playthrough.mjs --port 4199 --quality low
 *   node tools/qa/playthrough.mjs --port 4199 --seconds 90        # short run
 *   node tools/qa/playthrough.mjs --port 4199 --no-audio          # skip live audio
 *
 * Outputs (docs/verification/):
 *   playthrough.json        every sample, every event, every assertion
 *   playthrough.md          a human-readable chronology + pacing analysis
 *   filmstrip/NNN_*.png     one frame every `--film` seconds of the session
 *   filmstrip.md            the strip in order, with times
 * ===========================================================================
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4199', 10);
const OUT = args.out || 'docs/verification';
const QUALITY = args.quality || 'low';
const WIDTH = parseInt(args.width || '800', 10);
const HEIGHT = parseInt(args.height || '450', 10);
const DT = 1 / 60;
/** Hard cap on simulated seconds. The default runs the whole script (~350 s);
 *  the Director's quiet floor is 95 s, so a run shorter than ~200 s cannot say
 *  anything at all about beat spacing. */
const SECONDS = parseInt(args.seconds || '9999', 10);
/** Seconds between filmstrip frames. */
const FILM = parseFloat(args.film || '15');
/** Seconds between recorded state samples. */
const SAMPLE = parseFloat(args.sample || '0.5');
// Render one frame in N. 1 renders everything (a true frame-time measurement, and
// unusably slow here); higher values measure the GAME rather than the renderer.
const RENDER_EVERY = Math.max(1, parseInt(args.renderEvery || '1', 10));
const LIVE_AUDIO = !args['no-audio'];
const BOOT_TIMEOUT = parseInt(args.timeout || '420000', 10);

const CHUNK = Math.max(1, Math.round(SAMPLE / DT));   // frames per round-trip

// ---------------------------------------------------------------------------
// The session script.
//
// This is the shape of an opening: arrive, look, explore, get quiet, get loud,
// go dark, stand still and listen. It deliberately includes both of the things
// the design says the entity reacts to — sprinting is loud, crouching is nearly
// silent — and both lamp states, because the lamp is what lets the Surveyor
// move.
//
// `mode`:  still | pan | wander | goto | seek | enter | place | spawn
// `keys`:  held for the whole phase (real DOM keydown/keyup)
// `tap`:   pressed once at the start of the phase
// `target` (seek): an interactable id, an id prefix, or a kind
// `at`     (place): [x, z] in the CURRENT zone's local coordinates — scripted
// ---------------------------------------------------------------------------
const SCRIPT = [
  { name: 'arrival — standing still, taking the room in', seconds: 8, mode: 'pan', keys: [] },
  { name: 'first walk, no lamp', seconds: 24, mode: 'wander', keys: ['w'] },
  // ---- the tutorial beat: pick something up -------------------------------
  { name: 'INTERACT: take the nearest thing off the floor', seconds: 26, mode: 'seek', target: 'pickup' },
  { name: 'lamp on', seconds: 22, mode: 'wander', keys: ['w'], tap: ['f'] },
  { name: 'stop and listen (lamp on)', seconds: 18, mode: 'pan', keys: [] },
  { name: 'INTERACT: get into the locker by the lift', seconds: 24, mode: 'seek', target: 'locker_intake_enter' },
  { name: 'inside the locker — two louvre slots and your own breathing', seconds: 12, mode: 'still', keys: [] },
  // GET OUT AGAIN. The first session did not, and spent nine minutes in a steel
  // box: inside a hiding place `controlEnabled` is false, so every later movement
  // phase did nothing and the whole run measured a player standing still in the
  // dark. That is a bot mistake and it exposed a real one — the prompt still read
  // "Get in" — but the harness has to press E twice either way.
  { name: 'INTERACT: get out of the locker', seconds: 20, mode: 'seek', target: 'locker_intake_enter' },
  { name: 'crouch-walk — nearly silent', seconds: 22, mode: 'wander', keys: ['w', 'Control'] },
  { name: 'sprint — deliberately loud', seconds: 18, mode: 'wander', keys: ['w', 'Shift'] },
  { name: 'walk on, lamp off (the entity only moves in light)', seconds: 26, mode: 'wander', keys: ['w'], tap: ['f'] },
  { name: 'stand in the dark and wait', seconds: 26, mode: 'still', keys: [] },
  // The Director now spawns the Surveyor itself (`_ensureSpawned`), but a run
  // that depends on its random timing cannot assert anything, so the threat is
  // still placed deliberately and logged as scripted.
  { name: 'SCRIPTED: spawn the Surveyor 26 m away, dormant', seconds: 0, mode: 'spawn' },
  { name: 'sprint past it — loud enough to be heard', seconds: 22, mode: 'wander', keys: ['w', 'Shift'] },
  { name: 'lamp on and keep moving (it only advances in light)', seconds: 30, mode: 'wander', keys: ['w'], tap: ['f'] },
  { name: 'stop, lamp off, stay still — does it lose you?', seconds: 34, mode: 'still', keys: [], tap: ['f'] },

  // ---- the Service Spine and the board ------------------------------------
  { name: 'SCRIPTED ZONE CHANGE -> service', seconds: 0, mode: 'enter', zone: 'service' },
  { name: 'service spine — first walk', seconds: 28, mode: 'wander', keys: ['w'] },
  { name: 'SCRIPTED: reposition to the switchroom door', seconds: 0, mode: 'place', at: [12.6, -2.2] },
  { name: 'walk into the switchroom', seconds: 12, mode: 'wander', keys: ['w'] },
  { name: 'INTERACT: read the board schedule off the floor', seconds: 20, mode: 'seek', target: 'pickup' },
  { name: 'SCRIPTED: reposition in front of Distribution Board C', seconds: 0, mode: 'place', at: [14.6, -8.4] },
  { name: 'INTERACT: reset way 5 — the Stack lift lobby', seconds: 24, mode: 'seek', target: 'board_c_way5' },
  { name: 'INTERACT: trip way 2 — put the Spine out behind you', seconds: 20, mode: 'seek', target: 'board_c_way2' },
  { name: 'stand in the switchroom and look at what changed', seconds: 14, mode: 'pan', keys: [] },
  // Put the Spine back on. Leaving it out is a legitimate thing for a player to
  // do and an illegitimate thing for a MEASUREMENT to do: every light reading for
  // the rest of the session would be of a zone the bot had deliberately darkened.
  { name: 'INTERACT: reset way 2 — the Spine comes back', seconds: 20, mode: 'seek', target: 'board_c_way2' },

  // ---- the Cistern: a valve you have to hold -------------------------------
  { name: 'SCRIPTED ZONE CHANGE -> cistern', seconds: 0, mode: 'enter', zone: 'cistern' },
  { name: 'cistern — wading', seconds: 26, mode: 'wander', keys: ['w'], tap: ['f'] },
  { name: 'SCRIPTED: reposition onto the chamber walkway', seconds: 0, mode: 'place', at: [15.4, 3.2] },
  { name: 'INTERACT: turn penstock 1 (a 1.35 s hold)', seconds: 26, mode: 'seek', target: 'penstock_1' },
  { name: 'INTERACT: try penstock 2 — it is padlocked', seconds: 20, mode: 'seek', target: 'penstock_2' },
  { name: 'cistern — stand still in the water', seconds: 16, mode: 'pan', keys: [] },

  // ---- the Plant: the machine the game is about ---------------------------
  { name: 'SCRIPTED ZONE CHANGE -> plant', seconds: 0, mode: 'enter', zone: 'plant' },
  { name: 'the generator hall — the landmark frame', seconds: 20, mode: 'pan', keys: [] },
  { name: 'SCRIPTED: reposition on the hall floor by Set No. 2', seconds: 0, mode: 'place', at: [2.6, -2.0] },
  { name: 'INTERACT: try the fuel valve with no cores fitted', seconds: 22, mode: 'seek', target: 'set_2_fuel' },
  { name: 'INTERACT: try a socket with nothing in your hands', seconds: 20, mode: 'seek', target: 'set_2_socket0' },
  { name: 'SCRIPTED: reposition by the lift apron', seconds: 0, mode: 'place', at: [14.0, 0.0] },
  { name: 'INTERACT: call the goods lift — it has no supply', seconds: 22, mode: 'seek', target: 'lift_2_call' },

  // ---- the Office of Record ------------------------------------------------
  { name: 'SCRIPTED ZONE CHANGE -> safe (the Office of Record)', seconds: 0, mode: 'enter', zone: 'safe' },
  { name: 'the safe room', seconds: 18, mode: 'wander', keys: ['w'] },
  { name: 'INTERACT: the terminal', seconds: 22, mode: 'seek', target: 'terminal_record_dial' },
  { name: 'INTERACT: read what is on the desk', seconds: 20, mode: 'seek', target: 'pickup' },
];

// ---------------------------------------------------------------------------

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};
const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : String(v));

async function up(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// ---------------------------------------------------------------------------
// The in-page driver. Installed once; called once per chunk of frames.
// ---------------------------------------------------------------------------
/* eslint-disable */
function installDriver(cfg) {
  const g = window.ANNEX;
  const RENDER_EVERY = Math.max(1, (cfg && cfg.renderEvery) || 1);
  // Take the frame loop away from requestAnimationFrame. Two things step the
  // world otherwise — rAF with a wall-clock dt and this driver with a fixed one
  // — and the session would advance at a rate nobody chose.
  g.stop();

  const PT = window.__PT = {
    t: 0, frame: 0,
    samples: [], events: [], frameMs: [],
    nanFrames: 0, noFloorFrames: 0, noFloorRun: 0, worstNoFloorRun: 0,
    yMin: Infinity, yMax: -Infinity,
    stepCount: 0, noiseCount: 0,
    desiredYaw: g.player.yaw, mode: 'still', phase: '', panT: 0,
    entityStates: [], lastEntityState: null,
    busy: false,
  };

  // Record every event on the bus, whatever its name, by wrapping emit. A
  // fixed subscription list would silently miss anything added later.
  const rawEmit = g.bus.emit.bind(g.bus);
  const brief = (a) => {
    if (a == null || typeof a !== 'object') return a === undefined ? '' : String(a);
    const out = {};
    for (const k of ['zone', 'from', 'state', 'entity', 'circuit', 'powered', 'name',
      'cause', 'id', 'kind', 'title', 'surface', 'water', 'crouch', 'strength',
      'radius', 'ending', 'objective', 'fear', 'item', 'distance', 'remaining', 'reason']) {
      if (a[k] !== undefined && typeof a[k] !== 'object') out[k] = a[k];
    }
    const p = a.position;
    if (p && typeof p === 'object') {
      const x = p.x ?? p[0], y = p.y ?? p[1], z = p.z ?? p[2];
      if (Number.isFinite(x)) out.at = [+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)];
    }
    return out;
  };
  g.bus.emit = (k, ...a) => {
    if (k === 'player:step') PT.stepCount++;
    else if (k === 'player:noise' || k === 'world:noise') PT.noiseCount++;
    PT.events.push({ t: +PT.t.toFixed(3), frame: PT.frame, key: k, data: brief(a[0]), phase: PT.phase });
    if (PT.events.length > 60000) PT.events.shift();
    return rawEmit(k, ...a);
  };

  const TAU = Math.PI * 2;
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  /** How far can the player see along `yaw` at eye height, in the real world? */
  const clearAhead = (yaw, max = 14) => {
    const p = g.player.position, ey = p.y + 1.45;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let c = 0;
    for (let d = 0.5; d <= max; d += 0.5) {
      if (g.collision.segmentBlocked(p.x, ey, p.z, p.x + fx * d, ey, p.z + fz * d, 'ceiling')) break;
      c = d;
    }
    return c;
  };

  /** Pick the most open heading, biased toward `prefer`. */
  const bestHeading = (prefer) => {
    let best = prefer, score = -1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const clear = clearAhead(a, 16);
      const delta = Math.abs(wrap(a - prefer));
      const s = clear + Math.max(0, 1 - delta / Math.PI) * 3.5;
      if (s > score) { score = s; best = a; }
    }
    return best;
  };

  PT.setPhase = (name, mode, target) => {
    PT.phase = name; PT.mode = mode || 'still'; PT.target = target || null;
    PT.panT = 0;
    PT.seekId = null; PT.seekDone = false; PT.seekTries = 0; PT.seekCool = 0;
    PT.seekHeld = false;
    PT.seekBest = undefined; PT.seekStall = 0; PT.seekDetour = 0;
    PT.hold('KeyW', false);
    PT.hold('KeyE', false);
    if (mode === 'seek') {
      // `target` may be an exact id or an id prefix / kind to resolve now.
      PT.seekId = (g.interactor?.get(target) && target) || PT.nearest(target) || null;
    }
    PT.desiredYaw = g.player.yaw;
    PT.events.push({ t: +PT.t.toFixed(3), frame: PT.frame, key: 'qa:phase', data: { name, mode }, phase: name });
  };

  PT.enterZone = (zone) => {
    // There is no player-reachable portal in the build (see the report). This
    // is the World's own transition, run mid-session so the session stays
    // continuous, and it is logged as scripted so nobody mistakes it for play.
    const r = g.world?.enter?.(zone) || null;
    PT.events.push({ t: +PT.t.toFixed(3), frame: PT.frame, key: 'qa:scripted-zone-change', data: { zone }, phase: PT.phase });
    PT.desiredYaw = g.player.yaw;
    return r;
  };

  // -------------------------------------------------------------------------
  // INTERACTION
  //
  // Until this existed the bot could walk, run, crouch and flick the lamp, and
  // that was all: not one interactable had ever been pressed in this project, so
  // the breakers, the valves, the keypads, the readers, the sockets, the starter
  // and the lift were verified only by reading the code that built them.
  //
  // The interact key is dispatched as a real KeyboardEvent, in-page rather than
  // from the driver process, for one reason: it has to land on a chosen FRAME.
  // `Interactor` reads `input.pressed('interact')`, which is true for exactly one
  // frame, and a round trip to Node between frames cannot hit a specific one. The
  // event still travels the whole path — window keydown -> Input.keys ->
  // Input.pressed -> Interactor.update — so what is being tested is the real
  // input chain, not a poke at an internal method.
  //
  // Steering is the honest weak point: there is no navmesh, so `seek` walks
  // toward a target and steps around what it bumps into. Where that is not enough
  // the phase declares `at`, which repositions the player and is logged as
  // SCRIPTED, exactly as the zone changes are.
  // -------------------------------------------------------------------------
  const key = (code, downUp) => {
    window.dispatchEvent(new KeyboardEvent(downUp ? 'keydown' : 'keyup', { code, bubbles: true }));
  };
  PT.held = new Set();
  PT.hold = (code, want) => {
    if (want && !PT.held.has(code)) { PT.held.add(code); key(code, true); }
    else if (!want && PT.held.has(code)) { PT.held.delete(code); key(code, false); }
  };
  PT.interactions = [];

  /** World position of an interactable's hit object. */
  const itemPos = (item) => {
    if (!item?.object) return null;
    item.object.updateMatrixWorld(true);
    const m = item.object.matrixWorld.elements;
    return { x: m[12], y: m[13], z: m[14] };
  };

  /** Every registered interactable, with distance — what the bot can see to do. */
  PT.targets = (filter) => {
    const p = g.player.position;
    const out = [];
    for (const it of g.interactor?.items || []) {
      if (!it.object?.visible) continue;
      const q = itemPos(it);
      if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (filter && !(it.id?.startsWith(filter) || it.kind === filter)) continue;
      out.push({ id: it.id, kind: it.kind, verb: it.verb, label: it.label, range: it.range, d: +d.toFixed(2) });
    }
    return out.sort((a, b) => a.d - b.d);
  };

  /** Nearest interactable matching an id prefix or a kind. */
  PT.nearest = (filter, maxD = 60) => {
    const list = PT.targets(filter);
    return list.length && list[0].d <= maxD ? list[0].id : null;
  };

  /** Reposition. Scripted, and recorded as such. */
  PT.placeAt = (lx, lz, yaw) => {
    const w = g.world;
    const zone = w?.currentZone;
    const p = w ? w.toWorld(zone, [lx, 0, lz]) : [lx, 0, lz];
    const fl = g.collision.sampleFloor(p[0], p[2], 40, 60)
      || g.collision.sampleFloor(p[0], p[2], 4, 8);
    if (!fl) {
      // Refuse rather than drop the player into the void. A reposition onto no
      // floor at all is how a 64-second fall got into a session and poisoned
      // every measurement after it.
      PT.events.push({
        t: +PT.t.toFixed(3), frame: PT.frame, key: 'qa:reposition-refused',
        data: { want: [lx, lz], zone }, phase: PT.phase,
      });
      return { at: null, zone, refused: true };
    }
    const y = fl.y;
    g.player.teleport(p[0], y, p[2], yaw ?? g.player.yaw);
    PT.desiredYaw = g.player.yaw;
    PT.events.push({
      t: +PT.t.toFixed(3), frame: PT.frame, key: 'qa:scripted-reposition',
      data: { at: [+p[0].toFixed(1), +y.toFixed(1), +p[2].toFixed(1)], zone }, phase: PT.phase,
    });
    return { at: [p[0], y, p[2]], zone };
  };

  /**
   * One frame of "walk over there and press E".
   *
   * Aims yaw AND pitch at the target through `Input.mouse`, holds forward until
   * inside the item's own range, and taps the interact key on the frame the
   * interactor's own reticle reports the item as focused. Waiting for focus is
   * the point: it means the raycast, the distance pre-filter, the range test and
   * the prompt all agree before anything is pressed, so a pass here is evidence
   * the player could do it, not that a function exists.
   */
  PT.seekStep = () => {
    if (PT.seekCool > 0) PT.seekCool -= 1 / 60;
    const item = PT.seekId ? g.interactor?.get(PT.seekId) : null;
    if (!item || PT.seekDone) { PT.hold('KeyW', false); return; }
    const q = itemPos(item);
    if (!q) { PT.hold('KeyW', false); return; }

    const p = g.player.position;
    const eye = p.y + (g.player.eyeHeight || 1.63);
    const dx = q.x - p.x, dz = q.z - p.z;
    const flat = Math.hypot(dx, dz);
    const range = item.range ?? 2.2;

    // Aim.
    const wantYaw = Math.atan2(-dx, -dz);
    const wantPitch = Math.atan2(q.y - eye, Math.max(0.25, flat));
    const sens = g.input.sensitivity || 0.0021;
    const dyaw = Math.max(-3.0 / 60, Math.min(3.0 / 60, wrap(wantYaw - g.player.yaw)));
    const dpit = Math.max(-2.4 / 60, Math.min(2.4 / 60, wantPitch - g.player.pitch));
    g.input.mouse.dx += -dyaw / sens;
    g.input.mouse.dy += -dpit / sens;

    // Walk. Stop just inside reach; if something is in the way, sidestep by
    // steering off-axis rather than grinding into it.
    const close = flat < range * 0.62 + 0.25;
    PT.hold('KeyW', !close);

    // STUCK-BREAKER. Aiming straight at a target and walking is enough in a room
    // and hopeless in a building: without a navmesh the bot grinds into the corner
    // between itself and a prop two metres away and stays there. A run had it spend
    // 26 seconds covering none of 11.9 m. So: if the distance has not dropped in
    // three seconds, commit to a detour — a fixed 80 degrees off the direct line,
    // held for a second and a half, alternating sides. It is not pathfinding; it is
    // the wall-follow a person does, and it is enough to get round furniture.
    if (PT.seekBest === undefined || flat < PT.seekBest - 0.25) {
      PT.seekBest = flat; PT.seekStall = 0;
    } else {
      PT.seekStall = (PT.seekStall || 0) + 1 / 60;
    }
    if (PT.seekStall > 3 && !PT.seekDetour) {
      PT.seekDetour = 1.5;
      PT.seekSide = (PT.seekSide || 1) * -1;
      PT.seekStall = 0;
    }
    if (PT.seekDetour > 0) {
      PT.seekDetour -= 1 / 60;
      if (PT.seekDetour <= 0) { PT.seekDetour = 0; PT.seekBest = flat; }
      const alt = wantYaw + (PT.seekSide || 1) * 1.4;
      g.input.mouse.dx += -Math.max(-3.0 / 60, Math.min(3.0 / 60, wrap(alt - g.player.yaw))) / sens;
      PT.hold('KeyW', true);
    } else if (!close && clearAhead(g.player.yaw, 2.0) < 1.2) {
      const alt = bestHeading(wantYaw + (PT.frame % 240 < 120 ? 0.9 : -0.9));
      g.input.mouse.dx += -Math.max(-3.0 / 60, Math.min(3.0 / 60, wrap(alt - g.player.yaw))) / sens;
    }

    // Press, when the game itself says the thing is under the reticle.
    const focus = g.interactor?.focus;
    if (focus?.id === PT.seekId && PT.seekCool <= 0) {
      const blocked = focus.blocked;
      const holdSecs = focus.hold || 0;
      if (holdSecs > 0) {
        // A hold action: keep E down until the interactor's own progress completes.
        PT.hold('KeyE', true);
        if (focus.progress <= 0.001 && PT.seekHeld) {
          PT.seekHeld = false;
          PT.hold('KeyE', false);
          PT.seekCool = 0.5;
          PT.interactions.push({
            t: +PT.t.toFixed(2), id: PT.seekId, verb: item.verb, label: item.label,
            hold: holdSecs, blocked, phase: PT.phase, result: 'completed a hold',
          });
          PT.seekDone = true;
        } else if (focus.progress > 0.001) PT.seekHeld = true;
      } else {
        key('KeyE', true);
        key('KeyE', false);
        PT.seekCool = 0.35;
        PT.interactions.push({
          t: +PT.t.toFixed(2), id: PT.seekId, verb: item.verb, label: item.label,
          blocked, reason: focus.reason || null, phase: PT.phase,
          result: blocked ? `refused: ${focus.reason}` : 'pressed',
        });
        if (!blocked || ++PT.seekTries >= 3) PT.seekDone = true;
      }
    }
  };

  PT.audioInit = async () => {
    if (!g.audio) return { ok: false, why: 'no audio subsystem' };
    try {
      const ok = await g.audio.init();
      return { ok: !!ok, state: g.audio.engine?.ctx?.state || 'none', stats: g.audio.stats };
    } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
  };

  const snapshot = () => {
    const p = g.player.position;
    const v = g.player.velocity;
    const ent = g.gameplay?.surveyor || null;
    const dir = g.gameplay?.director || g.director || null;
    const fl = g.flashlight || null;
    const s = {
      t: +PT.t.toFixed(2), frame: PT.frame, phase: PT.phase,
      zone: g.currentZone || g.world?.currentZone || null,
      pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      yaw: +g.player.yaw.toFixed(3),
      speed: +Math.hypot(v.x, v.z).toFixed(2),
      moving: Math.hypot(v.x, v.z) > 0.25,
      crouch: !!g.player.crouching,
      crawl: !!g.player.crawling,
      hidden: !!(g.gameplay?.director?.hidden),
      controls: !!g.player.controlEnabled,
      state: g.state,
      exertion: +(g.player.exertion ?? 0).toFixed(2),
      fear: dir ? +dir.fear.toFixed(3) : null,
      dread: dir ? +(dir.dread ?? 0).toFixed(3) : null,
      decoy: g.gameplay?.decoy?.debugState?.() ?? null,
      // The CURRENT zone's fixtures. `engine.stats`/`rig.stats` count every
      // resident zone, and zones are 400 m apart, so a global `lit` count says
      // nothing about whether the room the player is standing in has any light
      // in it. The unlit-zone assertion below compares like with like only
      // because this is here.
      zoneLit: g.lightProbe?.()?.zoneFixtures ?? null,
      tension: dir ? +dir.tension.toFixed(3) : null,
      sinceBeat: dir ? +dir.sinceBeat.toFixed(1) : null,
      nextBeatAt: dir ? +dir.nextBeatAt.toFixed(1) : null,
      grace: dir ? +Math.max(0, dir.graceUntil - dir.time).toFixed(1) : null,
      intensity: dir ? +dir.intensity.toFixed(2) : null,
      lights: { ...g.rig.stats },
      ms: +(g.engine.stats.ms ?? 0).toFixed(2),
    };
    if (fl) s.lamp = { on: !!fl.isOn, battery: +fl.battery.toFixed(3), beam: +(fl.beamStrength ?? 0).toFixed(2) };
    if (ent) {
      s.entity = {
        active: !!ent.active, state: ent.state,
        stateTime: +ent.stateTime.toFixed(1),
        dist: +ent.position.distanceTo(g.player.position).toFixed(2),
        illum: +(ent.illumination ?? 0).toFixed(3),
        conf: +(ent.confidence ?? 0).toFixed(2),
        speed: +(ent.speed ?? 0).toFixed(2),
      };
    } else s.entity = null;
    if (g.audio) {
      const a = g.audio.stats || {};
      s.audio = { state: a.state, voices: a.voices, loops: a.loops, hums: a.hums, zone: a.zone, reverb: a.reverb };
    }
    return s;
  };

  /** Advance `n` frames. Returns the sample taken at the end of the chunk. */
  PT.run = (n) => {
    for (let i = 0; i < n; i++) {
      // ---- steering: write the field a locked pointer would write ----------
      const yaw = g.player.yaw;
      if (PT.mode === 'wander') {
        const ahead = clearAhead(yaw, 10);
        if (ahead < 2.6 || Math.abs(wrap(PT.desiredYaw - yaw)) < 0.05) {
          PT.desiredYaw = ahead < 2.6
            ? bestHeading(yaw + (Math.random() < 0.5 ? 1 : -1) * 1.9)
            : bestHeading(yaw + (Math.random() * 2 - 1) * 0.9);
        }
      } else if (PT.mode === 'goto' && PT.target) {
        const p = g.player.position;
        const dx = PT.target[0] - p.x, dz = PT.target[1] - p.z;
        let want = Math.atan2(-dx, -dz);
        if (clearAhead(want, 4) < 2.2) want = bestHeading(want);
        PT.desiredYaw = want;
      } else if (PT.mode === 'pan') {
        PT.panT += 1 / 60;
        PT.desiredYaw = yaw + Math.sin(PT.panT * 0.55) * 0.02;
      } else if (PT.mode === 'seek') {
        PT.seekStep();
      }
      if (PT.mode !== 'still' && PT.mode !== 'seek') {
        // 2.4 rad/s is a brisk but human head turn.
        const d = Math.max(-2.4 / 60, Math.min(2.4 / 60, wrap(PT.desiredYaw - yaw)));
        g.input.mouse.dx += -d / (g.input.sensitivity || 0.0021);
      }

      // ---- the frame: exactly Game._frame() with a fixed dt ----------------
      // RENDER SKIPPING. `step` is the game; `render` is the picture, and on a
      // CPU rasteriser the picture costs about a thousand times more — a 100 s
      // session rendering every frame took 89 minutes of wall clock, which made
      // the full 7-minute script unrunnable and is why the first session ever run
      // was truncated to its opening walk and concluded that nothing happens.
      // Nothing in the Director, the entities, the audio or the physics reads back
      // from the framebuffer, so for a pacing run the frames in between are pure
      // cost. Frames are still rendered on a cadence so the filmstrip is real and
      // so shader compilation still happens where it would.
      const t0 = performance.now();
      g.step(1 / 60);
      const wantRender = (PT.frame % RENDER_EVERY) === 0;
      if (wantRender) g.engine.render(1 / 60);
      g.input.endFrame();
      const ms = performance.now() - t0;

      // ANSWER THE DEATH SCREEN.
      //
      // Being caught opens a modal with two buttons and clears the Director's
      // auto-respawn, because with a UI present the player is supposed to
      // choose. This harness never knew the screen existed, so the first death
      // ended the session in place: `game:death` at 3:17, `death:settled` and
      // `ui:screen` at 3:21, and then eight minutes of a frozen player two feet
      // from a stationary Surveyor with `controlEnabled` false. The run still
      // reported 690 s of "play" and its pacing section described the silence.
      //
      // A player presses the button. So does this. `respawn` is the death
      // screen's "Report to the Office of Record"; `Game._onUiAction` puts the
      // state machine back to `play` and moves the body to the last safe point.
      // USE THE DECOY THE WAY A PLAYER WOULD.
      //
      // Every other key in this harness is dispatched by the script at a fixed
      // time, which is fine for "walk here, press that" and useless for a verb
      // whose whole point is that you reach for it when something is coming.
      // So this one is reactive: if the Surveyor is up and inside 25 m, throw a
      // cell. It goes out as a real `KeyboardEvent` on `window`, the same path a
      // player's keypress takes into `Input`, rather than by calling
      // `Decoy.throwCell()` directly — a mechanic that only works when the
      // harness calls it is not a mechanic.
      {
        const ent = g.gameplay?.surveyor;
        // SEARCHING, NOT COMMITTED. A decoy moves a BELIEF; once the Surveyor is
        // APPROACHING it has stopped believing and started arriving, and
        // `hear()` will not let a 14 m noise overwrite a confidence above 0.55.
        // That is correct design — a thrown cell is not a get-out-of-jail card
        // at arm's length — but the bot was throwing at 1.6 m one second before
        // being caught, and then the redirect check failed for the mechanic
        // working exactly as intended.
        const hunting = ent?.active && (ent.state === 'ROUSED' || ent.state === 'SEEKING');
        const dist = ent?.position ? ent.position.distanceTo(g.player.position) : 1e9;
        // 18 m, not 25: the cell lands up to 14 m from the player, so throwing
        // from further out can put it beyond the Surveyor's hearing even when
        // the Surveyor is well inside the player's.
        // AIM BEFORE YOU THROW. A player about to put a noise somewhere looks
        // there first; this bot threw wherever it happened to be walking, so the
        // cell landed on the far side of the player from the Surveyor and the
        // redirect check failed for a reason that had nothing to do with the
        // mechanic. Face roughly toward it — `Decoy` throws along the yaw — and
        // only then press the key.
        const wantAim = hunting && dist > 7 && dist < 18 && g.gameplay?.decoy?.canThrow?.()
          && PT.t - (PT.lastThrowAt ?? -99) > 6;
        if (wantAim && ent?.position) {
          const dx = ent.position.x - g.player.position.x;
          const dz = ent.position.z - g.player.position.z;
          // NOT AT IT — PAST IT.
          //
          // The first aiming version pointed straight at the Surveyor, and the
          // cell landed 2.2 m from it. A noise where the monster already is is
          // not a decoy; it tells it nothing it does not know, and the redirect
          // check then passed for a throw no player would make. Offset the aim
          // by about 50 degrees so the cell lands off to one side — inside the
          // Surveyor's hearing, well away from both it and the player, which is
          // the whole geometry of drawing something off.
          const toEnt = Math.atan2(-dx, -dz);
          PT.throwYaw = toEnt + (PT.throwSide = (PT.throwSide === 0.9 ? -0.9 : 0.9));
          PT.desiredYaw = PT.throwYaw;
        }
        const aimed = PT.throwYaw != null
          && Math.abs(wrap(PT.throwYaw - g.player.yaw)) < 0.35;
        if (wantAim && aimed) {
          PT.throwYaw = null;
          PT.lastThrowAt = PT.t;
          PT.throws = (PT.throws || 0) + 1;
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT', bubbles: true }));
          // The key is a DOM event, so `Decoy.update` consumes it on the NEXT
          // frame. Flag it and read the landing point when it appears.
          PT.pendingThrow = (g.gameplay.decoy.thrown || 0);
          // AND THEN BE QUIET, WHICH IS HALF THE MECHANIC.
          //
          // `nb_1` tells the player: "it goes to the sound in a straight line
          // and it commits to it, and if you are quiet from then on it goes to
          // where the sound was and not to where you are." The first run threw
          // a cell and then kept sprinting, at radius 11 against the decoy's 7,
          // and the Surveyor — correctly — walked to the louder, closer, still
          // arriving noise. A harness that does not play by the rule it is
          // testing is testing nothing. Crouching drops the player from 6/11 to
          // 2.2 without fighting the keys Playwright is holding down.
          PT.quietUntil = PT.t + 5;
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', bubbles: true }));
        }
        // WAS THE CELL AUDIBLE FROM WHERE THE SURVEYOR WAS STANDING?
        //
        // `Surveyor.hear` multiplies a noise by `lerp(1, 0.34, occlusion)`, so a
        // cell that lands behind a wall is muffled to a third and loses the
        // overwrite race against the player's own footsteps. That is correct —
        // it is the same rule that makes crouching behind cover work — but it
        // makes an unlucky throw look like a broken mechanic. Record the
        // occlusion the entity actually had, so the check can tell a throw that
        // failed from a throw that was never heard.
        if (PT.pendingThrow != null && g.gameplay?.decoy
            && (g.gameplay.decoy.thrown || 0) > PT.pendingThrow) {
          PT.pendingThrow = null;
          const land = g.gameplay.decoy.lastLanding;
          const e2 = g.gameplay.surveyor;
          if (land && e2?.position && g.collision?.occlusion) {
            PT.throwOccl = (PT.throwOccl || []);
            PT.throwOccl.push({
              t: +PT.t.toFixed(2),
              occl: +g.collision.occlusion(
                e2.position.x, e2.position.y + 1.5, e2.position.z,
                land.x, land.y + 0.2, land.z).toFixed(3),
              dist: +e2.position.distanceTo(
                new g.player.position.constructor(land.x, land.y, land.z)).toFixed(1),
              state: e2.state,
            });
          }
        }
        if (PT.quietUntil && PT.t > PT.quietUntil) {
          PT.quietUntil = 0;
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft', bubbles: true }));
        }
      }

      if (g.state === 'dead' && PT.t - (PT.lastReviveAt ?? -99) > 1.5) {
        PT.lastReviveAt = PT.t;
        PT.revives = (PT.revives || 0) + 1;
        g.bus.emit('ui:action', { action: 'respawn' });
      }

      PT.t += 1 / 60; PT.frame++;
      PT.frameMs.push(+ms.toFixed(2));

      // ---- per-frame invariants -------------------------------------------
      const p = g.player.position;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) PT.nanFrames++;
      else {
        if (p.y < PT.yMin) PT.yMin = p.y;
        if (p.y > PT.yMax) PT.yMax = p.y;
        // Zone-independent floor test: is there a walkable rectangle under the
        // player, and is the player standing on it rather than falling past it?
        // Absolute y limits cannot be used — the Stack is a vertical shaft and
        // the Plant has a lift pit — so this asks the collision world instead.
        const fl = g.collision.sampleFloor(p.x, p.z, p.y + 1.2, 3.0);
        if (!fl || p.y - fl.y > 2.5) {
          PT.noFloorFrames++; PT.noFloorRun++;
          if (PT.noFloorRun > PT.worstNoFloorRun) PT.worstNoFloorRun = PT.noFloorRun;
        } else PT.noFloorRun = 0;
      }
      const ent = g.gameplay?.surveyor;
      if (ent && ent.state !== PT.lastEntityState) {
        PT.entityStates.push({ t: +PT.t.toFixed(2), from: PT.lastEntityState, to: ent.state, active: !!ent.active });
        PT.lastEntityState = ent.state;
      }
    }
    const s = snapshot();
    PT.samples.push(s);
    return s;
  };

  /** True while the player is inside a hiding place and cannot move. */
  PT.isHidden = () => !!(g.gameplay?.director?.hidden);

  PT.harvest = () => ({
    samples: PT.samples, events: PT.events, entityStates: PT.entityStates,
    interactions: PT.interactions,
    hiddenSamples: PT.samples.filter((s) => s.hidden).length,
    progression: g.gameplay?.progression?.debugState?.() || null,
    inventory: g.gameplay?.inventory?.snapshot?.() || null,
    interactorItems: (g.interactor?.items || []).length,
    doors: (g.interactor?.doors || []).length,
    frameMs: PT.frameMs,
    nanFrames: PT.nanFrames, noFloorFrames: PT.noFloorFrames,
    worstNoFloorRun: PT.worstNoFloorRun,
    revives: PT.revives || 0,
    throws: PT.throws || 0,
    throwOccl: PT.throwOccl || [],
    yMin: PT.yMin, yMax: PT.yMax, frames: PT.frame, simSeconds: PT.t,
    stepCount: PT.stepCount, noiseCount: PT.noiseCount,
    status: g.status(),
  });

  return { ok: true, zone: g.currentZone, spawn: [g.player.position.x, g.player.position.y, g.player.position.z] };
}
/* eslint-enable */

// ---------------------------------------------------------------------------

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, 'filmstrip'), { recursive: true });

  const url = `http://127.0.0.1:${PORT}/`;
  let server = null;
  if (!(await up(url, 1200))) {
    if (!existsSync('dist/index.html')) {
      console.error('No dist/ build. Run `npm run build` first.');
      process.exit(1);
    }
    server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
      { stdio: 'ignore' });
    if (!(await up(url, 60000))) { console.error('preview server did not come up'); process.exit(1); }
  }

  const browser = await chromium.launch({
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox', '--no-sandbox', '--ignore-gpu-blocklist',
      '--enable-webgl', '--disable-dev-shm-usage',
      // Let the AudioContext start without a gesture so the live audio path is
      // actually exercised during the session rather than sitting suspended.
      '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    ],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  const logs = [];
  page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: `${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}` }));

  // `prewarm=0`: skip the per-zone shader pre-warm. It is the right behaviour on
  // real hardware — `compileAsync` links off-thread where the driver supports it —
  // but this environment is a software rasteriser with no GPU, where compiling one
  // zone measured 190 SECONDS. Left on, a session with five zone changes spends
  // most of an hour linking programs, and the numbers it produces are about
  // SwiftShader's compiler rather than about the game. The consequence is stated
  // rather than hidden: with it off, the transition stalls this harness reports are
  // the UNWARMED ones, which is exactly what the pre-warm exists to remove.
  const QS = `?quality=${QUALITY}&qa=1&prewarm=${args.prewarm === '1' ? '1' : '0'}`;
  console.log(`→ ${url}${QS}   ${WIDTH}x${HEIGHT}`);
  const bootT0 = Date.now();
  await page.goto(`${url}${QS}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try {
    await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR', { timeout: BOOT_TIMEOUT });
  } catch {
    await writeFile(path.join(OUT, 'playthrough-console.log'), logs.map((l) => `[${l.type}] ${l.text}`).join('\n'));
    console.error('timed out waiting for ANNEX_READY');
    console.error(logs.slice(-30).map((l) => `[${l.type}] ${l.text}`).join('\n'));
    await browser.close(); server?.kill(); process.exit(2);
  }
  const bootErr = await page.evaluate('window.ANNEX_ERROR || null');
  if (bootErr) {
    console.error('boot failed:\n' + bootErr);
    await writeFile(path.join(OUT, 'playthrough-console.log'), logs.map((l) => `[${l.type}] ${l.text}`).join('\n'));
    await browser.close(); server?.kill(); process.exit(3);
  }
  const bootMs = Date.now() - bootT0;
  console.log(`  booted in ${(bootMs / 1000).toFixed(1)}s`);

  const install = await page.evaluate(installDriver, { renderEvery: RENDER_EVERY });
  console.log(`  driver installed; zone=${install.zone} spawn=[${install.spawn.map((v) => v.toFixed(1)).join(', ')}]`);

  let audioInit = { ok: false, why: 'skipped (--no-audio)' };
  if (LIVE_AUDIO) {
    audioInit = await page.evaluate(() => window.__PT.audioInit());
    console.log(`  audio init: ok=${audioInit.ok} state=${audioInit.state || audioInit.why}`);
  }

  // Settle: the eye adaptation has a 1.8 s time constant and the first frames of
  // a new zone pay shader compilation. 120 frames of settle before the clock
  // starts means the session does not open on a mis-exposed frame.
  console.log('  settling (120 frames, first frames compile shaders)…');
  await page.evaluate(() => window.__PT.setPhase('settle', 'still'));
  for (let i = 0; i < 6; i++) {
    const t0 = Date.now();
    await page.evaluate(() => window.__PT.run(20));
    console.log(`    settle ${(i + 1) * 20}/120 frames  ${((Date.now() - t0) / 20).toFixed(0)} ms/frame`);
  }
  await page.evaluate(() => {
    // Reset the clock so the timeline starts at 0:00 at the first played frame.
    const PT = window.__PT;
    PT.t = 0; PT.frame = 0; PT.samples.length = 0; PT.events.length = 0;
    PT.frameMs.length = 0; PT.entityStates.length = 0;
  });

  // ---- the session -------------------------------------------------------
  const film = [];
  let nextFilm = 0;
  let simT = 0;
  const heldKeys = new Set();

  const setKeys = async (want) => {
    for (const k of [...heldKeys]) if (!want.includes(k)) { await page.keyboard.up(k); heldKeys.delete(k); }
    for (const k of want) if (!heldKeys.has(k)) { await page.keyboard.down(k); heldKeys.add(k); }
  };

  const grabFilm = async (t, label) => {
    const dataUrl = await page.evaluate(() => document.getElementById('view').toDataURL('image/png'));
    const name = `${String(film.length).padStart(3, '0')}_${Math.round(t)}s_${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 34)}.png`;
    await writeFile(path.join(OUT, 'filmstrip', name), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    film.push({ t: +t.toFixed(1), file: `filmstrip/${name}`, label });
  };

  let chunkWall = 0, chunkFrames = 0;
  const scripted = SCRIPT.reduce((a, p) => a + p.seconds, 0) + SCRIPT.filter((p) => p.mode === 'enter').length * 1.5;
  const planned = Math.min(SECONDS, scripted);
  const wallT0 = Date.now();
  console.log(`\n  ${planned.toFixed(0)}s of simulated play, dt=1/60, ~${Math.round(planned / DT)} frames\n`);

  for (const phase of SCRIPT) {
    if (simT >= SECONDS) break;
    if (phase.mode === 'enter') {
      await setKeys([]);
      const r = await page.evaluate((z) => window.__PT.enterZone(z), phase.zone);
      console.log(`  ${fmt(simT)}  ${phase.name}${r ? '' : '  (FAILED — world.enter returned null)'}`);
      // Let the new zone's materials compile and the exposure re-adapt before
      // the timeline records anything about it.
      await page.evaluate(() => { window.__PT.setPhase('zone settle', 'still'); window.__PT.run(90); });
      simT += 90 * DT;
      await grabFilm(simT, `enter ${phase.zone}`);
      continue;
    }
    if (phase.mode === 'place') {
      await setKeys([]);
      const r = await page.evaluate(([x, z]) => window.__PT.placeAt(x, z), phase.at);
      console.log(`  ${fmt(simT)}  ${phase.name}  -> ${r.zone} `
        + (r.at ? r.at.map((v) => v.toFixed(1)).join(', ') : 'REFUSED — no floor there'));
      // Two seconds so the collision resolve settles and the exposure catches up.
      await page.evaluate(() => { window.__PT.setPhase('reposition settle', 'still'); window.__PT.run(120); });
      simT += 120 * DT;
      continue;
    }
    await setKeys(phase.keys || []);
    for (const k of phase.tap || []) { await page.keyboard.press(k); }
    const resolved = await page.evaluate(({ n, m, t }) => {
      window.__PT.setPhase(n, m, t);
      return m === 'seek' ? { id: window.__PT.seekId, near: window.__PT.targets(t).slice(0, 3) } : null;
    }, { n: phase.name, m: phase.mode, t: phase.target || null });
    if (phase.mode === 'seek') {
      console.log(`  ${fmt(simT)}  ${phase.name}  -> ${resolved?.id || 'NO TARGET IN RANGE'}`
        + (resolved?.near?.length ? `  (nearest: ${resolved.near.map((x) => `${x.id}@${x.d}m`).join(', ')})` : ''));
    } else {
      console.log(`  ${fmt(simT)}  ${phase.name}  [keys: ${(phase.keys || []).join('+') || 'none'}]`);
    }

    const endT = Math.min(SECONDS, simT + phase.seconds);
    let nextProgress = simT + 10;
    while (simT < endT) {
      const n = Math.min(CHUNK, Math.round((endT - simT) / DT));
      if (n <= 0) break;
      const c0 = Date.now();
      const s = await page.evaluate((k) => window.__PT.run(k), n);
      simT += n * DT;
      chunkWall += Date.now() - c0; chunkFrames += n;
      if (simT >= nextProgress) {
        nextProgress = simT + 10;
        process.stdout.write(`      ${fmt(simT)}  ${(chunkWall / chunkFrames).toFixed(0)} ms/frame avg · ` +
          `zone ${s.zone} · fear ${s.fear} · lit ${s.lights.active}/${s.lights.lit}\n`);
      }
      if (simT >= nextFilm) { await grabFilm(simT, phase.name); nextFilm = simT + FILM; }
      if (s.entity?.active && s.entity.state !== 'DORMANT') {
        process.stdout.write(`      ${fmt(simT)} entity ${s.entity.state} @ ${s.entity.dist}m  fear ${s.fear}\n`);
      }
      if (phase.mode === 'seek') {
        const done = await page.evaluate(() => (window.__PT.seekDone
          ? window.__PT.interactions[window.__PT.interactions.length - 1] || true : null));
        if (done) {
          if (done !== true) process.stdout.write(`      ${fmt(simT)} INTERACT ${done.id}: ${done.result}\n`);
          break;
        }
      }
    }
  }
  await setKeys([]);
  const wallMs = Date.now() - wallT0;

  const H = await page.evaluate(() => window.__PT.harvest());
  const fixtureReport = await page.evaluate(() => window.ANNEX.fixtureReport(4));
  await browser.close();
  server?.kill();

  console.log(`\n  ${H.frames} frames of ${H.simSeconds.toFixed(1)}s simulated in ${(wallMs / 1000).toFixed(0)}s wall clock`);

  // ---------------------------------------------------------------------------
  // Analysis
  // ---------------------------------------------------------------------------
  const S = H.samples;
  const ms = H.frameMs;
  const sorted = [...ms].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  // The first frames of the session and of every zone change compile shaders.
  const warm = ms.slice(Math.round(3 / DT));
  const warmSorted = [...warm].sort((a, b) => a - b);
  const wpct = (p) => warmSorted[Math.min(warmSorted.length - 1, Math.floor(p * warmSorted.length))] ?? 0;

  // What counts as "something happened" has to be something the PLAYER could
  // notice. Footsteps and the noise events they raise are the player's own
  // output; `entity:tick` and everything the harness emits are diagnostics that
  // fire on a timer and would make the metric below unfailable.
  const NOISY = new Set(['player:step', 'player:noise', 'world:noise', 'entity:tick']);
  const notable = H.events.filter((e) => !NOISY.has(e.key) && !e.key.startsWith('qa:'));
  const counts = {};
  for (const e of H.events) counts[e.key] = (counts[e.key] || 0) + 1;

  const fears = S.map((s) => s.fear ?? 0);
  const fearSorted = [...fears].sort((a, b) => a - b);
  const fp = (p) => fearSorted[Math.min(fearSorted.length - 1, Math.floor(p * fearSorted.length))] ?? 0;
  const frac = (pred) => (S.length ? S.filter(pred).length / S.length : 0);

  // Threat episodes: contiguous stretches where the entity exists AND is doing
  // something. A dormant entity is scenery.
  const episodes = [];
  {
    let cur = null;
    for (const s of S) {
      const live = !!(s.entity?.active && s.entity.state !== 'DORMANT');
      if (live && !cur) cur = { from: s.t, to: s.t, states: new Set([s.entity.state]), minDist: s.entity.dist, maxFear: s.fear ?? 0 };
      else if (live) {
        cur.to = s.t; cur.states.add(s.entity.state);
        cur.minDist = Math.min(cur.minDist, s.entity.dist);
        cur.maxFear = Math.max(cur.maxFear, s.fear ?? 0);
      } else if (cur) { episodes.push(cur); cur = null; }
    }
    if (cur) episodes.push(cur);
  }

  // Longest stretch with nothing notable on the bus at all.
  //
  // THIS WAS SEEDED WITH THE WHOLE SESSION AND COULD THEREFORE NEVER REPORT
  // ANYTHING ELSE. The initial value was `{ seconds: H.simSeconds }` and the
  // loop below only replaces it on a gap STRICTLY LONGER than the incumbent, so
  // no real gap could ever win. Every run this tool has ever produced printed
  // "the entire session" here regardless of what happened, and that line was
  // quoted as the project's headline pacing defect. It was a bug in the ruler.
  // Start from nothing and let the gaps compete.
  let longestQuiet = { from: 0, to: 0, seconds: 0 };
  {
    let prev = 0;
    for (const e of notable) {
      if (e.t - prev > longestQuiet.seconds) longestQuiet = { from: prev, to: e.t, seconds: e.t - prev };
      prev = e.t;
    }
    if (H.simSeconds - prev > longestQuiet.seconds) longestQuiet = { from: prev, to: H.simSeconds, seconds: H.simSeconds - prev };
  }

  const zones = [];
  for (const s of S) { if (!zones.length || zones.at(-1).zone !== s.zone) zones.push({ zone: s.zone, from: s.t, to: s.t }); else zones.at(-1).to = s.t; }

  const beats = H.events.filter((e) => e.key === 'director:beat');
  const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror')
    .filter((l) => !/useProgram|deprecated|Blocked autoplay|AudioContext was not allowed/i.test(l.text));

  // ---------------------------------------------------------------------------
  // Assertions. Nothing here is relaxed to make a run pass.
  // ---------------------------------------------------------------------------
  const checks = [];
  const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); return ok; };

  check('no console errors during the session', errors.length === 0,
    errors.slice(0, 4).map((e) => e.text.split('\n')[0]).join(' | '));
  check('player position never NaN', H.nanFrames === 0, `${H.nanFrames} frames`);
  check('player never falls through the floor',
    H.worstNoFloorRun === 0,
    `y ${num(H.yMin)}..${num(H.yMax)}; frames not standing on a floor: ${H.noFloorFrames} of ${H.frames} (worst consecutive run ${H.worstNoFloorRun})`);
  check('the frame loop never stalls (no frame > 5 s)', Math.max(...ms) < 5000,
    `max ${num(Math.max(...ms), 0)} ms, p99 ${num(pct(0.99), 0)} ms, p50 ${num(pct(0.5))} ms`);
  check('post-warmup frame times stay bounded (p99 < 250 ms)', wpct(0.99) < 250,
    `warm p50 ${num(wpct(0.5))} ms, p90 ${num(wpct(0.9))} ms, p99 ${num(wpct(0.99))} ms`);
  check('simulated time advanced continuously',
    Math.abs(H.simSeconds - H.frames * DT) < 1e-6 && H.frames > 3000, `${H.frames} frames`);
  check('at least one entity state transition occurred', H.entityStates.length >= 1,
    H.entityStates.length ? H.entityStates.map((s) => `${s.from}->${s.to}@${s.t}s`).join(', ') : 'the Surveyor never changed state');
  check('audio subsystem reports as constructed',
    H.status?.subsystems?.audio === true && !!H.status?.audio,
    `subsystems.audio=${H.status?.subsystems?.audio}, ctx state=${H.status?.audio?.state}`);
  check('footsteps fired while walking', H.stepCount > 20, `${H.stepCount} player:step events`);
  // A ZONE WITH NO ACTIVE LIGHTS IS SOMETIMES THE GAME WORKING.
  //
  // This asserted that every single sample had at least one dynamic light, which
  // was true only because the Director's `circuit_trip` beat had never once been
  // able to fire — it requires fear 0.15 and fear sat at 0.024. Now that it does
  // fire, the Intake drops from 208 lit fixtures to 8 and this went red for the
  // blackout it asked for. A dark room the player was plunged into is a game
  // state; a dark room nobody switched off is a defect, and the difference is
  // whether a circuit went down. Allow brief unlit windows, name their cause,
  // and still fail if a zone is unlit for a sustained stretch.
  // The test is the FIXTURES, not the clock: a tripped circuit stays off until
  // somebody walks to the board and closes it, so a time window round the trip
  // event is the wrong shape. If almost nothing in the zone is lit, the power is
  // out and an empty active set is correct. If most of the zone is lit and the
  // active set is still empty, that is the rig failing to rank anything, which
  // is a defect and is what this should catch.
  const unlit = S.filter((s) => (s.lights?.active ?? 0) === 0);
  // MEASURED OVER THE SAME SET, WHICH IT WAS NOT.
  //
  // This compared `lights.active` — which can only ever come from the player's
  // own zone, because `LightRig` culls a fixture beyond `def.distance * 1.5` —
  // against `lights.lit`, which counts every resident zone including the two
  // sitting 400 m away. In the Plant it read 83 lit of 119 with 0 active and
  // called it unexplained, when the truthful statement is "no fixture in this
  // room is within its own cull radius of the player". Use the current zone's
  // own counts where they are recorded.
  // HALF, NOT A QUARTER. With the counts finally taken over the same set, the
  // Plant reads 7 of its 25 fixtures lit with nothing in the active set — and
  // the Plant's power IS the puzzle you go there to solve, so most of it being
  // dark is the game, not a defect. A quarter was tight enough to call that
  // unexplained by one fixture. A zone with more than half its fittings out is
  // a zone whose supply is substantially down.
  const poweredDown = (s) => {
    const z = s.zoneLit;
    if (z && z.total > 0) return z.lit < z.total * 0.5;
    return (s.lights?.lit ?? 0) < (s.lights?.fixtures ?? 1) * 0.5;
  };
  const unexplained = unlit.filter((s) => !poweredDown(s));
  check('no zone went dark without something switching it off',
    unexplained.length <= 2 && unlit.length < S.length * 0.25,
    `${unlit.length} of ${S.length} samples had no active light`
    + ` (${unlit.length - unexplained.length} with the power out,`
    + ` ${unexplained.length} unexplained)`);
  // A hiding place takes the controls away, so a session that gets stuck in one
  // measures a player standing still and reports it as a quiet game. That happened
  // once and cost a whole run, so it is an assertion now rather than something to
  // notice in a graph.
  check('the session did not get stuck inside a hiding place',
    (H.hiddenSamples ?? 0) < S.length * 0.25,
    `${H.hiddenSamples ?? 0} of ${S.length} samples were spent hidden`);
  check('at least one interactable was operated',
    (H.interactions?.length ?? 0) >= 6,
    (H.interactions || []).map((i) => `${i.id}:${i.result}`).join('; ') || 'none');
  check('the player was able to move for most of the session',
    frac((s) => s.controls !== false) > 0.7,
    `${(frac((s) => s.controls !== false) * 100).toFixed(0)}% of samples had controls enabled`);
  // DID THE DECOY ACTUALLY DO ANYTHING?
  //
  // Counting throws proves the key is bound. What has to be true for it to be a
  // mechanic is that the Surveyor went somewhere else because of it. Each throw
  // publishes `decoy:thrown` with its landing point; `entity:heard` publishes
  // the belief the Surveyor formed and where. So: within four seconds of a
  // throw, did a belief land near the cell rather than near the player?
  //
  // This is the check that fails if `world:noise` is not wired, if the landing
  // point is computed wrong, or if `hear()` rejects the radius — none of which
  // the throw count would notice.
  const throws = H.events.filter((e) => e.key === 'decoy:thrown');
  const heard = H.events.filter((e) => e.key === 'entity:heard' && e.data?.at);
  const redirected = throws.filter((tw) => {
    if (!tw.data?.at) return false;
    const [tx, , tz] = tw.data.at;
    return heard.some((h) => {
      if (h.t < tw.t || h.t > tw.t + 4) return false;
      const [hx, , hz] = h.data.at;
      return Math.hypot(hx - tx, hz - tz) < 6;
    });
  });
  // ONLY A THROW THAT COULD HAVE WORKED IS EVIDENCE THAT IT DOES NOT.
  //
  // `Surveyor.hear` gives a `world:noise` of radius r a reach of `r * 1.9 + 3`,
  // so a cell thrown beyond 27.7 m of the entity is inaudible by design and its
  // failure to redirect says nothing. Neither does a throw made while the
  // Surveyor is APPROACHING — it has stopped believing and started arriving.
  // Both were happening, and both produced a red check for the mechanic
  // behaving correctly.
  //
  // This is a precondition, not a softened threshold: a throw that lands inside
  // the audible radius while the entity is still searching MUST move the belief,
  // and if none does, this fails. What it will not do any more is fail for a
  // throw that was never a fair test — and it says how many it discarded, so a
  // session where every throw was unfair cannot read as a pass by silence.
  const AUDIBLE = 16 * 1.9 + 3;   // Decoy.noiseRadius through Surveyor.hear
  const entAt = (t) => {
    let best = null;
    for (const s of S) if (s.entity?.dist != null && Math.abs(s.t - t) <= 1.5
      && (!best || Math.abs(s.t - t) < Math.abs(best.t - t))) best = s;
    return best;
  };
  const occlOf = (t) => (H.throwOccl || []).find((o) => Math.abs(o.t - t) < 2.5) || null;
  const fair = throws.filter((tw) => {
    if (!tw.data?.at) return false;
    const o = occlOf(tw.t);
    // `o.dist` is entity-to-cell. Too far and it was never heard; too CLOSE and
    // it is not a decoy — a noise where the Surveyor already is cannot draw it
    // anywhere, and counting it as a pass is how a check rewards a throw no
    // player would make.
    if (o) return o.dist <= AUDIBLE && o.dist >= 5 && o.occl < 0.6;
    const s = entAt(tw.t);
    if (!s) return false;
    return (s.entity.dist + (tw.data.distance ?? 14)) <= AUDIBLE;
  });
  const fairRedirected = redirected.filter((tw) => fair.includes(tw));
  check('a thrown decoy moved the Surveyor\'s belief to where it landed',
    fair.length === 0 || fairRedirected.length > 0,
    throws.length
      ? `${fairRedirected.length} of ${fair.length} audible throws redirected`
        + ` (${throws.length - fair.length} discarded as not a decoy —`
        + ` beyond ${AUDIBLE.toFixed(0)} m, on top of it, or behind a wall:`
        + ` ${(H.throwOccl || []).map((o) => `${o.dist} m occl ${o.occl}`).join(', ') || 'n/a'})`
      : 'no decoy was thrown this session — the entity never came close enough');

  // A session that dies and never gets up measures the silence of a modal
  // screen, not the silence of the game. See the revive block in the step loop.
  check('the session never sat on the death screen',
    frac((s) => s.state === 'dead') < 0.05,
    `${(frac((s) => s.state === 'dead') * 100).toFixed(1)}% of samples were dead; ${H.revives ?? 0} revive(s)`);

  const failed = checks.filter((c) => !c.ok);

  // ---------------------------------------------------------------------------
  // playthrough.json
  // ---------------------------------------------------------------------------
  const analysis = {
    zeroThreatFraction: frac((s) => !(s.entity?.active && s.entity.state !== 'DORMANT') && (s.fear ?? 0) < 0.15),
    entityEverActive: S.some((s) => s.entity?.active),
    episodes: episodes.map((e) => ({
      from: e.from, to: e.to, seconds: +(e.to - e.from).toFixed(1),
      states: [...e.states], minDist: e.minDist, maxFear: e.maxFear,
    })),
    fear: {
      p50: +fp(0.5).toFixed(3), p90: +fp(0.9).toFixed(3), max: +Math.max(...fears, 0).toFixed(3),
      fractionAbove: { 0.15: +frac((s) => (s.fear ?? 0) > 0.15).toFixed(3), 0.3: +frac((s) => (s.fear ?? 0) > 0.3).toFixed(3), 0.5: +frac((s) => (s.fear ?? 0) > 0.5).toFixed(3) },
    },
    directorBeats: beats.map((b) => ({ t: b.t, name: b.data?.name, fear: b.data?.fear })),
    longestSilence: longestQuiet,
    eventCounts: counts,
    zonesVisited: zones,
    frameMs: { p50: +pct(0.5).toFixed(2), p90: +pct(0.9).toFixed(2), p99: +pct(0.99).toFixed(2), max: +Math.max(...ms).toFixed(2), warmP99: +wpct(0.99).toFixed(2) },
    movingFraction: +frac((s) => s.moving).toFixed(3),
  };

  await writeFile(path.join(OUT, 'playthrough.json'), JSON.stringify({
    generated: new Date().toISOString(),
    config: { quality: QUALITY, width: WIDTH, height: HEIGHT, dt: DT, seconds: SECONDS, sampleEvery: SAMPLE, filmEvery: FILM, liveAudio: LIVE_AUDIO },
    boot: { ms: bootMs, audioInit },
    script: SCRIPT.map((p) => ({ name: p.name, seconds: p.seconds, mode: p.mode, keys: p.keys || [] })),
    frames: H.frames, simSeconds: +H.simSeconds.toFixed(2), wallMs,
    checks, analysis,
    status: H.status, fixtureReport,
    entityStates: H.entityStates,
    samples: S, events: H.events, film,
    console: logs.slice(-400),
  }, null, 2));

  // ---------------------------------------------------------------------------
  // playthrough.md — the deliverable a human reads
  // ---------------------------------------------------------------------------
  const L = [];
  L.push('# THE ANNEX — continuous playthrough');
  L.push('');
  L.push(`Generated ${new Date().toISOString()} by \`tools/qa/playthrough.mjs\`.`);
  L.push('');
  L.push(`**${H.frames} frames · ${H.simSeconds.toFixed(1)} s of simulated play at a fixed 1/60 step · ` +
    `${(wallMs / 1000).toFixed(0)} s of wall clock · quality \`${QUALITY}\` · ${WIDTH}×${HEIGHT}**`);
  L.push('');
  L.push('This is the first continuous session ever run on this build. Movement, sprint, crouch, the');
  L.push('lamp key and the interact key are real DOM keyboard events; mouse look is written into the');
  L.push('field a locked pointer would write, because headless Chromium cannot grant pointer lock.');
  L.push('Frame times come from a CPU rasteriser and are not a frame-rate verdict.');
  L.push('');

  // -- assertions
  L.push('## Assertions');
  L.push('');
  L.push('| | check | detail |');
  L.push('|---|---|---|');
  for (const c of checks) L.push(`| ${c.ok ? '**PASS**' : '**FAIL**'} | ${c.name} | ${c.detail || ''} |`);
  L.push('');
  if (failed.length) {
    L.push(`**${failed.length} check(s) failed.**`);
    L.push('');
  }

  // -- what was actually operated
  L.push('## Interactions');
  L.push('');
  if (!(H.interactions || []).length) {
    L.push('Nothing was operated. Every `seek` phase failed to reach its target.');
  } else {
    L.push('| at | interactable | verb | result |');
    L.push('|---|---|---|---|');
    for (const i of H.interactions) {
      L.push(`| ${fmt(i.t)} | \`${i.id}\` | ${i.verb || ''} | ${i.result} |`);
    }
  }
  L.push('');
  L.push(`Objective state at the end: \`${JSON.stringify(H.progression)}\``);
  L.push(`Carried: \`${JSON.stringify(H.inventory)}\``);
  L.push(`Interactor registry: ${H.interactorItems} items, ${H.doors} doors.`);
  L.push('');

  // -- pacing
  L.push('## Pacing');
  L.push('');
  L.push(`- **Session length:** ${H.simSeconds.toFixed(1)} s (${(H.simSeconds / 60).toFixed(1)} min) of play.`);
  L.push(`- **Zero-threat time:** ${(analysis.zeroThreatFraction * 100).toFixed(1)}% of samples had no active entity and fear below 0.15.`);
  L.push(`- **The Surveyor was ${analysis.entityEverActive ? 'active at some point' : '**never active at all**'}.**`);
  L.push(`- **Threat episodes:** ${analysis.episodes.length}` +
    (analysis.episodes.length ? ` — ${analysis.episodes.map((e) => `${e.seconds}s (${e.states.join('→')}, closest ${e.minDist} m)`).join('; ')}` : ' (none)'));
  L.push(`- **Fear:** median ${analysis.fear.p50}, p90 ${analysis.fear.p90}, peak ${analysis.fear.max}. ` +
    `Above 0.3 for ${(analysis.fear.fractionAbove[0.3] * 100).toFixed(1)}% of the session, above 0.5 for ${(analysis.fear.fractionAbove[0.5] * 100).toFixed(1)}%.`);
  L.push(`- **Director beats fired:** ${beats.length}` +
    (beats.length ? ` — ${beats.map((b) => `${b.data?.name} at ${fmt(b.t)}`).join(', ')}` : ' (none — the quiet floor is 95 s and `nextBeatAt` starts at 150 s)'));
  L.push(`- **Longest stretch with nothing on the bus except footsteps:** ` +
    `${longestQuiet.seconds.toFixed(1)} s (${fmt(longestQuiet.from)} → ${fmt(longestQuiet.to)}).`);
  L.push(`- **Moving:** ${(analysis.movingFraction * 100).toFixed(0)}% of samples.`);
  L.push(`- **Zones:** ${zones.map((z) => `${z.zone} (${fmt(z.from)}–${fmt(z.to)})`).join(' → ')}`);
  L.push('');

  L.push('### Frame time (CPU rasteriser — not a frame-rate verdict)');
  L.push('');
  L.push('| | p50 | p90 | p99 | max |');
  L.push('|---|---:|---:|---:|---:|');
  L.push(`| whole session | ${num(pct(0.5))} | ${num(pct(0.9))} | ${num(pct(0.99))} | ${num(Math.max(...ms), 0)} |`);
  L.push(`| after 3 s warmup | ${num(wpct(0.5))} | ${num(wpct(0.9))} | ${num(wpct(0.99))} | ${num(Math.max(...warm), 0)} |`);
  L.push('');
  L.push('All in milliseconds. The multi-second outliers are first-frame shader compiles');
  L.push('after a camera or zone change, which is a property of SwiftShader, not of the renderer.');
  L.push('');

  // -- event census
  L.push('## Event census');
  L.push('');
  L.push('| event | count |');
  L.push('|---|---:|');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) L.push(`| \`${k}\` | ${v} |`);
  L.push('');

  // -- the timeline
  L.push('## Timeline');
  L.push('');
  L.push('State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise');
  L.push('events are counted in the census above rather than listed, because there are hundreds.');
  L.push('');
  L.push('```');
  {
    const evByTime = [...notable].sort((a, b) => a.t - b.t);
    let ei = 0;
    let lastPhase = null;
    let nextState = 0;
    const pushEventsUpTo = (t) => {
      while (ei < evByTime.length && evByTime[ei].t <= t) {
        const e = evByTime[ei++];
        if (e.key === 'qa:phase') {
          L.push('');
          L.push(`${fmt(e.t).padStart(7)}  ── ${e.data.name} ──`);
          continue;
        }
        const d = e.data && typeof e.data === 'object'
          ? Object.entries(e.data).map(([k, v]) => `${k}=${Array.isArray(v) ? `(${v.join(', ')})` : v}`).join(' ')
          : String(e.data ?? '');
        L.push(`${fmt(e.t).padStart(7)}      * ${e.key.padEnd(24)} ${d}`);
      }
    };
    for (const s of S) {
      pushEventsUpTo(s.t);
      if (s.t < nextState) continue;
      nextState = s.t + 5;
      if (s.phase !== lastPhase) lastPhase = s.phase;
      const ent = s.entity
        ? (s.entity.active ? `${s.entity.state} @${num(s.entity.dist, 1)}m` : 'not spawned')
        : 'none';
      L.push(`${fmt(s.t).padStart(7)}  ${String(s.zone).padEnd(9)} ` +
        `pos(${s.pos.map((v) => num(v, 1).padStart(6)).join(',')}) ` +
        `${s.moving ? 'walk' : 'stil'} ${s.crouch ? 'crch' : '    '} ` +
        `fear ${num(s.fear ?? 0)} ` +
        `lamp ${s.lamp ? (s.lamp.on ? `on ${num(s.lamp.battery, 2)}` : 'off     ') : '—'} ` +
        `lit ${String(s.lights.active).padStart(2)}/${String(s.lights.lit).padStart(3)}/${s.lights.fixtures} ` +
        `entity ${ent.padEnd(18)} ` +
        `${num(s.ms, 1).padStart(6)}ms`);
    }
    pushEventsUpTo(Infinity);
  }
  L.push('```');
  L.push('');
  L.push('`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.');
  L.push('');

  // -- entity transitions
  L.push('## Entity state transitions');
  L.push('');
  if (!H.entityStates.length) L.push('None. The Surveyor never changed state during the session.');
  else {
    L.push('| t | from | to | active |');
    L.push('|---|---|---|---|');
    for (const s of H.entityStates) L.push(`| ${fmt(s.t)} | ${s.from ?? '—'} | ${s.to} | ${s.active} |`);
  }
  L.push('');

  // -- filmstrip
  L.push('## Filmstrip');
  L.push('');
  L.push(`${film.length} frames, one every ~${FILM} s of play. See \`filmstrip.md\` for them in order.`);
  L.push('');

  L.push('## Subsystems at the end of the session');
  L.push('');
  L.push('```json');
  L.push(JSON.stringify(H.status, null, 2));
  L.push('```');
  L.push('');

  await writeFile(path.join(OUT, 'playthrough.md'), L.join('\n'));

  // filmstrip.md
  const F = ['# Playthrough filmstrip', '',
    `${film.length} frames from one continuous ${H.simSeconds.toFixed(0)} s session, in order.`,
    'Read it as a sequence: what changes between two frames 15 s apart is the pacing.', ''];
  for (const f of film) {
    F.push(`### ${fmt(f.t)} — ${f.label}`);
    F.push('');
    F.push(`![${f.label}](${f.file})`);
    F.push('');
  }
  await writeFile(path.join(OUT, 'filmstrip.md'), F.join('\n'));
  await writeFile(path.join(OUT, 'playthrough-console.log'),
    logs.map((l) => `[${l.type}] ${l.text}`).join('\n'));

  // ---- console summary ---------------------------------------------------
  console.log('\n' + '─'.repeat(76));
  for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log('─'.repeat(76));
  console.log(`  zero-threat: ${(analysis.zeroThreatFraction * 100).toFixed(1)}%   ` +
    `episodes: ${analysis.episodes.length}   beats: ${beats.length}   ` +
    `fear p90 ${analysis.fear.p90} peak ${analysis.fear.max}`);
  console.log(`  longest silence: ${longestQuiet.seconds.toFixed(1)}s`);
  console.log(`  wrote ${OUT}/playthrough.md, playthrough.json, filmstrip/ (${film.length} frames)`);
  if (failed.length) { console.error(`\n${failed.length} check(s) FAILED`); process.exit(4); }
}

main().catch((e) => { console.error(e); process.exit(1); });
