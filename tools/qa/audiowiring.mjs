/**
 * Audio wiring audit — is every sound reachable, and is every event heard?
 *
 * WHY THIS EXISTS
 *
 * `Library.js` registers 35 named sounds. Fifteen of them had no caller anywhere
 * in the project: door.open, door.close, door.latch, door.locked, door.heavy,
 * valve.turn, hatch.open, lift.call, lift.arrive, relay.click, switch.click,
 * locker.click, metal.clang, pipe.knock, chair.scrape. Every door, breaker,
 * valve, keypad, socket, lift and locker in the building was silent — and for a
 * game whose entity hunts by sound, that is not a polish gap: the player could
 * not hear the thing they had just done, and the Surveyor could.
 *
 * Nothing catches that at run time. A missing handler is silence, and silence in
 * a horror game reads as intent. A misspelt sound name is one `console.warn` in a
 * session nobody is watching. So this reads both sides statically:
 *
 *   * every `play` / `playAt` name in src/ must be registered by Library.js
 *   * every gameplay event emitted by the interactables, the door latch and the
 *     progression must be consumed by SOMETHING — audio, UI, or another system
 *
 * It is a spelling-and-coverage check, not a listening test. What it cannot tell
 * you is whether the sound is any good.
 *
 *   node tools/qa/audiowiring.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = await walk(SRC);
const text = new Map();
for (const f of files) text.set(f, await readFile(f, 'utf8'));

// ---------------------------------------------------------------------------
// 1. registered sounds
// ---------------------------------------------------------------------------
const lib = text.get(path.join(SRC, 'audio', 'Library.js')) || '';
const registered = new Set([...lib.matchAll(/\bR\('([a-z0-9_.]+)'/g)].map((m) => m[1]));

// Sounds registered elsewhere: the ambience beds, the entity bank, the footstep
// banks and the music cues all register their own, through a local alias for the
// engine (`E.register`, `eng.register`), so match the call rather than the
// receiver. Template literals are counted as a prefix wildcard.
const wildcards = [];
for (const [, s] of text) {
  for (const m of s.matchAll(/\.register\(\s*'([a-z0-9_.]+)'/g)) registered.add(m[1]);
  for (const m of s.matchAll(/\.register\(\s*`([a-z0-9_.]*)\$\{/g)) wildcards.push(m[1]);
  for (const m of s.matchAll(/\bcue\(\s*'([a-z0-9_.]+)'/g)) registered.add(`music.${m[1]}`);
}
const known = (n) => registered.has(n) || wildcards.some((w) => w && n.startsWith(w));

// ---------------------------------------------------------------------------
// 2. sounds actually played
// ---------------------------------------------------------------------------
// TWO DIFFERENT QUESTIONS, TWO DIFFERENT SWEEPS.
//
// "Is this name misspelt?" is answered by the direct call form only — a loose
// sweep for dotted literals picks up `localStorage.getItem('annex.save')` and
// reports the save key as a missing sound.
//
// "Is this sound reachable?" cannot use the call form at all: a ternary
// (`play(isCore ? 'pickup.core' : 'pickup.item')`), a template
// (`play(\`step.${surface}\`)`) and a lookup table are all normal, and half the
// library is played that way. So a registered name counts as reachable if it
// appears as a quoted literal anywhere other than its own registration.
// `sequencer.play('intro')` is a CINEMATIC, not a sound, and it shares the verb.
// Only files that construct or hold the audio engine are scanned for names.
const AUDIO_CALLERS = files.filter((f) => f.includes(`${path.sep}audio${path.sep}`));
const spelled = new Map();     // name -> [files]   direct `play('name')`
for (const f of AUDIO_CALLERS) {
  const s = text.get(f);
  for (const m of s.matchAll(/\.(?:play|playAt|loop|loopAt)\(\s*'([a-z0-9_.]+)'/g)) {
    if (!spelled.has(m[1])) spelled.set(m[1], []);
    spelled.get(m[1]).push(f);
  }
}
const referenced = new Set();
for (const [, s] of text) {
  for (const name of registered) {
    // Every occurrence except the registration itself.
    const uses = s.split(`'${name}'`).length - 1;
    const regs = s.split(`.register('${name}'`).length - 1 + s.split(`R('${name}'`).length - 1;
    if (uses > regs) referenced.add(name);
  }
}

// ---------------------------------------------------------------------------
// 3. gameplay events emitted, and who listens
// ---------------------------------------------------------------------------
const emitted = new Map();    // event -> [files]
const heard = new Map();      // event -> [files]
for (const [f, s] of text) {
  for (const m of s.matchAll(/\bemit\(\s*'([a-z0-9:_]+)'/g)) {
    if (!emitted.has(m[1])) emitted.set(m[1], []);
    emitted.get(m[1]).push(f);
  }
  for (const m of s.matchAll(/\bon\(\s*'([a-z0-9:_]+)'/g)) {
    if (!heard.has(m[1])) heard.set(m[1], []);
    heard.get(m[1]).push(f);
  }
}

/**
 * Events that are deliberately fire-and-forget: they exist so a future system or
 * a mod can hook them, or they carry data the QA harness reads off the bus. An
 * unheard event is only a bug when it is something the PLAYER should notice.
 */
