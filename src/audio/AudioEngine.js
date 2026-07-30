/**
 * AudioEngine.js — the graph.
 *
 *   sources ─┬─ voiceGain ─ occlusionLPF ─┬─ panner ──────── bus ─ busComp ─┐
 *            │                            └─ reverbSend ─┐                  │
 *            │                                           ▼                  ▼
 *            └────────────────────────────────  convA/convB xfade ─ wet ─ master ─ limiter ─ out
 *
 * Rules this file enforces:
 *
 *  * Nothing plays before `init()` succeeds, and if `init()` fails (autoplay
 *    policy, no AudioContext, a broken driver) every method becomes a no-op and
 *    the game runs silent. Audio must never be able to break the game.
 *
 *  * Every positional source is occlusion-tested against the CollisionWorld a
 *    few times a second, round-robin, capped per frame. Occlusion drives three
 *    things at once — a lowpass, the dry gain, and the reverb send — because a
 *    sound behind a wall is muffled and MORE reverberant, not merely quieter.
 *    All three are moved with setTargetAtTime; audible stepping is a bug.
 *
 *  * Two convolvers are kept alive and crossfaded, so a zone change is a
 *    dissolve rather than a cut. Impulse responses are generated procedurally
 *    (see Synth.renderIR) and cached by name.
 *
 *  * Voices are pooled and capped. Every one-shot has a computed death time and
 *    is disconnected on reap; a leaked BiquadFilter is forever.
 */

import { clamp, clamp01, lerp, makeRng } from '../core/util.js';
import {
  NodeBag, renderIR, dbToGain, glide, analyseBuffer,
} from './Synth.js';

// ---------------------------------------------------------------------------
// Zone reverb profiles. Keys are what `setZone()` and a zone's `reverb` field
// use. Anything unknown falls back to 'corridor'.
// ---------------------------------------------------------------------------

export const REVERB_PROFILES = {
  /** Intake: 2.78 m ceiling, carpet floor, vinyl walls. Tight, boxy, dull. */
  corridor: {
    seconds: 1.25, decay: 0.68, predelay: 0.007, buildup: 0.012, hfDamp: 0.62,
    width: 0.7, seed: 11, gain: 1.0, energy: 0.0013,
    early: [
      { t: 0.0000, g: 0.60, pan: -0.25 }, { t: 0.0062, g: 0.44, pan: 0.42 },
      { t: 0.0121, g: 0.36, pan: -0.55 }, { t: 0.0189, g: 0.28, pan: 0.18 },
      { t: 0.0247, g: 0.22, pan: 0.66 }, { t: 0.0331, g: 0.17, pan: -0.38 },
      { t: 0.0448, g: 0.12, pan: 0.05 },
    ],
  },
  /** A small hard-tiled service corridor — bright, slappy, unpleasant. */
  tiled: {
    seconds: 1.5, decay: 0.95, predelay: 0.005, buildup: 0.008, hfDamp: 0.18,
    width: 0.78, seed: 23, gain: 1.05, energy: 0.0016,
    resonance: { freq: 118, g: 0.16 },
    early: [
      { t: 0.0000, g: 0.72, pan: -0.15 }, { t: 0.0041, g: 0.62, pan: 0.55 },
      { t: 0.0083, g: 0.55, pan: -0.62 }, { t: 0.0128, g: 0.44, pan: 0.30 },
      { t: 0.0176, g: 0.38, pan: -0.10 }, { t: 0.0231, g: 0.30, pan: 0.72 },
      { t: 0.0298, g: 0.24, pan: -0.44 }, { t: 0.0377, g: 0.18, pan: 0.12 },
    ],
  },
  /** The Service Spine: board-formed concrete, longer, still fairly dry. */
  service: {
    seconds: 2.0, decay: 1.35, predelay: 0.011, buildup: 0.022, hfDamp: 0.34,
    width: 0.82, seed: 37, gain: 1.0, energy: 0.0018,
    early: [
      { t: 0.0000, g: 0.55, pan: -0.35 }, { t: 0.0094, g: 0.46, pan: 0.48 },
      { t: 0.0171, g: 0.38, pan: -0.66 }, { t: 0.0263, g: 0.30, pan: 0.22 },
      { t: 0.0388, g: 0.23, pan: 0.61 }, { t: 0.0522, g: 0.17, pan: -0.28 },
    ],
  },
  /** The Plant: a 14 m concrete cathedral. Long, dark, enormous predelay. */
  hall: {
    seconds: 3.6, decay: 3.1, predelay: 0.031, buildup: 0.085, hfDamp: 0.46,
    width: 0.95, seed: 53, gain: 1.0, energy: 0.0021, lfTilt: 0.4,
    early: [
      { t: 0.0000, g: 0.34, pan: -0.55, dur: 0.003 }, { t: 0.0213, g: 0.30, pan: 0.62, dur: 0.003 },
      { t: 0.0367, g: 0.26, pan: -0.30, dur: 0.004 }, { t: 0.0561, g: 0.21, pan: 0.15, dur: 0.004 },
      { t: 0.0812, g: 0.17, pan: 0.80, dur: 0.005 }, { t: 0.1104, g: 0.13, pan: -0.72, dur: 0.005 },
      { t: 0.1533, g: 0.09, pan: 0.05, dur: 0.006 },
    ],
    slap: { t: 0.196, g: 0.16, decay: 0.09 },
  },
  /** The Cistern: wet tunnel, standing water, a long tuned slap-back. */
  cistern: {
    seconds: 3.2, decay: 2.5, predelay: 0.018, buildup: 0.04, hfDamp: 0.30,
    width: 0.92, seed: 71, gain: 1.05, energy: 0.0024, modulate: 0.07,
    resonance: { freq: 74, g: 0.34 },
    early: [
      { t: 0.0000, g: 0.48, pan: -0.45 }, { t: 0.0138, g: 0.42, pan: 0.58 },
      { t: 0.0261, g: 0.36, pan: -0.70 }, { t: 0.0407, g: 0.29, pan: 0.24 },
      { t: 0.0596, g: 0.22, pan: 0.68 },
    ],
    slap: { t: 0.128, g: 0.30, decay: 0.07 },
  },
  /** The Residence: carpet, damask, soft furnishings. Nearly dead. */
  dead: {
    seconds: 0.85, decay: 0.34, predelay: 0.004, buildup: 0.006, hfDamp: 0.92,
    width: 0.55, seed: 89, gain: 0.85, energy: 0.0008,
    early: [
      { t: 0.0000, g: 0.30, pan: -0.20 }, { t: 0.0055, g: 0.20, pan: 0.30 },
      { t: 0.0102, g: 0.13, pan: -0.10 },
    ],
  },
  /** Inside the ducts: a 0.8 m galvanised box around your head. */
  duct: {
    seconds: 0.7, decay: 0.30, predelay: 0.0016, buildup: 0.003, hfDamp: 0.24,
    width: 0.35, seed: 101, gain: 1.1, energy: 0.0015,
    resonance: { freq: 214, g: 0.42 },
    early: [
      { t: 0.0000, g: 0.80, pan: -0.08 }, { t: 0.0019, g: 0.70, pan: 0.10 },
      { t: 0.0037, g: 0.60, pan: -0.06 }, { t: 0.0058, g: 0.48, pan: 0.05 },
      { t: 0.0081, g: 0.38, pan: 0.0 },
    ],
  },
  /** The Stack: a vertical shaft of identical floors, receding forever. */
  stack: {
    seconds: 4.2, decay: 3.8, predelay: 0.042, buildup: 0.12, hfDamp: 0.52,
    width: 1.0, seed: 127, gain: 0.95, energy: 0.0019, modulate: 0.04,
    early: [
      { t: 0.0000, g: 0.26, pan: -0.9, dur: 0.004 }, { t: 0.0388, g: 0.24, pan: 0.9, dur: 0.004 },
      { t: 0.0791, g: 0.21, pan: -0.5, dur: 0.005 }, { t: 0.1244, g: 0.18, pan: 0.5, dur: 0.005 },
      { t: 0.1866, g: 0.14, pan: -0.2, dur: 0.006 }, { t: 0.2611, g: 0.10, pan: 0.2, dur: 0.007 },
    ],
  },
  /** Office of Record — small, warm, safe. Probably. */
  safe: {
    seconds: 0.9, decay: 0.42, predelay: 0.005, buildup: 0.008, hfDamp: 0.78,
    width: 0.6, seed: 149, gain: 0.9, energy: 0.0009,
    early: [
      { t: 0.0000, g: 0.36, pan: -0.28 }, { t: 0.0068, g: 0.26, pan: 0.36 },
      { t: 0.0131, g: 0.18, pan: -0.12 }, { t: 0.0204, g: 0.12, pan: 0.20 },
    ],
  },
};

