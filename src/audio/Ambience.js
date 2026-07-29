/**
 * Ambience.js — the building's continuous voice.
 *
 * Six layers, all synthesised, all with slow internal variation so a player who
 * stands still for five minutes never hears a loop point:
 *
 *   1. FLUORESCENT HUM   the signature. 100 Hz mains (50 Hz UK supply, doubled
 *                        by the rectifying arc) with a full harmonic series,
 *                        detuned per fixture so a corridor of tubes beats
 *                        against itself, plus a ballast whine at 6-15 kHz.
 *                        Spatialised PER FIXTURE and driven by that fixture's
 *                        live `level`, so a dying tube stutters in sync with
 *                        its flicker and a restrike gets a starter crackle.
 *   2. VENTILATION       brown noise with slow resonant sweeps; louder at
 *                        grilles and duct openings.
 *   3. PIPES AND WATER   Poisson-timed drips with a rising-pitch bubble model,
 *                        running water, the Cistern's lap, plumbing knocks.
 *   4. MACHINERY         the Plant's rotating thrum, audible two zones away and
 *                        louder as you approach. It is a navigational cue.
 *   5. ELECTRICAL        transformer buzz, arc crackle, relay clicks.
 *   6. STRUCTURE         settling creaks, expansion ticks, very distant
 *                        impacts. Rare, unmotivated, never on a timer.
 *
 * Nothing here is on a fixed rate. Every discrete event uses an exponential
 * inter-arrival time, which is what makes a dripping tap sound like a dripping
 * tap instead of a metronome.
 */

import { clamp, clamp01, damp, lerp, makeRng, hash2 } from '../core/util.js';
import {
  noiseSource, biquad, gainNode, hit, ar, env, expTo, glide, poissonGap,
  mainsWave, transformerWave, machineWave, modalRing, noiseBurst, varied,
  GrainCloud, sharedNoise, shaper, panner2d, jit,
} from './Synth.js';

// ---------------------------------------------------------------------------
// Zone profiles. Every number is a layer gain 0..1 unless noted.
// ---------------------------------------------------------------------------

export const ZONE_AMBIENCE = {
  intake: {
    hum: 1.00, humRange: 20, vent: 0.34, ventTone: 620, ventSweep: 0.5,
    machine: 0.045, electrical: 0.18, structure: 0.35, water: 0,
    dripEvery: 34, knockEvery: 95, creakEvery: 46, tickEvery: 22, arcEvery: 220, impactEvery: 260,
    airDamp: 0.55, roomTone: 0.30, roomToneF: 210,
  },
  service: {
    hum: 0.80, humRange: 24, vent: 0.55, ventTone: 480, ventSweep: 0.8,
    machine: 0.16, electrical: 0.35, structure: 0.45, water: 0.08,
    dripEvery: 17, knockEvery: 40, creakEvery: 55, tickEvery: 26, arcEvery: 130, impactEvery: 190,
    airDamp: 0.4, roomTone: 0.26, roomToneF: 148,
  },
  cistern: {
    hum: 0.34, humRange: 26, vent: 0.30, ventTone: 300, ventSweep: 1.2,
    machine: 0.24, electrical: 0.10, structure: 0.55, water: 1.0,
    dripEvery: 4.0, knockEvery: 22, creakEvery: 70, tickEvery: 40, arcEvery: 400, impactEvery: 140,
    airDamp: 0.30, roomTone: 0.34, roomToneF: 74,
  },
  residence: {
    hum: 0.12, humRange: 14, vent: 0.20, ventTone: 380, ventSweep: 0.35,
    machine: 0.03, electrical: 0.06, structure: 0.60, water: 0.02,
    dripEvery: 46, knockEvery: 55, creakEvery: 26, tickEvery: 14, arcEvery: 600, impactEvery: 220,
    airDamp: 0.75, roomTone: 0.22, roomToneF: 120,
  },
  plant: {
    hum: 0.45, humRange: 34, vent: 0.70, ventTone: 260, ventSweep: 1.6,
    machine: 1.0, electrical: 0.75, structure: 0.40, water: 0.05,
    dripEvery: 26, knockEvery: 30, creakEvery: 60, tickEvery: 30, arcEvery: 45, impactEvery: 150,
    airDamp: 0.35, roomTone: 0.40, roomToneF: 58,
  },
  duct: {
    hum: 0.10, humRange: 8, vent: 1.0, ventTone: 900, ventSweep: 0.4,
    machine: 0.30, electrical: 0.08, structure: 0.70, water: 0.03,
    dripEvery: 30, knockEvery: 18, creakEvery: 20, tickEvery: 9, arcEvery: 500, impactEvery: 190,
    airDamp: 0.5, roomTone: 0.45, roomToneF: 214,
  },
  stack: {
    hum: 0.70, humRange: 30, vent: 0.28, ventTone: 540, ventSweep: 0.9,
    machine: 0.06, electrical: 0.14, structure: 0.30, water: 0,
    dripEvery: 55, knockEvery: 120, creakEvery: 80, tickEvery: 34, arcEvery: 300, impactEvery: 110,
    airDamp: 0.5, roomTone: 0.26, roomToneF: 96,
  },
  safe: {
    hum: 0.22, humRange: 10, vent: 0.14, ventTone: 420, ventSweep: 0.25,
    machine: 0.02, electrical: 0.05, structure: 0.25, water: 0,
    dripEvery: 90, knockEvery: 140, creakEvery: 90, tickEvery: 40, arcEvery: 900, impactEvery: 400,
    airDamp: 0.8, roomTone: 0.18, roomToneF: 165,
  },
};
ZONE_AMBIENCE.spine = ZONE_AMBIENCE.service;
ZONE_AMBIENCE.office = ZONE_AMBIENCE.safe;

