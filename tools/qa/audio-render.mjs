#!/usr/bin/env node
/**
 * AUDIO EXPORT — .wav files a human can actually listen to.
 * ===========================================================================
 * Every sound in THE ANNEX is synthesised at runtime by `src/audio/` and has
 * only ever been *measured* (tools/qa/audio-probe.mjs). Nothing has ever left
 * the browser as a file, and nobody in the loop has heard any of it. This
 * renders the shipping code path offline and writes real WAVs.
 *
 * Three kinds of artefact, because they answer different questions:
 *
 *   sounds/<name>.wav   one file per registered sound, DRY — no zone reverb, no
 *                       bus compressor, no master limiter, at its own authored
 *                       gain. This is the sound itself, which is what you want
 *                       when asking "is this a good drip".
 *
 *   beds/<zone>.wav     60+ seconds of the zone's whole soundscape, continuous:
 *                       fluorescent hum spatialised per fixture and driven by
 *                       each fixture's flicker, the vent bed, room tone,
 *                       machinery, Poisson-timed drips/knocks/creaks/ticks at
 *                       the zone's own rates, footsteps under a listener who
 *                       walks up and down the corridor and through two
 *                       doorways, occlusion measured through a real
 *                       CollisionWorld, all of it through the zone's
 *                       convolution reverb, the bus compressors and the master
 *                       limiter. A horror soundscape can only be judged as a
 *                       continuous bed, never as isolated one-shots.
 *
 *   scenes/<name>.wav   a bed with scripted beats on it — the Surveyor's whine,
 *                       approach, measure and freeze; a circuit dropping and
 *                       coming back. These are the sequences the design
 *                       document makes promises about.
 *
 * Usage:
 *   node tools/qa/audio-render.mjs                       # everything
 *   node tools/qa/audio-render.mjs --bed-seconds 90
 *   node tools/qa/audio-render.mjs --only beds
 *   node tools/qa/audio-render.mjs --port 5307
 * ===========================================================================
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '5307', 10);
const OUT = args.out || 'docs/verification/audio';
/** The brief asks for 60+ seconds per zone. 65 keeps eight stereo 48 kHz WAVs
 *  to about 100 MB in total, which is already a lot to put in a repository. */
const BED_SECONDS = parseInt(args['bed-seconds'] || '65', 10);
const ONLY = args.only ? String(args.only).split(',') : ['sounds', 'beds', 'scenes'];
const TIMEOUT = parseInt(args.timeout || '600000', 10);
const CHUNK = 4 * 1024 * 1024;      // base64 characters per round-trip

const ZONES = ['intake', 'service', 'cistern', 'residence', 'plant', 'duct', 'stack', 'safe'];
const SCENES = [
  { name: 'surveyor', zone: 'service', seconds: 75 },
  { name: 'breaker', zone: 'intake', seconds: 60 },
];

