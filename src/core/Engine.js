import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { GradePass, ExposureAdaptation } from '../render/GradePass.js';
import { installAtmosphereFog, AtmosphereController } from '../render/AtmosphereFog.js';
import { Rolling, clamp } from './util.js';

/**
 * Engine — owns the WebGL context, the scene graph roots, the post chain and
 * the frame loop's render half.
 *
 * Quality tiers exist because this runs in a browser on unknown hardware. The
 * tiers scale render resolution, AO, bloom resolution and shadow budget, but
 * never the *art*: geometry, materials and light placement are identical at
 * every tier, so a low-tier frame is a softer version of the same picture
 * rather than a different, worse-looking scene.
 */

/**
 * `lights` is the dominant cost in this renderer: three compiles the visible
 * light count into every material's shader and evaluates all of them per
 * fragment. `stochastic` is the second tap of the anti-repetition re-tile — a
 * full extra texture fetch plus a noise field, worth it at high, not at low.
 */
export const QUALITY = {
  low:    { scale: 0.62, ao: false, aoScale: 0.5, bloom: true,  bloomDiv: 4, shadowMap: 512,  maxShadows: 1, aniso: 4,  textureQuality: 0.5,  lights: 6,  stochastic: 0.0,  aoVolume: 0.85, aoCell: 0.85, motes: 900,  moteScale: 0.85, msaa: 0 },
  medium: { scale: 0.80, ao: true,  aoScale: 0.5, bloom: true,  bloomDiv: 3, shadowMap: 1024, maxShadows: 2, aniso: 8,  textureQuality: 0.75, lights: 10, stochastic: 0.45, aoVolume: 0.90, aoCell: 0.60, motes: 2200, moteScale: 1.00, msaa: 2 },
  high:   { scale: 1.00, ao: true,  aoScale: 0.5, bloom: true,  bloomDiv: 2, shadowMap: 1536, maxShadows: 3, aniso: 16, textureQuality: 1,    lights: 14, stochastic: 0.62, aoVolume: 0.90, aoCell: 0.45, motes: 3800, moteScale: 1.00, msaa: 2 },
};

/**
 * WHAT THE HIGH TIER USED TO COST, MEASURED ON A GPU.
 *
 * Every performance number this project had came from SwiftShader, a CPU
 * rasteriser, and the completion report says so. Measured instead on an Apple
 * M4 through ANGLE/Metal, at 1920x1080, with the camera fixed and the
 * configurations interleaved over four rounds so drift could not favour one:
 *
 *   msaa 4, ao 1.0   34.6 ms   28.9 fps   <- what shipped
 *   msaa 4, ao 0.5   31.2 ms   32.1 fps
 *   msaa 2, ao 0.5   26.0 ms   38.5 fps   <- this
 *   msaa 0, ao 0.5   19.6 ms   51.0 fps
 *
 * A sweep of eight headings in each of the three zones the player spends most
 * of the game in gave 19-34 fps at the old high tier and 46-81 at medium. The
 * brief asks for a stable 60 and no zone reached it, so the two settings that
 * were buying the least per millisecond come down a tier.
 *
 * GTAO at half resolution is the cheap one: ambient occlusion is a
 * low-frequency signal and the pass already runs at 0.5 on medium. 4x MSAA to
 * 2x is the one with a visible cost — this building is made of thin
 * high-contrast edges and that is why MSAA is here at all (see _buildComposer)
 * — but 2x still resolves the speckling that 0x does not, at 5.2 ms less than
 * 4x on a half-float 1080p target.
 *
 * These are one machine's numbers. They are not a claim about every machine;
 * they are a claim that the tier as shipped did not hit its own target on a
 * current Apple GPU, which had never been checked.
 */

