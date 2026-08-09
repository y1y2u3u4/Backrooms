/**
 * Plenum legibility — does a missing ceiling tile read as a space or as a hole?
 *
 * WHY A DEDICATED TOOL.
 *
 * `artifacts.mjs` reports whole-frame statistics, and a ceiling occupies a
 * different part of the frame from the thing those statistics were tuned for.
 * The specific failure being measured here is narrow: a void that renders as
 * FLAT and BLACK with a HARD EDGE reads to a player as missing geometry, and
 * one that renders dark but with internal variation reads as somewhere the
 * light does not reach. Those two are nearly the same mean brightness and
 * completely different to look at, so mean brightness cannot tell them apart.
 *
 * What separates them is: how much of the frame is at or near zero, and how
 * much structure survives inside the dark regions. Both are measured here.
 *
 * WHAT THIS CANNOT SAY: whether it looks good. It can say a void stopped being
 * a black rectangle. Whether the result is convincing dilapidation is a
 * question for a person, and this project's own completion report already warns
 * that its frame metrics are gameable.
 *
 *   node tools/qa/plenum.mjs --before docs/captures/ceil_before --after docs/captures/ceil_after
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));

const BEFORE = args.before || 'docs/captures/ceil_before';
const AFTER = args.after || 'docs/captures/ceil_after';

/** Minimal PNG reader: 8-bit RGB/RGBA, non-interlaced, which is what we write. */
async function readPNG(file) {
  const buf = await readFile(file);
  let w = 0, h = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colourType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colourType !== 2 && colourType !== 6)) {
    throw new Error(`${file}: unsupported PNG (depth ${bitDepth} colour ${colourType} interlace ${interlace})`);
  }
  const ch = colourType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prior ? prior[x] : 0;
      const c = (prior && x >= ch) ? prior[x - ch] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, data: out };
}

const lum = (im, x, y) => {
  const i = (y * im.w + x) * im.ch;
  return 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2];
};

/**
 * THE COMPARISON IS PAIRED, AND IT TOOK TWO WRONG VERSIONS TO GET THERE.
 *
 * v1 reported "pure black % of the ceiling half". That read 0.99 % -> 0.87 % on
 * the captures, which is nothing, and the change was very nearly reverted as a
 * no-op on its say-so. The aggregate was diluted about ten to one: the voids
 * this measures are ~10 % of the ceiling half and the rest is lit mineral fibre.
 * Averaging a fix over the region it does not touch will hide almost any fix.
 *
 * v2 reported the mean of the dark pixels — but selected them INDEPENDENTLY IN
 * EACH IMAGE, which is a survivorship filter, not a measurement. A void that
 * brightens past the threshold simply leaves the set, so the surviving mean
 * barely moves: it said 10.22 -> 10.52 where the truth was 8.3 -> 16.4.
 *
 * The mask is taken from the BEFORE frame and applied to both. The question is
 * "the pixels that were dark — what are they now", and only a fixed mask asks
 * it. Both earlier versions were reasonable-looking and both were wrong in the
 * direction of reporting no change.
 */
const DARK = 24;   // luminance below which a pixel is "in a void"

/**
 * Paired statistics over the CEILING HALF of the frame. These shots are pitched
 * up, so the top is ceiling and the bottom is floor, wall and the player's hand;
 * measuring whole frames would let a bright floor mask a black ceiling.
 */
