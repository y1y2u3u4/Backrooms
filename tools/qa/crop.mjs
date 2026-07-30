/**
 * Crop and magnify a region out of one or more captures, side by side.
 *
 * Frame-level inspection at 1100 px wide cannot resolve a one-pixel seam or a
 * two-value banding step, and those are exactly the defects that matter most.
 *
 *   node tools/qa/crop.mjs --out docs/captures/crop/x.png --box 0,240,420,140 \
 *       --zoom 3 docs/captures/ao/ao_00_off_spine.png docs/captures/ao/ao_01_on_spine.png
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const argv = process.argv.slice(2);
const opts = {};
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
  else files.push(argv[i]);
}
const [bx, by, bw, bh] = (opts.box || '0,0,400,200').split(',').map(Number);
const ZOOM = parseInt(opts.zoom || '3', 10);
const OUT = opts.out || 'docs/captures/crop/crop.png';
const GAP = 8;

function inflatePNG(buf) {
  let i = 8, w = 0, h = 0, ct = 6, idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(i + 8); h = buf.readUInt32BE(i + 12); ct = buf[i + 17]; }
    else if (type === 'IDAT') idat.push(buf.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3;
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * bpp);
  let prev = Buffer.alloc(stride), pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride)); pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride); prev = line;
  }
  return { w, h, bpp, data: out };
}

function writePNG(file, w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const b = Buffer.alloc(8 + data.length + 4);
    b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8);
    b.writeInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
    return b;
  };
  let table = null;
  function crc(buf) {
    if (!table) {
      table = new Int32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
    }
    let c = -1;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return c ^ -1;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const imgs = [];
for (const f of files) imgs.push(inflatePNG(await readFile(f)));

const cw = bw * ZOOM, chh = bh * ZOOM;
const W = cw * imgs.length + GAP * (imgs.length - 1);
const H = chh;
const out = Buffer.alloc(W * H * 3, 24);
imgs.forEach((im, k) => {
  const ox = k * (cw + GAP);
  for (let y = 0; y < chh; y++) {
    const sy = Math.min(im.h - 1, by + Math.floor(y / ZOOM));
    for (let x = 0; x < cw; x++) {
      const sx = Math.min(im.w - 1, bx + Math.floor(x / ZOOM));
      const s = (sy * im.w + sx) * im.bpp;
      const d = (y * W + ox + x) * 3;
      out[d] = im.data[s]; out[d + 1] = im.data[s + 1]; out[d + 2] = im.data[s + 2];
    }
  }
});
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, writePNG(OUT, W, H, out));
console.log(`${OUT}  ${W}x${H}  (${imgs.length} panels, box ${bx},${by} ${bw}x${bh} @${ZOOM}x)`);
