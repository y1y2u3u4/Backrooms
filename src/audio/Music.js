/**
 * Music.js — used five times, and never as wallpaper.
 *
 * The Annex has no score. It has a generative drone system that is allowed to
 * speak at specific narrative moments and is silent otherwise, and a
 * three-note motif that is the only actual melodic material in the game.
 *
 * Rules enforced in code, not by discipline:
 *
 *  * `budget` — the number of times the dramatic cues may fire in a whole
 *    playthrough. Default 5. Once it is spent, `cue()` returns null and logs.
 *    Safe-room warmth and the ending are exempt; they are furniture, not score.
 *  * `minGap` — the shortest permitted silence between cues, in seconds.
 *    Default 210. Two stingers three minutes apart is a soundtrack; two
 *    stingers thirty seconds apart is a horror game trailer.
 *  * Everything fades in over 6-14 seconds. Nothing here has an onset.
 *
 * The motif is three notes: root, minor third above, major third below. It is
 * deliberately unresolved and deliberately short, so that hearing it twenty
 * minutes apart still registers as the same idea.
 */

import { clamp, clamp01, lerp, makeRng } from '../core/util.js';
import {
  biquad, gainNode, env, expTo, glide, noiseSource, midiToFreq, panner2d,
  modalRing, varied, poissonGap,
} from './Synth.js';

/** Semitone offsets from the root. Unresolved on purpose. */
export const MOTIF = [0, 3, -4];

/** D2 — low enough to be felt, high enough to have a pitch. */
const ROOT_MIDI = 38;

export const MUSIC_CUES = {
  /** The lift doors open on a floor that is not on the schedule. */
  arrival: { root: 0, dur: 34, motif: false, bowed: 0.5, bed: 0.75, budget: false },
  /** First sight of the Surveyor. The motif's first appearance. */
  contact: { root: 0, dur: 26, motif: true, motifAt: 7, bowed: 0.85, bed: 0.6 },
  /** A fuse core in your hands. */
  core: { root: 5, dur: 22, motif: true, motifAt: 4.5, bowed: 0.5, bed: 0.7 },
  /** Going down when you meant to go up. */
  descent: { root: -5, dur: 40, motif: false, bowed: 0.7, bed: 0.9 },
  /** The Stack. Nothing resolves, including this. */
  vertigo: { root: 2, dur: 30, motif: false, bowed: 0.4, bed: 1.0 },
  /** The building notices you. */
  seen: { root: -2, dur: 18, motif: true, motifAt: 2.5, bowed: 1.0, bed: 0.45 },
  /** The last one. Exempt from the budget — it only happens once anyway. */
  ending: { root: 0, dur: 72, motif: true, motifAt: 26, bowed: 0.8, bed: 1.0, budget: false, ending: true },
};

export class Music {
  constructor({ engine, bus = null, seed = 30011 }) {
    this.engine = engine;
    this.bus = bus;
    this.rng = makeRng(seed);
    this.enabled = true;

    this.budget = 5;
    this.spent = 0;
    this.minGap = 210;
    this._sinceLast = 1e6;
    this.current = null;
    this.handles = [];
    this.safeHandle = null;
    this.playedCues = [];

    this._registerDefs();
  }

  // -- definitions ----------------------------------------------------------

