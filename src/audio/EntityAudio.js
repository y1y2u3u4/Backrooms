/**
 * EntityAudio.js — the Surveyor's voice, and the Attendant's evidence.
 *
 * DESIGN.md §2: the player must be able to learn the Surveyor's entire
 * behavioural language without being told. Audio carries most of that load,
 * because the thing is usually not on screen. The contract, sound by sound:
 *
 *   APPROACH   A rising transformer whine, 3-4 s ahead of arrival. Deliberately
 *              hard to localise: decorrelated wide stereo, a big reverb send and
 *              a weak direct signal, so it tells you WHEN and not WHERE. Learn
 *              the whine, live longer.
 *   TICK       A dry ratchet when the head plate rotates. This one IS
 *              localisable, and it is the only reliable bearing you ever get.
 *   MEASURE    A tape measure retracting, but wrong: an accelerating ratchet
 *              that chokes, a reversed metallic zip, and a flat dead clack.
 *              Hearing it means you have several seconds. It is the game's most
 *              valuable sound and it must be instantly recognisable.
 *   FOOTFALL   Too heavy and too far apart for something that thin. The
 *              interval, not the timbre, is what makes it wrong.
 *   FROZEN     In darkness it stops mid-stride. Near-silence — but not silence.
 *              A faint tone remains, and it means IT IS STILL THERE.
 *   CAPTURE    No scream. A plate of white noise, and the frame goes.
 *
 * The Attendant has no model and therefore no voice: only evidence, always at
 * the edge of audibility, always behind you, never repeated in the same place.
 */

import { clamp, clamp01, lerp, makeRng } from '../core/util.js';
import {
  noiseBurst, modalRing, biquad, gainNode, hit, ar, env, expTo, glide,
  varied, noiseSource, panner2d, widener, shaper, transformerWave, poissonGap,
  renderModal, renderKarplus, fmVoice,
} from './Synth.js';
import { MODES, tuned, ratchet, scrape, thud } from './Library.js';

/** Canonical states, with generous aliases for whatever the AI actually emits. */
const STATE_ALIAS = {
  idle: 'dormant', dormant: 'dormant', asleep: 'dormant', inactive: 'dormant',
  spawn: 'spawn', arrive: 'spawn', realise: 'spawn',
  approach: 'approach', incoming: 'approach', alert: 'approach', aware: 'approach',
  hunt: 'hunt', pursue: 'hunt', chase: 'hunt', walk: 'hunt', move: 'hunt', advance: 'hunt',
  search: 'search', investigate: 'search', seek: 'search',
  measure: 'measure', measuring: 'measure', lost: 'measure', pause: 'measure',
  frozen: 'frozen', dark: 'frozen', still: 'frozen', halted: 'frozen',
  capture: 'capture', kill: 'capture', grab: 'capture', caught: 'capture',
  despawn: 'despawn', gone: 'despawn', leave: 'despawn', retreat: 'despawn', dead: 'despawn',
};

export class EntityAudio {
  constructor({ engine, bus = null, seed = 6113 }) {
    this.engine = engine;
    this.bus = bus;
    this.rng = makeRng(seed);
    this.enabled = true;

    this.state = 'dormant';
    this.position = { x: 0, y: 0, z: 0 };
    this.listener = { x: 0, y: 1.6, z: 0 };
    this.distance = 999;

    this.presence = null;        // the "it is still there" loop
    this.whineHandle = null;
    this._stepT = 1.4;
    this._tickT = 3;
    this._whineCool = 0;
    this._measureCool = 0;
    this.attendantActivity = 0;
    this._attendantT = 40;
    this._unsub = [];

    this._registerDefs();
    if (bus) this.attach(bus);
  }

  attach(bus) {
    this._unsub.push(bus.on('entity:state', (e) => this.setState(e)));
    this._unsub.push(bus.on('entity:heard', (e) => {
      // It turns its head toward what it heard. That tick is your bearing.
      if (this.state !== 'dormant' && this.state !== 'despawn') this.headTick(e?.position);
    }));
    return this;
  }
  detach() { for (const u of this._unsub) u(); this._unsub.length = 0; }

