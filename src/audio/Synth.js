/**
 * Synth.js — the procedural audio toolkit for THE ANNEX.
 *
 * THERE ARE NO AUDIO FILES IN THIS PROJECT. Every sound in the game is built
 * from the primitives in this file, either as a live Web Audio node graph or as
 * an AudioBuffer computed sample-by-sample in JavaScript.
 *
 * Design notes that matter:
 *
 *  * Everything takes an explicit `ctx`, so the identical code path renders
 *    into an OfflineAudioContext for the QA probe as it does into the live
 *    context. If a sound only exists inside AudioEngine it cannot be measured.
 *
 *  * Modal bodies are synthesised with high-Q bandpass filters excited by a
 *    two-sample impulse. A bandpass rings as `exp(-pi*f*t/Q)`, so the mapping
 *    from a musically meaningful T60 to a filter Q is exact:
 *        Q = T60 * pi * f / ln(1e3)^... -> Q = T60 * PI * f / 6.9078
 *    That gives real metal and real pipes for the price of one biquad per
 *    partial, live, with no buffer allocation per trigger. It is the single
 *    most useful function in this file.
 *
 *  * Anything that must not repeat is built live with a fresh RNG. Anything
 *    expensive is rendered once into a small POOL of variants at load time and
 *    then further varied per trigger (rate, filter, envelope, pan), which is
 *    audibly non-repeating without the CPU cost.
 *
 *  * Envelope helpers never call exponentialRampToValueAtTime with zero, and
 *    never schedule in the past — both throw and both kill the whole frame.
 */

import { clamp, clamp01, lerp, makeRng, TAU } from '../core/util.js';

export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-7, g));
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const EPS = 1e-4;

// ---------------------------------------------------------------------------
// Scheduling / envelope helpers
// ---------------------------------------------------------------------------

/** Safe exponential ramp — clamps the target away from zero. */
export function expTo(param, value, time) {
  param.exponentialRampToValueAtTime(Math.max(EPS, value), time);
  return param;
}

/**
 * Schedule a piecewise envelope.
 * `points` is [[dt, value, mode]] with mode 'lin' (default) | 'exp' | 'set' | 'tgt'.
 * `dt` is relative to `t0`, always increasing.
 */
export function env(param, t0, start, points) {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(Math.max(0, start), t0);
  for (const [dt, v, mode = 'lin'] of points) {
    const t = t0 + dt;
    if (mode === 'exp') expTo(param, v, t);
    else if (mode === 'set') param.setValueAtTime(v, t);
    else if (mode === 'tgt') param.setTargetAtTime(v, t, Math.max(0.001, dt || 0.01));
    else param.linearRampToValueAtTime(v, t);
  }
  return param;
}

/** Percussive envelope: silent -> peak over `attack` -> exponential tail. */
export function hit(param, t0, peak, attack, decay, floor = 0.0008) {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.exponentialRampToValueAtTime(Math.max(EPS, peak), t0 + Math.max(0.0006, attack));
  param.exponentialRampToValueAtTime(Math.max(EPS, peak * floor), t0 + Math.max(0.002, attack + decay));
  param.setValueAtTime(0, t0 + attack + decay + 0.001);
  return t0 + attack + decay + 0.002;
}

/** Sustained envelope with a definite end. Returns the release-complete time. */
export function ar(param, t0, peak, attack, hold, release) {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.exponentialRampToValueAtTime(Math.max(EPS, peak), t0 + Math.max(0.001, attack));
  param.setValueAtTime(Math.max(EPS, peak), t0 + attack + Math.max(0, hold));
  param.exponentialRampToValueAtTime(EPS, t0 + attack + hold + Math.max(0.004, release));
  param.setValueAtTime(0, t0 + attack + hold + release + 0.001);
  return t0 + attack + hold + release + 0.002;
}

/** Smooth parameter move that never steps audibly. */
export function glide(param, value, time, tc = 0.08) {
  param.setTargetAtTime(value, time, Math.max(0.004, tc));
  return param;
}

/** Poisson (exponential) inter-arrival time — the only honest way to time drips. */
export function poissonGap(rng, mean, min = 0.02, max = Infinity) {
  const u = Math.max(1e-6, 1 - rng());
  return clamp(-Math.log(u) * mean, min, max);
}

/** Jitter a value multiplicatively by +/- `amt` (0..1). */
export const jit = (rng, v, amt) => v * (1 + (rng() * 2 - 1) * amt);
/** Jitter additively. */
export const jitAdd = (rng, v, amt) => v + (rng() * 2 - 1) * amt;

// ---------------------------------------------------------------------------
// Node bookkeeping — voices must clean themselves up or the graph grows forever
// ---------------------------------------------------------------------------