/** Zone name (from DESIGN.md §3) -> reverb profile. */
export const ZONE_REVERB = {
  intake: 'corridor', service: 'service', spine: 'service', cistern: 'cistern',
  residence: 'dead', plant: 'hall', duct: 'duct', stack: 'stack', safe: 'safe',
  tiled: 'tiled', office: 'safe',
};

export const BUSES = ['ambience', 'world', 'entity', 'player', 'music', 'ui'];

/**
 * Bus gains and compression.
 *
 * NOTE ON THE AMBIENCE GAIN, which was 0.62 and is now 0.20.
 *
 * Every individual sound in this game measures correctly in isolation — the
 * offline probe puts all 75 of them between -6 and -23 dBFS peak with no
 * clipping, no DC offset and no silence. What that could never show is what
 * happens when two hundred of them play at once, continuously, which is exactly
 * what a zone's ambience bed IS. Rendering the beds to .wav for the first time
 * measured it: the Service Spine bed peaked at 0.0 dBFS and the Cistern at +0.2,
 * i.e. clipping, with a crest factor of 2.3-3.6.
 *
 * A crest factor that low on an ambient bed means it is pinned against the master
 * limiter the whole time. The limiter then has nothing left to give when
 * something loud actually happens, so a door slam, a light failing, or the
 * Surveyor's transformer whine arrives at the same loudness as the room tone —
 * and the dynamic range between "nothing is happening" and "something is behind
 * you" is the entire mechanism a horror mix runs on. Losing it is worse than any
 * individual sound being wrong.
 *
 * At 0.20 the bed sits about 10 dB down, which leaves the headroom the events
 * and the entity need, and leaves the limiter doing what a limiter is for.
 */
const BUS_CONFIG = {
  // gain, compressor {threshold, knee, ratio, attack, release}
  // STILL 0.20, and there is an open defect behind that.
  //
  // This number does not currently control the loud zone beds, and making the
  // reverb sends post-fader did not give it control either. Three measurements,
  // all on the Intake's 65 s bed: holding the bus's breath stage at 0.2 for the
  // whole render left it at -9.4 dBFS against -12.1 unpinned; cutting this gain
  // to 0.075 moved it by nothing; cutting it to 0.085 with post-fader sends
  // moved it by nothing. Meanwhile the four zones that were never limiter-bound
  // — residence, safe, cistern, duct — respond to the same gestures normally and
  // went from a quiet fraction of exactly zero to 0.01-0.07.
  //
  // So something in the Intake/Service/Stack/Plant beds reaches the master
  // without passing this fader, and it has not been identified. Two attempts to
  // fix the level by changing this number would have been changing a number for
  // an effect it does not have, so it is left where the mix was balanced.
  // Next diagnostic: zero `buses.ambience.input` in the offline harness and see
  // whether the bed goes silent. If it does not, the layers are not on this bus.
  ambience: { gain: 0.20, comp: { threshold: -22, knee: 10, ratio: 3.0, attack: 0.05, release: 0.5 } },
  world: { gain: 0.85, comp: { threshold: -16, knee: 8, ratio: 3.5, attack: 0.006, release: 0.22 } },
  entity: { gain: 1.05, comp: { threshold: -12, knee: 4, ratio: 2.2, attack: 0.004, release: 0.30 } },
  player: { gain: 0.80, comp: { threshold: -14, knee: 6, ratio: 3.0, attack: 0.003, release: 0.16 } },
  music: { gain: 0.55, comp: { threshold: -20, knee: 12, ratio: 2.5, attack: 0.08, release: 0.8 } },
  ui: { gain: 0.70, comp: { threshold: -14, knee: 6, ratio: 3.0, attack: 0.004, release: 0.14 } },
};

