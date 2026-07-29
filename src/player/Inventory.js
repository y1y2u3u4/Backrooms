import { Bus } from '../core/util.js';

/**
 * Inventory — small, diegetic, and mostly about your hands.
 *
 * There is no grid, no weight limit and no menu. What the player carries is
 * expressed physically: a tool is in one hand, a fuse core is in both, and a
 * fuse core is the only thing in the game that changes how you move. That is
 * the whole design — the inventory exists so the *body* can be a puzzle piece.
 *
 * Consumables (batteries) count. Keys, cards, tapes and notes are boolean.
 * Nothing is ever silently removed: `use()` returns false rather than
 * pretending, so callers must handle the refusal and the UI can say why.
 */

export const ITEM_KINDS = {
  TOOL: 'tool',
  KEY: 'key',
  CARD: 'card',
  BATTERY: 'battery',
  TAPE: 'tape',
  NOTE: 'note',
  CORE: 'core',
};

/**
 * The item catalogue. `hand` describes what the item does to the player's body:
 *   'none'  — pocketed, never seen
 *   'right' — held in the right hand, displaces the lamp to the left
 *   'both'  — occupies both hands; the lamp is stowed and the player is slowed
 */
export const ITEMS = {
  battery_cell: {
    name: 'Spare cell', kind: ITEM_KINDS.BATTERY, stack: 4, hand: 'none',
    blurb: 'A 6 V lantern cell in a waxed sleeve. Meridian stores issue.',
  },
  pry_bar: {
    name: 'Pry bar', kind: ITEM_KINDS.TOOL, hand: 'right',
    blurb: '600 mm, hexagon stock, one end flattened. Heavy enough to be a decision.',
  },
  keys_ring: {
    name: 'Ring of keys', kind: ITEM_KINDS.KEY, hand: 'none',
    blurb: 'Eleven keys, four labelled, none of them labelled usefully.',
  },
  key_penstock: {
    name: 'Penstock padlock key', kind: ITEM_KINDS.KEY, hand: 'none',
    blurb: 'Brass, stamped P2. It has been in water for a long time.',
  },
  card_warden: {
    name: "Warden's access card", kind: ITEM_KINDS.CARD, hand: 'none',
    blurb: 'Photograph bleached to a grey oval. Issue date after October.',
  },
  card_contractor: {
    name: 'Contractor card', kind: ITEM_KINDS.CARD, hand: 'none',
    blurb: 'Your own. Issued March. It opens less than you were told it would.',
  },
  tape_player: {
    name: 'Dictaphone', kind: ITEM_KINDS.TOOL, hand: 'right',
    blurb: 'Pocket recorder. The play head is worn but it tracks.',
  },
  fuse_core: {
    name: 'HRC supply core', kind: ITEM_KINDS.CORE, stack: 3, hand: 'both',
    blurb: '400 A ceramic core, sand-filled. Twenty-two kilograms and awkward with it.',
  },
  lamp: {
    name: 'Inspection lamp', kind: ITEM_KINDS.TOOL, hand: 'right',
    blurb: 'Meridian issue. Rubber armoured, one cell, one switch, no spare bulb.',
  },
};

export class Inventory {
  /**
   * @param {object} opts
   * @param {Bus} opts.bus
   * @param {import('./Player.js').Player} [opts.player]
   */
  constructor({ bus, player = null } = {}) {
    this.bus = bus || new Bus();
    this.player = player;
    /** @type {Map<string, {id:string,count:number,def:object,meta:object}>} */
    this.slots = new Map();
    this.selected = null;         // id of the item currently in the right hand
    this.encumbered = false;      // true while carrying anything 'both'-handed
    this._speedPenalty = 1;

    // The lamp is not a pickup; you arrived with it.
    this.add('lamp', 1, { silent: true });
    this.select('lamp');
  }

  // -- queries ---------------------------------------------------------------

  has(id, n = 1) { return (this.slots.get(id)?.count ?? 0) >= n; }
  count(id) { return this.slots.get(id)?.count ?? 0; }
  def(id) { return ITEMS[id] || null; }
  meta(id) { return this.slots.get(id)?.meta ?? null; }
  list() { return [...this.slots.values()]; }

  /** Items of a kind, e.g. every tape the player is carrying. */
  ofKind(kind) { return this.list().filter((s) => s.def.kind === kind); }

