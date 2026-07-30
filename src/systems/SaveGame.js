/**
 * SaveGame — checkpoint capture and restore.
 *
 * WHY THIS EXISTS
 *
 * The title screen has a Continue item. `UI.readHasSave()` decides whether it is
 * enabled by reading `localStorage['annex.save']`, and nothing in the project
 * ever wrote that key — so Continue was permanently greyed out and every session
 * started from the arrival lift. A game you cannot leave and come back to is not
 * a game you can finish in one sitting, and this one is about forty minutes long.
 *
 * WHAT IS SAVED, AND WHY ONLY THIS
 *
 * Not a snapshot of the world. The zones are deterministic functions of one seed,
 * so re-running the builders reproduces every wall, lamp and prop exactly; what
 * cannot be reproduced is what the PLAYER changed. That is a short list, and
 * keeping it short is the point — a save format that serialises geometry breaks
 * the first time a zone builder is edited, and this one survives it.
 *
 *   where       zone, position, yaw
 *   carried     the inventory's own snapshot
 *   progress    objective states, cores found and fitted, the set, the ending,
 *               discoveries, and which gates are still shut
 *   read        every note and tape id collected, and which were actually read
 *   switched    each way of Distribution Board C, and whether way 8 is alive
 *   fitted      which of Set No. 2's three sockets have a core in them
 *   clock       elapsed play time and the death count
 *
 * CHECKPOINTS, NOT SAVE-ANYWHERE. The save is written when the player enters the
 * Office of Record and when an objective completes. A horror game that lets you
 * save mid-chase has no chases in it, and the Office is already the room the
 * fiction offers as the place you may sit down.
 */

const KEY = 'annex.save';
const VERSION = 3;

/** Read the raw save, or null. Never throws — private mode, quota, bad JSON. */
export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION) return null;
    return data;
  } catch { return null; }
}

export function hasSave() { return !!readSave(); }

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

/**
 * Everything the player has changed about the building.
 * @param {object} game
 */
export function capture(game) {
  const p = game?.player;
  const prog = game?.progression;
  const notes = game?.gameplay?.notes;
  const inv = game?.inventory;
  const board = game?.gameplay?.interactables?.get('board_c');
  const gen = game?.gameplay?.interactables?.get('set_2');

  return {
    version: VERSION,
    at: new Date().toISOString(),
    clock: {
      elapsed: +(game?.time ?? 0).toFixed(1),
      deaths: game?.director?.deaths ?? 0,
    },
    where: {
      zone: game?.world?.currentZone ?? 'intake',
      // LOCAL to the zone. World-space coordinates would break the moment a
      // ZONE_ORIGIN moved, and they are 400 m numbers that read as nonsense.
      position: p && game?.world
        ? game.world.toLocal(game.world.currentZone, [p.position.x, p.position.y, p.position.z])
            .map((v) => +v.toFixed(3))
        : [0, 0, 0],
      yaw: +(p?.yaw ?? 0).toFixed(4),
    },
    carried: inv?.snapshot?.() ?? null,
    progress: prog ? {
      objectives: prog.objectives.map((o) => [o.id, o.state]),
      coresFound: prog.coresFound,
      coresFitted: prog.coresFitted,
      setRunning: prog.setRunning,
      liftPowered: prog.liftPowered,
      ended: prog.ended,
      time: +prog.time.toFixed(1),
      discoveries: prog.discoveries.filter((d) => d.done).map((d) => d.id),
      // Group state, not per-portal: a zone that has not been built yet has no
      // portals registered, and the group is what a late arrival inherits.
      gates: [...prog.groups.entries()].map(([k, v]) => [k, !!v.locked, v.reason || '']),
    } : null,
    read: notes ? {
      collected: [...notes.collected],
      read: [...notes.read],
    } : null,
    switched: board ? {
      ways: board.api.state().map((w) => [w.name, !!w.on, !!w.dead]),
    } : null,
    fitted: gen ? {
      sockets: gen.sockets.map((s) => !!s.fitted),
      state: (() => { const s = gen.state(); return { fuel: !!s.fuel, primed: !!s.primed, running: !!s.running }; })(),
    } : null,
  };
}

/** Write a checkpoint. Returns true if it actually landed. */
export function write(game) {
  try {
    const data = capture(game);
    localStorage.setItem(KEY, JSON.stringify(data));
    game?.bus?.emit('save:written', { at: data.at, zone: data.where.zone });
    return true;
  } catch (e) {
    // Quota, private mode, or a serialisation bug. Never take the run down.
    console.warn('[save] could not write checkpoint', e);
    return false;
  }
}

