import { clamp01 } from '../core/util.js';

/**
 * NIGHT WATCH — the survival mode.
 *
 * WHY THIS IS A TASK LOOP AND NOT A TIMER.
 *
 * The obvious way to build "how long can you last" is to start a clock and let
 * the entity hunt. It does not work in this building, and the reason is the
 * game's own best idea. The Surveyor is blind, it hunts by sound, and it stops
 * below a light threshold — so a player who stands still in an unlit room makes
 * no noise, gives it no belief to walk to, and cannot be reached. Against a
 * scoreboard measured in minutes, "go and stand in the dark" is not a tactic,
 * it is the solution, and it is available from the first second.
 *
 * Lowering the freeze threshold with aggression narrows that (see
 * `LIGHT_DEAD_HOT` in Surveyor.js) and does not close it: pitch black still
 * stops it, and it has to, because the frozen pose is how the whole rule is
 * taught. A mode scored on time therefore cannot be won by waiting *because of
 * the entity*. It has to be unwinnable by waiting because of the BUILDING.
 *
 * So the shift is a job. Annex 7 runs on Distribution Board C, ways trip on
 * their own all night, and a way left open long enough takes the plant with it.
 * The player is not surviving the Surveyor; they are keeping the lights on while
 * something walks around. Standing still loses — not quickly, and not because
 * anything came for you, but because the board does not reset itself.
 *
 * That is also the shape that makes the entity frightening again rather than
 * avoidable: you have somewhere you have to be, and it is between you and there.
 *
 * This class is deliberately pure — no THREE, no scene, no DOM. It takes the
 * circuit names, emits what it wants done, and is driven a frame at a time, so
 * `src/systems/qa/survival_sim.mjs` can play a whole shift headlessly.
 */

/** A way that has tripped and is waiting to be reset. */
class Fault {
  constructor(circuit, at, grace) {
    this.circuit = circuit;
    this.at = at;
    this.grace = grace;      // seconds before this one alone ends the shift
    this.age = 0;
  }
}

export class Survival {
  /**
   * @param {object} opts
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {string[]} opts.circuits  the ways this board carries
   * @param {() => number} [opts.rng]
   */
  constructor({ bus, circuits = [], rng = Math.random, config = {} } = {}) {
    this.bus = bus;
    this.circuits = circuits.filter((c) => c !== 'emergency');
    this.rng = rng;

    /**
     * Tuning. All of it is here rather than sprinkled through the update so a
     * balance pass is one object and one sim run, and so the numbers can be
     * asserted directly.
     */
    this.cfg = {
      /** Seconds before the first way trips. The shift starts quietly. */
      firstFault: 45,
      /** Mean seconds between trips at the start... */
      faultEvery: 78,
      /** ...and at the end. The building degrades; this is the whole curve. */
      faultEveryLate: 26,
      /** Seconds a shift takes to reach its hardest state. */
      rampOver: 900,
      /** How long one open way can be left before it takes the plant. */
      grace: 100,
      /** Two open ways at once burn the clock down this much faster. */
      compound: 2.2,
      ...config,
    };

    this.time = 0;
    this.ended = false;
    this.score = 0;
    this.faults = [];        // open Faults, oldest first
    this.resets = 0;
    this.trips = 0;
    this._next = this.cfg.firstFault;
    this._unsub = [];

    if (bus) {
      // The player resetting a way at the board. Same event the campaign uses,
      // so the mode needs no special-case interactable.
      this._unsub.push(bus.on('breaker:set', (e) => {
        if (e?.on) this.clear(e.way ?? e.circuit);
      }));
    }
  }

  /** How hard the shift is right now, 0..1. */
  get pressure() { return clamp01(this.time / this.cfg.rampOver); }

  /** Seconds until the oldest open fault takes the plant, or Infinity. */
  get margin() {
    if (!this.faults.length) return Infinity;
    const burn = this.faults.length > 1 ? this.cfg.compound : 1;
    return Math.max(0, (this.faults[0].grace - this.faults[0].age) / burn);
  }

  /** Trip a way that is not already open. Returns it, or null if none is left. */
  trip(circuit = null) {
    const open = new Set(this.faults.map((f) => f.circuit));
    const avail = this.circuits.filter((c) => !open.has(c));
    if (!avail.length) return null;
    const pick = circuit && avail.includes(circuit)
      ? circuit
      : avail[Math.floor(this.rng() * avail.length) % avail.length];
    const f = new Fault(pick, this.time, this.cfg.grace);
    this.faults.push(f);
    this.trips++;
    this.bus?.emit('survival:fault', { circuit: pick, at: this.time, open: this.faults.length });
    // The whole point of the mode: somewhere you have to be.
    this.bus?.emit('progress:hint', { text: `Way for ${pick} has dropped. Reset it at Board C.` });
    return pick;
  }

  /** The player has put a way back on. */
  clear(circuit) {
    const i = this.faults.findIndex((f) => f.circuit === circuit);
    if (i < 0) return false;
    const f = this.faults.splice(i, 1)[0];
    this.resets++;
    this.bus?.emit('survival:reset', {
      circuit, held: +f.age.toFixed(1), open: this.faults.length,
    });
    return true;
  }

  end(reason) {
    if (this.ended) return;
    this.ended = true;
    this.score = this.time;
    this.bus?.emit('survival:end', {
      reason, seconds: +this.time.toFixed(1), trips: this.trips, resets: this.resets,
    });
  }

  update(dt) {
    if (this.ended) return;
    this.time += dt;

    // Trips come faster as the shift wears on. Interval is interpolated rather
    // than scheduled up front, so a player who is doing well still gets the
    // late-shift rate rather than an easy list drawn at the start.
    this._next -= dt;
    if (this._next <= 0) {
      const p = this.pressure;
      const mean = this.cfg.faultEvery + (this.cfg.faultEveryLate - this.cfg.faultEvery) * p;
      // 0.65..1.35 of the mean, so the rhythm is not metronomic.
      this._next = mean * (0.65 + this.rng() * 0.7);
      this.trip();
    }

    // Open ways burn. Two at once burn faster than twice as fast, which is what
    // turns a bad minute into a lost shift and is the only place this mode
    // punishes hesitation rather than distance.
    const burn = this.faults.length > 1 ? this.cfg.compound : 1;
    for (const f of this.faults) f.age += dt * burn;
    if (this.faults.length && this.faults[0].age >= this.faults[0].grace) {
      this.end('plant');
    }
  }

  /** QA. */
  debugState() {
    return {
      time: +this.time.toFixed(1),
      ended: this.ended,
      open: this.faults.map((f) => f.circuit),
      margin: this.margin === Infinity ? null : +this.margin.toFixed(1),
      pressure: +this.pressure.toFixed(3),
      trips: this.trips,
      resets: this.resets,
    };
  }

  dispose() { for (const u of this._unsub) u(); this._unsub.length = 0; }
}

export default Survival;
