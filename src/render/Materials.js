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
  uMacroScale: { value: 0.055 },
  uMacroStrength: { value: 0.22 },
  uGrimeAmount: { value: 0.5 },
  uWetLine: { value: -999 },
  uWetAmount: { value: 0 },
  uDamage: { value: 0 },
};

const VERT_HEAD = /* glsl */ `
  varying vec3 vAnnexWorld;
`;
const VERT_BODY = /* glsl */ `
  vAnnexWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const FRAG_HEAD = /* glsl */ `
  varying vec3 vAnnexWorld;
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
  float axFbm(vec3 p) {
    return axNoise(p) * 0.58 + axNoise(p * 2.13) * 0.28 + axNoise(p * 4.7) * 0.14;
  }
`;

const FRAG_MAP = /* glsl */ `
  {
    float m  = axFbm(vAnnexWorld * uMacroScale);
    float m2 = axFbm(vAnnexWorld * uMacroScale * 5.7 + 41.0);

    // 1. macro luminance + hue drift
    float lum = mix(1.0 - uMacroStrength, 1.0 + uMacroStrength * 0.55, m);
    diffuseColor.rgb *= lum;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTintColor, uTintAmount);
    // patchy grime, biased dark so it never brightens the surface
    diffuseColor.rgb *= 1.0 - smoothstep(0.45, 0.95, m2) * 0.30 * uGrimeAmount;

    // 2. grounding dirt at the base of vertical surfaces
    float dirt = 1.0 - smoothstep(uDirtBase, uDirtBase + 1.05, vAnnexWorld.y);
    dirt *= uDirtAmount * (0.45 + 0.55 * m2);
    diffuseColor.rgb *= mix(1.0, 0.55, clamp(dirt, 0.0, 1.0));

    // 4. damage darkening, used when a zone "turns"
    diffuseColor.rgb *= mix(1.0, 0.35 + 0.25 * m, uDamage);
  }
`;

const FRAG_ROUGH = /* glsl */ `
  {
    float mr = axFbm(vAnnexWorld * uMacroScale * 1.7 + 7.0);
    roughnessFactor = clamp(roughnessFactor + (mr - 0.5) * 0.26 * uMacroStrength, 0.035, 1.0);
    float dirtR = 1.0 - smoothstep(uDirtBase, uDirtBase + 1.05, vAnnexWorld.y);
    roughnessFactor = clamp(roughnessFactor + dirtR * uDirtAmount * 0.16, 0.035, 1.0);

    // 3. wetness below the zone water line
    float wet = uWetAmount * (1.0 - smoothstep(uWetLine - 0.04, uWetLine + 0.42, vAnnexWorld.y));
    wet = clamp(wet, 0.0, 1.0);
    roughnessFactor = mix(roughnessFactor, 0.075, wet);
    diffuseColor.rgb *= mix(1.0, 0.42, wet);
  }
`;

const FRAG_DETAIL_NORMAL = /* glsl */ `
  #ifdef USE_NORMALMAP_TANGENTSPACE
    if (uDetailStrength > 0.001) {
      vec3 dN = texture2D(normalMap, vNormalMapUv * uDetailTile).xyz * 2.0 - 1.0;
      dN.xy *= uDetailStrength;
      // UDN blend keeps the base map's low-frequency shape intact.
      normal = normalize(tbn * normalize(vec3(mapN.xy + dN.xy, mapN.z * max(dN.z, 0.1))));
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
  detailTile: 7.0,
  detailStrength: 0.35,
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
      `annex|${o.dirtBase}|${o.dirtAmount}|${o.detailTile}|${o.detailStrength}|${o.tintAmount}`;
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