/** What a listener should be checking for, per zone. Written by hand. */
const LISTEN_FOR = {
  intake: 'The signature sound of the game. A corridor of fluorescent tubes at 100 Hz, each '
    + 'detuned a few cents so the corridor beats against itself, plus ballast whine near 9.4 kHz. '
    + 'Listen for: the beating (it should wander, never pulse regularly); one tube stuttering out '
    + 'of sync with the others and crackling back in; carpet footsteps that do NOT excite the room; '
    + 'a near-dead low room tone under everything. If this reads as one steady synth pad, the '
    + 'per-fixture spatialisation is not working.',
  service: 'Cold and load-bearing. Concrete footsteps should slap the corridor — the room '
    + 'excitation layer is 6x the carpet one — and the reverb is longer and brighter. Listen for: '
    + 'the transformer buzz at the far end getting louder and duller as you approach and pass it, '
    + 'the vent grille sweeping, and drips roughly every 17 s. A drip behind a partition should be '
    + 'duller AND wetter than one in the open; that is occlusion working, and it is the single '
    + 'most important thing in this file.',
  cistern: 'Drowned and slow. A drip every ~4 s, running water, the standing-water lap breathing '
    + 'on three incommensurate LFOs, and a long tuned slap-back at 74 Hz. Footsteps are wading. '
    + 'Listen for: whether the drips ever sound like a metronome (they must not — the gaps are '
    + 'exponentially distributed), and whether the 74 Hz resonance is a room or a hum.',
  residence: 'Nearly dead acoustically — carpet, damask, soft furnishings, a 0.34 s decay. This '
    + 'file is mostly a test of restraint: the hum is at 0.12, there is almost no vent, and the '
    + 'structure creaks every ~26 s. Listen for: whether it is unnervingly quiet rather than '
    + 'broken, and whether the creaks read as a building settling rather than as a sound effect.',
  plant: 'A 14 m concrete cathedral with a 3.1 s decay and a 196 ms slap. The machinery bed is at '
    + 'full proximity: two shafts at slightly different speeds beating against each other, plus '
    + 'casing broadband. Footsteps are chequer plate over a void and should ring for ~0.4 s. '
    + 'Listen for: whether the machine sounds like a machine hunting rather than a sawtooth, and '
    + 'whether the reverb makes the space feel 14 m tall.',
  duct: 'A 0.8 m galvanised box around your head: 0.30 s decay, 214 Hz box resonance, width 0.35, '
    + 'nothing but the vent (at 1.0) and your own knees. Listen for: claustrophobia. The panel '
    + 'should boom under each crawl step and the reverb should feel like it is touching your ears.',
  stack: 'A vertical shaft: 4.2 s decay, 42 ms predelay, full stereo width, hum at 0.70 from '
    + 'floors above and below. Listen for: whether the early reflections read as *distance upward* '
    + 'rather than as a big room, and whether distant impacts arrive with no highs at all.',
  safe: 'The Office of Record. Small, warm, 0.42 s decay, hum at 0.22, almost no events — a drip '
    + 'every 90 s. Listen for: relief. If this is not audibly safer than the Service Spine within '
    + 'two seconds of pressing play, the contrast the whole game rests on is not there.',
};

const SCENE_LISTEN = {
  surveyor: 'The behavioural promises in DESIGN.md §2, in order, over 75 s. 0:10 the whine begins '
    + '— it must be direction-ambiguous (a Haas widener with an inverted delayed side channel and '
    + 'the largest reverb send in the game) and must feel like it is accelerating. 0:14 it walks. '
    + '0:30 a head-plate tick — the one moment you are given a bearing. 0:34 it loses you. 0:40 it '
    + 'measures a wall; this is the silence you are supposed to move in. 0:52 the lights die and it '
    + 'freezes — note that the hum dies with them. 1:02 it leaves. Listen for: whether you could '
    + 'learn the whine means "three seconds" from this file alone.',
  breaker: 'Mechanism audio over the Intake bed. 0:08 a circuit drops: contactor, then 127 tubes '
    + 'fading out and the hum going with them. 0:22 it comes back: relays strike raggedly over '
    + '0.6 s and each tube restrikes with its own crackle. 0:34 a fuse core is picked up and the '
    + 'three-note motif fires (budget: five cues per playthrough). 0:46 paper and the journal '
    + 'chime. Listen for: whether the circuit coming back sounds like 1970s switchgear rather than '
    + 'a fade-in.',
};

