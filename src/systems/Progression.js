import { clamp, clamp01 } from '../core/util.js';

/**
 * Progression — the critical path, the gates, and the endings.
 *
 * The spine of the game is four sentences long:
 *
 *   Get to the Plant. Find three supply cores. Fit them and start the set.
 *   Ride the goods lift out.
 *
 * Everything else — every note, every locked door, every drowned corridor — is
 * arranged around those four sentences. This file is the only place that knows
 * the order, so a zone builder can be written, moved or deleted without the
 * critical path silently breaking.
 *
 * Design notes:
 *
 *  * **Objectives are descriptions, not instructions.** "Three cores. One
 *    behind the penstocks." The game never says GO TO THE CISTERN, because the
 *    player working out where the penstocks are is the game.
 *  * **Gates are diegetic.** A portal is never "locked because the plot says
 *    so": it is chained, or it is under water, or the lift has no supply. Every
 *    `gate()` call names the reason, and the reason is what the prompt shows.
 *  * **The alternate ending is hidden and is not better.** It is available only
 *    to a player who found Docket 0000, understood it, and then chose to walk
 *    away from the lift they spent the whole game earning.
 */

/** @typedef {{id:string,title:string,detail:string,state:'hidden'|'active'|'done',zone:string}} Objective */

const OBJECTIVES = [
  {
    id: 'reach_plant',
    title: 'Find the Plant',
    detail: 'Way 8 feeds the goods lift and Way 8 is dead. The Plant is below the Service Spine.',
    zone: 'spine',
  },
  {
    id: 'core_cistern',
    title: 'Supply core — the Cistern',
    detail: 'One core is in the penstock room. The permit says both valves matter and it is lying.',
    zone: 'cistern',
  },
  {
    id: 'core_residence',
    title: 'Supply core — R-207',
    detail: 'Cards issued before October will not open R-207. The warden carries one that will.',
    zone: 'residence',
  },
  {
    id: 'core_stack',
    title: 'Supply core — the Stack',
    detail: 'The lift lobby is on Way 7. Nothing runs in the Stack without lighting.',
    zone: 'stack',
  },
  {
    id: 'fit_cores',
    title: 'Fit all three cores',
    detail: 'Set No. 2, socket bank on the alternator end. They latch.',
    zone: 'plant',
  },
  {
    id: 'start_set',
    title: 'Start Set No. 2',
    detail: 'Fuel valve, primer until firm, starter. Fifteen seconds maximum on the starter.',
    zone: 'plant',
  },
  {
    id: 'ride_out',
    title: 'Ride the goods lift out',
    detail: 'It will travel exactly once before the interlock resets.',
    zone: 'plant',
  },
];

/** Optional discoveries. None of these are required; all of them are noticed. */
const DISCOVERIES = [
  { id: 'notebook', title: "Kearns' notebook", need: 5, detail: 'Five loose pages, kept against procedure.' },
  { id: 'tapes', title: 'The tapes', need: 6, detail: 'Six cassettes. One has been recorded over.' },
  { id: 'sealed', title: 'Incident 0031', need: 1, detail: 'The sealed record on the terminal in the Office of Record.' },
  { id: 'office', title: 'The Office of Record', need: 1, detail: 'A room with a working kettle.' },
  { id: 'docket', title: 'Docket 0000', need: 1, detail: 'A day-work sheet made out in your name.' },
];

export const ENDINGS = {
  /** Ride the lift. The intended ending. */
  LEFT: 'left',
  /** Start the set, then walk away from the car and file the docket. */
  STAYED: 'stayed',
  /** Never started the set and rode the lift anyway. It only goes down. */
  DESCENDED: 'descended',
};

