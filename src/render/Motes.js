import * as THREE from 'three';
import { clamp01 } from '../core/util.js';

/**
 * Motes — airborne dust suspended in the air the player is standing in.
 *
 * WHY THIS EXISTS
 *
 * In inspection frames the Annex's rooms read as *empty volumes with surfaces at
 * the far end*. Every real interior photograph of a lit room has something in the
 * air between the camera and the wall, and its absence is one of the reasons a
 * frame reads as computer graphics even when the surfaces themselves are good.
 * The light cones already establish the shape of a beam; this establishes that
 * the beam is passing through something.
 *
 * DESIGN
 *
 * A single `THREE.Points` cloud of a few thousand particles living in a cube
 * that follows the camera, wrapped modulo the cube in the vertex shader so the
 * density around the player is constant and nothing ever spawns or dies. All the
 * motion is a function of `uTime` and a per-point phase, so the CPU cost per
 * frame is a handful of uniform writes regardless of the particle count.
 *
 * Lighting is evaluated per point against the nearest few fixtures. It is
 * deliberately dominated by a strong forward-scattering lobe: a dust mote is
 * overwhelmingly brightest when it sits between the eye and the light, which is
 * why real dust appears as a sudden shimmer when you turn to face a lamp and
 * almost vanishes when you turn away. Getting that anisotropy right matters far
 * more than the particle count — isotropic motes look like falling snow.
 *
 * The cloud renders additively with depth *testing* on and depth *writing* off,
 * so a mote behind a wall is correctly hidden and a mote in front of one never
 * occludes it.
 */

const MAX_LIGHTS = 6;