export class Engine {
  constructor(canvas, { quality = 'high', maxPixelRatio = 1.5, readback = false } = {}) {
    installAtmosphereFog();

    this.canvas = canvas;
    this.qualityName = quality;
    this.q = QUALITY[quality];
    this.maxPixelRatio = maxPixelRatio;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,           // meaningless with a post chain; MSAA is on
                                  // the composer's target instead (see _buildComposer)
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      alpha: false,
      // QA capture reads the frame back out of the canvas and needs this; a
      // player does not, and it costs a back-buffer copy every presented frame.
      // `?qa=1` turns it on — see Game.boot.
      preserveDrawingBuffer: readback,
    });
    this.renderer.debug.checkShaderErrors = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // handled in GradePass
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // driven by the light manager
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    // three needs *a* fog instance to enable USE_FOG; our chunk overrides it.
    this.scene.fog = new THREE.FogExp2(0x0d0c08, 0.02);
    this.atmosphere = new AtmosphereController();

    this.camera = new THREE.PerspectiveCamera(66, 1, 0.045, 260);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Overlay scene: first-person hands and held items render after the world
    // with a cleared depth buffer so they can never clip through walls.
    //
    // A narrower FOV than the world camera (52 vs 66) is deliberate: hands at
    // arm's length through a 66-degree lens distort badly at the frame edge.
    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.PerspectiveCamera(52, 1, 0.01, 6);
    this.overlayScene.add(this.overlayCamera);

    // The overlay is a separate scene, so it sees none of the world's lights.
    // Without its own rig, anything rendered here is flat and unlit — which is
    // exactly what first-person hands look like when this is forgotten. Two
    // lights only: a key roughly where the held lamp is, and a broad fill that
    // tracks the zone's bounce colour so hands pick up the room they are in.
    this.overlayKey = new THREE.DirectionalLight(0xffe8c4, 2.2);
    this.overlayKey.position.set(0.35, 0.55, 0.9);
    this.overlayFill = new THREE.HemisphereLight(0x2a2418, 0x151210, 0.9);
    this.overlayScene.add(this.overlayKey, this.overlayFill);
    this.setOverlayLighting(0x2a2418, 0x4a3c22, 0.9, 1.0);

    this._buildEnvironment();
    this._buildComposer();

    this.frameTime = new Rolling(120);
    this.gpuTris = 0;
    this.drawCalls = 0;
    this.autoQuality = true;
    this._qualityCooldown = 3;
    this._sizeDirty = true;

    this._onResize = () => { this._sizeDirty = true; };
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  // -- procedural environment map ------------------------------------------
  /**
   * There is no sky in the Annex, but metals and wet floors still need
   * something to reflect or they render as black holes. This builds a tiny
   * equirect that approximates a lit interior: a warm luminous ceiling band, a
   * dark floor, and a horizon the colour of distant fluorescents.
   */
  _buildEnvironment() {
    const W = 64, H = 32;
    const data = new Float32Array(W * H * 4);
    const ceil = new THREE.Color(0x7d6c40);
    const horizon = new THREE.Color(0x282622);
    const floor = new THREE.Color(0x231f19);
    const c = new THREE.Color();
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);                 // 0 = top
      if (t < 0.42) c.copy(ceil).lerp(horizon, t / 0.42);
      else c.copy(horizon).lerp(floor, (t - 0.42) / 0.58);
      for (let x = 0; x < W; x++) {
        // Break the band up so reflections have some structure to catch.
        const wob = 0.82 + 0.36 * Math.abs(Math.sin(x * 0.41 + y * 0.13));
        const i = (y * W + x) * 4;
        data[i] = c.r * wob; data[i + 1] = c.g * wob; data[i + 2] = c.b * wob; data[i + 3] = 1;
      }
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.envMap = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.85;
  }

  _buildComposer() {
    const rtOpts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      colorSpace: THREE.LinearSRGBColorSpace,
      // MSAA on the scene pass.
      //
      // The renderer is constructed with antialias:false because the composer,
      // not the default framebuffer, is what the scene is drawn into — the
      // context flag does nothing once a post chain exists. Without samples here
      // there was no anti-aliasing of any kind, and this building is made almost
      // entirely of thin high-contrast edges: ceiling tee flanges, conduit runs,
      // skirting, door frames, handrails. Seen near edge-on those go sub-pixel
      // and break into strings of isolated black dots — the speckling visible
      // along every horizontal run in the diagnostic captures, which survived
      // turning off GTAO, the shadow maps and the injected detail normal in turn.
      // 4x MSAA is the cheapest thing that fixes the whole class.
      samples: this.q.msaa,
    };
    this.composer = new EffectComposer(this.renderer,
      new THREE.WebGLRenderTarget(1, 1, rtOpts));
    this.composer.renderToScreen = true;

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.updateGtaoMaterial({
      radius: 0.42,
      distanceExponent: 1.6,
      thickness: 0.7,
      scale: 1.0,
      samples: 12,
      distanceFallOff: 1.0,
      screenSpaceRadius: false,
    });
    this.gtao.blendIntensity = 0.95;
    this.gtao.enabled = this.q.ao;
    this.composer.addPass(this.gtao);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.62, 0.72);
    this.bloom.enabled = this.q.bloom;
    this.composer.addPass(this.bloom);

    this.grade = new GradePass();
    this.grade.renderToScreen = true;
    this.composer.addPass(this.grade);

    this.exposure = new ExposureAdaptation(this.renderer, { size: 64 });

    // The overlay (hands / held items) renders straight to the composer's
    // working target after the world, before the grade, so it receives the
    // same tone map and grain as everything else.
    this.overlayPass = {
      enabled: true,
      render: (renderer, writeBuffer, readBuffer) => {
        // renderer.render() clears colour, depth AND stencil by default. Left
        // on, this pass wipes the entire world and leaves only the hands on a
        // black frame — which is exactly what happened the first time hands
        // were added. Only the depth buffer may be cleared here: that is what
        // lets held items render in front of geometry they are standing in.
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setRenderTarget(readBuffer);
        renderer.clearDepth();
        renderer.render(this.overlayScene, this.overlayCamera);
        renderer.autoClear = prevAutoClear;
      },
    };
  }

  /**
   * Drive the overlay rig from the world's current mood.
   * @param {number} sky   fill colour from above
   * @param {number} ground fill colour from below (floor bounce)
   * @param {number} fill  fill intensity
   * @param {number} key   key intensity — raise it when the lamp is on
   */
  setOverlayLighting(sky, ground, fill, key) {
    this.overlayFill.color.set(sky);
    this.overlayFill.groundColor.set(ground);
    this.overlayFill.intensity = fill;
    this.overlayKey.intensity = key;
  }

  setQuality(name) {
    if (!QUALITY[name] || name === this.qualityName) return;
    this.qualityName = name;
    this.q = QUALITY[name];
    this.gtao.enabled = this.q.ao;
    this.bloom.enabled = this.q.bloom;
    // MSAA sample count is baked into the framebuffer when it is first bound, so
    // changing the tier's `msaa` is not enough — the targets have to be dropped
    // so the next setSize reallocates them at the new count.
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt && rt.samples !== this.q.msaa) { rt.samples = this.q.msaa; rt.dispose(); }
    }
    this._sizeDirty = true;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    const scale = this.q.scale;
    this.width = w; this.height = h;

    this.renderer.setPixelRatio(dpr * scale);
    this.renderer.setSize(w, h, false);

    const rw = Math.max(2, Math.round(w * dpr * scale));
    const rh = Math.max(2, Math.round(h * dpr * scale));
    this.renderWidth = rw; this.renderHeight = rh;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlayCamera.aspect = w / h;
    this.overlayCamera.updateProjectionMatrix();

    this.composer.setSize(w, h);
    this.composer.setPixelRatio(dpr * scale);
    this.gtao.setSize(rw * this.q.aoScale, rh * this.q.aoScale);
    this.bloom.setSize(rw / this.q.bloomDiv, rh / this.q.bloomDiv);
    this.grade.setSize(rw, rh);
    this._sizeDirty = false;
  }

  /** Vertical FOV in degrees, kept in sync with the overlay camera. */
  setFov(deg) {
    this.camera.fov = deg;
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    if (this._sizeDirty) this.resize();
    const t0 = performance.now();

    this.renderer.info.reset();
    this.atmosphere.update(dt);

    // Pass 1..n: world -> composer working buffer, then hands, then grade.
    // EffectComposer does not support injecting a raw callback pass cleanly,
    // so the overlay is drawn by temporarily borrowing the read buffer.
    this.grade.uniforms.uTime.value += dt;

    this._renderComposerWithOverlay();

    const adapted = this.exposure.update(this.composer.readBuffer.texture, dt);
    this.grade.uniforms.tLum.value = adapted;

    const t1 = performance.now();
    this.frameTime.push(t1 - t0);
    this.drawCalls = this.renderer.info.render.calls;
    this.gpuTris = this.renderer.info.render.triangles;

    if (this.autoQuality) this._autoQuality(dt);
  }

  _renderComposerWithOverlay() {
    const passes = this.composer.passes;
    // Render everything up to (not including) the grade pass, inject the
    // overlay, then run the grade.
    const gradeIndex = passes.indexOf(this.grade);
    const c = this.composer;
    let maskActive = false;
    c.readBuffer = c.renderTarget1;
    c.writeBuffer = c.renderTarget2;

    for (let i = 0; i < gradeIndex; i++) {
      const pass = passes[i];
      if (!pass.enabled) continue;
      pass.renderToScreen = false;
      pass.render(this.renderer, c.writeBuffer, c.readBuffer, 0.016, maskActive);
      if (pass.needsSwap) c.swapBuffers();
    }

    if (this.overlayPass.enabled && this.overlayScene.children.length > 1) {
      this.overlayPass.render(this.renderer, c.writeBuffer, c.readBuffer);
    }

    this.grade.renderToScreen = true;
    this.grade.render(this.renderer, c.writeBuffer, c.readBuffer, 0.016, maskActive);
    this.renderer.setRenderTarget(null);
  }

  /**
   * Drop a tier under sustained load, and climb back when the load goes away.
   *
   * The ladder used to be one-way, with `low` latched behind a 999-second
   * cooldown. That is a defensible choice when a drop means the machine cannot
   * cope, and the wrong one here, because the drop is usually the room: the
   * Plant and the Service Spine run fourteen dynamic lights and the Cistern
   * runs one, and the same GPU measures 26 fps in the first and 49 in the
   * second. Thirty seconds in the Plant used to cost a player the rest of the
   * session at 1190x670 with no ambient occlusion — measured at 100-185 fps on
   * an M4, i.e. throwing away most of the machine to pay for a corridor it left
   * ten minutes ago.
   *
   * Climbing is deliberately harder than dropping: twice the dwell, a margin
   * well inside the tier below's trigger so the two cannot oscillate, and the
   * requirement that the whole window is comfortable rather than its average.
   */
  _autoQuality(dt) {
    this._qualityCooldown -= dt;
    if (this._qualityCooldown > 0 || this.frameTime.buf.length < 90) return;
    const p90 = this.frameTime.percentile(0.9);
    if (p90 > 26 && this.qualityName === 'high') { this.setQuality('medium'); this._qualityCooldown = 6; }
    else if (p90 > 30 && this.qualityName === 'medium') { this.setQuality('low'); this._qualityCooldown = 8; }
    // Climb only from a p90 that would still be comfortable after the step up.
    // The gap between the tiers is roughly 2x, so 11 ms here lands around 22 ms
    // there — under the 26 ms that would send it straight back down.
    else if (p90 < 11 && this.qualityName === 'low') { this.setQuality('medium'); this._qualityCooldown = 12; }
    else if (p90 < 11 && this.qualityName === 'medium') { this.setQuality('high'); this._qualityCooldown = 12; }
  }

  get stats() {
    return {
      ms: this.frameTime.avg,
      fps: this.frameTime.avg > 0 ? 1000 / this.frameTime.avg : 0,
      p90: this.frameTime.percentile(0.9),
      calls: this.drawCalls,
      tris: this.gpuTris,
      quality: this.qualityName,
      res: `${this.renderWidth}x${this.renderHeight}`,
    };
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.exposure.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export default Engine;
