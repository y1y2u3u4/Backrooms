import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, makeRng, smoothstep, wobble } from '../core/util.js';
import { box, merge, xf, worldUV, whiteColors } from './geo.js';

/**
 * Lighting rig.
 *
 * Every practical light in the Annex is a *fixture*: a physical housing, an
 * emissive tube or lamp, a real THREE light, and optionally a volumetric cone.
 * Nothing is lit by an invisible point light with no source in frame — if the
 * player can see light, they can see what is making it.
 *
 * Fixtures belong to circuits. Circuits are switched by breakers, which is both
 * the core traversal puzzle and the reason the world can go dark believably.
 *
 * Shadow casting is budgeted: only the N nearest live fixtures cast, re-sorted
 * a few times a second, with a hysteresis band so a fixture on the boundary
 * does not pop its shadow on and off as the player sways.
 */

export const FIXTURE_TYPES = {
  /**
   * Recessed 1200 mm twin-tube troffer — the Intake signature.
   * Intensities are three's physical candela. A ceiling fixture 2.7 m above the
   * floor needs roughly 30 cd to land a mid-tone on a 0.4-albedo carpet; the
   * whole rig is calibrated from that one number outward.
   */
  troffer: {
    size: [1.20, 0.09, 0.30],
    color: 0xfff0cf, intensity: 31, distance: 17.0, angle: 1.42, penumbra: 0.30,
    tubeColor: 0xfff6e2, tubeIntensity: 1.35, cone: 0.11, hum: 1.0,
  },
  /** Surface-mounted strip light, service corridors. */
  strip: {
    size: [1.55, 0.10, 0.13], mount: 'surface',
    color: 0xe4efff, intensity: 28, distance: 13.0, angle: 1.34, penumbra: 0.88,
    tubeColor: 0xdfeaff, tubeIntensity: 1.25, cone: 0.09, hum: 1.15,
  },
  /** Vapour-tight bulkhead, the Cistern and the Plant. */
  bulkhead: {
    size: [0.34, 0.20, 0.18], mount: 'wall',
    color: 0xffd39a, intensity: 20, distance: 11.0, angle: 1.45, penumbra: 0.7,
    tubeColor: 0xffe3b4, tubeIntensity: 1.15, cone: 0.16, hum: 0.5,
  },
  /** High-bay sodium lamp for the Plant's big volume. */
  highbay: {
    size: [0.62, 0.42, 0.62], mount: 'ceiling',
    color: 0xffb45c, intensity: 340, distance: 46.0, angle: 1.02, penumbra: 0.58,
    tubeColor: 0xffca80, tubeIntensity: 2.2, cone: 0.30, hum: 0.35,
  },
  /** Warm domestic pendant, the Residence and safe rooms. */
  pendant: {
    size: [0.26, 0.30, 0.26], mount: 'ceiling',
    color: 0xffb964, intensity: 17, distance: 9.5, angle: 1.5, penumbra: 0.95,
    tubeColor: 0xffd08a, tubeIntensity: 0.9, cone: 0.07, hum: 0.0,
  },
  /** Battery emergency light — the only thing left when the grid is down. */
  /**
   * Battery emergency light — the only thing left when the grid is down.
   *
   * THE GREEN WAS A FILTER, NOT A LIGHT. At 0x86ffa8 the emitted colour is 53%
   * red against full green, and in a zone running on emergency alone — which is
   * every blackout, and every arrival in the Stack now that a setpiece takes its
   * lighting down — that tints the entire frame. A capture of the Stack gantry
   * came back green from edge to edge, walls, floor, handrail and hazard stripe
   * alike, which reads as a post effect rather than as a lamp somebody bolted to
   * a wall.
   *
   * A real self-contained emergency luminaire is a cool white LED with a green
   * legend beside it; the green belongs to the SIGN, not to the throw. So the
   * cast light moves most of the way to white and the lens keeps its colour —
   * `tubeColor` is what the player looks at and it stays green, so the fitting
   * still reads as emergency lighting at a glance while the room it lights
   * stops being a colour wash.
   */
  emergency: {
    size: [0.22, 0.12, 0.11], mount: 'wall',
    color: 0xd8f4e2, intensity: 9, distance: 8.0, angle: 1.4, penumbra: 0.8,
    tubeColor: 0x9dffbe, tubeIntensity: 0.8, cone: 0.10, hum: 0.0,
  },
};