export class NodeBag {
  constructor() { this.sources = []; this.nodes = []; this.stopped = false; }
  /** Register a source (Oscillator / BufferSource) so it can be stopped. */
  src(n) { this.sources.push(n); this.nodes.push(n); return n; }
  /** Register a processing node so it can be disconnected. */
  add(n) { this.nodes.push(n); return n; }
  startAll(t) { for (const s of this.sources) { try { s.start(t); } catch { /* already started */ } } }
  stopAll(t) {
    if (this.stopped) return;
    this.stopped = true;
    for (const s of this.sources) { try { s.stop(t); } catch { /* not started */ } }
  }
  dispose() {
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* gone */ } }
    this.nodes.length = 0; this.sources.length = 0;
  }
  get size() { return this.nodes.length; }
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

export function fillWhite(data, rng) {
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
}

/** Paul Kellet's refined pink filter — flat -3 dB/oct to well below 20 Hz. */
export function fillPink(data, rng) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.108;
    b6 = w * 0.115926;
  }
}

/** Leaky-integrated white — -6 dB/oct. The bed under every ventilation layer. */
export function fillBrown(data, rng) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const w = rng() * 2 - 1;
    last = (last + 0.022 * w) * 0.9985;
    data[i] = last * 12.5;
  }
  normalise(data, 0.85);
}

/** Peak-normalise in place. */
export function normalise(data, target = 0.95) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak < 1e-9) return 0;
  const g = target / peak;
  for (let i = 0; i < data.length; i++) data[i] *= g;
  return g;
}

/** Remove DC. A DC-offset one-shot eats headroom and clicks on every trigger. */
export function removeDC(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const m = sum / Math.max(1, data.length);
  if (Math.abs(m) < 1e-9) return;
  for (let i = 0; i < data.length; i++) data[i] -= m;
}

/** Short fades at both ends so a looped or truncated buffer never clicks. */
export function fadeEnds(data, sr, inSec = 0.004, outSec = 0.008) {
  const a = Math.min(data.length >> 1, Math.round(inSec * sr));
  const b = Math.min(data.length >> 1, Math.round(outSec * sr));
  for (let i = 0; i < a; i++) data[i] *= i / a;
  for (let i = 0; i < b; i++) data[data.length - 1 - i] *= i / b;
}

export function noiseBuffer(ctx, seconds = 2, type = 'white', seed = 1, channels = 1) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.round(seconds * sr));
  const buf = ctx.createBuffer(channels, len, sr);
  for (let c = 0; c < channels; c++) {
    const rng = makeRng((seed * 7919 + c * 104729) >>> 0);
    const d = buf.getChannelData(c);
    if (type === 'pink') fillPink(d, rng);
    else if (type === 'brown') fillBrown(d, rng);
    else fillWhite(d, rng);
    removeDC(d);
  }
  return buf;
}

const _noiseCache = new WeakMap();
/**
 * Shared looping noise beds. One 4-second stereo buffer per colour per context;
 * every ventilation / hiss / wind layer reads from these with a randomised
 * offset and playbackRate, which is both cheap and unrepeating.
 */
export function sharedNoise(ctx, type = 'brown') {
  let m = _noiseCache.get(ctx);
  if (!m) { m = new Map(); _noiseCache.set(ctx, m); }
  if (!m.has(type)) {
    const secs = type === 'white' ? 3 : 5;
    const buf = noiseBuffer(ctx, secs, type, type.length * 3931 + 17, 2);
    // Loop-safe: crossfade the tail into the head so there is no seam tick.
    const sr = ctx.sampleRate, xf = Math.round(0.05 * sr);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < xf; i++) {
        const t = i / xf;
        d[i] = d[i] * t + d[d.length - xf + i] * (1 - t);
      }
    }
    m.set(type, buf);
  }
  return m.get(type);
}

/** A looping noise source, randomly offset and slightly rate-shifted. */
export function noiseSource(ctx, bag, { type = 'brown', rate = 1, loop = true, rng = Math.random } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = sharedNoise(ctx, type);
  src.loop = loop;
  src.playbackRate.value = rate;
  if (loop) {
    src.loopStart = 0.02;
    src.loopEnd = src.buffer.duration - 0.06;
  }
  bag?.src(src);
  return src;
}

// ---------------------------------------------------------------------------
// Filters and shaping
// ---------------------------------------------------------------------------

export function biquad(ctx, bag, type, freq, q = 1, gainDb = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = clamp(freq, 10, ctx.sampleRate * 0.48);
  f.Q.value = q;
  if (gainDb) f.gain.value = gainDb;
  bag?.add(f);
  return f;
}

export function gainNode(ctx, bag, value = 1) {
  const g = ctx.createGain();
  g.gain.value = value;
  bag?.add(g);
  return g;
}

