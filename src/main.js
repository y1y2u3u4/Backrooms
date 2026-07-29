import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Bus } from './core/util.js';
import { TextureForge } from './render/TextureForge.js';
import { MaterialLibrary, updateMaterialGlobals } from './render/Materials.js';
import { LightRig } from './render/Lighting.js';
import { FOG_PROFILES } from './render/AtmosphereFog.js';
import { CollisionWorld } from './player/Physics.js';
import { Player } from './player/Player.js';
import { buildPalette } from './world/Palette.js';
import { buildIntake } from './world/zones/IntakeZone.js';

/**
 * THE ANNEX — bootstrap.
 *
 * Keeps a single Game object on `window.ANNEX` so the QA harness can drive the
 * build headlessly: teleport the camera, force lighting states, step time and
 * grab deterministic frames.
 */

class Game {
  constructor() {
    this.bus = new Bus();
    this.canvas = document.getElementById('view');
    this.uiRoot = document.getElementById('ui-root');
    this._last = performance.now();
    this.running = false;
    this.time = 0;
    this.paused = false;
    this.ready = false;
  }

  async boot(onProgress = () => {}) {
    onProgress(0.02, 'initialising renderer');
    this.engine = new Engine(this.canvas, { quality: detectQuality() });
    this.input = new Input(this.canvas);

    onProgress(0.06, 'forging surfaces');
    this.forge = new TextureForge({ quality: this.engine.q.textureQuality });
    await this.forge.forgeAll((p, name) => onProgress(0.06 + p * 0.62, `forging ${name}`));

    onProgress(0.70, 'mixing materials');
    this.materials = new MaterialLibrary(this.forge, { envMap: this.engine.envMap });
    this.palette = buildPalette(this.materials);

    onProgress(0.74, 'raising structure');
    this.collision = new CollisionWorld();
    this.rig = new LightRig(this.engine.scene, {
      maxShadows: this.engine.q.maxShadows,
      shadowMapSize: this.engine.q.shadowMap,
    });

    const ctx = {
      materials: this.materials, collision: this.collision,
      rig: this.rig, palette: this.palette, scene: this.engine.scene, bus: this.bus,
    };
    this.ctx = ctx;

    const intake = buildIntake(ctx, {});
    this.engine.scene.add(intake.root);
    this.intake = intake;

    onProgress(0.92, 'settling dust');
    this.engine.atmosphere.set(FOG_PROFILES.intake, true);

    this.player = new Player({
      collision: this.collision,
      camera: this.engine.camera,
      bus: this.bus,
    });
    this.player.teleport(intake.spawn[0], intake.spawn[1], intake.spawn[2], intake.spawnYaw);

    this.engine.renderer.shadowMap.needsUpdate = true;

    // Compile everything up front so the first frames do not stutter.
    this.engine.renderer.compile(this.engine.scene, this.engine.camera);
    onProgress(1, 'ready');
    this.ready = true;

    this.canvas.addEventListener('click', () => {
      if (this.ready && !this.paused) this.input.requestLock();
    });

    return this;
  }

  start() {
    if (this.running) return;
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this._frame();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _frame() {
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.time += dt;
    if (!this.paused) this.step(dt);
    this.engine.render(dt);
    this.input.endFrame();
  }

  /** One logic step. Split out so the QA harness can advance deterministically. */
  step(dt) {
    updateMaterialGlobals(dt);
    this.player.update(dt, this.input);
    this.rig.update(dt, this.engine.camera, this.engine.renderer);
  }

  /** QA hook: render exactly one frame with a fixed dt. */
  renderOnce(dt = 1 / 60) {
    this.step(dt);
    this.engine.render(dt);
  }

  /**
   * QA hook: place the camera and settle. Used by the capture harness so
   * frames are reproducible run to run.
   */
  look(x, y, z, yaw = 0, pitch = 0) {
    this.player.teleport(x, y, z, yaw);
    this.player.pitch = pitch;
    this.player.bobAmount = 0;
    this.player.velocity.set(0, 0, 0);
    this.engine.exposure.reset();
  }

  /** QA hook: walk from A to B over `seconds`, for motion/streaming checks. */
  walkTo(x, z, seconds = 1) {
    const p = this.player;
    const steps = Math.max(1, Math.round(seconds * 60));
    const sx = p.position.x, sz = p.position.z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      p.position.x = sx + (x - sx) * t;
      p.position.z = sz + (z - sz) * t;
      this.renderOnce(1 / 60);
    }
  }
}

function detectQuality() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');
  if (forced && ['low', 'medium', 'high'].includes(forced)) return forced;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 2) return 'low';
  if (mem <= 8 && cores <= 4) return 'medium';
  return 'high';
}

// ---------------------------------------------------------------------------

const veil = document.getElementById('boot-veil');
const loadingEl = document.createElement('div');
loadingEl.style.cssText = `
  position:fixed; inset:0; display:grid; place-items:center; z-index:200;
  background:#000; color:#8a7134; font:300 13px/1.7 var(--ui-font);
  letter-spacing:0.36em; text-transform:uppercase;`;
loadingEl.innerHTML = `
  <div style="text-align:center">
    <div style="font-size:26px;letter-spacing:0.5em;color:#d8b45a;margin-bottom:18px">THE ANNEX</div>
    <div id="load-msg" style="opacity:.65;font-size:10px">initialising</div>
    <div style="width:220px;height:1px;background:#2a2418;margin:22px auto 0">
      <div id="load-bar" style="width:0%;height:100%;background:#d8b45a;transition:width .25s"></div>
    </div>
  </div>`;
document.body.appendChild(loadingEl);

const game = new Game();
window.ANNEX = game;

game.boot((p, msg) => {
  const bar = document.getElementById('load-bar');
  const m = document.getElementById('load-msg');
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  if (m) m.textContent = msg;
}).then(() => {
  const qa = new URLSearchParams(location.search).get('qa') === '1';
  if (qa) {
    // QA drives frames itself; no menu, no fade, no loading chrome.
    loadingEl.remove(); veil.remove();
    window.ANNEX_READY = true;
    return;
  }
  game.start();
  setTimeout(() => {
    loadingEl.style.transition = 'opacity 900ms ease';
    loadingEl.style.opacity = '0';
    veil.style.opacity = '0';
    setTimeout(() => { loadingEl.remove(); veil.remove(); }, 1000);
  }, 200);
  window.ANNEX_READY = true;
}).catch((err) => {
  console.error(err);
  const m = document.getElementById('load-msg');
  if (m) { m.textContent = 'failed: ' + err.message; m.style.color = '#b04a3a'; }
  window.ANNEX_ERROR = String(err && err.stack || err);
});

export default game;
