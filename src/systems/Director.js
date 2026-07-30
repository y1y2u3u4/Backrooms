import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, smoothstep, makeRng } from '../core/util.js';
import { STATE as SURVEYOR_STATE } from '../entities/Surveyor.js';

/**
 * Director — pacing, fear, and the only place in the game allowed to decide
 * that something should happen.
 *
 * The thesis of this file is that **long stretches of nothing are the point.**
 * Horror games fail by being generous. If a beat lands every ninety seconds the
 * player learns the rhythm inside ten minutes and spends the rest of the game
 * waiting rather than listening. So:
 *
 *  * There is a hard **quiet floor**. No systemic beat may fire within
 *    `quietFloor` seconds of the last one, ever, for any reason. At the calmest
 *    setting that is nearly four minutes of authored, deliberate nothing.
 *  * There is a **puzzle grace**. The moment the player starts working on
 *    something — a keypad, a valve, a breaker board, a terminal — the Director
 *    stands down for `puzzleGrace` seconds. Being harassed while thinking is
 *    not tension, it is noise, and it teaches players to stop engaging with
 *    mechanisms.
 *  * Beats are **weighted by what has been quiet longest**, so the same trick
 *    never lands twice running, and the Attendant (which is by construction the
 *    subtlest option) is preferred while fear is already high. When the player
 *    is frightened the correct move is almost always to do less.
 *
 * Fear is a rendered quantity, not a score: it feeds `player.fear`, which the
 * camera uses for breath rate and bob, the hands use for tremor, and the audio
 * agent uses for the mix. Nothing displays it.
 */

const BEATS = {
  /** A door closes somewhere you have already been. */
  distant_door: { weight: 1.0, minFear: 0.0, cost: 0.10 },
  /** A lighting circuit drops out. The most useful beat: it changes the map. */
  circuit_trip: { weight: 0.85, minFear: 0.15, cost: 0.22 },
  /** The Attendant leaves evidence. Always available, always the best answer. */
  attendant: { weight: 1.35, minFear: 0.0, cost: 0.05 },
  /** Something heavy settles in the services. Pure atmosphere. */
  services: { weight: 1.1, minFear: 0.0, cost: 0.04 },
  /** The Surveyor wakes and walks. Expensive. Rationed hard. */
  rouse: { weight: 0.55, minFear: 0.25, cost: 0.65 },
  /** The lamp stutters once, for no reason. */
  lamp_stutter: { weight: 0.6, minFear: 0.30, cost: 0.08 },
};

export class Director {
  /**
   * @param {object} opts
   * @param {import('../player/Player.js').Player} opts.player
   * @param {import('../render/Lighting.js').LightRig} opts.rig
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {import('../entities/Surveyor.js').Surveyor} [opts.surveyor]
   * @param {import('../entities/Attendant.js').Attendant} [opts.attendant]
   * @param {import('../player/Flashlight.js').Flashlight} [opts.flashlight]
   * @param {import('../player/Inventory.js').Inventory} [opts.inventory]
   */
  constructor({
    player, rig, bus, surveyor = null, attendant = null, flashlight = null,
    inventory = null, interactor = null, seed = 0xd12ec7,
  }) {
    this.player = player;
    this.rig = rig;
    this.bus = bus;
    this.surveyor = surveyor;
    this.attendant = attendant;
    this.flashlight = flashlight;
    this.inventory = inventory;
    this.interactor = interactor;
    this.rng = makeRng(seed);

    // ---- pacing knobs ----
    this.quietFloor = 95;         // absolute minimum seconds between beats
    this.quietCeiling = 240;      // longest the Director will stay silent
    this.puzzleGrace = 50;        // stand-down after the player starts a puzzle
    this.intensity = 0.15;        // 0..1, rises with progress; scales everything

    // ---- runtime ----
    this.time = 0;
    // Seconds before the Surveyor is first placed in the world. See _ensureSpawned.
    this.firstSpawnAt = 22;
    this.firstSpawnRange = 26;
    this._spawnedOnce = false;
    this.sinceBeat = 40;          // start part-way in so the opening is not dead
    this.nextBeatAt = 150;
    this.graceUntil = 0;
    this.tension = 0;             // spent by beats, recovers over time
    this.fear = 0;
    this.zone = 'intake';
    this.objective = null;
    this.beatLog = [];
    this.enabled = true;

    // ---- death / respawn ----
    this.safeRooms = [];
    this.lastSafe = null;
    this.deaths = 0;
    this.dying = 0;               // >0 while the death sequence runs
    this.hidden = false;          // player is inside a locker/cupboard
    this.respawnDelay = 4.2;
    /**
     * Whether the death sequence puts the player back by itself.
     *
     * The UI ships a death screen with two options — "Report to the Office of
     * Record" and "Abandon shift" — so the authored intent is that the player
     * CHOOSES. With an unconditional timer here, the world would respawn behind a
     * modal screen and then respawn again when the button was pressed. `Game`
     * clears this when it has a UI that can offer the choice; without one (the
     * capture harness, a headless run) the timer stands and death still resolves.
     */
    this.autoRespawn = true;

    this._unsub = [];
    this._wire();
  }