export class Progression {
  /**
   * @param {object} opts
   * @param {import('../core/util.js').Bus} opts.bus
   * @param {import('../player/Inventory.js').Inventory} opts.inventory
   * @param {import('./Notes.js').NotesLibrary} opts.notes
   * @param {import('./Interactables.js').Interactables} [opts.interactables]
   * @param {import('../player/Interactor.js').Interactor} [opts.interactor]
   * @param {import('./Director.js').Director} [opts.director]
   */
  constructor({ bus, inventory, notes, interactables = null, interactor = null, director = null, player = null }) {
    this.bus = bus;
    this.inventory = inventory;
    this.notes = notes;
    this.interactables = interactables;
    this.interactor = interactor;
    this.director = director;
    this.player = player;

    /** @type {Objective[]} */
    this.objectives = OBJECTIVES.map((o, i) => ({ ...o, state: i === 0 ? 'active' : 'hidden' }));
    this.discoveries = DISCOVERIES.map((d) => ({ ...d, count: 0, done: false }));

    this.coresFound = 0;
    this.coresFitted = 0;
    this.setRunning = false;
    this.liftPowered = false;
    this.ended = null;
    this.startTime = 0;
    this.time = 0;

    /** @type {Map<string,{id:string, locked:boolean, reason:string, group:string|null}>} */
    this.portals = new Map();
    /** Gate state by group name, so late-built zones inherit it. */
    this.groups = new Map();
    this._unsub = [];
    this._wire();
  }

  // -- objectives ---------------------------------------------------------------

  get current() { return this.objectives.find((o) => o.state === 'active') || null; }
  get completed() { return this.objectives.filter((o) => o.state === 'done').length; }

  objective(id) { return this.objectives.find((o) => o.id === id) || null; }

  /** Reveal an objective without completing it. */
  reveal(id) {
    const o = this.objective(id);
    if (!o || o.state !== 'hidden') return false;
    o.state = 'active';
    this._announce();
    return true;
  }

  complete(id) {
    const o = this.objective(id);
    if (!o || o.state === 'done') return false;
    o.state = 'done';
    // Reveal whatever the completion unblocks.
    // The three core hunts are revealed together — they are parallel, not a
    // sequence, and pretending otherwise would railroad the whole midgame.
    // Everything else reveals strictly one at a time.
    const idx = this.objectives.indexOf(o);
    let revealedCore = false;
    for (let i = idx + 1; i < this.objectives.length; i++) {
      const n = this.objectives[i];
      if (n.state !== 'hidden') continue;
      const isCore = n.id.startsWith('core_');
      if (!isCore && revealedCore) break;
      n.state = 'active';
      if (!isCore) break;
      revealedCore = true;
    }
    this.bus.emit('progress:complete', { id, title: o.title });
    this._announce();
    return true;
  }

  _announce() {
    const cur = this.current;
    this.bus.emit('progress:objective', {
      objective: cur ? cur.id : null,
      title: cur?.title ?? null,
      detail: cur?.detail ?? null,
      completed: this.completed,
      total: this.objectives.length,
      list: this.objectives.filter((o) => o.state !== 'hidden'),
    });
  }

  // -- portals -----------------------------------------------------------------

  /**
   * Register a portal so the critical path can gate it. `reason` is player-facing
   * text: it is what the door prompt says when it refuses.
   *
   * GROUPS. The critical path talks about "the way into the Residence", not
   * about `to_residence` in the Service Spine and `to_residence` in the Stack —
   * and there are two of those, authored independently in two zone files, which
   * both have to be shut for the gate to mean anything. A portal therefore joins
   * a named `group`, and gate() addresses either a single id or a whole group.
   *
   * The group's state is remembered, so a portal registered later — a zone the
   * player has not reached yet, built on demand by the streamer — arrives already
   * carrying whatever lock the group is under. Without that, walking away from a
   * zone and back would silently unlock its doors.
   */
  /**
   * A PORTAL ID IS NOT UNIQUE, AND THIS MAP USED IT AS A KEY.
   *
   * `to_plant` is declared by three different zone files — the Service Spine's
   * lobby door (open, on the critical path), the Ductwork's hatch (open) and the
   * Cistern's ladder hatch, which carries `{ locked: true }`. Zones are built on
   * demand as the player reaches them, so the registration order is the player's
   * route, and `portals.set(portal.id, p)` meant the last one to build won. Take
   * the ordinary route and detour through the Cistern first, and `isGated
   * ('to_plant')` starts answering for the Cistern's locked ladder — reporting
   * the Service Spine's main door to the Plant as shut, with nothing in the game
   * able to open it.
   *
   * It has never been seen because every harness in `tools/qa` changes zone by
   * teleport. No gated portal has ever been walked through.
   *
   * The map is now keyed by `zone:id`, which is unique. Bare-id lookups still
   * work — `_resolve` prefers the portal in the zone the player is standing in,
   * which is the one they are looking at — so every existing call site is
   * unaffected, including `installDefaultGates` and the group machinery.
   */
  registerPortal(portal, { locked = false, reason = '', group = null } = {}) {
    const g = group ? this.groups.get(group) : null;
    const p = {
      id: portal.id, zone: portal.zone ?? null, portal, group,
      locked: g ? g.locked : locked,
      reason: g && g.reason ? g.reason : reason,
    };
    this.portals.set(`${p.zone ?? '?'}:${p.id}`, p);
    if (group && !this.groups.has(group)) this.groups.set(group, { locked, reason });
    if (portal) portal.locked = p.locked;
    return p;
  }

