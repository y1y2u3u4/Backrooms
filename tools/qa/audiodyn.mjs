#!/usr/bin/env node
/**
 * AUDIO DYNAMICS — does the mix ever get quiet?
 * ===========================================================================
 * WHY THIS EXISTS
 *
 * `audio-render.mjs` reports peak and RMS per file, and both are single numbers
 * over the whole render. They cannot tell a horror bed apart from a wall of
 * noise. The first run of it made that concrete: five of eight zone beds came
 * back at roughly -10 dBFS RMS with a **crest factor under 3.2 dB**, and a 3 dB
 * crest factor is what a sine wave has. Nothing in the existing checks — no
 * silence, no clipping, no DC offset, occlusion monotonic, reverb T60 on target
 * — can fail on that, because every one of them is true of a constant roar.
 *
 * The brief this project works to asks for "carefully controlled silence". A bed
 * with no dynamic range has no silence in it anywhere, and that is a mix defect
 * you can only see by looking at how loudness is DISTRIBUTED over time.
 *
 * WHAT IS MEASURED
 *
 *   LRA        loudness range, after EBU R128 in shape: short-term loudness in
 *              3 s windows every 100 ms, gated to drop the near-silent tail,
 *              then p95 - p10 of what is left. Film mixes run 15-20 LU. Heavily
 *              limited pop runs 3-5 LU. An ambience bed that never lets go
 *              measures near zero.
 *   ST p10/50/90  the short-term loudness distribution itself, because LRA is a
 *              spread and says nothing about WHERE it sits.
 *   quiet%     fraction of 3 s windows more than 12 LU below the file's own p90.
 *              This is the direct reading of "does it ever back off".
 *   crest      peak minus RMS over the whole file, kept for continuity with
 *              audio-render.mjs.
 *   centroid   spectral centroid in Hz, from a coarse DFT on a decimated
 *              signal. A bed whose centroid sits high is hiss; one that sits
 *              very low is rumble. It is a character check, not a pass/fail.
 *
 * There is no absolute right answer for an ambience bed, so the thresholds here
 * are deliberately loose and are about the SHAPE of the mix, not taste.
 *
 *   node tools/qa/audiodyn.mjs
 *   node tools/qa/audiodyn.mjs --in docs/verification/audio --only beds
 * ===========================================================================
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const IN = args.in || 'docs/verification/audio';
const ONLY = args.only ? String(args.only).split(',') : ['beds', 'scenes'];

/**
 * Budgets. These apply to CONTINUOUS material — beds and scenes — and not to
 * one-shot sounds, where a low LRA is simply what a door latch is.
 */
const LIMITS = {
  lra: 6.0,          // LU. Below this the bed is a wall; a room tone with events wants more.
  quietFrac: 0.10,   // at least a tenth of the time should sit well below the top
  rms: -16.0,        // dBFS. Above this a bed leaves no headroom for anything to happen in.
};

/** Minimal RIFF/WAVE reader — 16-bit PCM, which is what audio-render writes. */
function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt or data chunk');
  if (fmt.bits !== 16) throw new Error(`expected 16-bit, got ${fmt.bits}`);
  const frames = Math.floor(data.length / 2 / fmt.channels);
  // Mono sum. Loudness of a stereo bed is what matters here, not the imaging.
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
    mono[i] = s / fmt.channels;
  }
  return { rate: fmt.rate, channels: fmt.channels, frames, mono };
}

const db = (x) => (x > 1e-12 ? 20 * Math.log10(x) : -Infinity);