function pairStats(B, A) {
  if (B.w !== A.w || B.h !== A.h) throw new Error('frame sizes differ');
  const y1 = Math.floor(B.h * 0.55);
  let n = 0, sumB = 0, sumA = 0, blackB = 0, blackA = 0;
  let darkN = 0, darkB = 0, darkA = 0, moved = 0, structB = 0, structA = 0;
  const grad = (im, x, y) => Math.abs(lum(im, x + 1, y) - lum(im, x - 1, y))
                           + Math.abs(lum(im, x, y + 1) - lum(im, x, y - 1));
  for (let y = 1; y < y1; y++) {
    for (let x = 1; x < B.w - 1; x++) {
      const vb = lum(B, x, y), va = lum(A, x, y);
      n++; sumB += vb; sumA += va;
      if (vb < 2) blackB++;
      if (va < 2) blackA++;
      // THE MASK IS THE BEFORE FRAME'S. See the note above.
      if (vb < DARK) {
        darkN++; darkB += vb; darkA += va;
        if (Math.abs(va - vb) > 1) moved++;
        // Structure: a local gradient of a few levels is the difference between
        // a void with a deck and hangers in it and a rectangle of nothing.
        if (grad(B, x, y) > 3) structB++;
        if (grad(A, x, y) > 3) structA++;
      }
    }
  }
  const r = (v) => +v.toFixed(2);
  return {
    darkPixels: darkN,
    darkPctOfRegion: r(100 * darkN / n),
    darkMeanBefore: darkN ? r(darkB / darkN) : null,
    darkMeanAfter: darkN ? r(darkA / darkN) : null,
    darkMovedPct: darkN ? r(100 * moved / darkN) : null,
    structureBeforePct: darkN ? r(100 * structB / darkN) : null,
    structureAfterPct: darkN ? r(100 * structA / darkN) : null,
    pureBlackBeforePct: r(100 * blackB / n),
    pureBlackAfterPct: r(100 * blackA / n),
    meanBefore: r(sumB / n), meanAfter: r(sumA / n),
  };
}

const listPNG = async (d) => (await readdir(d)).filter((f) => f.endsWith('.png')).sort();
const names = [...new Set([...(await listPNG(BEFORE)), ...(await listPNG(AFTER))])].sort();

console.log(`\nPlenum legibility — pixels that were dark BEFORE, in the ceiling half\n`);
console.log(`  ${'frame'.padEnd(22)} ${'dark mean'.padStart(17)} ${'moved'.padStart(8)} ${'structure %'.padStart(18)}`);
const rows = [];
for (const nm of names) {
  let s;
  try {
    s = pairStats(await readPNG(path.join(BEFORE, nm)), await readPNG(path.join(AFTER, nm)));
  } catch (e) { console.log(`  ${nm.padEnd(22)}  (${e.message})`); continue; }
  const f = (x) => (x == null ? '    —' : x.toFixed(2).padStart(6));
  console.log(`  ${nm.replace('.png', '').padEnd(22)} ${f(s.darkMeanBefore)} ->${f(s.darkMeanAfter)} ${f(s.darkMovedPct)}% ${f(s.structureBeforePct)} ->${f(s.structureAfterPct)}`);
  rows.push({ frame: nm, ...s });
}

const avg = (k) => rows.reduce((t, r) => t + (r[k] ?? 0), 0) / Math.max(1, rows.length);
const move = (a, b) => {
  const x = avg(a), y = avg(b);
  return `${x.toFixed(2)} -> ${y.toFixed(2)}  (${x ? (y > x ? '+' : '') + ((y - x) / x * 100).toFixed(0) : '—'} %)`;
};
console.log('');
console.log('  VERDICT');
console.log(`    luminance of the pixels that were dark   ${move('darkMeanBefore', 'darkMeanAfter')}`);
console.log(`    of those, the fraction that moved at all ${avg('darkMovedPct').toFixed(1)} %`);
console.log(`    structure inside them                    ${move('structureBeforePct', 'structureAfterPct')}`);
console.log('');
console.log('  context — these average the fix over the region it does not touch');
console.log(`    pure black % of ceiling half   ${avg('pureBlackBeforePct').toFixed(3)} -> ${avg('pureBlackAfterPct').toFixed(3)}`);
console.log(`    whole-region mean              ${avg('meanBefore').toFixed(2)} -> ${avg('meanAfter').toFixed(2)}`);
console.log('');

await writeFile('docs/verification/plenum.json', JSON.stringify({ before: BEFORE, after: AFTER, frames: rows }, null, 2));
console.log(`  wrote docs/verification/plenum.json\n`);
