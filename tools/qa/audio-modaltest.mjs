#!/usr/bin/env node
/**
 * Modal resonator diagnostic.
 *
 * This exists because of a specific, non-obvious browser behaviour, and it is
 * kept so the next person to reach for a filter-based modal bank finds the
 * measurement rather than repeating the mistake.
 *
 * Blink computes a BiquadFilterNode's tail time analytically from its UNIT
 * impulse response against an absolute threshold of 1/32768, then hard-stops
 * the node when that time elapses after its input goes silent. A
 * constant-0dB-peak bandpass at Q=146 has a unit impulse response peaking at
 * 1.9e-4 — 16 dB above that threshold — so a resonator asked to ring for 1.5 s
 * is cut to exactly zero at 0.40 s, about 20 dB down, with a discontinuity.
 * Scaling before or after the filter does not help: the threshold comes from
 * the coefficients, not the signal.
 *
 * `Synth.modalRing` is therefore additive (one oscillator + one envelope per
 * partial). This script prints, for three representative modes:
 *
 *   raw      a bare biquad bandpass fed a one-sample impulse
 *   ring     modalRing's full graph
 *   pure     modalRing with the contact noise disabled, plus its envelope
 *
 * A healthy result has `pure` within a few percent of the requested T60 and an
 * envelope that decays smoothly to zero rather than stopping mid-decay.
 *
 *   node tools/qa/audio-modaltest.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const PORT = parseInt(process.env.AUDIO_QA_PORT || '5307', 10);

const waitForServer = async (url, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

let server = null;
if (!(await waitForServer(`http://127.0.0.1:${PORT}/`, 800))) {
  server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await waitForServer(`http://127.0.0.1:${PORT}/`, 45000))) {
    console.error('vite did not come up on', PORT);
    process.exit(1);
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const url = `http://127.0.0.1:${PORT}/tools/qa/audio-harness.html`;
let up = false;
for (let attempt = 0; attempt < 5 && !up; attempt++) {
  if (attempt) await page.waitForTimeout(1500);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction('window.AUDIO_READY === true', { timeout: 12000 });
    up = true;
  } catch { /* vite dep cache still warming */ }
}
if (!up) {
  console.error('harness never became ready');
  await browser.close(); if (server) server.kill();
  process.exit(2);
}

page.setDefaultTimeout(300000);
const rows = await page.evaluate(() => window.AUDIO_PROBE.modalTest());

console.log('\nMODAL RESONATOR DECAY');
console.log('─'.repeat(84));
console.log('  f (Hz)   want T60         Q   raw biquad    modalRing    pure');
console.log('─'.repeat(84));
let bad = 0;
for (const r of rows) {
  const err = Math.abs(r.pure.t60 - r.t60) / r.t60;
  if (err > 0.12) bad++;
  console.log(`  ${String(r.f).padStart(6)}   ${String(r.t60).padStart(8)}  ${String(r.Q).padStart(8)}`
    + `   ${r.raw.t60.toFixed(3).padStart(10)}   ${r.ring.t60.toFixed(3).padStart(10)}`
    + `   ${r.pure.t60.toFixed(3).padStart(6)}  ${err > 0.12 ? 'TRUNCATED' : 'ok'}`);
  console.log(`           envelope: ${r.envelope.slice(0, 24).join(' ')}`);
}
console.log('\n  (the raw biquad column is expected to be short — that is the behaviour');
console.log('   this file documents, and the reason modalRing is additive)');
console.log(bad ? `\n  ${bad} modes are not ringing for their stated T60` : '\n  clean');

await browser.close();
if (server) server.kill();
process.exit(bad ? 4 : 0);