function percentile(sorted, p) {
  if (!sorted.length) return -Infinity;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

/**
 * Short-term loudness, R128 in shape but not in letter: no K-weighting filter,
 * because the point here is the SPREAD of loudness over time and a pre-filter
 * shifts every window by nearly the same amount. Stated plainly rather than
 * implied, so nobody reads "LRA" here as a certified broadcast measurement.
 */
function shortTerm(mono, rate, win = 3.0, hop = 0.1) {
  const w = Math.round(win * rate), h = Math.round(hop * rate);
  const out = [];
  if (mono.length < w) return out;
  // Running sum of squares. The naive form is O(windows x window) and at a 0.1 s
  // hop over 65 s that is 1.9 billion multiplies per file.
  let sum = 0;
  for (let i = 0; i < w; i++) sum += mono[i] * mono[i];
  out.push(db(Math.sqrt(sum / w)));
  for (let start = h; start + w <= mono.length; start += h) {
    for (let i = start - h; i < start; i++) sum -= mono[i] * mono[i];
    for (let i = start + w - h; i < start + w; i++) sum += mono[i] * mono[i];
    out.push(db(Math.sqrt(Math.max(0, sum) / w)));
  }
  return out;
}

/**
 * A loudness spread needs enough independent windows to be a distribution.
 *
 * The first version of this file used a fixed 3 s window for everything, and the
 * sanity check caught it being wrong in the confident direction: `door.heavy` is
 * 3.5 s of silence, a bang and a decay — a 22.9 dB crest, about as dynamic as a
 * file gets — and it measured LRA 0.0, because five almost totally overlapping
 * windows all see the same energy. Files shorter than the window measured NaN.
 *
 * So the window scales down for short material, and anything too short to carry
 * a distribution at all is reported as `—` rather than as a number that looks
 * like a measurement and is not one.
 */
function windowFor(seconds) {
  if (seconds < 4) return null;              // no honest spread exists here
  return Math.min(3.0, seconds / 8);
}

/** Spectral centroid via a coarse DFT on a decimated, windowed slice. */
function centroid(mono, rate) {
  const DEC = 4, N = 2048;
  const dr = rate / DEC;
  const mid = Math.max(0, Math.floor(mono.length / 2) - (N * DEC) / 2);
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = mid + i * DEC;
    x[i] = (j < mono.length ? mono[j] : 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  let num = 0, den = 0;
  // Every 4th bin: this is a character reading, not an analysis.
  for (let k = 1; k < N / 2; k += 4) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n += 2) {
      const a = (-2 * Math.PI * k * n) / N;
      re += x[n] * Math.cos(a); im += x[n] * Math.sin(a);
    }
    const mag = Math.hypot(re, im);
    num += mag * ((k * dr) / N); den += mag;
  }
  return den > 0 ? num / den : 0;
}

function analyse(name, wav) {
  const { mono, rate } = wav;
  let peak = 0, sum = 0;
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) peak = a;
    sum += mono[i] * mono[i];
  }
  const rms = db(Math.sqrt(sum / mono.length));
  const seconds = mono.length / rate;
  const base = {
    name, seconds: +seconds.toFixed(1),
    peak: +db(peak).toFixed(1), rms: +rms.toFixed(1),
    crest: +(db(peak) - rms).toFixed(1),
    centroid: Math.round(centroid(mono, rate)),
  };
  const win = windowFor(seconds);
  if (win == null) return { ...base, short: true };
  const st = shortTerm(mono, rate, win);
  // Absolute gate: windows below -70 dBFS are silence, not quiet, and would
  // drag the low percentile down on any file with a lead-in.
  const gated = st.filter((v) => v > -70).sort((a, b) => a - b);
  if (gated.length < 20) return { ...base, short: true };
  const p10 = percentile(gated, 10), p50 = percentile(gated, 50), p90 = percentile(gated, 90);
  const lra = percentile(gated, 95) - p10;
  const quiet = gated.filter((v) => v < p90 - 12).length / gated.length;
  return {
    ...base, win: +win.toFixed(2),
    lra: +lra.toFixed(1), p10: +p10.toFixed(1), p50: +p50.toFixed(1), p90: +p90.toFixed(1),
    quiet: +quiet.toFixed(3),
  };
}

/**
 * SELF-TEST. `node tools/qa/audiodyn.mjs --selftest`
 *
 * A dynamics measurement that cannot be shown to detect dynamics is worth
 * nothing, and this project has been burned six times by tools that reported
 * success while measuring the wrong thing. So the tool proves itself against
 * signals whose answer is known before it is trusted on real material:
 *
 *   flat    65 s of steady noise                  -> LRA near 0, quiet 0
 *   pulsed  65 s alternating 5 s loud / 5 s quiet,
 *           20 dB apart                           -> LRA near 20, quiet > 0.3
 *
 * If `pulsed` does not come back near 20 LU the tool is broken, whatever it says
 * about the zone beds.
 */