/** Health states drive a fixture's flicker personality. */
export const HEALTH = { GOOD: 'good', BUZZ: 'buzz', DYING: 'dying', STROBE: 'strobe', DEAD: 'dead' };

const _v = new THREE.Vector3();

export class Fixture {
  constructor(rig, { type = 'troffer', position, rotation = 0, circuit = 'main', health = HEALTH.GOOD, seed = 1, intensityScale = 1, coneScale = 1 }) {
    const def = FIXTURE_TYPES[type];
    this.rig = rig;
    this.type = type;
    this.def = def;
    this.circuit = circuit;
    this.health = health;
    this.seed = seed;
    this.rng = makeRng(seed * 2654435761 >>> 0);
    this.intensityScale = intensityScale;

    this.group = new THREE.Group();
    this.group.position.set(position[0], position[1], position[2]);
    this.group.rotation.y = rotation;

    this.light = new THREE.SpotLight(def.color, 0, def.distance, def.angle, def.penumbra, 2);
    this.light.position.set(0, -0.02, 0);
    this.target = new THREE.Object3D();
    this.target.position.set(0, -3, 0);
    this.group.add(this.light, this.target);
    this.light.target = this.target;
    this.light.castShadow = false;
    // Shadow acne shows up as a field of bright/dark pixels on any surface at a
    // grazing angle to the light — and in a building lit entirely from directly
    // overhead, every wall is at a grazing angle. normalBias has to cover more
    // than one shadow-map texel at the far end of the spot's range.
    this.light.shadow.bias = -0.0035;
    this.light.shadow.normalBias = 0.075;
    this.light.shadow.mapSize.set(rig.shadowMapSize, rig.shadowMapSize);
    this.light.shadow.camera.near = 0.12;
    this.light.shadow.camera.far = def.distance;

    this.tube = null;      // set by the builder that makes the housing
    this.coneMesh = null;
    this.coneScale = coneScale;

    this.on = true;
    this.level = 0;        // current 0..1 output
    this.targetLevel = 1;
    this._phase = this.rng() * 100;
    this._burstT = this.rng.range(2, 14);
    this._burstLen = 0;
    this._dead = health === HEALTH.DEAD;
    this._shadowWanted = false;
    this.distToCam = 1e9;
    /** Estimated irradiance at the camera; the light budget ranks on this. */
    this._importance = 0;
    this.audioNode = null;
  }

  setHealth(h) { this.health = h; this._dead = h === HEALTH.DEAD; }

  /** 0..1 output level for this frame, before circuit power is applied. */
  _flicker(t, dt) {
    if (this._dead) return 0;
    switch (this.health) {
      case HEALTH.GOOD: {
        // Real fluorescents ripple at twice mains frequency. Sampled at 60 Hz
        // that aliases into a slow shimmer, which is exactly the look wanted.
        return 0.985 + 0.015 * Math.sin(t * 12.6 + this._phase);
      }
      case HEALTH.BUZZ: {
        const base = 0.93 + 0.07 * Math.sin(t * 17.3 + this._phase);
        const dip = smoothstep(0.55, 0.9, Math.abs(wobble(t * 0.6, this.seed))) * 0.28;
        return clamp01(base - dip);
      }
      case HEALTH.DYING: {
        // Long healthy stretches punctuated by a hard, ugly restrike burst.
        this._burstT -= dt;
        if (this._burstT <= 0) {
          this._burstLen = this.rng.range(0.12, 0.9);
          this._burstT = this.rng.range(3.5, 17);
        }
        if (this._burstLen > 0) {
          this._burstLen -= dt;
          const f = Math.sin(t * 61 + this._phase) * 0.5 + 0.5;
          const g = Math.sin(t * 23.7 + this._phase * 2) * 0.5 + 0.5;
          return clamp01(f * g * 1.5) * (this.rng() > 0.06 ? 1 : 0.05);
        }
        return 0.86 + 0.06 * Math.sin(t * 9.1 + this._phase);
      }
      case HEALTH.STROBE: {
        const f = Math.sin(t * 8.4 + this._phase);
        return f > 0.35 ? 1 : f > 0.1 ? 0.15 : 0.02;
      }
      default: return 0;
    }
  }