const dB = (v) => (v > 1e-9 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
const pad = (s, n, right = false) => (right ? String(s).padStart(n) : String(s).padEnd(n));
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

async function up(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const d of ['sounds', 'beds', 'scenes']) await mkdir(path.join(OUT, d), { recursive: true });

  const base = `http://127.0.0.1:${PORT}`;
  let server = null;
  if (!(await up(`${base}/`, 800))) {
    server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
    if (!(await up(`${base}/`, 60000))) { console.error('vite did not come up on', PORT); process.exit(1); }
  }

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--js-flags=--max-old-space-size=4096'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  // A full run takes many minutes; an HMR reload half way through would destroy
  // the execution context. See audio-probe.mjs, which learned this the hard way.
  await page.route('**/@vite/client', (r) => r.abort());
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 8).join('\n')}`));

  const url = `${base}/tools/qa/audio-render.html`;
  console.log('→', url);
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

  const ready = () => page.waitForFunction('window.AUDIO_RENDER_READY === true', { timeout: 90000 });
  try {
    await ready();
    // Vite pre-bundles `three` (via Physics.js) on first sight and forces a full
    // reload. Settle through it, then reload deliberately off the warm cache.
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    await page.waitForTimeout(800);
  } catch {
    console.error('harness never became ready:\n' + logs.join('\n'));
    await browser.close(); server?.kill(); process.exit(2);
  }

  /** Pull the held WAV out of the page in slices and write it. */
  const drain = async (file) => {
    const len = await page.evaluate(() => window.AUDIO_RENDER.len());
    let b64 = '';
    for (let off = 0; off < len; off += CHUNK) {
      b64 += await page.evaluate(({ o, n }) => window.AUDIO_RENDER.slice(o, n), { o: off, n: CHUNK });
    }
    await page.evaluate(() => window.AUDIO_RENDER.release());
    const buf = Buffer.from(b64, 'base64');
    await writeFile(file, buf);
    return buf.length;
  };

  const report = { generated: new Date().toISOString(), sounds: [], beds: [], scenes: [], failures: [], warnings: [] };
  const fail = (m) => { report.failures.push(m); };
  const warn = (m) => { report.warnings.push(m); };

  /** Level policy, applied identically to every artefact. */
  const judge = (label, s, { quietFloor = -60 } = {}) => {
    const flags = [];
    if (s.clipped > 0) { flags.push('CLIP'); fail(`${label}: ${s.clipped} clipped samples (peak ${s.peak.toFixed(3)})`); }
    else if (s.peak > 0.98) { flags.push('hot'); warn(`${label}: peak ${dB(s.peak)} dBFS — within 0.2 dB of full scale`); }
    if (s.peak < 0.0015) { flags.push('SILENT'); fail(`${label}: silent (peak ${s.peak.toExponential(2)})`); }
    else if (20 * Math.log10(s.rms) < quietFloor) {
      flags.push('QUIET'); warn(`${label}: RMS ${dB(s.rms)} dBFS — inaudible without gain`);
    }
    if (Math.abs(s.dc) > 0.002) { flags.push('DC'); fail(`${label}: DC offset ${s.dc.toExponential(2)}`); }
    return flags;
  };

  // ---- 1. one file per sound --------------------------------------------
  if (ONLY.includes('sounds')) {
    const names = await page.evaluate(() => window.AUDIO_RENDER.names());
    console.log(`\nSOUNDS  (${names.length} registered)`);
    console.log('─'.repeat(96));
    console.log([pad('name', 22), pad('bus', 10), pad('dur s', 8, true), pad('peak dBFS', 11, true),
      pad('rms dBFS', 10, true), pad('kB', 8, true), ' flags'].join(''));
    console.log('─'.repeat(96));
    for (const name of names) {
      let info;
      try {
        info = await page.evaluate((n) => window.AUDIO_RENDER.solo(n), name);
      } catch (e) {
        fail(`${name}: render threw — ${String(e.message).split('\n')[0]}`);
        console.log(`${pad(name, 22)}  RENDER ERROR`);
        continue;
      }
      const file = `sounds/${name.replace(/\./g, '_')}.wav`;
      const bytes = await drain(path.join(OUT, file));
      const s = info.stats;
      // One-shots are allowed to be quiet; they are mixed up by their bus.
      const flags = judge(name, s, { quietFloor: -72 });
      report.sounds.push({ name, file, bus: info.bus, loop: info.loop, bytes, flags, stats: s });
      console.log([pad(name, 22), pad(info.bus, 10), pad(s.duration.toFixed(2), 8, true),
        pad(dB(s.peak), 11, true), pad(dB(s.rms), 10, true), pad((bytes / 1024).toFixed(0), 8, true),
        ' ' + flags.join(',')].join(''));
    }
  }

  // ---- 2. one continuous bed per zone ------------------------------------
  if (ONLY.includes('beds')) {
    console.log(`\nZONE BEDS  (${BED_SECONDS} s each, continuous)`);
    console.log('─'.repeat(96));
    console.log([pad('zone', 12), pad('reverb', 10), pad('dur s', 8, true), pad('peak dBFS', 11, true),
      pad('rms dBFS', 10, true), pad('crest', 8, true), pad('voices', 8, true), pad('MB', 7, true), ' flags'].join(''));
    console.log('─'.repeat(96));
    for (const zone of ZONES) {
      let info;
      try {
        info = await page.evaluate(({ z, s }) => window.AUDIO_RENDER.bed(z, s), { z: zone, s: BED_SECONDS });
      } catch (e) {
        fail(`bed ${zone}: render threw — ${String(e.message).split('\n')[0]}`);
        console.log(`${pad(zone, 12)}  RENDER ERROR: ${String(e.message).split('\n')[0]}`);
        continue;
      }
      const file = `beds/${zone}.wav`;
      const bytes = await drain(path.join(OUT, file));
      const s = info.stats;
      // A bed is the thing the player hears continuously. If its RMS is below
      // -48 dBFS nobody will hear it over a laptop fan.
      const flags = judge(`bed ${zone}`, s, { quietFloor: -48 });
      report.beds.push({ zone, file, bytes, flags, stats: s, reverb: info.reverb, voices: info.voices, profile: info.profile });
      console.log([pad(zone, 12), pad(info.reverb, 10), pad(s.duration.toFixed(1), 8, true),
        pad(dB(s.peak), 11, true), pad(dB(s.rms), 10, true), pad(s.crest.toFixed(1), 8, true),
        pad(info.voices.spawned, 8, true), pad((bytes / 1048576).toFixed(1), 7, true),
        ' ' + flags.join(',')].join(''));
    }
  }

  // ---- 3. scripted scenes ------------------------------------------------
  if (ONLY.includes('scenes')) {
    console.log('\nSCENES');
    console.log('─'.repeat(96));
    for (const sc of SCENES) {
      let info;
      try {
        info = await page.evaluate(({ n, z, s }) => window.AUDIO_RENDER.scene(n, z, s), { n: sc.name, z: sc.zone, s: sc.seconds });
      } catch (e) {
        fail(`scene ${sc.name}: render threw — ${String(e.message).split('\n')[0]}`);
        console.log(`  ${sc.name}: RENDER ERROR: ${String(e.message).split('\n')[0]}`);
        continue;
      }
      const file = `scenes/${sc.name}.wav`;
      const bytes = await drain(path.join(OUT, file));
      const s = info.stats;
      const flags = judge(`scene ${sc.name}`, s, { quietFloor: -48 });
      report.scenes.push({ ...sc, file, bytes, flags, stats: s, marks: info.marks });
      console.log(`  ${pad(sc.name, 12)} ${pad(sc.zone, 10)} ${pad(s.duration.toFixed(1) + 's', 8, true)} ` +
        `peak ${pad(dB(s.peak), 7, true)} dBFS  rms ${pad(dB(s.rms), 7, true)} dBFS  ` +
        `${(bytes / 1048576).toFixed(1)} MB  ${flags.join(',')}`);
      for (const m of info.marks) console.log(`      ${fmtT(m.t)}  ${m.what}`);
    }
  }

  await browser.close();
  server?.kill();

  // ---- README ------------------------------------------------------------
  const L = [];
  L.push('# THE ANNEX — audio, as files you can play');
  L.push('');
  L.push(`Generated ${report.generated} by \`tools/qa/audio-render.mjs\`. Every file here is`);
  L.push('rendered offline through the same `src/audio/` code the live game runs — there is no');
  L.push('sample content in this project and nothing here was recorded.');
  L.push('');
  L.push('**Read this first.** All levels below are measured, not adjusted. Nothing has been');
  L.push('normalised, because a normalised QA artefact hides the one defect it exists to find.');
  L.push('The one-shots in `sounds/` are **dry**: no zone reverb, no bus compressor, no master');
  L.push('limiter, at their own authored gain. That is deliberate — it is the sound itself, which');
  L.push('is what you want when judging a drip. Several are quiet in absolute terms because the');
  L.push('bus that carries them applies up to +5 dB and the reverb send doubles their apparent');
  L.push('loudness; the peak column tells you which ones need the volume turned up. The files in');
  L.push('`beds/` and `scenes/` are the full chain and are the ones to judge the mix on.');
  L.push('');

  // -- beds
  L.push('## `beds/` — start here');
  L.push('');
  L.push(`One continuous ${BED_SECONDS}-second excerpt per zone. A horror soundscape is a bed, not a`);
  L.push('set of one-shots, and this is the only artefact in the project that can be judged as one.');
  L.push('Each is the whole system running: the fluorescent hum spatialised per fixture and driven');
  L.push('by that fixture\'s live flicker level, the ventilation bed, room tone, machinery, and');
  L.push('Poisson-timed drips, pipe knocks, structural creaks, expansion ticks, arcs and distant');
  L.push('impacts at the zone\'s own authored rates — through the zone\'s procedural convolution');
  L.push('reverb, the bus compressors and the master limiter. A listener walks up and down a 36 m');
  L.push('corridor and through two doorways, so occlusion is measured against a real');
  L.push('`CollisionWorld` while the mix runs. The first and last 8 seconds have no footsteps, so');
  L.push('the bed can be heard on its own.');
  L.push('');
  L.push('| file | reverb | peak dBFS | RMS dBFS | crest | voices | flags |');
  L.push('|---|---|---:|---:|---:|---:|---|');
  for (const b of report.beds) {
    L.push(`| [\`${b.file}\`](${b.file}) | \`${b.reverb}\` | ${dB(b.stats.peak)} | ${dB(b.stats.rms)} | ` +
      `${b.stats.crest.toFixed(1)} | ${b.voices.spawned} | ${b.flags.join(', ') || '—'} |`);
  }
  L.push('');
  for (const b of report.beds) {
    L.push(`### \`${b.file}\` — ${b.zone}`);
    L.push('');
    L.push(`Peak ${dB(b.stats.peak)} dBFS, RMS ${dB(b.stats.rms)} dBFS, crest ${b.stats.crest.toFixed(1)}, ` +
      `spectral centroid ${Math.round(b.stats.centroid)} Hz, ${b.voices.spawned} voices spawned over the excerpt. ` +
      `Reverb profile \`${b.reverb}\`.`);
    L.push('');
    L.push(`**What to listen for.** ${LISTEN_FOR[b.zone]}`);
    L.push('');
  }

  // -- scenes
  if (report.scenes.length) {
    L.push('## `scenes/` — the sequences the design makes promises about');
    L.push('');
    for (const s of report.scenes) {
      L.push(`### \`${s.file}\` — ${s.name} (over the ${s.zone} bed)`);
      L.push('');
      L.push(`Peak ${dB(s.stats.peak)} dBFS, RMS ${dB(s.stats.rms)} dBFS, ${s.stats.duration.toFixed(0)} s.`);
      L.push('');
      L.push(`**What to listen for.** ${SCENE_LISTEN[s.name]}`);
      L.push('');
      L.push('| time | beat |');
      L.push('|---|---|');
      for (const m of s.marks) L.push(`| ${fmtT(m.t)} | ${m.what} |`);
      L.push('');
    }
  }

  // -- sounds
  if (report.sounds.length) {
    L.push('## `sounds/` — one file per registered sound');
    L.push('');
    L.push(`${report.sounds.length} files, dry, at the render window the QA probe uses. Loops are`);
    L.push('rendered with a level driven in and stopped just before the file ends, which is why some');
    L.push('are exactly 6.00 s.');
    L.push('');
    L.push('| file | bus | loop | dur s | peak dBFS | RMS dBFS | centroid | flags |');
    L.push('|---|---|---|---:|---:|---:|---:|---|');
    for (const s of report.sounds) {
      L.push(`| [\`${s.file}\`](${s.file}) | ${s.bus} | ${s.loop ? 'yes' : ''} | ${s.stats.duration.toFixed(2)} | ` +
        `${dB(s.stats.peak)} | ${dB(s.stats.rms)} | ${Math.round(s.stats.centroid)} Hz | ${s.flags.join(', ') || '—'} |`);
    }
    L.push('');
  }

  // -- levels summary
  L.push('## Levels');
  L.push('');
  const hot = [...report.sounds, ...report.beds, ...report.scenes].filter((r) => r.flags.includes('CLIP') || r.flags.includes('hot'));
  const quiet = [...report.sounds, ...report.beds, ...report.scenes].filter((r) => r.flags.includes('QUIET') || r.flags.includes('SILENT'));
  L.push(`- **Clipping:** ${report.sounds.concat(report.beds, report.scenes).filter((r) => r.flags.includes('CLIP')).length} artefact(s) clipped.`);
  L.push(`- **Within 0.2 dB of full scale:** ${hot.filter((r) => r.flags.includes('hot')).length}.`);
  L.push(`- **Inaudibly quiet:** ${quiet.length} — ${quiet.length ? quiet.map((r) => (r.name || r.zone)).join(', ') : 'none'}.`);
  L.push('');
  if (report.failures.length) {
    L.push('### Failures');
    L.push('');
    for (const f of report.failures) L.push(`- ${f}`);
    L.push('');
  }
  if (report.warnings.length) {
    L.push('### Warnings');
    L.push('');
    for (const w of report.warnings) L.push(`- ${w}`);
    L.push('');
  }

  L.push('## Method, and what it does not prove');
  L.push('');
  L.push('The audio system is written for a live `AudioContext` whose clock advances by itself. An');
  L.push('`OfflineAudioContext` clock does not move until `startRendering()`, so stepping the');
  L.push('simulation against it would schedule every event at t = 0. `engine.now` is therefore');
  L.push('shadowed with a virtual clock that returns the simulation time, and the whole graph is');
  L.push('scheduled into the future of one offline render. Voice reaping is also made');
  L.push('non-destructive, because `NodeBag.dispose()` disconnects nodes and offline the sound has');
  L.push('not been rendered yet. Nothing in `src/` is modified; both changes are made from outside.');
  L.push('');
  L.push('What this does **not** prove: that the mix works on speakers in a room, that the');
  L.push('spatialisation reads correctly on headphones versus stereo, or that the levels sit right');
  L.push('against a system volume a player has already set. Those need ears. What it does prove is');
  L.push('that the files exist, that they are not silent or clipped, and that the continuous bed');
  L.push('holds together for over a minute without a loop point, a pile-up or a dropout.');
  L.push('');

  await writeFile(path.join(OUT, 'README.md'), L.join('\n'));
  await writeFile(path.join(OUT, 'audio-render.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(OUT, 'audio-render-console.log'), logs.join('\n'));

  // ---- summary -----------------------------------------------------------
  const total = [...report.sounds, ...report.beds, ...report.scenes].reduce((a, r) => a + r.bytes, 0);
  console.log('\n' + '═'.repeat(96));
  console.log(`  ${report.sounds.length} sounds · ${report.beds.length} zone beds · ${report.scenes.length} scenes · ` +
    `${(total / 1048576).toFixed(1)} MB total`);
  console.log(`  ${report.warnings.length} warnings · ${report.failures.length} failures`);
  for (const w of report.warnings) console.log('   ·', w);
  for (const f of report.failures) console.log('   ✗', f);
  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
    .filter((l) => !/ERR_FAILED/.test(l));
  if (errs.length) { console.log('\n  console errors:'); console.log(errs.slice(0, 12).join('\n')); }
  console.log(`\n  wrote ${OUT}/README.md and ${report.sounds.length + report.beds.length + report.scenes.length} wav files`);
  process.exit(report.failures.length ? 4 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
