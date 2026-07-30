import * as THREE from 'three';
import { clamp01 } from '../core/util.js';

/**
 * AOVolume — a baked ambient-occlusion field for a whole zone.
 *
 * WHY THIS EXISTS
 *
 * The single most obvious difference between this renderer and a lightmapped or
 * GI-lit one was that corners were not dark. A wall met a floor, a column met a
 * ceiling, a doorway reveal turned a corner, and none of those junctions had any
 * darkening at all — because the only indirect light in the scene was a
 * hemisphere constant, which by definition reaches everywhere equally. Screen
 * space AO cannot fix it: GTAO's radius is centimetres, so it darkens a skirting
 * board's own bevel but knows nothing about the fact that the corner of a room
 * receives light from a quarter of the sphere instead of half of it.
 *
 * This bakes that large-scale term. It voxelises the zone's collision boxes,
 * measures openness per cell by casting a fixed direction set through the
 * occupancy grid, blurs the result, and uploads it as a texture the materials
 * sample by world position. It multiplies ONLY the indirect terms, so direct
 * light and its shadows are untouched.
 *
 * WHY A 2D ATLAS AND NOT A 3D TEXTURE
 *
 * `sampler3D` requires GLSL ES 3.00. three compiles MeshStandardMaterial as GLSL
 * ES 1.00 even on WebGL2, so a 3D sampler injected into it will not compile. The
 * volume is therefore laid out as Y-slices tiled into one 2D texture, with
 * manual interpolation between the two nearest slices and a half-texel inset so
 * hardware bilinear filtering cannot bleed across a tile boundary.
 *
 * WHY THE RESOLUTION IS DRIVEN BY CELL SIZE, NOT CELL COUNT
 *
 * A fixed grid is the wrong knob. The Annex's zones run from a 12 m safe room to
 * a 48 m cistern, and a fixed 64³ would give the cistern 0.75 m cells and the
 * Intake nearly 2 m ones — at which point a wall/floor junction is a single cell
 * and the blur smears it into a metre-scale gradient that reads as a lighting
 * mistake rather than a corner. What has to stay constant across zones is the
 * world-space distance over which the darkening falls off, so the target cell
 * size is the parameter and the grid dimensions follow from the zone's size.
 */

/** Direction set for the openness measurement — a rough sphere, cosine-ish. */
const DIRS = (() => {
  const d = [];
  // Golden-spiral points give a much more even sphere than a lat/long grid, and
  // evenness matters more than count here: an uneven set makes the AO field
  // anisotropic and you see it as directional streaking across a flat floor.
  const N = 32;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.39996323;
    d.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return d;
})();

/**
 * Ray reach, in METRES, and how many samples along it.
 *
 * This has to be metric rather than a cell count. With a cell count the effect's
 * radius scales with the grid resolution, so the low tier's coarse grid produced
 * a wide soft gradient and the high tier's fine grid produced a tight rim — the
 * same room lit differently at different quality settings — and worse, at fine
 * resolutions the reach shrank below the distance at which a wall should start
 * to matter, so a corner 55 cm from two walls measured as fully open.
 */
const REACH = 3.0;
const STEPS = 8;

export class AOVolume {
  /**
   * @param {object} [opts]
   * @param {number} [opts.cell]     target cell size in metres
   * @param {number} [opts.maxDim]   cap on nx / nz
   * @param {number} [opts.maxY]     cap on ny
   * @param {number} [opts.maxCells] cap on total cells, to bound bake time
   */
  constructor({ cell = 0.5, maxDim = 128, maxY = 32, maxCells = 700000 } = {}) {
    this.cellTarget = cell;
    this.maxDim = maxDim;
    this.maxY = maxY;
    this.maxCells = maxCells;

    this.nx = 0; this.ny = 0; this.nz = 0;
    this.tilesX = 1; this.tilesY = 1;
    this.width = 0; this.height = 0;
    this.data = null;
    this.texture = null;

    this.min = new THREE.Vector3(-1, -1, -1);
    this.size = new THREE.Vector3(2, 2, 2);
    this.built = false;
    this.lastBuildMs = 0;
  }

