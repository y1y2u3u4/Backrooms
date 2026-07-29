/**
 * Sequencer — the Annex's timeline system.
 *
 * A cinematic here is a small program that borrows the camera, the post grade
 * and the player's control for a while, and is contractually obliged to give
 * all three back. The guarantees, in order of importance:
 *
 *  1. **Cleanup is not optional.** Everything a sequence touches is recorded at
 *     play time and restored on end, on skip, on interruption, on exception and
 *     on a second `play()` arriving mid-flight. A sequence cannot strand the
 *     player without controls; that is the single worst bug this system can
 *     have, so it is the one thing that is structurally impossible.
 *  2. **No linear camera moves.** Every move is a centripetal Catmull-Rom
 *     through its keys, eased, with the first key optionally taken from the
 *     live camera so a move can begin from wherever the player happened to be
 *     looking. Nothing snaps.
 *  3. **Skipping is real.** Skip runs the remaining cues in order with
 *     `ctx.skipped` set, snaps tweens and the camera to their final state, and
 *     then ends through the normal path — so a skipped sequence leaves the
 *     world in exactly the state a watched one does.
 *  4. **Audio is a callback, not a dependency.** Cues emit `cine:cue` on the
 *     bus. The audio agent listens. The sequencer never imports audio.
 *
 * Authoring uses a small fluent timeline:
 *
 *   ctx.track('intro', { duration: 26 })
 *      .lock({ control: true, look: false })
 *      .grade(0,   { uFade: 1 })
 *      .grade(0.4, { uFade: 0 }, 2.6)
 *      .camera(0, 8.5, [
 *        { pos: [0, 1.6, 4], look: [0, 1.5, -6] },
 *        { pos: [0, 1.6, -2], look: [0, 1.5, -9] },
 *      ], 'inOut')
 *      .audio(0.2, 'lift/gate_open')
 *      .cue(6.0, (c) => c.rig?.setCircuit('intake_a', false))
 *      .handOff(8.0)
 */

import * as THREE from 'three';
import { EASE, easeFn, catmullRom, clamp01 } from './ease.js';

// ---------------------------------------------------------------------------

class Timeline {
  constructor(name, opts = {}) {
    this.name = name;
    this.duration = opts.duration ?? 0;
    this.skippable = opts.skippable !== false;
    this.locks = { control: true, look: true, freeze: true, ...(opts.lock || {}) };
    this.hideHud = opts.hideHud !== false;
    this.cues = [];
    this.moves = [];
    this.handOffAt = null;
    this.handOffOpts = null;
    this._onEnd = null;
  }

  lock(o) { Object.assign(this.locks, o); return this; }

  /** Arbitrary callback at time `at`. Receives the run context. */
  cue(at, fn, { skipSafe = true } = {}) {
    this.cues.push({ at, fn, skipSafe });
    this.duration = Math.max(this.duration, at);
    return this;
  }

  /** Emit `cine:cue` for the audio agent. `params` is passed through verbatim. */
  audio(at, cue, params = {}) {
    return this.cue(at, (c) => c.emit(cue, params));
  }

  /** Subtitle convenience — routes through the UI facade if one is present. */
  caption(at, text, opts = {}) {
    return this.cue(at, (c) => c.ui?.subtitle?.({ text, ...opts }));
  }

  /** Grade tween on this sequence's own layer. `dur` 0 = immediate set. */
  grade(at, values, dur = 0, ease = 'fade') {
    return this.cue(at, (c) => {
      if (dur <= 0 || c.skipped) c.grade.set(values);
      else for (const [k, v] of Object.entries(values)) c.grade.to(k, v, dur, easeFn(ease));
    });
  }

  /**
   * Camera move.
   * @param {number} at start time
   * @param {number} dur duration (must be > 0)
   * @param {Array} keys  [{pos:[x,y,z], look?:[x,y,z], yaw?, pitch?, roll?, fov?}]
   *                      `pos` may be a function(ctx) for keys that depend on
   *                      runtime state (the player's actual position, a door).
   * @param {string|Function} ease
   * @param {object} [opts] { from:'current' } prepends the live camera pose
   */
  camera(at, dur, keys, ease = 'inOut', opts = {}) {
    this.moves.push({ at, dur: Math.max(0.0001, dur), keys, ease, from: opts.from || null });
    this.duration = Math.max(this.duration, at + dur);
    return this;
  }

  /** A shake impulse. Scaled by the player's motion-reduction setting. */
  shake(at, amount = 0.5, decay = 2.6) {
    return this.cue(at, (c) => c.shake(amount, decay));
  }

