import * as THREE from 'three';
import { clamp01, lerp, makeRng, hash2 } from '../core/util.js';

/**
 * Water — the Cistern's standing water.
 *
 * There is no render-to-texture reflection and no depth prepass here; both cost
 * more than this project can spend and neither is what makes shallow interior
 * water read. What makes it read is:
 *
 *  1. TWO SCROLLING NORMAL LAYERS at different scales and speeds, cross-faded,
 *     so the surface has both a slow swell and a fine chop and never shows the
 *     period of either.
 *  2. DEPTH ABSORPTION. The bed height is baked per-vertex (`aBed`), so the
 *     shader knows how deep the water is at every point without reading a depth
 *     buffer. Colour is absorbed exponentially with depth — Beer-Lambert with a
 *     per-channel coefficient, so deep water goes green-black and the shallows
 *     stay clear enough to see the silt. Opacity follows depth too, which is
 *     what stops the classic "sheet of blue glass" look.
 *  3. FRESNEL REFLECTION against an analytic interior environment: a warm band
 *     where the ceiling lamps are, a dark band at the horizon, tinted by the
 *     fog colour so the water always belongs to the room it is in. Real lamps
 *     are passed in as point specular highlights, which is the single most
 *     convincing element — a moving glint on water sells it instantly.
 *  4. FOAM / SCUM at wall contact, baked per-vertex (`aShore`) and animated, so
 *     the water meets the walls in a line of dirty froth rather than an
 *     intersection.
 *  5. RIPPLES ON `player:step`. Each footfall injects an expanding ring that
 *     perturbs the normal and fades. Wading is the loudest thing you can do in
 *     this game, and the water is the only thing that tells you so.
 */

const MAX_RIPPLES = 10;
const MAX_LAMPS = 6;

