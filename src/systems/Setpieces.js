import * as THREE from 'three';

/**
 * Setpieces — the handful of things that happen exactly once.
 *
 * WHY THIS EXISTS.
 *
 * `Director` is a good systemic pacer and after this pass it works: it fires
 * three to five beats in nine minutes, uses four of its six kinds, and puts the
 * player above fear 0.3 for a fifth to a third of a session. What it cannot do,
 * by construction, is produce a moment. Every instant it generates is a sample
 * from the same distribution, so a player who has been in the building ten
 * minutes has nothing they would describe to somebody else afterwards — the
 * beats were all *a* door, *a* circuit, *a* noise in the services.
 *
 * The horror titles this is measured against mix a systemic layer with a small
 * number of authored ones. The system carries the minute-to-minute tension; the
 * authored moments are what the player remembers and what makes the systemic
 * layer feel like it might do anything. Six of these, fired on progression
 * events rather than on a timer, is cheap and is the difference between "the
 * building is tense" and "the building did something to me".
 *
 * RULES THESE FOLLOW, all of which are the Director's rules and are not relaxed:
 *
 *  * **Once each, ever.** A setpiece that can repeat is a system, and a worse
 *    one than the Director.
 *  * **Never during a capture, never inside a hiding place, never on the death
 *    screen.** The Director refuses to act in all three and so does this.
 *  * **They buy the Director quiet rather than stacking on top of it.** Each one
 *    calls `grantGrace`, so the systemic layer stands down while an authored
 *    moment plays and the two never talk over each other.
 *  * **Nothing here is a cutscene.** The player keeps the controls throughout.
 *    The one thing this project has that reliably ruins a scare is taking the
 *    body away, and `docs/EVALUATION_2026-07-31.md` §4 already measured an
 *    18-second intro with `controlEnabled` false.
 */

/**
 * @typedef {object} Setpiece
 * @property {string} id
 * @property {string} on       progression event id that arms it
 * @property {(ctx:object)=>void} play
 */

export class Setpieces {
  /**
   * @param {object} opts
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {import('../player/Player.js').Player} opts.player
   * @param {import('../render/Lighting.js').LightRig} opts.rig
   * @param {import('./Director.js').Director} [opts.director]
   * @param {import('../entities/Surveyor.js').Surveyor} [opts.surveyor]
   */
  constructor({ bus, player, rig, director = null, surveyor = null, attendant = null }) {
    this.bus = bus;
    this.player = player;
    this.rig = rig;
    this.director = director;
    this.surveyor = surveyor;
    this.attendant = attendant;
    this.fired = new Set();
    this.log = [];
    this._unsub = [];
    this._wire();
  }

  /** Everything the Director refuses to act through, this refuses too. */
  _allowed() {
    const d = this.director;
    if (!d || d.dying > 0 || d.hidden) return false;
    if (this.player?.controlEnabled === false) return false;
    const s = this.surveyor;
    if (s?.active && (s.state === 'APPROACHING' || s.state === 'CAPTURING')) return false;
    return true;
  }

  fire(id) {
    if (this.fired.has(id)) return false;
    const p = PIECES[id];
    if (!p || !this._allowed()) return false;
    this.fired.add(id);
    // An authored moment owns the room while it plays. The Director stands down
    // rather than firing a distant door over the top of it.
    this.director?.grantGrace?.(p.grace ?? 22);
    this.log.push({ id, t: +(this.director?.time ?? 0).toFixed(1) });
    this.bus.emit('setpiece', { id, at: +(this.director?.time ?? 0).toFixed(1) });
    try { p.play(this); } catch (e) { console.warn(`[setpiece:${id}]`, e); }
    return true;
  }

  _wire() {
    const on = (k, fn) => this._unsub.push(this.bus.on(k, fn));

    // Progression events, not a clock. A setpiece that fires at 4:00 whatever
    // the player is doing is a timer with a costume on.
    on('progress:complete', (e) => {
      const id = e?.id;
      if (id === 'reach_plant') this.fire('the_plant_answers');
      if (id === 'fit_cores') this.fire('the_set_turns_over');
    });
    on('pickup:taken', (e) => {
      if (e?.id === 'fuse_core' || e?.item === 'fuse_core') this.fire('first_core');
    });
    on('progress:discovery', (e) => {
      if (e?.id === 'office') this.fire('the_kettle');
    });
    on('zone:enter', (e) => {
      if (e?.zone === 'stack') this.fire('the_stack_goes_out');
      if (e?.zone === 'cistern') this.fire('something_in_the_water');
      // Arriving IS the moment. `progress:discovery` is the bookkeeping that
      // follows it, and hanging the piece off the bookkeeping meant the one
      // harness that walks the critical path never saw it fire. `fire` is
      // idempotent, so both triggers can stay.
      if (e?.zone === 'safe') this.fire('the_kettle');
    });

    on('game:death', () => { /* nothing authored fires on death; Death.js owns it */ });
  }

  update() { /* everything is event-driven; kept for symmetry with the systems */ }

  debugState() {
    return { fired: [...this.fired], count: this.fired.size, log: this.log.slice(-6) };
  }

  dispose() { for (const u of this._unsub) u(); }
}