  _wire() {
    const on = (k, fn) => this._unsub.push(this.bus.on(k, fn));

    on('zone:enter', (e) => {
      this.zone = e?.zone || this.zone;
      // A zone transition is itself an event; do not stack a beat on top of it.
      this.sinceBeat = Math.min(this.sinceBeat, this.quietFloor * 0.35);
    });

    // Any real engagement with a mechanism buys quiet.
    on('interact:use', (e) => {
      const puzzling = ['keypad', 'dial', 'terminal', 'valve', 'breaker', 'socket', 'pump', 'starter', 'lever', 'reader'];
      if (puzzling.includes(e?.kind)) this.grantGrace();
    });
    on('story:note', () => this.grantGrace(this.puzzleGrace * 0.6));

    on('hide:enter', () => { this.hidden = true; this.grantGrace(30); });
    on('hide:exit', () => { this.hidden = false; });

    on('game:death', (e) => this.onDeath(e));

    on('entity:state', (e) => {
      if (e?.entity !== 'surveyor') return;
      // Anything above SEEKING costs the Director its budget: it did not
      // schedule this, but it must not schedule anything else on top of it.
      if (e.state === SURVEYOR_STATE.ROUSED || e.state === SURVEYOR_STATE.APPROACHING) {
        this.sinceBeat = 0;
        this.tension = Math.max(this.tension, 0.7);
      }
      if (e.state === SURVEYOR_STATE.DORMANT) this.tension *= 0.5;
    });

    on('progress:objective', (e) => {
      this.objective = e?.objective ?? this.objective;
      this.intensity = clamp01(0.15 + (e?.completed ?? 0) * 0.13);
      this.grantGrace(this.puzzleGrace);
    });

    on('progress:safe', (e) => {
      if (e?.position) this.registerSafeRoom(e);
    });
  }

  // -- public ------------------------------------------------------------------

  /** Stand down for a while. Called whenever the player starts thinking. */
  grantGrace(seconds = this.puzzleGrace) {
    this.graceUntil = Math.max(this.graceUntil, this.time + seconds);
  }

  registerSafeRoom({ id, position, yaw = 0, zone = this.zone }) {
    const room = { id, position: Array.isArray(position) ? position.slice() : position.toArray(), yaw, zone };
    this.safeRooms.push(room);
    this.lastSafe = room;
    return room;
  }

  /** Called by Progression when the player enters somewhere survivable. */
  markSafe(id) {
    const r = this.safeRooms.find((s) => s.id === id);
    if (r) this.lastSafe = r;
  }

  // -- fear -----------------------------------------------------------------------