  /**
   * Choose grid dimensions for `size` and allocate the atlas.
   * Reallocates only when the dimensions actually change, so rebuilding the
   * same zone reuses the GPU texture.
   */
  _fit(size) {
    let cell = this.cellTarget;
    const dim = (extent) => Math.max(4, Math.min(this.maxDim, Math.round(extent / cell)));
    let nx = dim(size.x), nz = dim(size.z);
    let ny = Math.max(4, Math.min(this.maxY, Math.round(size.y / cell)));
    // Bake cost is linear in cell count; if the zone is large enough that the
    // target cell size blows the budget, coarsen uniformly rather than letting
    // one axis clamp and skew the field.
    while (nx * ny * nz > this.maxCells && cell < 4) {
      cell *= 1.15;
      nx = dim(size.x); nz = dim(size.z);
      ny = Math.max(4, Math.min(this.maxY, Math.round(size.y / cell)));
    }
    this.cell = cell;

    if (nx === this.nx && ny === this.ny && nz === this.nz && this.texture) return;
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.tilesX = Math.ceil(Math.sqrt(ny));
    this.tilesY = Math.ceil(ny / this.tilesX);
    this.width = nx * this.tilesX;
    this.height = nz * this.tilesY;

    this.texture?.dispose();
    // Single channel would be the honest choice, but LuminanceFormat is gone in
    // WebGL2-only three and R8 needs an internalFormat dance; 4 bytes a cell on
    // a sub-megapixel atlas is not worth the complexity.
    this.data = new Uint8Array(this.width * this.height * 4).fill(255);
    this.texture = new THREE.DataTexture(
      this.data, this.width, this.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.texture.name = 'ao.volume';
  }

  /**
   * Voxelise `collision` over `box` and bake openness.
   * @param {import('../player/Physics.js').CollisionWorld} collision
   * @param {THREE.Box3} box world-space bounds of the zone
   */
  build(collision, box) {
    const t0 = performance.now();

    // Pad the volume so geometry at the very edge still has neighbours to be
    // occluded by, and so a sample just outside reads open rather than sealed.
    const pad = 1.5;
    this.min.set(box.min.x - pad, box.min.y - pad, box.min.z - pad);
    this.size.set(
      (box.max.x - box.min.x) + pad * 2,
      (box.max.y - box.min.y) + pad * 2,
      (box.max.z - box.min.z) + pad * 2);

    this._fit(this.size);
    const { nx, ny, nz } = this;
    const cw = this.size.x / nx, ch = this.size.y / ny, cd = this.size.z / nz;
    const maxX = this.min.x + this.size.x;
    const maxY = this.min.y + this.size.y;
    const maxZ = this.min.z + this.size.z;

    // ---- 1. occupancy -----------------------------------------------------
    const occ = new Uint8Array(nx * ny * nz);
    const idx = (x, y, z) => (y * nz + z) * nx + x;

    /** Fill an axis-aligned world-space span. Returns false if it missed. */
    const fill = (bx0, by0, bz0, bx1, by1, bz1) => {
      // One collision world holds every resident zone, and zones sit 400 m
      // apart. Without this test a box from another zone clamps to the full
      // index range on all three axes and fills the entire grid solid.
      if (bx1 <= this.min.x || bx0 >= maxX) return false;
      if (by1 <= this.min.y || by0 >= maxY) return false;
      if (bz1 <= this.min.z || bz0 >= maxZ) return false;
      const x0 = Math.max(0, Math.floor((bx0 - this.min.x) / cw));
      const x1 = Math.min(nx - 1, Math.ceil((bx1 - this.min.x) / cw) - 1);
      const y0 = Math.max(0, Math.floor((by0 - this.min.y) / ch));
      const y1 = Math.min(ny - 1, Math.ceil((by1 - this.min.y) / ch) - 1);
      const z0 = Math.max(0, Math.floor((bz0 - this.min.z) / cd));
      const z1 = Math.min(nz - 1, Math.ceil((bz1 - this.min.z) / cd) - 1);
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          const row = (y * nz + z) * nx;
          for (let x = x0; x <= x1; x++) occ[row + x] = 1;
        }
      }
      return true;
    };

