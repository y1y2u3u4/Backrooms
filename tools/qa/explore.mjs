#!/usr/bin/env node
/**
 * THE EXPLORATION BOT — a harness that measures getting lost.
 * ===========================================================================
 * `tools/qa/playthrough.mjs` drives a continuous session and operates thirteen
 * interactables *because it is told which ones*. It cannot take a wrong turn,
 * because it has no turns to take: every zone change is `world.enter(id)` and
 * every awkward approach is a scripted reposition. Getting lost is most of what
 * this game is, and nothing in that harness can observe it.
 *
 * This one is given no route, no zone list, no interactable ids and no
 * objectives. It walks on what it can see and presses what comes under its
 * reticle, and the report is about how badly that goes.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE BOT IS ALLOWED TO KNOW — the line this whole tool stands or falls on
 * ---------------------------------------------------------------------------
 * PERCEPTION (allowed). Everything the steering reads is a geometric query a
 * player's eyes answer for free:
 *   - `collision.segmentBlocked(eye -> point)` — line of sight.
 *   - `collision.sampleFloor(x, z, ...)`      — is there floor over there.
 *   - `collision.ceilingAbove(...)`           — is there headroom.
 *   - `interactor.items`, culled to those inside the camera's real horizontal
 *     FOV, within 14 m, and with an unblocked sightline. The registry is used
 *     as the set of *objects that exist*, exactly as the renderer does; what
 *     survives the cull is what is on screen. It is never sorted by id, never
 *     filtered by kind, and nothing out of sight is ever targeted.
 *   - `interactor.focus` — the on-screen prompt. The interact key is only
 *     pressed on a frame where the game itself says something is under the
 *     reticle, so a press here is evidence a player could have made it.
 *   - its own memory of which 2 m cells it has already stood in.
 *
 * FORBIDDEN, and not read anywhere in the steering: `world.enter`,
 * `player.teleport`, `progression`, the zone graph, portal positions, item ids,
 * any waypoint. There is not one coordinate literal in this file. Zone changes
 * happen because the bot physically walked into a doorway and `World.update`
 * fired the portal — the same code path a player uses.
 *
 * MEASUREMENT (separate, and allowed to know more). The coverage denominator is
 * built from `collision.floors`, which the bot never sees. That asymmetry is the
 * point: the ruler may know the size of the room; the walker may not.
 *
 * REAL / SIMULATED / NOT REAL — same disclosure as playthrough.mjs:
 *   REAL       every key. W/A/S/D, E and F are dispatched as KeyboardEvents on
 *              `window`, which is the listener `Input` actually installs
 *              (src/core/Input.js:94), so they travel keydown -> Input.keys ->
 *              Input.down(action) -> Player.update. The frame is the real
 *              `step -> render -> endFrame` at a fixed 1/60.
 *   SIMULATED  mouse look, written into `Input.mouse.dx/dy` — the only field a
 *              locked pointer sets. Headless Chromium cannot grant pointer lock.
 *              The steering that decides *where* to look is this file's bot.
 *   NOT REAL   frame times. SwiftShader, CPU rasteriser. Recorded, not a verdict.
 *
 * Usage (the defaults are the run in docs/verification/explore, ~19 min of wall
 * clock for 9 minutes of play; `--renderEvery 1` is a true frame-time run and is
 * unusably slow here):
 *   node tools/qa/explore.mjs --port 4317 --seconds 540 \
 *        --renderEvery 32 --sample 1 --film 60 --width 480 --height 270 --no-audio
 *   node tools/qa/explore.mjs --selftest      # metric self-tests, no browser
 *   node tools/qa/explore.mjs --verify docs/verification/explore/explore.json
 *                                            # re-derive the report's numbers from
 *                                            # its own record, and require them to
 *                                            # MOVE when the session is truncated
 *
 * Outputs (docs/verification/explore/):
 *   explore.json          every sample, every cell entry, every metric
 *   explore.md            the human-readable report
 *   filmstrip/NNN_*.png   frames on a cadence, PLUS a frame every time the bot
 *                         has gone 25 s without finding anywhere new — so the
 *                         places it got stuck are photographed, not inferred
 * ===========================================================================
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '4317', 10);
const OUT = args.out || 'docs/verification/explore';
const QUALITY = args.quality || 'low';
const WIDTH = parseInt(args.width || '480', 10);
const HEIGHT = parseInt(args.height || '270', 10);
const DT = 1 / 60;
const SECONDS = parseInt(args.seconds || '540', 10);
const FILM = parseFloat(args.film || '60');
const SAMPLE = parseFloat(args.sample || '1');
const RENDER_EVERY = Math.max(1, parseInt(args.renderEvery || '32', 10));
const LIVE_AUDIO = !args['no-audio'];
const BOOT_TIMEOUT = parseInt(args.timeout || '420000', 10);
const CHUNK = Math.max(1, Math.round(SAMPLE / DT));

/** Coverage cell, metres. 2 m is about one stride and a half. */
const CELL = 2.0;
/** Vertical bucket. The Stack is a shaft: galleries stack over the same x/z and
 *  collapsing them would let one landing claim the whole well as covered. */
const YCELL = 3.0;
/** A stretch of this long with no new cell found is "lost", for the filmstrip. */
const LOST_FILM = 25;
/** Stall = stayed inside this radius for at least this long. */
const STALL_RADIUS = 1.6;
const STALL_SECONDS = 12;

const fmt = (t) => {
  // Round to the printed precision FIRST. Rounding afterwards prints "1:60.0"
  // for 119.97 s, which is in every report playthrough.mjs has ever written.
  const r = Math.round((t || 0) * 10) / 10;
  const m = Math.floor(r / 60);
  return `${m}:${(r - m * 60).toFixed(1).padStart(4, '0')}`;
};
const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : String(v));
const pos3 = (p) => (p ? `(${p.map((v) => num(v, 1)).join(', ')})` : '—');

// ===========================================================================
// METRICS — pure functions over the raw record, so they can be tested against
// a known state without a browser. Every one of these was wrong at least once
// while this file was being written; `--selftest` is how that was found.
//
// The raw record is deliberately dumb:
//   cellLog: [{t, zone, key, isNew, pos}]   one entry per cell BOUNDARY CROSSED
//   samples: [{t, zone, pos, cue, ...}]     one every --sample seconds
// Nothing derived is computed in the page.
// ===========================================================================

/** Coverage per zone, and overall. `walk` is zoneId -> walkable cell count. */
export function coverage(walk, cellLog) {
  const visited = {};
  for (const c of cellLog) (visited[c.zone] ||= new Set()).add(c.key);
  const zones = {};
  let totV = 0, totW = 0;
  for (const z of new Set([...Object.keys(walk), ...Object.keys(visited)])) {
    const w = walk[z] ?? 0;
    const v = visited[z] ? visited[z].size : 0;
    // A cell can be entered that the walkable grid did not predict (a floor
    // that streamed in late, a lift car). Never report over 100 %.
    zones[z] = { walkable: w, visited: v, fraction: w > 0 ? Math.min(1, v / w) : null };
    // A zone whose walkable grid came out empty has no denominator, so it
    // cannot contribute to an average — adding its visited cells to the
    // numerator alone is how a zone that gridded to zero used to inflate the
    // overall figure instead of being reported as unmeasured.
    if (w > 0) { totV += Math.min(v, w); totW += w; }
  }
  return { zones, overall: totW > 0 ? Math.min(1, totV / totW) : null, walkableTotal: totW };
}

/** How often it walks back into somewhere it has already been. */
export function revisits(cellLog) {
  const entries = cellLog.length;
  const fresh = cellLog.filter((c) => c.isNew).length;
  const again = entries - fresh;
  return { entries, fresh, revisits: again, rate: entries ? again / entries : 0 };
}

/**
 * Stretches with no new cell discovered. The gap before the first discovery and
 * the gap after the last one both count, and the tail is flagged, because a bot
 * that finds nothing in the last four minutes is the finding.
 *
 * NOT seeded with the session. §7 of docs/PLAYTEST_2026-07-31.md is a whole
 * section about the last metric in this project that was.
 */
export function lostStretches(cellLog, simSeconds, from = 0) {
  const found = cellLog.filter((c) => c.isNew);
  const out = [];
  let prevT = from, prevPos = found.length ? found[0].pos : null, prevZone = found.length ? found[0].zone : null;
  for (const f of found) {
    if (f.t - prevT > 0) {
      out.push({ from: prevT, to: f.t, seconds: f.t - prevT, at: prevPos, zone: prevZone, tail: false });
    }
    prevT = f.t; prevPos = f.pos; prevZone = f.zone;
  }
  if (simSeconds - prevT > 0) {
    out.push({ from: prevT, to: simSeconds, seconds: simSeconds - prevT, at: prevPos, zone: prevZone, tail: true });
  }
  out.sort((a, b) => b.seconds - a.seconds);
  return { longest: out[0] || null, top: out.slice(0, 8), totalStretches: out.length };
}

/** Places it stood still. Greedy, non-overlapping, anchored on the first sample. */
export function stalls(samples, radius = STALL_RADIUS, minSeconds = STALL_SECONDS) {
  const out = [];
  let i = 0;
  while (i < samples.length) {
    const a = samples[i];
    let j = i + 1;
    while (j < samples.length) {
      const b = samples[j];
      if (Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]) > radius) break;
      j++;
    }
    const secs = (samples[j - 1]?.t ?? a.t) - a.t;
    if (secs >= minSeconds) {
      out.push({
        from: a.t, to: samples[j - 1].t, seconds: secs, at: a.pos, zone: a.zone,
        // A stall with the controls off is a modal screen or a hiding place, not
        // a level-design defect. Named, not silently merged in.
        controlsOff: samples.slice(i, j).some((s) => s.controls === false),
      });
      i = j;
    } else i++;
  }
  return out.sort((a, b) => b.seconds - a.seconds);
}

