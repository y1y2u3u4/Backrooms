/**
 * Footsteps.js — per-surface footfall synthesis.
 *
 * A footstep is not one sound, it is four, and getting the proportions right is
 * most of the job:
 *
 *   1. HEEL      a short filtered transient. Its brightness IS the material.
 *   2. BODY      the surface's own resonance — a modal ring on tread plate, a
 *                dull thump on carpet, essentially nothing on lino.
 *   3. ROOM      a very short bright burst with a large reverb send, which is
 *                what "excites the room" means. Hard surfaces do this and soft
 *                ones do not, and it is why concrete corridors sound big.
 *   4. CLOTH     a separate rustle layer on the player bus, independent of the
 *                surface, quieter when crouched, louder when sprinting.
 *
 * Driven entirely from `player:step` / `player:land`, so audio and the camera
 * bob are locked together at every speed (see Player.js — footfalls fire off
 * the bob phase, never a timer).
 *
 * Left and right feet are deliberately not identical: the trailing foot lands
 * a touch softer and a touch duller, which is what stops a walk cycle sounding
 * like a drum machine.
 */

import { clamp, clamp01, lerp, makeRng } from '../core/util.js';
import {
  noiseBurst, modalRing, biquad, gainNode, hit, ar, env, expTo, poissonGap,
  varied, noiseSource, panner2d, glide,
} from './Synth.js';

/**
 * Surface table. `heel` is the transient, `body` the resonance, `room` how much
 * the surface excites the space, `scuff`/`squeak` are per-step probabilities.
 */
export const SURFACES = {
  carpet: {
    heel: { type: 'brown', filter: 'lowpass', f0: 620, f1: 300, q: 0.8, attack: 0.004, decay: 0.055, gain: 0.34 },
    body: { modes: [{ f: 78, t60: 0.075, gain: 1 }, { f: 143, t60: 0.05, gain: 0.4 }], gain: 0.30, tone: 700 },
    room: 0.10, send: 0.22, scuff: 0.16, squeak: 0, cloth: 1.0, pitch: 1,
  },
  carpet_damp: {
    // Damp loop carpet: darker, and the fibres release with a faint suck.
    heel: { type: 'brown', filter: 'lowpass', f0: 430, f1: 210, q: 0.9, attack: 0.006, decay: 0.075, gain: 0.36 },
    body: { modes: [{ f: 64, t60: 0.10, gain: 1 }, { f: 118, t60: 0.06, gain: 0.42 }], gain: 0.34, tone: 480 },
    room: 0.07, send: 0.26, scuff: 0.22, squeak: 0, suck: 0.55, cloth: 1.0, pitch: 0.94,
  },
  concrete: {
    heel: { type: 'white', filter: 'bandpass', f0: 2200, f1: 1100, q: 0.9, attack: 0.0012, decay: 0.030, gain: 0.42 },
    body: { modes: [{ f: 108, t60: 0.055, gain: 1 }, { f: 232, t60: 0.035, gain: 0.5 }, { f: 470, t60: 0.02, gain: 0.24 }], gain: 0.34, tone: 2600 },
    room: 0.62, send: 0.55, scuff: 0.30, squeak: 0, cloth: 0.9, pitch: 1,
  },
  lino: {
    heel: { type: 'white', filter: 'bandpass', f0: 1500, f1: 800, q: 1.3, attack: 0.0016, decay: 0.036, gain: 0.38 },
    body: { modes: [{ f: 132, t60: 0.045, gain: 1 }, { f: 296, t60: 0.025, gain: 0.35 }], gain: 0.26, tone: 1900 },
    room: 0.38, send: 0.42, scuff: 0.24, squeak: 0.17, cloth: 0.95, pitch: 1.04,
  },
  tread: {
    // Chequer plate over a void: a bright strike and a long metallic ring.
    heel: { type: 'white', filter: 'highpass', f0: 2600, q: 0.7, attack: 0.0009, decay: 0.022, gain: 0.40 },
    body: {
      modes: [
        { f: 268, t60: 0.42, gain: 1 }, { f: 447, t60: 0.30, gain: 0.62 },
        { f: 731, t60: 0.20, gain: 0.44 }, { f: 1183, t60: 0.13, gain: 0.28 },
        { f: 1874, t60: 0.08, gain: 0.16 },
      ], gain: 0.42, tone: 4200,
    },
    room: 0.55, send: 0.62, scuff: 0.28, squeak: 0, rattle: 0.35, cloth: 0.9, pitch: 1,
  },
  duct: {
    // Inside a 0.8 m galvanised box: the panel itself booms under your knee.
    heel: { type: 'white', filter: 'bandpass', f0: 1700, f1: 700, q: 1.0, attack: 0.0012, decay: 0.030, gain: 0.36 },
    body: {
      modes: [
        { f: 71, t60: 0.34, gain: 1 }, { f: 124, t60: 0.26, gain: 0.78 },
        { f: 203, t60: 0.19, gain: 0.5 }, { f: 337, t60: 0.12, gain: 0.3 },
        { f: 528, t60: 0.07, gain: 0.16 },
      ], gain: 0.62, tone: 2400,
    },
    room: 0.30, send: 0.30, scuff: 0.34, squeak: 0, rattle: 0.5, cloth: 1.15, pitch: 1,
  },
  water: {
    heel: { type: 'white', filter: 'bandpass', f0: 1900, f1: 900, q: 0.7, attack: 0.003, decay: 0.09, gain: 0.30 },
    body: { modes: [{ f: 92, t60: 0.10, gain: 1 }], gain: 0.22, tone: 900 },
    room: 0.35, send: 0.7, scuff: 0, squeak: 0, cloth: 1.0, pitch: 1,
  },
};

