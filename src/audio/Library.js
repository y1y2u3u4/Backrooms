/**
 * Library.js — the world's one-shots.
 *
 * Props, doors, switches, pickups and UI. Every definition is a build function
 * over the Synth toolkit; every one is wrapped in `varied()` so that two
 * triggers of the same name differ in pitch, filter, envelope and stereo
 * placement. If a sound in this file ever repeats identically, that is a bug and
 * the QA probe will catch it (`tools/qa/audio-probe.mjs`, "differs" column).
 *
 * Level policy, roughly:
 *   ambience beds   -30 .. -22 dBFS
 *   footsteps       -18 .. -12
 *   world props     -16 .. -8
 *   the Surveyor    -10 .. -3      (cuts through everything)
 */

import { clamp, clamp01, lerp } from '../core/util.js';
import {
  modalRing, noiseBurst, noiseSource, biquad, gainNode, hit, ar, env, expTo,
  varied, renderKarplus, fmVoice, shaper, panner2d, poissonGap, jit, glide,
} from './Synth.js';

// --- shared material mode sets ---------------------------------------------

const MODES = {
  steelPlate: [
    { f: 214, t60: 1.5, gain: 1.0 }, { f: 371, t60: 1.1, gain: 0.72 },
    { f: 559, t60: 0.85, gain: 0.55 }, { f: 812, t60: 0.6, gain: 0.42 },
    { f: 1103, t60: 0.44, gain: 0.30 }, { f: 1497, t60: 0.30, gain: 0.22 },
    { f: 2211, t60: 0.19, gain: 0.14 },
  ],
  castPipe: [
    { f: 96, t60: 0.42, gain: 1.0 }, { f: 258, t60: 0.30, gain: 0.62 },
    { f: 431, t60: 0.22, gain: 0.40 }, { f: 688, t60: 0.15, gain: 0.26 },
    { f: 1044, t60: 0.10, gain: 0.16 },
  ],
  thinSteel: [
    { f: 640, t60: 0.55, gain: 1.0 }, { f: 1180, t60: 0.38, gain: 0.66 },
    { f: 1847, t60: 0.26, gain: 0.44 }, { f: 2690, t60: 0.17, gain: 0.28 },
    { f: 3910, t60: 0.11, gain: 0.16 },
  ],
  ductPanel: [
    { f: 74, t60: 0.30, gain: 1.0 }, { f: 129, t60: 0.24, gain: 0.80 },
    { f: 211, t60: 0.18, gain: 0.50 }, { f: 348, t60: 0.12, gain: 0.30 },
    { f: 512, t60: 0.08, gain: 0.18 },
  ],
  woodDoor: [
    { f: 88, t60: 0.20, gain: 1.0 }, { f: 152, t60: 0.15, gain: 0.60 },
    { f: 267, t60: 0.10, gain: 0.34 }, { f: 418, t60: 0.07, gain: 0.20 },
  ],
  glassPane: [
    { f: 1420, t60: 0.9, gain: 1.0 }, { f: 2611, t60: 0.6, gain: 0.62 },
    { f: 3877, t60: 0.4, gain: 0.40 }, { f: 5310, t60: 0.25, gain: 0.24 },
  ],
  ceramic: [
    { f: 2210, t60: 0.5, gain: 1.0 }, { f: 3640, t60: 0.34, gain: 0.55 },
    { f: 5180, t60: 0.2, gain: 0.30 },
  ],
  concreteSlab: [
    { f: 58, t60: 0.16, gain: 1.0 }, { f: 121, t60: 0.10, gain: 0.5 },
    { f: 246, t60: 0.06, gain: 0.24 },
  ],
};

/** Scale a mode set's frequencies and decays, returning a fresh array. */
export function tuned(modes, pitch = 1, damp = 1, rng = null, drift = 0) {
  return modes.map((m) => ({
    f: m.f * pitch * (drift && rng ? 1 + (rng() * 2 - 1) * drift : 1),
    t60: m.t60 * damp,
    gain: m.gain * (rng ? 0.8 + rng() * 0.4 : 1),
  }));
}

/**
 * Ratchet: a burst of N clicks with an accelerating or decelerating rate.
 * Tape measures, cable reels, door mechanisms and the Surveyor's measuring
 * pose are all this function with different numbers.
 */
