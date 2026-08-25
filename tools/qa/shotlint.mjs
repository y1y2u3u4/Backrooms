#!/usr/bin/env node
/**
 * Lint the capture shot lists.
 *
 * WHY THIS EXISTS.
 *
 * `g.lookOpen(pos, yaw, pitch)` is a QUERY. It searches for an open sightline
 * and returns `{position, yaw, clear, degenerate}`. It moves nothing. Written
 * as a bare statement it does exactly one useful thing — nothing — and the
 * shot is then photographed from whatever pose `world.goto` happened to leave.
 *
 * 115 of the 135 shots that called it did so as a bare statement. Frames named
 * `intake_ceiling`, `stack_up` and `service_spine` were pictures of the zone
 * spawn facing forward, and were read for months as if they showed what their
 * names said. One of them, `09_duct`, came back 94 % crushed and was treated as
 * evidence that the Ductwork was unlit; four rounds of lighting changes later
 * the live canvas measured mean luminance 169 — the brightest zone in the
 * building. The frame had never been aimed at anything.
 *
 * `g.lookAtOpen(...)` queries and poses. This check fails the audit if a shot
 * list goes back to calling the query as though it were a command.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'tools/qa';
const KEYS = ['setup', 'preamble', 'pre'];
/** A call whose value is consumed — assigned, returned, or passed on. */
const CONSUMED = ['=', 'return', '(', ',', '&&', '||', '?', ':'];

let bad = 0, shots = 0, files = 0;
const rows = [];

for (const name of (await readdir(DIR)).sort()) {
  if (!/^shots\..+\.json$/.test(name)) continue;
  const p = path.join(DIR, name);
  let list;
  try { list = JSON.parse(await readFile(p, 'utf8')); } catch (e) {
    rows.push(`  ✗ ${name} is not valid JSON — ${e.message}`); bad++; continue;
  }
  if (!Array.isArray(list)) continue;
  files++;
  for (const s of list) {
    shots++;
    const src = KEYS.map((k) => (typeof s[k] === 'string' ? s[k] : '')).join(' ');
    if (!src.includes('lookOpen')) continue;
    for (const m of src.matchAll(/g\.lookOpen\s*\(/g)) {
      const before = src.slice(0, m.index).trimEnd();
      if (!CONSUMED.some((c) => before.endsWith(c))) {
        rows.push(`  ✗ ${name} → ${s.name || '?'}: bare g.lookOpen() — the result is dropped, `
          + 'so this shot is never posed. Use g.lookAtOpen().');
        bad++;
        continue;
      }
      // THE SECOND VARIANT, WHICH THE FIRST PASS OF THIS CHECK LET THROUGH.
      //
      // `const o = g.lookOpen(p, y, 0);` and then nothing ever reads `o`. The
      // assignment makes it look deliberate and it poses exactly as little as
      // the bare call. Two of the fifteen judge shots were written this way and
      // survived the sweep that fixed the other 115: `13_surveyor_mid` and
      // `14_surveyor_close` both said `goto('intake')`, never moved, and were
      // photographed in the Stack where the previous shot had left the player —
      // with the Surveyor placed relative to that wrong position too.
      const decl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(before);
      if (!decl) continue;
      const v = decl[1];
      const after = src.slice(m.index);
      const reads = [...after.matchAll(new RegExp(`\\b${v}\\b`, 'g'))].length;
      if (reads <= 1) {
        rows.push(`  ✗ ${name} → ${s.name || '?'}: g.lookOpen() assigned to \`${v}\`, `
          + 'which is never read — the shot is not posed. Use g.lookAtOpen().');
        bad++;
      }
    }
  }
}

console.log('\nShot lists — is every shot actually aimed?\n');
if (rows.length) rows.forEach((r) => console.log(r));
else console.log(`  ✓ ${shots} shots across ${files} lists; no query-as-command calls`);
console.log(`\n${bad ? `${bad} failed` : 'passed'}\n`);
process.exit(bad ? 1 : 0);
