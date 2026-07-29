#!/usr/bin/env node
/**
 * Automated artifact review.
 *
 * Reads a capture directory and measures the things that are tedious and
 * unreliable to eyeball across dozens of frames. It does not replace looking at
 * the images — it tells you *which* images to look at, and it catches slow
 * regressions that the eye adapts to between rounds.
 *
 * Measured per frame:
 *   crushed        fraction of pixels at or near pure black (lost shadow detail)
 *   clipped        fraction at or near pure white (blown highlights)
 *   dynamicRange   p1..p99 luminance spread
 *   contrast       stddev of luminance
 *   banding        long runs of identical luminance along scanlines, which is
 *                  what posterised gradients look like numerically
 *   highFreq       mean |laplacian|, a proxy for aliasing and shimmer; a frame
 *                  far above its neighbours is usually a texture aliasing badly
 *   speckle        isolated pixels far darker than all 8 neighbours — the
 *                  signature of geometry gaps and shadow acne
 *   colourCast     mean channel imbalance
 *   emptiness      fraction of the frame within 2% of the frame's modal colour
 *
 *   node tools/qa/artifacts.mjs --in docs/captures/r6
 */
import { chromium } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const IN = args.in || 'docs/captures/latest';
const OUT = args.out || path.join(IN, '_artifacts.json');

/** Thresholds tuned for this project's grade: dark, but never crushed. */
const LIMITS = {
  crushed: 0.16,        // >16% of frame at black means detail is being lost
  clipped: 0.030,
  dynamicRange: 0.22,   // below this the frame is flat/foggy
  banding: 0.055,
  speckle: 0.0035,
  emptiness: 0.72,
};

const files = (await readdir(IN)).filter((f) => f.endsWith('.png') && !f.startsWith('_')).sort();
if (!files.length) { console.error('no PNGs in ' + IN); process.exit(1); }

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

await page.addScriptTag({
  content: `
window.analyse = async function (dataUrl) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;

  const lum = new Float32Array(W * H);
  let rs = 0, gs = 0, bs = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    lum[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    rs += r; gs += g; bs += b;
  }
  const n = W * H;

  let crushed = 0, clipped = 0, sum = 0;
  for (let p = 0; p < n; p++) {
    if (lum[p] <= 0.012) crushed++;
    if (lum[p] >= 0.988) clipped++;
    sum += lum[p];
  }
  const mean = sum / n;
  let varsum = 0;
  for (let p = 0; p < n; p++) varsum += (lum[p] - mean) ** 2;
  const contrast = Math.sqrt(varsum / n);

  const sorted = Float32Array.from(lum).sort();
  const pct = (q) => sorted[Math.min(n - 1, Math.max(0, Math.floor(q * n)))];
  const dynamicRange = pct(0.99) - pct(0.01);

  // Banding: runs of >=6 consecutive pixels with byte-identical luminance,
  // inside a region that is not flat overall.
  let bandPixels = 0;
  for (let y = 0; y < H; y += 2) {
    let runStart = 0, runVal = -1;
    for (let x = 0; x <= W; x++) {
      const v = x < W ? Math.round(lum[y * W + x] * 255) : -2;
      if (v !== runVal) {
        const len = x - runStart;
        if (len >= 6 && runVal > 2 && runVal < 250) bandPixels += len;
        runStart = x; runVal = v;
      }
    }
  }
  const banding = bandPixels / (n / 2);

  // High-frequency energy (laplacian) and isolated dark speckles.
  let hf = 0, speck = 0, hfCount = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      const c0 = lum[p];
      const up = lum[p - W], dn = lum[p + W], lf = lum[p - 1], rt = lum[p + 1];
      hf += Math.abs(4 * c0 - up - dn - lf - rt);
      hfCount++;
      const minN = Math.min(up, dn, lf, rt,
        lum[p - W - 1], lum[p - W + 1], lum[p + W - 1], lum[p + W + 1]);
      if (c0 < minN - 0.16 && minN > 0.05) speck++;
    }
  }
  const highFreq = hf / hfCount;
  const speckle = speck / hfCount;

  // Emptiness: how much of the frame sits in one narrow luminance bucket.
  const hist = new Int32Array(64);
  for (let p = 0; p < n; p++) hist[Math.min(63, (lum[p] * 64) | 0)]++;
  let modal = 0;
  for (let i = 0; i < 64; i++) if (hist[i] > hist[modal]) modal = i;
  const emptiness = hist[modal] / n;

  const rm = rs / n, gm = gs / n, bm = bs / n;
  const avg = (rm + gm + bm) / 3 || 1e-6;
  const colourCast = Math.max(Math.abs(rm - avg), Math.abs(gm - avg), Math.abs(bm - avg)) / avg;

  return { W, H, mean, contrast, dynamicRange, crushed: crushed / n, clipped: clipped / n,
           banding, highFreq, speckle, emptiness, colourCast };
};`,
});

const rows = [];
for (const f of files) {
  const b64 = (await readFile(path.join(IN, f))).toString('base64');
  const r = await page.evaluate((u) => window.analyse(u), `data:image/png;base64,${b64}`);
  rows.push({ file: f, ...r });
}
await browser.close();

// High-frequency energy is only meaningful relative to the rest of the set.
const hfs = rows.map((r) => r.highFreq).sort((a, b) => a - b);
const hfMedian = hfs[Math.floor(hfs.length / 2)];

const flagged = [];
const fmt = (v, d = 3) => v.toFixed(d).padStart(d + 3);
console.log(`\nartifact review — ${IN}  (${rows.length} frames)\n`);
console.log('frame                     crush  clip   range  contr  band   hf     speck  empty');
for (const r of rows) {
  const flags = [];
  if (r.crushed > LIMITS.crushed) flags.push('CRUSHED');
  if (r.clipped > LIMITS.clipped) flags.push('CLIPPED');
  if (r.dynamicRange < LIMITS.dynamicRange) flags.push('FLAT');
  if (r.banding > LIMITS.banding) flags.push('BANDING');
  if (r.speckle > LIMITS.speckle) flags.push('SPECKLE');
  if (r.emptiness > LIMITS.emptiness) flags.push('EMPTY');
  if (r.highFreq > hfMedian * 2.2) flags.push('ALIASING');
  if (flags.length) flagged.push({ file: r.file, flags });
  console.log(
    `${r.file.replace('.png', '').padEnd(24)} ${fmt(r.crushed)} ${fmt(r.clipped)} ` +
    `${fmt(r.dynamicRange)} ${fmt(r.contrast)} ${fmt(r.banding)} ${fmt(r.highFreq)} ` +
    `${fmt(r.speckle, 4)} ${fmt(r.emptiness)}  ${flags.join(' ')}`);
}

console.log(`\nmedian high-frequency energy: ${hfMedian.toFixed(4)}`);
if (flagged.length) {
  console.log(`\n${flagged.length} frame(s) flagged — inspect these first:`);
  for (const f of flagged) console.log(`  ${f.file}: ${f.flags.join(', ')}`);
} else {
  console.log('\nno frames flagged');
}

await writeFile(OUT, JSON.stringify({ dir: IN, limits: LIMITS, hfMedian, rows, flagged }, null, 2));
console.log(`\nwrote ${OUT}`);