export function ratchet(ctx, bag, out, t, {
  count = 14, rate0 = 46, rate1 = 12, pitch = 1, gain = 0.5, jitter = 0.22,
  modes = MODES.thinSteel, damp = 0.16, rng = Math.random, spread = 0.3,
} = {}) {
  let time = t, end = t;
  for (let i = 0; i < count; i++) {
    const u = count > 1 ? i / (count - 1) : 0;
    const rate = lerp(rate0, rate1, u * u);
    const g = gain * (0.55 + 0.45 * (1 - u)) * (0.7 + rng() * 0.6);
    const e = modalRing(ctx, bag, out, time, {
      modes: tuned(modes, pitch * (0.94 + rng() * 0.14), damp, rng, 0.02),
      gain: g,
      excite: { dur: 0.0016, type: 'white', tone: 7200, gain: 0.9 },
      spread: spread * rng(), rng,
    });
    end = Math.max(end, e);
    time += (1 / rate) * (1 + (rng() * 2 - 1) * jitter);
  }
  return end;
}

/** A short scrape: filtered noise with a wandering resonance. */
export function scrape(ctx, bag, out, t, {
  dur = 0.45, f0 = 420, f1 = 900, q = 6, gain = 0.4, type = 'white',
  rough = 12, rng = Math.random,
} = {}) {
  const n = noiseSource(ctx, bag, { type, rate: 0.8 + rng() * 0.5 });
  const bp = biquad(ctx, bag, 'bandpass', f0, q);
  const hp = biquad(ctx, bag, 'highpass', 180, 0.7);
  const g = gainNode(ctx, bag, 0);
  n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);

  // The resonance wanders — a scrape that holds one pitch sounds like a filter.
  bp.frequency.setValueAtTime(f0, t);
  const steps = Math.max(2, Math.round(dur * rough));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    expTo(bp.frequency, lerp(f0, f1, u) * (0.8 + rng() * 0.45), t + dur * u);
  }
  env(g.gain, t, 0, [
    [0.012, gain],
    [dur * 0.4, gain * (0.6 + rng() * 0.5)],
    [dur * 0.75, gain * (0.4 + rng() * 0.4)],
    [dur, 0],
  ]);
  try { n.start(t, rng() * 2); } catch { n.start(t); }
  n.stop(t + dur + 0.05);
  return t + dur + 0.02;
}

/** Low-frequency body thud — impacts, doors closing, distant collapse. */
export function thud(ctx, bag, out, t, {
  f = 62, decay = 0.22, gain = 0.6, click = 0.3, rng = Math.random,
} = {}) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f * 2.2, t);
  expTo(osc.frequency, f * 0.72, t + decay * 0.7);
  bag.src(osc);
  const g = gainNode(ctx, bag, 0);
  osc.connect(g); g.connect(out);
  const end = hit(g.gain, t, gain, 0.004, decay);
  osc.start(t); osc.stop(end + 0.02);
  if (click > 0) {
    noiseBurst(ctx, bag, out, t, {
      type: 'white', filter: 'lowpass', f0: 1800 * (0.7 + rng() * 0.6), q: 0.7,
      attack: 0.0012, decay: 0.028, gain: click,
    });
  }
  return end;
}

// ---------------------------------------------------------------------------