function selftest() {
  const rate = 48000, n = rate * 65;
  const mk = (gain) => {
    const x = new Float32Array(n);
    let s = 12345;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      x[i] = ((s / 0x7fffffff) * 2 - 1) * 0.2 * gain(i / rate);
    }
    return x;
  };
  const cases = [
    { name: 'flat', mono: mk(() => 1), lra: [0, 1.5], quiet: [0, 0.02] },
    // 20 dB apart is a factor of 10 in amplitude, so LRA must land near 20.
    //
    // `quiet` is NOT 0.5 even though half the signal is quiet, and the expected
    // band here is derived rather than guessed. A 3 s window slid over 5 s
    // blocks only sits ENTIRELY inside a quiet block for (5 - 3) = 2 s of every
    // 10 s cycle; every other position straddles a transition and averages the
    // two levels. So the correct answer is (d - w) / 2d = 0.2, and the first
    // version of this test asserting 0.3..0.6 was the test being wrong, not the
    // tool. Recorded because "the measurement disagreed with me so I widened the
    // band" is exactly how a check stops meaning anything.
    { name: 'pulsed', mono: mk((t) => (Math.floor(t / 5) % 2 ? 0.1 : 1)), lra: [17, 23], quiet: [0.15, 0.28] },
  ];
  let ok = true;
  console.log('\naudiodyn self-test — can this tool see dynamics at all?\n');
  for (const c of cases) {
    const r = analyse(c.name, { rate, channels: 1, frames: n, mono: c.mono });
    const lraOk = r.lra >= c.lra[0] && r.lra <= c.lra[1];
    const qOk = r.quiet >= c.quiet[0] && r.quiet <= c.quiet[1];
    if (!lraOk || !qOk) ok = false;
    console.log(`  ${lraOk && qOk ? 'ok  ' : 'FAIL'} ${c.name.padEnd(8)} LRA ${String(r.lra).padStart(5)}`
      + ` (want ${c.lra[0]}..${c.lra[1]})   quiet ${String(r.quiet).padStart(5)}`
      + ` (want ${c.quiet[0]}..${c.quiet[1]})`);
  }
  console.log(ok
    ? '\nThe tool separates a constant bed from a dynamic one. Its readings mean something.\n'
    : '\nThe tool CANNOT see dynamics. Do not trust any reading it produces.\n');
  return ok;
}

if (args.selftest) process.exit(selftest() ? 0 : 1);

const rows = [];
for (const dir of ONLY) {
  let files = [];
  try { files = (await readdir(path.join(IN, dir))).filter((f) => f.endsWith('.wav')); } catch { continue; }
  for (const f of files.sort()) {
    const buf = await readFile(path.join(IN, dir, f));
    try { rows.push({ dir, ...analyse(f.replace('.wav', ''), readWav(buf)) }); } catch (e) {
      rows.push({ dir, name: f.replace('.wav', ''), error: e.message });
    }
  }
}

if (!rows.length) {
  console.error(`no wav files under ${IN}/{${ONLY.join(',')}} — run tools/qa/audio-render.mjs first`);
  process.exit(1);
}

console.log('');
console.log('audio dynamics — continuous material only; one-shots are not judged here');
console.log('');
console.log('file                  dir      dur   peak    rms  crest    LRA    p10    p50    p90  quiet  centroid');
let fails = 0;
for (const r of rows) {
  if (r.error) { console.log(`${r.name.padEnd(21)} ${r.dir.padEnd(8)} ${r.error}`); fails++; continue; }
  if (r.short) {
    console.log(`${r.name.padEnd(21)} ${r.dir.padEnd(8)} ${String(r.seconds).padStart(5)}`
      + ` ${String(r.peak).padStart(6)} ${String(r.rms).padStart(6)} ${String(r.crest).padStart(6)}`
      + `      —      —      —      —      — ${String(r.centroid).padStart(9)}`
      + '  (too short for a loudness spread)');
    continue;
  }
  const bad = [];
  if (r.lra < LIMITS.lra) bad.push('FLAT');
  if (r.quiet < LIMITS.quietFrac) bad.push('NO-QUIET');
  if (r.rms > LIMITS.rms) bad.push('HOT');
  if (bad.length) fails++;
  console.log(
    `${r.name.padEnd(21)} ${r.dir.padEnd(8)} ${String(r.seconds).padStart(5)}`
    + ` ${String(r.peak).padStart(6)} ${String(r.rms).padStart(6)} ${String(r.crest).padStart(6)}`
    + ` ${String(r.lra).padStart(6)} ${String(r.p10).padStart(6)} ${String(r.p50).padStart(6)}`
    + ` ${String(r.p90).padStart(6)} ${String(r.quiet).padStart(6)} ${String(r.centroid).padStart(9)}`
    + (bad.length ? `  ${bad.join(' ')}` : ''));
}

console.log('');
console.log(`budgets: LRA >= ${LIMITS.lra} LU, quiet fraction >= ${LIMITS.quietFrac}, RMS <= ${LIMITS.rms} dBFS`);
console.log('LRA here is R128 in shape, not in letter — no K-weighting. It is a spread,');
console.log('and a spread is what the question "does this mix ever back off" needs.');
console.log('');
console.log(fails === 0
  ? `All ${rows.length} continuous files have somewhere to go.`
  : `${fails} of ${rows.length} files are flat, hot, or never quiet.`);
process.exit(fails === 0 ? 0 : 1);