    for (const b of collision.boxes) {
      if (!b.enabled || !b.blocksSight) continue;
      // Ceiling colliders ARE included. They sit *above* the ceiling plane —
      // a 0.6 m slab whose underside is the tile line — so treating them as
      // solid does not seal the room, it gives the room a lid, which is what
      // makes a wall/ceiling junction darken. Leaving them out was why the
      // tops of walls stayed as bright as their middles.
      fill(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
    }

    // Floors are registered as walkable RECTANGLES, not boxes — the physics
    // only needs a height to stand on. Without voxelising them the volume has
    // no ground at all: nothing occludes from below, so the skirting line and
    // the base of every column measured as open air and stayed flat.
    for (const f of collision.floors || []) {
      if (f.enabled === false) continue;
      fill(f.minX, f.y - 0.35, f.minZ, f.maxX, f.y, f.maxZ);
    }

    // ---- 2. openness ------------------------------------------------------
    // March each direction a few cells; the first hit stops that ray. Weighting
    // by 1/step means a wall 40 cm away matters far more than one 3 m away,
    // which is what makes creases read rather than whole rooms dimming.
    //
    // The step offsets are rounded to integers ONCE, up front. Doing it in the
    // inner loop costs ~30 million Math.round calls on a large zone and was
    // most of the bake time.
    const stepW = [];
    let perDir = 0;
    for (let s = 1; s <= STEPS; s++) { const w = 1 / s; stepW.push(w); perDir += w; }
    // Step length in metres, converted to cell offsets per axis. Doing it per
    // axis is also what makes a non-cubic cell behave: ny is capped, so tall
    // zones get cells much taller than they are wide, and a ray marched in cell
    // units would be skewed towards the vertical in exactly those zones.
    const stepLen = REACH / STEPS;
    const rays = new Int32Array(DIRS.length * STEPS * 3);
    for (let d = 0; d < DIRS.length; d++) {
      const dir = DIRS[d];
      for (let s = 1; s <= STEPS; s++) {
        const o = (d * STEPS + (s - 1)) * 3;
        const m = s * stepLen;
        rays[o] = Math.round((dir[0] * m) / cw);
        rays[o + 1] = Math.round((dir[1] * m) / ch);
        rays[o + 2] = Math.round((dir[2] * m) / cd);
      }
    }
    const norm = 1 / (DIRS.length * perDir);

    const open = new Float32Array(nx * ny * nz);
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        const base = (y * nz + z) * nx;
        for (let x = 0; x < nx; x++) {
          const i = base + x;
          if (occ[i]) { open[i] = 0; continue; }
          let vis = 0;
          for (let d = 0; d < DIRS.length; d++) {
            let o = d * STEPS * 3;
            for (let s = 0; s < STEPS; s++, o += 3) {
              const sx = x + rays[o], sy = y + rays[o + 1], sz = z + rays[o + 2];
              if (sx < 0 || sy < 0 || sz < 0 || sx >= nx || sy >= ny || sz >= nz) {
                // Outside the volume counts as open — a sample near the padded
                // border should not read as sealed in.
                vis += stepW[s];
                continue;
              }
              if (occ[(sy * nz + sz) * nx + sx]) break;
              vis += stepW[s];
            }
          }
          open[i] = vis * norm;
        }
      }
    }

    // ---- 3. blur ----------------------------------------------------------
    // A 3D box blur, run separably. Without it the field is visibly cell-stepped
    // on any large flat surface — the artifact reads as blotches, which is worse
    // than no AO at all. Three passes: one leaves the diagonal of a corner faceted,
    // two still shows low-frequency blotching across a large flat ceiling, and
    // beyond three the creases start to wash out for no further gain.
    let src = open, dst = new Float32Array(open.length);
    for (let pass = 0; pass < 3; pass++) {
      const s = src, d = dst;
      // X
      for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
        const base = (y * nz + z) * nx;
        for (let x = 0; x < nx; x++) {
          const a = s[base + Math.max(0, x - 1)];
          const b = s[base + x];
          const c = s[base + Math.min(nx - 1, x + 1)];
          d[base + x] = (a + b * 2 + c) * 0.25;
        }
      }
      // Z
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        for (let z = 0; z < nz; z++) {
          const a = d[(y * nz + Math.max(0, z - 1)) * nx + x];
          const b = d[(y * nz + z) * nx + x];
          const c = d[(y * nz + Math.min(nz - 1, z + 1)) * nx + x];
          s[(y * nz + z) * nx + x] = (a + b * 2 + c) * 0.25;
        }
      }
      // Y
      for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
        for (let y = 0; y < ny; y++) {
          const a = s[(Math.max(0, y - 1) * nz + z) * nx + x];
          const b = s[(y * nz + z) * nx + x];
          const c = s[(Math.min(ny - 1, y + 1) * nz + z) * nx + x];
          d[(y * nz + z) * nx + x] = (a + b * 2 + c) * 0.25;
        }
      }
      const t = src; src = dst; dst = t;
    }
    // Two swaps per pass in the X/Z stages above write back into `s`, so the
    // final result is whichever buffer the last Y stage wrote — after the swap
    // that is `src`.
    const field = src;

    // ---- 4. normalise -----------------------------------------------------
    // The raw openness of a cell in the middle of a room is nowhere near 1: half
    // its rays point into the floor, and in a 2.8 m-high office plate the other
    // half run into the ceiling well inside the reach. What that baseline value
    // actually IS depends on the room's height, the cell size and the reach, so
    // it cannot be a constant — an earlier hand-tuned 0.52 divisor saturated the
    // entire field to 1.0 at fine cell sizes and the effect vanished.
    //
    // Instead, take a high percentile of the unoccupied cells as "open" and
    // spend the range below it. A percentile rather than the maximum, because
    // the maximum is always some cell out in the padding with nothing around it.
    // The percentile is taken only over cells inside the UNPADDED bounds. The
    // padding shell is open on the outside by construction and reads near 1.0,
    // so including it pulls the reference above anything the room itself
    // contains and dims every surface in the zone by a flat 25%.
    const px = Math.round(pad / cw), py = Math.round(pad / ch), pz = Math.round(pad / cd);
    const hist = new Uint32Array(256);
    let counted = 0;
    for (let y = py; y < ny - py; y++) {
      for (let z = pz; z < nz - pz; z++) {
        const base = (y * nz + z) * nx;
        for (let x = px; x < nx - px; x++) {
          if (occ[base + x]) continue;
          hist[Math.min(255, (field[base + x] * 255) | 0)]++;
          counted++;
        }
      }
    }
    let acc = 0, p90 = 128;
    // p85, not the maximum: the maximum in any zone is whatever cell happens to
    // sit in the largest open span, and mapping that to 1.0 would leave every
    // ordinary corridor permanently dimmed.
    const want = Math.max(1, counted * 0.85);
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= want) { p90 = i; break; }
    }
    // Guard a degenerate bake (an empty or fully-solid volume) from dividing by
    // something near zero and turning the whole zone black.
    const openRef = Math.max(0.08, p90 / 255);
    this.openRef = openRef;

    // ---- 5. pack into the atlas -------------------------------------------
    this.data.fill(255);
    let sum = 0, lo = 1;
    for (let y = 0; y < ny; y++) {
      const tx = (y % this.tilesX) * nx;
      const ty = Math.floor(y / this.tilesX) * nz;
      for (let z = 0; z < nz; z++) {
        const row = ((ty + z) * this.width + tx) * 4;
        for (let x = 0; x < nx; x++) {
          const v = clamp01(field[idx(x, y, z)] / openRef);
          // Gamma < 1 lifts the mid-tones, so the darkening is concentrated in
          // the last few tens of centimetres of a crease rather than being a
          // broad room-wide dimming that the auto-exposure would just undo.
          const shaped = Math.pow(v, 0.75);
          const o = row + x * 4;
          const b = Math.round(shaped * 255);
          this.data[o] = b; this.data[o + 1] = b; this.data[o + 2] = b;
          this.data[o + 3] = 255;
          sum += shaped; if (shaped < lo) lo = shaped;
        }
      }
    }
    this.mean = sum / (nx * ny * nz);
    this.floorValue = lo;
    this.texture.needsUpdate = true;
    this.built = true;
    this.lastBuildMs = performance.now() - t0;
    return this;
  }

  /** Uniform values for the material injection. */
  writeUniforms(u) {
    if (!this.built) return;
    u.uAOAtlas.value = this.texture;
    u.uAOMin.value.copy(this.min);
    u.uAOInvSize.value.set(1 / this.size.x, 1 / this.size.y, 1 / this.size.z);
    u.uAORes.value.set(this.nx, this.ny, this.nz);
    u.uAOTiles.value.set(this.tilesX, this.tilesY);
  }

  stats() {
    return {
      dims: [this.nx, this.ny, this.nz],
      cell: +(this.cell || 0).toFixed(3),
      atlas: [this.width, this.height],
      openRef: +(this.openRef ?? 0).toFixed(3),
      mean: +(this.mean ?? 0).toFixed(3),
      min: +(this.floorValue ?? 0).toFixed(3),
      ms: Math.round(this.lastBuildMs),
    };
  }

  dispose() { this.texture?.dispose(); this.texture = null; this.nx = 0; }
}