/** Aliases so a world builder can label a floor however it likes. */
const ALIAS = {
  carpetDamp: 'carpet_damp', dampCarpet: 'carpet_damp', wetCarpet: 'carpet_damp',
  concrete_wet: 'concrete', tile: 'concrete', screed: 'concrete', slab: 'concrete',
  vinyl: 'lino', linoleum: 'lino', floorboard: 'lino', wood: 'lino',
  metal: 'tread', grate: 'tread', grating: 'tread', plate: 'tread', gantry: 'tread',
  duct: 'duct', vent: 'duct', silt: 'water', flooded: 'water',
};
export const resolveSurface = (s) => (SURFACES[s] ? s : (ALIAS[s] || 'concrete'));

// ---------------------------------------------------------------------------

export class Footsteps {
  constructor({ engine, bus = null, seed = 991 }) {
    this.engine = engine;
    this.bus = bus;
    this.rng = makeRng(seed);
    this.enabled = true;
    this.gain = 1;
    this.stepCount = 0;
    this.exertion = 0;
    this.fear = 0;
    this._breathT = 2.2;
    this._breathIn = true;
    this._lastStepAt = -10;
    this._unsub = [];
    this._registerDefs();
    if (bus) this.attach(bus);
  }

  attach(bus) {
    this._unsub.push(bus.on('player:step', (e) => this.step(e)));
    this._unsub.push(bus.on('player:land', (e) => this.land(e)));
    return this;
  }
  detach() { for (const u of this._unsub) u(); this._unsub.length = 0; }

  // -- definitions ----------------------------------------------------------