/** Contiguous runs with nothing interactable and no door visible or in reach. */
export function cueless(samples, sampleDt) {
  const runs = [];
  let cur = null;
  for (const s of samples) {
    if (s.cue === 0) {
      if (!cur) cur = { from: s.t, to: s.t, at: s.pos, zone: s.zone };
      else cur.to = s.t;
    } else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  for (const r of runs) r.seconds = (r.to - r.from) + sampleDt;
  const total = samples.filter((s) => s.cue === 0).length * sampleDt;
  runs.sort((a, b) => b.seconds - a.seconds);
  return { runs: runs.slice(0, 8), totalSeconds: total,
    fraction: samples.length ? samples.filter((s) => s.cue === 0).length / samples.length : 0,
    longest: runs[0] || null };
}

/** Contiguous stretches of the session spent in one zone. */
export function visitsTo(samples, zone) {
  const out = [];
  let cur = null;
  for (const s of samples) {
    if (s.zone === zone) { if (!cur) cur = { from: s.t, to: s.t }; else cur.to = s.t; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Per-zone rollup.
 *
 * `longestLost` IS COMPUTED PER VISIT, not over the zone's whole cell log.
 * Filtering the log by zone and taking the largest gap in it measures the time
 * BETWEEN two visits, which is a number about somewhere else. The first run of
 * this tool reported "worst lost 494.9 s" for the Service Spine, a zone the bot
 * had been inside for four seconds. The metric was adjacent to its own label.
 */
export function perZone(samples, cellLog, walk, sampleDt, interactions, events) {
  const ids = new Set([...Object.keys(walk), ...samples.map((s) => s.zone), ...cellLog.map((c) => c.zone)]);
  const rows = [];
  for (const z of ids) {
    if (!z) continue;
    const ss = samples.filter((s) => s.zone === z);
    const cl = cellLog.filter((c) => c.zone === z);
    const cov = coverage({ [z]: walk[z] ?? 0 }, cl).zones[z];
    const visits = visitsTo(samples, z);
    let worst = null;
    for (const v of visits) {
      const sub = cl.filter((c) => c.t >= v.from && c.t <= v.to);
      const l = lostStretches(sub, v.to, v.from).longest;
      if (l && (!worst || l.seconds > worst.seconds)) worst = l;
    }
    rows.push({
      zone: z,
      seconds: ss.length * sampleDt,
      walkable: cov.walkable, visited: cov.visited, coverage: cov.fraction,
      entries: cl.length, revisitRate: revisits(cl).rate,
      cuelessFraction: ss.length ? ss.filter((s) => s.cue === 0).length / ss.length : null,
      longestLost: worst ? +worst.seconds.toFixed(1) : null,
      interactions: interactions.filter((i) => i.zone === z).length,
      firstSeen: ss.length ? ss[0].t : null,
      visits: visits.length,
      lockedDoorNags: events.filter((e) => e.key === 'portal:locked' && e.zoneAt === z).length,
    });
  }
  return rows.sort((a, b) => b.seconds - a.seconds);
}

// ---------------------------------------------------------------------------
// SELF-TEST. Runs the five functions above against states whose answers are
// known by construction, including the states that would make each metric
// unfailable. No browser, no build, ~5 ms.
// ---------------------------------------------------------------------------
function selftest() {
  const results = [];
  const T = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
  const close = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

  // --- coverage ------------------------------------------------------------
  T('coverage of an empty walk is 0, not 1',
    coverage({ intake: 100 }, []).zones.intake.fraction === 0,
    `got ${coverage({ intake: 100 }, []).zones.intake.fraction}`);
  const half = coverage({ intake: 10 }, Array.from({ length: 5 }, (_, i) => ({ zone: 'intake', key: `k${i}` })));
  T('coverage of 5 distinct cells of 10 is 0.5', close(half.zones.intake.fraction, 0.5), `got ${half.zones.intake.fraction}`);
  const dup = coverage({ intake: 10 }, Array.from({ length: 40 }, () => ({ zone: 'intake', key: 'k0' })));
  T('coverage counts DISTINCT cells (40 entries in one cell is 0.1)',
    close(dup.zones.intake.fraction, 0.1), `got ${dup.zones.intake.fraction}`);
  T('coverage cannot exceed 1', coverage({ intake: 2 }, [{ zone: 'intake', key: 'a' }, { zone: 'intake', key: 'b' }, { zone: 'intake', key: 'c' }]).zones.intake.fraction === 1);
  T('coverage is null, not 1, when the denominator is unknown',
    coverage({}, [{ zone: 'ghost', key: 'a' }]).zones.ghost.fraction === null);
  // The failure mode the brief names: a metric that cannot go down.
  const full = Array.from({ length: 20 }, (_, i) => ({ zone: 'intake', key: `k${i}` }));
  T('TRUNCATION LOWERS COVERAGE (half the log gives half the coverage)',
    coverage({ intake: 20 }, full).zones.intake.fraction === 1
    && close(coverage({ intake: 20 }, full.slice(0, 10)).zones.intake.fraction, 0.5),
    `full ${coverage({ intake: 20 }, full).zones.intake.fraction}, half ${coverage({ intake: 20 }, full.slice(0, 10)).zones.intake.fraction}`);

  // --- revisits ------------------------------------------------------------
  const rv = revisits([{ isNew: true }, { isNew: true }, { isNew: false }, { isNew: false }]);
  T('revisit rate of 2 fresh + 2 repeat is 0.5', close(rv.rate, 0.5), `got ${rv.rate}`);
  T('revisit rate of a walk that never repeats is 0',
    revisits([{ isNew: true }, { isNew: true }]).rate === 0);
  T('revisit rate of a walk that never discovers is 1',
    revisits([{ isNew: false }, { isNew: false }]).rate === 1);

  // --- lost stretches ------------------------------------------------------
  // THE seeded-with-the-session bug, in the form it took in playthrough.mjs.
  const busy = lostStretches(
    Array.from({ length: 100 }, (_, i) => ({ t: i, isNew: true, pos: [0, 0, 0], zone: 'intake' })), 100);
  T('LOST TIME IS NOT ALWAYS THE SESSION (100 discoveries in 100 s -> 1 s, not 100 s)',
    close(busy.longest.seconds, 1), `got ${busy.longest.seconds}`);
  const idle = lostStretches([{ t: 0, isNew: true, pos: [0, 0, 0], zone: 'intake' }], 100);
  T('a session that discovers nothing after t=0 reports the whole tail as lost',
    close(idle.longest.seconds, 100) && idle.longest.tail === true, `got ${idle.longest.seconds}`);
  const mid = lostStretches([
    { t: 0, isNew: true, pos: [1, 0, 1], zone: 'intake' },
    { t: 5, isNew: true, pos: [2, 0, 2], zone: 'intake' },
    { t: 60, isNew: true, pos: [3, 0, 3], zone: 'intake' },
    { t: 62, isNew: true, pos: [4, 0, 4], zone: 'intake' },
  ], 70);
  T('the longest gap is found in the middle of a session, and located',
    close(mid.longest.seconds, 55) && mid.longest.at[0] === 2,
    `got ${mid.longest.seconds}s at ${JSON.stringify(mid.longest.at)}`);
  T('lost stretches never exceed the session',
    mid.top.every((s) => s.seconds <= 70));
  T('a window that starts late does not charge itself the time before it',
    close(lostStretches([{ t: 100, isNew: true, pos: [0, 0, 0], zone: 'z' }], 105, 99).longest.seconds, 5),
    `got ${lostStretches([{ t: 100, isNew: true, pos: [0, 0, 0], zone: 'z' }], 105, 99).longest.seconds}`);

  // --- per-zone: the one that was wrong in the first real run ---------------
  {
    // Two seconds in `service` at the start, two at the end, 500 s of `intake`
    // in between. The gap between the two visits is ~500 s and belongs to
    // neither of them.
    const S2 = [];
    for (let t = 0; t <= 504; t++) S2.push({ t, zone: (t <= 2 || t >= 502) ? 'service' : 'intake', pos: [t, 0, 0], cue: 1, controls: true });
    const CL = [
      { t: 0, zone: 'service', key: 's0', isNew: true, pos: [0, 0, 0] },
      { t: 2, zone: 'service', key: 's1', isNew: true, pos: [0, 0, 0] },
      { t: 250, zone: 'intake', key: 'i0', isNew: true, pos: [0, 0, 0] },
      { t: 502, zone: 'service', key: 's2', isNew: true, pos: [0, 0, 0] },
      { t: 504, zone: 'service', key: 's3', isNew: true, pos: [0, 0, 0] },
    ];
    const rows = perZone(S2, CL, { service: 10, intake: 10 }, 1, [], []);
    const svc = rows.find((r) => r.zone === 'service');
    T('PER-ZONE LOST TIME IS TIME LOST IN THE ZONE, NOT TIME AWAY FROM IT',
      svc.longestLost <= 3, `service: ${svc.longestLost} s lost across ${svc.visits} visits of 2 s each`);
    T('per-zone visits are counted as separate stretches', svc.visits === 2, `got ${svc.visits}`);
    T('visitsTo splits a return trip into two visits',
      visitsTo(S2, 'service').length === 2 && visitsTo(S2, 'intake').length === 1);
  }

  // --- stalls --------------------------------------------------------------
  const walking = Array.from({ length: 60 }, (_, i) => ({ t: i, pos: [i, 0, 0], zone: 'intake', controls: true }));
  T('a bot that never stops has no stalls', stalls(walking).length === 0, `got ${stalls(walking).length}`);
  const stuck = Array.from({ length: 60 }, (_, i) => ({ t: i, pos: [i < 40 ? 0 : i, 0, 0], zone: 'intake', controls: true }));
  const st = stalls(stuck);
  T('a 39 s stand-still is one stall of 39 s at the right place',
    st.length === 1 && close(st[0].seconds, 39) && st[0].at[0] === 0, JSON.stringify(st[0] || null));
  T('a stall shorter than the threshold is not a stall',
    stalls(Array.from({ length: 20 }, (_, i) => ({ t: i, pos: [i < 5 ? 0 : i, 0, 0], zone: 'i', controls: true }))).length === 0);

  // --- cueless -------------------------------------------------------------
  const seen = Array.from({ length: 10 }, (_, i) => ({ t: i, cue: 1, pos: [0, 0, 0], zone: 'i' }));
  T('a bot that always has a door in view has 0 cueless time', cueless(seen, 1).totalSeconds === 0);
  const blind = seen.map((s, i) => ({ ...s, cue: i >= 3 && i <= 6 ? 0 : 1 }));
  const cl = cueless(blind, 1);
  T('four cueless samples at 1 s each is 4 s, in one run',
    close(cl.totalSeconds, 4) && cl.runs.length === 1 && close(cl.longest.seconds, 4),
    `${cl.totalSeconds}s in ${cl.runs.length} run(s)`);
  T('cueless fraction of an all-blind session is 1',
    cueless(seen.map((s) => ({ ...s, cue: 0 })), 1).fraction === 1);

  const bad = results.filter((r) => !r.ok);
  console.log('\n  metric self-test\n' + '─'.repeat(76));
  for (const r of results) console.log(`  ${r.ok ? 'pass' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  console.log('─'.repeat(76));
  console.log(`  ${results.length - bad.length}/${results.length} passed`);
  return bad.length;
}

/**
 * `--verify <explore.json>` — the self-test again, but against a REAL session.
 *
 * The synthetic tests above prove the functions are right about numbers I made
 * up. This proves the same functions, fed the run that produced the report, both
 * reproduce that report (so nothing in it is hard-coded) and MOVE when the
 * session is cut short (so nothing in it is a constant). It exists because this
 * repo has shipped a metric that always printed the same answer and an assertion
 * that could never fail, and "I checked" is not evidence.
 */
async function verify(file) {
  const { readFile } = await import('node:fs/promises');
  const J = JSON.parse(await readFile(file, 'utf8'));
  const log = J.cellLog, S = J.samples, walk = J.walkable, T = J.simSeconds;
  const R = [];
  const T_ = (name, ok, detail = '') => { R.push({ name, ok: !!ok, detail }); };

  // 1. The report is derived from the record, not written into it.
  const cov = coverage(walk, log);
  T_('recomputing coverage from the stored cell log reproduces the report',
    Math.abs((cov.overall ?? -1) - (J.metrics.coverage.overall ?? -2)) < 1e-9,
    `recomputed ${cov.overall}, reported ${J.metrics.coverage.overall}`);
  const lost = lostStretches(log, T);
  T_('recomputing the lost stretches reproduces the report',
    Math.abs((lost.longest?.seconds ?? -1) - (J.metrics.lost.longest?.seconds ?? -2)) < 1e-9,
    `recomputed ${lost.longest?.seconds}, reported ${J.metrics.lost.longest?.seconds}`);
  const rv = revisits(log);
  T_('recomputing the revisit rate reproduces the report',
    Math.abs(rv.rate - J.metrics.revisits.rate) < 1e-9,
    `recomputed ${rv.rate}, reported ${J.metrics.revisits.rate}`);

  // 2. Coverage falls when the session is cut short — on this session's own data.
  const cuts = [0.25, 0.5, 0.75, 1.0].map((f) => {
    const c = coverage(walk, log.filter((e) => e.t <= T * f));
    return { f, cov: c.overall };
  });
  T_('COVERAGE FALLS WHEN THE SESSION IS TRUNCATED',
    cuts.every((c, i) => i === 0 || c.cov >= cuts[i - 1].cov) && cuts[0].cov < cuts[3].cov,
    cuts.map((c) => `${(c.f * 100).toFixed(0)}%: ${(c.cov * 100).toFixed(1)}%`).join('  '));

  // 3. Lost time is not the session, and not a constant either.
  T_('LOST TIME IS SHORTER THAN THE SESSION THAT CONTAINS IT',
    lost.longest && lost.longest.seconds < T,
    `${num(lost.longest?.seconds, 1)} s of ${num(T, 1)} s (${((lost.longest?.seconds ?? 0) / T * 100).toFixed(1)}%)`);
  const halfLost = lostStretches(log.filter((e) => e.t <= T * 0.5), T * 0.5);
  T_('lost time changes when the session changes',
    halfLost.longest && Math.abs(halfLost.longest.seconds - lost.longest.seconds) > 1e-9,
    `full ${num(lost.longest.seconds, 1)} s, first half ${num(halfLost.longest?.seconds, 1)} s`);

  // 4. The cue metric is not stuck at one end.
  const cl = cueless(S, J.config.sampleEvery);
  T_('the navigational-cue metric took both values during the session',
    S.some((s) => s.cue === 0) && S.some((s) => s.cue > 0),
    `${S.filter((s) => s.cue === 0).length} samples with nothing in view, `
    + `${S.filter((s) => s.cue > 0).length} with something; fraction ${(cl.fraction * 100).toFixed(1)}%`);
  T_('the vision cull is not rejecting everything',
    (J.metrics.visionCull?.seen ?? 0) > 0, JSON.stringify(J.metrics.visionCull));

  // 5. The coverage denominator is a real measurement of a real zone.
  T_('the walkable grid is non-empty and finite',
    Object.values(walk).every((v) => v > 0 && Number.isFinite(v)), JSON.stringify(walk));
  T_('the bot visited fewer cells than exist (coverage is not pinned at 100 %)',
    (cov.overall ?? 1) < 1, `${((cov.overall ?? 1) * 100).toFixed(1)}%`);

  const bad = R.filter((r) => !r.ok);
  console.log(`\n  verifying the metrics against ${file}\n` + '─'.repeat(76));
  for (const r of R) console.log(`  ${r.ok ? 'pass' : 'FAIL'}  ${r.name}${r.detail ? '\n          ' + r.detail : ''}`);
  console.log('─'.repeat(76));
  console.log(`  ${R.length - bad.length}/${R.length} passed`);
  return bad.length;
}

if (args.selftest) { process.exit(selftest() ? 1 : 0); }
if (args.verify) { process.exit((await verify(String(args.verify))) ? 1 : 0); }

// ---------------------------------------------------------------------------

async function up(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// ===========================================================================
// THE IN-PAGE BOT.
// ===========================================================================
/* eslint-disable */
function installDriver(cfg) {
  const g = window.ANNEX;
  const RENDER_EVERY = Math.max(1, cfg.renderEvery || 1);
  const CELL = cfg.cell, YCELL = cfg.ycell;
  const SEE = 14.0;          // how far the bot notices something, metres
  const LOOK = 12.0;         // how far it probes a heading for openness
  g.stop();

  const TAU = Math.PI * 2;
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const EX = window.__EX = {
    t: 0, frame: 0,
    samples: [], events: [], cellLog: [], interactions: [], frameMs: [],
    visited: new Map(),      // cellKey -> {t, n}
    walk: {},                // zoneId -> Set of walkable cell keys
    walkCount: {},
    nanFrames: 0, noFloorFrames: 0, noFloorRun: 0, worstNoFloorRun: 0,
    yMin: Infinity, yMax: -Infinity,
    distance: 0, stepCount: 0,
    mode: 'explore', targetId: null, approachT: 0,
    desiredYaw: g.player.yaw, commit: 0, heading: g.player.yaw,
    recent: [],              // recently committed headings, to stop ping-ponging
    tried: new Map(),
    unstick: 0, unsticks: 0, backT: 0,
    lastNewT: 0, lostFlag: 0,
    hidden: 0, hiddenT: 0, noControl: 0, revives: 0, ended: false,
    lampToggles: 0, lampCheck: 0,
    zoneSeq: [],
    _lastPos: null,
  };

  // ---- the eight zone patches, for MEASUREMENT ONLY ------------------------
  // Used to attribute a floor rectangle to a zone when building the coverage
  // denominator. The steering never touches this and never touches `g.world`.
  const ZONE_IDS = ['intake', 'service', 'cistern', 'residence', 'plant', 'duct', 'stack', 'safe'];
  const ORIGINS = ZONE_IDS.map((id) => ({ id, o: g.world?.origin?.(id) || [0, 0, 0] }));
  const zoneOf = (x, z) => {
    let best = null, bd = Infinity;
    for (const e of ORIGINS) {
      const d = (x - e.o[0]) ** 2 + (z - e.o[2]) ** 2;
      if (d < bd) { bd = d; best = e.id; }
    }
    return best;
  };

  // ---- events -------------------------------------------------------------
  const rawEmit = g.bus.emit.bind(g.bus);
  const brief = (a) => {
    if (a == null || typeof a !== 'object') return a === undefined ? '' : String(a);
    const out = {};
    for (const k of ['zone', 'from', 'state', 'id', 'kind', 'title', 'reason', 'objective',
      'completed', 'name', 'cause', 'surface', 'locked', 'circuit', 'powered', 'item', 'text']) {
      if (a[k] !== undefined && typeof a[k] !== 'object') out[k] = a[k];
    }
    return out;
  };
  g.bus.emit = (k, ...a) => {
    if (k === 'player:step') EX.stepCount++;
    else if (k !== 'player:noise' && k !== 'world:noise' && k !== 'entity:tick') {
      EX.events.push({ t: +EX.t.toFixed(3), key: k, data: brief(a[0]),
        zoneAt: g.world?.currentZone || g.currentZone || null });
      if (EX.events.length > 40000) EX.events.shift();
    }
    return rawEmit(k, ...a);
  };

  // ---- keys: real DOM events on window ------------------------------------
  const key = (code, downUp) =>
    window.dispatchEvent(new KeyboardEvent(downUp ? 'keydown' : 'keyup', { code, bubbles: true }));
  EX.held = new Set();
  EX.hold = (code, want) => {
    if (want && !EX.held.has(code)) { EX.held.add(code); key(code, true); }
    else if (!want && EX.held.has(code)) { EX.held.delete(code); key(code, false); }
  };
  EX.tap = (code) => { key(code, true); key(code, false); };
  EX.look = (dyaw, dpitch) => {
    const s = g.input.sensitivity || 0.0021;
    g.input.mouse.dx += -dyaw / s;
    g.input.mouse.dy += -(dpitch || 0) / s;
  };

  // ---- PERCEPTION ---------------------------------------------------------
  const eyeY = () => g.player.position.y + (g.player.eyeHeight || 1.63);

  /**
   * How far a heading is walkable, from here. Marches at 0.6 m: sight is
   * blocked by anything solid that is not tagged `ceiling` (soffits are ducked
   * under, not walls), and the march also stops where the floor stops or steps
   * more than a stride, because a player does not walk off a gantry.
   */
  const openAhead = (yaw, max) => {
    const p = g.player.position, y = p.y + 0.9;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let px = p.x, pz = p.z, floorY = p.y, out = 0;
    for (let d = 0.6; d <= max; d += 0.6) {
      const nx = p.x + fx * d, nz = p.z + fz * d;
      if (g.collision.segmentBlocked(px, y, pz, nx, y, nz, 'ceiling')) break;
      const fl = g.collision.sampleFloor(nx, nz, floorY + 1.1, 1.1);
      if (!fl || fl.y < floorY - 1.5) break;
      floorY = fl.y; px = nx; pz = nz; out = d;
    }
    return { d: out, x: px, z: pz, y: floorY };
  };

  const cellKey = (x, y, z) =>
    `${Math.floor(x / CELL)}|${Math.floor(z / CELL)}|${Math.round(y / YCELL)}`;

  /** World position of an interactable's hit object. */
  const objPos = (o) => {
    if (!o) return null;
    o.updateMatrixWorld(true);
    const m = o.matrixWorld.elements;
    return { x: m[12], y: m[13], z: m[14] };
  };

  const cam = g.engine.camera;
  const halfFov = () => {
    const vf = (cam.fov || 65) * Math.PI / 180;
    return Math.atan(Math.tan(vf / 2) * (cam.aspect || 16 / 9));
  };

  /**
   * What is on screen, or close enough to reach out and touch.
   *
   * Doors ARE in this list: `ZoneGameplay` and `Interactables.doorway()` both
   * register every latch as an interactable of kind `door`, so "no interactable
   * and no door in view" is one query and not two.
   */
  EX.visReject = { far: 0, behind: 0, elevation: 0, occluded: 0, hidden: 0, seen: 0 };
  EX.visible = () => {
    const p = g.player.position, ey = eyeY(), yaw = g.player.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const cosH = Math.cos(halfFov() + 0.09);
    const R = EX.visReject;
    const out = [];
    for (const it of g.interactor?.items || []) {
      if (!it.object || it.object.visible === false) { R.hidden++; continue; }
      const q = objPos(it.object);
      if (!q) { R.hidden++; continue; }
      const dx = q.x - p.x, dz = q.z - p.z;
      const flat = Math.hypot(dx, dz);
      const dist = Math.hypot(dx, q.y - ey, dz);
      if (dist > SEE) { R.far++; continue; }
      const inReach = dist <= (it.range ?? 2.2);
      if (!inReach) {
        // Horizontal: the camera's real FOV. Vertical: generous, because a
        // player standing up sees the floor two metres in front of their boots
        // without ducking their head.
        if (flat < 1e-3) { R.behind++; continue; }
        if ((fx * dx + fz * dz) / flat < cosH) { R.behind++; continue; }
        if (Math.abs(Math.atan2(q.y - ey, Math.max(0.4, flat))) > 0.95) { R.elevation++; continue; }
        // STOP THE RAY SHORT OF WHAT IT IS LOOKING AT.
        //
        // Every one of these things has a collider of its own — a door leaf, a
        // breaker panel, a locker — and a sightline drawn to the object's origin
        // ends INSIDE that collider, so `segmentBlocked` returns true for
        // everything and the cue metric reads zero for the whole session. It did:
        // the first run of this tool reported 100 % of samples with nothing in
        // view while the bot walked past four doors. Back the far end off by
        // 0.45 m along the ray, which is outside any of these boxes and still
        // inside the wall that would genuinely hide it.
        const t = Math.max(0, (dist - 0.45) / dist);
        if (g.collision.segmentBlocked(p.x, ey, p.z,
          p.x + dx * t, ey + (q.y - ey) * t, p.z + dz * t, 'ceiling')) { R.occluded++; continue; }
      }
      R.seen++;
      out.push({ id: it.id, kind: it.kind, label: it.label, verb: it.verb,
        range: it.range ?? 2.2, hold: it.hold ?? 0, d: dist, flat, q, inReach });
    }
    return out.sort((a, b) => a.d - b.d);
  };

  // ---- MEASUREMENT: the coverage denominator ------------------------------
  // Built from `collision.floors` the first time a zone is resident. The bot
  // does not read this; it is the ruler, not the map.
  EX.gridZone = (zoneId) => {
    if (EX.walk[zoneId]) return EX.walkCount[zoneId];
    const cand = new Map();
    for (const f of g.collision.floors) {
      const cx = (f.minX + f.maxX) / 2, cz = (f.minZ + f.maxZ) / 2;
      if (zoneOf(cx, cz) !== zoneId) continue;
      const i0 = Math.floor(f.minX / CELL), i1 = Math.floor(f.maxX / CELL);
      const j0 = Math.floor(f.minZ / CELL), j1 = Math.floor(f.maxZ / CELL);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 60000) continue;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        // PROBE INSIDE THE RECTANGLE, NOT AT THE GRID CENTRE.
        //
        // This took the centre of the 2 m grid cell and discarded it if it fell
        // outside the floor rectangle — so a corridor narrower than the grid
        // contributed NOTHING, because no grid centre can land inside it. The
        // Ductwork is built from 1.8 m spines and gridded to **zero cells**,
        // which made its coverage a division by zero; the Service Spine lost
        // about 60% of its floor the same way and reported 84% covered when it
        // was nearer 33%.
        //
        // Clamp the probe into the rectangle instead. The CELL still keys the
        // count, so a narrow corridor contributes one cell per grid square it
        // crosses, exactly like a wide one.
        const x = Math.min(Math.max((i + 0.5) * CELL, f.minX + 0.02), f.maxX - 0.02);
        const z = Math.min(Math.max((j + 0.5) * CELL, f.minZ + 0.02), f.maxZ - 0.02);
        if (!(x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)) continue;
        const k = `${i}|${j}|${Math.round(f.y / YCELL)}`;
        if (!cand.has(k)) cand.set(k, { x, z, y: f.y });
      }
    }
    const cells = new Set();
    for (const c of cand.values()) {
      const top = g.collision.sampleFloor(c.x, c.z, c.y + 0.3, 0.4);
      if (!top) continue;
      // A cell is walkable if a body can occupy it. `resolveCapsule` is the
      // real query — `pointBlocked` does not exist (PLAYTEST §1.1 defect 5).
      // Crawl height, because the Ductwork's 800 mm soffit is a corridor.
      if (g.collision.resolveCapsule(c.x, top.y + 0.1, c.z, 0.29, 0.62).hit) continue;
      if (g.collision.ceilingAbove(c.x, c.z, top.y + 0.1, 0.29) - top.y < 0.62) continue;
      cells.add(cellKey(c.x, top.y, c.z));
    }
    EX.walk[zoneId] = cells;
    EX.walkCount[zoneId] = cells.size;
    return cells.size;
  };

  // ---- STEERING -----------------------------------------------------------
  /**
   * Choose a heading. Sixteen probes, scored on:
   *   novelty  — do the cells along it contain any it has not stood in
   *   openness — how far it can actually get
   *   turn     — a human does not spin 180 degrees for a marginal gain
   *   recency  — a heading it just committed to and abandoned is deprioritised
   * There is no goal term because there is no goal.
   */
  EX.chooseHeading = (bias) => {
    const p = g.player.position;
    let best = g.player.yaw, score = -Infinity, bestOpen = 0, bestNov = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + EX.headingPhase;
      const o = openAhead(a, LOOK);
      if (o.d < 1.0) continue;
      // Novelty: walk the ray and ask "have I stood there".
      let nov = 0;
      const fx = -Math.sin(a), fz = -Math.cos(a);
      let fy = p.y;
      for (let d = 2; d <= o.d; d += 2) {
        const x = p.x + fx * d, z = p.z + fz * d;
        const fl = g.collision.sampleFloor(x, z, fy + 1.1, 1.1);
        if (!fl) break;
        fy = fl.y;
        if (!EX.visited.has(cellKey(x, fl.y, z))) nov += 1 / (1 + d * 0.12);
      }
      let rec = 0;
      for (const r of EX.recent) rec += Math.max(0, 1 - Math.abs(wrap(a - r)) / 0.6);
      const turn = Math.abs(wrap(a - (bias ?? g.player.yaw)));
      const s = nov * 4.0 + Math.min(o.d, LOOK) * 0.30 - turn * 0.55 - rec * 1.1
        + (EX.rand() - 0.5) * 0.5;
      if (s > score) { score = s; best = a; bestOpen = o.d; bestNov = nov; }
    }
    return { yaw: best, open: bestOpen, novelty: bestNov };
  };
  // Deterministic PRNG so a run is reproducible from --seed.
  let _s = (cfg.seed >>> 0) || 0x9e3779b9;
  EX.rand = () => { _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; return ((_s >>> 0) % 100000) / 100000; };
  EX.headingPhase = EX.rand() * TAU;

  /** Give up on a target, permanently or for a while. */
  const giveUp = (id, why, cool) => {
    const rec = EX.tried.get(id) || { presses: 0, refusals: 0 };
    rec.done = true; rec.why = why;
    if (cool) rec.retryAt = EX.t + cool;
    EX.tried.set(id, rec);
  };
  const isCandidate = (v) => {
    const rec = EX.tried.get(v.id);
    if (!rec) return true;
    if (rec.done && (rec.retryAt == null || EX.t < rec.retryAt)) return false;
    return rec.presses < 4 && rec.refusals < 2;
  };

  // ---- one frame ----------------------------------------------------------
  EX.tick = () => {
    const p = g.player.position;

    // --- answer the death screen (playthrough.mjs §8: a run that dies and
    // never gets up measures the silence of a modal, not of the game).
    if (g.state === 'dead' && EX.t - (EX.lastReviveAt ?? -99) > 1.5) {
      EX.lastReviveAt = EX.t; EX.revives++;
      g.bus.emit('ui:action', { action: 'respawn' });
    }
    if (g.state === 'ended') EX.ended = true;

    // --- NO CONTROLS. This block has to run even though `Player.update` is
    // ignoring input, which is why `tick` is called unconditionally: the first
    // version skipped the whole bot whenever `controlEnabled` was false, so the
    // one situation it was written to escape — being inside a locker, where
    // controls are gone and E is the only key that works — was the one situation
    // it could not run in. The bot got in at 1:17 of a 120 s run and was still in
    // there at the end. That is the identical failure playthrough.mjs hit, from
    // the opposite direction.
    if (g.player.controlEnabled === false) {
      EX.noControl++;
      EX.hold('KeyW', false); EX.hold('KeyS', false);
      if (g.gameplay?.director?.hidden) {
        EX.hiddenT += 1 / 60;
        EX.hidden++;
        // Look around from inside for a moment — that is what a hiding place is
        // for — and then get out. The prompt says "Get out"; press it.
        if (EX.hiddenT > 5 && (EX.t - (EX.lastHideOut ?? -99)) > 1.2) {
          EX.lastHideOut = EX.t; EX.tap('KeyE');
        }
      }
      return;
    }
    EX.hiddenT = 0;

    // --- the lamp. A player in the dark switches it on.
    EX.lampCheck -= 1 / 60;
    if (EX.lampCheck <= 0) {
      EX.lampCheck = 6;
      const fl = g.flashlight;
      if (fl && !fl.isOn && (fl.battery ?? 1) > 0.03) {
        const probe = g.rig.illuminationAt(p.x, p.y + 1.6, p.z);
        if (probe < 0.35) { EX.tap('KeyF'); EX.lampToggles++; }
      }
    }

    // --- what can it see, at 10 Hz -------------------------------------------
    if ((EX.frame % 6) === 0) EX.seen = EX.visible();
    const seen = EX.seen || [];

    if (EX.mode === 'approach') {
      EX.approachT += 1 / 60;
      const item = g.interactor?.get(EX.targetId);
      if (!item) { EX.mode = 'explore'; EX.targetId = null; EX.hold('KeyW', false); }
      else {
        const q = objPos(item.object);
        const dx = q.x - p.x, dz = q.z - p.z;
        const flat = Math.hypot(dx, dz);
        // ABANDON A TARGET IN ANOTHER BUILDING.
        //
        // Zones sit 400 m apart in world space and `interactor.items` spans every
        // resident zone, so a target chosen just before walking through a portal
        // stays resolvable — and the bot then walks 400 m toward it, which means
        // straight back out of the door it just came in by. That is exactly what
        // happened: it reached the Service Spine at 8:15, turned round inside two
        // seconds, and the per-zone row read "4 s in service" as though the Spine
        // had repelled it. It had not; the bot was chasing a door handle in the
        // Intake. Drop the target the moment the zone changes or the thing gets
        // further away than the bot could ever have seen it.
        if (flat > SEE + 10 || (g.world?.currentZone && g.world.currentZone !== EX.targetZone)) {
          EX.interactions.push({ t: +EX.t.toFixed(2), id: EX.targetId, kind: item.kind,
            label: item.label, zone: EX.targetZone,
            result: 'abandoned — left the zone it was in', foundAfter: null });
          giveUp(EX.targetId, 'left the zone', 60);
          EX.mode = 'explore'; EX.targetId = null;
          EX.hold('KeyW', false); EX.hold('KeyE', false);
          return;
        }
        const ey = eyeY();
        const wantYaw = Math.atan2(-dx, -dz);
        const wantPitch = Math.atan2(q.y - ey, Math.max(0.3, flat));
        EX.look(Math.max(-2.6 / 60, Math.min(2.6 / 60, wrap(wantYaw - g.player.yaw))),
          Math.max(-2.0 / 60, Math.min(2.0 / 60, wantPitch - g.player.pitch)));
        const close = flat < (item.range ?? 2.2) * 0.60 + 0.22;
        EX.hold('KeyW', !close);
        // Wall-follow round furniture: same shape as playthrough's detour, but
        // it is allowed to abandon the target entirely, which that one is not.
        if (EX.bestFlat === undefined || flat < EX.bestFlat - 0.25) { EX.bestFlat = flat; EX.stallT = 0; }
        else EX.stallT = (EX.stallT || 0) + 1 / 60;
        if (EX.stallT > 2.5) {
          EX.detour = 1.4; EX.side = (EX.side || 1) * -1; EX.stallT = 0; EX.bestFlat = flat;
        }
        if (EX.detour > 0) {
          EX.detour -= 1 / 60;
          EX.look(Math.max(-2.6 / 60, Math.min(2.6 / 60, wrap(wantYaw + EX.side * 1.5 - g.player.yaw))), 0);
          EX.hold('KeyW', true);
        }

        // Press only when the GAME says it is under the reticle.
        const focus = g.interactor?.focus;
        EX.cool = Math.max(0, (EX.cool || 0) - 1 / 60);
        if (focus?.id === EX.targetId && EX.cool <= 0) {
          const rec = EX.tried.get(EX.targetId) || { presses: 0, refusals: 0 };
          if (focus.blocked) {
            EX.tap('KeyE');
            rec.refusals++; rec.presses++; EX.cool = 0.6;
            EX.interactions.push({ t: +EX.t.toFixed(2), id: EX.targetId, kind: item.kind,
              verb: item.verb, label: item.label, zone: g.world?.currentZone || null,
              result: `refused: ${focus.reason}`, foundAfter: +EX.approachT.toFixed(1) });
            rec.done = true; EX.tried.set(EX.targetId, rec);
            EX.mode = 'explore'; EX.targetId = null; EX.hold('KeyW', false); EX.hold('KeyE', false);
          } else if ((focus.hold || 0) > 0) {
            EX.hold('KeyE', true);
            if (focus.progress > 0.001) EX.heldOnce = true;
            else if (EX.heldOnce) {
              EX.heldOnce = false; EX.hold('KeyE', false); EX.cool = 0.6;
              rec.presses++; EX.tried.set(EX.targetId, rec);
              EX.interactions.push({ t: +EX.t.toFixed(2), id: EX.targetId, kind: item.kind,
                verb: item.verb, label: item.label, zone: g.world?.currentZone || null,
                result: `completed a ${focus.hold}s hold`, foundAfter: +EX.approachT.toFixed(1) });
              giveUp(EX.targetId, 'operated', item.kind === 'door' ? 25 : null);
              EX.mode = 'explore'; EX.targetId = null; EX.hold('KeyW', false);
            }
          } else {
            EX.tap('KeyE');
            rec.presses++; EX.cool = 0.5; EX.tried.set(EX.targetId, rec);
            EX.interactions.push({ t: +EX.t.toFixed(2), id: EX.targetId, kind: item.kind,
              verb: item.verb, label: item.label, zone: g.world?.currentZone || null,
              result: 'operated', foundAfter: +EX.approachT.toFixed(1) });
            giveUp(EX.targetId, 'operated', item.kind === 'door' ? 25 : null);
            EX.mode = 'explore'; EX.targetId = null; EX.hold('KeyW', false);
          }
        }
        // A player does not spend forever on one handle.
        if (EX.approachT > 16) {
          EX.interactions.push({ t: +EX.t.toFixed(2), id: EX.targetId, kind: item.kind,
            label: item.label, zone: g.world?.currentZone || null,
            result: 'gave up — could not reach it', foundAfter: null });
          giveUp(EX.targetId, 'unreachable', 90);
          EX.mode = 'explore'; EX.targetId = null; EX.hold('KeyW', false); EX.hold('KeyE', false);
        }
      }
    }

    if (EX.mode === 'explore') {
      EX.hold('KeyE', false);
      // Something in view worth walking to?
      const cand = seen.find(isCandidate);
      if (cand && (EX.t - (EX.lastTargetAt ?? -99)) > 0.4) {
        EX.mode = 'approach'; EX.targetId = cand.id; EX.approachT = 0;
        EX.targetZone = g.world?.currentZone || g.currentZone || null;
        EX.lastTargetAt = EX.t; EX.bestFlat = undefined; EX.stallT = 0; EX.detour = 0;
      } else {
        // --- wander ---------------------------------------------------------
        if (EX.unstick > 0) {
          EX.unstick -= 1 / 60;
          EX.hold('KeyW', false); EX.hold('KeyS', EX.unstick > 0.7);
          EX.look(Math.max(-2.8 / 60, Math.min(2.8 / 60, wrap(EX.heading - g.player.yaw))), 0);
          if (EX.unstick <= 0) { EX.hold('KeyS', false); EX.commit = 2.0; }
        } else {
          EX.commit -= 1 / 60;
          const ahead = openAhead(g.player.yaw, 4).d;
          if (EX.commit <= 0 || ahead < 1.2) {
            const h = EX.chooseHeading(ahead < 1.2 ? g.player.yaw + Math.PI * 0.5 : g.player.yaw);
            EX.heading = h.yaw;
            EX.recent.push(h.yaw); if (EX.recent.length > 4) EX.recent.shift();
            EX.commit = 0.9 + EX.rand() * 1.2;
            EX.lastChoice = { open: +h.open.toFixed(1), novelty: +h.novelty.toFixed(2) };
          }
          EX.hold('KeyW', true);
          EX.look(Math.max(-2.4 / 60, Math.min(2.4 / 60, wrap(EX.heading - g.player.yaw))), 0);
          // A slow gaze sweep, so the floor in front of the boots and the wall
          // above the skirting both pass through the reticle.
          const wantPitch = -0.18 + Math.sin(EX.t * 0.31) * 0.20;
          EX.look(0, Math.max(-1.2 / 60, Math.min(1.2 / 60, wantPitch - g.player.pitch)));
        }
      }
    }
  };

  EX.renderNow = () => { g.engine.render(1 / 60); };

  /** Advance n frames. */
  EX.run = (n) => {
    for (let i = 0; i < n; i++) {
      EX.tick();
      const t0 = performance.now();
      g.step(1 / 60);
      if ((EX.frame % RENDER_EVERY) === 0) g.engine.render(1 / 60);
      g.input.endFrame();
      EX.frameMs.push(+(performance.now() - t0).toFixed(2));
      EX.t += 1 / 60; EX.frame++;

      const p = g.player.position;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) { EX.nanFrames++; continue; }
      if (p.y < EX.yMin) EX.yMin = p.y;
      if (p.y > EX.yMax) EX.yMax = p.y;
      if (EX._lastPos) EX.distance += Math.hypot(p.x - EX._lastPos[0], p.z - EX._lastPos[2]);
      EX._lastPos = [p.x, p.y, p.z];

      const fl = g.collision.sampleFloor(p.x, p.z, p.y + 1.2, 3.0);
      if (!fl || p.y - fl.y > 2.5) {
        EX.noFloorFrames++; EX.noFloorRun++;
        if (EX.noFloorRun > EX.worstNoFloorRun) EX.worstNoFloorRun = EX.noFloorRun;
      } else EX.noFloorRun = 0;

      // --- the cell log: one entry per boundary crossed --------------------
      const zone = g.world?.currentZone || g.currentZone || null;
      if (zone && !EX.walk[zone]) { EX.gridZone(zone); }
      if (zone && (!EX.zoneSeq.length || EX.zoneSeq[EX.zoneSeq.length - 1].zone !== zone)) {
        EX.zoneSeq.push({ zone, t: +EX.t.toFixed(2) });
        // A new room. The heading and the recent-heading memory were about the
        // last one; keeping them walks the bot back through the door it arrived
        // by, because that is the direction it was already committed to.
        EX.commit = 0; EX.recent.length = 0; EX._trail = [];
      }
      const k = cellKey(p.x, fl ? fl.y : p.y, p.z);
      if (k !== EX._lastCell) {
        EX._lastCell = k;
        const known = EX.visited.get(k);
        const isNew = !known;
        if (isNew) { EX.visited.set(k, { t: EX.t, n: 1 }); EX.lastNewT = EX.t; }
        else known.n++;
        EX.cellLog.push({ t: +EX.t.toFixed(2), zone, key: k, isNew,
          pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] });
      }
      EX.lostFlag = EX.t - EX.lastNewT;

      // --- unstick: 4 s of covering under 0.8 m is not walking -------------
      EX._trail = EX._trail || [];
      if ((EX.frame % 30) === 0) {
        EX._trail.push([p.x, p.z]);
        if (EX._trail.length > 8) EX._trail.shift();
        if (EX._trail.length === 8 && EX.mode === 'explore' && EX.unstick <= 0) {
          const a = EX._trail[0], b = EX._trail[7];
          let span = 0;
          for (const q of EX._trail) span = Math.max(span, Math.hypot(q[0] - a[0], q[1] - a[1]));
          if (span < 0.8 && Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.8) {
            EX.unstick = 1.4; EX.unsticks++; EX._trail.length = 0;
            EX.heading = g.player.yaw + Math.PI * (0.6 + EX.rand() * 0.8);
            EX.recent.length = 0;
          }
        }
      }
    }
    // Everything the driver process needs, in ONE round trip. Asking the page
    // separately for `lostFlag` and `interactions.length` every chunk tripled
    // the wall clock of a run without changing a single number in it.
    const s = EX.sample();
    return { ...s, lost: +EX.lostFlag.toFixed(1), nInteract: EX.interactions.length,
      lastInteract: EX.interactions[EX.interactions.length - 1] || null, ended: EX.ended };
  };

  EX.sample = () => {
    const p = g.player.position;
    const seen = EX.visible();
    const zone = g.world?.currentZone || g.currentZone || null;
    const dir = g.gameplay?.director || null;
    const s = {
      t: +EX.t.toFixed(2), zone,
      pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      yaw: +g.player.yaw.toFixed(2),
      // THE NAVIGATIONAL-CUE METRIC. `cue` is the count of interactables and
      // doors either on screen with a clear sightline or literally within reach.
      cue: seen.length,
      cueNearest: seen.length ? +seen[0].d.toFixed(1) : null,
      doorsInView: seen.filter((v) => v.kind === 'door').length,
      focus: g.interactor?.focus?.id || null,
      mode: EX.mode, target: EX.targetId,
      moving: Math.hypot(g.player.velocity.x, g.player.velocity.z) > 0.25,
      controls: g.player.controlEnabled !== false,
      hidden: !!g.gameplay?.director?.hidden,
      state: g.state,
      sinceNewCell: +(EX.t - EX.lastNewT).toFixed(1),
      cells: EX.visited.size,
      fear: dir ? +dir.fear.toFixed(3) : null,
      entity: g.gameplay?.surveyor?.active ? g.gameplay.surveyor.state : null,
      light: +g.rig.illuminationAt(p.x, p.y + 1.6, p.z).toFixed(2),
      lamp: g.flashlight ? !!g.flashlight.isOn : null,
      ms: +(g.engine.stats.ms ?? 0).toFixed(1),
    };
    EX.samples.push(s);
    return s;
  };

  EX.harvest = () => ({
    samples: EX.samples, events: EX.events, cellLog: EX.cellLog,
    interactions: EX.interactions, frameMs: EX.frameMs,
    walkable: EX.walkCount, zoneSeq: EX.zoneSeq, visReject: EX.visReject,
    tried: [...EX.tried.entries()].map(([id, r]) => ({ id, ...r })),
    frames: EX.frame, simSeconds: EX.t, distance: EX.distance,
    stepCount: EX.stepCount, unsticks: EX.unsticks, lampToggles: EX.lampToggles,
    revives: EX.revives, ended: EX.ended, hiddenFrames: EX.hidden || 0,
    noControlFrames: EX.noControl || 0,
    nanFrames: EX.nanFrames, noFloorFrames: EX.noFloorFrames,
    worstNoFloorRun: EX.worstNoFloorRun, yMin: EX.yMin, yMax: EX.yMax,
    progression: g.gameplay?.progression?.debugState?.() || null,
    inventory: g.gameplay?.inventory?.snapshot?.() || null,
    interactorItems: (g.interactor?.items || []).length,
    doors: (g.interactor?.doors || []).length,
    status: g.status(),
  });

  EX.audioInit = async () => {
    if (!g.audio) return { ok: false, why: 'no audio subsystem' };
    try {
      const ok = await g.audio.init();
      return { ok: !!ok, state: g.audio.engine?.ctx?.state || 'none' };
    } catch (e) { return { ok: false, why: String((e && e.message) || e) }; }
  };

  return { ok: true, zone: g.world?.currentZone || g.currentZone,
    spawn: [g.player.position.x, g.player.position.y, g.player.position.z],
    items: (g.interactor?.items || []).length };
}
/* eslint-enable */

// ===========================================================================

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, 'filmstrip'), { recursive: true });

  const url = `http://127.0.0.1:${PORT}/`;
  let server = null;
  if (!(await up(url, 1200))) {
    if (!existsSync('dist/index.html')) {
      console.error('No dist/ build. Run `npm run build` first.');
      process.exit(1);
    }
    server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
      { stdio: 'ignore' });
    if (!(await up(url, 60000))) { console.error('preview server did not come up'); process.exit(1); }
  }

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox', '--no-sandbox', '--ignore-gpu-blocklist',
      '--enable-webgl', '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: `${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}` }));

  const QS = `?quality=${QUALITY}&qa=1&prewarm=${args.prewarm === '1' ? '1' : '0'}`;
  console.log(`→ ${url}${QS}   ${WIDTH}x${HEIGHT}   renderEvery=${RENDER_EVERY}`);
  const bootT0 = Date.now();
  await page.goto(`${url}${QS}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try {
    await page.waitForFunction('window.ANNEX_READY === true || window.ANNEX_ERROR', { timeout: BOOT_TIMEOUT });
  } catch {
    await writeFile(path.join(OUT, 'explore-console.log'), logs.map((l) => `[${l.type}] ${l.text}`).join('\n'));
    console.error('timed out waiting for ANNEX_READY');
    console.error(logs.slice(-30).map((l) => `[${l.type}] ${l.text}`).join('\n'));
    await browser.close(); server?.kill(); process.exit(2);
  }
  const bootErr = await page.evaluate('window.ANNEX_ERROR || null');
  if (bootErr) {
    console.error('boot failed:\n' + bootErr);
    await browser.close(); server?.kill(); process.exit(3);
  }
  const bootMs = Date.now() - bootT0;
  console.log(`  booted in ${(bootMs / 1000).toFixed(1)}s`);

  const install = await page.evaluate(installDriver,
    { renderEvery: RENDER_EVERY, cell: CELL, ycell: YCELL, seed: parseInt(args.seed || '20260731', 10) });
  console.log(`  bot installed; zone=${install.zone} spawn=[${install.spawn.map((v) => v.toFixed(1)).join(', ')}]`
    + `  (${install.items} interactables registered — the bot is told about none of them)`);

  let audioInit = { ok: false, why: 'skipped (--no-audio)' };
  if (LIVE_AUDIO) {
    audioInit = await page.evaluate(() => window.__EX.audioInit());
    console.log(`  audio init: ok=${audioInit.ok} state=${audioInit.state || audioInit.why}`);
  }

  console.log('  settling (120 frames)…');
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__EX.run(20));
  await page.evaluate(() => {
    const EX = window.__EX;
    EX.t = 0; EX.frame = 0; EX.lastNewT = 0; EX.distance = 0;
    EX.samples.length = 0; EX.events.length = 0; EX.cellLog.length = 0;
    EX.frameMs.length = 0; EX.zoneSeq.length = 0; EX.visited.clear();
    EX._lastCell = null; EX.stepCount = 0;
  });

  // ---- the session --------------------------------------------------------
  const film = [];
  let nextFilm = 0, lastLostFilm = -999, simT = 0;
  let filmRenderMs = 0, filmEncodeMs = 0;
  const grabFilm = async (t, label) => {
    // Force a render: at --renderEvery 32 the canvas can be half a second of
    // simulated time behind the position this frame is labelled with.
    const r0 = Date.now();
    await page.evaluate(() => window.__EX.renderNow());
    filmRenderMs += Date.now() - r0;
    const e0 = Date.now();
    const dataUrl = await page.evaluate(() => document.getElementById('view').toDataURL('image/png'));
    filmEncodeMs += Date.now() - e0;
    const name = `${String(film.length).padStart(3, '0')}_${Math.round(t)}s_${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`;
    await writeFile(path.join(OUT, 'filmstrip', name), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    film.push({ t: +t.toFixed(1), file: `filmstrip/${name}`, label });
  };

  console.log(`\n  ${SECONDS}s of unguided exploration, dt=1/60, ~${Math.round(SECONDS / DT)} frames\n`);
  const wallT0 = Date.now();
  let chunkWall = 0, chunkFrames = 0, nextProgress = 0, lastInteractions = 0, filmWall = 0;
  while (simT < SECONDS) {
    const n = Math.min(CHUNK, Math.round((SECONDS - simT) / DT));
    if (n <= 0) break;
    const c0 = Date.now();
    const s = await page.evaluate((k) => window.__EX.run(k), n);
    simT += n * DT;
    chunkWall += Date.now() - c0; chunkFrames += n;

    if (simT >= nextProgress) {
      nextProgress = simT + 20;
      const eta = (SECONDS - simT) / DT * (chunkWall / chunkFrames) / 1000;
      process.stdout.write(`  ${fmt(simT)}  ${String(s.zone).padEnd(9)} `
        + `pos(${s.pos.map((v) => num(v, 0).padStart(5)).join(',')}) `
        + `cells ${String(s.cells).padStart(4)}  lost ${num(s.lost, 0).padStart(3)}s  `
        + `cue ${s.cue}  ${s.mode}${s.target ? ':' + s.target : ''}  `
        + `${(chunkWall / chunkFrames).toFixed(0)} ms/f  eta ${(eta / 60).toFixed(1)} min\n`);
    }
    const f0 = Date.now();
    if (simT >= nextFilm) { await grabFilm(simT, `${s.zone} exploring`); nextFilm = simT + FILM; }
    // Photograph the places it gets stuck, WHILE it is stuck in them.
    if (s.lost > LOST_FILM && simT - lastLostFilm > LOST_FILM) {
      lastLostFilm = simT;
      await grabFilm(simT, `LOST ${Math.round(s.lost)}s in ${s.zone}`);
      process.stdout.write(`  ${fmt(simT)}  ** lost: ${Math.round(s.lost)} s with nowhere new, in ${s.zone}\n`);
    }
    filmWall += Date.now() - f0;
    if (s.nInteract > lastInteractions) {
      lastInteractions = s.nInteract;
      process.stdout.write(`  ${fmt(simT)}  ** interact ${s.lastInteract.id} (${s.lastInteract.kind}) → ${s.lastInteract.result}\n`);
    }
    if (s.ended) { process.stdout.write(`  ${fmt(simT)}  ** the game ended — stopping\n`); break; }
  }
  const wallMs = Date.now() - wallT0;
  console.log(`\n  wall clock: ${(wallMs / 1000).toFixed(0)} s total — ${(chunkWall / 1000).toFixed(0)} s in the`
    + ` frame loop, ${(filmWall / 1000).toFixed(0)} s photographing `
    + `(${(filmRenderMs / 1000).toFixed(0)} s rendering, ${(filmEncodeMs / 1000).toFixed(0)} s encoding), `
    + `${((wallMs - chunkWall - filmWall) / 1000).toFixed(0)} s of driver overhead`);
  const H = await page.evaluate(() => window.__EX.harvest());
  await grabFilm(simT, 'final frame');
  await browser.close();
  server?.kill();

  console.log(`\n  ${H.frames} frames of ${H.simSeconds.toFixed(1)}s simulated in ${(wallMs / 1000).toFixed(0)}s wall clock`);

  // ---- metrics ------------------------------------------------------------
  const S = H.samples;
  const cov = coverage(H.walkable, H.cellLog);
  const rev = revisits(H.cellLog);
  const lost = lostStretches(H.cellLog, H.simSeconds);
  const st = stalls(S);
  const cl = cueless(S, SAMPLE);
  const zt = perZone(S, H.cellLog, H.walkable, SAMPLE, H.interactions, H.events);

  const completions = H.events.filter((e) => e.key === 'progress:complete');
  const firstObjective = completions.length
    ? { t: completions[0].t, id: completions[0].data?.id, title: completions[0].data?.title }
    : null;
  const zoneVisits = H.zoneSeq;
  const distinctZones = new Set(zoneVisits.map((z) => z.zone));
  const lockedNags = H.events.filter((e) => e.key === 'portal:locked');
  const counts = {};
  for (const e of H.events) counts[e.key] = (counts[e.key] || 0) + 1;

  const ms = H.frameMs;
  const sortedMs = [...ms].sort((a, b) => a - b);
  const pct = (p) => sortedMs[Math.min(sortedMs.length - 1, Math.floor(p * sortedMs.length))] ?? 0;

  const operated = H.interactions.filter((i) => i.result === 'operated' || i.result.startsWith('completed'));
  const refused = H.interactions.filter((i) => i.result.startsWith('refused'));
  const unreachable = H.interactions.filter((i) => i.result.startsWith('gave up'));

  // ---- assertions ---------------------------------------------------------
  // These are about the BOT'S EXPERIENCE, and several of them are expected to
  // go red on the current build. That is the deliverable.
  const checks = [];
  const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); return ok; };
  const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror')
    .filter((l) => !/useProgram|deprecated|Blocked autoplay|AudioContext was not allowed/i.test(l.text));

  check('no console errors during the session', errors.length === 0,
    errors.slice(0, 3).map((e) => e.text.split('\n')[0]).join(' | '));
  check('player position never NaN', H.nanFrames === 0, `${H.nanFrames} frames`);
  check('the bot never fell through the floor', H.worstNoFloorRun === 0,
    `y ${num(H.yMin)}..${num(H.yMax)}; ${H.noFloorFrames} of ${H.frames} frames off a floor `
    + `(worst run ${H.worstNoFloorRun})`);
  check('the bot actually walked (averaged over 1 m of ground per second)',
    H.distance > H.simSeconds,
    `${num(H.distance, 0)} m in ${num(H.simSeconds, 0)} s`);
  check('the bot found and operated an interactable with no hint',
    operated.length >= 1,
    operated.length ? operated.map((i) => i.id).join(', ') : 'nothing was ever operated');
  check('the bot got out of its starting zone unaided',
    distinctZones.size >= 2,
    `${distinctZones.size} zone(s): ${[...distinctZones].join(' → ')}`);
  // Coverage is a function of session length as well as of level design, so the
  // threshold is deliberately low and is stated as such in the report.
  check('the starting zone is at least 25 % covered',
    (cov.zones[zoneVisits[0]?.zone]?.fraction ?? 0) >= 0.25,
    `${zoneVisits[0]?.zone}: ${((cov.zones[zoneVisits[0]?.zone]?.fraction ?? 0) * 100).toFixed(1)}% of `
    + `${cov.zones[zoneVisits[0]?.zone]?.walkable ?? 0} walkable cells in ${num(H.simSeconds, 0)} s`);
  // The one that is length-independent: was it still getting anywhere at the end,
  // or had it run out of building it could find? A bot that discovers nothing in
  // the last quarter of a session has stopped exploring and started pacing.
  {
    const cut = H.simSeconds * 0.75;
    const lateNew = H.cellLog.filter((c) => c.isNew && c.t >= cut).length;
    check('the bot was still finding new ground in the last quarter of the session',
      lateNew > 0, `${lateNew} new cells after ${fmt(cut)}`);
  }
  check('the bot was not lost for more than a quarter of the session',
    lost.longest ? lost.longest.seconds < H.simSeconds * 0.25 : false,
    lost.longest ? `longest stretch with nowhere new: ${num(lost.longest.seconds, 1)} s `
      + `(${(lost.longest.seconds / H.simSeconds * 100).toFixed(0)}% of the session) at `
      + `${pos3(lost.longest.at)} in ${lost.longest.zone}` : 'no cells were ever entered');
  check('less than half the session had no navigational cue in sight',
    cl.fraction < 0.5, `${(cl.fraction * 100).toFixed(1)}% of samples had nothing to walk toward`);
  check('no single stall lasted longer than 60 s',
    !st.length || st[0].seconds <= 60,
    st.length ? `worst ${num(st[0].seconds, 0)} s at ${pos3(st[0].at)} in ${st[0].zone}`
      + (st[0].controlsOff ? ' (controls were disabled — a modal or a hiding place)' : '') : 'no stalls');
  check('an objective completed without hints',
    !!firstObjective,
    firstObjective ? `${firstObjective.id} at ${fmt(firstObjective.t)}`
      : 'no objective completed in the whole session');
  check('the session never sat on the death screen',
    S.filter((s) => s.state === 'dead').length < S.length * 0.05,
    `${S.filter((s) => s.state === 'dead').length} of ${S.length} samples dead; ${H.revives} revive(s)`);
  check('the session did not get stuck inside a hiding place',
    H.hiddenFrames < H.frames * 0.15, `${H.hiddenFrames} of ${H.frames} frames hidden`);
  const failed = checks.filter((c) => !c.ok);

  // ---- explore.json -------------------------------------------------------
  const metrics = {
    coverage: cov, revisits: rev, lost, stalls: st, cueless: cl, perZone: zt,
    firstObjective, timeToFirstObjective: firstObjective ? firstObjective.t : null,
    zoneSequence: zoneVisits, distinctZones: [...distinctZones],
    lockedDoorNags: lockedNags.length,
    distanceMetres: +H.distance.toFixed(1),
    interactions: { operated: operated.length, refused: refused.length, unreachable: unreachable.length },
    // Why candidate objects were culled from view, summed over every scan. This
    // is the cue metric showing its working: if `occluded` is everything, the
    // sightline test is broken, which is exactly what happened on the first run.
    visionCull: H.visReject,
    eventCounts: counts,
    frameMs: { p50: +pct(0.5).toFixed(2), p90: +pct(0.9).toFixed(2), p99: +pct(0.99).toFixed(2), max: +Math.max(...ms).toFixed(2) },
  };
  await writeFile(path.join(OUT, 'explore.json'), JSON.stringify({
    generated: new Date().toISOString(),
    config: { quality: QUALITY, width: WIDTH, height: HEIGHT, dt: DT, seconds: SECONDS,
      sampleEvery: SAMPLE, filmEvery: FILM, renderEvery: RENDER_EVERY, liveAudio: LIVE_AUDIO,
      cell: CELL, ycell: YCELL, seed: parseInt(args.seed || '20260731', 10) },
    boot: { ms: bootMs, audioInit },
    frames: H.frames, simSeconds: +H.simSeconds.toFixed(2), wallMs,
    checks, metrics,
    walkable: H.walkable, progression: H.progression, inventory: H.inventory,
    interactorItems: H.interactorItems, doors: H.doors,
    tried: H.tried, interactionLog: H.interactions,
    samples: S, cellLog: H.cellLog, events: H.events, film,
    status: H.status, console: logs.slice(-300),
  }, null, 2));

  // ---- explore.md ---------------------------------------------------------
  const L = [];
  const pctS = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
  L.push('# THE ANNEX — an exploration bot, and what it could not find');
  L.push('');
  L.push(`Generated ${new Date().toISOString()} by \`tools/qa/explore.mjs\`.`);
  L.push('');
  L.push(`**${H.frames} frames · ${H.simSeconds.toFixed(1)} s of unguided play at a fixed 1/60 step · `
    + `${(wallMs / 1000).toFixed(0)} s of wall clock · quality \`${QUALITY}\` · ${WIDTH}×${HEIGHT} · `
    + `render 1 frame in ${RENDER_EVERY}**`);
  L.push('');
  L.push('This bot is given no route, no zone list, no interactable ids and no objectives. It steers');
  L.push('on line-of-sight probes into the collision world, prefers headings that lead somewhere it');
  L.push('has not stood, and presses the interact key only on frames where the game itself reports');
  L.push('something under the reticle. Every zone change in the timeline below happened because it');
  L.push('walked into a doorway and `World.update` fired the portal. Keys are real DOM events; mouse');
  L.push('look is written into `Input.mouse`, because headless Chromium cannot grant pointer lock.');
  L.push('');
  L.push('The coverage denominator is built from `collision.floors`, which the bot never reads. The');
  L.push('ruler is allowed to know the size of the room; the walker is not.');
  L.push('');

  L.push('## Assertions');
  L.push('');
  L.push('| | check | detail |');
  L.push('|---|---|---|');
  for (const c of checks) L.push(`| ${c.ok ? '**PASS**' : '**FAIL**'} | ${c.name} | ${c.detail || ''} |`);
  L.push('');
  if (failed.length) L.push(`**${failed.length} check(s) failed.** They are findings, not tool errors — see below.`);
  L.push('');

  L.push('## The headline numbers');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| Time to first objective, no hints | ${firstObjective ? `**${fmt(firstObjective.t)}** — ${firstObjective.title || firstObjective.id}` : '**never** — no objective completed in the session'} |`);
  L.push(`| Walkable area visited | **${pctS(cov.overall)}** of ${cov.walkableTotal} cells of ${CELL} m across the zones it reached |`);
  L.push(`| Revisit rate | **${pctS(rev.rate)}** — ${rev.revisits} of ${rev.entries} cell entries were somewhere it had already been |`);
  L.push(`| Longest stretch with nowhere new | **${lost.longest ? num(lost.longest.seconds, 1) + ' s' : '—'}**${lost.longest ? ` (${fmt(lost.longest.from)} → ${fmt(lost.longest.to)}), at ${pos3(lost.longest.at)} in \`${lost.longest.zone}\`${lost.longest.tail ? ' — and it never recovered' : ''}` : ''} |`);
  L.push(`| No navigational cue in sight | **${pctS(cl.fraction)}** of the session (${num(cl.totalSeconds, 0)} s), longest run ${cl.longest ? num(cl.longest.seconds, 0) + ' s' : '0 s'} |`);
  L.push(`| Zones reached | **${distinctZones.size} of 8** — ${[...distinctZones].join(', ')} |`);
  L.push(`| Ground covered | ${num(H.distance, 0)} m |`);
  L.push(`| Interactables operated | ${operated.length} operated, ${refused.length} refused, ${unreachable.length} seen but never reached |`);
  L.push(`| Locked-door refusals walked into | ${lockedNags.length} |`);
  L.push(`| Times it had to shove itself out of a corner | ${H.unsticks} |`);
  L.push('');

  L.push('## Per zone');
  L.push('');
  L.push('| zone | time | visits | coverage | cells | revisit | no cue | worst lost | operated | locked |');
  L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of zt) {
    L.push(`| \`${r.zone}\` | ${num(r.seconds, 0)} s | ${r.visits} | ${pctS(r.coverage)} | `
      + `${r.visited}/${r.walkable} | ${pctS(r.revisitRate)} | ${pctS(r.cuelessFraction)} | `
      + `${r.longestLost ?? '—'} s | ${r.interactions} | ${r.lockedDoorNags} |`);
  }
  L.push('');
  L.push('`coverage` is 2 m × 2 m × 3 m cells of walkable floor the bot physically stood in, over every');
  L.push('such cell in the zone that a body fits in. A zone with a high revisit rate and low coverage is');
  L.push('a zone the bot walked in circles in. `worst lost` is the longest stretch **inside one visit to');
  L.push('that zone** with no new cell found — not the time between two visits, which is a number about');
  L.push('somewhere else.');
  L.push('');
  L.push('**A 2 m grid is coarse for a corridor.** A cell whose centre lands in a wall is dropped from');
  L.push('the denominator, so a zone made of 1.8 m spines loses proportionally more of its floor to the');
  L.push('grid than a zone made of halls does, and its coverage percentage reads high for that reason');
  L.push('alone. Compare a zone against itself across builds; do not rank zones against each other on');
  L.push('this column.');
  L.push('');

  L.push('## Where it got lost');
  L.push('');
  L.push('Stretches with no new cell discovered. Long ones are rooms without a way on.');
  L.push('');
  L.push('| from | to | seconds | zone | last new ground |');
  L.push('|---|---|---:|---|---|');
  for (const s of lost.top) {
    L.push(`| ${fmt(s.from)} | ${fmt(s.to)} | ${num(s.seconds, 1)} | \`${s.zone}\` | ${pos3(s.at)}${s.tail ? ' *(ran out the clock)*' : ''} |`);
  }
  L.push('');

  L.push('## Where it stalled');
  L.push('');
  if (!st.length) L.push(`No stall of ${STALL_SECONDS} s or more inside a ${STALL_RADIUS} m radius.`);
  else {
    L.push(`Stayed inside a ${STALL_RADIUS} m radius for at least ${STALL_SECONDS} s.`);
    L.push('');
    L.push('| from | seconds | zone | position | note |');
    L.push('|---|---:|---|---|---|');
    for (const s of st.slice(0, 12)) {
      L.push(`| ${fmt(s.from)} | ${num(s.seconds, 0)} | \`${s.zone}\` | ${pos3(s.at)} | `
        + `${s.controlsOff ? 'controls were disabled — modal or hiding place' : 'walking into something'} |`);
    }
  }
  L.push('');

  L.push('## Without a cue');
  L.push('');
  L.push(`${num(cl.totalSeconds, 0)} s (${pctS(cl.fraction)}) with no interactable and no door on screen or in reach.`);
  L.push('');
  if (cl.runs.length) {
    L.push('| from | seconds | zone | position |');
    L.push('|---|---:|---|---|');
    for (const r of cl.runs) L.push(`| ${fmt(r.from)} | ${num(r.seconds, 0)} | \`${r.zone}\` | ${pos3(r.at)} |`);
  } else L.push('There was never a moment with nothing to walk toward.');
  L.push('');
  L.push('The cue metric showing its working — why candidate objects were culled from view, summed');
  L.push('over every scan of the session:');
  L.push('');
  L.push('```json');
  L.push(JSON.stringify(H.visReject));
  L.push('```');
  L.push('');
  L.push('If `occluded` were everything and `seen` were zero, the sightline test would be broken');
  L.push('rather than the level being empty. That is not a hypothetical: it was the first result');
  L.push('this tool produced, because a ray drawn to a door ends inside the door\'s own collider.');
  L.push('');

  L.push('## What it operated, and what it could not');
  L.push('');
  if (!H.interactions.length) L.push('Nothing. It never got the reticle onto anything.');
  else {
    L.push('| at | id | kind | approach | result |');
    L.push('|---|---|---|---:|---|');
    for (const i of H.interactions) {
      L.push(`| ${fmt(i.t)} | \`${i.id}\` | ${i.kind || ''} | ${i.foundAfter != null ? num(i.foundAfter, 1) + ' s' : '—'} | ${i.result} |`);
    }
  }
  L.push('');
  L.push(`Registry: ${H.interactorItems} interactables and ${H.doors} door latches were resident at the end.`);
  L.push(`Objective state: \`${JSON.stringify(H.progression)}\``);
  L.push(`Carried: \`${JSON.stringify(H.inventory)}\``);
  L.push('');

  L.push('## The route it actually took');
  L.push('');
  L.push('```');
  for (const z of zoneVisits) L.push(`${fmt(z.t).padStart(8)}  ${z.zone}`);
  L.push('```');
  L.push('');

  L.push('## Timeline');
  L.push('');
  L.push('State every 10 s, plus every event that was not a footstep.');
  L.push('');
  L.push('```');
  {
    const ev = [...H.events].sort((a, b) => a.t - b.t);
    let ei = 0, nextState = 0;
    const flush = (t) => {
      while (ei < ev.length && ev[ei].t <= t) {
        const e = ev[ei++];
        const d = e.data && typeof e.data === 'object'
          ? Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(' ') : String(e.data ?? '');
        L.push(`${fmt(e.t).padStart(8)}      * ${e.key.padEnd(22)} ${d}`);
      }
    };
    for (const s of S) {
      flush(s.t);
      if (s.t < nextState) continue;
      nextState = s.t + 10;
      L.push(`${fmt(s.t).padStart(8)}  ${String(s.zone).padEnd(9)} `
        + `pos(${s.pos.map((v) => num(v, 1).padStart(7)).join(',')}) `
        + `cells ${String(s.cells).padStart(4)} lost ${num(s.sinceNewCell, 0).padStart(3)}s `
        + `cue ${String(s.cue).padStart(2)} ${s.mode.padEnd(8)} `
        + `${s.moving ? 'walk' : 'stil'} light ${num(s.light, 1).padStart(5)} `
        + `${s.lamp ? 'lamp' : '    '} ${s.entity || ''}`);
    }
    flush(Infinity);
  }
  L.push('```');
  L.push('');

  L.push('## Event census');
  L.push('');
  L.push('| event | count |');
  L.push('|---|---:|');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) L.push(`| \`${k}\` | ${v} |`);
  L.push('');

  L.push('## Filmstrip');
  L.push('');
  L.push(`${film.length} frames — one every ~${FILM} s, plus one every time the bot had gone `);
  L.push(`${LOST_FILM} s without finding anywhere new. The \`LOST\` frames are the ones to look at.`);
  L.push('');
  for (const f of film) {
    L.push(`### ${fmt(f.t)} — ${f.label}`);
    L.push('');
    L.push(`![${f.label}](${f.file})`);
    L.push('');
  }

  L.push('## What this tool cannot tell you');
  L.push('');
  L.push('- It is a bot. It has no curiosity, cannot read a note, and does not form a hypothesis about');
  L.push('  where a corridor goes. A human is better at this and will get lost in different places.');
  L.push('- **A "cue" here is an interactable or a door, and nothing else.** Room plates, `STAFF ONLY`');
  L.push('  labels, wear paths worn into the lino, a lit corridor at the end of a dark one and the');
  L.push('  shape of the architecture itself are all navigational cues this tool is blind to. The');
  L.push('  cueless figure is therefore an **upper bound** on how lost a player would feel, not a');
  L.push('  measurement of it. What it is good for is comparison between zones and between builds.');
  L.push('- It steers on collision geometry, not on the rendered image, so a corridor that is visually');
  L.push('  unreadable but geometrically open reads as findable here. It cannot measure "too dark to');
  L.push('  navigate"; `tools/qa/emissive.mjs` and the capture harnesses do that.');
  L.push('- Frame times are SwiftShader and are not a frame-rate verdict.');
  L.push('- Coverage counts every walkable cell in a zone, including rooms behind doors this run never');
  L.push('  unlocked. It is "how much of the floor did it stand on", not "how much of the floor was');
  L.push('  reachable in this session". It is also a function of how long the session ran.');
  L.push('- One run is one route. The steering is seeded (`--seed`), so a run repeats; a *different*');
  L.push('  seed is a different walk and the numbers will move. Treat a single run as one playtester,');
  L.push('  not as the truth about the building.');
  L.push('');
  L.push('## Checking the ruler');
  L.push('');
  L.push('Two modes exist so that none of the above has to be taken on trust:');
  L.push('');
  L.push('```');
  L.push('node tools/qa/explore.mjs --selftest');
  L.push('node tools/qa/explore.mjs --verify docs/verification/explore/explore.json');
  L.push('```');
  L.push('');
  L.push('`--selftest` runs every metric function against states whose answers are known by');
  L.push('construction — including the two shapes this repo has shipped before: a coverage figure that');
  L.push('cannot go down, and a "longest quiet stretch" seeded with the whole session so that no real');
  L.push('gap can ever beat it (`docs/PLAYTEST_2026-07-31.md` §7). `--verify` re-derives every headline');
  L.push('number above from the stored record, confirms it reproduces, then truncates the session to');
  L.push('25/50/75 % and requires the coverage to fall and the lost time to change. A metric that does');
  L.push('not move when the session is cut in half is not measuring the session.');
  L.push('');

  await writeFile(path.join(OUT, 'explore.md'), L.join('\n'));
  await writeFile(path.join(OUT, 'explore-console.log'), logs.map((l) => `[${l.type}] ${l.text}`).join('\n'));

  // ---- console summary ----------------------------------------------------
  console.log('\n' + '─'.repeat(76));
  for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log('─'.repeat(76));
  console.log(`  coverage ${pctS(cov.overall)} of ${cov.walkableTotal} cells   revisit ${pctS(rev.rate)}   `
    + `lost ${lost.longest ? num(lost.longest.seconds, 0) : '—'}s   cueless ${pctS(cl.fraction)}   `
    + `zones ${distinctZones.size}   operated ${operated.length}`);
  console.log(`  first objective: ${firstObjective ? fmt(firstObjective.t) + ' ' + firstObjective.id : 'NEVER'}`);
  console.log(`  wrote ${OUT}/explore.md, explore.json, filmstrip/ (${film.length} frames)`);
  if (failed.length) { console.error(`\n${failed.length} check(s) FAILED`); process.exit(4); }
}

main().catch((e) => { console.error(e); process.exit(1); });