// ---------------------------------------------------------------------------

let _voiceId = 1;

class Voice {
  constructor(engine, name, def, opts) {
    this.engine = engine;
    this.name = name;
    this.def = def;
    this.id = _voiceId++;
    this.bag = new NodeBag();
    this.dead = false;
    this.loop = !!def.loop;
    this.spatial = false;
    this.occl = 0;
    this.occlTarget = 0;
    this.dist = 0;
    this.priority = opts.priority ?? def.priority ?? 1;
    this.startedAt = engine.now;
    this.endAt = Infinity;
    this._setFn = null;
    this._stopFn = null;
    this.follow = opts.follow || null;
    this.pos = { x: 0, y: 0, z: 0 };
  }

  /** Chain built on demand so a stolen voice costs nothing. */
  _build(opts, position) {
    const engine = this.engine, ctx = engine.ctx, bag = this.bag;
    const def = this.def;

    const out = ctx.createGain();
    out.gain.value = 1;
    bag.add(out);
    this.out = out;

    this._userGain = opts.gain ?? 1;
    const vg = ctx.createGain();
    vg.gain.value = (def.gain ?? 1) * this._userGain;
    bag.add(vg);
    this.voiceGain = vg;
    out.connect(vg);

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 20000;
    lpf.Q.value = 0.4;
    bag.add(lpf);
    this.lpf = lpf;
    vg.connect(lpf);

    const busNode = engine.buses[opts.bus || def.bus || 'world'] || engine.buses.world;
    this.busNode = busNode;

    const sendBase = opts.send ?? def.send ?? 0.34;
    this.sendBase = sendBase;
    const send = ctx.createGain();
    send.gain.value = sendBase;
    bag.add(send);
    this.send = send;
    lpf.connect(send);
    // Into the BUS's send stage, not straight to the global reverb send. The
    // per-voice send amount is still per-voice; what changes is that the bus's
    // fader, duck and breath now apply to this voice's wet signal as well as its
    // dry one. See POST-FADER REVERB SEND in the bus construction.
    send.connect(busNode.sendIn || engine.reverbSend);

    if (position && def.spatial !== false) {
      this.spatial = true;
      const p = ctx.createPanner();
      p.panningModel = def.hrtf ? 'HRTF' : 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = def.ref ?? 2.2;
      p.rolloffFactor = def.rolloff ?? 1.1;
      p.maxDistance = def.maxDist ?? 70;
      p.coneInnerAngle = 360;
      this._setPannerPos(p, position);
      bag.add(p);
      this.panner = p;
      lpf.connect(p);
      p.connect(busNode.input);
    } else {
      const sp = ctx.createStereoPanner();
      sp.pan.value = clamp(opts.pan ?? 0, -1, 1);
      bag.add(sp);
      this.stereo = sp;
      lpf.connect(sp);
      sp.connect(busNode.input);
    }
    return out;
  }

  _setPannerPos(p, position) {
    const x = position.x ?? position[0] ?? 0;
    const y = position.y ?? position[1] ?? 0;
    const z = position.z ?? position[2] ?? 0;
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
    const t = this.engine.now;
    if (p.positionX) {
      p.positionX.setTargetAtTime(x, t, 0.015);
      p.positionY.setTargetAtTime(y, t, 0.015);
      p.positionZ.setTargetAtTime(z, t, 0.015);
    } else {
      p.setPosition(x, y, z);
    }
  }

  setPosition(x, y, z) {
    if (this.dead) return this;
    if (typeof x === 'object' && x) { z = x.z; y = x.y; x = x.x; }
    if (this.panner) this._setPannerPos(this.panner, { x, y, z });
    else { this.pos.x = x; this.pos.y = y; this.pos.z = z; }
    return this;
  }

  /**
   * `g` is a user multiplier on top of the definition's base gain. Stored
   * separately so the occlusion pass, which also writes voiceGain, composes
   * with it instead of fighting it.
   */
  setGain(g, time = 0.05) {
    if (this.dead || !this.voiceGain) return this;
    this._userGain = Math.max(0, g);
    const dry = lerp(1, 0.20, this.occl);
    glide(this.voiceGain.gain, dry * (this.def.gain ?? 1) * this._userGain, this.engine.now, time);
    return this;
  }

  setParam(key, value, time) {
    if (this.dead) return this;
    if (key === 'gain') return this.setGain(value, time ?? 0.05);
    if (key === 'send') { this.sendBase = value; return this; }
    if (this._setFn) { try { this._setFn(key, value, time ?? this.engine.now); } catch (e) { /* def bug */ } }
    return this;
  }