/**
 * Put a captured state back. Order matters and is not obvious:
 *
 *   1. the ZONE first, because entering it builds it, which is what creates the
 *      props whose state comes later — and `enter()` teleports the player, so
 *      restoring the position before this would be undone;
 *   2. the board, because its ways decide which circuits are live, and the zone
 *      built in step 1 registers its fixtures against those circuits;
 *   3. progression and notes, which are pure data;
 *   4. the position, last, so nothing can move the player afterwards.
 *
 * Returns a list of what could not be restored rather than throwing: a save from
 * a build whose Plant has no generator should still put the player back in the
 * right corridor.
 */
export function restore(game, data = readSave()) {
  if (!data) return { ok: false, missing: ['no save'] };
  const missing = [];

  // 1. the zone
  const zone = data.where?.zone || 'intake';
  if (game?.world?.enter) {
    if (!game.world.enter(zone)) missing.push(`zone ${zone}`);
  } else missing.push('world');

  // 2. the board
  const board = game?.gameplay?.interactables?.get('board_c');
  if (data.switched && board) {
    for (const [name, on, dead] of data.switched.ways) {
      const w = board.breakers.find((b) => b.name === name);
      if (!w) continue;
      if (!dead && w.dead) board.api.energiseWay8();
      if (!!w.on !== !!on) board.api.setWay(name, on);
    }
  } else if (data.switched) missing.push('board_c');

  // 3. the generator
  const gen = game?.gameplay?.interactables?.get('set_2');
  if (data.fitted && gen) {
    data.fitted.sockets.forEach((f, i) => {
      const s = gen.sockets[i];
      if (!s || s.fitted || !f) return;
      s.fitted = true;
      s.core.visible = true;
    });
    // Re-derive the machine's stage from the sockets rather than trusting a
    // stored enum: the generator owns that state machine and this file should not
    // be a second copy of it.
    const n = data.fitted.sockets.filter(Boolean).length;
    if (n) game.bus?.emit('gen:core', { id: 'set_2', cores: n, required: gen.sockets.length });
    if (data.fitted.state?.running) game.bus?.emit('gen:running', { id: 'set_2' });
  } else if (data.fitted) missing.push('set_2');

  // 4. carried items
  const inv = game?.inventory;
  if (data.carried && inv?.restore) inv.restore(data.carried);
  else if (data.carried) missing.push('inventory');

  // 5. papers
  const notes = game?.gameplay?.notes;
  if (data.read && notes) {
    for (const id of data.read.collected) notes.collect(id);
    for (const id of data.read.read) notes.read.add(id);
  } else if (data.read) missing.push('notes');

  // 6. progression
  const prog = game?.progression;
  if (data.progress && prog) {
    for (const [id, state] of data.progress.objectives) {
      const o = prog.objective(id);
      if (o) o.state = state;
    }
    prog.coresFound = data.progress.coresFound ?? 0;
    prog.coresFitted = data.progress.coresFitted ?? 0;
    prog.setRunning = !!data.progress.setRunning;
    prog.liftPowered = !!data.progress.liftPowered;
    prog.ended = data.progress.ended ?? null;
    prog.time = data.progress.time ?? 0;
    for (const d of prog.discoveries) d.done = data.progress.discoveries.includes(d.id);
    for (const [name, locked, reason] of data.progress.gates || []) prog.gate(name, locked, reason);
    prog._announce();
  } else if (data.progress) missing.push('progression');

  // 7. where, last
  if (game?.player && game?.world && data.where) {
    const w = game.world.toWorld(zone, data.where.position);
    game.player.teleport(w[0], w[1], w[2], data.where.yaw ?? 0);
  }
  if (game?.director) game.director.deaths = data.clock?.deaths ?? 0;

  game?.bus?.emit('save:restored', { zone, missing });
  return { ok: true, missing };
}

/**
 * Wire the autosave. Call once, after the gameplay layer exists.
 * Returns an unsubscribe function.
 */
export function installAutosave(game) {
  const bus = game?.bus;
  if (!bus) return () => {};
  let cooldown = 0;
  const guarded = (why) => {
    // One checkpoint per 20 s at most. `progress:complete` and `zone:enter` can
    // land on the same frame — completing an objective by walking into a room —
    // and two identical writes is one wasted quota hit.
    const now = game.time ?? 0;
    if (now - cooldown < 20) return;
    cooldown = now;
    if (write(game)) console.info(`[save] checkpoint (${why})`);
  };
  const subs = [
    // The Office of Record. Nothing has ever come in here.
    bus.on('zone:enter', (e) => { if (e?.zone === 'safe') guarded('safe room'); }),
    bus.on('progress:complete', (e) => guarded(`objective ${e?.id}`)),
    bus.on('gen:running', () => guarded('the set is running')),
  ];
  return () => { for (const u of subs) u(); };
}

export default { readSave, hasSave, clearSave, capture, write, restore, installAutosave };
