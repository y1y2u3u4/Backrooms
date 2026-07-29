#!/usr/bin/env node
/**
 * Audio QA probe.
 *
 * Audio cannot be screenshotted, so it gets measured instead. This boots the
 * audio system in headless Chromium against an OfflineAudioContext, renders
 * EVERY registered sound twice through the same build() code the live game
 * runs, and reports peak / RMS / spectral centroid / duration / crest factor /
 * DC offset, plus a difference score between the two renders.
 *
 * It then checks four things the design brief actually cares about:
 *
 *   1. nothing is silent, clipping or DC-offset;
 *   2. two consecutive triggers of the same sound genuinely differ;
 *   3. the procedurally generated impulse responses have the T60 they claim,
 *      are stereo-decorrelated, and are level-matched to each other;
 *   4. occluding a source makes it duller, quieter AND more reverberant —
 *      measured through the real CollisionWorld, not asserted;
 *   5. the fluorescent hum's output envelope actually tracks a fixture's live
 *      flicker curve, with the 100 Hz mains partial dominant.
 *
 * Usage:
 *   node tools/qa/audio-probe.mjs
 *   node tools/qa/audio-probe.mjs --png          # also write waveform strips
 *   node tools/qa/audio-probe.mjs --json out.json
 *   node tools/qa/audio-probe.mjs --port 5303
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '5303', 10);
const OUT = args.out || 'tools/qa/audio-out';
const WANT_PNG = !!args.png;
const TIMEOUT = parseInt(args.timeout || '240000', 10);

// Sounds worth looking at as pictures when --png is passed.
const PNG_LIST = [
  'amb.hum', 'drip', 'step.concrete', 'step.carpet', 'step.tread', 'step.water',
  'entity.whine', 'entity.measure', 'entity.step', 'entity.capture',
  'metal.clang', 'pipe.knock', 'struct.creak', 'music.motif', 'door.close',
];

const dB = (v) => (v > 1e-9 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
const pad = (s, n, right = false) => {
  s = String(s);
  return right ? s.padStart(n) : s.padEnd(n);
};

async function waitForServer(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const url = `http://127.0.0.1:${PORT}/tools/qa/audio-harness.html`;
  let server = null;

  if (!(await waitForServer(`http://127.0.0.1:${PORT}/`, 800))) {
    server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
    if (!(await waitForServer(`http://127.0.0.1:${PORT}/`, 45000))) {
      console.error('vite did not come up on', PORT);
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 8).join('\n')}`));

  console.log('→', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const ready = async () => {
    await page.waitForFunction('window.AUDIO_READY === true', { timeout: 60000 });
  };
  try {
    await ready();
    // Vite pre-bundles `three` (pulled in by Physics.js) on first sight and then
    // forces a full reload, which would destroy an execution context mid-run.
    // Settle through that, then reload once deliberately so the page we measure
    // on is loaded entirely from the warm dep cache.
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    await page.waitForTimeout(1200);
  } catch {
    console.error('harness never became ready:\n' + logs.join('\n'));
    await browser.close(); if (server) server.kill();
    process.exit(2);
  }

  /** Evaluate, surviving a navigation by waiting for the harness again. */
  const run = async (fn, arg) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { return await page.evaluate(fn, arg); } catch (e) {
        if (!/context was destroyed|Target closed|navigation/i.test(String(e.message))) throw e;
        await page.waitForTimeout(1200);
        await ready();
      }
    }
    throw new Error('harness kept navigating away');
  };

  const names = await run(() => window.AUDIO_PROBE.names());
  console.log(`  ${names.length} registered sounds\n`);

  // -- 1. render everything ------------------------------------------------
  page.setDefaultTimeout(TIMEOUT);
  const rows = await run(() => window.AUDIO_PROBE.runAll());

  const failures = [];
  const warnings = [];

  console.log('SOUND INVENTORY');
  console.log('─'.repeat(112));
  console.log([
    pad('name', 22), pad('bus', 10), pad('peak', 8, true), pad('rms dBFS', 10, true),
    pad('dur s', 8, true), pad('centroid', 10, true), pad('crest', 8, true),
    pad('dc', 10, true), pad('differs', 9, true), ' flags',
  ].join(''));
  console.log('─'.repeat(112));

  for (const r of rows) {
    if (r.error) {
      failures.push(`${r.name}: build threw — ${r.error}`);
      console.log(`${pad(r.name, 22)}${pad('—', 10)}  BUILD ERROR: ${r.error}`);
      continue;
    }
    const flags = [];
    // Silence: a registered sound that produces nothing is a dead sound.
    if (r.peak < 0.0015) { flags.push('SILENT'); failures.push(`${r.name}: silent (peak ${r.peak.toExponential(2)})`); }
    // Clipping: the master limiter should never be asked to save us.
    if (r.peak > 0.999) { flags.push('CLIP'); failures.push(`${r.name}: clipping (peak ${r.peak.toFixed(3)})`); }
    else if (r.peak > 0.92) { flags.push('hot'); warnings.push(`${r.name}: hot (peak ${r.peak.toFixed(3)})`); }
    // DC: eats headroom and clicks on every trigger.
    if (Math.abs(r.dc) > 0.002) { flags.push('DC'); failures.push(`${r.name}: DC offset ${r.dc.toExponential(2)}`); }
    // Variation: two triggers must not be the same sound.
    if (r.diff < 0.02) { flags.push('IDENTICAL'); failures.push(`${r.name}: two triggers are identical (diff ${r.diff.toFixed(4)})`); }
    else if (r.diff < 0.08) { flags.push('samey'); warnings.push(`${r.name}: low variation (diff ${r.diff.toFixed(3)})`); }
    // Anything that renders as a single click was probably meant to ring.
    if (!r.loop && r.duration < 0.012) { flags.push('tiny'); warnings.push(`${r.name}: ${(r.duration * 1000).toFixed(0)} ms long`); }

    console.log([
      pad(r.name, 22), pad(r.bus, 10),
      pad(r.peak.toFixed(3), 8, true), pad(dB(r.rms), 10, true),
      pad(r.duration.toFixed(2), 8, true), pad(Math.round(r.centroid) + 'Hz', 10, true),
      pad(r.crest.toFixed(1), 8, true), pad(r.dc.toExponential(1), 10, true),
      pad(r.diff.toFixed(3), 9, true),
      ' ' + flags.join(','),
    ].join(''));
  }

  // -- 2. reverbs ----------------------------------------------------------
  const revs = await run(() => window.AUDIO_PROBE.reverbs());
  console.log('\nZONE REVERBS (procedurally generated impulse responses)');
  console.log('─'.repeat(96));
  console.log([pad('profile', 14), pad('len s', 8, true), pad('target T60', 12, true),
    pad('measured', 10, true), pad('rms', 10, true), pad('centroid', 10, true),
    pad('L/R corr', 10, true), ' flags'].join(''));
  console.log('─'.repeat(96));
  let revRms = [];
  for (const r of revs) {
    const flags = [];
    if (r.peak < 1e-4) { flags.push('EMPTY'); failures.push(`reverb ${r.name}: empty IR`); }
    if (Math.abs(r.dc) > 0.002) { flags.push('DC'); failures.push(`reverb ${r.name}: DC offset`); }
    if (r.corr > 0.85) { flags.push('MONO'); warnings.push(`reverb ${r.name}: channels correlated (${r.corr.toFixed(2)})`); }
    // Measured T60 should be within a factor of ~2 of the target; the IR is
    // truncated at `seconds`, so a long tail reads short by design.
    const ratio = r.t60 > 0 ? r.t60 / r.target : 0;
    if (r.t60 > 0 && (ratio < 0.4 || ratio > 2.6)) {
      flags.push('T60'); warnings.push(`reverb ${r.name}: T60 ${r.t60.toFixed(2)}s vs target ${r.target}s`);
    }
    revRms.push(r.rms);
    console.log([pad(r.name, 14), pad(r.length.toFixed(2), 8, true), pad(r.target.toFixed(2), 12, true),
      pad(r.t60 ? r.t60.toFixed(2) : 'full', 10, true), pad(r.rms.toFixed(4), 10, true),
      pad(Math.round(r.centroid) + 'Hz', 10, true), pad(r.corr.toFixed(2), 10, true),
      ' ' + flags.join(',')].join(''));
  }
  const rmsSpread = Math.max(...revRms) / Math.max(1e-9, Math.min(...revRms));
  console.log(`  level match across profiles: ${rmsSpread.toFixed(2)}x  ${rmsSpread > 2.2 ? '(WIDE — a zone change will jump)' : '(ok)'}`);
  if (rmsSpread > 2.2) warnings.push(`reverb level spread ${rmsSpread.toFixed(2)}x`);

  // -- 3. occlusion --------------------------------------------------------
  const occ = await run(() => window.AUDIO_PROBE.occlusion());
  console.log('\nOCCLUSION (real CollisionWorld + the engine\'s own filter mapping)');
  console.log('─'.repeat(96));
  console.log(`  line of sight, no wall       occlusion = ${occ.open.toFixed(2)}`);
  console.log(`  through a 160 mm solid wall  occlusion = ${occ.solid.toFixed(2)}`);
  console.log(`  through a 0.9 m doorway      occlusion = ${occ.doorway.toFixed(2)}`);
  console.log(`  ${pad('', 4)}${pad('state', 10)}${pad('dry dBFS', 12, true)}${pad('centroid', 12, true)}${pad('wet dBFS', 12, true)}${pad('wet/dry', 10, true)}`);
  for (const [k, v] of [['clear', occ.clear], ['half', occ.half], ['blocked', occ.blocked]]) {
    console.log(`  ${pad('', 4)}${pad(k, 10)}${pad(dB(v.dryRms), 12, true)}${pad(Math.round(v.centroid) + 'Hz', 12, true)}${pad(dB(v.wetRms), 12, true)}${pad(v.wetDry.toFixed(2), 10, true)}`);
  }
  if (!(occ.open < 0.05)) failures.push(`occlusion: clear line reads ${occ.open}`);
  if (!(occ.solid > 0.9)) failures.push(`occlusion: solid wall reads ${occ.solid}`);
  if (!(occ.doorway > 0.05 && occ.doorway < 0.95)) {
    warnings.push(`occlusion: doorway reads ${occ.doorway} (expected partial)`);
  }
  if (!(occ.blocked.centroid < occ.clear.centroid * 0.6)) {
    failures.push(`occlusion: blocked is not duller (${Math.round(occ.blocked.centroid)}Hz vs ${Math.round(occ.clear.centroid)}Hz)`);
  }
  if (!(occ.blocked.dryRms < occ.clear.dryRms * 0.6)) failures.push('occlusion: blocked is not quieter');
  if (!(occ.blocked.wetDry > occ.clear.wetDry * 1.5)) {
    failures.push('occlusion: blocked is not MORE reverberant — the whole point');
  }
  if (!(occ.half.wetDry > occ.clear.wetDry && occ.half.wetDry < occ.blocked.wetDry)) {
    warnings.push('occlusion: the wet/dry curve is not monotonic');
  }
  console.log(`  → duller: ${occ.blocked.centroid < occ.clear.centroid * 0.6 ? 'yes' : 'NO'}` +
    `   quieter: ${occ.blocked.dryRms < occ.clear.dryRms * 0.6 ? 'yes' : 'NO'}` +
    `   wetter: ${occ.blocked.wetDry > occ.clear.wetDry * 1.5 ? 'yes' : 'NO'}`);

  // -- 4. fluorescent hum tracks the fixture -------------------------------
  const hum = await run(() => window.AUDIO_PROBE.humFlicker());
  console.log('\nFLUORESCENT HUM vs a dying fixture\'s live level');
  console.log('─'.repeat(96));
  console.log(`  envelope correlation with the flicker curve : ${hum.corr.toFixed(3)}`);
  console.log(`  100 Hz mains partial                        : ${hum.g100.toExponential(2)}`);
  console.log(`  200 Hz harmonic                             : ${hum.g200.toExponential(2)}`);
  console.log(`  137 Hz (non-harmonic control)               : ${hum.g137.toExponential(2)}`);
  console.log(`  peak ${hum.peak.toFixed(3)}  rms ${dB(hum.rms)} dBFS  centroid ${Math.round(hum.centroid)}Hz`);
  if (hum.corr < 0.7) failures.push(`hum: envelope does not follow the fixture (r=${hum.corr.toFixed(2)})`);
  if (!(hum.g100 > hum.g137 * 3)) failures.push('hum: 100 Hz mains partial is not dominant');
  console.log(`  → a dying tube ${hum.corr > 0.7 ? 'stutters in sync with its flicker' : 'DOES NOT track its fixture'}`);

  // -- 5. optional pictures ------------------------------------------------
  if (WANT_PNG) {
    console.log('\nWAVEFORMS');
    for (const n of PNG_LIST) {
      if (!names.includes(n)) continue;
      const data = await run((nm) => window.AUDIO_PROBE.waveform(nm), n);
      const b64 = data.split(',')[1];
      const file = path.join(OUT, `wave-${n.replace(/\./g, '_')}.png`);
      await writeFile(file, Buffer.from(b64, 'base64'));
      console.log('  ✓', file);
    }
  }

  // -- summary -------------------------------------------------------------
  const ok = rows.filter((r) => !r.error).length;
  console.log('\n' + '═'.repeat(96));
  console.log(`  ${ok}/${rows.length} sounds rendered · ${revs.length} reverb profiles · ` +
    `${warnings.length} warnings · ${failures.length} failures`);
  if (warnings.length) {
    console.log('\n  warnings:');
    for (const w of warnings) console.log('   ·', w);
  }
  if (failures.length) {
    console.log('\n  FAILURES:');
    for (const f of failures) console.log('   ✗', f);
  }
  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errs.length) {
    console.log('\n  console errors:');
    console.log(errs.slice(0, 12).join('\n'));
  }

  if (args.json) {
    await writeFile(String(args.json), JSON.stringify({ rows, revs, occ, hum, failures, warnings }, null, 2));
    console.log('\n  wrote', args.json);
  }
  await writeFile(path.join(OUT, 'audio-report.json'),
    JSON.stringify({ rows, revs, occ, hum, failures, warnings }, null, 2));

  await browser.close();
  if (server) server.kill();
  process.exit(failures.length ? 4 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
