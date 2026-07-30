/**
 * Portal-graph audit — can a player actually walk from the start to the end?
 *
 * WHY THIS EXISTS
 *
 * Every zone declares its doors with portal(), Progression keeps a gate table for
 * them, and World.enter() performs the transition — and for the whole life of the
 * project nothing joined those three things up. No code path called enter(), so
 * the only zone change available required walking 400 m of empty space between
 * world patches. The eight zones were eight disconnected rooms: a player could
 * never leave the Intake, and the fuse cores, the goods lift and the entire
 * objective chain were unreachable.
 *
 * That was invisible to every other tool here. Screenshots are per-zone. The
 * playthrough changed zones by calling a QA hook, so it never exercised a door.
 * This walks the declared graph instead and answers the only question that
 * matters about it: is the building connected?
 */
const files = {
  intake: 'IntakeZone.js', service: 'ServiceZone.js', cistern: 'CisternZone.js',
  residence: 'ResidenceZone.js', plant: 'PlantZone.js', duct: 'DuctZone.js',
  stack: 'StackZone.js', safe: 'SafeRoom.js',
};

// Read the declared portals straight out of the source. Building every zone just
// to enumerate its doors costs ten seconds and drags in the whole engine; the
// declaration is a literal and reading it is exact.
import { readFile } from 'node:fs/promises';
const edges = [];
const bad = [];
const ends = [];
for (const [zone, file] of Object.entries(files)) {
  const src = await readFile(new URL(`../../src/world/zones/${file}`, import.meta.url), 'utf8');
  const re = /portal\(\s*'([a-z0-9_]+)'\s*,\s*'([a-z]+)'\s*,[\s\S]{0,400?}?\{\s*zone:\s*'([a-z]+)'/g;
  let m, n = 0;
  const re2 = /portal\(\s*'([a-z0-9_]+)'\s*,\s*'([a-z]+)'/g;
  const declared = [];
  while ((m = re2.exec(src))) declared.push({ id: m[1], from: m[2] });
  for (const d of declared) {
    // Find the target zone in the same call.
    const at = src.indexOf(`portal('${d.id}'`);
    const chunk = src.slice(at, at + 600);
    const t = chunk.match(/zone:\s*'([a-z]+)'/);
    if (t) { edges.push({ from: zone, to: t[1], id: d.id }); n++; }
    // A portal with no target zone is an ENDPOINT, not a defect: the arrival
    // lift is where the player came in and the exit lift is the ending. They are
    // doors out of the game rather than doors between zones.
    else ends.push({ zone, id: d.id });
  }
  if (!n) bad.push({ zone, id: '(none)', why: 'zone declares no portal with a target' });
}

const adj = new Map();
for (const e of edges) {
  if (!adj.has(e.from)) adj.set(e.from, []);
  adj.get(e.from).push(e);
}

console.log('');
console.log('portal graph — declared doors between zones');
console.log('');
for (const z of Object.keys(files)) {
  const out = (adj.get(z) || []).map((e) => `${e.to}(${e.id})`).join('  ');
  console.log(`  ${z.padEnd(11)} -> ${out || '(nothing)'}`);
}

// Reachability from the spawn zone.
const START = 'intake';
const seen = new Set([START]);
const q = [START];
const from = new Map();
while (q.length) {
  const z = q.shift();
  for (const e of adj.get(z) || []) {
    if (seen.has(e.to)) continue;
    seen.add(e.to); from.set(e.to, `${z} --${e.id}--> ${e.to}`); q.push(e.to);
  }
}
const missing = Object.keys(files).filter((z) => !seen.has(z));

console.log('');
console.log(`reachable from ${START}: ${[...seen].join(', ')}`);
if (missing.length) console.log(`UNREACHABLE: ${missing.join(', ')}`);
for (const b of bad) console.log(`  WARN  ${b.zone}/${b.id}: ${b.why}`);
if (ends.length) console.log(`endpoints (no destination zone, by design): ${ends.map((e) => `${e.zone}/${e.id}`).join(', ')}`);
console.log('');
const ok = missing.length === 0 && bad.length === 0;
console.log(ok
  ? `All ${Object.keys(files).length} zones reachable on foot from ${START} across ${edges.length} doors.`
  : 'The building is not fully connected.');
process.exit(ok ? 0 : 1);