  stop(fade = 0.08) {
    if (this.dead) return;
    const t = this.engine.now;
    if (this._stopFn) { try { this._stopFn(t, fade); } catch { /* def bug */ } }
    if (this.voiceGain) {
      try {
        this.voiceGain.gain.cancelScheduledValues(t);
        this.voiceGain.gain.setValueAtTime(Math.max(1e-4, this.voiceGain.gain.value), t);
        this.voiceGain.gain.exponentialRampToValueAtTime(1e-4, t + Math.max(0.01, fade));
      } catch { /* torn down */ }
    }
    this.bag.stopAll(t + Math.max(0.01, fade) + 0.02);
    this.endAt = t + Math.max(0.01, fade) + 0.06;
    this.loop = false;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    try { this.bag.stopAll(this.engine.now); } catch { /* torn down */ }
    this.bag.dispose();
    this.out = this.voiceGain = this.lpf = this.send = this.panner = this.stereo = null;
  }

  get alive() { return !this.dead; }
}

// ---------------------------------------------------------------------------

export class AudioEngine {
  constructor({ collision = null, camera = null, maxVoices = 44, seed = 20250729 } = {}) {
    this.collision = collision;
    this.camera = camera;
    this.registry = new Map();
    this.voices = [];
    this.maxVoices = maxVoices;
    this.rng = makeRng(seed);

    this.ctx = null;
    this.available = false;
    this.started = false;
    this._muted = false;
    // 0.60, not 1.0 — about 4.5 dB of headroom.
    //
    // Rendering the zone beds to .wav for the first time measured the Service
    // Spine at 0.0 dBFS peak and the Cistern at +0.2, i.e. clipping, with crest
    // factors of 2.3-3.6. Lowering the ambience bus alone did not move it, which
    // located the problem: the bed is not one loud bus, it is every bus summing
    // — fixture hum on `world`, one-shots on `ambience`, the player's own steps —
    // and the mix as a whole had no headroom left before the limiter.
    //
    // A limiter working continuously is not a safety net, it is a compressor
    // nobody asked for: it has nothing left to give when something loud actually
    // happens, so a door slam arrives at the same loudness as room tone. The
    // dynamic range between "nothing is happening" and "something is behind you"
    // is the entire mechanism a horror mix runs on, and this is what buys it back.
    // Scaling the master preserves every relative balance in the mix.
    this._masterVol = 0.60;
    this.buses = {};
    this.zone = null;
    this.zoneProfile = null;
    this._irs = new Map();
    this._slot = 0;
    this._occIndex = 0;
    this._occAccum = 0;
    this._nameCounts = new Map();
    this._pendingZone = null;
    this._listenerTmp = { fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0 };
    this.params = { fear: 0, wet: 1, air: 1 };
    this.stats = { voices: 0, oneShots: 0, loops: 0, nodes: 0, occlChecks: 0, denied: 0 };
    this.occlusionRate = 6;      // Hz per voice
    this.maxOccPerFrame = 4;
    this.onError = null;
  }

  // -- lifecycle ------------------------------------------------------------

  /**
   * Must be called from a user gesture. Returns true if audio is live.
   * `opts.context` lets the QA harness inject an OfflineAudioContext.
   */
  async init(opts = {}) {
    if (this.available) return true;
    try {
      const Ctor = opts.context ? null : (globalThis.AudioContext || globalThis.webkitAudioContext);
      if (!opts.context && !Ctor) return false;
      this.ctx = opts.context || new Ctor({ latencyHint: opts.latencyHint || 'interactive' });
      if (this.ctx.state === 'suspended' && this.ctx.resume) {
        try { await this.ctx.resume(); } catch { /* still suspended; graph is valid */ }
      }
      this._buildGraph();
      this.available = true;
      this.started = this.ctx.state === 'running';
      // First reverb synchronously so the very first footstep has a room.
      this.setZone(opts.zone || 'corridor', 0);
      if (!opts.context) this._prefetchIRs();
      return true;
    } catch (e) {
      console.warn('[audio] unavailable:', e && e.message);
      this.available = false;
      this.ctx = null;
      if (this.onError) this.onError(e);
      return false;
    }
  }

