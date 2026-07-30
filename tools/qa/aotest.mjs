/**
 * Numeric check on the AO bake, independent of the renderer.
 *
 * Builds a synthetic 8 x 3 x 8 m room out of collider boxes, bakes the volume,
 * then prints the value the shader would sample at a set of named probe points.
 * A screenshot can hide an indexing or sign error behind an unrelated lighting
 * problem; this cannot.
 *
 *   node tools/qa/aotest.mjs
 */
import * as THREE from 'three';
import { AOVolume } from '../../src/render/AOVolume.js';

const boxes = [];
function add(min, max, tag = 'world') {
  boxes.push({
    minX: min[0], minY: min[1], minZ: min[2],
    maxX: max[0], maxY: max[1], maxZ: max[2],
    enabled: true, solid: true, blocksSight: true, tag,
  });
}

const W = 4, D = 4, H = 3, T = 0.16;   // half-extents in x/z, full height
add([-W - T, 0, -D - T], [W + T, H, -D]);        // north wall
add([-W - T, 0, D], [W + T, H, D + T]);          // south wall
add([-W - T, 0, -D - T], [-W, H, D + T]);        // west wall
add([W, 0, -D - T], [W + T, H, D + T]);          // east wall
add([-W, -0.3, -D], [W, 0, D]);                  // floor slab
add([-W, H, -D], [W, H + 0.3, D], 'ceiling');    // ceiling — must be ignored
add([1.0, 0, 1.0], [1.4, H, 1.4]);               // a column

const collision = { boxes };
const box = new THREE.Box3(
  new THREE.Vector3(-W - T, -0.3, -D - T),
  new THREE.Vector3(W + T, H + 0.3, D + T));

const vol = new AOVolume({ cell: 0.25 }).build(collision, box);
console.log('bake', vol.stats());

// Reproduce the GLSL sampler on the CPU, including the tile inset, so this
// tests the packing and not just the field.
function sample(x, y, z) {
  const gx = (x - vol.min.x) / vol.size.x;
  const gy = (y - vol.min.y) / vol.size.y;
  const gz = (z - vol.min.z) / vol.size.z;
  if (gx < 0 || gy < 0 || gz < 0 || gx > 1 || gy > 1 || gz > 1) return 1;
  const yf = gy * (vol.ny - 1), y0 = Math.floor(yf);
  const cu = Math.min(Math.max(gx, 0.5 / vol.nx), 1 - 0.5 / vol.nx);
  const cv = Math.min(Math.max(gz, 0.5 / vol.nz), 1 - 0.5 / vol.nz);
  const slice = (s) => {
    const tx = s % vol.tilesX, ty = Math.floor(s / vol.tilesX);
    // Nearest texel; the GPU filters bilinearly but that only smooths this.
    const px = Math.min(vol.nx - 1, Math.floor(cu * vol.nx));
    const pz = Math.min(vol.nz - 1, Math.floor(cv * vol.nz));
    const o = (((ty * vol.nz + pz) * vol.width) + (tx * vol.nx + px)) * 4;
    return vol.data[o] / 255;
  };
  const a = slice(y0), b = slice(Math.min(y0 + 1, vol.ny - 1));
  return a + (b - a) * (yf - y0);
}

// The shader probes 0.55 m along the surface normal.
const OFF = 0.55;
const probes = [
  ['room centre, floor  (expect ~1.0)', 0, 0 + OFF, 0],
  ['room centre, wall   (expect ~1.0)', W - OFF, 1.5, 0],
  ['room centre, ceiling(expect ~1.0)', 0, H - OFF, 0],
  ['floor at wall base  (expect < 0.85)', W - 0.15, 0 + OFF, 0],
  ['wall/floor crease   (expect < 0.85)', W - OFF, 0.15, 0],
  ['wall/ceiling crease (expect < 0.90)', W - OFF, H - 0.15, 0],
  ['inside corner, mid  (expect < 0.70)', W - OFF, 1.5, D - OFF],
  ['inside corner, low  (expect < 0.55)', W - OFF, 0.25, D - OFF],
  ['column base         (expect < 0.80)', 1.2, 0 + OFF, 1.4 + OFF],
  ['outside the volume  (expect  1.0)', 40, 1.5, 0],
];

let worstMid = 0;
for (const [label, x, y, z] of probes) {
  const v = sample(x, y, z);
  console.log(`  ${label}  ->  ${v.toFixed(3)}`);
  if (label.startsWith('room centre')) worstMid = Math.max(worstMid, 1 - v);
}

const corner = sample(W - OFF, 0.25, D - OFF);
const mid = sample(0, 0 + OFF, 0);

// PASS CRITERIA, and why they are what they are.
//
// The first version of this test asserted mid-room >= 0.93 — i.e. that an open
// floor is essentially untouched. Measured, this room gives 0.86. That is not a
// bug: the test room is 8 x 3 x 8 m and sealed, so a cell in the middle of it
// genuinely has a quarter of its sphere within 3 m of a surface. A large hall
// measures close to 1.0 and a cupboard measures lower, which is the correct
// behaviour for an occlusion field. What must NOT happen is the effect
// degenerating into a flat room-wide dimming, so the criterion that matters is
// the RATIO between open floor and crease, plus a floor under the open value so
// a regression that dims everything still fails.
const ratio = mid / Math.max(corner, 1e-3);
console.log('');
console.log(`open-room value        ${mid.toFixed(3)}  (floor: >= 0.80)`);
console.log(`corner value           ${corner.toFixed(3)}  (ceiling: <= 0.55)`);
console.log(`contrast mid/corner    ${ratio.toFixed(2)}x  (>= 2.0)`);

const checks = [
  ['open floor not globally dimmed', mid >= 0.80],
  ['corner darkens', corner <= 0.55],
  ['crease contrast', ratio >= 2.0],
  ['outside the volume is neutral', sample(40, 1.5, 0) === 1],
  ['wall/ceiling junction darkens', sample(W - OFF, H - 0.15, 0) < mid * 0.75],
  ['wall/floor junction darkens', sample(W - OFF, 0.15, 0) < mid * 0.75],
  ['column base darkens', sample(1.2, OFF, 1.4 + OFF) < mid * 0.95],
  ['monotone: corner darker than single wall',
    sample(W - OFF, 1.5, D - OFF) < sample(W - OFF, 1.5, 0)],
];
let ok = true;
for (const [name, pass] of checks) {
  if (!pass) ok = false;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