  /** Every registered portal carrying this bare id, nearest zone first. */
  _byId(id) {
    const here = this.player?.game?.currentZone ?? this.director?.zone ?? null;
    const hits = [];
    for (const p of this.portals.values()) if (p.id === id) hits.push(p);
    hits.sort((a, b) => (b.zone === here ? 1 : 0) - (a.zone === here ? 1 : 0));
    return hits;
  }

  /** One portal for a bare id — the one in the zone the player is in, if any. */
  /**
   * One portal for a bare id — and NEVER an arbitrary one.
   *
   * This returned `_byId(id)[0]`, which for a unique id is right and for a
   * homonym is a coin toss weighted by whichever zone happened to build first.
   * `to_plant` names three doors and one of them is authored shut, so a caller
   * that forgot to pass a zone could still be told the Service Spine's lobby
   * door was locked — the same critical-path break as the union, reachable by
   * dropping one argument at one call site. A check that compares
   * `isGated(id, zone)` against the registration cannot see that, because with a
   * zone the two are the same expression.
   *
   * So an ambiguous bare id with nothing in the player's current zone resolves
   * to null, and null reads as open. A door nobody can identify must not be
   * allowed to shut the building.
   */
  _resolve(id) {
    const direct = this.portals.get(id);
    if (direct) return direct;
    const hits = this._byId(id);
    if (hits.length <= 1) return hits[0] || null;
    const here = this.player?.game?.currentZone ?? this.director?.zone ?? null;
    return hits.find((p) => p.zone === here) || null;
  }

  /** @param {string} key a portal id, or a group name. */
  gate(key, locked, reason = '') {
    const targets = [];
    // A bare id may now name more than one portal (see registerPortal). Gating
    // `to_plant` must gate every door called that, not whichever built last.
    const direct = this._byId(key);
    for (const d of direct) targets.push(d);
    if (this.groups.has(key) || !direct.length) {
      const g = this.groups.get(key) || { locked, reason };
      g.locked = locked;
      if (reason) g.reason = reason;
      this.groups.set(key, g);
      for (const p of this.portals.values()) if (p.group === key) targets.push(p);
    }
    if (!targets.length) return false;
    for (const p of targets) {
      p.locked = locked;
      if (reason) p.reason = reason;
      if (p.portal) p.portal.locked = locked;
      // Keep any door interactable in step with the portal.
      const latch = this.interactor?.door(p.id);
      if (latch) { latch.locked = locked; latch.label = reason || latch.label; }
      this.bus.emit('portal:gate', { id: p.id, locked, reason: p.reason });
    }
    return true;
  }

  /**
   * Is THIS door shut? Not "is any door with this name shut".
   *
   * The re-keying that fixed the last-build-wins collision introduced a worse
   * bug in its place: this read `_byId(id).some(p => p.locked)`, a union over
   * every portal sharing a bare id. `to_plant` is the id of the Service Spine's
   * lobby door, the Ductwork's hatch AND the Cistern's ladder hatch — and the
   * Cistern's is authored `locked: true` at registration. So the moment the
   * Cistern was built, which `World._preload` does from 14 m away, **every route
   * into the Plant in the building read as locked, with nothing able to open
   * them.** Before the re-key it depended on the player's route; after it, it
   * was certain. That is a critical-path break, and it was mine.
   *
   * A portal is gated if the portal in ITS OWN zone is gated. `zone` is passed
   * by `World.update`, which knows which zone's portal list it is walking; the
   * fallbacks are for callers that only have a name, and they resolve to the
   * player's current zone rather than to a union.
   *
   * @param {string} id
   * @param {string} [zone] the zone the portal being asked about belongs to
   */
  isGated(id, zone = null) {
    if (zone) return !!this.portals.get(`${zone}:${id}`)?.locked;
    return !!this._resolve(id)?.locked;
  }

