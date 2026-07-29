import * as THREE from 'three';

/**
 * MaterialLibrary — wraps forged surface sets in MeshStandardMaterials and
 * injects the shader terms that make a tiling texture stop looking tiled.
 *
 * Four injected effects, all driven from world-space position so they are
 * continuous across separate meshes and never swim with the camera:
 *
 *  1. MACRO VARIATION. Two octaves of low-frequency world-space noise modulate
 *     albedo brightness and roughness. This is the single most effective
 *     anti-repetition tool available without unique texturing: a 2 m tile
 *     repeated 20 times down a corridor stops reading as a grid because the
 *     large-scale luminance structure has a much longer period than the tile.
 *
 *  2. GROUNDING DIRT. A world-Y gradient darkens and roughens the bottom of
 *     every vertical surface. Buildings are dirtier where mops, shoes and
 *     damp reach; a wall that is equally clean top to bottom always reads CG.
 *
 *  3. WETNESS. Below a per-zone water line, albedo darkens and roughness
 *     collapses toward a specular sheen. Lets the Cistern flood a corridor
 *     built from the same modules as a dry one.
 *
 *  4. DETAIL NORMAL. The normal map is resampled at high tiling frequency and
 *     UDN-blended over the base, so surfaces keep micro-relief when the player
 *     stands with their face against them.
 */

export const materialGlobals = {
  uTime: { value: 0 },
  uMacroScale: { value: 0.038 },
  uMacroStrength: { value: 0.30 },
  uStochastic: { value: 0.62 },
  uGrimeAmount: { value: 0.5 },
  uWetLine: { value: -999 },
  uWetAmount: { value: 0 },
  uDamage: { value: 0 },
};

const VERT_HEAD = /* glsl */ `
  varying vec3 vAnnexWorld;
  varying vec3 vAnnexNormal;
`;
const VERT_BODY = /* glsl */ `
  vAnnexWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vAnnexNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_HEAD = /* glsl */ `
  varying vec3 vAnnexWorld;
  varying vec3 vAnnexNormal;
  uniform float uStochastic;
  uniform float uTime;
  uniform float uMacroScale;
  uniform float uMacroStrength;
  uniform float uGrimeAmount;
  uniform float uWetLine;
  uniform float uWetAmount;
  uniform float uDamage;
  uniform float uDirtBase;
  uniform float uDirtAmount;
  uniform float uDetailTile;
  uniform float uDetailStrength;
  uniform float uTintAmount;
  uniform vec3  uTintColor;

  float axHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float axNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(axHash(i), axHash(i + vec3(1,0,0)), f.x),
                   mix(axHash(i + vec3(0,1,0)), axHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(axHash(i + vec3(0,0,1)), axHash(i + vec3(1,0,1)), f.x),
                   mix(axHash(i + vec3(0,1,1)), axHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  /**
   * Returns TWO correlated bands from one lattice walk:
   *   .x — a smooth 2-octave macro value
   *   .y — the same field pushed two octaves finer
   * Sharing the first two octaves between both outputs costs one extra noise
   * lookup instead of three, which matters because this runs on every fragment
   * of every surface in the game.
   */
  vec2 axFbm2(vec3 p) {
    float a = axNoise(p);
    float b = axNoise(p * 2.13 + 17.0);
    float c = axNoise(p * 5.90 + 43.0);
    return vec2(a * 0.66 + b * 0.34, b * 0.45 + c * 0.55);
  }
  float axFbm(vec3 p) { return axFbm2(p).x; }
`;

/**
 * Injected after <map_fragment>.
 *
 * Deliberately NOT wrapped in a block: the values computed here (`axM`,
 * `axLeak`, `axVert`) are reused by the roughness injection further down
 * main(). Every one of these terms is an fBm chain, and evaluating the same
 * noise twice per fragment was measurably the most expensive thing in the
 * shader — one evaluation, two consumers.
 */
const FRAG_MAP = /* glsl */ `
  float axVert = 1.0 - abs(vAnnexNormal.y);
  float axUp   = clamp(vAnnexNormal.y, 0.0, 1.0);
  vec2  axN    = axFbm2(vAnnexWorld * uMacroScale);       // .x macro, .y fine
  float axM    = axN.x;

  // LEAK STREAKS on vertical surfaces. Water enters from above and runs down,
  // so the noise is stretched hard in Y and gated by a low-frequency "where is
  // the leak" mask. Biggest single win for making a wall read as a real wall.
  // Leaks only exist on vertical faces, and floors plus ceilings are most of
  // the screen area in a building like this — evaluating the field for them
  // was pure waste. The traffic term below reuses .y, so the branch keeps a
  // cheap fallback rather than skipping outright.
  vec2 axLeakN = vec2(0.0);
  float axLeak = 0.0;
  if (axVert > 0.12 || axUp > 0.12) {
    axLeakN = axFbm2(vAnnexWorld * vec3(0.09, 0.012, 0.09) + 71.0);
    axLeak = smoothstep(0.50, 0.80, axLeakN.x)
           * smoothstep(0.42, 0.88, axLeakN.y)
           * axVert * uGrimeAmount;
  }

  {
    // STOCHASTIC RE-TILING. Blend a second, rotated, differently-scaled tap of
    // the same albedo, weighted by world-space noise. Two taps at an irrational
    // scale ratio push the combined pattern's period far beyond anything
    // visible in one shot, which is what kills the "wallpaper grid" read down a
    // long corridor.
    #ifdef USE_MAP
      if (uStochastic > 0.001) {
        float w = smoothstep(0.36, 0.64, axN.y) * uStochastic;
        const float CA = 0.7648, SA = 0.6442;   // ~40 degrees
        vec2 ruv = vec2(vMapUv.x * CA - vMapUv.y * SA, vMapUv.x * SA + vMapUv.y * CA);
        vec3 s1 = texture2D(map, vMapUv).rgb;
        vec3 s2 = texture2D(map, ruv * 0.6180 + vec2(0.317, 0.771)).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), s2 / max(s1, vec3(1e-3)), w);
      }
    #endif

    // macro luminance + hue drift
    diffuseColor.rgb *= mix(1.0 - uMacroStrength, 1.0 + uMacroStrength * 0.55, axM);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTintColor, uTintAmount);
    diffuseColor.rgb *= 1.0 - smoothstep(0.45, 0.95, axN.y) * 0.26 * uGrimeAmount;

    diffuseColor.rgb *= mix(1.0, 0.46, clamp(axLeak, 0.0, 1.0));

    // TRAFFIC WEAR on horizontal surfaces — long, low-frequency, directional.
    float traffic = smoothstep(0.46, 0.84, axLeakN.y);
    diffuseColor.rgb *= mix(1.0, 0.76, traffic * axUp * uGrimeAmount);

    // grounding dirt at the base of vertical surfaces
    float dirt = 1.0 - smoothstep(uDirtBase, uDirtBase + 1.05, vAnnexWorld.y);
    dirt *= uDirtAmount * (0.45 + 0.55 * axN.y) * axVert;
    diffuseColor.rgb *= mix(1.0, 0.55, clamp(dirt, 0.0, 1.0));

    // damage darkening, used when a zone "turns"
    diffuseColor.rgb *= mix(1.0, 0.35 + 0.25 * axM, uDamage);
  }
