#!/usr/bin/env node
/**
 * Live audio soak.
 *
 * The offline probe measures what each sound IS. This measures what the engine
 * DOES: a real AudioContext, a real frame loop, real CollisionWorld occlusion
 * probes, the fluorescent hum pool following real LightRig fixtures, zone
 * reverb crossfades, voice pooling and reaping.
 *
 * Chromium is launched with the autoplay policy disabled so the context can
 * start without a gesture. Everything else is exactly the runtime path.
 *
 * Fails if: the context never runs, the voice count grows without bound, nodes
 * leak after the drivers stop, or anything throws.
 *
 *   node tools/qa/audio-live.mjs
 *   node tools/qa/audio-live.mjs --seconds 60
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const PORT = parseInt(args.port || '5305', 10);
const SECONDS = parseInt(args.seconds || '40', 10);

async function waitForServer(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return true; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

const pad = (s, n, right = false) => (right ? String(s).padStart(n) : String(s).padEnd(n));

async function main() {
  let server = null;
  if (!(await waitForServer(`http://127.0.0.1:${PORT}/`, 800))) {
    server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
    if (!(await waitForServer(`http://127.0.0.1:${PORT}/`, 45000))) {
      console.error('vite did not come up on', PORT); process.exit(1);
    }
  }

  const browser = await chromium.launch({
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  await page.route('**/@vite/client', (r) => r.abort());
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  const url = `http://127.0.0.1:${PORT}/tools/qa/audio-live.html`;
  console.log('→', url);
  // Vite pre-bundles `three` on first sight and answers in-flight requests for
  // the old bundle with a 504 "Outdated Optimize Dep". With the HMR client
  // blocked the page cannot self-heal, so retry the load until it comes up.
  let up = false;
  for (let attempt = 0; attempt < 5 && !up; attempt++) {
    if (attempt) await page.waitForTimeout(1500);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForFunction('window.AUDIO_LIVE_READY === true', { timeout: 12000 });
      up = true;
    } catch { /* dep cache still warming; reload */ }
  }
  if (!up) {
    console.error('harness never became ready:\n' + logs.join('\n'));
    await browser.close(); if (server) server.kill();
    process.exit(2);
  }

  page.setDefaultTimeout(600000);
  const r = await page.evaluate((s) => window.SOAK(s), SECONDS);

  const failures = [];
  console.log('\nLIVE SOAK');
  console.log('─'.repeat(84));
  if (!r.ok) {
    console.log('  AudioContext unavailable —', r.reason);
    console.log('  (this is a PASS for graceful degradation, but nothing else was measured)');
  } else {
    console.log(`  ${r.frames} frames over ${r.wall}s of real time (target ${SECONDS}s)`);
    console.log(`  context state          ${r.contextState}`);
    console.log(`  reverb at end          ${r.reverb}`);
    console.log(`  live fluorescent hums  ${r.hums}`);
    console.log(`  peak voices / nodes    ${r.peakVoices} / ${r.peakNodes}`);
    console.log(`  occlusion probes       ${r.occlChecks}`);
    console.log(`  voices denied by cap   ${r.denied}`);
    console.log(`  one-shots after wind-down ${r.afterQuiet}   (persistent loops: ${r.afterQuietLoops})`);
    console.log('\n  voice count over time');
    console.log(`  ${pad('t (s)', 8)}${pad('voices', 8, true)}${pad('nodes', 8, true)}${pad('loops', 8, true)}${pad('hums', 7, true)}  ${pad('zone', 10)}${pad('reverb', 10)}`);
    for (const s of r.samples) {
      console.log(`  ${pad(s.t, 8)}${pad(s.voices, 8, true)}${pad(s.nodes, 8, true)}${pad(s.loops, 8, true)}${pad(s.hums, 7, true)}  ${pad(s.zone, 10)}${pad(s.reverb, 10)}`);
    }

    if (r.contextState !== 'running') failures.push(`context is "${r.contextState}", not running`);
    if (r.peakVoices > 48) failures.push(`voice count peaked at ${r.peakVoices} (cap is 44 + loops)`);
    // Voice counts must plateau, not climb. Compare the first and last thirds.
    const v = r.samples.map((s) => s.voices);
    const third = Math.max(1, Math.floor(v.length / 3));
    const early = v.slice(third, third * 2).reduce((a, b) => a + b, 0) / third;
    const late = v.slice(-third).reduce((a, b) => a + b, 0) / third;
    console.log(`\n  mid-run mean voices ${early.toFixed(1)} → late mean ${late.toFixed(1)}`);
    if (late > early * 1.6 + 4) failures.push(`voice count is climbing (${early.toFixed(1)} → ${late.toFixed(1)}) — a leak`);
    if (r.afterQuiet > 2) failures.push(`${r.afterQuiet} one-shot voices still alive after wind-down`);
    if (r.afterQuietLoops > 20) failures.push(`${r.afterQuietLoops} loops still alive after wind-down`);
    if (r.hums < 1) failures.push('no fluorescent hums running next to a corridor full of fixtures');
    if (r.errors.length) failures.push(`window errors: ${r.errors.slice(0, 3).join(' | ')}`);
  }

  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
    .filter((l) => !/ERR_FAILED/.test(l));   // the deliberately blocked HMR client
  if (errs.length) {
    console.log('\n  console errors:');
    console.log('  ' + errs.slice(0, 10).join('\n  '));
    failures.push(`${errs.length} console errors`);
  }

  console.log('\n' + '═'.repeat(84));
  console.log(failures.length ? `  ${failures.length} FAILURES` : '  clean');
  for (const f of failures) console.log('   ✗', f);

  await browser.close();
  if (server) server.kill();
  process.exit(failures.length ? 4 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