/** GLSL for sampling the atlas. Injected into every decorated material. */
export const AO_VOLUME_GLSL = /* glsl */ `
  uniform sampler2D uAOAtlas;
  uniform vec3  uAOMin;
  uniform vec3  uAOInvSize;
  uniform vec3  uAORes;
  uniform vec2  uAOTiles;
  uniform float uAOStrength;
  uniform float uAOFloor;

  float axAOSlice(vec2 cellUV, float slice) {
    float tx = mod(slice, uAOTiles.x);
    float ty = floor(slice / uAOTiles.x);
    return texture2D(uAOAtlas, (vec2(tx, ty) + cellUV) / uAOTiles).r;
  }

  float axAOVolume(vec3 wp) {
    vec3 g = (wp - uAOMin) * uAOInvSize;
    if (g.x < 0.0 || g.y < 0.0 || g.z < 0.0 || g.x > 1.0 || g.y > 1.0 || g.z > 1.0) return 1.0;
    float yf = g.y * (uAORes.y - 1.0);
    float y0 = floor(yf);
    // Half-texel inset: hardware bilinear must not reach into the next tile.
    vec2 cellUV = clamp(vec2(g.x, g.z),
                        vec2(0.5) / uAORes.xz,
                        vec2(1.0) - vec2(0.5) / uAORes.xz);
    float a = axAOSlice(cellUV, y0);
    float b = axAOSlice(cellUV, min(y0 + 1.0, uAORes.y - 1.0));
    return mix(a, b, yf - y0);
  }
`;