/** Ballast whine centre frequency and hum weight per fixture type. */
const FIXTURE_AUDIO = {
  troffer: { whine: 9400, hum: 1.00, rasp: 0.22 },
  strip: { whine: 12600, hum: 1.15, rasp: 0.30 },
  bulkhead: { whine: 8200, hum: 0.50, rasp: 0.16 },
  highbay: { whine: 5600, hum: 0.35, rasp: 0.42 },
  pendant: { whine: 0, hum: 0.0, rasp: 0 },
  emergency: { whine: 15200, hum: 0.0, rasp: 0 },
};

const MAX_HUM_VOICES = 8;

// ---------------------------------------------------------------------------
// A Poisson-timed event source. Nothing in this game ticks on a fixed period.
// ---------------------------------------------------------------------------

class PoissonEvent {
  constructor(rng, mean, fn, { burst = 1, minGap = 0.05 } = {}) {
    this.rng = rng; this.mean = mean; this.fn = fn;
    this.minGap = minGap; this.burst = burst;
    this.t = poissonGap(rng, mean, minGap);
    this.enabled = true;
    this.scale = 1;
  }
  update(dt) {
    if (!this.enabled || this.mean <= 0 || this.scale <= 0) return;
    this.t -= dt * this.scale;
    if (this.t <= 0) {
      this.t = poissonGap(this.rng, this.mean, this.minGap);
      const n = this.burst > 1 ? 1 + Math.floor(this.rng() * this.burst) : 1;
      for (let i = 0; i < n; i++) this.fn(i);
    }
  }
}

// ---------------------------------------------------------------------------

export class Ambience {
  constructor({ engine, bus = null, rig = null, collision = null, seed = 4711 }) {
    this.engine = engine;
    this.bus = bus;
    this.rig = rig;
    this.collision = collision;
    this.rng = makeRng(seed);
    this.zone = 'intake';
    this.profile = ZONE_AMBIENCE.intake;
    this.enabled = true;
    this.ready = false;

    this.emitters = [];         // {kind, position, gain, radius, handle}
    this.humVoices = [];        // pooled fluorescent hums
    this._humTimer = 0;
    this._levelPrev = new WeakMap();
    this.playerPos = { x: 0, y: 1.6, z: 0 };
    this.machineProximity = 0;
    this._machineTarget = 0;
    this._layerGain = { hum: 1, vent: 1, water: 1, machine: 1, electrical: 1, structure: 1 };
    this._zoneMix = { ...this.profile };
    this.intensity = 1;         // Silence.js pulls this down

    this._registerDefs();
    this._buildSchedulers();
  }

  // -- sound definitions ----------------------------------------------------