const VERT = /* glsl */`
  attribute float aBed;
  attribute float aShore;
  varying vec3 vWorld;
  varying float vBed;
  varying float vShore;
  varying vec2 vUvW;
  uniform float uTime;
  uniform float uLevel;
  #include <fog_pars_vertex>

  void main() {
    vBed = aBed;
    vShore = aShore;
    vec3 p = position;
    // A very slow swell, killed at the shore so the water does not detach
    // from the walls.
    float swell = sin(p.x * 0.55 + uTime * 0.35) * cos(p.z * 0.47 - uTime * 0.28);
    p.y += swell * 0.010 * smoothstep(0.0, 0.6, aShore);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vUvW = wp.xz;
    vec3 transformed = p;
    #include <fog_vertex>
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  varying float vBed;
  varying float vShore;
  varying vec2 vUvW;

  uniform float uTime;
  uniform float uLevel;
  uniform vec3  uCamPos;
  uniform vec3  uShallow;
  uniform vec3  uDeep;
  uniform vec3  uSkyTint;
  uniform vec3  uHorizon;
  uniform float uAbsorb;
  uniform float uChop;
  uniform float uFoam;
  uniform vec4  uRipples[${MAX_RIPPLES}];   // xz = centre, z = age, w = strength
  uniform vec4  uLamps[${MAX_LAMPS}];       // xyz = position, w = intensity
  uniform vec3  uLampCol[${MAX_LAMPS}];
  #include <fog_pars_fragment>

  float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wh(i), wh(i + vec2(1,0)), f.x), mix(wh(i + vec2(0,1)), wh(i + vec2(1,1)), f.x), f.y);
  }
  float wfbm(vec2 p) {
    return wn(p) * 0.55 + wn(p * 2.07) * 0.27 + wn(p * 4.13) * 0.12 + wn(p * 8.3) * 0.06;
  }

  /** Gradient of the fbm field — used as a normal perturbation. */
  vec2 wgrad(vec2 p, float e) {
    float c = wfbm(p);
    return vec2(wfbm(p + vec2(e, 0.0)) - c, wfbm(p + vec2(0.0, e)) - c) / e;
  }

  void main() {
    vec2 uv = vUvW;
    float t = uTime;

    // --- two scrolling layers -------------------------------------------
    vec2 g1 = wgrad(uv * 1.55 + vec2(t * 0.045, t * 0.031), 0.06);
    vec2 g2 = wgrad(uv * 5.30 - vec2(t * 0.085, t * 0.061), 0.03);
    vec2 slope = g1 * 0.055 + g2 * 0.022;
    slope *= uChop;

    // --- footstep ripples ------------------------------------------------
    float ripple = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      if (r.w <= 0.001) continue;
      float d = length(uv - r.xy);
      float age = r.z;
      float front = age * 1.35;
      float band = exp(-pow((d - front) * 3.4, 2.0));
      float decay = exp(-age * 1.5) * exp(-d * 0.55);
      float w = sin(d * 26.0 - age * 16.0) * band * decay * r.w;
      ripple += w;
      vec2 dir = d > 1e-4 ? (uv - r.xy) / d : vec2(0.0);
      slope += dir * w * 0.28;
    }

    vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 V = normalize(uCamPos - vWorld);

    // --- depth absorption -------------------------------------------------
    float depth = max(uLevel - vBed, 0.0);
    // Path length through the water toward the eye, not just the vertical.
    float cosT = max(abs(V.y), 0.12);
    float path = depth / cosT;
    vec3 absorbCol = exp(-path * uAbsorb * vec3(1.55, 0.85, 0.62));
    vec3 body = mix(uDeep, uShallow, absorbCol.g);

    // --- reflection ---------------------------------------------------------
    vec3 R = reflect(-V, N);
    float up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
    // Analytic interior: dark floorish below, warm lamp band above, horizon
    // in between. Broken up so the reflection is not a clean gradient.
    float band = smoothstep(0.52, 0.92, up);
    vec3 env = mix(uHorizon, uSkyTint, band);
    env *= 0.80 + wfbm(R.xz * 3.0 + t * 0.02) * 0.55;

    float f0 = 0.020;
    float fres = f0 + (1.0 - f0) * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    fres = clamp(fres, 0.0, 1.0);

    // --- lamp specular ------------------------------------------------------
    vec3 spec = vec3(0.0);
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      vec4 L = uLamps[i];
      if (L.w <= 0.001) continue;
      vec3 ld = L.xyz - vWorld;
      float dist = length(ld);
      ld /= max(dist, 1e-3);
      vec3 hv = normalize(ld + V);
      float s = pow(max(dot(N, hv), 0.0), 420.0);
      // A broader, dimmer lobe as well, so the glint has a halo on chop.
      s += pow(max(dot(N, hv), 0.0), 42.0) * 0.10;
      spec += uLampCol[i] * s * L.w / (1.0 + dist * dist * 0.05);
    }

    // --- foam ---------------------------------------------------------------
    float shoreLine = 1.0 - smoothstep(0.0, 0.42, vShore);
    float foamN = wfbm(uv * 7.0 + vec2(t * 0.06, -t * 0.05));
    float foam = smoothstep(0.35, 0.85, shoreLine * (0.55 + foamN * 0.9)) * uFoam;
    // Ripples throw a little scum up too.
    foam += clamp(ripple * 2.4, 0.0, 1.0) * 0.18 * uFoam;
    foam = clamp(foam, 0.0, 1.0);

    vec3 col = mix(body, env, fres * 0.86) + spec;
    col = mix(col, vec3(0.44, 0.44, 0.40), foam * 0.75);

    // Opacity: shallow water is nearly clear, deep water is not.
    float alpha = mix(0.30, 0.965, clamp(path * 1.25, 0.0, 1.0));
    alpha = max(alpha, foam * 0.9);
    alpha = max(alpha, fres * 0.85);

    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }`;