const _shaperCache = new WeakMap();
/** tanh-ish saturation. `amount` 0..1. Used for transformer grit and clipping. */
export function shaper(ctx, bag, amount = 0.5) {
  let m = _shaperCache.get(ctx);
  if (!m) { m = new Map(); _shaperCache.set(ctx, m); }
  const key = Math.round(clamp01(amount) * 20);
  if (!m.has(key)) {
    const n = 2048, curve = new Float32Array(n);
    const k = 1 + (key / 20) * 24;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * k) / Math.tanh(k);
    }
    m.set(key, curve);
  }
  const ws = ctx.createWaveShaper();
  ws.curve = m.get(key);
  ws.oversample = '2x';
  bag?.add(ws);
  return ws;
}

/**
 * Haas / mid-side widener. Returns {input, output}. Used to make the Surveyor's
 * whine impossible to localise: a wide, decorrelated signal has no clean ITD.
 */
export function widener(ctx, bag, { width = 0.9, delayMs = 17, invert = true } = {}) {
  const input = gainNode(ctx, bag, 1);
  const merger = ctx.createChannelMerger(2);
  bag?.add(merger);
  const left = gainNode(ctx, bag, 1);
  const right = gainNode(ctx, bag, invert ? -1 : 1);
  const dl = ctx.createDelay(0.2); dl.delayTime.value = delayMs * 0.001; bag?.add(dl);
  const dr = ctx.createDelay(0.2); dr.delayTime.value = delayMs * 0.001 * 0.63; bag?.add(dr);
  const wet = clamp01(width);
  input.connect(left);
  input.connect(dl); dl.connect(left);
  input.connect(right);
  input.connect(dr); dr.connect(right);
  left.gain.value = 1;
  right.gain.value = invert ? -wet : wet;
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  return { input, output: merger };
}

/** Equal-power stereo placement for a mono chain. Returns a StereoPannerNode. */
export function panner2d(ctx, bag, pan = 0) {
  const p = ctx.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
  bag?.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Excitation
// ---------------------------------------------------------------------------

const _impulseCache = new WeakMap();
/**
 * A true single-sample unit impulse — the exciter for every modal ring.
 * It must be a UNIT impulse and nothing else: modalRing's level compensation is
 * derived analytically from the biquad's impulse response, so any extra samples
 * here silently change the loudness of every struck object in the game.
 */
export function impulseBuffer(ctx) {
  let b = _impulseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, 2, ctx.sampleRate);
    b.getChannelData(0)[0] = 1;
    _impulseCache.set(ctx, b);
  }
  return b;
}

/**
 * Filtered noise burst. The workhorse: every transient, scuff, hiss, splash and
 * cloth rustle in the game starts here.
 *
 *   type      noise colour
 *   f0 -> f1  filter sweep across the burst
 *   q         filter resonance
 *   attack/decay  envelope, exponential tail
 */
export function noiseBurst(ctx, bag, dest, t, {
  type = 'white', filter = 'bandpass', f0 = 900, f1 = null, q = 1.2,
  attack = 0.002, decay = 0.09, gain = 0.5, rate = 1, pan = null,
  hp = 0, curve = 'exp',
} = {}) {
  const src = noiseSource(ctx, bag, { type, rate, loop: true });
  let node = src;
  if (hp > 0) { const h = biquad(ctx, bag, 'highpass', hp, 0.72); node.connect(h); node = h; }
  const f = biquad(ctx, bag, filter, f0, q);
  node.connect(f);
  const g = gainNode(ctx, bag, 0);
  f.connect(g);
  g.connect(dest);

  if (f1 != null && f1 !== f0) {
    f.frequency.setValueAtTime(clamp(f0, 20, ctx.sampleRate * 0.47), t);
    expTo(f.frequency, clamp(f1, 20, ctx.sampleRate * 0.47), t + attack + decay);
  }
  const end = curve === 'lin'
    ? (env(g.gain, t, 0, [[attack, gain], [attack + decay, 0]]), t + attack + decay)
    : hit(g.gain, t, gain, attack, decay);

  // A source read from a random point in the shared bed never repeats.
  const off = Math.random() * (src.buffer.duration - 0.4);
  try { src.start(t, off); } catch { src.start(t); }
  src.stop(end + 0.02);
  if (pan != null) {
    const p = panner2d(ctx, bag, pan);
    g.disconnect(); g.connect(p); p.connect(dest);
  }
  return end;
}

// ---------------------------------------------------------------------------
// Modal synthesis — metal, pipes, plates, drips, ceramic, glass
// ---------------------------------------------------------------------------

/** T60 (seconds) to bandpass Q at frequency f. */
export const t60ToQ = (t60, f) => clamp(t60 * Math.PI * f / 6.9078, 0.5, 900);

/**
 * Ring a bank of modes with a short excitation.
 *
 *   modes: [{ f, t60, gain, q? }]
 *   excite: { dur, type, tone, gain }  — the strike itself
 *
 * Returns the time at which the last mode has decayed.
 */