  _registerDefs() {
    const E = this.engine;

    /**
     * THE SIGNATURE SOUND.
     *
     * Two mains oscillators a few cents apart give the slow beat you hear in a
     * real corridor; the harmonic-rich PeriodicWave gives the buzz. The ballast
     * whine sits an octave-and-a-half above anything else in the mix, which is
     * why it reads as "electrical" rather than "tonal".
     *
     * `set('level', v)` is called every frame from the fixture's live level, with
     * a 6 ms time constant — fast enough that a strobing tube audibly stutters,
     * slow enough that it never clicks.
     */
    E.register('amb.hum', {
      bus: 'ambience', gain: 0.34, send: 0.28, ref: 2.6, rolloff: 1.35, maxDist: 34,
      loop: true, dur: Infinity, maxVoices: MAX_HUM_VOICES + 2, priority: 1,
      build: ({ ctx, bag, out, t, opts }) => {
        const detune = opts.detune ?? 0;
        const whineF = opts.whine ?? 9400;
        const rasp = opts.rasp ?? 0.2;
        const wave = mainsWave(ctx);

        const level = gainNode(ctx, bag, 0.0001);
        level.connect(out);

        // -- mains buzz --------------------------------------------------
        const mix = gainNode(ctx, bag, 1);
        mix.connect(level);
        for (let i = 0; i < 2; i++) {
          const o = ctx.createOscillator();
          o.setPeriodicWave(wave);
          o.frequency.value = 100;
          o.detune.value = detune + (i ? 6.5 : -6.5);
          bag.src(o);
          const lp = biquad(ctx, bag, 'lowpass', 1350 + rasp * 2600, 0.8);
          const g = gainNode(ctx, bag, i ? 0.42 : 0.5);
          o.connect(lp); lp.connect(g); g.connect(mix);
          o.start(t + i * 0.003);
        }
        // A little saturation is what separates a fluorescent from a sine.
        const sat = shaper(ctx, bag, 0.28 + rasp * 0.4);
        const satIn = gainNode(ctx, bag, 0.8);
        mix.disconnect();
        mix.connect(satIn); satIn.connect(sat);
        const hp = biquad(ctx, bag, 'highpass', 72, 0.6);
        sat.connect(hp); hp.connect(level);

        // -- ballast whine ------------------------------------------------
        if (whineF > 0) {
          const w = ctx.createOscillator();
          w.type = 'triangle';
          w.frequency.value = whineF;
          bag.src(w);
          const wbp = biquad(ctx, bag, 'bandpass', whineF, 7);
          const wg = gainNode(ctx, bag, 0.0085 + rasp * 0.012);
          w.connect(wbp); wbp.connect(wg); wg.connect(level);
          // The whine drifts — a fixed 12 kHz tone reads as a broken speaker.
          const drift = ctx.createOscillator();
          drift.type = 'sine'; drift.frequency.value = 0.037 + Math.random() * 0.04;
          bag.src(drift);
          const dg = gainNode(ctx, bag, whineF * 0.028);
          drift.connect(dg); dg.connect(w.frequency);
          w.start(t); drift.start(t);

          // Broadband hiss from the tube itself, band-limited high.
          const n = noiseSource(ctx, bag, { type: 'white', rate: 1 });
          const nbp = biquad(ctx, bag, 'bandpass', whineF * 0.72, 1.6);
          const ng = gainNode(ctx, bag, 0.010 + rasp * 0.02);
          n.connect(nbp); nbp.connect(ng); ng.connect(level);
          n.start(t, Math.random() * 2);
        }

        // -- slow internal variation --------------------------------------
        const wobble = ctx.createOscillator();
        wobble.type = 'sine'; wobble.frequency.value = 0.0731 + Math.random() * 0.06;
        bag.src(wobble);
        const wobbleG = gainNode(ctx, bag, 0.09);
        wobble.connect(wobbleG); wobbleG.connect(mix.gain);
        wobble.start(t);

        glide(level.gain, 0.0001, t, 0.01);
        return {
          dur: Infinity,
          set: (key, value, time) => {
            const tt = time ?? ctx.currentTime;
            if (key === 'level') level.gain.setTargetAtTime(Math.max(0.00008, value), tt, 0.006);
            else if (key === 'detune') { /* handled at spawn */ }
          },
          stop: (tt, fade) => glide(level.gain, 0.00008, tt, Math.max(0.01, fade * 0.5)),
        };
      },
    });

    /** Starter crackle — a fluorescent striking, or failing to. */
    E.register('amb.strike', {
      bus: 'ambience', gain: 0.42, send: 0.35, ref: 2.4, maxDist: 26, dur: 0.5, maxVoices: 4,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        let end = t;
        const n = 3 + Math.floor(rng() * 7);
        let tt = t;
        for (let i = 0; i < n; i++) {
          end = Math.max(end, noiseBurst(ctx, bag, out, tt, {
            type: 'white', filter: 'bandpass', f0: 1600 + rng() * 5200, q: 2.2 + rng() * 4,
            attack: 0.0006, decay: 0.006 + rng() * 0.022,
            gain: (0.10 + rng() * 0.30) * vary.gain, pan: (rng() * 2 - 1) * 0.3,
          }));
          tt += poissonGap(rng, 0.022, 0.004, 0.12);
        }
        return end;
      }),
    });

    /** Ventilation bed. Non-positional; the grille version below is spatial. */
    E.register('amb.vent', {
      bus: 'ambience', gain: 0.30, send: 0.16, spatial: false, loop: true, dur: Infinity,
      build: ({ ctx, bag, out, t, opts }) => {
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 0.94 + Math.random() * 0.12 });
        const lp = biquad(ctx, bag, 'lowpass', opts.tone ?? 620, 0.7);
        const res = biquad(ctx, bag, 'peaking', 240, 3.2, 7);
        const res2 = biquad(ctx, bag, 'peaking', 470, 4.5, 5);
        const hp = biquad(ctx, bag, 'highpass', 42, 0.6);
        const g = gainNode(ctx, bag, 0.0001);
        n.connect(hp); hp.connect(lp); lp.connect(res); res.connect(res2); res2.connect(g);
        const wide = ctx.createStereoPanner(); bag.add(wide);
        g.connect(wide); wide.connect(out);

        // Three LFOs on irrational-ish ratios: the sweep never repeats.
        const lfo = (freq, depth, target, base) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
          bag.src(o);
          const og = gainNode(ctx, bag, depth);
          o.connect(og); og.connect(target);
          o.start(t + Math.random() * 2);
          return o;
        };
        lfo(0.0413, 130 * (opts.sweep ?? 1), res.frequency);
        lfo(0.0271, 190 * (opts.sweep ?? 1), res2.frequency);
        lfo(0.0117, (opts.tone ?? 620) * 0.28, lp.frequency);
        lfo(0.0089, 0.22, g.gain);
        lfo(0.0061, 0.35, wide.pan);

        n.start(t, Math.random() * 3);
        glide(g.gain, opts.level ?? 0.5, t, 2.5);
        return {
          dur: Infinity,
          set: (key, value, time) => {
            const tt = time ?? ctx.currentTime;
            if (key === 'level') glide(g.gain, Math.max(0.0001, value), tt, 1.2);
            else if (key === 'tone') glide(lp.frequency, clamp(value, 60, 16000), tt, 1.5);
          },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /** A grille or duct opening you can walk past. */
    E.register('amb.grille', {
      bus: 'ambience', gain: 0.36, send: 0.24, ref: 1.6, rolloff: 1.7, maxDist: 22,
      loop: true, dur: Infinity, maxVoices: 6,
      build: ({ ctx, bag, out, t, opts }) => {
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 1.15 + Math.random() * 0.2 });
        const bp = biquad(ctx, bag, 'bandpass', opts.tone ?? 900, 0.9);
        const notch = biquad(ctx, bag, 'notch', (opts.tone ?? 900) * 1.9, 3);
        const g = gainNode(ctx, bag, 0.0001);
        n.connect(bp); bp.connect(notch); notch.connect(g); g.connect(out);
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 0.0523;
        bag.src(o);
        const og = gainNode(ctx, bag, (opts.tone ?? 900) * 0.22);
        o.connect(og); og.connect(bp.frequency);
        o.start(t); n.start(t, Math.random() * 3);
        glide(g.gain, opts.level ?? 0.5, t, 1.5);
        return {
          dur: Infinity,
          set: (k, v, time) => { if (k === 'level') glide(g.gain, Math.max(0.0001, v), time ?? ctx.currentTime, 0.8); },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /** Room tone: the low, almost-inaudible pressure of a big empty volume. */
    E.register('amb.room', {
      bus: 'ambience', gain: 0.26, send: 0.1, spatial: false, loop: true, dur: Infinity,
      build: ({ ctx, bag, out, t, opts }) => {
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 0.7 });
        const lp = biquad(ctx, bag, 'lowpass', 180, 0.6);
        const pk = biquad(ctx, bag, 'peaking', opts.freq ?? 120, 6, 11);
        const g = gainNode(ctx, bag, 0.0001);
        n.connect(lp); lp.connect(pk); pk.connect(g); g.connect(out);
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 0.0197;
        bag.src(o);
        const og = gainNode(ctx, bag, 0.3);
        o.connect(og); og.connect(g.gain);
        o.start(t); n.start(t, Math.random() * 4);
        glide(g.gain, opts.level ?? 0.3, t, 3);
        return {
          dur: Infinity,
          set: (k, v, time) => {
            const tt = time ?? ctx.currentTime;
            if (k === 'level') glide(g.gain, Math.max(0.0001, v), tt, 2);
            else if (k === 'freq') glide(pk.frequency, clamp(v, 30, 800), tt, 2);
          },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /**
     * Drip. A real drip is a bubble entrained by the impact; its pitch RISES as
     * the bubble shrinks. That rise is the whole sound. `vessel` 0..1 selects
     * the imagined container: 0 = a deep steel drum, 1 = a shallow tile puddle.
     */
    E.register('drip', {
      bus: 'ambience', gain: 0.5, send: 0.85, ref: 3.0, rolloff: 1.0, maxDist: 30,
      dur: 0.8, maxVoices: 6,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const vessel = clamp01(opts.vessel ?? rng());
        const f0 = lerp(360, 2600, vessel * vessel) * vary.pitch * (0.85 + rng() * 0.3);
        const decay = lerp(0.24, 0.055, vessel) * (0.7 + rng() * 0.6);
        const rise = lerp(1.10, 1.34, rng());

        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f0, t);
        expTo(o.frequency, f0 * rise, t + decay);
        bag.src(o);
        const g = gainNode(ctx, bag, 0);
        o.connect(g); g.connect(out);
        const end = hit(g.gain, t, 0.55 * vary.gain, 0.0012, decay);
        o.start(t); o.stop(end + 0.02);

        // The impact itself: a very short, very bright tick.
        noiseBurst(ctx, bag, out, t, {
          type: 'white', filter: 'highpass', f0: 3200 + rng() * 3000, q: 0.6,
          attack: 0.0005, decay: 0.006 + rng() * 0.008, gain: 0.13 * vary.gain,
        });
        // Sometimes the vessel itself answers.
        let e2 = t;
        if (rng() < 0.35) {
          e2 = modalRing(ctx, bag, out, t + 0.002, {
            modes: [
              { f: f0 * 0.31, t60: 0.18 + rng() * 0.3, gain: 1 },
              { f: f0 * 0.52, t60: 0.10, gain: 0.4 },
            ],
            gain: 0.10 * vary.gain, excite: { dur: 0.002, tone: 2200 }, rng,
          });
        }
        return Math.max(end, e2);
      }, { pitch: 0.14, gain: 0.3, pan: 0.4 }),
    });

    /** Running water — a leak, a broken main, a tap left on. */
    E.register('amb.water.run', {
      bus: 'ambience', gain: 0.3, send: 0.5, ref: 2.4, rolloff: 1.4, maxDist: 24,
      loop: true, dur: Infinity, maxVoices: 4,
      build: ({ ctx, bag, out, t, opts }) => {
        const n = noiseSource(ctx, bag, { type: 'white', rate: 1 });
        const hp = biquad(ctx, bag, 'highpass', 420, 0.7);
        const bp = biquad(ctx, bag, 'bandpass', 1700, 0.8);
        const g = gainNode(ctx, bag, 0.0001);
        n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 0.29;
        bag.src(o);
        const og = gainNode(ctx, bag, 620);
        o.connect(og); og.connect(bp.frequency);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 0.071;
        bag.src(o2);
        const og2 = gainNode(ctx, bag, 0.28);
        o2.connect(og2); og2.connect(g.gain);
        o.start(t); o2.start(t); n.start(t, Math.random() * 2);
        glide(g.gain, opts.level ?? 0.4, t, 1.2);
        return {
          dur: Infinity,
          set: (k, v, time) => { if (k === 'level') glide(g.gain, Math.max(0.0001, v), time ?? ctx.currentTime, 0.8); },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /** The Cistern's standing water: a slow lap with irregular slop. */
    E.register('amb.water.lap', {
      bus: 'ambience', gain: 0.32, send: 0.6, spatial: false, loop: true, dur: Infinity,
      build: ({ ctx, bag, out, t, opts }) => {
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 0.6 });
        const lp = biquad(ctx, bag, 'lowpass', 520, 0.9);
        const hp = biquad(ctx, bag, 'highpass', 90, 0.7);
        const g = gainNode(ctx, bag, 0.0001);
        const pan = ctx.createStereoPanner(); bag.add(pan);
        n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(pan); pan.connect(out);
        // Two slow, incommensurate swells — water never breathes in time.
        for (const [f, d] of [[0.113, 0.45], [0.0729, 0.35], [0.0431, 0.25]]) {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          bag.src(o);
          const og = gainNode(ctx, bag, d);
          o.connect(og); og.connect(g.gain);
          o.start(t + Math.random());
        }
        const po = ctx.createOscillator(); po.type = 'sine'; po.frequency.value = 0.0233;
        bag.src(po);
        const pg = gainNode(ctx, bag, 0.55);
        po.connect(pg); pg.connect(pan.pan);
        po.start(t);
        n.start(t, Math.random() * 4);
        glide(g.gain, opts.level ?? 0.4, t, 3);
        return {
          dur: Infinity,
          set: (k, v, time) => { if (k === 'level') glide(g.gain, Math.max(0.0001, v), time ?? ctx.currentTime, 1.5); },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /**
     * The Plant. A big rotating machine two zones away. `proximity` 0..1 opens
     * the lowpass and lifts the level — getting louder IS the navigation cue,
     * so the curve has to be monotonic and obvious.
     */
    E.register('amb.machine', {
      bus: 'ambience', gain: 0.42, send: 0.30, spatial: false, loop: true, dur: Infinity,
      build: ({ ctx, bag, out, t, opts }) => {
        const wave = machineWave(ctx);
        const g = gainNode(ctx, bag, 0.0001);
        const lp = biquad(ctx, bag, 'lowpass', 180, 0.9);
        const hp = biquad(ctx, bag, 'highpass', 26, 0.6);
        lp.connect(hp); hp.connect(g); g.connect(out);

        // Two shafts running at slightly different speeds: the beat between
        // them is what makes a plant room sound alive rather than sampled.
        const base = 29.5;
        for (const [mult, gg] of [[1, 0.55], [1.0137, 0.4], [2.0, 0.16], [0.5, 0.22]]) {
          const o = ctx.createOscillator();
          o.setPeriodicWave(wave);
          o.frequency.value = base * mult;
          bag.src(o);
          const og = gainNode(ctx, bag, gg);
          o.connect(og); og.connect(lp);
          o.start(t);
          // Slow speed drift — machinery hunts.
          const d = ctx.createOscillator(); d.type = 'sine';
          d.frequency.value = 0.0173 + Math.random() * 0.02;
          bag.src(d);
          const dg = gainNode(ctx, bag, base * mult * 0.006);
          d.connect(dg); dg.connect(o.frequency);
          d.start(t);
        }
        // Airborne broadband from the casing.
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 1 });
        const nbp = biquad(ctx, bag, 'bandpass', 340, 1.1);
        const ng = gainNode(ctx, bag, 0.28);
        n.connect(nbp); nbp.connect(ng); ng.connect(lp);
        n.start(t, Math.random() * 3);

        let prox = clamp01(opts.proximity ?? 0.1);
        const apply = (p, tt, time = 1.4) => {
          prox = clamp01(p);
          glide(g.gain, lerp(0.05, 1.0, prox), tt, time);
          glide(lp.frequency, lerp(105, 900, prox * prox), tt, time);
        };
        apply(prox, t, 0.05);
        return {
          dur: Infinity,
          set: (k, v, time) => {
            const tt = time ?? ctx.currentTime;
            if (k === 'proximity') apply(v, tt);
            else if (k === 'level') glide(g.gain, Math.max(0.0001, v), tt, 1.2);
          },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /** Transformer / substation buzz. Odd-harmonic, gritty, 50 Hz-rooted. */
    E.register('amb.transformer', {
      bus: 'ambience', gain: 0.28, send: 0.35, ref: 2.2, rolloff: 1.6, maxDist: 26,
      loop: true, dur: Infinity, maxVoices: 4,
      build: ({ ctx, bag, out, t, opts }) => {
        const wave = transformerWave(ctx);
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = opts.freq ?? 100;
        bag.src(o);
        const o2 = ctx.createOscillator();
        o2.setPeriodicWave(wave);
        o2.frequency.value = (opts.freq ?? 100) * 0.5;
        o2.detune.value = 4;
        bag.src(o2);
        const sat = shaper(ctx, bag, 0.65);
        const lp = biquad(ctx, bag, 'lowpass', 2600, 0.7);
        const hp = biquad(ctx, bag, 'highpass', 78, 0.7);
        const g = gainNode(ctx, bag, 0.0001);
        const pre = gainNode(ctx, bag, 0.6);
        o.connect(pre); o2.connect(pre);
        pre.connect(sat); sat.connect(lp); lp.connect(hp); hp.connect(g); g.connect(out);
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.0311;
        bag.src(lfo);
        const lg = gainNode(ctx, bag, 0.22);
        lfo.connect(lg); lg.connect(g.gain);
        lfo.start(t); o.start(t); o2.start(t);
        glide(g.gain, opts.level ?? 0.4, t, 1.5);
        return {
          dur: Infinity,
          set: (k, v, time) => { if (k === 'level') glide(g.gain, Math.max(0.0001, v), time ?? ctx.currentTime, 1.0); },
          stop: (tt, fade) => glide(g.gain, 0.0001, tt, Math.max(0.05, fade)),
        };
      },
    });

    /** Arc crackle: a fault somewhere in the building, never in front of you. */
    E.register('elec.arc', {
      bus: 'ambience', gain: 0.4, send: 0.6, ref: 3.0, maxDist: 34, dur: 0.9, maxVoices: 3,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        let end = t, tt = t;
        const n = 4 + Math.floor(rng() * 12);
        for (let i = 0; i < n; i++) {
          end = Math.max(end, noiseBurst(ctx, bag, out, tt, {
            type: 'white', filter: 'bandpass', f0: 900 + rng() * 6500, q: 1.2 + rng() * 5,
            attack: 0.0004, decay: 0.004 + rng() * 0.03,
            gain: (0.08 + rng() * 0.34) * vary.gain, pan: (rng() * 2 - 1) * 0.5,
          }));
          tt += poissonGap(rng, 0.030, 0.003, 0.22);
        }
        return end;
      }),
    });

    /** Settling creak: a slow, quiet groan with a wandering resonance. */
    E.register('struct.creak', {
      bus: 'ambience', gain: 0.45, send: 0.8, ref: 4.0, rolloff: 0.8, maxDist: 45,
      dur: 2.6, maxVoices: 3, priority: 2,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        const dur = 0.5 + rng() * 1.4;
        const f0 = (70 + rng() * 180) * vary.pitch;
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 0.5 + rng() * 0.4 });
        const bp = biquad(ctx, bag, 'bandpass', f0, 14 + rng() * 12);
        const bp2 = biquad(ctx, bag, 'bandpass', f0 * (2.1 + rng() * 0.9), 9);
        const g = gainNode(ctx, bag, 0);
        const pan = panner2d(ctx, bag, vary.pan);
        n.connect(bp); bp.connect(bp2); bp2.connect(g); g.connect(pan); pan.connect(out);

        // A creak is stick-slip: the pitch walks up in uneven jumps.
        bp.frequency.setValueAtTime(f0, t);
        const steps = 5 + Math.floor(rng() * 7);
        for (let i = 1; i <= steps; i++) {
          expTo(bp.frequency, f0 * (1 + (i / steps) * (0.3 + rng() * 1.1)), t + dur * (i / steps));
        }
        env(g.gain, t, 0, [
          [dur * 0.15, 0.5 * vary.gain],
          [dur * 0.55, 0.30 * vary.gain],
          [dur * 0.8, 0.42 * vary.gain],
          [dur, 0],
        ]);
        n.start(t, rng() * 3);
        n.stop(t + dur + 0.05);
        return t + dur + 0.05;
      }),
    });

    /** Expansion tick: a single, tiny, unmotivated noise in a wall. */
    E.register('struct.tick', {
      bus: 'ambience', gain: 0.34, send: 0.7, ref: 3.2, maxDist: 30, dur: 0.5, maxVoices: 4,
      build: varied(({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
        modes: [
          { f: (380 + rng() * 900) * vary.pitch, t60: 0.02 + rng() * 0.06, gain: 1 },
          { f: (1400 + rng() * 2600) * vary.pitch, t60: 0.012, gain: 0.4 },
        ],
        gain: (0.14 + rng() * 0.22) * vary.gain,
        excite: { dur: 0.001, tone: 6000 }, spread: 0.4, rng,
      })),
    });

    /** Something very heavy, very far away, that you will not find. */
    E.register('struct.impact', {
      bus: 'ambience', gain: 0.55, send: 1.1, ref: 8, rolloff: 0.45, maxDist: 120,
      dur: 3.4, maxVoices: 2, priority: 3,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const f = (30 + rng() * 22) * vary.pitch;
        o.frequency.setValueAtTime(f * 1.8, t);
        expTo(o.frequency, f * 0.7, t + 0.5);
        bag.src(o);
        const g = gainNode(ctx, bag, 0);
        o.connect(g); g.connect(out);
        const end = hit(g.gain, t, 0.62 * vary.gain, 0.012, 0.7 + rng() * 0.9);
        o.start(t); o.stop(end + 0.05);
        // Distance means no highs at all. Only the body arrives.
        noiseBurst(ctx, bag, out, t, {
          type: 'brown', filter: 'lowpass', f0: 220 * vary.tone, q: 0.8,
          attack: 0.02, decay: 0.55, gain: 0.22 * vary.gain, curve: 'lin',
        });
        return end;
      }),
    });
  }

  // -- schedulers -----------------------------------------------------------

  _buildSchedulers() {
    const rng = this.rng;
    const p = () => this.profile;
    const on = () => this.enabled && this.engine.available && this.intensity > 0.05;

    const near = (minR, maxR, yLo = -0.4, yHi = 2.4) => {
      const a = rng() * Math.PI * 2;
      const r = lerp(minR, maxR, Math.sqrt(rng()));
      return {
        x: this.playerPos.x + Math.cos(a) * r,
        y: this.playerPos.y + lerp(yLo, yHi, rng()),
        z: this.playerPos.z + Math.sin(a) * r,
      };
    };
    this._near = near;

    this.events = {
      drip: new PoissonEvent(rng, 34, () => {
        if (!on()) return;
        const em = this._pickEmitter('drip');
        const pos = em ? em.position : near(2.5, 14);
        this.engine.playAt('drip', pos, {
          vessel: em?.vessel ?? rng(),
          gain: (em?.gain ?? 1) * lerp(0.35, 1, rng()),
        });
        // Drips cluster: a tap that drips once often drips twice.
        if (rng() < 0.22) {
          setTimeout(() => {
            if (on()) this.engine.playAt('drip', pos, { vessel: em?.vessel ?? rng(), gain: 0.5 });
          }, 220 + rng() * 700);
        }
      }, { minGap: 0.35 }),

      knock: new PoissonEvent(rng, 95, () => {
        if (!on()) return;
        this.engine.playAt('pipe.knock', near(4, 18, 0.2, 2.6), { gain: 0.5 + rng() * 0.6 });
      }, { minGap: 1.5 }),

      creak: new PoissonEvent(rng, 46, () => {
        if (!on()) return;
        this.engine.playAt('struct.creak', near(3, 16, -0.6, 3.0), { gain: 0.35 + rng() * 0.7 });
      }, { minGap: 3 }),

      tick: new PoissonEvent(rng, 22, () => {
        if (!on()) return;
        this.engine.playAt('struct.tick', near(1.5, 9, -0.5, 2.6), { gain: 0.4 + rng() * 0.7 });
      }, { minGap: 0.8, burst: 2 }),

      arc: new PoissonEvent(rng, 220, () => {
        if (!on()) return;
        this.engine.playAt('elec.arc', near(6, 24, 0.5, 3.0), { gain: 0.3 + rng() * 0.6 });
      }, { minGap: 8 }),

      impact: new PoissonEvent(rng, 260, () => {
        if (!on()) return;
        this.engine.playAt('struct.impact', near(22, 60, -3, 6), { gain: 0.4 + rng() * 0.7 });
      }, { minGap: 20 }),
    };
  }

  _pickEmitter(kind) {
    const list = this.emitters.filter((e) => e.kind === kind);
    if (!list.length) return null;
    // Prefer emitters near the player, but never deterministically the nearest.
    let best = null, bestW = -1;
    for (const e of list) {
      const d = Math.hypot(e.position.x - this.playerPos.x, e.position.z - this.playerPos.z);
      const w = (1 / (1 + d * 0.12)) * (0.4 + this.rng());
      if (w > bestW) { bestW = w; best = e; }
    }
    return best;
  }

  // -- lifecycle ------------------------------------------------------------

  /** Build the persistent beds. Safe to call once audio is live. */
  init() {
    if (this.ready || !this.engine.available) return this;
    const E = this.engine;
    this.beds = {
      vent: E.loop('amb.vent', { tone: this.profile.ventTone, sweep: this.profile.ventSweep, level: 0.0001 }),
      room: E.loop('amb.room', { freq: this.profile.roomToneF, level: 0.0001 }),
      machine: E.loop('amb.machine', { proximity: 0.05 }),
      water: E.loop('amb.water.lap', { level: 0.0001 }),
    };
    this.ready = true;
    this.setZone(this.zone, 0.05);
    return this;
  }

  /** Add a world-authored emitter. See docs/INTEGRATION_REQUESTS_AUDIO.md. */
  addEmitter(kind, position, opts = {}) {
    const e = {
      kind,
      position: { x: position.x ?? position[0], y: position.y ?? position[1], z: position.z ?? position[2] },
      gain: opts.gain ?? 1,
      radius: opts.radius ?? 18,
      vessel: opts.vessel,
      tone: opts.tone,
      handle: null,
      id: opts.id || `${kind}-${this.emitters.length}`,
    };
    this.emitters.push(e);
    return e;
  }

  removeEmitters(pred = () => true) {
    for (const e of this.emitters) {
      if (pred(e) && e.handle) { e.handle.stop(0.4); e.handle = null; }
    }
    this.emitters = this.emitters.filter((e) => !pred(e));
  }

  clearEmitters() { this.removeEmitters(); }

  // -- zone -----------------------------------------------------------------

  setZone(name, fade = 2.5) {
    const p = ZONE_AMBIENCE[name] || ZONE_AMBIENCE[this.zone] || ZONE_AMBIENCE.intake;
    this.zone = name;
    this.profile = p;
    // Event MEANS are per-zone, in seconds between occurrences: a drip roughly
    // every 4 s in the Cistern, every 90 s in the office. Actual gaps are
    // exponentially distributed around the mean, never regular.
    if (this.events) {
      this.events.drip.mean = p.dripEvery;
      this.events.knock.mean = p.knockEvery;
      this.events.creak.mean = p.creakEvery;
      this.events.tick.mean = p.tickEvery;
      this.events.arc.mean = p.arcEvery;
      this.events.impact.mean = p.impactEvery;
    }
    if (!this.ready) return this;
    const b = this.beds, I = this.intensity;
    b.vent?.setParam('tone', p.ventTone);
    b.vent?.setParam('level', p.vent * 0.55 * I);
    b.room?.setParam('freq', p.roomToneF);
    b.room?.setParam('level', p.roomTone * I);
    b.water?.setParam('level', p.water * 0.5 * I);
    this._machineTarget = Math.max(this._machineTarget, p.machine);
    this.engine.setParam('air', lerp(0.5, 1.6, 1 - p.airDamp), 1.5);
    return this;
  }

  /** Silence.js pulls this to 0 for a held breath, then back to 1. */
  setIntensity(v, time = 1.2) {
    this.intensity = clamp01(v);
    if (!this.ready) return this;
    const p = this.profile, I = this.intensity;
    this.beds.vent?.setParam('level', p.vent * 0.55 * I);
    this.beds.room?.setParam('level', p.roomTone * I);
    this.beds.water?.setParam('level', p.water * 0.5 * I);
    for (const e of this.emitters) if (e.handle) e.handle.setParam('level', (e.gain ?? 1) * 0.5 * I);
    return this;
  }

  /** 0..1 — how close the Plant is. Drives the navigational thrum. */
  setMachineProximity(v) { this._machineTarget = clamp01(v); return this; }

  // -- fluorescent hum ------------------------------------------------------

  _updateHum(dt) {
    const rig = this.rig;
    if (!rig || !this.engine.available) return;
    const p = this.playerPos;
    const range = this.profile.humRange || 20;

    this._humTimer -= dt;
    if (this._humTimer <= 0) {
      this._humTimer = 0.31;
      // Rank hum-capable fixtures by distance.
      const cands = [];
      for (const f of rig.fixtures) {
        const fa = FIXTURE_AUDIO[f.type];
        if (!fa || fa.hum <= 0) continue;
        const q = f.group.position;
        const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
        if (d > range) continue;
        cands.push({ f, d, fa });
      }
      cands.sort((a, b) => a.d - b.d);
      const want = cands.slice(0, MAX_HUM_VOICES);

      // Retire voices whose fixture dropped out, with hysteresis so a fixture
      // hovering at the range boundary does not chatter on and off.
      for (let i = this.humVoices.length - 1; i >= 0; i--) {
        const hv = this.humVoices[i];
        const still = want.find((w) => w.f === hv.fixture);
        const q = hv.fixture.group.position;
        const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
        if (!still && d > range * 1.25) {
          hv.handle.stop(0.5);
          this.humVoices.splice(i, 1);
        }
      }
      for (const w of want) {
        if (this.humVoices.length >= MAX_HUM_VOICES) break;
        if (this.humVoices.some((hv) => hv.fixture === w.f)) continue;
        const seedHash = hash2(Math.round(w.f.group.position.x * 7), Math.round(w.f.group.position.z * 7));
        const handle = this.engine.loopAt('amb.hum', w.f.group.position, {
          // +/- 26 cents per fixture: a corridor of tubes beats against itself.
          detune: (seedHash * 2 - 1) * 26,
          whine: w.fa.whine * (0.9 + seedHash * 0.22),
          rasp: w.fa.rasp * (w.f.health === 'dying' || w.f.health === 'buzz' ? 2.1 : 1),
          gain: w.fa.hum,
        });
        if (!handle || !handle.alive) continue;
        this.humVoices.push({ fixture: w.f, handle, weight: w.fa.hum, lastLevel: 0, strikeCool: 0 });
      }
    }

    // Per-frame: drive each hum from its fixture's live level. This is the line
    // that makes a dying tube sound the way it looks.
    const zoneHum = this.profile.hum * this.intensity;
    for (const hv of this.humVoices) {
      const f = hv.fixture;
      const lvl = f.level;
      // Hum does not scale linearly with light: a tube at 30% brightness still
      // buzzes hard, so bias the curve upward, then floor it at zero when dead.
      const audible = lvl > 0.004 ? Math.pow(clamp01(lvl), 0.45) : 0;
      hv.handle.setParam('level', audible * hv.weight * zoneHum * 0.9);

      hv.strikeCool -= dt;
      const d = lvl - hv.lastLevel;
      // A restrike: level jumping up hard from near-dark. Crackle on the way in.
      if (d > 0.34 && hv.lastLevel < 0.30 && hv.strikeCool <= 0) {
        hv.strikeCool = 0.22 + this.rng() * 0.5;
        this.engine.playAt('amb.strike', f.group.position, { gain: 0.4 + this.rng() * 0.6 });
      }
      hv.lastLevel = lvl;
    }
  }

  // -- emitters -------------------------------------------------------------

  _updateEmitters() {
    const p = this.playerPos;
    for (const e of this.emitters) {
      if (e.kind === 'drip') continue;              // event-driven, not a loop
      const d = Math.hypot(e.position.x - p.x, e.position.y - p.y, e.position.z - p.z);
      const inRange = d < e.radius;
      if (inRange && !e.handle) {
        const name = e.kind === 'vent' ? 'amb.grille'
          : e.kind === 'water' ? 'amb.water.run'
            : e.kind === 'transformer' ? 'amb.transformer' : null;
        if (!name) continue;
        e.handle = this.engine.loopAt(name, e.position, {
          level: e.gain * 0.5 * this.intensity,
          tone: e.tone ?? (e.kind === 'vent' ? 900 : undefined),
          freq: e.freq,
        });
      } else if (!inRange && e.handle && d > e.radius * 1.3) {
        e.handle.stop(0.8);
        e.handle = null;
      }
    }
  }

  // -- frame ----------------------------------------------------------------

  update(dt, playerPos) {
    if (!this.engine.available) return;
    if (playerPos) {
      this.playerPos.x = playerPos.x ?? playerPos[0] ?? 0;
      this.playerPos.y = playerPos.y ?? playerPos[1] ?? 1.6;
      this.playerPos.z = playerPos.z ?? playerPos[2] ?? 0;
    }
    if (!this.ready) return;

    this._updateHum(dt);
    this._updateEmitters();

    this.machineProximity = damp(this.machineProximity, this._machineTarget, 0.55, dt);
    this.beds.machine?.setParam('proximity', this.machineProximity * this.intensity);

    if (this.enabled) for (const k in this.events) this.events[k].update(dt);
  }

  /** Stop everything with a fade. Used on death, endings and teardown. */
  silence(fade = 1.0) {
    for (const hv of this.humVoices) hv.handle.stop(fade);
    this.humVoices.length = 0;
    for (const k in this.beds || {}) this.beds[k]?.stop(fade);
    for (const e of this.emitters) { if (e.handle) { e.handle.stop(fade); e.handle = null; } }
    this.ready = false;
  }
}

export default Ambience;