`;

const FRAG_ROUGH = /* glsl */ `
  {
    roughnessFactor = clamp(roughnessFactor + (axM - 0.5) * 0.26 * uMacroStrength, 0.035, 1.0);
    float dirtR = 1.0 - smoothstep(uDirtBase, uDirtBase + 1.05, vAnnexWorld.y);
    roughnessFactor = clamp(roughnessFactor + dirtR * uDirtAmount * 0.16 * axVert, 0.035, 1.0);
    // Leaks leave a residue that is glossier than the surrounding dry surface.
    roughnessFactor = mix(roughnessFactor, 0.34, clamp(axLeak, 0.0, 1.0) * 0.7);

    // wetness below the zone water line
    float wet = uWetAmount * (1.0 - smoothstep(uWetLine - 0.04, uWetLine + 0.42, vAnnexWorld.y));
    wet = clamp(wet, 0.0, 1.0);
    roughnessFactor = mix(roughnessFactor, 0.075, wet);
    diffuseColor.rgb *= mix(1.0, 0.42, wet);
  }
`;

const FRAG_DETAIL_NORMAL = /* glsl */ `
  #ifdef USE_NORMALMAP_TANGENTSPACE
    if (uDetailStrength > 0.001) {
      // Fade the detail layer out as soon as it approaches one texel per pixel.
      // Without this it shimmers violently on any surface seen at a grazing
      // angle — a corridor wall is the worst case, and it was producing hard
      // vertical banding down every wall in the build.
      vec2 duv = fwidth(vNormalMapUv * uDetailTile);
      float detailFade = 1.0 - smoothstep(0.0035, 0.020, max(duv.x, duv.y));
      if (detailFade > 0.004) {
        vec3 dN = texture2D(normalMap, vNormalMapUv * uDetailTile).xyz * 2.0 - 1.0;
        dN.xy *= uDetailStrength * detailFade;
        // UDN blend keeps the base map's low-frequency shape intact.
        normal = normalize(tbn * normalize(vec3(mapN.xy + dN.xy, mapN.z * max(dN.z, 0.1))));
      }
    }
  #endif