export function modalRing(ctx, bag, dest, t, {
  modes = [], gain = 0.5, excite = {}, pitch = 1, damp = 1, spread = 0, rng = Math.random,
} = {}) {
  const out = gainNode(ctx, bag, gain);
  out.connect(dest);

  const ex = {
    dur: 0.004, type: 'white', tone: 5200, q: 0.6, gain: 1, noise: 0.22, impulse: true, ...excite,
  };
  // Normalise the bank so `gain` IS the peak amplitude of the summed ring,
  // regardless of how many modes there are.
  let sumG = 0;
  for (const m of modes) sumG += Math.abs(m.gain ?? 1);
  const norm = 1 / Math.max(1e-6, sumG);

  // Exciter: an impulse plus an optional short noise chirp. The impulse gives a
  // clean modal onset; the noise gives the strike its material (wood vs steel).
  const exBus = gainNode(ctx, bag, ex.gain);
  if (ex.impulse !== false) {
    const imp = ctx.createBufferSource();
    imp.buffer = impulseBuffer(ctx);
    bag.src(imp);
    const ig = gainNode(ctx, bag, 1);
    imp.connect(ig); ig.connect(exBus);
    try { imp.start(t); } catch { /* noop */ }
  }
  if (ex.dur > 0 && ex.noise > 0) {
    // The contact noise is radiated DIRECTLY, not through the resonators. That
    // is both physically right (it is the sound of two things touching, not of
    // the body ringing) and numerically necessary: a sustained excitation into
    // a bank whose gain is compensated by 1/alpha builds up by orders of
    // magnitude and blows the voice apart. Only a trickle goes into the body.
    const n = noiseSource(ctx, bag, { type: ex.type, rate: 1 });
    const nf = biquad(ctx, bag, 'lowpass', ex.tone, ex.q);
    const ng = gainNode(ctx, bag, 0);
    n.connect(nf); nf.connect(ng);
    ng.connect(out);
    const bleed = gainNode(ctx, bag, ex.bleed ?? 0.015);
    ng.connect(bleed); bleed.connect(exBus);
    hit(ng.gain, t, ex.noise, 0.0008, ex.dur);
    try { n.start(t, Math.random() * 2); } catch { n.start(t); }
    n.stop(t + ex.dur + 0.05);
  }

  let last = t + 0.05;
  for (const m of modes) {
    const f = clamp(m.f * pitch, 18, ctx.sampleRate * 0.47);
    const t60 = Math.max(0.006, (m.t60 ?? 0.4) * damp);
    const q = m.q ?? t60ToQ(t60, f);
    const bp = biquad(ctx, bag, 'bandpass', f, q);
    // A constant-0dB-peak bandpass (which is what Web Audio's 'bandpass' is)
    // has an impulse response whose ENVELOPE peaks at exactly 2*alpha, where
    // alpha = sin(w0)/2Q. For a 5-second mode at 147 Hz that is 1e-4, which is
    // why the first version of this function rendered the game's whole modal
    // palette 70 dB too quiet. Compensating by 1/(2*alpha) makes each mode ring
    // at exactly its stated gain, so `gain` is a true upper bound on the peak
    // of the summed bank — verified numerically, not guessed.
    const w0 = TAU * f / ctx.sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const comp = clamp(1 / Math.max(2 * alpha, 1e-7), 1, 8e4);
    const mg = gainNode(ctx, bag, (m.gain ?? 1) * norm * comp);
    exBus.connect(bp); bp.connect(mg);
    if (spread > 0) {
      const p = panner2d(ctx, bag, clamp((rng() * 2 - 1) * spread, -1, 1));
      mg.connect(p); p.connect(out);
    } else {
      mg.connect(out);
    }
    last = Math.max(last, t + t60 * 1.15);
  }
  return last;
}

/**
 * Offline modal render — used where a dense, fixed body is wanted (a pool of
 * variants generated once at load and then rate/filter-varied per trigger).
 */
export function renderModal(ctx, {
  modes = [], seconds = 1.2, seed = 1, strike = 0.35, strikeTone = 0.5, drift = 0,
} = {}) {
  const sr = ctx.sampleRate;
  const len = Math.max(8, Math.round(seconds * sr));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const rng = makeRng(seed >>> 0 || 1);

  for (const m of modes) {
    const f = m.f, t60 = Math.max(0.005, m.t60 ?? 0.4), a = m.gain ?? 1;
    const k = 6.9078 / t60;
    const w = TAU * f / sr;
    const ph = rng() * TAU;
    // Slight inharmonic drift makes struck metal sound struck rather than synth.
    const dr = drift ? (rng() * 2 - 1) * drift : 0;
    const n = Math.min(len, Math.ceil(t60 * 1.4 * sr));
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      const amp = a * Math.exp(-k * tt);
      d[i] += amp * Math.sin(w * i * (1 + dr * Math.exp(-tt * 8)) + ph);
    }
  }
  if (strike > 0) {
    const n = Math.min(len, Math.round(0.008 * sr));
    let lp = 0;
    const coef = clamp01(strikeTone) * 0.6 + 0.05;
    for (let i = 0; i < n; i++) {
      const w = rng() * 2 - 1;
      lp += coef * (w - lp);
      d[i] += lp * strike * (1 - i / n);
    }
  }
  removeDC(d);
  normalise(d, 0.9);
  fadeEnds(d, sr, 0.0004, 0.02);
  return buf;
}

