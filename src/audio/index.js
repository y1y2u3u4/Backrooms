/**
 * THE ANNEX — audio facade.
 * ===========================================================================
 * INTEGRATOR: this is the only file you need to read. Follow it literally.
 *
 *   import { createAudio } from './audio/index.js';
 *
 *   // 1. CONSTRUCT — during boot, after collision/rig/camera exist.
 *   //    Cheap: registers ~60 sound definitions, creates NO AudioContext.
 *   this.audio = createAudio({
 *     bus:       this.bus,          // required — core/util.js Bus
 *     collision: this.collision,    // required for occlusion (CollisionWorld)
 *     camera:    this.engine.camera,// required — drives the Web Audio listener
 *     rig:       this.rig,          // required for per-fixture fluorescent hum
 *   });
 *
 *   // 2. INIT — MUST be called from inside a user gesture (click / keydown).
 *   //    Returns Promise<boolean>. false = no audio; the game runs silent and
 *   //    every other call below becomes a safe no-op. Never blocks boot.
 *   canvas.addEventListener('click', () => this.audio.init(), { once: false });
 *
 *   // 3. UPDATE — once per frame, in Game.step(), AFTER player.update() so the
 *   //    camera matrix is current. Second argument is the LISTENER position
 *   //    (the player's eye), not the feet.
 *   this.audio.update(dt, this.engine.camera.position);
 *
 *   // 4. ZONE — on every zone change. Accepts a zone name from DESIGN.md §3
 *   //    ('intake', 'service', 'cistern', 'residence', 'plant', 'duct',
 *   //    'stack', 'safe') or a raw reverb profile key. Emitting `zone:enter`
 *   //    on the bus does this automatically; the call is here for scripted
 *   //    transitions.
 *   this.audio.setZone('cistern');
 *
 *   // 5. TEARDOWN (optional)
 *   this.audio.dispose();
 *
 * ---------------------------------------------------------------------------
 * WIRED AUTOMATICALLY FROM THE BUS — you do not need to call these yourself.
 *
 *   player:step   {surface, water, strength, crouch, left, position}  footsteps
 *   player:land   {force, surface}                                    landing
 *   zone:enter    {zone, from}                     reverb + ambience profile
 *   light:circuit {circuit, powered}               breaker/relay + hum settle
 *   entity:state  {entity, state, position}        the Surveyor / Attendant
 *   entity:heard  {position, radius}               head-plate tick
 *   item:pickup   {id, name}                       pickup one-shot
 *   story:note    {id, title, body}                paper + UI
 *   game:death    {cause}                          full duck, ambience out
 *   game:ending   {ending}                         the ending piece
 *   cine:begin / cine:end  {name}                  duck under cinematics
 *
 *   Escape hatches, if you would rather emit than call:
 *     bus.emit('audio:play',  { name, position?, opts? })
 *     bus.emit('audio:zone',  { zone })
 *     bus.emit('audio:duck',  { amount, seconds })
 *     bus.emit('audio:silence', { seconds })            // Silence.holdBreath
 *     bus.emit('audio:music', { cue })                  // Music.cue
 *     bus.emit('audio:emitter', { kind, position, ...}) // ambience emitters
 *
 * ---------------------------------------------------------------------------
 * ENTITY STATES accepted by `entity:state` (aliases in EntityAudio.js):
 *   dormant | spawn | approach | hunt | search | measure | frozen | capture |
 *   despawn        — for entity 'surveyor'
 *   step | breath | write | shift | any   — for entity 'attendant'
 *
 * ZONE-AUTHORED EMITTERS (see docs/INTEGRATION_REQUESTS_AUDIO.md):
 *   audio.addEmitter('vent',  [x,y,z], { gain, radius, tone })
 *   audio.addEmitter('drip',  [x,y,z], { vessel: 0..1 })
 *   audio.addEmitter('water', [x,y,z], { gain, radius })
 *   audio.addEmitter('transformer', [x,y,z], { freq: 100 })
 * ===========================================================================
 */

import { clamp01 } from '../core/util.js';
import { AudioEngine, REVERB_PROFILES, ZONE_REVERB } from './AudioEngine.js';
import { registerLibrary } from './Library.js';
import { Ambience, ZONE_AMBIENCE } from './Ambience.js';
import { Footsteps } from './Footsteps.js';
import { EntityAudio } from './EntityAudio.js';
import { Music } from './Music.js';
import { Silence } from './Silence.js';