  /**
   * Give control back at `at` while the camera is still moving. The player's
   * yaw/pitch/position are synced to the camera every frame from this point on,
   * so look input starts working mid-move with no discontinuity.
   */
  handOff(at, opts = {}) {
    this.handOffAt = at;
    this.handOffOpts = opts;
    this.duration = Math.max(this.duration, at);
    return this;
  }

  /** Runs on every exit path: natural end, skip, interruption, error. */
  onEnd(fn) { this._onEnd = fn; return this; }

  /** Extend the timeline without adding a cue (holds on black, etc). */
  hold(until) { this.duration = Math.max(this.duration, until); return this; }
}

// ---------------------------------------------------------------------------

const _v = new THREE.Vector3();
const _look = new THREE.Vector3();

export function createSequencer({ bus, engine, player, deck, ui = null, rig = null, game = null } = {}) {
  const registry = new Map();
  const camera = engine?.camera || null;

  let run = null;          // the active run, or null
  let shakeAmt = 0, shakeDecay = 2.6, shakeT = 0;
  let motionScale = 1;

  // ---- run lifecycle -----------------------------------------------------

  function capture() {
    return {
      frozen: player?.frozen ?? false,
      controlEnabled: player?.controlEnabled ?? true,
      lookEnabled: player?.lookEnabled ?? true,
      fovOffset: player?.fovOffset ?? 0,
      camFov: camera?.fov ?? 66,
      yaw: player?.yaw ?? 0,
      pitch: player?.pitch ?? 0,
      autoExposure: engine?.grade?.uniforms?.uAutoExposure?.value ?? 1,
    };
  }

  function restore(saved) {
    if (player) {
      player.frozen = saved.frozen;
      player.controlEnabled = saved.controlEnabled;
      player.lookEnabled = saved.lookEnabled;
      player.fovOffset = saved.fovOffset;
    }
    if (camera && Math.abs(camera.fov - saved.camFov) > 0.001) {
      camera.fov = saved.camFov;
      camera.updateProjectionMatrix();
    }
  }

  function buildMoves(track, ctx) {
    return track.moves.map((m, mi) => {
      const keys = m.keys.map((k) => {
        const pos = typeof k.pos === 'function' ? k.pos(ctx) : k.pos;
        const look = typeof k.look === 'function' ? k.look(ctx) : k.look;
        return { ...k, pos: toV(pos), look: look ? toV(look) : null };
      });
      if (m.from === 'current' && camera) {
        const p = camera.position;
        const l = new THREE.Vector3(0, 0, -4).applyQuaternion(camera.quaternion).add(p);
        keys.unshift({ pos: { x: p.x, y: p.y, z: p.z }, look: { x: l.x, y: l.y, z: l.z }, fov: camera.fov });
      }
      // Any move that mixes aim-point and yaw/pitch keys is normalised to
      // aim points, because a camera cannot be interpolated two ways at once.
      const usesLook = keys.some((k) => k.look);
      if (usesLook) {
        for (const k of keys) {
          if (k.look) continue;
          const yaw = k.yaw ?? 0, pitch = k.pitch ?? 0;
          k.look = {
            x: k.pos.x - Math.sin(yaw) * Math.cos(pitch) * 4,
            y: k.pos.y + Math.sin(pitch) * 4,
            z: k.pos.z - Math.cos(yaw) * Math.cos(pitch) * 4,
          };
        }
      } else {
        // Unwrap yaw so the shortest path is taken across the ±pi seam.
        let prev = keys[0].yaw ?? 0;
        for (const k of keys) {
          let y = k.yaw ?? prev;
          while (y - prev > Math.PI) y -= Math.PI * 2;
          while (prev - y > Math.PI) y += Math.PI * 2;
          k.yaw = y; prev = y;
        }
      }
      const fovs = keys.map((k) => ({ x: k.fov ?? camera?.fov ?? 66, y: 0, z: 0 }));
      const rolls = keys.map((k) => ({ x: k.roll ?? 0, y: 0, z: 0 }));
      const pts = keys.map((k) => k.pos);
      const looks = usesLook ? keys.map((k) => k.look) : null;
      const yps = usesLook ? null : keys.map((k) => ({ x: k.yaw ?? 0, y: k.pitch ?? 0, z: 0 }));
      return { ...m, index: mi, keys, pts, looks, yps, fovs, rolls, ease: easeFn(m.ease) };
    });
  }

  function toV(a) {
    if (!a) return { x: 0, y: 0, z: 0 };
    if (Array.isArray(a)) return { x: a[0], y: a[1], z: a[2] };
    return { x: a.x, y: a.y, z: a.z };
  }

  const _tmpA = { x: 0, y: 0, z: 0 }, _tmpB = { x: 0, y: 0, z: 0 }, _tmpC = { x: 0, y: 0, z: 0 };

  function applyMove(mv, u) {
    if (!camera) return;
    const e = mv.ease(clamp01(u));
    catmullRom(mv.pts, e, _tmpA);
    camera.position.set(_tmpA.x, _tmpA.y, _tmpA.z);

    if (mv.looks) {
      catmullRom(mv.looks, e, _tmpB);
      _look.set(_tmpB.x, _tmpB.y, _tmpB.z);
      _v.copy(_look).sub(camera.position);
      const yaw = Math.atan2(-_v.x, -_v.z);
      const pitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    } else {
      catmullRom(mv.yps, e, _tmpB);
      camera.rotation.set(_tmpB.y, _tmpB.x, 0, 'YXZ');
    }
    catmullRom(mv.rolls, e, _tmpC);
    camera.rotation.z += _tmpC.x;

    catmullRom(mv.fovs, e, _tmpC);
    if (Math.abs(camera.fov - _tmpC.x) > 0.01) { camera.fov = _tmpC.x; camera.updateProjectionMatrix(); }
  }

  function makeContext(track, params) {
    const layer = deck.layer(`cine:${track.name}`, 100);
    const ctx = {
      bus, engine, player, camera, rig, game, ui, params,
      grade: layer, deck,
      skipped: false, t: 0, name: track.name,
      /** Emit an audio cue for whoever is listening. */
      emit(cue, extra = {}) {
        bus?.emit('cine:cue', { sequence: track.name, cue, at: ctx.t, ...extra });
      },
      shake(amount, decay = 2.6) { shakeAmt = Math.max(shakeAmt, amount * motionScale); shakeDecay = decay; },
      /** Build a timeline. Provided so sequence modules need no imports. */
      track: (n, o) => new Timeline(n, o),
      /** Convenience: current player eye position as an array. */
      eye() {
        if (!player) return [0, 1.6, 0];
        return [player.position.x, player.position.y + player.eyeHeight, player.position.z];
      },
      forward(d = 1) {
        const y = player?.yaw ?? 0;
        const e = ctx.eye();
        return [e[0] - Math.sin(y) * d, e[1], e[2] - Math.cos(y) * d];
      },
    };
    return ctx;
  }

  function finish(reason) {
    if (!run) return;
    const r = run;
    run = null;
    try { r.track._onEnd?.(r.ctx, reason); }
    catch (e) { console.error(`[cine:${r.track.name}] onEnd`, e); }

    restore(r.saved);
    if (player && r.handedOff !== true && camera) syncPlayerToCamera(r);
    if (player) { player.frozen = r.saved.frozen; }

    if (reason.immediate) { r.ctx.grade.clear(); deck.drop(`cine:${r.track.name}`); }
    else r.ctx.grade.retire(0.36);

    shakeAmt = 0;
    ui?._cineEnd?.(r.track.name);
    bus?.emit('cine:end', { name: r.track.name, skipped: !!reason.skipped, interrupted: !!reason.interrupted });
    r.resolve({ name: r.track.name, ...reason });
  }

  /** Put the player exactly where the camera ended up, so nothing jumps. */
  function syncPlayerToCamera(r) {
    if (!player || !camera) return;
    const e = camera.rotation;
    player.yaw = e.y;
    player.pitch = Math.max(-1.48, Math.min(1.48, e.x));
    if (r.track.handOffAt !== null || r.movedPlayer) {
      player.position.set(camera.position.x, player.position.y, camera.position.z);
    }
    player._fovNow = camera.fov;
    player.viewRoll = 0;
  }

  // ---- public ------------------------------------------------------------

  const api = {
    /** @param {string} name @param {(ctx)=>Timeline} factory */
    register(name, factory) { registry.set(name, factory); return api; },
    registerAll(map) { for (const [k, v] of Object.entries(map)) registry.set(k, v); return api; },
    has(name) { return registry.has(name); },
    get current() { return run ? run.track : null; },
    get active() { return !!run; },
    get elapsed() { return run ? run.t : 0; },
    /** Motion-reduction setting, 0..1. Scales shake only; camera paths are art. */
    setMotionScale(v) { motionScale = Math.max(0, Math.min(1, v)); },

    /**
     * Play a registered sequence, or a Timeline built elsewhere.
     * @returns {Promise<{name,skipped,interrupted}>} resolves on every exit path
     */
    play(nameOrTrack, params = {}) {
      if (run) finish({ interrupted: true, immediate: true });

      let track, ctx;
      try {
        if (nameOrTrack instanceof Timeline) {
          track = nameOrTrack;
          ctx = makeContext(track, params);
        } else {
          const factory = registry.get(nameOrTrack);
          if (!factory) {
            console.warn(`[cine] no sequence "${nameOrTrack}"`);
            return Promise.resolve({ name: nameOrTrack, missing: true });
          }
          const probe = makeContext({ name: nameOrTrack }, params);
          track = factory(probe, params);
          ctx = makeContext(track, params);
          ctx.grade = probe.grade;   // keep the layer the factory may have used
        }
      } catch (e) {
        console.error('[cine] build failed', e);
        return Promise.resolve({ name: String(nameOrTrack), error: true });
      }

      const saved = capture();
      if (player) {
        if (track.locks.freeze) player.frozen = true;
        if (track.locks.control) player.controlEnabled = false;
        if (track.locks.look) player.lookEnabled = false;
      }

      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      const cues = [...track.cues].sort((a, b) => a.at - b.at);
      run = {
        track, ctx, saved, resolve, promise,
        t: 0, next: 0, cues,
        moves: buildMoves(track, ctx),
        handedOff: false, movedPlayer: track.moves.length > 0,
      };

      ui?._cineBegin?.(track.name, track.skippable);
      bus?.emit('cine:begin', { name: track.name, duration: track.duration, skippable: track.skippable });

      // Frame 0: put the camera on the first key straight away so there is
      // never a single frame of the player's own view leaking through.
      if (run.moves.length && run.moves[0].at <= 0) applyMove(run.moves[0], 0);
      return promise;
    },

    /** Fast-forward the active sequence through its own ending. */
    skip() {
      if (!run || !run.track.skippable) return false;
      const r = run;
      r.ctx.skipped = true;
      for (let i = r.next; i < r.cues.length; i++) {
        try { r.cues[i].fn(r.ctx); } catch (e) { console.error(`[cine:${r.track.name}] cue`, e); }
      }
      r.next = r.cues.length;
      r.ctx.grade.finish();
      const last = r.moves[r.moves.length - 1];
      if (last) applyMove(last, 1);
      r.t = r.track.duration;
      finish({ skipped: true });
      return true;
    },

    /** Abort. `immediate` skips the grade fade-out — used on teardown. */
    stop(immediate = false) {
      if (!run) return false;
      finish({ interrupted: true, immediate });
      return true;
    },

    /** Call once per frame, AFTER player.update, BEFORE engine.render. */
    update(dt) {
      // Shake decays whether or not a sequence is running, so an interrupted
      // sequence cannot leave the camera vibrating.
      if (shakeAmt > 0.0001) {
        shakeAmt *= Math.exp(-shakeDecay * dt);
        shakeT += dt;
        if (camera) {
          const a = shakeAmt;
          camera.rotation.x += Math.sin(shakeT * 47.3) * 0.010 * a;
          camera.rotation.y += Math.sin(shakeT * 38.9 + 1.7) * 0.012 * a;
          camera.rotation.z += Math.sin(shakeT * 29.1 + 3.1) * 0.008 * a;
        }
      } else shakeAmt = 0;

      if (!run) return;
      const r = run;
      r.t += dt;
      r.ctx.t = r.t;

      while (r.next < r.cues.length && r.cues[r.next].at <= r.t) {
        const c = r.cues[r.next++];
        try { c.fn(r.ctx); } catch (e) { console.error(`[cine:${r.track.name}] cue @${c.at}`, e); }
      }

      let active = null;
      for (const mv of r.moves) {
        if (r.t < mv.at) continue;
        if (r.t <= mv.at + mv.dur || !active) active = mv;
      }
      if (active) {
        const u = clamp01((r.t - active.at) / active.dur);
        applyMove(active, u);
      }

      // Hand-off: player takes look control while the dolly finishes.
      const ho = r.track.handOffAt;
      if (ho !== null && !r.handedOff && r.t >= ho) {
        r.handedOff = true;
        if (player) {
          player.frozen = false;
          player.controlEnabled = r.track.handOffOpts?.control !== false;
          player.lookEnabled = true;
          syncPlayerToCamera(r);
          const v = r.track.handOffOpts?.velocity;
          if (v) player.velocity.set(v[0], v[1] ?? 0, v[2]);
        }
      }
      if (r.handedOff && player && active) {
        // The dolly still owns position; the player owns aim. Feed the player's
        // live yaw/pitch back into the camera so look input reads immediately.
        camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
        player.position.set(camera.position.x, player.position.y, camera.position.z);
      }

      if (r.t >= r.track.duration) finish({ completed: true });
    },

    /** Tear everything down (page unload, scene rebuild). */
    dispose() { api.stop(true); registry.clear(); },
  };

  return api;
}

export { Timeline, EASE };
export default createSequencer;