// ---------------------------------------------------------------------------
// Karplus-Strong — cable twangs, wire hum, taut things
// ---------------------------------------------------------------------------

export function renderKarplus(ctx, {
  freq = 180, seconds = 2.0, decay = 0.9965, brightness = 0.5, seed = 1,
  pluckWidth = 1, stretch = 0, noiseTone = 0.5,
} = {}) {
  const sr = ctx.sampleRate;
  const len = Math.max(16, Math.round(seconds * sr));
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rng = makeRng(seed >>> 0 || 1);

  const delay = Math.max(2, sr / freq);
  const N = Math.ceil(delay) + 2;
  const line = new Float32Array(N);
  // Excite with a band-limited noise burst; a raw white pluck is too fizzy.
  let lp = 0;
  const nCoef = clamp01(noiseTone) * 0.85 + 0.05;
  const fill = Math.max(2, Math.round(N * clamp01(pluckWidth)));
  for (let i = 0; i < fill; i++) {
    const w = rng() * 2 - 1;
    lp += nCoef * (w - lp);
    line[i] = lp;
  }
  let w = 0, r = N - delay;
  let z = 0;                       // one-pole loop damping
  const b = clamp01(brightness) * 0.7 + 0.15;
  let allpassZ = 0;
  const frac = delay - Math.floor(delay);
  const apC = (1 - frac) / (1 + frac);  // fractional tuning allpass

  for (let i = 0; i < len; i++) {
    const ri = Math.floor(r) % N;
    const rn = (ri + 1) % N;
    const f = r - Math.floor(r);
    let s = line[ri] * (1 - f) + line[rn] * f;
    // Tuning allpass
    const ap = apC * (s - allpassZ) + line[ri];
    allpassZ = ap;
    s = s * (1 - stretch) + ap * stretch;
    // Loop filter: one-pole lowpass -> string gets darker as it decays
    z += b * (s - z);
    const y = z * decay;
    line[w % N] = y;
    out[i] = s;
    w++; r += 1;
    if (r >= N) r -= N;
  }
  removeDC(out);
  normalise(out, 0.85);
  fadeEnds(out, sr, 0.0005, 0.05);
  return buf;
}

// ---------------------------------------------------------------------------
// FM operator — bells, the Surveyor's wrongness, alarm tones
// ---------------------------------------------------------------------------

export function fmVoice(ctx, bag, dest, t, {
  carrier = 220, ratio = 1.41, index = 300, attack = 0.004, decay = 1.1,
  gain = 0.4, modDecay = 0.35, type = 'sine', modType = 'sine', detune = 0,
} = {}) {
  const mod = ctx.createOscillator(); mod.type = modType;
  mod.frequency.value = clamp(carrier * ratio, 0.01, ctx.sampleRate * 0.47);
  bag.src(mod);
  const modGain = gainNode(ctx, bag, 0);
  mod.connect(modGain);

  const car = ctx.createOscillator(); car.type = type;
  car.frequency.value = clamp(carrier, 0.01, ctx.sampleRate * 0.47);
  car.detune.value = detune;
  bag.src(car);
  modGain.connect(car.frequency);

  const g = gainNode(ctx, bag, 0);
  car.connect(g); g.connect(dest);

  hit(modGain.gain, t, index, Math.max(0.0008, attack * 0.5), Math.max(0.01, modDecay));
  const end = hit(g.gain, t, gain, attack, decay);
  mod.start(t); car.start(t);
  mod.stop(end + 0.02); car.stop(end + 0.02);
  return end;
}

// ---------------------------------------------------------------------------
// Granular
// ---------------------------------------------------------------------------

/**
 * Granular cloud. Owns no timer — the caller pumps `update(now)` so the whole
 * engine ticks from one clock. Grains are BufferSources with a windowed gain;
 * density, size, pitch spread and stereo spread are all live parameters.
 */
