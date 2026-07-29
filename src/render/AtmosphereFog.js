import * as THREE from 'three';

/**
 * Replaces three's built-in fog with a height-stratified, lightly animated
 * atmosphere shared by every material in the game.
 *
 * Why not FogExp2: flat exponential fog washes tall spaces (the Stack, the
 * Plant) into a uniform milk and destroys the sense of a ceiling. Here density
 * falls off with altitude, so haze pools in corridors and drains out of
 * volumes, and a slow low-frequency term keeps it from reading as a static
 * gradient. A dry/wet weight lets flooded zones swap in a cooler, denser mix
 * without any material rebuilds.
 *
 * This patches THREE.ShaderChunk once at module init, before any material is
 * compiled.
 */

export const fogUniforms = {
  fogColor: { value: new THREE.Color(0x0d0c08) },
  fogColorFar: { value: new THREE.Color(0x161309) },
  fogDensity: { value: 0.021 },
  fogHeightFalloff: { value: 0.115 },
  fogBaseY: { value: -1.2 },
  fogTime: { value: 0 },
  fogNoiseAmt: { value: 0.35 },
  fogMax: { value: 0.965 },
};

let patched = false;

export function installAtmosphereFog() {
  if (patched) return;
  patched = true;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
  #ifdef USE_FOG
    varying vec3 vFogWorldPos;
    uniform vec3  fogColor;
    uniform vec3  fogColorFar;
    uniform float fogDensity;
    uniform float fogHeightFalloff;
    uniform float fogBaseY;
    uniform float fogTime;
    uniform float fogNoiseAmt;
    uniform float fogMax;

    float annexHash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float annexNoise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(annexHash(i + vec3(0,0,0)), annexHash(i + vec3(1,0,0)), f.x),
                     mix(annexHash(i + vec3(0,1,0)), annexHash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(annexHash(i + vec3(0,0,1)), annexHash(i + vec3(1,0,1)), f.x),
                     mix(annexHash(i + vec3(0,1,1)), annexHash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }

    // Analytic integral of exp(-k*(y - baseY)) along the view ray. Gives a
    // stable result at grazing angles where a naive per-fragment evaluation
    // would band badly across a long corridor floor.
    float annexFogAmount(vec3 camPos, vec3 worldPos) {
      vec3 dir = worldPos - camPos;
      float dist = length(dir);
      if (dist < 1e-4) return 0.0;
      dir /= dist;
      float k = fogHeightFalloff;
      float baseDensity = fogDensity * exp(-k * (camPos.y - fogBaseY));
      float ky = k * dir.y * dist;
      float integral = abs(ky) > 1e-4 ? (1.0 - exp(-ky)) / ky : 1.0;
      return baseDensity * dist * integral;
    }
  #endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */ `
  #ifdef USE_FOG
    float fogAmt = annexFogAmount(cameraPosition, vFogWorldPos);

    // Slow drifting inhomogeneity — reads as still air with dust moving in it,
    // not as a shader effect. Amplitude is deliberately small.
    //
    // ONE octave, not two. This runs on every fragment of every surface in the
    // game; the second octave cost as much as the first and was invisible at
    // the amplitude this term is allowed to use.
    if (fogNoiseAmt > 0.001) {
      vec3 np = vFogWorldPos * 0.055 + vec3(fogTime * 0.013, fogTime * 0.006, -fogTime * 0.009);
      fogAmt *= 1.0 + (annexNoise(np) - 0.5) * 2.0 * fogNoiseAmt;
    }

    float f = clamp(1.0 - exp(-fogAmt), 0.0, fogMax);
    // Distant haze picks up a warmer bounce from the fluorescents overhead.
    vec3 fc = mix(fogColor, fogColorFar, clamp(f * 1.35, 0.0, 1.0));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, f);
  #endif`;

  THREE.ShaderChunk.fog_vertex = /* glsl */ `
  #ifdef USE_FOG
    vFogWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`;

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
  #ifdef USE_FOG
    varying vec3 vFogWorldPos;
  #endif`;

  // three still needs a Fog instance on the scene to define USE_FOG and to
  // merge fog uniforms; the built-in values below are overwritten by ours.
  THREE.UniformsLib.fog = Object.assign(THREE.UniformsLib.fog || {}, fogUniforms);
}

/** Blend the atmosphere toward a zone's profile. */
export class AtmosphereController {
  constructor() {
    this.target = {
      color: new THREE.Color(0x0d0c08),
      colorFar: new THREE.Color(0x161309),
      density: 0.021,
      falloff: 0.115,
      baseY: -1.2,
      noise: 0.35,
    };
    this.speed = 1.4;
  }
  set(profile, immediate = false) {
    if (profile.color !== undefined) this.target.color.set(profile.color);
    if (profile.colorFar !== undefined) this.target.colorFar.set(profile.colorFar);
    for (const k of ['density', 'falloff', 'baseY', 'noise']) {
      if (profile[k] !== undefined) this.target[k] = profile[k];
    }
    if (immediate) this.apply(1);
  }
  apply(t) {
    fogUniforms.fogColor.value.lerp(this.target.color, t);
    fogUniforms.fogColorFar.value.lerp(this.target.colorFar, t);
    fogUniforms.fogDensity.value += (this.target.density - fogUniforms.fogDensity.value) * t;
    fogUniforms.fogHeightFalloff.value += (this.target.falloff - fogUniforms.fogHeightFalloff.value) * t;
    fogUniforms.fogBaseY.value += (this.target.baseY - fogUniforms.fogBaseY.value) * t;
    fogUniforms.fogNoiseAmt.value += (this.target.noise - fogUniforms.fogNoiseAmt.value) * t;
  }
  update(dt) {
    fogUniforms.fogTime.value += dt;
    this.apply(1 - Math.exp(-this.speed * dt));
  }
}

/** Named atmosphere profiles, one per zone family. */
export const FOG_PROFILES = {
  intake:    { color: 0x121008, colorFar: 0x241d0c, density: 0.026, falloff: 0.10,  baseY: -1.0, noise: 0.38 },
  service:   { color: 0x0a0b0c, colorFar: 0x14161a, density: 0.030, falloff: 0.09,  baseY: -1.4, noise: 0.30 },
  cistern:   { color: 0x070c0d, colorFar: 0x0d1618, density: 0.055, falloff: 0.22,  baseY:  0.0, noise: 0.55 },
  residence: { color: 0x100d0a, colorFar: 0x1d1710, density: 0.024, falloff: 0.12,  baseY: -1.0, noise: 0.34 },
  plant:     { color: 0x08090b, colorFar: 0x13161c, density: 0.017, falloff: 0.045, baseY: -4.0, noise: 0.42 },
  duct:      { color: 0x0b0a09, colorFar: 0x121110, density: 0.048, falloff: 0.05,  baseY: -1.0, noise: 0.20 },
  stack:     { color: 0x0a0a0c, colorFar: 0x1a1a22, density: 0.013, falloff: 0.022, baseY: -20.0, noise: 0.50 },
  safe:      { color: 0x14100a, colorFar: 0x241b0e, density: 0.020, falloff: 0.14,  baseY: -1.0, noise: 0.25 },
  void:      { color: 0x000000, colorFar: 0x000000, density: 0.20,  falloff: 0.01,  baseY: -1.0, noise: 0.10 },
};
