/**
 * Night Watch — headless checks.
 *
 * Plays whole shifts with no browser at all. The mode exists because a timed
 * challenge in this building cannot be won by waiting, and the thing being
 * asserted here is exactly that: a player who does nothing loses, a player who
 * keeps up survives, and the shift gets harder rather than staying level.
 */
import { Survival } from '../Survival.js';
import { Bus } from '../../core/util.js';

let passed = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}   ${detail}`); }
};

const WAYS = ['intake', 'service', 'cistern', 'residence', 'plant', 'stack', 'duct'];

/** Deterministic PRNG so a failing shift can be replayed exactly. */
const rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};

/**
 * @param {object} o
 * @param {(s: Survival) => void} [o.play]  called every simulated second
 */
function shift({ seed = 1, seconds = 3600, play = null, config = {} } = {}) {
  const bus = new Bus();
  const events = [];
  bus.on('survival:fault', (e) => events.push({ t: 'fault', ...e }));
  bus.on('survival:reset', (e) => events.push({ t: 'reset', ...e }));
  bus.on('survival:end', (e) => events.push({ t: 'end', ...e }));
  const s = new Survival({ bus, circuits: WAYS, rng: rng(seed), config });
  const dt = 1 / 30;
  let sinceTick = 0;
  for (let i = 0; i < seconds / dt && !s.ended; i++) {
    s.update(dt);
    sinceTick += dt;
    if (sinceTick >= 1) { sinceTick = 0; play?.(s); }
  }
  return { s, events, bus };
}

console.log('\nNight Watch — headless shift checks\n');

// 1. Doing nothing loses ----------------------------------------------------
{
  console.log('standing still loses');
  const { s } = shift({ seed: 1, seconds: 3600, play: null });
  ok('a shift where the player never moves ends', s.ended);
  ok('and it ends because the plant went, not because time ran out',
    s.score < 3600, `${s.score.toFixed(0)} s`);
  ok('but not instantly — there is a shift to lose', s.score > 100,
    `${s.score.toFixed(0)} s`);

  // The whole reason this mode is a task loop: in this building an idle player
  // is UNREACHABLE by the entity, so if the building did not end the shift,
  // nothing would.
  ok('the reason is the board, not the monster',
    s.trips >= 2 && s.resets === 0, `${s.trips} trips, ${s.resets} resets`);
}

// 2. Keeping up survives ----------------------------------------------------
{
  console.log('keeping up survives');
  // A player who resets a way about eleven seconds after it drops — roughly the
  // walk from anywhere in the Service Spine to Board C.
  const pending = [];
  const { s } = shift({
    seed: 1,
    seconds: 3600,
    play: (sv) => {
      for (const f of sv.faults) if (!pending.includes(f.circuit)) pending.push(f.circuit);
      if (pending.length && sv.time % 1 < 1) {
        // 11 s reaction: only clear faults that have been open that long.
        const due = sv.faults.find((f) => f.age > 11);
        if (due) { sv.clear(due.circuit, due.board); pending.splice(pending.indexOf(due.circuit), 1); }
      }
    },
  });
  ok('an attentive player lasts the hour', !s.ended || s.score > 3500,
    `${s.score.toFixed(0)} s, ${s.resets} resets`);
  ok('and was kept busy doing it', s.resets >= 20, `${s.resets} resets`);
}

// 3. It gets harder ---------------------------------------------------------
{
  console.log('the shift gets harder');
  const { s, events } = shift({
    seed: 3,
    seconds: 3600,
    play: (sv) => { const d = sv.faults.find((f) => f.age > 6); if (d) sv.clear(d.circuit, d.board); },
  });
  const faults = events.filter((e) => e.t === 'fault').map((e) => e.at);
  const gapsEarly = [], gapsLate = [];
  for (let i = 1; i < faults.length; i++) {
    (faults[i] < 450 ? gapsEarly : gapsLate).push(faults[i] - faults[i - 1]);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  ok('trips come faster late than early',
    gapsLate.length > 3 && mean(gapsLate) < mean(gapsEarly) * 0.75,
    `early ${mean(gapsEarly).toFixed(0)} s, late ${mean(gapsLate).toFixed(0)} s`);
  ok('pressure reaches its ceiling and stays there', s.pressure === 1 || s.ended);
}

// 4. Two open ways is the losing state --------------------------------------
{
  console.log('two at once is what kills you');
  const bus = new Bus();
  const one = new Survival({ bus, circuits: WAYS, rng: rng(9) });
  one.trip('plant');
  const marginOne = one.margin;
  one.trip('stack');
  ok('a second open way cuts the margin', one.margin < marginOne,
    `${marginOne.toFixed(0)} s -> ${one.margin.toFixed(0)} s`);
  ok('and it is worse than merely twice as fast',
    one.margin < marginOne / 2 + 1, `${one.margin.toFixed(1)} vs ${(marginOne / 2).toFixed(1)}`);
  one.clear('stack', one.boardFor('stack'));
  ok('clearing one gives the margin back', one.margin > marginOne * 0.9);
}

// 5. The board is the only way to clear a fault -----------------------------
{
  console.log('the board is the interface');
  const bus = new Bus();
  const s = new Survival({ bus, circuits: WAYS, rng: rng(4) });
  s.trip('cistern');
  ok('a fault is open', s.faults.length === 1);
  // THE REAL EVENT. This used to emit `breaker:set`, which nothing in the game
  // has ever emitted — the panel emits `light:circuit`. Implementation and test
  // agreed on an invented name, so the mode's entire reset path was dead in a
  // real run and this suite passed anyway. A check has to speak the game's
  // vocabulary or it is only testing that I can spell my own typo twice.
  bus.emit('light:circuit', { circuit: 'cistern', powered: false, board: 'board_c' });
  ok('switching it OFF does not clear it', s.faults.length === 1);
  bus.emit('light:circuit', { circuit: 'cistern', powered: true, board: 'board_c' });
  ok('switching it on does', s.faults.length === 0);

  // And it has to be the right panel.
  s.trip('plant');
  ok('a Plant fault names the Plant sub-main', s.faults[0].board === 'board_p',
    `${s.faults[0].board}`);
  bus.emit('light:circuit', { circuit: 'plant', powered: true, board: 'board_c' });
  ok('resetting it at Board C does nothing', s.faults.length === 1,
    'the sub-mains exist so that the fault decides which zone you cross');
  bus.emit('light:circuit', { circuit: 'plant', powered: true, board: 'board_p' });
  ok('resetting it at its own board does', s.faults.length === 0);
  ok('and clearing a way that is not faulted is harmless',
    s.clear('residence', 'board_r') === false && s.faults.length === 0);
  ok('the emergency circuit is never tripped', !s.circuits.includes('emergency'),
    'the always-live way is what a blackout leaves you; it is not a chore');
}

// 6. Determinism ------------------------------------------------------------
{
  console.log('a shift can be replayed');
  // Compared on the sequence of ways that dropped, not on the score. An IDLE
  // shift always ends at about firstFault + grace whatever the seed, because
  // nobody resets anything — the first version of this check compared scores,
  // got 117.3 s from both seeds, and reported the randomiser broken when it was
  // measuring a constant. Play the shift, then compare what actually varies.
  const keepUp = (sv) => { const d = sv.faults.find((f) => f.age > 8); if (d) sv.clear(d.circuit, d.board); };
  const seq = (r) => r.events.filter((e) => e.t === 'fault').map((e) => e.circuit).join(',');
  const a = shift({ seed: 77, seconds: 1200, play: keepUp });
  const b = shift({ seed: 77, seconds: 1200, play: keepUp });
  ok('the same seed gives the same shift', seq(a) === seq(b) && a.s.trips === b.s.trips,
    `${a.s.trips} vs ${b.s.trips} trips`);
  const c = shift({ seed: 78, seconds: 1200, play: keepUp });
  ok('a different seed gives a different one', seq(c) !== seq(a),
    `both ran ${a.s.trips} trips in the same order`);
  ok('and a shift is long enough to have a shape', a.s.trips >= 8, `${a.s.trips} trips`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