const SILENT_BY_DESIGN = new Set([
  'player:noise',      // read by the entities off the player, not off the bus
  'world:noise',
  'pickup:taken',      // item:pickup is the one the UI and audio use
  'gen:stage', 'terminal:page', 'terminal:dial', 'valve:turn', 'light:overload',
  'interact:use',      // Progression listens; nothing else needs to
  'progress:core', 'progress:complete',
  'zone:unload', 'zone:build', 'world:teleport', 'world:power',
  'portal:gate', 'ui:hint', 'door:unlocked', 'audio:emitter',
]);

/** Events a player must be able to hear or see the result of. */
const MUST_BE_HEARD = [
  'door:state', 'door:refused', 'door:pried', 'door:slam',
  'sfx:breaker', 'sfx:valve', 'sfx:detent', 'sfx:keypad',
  'valve:complete', 'keypad:reject', 'keypad:unlock', 'reader:unlock',
  'terminal:reject', 'terminal:solved',
  'lift:call', 'lift:arrive', 'lift:power',
  'gen:core', 'gen:fuel', 'gen:prime', 'gen:fail', 'gen:running',
  'hide:enter', 'hide:exit',
  'item:pickup', 'story:note', 'story:tape',
  'progress:objective', 'progress:hint', 'progress:discovery',
  'ui:refuse', 'portal:locked', 'light:circuit',
  // The two ends of the game. `Surveyor` emits the first when a capture
  // completes and `Progression` the second when the lift reaches the surface;
  // for a long time nothing at the level that owns the SCREENS listened to
  // either, so being caught froze the player with no way back and finishing the
  // game after forty minutes showed nothing at all.
  'game:death', 'game:ending', 'death:settled',
];

// ---------------------------------------------------------------------------
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

console.log('');
console.log('audio + event wiring');
console.log('');

// Misspelt or missing sound names are silent failures at run time.
const unknown = [...spelled.keys()].filter((n) => !known(n));
check('every sound played by name is registered', unknown.length === 0,
  unknown.length ? unknown.join(', ') : `${spelled.size} direct calls, all known`);

/**
 * Sounds in the library with nothing to trigger them yet, accepted rather than
 * hidden. Each of these needs an event that does not exist: there is no physics
 * layer to throw a `debris.small`, nothing breaks glass, and no cable is ever
 * plucked. They are listed so the gap is visible and the count cannot creep.
 */
const ACCEPTED_ORPHANS = new Set([
  'impact.soft', 'impact.hard', 'debris.small', 'glass.crack', 'cable.twang',
]);
const orphaned = [...registered].filter((n) => !referenced.has(n)
  && !n.startsWith('step.') && !n.startsWith('ent.') && !n.startsWith('music.')
  && !ACCEPTED_ORPHANS.has(n));
check('no registered sound is unreachable', orphaned.length === 0,
  orphaned.length ? `never played: ${orphaned.join(', ')}` :
    `${registered.size} registered, ${ACCEPTED_ORPHANS.size} accepted as awaiting an emitter`);

const deaf = MUST_BE_HEARD.filter((e) => emitted.has(e) && !heard.has(e));
check('every player-facing event has a listener', deaf.length === 0,
  deaf.length ? deaf.join(', ') : `${MUST_BE_HEARD.length} checked`);

const missing = MUST_BE_HEARD.filter((e) => !emitted.has(e));
check('every player-facing event is actually emitted', missing.length === 0,
  missing.length ? `declared but never fired: ${missing.join(', ')}` : '');

// Scoped to the MECHANISM layer. A global sweep is noise: Input publishes its own
// key and pointer events, the inventory publishes item:select for a HUD that reads
// the inventory directly, and a bus is allowed to carry an extension point. What
// matters is that nothing a player DOES in the world goes unanswered.
const MECHANISM = [
  path.join(SRC, 'systems', 'Interactables.js'),
  path.join(SRC, 'player', 'Interactor.js'),
  path.join(SRC, 'systems', 'Progression.js'),
];
const stray = [...emitted.entries()]
  .filter(([e, fs]) => fs.some((f) => MECHANISM.includes(f)))
  .map(([e]) => e)
  .filter((e) => !heard.has(e) && !SILENT_BY_DESIGN.has(e));
check('nothing the player does in the world goes unanswered', stray.length === 0,
  stray.length ? stray.join(', ') : `${emitted.size} event names in all`);

console.log('');
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