  /**
   * @param {number} t
   * @param {number} dt
   * @param {boolean} powered
   */
  update(t, dt, powered) {
    const raw = powered && this.on ? this._flicker(t, dt) : 0;
    // Fluorescent tubes have thermal inertia: they fall faster than they rise.
    const rate = raw > this.level ? 26 : 34;
    this.level = damp(this.level, raw, rate, dt);

    const lit = this.level * this.intensityScale;
    this.light.intensity = this.def.intensity * lit;
    this.light.visible = lit > 0.004;
    // The emissive source is a slot in the chunk's shared instanced mesh, not a
    // mesh of its own — see render/EmissiveBatch.js.
    if (this.tube) this.tube.setLevel(this.def.tubeIntensity * lit, lit > 0.002);
    if (this.coneMesh) {
      this.coneMesh.material.uniforms.uIntensity.value = lit * this.def.cone * this.coneScale;
      this.coneMesh.visible = lit > 0.02;
    }
    return lit;
  }

  dispose() {
    this.light.dispose();
    this.group.removeFromParent();
  }
}

// ---------------------------------------------------------------------------

const ConeShader = {
  uniforms: {
    uIntensity: { value: 0.5 },
    uColor: { value: new THREE.Color(0xfff0cf) },
    uHeight: { value: 3 },
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    varying vec3 vLocal;
    varying vec3 vNormalW;
    void main() {
      vLocal = position;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uIntensity, uHeight, uTime;
    uniform vec3 uColor, uCameraPos;
    varying vec3 vWorld;
    varying vec3 vLocal;
    varying vec3 vNormalW;

    float h(vec3 p){ p = fract(p*0.1031); p += dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
    float n3(vec3 x){
      vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
    }

    void main() {
      // Density falls off down the cone as the beam spreads.
      float down = clamp(-vLocal.y / uHeight, 0.0, 1.0);
      float a = pow(1.0 - down, 1.9);

      // Optical depth through a beam is greatest along its axis and vanishes at
      // the silhouette, so alpha follows |N.V| — NOT the grazing term you would
      // use for a rim. Getting this backwards turns a soft shaft into a solid
      // white cone, which is exactly what it looked like before this comment.
      vec3 viewDir = normalize(uCameraPos - vWorld);
      float axial = abs(dot(normalize(vNormalW), viewDir));
      a *= pow(axial, 1.5);

      // Slow dust motion through the beam.
      float d = n3(vWorld * 2.4 + vec3(0.0, uTime * 0.06, uTime * 0.028));
      a *= 0.70 + d * 0.60;

      // Fade out near the fixture so the housing is not haloed, and with
      // distance so a corridor of fixtures does not stack into a white wall.
      a *= smoothstep(0.015, 0.30, down);
      float dist = length(uCameraPos - vWorld);
      a *= 1.0 / (1.0 + dist * 0.16);

      gl_FragColor = vec4(uColor * uIntensity * a, 1.0);
    }`,
};

export function makeLightCone(height, radius, color) {
  const g = new THREE.ConeGeometry(radius, height, 20, 4, true);
  g.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(ConeShader.uniforms),
    vertexShader: ConeShader.vertexShader,
    fragmentShader: ConeShader.fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
  });
  mat.uniforms.uColor.value = new THREE.Color(color);
  mat.uniforms.uHeight.value = height;
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 5;
  m.frustumCulled = true;
  return m;
}

// ---------------------------------------------------------------------------

export class LightRig {
  constructor(scene, { maxShadows = 3, shadowMapSize = 1024, maxActiveLights = 12 } = {}) {
    this.scene = scene;
    this.fixtures = [];
    this.circuits = new Map();     // name -> {powered, level}
    this.maxShadows = maxShadows;
    this.shadowMapSize = shadowMapSize;
    this.maxActiveLights = maxActiveLights;
    this.time = 0;
    this._sortTimer = 0;
    this._shadowSet = new Set();
    this._activeSet = null;
    this.cones = [];
    this.enableCones = true;

    this.setCircuit('main', true);
    this.setCircuit('emergency', true);

    // Bounce fill. There is no GI, and a recessed troffer throws nothing at the
    // ceiling it is set into, so without this the entire suspended ceiling —
    // one of the zone's signature surfaces — renders black. The *ground* colour
    // is the bright one because it stands in for light bouncing off the lit
    // floor onto every downward-facing surface.
    this.ambient = new THREE.HemisphereLight(0x201c14, 0x4a3c22, 0.34);
    this.ambientTarget = { sky: new THREE.Color(0x201c14), ground: new THREE.Color(0x453b28), intensity: 0.34 };
    scene.add(this.ambient);
  }

  /**
   * Per-zone bounce fill. Intake is a low-ceilinged room of saturated yellow
   * surfaces lit by dozens of fixtures: in reality it would be flooded with
   * inter-reflected light and have almost no shadows anywhere. With no GI, this
   * is how that gets faked, and it is why Intake can be blindingly bright while
   * the Cistern two doors away is nearly black.
   */
  setAmbient(sky, ground, intensity) {
    this.ambientTarget.sky.set(sky);
    this.ambientTarget.ground.set(ground);
    this.ambientTarget.intensity = intensity;
  }

  /**
   * Per-zone active-light budget. Twelve is right for the corridor zones, but
   * the Plant's whole point is that you can see the whole hall at once, and
   * dropping its two furthest high-bays is what establishes the room's depth.
   * Raising this raises the shader cost for every material in that zone, so it
   * is a per-zone decision, not a global one.
   */
  setLightBudget(n) {
    this.maxActiveLights = Math.max(1, Math.min(24, n | 0));
    this._sortTimer = 0;   // re-rank immediately
  }

  /** Jump the bounce fill to its target — used on a zone change or at boot. */
  snapAmbient() {
    this.ambient.color.copy(this.ambientTarget.sky);
    this.ambient.groundColor.copy(this.ambientTarget.ground);
    this.ambient.intensity = this.ambientTarget.intensity;
  }

  setCircuit(name, powered, { immediate = false } = {}) {
    const existing = this.circuits.get(name);
    // A circuit that is created already powered — which is every circuit a zone
    // builder registers — should start at full, not ramp up from black. The
    // ramp exists for a breaker being thrown, not for a zone being built.
    const c = existing || { powered: false, level: powered ? 1 : 0, target: 0 };
    c.powered = powered;
    c.target = powered ? 1 : 0;
    if (immediate) c.level = c.target;
    this.circuits.set(name, c);
    // Re-rank on the next update so a newly powered circuit's fixtures can
    // claim their place in the active-light budget straight away.
    this._sortTimer = 0;
  }
  isPowered(name) { return this.circuits.get(name)?.powered ?? false; }
  circuitLevel(name) { return this.circuits.get(name)?.level ?? 0; }

  add(opts) {
    const f = new Fixture(this, { ...opts, });
    this.fixtures.push(f);
    this.scene.add(f.group);
    if (!this.circuits.has(f.circuit)) this.setCircuit(f.circuit, true);
    return f;
  }

  remove(f) {
    const i = this.fixtures.indexOf(f);
    if (i >= 0) this.fixtures.splice(i, 1);
    f.dispose();
  }

  clear() {
    for (const f of this.fixtures) f.dispose();
    this.fixtures.length = 0;
    this.cones.length = 0;
  }

  /**
   * Light level reaching a world point. This is the input to the Surveyor's
   * movement rule, so it has to agree with what the player can see: a fixture
   * on the far side of a 160 mm wall must not "light" a room that is visibly
   * dark. Pass `{occlude: true, collision}` to run a segment test against the
   * few fixtures that are actually in range — it is cheap because the range
   * cull rejects almost everything first.
   */
  illuminationAt(x, y, z, { occlude = false, collision = null } = {}) {
    let total = 0;
    for (const f of this.fixtures) {
      if (f.level < 0.02) continue;
      const p = f.group.position;
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
      const range = f.def.distance;
      if (d2 > range * range) continue;
      const atten = clamp01(1 - Math.sqrt(d2) / range);
      // intensityScale has to be in here. Fixture.update applies it to the actual
      // light (`this.level * this.intensityScale`) and this did not, so the two
      // disagreed: raising the Cistern's bulkheads to 3x visibly lifted the frame —
      // crushed pixels 0.911 to 0.842, dynamic range from 0.21 to 0.47 — while this
      // metric reported the illumination unchanged at 1.03. A probe that cannot see
      // a change the renderer can see is worse than no probe, because it reads as
      // evidence that the change did nothing.
      let contribution = f.level * f.intensityScale * atten * atten * (f.def.intensity / 5);
      if (occlude && collision && contribution > 0.02) {
        // Aim slightly below the fixture: the light body itself is a collider
        // in some zones and would occlude its own beam.
        if (collision.segmentBlocked(p.x, p.y - 0.12, p.z, x, y, z, 'ceiling')) continue;
      }
      total += contribution;
    }
    return total;
  }

  /**
   * Mark only the shadow maps whose light could actually see `object`, instead
   * of re-rendering every live shadow map. three has no per-light dirty flag,
   * so this still sets the global `needsUpdate`, but it suppresses the refresh
   * entirely when nothing that casts is anywhere near the mover — which is the
   * common case for a wandering entity in a building this size.
   */
  requestShadowRefresh(object, radius = 2.0) {
    if (!object) { this._shadowDirty = true; return true; }
    const p = object.isVector3 ? object : (object.position || object);
    for (const f of this._shadowSet) {
      const q = f.group.position;
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (d < f.def.distance + radius) { this._shadowDirty = true; return true; }
    }
    return false;
  }

  /** Nearest live fixture, for "run toward the light" behaviours. */
  nearestLit(x, y, z, maxDist = 40) {
    let best = null, bd = maxDist * maxDist;
    for (const f of this.fixtures) {
      if (f.level < 0.15) continue;
      const p = f.group.position;
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = f; }
    }
    return best;
  }

  update(dt, camera, renderer) {
    this.time += dt;
    const t = this.time;

    for (const c of this.circuits.values()) {
      c.level = damp(c.level, c.target, 4.5, dt);
    }
    const k = 1 - Math.exp(-5.0 * dt);
    this.ambient.color.lerp(this.ambientTarget.sky, k);
    this.ambient.groundColor.lerp(this.ambientTarget.ground, k);
    this.ambient.intensity += (this.ambientTarget.intensity - this.ambient.intensity) * k;

    this._sortTimer -= dt;
    const resort = this._sortTimer <= 0 || !this._activeSet;
    if (resort) this._sortTimer = 0.18;

    const camPos = camera.position;
    let shadowChanged = false;

    if (resort) {
      for (const f of this.fixtures) {
        const p = f.group.position;
        f.distToCam = Math.hypot(p.x - camPos.x, p.y - camPos.y, p.z - camPos.z);
        // Estimated irradiance at the camera. `def.intensity` is physical candela
        // and spans 6 (an emergency bulkhead) to 240 (a high bay), so this term
        // dominates distance and is the whole reason for ranking on it.
        const rated = (f.def?.intensity ?? 20) * (f.intensityScale ?? 1);
        const supply = this.circuits.get(f.circuit)?.target ?? 1;
        f._importance = (rated * supply) / (1 + f.distToCam * f.distToCam);
      }
      // Rank by importance among fixtures that are *supposed* to be on.
      //
      // This deliberately tests the circuit's TARGET and the fixture's health,
      // not its instantaneous `level`. Level is a transient: a freshly built
      // zone's fixtures all start at zero and its circuits ramp up over a
      // fraction of a second, so filtering on current brightness selected an
      // empty active set on the first frame after a zone change and then left
      // every light in that zone switched off until the next re-sort. Whole
      // zones rendered unlit.
      const live = this.fixtures
        .filter((f) => {
          if (f._dead || !f.on) return false;
          const c = this.circuits.get(f.circuit);
          return c ? c.target > 0.05 : true;
        })
        .sort((a, b) => b._importance - a._importance);

      // IMPORTANCE-RANKED active set, not distance-ranked.
      //
      // Ranking by distance alone means the nearest lamp always wins, whatever it
      // is worth. A 6 cd emergency bulkhead 2 m away displaced a 240 cd high bay
      // 5 m away, and at the shipping medium tier the budget is ten fixtures, so a
      // handful of dim wall-washes and emergency lamps standing near the player
      // could push most of the real lighting out of the frame. Irradiance falls as
      // 1/d^2 and rated output spans a factor of forty across FIXTURE_TYPES, so
      // distance is the weaker of the two terms by a long way.
      //
      // `_importance` is the estimated irradiance the fixture delivers AT THE
      // CAMERA: rated candela x its own scale x its circuit's level, over
      // (1 + d^2). It is computed in the loop above where the distance already is.
      // This is what makes it safe to put emergency lighting on the escape routes
      // — the lamps that keep a blacked-out zone navigable no longer cost the lit
      // zones their key light.
      this._activeSet = new Set(live.slice(0, this.maxActiveLights));

      const want = new Set(live.slice(0, this.maxShadows));
      // Hysteresis: keep an existing caster while it is still worth more than a
      // little under the cut-off, so shadows do not pop while the player sways.
      // The band is expressed in IMPORTANCE now that the ranking is: reading a
      // distance off `live[maxShadows]` after an importance sort picks an
      // arbitrary fixture's distance and the hysteresis stops meaning anything.
      const cutoff = live[this.maxShadows]?._importance ?? 0;
      for (const f of this._shadowSet) {
        if (!want.has(f) && f.level > 0.05 && f._importance > cutoff * 0.55 && want.size < this.maxShadows + 1) {
          want.add(f);
        }
      }
      for (const f of this.fixtures) {
        const should = want.has(f);
        if (f.light.castShadow !== should) { f.light.castShadow = should; shadowChanged = true; }
      }
      this._shadowSet = want;
    }

    let litCount = 0;
    let tubeCount = 0;
    const active = this._activeSet;
    for (const f of this.fixtures) {
      const power = this.circuitLevel(f.circuit);
      // No distance cull on the emissive sources, deliberately.
      //
      // There used to be one, hiding any source past 40 m, on the theory that
      // 217 independent tube meshes per zone were what pushed the Intake to 221
      // draw calls. Measured, it recovered five: the Intake is a dense 63 x 63 m
      // plate, so nearly everything lit is already inside 40 m. The cost was one
      // mesh per fixture, not distance, and batching them (EmissiveBatch) took
      // the whole zone's sources down to one draw call per fixture type. With
      // that done a distance cull buys nothing and can only break the rule that
      // if the player can see light, they can see what is making it.
      const lit = f.update(t, dt, power > 0.02 ? power : 0);
      if (f.tube?.visible) tubeCount++;
      // Distance is recomputed EVERY frame, not only on the throttled re-sort.
      //
      // The cull below is `distToCam > def.distance * 1.5`, and distToCam used to
      // be written only when the set was re-ranked, a few times a second. That is
      // fine while walking and catastrophic on a teleport: zones sit 400 m apart,
      // so the frame after a portal transition every fixture in the destination
      // still carries its distance from the zone the player just left, reads as
      // unreachably far, and is culled. Measured in a live session as 23 seconds
      // of the Service Spine with 286 fixtures resident and ZERO active — the
      // zone rendered by bounce fill alone.
      //
      // A hypot per fixture per frame is nothing next to what an active light
      // costs the fragment shader; only the SORT needs throttling.
      const fp = f.group.position;
      f.distToCam = Math.hypot(fp.x - camPos.x, fp.y - camPos.y, fp.z - camPos.z);
      // Cull distant lights entirely. three compiles the light count into every
      // material's shader and evaluates every visible light for every fragment,
      // so the *count* dominates the cost far more than each light's range —
      // and a fixture 30 m away contributes less than the bounce fill does.
      const tooFar = f.distToCam > f.def.distance * 1.5;
      if (tooFar || lit < 0.004 || (active && !active.has(f))) {
        f.light.visible = false;
      } else {
        litCount++;
      }
    }
    this.litCount = litCount;
    this.tubeCount = tubeCount;

    if (this.enableCones) {
      for (const f of this.fixtures) {
        if (!f.coneMesh) continue;
        // Cones are pure overdraw; only the near field earns it.
        if (f.distToCam > 26) { f.coneMesh.visible = false; continue; }
        const u = f.coneMesh.material.uniforms;
        u.uTime.value = t;
        u.uCameraPos.value.copy(camPos);
      }
    }

    if (renderer && (shadowChanged || this._shadowDirty)) {
      renderer.shadowMap.needsUpdate = true;
      this._shadowDirty = false;
    }
  }

  /** Force a shadow refresh — call after moving geometry or opening a door. */
  invalidateShadows() { this._shadowDirty = true; }

  get stats() {
    let on = 0;
    for (const f of this.fixtures) if (f.level > 0.05) on++;
    return {
      fixtures: this.fixtures.length,
      lit: on,
      active: this.litCount ?? 0,     // lights actually uploaded to shaders
      // Emissive sources currently glowing. This is an ART metric, not a cost
      // one: they are batched, so 200 of them and 2 of them draw the same.
      tubes: this.tubeCount ?? 0,
      shadows: this._shadowSet.size,
    };
  }
}

export default LightRig;