  _registerDefs() {
    const E = this.engine;

    for (const key of Object.keys(SURFACES)) {
      const S = SURFACES[key];
      E.register(`step.${key}`, {
        bus: 'player', spatial: false, gain: 0.72, send: S.send, dur: 1.2, maxVoices: 6, priority: 3,
        build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
          const strength = clamp01(opts.strength ?? 0.6);
          const crouch = !!opts.crouch;
          const left = opts.left !== false;
          const depth = clamp01(opts.water ?? 0);

          // Crouching is quieter AND duller — a low-pass, not just a fader.
          const lvl = (crouch ? 0.30 : lerp(0.55, 1.0, strength)) * (opts.gain ?? 1);
          const dull = crouch ? 0.45 : lerp(0.8, 1.15, strength);
          // The trailing foot is softer and darker than the leading one.
          const asym = left ? 1 : 0.90;
          const pitch = S.pitch * vary.pitch * (left ? 1 : 0.965);

          const pan = panner2d(ctx, bag, (left ? -0.13 : 0.13) + vary.pan * 0.3);
          pan.connect(out);
          const tone = biquad(ctx, bag, 'lowpass', clamp(2400 * dull * vary.tone, 300, 18000), 0.7);
          tone.connect(pan);

          // 1. heel
          const h = S.heel;
          let end = noiseBurst(ctx, bag, tone, t, {
            type: h.type, filter: h.filter, q: h.q,
            f0: h.f0 * pitch * (0.9 + rng() * 0.2),
            f1: h.f1 ? h.f1 * pitch : null,
            attack: h.attack * (crouch ? 1.6 : 1),
            decay: h.decay * (crouch ? 1.5 : 1) * (0.85 + rng() * 0.3),
            gain: h.gain * lvl * asym * vary.gain,
          });

          // 2. body — the surface itself
          end = Math.max(end, modalRing(ctx, bag, tone, t + 0.0016 + rng() * 0.004, {
            modes: S.body.modes.map((m) => ({
              f: m.f * pitch * (1 + (rng() * 2 - 1) * 0.035),
              t60: m.t60 * (crouch ? 0.7 : 1) * (0.8 + rng() * 0.45),
              gain: m.gain,
            })),
            gain: S.body.gain * lvl * asym * vary.gain,
            excite: { dur: 0.0022, tone: S.body.tone * dull, type: 'white', gain: 0.8 },
            rng,
          }));

          // 3. room excitation — hard floors slap the corridor, carpet does not
          if (S.room > 0.02) {
            end = Math.max(end, noiseBurst(ctx, bag, pan, t, {
              type: 'white', filter: 'highpass', f0: 1400 + rng() * 900, q: 0.6,
              attack: 0.0007, decay: 0.012 + rng() * 0.01,
              gain: S.room * 0.20 * lvl * (crouch ? 0.35 : 1) * vary.gain,
            }));
          }

          // 4. scuff — the foot does not land clean every time
          if (!crouch && rng() < S.scuff * (0.4 + strength)) {
            const sd = 0.05 + rng() * 0.09;
            const n = noiseSource(ctx, bag, { type: 'white', rate: 0.8 + rng() * 0.5 });
            const bp = biquad(ctx, bag, 'bandpass', 1800 + rng() * 2600, 1.4);
            const g = gainNode(ctx, bag, 0);
            n.connect(bp); bp.connect(g); g.connect(tone);
            expTo(bp.frequency, (900 + rng() * 1400), t + sd);
            env(g.gain, t + 0.008, 0, [[0.012, 0.09 * lvl * vary.gain], [sd, 0]]);
            n.start(t + 0.008, rng() * 2); n.stop(t + sd + 0.05);
            end = Math.max(end, t + sd + 0.02);
          }

          // Lino squeaks on the heel, occasionally, and never twice the same.
          if (S.squeak && !crouch && rng() < S.squeak * (0.3 + strength)) {
            const f = 900 + rng() * 2200;
            const o = ctx.createOscillator(); o.type = 'sawtooth';
            o.frequency.setValueAtTime(f, t + 0.006);
            expTo(o.frequency, f * (1.3 + rng() * 0.9), t + 0.006 + 0.05 + rng() * 0.06);
            bag.src(o);
            const bp2 = biquad(ctx, bag, 'bandpass', f * 1.4, 9);
            const g2 = gainNode(ctx, bag, 0);
            o.connect(bp2); bp2.connect(g2); g2.connect(tone);
            const e2 = hit(g2.gain, t + 0.006, 0.055 * lvl * vary.gain, 0.008, 0.06 + rng() * 0.08);
            o.start(t + 0.006); o.stop(e2 + 0.02);
            end = Math.max(end, e2);
          }

          // Damp carpet releases with a faint suck as the sole lifts.
          if (S.suck && rng() < S.suck) {
            const sd = 0.05 + rng() * 0.05;
            const o = ctx.createOscillator(); o.type = 'sine';
            const f = 180 + rng() * 220;
            o.frequency.setValueAtTime(f, t + 0.05);
            expTo(o.frequency, f * 2.4, t + 0.05 + sd);
            bag.src(o);
            const g = gainNode(ctx, bag, 0);
            o.connect(g); g.connect(tone);
            const e = hit(g.gain, t + 0.05, 0.055 * lvl, 0.012, sd);
            o.start(t + 0.05); o.stop(e + 0.02);
            end = Math.max(end, e);
          }

          // Loose plate / panel rattle after the strike.
          if (S.rattle && rng() < S.rattle * (0.3 + strength)) {
            const n = 1 + Math.floor(rng() * 3);
            let tt = t + 0.03 + rng() * 0.03;
            for (let i = 0; i < n; i++) {
              end = Math.max(end, modalRing(ctx, bag, tone, tt, {
                modes: [{ f: (900 + rng() * 2400) * pitch, t60: 0.02 + rng() * 0.05, gain: 1 }],
                gain: 0.05 * lvl * vary.gain, excite: { dur: 0.0009, tone: 7000 }, rng,
              }));
              tt += 0.018 + rng() * 0.05;
            }
          }

          // Water on top of anything: the splash owns the transient.
          if (depth > 0.02) {
            end = Math.max(end, splash(ctx, bag, pan, t, {
              depth, strength, rng, gain: lvl * vary.gain, crouch,
            }));
          }
          return end;
        }, { pitch: 0.055, gain: 0.14, time: 0.008, pan: 0.5, tone: 0.14 }),
      });
    }

    /** Standalone splash — wading, an object dropped in the Cistern. */
    E.register('splash', {
      bus: 'world', gain: 0.6, send: 0.7, ref: 2.4, dur: 1.4, maxVoices: 5,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => splash(ctx, bag, out, t, {
        depth: clamp01(opts.depth ?? 0.5), strength: clamp01(opts.strength ?? 0.7),
        rng, gain: vary.gain, crouch: false,
      })),
    });

    /** Clothing. Separate layer, separate bus level, never in step with itself. */
    E.register('cloth.rustle', {
      bus: 'player', spatial: false, gain: 0.4, send: 0.12, dur: 0.6, maxVoices: 5, priority: 1,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const amt = clamp01(opts.amount ?? 0.5);
        let end = t;
        const n = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i++) {
          end = Math.max(end, noiseBurst(ctx, bag, out, t + rng() * 0.06, {
            type: 'white', filter: 'bandpass',
            f0: 1800 + rng() * 4200, f1: 900 + rng() * 1400, q: 0.8 + rng() * 0.9,
            attack: 0.008 + rng() * 0.02, decay: 0.05 + rng() * 0.10,
            gain: (0.05 + rng() * 0.10) * amt * vary.gain,
            pan: (rng() * 2 - 1) * 0.45,
          }));
        }
        return end;
      }),
    });

    /** Breath. Sprinting adds it; fear makes it shallow and fast. */
    E.register('breath', {
      bus: 'player', spatial: false, gain: 0.42, send: 0.14, dur: 1.2, maxVoices: 3, priority: 2,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const inhale = opts.inhale !== false;
        const effort = clamp01(opts.effort ?? 0.5);
        const dur = lerp(0.42, 0.20, effort) * (0.85 + rng() * 0.3);
        const n = noiseSource(ctx, bag, { type: 'white', rate: 0.9 + rng() * 0.3 });
        // Two formants: the throat, then the mouth. One band reads as wind.
        const f1 = biquad(ctx, bag, 'bandpass', inhale ? 520 : 380, 1.5);
        const f2 = biquad(ctx, bag, 'bandpass', inhale ? 1650 : 1180, 2.4);
        const mix = gainNode(ctx, bag, 1);
        const hp = biquad(ctx, bag, 'highpass', 200, 0.7);
        const g = gainNode(ctx, bag, 0);
        n.connect(hp); hp.connect(f1); hp.connect(f2);
        f1.connect(mix); f2.connect(mix); mix.connect(g);
        const pan = panner2d(ctx, bag, vary.pan * 0.25);
        g.connect(pan); pan.connect(out);
        // The formants move through the breath, which is what makes it a breath.
        expTo(f1.frequency, (inhale ? 760 : 300) * vary.tone, t + dur);
        expTo(f2.frequency, (inhale ? 2100 : 900) * vary.tone, t + dur);
        const peak = lerp(0.10, 0.30, effort) * vary.gain;
        if (inhale) env(g.gain, t, 0, [[dur * 0.65, peak], [dur, 0.0001]]);
        else env(g.gain, t, 0, [[dur * 0.18, peak], [dur, 0.0001]]);
        n.start(t, rng() * 2); n.stop(t + dur + 0.05);
        return t + dur + 0.04;
      }, { pitch: 0.05, gain: 0.22, pan: 0.5, tone: 0.14 }),
    });

    /** Landing. Heavier than a step, with a knee-and-cloth component. */
    E.register('land', {
      bus: 'player', spatial: false, gain: 0.85, send: 0.4, dur: 1.6, maxVoices: 3, priority: 4,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const S = SURFACES[resolveSurface(opts.surface)] || SURFACES.concrete;
        const f = clamp01(opts.force ?? 0.5);
        const tone = biquad(ctx, bag, 'lowpass', 3200 * vary.tone, 0.7);
        tone.connect(out);
        let end = noiseBurst(ctx, bag, tone, t, {
          type: S.heel.type, filter: S.heel.filter, q: S.heel.q,
          f0: S.heel.f0 * 0.82, f1: S.heel.f1 ? S.heel.f1 * 0.8 : null,
          attack: 0.0012, decay: S.heel.decay * 1.8,
          gain: S.heel.gain * (0.7 + f) * vary.gain,
        });
        end = Math.max(end, modalRing(ctx, bag, tone, t, {
          modes: S.body.modes.map((m) => ({ f: m.f * 0.86, t60: m.t60 * 1.7, gain: m.gain })),
          gain: S.body.gain * (0.9 + f * 1.2) * vary.gain,
          excite: { dur: 0.005, tone: S.body.tone, gain: 1.1 }, rng,
        }));
        // Both feet at once, offset by a few milliseconds.
        end = Math.max(end, modalRing(ctx, bag, tone, t + 0.014 + rng() * 0.012, {
          modes: S.body.modes.map((m) => ({ f: m.f * 0.93, t60: m.t60 * 1.2, gain: m.gain })),
          gain: S.body.gain * 0.5 * (0.9 + f) * vary.gain,
          excite: { dur: 0.004, tone: S.body.tone * 0.8 }, rng,
        }));
        if (S.room > 0.02) {
          noiseBurst(ctx, bag, out, t, {
            type: 'white', filter: 'highpass', f0: 1200, q: 0.6,
            attack: 0.0008, decay: 0.02, gain: S.room * 0.3 * (0.6 + f) * vary.gain,
          });
        }
        return end;
      }),
    });
  }

  // -- events ---------------------------------------------------------------

  /** `player:step` handler. Payload: {surface, water, strength, crouch, left}. */
  step(e = {}) {
    if (!this.enabled || !this.engine.available) return;
    const now = this.engine.now;
    // Guard against a double-fire from a long frame; two steps 30 ms apart is
    // not a walk, it is a bug somewhere upstream.
    if (now - this._lastStepAt < 0.055) return;
    this._lastStepAt = now;
    this.stepCount++;

    const rng = this.rng;
    const water = e.water || 0;
    const surface = water > 0.06 ? 'water' : resolveSurface(e.surface);
    const strength = clamp01(e.strength ?? 0.6);
    const crouch = !!e.crouch;

    this.engine.play(`step.${surface}`, {
      strength, crouch, left: e.left !== false, water,
      gain: this.gain,
    });

    // Cloth: not on every step, and never on the same step number twice.
    const S = SURFACES[surface] || SURFACES.concrete;
    const clothChance = crouch ? 0.35 : lerp(0.45, 0.95, strength);
    if (rng() < clothChance) {
      this.engine.play('cloth.rustle', {
        amount: (crouch ? 0.35 : lerp(0.4, 1.0, strength)) * (S.cloth ?? 1),
        delay: rng() * 0.035,
      });
    }

    // Wading is loud and continuous, not just a splash per step.
    if (water > 0.25 && strength > 0.4 && rng() < 0.5) {
      this.engine.play('splash', {
        depth: clamp01(water), strength: strength * 0.7, gain: 0.5, delay: 0.05 + rng() * 0.09,
      });
    }

    // Sprint breathing rides on the step count, offset so it never lines up.
    if (!crouch && strength > 0.78) {
      this._sprintSteps = (this._sprintSteps || 0) + 1;
      if (this._sprintSteps % 3 === (this.stepCount % 2 ? 0 : 1)) {
        this.engine.play('breath', {
          inhale: this._breathIn, effort: clamp01(0.45 + this.exertion * 0.6),
          delay: 0.03 + rng() * 0.05,
        });
        this._breathIn = !this._breathIn;
        this._breathT = 1.6;
      }
    }
  }

  /** `player:land` handler. Payload: {force, surface}. */
  land(e = {}) {
    if (!this.enabled || !this.engine.available) return;
    this.engine.play('land', { force: clamp01(e.force ?? 0.5), surface: e.surface, gain: this.gain });
    this.engine.play('cloth.rustle', { amount: 0.6 + clamp01(e.force ?? 0.5) * 0.6, delay: 0.02 });
    this._lastStepAt = this.engine.now;
  }

  /**
   * Optional per-frame update. Pass the Player (or `{exertion, fear, sprinting,
   * crouching}`) and idle breathing follows exertion and fear even when
   * standing still — total silence from the player's own body reads as a bug.
   */
  update(dt, state = null) {
    if (!this.enabled || !this.engine.available) return;
    if (state) {
      this.exertion = state.exertion ?? this.exertion;
      this.fear = state.fear ?? this.fear;
    }
    const drive = clamp01(this.exertion * 0.75 + this.fear * 0.55);
    this._breathT -= dt;
    if (this._breathT <= 0) {
      // Only breathe out loud once there is something to breathe about.
      if (drive > 0.22) {
        this.engine.play('breath', { inhale: this._breathIn, effort: drive * 0.8 });
        this._breathIn = !this._breathIn;
      }
      this._breathT = lerp(3.4, 0.62, drive) * (0.8 + this.rng() * 0.4);
    }
  }
}