  /** True when the hands are full of something that is not a tool. */
  get handsFull() { return this.encumbered; }

  /** What the hands system should be showing in the right hand right now. */
  get heldId() {
    if (this.encumbered) return 'fuse_core';
    return this.selected;
  }

  // -- mutation --------------------------------------------------------------

  /**
   * @param {string} id
   * @param {number} n
   * @param {{silent?:boolean, meta?:object}} [opts]
   * @returns {boolean} false if the item is unknown or the stack is full
   */
  add(id, n = 1, { silent = false, meta = null } = {}) {
    const def = ITEMS[id];
    if (!def) { console.warn(`[inventory] unknown item "${id}"`); return false; }
    const max = def.stack ?? 1;
    let slot = this.slots.get(id);
    if (!slot) {
      slot = { id, count: 0, def, meta: meta || {} };
      this.slots.set(id, slot);
    } else if (meta) {
      Object.assign(slot.meta, meta);
    }
    if (slot.count >= max) return false;
    slot.count = Math.min(max, slot.count + n);

    if (!silent) this.bus.emit('item:pickup', { id, name: def.name, count: slot.count, kind: def.kind });
    this._refreshBody();
    return true;
  }

  /** Remove and return true, or return false and change nothing. */
  take(id, n = 1) {
    const slot = this.slots.get(id);
    if (!slot || slot.count < n) return false;
    slot.count -= n;
    if (slot.count <= 0) {
      this.slots.delete(id);
      if (this.selected === id) this.select('lamp');
    }
    this.bus.emit('item:remove', { id, name: slot.def.name, count: slot.count });
    this._refreshBody();
    return true;
  }

  /**
   * Consume one of `id` for a use that has already been validated.
   * Non-consumable kinds (keys, cards, tools) are *not* removed — using a key
   * is not spending it.
   */
  use(id) {
    const slot = this.slots.get(id);
    if (!slot) return false;
    const consumable = slot.def.kind === ITEM_KINDS.BATTERY || slot.def.kind === ITEM_KINDS.CORE;
    this.bus.emit('item:use', { id, name: slot.def.name });
    if (consumable) return this.take(id, 1);
    return true;
  }

  /** Put an item in the right hand. Refuses while encumbered. */
  select(id) {
    if (this.encumbered) return false;
    if (id && !this.slots.has(id)) return false;
    if (this.selected === id) return true;
    this.selected = id;
    this.bus.emit('item:select', { id, name: id ? ITEMS[id]?.name : null });
    return true;
  }

  /** Drop the encumbering item where the player stands. Loud. */
  dropCarried(position = null) {
    if (!this.encumbered) return null;
    const id = 'fuse_core';
    if (!this.take(id, 1)) return null;
    const pos = position || this.player?.position?.clone?.() || null;
    this.bus.emit('item:drop', { id, position: pos });
    // 22 kg of ceramic hitting a floor is the loudest thing in the game that
    // the player can do on purpose.
    this.player?.makeNoise?.(18);
    return id;
  }

  // -- body coupling ---------------------------------------------------------

  /**
   * Carrying a fuse core is the only inventory state with a movement cost, and
   * it is deliberately steep: it is the tax on the last third of the game.
   */
  _refreshBody() {
    const cores = this.count('fuse_core');
    const wasEncumbered = this.encumbered;
    this.encumbered = cores > 0;
    this._speedPenalty = this.encumbered ? 0.62 : 1;

    if (this.player) {
      // Multiplicative so the director and other systems can also scale speed.
      this.player.speedScale = (this.player._invScale === undefined ? 1 : this.player.speedScale / this.player._invScale) * this._speedPenalty;
      this.player._invScale = this._speedPenalty;
    }
    if (this.encumbered !== wasEncumbered) {
      this.bus.emit('player:encumbered', { encumbered: this.encumbered, count: cores });
    }
  }

  /** Serialisable state for the director's respawn bookkeeping. */
  snapshot() {
    const out = {};
    for (const [id, s] of this.slots) out[id] = s.count;
    return { items: out, selected: this.selected };
  }

  restore(snap) {
    this.slots.clear();
    for (const [id, n] of Object.entries(snap.items || {})) this.add(id, n, { silent: true });
    this.selected = snap.selected && this.slots.has(snap.selected) ? snap.selected : 'lamp';
    this._refreshBody();
  }
}

export default Inventory;
