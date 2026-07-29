import * as THREE from 'three';
import { clamp01, lerp, smoothstep, tileFbm, tileRidge, tileWorley, tileNoise, hash2 } from '../core/util.js';

/**
 * TextureForge — synthesises tiling PBR texture sets on the CPU.
 *
 * The Annex ships no photographic source art, so every surface is authored here
 * as a recipe that fills four parallel float buffers:
 *
 *   height     -> converted to a tangent-space normal map (sobel)
 *   albedo     -> linear RGB, converted to an sRGB DataTexture
 *   roughness  -> packed into the G channel of the ORM map
 *   ao         -> packed into the R channel (cavity/dirt occlusion, not SSAO)
 *
 * Recipes are written as plain per-pixel functions over normalised tile-space
 * UVs. They are slow-ish but run once at load behind the boot sequence, and the
 * results are cached and shared across the whole world.
 *
 * Anti-repetition is *not* solved here — see Materials.js, which layers a
 * world-space macro-variation term over every surface so a 2 m tile never reads
 * as a grid across a 40 m corridor.
 */

const SRGB_TO_LINEAR = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const LINEAR_TO_SRGB = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** Parse '#rrggbb' into a linear-space [r,g,b] triple. */
export function hexLin(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [
    SRGB_TO_LINEAR(((n >> 16) & 255) / 255),
    SRGB_TO_LINEAR(((n >> 8) & 255) / 255),
    SRGB_TO_LINEAR((n & 255) / 255),
  ];
}

const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scaleRgb = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/** A single surface buffer set at a given resolution. */
class Canvas {
  constructor(size) {
    this.size = size;
    const n = size * size;
    this.h = new Float32Array(n);
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.rough = new Float32Array(n).fill(0.8);
    this.ao = new Float32Array(n).fill(1);
    this.metal = new Float32Array(n);
  }
  idx(x, y) {
    const s = this.size;
    return (((y % s) + s) % s) * s + (((x % s) + s) % s);
  }
  set(i, rgb, rough, ao, height, metal = 0) {
    this.r[i] = rgb[0]; this.g[i] = rgb[1]; this.b[i] = rgb[2];
    this.rough[i] = rough; this.ao[i] = ao; this.h[i] = height; this.metal[i] = metal;
  }
}

/** Convert a height field to an RGB tangent-space normal map (DataTexture bytes). */
function heightToNormal(h, size, strength) {
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel gives a smoother gradient than a 2-tap difference and avoids the
      // stair-stepping that shows up badly on near-tangent fluorescent lighting.
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return data;
}

function makeTexture(data, size, { srgb = false, linearFilter = true } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = linearFilter ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Result of forging one surface.
 * @typedef {{map:THREE.Texture, normalMap:THREE.Texture, ormMap:THREE.Texture, size:number}} SurfaceSet
 */

export class TextureForge {
  constructor({ quality = 1 } = {}) {
    this.cache = new Map();
    this.quality = quality;
    this.recipes = new Map();
    this.totalTexels = 0;
    registerRecipes(this);
  }

  define(name, { size = 512, normalStrength = 2.2, fill }) {
    this.recipes.set(name, { size, normalStrength, fill });
  }

  has(name) { return this.recipes.has(name); }
  list() { return [...this.recipes.keys()]; }

  /** Synchronous forge of one named surface (cached). */
  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const recipe = this.recipes.get(name);
    if (!recipe) throw new Error(`TextureForge: unknown surface "${name}"`);
    const size = Math.max(64, Math.round(recipe.size * this.quality));
    const c = new Canvas(size);
    recipe.fill(c, size);

    const albedo = new Uint8Array(size * size * 4);
    const orm = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const j = i * 4;
      albedo[j] = clamp01(LINEAR_TO_SRGB(clamp01(c.r[i]))) * 255;
      albedo[j + 1] = clamp01(LINEAR_TO_SRGB(clamp01(c.g[i]))) * 255;
      albedo[j + 2] = clamp01(LINEAR_TO_SRGB(clamp01(c.b[i]))) * 255;
      albedo[j + 3] = 255;
      orm[j] = clamp01(c.ao[i]) * 255;
      orm[j + 1] = clamp01(c.rough[i]) * 255;
      orm[j + 2] = clamp01(c.metal[i]) * 255;
      orm[j + 3] = 255;
    }
    const set = {
      size,
      map: makeTexture(albedo, size, { srgb: true }),
      normalMap: makeTexture(heightToNormal(c.h, size, recipe.normalStrength), size),
      ormMap: makeTexture(orm, size),
    };
    set.map.name = `${name}.albedo`;
    set.normalMap.name = `${name}.normal`;
    set.ormMap.name = `${name}.orm`;
    this.totalTexels += size * size;
    this.cache.set(name, set);
    return set;
  }

  /** Forge every registered surface, yielding between each so the loader animates. */
  async forgeAll(onProgress) {
    const names = this.list();
    for (let i = 0; i < names.length; i++) {
      this.get(names[i]);
      onProgress?.((i + 1) / names.length, names[i]);
      await new Promise((r) => setTimeout(r, 0));
    }
    return this.cache;
  }

  dispose() {
    for (const s of this.cache.values()) {
      s.map.dispose(); s.normalMap.dispose(); s.ormMap.dispose();
    }
    this.cache.clear();
  }
}