`;

/** Options accepted by MaterialLibrary.get(). */
const DEFAULTS = {
  repeat: [1, 1],
  color: 0xffffff,
  roughness: 1,
  metalness: 1,
  normalScale: 1,
  aoIntensity: 1,
  envMapIntensity: 0.55,
  dirtBase: -0.4,      // world Y at which grounding dirt reaches full strength
  dirtAmount: 0.55,
  detailTile: 4.0,
  detailStrength: 0.26,
  stochastic: 0.62,
  tint: 0xffffff,
  tintAmount: 0,
  side: THREE.FrontSide,
  transparent: false,
  vertexColors: true,  // procedural geometry bakes corner occlusion into colours
  flatShading: false,
  emissive: 0x000000,
  emissiveIntensity: 1,
  depthWrite: true,
  polygonOffset: 0,
};

export class MaterialLibrary {
  /** @param {import('./TextureForge.js').TextureForge} forge */
  constructor(forge, { envMap = null } = {}) {
    this.forge = forge;
    this.envMap = envMap;
    this.cache = new Map();
    this.all = new Set();
  }

  setEnvMap(env) {
    this.envMap = env;
    for (const m of this.all) { m.envMap = env; m.needsUpdate = true; }
  }

  /**
   * @param {string} surface name registered in the TextureForge
   * @param {object} [opts]
   * @returns {THREE.MeshStandardMaterial}
   */
  get(surface, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const key = surface + '|' + JSON.stringify(o);
    if (this.cache.has(key)) return this.cache.get(key);

    const set = this.forge.get(surface);
    const map = set.map.clone();
    const nrm = set.normalMap.clone();
    const orm = set.ormMap.clone();
    for (const t of [map, nrm, orm]) {
      t.repeat.set(o.repeat[0], o.repeat[1]);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
    }
    map.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap: nrm,
      normalScale: new THREE.Vector2(o.normalScale, o.normalScale),
      roughnessMap: orm,
      metalnessMap: orm,
      aoMap: orm,
      aoMapIntensity: o.aoIntensity,
      color: o.color,
      roughness: o.roughness,
      metalness: o.metalness,
      envMap: this.envMap,
      envMapIntensity: o.envMapIntensity,
      side: o.side,
      transparent: o.transparent,
      vertexColors: o.vertexColors,
      flatShading: o.flatShading,
      emissive: o.emissive,
      emissiveIntensity: o.emissiveIntensity,
      depthWrite: o.depthWrite,
      fog: true,
      dithering: true,
    });
    if (o.polygonOffset) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = o.polygonOffset;
      mat.polygonOffsetUnits = o.polygonOffset;
    }
    mat.name = `${surface}`;

    this.decorate(mat, o);
    this.cache.set(key, mat);
    this.all.add(mat);
    return mat;
  }

  /** Apply the Annex shader injections to any MeshStandardMaterial. */
  decorate(mat, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    mat.userData.annex = true;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, materialGlobals, {
        uDirtBase: { value: o.dirtBase },
        uDirtAmount: { value: o.dirtAmount },
        uDetailTile: { value: o.detailTile },
        uDetailStrength: { value: o.detailStrength },
        uTintColor: { value: new THREE.Color(o.tint) },
        uTintAmount: { value: o.tintAmount },
        uStochastic: { value: o.stochastic },
      });
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', VERT_HEAD + '\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', FRAG_HEAD + '\nvoid main() {')
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_MAP)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FRAG_ROUGH)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_DETAIL_NORMAL);
      mat.userData.shader = shader;
    };
    // Distinct cache key so three does not share a program with an
    // undecorated standard material.
    mat.customProgramCacheKey = () =>
      `annex|${o.dirtBase}|${o.dirtAmount}|${o.detailTile}|${o.detailStrength}|${o.tintAmount}|${o.stochastic}`;
    this.all.add(mat);
    return mat;
  }

  /** Plain emissive material for tubes, signs and screens — no injections. */
  emissive(color, intensity = 1, opts = {}) {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      fog: true,
      toneMapped: true,
      ...opts,
    });
    return m;
  }

  dispose() {
    for (const m of this.all) {
      m.map?.dispose(); m.normalMap?.dispose(); m.roughnessMap?.dispose();
      m.dispose();
    }
    this.all.clear();
    this.cache.clear();
  }
}

/** Advance shared time uniform. Call once per frame. */
export function updateMaterialGlobals(dt) {
  materialGlobals.uTime.value += dt;
}

/** Set the global water line (world Y) and blend amount. */
export function setWetness(line, amount) {
  materialGlobals.uWetLine.value = line;
  materialGlobals.uWetAmount.value = amount;
}

export default MaterialLibrary;