  // -- definitions ----------------------------------------------------------

  _registerDefs() {
    const E = this.engine;

    /**
     * THE WHINE. Everything about this is built to be non-directional:
     *  * a Haas widener with an inverted, delayed side channel — no clean ITD;
     *  * the biggest reverb send in the game;
     *  * a slow pan drift so any bearing you think you have keeps sliding.
     * The rise is exponential in both pitch and level, so it feels like it is
     * accelerating even at constant speed.
     */
    E.register('entity.whine', {
      bus: 'entity', spatial: false, gain: 0.75, send: 1.25, dur: 5.0,
      maxVoices: 2, priority: 9,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const dur = clamp(opts.duration ?? 3.5, 1.2, 8);
        const wave = transformerWave(ctx);
        const w = widener(ctx, bag, { width: 0.95, delayMs: 14 + rng() * 9, invert: true });
        const drift = panner2d(ctx, bag, (rng() * 2 - 1) * 0.4);
        w.output.connect(drift); drift.connect(out);
        // The bearing you think you have keeps sliding away.
        drift.pan.linearRampToValueAtTime(clamp((rng() * 2 - 1) * 0.75, -1, 1), t + dur);

        const g = gainNode(ctx, bag, 0);
        g.connect(w.input);
        const bp = biquad(ctx, bag, 'bandpass', 300, 3.4);
        const sat = shaper(ctx, bag, 0.5);
        const hp = biquad(ctx, bag, 'highpass', 110, 0.7);
        bp.connect(sat); sat.connect(hp); hp.connect(g);

        const f0 = 58 * vary.pitch, f1 = f0 * (2.9 + rng() * 0.5);
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          o.setPeriodicWave(wave);
          o.frequency.setValueAtTime(f0 * (1 + i * 0.004), t);
          expTo(o.frequency, f1 * (1 + i * 0.004), t + dur);
          o.detune.value = (i - 1) * 11;
          bag.src(o);
          const og = gainNode(ctx, bag, i === 1 ? 0.5 : 0.32);
          o.connect(og); og.connect(bp);
          o.start(t); o.stop(t + dur + 0.35);
        }
        // The resonance climbs faster than the fundamental: it "opens up".
        bp.frequency.setValueAtTime(300, t);
        expTo(bp.frequency, 2400 * vary.tone, t + dur);
        bp.Q.setValueAtTime(3.4, t);
        bp.Q.linearRampToValueAtTime(9, t + dur);

        // Level: slow, then sudden. It should feel like it got close all at once.
        env(g.gain, t, 0.0001, [
          [dur * 0.35, 0.10 * vary.gain, 'exp'],
          [dur * 0.72, 0.34 * vary.gain, 'exp'],
          [dur * 0.94, 0.62 * vary.gain, 'exp'],
          [dur + 0.30, 0.0001, 'exp'],
        ]);

        // A whisper of noise riding the resonance: coil, not oscillator.
        const n = noiseSource(ctx, bag, { type: 'white', rate: 1 });
        const nbp = biquad(ctx, bag, 'bandpass', 900, 2.2);
        const ng = gainNode(ctx, bag, 0);
        n.connect(nbp); nbp.connect(ng); ng.connect(w.input);
        expTo(nbp.frequency, 4200, t + dur);
        env(ng.gain, t, 0.0001, [[dur * 0.8, 0.055 * vary.gain, 'exp'], [dur + 0.25, 0.0001, 'exp']]);
        n.start(t, rng() * 2); n.stop(t + dur + 0.35);

        return t + dur + 0.4;
      }, { pitch: 0.07, gain: 0.12, pan: 0, tone: 0.12 }),
    });

    /** Head plate rotating. Dry, close-miked, LOCALISABLE — this is the tell. */
    E.register('entity.tick', {
      bus: 'entity', gain: 1.6, send: 0.20, ref: 4.0, rolloff: 0.9, maxDist: 45,
      hrtf: true, dur: 0.8, maxVoices: 3, priority: 8,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        const n = 2 + Math.floor(rng() * 4);
        const a = ratchet(ctx, bag, out, t, {
          count: n, rate0: 22 + rng() * 14, rate1: 9 + rng() * 6,
          pitch: 1.35 * vary.pitch, gain: 0.34 * vary.gain,
          modes: MODES.thinSteel, damp: 0.055, jitter: 0.35, rng, spread: 0.1,
        });
        // The plate itself settles after the last detent.
        const b = modalRing(ctx, bag, out, t + 0.02 + rng() * 0.06, {
          modes: tuned(MODES.ductPanel, 2.4 * vary.pitch, 0.55, rng, 0.03),
          gain: 0.16 * vary.gain, excite: { dur: 0.002, tone: 3600 }, rng,
        });
        return Math.max(a, b);
      }),
    });

    /**
     * THE MEASURING POSE. An arm goes out against a wall and something inside it
     * retracts. Three parts: a ratchet that accelerates and CHOKES rather than
     * finishing, a reversed metallic zip (a rendered modal body played
     * backwards — nothing in nature rises like that), and a flat dead clack.
     */
    E.register('entity.measure', {
      bus: 'entity', gain: 1.8, send: 0.55, ref: 5.0, rolloff: 0.75, maxDist: 55,
      hrtf: true, dur: 3.2, maxVoices: 1, priority: 10,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        // 1. blade extends against the wall
        const s = scrape(ctx, bag, out, t, {
          dur: 0.26 + rng() * 0.14, f0: 1800, f1: 620, q: 7,
          gain: 0.16 * vary.gain, rng,
        });

        // 2. retraction — fast, accelerating, then it just stops
        const t1 = t + 0.30 + rng() * 0.08;
        const a = ratchet(ctx, bag, out, t1, {
          count: 22 + Math.floor(rng() * 12), rate0: 14, rate1: 96,
          pitch: 1.9 * vary.pitch, gain: 0.17 * vary.gain,
          modes: MODES.thinSteel, damp: 0.03, jitter: 0.12, rng, spread: 0.18,
        });

        // 3. the reversed zip — rendered, then played backwards
        const zipLen = 0.55;
        const zip = renderModal(ctx, {
          modes: [
            { f: 210, t60: 0.5, gain: 1 }, { f: 386, t60: 0.38, gain: 0.7 },
            { f: 631, t60: 0.30, gain: 0.5 }, { f: 1010, t60: 0.22, gain: 0.34 },
            { f: 1622, t60: 0.15, gain: 0.2 }, { f: 2519, t60: 0.09, gain: 0.12 },
          ],
          seconds: zipLen, seed: (rng() * 1e9) >>> 0, strike: 0.5, drift: 0.02,
        });
        const zd = zip.getChannelData(0);
        for (let i = 0, j = zd.length - 1; i < j; i++, j--) { const v = zd[i]; zd[i] = zd[j]; zd[j] = v; }
        const zsrc = ctx.createBufferSource();
        zsrc.buffer = zip;
        zsrc.playbackRate.value = 0.85 + rng() * 0.3;
        bag.src(zsrc);
        const zbp = biquad(ctx, bag, 'bandpass', 1400, 1.1);
        const zg = gainNode(ctx, bag, 0.20 * vary.gain);
        zsrc.connect(zbp); zbp.connect(zg); zg.connect(out);
        const t2 = t1 + 0.30;
        zsrc.start(t2);

        // 4. dead flat clack. No ring at all — that absence is the wrongness.
        const t3 = t2 + zipLen / (zsrc.playbackRate.value) + 0.01;
        const c = modalRing(ctx, bag, out, t3, {
          modes: [
            { f: 148 * vary.pitch, t60: 0.030, gain: 1 },
            { f: 259 * vary.pitch, t60: 0.018, gain: 0.5 },
            { f: 900 * vary.pitch, t60: 0.008, gain: 0.3 },
          ],
          gain: 0.38 * vary.gain, excite: { dur: 0.003, tone: 2200, gain: 1.2 }, rng,
        });
        noiseBurst(ctx, bag, out, t3, {
          type: 'brown', filter: 'lowpass', f0: 420, q: 0.7,
          attack: 0.001, decay: 0.05, gain: 0.13 * vary.gain,
        });
        return Math.max(s, a, c, t3 + 0.2);
      }),
    });

    /**
     * Footfall. 2.9 m of stacked plates on reversed knees. The weight is in the
     * sub, the wrongness is in the two-part landing: the reversed knee touches
     * down BEFORE the mass arrives, so there is always a soft tick then a thud.
     */
    E.register('entity.step', {
      bus: 'entity', gain: 0.80, send: 0.75, ref: 6.0, rolloff: 0.72, maxDist: 70,
      hrtf: true, dur: 2.4, maxVoices: 3, priority: 9,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        // pre-tick: the blade of the foot finds the floor
        let end = noiseBurst(ctx, bag, out, t, {
          type: 'white', filter: 'bandpass', f0: 2600 + rng() * 1600, q: 1.4,
          attack: 0.0008, decay: 0.014, gain: 0.10 * vary.gain,
        });
        // the mass arrives 40-70 ms later. That gap is the whole character.
        const t1 = t + 0.042 + rng() * 0.030;
        end = Math.max(end, thud(ctx, bag, out, t1, {
          f: 41 * vary.pitch, decay: 0.42, gain: 0.85 * vary.gain, click: 0.22, rng,
        }));
        end = Math.max(end, modalRing(ctx, bag, out, t1, {
          modes: tuned(MODES.steelPlate, 0.46 * vary.pitch, 0.55, rng, 0.05),
          gain: 0.26 * vary.gain, excite: { dur: 0.006, tone: 1500 }, spread: 0.25, rng,
        }));
        // the stacked plates settle against each other
        if (rng() < 0.7) {
          end = Math.max(end, ratchet(ctx, bag, out, t1 + 0.05 + rng() * 0.06, {
            count: 2 + Math.floor(rng() * 3), rate0: 30, rate1: 18,
            pitch: 0.9 * vary.pitch, gain: 0.08 * vary.gain,
            modes: MODES.ductPanel, damp: 0.25, jitter: 0.5, rng,
          }));
        }
        return end;
      }),
    });

    /**
     * Presence. The only thing left when it is frozen in darkness. Two tones:
     * a 62 Hz body you feel more than hear, and a 3.1 kHz thread you only
     * notice when everything else stops. `set('mode', 0..1)` moves between
     * frozen (thin, still) and active (thicker, moving).
     */
    E.register('entity.presence', {
      bus: 'entity', gain: 0.42, send: 0.65, ref: 5.0, rolloff: 0.6, maxDist: 60,
      loop: true, dur: Infinity, maxVoices: 1, priority: 10,
      build: ({ ctx, bag, out, t, opts }) => {
        const level = gainNode(ctx, bag, 0.0001);
        level.connect(out);

        // Every realisation of the thing is tuned slightly differently. You
        // cannot learn its exact pitch, only that it is there.
        const f0 = 62 * (1 + (Math.random() * 2 - 1) * 0.03);
        const lowOsc = ctx.createOscillator();
        lowOsc.type = 'sine'; lowOsc.frequency.value = f0;
        bag.src(lowOsc);
        const lowG = gainNode(ctx, bag, 0.55);
        lowOsc.connect(lowG); lowG.connect(level);

        const hiOsc = ctx.createOscillator();
        hiOsc.type = 'sine'; hiOsc.frequency.value = 3117 * (1 + (Math.random() * 2 - 1) * 0.04);
        bag.src(hiOsc);
        const hiG = gainNode(ctx, bag, 0.030);
        hiOsc.connect(hiG); hiG.connect(level);

        // A third, detuned low partial that beats against the first slowly.
        const beat = ctx.createOscillator();
        beat.type = 'sine'; beat.frequency.value = f0 + 0.25 + Math.random() * 0.5;
        bag.src(beat);
        const beatG = gainNode(ctx, bag, 0.30);
        beat.connect(beatG); beatG.connect(level);

        // Coil rasp, only present when it is moving.
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 1 });
        const nbp = biquad(ctx, bag, 'bandpass', 190, 2.4);
        const ng = gainNode(ctx, bag, 0);
        n.connect(nbp); nbp.connect(ng); ng.connect(level);
        n.start(t, Math.random() * 2);

        lowOsc.start(t); hiOsc.start(t); beat.start(t);
        glide(level.gain, 0.0001, t, 0.01);

        return {
          dur: Infinity,
          set: (k, v, time) => {
            const tt = time ?? ctx.currentTime;
            if (k === 'level') glide(level.gain, Math.max(0.00006, v), tt, 0.6);
            else if (k === 'mode') {
              // 0 = frozen: almost nothing. 1 = active: rasp and body.
              const m = clamp01(v);
              glide(ng.gain, m * 0.18, tt, 0.8);
              glide(lowG.gain, lerp(0.30, 0.62, m), tt, 0.8);
              glide(hiG.gain, lerp(0.048, 0.020, m), tt, 0.8);
            }
          },
          stop: (tt, fade) => glide(level.gain, 0.00006, tt, Math.max(0.02, fade)),
        };
      },
    });

    /** Capture. A plate of white noise. No scream, no sting, no music. */
    E.register('entity.capture', {
      bus: 'entity', spatial: false, gain: 1.0, send: 0.0, dur: 4.5, maxVoices: 1, priority: 12,
      build: ({ ctx, bag, out, t }) => {
        const n = noiseSource(ctx, bag, { type: 'white', rate: 1 });
        const n2 = noiseSource(ctx, bag, { type: 'white', rate: 1.031 });
        const merge = ctx.createChannelMerger(2); bag.add(merge);
        const g1 = gainNode(ctx, bag, 1), g2 = gainNode(ctx, bag, 1);
        n.connect(g1); g1.connect(merge, 0, 0);
        n2.connect(g2); g2.connect(merge, 0, 1);
        const g = gainNode(ctx, bag, 0);
        merge.connect(g); g.connect(out);
        // Instant, total, then a long decay to nothing.
        env(g.gain, t, 0.0001, [
          [0.006, 0.85, 'exp'], [0.9, 0.72], [3.4, 0.0001, 'exp'],
        ]);
        n.start(t, Math.random()); n2.start(t, Math.random());
        n.stop(t + 3.6); n2.stop(t + 3.6);
        return t + 3.7;
      },
    });

    // --- the Attendant ----------------------------------------------------
    // No model, no voice. Only evidence, always quiet, always slightly behind.

    E.register('attendant.step', {
      bus: 'entity', gain: 0.90, send: 0.95, ref: 4.0, rolloff: 1.0, maxDist: 30,
      dur: 1.2, maxVoices: 2, priority: 6,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        // A wet footstep on carpet. It starts in the middle of the room.
        const a = noiseBurst(ctx, bag, out, t, {
          type: 'brown', filter: 'lowpass', f0: 380 * vary.tone, f1: 190, q: 0.9,
          attack: 0.006, decay: 0.09, gain: 0.30 * vary.gain,
        });
        const b = modalRing(ctx, bag, out, t + 0.003, {
          modes: [{ f: 66 * vary.pitch, t60: 0.11, gain: 1 }, { f: 121, t60: 0.07, gain: 0.4 }],
          gain: 0.20 * vary.gain, excite: { dur: 0.004, tone: 500 }, rng,
        });
        // the suck of a wet sole lifting
        const o = ctx.createOscillator(); o.type = 'sine';
        const f = 200 + rng() * 180;
        o.frequency.setValueAtTime(f, t + 0.07);
        expTo(o.frequency, f * 2.6, t + 0.14);
        bag.src(o);
        const g = gainNode(ctx, bag, 0);
        o.connect(g); g.connect(out);
        const e = hit(g.gain, t + 0.07, 0.07 * vary.gain, 0.012, 0.07);
        o.start(t + 0.07); o.stop(e + 0.02);
        return Math.max(a, b, e);
      }),
    });

    E.register('attendant.breath', {
      bus: 'entity', gain: 0.85, send: 1.0, ref: 2.4, rolloff: 1.4, maxDist: 16,
      dur: 1.6, maxVoices: 1, priority: 7,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        // Not your breath. Slower than yours, and it does not match your bob.
        const dur = 0.9 + rng() * 0.6;
        const n = noiseSource(ctx, bag, { type: 'white', rate: 0.8 });
        const bp = biquad(ctx, bag, 'bandpass', 420, 1.8);
        const bp2 = biquad(ctx, bag, 'bandpass', 1180, 3.2);
        const hp = biquad(ctx, bag, 'highpass', 260, 0.7);
        const mix = gainNode(ctx, bag, 1);
        const g = gainNode(ctx, bag, 0);
        n.connect(hp); hp.connect(bp); hp.connect(bp2);
        bp.connect(mix); bp2.connect(mix); mix.connect(g); g.connect(out);
        expTo(bp.frequency, 300, t + dur);
        expTo(bp2.frequency, 820, t + dur);
        env(g.gain, t, 0, [[dur * 0.4, 0.16 * vary.gain], [dur, 0.0001, 'exp']]);
        n.start(t, rng() * 2); n.stop(t + dur + 0.05);
        return t + dur + 0.05;
      }),
    });

    E.register('attendant.write', {
      bus: 'entity', gain: 0.70, send: 0.9, ref: 3.0, maxDist: 20, dur: 2.4, maxVoices: 1, priority: 5,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        // A pen on carbon paper. Filling in a form you have not filled in.
        let end = t, tt = t;
        const strokes = 5 + Math.floor(rng() * 7);
        for (let i = 0; i < strokes; i++) {
          const d = 0.05 + rng() * 0.16;
          end = Math.max(end, scrape(ctx, bag, out, tt, {
            dur: d, f0: 2200 + rng() * 2600, f1: 1400 + rng() * 2600,
            q: 2.5, gain: 0.16 * vary.gain, rough: 40, rng,
          }));
          tt += d + poissonGap(rng, 0.11, 0.02, 0.5);
        }
        return end;
      }),
    });

    E.register('attendant.shift', {
      bus: 'entity', gain: 0.30, send: 1.0, ref: 4.5, maxDist: 30, dur: 2.0, maxVoices: 2, priority: 6,
      build: varied(({ ctx, bag, out, t, rng, vary }) => {
        // Something moved in a room you are not looking at. A chair, a locker,
        // a door that was open. You will not find out which.
        const pick = rng();
        if (pick < 0.4) {
          return scrape(ctx, bag, out, t, {
            dur: 0.25 + rng() * 0.4, f0: 240 + rng() * 200, f1: 500 + rng() * 400,
            q: 8, gain: 0.20 * vary.gain, type: 'pink', rough: 14, rng,
          });
        }
        if (pick < 0.75) {
          const a = modalRing(ctx, bag, out, t, {
            modes: tuned(MODES.thinSteel, 1.1 * vary.pitch, 0.4, rng, 0.04),
            gain: 0.22 * vary.gain, excite: { dur: 0.002, tone: 5200 }, rng,
          });
          const b = modalRing(ctx, bag, out, t + 0.04 + rng() * 0.04, {
            modes: tuned(MODES.ductPanel, 1.4 * vary.pitch, 0.5, rng, 0.04),
            gain: 0.16 * vary.gain, excite: { dur: 0.004, tone: 1600 }, rng,
          });
          return Math.max(a, b);
        }
        return thud(ctx, bag, out, t, {
          f: 60 * vary.pitch, decay: 0.24, gain: 0.26 * vary.gain, click: 0.08, rng,
        });
      }),
    });
  }

  // -- state ----------------------------------------------------------------

  /** `entity:state` handler. Payload: {entity, state, position}. */
  setState(e = {}) {
    if (!this.enabled || !this.engine.available) return;
    const who = (e.entity || 'surveyor').toLowerCase();
    if (who !== 'surveyor' && who !== 'the_surveyor') {
      if (who === 'attendant') this.attendant(e.state, e.position);
      return;
    }
    const raw = String(e.state || '').toLowerCase();
    const s = STATE_ALIAS[raw] || raw;
    if (e.position) this.setPosition(e.position);
    if (s === this.state) return;
    const prev = this.state;
    this.state = s;

    switch (s) {
      case 'spawn':
      case 'approach':
        this._ensurePresence();
        this.presence?.setParam('mode', 0.7);
        this.approachWhine();
        this._stepT = 0.9;
        break;
      case 'hunt':
        this._ensurePresence();
        this.presence?.setParam('mode', 1);
        // If it went straight to hunting without warning, warn now — the whine
        // is a promise the game makes to the player and it is never broken.
        if (prev === 'dormant' || prev === 'despawn') this.approachWhine();
        this._stepT = Math.min(this._stepT, 0.5);
        break;
      case 'search':
        this._ensurePresence();
        this.presence?.setParam('mode', 0.75);
        this._stepT = Math.max(this._stepT, 1.1);
        break;
      case 'measure':
        this._ensurePresence();
        this.presence?.setParam('mode', 0.35);
        this.measure();
        this._stepT = 3.6;       // it is not walking; give the player the window
        break;
      case 'frozen':
        this._ensurePresence();
        this.presence?.setParam('mode', 0);
        this._stepT = 1e9;
        break;
      case 'capture':
        this.engine.play('entity.capture');
        this.engine.duck(0.92, 3.2, ['ambience', 'world', 'music', 'player']);
        this.presence?.stop(0.4);
        this.presence = null;
        break;
      case 'despawn':
      case 'dormant':
        if (this.presence) { this.presence.stop(1.6); this.presence = null; }
        break;
      default:
        break;
    }
  }

  setPosition(p) {
    if (!p) return;
    this.position.x = p.x ?? p[0] ?? 0;
    this.position.y = p.y ?? p[1] ?? 0;
    this.position.z = p.z ?? p[2] ?? 0;
    if (this.presence) this.presence.setPosition(this.position.x, this.position.y + 1.4, this.position.z);
  }

  _ensurePresence() {
    if (this.presence && this.presence.alive) return this.presence;
    this.presence = this.engine.loopAt('entity.presence',
      { x: this.position.x, y: this.position.y + 1.4, z: this.position.z }, {});
    this.presence.setParam('level', 0.5);
    return this.presence;
  }

  // -- discrete cues --------------------------------------------------------

  /** The 3-4 second warning. Direction-ambiguous by construction. */
  approachWhine(duration = null) {
    if (!this.engine.available || this._whineCool > 0) return null;
    this._whineCool = 6.0;
    const d = duration ?? (3.0 + this.rng() * 1.2);
    // Level falls with distance but never vanishes: the warning always lands.
    const g = lerp(1.0, 0.42, clamp01((this.distance - 6) / 34));
    return this.engine.play('entity.whine', { duration: d, gain: g });
  }

  /** Head plate rotation. Pass a position to point the tick somewhere. */
  headTick(at = null) {
    if (!this.engine.available) return null;
    const p = at || this.position;
    return this.engine.playAt('entity.tick', { x: p.x ?? p[0], y: (p.y ?? p[1]) + 2.4, z: p.z ?? p[2] }, {});
  }

  /** The measuring pose. Your window. */
  measure() {
    if (!this.engine.available || this._measureCool > 0) return null;
    this._measureCool = 4.0;
    return this.engine.playAt('entity.measure',
      { x: this.position.x, y: this.position.y + 1.6, z: this.position.z }, {});
  }

  /** One heavy footfall. Normally driven from update(), exposed for scripting. */
  footfall(gain = 1) {
    if (!this.engine.available) return null;
    return this.engine.playAt('entity.step',
      { x: this.position.x, y: this.position.y + 0.15, z: this.position.z }, { gain });
  }

  /**
   * The Attendant. `kind` is 'step' | 'breath' | 'write' | 'shift' | 'any'.
   * Always placed behind and to one side of the listener, always quiet.
   */
  attendant(kind = 'any', position = null) {
    if (!this.engine.available) return null;
    const rng = this.rng;
    const names = { step: 'attendant.step', breath: 'attendant.breath', write: 'attendant.write', shift: 'attendant.shift' };
    const key = names[kind] || names[['step', 'shift', 'write', 'breath'][Math.floor(rng() * 4)]];
    let p = position;
    if (!p) {
      // Behind you. Not directly behind — that reads as scripted.
      const a = Math.PI + (rng() * 2 - 1) * 1.05;
      const r = key === 'attendant.breath' ? 1.4 + rng() * 1.6 : 3 + rng() * 9;
      p = {
        x: this.listener.x + Math.cos(a) * r,
        y: this.listener.y - 0.4 + rng() * 0.8,
        z: this.listener.z + Math.sin(a) * r,
      };
    }
    return this.engine.playAt(key, p, { gain: 0.5 + rng() * 0.5 });
  }

  /** 0..1 — how busy the Attendant is. Raise it when the player is alone. */
  setAttendantActivity(v) { this.attendantActivity = clamp01(v); return this; }

  // -- frame ----------------------------------------------------------------

  update(dt, listenerPos = null) {
    if (!this.enabled || !this.engine.available) return;
    if (listenerPos) {
      this.listener.x = listenerPos.x ?? listenerPos[0] ?? 0;
      this.listener.y = listenerPos.y ?? listenerPos[1] ?? 1.6;
      this.listener.z = listenerPos.z ?? listenerPos[2] ?? 0;
    }
    this.distance = Math.hypot(
      this.position.x - this.listener.x,
      this.position.y - this.listener.y,
      this.position.z - this.listener.z);

    this._whineCool = Math.max(0, this._whineCool - dt);
    this._measureCool = Math.max(0, this._measureCool - dt);

    // Presence level: audible at any range, but only just, and it never stops
    // while the thing is realised. That is the point of it.
    if (this.presence && this.presence.alive) {
      const near = clamp01(1 - (this.distance - 3) / 45);
      const base = this.state === 'frozen' ? 0.34 : 0.55;
      this.presence.setParam('level', lerp(0.10, base, near * near));
    }

    // Footfalls: too far apart, and never metronomic. A 2.9 m stride at a
    // measured walking pace lands about every 1.5 s; every fourth is late.
    if (this.state === 'hunt' || this.state === 'search' || this.state === 'approach') {
      this._stepT -= dt;
      if (this._stepT <= 0) {
        this._stepCount = (this._stepCount || 0) + 1;
        const base = this.state === 'hunt' ? 1.30 : 1.72;
        const late = this._stepCount % 4 === 0 ? 1.45 : 1;
        this._stepT = base * late * (0.88 + this.rng() * 0.26);
        this.footfall(this.state === 'hunt' ? 1 : 0.78);
      }
      // It looks around while it walks.
      this._tickT -= dt;
      if (this._tickT <= 0) {
        this._tickT = poissonGap(this.rng, this.state === 'search' ? 2.6 : 5.0, 0.9);
        this.headTick();
      }
    } else if (this.state === 'frozen') {
      // Frozen means frozen. One tick, very rarely, so you know it is not gone.
      this._tickT -= dt;
      if (this._tickT <= 0) {
        this._tickT = poissonGap(this.rng, 26, 8);
        if (this.rng() < 0.45) this.engine.playAt('entity.tick',
          { x: this.position.x, y: this.position.y + 2.4, z: this.position.z }, { gain: 0.35 });
      }
    }

    // The Attendant works while you are not looking.
    if (this.attendantActivity > 0.02) {
      this._attendantT -= dt * this.attendantActivity;
      if (this._attendantT <= 0) {
        this._attendantT = poissonGap(this.rng, 42, 9);
        this.attendant('any');
      }
    }
  }

  /** Stop everything the entity owns. */
  silence(fade = 0.6) {
    if (this.presence) { this.presence.stop(fade); this.presence = null; }
    this.engine.stopByName('entity.whine', fade);
    this.state = 'dormant';
  }
}

export default EntityAudio;