// ===========================================================================
// Surface recipes.
//
// House rules, so the world reads as one building:
//  * Nothing is uniformly grimy. Dirt collects in cavities, at floor lines, and
//    under leaks; it does not wash evenly over a surface.
//  * Roughness carries as much story as albedo — polished traffic paths, greasy
//    handprints around handles, chalky dried-out paint on unused walls.
//  * Every recipe includes at least one low-frequency term so the 2 m tile has
//    internal large-scale structure rather than just high-frequency fizz.
// ===========================================================================

function registerRecipes(forge) {
  const P = 8; // lattice period for tileable noise — noise wraps every P units

  // -- INTAKE: aged vinyl wallcovering ------------------------------------
  // The signature surface. Mustard, but a *dirty printed* mustard: a woven
  // vinyl with a slubbed texture, sun-bleached in bands, blooming with damp
  // near the skirting. Colour drifts green in the shadows, never flat.
  forge.define('wallpaper', {
    size: 512, normalStrength: 1.0,
    fill(c, S) {
      const base = hexLin('#b8973f');
      const warm = hexLin('#cdae55');
      const cool = hexLin('#8d7c40');
      const damp = hexLin('#5f5228');
      const bleach = hexLin('#cfbe80');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Woven slub: fine vertical warp with irregular horizontal weft.
          // The warp frequency is a fixed cycle count, NOT a multiple of the
          // texture size — tying it to S puts the pattern at ~1 texel per cycle
          // at any sane resolution, which aliases into vertical streaks.
          const warp = Math.sin(u * 6.2831853 * 26) * 0.5 + 0.5;
          const weft = tileNoise(u * P * 14, v * P * 4.0, P * 14, 5);
          const slub = tileFbm(u * P * 3, v * P * 3, P * 3, 4, 11);
          let h = warp * 0.045 + weft * 0.14 + slub * 0.30;

          // Mid-frequency print drift only. Anything with a period close to the
          // tile size becomes a visible grid once the tile repeats down a
          // corridor, so the big blotches live in the world-space macro term.
          const drift = tileFbm(u * P * 2.4, v * P * 2.4, P * 2, 3, 3);
          let col = mixRgb(base, warm, drift * 0.7 + 0.15);
          col = mixRgb(col, cool, smoothstep(0.6, 1, 1 - drift) * 0.35);
          col = mixRgb(col, bleach, smoothstep(0.55, 0.95, tileFbm(u * P * 3.1, v * P * 3.1, P * 3, 3, 91)) * 0.12);

          // Fine damp mottling — small enough not to read as a repeating shape.
          const blot = tileFbm(u * P * 5.5 + 4, v * P * 5.5, P * 5, 4, 47);
          const bloom = smoothstep(0.60, 0.85, blot) * 0.5;
          col = mixRgb(col, damp, bloom * 0.30);

          // Scuffs: fine, low-contrast, and NOT strongly axis-aligned.
          const scuff = smoothstep(0.80, 0.97, tileRidge(u * P * 4.5, v * P * 6.5, P * 4, 3, 5));
          col = scaleRgb(col, 1 - scuff * 0.10);
          h -= scuff * 0.14;

          const rough = clamp01(0.68 + slub * 0.12 + bloom * 0.12 + scuff * 0.08);
          const ao = clamp01(1 - bloom * 0.10 - scuff * 0.10 - (1 - weft) * 0.04);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- INTAKE: damp loop-pile carpet ---------------------------------------
  // Commercial loop carpet, ochre flecked with brown and grey. Traffic paths
  // are matted flat (lower height, lower roughness), edges keep their pile.
  forge.define('carpet', {
    size: 512, normalStrength: 1.9,
    fill(c, S) {
      const fibreA = hexLin('#8a6f33');
      const fibreB = hexLin('#5c4a26');
      const fibreC = hexLin('#a58a45');
      const grey = hexLin('#4a453c');
      const wet = hexLin('#2b2415');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Loop pile: worley cells give discrete loops; a fine ridge adds fibre.
          const w = tileWorley(u * P * 30, v * P * 30, P * 30, 17);
          const loop = 1 - clamp01(w.f1 * 1.8);
          const fibre = tileFbm(u * P * 60, v * P * 60, P * 60, 3, 31);
          let h = loop * 0.46 + fibre * 0.14;

          // Fleck colour is per-loop so flecks read as discrete yarns. Kept
          // narrow: a wide spread between adjacent loops reads as gravel rather
          // than as a woven surface once the texture is minified.
          let col = mixRgb(fibreA, fibreB, w.id * 0.55);
          col = mixRgb(col, fibreC, smoothstep(0.78, 1, w.id) * 0.45);
          col = mixRgb(col, grey, smoothstep(0.94, 1, hash2(Math.floor(u * P * 30), Math.floor(v * P * 30))) * 0.35);

          // Mid-frequency matting only; the long traffic paths and soaked
          // patches are applied in world space so they never tile.
          const traffic = smoothstep(0.45, 0.85, tileFbm(u * P * 3.2, v * P * 4.6, P * 3, 3, 61));
          h *= 1 - traffic * 0.26;
          col = scaleRgb(col, 1 - traffic * 0.13);

          const soak = smoothstep(0.58, 0.86, tileFbm(u * P * 4.4 + 9, v * P * 4.4, P * 4, 3, 5));
          col = mixRgb(col, wet, soak * 0.35);

          const rough = clamp01(0.94 - traffic * 0.10 - soak * 0.20 + fibre * 0.05);
          const ao = clamp01(0.58 + loop * 0.42 - soak * 0.10);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Mineral-fibre ceiling tile -----------------------------------------
  forge.define('ceilingTile', {
    size: 512, normalStrength: 2.0,
    fill(c, S) {
      const clean = hexLin('#cdc7b6');
      const aged = hexLin('#a89f89');
      const stain = hexLin('#8c6f42');
      const deep = hexLin('#6a4f2a');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Fissured mineral fibre: directional worms plus pinholes.
          const fis = tileRidge(u * P * 7, v * P * 3.4, P * 7, 4, 3);
          const worm = smoothstep(0.62, 0.95, fis);
          const pin = smoothstep(0.86, 1, tileWorley(u * P * 40, v * P * 40, P * 40, 9).id);
          let h = -worm * 0.55 - pin * 0.35 + tileFbm(u * P * 18, v * P * 18, P * 18, 3, 2) * 0.12;

          let col = mixRgb(clean, aged, tileFbm(u * P * 0.7, v * P * 0.7, P, 4, 55));
          // Water ingress: concentric tide marks, strongest at the core.
          const wn = tileFbm(u * P * 0.9 + 3, v * P * 0.9 + 7, P, 5, 71);
          const wet = smoothstep(0.52, 0.86, wn);
          const edge = smoothstep(0.52, 0.57, wn) * (1 - smoothstep(0.60, 0.68, wn));
          col = mixRgb(col, stain, wet * 0.8);
          col = mixRgb(col, deep, edge * 0.55 + smoothstep(0.80, 0.9, wn) * 0.4);
          col = scaleRgb(col, 1 - worm * 0.18 - pin * 0.25);

          const rough = clamp01(0.93 - wet * 0.12 + worm * 0.05);
          const ao = clamp01(1 - worm * 0.45 - pin * 0.4 - wet * 0.12);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Board-formed service concrete --------------------------------------
  forge.define('concrete', {
    size: 512, normalStrength: 1.7,
    fill(c, S) {
      const grey = hexLin('#6e6a63');
      const pale = hexLin('#8b877e');
      const dark = hexLin('#4b4842');
      const efflor = hexLin('#c3c0b4');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Board-form marks: horizontal plank seams every ~0.2 of the tile.
          const plank = v * 5;
          const seam = 1 - smoothstep(0.0, 0.06, Math.abs(plank - Math.round(plank)));
          const grain = tileFbm(u * P * 4, v * P * 26, P * 4, 4, 13);
          // Exposed aggregate: worley pebbles poking through the skin.
          const agg = tileWorley(u * P * 16, v * P * 16, P * 16, 29);
          const pebble = smoothstep(0.30, 0.06, agg.f1) * smoothstep(0.55, 0.85, agg.id);
          const pit = smoothstep(0.93, 1, tileWorley(u * P * 16, v * P * 16, P * 16, 44).id);

          let h = grain * 0.2 - seam * 0.4 + pebble * 0.28 - pit * 0.38;
          let col = mixRgb(grey, pale, tileFbm(u * P * 0.8, v * P * 0.8, P, 4, 7));
          col = mixRgb(col, dark, smoothstep(0.55, 1, tileFbm(u * P * 1.6, v * P * 1.6, P, 4, 19)) * 0.5);
          col = mixRgb(col, scaleRgb(pale, 1.1), pebble * 0.55);
          col = scaleRgb(col, 1 - seam * 0.25 - pit * 0.4);

          // Efflorescence — mineral salts leaching down from a crack line.
          const leach = smoothstep(0.66, 0.9, tileFbm(u * P * 1.1, v * P * 0.4, P, 5, 101));
          col = mixRgb(col, efflor, leach * 0.5);

          const rough = clamp01(0.86 + grain * 0.1 - leach * 0.05 + pit * 0.08);
          const ao = clamp01(1 - seam * 0.35 - pit * 0.55 - (1 - grain) * 0.06);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Painted concrete masonry unit (institutional) ----------------------
  forge.define('paintedBlock', {
    size: 512, normalStrength: 2.8,
    fill(c, S) {
      const paint = hexLin('#8e9287');
      const paint2 = hexLin('#a3a79a');
      const under = hexLin('#6d6b62');
      const rustLine = hexLin('#7a5b39');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Running-bond block: 4 courses per tile, half-offset each course.
          const course = Math.floor(v * 4);
          const off = (course % 2) * 0.5;
          const bu = (u * 2 + off) % 1;
          const bv = (v * 4) % 1;
          const mortarU = 1 - smoothstep(0.0, 0.035, Math.min(bu, 1 - bu));
          const mortarV = 1 - smoothstep(0.0, 0.06, Math.min(bv, 1 - bv));
          const mortar = Math.max(mortarU, mortarV);

          const pore = tileFbm(u * P * 22, v * P * 22, P * 22, 3, 6);
          const bump = tileFbm(u * P * 6, v * P * 6, P * 6, 3, 66);
          let h = bump * 0.2 + pore * 0.16 - mortar * 0.55;

          let col = mixRgb(paint, paint2, tileFbm(u * P * 0.9, v * P * 0.9, P, 4, 21));
          col = mixRgb(col, scaleRgb(paint, 0.8), mortar * 0.6);
          // Paint chipping reveals grey block; concentrated at block edges.
          const chip = smoothstep(0.78, 0.93, pore) * smoothstep(0.25, 0.6, mortar + bump * 0.4);
          col = mixRgb(col, under, chip);
          h -= chip * 0.2;
          // Rust weep from an embedded fixing.
          const weep = smoothstep(0.80, 0.95, tileFbm(u * P * 1.3, v * P * 0.35, P, 4, 133));
          col = mixRgb(col, rustLine, weep * 0.5);

          const rough = clamp01(0.55 + pore * 0.25 + chip * 0.3 + mortar * 0.2);
          const ao = clamp01(1 - mortar * 0.5 - chip * 0.2 - pore * 0.1);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Institutional vinyl floor tile -------------------------------------
  forge.define('linoleum', {
    size: 512, normalStrength: 1.0,
    fill(c, S) {
      const base = hexLin('#9a978c');
      const fleckA = hexLin('#6e6b62');
      const fleckB = hexLin('#c2bfb2');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const tu = (u * 2) % 1, tv = (v * 2) % 1;
          const seam = Math.max(
            1 - smoothstep(0, 0.012, Math.min(tu, 1 - tu)),
            1 - smoothstep(0, 0.012, Math.min(tv, 1 - tv)));
          // Per-tile hue jitter so the checker never reads as a flat sheet.
          const tid = hash2(Math.floor(u * 2), Math.floor(v * 2));
          const speck = tileWorley(u * P * 34, v * P * 34, P * 34, 12);
          let col = mixRgb(base, fleckA, smoothstep(0.55, 0.9, speck.id) * 0.85);
          col = mixRgb(col, fleckB, smoothstep(0.05, 0.0, speck.f1) * 0.5);
          col = scaleRgb(col, 0.92 + tid * 0.14);
          col = scaleRgb(col, 1 - seam * 0.35);

          // Scuff arcs and a heavy scratched traffic lane.
          const scratch = smoothstep(0.86, 1, tileRidge(u * P * 3, v * P * 20, P * 3, 3, 41));
          const lane = smoothstep(0.5, 0.85, tileFbm(u * P * 0.6, v * P * 1.4, P, 4, 3));
          col = scaleRgb(col, 1 - lane * 0.14);

          const h = -seam * 0.6 + speck.id * 0.05 - scratch * 0.1;
          const rough = clamp01(0.28 + lane * 0.4 + scratch * 0.3 + seam * 0.3);
          const ao = clamp01(1 - seam * 0.4 - lane * 0.08);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Chipped enamel over primer, on plant machinery ---------------------
  forge.define('steelPainted', {
    size: 512, normalStrength: 2.0,
    fill(c, S) {
      const enamel = hexLin('#3f5a52');
      const enamel2 = hexLin('#4d6b61');
      const primer = hexLin('#8a4526');
      const bare = hexLin('#6d6e70');
      const rust = hexLin('#6b3a1c');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const grime = tileFbm(u * P * 1.2, v * P * 1.2, P, 5, 9);
          const flakeN = tileWorley(u * P * 9, v * P * 9, P * 9, 77);
          const flake = smoothstep(0.62, 0.78, flakeN.id) * smoothstep(0.34, 0.1, flakeN.f1);
          const deepFlake = smoothstep(0.80, 0.92, flakeN.id) * smoothstep(0.24, 0.05, flakeN.f1);
          const rustN = smoothstep(0.55, 0.9, tileFbm(u * P * 2.2, v * P * 2.2, P * 2, 4, 88));

          let col = mixRgb(enamel, enamel2, grime);
          col = mixRgb(col, primer, flake * 0.9);
          col = mixRgb(col, bare, deepFlake * 0.85);
          col = mixRgb(col, rust, rustN * flake * 0.8 + rustN * 0.12);
          col = scaleRgb(col, 0.85 + grime * 0.3);

          const h = -flake * 0.25 - deepFlake * 0.3 + tileFbm(u * P * 14, v * P * 14, P * 14, 2, 4) * 0.1;
          const rough = clamp01(0.35 + flake * 0.35 + rustN * 0.3 + grime * 0.1);
          const metal = clamp01(deepFlake * 0.85 - rustN * 0.5);
          const ao = clamp01(1 - flake * 0.25 - deepFlake * 0.3);
          c.set(i, col, rough, ao, h, metal);
        }
      }
    },
  });

  // -- Galvanised sheet, for ductwork -------------------------------------
  forge.define('galvSteel', {
    size: 512, normalStrength: 1.2,
    fill(c, S) {
      const zinc = hexLin('#9aa0a4');
      const zinc2 = hexLin('#787f85');
      const dust = hexLin('#6a655c');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Spangle: large crystalline grains characteristic of hot-dip galv.
          const sp = tileWorley(u * P * 7, v * P * 7, P * 7, 55);
          const grain = sp.id;
          const facet = smoothstep(0.02, 0.25, sp.f2 - sp.f1);
          let col = mixRgb(zinc2, zinc, grain);
          col = scaleRgb(col, 0.9 + facet * 0.18);
          const dirt = smoothstep(0.5, 0.9, tileFbm(u * P * 1.1, v * P * 1.1, P, 5, 34));
          col = mixRgb(col, dust, dirt * 0.45);
          const h = (grain - 0.5) * 0.12 + (1 - facet) * 0.08;
          const rough = clamp01(0.32 + grain * 0.18 + dirt * 0.35);
          c.set(i, col, rough, clamp01(1 - dirt * 0.15), h, clamp01(0.9 - dirt * 0.5));
        }
      }
    },
  });

  // -- Heavy corrosion, for the Cistern -----------------------------------
  forge.define('rustMetal', {
    size: 512, normalStrength: 3.0,
    fill(c, S) {
      const steel = hexLin('#5b5c5e');
      const rust1 = hexLin('#7d4522');
      const rust2 = hexLin('#4a2712');
      const bloom = hexLin('#9c6636');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const big = tileFbm(u * P * 1.0, v * P * 1.0, P, 5, 2);
          const mid = tileFbm(u * P * 4, v * P * 4, P * 4, 4, 22);
          const fine = tileWorley(u * P * 22, v * P * 22, P * 22, 6);
          const scale = smoothstep(0.42, 0.75, big);
          const pit = smoothstep(0.88, 1, fine.id) * scale;

          let col = mixRgb(steel, rust1, scale);
          col = mixRgb(col, rust2, smoothstep(0.55, 0.9, big) * 0.8);
          col = mixRgb(col, bloom, smoothstep(0.6, 0.85, mid) * scale * 0.7);
          const h = scale * 0.35 + mid * 0.2 - pit * 0.8;
          const rough = clamp01(0.42 + scale * 0.5 + pit * 0.1);
          const ao = clamp01(1 - pit * 0.6 - scale * 0.12);
          c.set(i, col, rough, ao, h, clamp01(0.9 - scale * 0.85));
        }
      }
    },
  });

  // -- Old plaster, Residence wing ----------------------------------------
  forge.define('plaster', {
    size: 512, normalStrength: 1.5,
    fill(c, S) {
      const cream = hexLin('#b6ac96');
      const yellowed = hexLin('#9c8c6c');
      const under = hexLin('#8d8578');
      const mould = hexLin('#4b4a3c');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const trowel = tileFbm(u * P * 2.2, v * P * 2.0, P * 2, 4, 12);
          const crack = smoothstep(0.80, 0.97, tileRidge(u * P * 2.2, v * P * 2.2, P * 2, 4, 8));
          const blister = smoothstep(0.72, 0.9, tileFbm(u * P * 3.4, v * P * 3.4, P * 3, 4, 44));

          let col = mixRgb(cream, yellowed, tileFbm(u * P * 0.6, v * P * 0.6, P, 4, 5));
          col = mixRgb(col, under, blister * 0.7);
          col = mixRgb(col, mould, smoothstep(0.68, 0.92, tileFbm(u * P * 1.5, v * P * 1.5, P, 5, 200)) * 0.55);
          col = scaleRgb(col, 1 - crack * 0.35);

          const h = trowel * 0.22 - crack * 0.7 + blister * 0.25;
          const rough = clamp01(0.78 + blister * 0.15 + crack * 0.1);
          const ao = clamp01(1 - crack * 0.55 - blister * 0.18);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Faded damask wallpaper, Residence ----------------------------------
  forge.define('wallpaperResidence', {
    size: 512, normalStrength: 1.6,
    fill(c, S) {
      const ground = hexLin('#7d6b57');
      const ground2 = hexLin('#6a5a48');
      const motif = hexLin('#93805f');
      const peelUnder = hexLin('#a89c8a');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // A damask-ish motif built from mirrored sinusoids — reads as an
          // ornamental repeat without being a recognisable stock pattern.
          const mu = (u * 2) % 1, mv = (v * 2) % 1;
          const sx = Math.abs(mu - 0.5) * 2, sy = Math.abs(mv - 0.5) * 2;
          const lobe = Math.sin((1 - sx) * Math.PI) * Math.sin((1 - sy) * Math.PI);
          const stem = Math.exp(-Math.pow((sx - sy) * 3.2, 2)) * 0.6;
          const orn = clamp01(lobe * 1.15 + stem - 0.28);
          const tex = tileFbm(u * P * 22, v * P * 22, P * 22, 3, 15);

          let col = mixRgb(ground, ground2, tileFbm(u * P * 0.7, v * P * 0.7, P, 4, 9));
          col = mixRgb(col, motif, orn * 0.85);
          // Vertical seams every half tile, lifting at the edges.
          const seam = 1 - smoothstep(0, 0.006, Math.min((u * 2) % 1, 1 - ((u * 2) % 1)));
          const peel = seam * smoothstep(0.45, 0.85, tileFbm(u * P * 0.5, v * P * 2.5, P, 4, 77));
          col = mixRgb(col, peelUnder, peel);
          col = scaleRgb(col, 0.85 + tex * 0.2);

          const h = orn * 0.3 + tex * 0.12 - seam * 0.2 + peel * 0.5;
          const rough = clamp01(0.72 + tex * 0.15 - orn * 0.1);
          const ao = clamp01(1 - seam * 0.3 - (1 - orn) * 0.06);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Painted flush door -------------------------------------------------
  forge.define('doorPaint', {
    size: 256, normalStrength: 1.4,
    fill(c, S) {
      const paint = hexLin('#6d6350');
      const paint2 = hexLin('#7d7360');
      const wood = hexLin('#4a3a26');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const brush = tileFbm(u * P * 3, v * P * 30, P * 3, 3, 18);
          const chip = smoothstep(0.84, 0.96, tileWorley(u * P * 12, v * P * 12, P * 12, 3).id);
          const scuff = smoothstep(0.6, 0.9, tileFbm(u * P * 1.2, v * P * 1.2, P, 4, 5));
          let col = mixRgb(paint, paint2, brush);
          col = mixRgb(col, wood, chip * 0.8);
          col = scaleRgb(col, 1 - scuff * 0.12);
          c.set(i, col, clamp01(0.45 + brush * 0.2 + chip * 0.3 + scuff * 0.15),
            clamp01(1 - chip * 0.35), brush * 0.1 - chip * 0.3);
        }
      }
    },
  });

  // -- Glazed institutional wall tile -------------------------------------
  forge.define('wallTile', {
    size: 512, normalStrength: 3.0,
    fill(c, S) {
      const glaze = hexLin('#b9bcae');
      const glaze2 = hexLin('#a2a598');
      const grout = hexLin('#6e6a5f');
      const groutDirty = hexLin('#4a4436');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const N = 4;
          const tu = (u * N) % 1, tv = (v * N) % 1;
          const gw = 0.045;
          const gu = 1 - smoothstep(gw * 0.5, gw, Math.min(tu, 1 - tu));
          const gv = 1 - smoothstep(gw * 0.5, gw, Math.min(tv, 1 - tv));
          const g = Math.max(gu, gv);
          const tid = hash2(Math.floor(u * N), Math.floor(v * N));
          const dirt = smoothstep(0.4, 0.85, tileFbm(u * P * 1.3, v * P * 1.3, P, 5, 27));

          let col = mixRgb(glaze, glaze2, tid);
          col = scaleRgb(col, 0.94 + tileFbm(u * P * 8, v * P * 8, P * 8, 3, 4) * 0.1);
          const gcol = mixRgb(grout, groutDirty, dirt);
          col = mixRgb(col, gcol, g);
          // Crazing in the glaze on a handful of tiles.
          const craze = tid > 0.82 ? smoothstep(0.88, 0.99, tileRidge(u * P * 9, v * P * 9, P * 9, 3, 61)) : 0;
          col = scaleRgb(col, 1 - craze * 0.2);

          const h = -g * 0.8 - craze * 0.15 + (tid - 0.5) * 0.03;
          const rough = clamp01(0.12 + g * 0.72 + dirt * 0.25 + craze * 0.3);
          const ao = clamp01(1 - g * 0.55 - dirt * 0.1);
          c.set(i, col, rough, ao, h);
        }
      }
    },
  });

  // -- Grated steel walkway / floor plate ---------------------------------
  forge.define('treadPlate', {
    size: 256, normalStrength: 3.2,
    fill(c, S) {
      const steel = hexLin('#57585a');
      const worn = hexLin('#8a8b8d');
      const grime = hexLin('#2e2b26');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          // Classic teardrop pattern approximated by two rotated dash lattices.
          const d1 = Math.abs(((u * 8 + v * 8) % 1) - 0.5);
          const d2 = Math.abs(((u * 8 - v * 8) % 1) - 0.5);
          const seg = Math.floor(v * 8) % 2 === 0 ? d1 : d2;
          const dash = (1 - smoothstep(0.06, 0.16, seg)) *
            (1 - smoothstep(0.30, 0.42, Math.abs(((u * 4) % 1) - 0.5)));
          const dirt = smoothstep(0.42, 0.85, tileFbm(u * P * 1.4, v * P * 1.4, P, 5, 88));
          let col = mixRgb(steel, worn, dash * 0.8);
          col = mixRgb(col, grime, dirt * 0.6);
          const h = dash * 0.9 + tileFbm(u * P * 16, v * P * 16, P * 16, 2, 3) * 0.08;
          c.set(i, col, clamp01(0.36 + dirt * 0.42 - dash * 0.1),
            clamp01(1 - dirt * 0.25 - (1 - dash) * 0.08), h, clamp01(0.85 - dirt * 0.4));
        }
      }
    },
  });

  // -- Paper: notes, signage, tape labels ---------------------------------
  forge.define('paper', {
    size: 256, normalStrength: 0.7,
    fill(c, S) {
      const white = hexLin('#c9c3b1');
      const aged = hexLin('#a89b7e');
      const foxing = hexLin('#7d6642');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const fib = tileFbm(u * P * 40, v * P * 40, P * 40, 3, 11);
          const age = tileFbm(u * P * 0.9, v * P * 0.9, P, 4, 3);
          let col = mixRgb(white, aged, smoothstep(0.35, 0.85, age));
          col = mixRgb(col, foxing, smoothstep(0.80, 0.97, tileFbm(u * P * 3, v * P * 3, P * 3, 4, 91)) * 0.7);
          col = scaleRgb(col, 0.94 + fib * 0.1);
          const crease = smoothstep(0.90, 0.99, tileRidge(u * P * 1.2, v * P * 1.2, P, 3, 5));
          c.set(i, scaleRgb(col, 1 - crease * 0.18), clamp01(0.85 + fib * 0.1),
            clamp01(1 - crease * 0.2), fib * 0.15 - crease * 0.3);
        }
      }
    },
  });

  // -- Acoustic fabric panel (safe rooms, offices) ------------------------
  forge.define('acousticPanel', {
    size: 256, normalStrength: 2.0,
    fill(c, S) {
      const cloth = hexLin('#5c5b52');
      const cloth2 = hexLin('#6d6c61');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const weaveU = Math.sin(u * 6.2831853 * 40) * 0.5 + 0.5;
          const weaveV = Math.sin(v * 6.2831853 * 40) * 0.5 + 0.5;
          const weave = (weaveU + weaveV) * 0.5;
          const nap = tileFbm(u * P * 12, v * P * 12, P * 12, 3, 7);
          const stain = smoothstep(0.6, 0.92, tileFbm(u * P * 1.1, v * P * 1.1, P, 4, 41));
          let col = mixRgb(cloth, cloth2, weave * 0.6 + nap * 0.4);
          col = scaleRgb(col, 1 - stain * 0.25);
          c.set(i, col, clamp01(0.92 + nap * 0.06), clamp01(0.85 + weave * 0.15 - stain * 0.1),
            weave * 0.2 + nap * 0.15);
        }
      }
    },
  });

  // -- Silt / sediment for flooded floors ---------------------------------
  forge.define('silt', {
    size: 512, normalStrength: 2.0,
    fill(c, S) {
      const mud = hexLin('#3a3428');
      const mud2 = hexLin('#4a4334');
      const algae = hexLin('#33402a');
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          const u = x / S, v = y / S;
          const ripple = tileFbm(u * P * 3.4, v * P * 1.1, P * 3, 4, 5);
          const grit = tileWorley(u * P * 30, v * P * 30, P * 30, 19);
          let col = mixRgb(mud, mud2, ripple);
          col = mixRgb(col, algae, smoothstep(0.55, 0.9, tileFbm(u * P * 1.5, v * P * 1.5, P, 4, 63)) * 0.6);
          col = scaleRgb(col, 0.85 + grit.id * 0.25);
          const h = ripple * 0.4 + (1 - clamp01(grit.f1 * 2)) * 0.12;
          c.set(i, col, clamp01(0.7 + ripple * 0.2), clamp01(0.8 + ripple * 0.2), h);
        }
      }
    },
  });
}

export default TextureForge;