export class WaterSurface {
  /**
   * @param {object} opts
   *   rect  [x0,z0,x1,z1] extent in zone-local space
   *   level water surface Y
   *   bedAt (x,z) -> bed height, used to bake depth and shore
   *   solidAt (x,z) -> true if the point is inside a wall (for the shore term)
   */
  constructor({
    rect, level = 0.55, bedAt = () => 0, solidAt = null, res = 0.55,
    shallow = 0x2c3a34, deep = 0x060c0c, sky = 0x5a4a2c, horizon = 0x101614,
    absorb = 1.35, chop = 1.0, foam = 1.0, origin = [0, 0, 0],
  } = {}) {
    const [x0, z0, x1, z1] = rect;
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const nx = Math.max(2, Math.min(220, Math.round(w / res)));
    const nz = Math.max(2, Math.min(220, Math.round(d / res)));
    const geo = new THREE.PlaneGeometry(w, d, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, level, (z0 + z1) / 2);

    const pos = geo.attributes.position;
    const bed = new Float32Array(pos.count);
    const shore = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), pz = pos.getZ(i);
      bed[i] = bedAt(px, pz);
      shore[i] = solidAt ? shoreDistance(px, pz, solidAt) : 1;
    }
    geo.setAttribute('aBed', new THREE.BufferAttribute(bed, 1));
    geo.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));

    const ripples = [];
    for (let i = 0; i < MAX_RIPPLES; i++) ripples.push(new THREE.Vector4(0, 0, 0, 0));
    const lamps = [];
    const lampCol = [];
    for (let i = 0; i < MAX_LAMPS; i++) { lamps.push(new THREE.Vector4(0, 0, 0, 0)); lampCol.push(new THREE.Color(1, 1, 1)); }

    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uLevel: { value: level },
          uCamPos: { value: new THREE.Vector3() },
          uShallow: { value: new THREE.Color(shallow) },
          uDeep: { value: new THREE.Color(deep) },
          uSkyTint: { value: new THREE.Color(sky) },
          uHorizon: { value: new THREE.Color(horizon) },
          uAbsorb: { value: absorb },
          uChop: { value: chop },
          uFoam: { value: foam },
          uRipples: { value: ripples },
          uLamps: { value: lamps },
          uLampCol: { value: lampCol },
        },
      ]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    // UniformsUtils.merge clones values; re-point our live arrays at the clones.
    this.material.uniforms.uRipples.value = ripples;
    this.material.uniforms.uLamps.value = lamps;
    this.material.uniforms.uLampCol.value = lampCol;
    this.material.uniforms.uCamPos.value = new THREE.Vector3();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.position.set(origin[0], origin[1], origin[2]);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = true;
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;

    this.level = level;
    this._level0 = level;
    this.origin = origin;
    this.rect = rect;
    this._ripples = ripples;
    this._lamps = lamps;
    this._lampCol = lampCol;
    this._next = 0;
    this.time = 0;
    this._rng = makeRng(99);
    this._ambientTimer = 0;
  }

  /** Register up to MAX_LAMPS fixtures whose reflections appear on the water. */
  setLamps(fixtures) {
    this._fixtures = fixtures.slice(0, MAX_LAMPS);
    this._fixtures.forEach((f, i) => {
      const p = f.group.position;
      this._lamps[i].set(p.x - this.origin[0], p.y - this.origin[1], p.z - this.origin[2], 0);
      this._lampCol[i].copy(new THREE.Color(f.def.color));
    });
  }

  /** Inject a ripple at a zone-local x,z. */
  splash(x, z, strength = 1) {
    const r = this._ripples[this._next % MAX_RIPPLES];
    this._next++;
    r.set(x, z, 0, Math.min(1.6, strength));
  }

  /** Wire the player's footsteps to the surface. */
  listen(bus, toLocal) {
    if (!bus) return this;
    this._off = bus.on('player:step', (e) => {
      if (!e?.position) return;
      if ((e.water ?? 0) < 0.02) return;
      const p = toLocal ? toLocal(e.position) : e.position;
      this.splash(p.x ?? p[0], p.z ?? p[2], 0.55 + (e.strength || 6) * 0.055);
    });
    this._offLand = bus.on('player:land', (e) => {
      if (!e) return;
      const p = toLocal ? toLocal(e.position || { x: 0, z: 0 }) : (e.position || { x: 0, z: 0 });
      this.splash(p.x ?? 0, p.z ?? 0, 1.4);
    });
    return this;
  }

  /**
   * Move the water. The shader takes the level as a uniform and computes depth
   * against the baked bed height per vertex, so lowering it shallows the whole
   * surface correctly — the tide-line decals stay where they were, which is
   * exactly right: they are the OLD water line, and now there are two.
   */
  setLevel(y) {
    this.level = y;
    this.material.uniforms.uLevel.value = y;
    // The plane's Y is baked into the geometry at construction, so the mesh has
    // to carry the difference.
    this.mesh.position.y = this.origin[1] + (y - this._level0);
    return this;
  }

  update(dt, camPos) {
    this.time += dt;
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    if (camPos) {
      u.uCamPos.value.set(
        camPos.x - this.origin[0], camPos.y - this.origin[1], camPos.z - this.origin[2]);
    }
    for (const r of this._ripples) {
      if (r.w <= 0.001) continue;
      r.z += dt;
      r.w -= dt * 0.55;
      if (r.w < 0.001 || r.z > 4) r.set(0, 0, 0, 0);
    }
    // Something else is in the water. Occasionally.
    this._ambientTimer -= dt;
    if (this._ambientTimer <= 0) {
      this._ambientTimer = this._rng.range(4, 13);
      const [x0, z0, x1, z1] = this.rect;
      this.splash(this._rng.range(x0, x1), this._rng.range(z0, z1), this._rng.range(0.10, 0.35));
    }
    if (this._fixtures) {
      this._fixtures.forEach((f, i) => { this._lamps[i].w = f.level * 1.6; });
    }
  }

  dispose() {
    this._off?.(); this._offLand?.();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** Distance to the nearest solid, sampled on rings — cheap and good enough. */
function shoreDistance(x, z, solidAt, max = 1.4) {
  if (solidAt(x, z)) return 0;
  for (let r = 0.18; r <= max; r += 0.18) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      if (solidAt(x + Math.cos(ang) * r, z + Math.sin(ang) * r)) return r;
    }
  }
  return max;
}

export default WaterSurface;