  /**
   * Fear is assembled from things the player can perceive, never from a hidden
   * timer. Every term is something they could point at afterwards and say "it
   * was because of that".
   */
  _computeFear(dt) {
    const p = this.player;
    let want = 0;

    // 1. Darkness where you are standing.
    const lum = this.rig ? this.rig.illuminationAt(p.position.x, p.position.y + 1.5, p.position.z) : 0;
    const lamp = this.flashlight?.beamStrength ?? 0;
    want += (1 - smoothstep(0.15, 2.6, lum + lamp * 2.2)) * 0.30;

    // 2. The lamp dying.
    const batt = this.flashlight?.battery ?? 1;
    want += (1 - smoothstep(0.06, 0.42, batt)) * 0.22;

    // 3. Proximity and state of the Surveyor.
    const s = this.surveyor;
    if (s?.active) {
      const d = s.position.distanceTo(p.position);
      const near = 1 - clamp01(d / 22);
      const stateMul = {
        [SURVEYOR_STATE.DORMANT]: 0.25,
        [SURVEYOR_STATE.ROUSED]: 0.85,
        [SURVEYOR_STATE.SEEKING]: 0.75,
        [SURVEYOR_STATE.MEASURING]: 0.55,
        [SURVEYOR_STATE.APPROACHING]: 1.0,
        [SURVEYOR_STATE.CAPTURING]: 1.0,
        [SURVEYOR_STATE.RETREATING]: 0.35,
      }[s.state] ?? 0.4;
      want += near * near * stateMul * 0.62;
    }

    // 4. Being encumbered — you cannot run and you know it.
    if (this.inventory?.handsFull) want += 0.12;

    // 4b. Being inside something. Hiding is not relief; it is a decision you
    // have already made and can no longer take back, and the breathing gets
    // very close.
    if (this.hidden) want += 0.30;

    // 5. Exertion bleeds into it.
    want += clamp01(p.exertion) * 0.10;

    want = clamp01(want * lerp(0.85, 1.15, this.intensity));

    // Fear rises quickly and subsides slowly. That asymmetry is the difference
    // between a scare that lingers and one that resets the moment you turn a
    // corner.
    this.fear = damp(this.fear, want, want > this.fear ? 2.6 : 0.42, dt);
    p.fear = this.fear;
    return this.fear;
  }

  // -- beats -----------------------------------------------------------------------

  _eligible() {
    const out = [];
    for (const [name, def] of Object.entries(BEATS)) {
      if (this.fear < def.minFear) continue;
      if (name === 'rouse' && (!this.surveyor || this.surveyor.state !== SURVEYOR_STATE.DORMANT)) continue;
      if (name === 'attendant' && !this.attendant) continue;
      if (name === 'circuit_trip' && !this.rig) continue;
      // The Director will not spend more tension than it has.
      if (def.cost > 1 - this.tension + 0.15) continue;
      // How long since this exact beat last played?
      const last = this.beatLog.filter((b) => b.name === name).pop();
      const age = last ? this.time - last.t : 1e9;
      if (age < 150) continue;
      // Preference for whatever has been silent longest, and for cheap beats
      // when the player is already frightened.
      const fearBias = lerp(1.0, 1.9, clamp01(this.fear)) * (def.cost < 0.15 ? 1 : 0.45);
      out.push({ name, def, score: def.weight * fearBias * clamp(age / 400, 0.2, 2.2) });
    }
    return out;
  }

  _fire(name) {
    const def = BEATS[name];
    this.tension = clamp01(this.tension + def.cost);
    this.sinceBeat = 0;
    this.nextBeatAt = lerp(this.quietCeiling, this.quietFloor, clamp01(this.intensity)) * this.rng.range(0.85, 1.25);
    this.beatLog.push({ name, t: this.time });
    if (this.beatLog.length > 60) this.beatLog.shift();
    this.bus.emit('director:beat', { name, fear: +this.fear.toFixed(2), zone: this.zone, t: this.time });

    const p = this.player.position;
    switch (name) {
      case 'distant_door': {
        // Somewhere behind, out of sight, at a plausible distance.
        const a = this.rng() * Math.PI * 2;
        const d = this.rng.range(16, 30);
        const pos = new THREE.Vector3(p.x + Math.sin(a) * d, p.y, p.z + Math.cos(a) * d);
        this.bus.emit('sfx:distant', { kind: 'door', position: pos });
        // The Surveyor hears it too. It is not a trick played on it, it is a
        // real event in the world, and it may well go and look.
        this.bus.emit('world:noise', { position: pos, radius: 11 });
        break;
      }
      case 'circuit_trip': {
        const live = [...this.rig.circuits.entries()].filter(([, c]) => c.powered && c.level > 0.5);
        if (!live.length) break;
        const [circuit] = this.rng.pick(live);
        if (circuit === 'emergency') break;
        this.rig.setCircuit(circuit, false);
        this.rig.invalidateShadows();
        this.bus.emit('light:circuit', { circuit, powered: false, cause: 'director' });
        this.bus.emit('sfx:trip', { circuit });
        break;
      }
      case 'attendant': {
        const kind = this.attendant.act();
        // Nothing was safely out of sight. Do not force it — try again sooner.
        if (!kind) { this.sinceBeat = this.nextBeatAt * 0.55; this.tension = Math.max(0, this.tension - def.cost); }
        break;
      }
      case 'services': {
        const a = this.rng() * Math.PI * 2;
        const d = this.rng.range(6, 18);
        this.bus.emit('sfx:services', {
          position: new THREE.Vector3(p.x + Math.sin(a) * d, p.y + this.rng.range(1, 3), p.z + Math.cos(a) * d),
          kind: this.rng.pick(['knock', 'settle', 'water', 'fan']),
        });
        break;
      }
      case 'rouse': {
        // It wakes where it already was, and it wakes because of something it
        // heard — never because the player has been quiet for too long.
        const a = this.rng() * Math.PI * 2;
        const d = this.rng.range(18, 34);
        const at = new THREE.Vector3(p.x + Math.sin(a) * d, p.y, p.z + Math.cos(a) * d);
        this.surveyor.rouse(at, 3.5);
        break;
      }
      case 'lamp_stutter': {
        if (this.flashlight) this.flashlight._restrikeT = 0;
        break;
      }
      default: break;
    }
  }