export class GrainCloud {
  constructor(ctx, buffer, opts = {}) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.output = ctx.createGain();
    this.output.gain.value = opts.gain ?? 0.4;
    this.density = opts.density ?? 22;      // grains/second
    this.size = opts.size ?? 0.08;          // seconds
    this.sizeJit = opts.sizeJit ?? 0.6;
    this.pitch = opts.pitch ?? 1;
    this.pitchSpread = opts.pitchSpread ?? 0.2;
    this.spread = opts.spread ?? 0.7;
    this.position = opts.position ?? 0;     // 0..1 through the buffer
    this.scatter = opts.scatter ?? 1;
    this.rng = makeRng(opts.seed ?? 12345);
    this.gain = opts.grainGain ?? 0.5;
    this._next = 0;
    this.running = false;
    this.live = 0;
    this.maxLive = opts.maxLive ?? 24;
  }
  start(t) { this.running = true; this._next = t ?? this.ctx.currentTime; }
  stop() { this.running = false; }
  update(now) {
    if (!this.running || !this.buffer) return;
    let guard = 0;
    while (this._next < now + 0.09 && guard++ < 24) {
      if (this.live < this.maxLive && this.density > 0.01) this._grain(this._next);
      this._next += poissonGap(this.rng, 1 / Math.max(0.05, this.density), 0.004);
    }
    if (this._next < now) this._next = now;
  }
  _grain(t) {
    const ctx = this.ctx, rng = this.rng;
    const dur = Math.max(0.006, this.size * (1 + (rng() * 2 - 1) * this.sizeJit));
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = clamp(this.pitch * (1 + (rng() * 2 - 1) * this.pitchSpread), 0.03, 12);
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp((rng() * 2 - 1) * this.spread, -1, 1);
    src.connect(g); g.connect(pan); pan.connect(this.output);
    // Hann-ish window via two ramps; a raw rectangular grain clicks.
    const peak = this.gain * (0.5 + rng() * 0.7);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const maxOff = Math.max(0, this.buffer.duration - dur - 0.01);
    const off = clamp(this.position * maxOff + (rng() * 2 - 1) * this.scatter * maxOff * 0.5, 0, maxOff);
    try { src.start(t, off, dur + 0.02); } catch { /* context torn down */ }
    src.stop(t + dur + 0.03);
    this.live++;
    src.onended = () => {
      this.live--;
      try { src.disconnect(); g.disconnect(); pan.disconnect(); } catch { /* gone */ }
    };
  }
  dispose() { this.stop(); try { this.output.disconnect(); } catch { /* gone */ } }
}

// ---------------------------------------------------------------------------
// Impulse response generation — the zone reverbs
// ---------------------------------------------------------------------------

/**
 * Render a stereo impulse response.
 *
 * The late field is decorrelated noise under an exponential envelope with a
 * time-varying one-pole lowpass, so high frequencies die first — the single
 * cue that separates "a room" from "a delay". Early reflections are placed
 * EXPLICITLY, because that is what tells the ear the size and shape of the
 * space; a pure exponential tail sounds like a plate, not a corridor.
 *
 *   seconds   IR length
 *   decay     T60 of the late field
 *   predelay  direct-to-first-reflection gap (room size cue)
 *   buildup   diffusion ramp; long = large room, ~0 = tiled corridor
 *   early     [{t, g, pan}] discrete reflections
 *   hfDamp    0 = tiled/bright, 1 = carpet/dead
 *   resonance {freq, g} adds a tuned comb — the Cistern's tunnel ring
 *   slap      {t, g, decay} a discrete late slap-back
 */