// ---------------------------------------------------------------------------
// The pieces. Six, deliberately.
//
// Every one is built from primitives the game already has — a distant sound, a
// circuit, the Attendant, the Surveyor's own rouse — because a setpiece made of
// bespoke machinery is a setpiece that rots the first time the systems change.
// ---------------------------------------------------------------------------

const away = (p, min, max, rng = Math.random) => {
  const a = rng() * Math.PI * 2;
  const d = min + rng() * (max - min);
  return new THREE.Vector3(p.x + Math.sin(a) * d, p.y, p.z + Math.cos(a) * d);
};

const PIECES = {
  /**
   * FIRST CORE. The building notices you have taken something.
   *
   * A ceramic core is 22 kg and the loudest thing the player can carry. The
   * moment they pick the first one up, a long way off, a door closes — and the
   * Surveyor hears it too, because `world:noise` is a real event and not a
   * trick played on the entity. It goes to look, which means the first core is
   * also the moment the thing stops being somewhere else.
   */
  first_core: {
    grace: 26,
    play(s) {
      const p = s.player.position;
      const at = away(p, 22, 34);
      s.bus.emit('sfx:distant', { kind: 'door', position: at });
      s.bus.emit('world:noise', { position: at, radius: 14 });
    },
  },

  /**
   * THE STACK GOES OUT. The first time the player steps into the shaft.
   *
   * The Stack is eighteen metres of void with galleries receding into it, and
   * after this pass its high bays actually light the far wall. So it is worth
   * taking away: the way lighting drops out one storey at a time, from the
   * bottom up, and the player watches the floor they can see get smaller.
   * Emergency stays lit, which is what keeps it navigable and is the whole
   * reason that circuit exists.
   */
  the_stack_goes_out: {
    grace: 30,
    play(s) {
      if (!s.rig) return;
      s.bus.emit('sfx:trip', { circuit: 'stack' });
      s.rig.setCircuit('stack', false);
      s.rig.invalidateShadows?.();
      s.bus.emit('light:circuit', { circuit: 'stack', powered: false, cause: 'setpiece' });
      // And it comes back on its own, once, a long half-minute later — so the
      // player learns the building can do this and that waiting is a choice.
      s._stackRelight = 26;
      const tick = () => {
        s._stackRelight -= 1 / 60;
        if (s._stackRelight > 0) return;
        s.rig.setCircuit('stack', true);
        s.bus.emit('light:circuit', { circuit: 'stack', powered: true, cause: 'setpiece' });
        s.bus.off?.('entity:tick', tick);
      };
      s.bus.on('entity:tick', tick);
    },
  },

  /**
   * SOMETHING IN THE WATER. Entering the Cistern.
   *
   * The Cistern is the one room in the building with a surface that carries
   * sound, and the design brief calls it the zone that reads as dim rather than
   * unreadable. This does not light it: it puts one heavy displacement a long
   * way across the water, and nothing follows. The Surveyor is not placed and is
   * not roused. It is the only piece here that is purely a promise.
   */
  something_in_the_water: {
    grace: 24,
    play(s) {
      const p = s.player.position;
      const at = away(p, 16, 26);
      s.bus.emit('sfx:services', { position: at, kind: 'water' });
      s.bus.emit('world:noise', { position: at, radius: 9 });
    },
  },

  /**
   * THE PLANT ANSWERS. Reaching the Plant for the first time.
   *
   * The objective the player has been carrying since the first minute is "find
   * the Plant". Arriving is the one moment in the critical path that deserves
   * to land, and the honest way to land it is that the room is not inert: the
   * services settle, twice, close.
   */
  the_plant_answers: {
    grace: 20,
    play(s) {
      const p = s.player.position;
      s.bus.emit('sfx:services', { position: away(p, 8, 14), kind: 'settle' });
      let n = 0;
      const tick = () => {
        if (++n < 90) return;
        s.bus.emit('sfx:services', { position: away(p, 10, 18), kind: 'knock' });
        s.bus.off?.('entity:tick', tick);
      };
      s.bus.on('entity:tick', tick);
    },
  },

  /**
   * THE KETTLE. Finding the Office of Record.
   *
   * The induction form tells the player to "report to the nearest room with a
   * working kettle and log the discrepancy on a 12/D". The Office of Record is
   * the safe room and the only warm thing in the building. The Attendant has
   * been there: it leaves evidence, which is what the Attendant is for and what
   * it has never been asked to do at a moment that means anything.
   */
  the_kettle: {
    grace: 30,
    play(s) { s.attendant?.act?.(); },
  },

  /**
   * THE SET TURNS OVER. All three cores fitted.
   *
   * The player has spent most of the game carrying 22 kg objects across a
   * building that is hunting them. The moment the last one latches, everything
   * that has been quiet gets loud — and the Surveyor hears all of it. This is
   * the only piece that deliberately makes the player's life worse, and it is
   * placed where they have already won.
   */
  the_set_turns_over: {
    grace: 8,
    play(s) {
      const p = s.player.position;
      s.bus.emit('sfx:services', { position: away(p, 4, 8), kind: 'fan' });
      s.bus.emit('world:noise', { position: p.clone(), radius: 24 });
      // It heard that. It does not need telling twice.
      if (s.surveyor?.active) s.surveyor.rouse(p.clone(), 3.5);
    },
  },
};

export const SETPIECE_IDS = Object.keys(PIECES);
export default Setpieces;