  _registerDefs() {
    const E = this.engine;

    /**
     * Detuned sine bed. Five partials on ratios that are close to but not
     * exactly harmonic, so the whole thing slowly phases against itself and
     * never settles into a chord.
     */
    E.register('music.bed', {
      bus: 'music', spatial: false, gain: 0.5, send: 0.45, loop: true, dur: Infinity, maxVoices: 2,
      build: ({ ctx, bag, out, t, opts }) => {
        const root = opts.freq ?? midiToFreq(ROOT_MIDI);
        const level = gainNode(ctx, bag, 0.0001);
        const lp = biquad(ctx, bag, 'lowpass', 900, 0.6);
        level.connect(lp); lp.connect(out);

        const ratios = [1, 2.006, 2.997, 4.011, 5.982, 8.03];
        const gains = [1, 0.42, 0.30, 0.16, 0.10, 0.05];
        ratios.forEach((r, i) => {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = root * r;
          o.detune.value = (Math.random() * 2 - 1) * 7;
          bag.src(o);
          const g = gainNode(ctx, bag, gains[i]);
          const p = panner2d(ctx, bag, (i % 2 ? 1 : -1) * (0.15 + i * 0.11));
          o.connect(g); g.connect(p); p.connect(level);
          o.start(t);
          // Each partial breathes on its own very slow, irrational period.
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = 0.0131 * (i + 1) * (0.7 + Math.random() * 0.6);
          bag.src(lfo);
          const lg = gainNode(ctx, bag, gains[i] * 0.55);
          lfo.connect(lg); lg.connect(g.gain);
          lfo.start(t);
        });

        // A hair of noise so it is not a synthesiser.
        const n = noiseSource(ctx, bag, { type: 'brown', rate: 0.6 });
        const nbp = biquad(ctx, bag, 'bandpass', root * 2, 1.2);
        const ng = gainNode(ctx, bag, 0.05);
        n.connect(nbp); nbp.connect(ng); ng.connect(level);
        n.start(t, Math.random() * 3);

        const lfo2 = ctx.createOscillator();
        lfo2.type = 'sine'; lfo2.frequency.value = 0.0089;
        bag.src(lfo2);
        const lg2 = gainNode(ctx, bag, 420);
        lfo2.connect(lg2); lg2.connect(lp.frequency);
        lfo2.start(t);

        glide(level.gain, 0.0001, t, 0.05);
        return {
          dur: Infinity,
          set: (k, v, time) => {
            const tt = time ?? ctx.currentTime;
            if (k === 'level') glide(level.gain, Math.max(0.00005, v), tt, opts.fade ?? 7);
            else if (k === 'tone') glide(lp.frequency, clamp(v, 80, 12000), tt, 6);
          },
          stop: (tt, fade) => glide(level.gain, 0.00005, tt, Math.max(1, fade)),
        };
      },
    });

    /**
     * Bowed metal. A modal bank excited CONTINUOUSLY by band-limited noise
     * instead of an impulse — that is the whole difference between struck metal
     * and bowed metal, and it is one node.
     */
    E.register('music.bowed', {
      bus: 'music', spatial: false, gain: 1.1, send: 0.7, dur: 14, maxVoices: 3,
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const f = (opts.freq ?? midiToFreq(ROOT_MIDI + 12)) * vary.pitch;
        const dur = clamp(opts.duration ?? 8, 1.5, 40);
        const bowAmt = clamp01(opts.bow ?? 0.6);

        const n = noiseSource(ctx, bag, { type: 'pink', rate: 0.7 + rng() * 0.5 });
        const bowLP = biquad(ctx, bag, 'lowpass', 2600, 0.7);
        const bow = gainNode(ctx, bag, 0);
        n.connect(bowLP); bowLP.connect(bow);
        n.start(t, rng() * 3);
        n.stop(t + dur + 0.5);

        const sum = gainNode(ctx, bag, 1);
        const pan = panner2d(ctx, bag, vary.pan * 0.6);
        sum.connect(pan); pan.connect(out);

        // Inharmonic partials — real bowed metal is a bell, not a string.
        const parts = [1, 2.41, 3.19, 4.72, 6.03, 7.87];
        const gs = [1, 0.55, 0.42, 0.26, 0.16, 0.09];
        parts.forEach((r, i) => {
          const ff = clamp(f * r * (1 + (rng() * 2 - 1) * 0.004), 20, 16000);
          const bp = biquad(ctx, bag, 'bandpass', ff, 42 + rng() * 70);
          const g = gainNode(ctx, bag, gs[i] * (0.7 + rng() * 0.6));
          bow.connect(bp); bp.connect(g); g.connect(sum);
        });
        // A sine at the fundamental gives it a floor the bandpasses cannot.
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        bag.src(o);
        const og = gainNode(ctx, bag, 0.16);
        o.connect(og); og.connect(sum);
        o.start(t); o.stop(t + dur + 0.5);

        // Bow pressure: slow in, slow out, with a live tremble.
        env(bow.gain, t, 0.0001, [
          [dur * 0.35, 0.9 * bowAmt * vary.gain, 'exp'],
          [dur * 0.7, 0.62 * bowAmt * vary.gain],
          [dur, 0.0001, 'exp'],
        ]);
        const trem = ctx.createOscillator();
        trem.type = 'sine'; trem.frequency.value = 0.19 + rng() * 0.26;
        bag.src(trem);
        const tg = gainNode(ctx, bag, 0.13 * bowAmt);
        trem.connect(tg); tg.connect(bow.gain);
        trem.start(t); trem.stop(t + dur + 0.5);
        env(og.gain, t, 0.0001, [[dur * 0.3, 0.16, 'exp'], [dur, 0.0001, 'exp']]);

        return t + dur + 0.4;
      }, { pitch: 0.004, gain: 0.12, pan: 0.5, tone: 0.05 }),
    });

    /**
     * THE MOTIF. Three notes. It has played maybe five times when the credits
     * roll, and it should be recognisable every single time.
     */
    E.register('music.motif', {
      bus: 'music', spatial: false, gain: 1.4, send: 0.85, dur: 16, maxVoices: 1, priority: 8,
      // The pitches are fixed — that is what makes it a motif — but the
      // phrasing is not. Each appearance breathes slightly differently.
      build: varied(({ ctx, bag, out, t, rng, vary, opts }) => {
        const rootMidi = (opts.root ?? 0) + ROOT_MIDI + 24;
        const gap = (opts.gap ?? 2.6) * (0.9 + rng() * 0.2);
        const noteDur = (opts.noteDur ?? 5.5) * (0.85 + rng() * 0.3);
        let end = t;
        MOTIF.forEach((semi, i) => {
          const f = midiToFreq(rootMidi + semi);
          const tt = t + i * gap * (i ? 0.94 + rng() * 0.12 : 1);
          // Struck, then allowed to ring for a long time. Two partials only —
          // the motif must be legible through everything else in the mix.
          const e = modalRing(ctx, bag, out, tt, {
            modes: [
              { f, t60: noteDur, gain: 1 },
              { f: f * 2.004, t60: noteDur * 0.62, gain: 0.34 },
              { f: f * 3.01, t60: noteDur * 0.35, gain: 0.14 },
              { f: f * 0.5, t60: noteDur * 0.8, gain: 0.22 },
            ],
            gain: 0.42 * (i === 1 ? 0.9 : 1) * vary.gain,
            excite: { dur: 0.02, type: 'pink', tone: f * 3, gain: 0.7, noise: 0.10 },
            spread: 0.25, rng,
          });
          end = Math.max(end, e);
        });
        return end;
      }, { pitch: 0, gain: 0.10, pan: 0, tone: 0, time: 0.04 }),
    });

    /**
     * Safe-room warmth. Not music exactly: a low, consonant pad plus the
     * suggestion of a filament and a radiator. The only warm sound in the game.
     */
    E.register('music.warm', {
      bus: 'music', spatial: false, gain: 0.45, send: 0.3, loop: true, dur: Infinity, maxVoices: 1,
      build: ({ ctx, bag, out, t, opts }) => {
        const root = opts.freq ?? midiToFreq(ROOT_MIDI + 12);
        const level = gainNode(ctx, bag, 0.0001);
        const lp = biquad(ctx, bag, 'lowpass', 1400, 0.7);
        level.connect(lp); lp.connect(out);
        // A major sixth: the only consonance in the entire soundtrack.
        for (const [r, g] of [[1, 0.5], [1.5, 0.30], [1.682, 0.22], [2, 0.18], [3, 0.07]]) {
          const o = ctx.createOscillator();
          o.type = 'sine'; o.frequency.value = root * r;
          o.detune.value = (Math.random() * 2 - 1) * 5;
          bag.src(o);
          const gg = gainNode(ctx, bag, g);
          o.connect(gg); gg.connect(level);
          o.start(t);
          const lfo = ctx.createOscillator();
          lfo.type = 'sine'; lfo.frequency.value = 0.021 + Math.random() * 0.03;
          bag.src(lfo);
          const lg = gainNode(ctx, bag, g * 0.4);
          lfo.connect(lg); lg.connect(gg.gain);
          lfo.start(t);
        }
        // Filament / radiator hiss.
        const n = noiseSource(ctx, bag, { type: 'pink', rate: 0.5 });
        const nlp = biquad(ctx, bag, 'lowpass', 700, 0.6);
        const ng = gainNode(ctx, bag, 0.055);
        n.connect(nlp); nlp.connect(ng); ng.connect(level);
        n.start(t, Math.random() * 3);
        glide(level.gain, 0.0001, t, 0.05);
        return {
          dur: Infinity,
          set: (k, v, time) => { if (k === 'level') glide(level.gain, Math.max(0.00005, v), time ?? ctx.currentTime, 6); },
          stop: (tt, fade) => glide(level.gain, 0.00005, tt, Math.max(1, fade)),
        };
      },
    });
  }

  // -- cues -----------------------------------------------------------------

  /**
   * Fire a narrative cue. Returns null and logs if the budget is spent or the
   * minimum silence has not elapsed — refusing to play is the feature.
   */
  cue(name, opts = {}) {
    if (!this.enabled || !this.engine.available) return null;
    const c = MUSIC_CUES[name];
    if (!c) { console.warn('[audio] unknown music cue:', name); return null; }
    const counts = c.budget !== false;
    if (!opts.force) {
      if (counts && this.spent >= this.budget) {
        console.info(`[audio] music budget spent (${this.spent}/${this.budget}); "${name}" stays silent.`);
        return null;
      }
      if (counts && this._sinceLast < this.minGap) {
        console.info(`[audio] music too soon (${this._sinceLast | 0}s < ${this.minGap}s); "${name}" stays silent.`);
        return null;
      }
    }
    if (counts) { this.spent++; this._sinceLast = 0; }
    this.playedCues.push({ name, at: this.engine.now });
    this.current = name;

    const rootF = midiToFreq(ROOT_MIDI + (c.root ?? 0));
    const dur = opts.duration ?? c.dur;

    // Bed: a very long fade in, a longer fade out.
    this._timers = this._timers || [];
    if (c.bed > 0) {
      const bed = this.engine.loop('music.bed', { freq: rootF, fade: 9 });
      bed.setParam('level', c.bed * 0.55);
      this.handles.push(bed);
      this._timers.push(setTimeout(
        () => bed.stop(Math.min(14, dur * 0.4)), Math.max(1, dur - 6) * 1000));
    }

    // Bowed metal: two or three long tones, entering at irregular times.
    if (c.bowed > 0) {
      const n = 2 + (this.rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const semi = [0, 7, 3, 10, -5][Math.floor(this.rng() * 5)];
        this.engine.play('music.bowed', {
          freq: midiToFreq(ROOT_MIDI + 12 + (c.root ?? 0) + semi),
          duration: lerp(7, Math.min(22, dur * 0.6), this.rng()),
          bow: c.bowed,
          delay: this.rng() * Math.max(1, dur * 0.35),
          gain: 0.8 + this.rng() * 0.4,
        });
      }
    }

    // The motif, if this moment has earned it.
    if (c.motif) {
      const at = (opts.motifAt ?? c.motifAt ?? 4) * 1000;
      this._timers.push(setTimeout(() => {
        this.engine.play('music.motif', { root: c.root ?? 0 });
      }, at));
    }

    if (c.ending) this.engine.setParam('music', 0.72, 6);
    return name;
  }

  /** Office of Record. Not a cue — it comes and goes with the room. */
  setSafe(on, fade = 6) {
    if (!this.engine.available) return this;
    if (on && !this.safeHandle) {
      this.safeHandle = this.engine.loop('music.warm', {});
      this.safeHandle.setParam('level', 0.42);
    } else if (!on && this.safeHandle) {
      this.safeHandle.stop(fade);
      this.safeHandle = null;
    }
    return this;
  }

  /** Play the motif on its own — for an ending beat, or a note that lands. */
  motif(root = 0) {
    if (!this.engine.available) return null;
    return this.engine.play('music.motif', { root });
  }

  stop(fade = 8) {
    for (const h of this.handles) h.stop(fade);
    this.handles.length = 0;
    for (const tm of this._timers || []) clearTimeout(tm);
    this._timers = [];
    this.engine.stopByName('music.bowed', fade);
    this.current = null;
    return this;
  }

  update(dt) {
    this._sinceLast += dt;
    for (let i = this.handles.length - 1; i >= 0; i--) if (!this.handles[i].alive) this.handles.splice(i, 1);
  }

  get stats() {
    return { spent: this.spent, budget: this.budget, sinceLast: Math.round(this._sinceLast), cues: this.playedCues.map((c) => c.name) };
  }
}

export default Music;