// ---------------------------------------------------------------------------

/**
 * Water impact. Depth changes everything: a puddle is a bright slap, knee-deep
 * standing water is a heavy displacement with a long bubbly tail.
 */
function splash(ctx, bag, dest, t, { depth = 0.5, strength = 0.7, rng, gain = 1, crouch = false }) {
  const d = clamp01(depth);
  const lvl = gain * (crouch ? 0.4 : 1) * lerp(0.55, 1.15, strength);

  // Impact: bright and short in a puddle, dark and long when wading.
  let end = noiseBurst(ctx, bag, dest, t, {
    type: 'white', filter: 'bandpass',
    f0: lerp(3400, 900, d) * (0.85 + rng() * 0.3),
    f1: lerp(1400, 380, d), q: 0.7,
    attack: lerp(0.001, 0.006, d), decay: lerp(0.05, 0.20, d),
    gain: 0.34 * lvl,
  });

  // Displacement body — the mass of water that has to go somewhere.
  if (d > 0.15) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = lerp(180, 70, d);
    o.frequency.setValueAtTime(f * 1.7, t);
    expTo(o.frequency, f * 0.8, t + 0.14);
    bag.src(o);
    const g = gainNode(ctx, bag, 0);
    o.connect(g); g.connect(dest);
    const e = hit(g.gain, t, 0.20 * lvl * d, 0.006, lerp(0.06, 0.22, d));
    o.start(t); o.stop(e + 0.02);
    end = Math.max(end, e);
  }

  // Bubbles: rising-pitch sines, Poisson-timed, one per entrained bubble.
  const nb = Math.round(lerp(2, 11, d) * (0.5 + strength));
  let tt = t + 0.01;
  for (let i = 0; i < nb; i++) {
    const f0 = lerp(700, 2900, rng()) * lerp(1.25, 0.75, d);
    const dec = 0.02 + rng() * 0.05;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, tt);
    expTo(o.frequency, f0 * (1.12 + rng() * 0.25), tt + dec);
    bag.src(o);
    const g = gainNode(ctx, bag, 0);
    o.connect(g); g.connect(dest);
    const e = hit(g.gain, tt, (0.03 + rng() * 0.05) * lvl, 0.0012, dec);
    o.start(tt); o.stop(e + 0.02);
    end = Math.max(end, e);
    tt += poissonGap(rng, 0.028, 0.004, 0.16);
  }

  // Ripple / spray tail.
  end = Math.max(end, noiseBurst(ctx, bag, dest, t + 0.02, {
    type: 'white', filter: 'highpass', f0: 2600 + rng() * 2000, q: 0.5,
    attack: 0.02, decay: lerp(0.10, 0.34, d), gain: 0.08 * lvl, curve: 'lin',
  }));
  return end;
}

export { splash };
export default Footsteps;