  /** Player-facing refusal text for a gated portal. */
  gateReason(id) { return this._resolve(id)?.reason || ''; }

  // -- wiring -------------------------------------------------------------------

  _wire() {
    const on = (k, fn) => this._unsub.push(this.bus.on(k, fn));

    on('zone:enter', (e) => {
      if (e?.zone === 'plant' && this.objective('reach_plant').state !== 'done') {
        this.complete('reach_plant');
        // All three core hunts open at once.
        for (const id of ['core_cistern', 'core_residence', 'core_stack']) this.reveal(id);
      }
      if (e?.zone === 'safe') this._discover('office');
    });

    on('item:pickup', (e) => {
      if (e?.id !== 'fuse_core') return;
      this.coresFound++;
      this.bus.emit('progress:core', { found: this.coresFound, fitted: this.coresFitted });
      // Attribute the core to whichever hunt is open in this zone.
      const z = this.director?.zone;
      const map = { cistern: 'core_cistern', residence: 'core_residence', stack: 'core_stack' };
      const id = map[z];
      // Reveal before completing. The three core hunts are only revealed on first
      // reaching the Plant, and nothing stops a player finding a core before then —
      // the Cistern and the Stack are both open before the Plant is. Requiring the
      // hunt to already be `active` meant a core found early was never credited to
      // anything, and the objective it belonged to stayed on the list for the rest
      // of the game with the core already in the player's hands.
      if (id) { this.reveal(id); this.complete(id); }
      if (this.coresFound >= 3) this.reveal('fit_cores');
    });

    on('gen:core', (e) => {
      this.coresFitted = e?.cores ?? this.coresFitted;
      if (this.coresFitted >= (e?.required ?? 3)) {
        this.complete('fit_cores');
        this.reveal('start_set');
      }
    });

    on('gen:running', () => {
      this.setRunning = true;
      this.complete('start_set');
      this.reveal('ride_out');
      this.liftPowered = true;
      // Way 8 comes alive; the whole building changes character.
      const board = this.interactables?.get('board_c');
      board?.api?.energiseWay8?.();
      const lift = this.interactables?.get('lift_2');
      lift?.api?.setPower?.(true);
      this.gate('portal_lift', false, '');
      this.bus.emit('world:power', { way8: true });
    });

    // The lift is the ending. A floor flagged `exit: true` is the way out; every
    // other floor is just a floor. Arriving there with the set running is the
    // intended ending, and arriving there *without* it is the one where the
    // indicator was telling the truth all along and the car only goes down.
    on('lift:arrive', (e) => {
      if (this.ended) return;
      if (!e?.exit) return;
      this._end(this.setRunning ? ENDINGS.LEFT : ENDINGS.DESCENDED);
    });

    on('valve:complete', (e) => {
      this.bus.emit('progress:hint', { text: 'Something heavy has moved in the pipework.' });
    });

    on('reader:unlock', () => this.bus.emit('progress:hint', { text: 'The reader takes the card.' }));
    on('terminal:solved', () => this._discover('sealed'));

    on('story:note', (e) => {
      const n = this.notes?.get(e?.id);
      if (!n) return;
      if (n.tags?.includes('notebook')) this._discover('notebook');
      if (n.tags?.includes('ending')) this._discover('docket');
    });
    on('story:tape', () => this._discover('tapes'));

    // The hidden ending's trigger: file the docket, with the set running,
    // having read it and understood what it offers.
    on('interact:use', (e) => {
      if (e?.id !== 'docket_0000') return;
      if (this.ended) return;
      if (!this.setRunning) {
        this.bus.emit('ui:refuse', { reason: 'There is nothing to sign off yet.' });
        return;
      }
      if (!this.notes?.hasRead('note_ending_hint')) {
        this.bus.emit('ui:refuse', { reason: 'You have not read it properly.' });
        return;
      }
      this._end(ENDINGS.STAYED);
    });
  }

