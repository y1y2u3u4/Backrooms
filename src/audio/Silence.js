/**
 * Silence.js — silence as a system, not as an absence of code.
 *
 * The loudest thing available to a horror game is the moment the building stops
 * making noise. When a beat is imminent, everything ducks over 2-4 seconds to
 * near-nothing: the hum thins out, the ventilation drops away, the drips stop
 * arriving. The player notices before they know why, which is the point.
 *
 * This is deliberately slow on the way down and fast on the way back. A fast
 * duck reads as a mixing error; a slow one reads as the building holding its
 * breath. The recovery is quick because the return of the hum should feel like
 * a lurch, not a fade.
 *
 * Usage from the director:
 *
 *   audio.silence.holdBreath(3.5);          // duck over 2.5 s, hold, release
 *   audio.silence.beat('imminent');         // named preset
 *   audio.silence.setPressure(0.6);         // continuous, e.g. driven by fear
 *   audio.silence.release();                // let go early
 */

import { clamp, clamp01, damp, lerp } from '../core/util.js';
import { noiseSource, biquad, gainNode, env, expTo, glide } from './Synth.js';

export const SILENCE_BEATS = {
  /** Something is about to happen. The default, and the most useful. */
  imminent: { depth: 0.88, down: 2.8, hold: 1.6, up: 0.9, vacuum: 0.35 },
  /** A long, unbearable one. Use once. */
  dread: { depth: 0.95, down: 4.0, hold: 4.5, up: 1.6, vacuum: 0.6 },
  /** Just before a reveal — shorter, and it snaps back hard. */
  reveal: { depth: 0.92, down: 1.8, hold: 0.7, up: 0.35, vacuum: 0.5 },
  /** The room you are in stops mattering. Used at zone thresholds. */
  threshold: { depth: 0.55, down: 2.2, hold: 1.0, up: 1.4, vacuum: 0 },
  /** After the danger passes. A partial duck that lets the room back in slowly. */
  reprieve: { depth: 0.45, down: 1.2, hold: 2.4, up: 3.5, vacuum: 0 },
};

export class Silence {
  constructor({ engine, ambience = null, music = null, bus = null }) {
    this.engine = engine;
    this.ambience = ambience;
    this.music = music;
    this.bus = bus;

    this.pressure = 0;        // 0 = normal world, 1 = held breath
    this._target = 0;
    this._phase = 'idle';     // idle | down | hold | up
    this._timer = 0;
    this._plan = null;
    this._applied = -1;
    this.enabled = true;
    this._vacuum = null;

    this._registerDefs();
  }

