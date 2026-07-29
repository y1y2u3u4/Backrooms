#!/usr/bin/env node
/**
 * Cinematics smoke test.
 *
 * Runs every registered sequence to completion in the UI harness, watched and
 * skipped, and fails if any of them leaves the player without control, leaves a
 * grade channel stuck, or throws.
 */
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));
const PORT = parseInt(args.port || '5304', 10);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/src/ui/harness.html?bare=1`, { waitUntil: 'load' });
await page.waitForFunction('window.UIH_READY === true', { timeout: 30000 });

const report = await page.evaluate(() => window.UIH_TEST());

let bad = 0;
for (const r of report) {
  const problems = [];
  if (r.frozen) problems.push('player still frozen');
  if (!r.control) problems.push('controlEnabled false');
  if (!r.look) problems.push('lookEnabled false');
  if (r.stuck.length) problems.push('stuck grade: ' + r.stuck.join(' '));
  if (r.errors.length) problems.push('errors: ' + r.errors.join(' | '));
  // Continuity: a 60 fps eased dolly never moves more than a few cm or turns
  // more than a couple of degrees in one frame, and never spikes off its own
  // median. A snap shows up here and nowhere else.
  // Absolute limits: 0.12 m/frame is 7 m/s, faster than any authored dolly;
  // 0.055 rad/frame is 190 deg/s, faster than a startled head turn. The spike
  // ratios are measured against the 95th percentile, not the median, and only
  // count when the move is big enough for the ratio to mean anything — a camera
  // that is nearly still all shot has a median of zero and would flag forever.
  if (r.mode === 'watch') {
    if (r.cam.maxStep > 0.12) problems.push(`camera jump ${r.cam.maxStep} m/frame`);
    if (r.cam.maxTurn > 0.055) problems.push(`camera whip ${(r.cam.maxTurn * 57.3).toFixed(1)}°/frame`);
    if (r.cam.maxStep > 0.02 && r.cam.posSpike > 6) problems.push(`position discontinuity ×${r.cam.posSpike}`);
    if (r.cam.maxTurn > 0.012 && r.cam.angSpike > 6) problems.push(`rotation discontinuity ×${r.cam.angSpike}`);
  }
  const tag = problems.length ? '✗' : '✓';
  if (problems.length) bad++;
  console.log(`  ${tag} ${r.name.padEnd(18)} ${r.mode.padEnd(6)} ${String(r.duration).padStart(6)}s ` +
    `${String(r.steps).padStart(5)}f  swaps=${r.swaps}  ` +
    `step=${r.cam.maxStep}m turn=${(r.cam.maxTurn * 57.3).toFixed(1)}° spike=${r.cam.posSpike}/${r.cam.angSpike}` +
    (problems.length ? `\n      ${problems.join('\n      ')}` : ''));
}
await browser.close();
console.log(bad ? `\n${bad} sequence run(s) failed` : `\nAll ${report.length} sequence runs clean`);
process.exit(bad ? 1 : 0);
