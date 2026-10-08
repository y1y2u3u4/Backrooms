#!/usr/bin/env node
/**
 * Where does the boot actually go?
 *
 * A loading bar's weights are a guess its author made, not a measurement, and
 * this project's were backwards: texture synthesis was allotted half the bar
 * and takes about a tenth of the wait, while the two phases that dominate --
 * downloading the hero assets and raising the first zone -- were given a
 * quarter between them. A player watched the bar rush to 55% and sit there,
 * which is the shape that reads as "it has hung".
 *
 * This drives a built page and times the real phases by watching the loading
 * screen's own text change, so the numbers come from the thing the player waits
 * on rather than from the code's opinion of itself.
 *
 *   node tools/qa/boot.mjs http://127.0.0.1:4173/          # a local preview
 *   node tools/qa/boot.mjs https://.../Backrooms/ high     # the deployed build
 *
 * The tier matters: `textureQuality` is 1 at high and 0.5 at low, and it is CPU
 * work at load, so a low-tier boot is not a faster version of the same profile.
 */
import { chromium } from '@playwright/test';
const url = process.argv[2];
const quality = process.argv[3] || 'high';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.addInitScript(() => {
  window.__BOOT = [];
  window.__T0 = performance.now();
});
// The loading screen writes the phase text into the DOM; watch it change.
await page.exposeFunction('__mark', (label, t) => { /* noop, kept in page */ });
await page.goto(`${url}?quality=${quality}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(() => {
  const seen = new Set();
  const obs = new MutationObserver(() => {
    document.querySelectorAll('*').forEach((n) => {
      if (n.children.length) return;
      const t = (n.textContent || '').trim();
      if (!t || t.length > 40 || seen.has(t)) return;
      if (!/forging|raising|mixing|unpacking|loading|settling|compiling|tuning|winding|printing|initialising|ready|schedule/i.test(t)) return;
      seen.add(t);
      window.__BOOT.push({ label: t, t: +(performance.now() - window.__T0).toFixed(0) });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
});
try {
  await page.waitForFunction(() => window.ANNEX_READY === true || window.ANNEX?.ready === true,
    null, { timeout: 900000, polling: 250 });
} catch { console.log('TIMED OUT'); }
const marks = await page.evaluate(() => ({ b: window.__BOOT, total: performance.now() - window.__T0 }));
// TWO DIFFERENT WAITS, AND ONLY ONE OF THEM IS THE PLAYER'S.
//
// The last phase the loading screen prints is when the player gets the game.
// `ANNEX.ready` flips later, after the shader pre-warm, which this file's own
// note in Game.js measures at about 190 SECONDS on a software rasteriser and at
// milliseconds on any real GPU. Reporting one number conflated a 2.7 s wait with
// a 185 s artefact of not having a graphics card.
const visible = marks.b.length ? marks.b[marks.b.length - 1].t : null;
console.log(`quality=${quality}`);
console.log(`  loading screen finishes  ${(visible / 1000).toFixed(1)}s   <- what the player waits`);
console.log(`  ANNEX.ready              ${(marks.total / 1000).toFixed(1)}s   (includes the shader pre-warm;`
  + ` on this CPU rasteriser that is ~190 s per zone and is not a player-facing number)\n`);
let prev = 0;
for (const m of marks.b) {
  console.log(`  ${String(m.t).padStart(7)} ms  (+${String(m.t - prev).padStart(6)})  ${m.label}`);
  prev = m.t;
}
await browser.close();