/**
 * Injected after <lights_fragment_end>, where `reflectedLight` exists and the
 * direct terms are already accumulated. Indirect only — direct light has real
 * shadow maps and must not be double-darkened.
 */
export const AO_VOLUME_APPLY = /* glsl */ `
  {
    // Offset along the normal by rather more than a cell so a surface does not
    // sample the occupancy of the wall it is part of.
    vec3 aoProbe = vAnnexWorld + normalize(vAnnexNormal) * 0.55;

    // The floor clamp stands in for multi-bounce light, and it is not optional
    // here. This renderer has no GI: "indirect" is a hemisphere constant, so an
    // occlusion term applied to it drives straight towards zero instead of
    // towards the dimmer, redder light that a real crease still receives from
    // three or four bounces off the room. Without the clamp the shaded side of a
    // light pool on the carpet went to solid black — measurably crushed, and one
    // of the specific things this project is not allowed to do.
    float volAO = mix(1.0, max(axAOVolume(aoProbe), uAOFloor), uAOStrength);
    reflectedLight.indirectDiffuse *= volAO;
    // Specular indirect is occluded less on smooth surfaces, where the
    // reflection is a narrow lobe that can still see out of the crease.
    reflectedLight.indirectSpecular *= mix(1.0, volAO, 0.35 + 0.65 * roughnessFactor);
  }
`;

export default AOVolume;