  // -- death / respawn ----------------------------------------------------------------

  onDeath({ cause = 'unknown' } = {}) {
    if (this.dying > 0) return;
    this.deaths++;
    this.dying = this.respawnDelay;
    this.player.frozen = true;
    this.player.controlEnabled = false;
    this.bus.emit('cine:begin', { name: 'death', cause });
  }

  /**
   * Respawn at the last safe room, with the world subtly changed.
   *
   * The changes are never punitive and never helpful. They exist so that the
   * player cannot treat a death as a reload: the building has had a moment to
   * itself, and something is different when you get back.
   */
  respawn() {
    const room = this.lastSafe || this.safeRooms[0];
    if (room) {
      this.player.teleport(room.position[0], room.position[1], room.position[2], room.yaw ?? 0);
    }
    this.player.frozen = false;
    this.player.controlEnabled = true;
    this.player.fear = 0.2;
    this.fear = 0.2;
    this.tension = 0;
    this.sinceBeat = 0;
    this.nextBeatAt = this.quietCeiling;
    this.grantGrace(40);

    if (this.surveyor) {
      this.surveyor.despawn();
      // It comes back somewhere else, and it is a little less patient.
      const a = this.rng() * Math.PI * 2;
      const d = 30;
      this.surveyor.spawnAt(
        this.player.position.x + Math.sin(a) * d, this.player.position.y,
        this.player.position.z + Math.cos(a) * d, a + Math.PI);
      this.surveyor.aggression = clamp01(this.surveyor.aggression + 0.12);
    }

    // The world changes: one circuit is different, and the Attendant has been
    // busy while you were not here.
    if (this.rig) {
      // Never the circuit lighting the zone the player is about to wake up in.
      //
      // The intent — "the world has changed while you were gone" — is good, and
      // one circuit being different is exactly the right size of change. But the
      // pick was uniform over every circuit in the building, so it could and did
      // choose the one carrying the zone the player respawns into. Measured in a
      // live session: the player was captured at 2:48, respawned, and the Intake's
      // 208 lit fixtures went out and stayed out for the remaining 145 seconds of
      // play, leaving the entrance zone lit by bounce fill alone with no way back
      // short of finding that breaker.
      //
      // A horror game may absolutely take the lights away. It should not do it to
      // the room you are standing in at the instant you regain control, because
      // that reads as a bug rather than as a threat — and this one was one.
      const here = this.zone;
      const all = [...this.rig.circuits.keys()]
        .filter((c) => c !== 'emergency' && c !== here && c !== 'main');
      if (all.length) {
        const c = this.rng.pick(all);
        this.rig.setCircuit(c, !this.rig.isPowered(c));
        this.rig.invalidateShadows();
      }
    }
    if (this.attendant) {
      this.attendant.reset({ keepHistory: false });
      this.attendant.globalCooldown = 0;
      // Two acts, immediately, both out of sight. The room you wake up in is
      // not quite the room you left.
      this.attendant.act();
      this.attendant.globalCooldown = 0;
      this.attendant.act();
    }
    // A small mercy: the lamp has been given a fresh cell by somebody.
    if (this.flashlight && this.flashlight.battery < 0.3) this.flashlight.setBattery(0.75);

    this.bus.emit('cine:end', { name: 'death' });
    this.bus.emit('game:respawn', { room: room?.id ?? null, deaths: this.deaths });
  }