/** Reverb profile key -> the zone whose ambience bed belongs with it. */
const REVERB_TO_ZONE = {
  corridor: 'intake', tiled: 'service', service: 'service', hall: 'plant',
  cistern: 'cistern', dead: 'residence', duct: 'duct', stack: 'stack', safe: 'safe',
};

export function createAudio({ bus = null, collision = null, camera = null, rig = null, options = {} } = {}) {
  const engine = new AudioEngine({
    collision, camera,
    maxVoices: options.maxVoices ?? 44,
    seed: options.seed ?? 20250729,
  });

  registerLibrary(engine);
  const ambience = new Ambience({ engine, bus, rig, collision, seed: options.seed ?? 4711 });
  const footsteps = new Footsteps({ engine, bus });
  const entity = new EntityAudio({ engine, bus });
  const music = new Music({ engine, bus });
  const silence = new Silence({ engine, ambience, music, bus });

  const subs = [];
  let initPromise = null;
  let started = false;
  let gestureHook = null;
  const listenerPos = { x: 0, y: 1.6, z: 0 };

  // -- bus wiring -----------------------------------------------------------

  if (bus) {
    subs.push(bus.on('zone:enter', (e) => api.setZone(e?.zone)));

    subs.push(bus.on('light:circuit', (e) => {
      if (!engine.available) return;
      // A breaker is a big, physical event; a circuit settling is a small one.
      const at = e?.position || listenerPos;
      engine.playAt('breaker.throw', at, { gain: 0.75 });
      if (e?.powered) {
        // Ballasts strike raggedly as a circuit comes back up.
        for (let i = 0; i < 3; i++) {
          engine.playAt('relay.click', at, { delay: 0.12 + Math.random() * 0.6, gain: 0.4 });
        }
      }
    }));

    subs.push(bus.on('item:pickup', (e) => {
      if (!engine.available) return;
      const isCore = /core|fuse/i.test(e?.id || e?.name || '');
      engine.play(isCore ? 'pickup.core' : 'pickup.item');
      if (isCore) music.cue('core');
    }));

    subs.push(bus.on('story:note', () => {
      if (!engine.available) return;
      engine.play('paper.take');
      engine.play('ui.note', { delay: 0.09 });
    }));

    subs.push(bus.on('game:death', () => {
      if (!engine.available) return;
      music.stop(1.2);
      silence.reset();
      engine.duck(0.95, 4.0, ['ambience', 'world', 'player', 'music']);
      ambience.setIntensity(0.05, 1.2);
      entity.silence(0.8);
    }));

    subs.push(bus.on('game:ending', (e) => {
      if (!engine.available) return;
      ambience.setIntensity(0.35, 6);
      music.cue('ending', { force: true });
    }));

    subs.push(bus.on('cine:begin', () => { if (engine.available) engine.setDuck(0.45, 1.2, ['ambience', 'world']); }));
    subs.push(bus.on('cine:end', () => { if (engine.available) engine.setDuck(0, 1.6, ['ambience', 'world']); }));

    // Escape hatches.
    subs.push(bus.on('audio:play', (e) => {
      if (!engine.available || !e?.name) return;
      if (e.position) engine.playAt(e.name, e.position, e.opts || {});
      else engine.play(e.name, e.opts || {});
    }));
    subs.push(bus.on('audio:zone', (e) => api.setZone(e?.zone)));
    subs.push(bus.on('audio:duck', (e) => engine.duck(e?.amount ?? 0.6, e?.seconds ?? 1.4)));
    subs.push(bus.on('audio:silence', (e) => silence.holdBreath(e?.seconds ?? 3.5, e || {})));
    subs.push(bus.on('audio:music', (e) => music.cue(e?.cue || e?.name, e || {})));
    subs.push(bus.on('audio:emitter', (e) => { if (e?.kind && e?.position) ambience.addEmitter(e.kind, e.position, e); }));
  }

  // -- facade ---------------------------------------------------------------

  const api = {
    engine, ambience, footsteps, entity, music, silence,

    /**
     * Start the AudioContext. MUST be called from a user gesture. Idempotent —
     * call it from every plausible gesture; only the first does work.
     * Resolves to `true` if audio is live, `false` if the game must run silent.
     */
    async init(opts = {}) {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        const ok = await engine.init({ zone: ZONE_REVERB[ambience.zone] || 'corridor', ...opts });
        if (!ok) {
          console.warn('[audio] running silent — AudioContext unavailable.');
          return false;
        }
        engine.setListener(camera);
        ambience.init();
        started = true;
        // If the browser suspended us anyway, take the next gesture.
        if (engine.ctx.state !== 'running') api._armGesture();
        return true;
      })();
      return initPromise;
    },

    /** Attach a one-shot listener that resumes a suspended context. */
    _armGesture() {
      if (gestureHook || typeof window === 'undefined') return;
      gestureHook = () => {
        engine.ctx?.resume?.().then(() => {
          if (engine.ctx.state === 'running') {
            window.removeEventListener('pointerdown', gestureHook);
            window.removeEventListener('keydown', gestureHook);
            gestureHook = null;
          }
        }).catch(() => {});
      };
      window.addEventListener('pointerdown', gestureHook);
      window.addEventListener('keydown', gestureHook);
    },

    /**
     * Once per frame, after the player and camera have updated.
     * @param {number} dt seconds
     * @param {{x,y,z}|number[]} playerPos listener position (the eye)
     */
    update(dt, playerPos) {
      if (!engine.available) return;
      // The camera IS the listener, so prefer it when one is bound; `playerPos`
      // is a fallback for a headless caller. Passing the player's feet instead
      // of the eye therefore costs nothing.
      if (camera && camera.position) {
        listenerPos.x = camera.position.x;
        listenerPos.y = camera.position.y;
        listenerPos.z = camera.position.z;
      } else if (playerPos) {
        listenerPos.x = playerPos.x ?? playerPos[0] ?? 0;
        listenerPos.y = playerPos.y ?? playerPos[1] ?? 1.6;
        listenerPos.z = playerPos.z ?? playerPos[2] ?? 0;
      }
      const d = Math.min(dt || 0, 0.1);
      engine.update(d);
      ambience.update(d, listenerPos);
      entity.update(d, listenerPos);
      footsteps.update(d, api.playerState);
      music.update(d);
      silence.update(d);
    },

    /** Optional: hand the facade the Player so breathing follows exertion. */
    playerState: null,
    bindPlayer(player) { api.playerState = player; return api; },

    /** Zone change: reverb profile + ambience profile in one call. */
    setZone(zone, fade = 1.4) {
      if (!zone) return api;
      // The engine resolves both zone names ('cistern') and raw reverb profile
      // keys ('hall'). The ambience only knows zone names, so a profile key is
      // mapped back to the zone that owns it — a builder returning
      // `reverb: 'hall'` should still get the Plant's ambience bed.
      engine.setZone(zone, fade);
      const ambKey = ZONE_AMBIENCE[zone] ? zone : REVERB_TO_ZONE[zone];
      if (ambKey) ambience.setZone(ambKey, fade * 2);
      return api;
    },

    // -- passthroughs the game will actually use ---------------------------
    play: (name, opts) => engine.play(name, opts),
    playAt: (name, pos, opts) => engine.playAt(name, pos, opts),
    loopAt: (name, pos, opts) => engine.loopAt(name, pos, opts),
    duck: (amount, seconds) => engine.duck(amount, seconds),
    holdBreath: (seconds, opts) => silence.holdBreath(seconds, opts),
    beat: (name, o) => silence.beat(name, o),
    cue: (name, o) => music.cue(name, o),
    setSafeRoom: (on) => music.setSafe(on),
    setMachineProximity: (v) => ambience.setMachineProximity(v),
    addEmitter: (kind, position, opts) => ambience.addEmitter(kind, position, opts),
    clearEmitters: () => ambience.clearEmitters(),
    setVolume: (v) => engine.setMasterVolume(v),
    setBusVolume: (name, v) => engine.setParam(name, v),
    toggleMute: () => engine.toggleMute(),

    get muted() { return engine.muted; },
    set muted(v) { engine.muted = v; },
    get ready() { return engine.available && started; },
    get running() { return engine.available && engine.ctx?.state === 'running'; },
    get names() { return engine.names; },
    get stats() {
      return {
        ...engine.stats,
        reverb: engine.currentReverb,
        zone: ambience.zone,
        hums: ambience.humVoices.length,
        state: engine.ctx?.state || 'none',
        music: music.stats,
        pressure: +silence.pressure.toFixed(2),
      };
    },

    dispose() {
      for (const u of subs) u();
      subs.length = 0;
      footsteps.detach();
      entity.detach();
      ambience.silence(0.1);
      engine.dispose();
    },
  };

  // The player's own gestures are the only reliable way in.
  if (typeof window !== 'undefined' && options.autoInit !== false) {
    const kick = () => { api.init(); };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  }

  return api;
}

export {
  AudioEngine, Ambience, Footsteps, EntityAudio, Music, Silence,
  REVERB_PROFILES, ZONE_REVERB, ZONE_AMBIENCE,
};
export default createAudio;