export function renderIR(ctx, opts = {}) {
  const {
    seconds = 2.0, decay = 1.4, predelay = 0.009, buildup = 0.03,
    early = [], erGain = 1, hfDamp = 0.5, lfTilt = 0.25,
    width = 0.85, seed = 7, gain = 1, resonance = null, slap = null,
    modulate = 0, energy = 0.0016,
  } = opts;

  const sr = ctx.sampleRate;
  const len = Math.max(64, Math.round(seconds * sr));
  const buf = ctx.createBuffer(2, len, sr);
  const rngL = makeRng((seed * 2654435761) >>> 0);
  const rngR = makeRng((seed * 40503 + 991) >>> 0);
  const k = 6.9078 / Math.max(0.05, decay);
  const pre = Math.round(predelay * sr);
  const build = Math.max(1, Math.round(buildup * sr));

  // Bright -> dark one-pole coefficients (0..1, larger = brighter).
  const aBright = lerp(0.92, 0.42, clamp01(hfDamp));
  const aDark = lerp(0.30, 0.035, clamp01(hfDamp));

  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const rng = c === 0 ? rngL : rngR;
    let lp = 0, hp = 0;
    for (let i = pre; i < len; i++) {
      const tt = (i - pre) / sr;
      const w = rng() * 2 - 1;
      const a = lerp(aBright, aDark, clamp01(tt / Math.max(0.08, decay)));
      lp += a * (w - lp);
      // Gentle low tilt: rooms have more energy down low as the tail dies.
      hp += 0.0016 * (lp - hp);
      const s = lp + hp * lfTilt * 6;
      const ramp = Math.min(1, (i - pre) / build);
      let m = 1;
      if (modulate > 0) {
        m = 1 + modulate * (Math.sin(tt * 3.117 + c * 2.1) * 0.6 + Math.sin(tt * 7.41 + c) * 0.4);
      }
      d[i] = s * Math.exp(-k * tt) * ramp * m;
    }
  }

  // Decorrelate to the requested width by folding some mono back in.
  if (width < 1) {
    const dL = buf.getChannelData(0), dR = buf.getChannelData(1);
    const mono = (1 - clamp01(width)) * 0.5;
    for (let i = 0; i < len; i++) {
      const l = dL[i], r = dR[i];
      dL[i] = l * (1 - mono) + r * mono;
      dR[i] = r * (1 - mono) + l * mono;
    }
  }

  // Explicit early reflections.
  const addBurst = (tSec, g, pan, dur = 0.0016, tone = 0.7) => {
    const i0 = Math.round(tSec * sr);
    if (i0 < 0 || i0 >= len) return;
    const n = Math.max(2, Math.round(dur * sr));
    const gl = Math.sqrt(clamp01((1 - pan) * 0.5)) * g;
    const gr = Math.sqrt(clamp01((1 + pan) * 0.5)) * g;
    const dL = buf.getChannelData(0), dR = buf.getChannelData(1);
    let z = 0;
    const rng = rngL;
    for (let i = 0; i < n && i0 + i < len; i++) {
      const w = rng() * 2 - 1;
      z += tone * (w - z);
      const e = 1 - i / n;
      dL[i0 + i] += z * gl * e;
      dR[i0 + i] += z * gr * e;
    }
  };
  for (const e of early) addBurst(predelay + e.t, (e.g ?? 0.5) * erGain, e.pan ?? 0, e.dur ?? 0.0016, e.tone ?? 0.7);
  if (slap) {
    const n = Math.max(4, Math.round((slap.decay ?? 0.05) * sr));
    const i0 = Math.round(slap.t * sr);
    const dL = buf.getChannelData(0), dR = buf.getChannelData(1);
    let zl = 0, zr = 0;
    for (let i = 0; i < n && i0 + i < len; i++) {
      zl += 0.5 * (rngL() * 2 - 1 - zl);
      zr += 0.5 * (rngR() * 2 - 1 - zr);
      const e = Math.exp(-4.5 * i / n);
      dL[i0 + i] += zl * (slap.g ?? 0.3) * e;
      dR[i0 + i] += zr * (slap.g ?? 0.3) * e * 0.85;
    }
  }

  // Tuned comb — a corridor or a pipe has a pitch, and the ear hears it.
  if (resonance && resonance.g > 0) {
    const D = Math.max(2, Math.round(sr / resonance.freq));
    const g = clamp(resonance.g, 0, 0.92);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      const dd = D + (c ? 3 : 0);
      for (let i = dd; i < len; i++) d[i] += g * d[i - dd];
    }
  }

  // Energy-normalise so switching zone reverb does not jump the wet level.
  let sum = 0;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) sum += d[i] * d[i];
  }
  const rms = Math.sqrt(sum / (len * 2));
  const norm = rms > 1e-9 ? (Math.sqrt(energy) / rms) * gain : gain;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] *= norm;
    removeDC(d);
    fadeEnds(d, sr, 0.0002, Math.min(0.25, seconds * 0.2));
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Periodic waves — mains hum needs exact harmonic control
// ---------------------------------------------------------------------------

const _waveCache = new WeakMap();
/**
 * Build a PeriodicWave from a harmonic amplitude list. Cached per context, so
 * eight fluorescent fixtures share one wave object.
 */
export function harmonicWave(ctx, key, amps, phases = null) {
  let m = _waveCache.get(ctx);
  if (!m) { m = new Map(); _waveCache.set(ctx, m); }
  if (m.has(key)) return m.get(key);
  const n = amps.length + 1;
  const real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 0; i < amps.length; i++) {
    const ph = phases ? phases[i] : 0;
    real[i + 1] = amps[i] * Math.cos(ph);
    imag[i + 1] = amps[i] * Math.sin(ph);
  }
  const w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  m.set(key, w);
  return w;
}

/** Mains hum: strong even harmonics of 100 Hz plus ballast rasp. */
export function mainsWave(ctx) {
  return harmonicWave(ctx, 'mains', [1, 0.52, 0.30, 0.19, 0.13, 0.085, 0.06, 0.042, 0.03, 0.021, 0.016, 0.012],
    [0, 1.1, 2.3, 0.4, 1.9, 2.8, 0.7, 1.4, 2.1, 0.2, 1.7, 2.5]);
}