  _registerDefs() {
    /**
     * The vacuum. Not a sound so much as a pressure: a sub-audio swell under
     * the duck, so the silence has a shape. Keep it below anything a laptop
     * speaker can reproduce — on good headphones it is the whole effect, on
     * bad ones it correctly does nothing.
     */
    this.engine.register('silence.vacuum', {
      bus: 'music', spatial: false, gain: 0.5, send: 0.0, dur: 12, maxVoices: 1, priority: 7,
      build: ({ ctx, bag, out, t, opts }) => {
        const dur = clamp(opts.duration ?? 4, 1, 20);
        const depth = clamp01(opts.depth ?? 0.5);
        const o = ctx.createOscillator();
        o.type = 'sine';
        const f0 = 31 * (0.88 + Math.random() * 0.24);
        o.frequency.setValueAtTime(f0, t);
        expTo(o.frequency, f0 * (0.58 + Math.random() * 0.10), t + dur);
        bag.src(o);
        const lp = biquad(ctx, bag, 'lowpass', 90, 0.7);
        const g = gainNode(ctx, bag, 0);
        o.connect(lp); lp.connect(g); g.connect(out);
        env(g.gain, t, 0.0001, [
          [dur * 0.75, 0.42 * depth, 'exp'],
          [dur, 0.0001, 'exp'],
        ]);
        // A breath of filtered noise under it so it is not a pure test tone.
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 0.5 });
        const nlp = biquad(ctx, bag, 'lowpass', 60, 0.8);
        const ng = gainNode(ctx, bag, 0);
        n.connect(nlp); nlp.connect(ng); ng.connect(out);
        env(ng.gain, t, 0.0001, [[dur * 0.8, 0.18 * depth, 'exp'], [dur, 0.0001, 'exp']]);
        n.start(t, Math.random() * 3); n.stop(t + dur + 0.2);
        o.start(t); o.stop(t + dur + 0.2);
        return t + dur + 0.2;
      },
    });
  }

  // -- the interface the director uses --------------------------------------

  /**
   * Duck the world to near-nothing for `seconds`, then let it back in.
   * The ramp down is 2-4 s by design; passing a shorter total just shortens
   * the hold.
   */
  holdBreath(seconds = 3.5, opts = {}) {
    if (!this.enabled || !this.engine.available) return this;
    const down = clamp(opts.down ?? Math.min(3.0, Math.max(2.0, seconds * 0.55)), 0.4, 6);
    const up = opts.up ?? 0.9;
    const hold = Math.max(0, seconds - down);
    return this._run({
      depth: clamp01(opts.depth ?? 0.9), down, hold, up,
      vacuum: opts.vacuum ?? 0.35,
    });
  }

  /** A named preset from SILENCE_BEATS. */
  beat(name = 'imminent', overrides = {}) {
    const p = SILENCE_BEATS[name] || SILENCE_BEATS.imminent;
    return this._run({ ...p, ...overrides });
  }

  /** Let the world back in now. */
  release(up = null) {
    if (!this._plan) return this;
    this._phase = 'up';
    this._timer = up ?? this._plan.up;
    this._plan.up = this._timer;
    this._target = 0;
    this._apply(this._plan.up);
    return this;
  }

  /**
   * Continuous control, for a director that wants to thin the world out
   * gradually rather than in a scripted beat. 0 = normal, 1 = held breath.
   * Ignored while a scripted beat is running.
   */
  setPressure(v, time = 1.5) {
    if (this._plan) return this;
    this._target = clamp01(v);
    this.pressure = damp(this.pressure, this._target, 3, 0.016);
    this._applyLevel(this._target, time);
    return this;
  }

  get active() { return this._plan !== null; }

  // -- internals ------------------------------------------------------------

  _run(plan) {
    if (!this.enabled || !this.engine.available) return this;
    this._plan = { depth: 0.9, down: 2.6, hold: 1.5, up: 0.9, vacuum: 0, ...plan };
    this._phase = 'down';
    this._timer = this._plan.down;
    this._target = this._plan.depth;
    this._apply(this._plan.down);
    if (this._plan.vacuum > 0) {
      this.engine.play('silence.vacuum', {
        duration: this._plan.down + this._plan.hold,
        depth: this._plan.vacuum,
      });
    }
    return this;
  }

  _apply(time) { this._applyLevel(this._target, time); }

  _applyLevel(amount, time) {
    const a = clamp01(amount);
    // Buses: ambience and world duck hard, music and player less so — the
    // player's own footsteps going silent reads as a bug, not as tension.
    this.engine.setDuck(a, time, ['ambience', 'world']);
    this.engine.setDuck(a * 0.55, time, ['music']);
    this.engine.setDuck(a * 0.35, time, ['player']);
    // Stop the ambience SPAWNING as well as sounding: a drip that is scheduled
    // during a held breath will arrive on the release and ruin it.
    if (this.ambience) this.ambience.setIntensity(1 - a * 0.94, Math.max(0.3, time * 0.7));
    // The reverb tail is part of the room; take it too, or the duck sounds fake.
    this.engine.setParam('wet', lerp(1, 0.35, a), time);
  }

  update(dt) {
    if (!this._plan) {
      this.pressure = damp(this.pressure, this._target, 2.5, dt);
      return;
    }
    this._timer -= dt;
    this.pressure = damp(this.pressure, this._target, 4, dt);
    if (this._timer > 0) return;

    if (this._phase === 'down') {
      this._phase = 'hold';
      this._timer = this._plan.hold;
    } else if (this._phase === 'hold') {
      this._phase = 'up';
      this._timer = this._plan.up;
      this._target = 0;
      this._apply(this._plan.up);
    } else {
      this._phase = 'idle';
      this._plan = null;
      this._target = 0;
      this._apply(0.6);
    }
  }

  /** Hard reset — used on death, endings and zone teardown. */
  reset() {
    this._plan = null;
    this._phase = 'idle';
    this._target = 0;
    this.pressure = 0;
    if (this.engine.available) this._applyLevel(0, 0.5);
    return this;
  }
}

export default Silence;