  // -- per frame ----------------------------------------------------------------------

  /**
   * Put the Surveyor into the world the first time.
   *
   * THE DEFECT THIS FIXES: it was never there at all. `spawnAt` had exactly two
   * callers — `seedIntakeDemo`, which `Game.js` gates behind
   * `seedDemo: !this.subsystems.world` and therefore only runs when the world
   * module is ABSENT, and this class's own post-death respawn, which cannot fire
   * because nothing had killed the player. In the shipped build the monster in
   * the horror game never entered it. A continuous playthrough measured the
   * consequence directly: 100 % zero-threat time, zero entity state transitions,
   * fear peaking at 0.027 out of 1.
   *
   * It is placed DORMANT and far away, which is the state the demo seeding used:
   * nothing is emitted, nothing is audible, and the player has no way to know it
   * is there. What it does is make the zone one that CONTAINS something, so the
   * rest of the design — that it moves only in light, that it hunts by sound,
   * that the player's own lamp is what lets it advance — has something to act on.
   *
   * The delay exists so the first seconds of a session are still the player's own.
   */
  _ensureSpawned() {
    if (this._spawnedOnce || !this.surveyor) return;
    if (this.time < this.firstSpawnAt) return;
    this._spawnedOnce = true;
    if (this.surveyor.active) return;      // a zone or a script placed it already
    const a = this.rng() * Math.PI * 2;
    const d = this.firstSpawnRange;
    const p = this.player?.position;
    if (!p) return;
    this.surveyor.spawnAt(
      p.x + Math.sin(a) * d, p.y, p.z + Math.cos(a) * d, a + Math.PI);
    this.bus?.emit('director:entity-placed', { at: +this.time.toFixed(1), range: d });
  }

  update(dt) {
    this.time += dt;
    this._computeFear(dt);
    this._ensureSpawned();

    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) {
        this.dying = 0;
        if (this.autoRespawn) this.respawn();
        else this.bus.emit('death:settled', { deaths: this.deaths });
      }
      return;
    }
    if (!this.enabled) return;

    // Tension bleeds back to zero over a couple of minutes.
    this.tension = Math.max(0, this.tension - dt * 0.0085);
    this.sinceBeat += dt;

    // The three hard gates, in order. Every one of these is a *refusal to act*,
    // and refusing to act is most of this system's job.
    if (this.sinceBeat < this.quietFloor) return;
    if (this.time < this.graceUntil) return;
    if (this.sinceBeat < this.nextBeatAt) return;

    // Never while the Surveyor is already on the player.
    const s = this.surveyor;
    if (s?.active && (s.state === SURVEYOR_STATE.APPROACHING || s.state === SURVEYOR_STATE.CAPTURING)) return;
    // Never while the player is inside something.
    if (this.player.controlEnabled === false) return;

    const options = this._eligible();
    if (!options.length) { this.sinceBeat = this.nextBeatAt * 0.7; return; }
    let total = 0;
    for (const o of options) total += o.score;
    let r = this.rng() * total;
    for (const o of options) {
      r -= o.score;
      if (r <= 0) { this._fire(o.name); return; }
    }
    this._fire(options[options.length - 1].name);
  }

  dispose() { for (const u of this._unsub) u(); }

  debugState() {
    return {
      fear: +this.fear.toFixed(3),
      tension: +this.tension.toFixed(3),
      intensity: +this.intensity.toFixed(2),
      sinceBeat: +this.sinceBeat.toFixed(1),
      nextBeatAt: +this.nextBeatAt.toFixed(1),
      grace: +Math.max(0, this.graceUntil - this.time).toFixed(1),
      zone: this.zone,
      objective: this.objective,
      deaths: this.deaths,
      hidden: this.hidden,
      lastBeats: this.beatLog.slice(-4).map((b) => b.name),
    };
  }
}

export default Director;