const VERT = /* glsl */ `
  attribute vec3 aSeed;      // xyz: unit-cube home position
  attribute vec2 aTrait;     // x: size 0..1, y: drift phase

  uniform vec3  uCam;
  uniform float uTime;
  uniform float uExtent;     // side of the wrap cube, metres
  uniform float uPixelScale; // viewport height / (2 tan(fov/2))
  uniform float uSizeScale;
  uniform float uFar;        // distance at which a mote has faded out

  uniform vec3  uLightPos[${MAX_LIGHTS}];
  uniform vec3  uLightCol[${MAX_LIGHTS}];
  uniform float uLightRange[${MAX_LIGHTS}];
  uniform int   uLightCount;

  varying vec3 vTint;

  void main() {
    // ---- position -------------------------------------------------------
    // Home position in the unit cube, drifted, then wrapped into the cube
    // centred on the camera. A mod() of the offset from the camera is what keeps
    // density constant without ever respawning a particle.
    float ph = aTrait.y * 6.2831853;
    vec3 drift = vec3(
      sin(uTime * 0.11 + ph) * 0.42 + uTime * 0.035,
      sin(uTime * 0.073 + ph * 1.7) * 0.30 - uTime * 0.012,
      cos(uTime * 0.094 + ph * 0.6) * 0.42);

    vec3 home = aSeed * uExtent + drift;
    vec3 wp = uCam + mod(home - uCam + uExtent * 0.5, uExtent) - uExtent * 0.5;

    vec4 view = viewMatrix * vec4(wp, 1.0);
    float dist = -view.z;
    gl_Position = projectionMatrix * view;

    // ---- lighting -------------------------------------------------------
    vec3 toEye = normalize(uCam - wp);
    vec3 lit = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uLightCount) break;
      vec3 d = uLightPos[i] - wp;
      float dl = length(d);
      if (dl > uLightRange[i]) continue;
      vec3 L = d / max(dl, 0.001);

      // Inverse-square with a windowed cut-off, matching the practicals.
      float atten = 1.0 / (0.35 + dl * dl * 0.25);
      float window = clamp(1.0 - dl / uLightRange[i], 0.0, 1.0);
      atten *= window * window;

      // The practicals all aim down, so a mote in the beam is BELOW the fixture
      // — which means L, pointing from the mote up to the light, has a positive
      // y. Getting this sign backwards zeroed every mote in every beam and lit
      // only the ones up in the plenum, where nothing can see them.
      float inBeam = clamp(L.y * 1.5 - 0.15, 0.0, 1.0);

      // Forward scatter: brightest when the light is directly behind the mote
      // as seen from the eye. This is the whole effect — a dust cloud you only
      // notice when you turn to face the lamp.
      float fwd = clamp(dot(-L, toEye), 0.0, 1.0);
      // Weighted harder toward the forward lobe than a textbook Mie phase
      // function: in the Plant, motes lit off-axis sit against an unlit roof void
      // with nothing behind them and read as a starfield rather than as dust.
      float phase = 0.22 + 2.9 * pow(fwd, 6.0);

      lit += uLightCol[i] * (atten * inBeam * phase);
    }

    // ---- size and fade --------------------------------------------------
    // Real dust is at or below one pixel. Clamping the low end to just under a
    // pixel and letting brightness carry the rest avoids the flickering that a
    // sub-pixel point primitive produces as it crosses the sample grid.
    float radius = mix(0.0016, 0.0075, aTrait.x);
    gl_PointSize = clamp(radius * uPixelScale / max(dist, 0.05) * uSizeScale, 0.9, 4.5);

    // Fade out with distance so the far end of a long room does not build up a
    // milky haze — that is the fog's job and it is already there.
    float fade = 1.0 - smoothstep(uFar * 0.45, uFar, dist);
    // ...and fade in very close, where a mote 8 cm from the lens would be a
    // huge unfocused blob if it were in focus at all.
    fade *= smoothstep(0.10, 0.45, dist);

    vTint = lit * fade;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uOpacity;
  varying vec3 vTint;

  void main() {
    // Soft round falloff. A hard square point reads as a pixel-art speck.
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    if (r2 > 0.25) discard;
    float a = 1.0 - smoothstep(0.04, 0.25, r2);
    vec3 col = vTint * uOpacity * a;
    if (col.r + col.g + col.b < 0.0006) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Motes {
  /**
   * @param {object} opts
   * @param {number} [opts.count]   particle count
   * @param {number} [opts.extent]  side of the wrap cube in metres
   */
  constructor({ count = 2600, extent = 16, seed = 1 } = {}) {
    this.extent = extent;
    this.count = count;

    const seeds = new Float32Array(count * 3);
    const traits = new Float32Array(count * 2);
    // A plain LCG so the distribution is identical between runs — a mote cloud
    // that reshuffles per launch makes A/B capture comparison useless.
    let s = seed * 1103515245 + 12345;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = rnd();
      seeds[i * 3 + 1] = rnd();
      seeds[i * 3 + 2] = rnd();
      // Bias the size distribution small: a few catchlights among many specks
      // is what a real beam looks like, not a uniform field of equal dots.
      const u = rnd();
      traits[i * 2] = u * u * u;
      traits[i * 2 + 1] = rnd();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geo.setAttribute('aTrait', new THREE.BufferAttribute(traits, 2));
    // A 'position' attribute is required by three's frustum-culling and by the Points
    // renderer's bookkeeping even though the vertex shader ignores it. Culling
    // is disabled below, so a zero-radius sphere is fine.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uExtent: { value: extent },
      uPixelScale: { value: 900 },
      uSizeScale: { value: 1 },
      uFar: { value: extent * 0.75 },
      uOpacity: { value: 1.0 },
      uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
      uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
      uLightRange: { value: new Array(MAX_LIGHTS).fill(1) },
      uLightCount: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      // Additive, so tone mapping must see it before the grade — but three's
      // tone mapping is off (GradePass owns it), so nothing to opt into here.
      fog: false,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;        // after opaque, before the light cones
    this.points.name = 'motes';
    this.points.matrixAutoUpdate = false;

    this.enabled = true;
    this._ranked = [];
  }

  addTo(scene) { scene.add(this.points); return this; }

  /**
   * Per-zone density and tint. The Cistern's air is damp and nearly still, the
   * Plant's is full of what the extraction fans have been circulating for thirty
   * years; the same cloud in both would flatten the difference between them.
   */
  setProfile({ opacity = 1, size = 1, extent = this.extent } = {}) {
    this.uniforms.uOpacity.value = opacity;
    this.uniforms.uSizeScale.value = size;
    if (extent !== this.uniforms.uExtent.value) {
      this.uniforms.uExtent.value = extent;
      this.uniforms.uFar.value = extent * 0.75;
    }
  }

  /** Match the projection so a mote's screen size is physically consistent. */
  resize(camera, viewportHeight) {
    const fov = (camera.fov * Math.PI) / 180;
    this.uniforms.uPixelScale.value = viewportHeight / (2 * Math.tan(fov / 2));
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} camera
   * @param {import('./Lighting.js').LightRig} rig
   */
  update(dt, camera, rig) {
    if (!this.enabled) return;
    this.uniforms.uTime.value += dt;
    this.uniforms.uCam.value.copy(camera.position);

    // Pick the brightest few nearby fixtures. The rig has already ranked the
    // active set by distance, but for motes *brightness at the mote* is what
    // matters, so a dim pendant 2 m away loses to a high-bay 15 m away.
    const cam = camera.position;
    const ranked = this._ranked;
    ranked.length = 0;
    for (const f of rig?.fixtures || []) {
      if (f.level < 0.02 || !f.light.visible) continue;
      const p = f.group.position;
      const d2 = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2;
      const range = f.def.distance;
      if (d2 > range * range) continue;
      ranked.push({ f, score: (f.def.intensity * f.level) / (1 + d2) });
    }
    ranked.sort((a, b) => b.score - a.score);

    const n = Math.min(MAX_LIGHTS, ranked.length);
    for (let i = 0; i < n; i++) {
      const f = ranked[i].f;
      this.uniforms.uLightPos.value[i].copy(f.group.position);
      // Scale the colour by output so a flickering tube's motes flicker with
      // it. The 0.055 factor turns candela into something that reads at the
      // exposure the grade settles on — measured, not guessed: at 0.02 an
      // off-axis mote landed around 0.003 of scene white, which is below what
      // AgX plus an 8-bit output can represent at all.
      this.uniforms.uLightCol.value[i]
        .copy(f.light.color)
        .multiplyScalar(clamp01(f.level) * f.def.intensity * 0.055);
      this.uniforms.uLightRange.value[i] = f.def.distance * 0.8;
    }
    this.uniforms.uLightCount.value = n;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

export default Motes;