export function registerLibrary(engine) {
  const R = (name, def) => engine.register(name, { ...def, build: varied(def.build, def.vary) });

  // --- doors ---------------------------------------------------------------

  R('door.handle', {
    bus: 'world', gain: 0.5, send: 0.30, ref: 2.0, dur: 0.5,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = ratchet(ctx, bag, out, t, {
        count: 3, rate0: 26, rate1: 16, pitch: 1.15 * vary.pitch, gain: 0.42 * vary.gain,
        modes: MODES.thinSteel, damp: 0.10, rng, spread: 0.2,
      });
      const b = modalRing(ctx, bag, out, t + 0.09, {
        modes: tuned(MODES.thinSteel, 0.72 * vary.pitch, 0.35, rng, 0.02),
        gain: 0.3 * vary.gain, excite: { dur: 0.004, tone: 4200 }, rng,
      });
      return Math.max(a, b);
    },
  });

  R('door.open', {
    bus: 'world', gain: 0.62, send: 0.36, ref: 2.4, dur: 1.6, priority: 2,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      // Latch withdraws, hinge complains, leaf swings past the frame.
      const a = modalRing(ctx, bag, out, t, {
        modes: tuned(MODES.thinSteel, 1.3 * vary.pitch, 0.16, rng, 0.03),
        gain: 0.32 * vary.gain, excite: { dur: 0.003, tone: 6000 }, rng,
      });
      // Hinge: a slow squeal, only sometimes, and never the same shape twice.
      let b = t;
      if (rng() < 0.65) {
        const f0 = 380 + rng() * 620;
        b = scrape(ctx, bag, out, t + 0.05 + rng() * 0.06, {
          dur: 0.35 + rng() * 0.5, f0, f1: f0 * (1.4 + rng()), q: 11 + rng() * 9,
          gain: 0.09 + rng() * 0.13, rough: 9, rng,
        });
      }
      const c = noiseBurst(ctx, bag, out, t + 0.12, {
        type: 'brown', filter: 'lowpass', f0: 620 * vary.tone, q: 0.6,
        attack: 0.09, decay: 0.5, gain: 0.16 * vary.gain, curve: 'lin',
      });
      const d = thud(ctx, bag, out, t + 0.42 + rng() * 0.3, {
        f: 74 * vary.pitch, decay: 0.16, gain: 0.18 * vary.gain, click: 0.06, rng,
      });
      return Math.max(a, b, c, d);
    },
  });

  R('door.close', {
    bus: 'world', gain: 0.72, send: 0.40, ref: 2.4, dur: 1.4, priority: 2,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const swing = noiseBurst(ctx, bag, out, t, {
        type: 'brown', filter: 'lowpass', f0: 500, q: 0.6,
        attack: 0.11, decay: 0.20, gain: 0.14 * vary.gain, curve: 'lin',
      });
      const tImp = t + 0.20;
      const a = thud(ctx, bag, out, tImp, {
        f: 68 * vary.pitch, decay: 0.30, gain: 0.72 * vary.gain, click: 0.34, rng,
      });
      const b = modalRing(ctx, bag, out, tImp, {
        modes: tuned(MODES.woodDoor, vary.pitch, 1, rng, 0.03),
        gain: 0.5 * vary.gain, excite: { dur: 0.006, tone: 2400 }, rng,
      });
      // Latch snaps home a few ms after the leaf lands. That gap is the sound.
      const c = modalRing(ctx, bag, out, tImp + 0.022 + rng() * 0.014, {
        modes: tuned(MODES.thinSteel, 1.5 * vary.pitch, 0.12, rng, 0.03),
        gain: 0.30 * vary.gain, excite: { dur: 0.0016, tone: 8000 }, rng,
      });
      return Math.max(swing, a, b, c);
    },
  });

  R('door.latch', {
    bus: 'world', gain: 0.5, send: 0.28, ref: 1.8, dur: 0.4,
    build: ({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
      modes: tuned(MODES.thinSteel, 1.55 * vary.pitch, 0.13, rng, 0.03),
      gain: 0.55 * vary.gain, excite: { dur: 0.0014, tone: 8600 }, rng, spread: 0.15,
    }),
  });

  R('door.locked', {
    bus: 'world', gain: 0.6, send: 0.34, ref: 2.0, dur: 0.9, priority: 2,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      // Two failed pulls. The second is always harder than the first.
      let end = t;
      for (let i = 0; i < 2; i++) {
        const tt = t + i * (0.16 + rng() * 0.07);
        end = Math.max(end, modalRing(ctx, bag, out, tt, {
          modes: tuned(MODES.thinSteel, (1.2 + i * 0.06) * vary.pitch, 0.14, rng, 0.03),
          gain: (0.42 + i * 0.16) * vary.gain, excite: { dur: 0.003, tone: 5200 }, rng,
        }));
        end = Math.max(end, thud(ctx, bag, out, tt + 0.004, {
          f: 90, decay: 0.09, gain: (0.20 + i * 0.1) * vary.gain, click: 0.1, rng,
        }));
      }
      return end;
    },
  });

  R('door.heavy', {
    bus: 'world', gain: 0.85, send: 0.46, ref: 3.0, dur: 2.6, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const s = scrape(ctx, bag, out, t, {
        dur: 0.9 + rng() * 0.5, f0: 120, f1: 300, q: 4, gain: 0.20 * vary.gain, type: 'brown', rough: 14, rng,
      });
      const a = thud(ctx, bag, out, t + 1.0 + rng() * 0.3, {
        f: 44 * vary.pitch, decay: 0.55, gain: 0.85 * vary.gain, click: 0.4, rng,
      });
      const b = modalRing(ctx, bag, out, t + 1.0, {
        modes: tuned(MODES.steelPlate, 0.55 * vary.pitch, 0.8, rng, 0.04),
        gain: 0.34 * vary.gain, excite: { dur: 0.01, tone: 1600 }, rng, spread: 0.35,
      });
      return Math.max(s, a, b);
    },
  });

  R('hatch.open', {
    bus: 'world', gain: 0.7, send: 0.42, ref: 2.6, dur: 1.8,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = scrape(ctx, bag, out, t, {
        dur: 0.55, f0: 900, f1: 380, q: 9, gain: 0.22 * vary.gain, rng,
      });
      const b = modalRing(ctx, bag, out, t + 0.5, {
        modes: tuned(MODES.steelPlate, 0.8 * vary.pitch, 0.9, rng, 0.05),
        gain: 0.44 * vary.gain, excite: { dur: 0.005, tone: 3400 }, rng, spread: 0.4,
      });
      return Math.max(a, b);
    },
  });

  // --- mechanisms ----------------------------------------------------------

  R('valve.turn', {
    bus: 'world', gain: 0.55, send: 0.32, ref: 2.0, dur: 1.9, priority: 2,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = ratchet(ctx, bag, out, t, {
        count: 9 + Math.floor(rng() * 5), rate0: 11, rate1: 6, pitch: 0.8 * vary.pitch,
        gain: 0.34 * vary.gain, modes: MODES.castPipe, damp: 0.5, jitter: 0.3, rng,
      });
      const b = scrape(ctx, bag, out, t, {
        dur: 1.1, f0: 230, f1: 190, q: 7, gain: 0.11 * vary.gain, type: 'pink', rough: 7, rng,
      });
      return Math.max(a, b);
    },
  });

  R('relay.click', {
    bus: 'world', gain: 0.42, send: 0.22, ref: 1.6, dur: 0.35,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = modalRing(ctx, bag, out, t, {
        modes: [
          { f: 1750 * vary.pitch, t60: 0.028, gain: 1 },
          { f: 3120 * vary.pitch, t60: 0.018, gain: 0.6 },
          { f: 5400 * vary.pitch, t60: 0.010, gain: 0.3 },
          { f: 420 * vary.pitch, t60: 0.05, gain: 0.5 },
        ],
        gain: 0.6 * vary.gain, excite: { dur: 0.0009, tone: 9000 }, rng,
      });
      // Armature bounce — a relay never closes cleanly.
      const b = rng() < 0.7 ? modalRing(ctx, bag, out, t + 0.006 + rng() * 0.005, {
        modes: [{ f: 1750 * vary.pitch * 1.02, t60: 0.014, gain: 1 }],
        gain: 0.22 * vary.gain, excite: { dur: 0.0006, tone: 9000 }, rng,
      }) : t;
      return Math.max(a, b);
    },
  });

  R('switch.click', {
    bus: 'world', gain: 0.4, send: 0.18, ref: 1.4, dur: 0.3,
    build: ({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
      modes: [
        { f: 2450 * vary.pitch, t60: 0.020, gain: 1 },
        { f: 890 * vary.pitch, t60: 0.030, gain: 0.7 },
        { f: 5900 * vary.pitch, t60: 0.008, gain: 0.35 },
      ],
      gain: 0.5 * vary.gain, excite: { dur: 0.0011, tone: 8000, type: 'white' }, rng,
    }),
  });

  R('breaker.throw', {
    bus: 'world', gain: 0.8, send: 0.38, ref: 2.2, dur: 1.0, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = modalRing(ctx, bag, out, t, {
        modes: [
          { f: 148 * vary.pitch, t60: 0.20, gain: 1 },
          { f: 610 * vary.pitch, t60: 0.09, gain: 0.55 },
          { f: 1830 * vary.pitch, t60: 0.045, gain: 0.4 },
          { f: 3410 * vary.pitch, t60: 0.02, gain: 0.25 },
        ],
        gain: 0.85 * vary.gain, excite: { dur: 0.0026, tone: 6400 }, rng,
      });
      const b = thud(ctx, bag, out, t, { f: 84, decay: 0.16, gain: 0.34, click: 0.2, rng });
      // A big contactor pulls in with a moment of arc.
      const c = noiseBurst(ctx, bag, out, t + 0.004, {
        type: 'white', filter: 'highpass', f0: 3800, q: 0.6,
        attack: 0.0008, decay: 0.035, gain: 0.18 * vary.gain,
      });
      return Math.max(a, b, c);
    },
  });

  R('lift.call', {
    bus: 'world', gain: 0.5, send: 0.3, ref: 3, dur: 1.4,
    build: ({ ctx, bag, out, t, rng, vary }) => fmVoice(ctx, bag, out, t, {
      carrier: 523 * vary.pitch, ratio: 2.01, index: 260, attack: 0.004,
      decay: 0.9, gain: 0.4 * vary.gain, modDecay: 0.14,
    }),
  });

  R('lift.arrive', {
    bus: 'world', gain: 0.8, send: 0.5, ref: 4, dur: 3.2, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = thud(ctx, bag, out, t, { f: 38, decay: 0.9, gain: 0.7 * vary.gain, click: 0.15, rng });
      const b = modalRing(ctx, bag, out, t + 0.02, {
        modes: tuned(MODES.steelPlate, 0.42 * vary.pitch, 1.6, rng, 0.05),
        gain: 0.4 * vary.gain, excite: { dur: 0.014, tone: 900 }, rng, spread: 0.5,
      });
      const c = scrape(ctx, bag, out, t + 0.5, {
        dur: 1.3, f0: 340, f1: 210, q: 5, gain: 0.14 * vary.gain, type: 'brown', rough: 9, rng,
      });
      return Math.max(a, b, c);
    },
  });

  // --- pickups and paper ---------------------------------------------------

  R('pickup.item', {
    bus: 'player', gain: 0.5, send: 0.2, spatial: false, dur: 0.7,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = noiseBurst(ctx, bag, out, t, {
        type: 'white', filter: 'bandpass', f0: 2400 * vary.tone, f1: 1200, q: 1.1,
        attack: 0.004, decay: 0.10, gain: 0.22 * vary.gain, pan: vary.pan * 0.4,
      });
      const b = modalRing(ctx, bag, out, t + 0.02, {
        modes: tuned(MODES.thinSteel, 0.9 * vary.pitch, 0.28, rng, 0.03),
        gain: 0.22 * vary.gain, excite: { dur: 0.003, tone: 4000 }, rng,
      });
      return Math.max(a, b);
    },
  });

  R('pickup.core', {
    bus: 'player', gain: 0.7, send: 0.35, spatial: false, dur: 3.0, priority: 4,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      // A fuse core is ceramic and heavy. It rings, and it should feel earned.
      const a = modalRing(ctx, bag, out, t, {
        modes: tuned(MODES.ceramic, 0.62 * vary.pitch, 1.7, rng, 0.01),
        gain: 0.34 * vary.gain, excite: { dur: 0.004, tone: 5200 }, rng, spread: 0.3,
      });
      const b = modalRing(ctx, bag, out, t + 0.005, {
        modes: [
          { f: 138 * vary.pitch, t60: 2.6, gain: 1 },
          { f: 207 * vary.pitch, t60: 2.0, gain: 0.5 },
          { f: 276 * vary.pitch, t60: 1.5, gain: 0.3 },
        ],
        gain: 0.26 * vary.gain, excite: { dur: 0.02, tone: 700 }, rng,
      });
      return Math.max(a, b);
    },
  });

  R('paper.take', {
    bus: 'player', gain: 0.45, send: 0.18, spatial: false, dur: 0.8,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      // Three overlapping crackles at irregular offsets: paper is not one event.
      let end = t;
      for (let i = 0; i < 3; i++) {
        end = Math.max(end, noiseBurst(ctx, bag, out, t + rng() * 0.16, {
          type: 'white', filter: 'highpass', f0: 2600 + rng() * 3200, q: 0.5,
          attack: 0.006 + rng() * 0.02, decay: 0.09 + rng() * 0.11,
          gain: (0.10 + rng() * 0.10) * vary.gain, pan: (rng() * 2 - 1) * 0.35,
        }));
      }
      return end;
    },
  });

  R('paper.rustle', {
    bus: 'ambience', gain: 0.3, send: 0.4, ref: 2.5, dur: 1.6,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      let end = t;
      const n = 4 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        end = Math.max(end, noiseBurst(ctx, bag, out, t + rng() * 0.9, {
          type: 'white', filter: 'bandpass', f0: 2200 + rng() * 4000, q: 0.9,
          attack: 0.01, decay: 0.06 + rng() * 0.14, gain: (0.05 + rng() * 0.08) * vary.gain,
        }));
      }
      return end;
    },
  });

  // --- impacts and debris --------------------------------------------------

  R('impact.soft', {
    bus: 'world', gain: 0.55, send: 0.32, ref: 2.2, dur: 0.8,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = thud(ctx, bag, out, t, { f: 78 * vary.pitch, decay: 0.16, gain: 0.5 * vary.gain, click: 0.1, rng });
      const b = noiseBurst(ctx, bag, out, t, {
        type: 'brown', filter: 'lowpass', f0: 900 * vary.tone, q: 0.7,
        attack: 0.002, decay: 0.08, gain: 0.2 * vary.gain,
      });
      return Math.max(a, b);
    },
  });

  R('impact.hard', {
    bus: 'world', gain: 0.8, send: 0.42, ref: 2.6, dur: 1.6, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = thud(ctx, bag, out, t, { f: 52 * vary.pitch, decay: 0.34, gain: 0.8 * vary.gain, click: 0.42, rng });
      const b = modalRing(ctx, bag, out, t, {
        modes: tuned(MODES.concreteSlab, vary.pitch, 1, rng, 0.05),
        gain: 0.5 * vary.gain, excite: { dur: 0.005, tone: 2600 }, rng,
      });
      return Math.max(a, b);
    },
  });

  R('debris.small', {
    bus: 'world', gain: 0.4, send: 0.36, ref: 2.0, dur: 1.4,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      let end = t;
      const n = 3 + Math.floor(rng() * 5);
      let tt = t;
      for (let i = 0; i < n; i++) {
        end = Math.max(end, modalRing(ctx, bag, out, tt, {
          modes: tuned(MODES.ceramic, (0.5 + rng() * 1.4) * vary.pitch, 0.10, rng, 0.06),
          gain: (0.12 + rng() * 0.16) * vary.gain,
          excite: { dur: 0.002, tone: 6000 }, spread: 0.5, rng,
        }));
        tt += poissonGap(rng, 0.09, 0.02, 0.4);
      }
      return end;
    },
  });

  R('glass.crack', {
    bus: 'world', gain: 0.6, send: 0.4, ref: 2.2, dur: 1.8, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = noiseBurst(ctx, bag, out, t, {
        type: 'white', filter: 'highpass', f0: 4200, q: 0.6,
        attack: 0.0008, decay: 0.045, gain: 0.3 * vary.gain,
      });
      const b = modalRing(ctx, bag, out, t, {
        modes: tuned(MODES.glassPane, vary.pitch, 1, rng, 0.04),
        gain: 0.34 * vary.gain, excite: { dur: 0.0016, tone: 9000 }, spread: 0.4, rng,
      });
      return Math.max(a, b);
    },
  });

  R('metal.clang', {
    bus: 'world', gain: 0.7, send: 0.5, ref: 2.6, dur: 2.6, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
      modes: tuned(MODES.steelPlate, vary.pitch, 1, rng, 0.04),
      gain: 0.7 * vary.gain, excite: { dur: 0.004, tone: 5200, gain: 1.1 },
      spread: 0.45, rng,
    }),
  });

  R('pipe.knock', {
    bus: 'ambience', gain: 0.55, send: 0.65, ref: 3.2, rolloff: 0.85, dur: 1.2,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      // Plumbing knocks come in twos and threes, never singly.
      let end = t, tt = t;
      const n = 1 + (rng() < 0.55 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        end = Math.max(end, modalRing(ctx, bag, out, tt, {
          modes: tuned(MODES.castPipe, (0.85 + rng() * 0.4) * vary.pitch, 1, rng, 0.03),
          gain: (0.5 - i * 0.12) * vary.gain, excite: { dur: 0.003, tone: 2200 }, rng,
        }));
        tt += 0.09 + rng() * 0.19;
      }
      return end;
    },
  });

  R('cable.twang', {
    bus: 'world', gain: 0.45, send: 0.5, ref: 2.4, dur: 2.4,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      // Karplus-Strong rendered fresh: a cable is never plucked the same way.
      const freq = clamp(56 * vary.pitch * (0.7 + rng() * 0.9), 28, 400);
      const buf = renderKarplus(ctx, {
        freq, seconds: 2.0, decay: 0.9955 + rng() * 0.003,
        brightness: 0.25 + rng() * 0.4, seed: (rng() * 1e9) >>> 0,
        pluckWidth: 0.5 + rng() * 0.5, noiseTone: 0.3 + rng() * 0.4,
      });
      const src = ctx.createBufferSource();
      src.buffer = buf;
      bag.src(src);
      const lp = biquad(ctx, bag, 'lowpass', 2600 * vary.tone, 0.8);
      const g = gainNode(ctx, bag, 0.5 * vary.gain);
      const p = panner2d(ctx, bag, vary.pan);
      src.connect(lp); lp.connect(g); g.connect(p); p.connect(out);
      src.start(t); src.stop(t + 2.1);
      return t + 2.1;
    },
  });

  R('locker.click', {
    bus: 'ambience', gain: 0.4, send: 0.5, ref: 3.0, dur: 1.0,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = modalRing(ctx, bag, out, t, {
        modes: tuned(MODES.thinSteel, 1.1 * vary.pitch, 0.5, rng, 0.03),
        gain: 0.3 * vary.gain, excite: { dur: 0.002, tone: 6000 }, rng,
      });
      const b = modalRing(ctx, bag, out, t + 0.03 + rng() * 0.02, {
        modes: tuned(MODES.ductPanel, 1.6 * vary.pitch, 0.6, rng, 0.04),
        gain: 0.22 * vary.gain, excite: { dur: 0.004, tone: 1800 }, rng,
      });
      return Math.max(a, b);
    },
  });

  R('chair.scrape', {
    bus: 'ambience', gain: 0.5, send: 0.55, ref: 3.2, dur: 1.6, priority: 3,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = scrape(ctx, bag, out, t, {
        dur: 0.35 + rng() * 0.45, f0: 260 + rng() * 200, f1: 520 + rng() * 400,
        q: 8, gain: 0.30 * vary.gain, type: 'pink', rough: 16, rng,
      });
      const b = modalRing(ctx, bag, out, t + 0.02, {
        modes: tuned(MODES.woodDoor, 1.8 * vary.pitch, 0.6, rng, 0.05),
        gain: 0.16 * vary.gain, excite: { dur: 0.006, tone: 1600 }, rng,
      });
      return Math.max(a, b);
    },
  });

  R('flashlight.click', {
    bus: 'player', gain: 0.42, send: 0.1, spatial: false, dur: 0.25,
    build: ({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
      modes: [
        { f: 3100 * vary.pitch, t60: 0.012, gain: 1 },
        { f: 1240 * vary.pitch, t60: 0.020, gain: 0.7 },
        { f: 620 * vary.pitch, t60: 0.026, gain: 0.4 },
      ],
      gain: 0.55 * vary.gain, excite: { dur: 0.0008, tone: 9500 }, rng,
    }),
  });

  R('flashlight.rattle', {
    bus: 'player', gain: 0.3, send: 0.14, spatial: false, dur: 0.6,
    build: ({ ctx, bag, out, t, rng, vary }) => ratchet(ctx, bag, out, t, {
      count: 2 + Math.floor(rng() * 3), rate0: 30, rate1: 22, pitch: 2.2 * vary.pitch,
      gain: 0.16 * vary.gain, modes: MODES.thinSteel, damp: 0.05, jitter: 0.5, rng,
    }),
  });

  R('kettle.click', {
    bus: 'world', gain: 0.4, send: 0.24, ref: 1.6, dur: 0.4,
    build: ({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
      modes: [
        { f: 980 * vary.pitch, t60: 0.05, gain: 1 },
        { f: 2340 * vary.pitch, t60: 0.02, gain: 0.5 },
      ],
      gain: 0.5 * vary.gain, excite: { dur: 0.0016, tone: 7000 }, rng,
    }),
  });

  // A kettle that is boiling is the warmest sound in the building.
  engine.register('kettle.boil', {
    bus: 'ambience', gain: 0.34, send: 0.3, ref: 2.0, loop: true, dur: Infinity,
    build: ({ ctx, bag, out, t }) => {
      const n = noiseSource(ctx, bag, { type: 'white', rate: 1 });
      const bp = biquad(ctx, bag, 'bandpass', 1700, 1.1);
      const hp = biquad(ctx, bag, 'highpass', 700, 0.7);
      const g = gainNode(ctx, bag, 0);
      n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
      // The boil ramps: quiet hiss -> rolling -> chatter.
      env(g.gain, t, 0.0001, [[8, 0.45], [26, 0.75], [40, 0.5]]);
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.23;
      bag.src(lfo);
      const lg = gainNode(ctx, bag, 380);
      lfo.connect(lg); lg.connect(bp.frequency);
      n.start(t); lfo.start(t);
      return {
        dur: Infinity,
        stop: (tt, fade) => { glide(g.gain, 0.0001, tt, Math.max(0.02, fade * 0.4)); },
      };
    },
  });

  // --- UI ------------------------------------------------------------------

  R('ui.click', {
    bus: 'ui', gain: 0.32, send: 0.0, spatial: false, dur: 0.2,
    build: ({ ctx, bag, out, t, rng, vary }) => modalRing(ctx, bag, out, t, {
      modes: [{ f: 1980 * vary.pitch, t60: 0.016, gain: 1 }, { f: 3960 * vary.pitch, t60: 0.008, gain: 0.35 }],
      gain: 0.4 * vary.gain, excite: { dur: 0.0006, tone: 9000 }, rng,
    }),
  });

  R('ui.hover', {
    bus: 'ui', gain: 0.16, send: 0.0, spatial: false, dur: 0.15,
    build: ({ ctx, bag, out, t, rng, vary }) => noiseBurst(ctx, bag, out, t, {
      type: 'white', filter: 'bandpass', f0: 5200 * vary.tone, q: 3,
      attack: 0.001, decay: 0.03, gain: 0.16 * vary.gain,
    }),
  });

  R('ui.deny', {
    bus: 'ui', gain: 0.36, send: 0.0, spatial: false, dur: 0.5,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(196 * vary.pitch, t);
      expTo(osc.frequency, 132 * vary.pitch, t + 0.16);
      bag.src(osc);
      const lp = biquad(ctx, bag, 'lowpass', 1400, 1.0);
      const g = gainNode(ctx, bag, 0);
      osc.connect(lp); lp.connect(g); g.connect(out);
      const end = ar(g.gain, t, 0.22 * vary.gain, 0.006, 0.05, 0.14);
      osc.start(t); osc.stop(end + 0.02);
      return end;
    },
  });

  R('ui.note', {
    bus: 'ui', gain: 0.4, send: 0.05, spatial: false, dur: 0.7,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      let end = t;
      for (let i = 0; i < 2; i++) {
        end = Math.max(end, noiseBurst(ctx, bag, out, t + i * (0.05 + rng() * 0.05), {
          type: 'white', filter: 'highpass', f0: 3000 + rng() * 2500, q: 0.5,
          attack: 0.005, decay: 0.10, gain: 0.13 * vary.gain, pan: (rng() * 2 - 1) * 0.3,
        }));
      }
      return end;
    },
  });

  R('ui.journal', {
    bus: 'ui', gain: 0.36, send: 0.05, spatial: false, dur: 0.9,
    build: ({ ctx, bag, out, t, rng, vary }) => {
      const a = noiseBurst(ctx, bag, out, t, {
        type: 'brown', filter: 'lowpass', f0: 1400, q: 0.6,
        attack: 0.02, decay: 0.22, gain: 0.16 * vary.gain, curve: 'lin',
      });
      const b = modalRing(ctx, bag, out, t + 0.12, {
        modes: [{ f: 220 * vary.pitch, t60: 0.10, gain: 1 }, { f: 470, t60: 0.06, gain: 0.4 }],
        gain: 0.2 * vary.gain, excite: { dur: 0.006, tone: 1400 }, rng,
      });
      return Math.max(a, b);
    },
  });

  return engine;
}

export { MODES };
export default registerLibrary;
