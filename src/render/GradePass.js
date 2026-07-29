import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * The Annex grade — the final image pass.
 *
 * Deliberately restrained. The brief for this project is that the environment
 * has to survive a well-exposed inspection screenshot, so nothing here exists
 * to hide geometry or lighting problems:
 *
 *  * exposure comes from a slow eye adaptation, clamped to ~1.6 stops of range
 *  * AgX tone mapping (three's implementation) keeps fluorescent tubes from
 *    clipping to flat white and holds hue in the deep shadows
 *  * the grade is a split-tone: sodium-warm highlights, cold green-blue shadows
 *  * vignette, aberration and grain are all set low enough to read as lens
 *    character rather than as an effect
 *  * `uDread` is the one channel allowed to get loud, and only during authored
 *    horror beats: it desaturates, pinches the vignette and pulls the highlight
 *    tint toward bone.
 */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tLum: { value: null },
    toneMappingExposure: { value: 1 },
    uExposure: { value: 1 },
    uAutoExposure: { value: 1 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },

    uLift: { value: new THREE.Vector3(0.004, 0.006, 0.010) },
    uGamma: { value: new THREE.Vector3(1.0, 0.99, 0.97) },
    uGain: { value: new THREE.Vector3(1.04, 1.0, 0.92) },
    uShadowTint: { value: new THREE.Color(0x1d2630) },
    uHighlightTint: { value: new THREE.Color(0xffe9bd) },
    uSplitAmount: { value: 0.30 },
    uSaturation: { value: 0.90 },
    uContrast: { value: 1.06 },

    uVignette: { value: 0.42 },
    uVignetteSoft: { value: 0.62 },
    uAberration: { value: 0.7 },
    uGrain: { value: 0.030 },
    uGrainSize: { value: 1.35 },
    uScanline: { value: 0.0 },

    uDread: { value: 0.0 },
    uFlash: { value: 0.0 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uFade: { value: 0.0 },
    uFadeColor: { value: new THREE.Color(0x000000) },
    uWarp: { value: 0.0 },
    uInvert: { value: 0.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,

  fragmentShader: /* glsl */ `
    // tonemapping_pars_fragment already pulls in the colour-space transfer
    // functions in this three version; including colorspace_pars_fragment as
    // well redefines them and fails to link.
    #include <common>
    #include <tonemapping_pars_fragment>

    uniform sampler2D tDiffuse;
    uniform sampler2D tLum;
    uniform float uExposure, uAutoExposure, uTime;
    uniform vec2  uResolution;
    uniform vec3  uLift, uGamma, uGain;
    uniform vec3  uShadowTint, uHighlightTint;
    uniform float uSplitAmount, uSaturation, uContrast;
    uniform float uVignette, uVignetteSoft, uAberration, uGrain, uGrainSize, uScanline;
    uniform float uDread, uFlash, uFade, uWarp, uInvert;
    uniform vec3  uFlashColor, uFadeColor;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    // Interleaved gradient noise — a good grain basis: temporally stable per
    // frame, no visible tiling, and cheap.
    float ign(vec2 p) {
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    void main() {
      vec2 uv = vUv;
      vec2 cen = uv - 0.5;
      float r2 = dot(cen, cen);

      // Barrel warp, used only during entity proximity / capture beats.
      if (uWarp > 0.001) {
        uv = 0.5 + cen * (1.0 + uWarp * (0.16 * r2 - 0.04));
      }

      // Lateral chromatic aberration, radial and zero at the centre so the
      // middle of frame stays clean for inspection.
      float ca = uAberration * (0.0008 + uDread * 0.0022);
      vec2 dir = normalize(cen + 1e-6) * ca * smoothstep(0.02, 0.55, r2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      // --- exposure -------------------------------------------------------
      float adapted = texture2D(tLum, vec2(0.5)).r;
      adapted = clamp(exp(adapted), 0.004, 4.0);
      // Aim for a mid-grey target, then clamp the correction hard so the image
      // never swings more than about 1.6 stops from the authored lighting.
      float autoGain = clamp(0.16 / max(adapted, 1e-4), 0.62, 1.95);
      float gain = uExposure * mix(1.0, autoGain, uAutoExposure);
      col *= gain;

      // --- tone map -------------------------------------------------------
      col = AgXToneMapping(col);

      // --- grade ----------------------------------------------------------
      col = pow(max(col + uLift, 0.0), 1.0 / max(uGamma, vec3(0.01))) * uGain;

      float l = luma(col);
      vec3 shadowT = mix(vec3(1.0), uShadowTint * 2.0, uSplitAmount * (1.0 - smoothstep(0.0, 0.55, l)));
      vec3 highT   = mix(vec3(1.0), uHighlightTint,     uSplitAmount * smoothstep(0.35, 1.0, l));
      col *= shadowT * highT;

      col = mix(vec3(luma(col)), col, uSaturation * (1.0 - uDread * 0.55));
      col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 8.0);

      // --- vignette -------------------------------------------------------
      float vig = 1.0 - uVignette * smoothstep(uVignetteSoft * 0.25, uVignetteSoft, r2 * 2.0);
      vig *= 1.0 - uDread * 0.35 * smoothstep(0.02, 0.5, r2);
      col *= vig;

      // --- encode ---------------------------------------------------------
      col = max(col, 0.0);
      vec4 outCol = sRGBTransferOETF(vec4(col, 1.0));

      // --- grain ----------------------------------------------------------
      // Applied after encode so it behaves like sensor noise: strongest in the
      // shadows, essentially absent in the highlights.
      float g = ign(gl_FragCoord.xy / uGrainSize + vec2(uTime * 61.7, uTime * 37.3));
      float shadowWeight = 1.0 - smoothstep(0.02, 0.6, luma(outCol.rgb));
      outCol.rgb += (g - 0.5) * uGrain * (0.35 + 0.65 * shadowWeight);

      if (uScanline > 0.001) {
        float s = sin(gl_FragCoord.y * 2.2 + uTime * 3.0) * 0.5 + 0.5;
        outCol.rgb *= 1.0 - uScanline * s * 0.35;
      }

      outCol.rgb = mix(outCol.rgb, 1.0 - outCol.rgb, uInvert);
      outCol.rgb = mix(outCol.rgb, uFlashColor, clamp(uFlash, 0.0, 1.0));
      outCol.rgb = mix(outCol.rgb, uFadeColor, clamp(uFade, 0.0, 1.0));

      gl_FragColor = vec4(outCol.rgb, 1.0);
    }`,
};

export class GradePass extends Pass {
  constructor() {
    super();
    this.uniforms = THREE.UniformsUtils.clone(GradeShader.uniforms);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.needsSwap = true;
  }
  setSize(w, h) { this.uniforms.uResolution.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}

// ---------------------------------------------------------------------------

/**
 * Two-target eye adaptation. Renders scene luminance to a small mipmapped
 * target, then blends a 1x1 accumulator toward the coarsest mip. Dark->light
 * adapts faster than light->dark, matching how unpleasant it is to walk out of
 * a lit corridor into a black one.
 */
export class ExposureAdaptation {
  constructor(renderer, { size = 64 } = {}) {
    this.renderer = renderer;
    this.size = size;
    const opts = {
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.lumRT = new THREE.WebGLRenderTarget(size, size, opts);
    const one = { ...opts, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false };
    this.accA = new THREE.WebGLRenderTarget(1, 1, one);
    this.accB = new THREE.WebGLRenderTarget(1, 1, one);
    this.mipLevel = Math.log2(size);

    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: GradeShader.vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          // Log-average is far more stable than a linear mean when a single
          // fluorescent tube occupies a few pixels of an otherwise black frame.
          gl_FragColor = vec4(vec3(log(max(l, 1e-4))), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.adaptMat = new THREE.ShaderMaterial({
      uniforms: {
        tCur: { value: null }, tPrev: { value: null },
        uUpRate: { value: 0.0 }, uDownRate: { value: 0.0 }, uMip: { value: this.mipLevel },
      },
      vertexShader: GradeShader.vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D tCur, tPrev; uniform float uUpRate, uDownRate, uMip;
        varying vec2 vUv;
        void main() {
          float cur = textureLod(tCur, vec2(0.5), uMip).r;
          float prev = texture2D(tPrev, vec2(0.5)).r;
          if (prev < -900.0 || prev != prev) prev = cur;
          float rate = cur > prev ? uUpRate : uDownRate;
          gl_FragColor = vec4(vec3(mix(prev, cur, rate)), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.downMat);
    this._primed = false;
  }

  /** @returns {THREE.Texture} the 1x1 adapted log-luminance */
  update(sceneTexture, dt) {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();

    this.quad.material = this.downMat;
    this.downMat.uniforms.tDiffuse.value = sceneTexture;
    r.setRenderTarget(this.lumRT);
    this.quad.render(r);

    this.quad.material = this.adaptMat;
    this.adaptMat.uniforms.tCur.value = this.lumRT.texture;
    this.adaptMat.uniforms.tPrev.value = this.accB.texture;
    // Adapting into darkness is slow (~2.5 s); adapting to light is quick.
    this.adaptMat.uniforms.uUpRate.value = this._primed ? 1 - Math.exp(-1.9 * dt) : 1;
    this.adaptMat.uniforms.uDownRate.value = this._primed ? 1 - Math.exp(-0.55 * dt) : 1;
    r.setRenderTarget(this.accA);
    this.quad.render(r);
    this._primed = true;

    const t = this.accA; this.accA = this.accB; this.accB = t;
    r.setRenderTarget(prevTarget);
    return this.accB.texture;
  }

  reset() { this._primed = false; }
  dispose() {
    this.lumRT.dispose(); this.accA.dispose(); this.accB.dispose();
    this.downMat.dispose(); this.adaptMat.dispose(); this.quad.dispose();
  }
}

export default GradePass;