  _discover(id) {
    const d = this.discoveries.find((x) => x.id === id);
    if (!d || d.done) return;
    d.count++;
    if (d.count >= d.need) {
      d.done = true;
      this.bus.emit('progress:discovery', { id, title: d.title, detail: d.detail });
    }
  }

  _end(ending) {
    if (this.ended) return;
    this.ended = ending;
    const found = this.discoveries.filter((d) => d.done).map((d) => d.id);
    this.bus.emit('game:ending', {
      ending,
      time: this.time,
      deaths: this.director?.deaths ?? 0,
      objectives: this.completed,
      discoveries: found,
      notes: this.notes?.stats?.() ?? null,
    });
  }

  // -- data-driven world hookup ---------------------------------------------------

  /**
   * The default gate set. A zone builder registers its portals by id and this
   * puts the right locks on them at the right time.
   */
  installDefaultGates() {
    this.gate('portal_cistern', false, '');
    this.gate('portal_residence', true, 'Card access. Yours was issued in March.');
    this.gate('portal_stack', true, 'The lobby is dark. Nothing calls without Way 7.');
    this.gate('portal_lift', true, 'No three-phase. The car will not accept a call.');
    this._announce();
    return this;
  }

  // -- Game.js compatibility ---------------------------------------------------------
  // `Game.respawn()` talks to the progression layer rather than the director,
  // which is the right call from its side — respawn is a *progression* concern
  // and the director is an implementation detail of pacing. These two forward.

  /** Where the player comes back. `[x, y, z]`, or null if nowhere is safe yet. */
  lastSafePoint() {
    const r = this.director?.lastSafe;
    return r ? r.position.slice() : null;
  }

  /** Yaw to face on respawn. */
  lastSafeYaw() { return this.director?.lastSafe?.yaw ?? 0; }

  /**
   * Perform the respawn. Idempotent and safe to call when nothing has died —
   * the director owns the world-changing side of it.
   */
  respawn() {
    this.director?.respawn?.();
    return this.lastSafePoint();
  }

  /** Register a safe room from a zone builder's `safe` marker. */
  registerSafeRoom(room) { return this.director?.registerSafeRoom?.(room) ?? null; }

  // -- per frame -------------------------------------------------------------------

  /**
   * Is a gate still shut? Takes a group name or a portal id.
   *
   * The two callers below used to read `this.portals.get('portal_stack')`, which
   * is a GROUP name and has never been a portal id — the zones call their doors
   * `to_stack`, `to_residence` and so on. So the lookup returned undefined, both
   * conditions were permanently false, and neither the Stack nor the Residence
   * ever opened no matter what the player did.
   */
  locked(key) {
    if (this.groups.has(key)) return !!this.groups.get(key).locked;
    return !!this.portals.get(key)?.locked;
  }

  update(dt) {
    this.time += dt;
    // The Stack gate opens itself when its circuit is live — no bookkeeping, it
    // simply reflects the state of the building.
    if (this.locked('portal_stack') && this.interactables) {
      const board = this.interactables.get('board_c');
      const live = board?.api?.state?.().find((w) => w.name === 'stack' && w.on);
      if (live) this.gate('portal_stack', false, '');
    }
    if (this.locked('portal_residence') && this.inventory?.has('card_warden')) {
      this.gate('portal_residence', false, '');
    }
  }

  dispose() { for (const u of this._unsub) u(); }

  debugState() {
    return {
      objective: this.current?.id ?? null,
      completed: this.completed,
      cores: { found: this.coresFound, fitted: this.coresFitted },
      running: this.setRunning,
      ended: this.ended,
      gates: [...this.portals.values()].filter((p) => p.locked).map((p) => p.id),
      discoveries: this.discoveries.filter((d) => d.done).map((d) => d.id),
    };
  }
}

export default Progression;
