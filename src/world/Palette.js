import * as THREE from 'three';

/**
 * Palette — the single source of truth for every material in the Annex.
 *
 * Builders never construct materials directly; they ask for a palette key.
 * That keeps texel density, grime weighting and reflectivity consistent across
 * zones authored by different hands, and means one edit here re-grades the
 * whole building.
 *
 * Naming: <surface><Variant>. The key is what a set dresser would say out
 * loud — "wallpaper", "carpetWet", "concreteWall" — not a texture filename.
 */

export function buildPalette(materials) {
  const M = (surface, opts) => () => materials.get(surface, opts);

  return {
    // ---- Intake: the office maze ----------------------------------------
    wallpaper: M('wallpaper', {
      repeat: [0.5, 0.5], roughness: 1, metalness: 0, dirtBase: -0.15, dirtAmount: 0.75,
      detailTile: 6, detailStrength: 0.42, normalScale: 0.9, envMapIntensity: 0.28,
    }),
    wallpaperLit: M('wallpaper', {
      repeat: [0.5, 0.5], roughness: 1, metalness: 0, dirtBase: -0.3, dirtAmount: 0.45,
      detailTile: 6, detailStrength: 0.42, normalScale: 0.9, envMapIntensity: 0.34,
    }),
    carpet: M('carpet', {
      repeat: [0.5, 0.5], roughness: 1, metalness: 0, dirtAmount: 0.25, dirtBase: -2,
      detailTile: 5, detailStrength: 0.55, normalScale: 1.35, envMapIntensity: 0.10,
    }),
    carpetWet: M('carpet', {
      repeat: [0.5, 0.5], roughness: 1, metalness: 0, dirtAmount: 0.6, dirtBase: 0.35,
      detailTile: 5, detailStrength: 0.5, normalScale: 1.2, envMapIntensity: 0.5,
      tint: 0x8a8a92, tintAmount: 0.25,
    }),
    ceilingTile: M('ceilingTile', {
      repeat: [0.82, 0.82], roughness: 1, metalness: 0, dirtAmount: 0, dirtBase: -99,
      detailTile: 4, detailStrength: 0.35, normalScale: 0.75, envMapIntensity: 0.18,
    }),
    plenum: M('concrete', {
      repeat: [0.7, 0.7], roughness: 1, metalness: 0, dirtAmount: 0, dirtBase: -99,
      detailStrength: 0.2, envMapIntensity: 0.04, color: 0x3a3833,
    }),

    // ---- Trim and metalwork ---------------------------------------------
    trim: M('doorPaint', {
      repeat: [1.4, 1.4], roughness: 0.62, metalness: 0, dirtAmount: 0.85, dirtBase: 0.12,
      detailTile: 8, detailStrength: 0.3, envMapIntensity: 0.4,
    }),
    gridMetal: M('galvSteel', {
      repeat: [1.5, 1.5], roughness: 0.55, metalness: 0.85, dirtAmount: 0, dirtBase: -99,
      detailStrength: 0.2, envMapIntensity: 0.7, color: 0xd6d2c4,
    }),
    conduitMetal: M('galvSteel', {
      repeat: [1.2, 1.2], roughness: 0.48, metalness: 0.92, dirtAmount: 0.3, dirtBase: -0.5,
      detailStrength: 0.25, envMapIntensity: 0.9,
    }),
    grilleMetal: M('steelPainted', {
      repeat: [2.4, 2.4], roughness: 0.6, metalness: 0.7, dirtAmount: 0.5, dirtBase: -0.2,
      detailStrength: 0.3, envMapIntensity: 0.6, color: 0xa9a89e,
    }),
    chrome: M('galvSteel', {
      repeat: [3, 3], roughness: 0.24, metalness: 1, dirtAmount: 0.2, dirtBase: -1,
      detailStrength: 0.15, envMapIntensity: 1.25,
    }),
    plasticWhite: M('doorPaint', {
      repeat: [3, 3], roughness: 0.42, metalness: 0, dirtAmount: 0.4, dirtBase: -0.5,
      detailStrength: 0.2, envMapIntensity: 0.55, color: 0xd8d4c6,
    }),
    signPlate: M('doorPaint', {
      repeat: [2, 2], roughness: 0.35, metalness: 0.1, dirtAmount: 0.3, dirtBase: -1,
      detailStrength: 0.15, envMapIntensity: 0.7, color: 0x9aa2a6,
    }),

    // ---- Service spine ---------------------------------------------------
    concreteWall: M('concrete', {
      repeat: [0.42, 0.42], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.8,
      detailTile: 5, detailStrength: 0.45, normalScale: 1.1, envMapIntensity: 0.2,
    }),
    concreteFloor: M('concrete', {
      repeat: [0.5, 0.5], roughness: 1, metalness: 0, dirtAmount: 0.35, dirtBase: -3,
      detailTile: 4, detailStrength: 0.4, normalScale: 0.9, envMapIntensity: 0.22,
      tint: 0x9a978d, tintAmount: 0.3,
    }),
    blockWall: M('paintedBlock', {
      repeat: [0.34, 0.34], roughness: 1, metalness: 0, dirtBase: -0.05, dirtAmount: 0.8,
      detailTile: 5, detailStrength: 0.4, normalScale: 1.15, envMapIntensity: 0.25,
    }),
    linoFloor: M('linoleum', {
      repeat: [0.55, 0.55], roughness: 1, metalness: 0, dirtAmount: 0.4, dirtBase: -3,
      detailTile: 4, detailStrength: 0.3, normalScale: 0.55, envMapIntensity: 0.55,
    }),
    tileWall: M('wallTile', {
      repeat: [0.62, 0.62], roughness: 1, metalness: 0, dirtBase: -0.05, dirtAmount: 0.7,
      detailTile: 4, detailStrength: 0.35, normalScale: 1.0, envMapIntensity: 0.85,
    }),

    // ---- Cistern ---------------------------------------------------------
    rust: M('rustMetal', {
      repeat: [0.7, 0.7], roughness: 1, metalness: 1, dirtAmount: 0.5, dirtBase: 0.5,
      detailTile: 4, detailStrength: 0.5, normalScale: 1.4, envMapIntensity: 0.6,
    }),
    silt: M('silt', {
      repeat: [0.5, 0.5], roughness: 1, metalness: 0, dirtAmount: 0, dirtBase: -99,
      detailTile: 4, detailStrength: 0.4, normalScale: 1.1, envMapIntensity: 0.35,
    }),
    tread: M('treadPlate', {
      repeat: [0.9, 0.9], roughness: 1, metalness: 1, dirtAmount: 0.35, dirtBase: -1,
      detailTile: 3, detailStrength: 0.3, normalScale: 1.2, envMapIntensity: 0.8,
    }),

    // ---- Residence -------------------------------------------------------
    plaster: M('plaster', {
      repeat: [0.45, 0.45], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.7,
      detailTile: 5, detailStrength: 0.4, normalScale: 1.0, envMapIntensity: 0.22,
    }),
    damask: M('wallpaperResidence', {
      repeat: [0.42, 0.42], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.65,
      detailTile: 6, detailStrength: 0.35, normalScale: 0.85, envMapIntensity: 0.25,
    }),
    fabric: M('acousticPanel', {
      repeat: [0.9, 0.9], roughness: 1, metalness: 0, dirtAmount: 0.4, dirtBase: -0.3,
      detailTile: 5, detailStrength: 0.4, normalScale: 1.1, envMapIntensity: 0.08,
    }),

    // ---- Plant -----------------------------------------------------------
    machinePaint: M('steelPainted', {
      repeat: [0.75, 0.75], roughness: 1, metalness: 1, dirtAmount: 0.55, dirtBase: -0.2,
      detailTile: 4, detailStrength: 0.4, normalScale: 1.15, envMapIntensity: 0.7,
    }),
    ductMetal: M('galvSteel', {
      repeat: [0.6, 0.6], roughness: 1, metalness: 1, dirtAmount: 0.35, dirtBase: -1,
      detailTile: 4, detailStrength: 0.3, normalScale: 0.9, envMapIntensity: 0.85,
    }),

    // ---- Paper and props -------------------------------------------------
    paper: M('paper', {
      repeat: [1, 1], roughness: 0.92, metalness: 0, dirtAmount: 0.15, dirtBase: -3,
      detailStrength: 0.2, envMapIntensity: 0.2,
    }),

    // ---- Doors -----------------------------------------------------------
    doorFrame: M('doorPaint', {
      repeat: [1.2, 1.2], roughness: 0.62, metalness: 0, dirtAmount: 0.7, dirtBase: 0.05,
      detailTile: 7, detailStrength: 0.32, envMapIntensity: 0.4,
    }),
    doorLeaf: M('doorPaint', {
      repeat: [1.0, 1.5], roughness: 0.58, metalness: 0, dirtAmount: 0.75, dirtBase: 0.05,
      detailTile: 7, detailStrength: 0.36, envMapIntensity: 0.42,
    }),
  };
}

/**
 * Attaches the palette to a Builder so `b.mat(key)` resolves without a factory.
 * Builders written by different authors then share exactly one instance of each
 * material, which keeps the draw-call count down.
 */
export function attachPalette(builder, palette) {
  const original = builder.mat.bind(builder);
  builder.mat = (key, factory) => original(key, factory || palette[key]);
  builder.palette = palette;
  // `add` without a factory needs the palette too.
  const originalAdd = builder.add.bind(builder);
  builder.add = (key, geo, factory) => originalAdd(key, geo, factory || palette[key]);
  return builder;
}

export default buildPalette;