/** Transformer: gritty, odd-heavy, the Surveyor's approach and every substation. */
export function transformerWave(ctx) {
  return harmonicWave(ctx, 'xfmr', [1, 0.72, 0.61, 0.38, 0.44, 0.22, 0.28, 0.16, 0.19, 0.11, 0.13, 0.08, 0.09],
    [0, 2.4, 1.1, 0.3, 2.9, 1.6, 0.8, 2.2, 1.3, 0.5, 2.7, 1.9, 0.9]);
}

/** Big rotating machinery: fundamental plus blade-pass partials. */
export function machineWave(ctx) {
  return harmonicWave(ctx, 'machine', [1, 0.42, 0.55, 0.18, 0.09, 0.24, 0.06, 0.04, 0.11],
    [0, 0.9, 2.1, 1.4, 0.2, 2.6, 1.1, 0.6, 1.8]);
}

// ---------------------------------------------------------------------------
// Variation wrapper
// ---------------------------------------------------------------------------

/**
 * "One-shot with variation": wrap a build function so that every trigger gets a
 * fresh RNG and jittered pitch / filter / envelope / stereo position. Nothing in
 * the Annex is allowed to fire twice identically.
 */
export function varied(build, {
  pitch = 0.06, gain = 0.16, time = 0.012, pan = 0.25, tone = 0.18,
} = {}) {
  let counter = 0;
  return (v) => {
    const seed = ((Date.now() & 0xffff) * 7919 + (counter++ * 104729) + Math.floor(Math.random() * 1e6)) >>> 0;
    const rng = makeRng(seed || 1);
    const vary = {
      pitch: 1 + (rng() * 2 - 1) * pitch,
      gain: 1 + (rng() * 2 - 1) * gain,
      delay: rng() * time,
      pan: (rng() * 2 - 1) * pan,
      tone: 1 + (rng() * 2 - 1) * tone,
      rng,
      seed,
    };
    return build({ ...v, rng, vary, t: v.t + vary.delay });
  };
}

// ---------------------------------------------------------------------------
// Analysis — used by the QA probe and by nothing else at runtime
// ---------------------------------------------------------------------------

/** Peak, RMS, DC offset, spectral centroid and effective duration of a buffer. */
export function analyseBuffer(buf) {
  const n = buf.length, ch = buf.numberOfChannels;
  let peak = 0, sum = 0, dc = 0;
  const mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / ch;
  }
  for (let i = 0; i < n; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) peak = a;
    sum += mono[i] * mono[i];
    dc += mono[i];
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  dc /= Math.max(1, n);

  // Effective duration: first to last sample above -60 dB of peak.
  const thr = peak * 0.001;
  let first = -1, last = -1;
  for (let i = 0; i < n; i++) if (Math.abs(mono[i]) > thr) { first = i; break; }
  for (let i = n - 1; i >= 0; i--) if (Math.abs(mono[i]) > thr) { last = i; break; }
  const dur = first < 0 ? 0 : (last - first + 1) / buf.sampleRate;

  // Spectral centroid via a coarse Goertzel bank — no FFT dependency needed.
  const bands = 48;
  let num = 0, den = 0;
  for (let b = 0; b < bands; b++) {
    const f = 30 * Math.pow(2, b * (Math.log2(16000 / 30) / (bands - 1)));
    const mag = goertzel(mono, buf.sampleRate, f);
    num += f * mag; den += mag;
  }
  const centroid = den > 1e-12 ? num / den : 0;

  // Zero crossing rate — a second, cheap brightness cue.
  let zc = 0;
  for (let i = 1; i < n; i++) if ((mono[i - 1] < 0) !== (mono[i] < 0)) zc++;

  return {
    peak, rms, dc, duration: dur, centroid,
    zcr: zc / Math.max(1, n / buf.sampleRate),
    clipped: peak > 0.999,
    samples: n,
    crest: rms > 1e-9 ? peak / rms : 0,
  };
}

/** Single-frequency magnitude, windowed, on a decimated copy for speed. */
export function goertzel(data, sr, freq) {
  const step = data.length > 96000 ? Math.ceil(data.length / 96000) : 1;
  const n = Math.floor(data.length / step);
  if (n < 4) return 0;
  const w = TAU * freq * step / sr;
  if (w >= Math.PI) return 0;
  const coeff = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const win = 0.5 - 0.5 * Math.cos(TAU * i / (n - 1));
    s0 = data[i * step] * win + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2)) / n;
}

export default {
  dbToGain, gainToDb, midiToFreq, expTo, env, hit, ar, glide, poissonGap, jit, jitAdd,
  NodeBag, noiseBuffer, sharedNoise, noiseSource, noiseBurst, biquad, gainNode, shaper,
  widener, panner2d, impulseBuffer, modalRing, renderModal, t60ToQ, renderKarplus,
  fmVoice, GrainCloud, renderIR, harmonicWave, mainsWave, transformerWave, machineWave,
  varied, analyseBuffer, normalise, removeDC, fadeEnds,
};
