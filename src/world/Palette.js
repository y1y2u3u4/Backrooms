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
      repeat: [1.25, 1.25], roughness: 1, metalness: 0, dirtBase: -0.15, dirtAmount: 0.75,
      detailTile: 3.6, detailStrength: 0.30, normalScale: 1.20, envMapIntensity: 0.28,
    }),
    wallpaperLit: M('wallpaper', {
      repeat: [1.25, 1.25], roughness: 1, metalness: 0, dirtBase: -0.3, dirtAmount: 0.45,
      detailTile: 6, detailStrength: 0.42, normalScale: 0.9, envMapIntensity: 0.34,
    }),
    // Hessian-faced dado lining for the lower wall — see wallRun's `dado`
    // option in Kit.js for why the Intake has one at all.
    //
    // The colour is doing two jobs. It is the institutional deep olive that a
    // 1994 commercial fit-out actually used below the rail, and it is the only
    // COOL, desaturated mass in a zone otherwise made entirely of warm yellows.
    // Before this there was no colour-temperature contrast anywhere within a
    // single Intake frame; a wall that is warm above the rail and cold below it
    // supplies that contrast as a property of the architecture rather than as a
    // grade applied over the top of it.
    dado: M('acousticPanel', {
      repeat: [2.1, 2.1], roughness: 0.94, metalness: 0,
      // CALIBRATION NOTE, because the first attempt at this was a solid black
      // band across every wall in the zone.
      //
      // Five separate multipliers land on this surface — texture albedo, the
      // `color` tint, the grounding-dirt gradient, the vertex shade baked by
      // wallRun, and the baked AO volume — and it is lit almost entirely by
      // bounce because every fixture in the building points straight down onto a
      // wall at a grazing angle. Choosing each multiplier to look "suitably
      // grubby" in isolation multiplied out to about 0.13 of the upper wall,
      // i.e. a void. A dado is a MID-TONE: darker than the wall above it, and
      // that is all. It should read at roughly half the upper wall's value.
      //
      // dirtBase sits at the floor, not at the rail, so the grime is a gradient
      // rising off the skirting the way a real one is, rather than a flat
      // darkening of the whole band.
      dirtBase: 0.02, dirtAmount: 0.42,
      detailTile: 7.5, detailStrength: 0.52, normalScale: 1.30, envMapIntensity: 0.18,
      color: 0xa8b69a, tint: 0x93a2ad, tintAmount: 0.14,
    }),
    carpet: M('carpet', {
      repeat: [1.7, 1.7], roughness: 1, metalness: 0, dirtAmount: 0.25, dirtBase: -2,
      detailTile: 5, detailStrength: 0.55, normalScale: 1.35, envMapIntensity: 0.10,
    }),
    carpetWet: M('carpet', {
      repeat: [1.7, 1.7], roughness: 1, metalness: 0, dirtAmount: 0.6, dirtBase: 0.35,
      detailTile: 5, detailStrength: 0.5, normalScale: 1.2, envMapIntensity: 0.5,
      tint: 0x8a8a92, tintAmount: 0.25,
    }),
    ceilingTile: M('ceilingTile', {
      repeat: [1.35, 1.35], roughness: 1, metalness: 0, dirtAmount: 0, dirtBase: -99,
      detailTile: 4, detailStrength: 0.35, normalScale: 0.75, envMapIntensity: 0.40,
      // Mineral fibre is a cool off-white. Without pulling the warmth back out
      // here it takes the colour of the floor bounce and reads as rust.
      tint: 0xc9d0d8, tintAmount: 0.55,
    }),
    plenum: M('concrete', {
      // A real plenum is a concrete soffit that catches a little of the room
      // light. Too dark and a missing tile reads as a hole in the mesh rather
      // than a void with services in it.
      repeat: [1.5, 1.5], roughness: 1, metalness: 0, dirtAmount: 0, dirtBase: -99,
      detailStrength: 0.25, envMapIntensity: 0.10, color: 0x6a655c,
    }),

    // ---- Trim and metalwork ---------------------------------------------
    trim: M('doorPaint', {
      repeat: [1.4, 1.4], roughness: 0.62, metalness: 0, dirtAmount: 0.85, dirtBase: 0.12,
      detailTile: 8, detailStrength: 0.3, envMapIntensity: 0.4,
    }),
    gridMetal: M('galvSteel', {
      // A ceiling tee is PAINTED steel, not a mirror. At high metalness its
      // downward-facing flange has nothing to reflect but the dark lower band
      // of the IBL, so the whole grid renders as hard black lines across every
      // ceiling in the game. Low metalness lets the bounce fill reach it.
      repeat: [1.5, 1.5], roughness: 0.64, metalness: 0.18, dirtAmount: 0, dirtBase: -99,
      detailStrength: 0.2, envMapIntensity: 0.45, color: 0xe2ded0,
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
      repeat: [1.7, 1.7], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.8,
      detailTile: 5, detailStrength: 0.45, normalScale: 1.1, envMapIntensity: 0.2,
    }),
    concreteFloor: M('concrete', {
      repeat: [2.0, 2.0], roughness: 1, metalness: 0, dirtAmount: 0.35, dirtBase: -3,
      detailTile: 4, detailStrength: 0.4, normalScale: 0.9, envMapIntensity: 0.22,
      tint: 0x9a978d, tintAmount: 0.3,
    }),
    blockWall: M('paintedBlock', {
      repeat: [1.4, 1.4], roughness: 1, metalness: 0, dirtBase: -0.05, dirtAmount: 0.8,
      detailTile: 5, detailStrength: 0.4, normalScale: 1.15, envMapIntensity: 0.25,
    }),
    linoFloor: M('linoleum', {
      repeat: [2.2, 2.2], roughness: 1, metalness: 0, dirtAmount: 0.4, dirtBase: -3,
      detailTile: 4, detailStrength: 0.3, normalScale: 0.55, envMapIntensity: 0.55,
    }),
    tileWall: M('wallTile', {
      repeat: [2.5, 2.5], roughness: 1, metalness: 0, dirtBase: -0.05, dirtAmount: 0.7,
      detailTile: 4, detailStrength: 0.35, normalScale: 1.0, envMapIntensity: 0.85,
    }),

    // ---- Cistern ---------------------------------------------------------
    rust: M('rustMetal', {
      repeat: [1.5, 1.5], roughness: 1, metalness: 1, dirtAmount: 0.5, dirtBase: 0.5,
      detailTile: 4, detailStrength: 0.5, normalScale: 1.4, envMapIntensity: 0.6,
    }),
    silt: M('silt', {
      repeat: [2.0, 2.0], roughness: 1, metalness: 0, dirtAmount: 0, dirtBase: -99,
      detailTile: 4, detailStrength: 0.4, normalScale: 1.1, envMapIntensity: 0.35,
    }),
    tread: M('treadPlate', {
      repeat: [1.8, 1.8], roughness: 1, metalness: 1, dirtAmount: 0.35, dirtBase: -1,
      detailTile: 3, detailStrength: 0.3, normalScale: 1.2, envMapIntensity: 0.8,
    }),

    // ---- Residence -------------------------------------------------------
    plaster: M('plaster', {
      repeat: [1.8, 1.8], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.7,
      detailTile: 5, detailStrength: 0.4, normalScale: 1.0, envMapIntensity: 0.22,
    }),
    damask: M('wallpaperResidence', {
      repeat: [1.7, 1.7], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.65,
      detailTile: 6, detailStrength: 0.35, normalScale: 0.85, envMapIntensity: 0.25,
      // 530 mm drops. This is the one surface in the game with a figurative
      // motif, so it is the one the stochastic re-tile cannot save: the eye
      // recognises the flower as a shape and reads the grid straight through any
      // amount of tonal variation. Hanging it in strips with a per-drop vertical
      // offset is what actually breaks it. See FRAG_MAP in Materials.js.
      rollWidth: 0.53,
    }),
    fabric: M('acousticPanel', {
      repeat: [1.8, 1.8], roughness: 1, metalness: 0, dirtAmount: 0.4, dirtBase: -0.3,
      detailTile: 5, detailStrength: 0.4, normalScale: 1.1, envMapIntensity: 0.08,
    }),

    // ---- Plant -----------------------------------------------------------
    machinePaint: M('steelPainted', {
      repeat: [1.6, 1.6], roughness: 1, metalness: 1, dirtAmount: 0.55, dirtBase: -0.2,
      detailTile: 4, detailStrength: 0.4, normalScale: 1.15, envMapIntensity: 0.7,
    }),
    ductMetal: M('galvSteel', {
      repeat: [1.5, 1.5], roughness: 1, metalness: 1, dirtAmount: 0.35, dirtBase: -1,
      detailTile: 4, detailStrength: 0.3, normalScale: 0.9, envMapIntensity: 0.85,
    }),

    // ---- Paper and props -------------------------------------------------
    paper: M('paper', {
      repeat: [1, 1], roughness: 0.92, metalness: 0, dirtAmount: 0.15, dirtBase: -3,
      detailStrength: 0.2, envMapIntensity: 0.2,
    }),

    // ---- Prop surfaces ---------------------------------------------------
    // Deliberately few. Every extra palette key is another draw call in every
    // chunk that uses it, so props share a small vocabulary of finishes and
    // rely on geometry and vertex shading for their individuality.
    laminate: M('doorPaint', {
      repeat: [1.6, 1.6], roughness: 0.44, metalness: 0, dirtAmount: 0.55, dirtBase: -0.55,
      detailTile: 9, detailStrength: 0.22, envMapIntensity: 0.55, tint: 0xbfa77e, tintAmount: 0.55,
    }),
    woodDark: M('doorPaint', {
      repeat: [1.3, 1.3], roughness: 0.55, metalness: 0, dirtAmount: 0.6, dirtBase: -0.4,
      detailTile: 9, detailStrength: 0.3, envMapIntensity: 0.42, tint: 0x6b4a27, tintAmount: 0.7,
    }),
    cardboard: M('paper', {
      repeat: [1.4, 1.4], roughness: 0.96, metalness: 0, dirtAmount: 0.5, dirtBase: -0.35,
      detailTile: 6, detailStrength: 0.35, normalScale: 1.1, envMapIntensity: 0.12,
      tint: 0xb08a52, tintAmount: 0.85,
    }),
    steelCabinet: M('steelPainted', {
      repeat: [1.5, 1.5], roughness: 0.62, metalness: 0.75, dirtAmount: 0.5, dirtBase: -0.45,
      detailTile: 5, detailStrength: 0.3, envMapIntensity: 0.6, color: 0x8f9187,
    }),
    plasticGrey: M('doorPaint', {
      repeat: [2.4, 2.4], roughness: 0.5, metalness: 0, dirtAmount: 0.45, dirtBase: -0.5,
      detailTile: 8, detailStrength: 0.18, envMapIntensity: 0.6, color: 0x7d7d78,
    }),
    hazardYellow: M('steelPainted', {
      repeat: [2.0, 2.0], roughness: 0.55, metalness: 0.15, dirtAmount: 0.6, dirtBase: -0.3,
      detailTile: 6, detailStrength: 0.25, envMapIntensity: 0.5, color: 0xc9a133,
    }),
    warningRed: M('steelPainted', {
      repeat: [2.0, 2.0], roughness: 0.42, metalness: 0.3, dirtAmount: 0.45, dirtBase: -0.5,
      detailTile: 6, detailStrength: 0.22, envMapIntensity: 0.7, color: 0x8e2a1e,
    }),
    enamel: M('wallTile', {
      repeat: [3.0, 3.0], roughness: 0.22, metalness: 0.05, dirtAmount: 0.45, dirtBase: -0.4,
      detailTile: 5, detailStrength: 0.2, envMapIntensity: 1.0, color: 0xd6d4cb,
    }),
    glassDark: M('doorPaint', {
      repeat: [2, 2], roughness: 0.12, metalness: 0.4, dirtAmount: 0.35, dirtBase: -2,
      detailStrength: 0.08, envMapIntensity: 1.3, color: 0x1b1d1f,
    }),
    rubber: M('acousticPanel', {
      repeat: [2.6, 2.6], roughness: 0.92, metalness: 0, dirtAmount: 0.4, dirtBase: -0.4,
      detailTile: 6, detailStrength: 0.35, envMapIntensity: 0.08, color: 0x2b2b2c,
    }),
    copper: M('rustMetal', {
      repeat: [2.2, 2.2], roughness: 0.44, metalness: 1, dirtAmount: 0.4, dirtBase: -0.6,
      detailTile: 5, detailStrength: 0.28, envMapIntensity: 0.95, tint: 0xb07a4a, tintAmount: 0.65,
    }),
    mattress: M('acousticPanel', {
      repeat: [1.5, 1.5], roughness: 1, metalness: 0, dirtAmount: 0.8, dirtBase: 0.15,
      detailTile: 5, detailStrength: 0.45, normalScale: 1.2, envMapIntensity: 0.06,
      tint: 0xa9a08c, tintAmount: 0.5,
    }),
    carpetRunner: M('carpet', {
      repeat: [2.4, 2.4], roughness: 1, metalness: 0, dirtAmount: 0.55, dirtBase: -1.2,
      detailTile: 5, detailStrength: 0.6, normalScale: 1.4, envMapIntensity: 0.08,
      tint: 0x6b2f2a, tintAmount: 0.6,
    }),
    boardConcrete: M('concrete', {
      repeat: [1.5, 1.5], roughness: 1, metalness: 0, dirtBase: -0.1, dirtAmount: 0.85,
      detailTile: 4, detailStrength: 0.5, normalScale: 1.3, envMapIntensity: 0.16,
      tint: 0x8d8c87, tintAmount: 0.35,
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