  _buildGraph() {
    const ctx = this.ctx;

    // Master: gain -> limiter -> safety saturator -> out.
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this._masterVol;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6.5;
    this.limiter.knee.value = 2.5;
    this.limiter.ratio.value = 18;
    this.limiter.attack.value = 0.0028;
    this.limiter.release.value = 0.22;

    // Safety saturator: transparent for quiet material, asymptotic at the top.
    //
    // This used to be tanh(x * 1.35) / tanh(1.35), and that curve is not a safety
    // net — it is a normaliser. Its slope at zero is 1.35 / tanh(1.35) = 1.55, so
    // it applied +3.8 dB to everything quiet while squashing the top towards 1.0,
    // which means the output sits near full scale no matter what happens upstream.
    // That is why every zone bed measured between -0.2 and +0.2 dBFS, and why
    // lowering the ambience bus and then the master gain moved the Residence (an
    // ambience-dominated bed) but left the Intake, Service, Cistern and Plant
    // pinned at 0.0 exactly as before. Two upstream fixes appeared to do nothing
    // because this was quietly undoing them.
    //
    // Plain tanh has slope 1 at the origin, so a quiet room tone passes through
    // untouched, and tanh(1) = 0.76, so nothing can ever reach full scale.
    this.safety = ctx.createWaveShaper();
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x);
    }
    this.safety.curve = curve;
    this.safety.oversample = '2x';

    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.safety);
    this.safety.connect(ctx.destination);

    // The reverb send node is created BEFORE the buses, because each bus now
    // owns a post-fader send stage that has to connect into it. See the note on
    // POST-FADER REVERB SEND below.
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;

    // Buses.
    for (const name of BUSES) {
      const cfg = BUS_CONFIG[name];
      const input = ctx.createGain(); input.gain.value = 1;
      // BREATH — slow macro-dynamics, owned by whoever drives the bus.
      //
      // Separate from `duck` on purpose: `duck` is the fast, event-driven gain
      // (getting into a locker, a cinematic taking the floor) and something has
      // to be able to move a bus slowly WITHOUT fighting it. Ambience uses this
      // for the building's drift and its lulls; see Ambience._breathe.
      //
      // Why it exists at all: the first render of the zone beds measured a
      // loudness range of 0.6 to 5.1 LU with a quiet fraction of exactly zero in
      // all eight zones — the Plant varied by half a decibel across 65 seconds.
      // Every ambience layer is `loop: true, dur: Infinity` at a fixed gain, so
      // the floor was mathematically a constant and no amount of event density
      // on top of it could make the mix breathe.
      const breath = ctx.createGain(); breath.gain.value = 1;
      const duck = ctx.createGain(); duck.gain.value = 1;
      const gain = ctx.createGain(); gain.gain.value = cfg.gain;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = cfg.comp.threshold;
      comp.knee.value = cfg.comp.knee;
      comp.ratio.value = cfg.comp.ratio;
      comp.attack.value = cfg.comp.attack;
      comp.release.value = cfg.comp.release;
      // BREATH SITS AFTER THE COMPRESSOR, and that placement is the whole point.
      //
      // Placed before it, the macro-dynamics measurably did not survive: with the
      // lull verified as running and pulling the bus to -14 dB for four seconds
      // out of every sixty-five, the rendered beds' loudness range moved from
      // 1.9 LU to 1.5 and the tenth percentile by four tenths of a decibel. A
      // compressor releasing into a gain dip is not a side effect, it is the
      // device doing exactly what it is for: 3:1 above -22 dBFS gives back about
      // two thirds of anything taken away in front of it.
      //
      // Level control belongs in front of the compressor. Gestures belong behind
      // it, where a 14 dB gesture is 14 dB.
      input.connect(duck); duck.connect(gain); gain.connect(comp);
      comp.connect(breath); breath.connect(this.masterGain);

      // POST-FADER REVERB SEND.
      //
      // Voices used to tap their send straight to `engine.reverbSend`, before
      // the panner and before this bus — a pre-fader send. Since the return
      // connects directly to the master, that put the entire wet signal outside
      // the reach of the bus's gain, compressor, duck and breath.
      //
      // It is not a subtle effect, because this mix is mostly wet. Two
      // independent measurements: holding the ambience bus's breath at 0.2 for a
      // whole render left the bed at -9.4 dBFS against -12.1 unpinned, and
      // cutting the ambience bus gain by 8.5 dB moved the Intake's rendered RMS
      // by nothing at all. A bus fader that does not change the level is not a
      // fader. It also means `Silence`'s held breaths -- the gesture the whole
      // design leans on -- were ducking a minority of the signal.
      //
      // So each bus now has its own send stage carrying the same gestures, and
      // `setDuck` and the breath write to both. Level control and gestures apply
      // to wet and dry alike, which is what a mix expects.
      const sendIn = ctx.createGain(); sendIn.gain.value = 1;
      const sendDuck = ctx.createGain(); sendDuck.gain.value = 1;
      const sendBreath = ctx.createGain(); sendBreath.gain.value = 1;
      sendIn.connect(sendDuck); sendDuck.connect(sendBreath);
      sendBreath.connect(this.reverbSend);

      this.buses[name] = {
        name, input, breath, duck, gain, comp, base: cfg.gain, duckAmount: 0,
        sendIn, sendDuck, sendBreath,
      };
    }

    // Reverb: two convolver slots and one return; the send itself was created
    // above the bus loop so the per-bus post-fader send stages could reach it.
    // Pre-filter the send: nothing below 90 Hz should smear into the tail, and
    // ultrasonic content in a convolver is wasted CPU.
    this.sendHP = ctx.createBiquadFilter();
    this.sendHP.type = 'highpass'; this.sendHP.frequency.value = 95; this.sendHP.Q.value = 0.6;
    this.sendLP = ctx.createBiquadFilter();
    this.sendLP.type = 'lowpass'; this.sendLP.frequency.value = 11000; this.sendLP.Q.value = 0.5;
    this.reverbSend.connect(this.sendHP); this.sendHP.connect(this.sendLP);

    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 1;
    this.reverbReturn.connect(this.masterGain);

    this.slots = [0, 1].map(() => {
      const conv = ctx.createConvolver();
      conv.normalize = false;
      const g = ctx.createGain();
      g.gain.value = 0;
      this.sendLP.connect(conv);
      conv.connect(g);
      g.connect(this.reverbReturn);
      return { conv, gain: g, profile: null };
    });
  }

  /** Build the remaining IRs off the critical path so init() stays snappy. */
  _prefetchIRs() {
    const names = Object.keys(REVERB_PROFILES).filter((n) => !this._irs.has(n));
    let i = 0;
    const step = () => {
      if (!this.available || i >= names.length) return;
      const n = names[i++];
      try { this._ir(n); } catch { /* skip */ }
      (globalThis.requestIdleCallback || ((f) => setTimeout(f, 24)))(step);
    };
    (globalThis.requestIdleCallback || ((f) => setTimeout(f, 24)))(step);
  }

  _ir(name) {
    if (this._irs.has(name)) return this._irs.get(name);
    const p = REVERB_PROFILES[name] || REVERB_PROFILES.corridor;
    const buf = renderIR(this.ctx, p);
    this._irs.set(name, buf);
    return buf;
  }

  dispose() {
    for (const v of this.voices) v.kill();
    this.voices.length = 0;
    try { this.masterGain?.disconnect(); this.safety?.disconnect(); this.limiter?.disconnect(); } catch { /* gone */ }
    if (this.ctx && this.ctx.close) { try { this.ctx.close(); } catch { /* gone */ } }
    this.available = false;
    this.ctx = null;
  }

  // -- registry -------------------------------------------------------------

  /**
   * Register a sound.
   *
   *   register(name, {
   *     bus:      'world' | 'ambience' | 'entity' | 'player' | 'music' | 'ui',
   *     gain:     base linear gain,
   *     spatial:  false to force a 2D sound even when playAt() is used,
   *     hrtf:     true for HRTF panning (use sparingly — expensive),
   *     ref/rolloff/maxDist: PannerNode distance model,
   *     send:     base reverb send 0..1,
   *     loop:     true if build() returns a sustaining voice,
   *     dur:      fallback lifetime in seconds,
   *     build({ ctx, bag, out, t, opts, rng, engine }) -> seconds | {dur,set,stop}
   *   })
   */
  register(name, def) {
    this.registry.set(name, def);
    return this;
  }
  has(name) { return this.registry.has(name); }
  get names() { return [...this.registry.keys()].sort(); }

  // -- transport ------------------------------------------------------------

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  get muted() { return this._muted; }
  set muted(v) {
    this._muted = !!v;
    if (this.masterGain) glide(this.masterGain.gain, this._muted ? 0 : this._masterVol, this.now, 0.06);
  }
  toggleMute() { this.muted = !this._muted; return this._muted; }

  setMasterVolume(v) {
    this._masterVol = clamp01(v);
    if (this.masterGain && !this._muted) glide(this.masterGain.gain, this._masterVol, this.now, 0.08);
  }

  /** Global parameter. Bus names set bus volume; 'wet' sets the reverb return. */
  setParam(key, value, time = 0.15) {
    if (key === 'master') return this.setMasterVolume(value);
    if (this.buses[key]) {
      const b = this.buses[key];
      b.base = value;
      if (this.available) glide(b.gain.gain, value, this.now, time);
      return this;
    }
    if (key === 'wet' && this.available) {
      this.params.wet = value;
      glide(this.reverbReturn.gain, value, this.now, time);
      return this;
    }
    this.params[key] = value;
    return this;
  }
  getParam(key) {
    if (this.buses[key]) return this.buses[key].base;
    return this.params[key];
  }

  setBusGain(name, v, time = 0.15) { return this.setParam(name, v, time); }

  /**
   * Duck the world down and bring it back. `amount` 0..1 of reduction.
   * Used for stingers and dialogue-like moments; Silence.js uses setDuck for
   * long held breaths.
   */
  duck(amount = 0.6, seconds = 1.4, buses = ['ambience', 'world', 'music']) {
    if (!this.available) return;
    // duck(0) reads as "let the world back in" everywhere it is called from, so
    // treat it as a release of any sustained duck rather than a no-op dip.
    if (amount <= 0) return this.setDuck(0, Math.max(0.05, seconds), buses);
    const t = this.now;
    const target = clamp01(1 - amount);
    const atk = Math.min(0.28, seconds * 0.22);
    for (const n of buses) {
      const b = this.buses[n];
      if (!b) continue;
      const g = b.duck.gain;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(1e-4, g.value), t);
        g.exponentialRampToValueAtTime(Math.max(1e-4, target), t + atk);
        g.setValueAtTime(Math.max(1e-4, target), t + Math.max(atk, seconds - atk));
        g.exponentialRampToValueAtTime(1, t + seconds + 0.35);
      } catch { /* torn down */ }
    }
  }

  /** Sustained duck. `amount` 0 = normal, 1 = silent. Call again to release. */
  setDuck(amount = 0, seconds = 2.0, buses = ['ambience', 'world', 'music']) {
    if (!this.available) return;
    const t = this.now;
    const target = Math.max(0.0008, 1 - clamp01(amount));
    for (const n of buses) {
      const b = this.buses[n];
      if (!b) continue;
      b.duckAmount = amount;
      // Both stages, wet and dry. A duck that only takes the dry path leaves the
      // room ringing underneath it, which is the effect `Silence` spent a
      // dedicated `wet` write working around.
      for (const node of [b.duck, b.sendDuck]) {
        if (!node) continue;
        try {
          node.gain.cancelScheduledValues(t);
          node.gain.setValueAtTime(Math.max(1e-4, node.gain.value), t);
          node.gain.exponentialRampToValueAtTime(target, t + Math.max(0.05, seconds));
        } catch { /* torn down */ }
      }
    }
  }

  // -- zone reverb ----------------------------------------------------------

  /**
   * Crossfade to a reverb profile. Accepts either a profile key
   * ('corridor', 'hall', ...) or a zone name ('intake', 'plant', ...).
   */
  setZone(profileName, fade = 1.2) {
    const key = REVERB_PROFILES[profileName] ? profileName
      : (ZONE_REVERB[profileName] || 'corridor');
    if (!this.available) { this.zone = key; return this; }
    if (this.zoneProfile === key) return this;
    this.zoneProfile = key;
    this.zone = key;

    const next = this.slots[this._slot ^ 1];
    const cur = this.slots[this._slot];
    let buf;
    try { buf = this._ir(key); } catch (e) { console.warn('[audio] IR failed', key, e); return this; }
    next.conv.buffer = buf;
    next.profile = key;

    const t = this.now;
    const f = Math.max(0.01, fade);
    try {
      next.gain.gain.cancelScheduledValues(t);
      next.gain.gain.setValueAtTime(next.gain.gain.value, t);
      next.gain.gain.linearRampToValueAtTime(1, t + f);
      cur.gain.gain.cancelScheduledValues(t);
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
      cur.gain.gain.linearRampToValueAtTime(0, t + f);
    } catch { /* torn down */ }
    this._slot ^= 1;
    return this;
  }

  get currentReverb() { return this.zoneProfile; }

  // -- listener -------------------------------------------------------------

  setListener(camera) { this.camera = camera; return this; }

  _updateListener() {
    if (!this.available || !this.camera) return;
    const L = this.ctx.listener;
    const cam = this.camera;
    const m = cam.matrixWorld ? cam.matrixWorld.elements : null;
    const px = cam.position?.x ?? 0, py = cam.position?.y ?? 0, pz = cam.position?.z ?? 0;
    let fx = 0, fy = 0, fz = -1, ux = 0, uy = 1, uz = 0;
    if (m) {
      fx = -m[8]; fy = -m[9]; fz = -m[10];
      ux = m[4]; uy = m[5]; uz = m[6];
    }
    const t = this.now;
    if (L.positionX) {
      const tc = 0.012;
      L.positionX.setTargetAtTime(px, t, tc);
      L.positionY.setTargetAtTime(py, t, tc);
      L.positionZ.setTargetAtTime(pz, t, tc);
      L.forwardX.setTargetAtTime(fx, t, tc);
      L.forwardY.setTargetAtTime(fy, t, tc);
      L.forwardZ.setTargetAtTime(fz, t, tc);
      L.upX.setTargetAtTime(ux, t, tc);
      L.upY.setTargetAtTime(uy, t, tc);
      L.upZ.setTargetAtTime(uz, t, tc);
    } else {
      L.setPosition(px, py, pz);
      L.setOrientation(fx, fy, fz, ux, uy, uz);
    }
    this.listenerPos = { x: px, y: py, z: pz };
  }

  // -- playback -------------------------------------------------------------

  _spawn(name, position, opts, loop) {
    if (!this.available) return null;
    const def = this.registry.get(name);
    if (!def) {
      if (!this._warned) this._warned = new Set();
      if (!this._warned.has(name)) { this._warned.add(name); console.warn('[audio] unknown sound:', name); }
      return null;
    }
    if (!this._budget(name, def, loop)) { this.stats.denied++; return null; }

    const v = new Voice(this, name, def, opts);
    v.loop = loop || !!def.loop;
    let handleOut;
    try {
      handleOut = v._build(opts, position);
    } catch (e) {
      v.kill();
      console.warn('[audio] voice build failed', name, e);
      return null;
    }

    const t = Math.max(this.now, this.now + (opts.delay || 0));
    let res;
    try {
      res = def.build({
        ctx: this.ctx, bag: v.bag, out: handleOut, t, engine: this,
        opts, rng: this.rng, name,
      });
    } catch (e) {
      v.kill();
      console.warn('[audio] build() threw for', name, e);
      if (this.onError) this.onError(e);
      return null;
    }

    let dur = def.dur ?? 1;
    if (typeof res === 'number') dur = res - t;
    else if (res && typeof res === 'object') {
      if (typeof res.dur === 'number') dur = res.dur;
      if (typeof res.end === 'number') dur = res.end - t;
      v._setFn = res.set || null;
      v._stopFn = res.stop || null;
    }
    v.endAt = v.loop ? Infinity : t + Math.max(0.02, dur) + 0.12;

    if (v.spatial) {
      this._updateVoiceOcclusion(v, true);
    }
    this.voices.push(v);
    this._nameCounts.set(name, (this._nameCounts.get(name) || 0) + 1);
    return v;
  }

  /** Concurrency budget: global cap, per-name cap, and oldest-one-shot theft. */
  _budget(name, def, loop) {
    const perName = def.maxVoices ?? (loop ? 4 : 5);
    const cur = this._nameCounts.get(name) || 0;
    if (cur >= perName) {
      // Steal the oldest instance of this same sound rather than refusing —
      // a machine-gun of footsteps should still sound like footsteps.
      const victim = this.voices.find((v) => v.name === name && !v.loop && !v.dead);
      if (victim) { victim.kill(); this._reapOne(victim); } else return false;
    }
    if (this.voices.length >= this.maxVoices) {
      let victim = null;
      for (const v of this.voices) {
        if (v.loop || v.dead) continue;
        if (!victim || v.priority < victim.priority
          || (v.priority === victim.priority && v.startedAt < victim.startedAt)) victim = v;
      }
      if (!victim || victim.priority > (def.priority ?? 1)) return false;
      victim.kill(); this._reapOne(victim);
    }
    return true;
  }

  _reapOne(v) {
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
    const c = this._nameCounts.get(v.name) || 0;
    this._nameCounts.set(v.name, Math.max(0, c - 1));
  }

  /** Non-positional one-shot. */
  play(name, opts = {}) { return this._spawn(name, null, opts, false); }

  /** Positional one-shot. `position` is a Vector3-ish or [x,y,z]. */
  playAt(name, position, opts = {}) { return this._spawn(name, position || { x: 0, y: 0, z: 0 }, opts, false); }

  /** Positional loop. Returns a handle: stop(), setPosition(), setParam(). */
  loopAt(name, position, opts = {}) {
    const v = this._spawn(name, position, opts, true);
    return v || nullHandle();
  }

  /** Non-positional loop (beds, music, 2D drones). */
  loop(name, opts = {}) {
    const v = this._spawn(name, null, { ...opts }, true);
    return v || nullHandle();
  }

  stopAll(fade = 0.25) {
    for (const v of this.voices) v.stop(fade);
  }
  stopByName(name, fade = 0.2) {
    for (const v of this.voices) if (v.name === name) v.stop(fade);
  }

  // -- occlusion ------------------------------------------------------------

  /**
   * One occlusion probe. `immediate` snaps the filter rather than gliding, used
   * when a voice is first created so it does not "open up" from behind a wall.
   */
  _updateVoiceOcclusion(v, immediate = false) {
    if (!v.spatial || v.dead || !this.available) return;
    const lp = this.listenerPos || (this.camera ? this.camera.position : null);
    if (!lp) return;
    const dx = v.pos.x - lp.x, dy = v.pos.y - lp.y, dz = v.pos.z - lp.z;
    const dist = Math.hypot(dx, dy, dz);
    v.dist = dist;

    let occ = 0;
    if (this.collision && dist > 0.6 && dist < 90) {
      // Probe from ear height, not from the camera's exact point, so a voice
      // does not flicker as the head bobs past a door frame.
      occ = this.collision.occlusion(lp.x, lp.y, lp.z, v.pos.x, v.pos.y, v.pos.z);
      this.stats.occlChecks++;
    }
    v.occlTarget = occ;

    const t = this.now;
    const tc = immediate ? 0.001 : 0.16;

    // 1. Lowpass: occlusion plus distance air absorption.
    const occCut = lerp(19000, 340, Math.pow(occ, 0.75));
    const airCut = 19000 * Math.exp(-dist * 0.028 * this.params.air);
    const cut = clamp(Math.min(occCut, airCut), 180, 20000);
    v.lpf.frequency.setTargetAtTime(cut, t, tc);

    // 2. Dry gain: -14 dB fully occluded, on top of the panner's distance law.
    const dry = lerp(1, 0.20, occ);
    v.voiceGain.gain.setTargetAtTime(
      dry * (v.def.gain ?? 1) * (v._userGain ?? 1), t, immediate ? 0.001 : 0.12);

    // 3. Reverb send: goes UP with occlusion. A muffled sound in another room
    //    is dominated by its reverberant field, which is what sells the wall.
    const ref = v.def.ref ?? 2.2;
    const distSend = clamp(ref / (ref + dist * 0.22), 0.10, 1);
    const send = v.sendBase * distSend * (1 + occ * 1.85);
    v.send.gain.setTargetAtTime(clamp(send, 0, 2.2), t, immediate ? 0.002 : 0.18);
    v.occl = occ;
  }

  // -- frame ----------------------------------------------------------------

  update(dt = 1 / 60) {
    if (!this.available) return;
    if (this.ctx.state === 'suspended') this.started = false;
    else this.started = true;

    this._updateListener();

    // Follow targets (an entity loop tied to a moving object).
    for (const v of this.voices) {
      if (v.dead || !v.follow) continue;
      const p = v.follow.position || v.follow;
      if (p) v.setPosition(p.x, p.y, p.z);
    }

    // Round-robin occlusion. Every spatial voice gets refreshed at
    // `occlusionRate` Hz, but never more than maxOccPerFrame probes per frame.
    const spatial = [];
    for (const v of this.voices) if (v.spatial && !v.dead) spatial.push(v);
    if (spatial.length) {
      this._occAccum += dt * this.occlusionRate * spatial.length;
      let budget = Math.min(this.maxOccPerFrame, Math.floor(this._occAccum));
      this._occAccum -= budget;
      while (budget-- > 0) {
        const v = spatial[this._occIndex % spatial.length];
        this._occIndex++;
        this._updateVoiceOcclusion(v, false);
      }
    } else {
      this._occAccum = 0;
    }

    // Reap.
    const now = this.now;
    let nodes = 0, oneShots = 0, loops = 0;
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const v = this.voices[i];
      if (v.dead || now >= v.endAt) {
        v.kill();
        this.voices.splice(i, 1);
        const c = this._nameCounts.get(v.name) || 0;
        this._nameCounts.set(v.name, Math.max(0, c - 1));
        continue;
      }
      nodes += v.bag.size;
      if (v.loop) loops++; else oneShots++;
    }
    this.stats.voices = this.voices.length;
    this.stats.nodes = nodes;
    this.stats.oneShots = oneShots;
    this.stats.loops = loops;
  }

  // -- offline rendering (QA) ----------------------------------------------

  /**
   * Render one registered sound into an AudioBuffer with no live context.
   * The QA probe uses this; nothing in the game does. Returns a Promise.
   *
   *   engine.renderOffline('step.concrete', { seconds: 2, opts: {...} })
   *
   * `params` is applied through the definition's own `set()` shortly after the
   * start, which is how loops (whose level is driven live) get a level at all.
   */
  async renderOffline(name, { seconds = 2.5, opts = {}, sampleRate = 48000, reverb = null, params = null } = {}) {
    const OC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OC) throw new Error('OfflineAudioContext unavailable');
    const def = this.registry.get(name);
    if (!def) throw new Error('unknown sound: ' + name);
    const ctx = new OC(2, Math.round(seconds * sampleRate), sampleRate);

    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    const out = ctx.createGain();
    out.gain.value = def.gain ?? 1;
    const pan = ctx.createStereoPanner();
    out.connect(pan); pan.connect(master);

    let wet = null;
    if (reverb) {
      const conv = ctx.createConvolver();
      conv.normalize = false;
      conv.buffer = renderIR(ctx, REVERB_PROFILES[reverb] || REVERB_PROFILES.corridor);
      wet = ctx.createGain();
      wet.gain.value = def.send ?? 0.3;
      out.connect(wet); wet.connect(conv); conv.connect(master);
    }

    const bag = new NodeBag();
    const t = 0.02;
    const res = def.build({ ctx, bag, out, t, engine: this, opts, rng: this.rng, name });
    if (params && res && typeof res.set === 'function') {
      for (const k in params) { try { res.set(k, params[k], t + 0.03); } catch { /* def bug */ } }
    }
    // Loops never end on their own; stop them just before the render finishes.
    if (def.loop || (res && res.dur === Infinity)) {
      const stopAt = seconds - 0.05;
      if (res && res.stop) { try { res.stop(stopAt, 0.03); } catch { /* def bug */ } }
      bag.stopAll(stopAt);
    }
    const buf = await ctx.startRendering();
    bag.dispose();
    return buf;
  }

  /** Convenience for the probe: render and analyse in one call. */
  async probe(name, opts = {}) {
    const buf = await this.renderOffline(name, opts);
    return { name, ...analyseBuffer(buf), buffer: buf };
  }
}

function nullHandle() {
  const h = {
    alive: false, id: 0,
    stop() { return h; }, setPosition() { return h; },
    setParam() { return h; }, setGain() { return h; }, kill() {},
  };
  return h;
}

export default AudioEngine;
