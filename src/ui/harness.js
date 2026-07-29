/**
 * UI harness.
 *
 * Boots the whole UI facade against a stubbed engine and player so every screen
 * and HUD state can be driven, screenshotted and looked at without the game
 * existing. Behind the UI it paints a one-point-perspective corridor plate at
 * roughly the value and colour the real Intake renders at, which is the only
 * way to judge whether a HUD element is legible or whether an amber prompt is
 * sitting on an amber wall.
 *
 * Drive it with the hash:  harness.html#hud-prompt
 * Or from Playwright:      await page.evaluate(n => UIH.set(n), 'journal-tapes')
 */

import * as THREE from 'three';
import { Bus } from '../core/util.js';
import { createUI } from './UI.js';
import { SAMPLE_NOTES, SAMPLE_TAPES, SAMPLE_PLAN } from './sampleContent.js';

// ---------------------------------------------------------------------------
// Backdrop: a plate that behaves like the Intake corridor under the grade.
// ---------------------------------------------------------------------------

const view = document.getElementById('view');
const g = view.getContext('2d');

function paintPlate() {
  const w = view.width = view.clientWidth;
  const h = view.height = view.clientHeight;
  const vx = w * 0.5, vy = h * 0.53;

  g.fillStyle = '#0b0a07'; g.fillRect(0, 0, w, h);

  const depths = [1, 0.66, 0.44, 0.29, 0.19, 0.125, 0.082];
  const halfW = w * 0.62, ceil = -h * 0.06, floor = h * 1.12;

  // walls / floor / ceiling as receding bands
  for (let i = 0; i < depths.length - 1; i++) {
    const a = depths[i], b = depths[i + 1];
    const ax = halfW * a, bx = halfW * b;
    const at = vy - (vy - ceil) * a, ab = vy + (floor - vy) * a;
    const bt = vy - (vy - ceil) * b, bb = vy + (floor - vy) * b;
    const k = 1 - i / (depths.length - 1);

    // left + right wall (mustard vinyl)
    g.fillStyle = `rgb(${Math.round(52 * k + 8)},${Math.round(44 * k + 7)},${Math.round(24 * k + 6)})`;
    g.beginPath(); g.moveTo(vx - ax, at); g.lineTo(vx - bx, bt); g.lineTo(vx - bx, bb); g.lineTo(vx - ax, ab); g.fill();
    g.fillStyle = `rgb(${Math.round(44 * k + 8)},${Math.round(37 * k + 7)},${Math.round(21 * k + 6)})`;
    g.beginPath(); g.moveTo(vx + ax, at); g.lineTo(vx + bx, bt); g.lineTo(vx + bx, bb); g.lineTo(vx + ax, ab); g.fill();
    // floor (damp loop carpet)
    g.fillStyle = `rgb(${Math.round(30 * k + 6)},${Math.round(27 * k + 6)},${Math.round(22 * k + 5)})`;
    g.beginPath(); g.moveTo(vx - ax, ab); g.lineTo(vx + ax, ab); g.lineTo(vx + bx, bb); g.lineTo(vx - bx, bb); g.fill();
    // ceiling
    g.fillStyle = `rgb(${Math.round(26 * k + 5)},${Math.round(24 * k + 5)},${Math.round(19 * k + 5)})`;
    g.beginPath(); g.moveTo(vx - ax, at); g.lineTo(vx + ax, at); g.lineTo(vx + bx, bt); g.lineTo(vx - bx, bt); g.fill();

    // troffer
    const tw = ax * 0.20, tw2 = bx * 0.20;
    const grad = g.createLinearGradient(0, at, 0, bt);
    grad.addColorStop(0, `rgba(255,242,214,${0.90 * k + 0.08})`);
    grad.addColorStop(1, `rgba(255,238,200,${0.62 * k + 0.06})`);
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(vx - tw, at); g.lineTo(vx + tw, at); g.lineTo(vx + tw2, bt); g.lineTo(vx - tw2, bt); g.fill();
    // spill on the ceiling
    g.fillStyle = `rgba(255,236,196,${0.055 * k})`;
    g.beginPath(); g.moveTo(vx - ax, at); g.lineTo(vx + ax, at); g.lineTo(vx + bx, bt); g.lineTo(vx - bx, bt); g.fill();
  }

  // far door
  g.fillStyle = '#171308';
  g.fillRect(vx - w * 0.026, vy - h * 0.085, w * 0.052, h * 0.155);

  // grain + vignette (the plate has to survive the same scrutiny the game does)
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 11;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const v = g.createRadialGradient(vx, vy, Math.min(w, h) * 0.18, vx, vy, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const bus = new Bus();

function uniforms() {
  const n = (v) => ({ value: v });
  return {
    uExposure: n(1), uAutoExposure: n(1), uSaturation: n(0.90), uContrast: n(1.06),
    uVignette: n(0.42), uAberration: n(0.7), uGrain: n(0.030), uScanline: n(0),
    uDread: n(0), uFlash: n(0), uFade: n(0), uWarp: n(0), uInvert: n(0),
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uFadeColor: { value: new THREE.Color(0x000000) },
    uTime: n(0),
  };
}

const camera = new THREE.PerspectiveCamera(66, 16 / 9, 0.045, 260);
camera.rotation.order = 'YXZ';

const engine = {
  camera,
  grade: { uniforms: uniforms() },
  setQuality() {}, setFov(f) { camera.fov = f; camera.updateProjectionMatrix(); },
  autoQuality: true,
};

const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  yaw: 0, pitch: 0, eyeHeight: 1.63,
  stamina: 1, fear: 0, exertion: 0,
  frozen: false, controlEnabled: true, lookEnabled: true,
  fovBase: 66, fovOffset: 0, viewRoll: 0, _breathPhase: 0, _fovNow: 66,
};

const input = { sensitivity: 0.0021, invertY: false, exitLock() {}, requestLock() {} };
// A stand-in for the integrator's slowly drifting menu camera, so the title
// screen is composited over a live plate rather than the degraded fallback.
const game = { time: 0, menuCamera: { update() {} } };

const ui = createUI({
  bus, root: document.getElementById('ui-root'),
  engine, player, input, game, rig: null, bindKeys: true,
});

for (const n of SAMPLE_NOTES) ui.addNote(n);
for (const t of SAMPLE_TAPES) ui.addTape(t);
for (const n of SAMPLE_PLAN.nodes) ui.mapAdd(n);
for (const [a, b] of SAMPLE_PLAN.edges) ui.mapLink(a, b);
ui.mapHere(SAMPLE_PLAN.here.x, SAMPLE_PLAN.here.z);

// The grade deck writes uniforms; here we mirror the ones that would be visible
// so cinematic beats can actually be seen in the harness.
const vigEl = document.createElement('div');
vigEl.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none';
document.getElementById('app').appendChild(vigEl);
const fx = document.createElement('div');
fx.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none';
document.getElementById('app').appendChild(fx);

function mirrorGrade() {
  const u = engine.grade.uniforms;
  const fade = u.uFade.value, flash = u.uFlash.value;
  const fc = u.uFadeColor.value, sc = u.uFlashColor.value;
  const hex = (c) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  fx.style.background = flash > 0.001
    ? hex(sc) : fade > 0.001 ? hex(fc) : 'transparent';
  fx.style.opacity = String(Math.max(fade, flash));
  const vig = u.uVignette.value, exp = u.uExposure.value, sat = u.uSaturation.value;
  view.style.filter = `brightness(${exp.toFixed(3)}) saturate(${(sat / 0.9).toFixed(3)})`;
  // Full-bleed radial, not an inset shadow — an inset shadow draws a visible
  // rectangle at the canvas edge and makes every screenshot look framed.
  vigEl.style.background =
    `radial-gradient(120% 96% at 50% 52%, rgba(0,0,0,0) 26%, rgba(0,0,0,${(vig * 1.5).toFixed(3)}) 100%)`;
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function reset() {
  ui.hide('title'); ui.hide('pause'); ui.hide('journal'); ui.hide('settings');
  ui.hide('death'); ui.hide('ending'); ui.hide('loading');
  ui.setPrompt(null); ui.setHoldProgress(0);
  ui.objective('');
  ui._components.subs.clear();
  ui.hideHud(false);
  player.stamina = 1; player.fear = 0;
  ui.setLampBattery(1);
}

const STATES = {
  'title': () => { ui.show('title'); },
  'title-credits': () => { ui.show('title'); ui.show('credits'); },
  'settings': () => { ui.show('settings', { from: 'title' }); },

  'loading-early': () => { ui.show('loading'); ui.loadProgress(0.06, 'forging surfaces'); },
  'loading-mid': () => { ui.show('loading'); ui.loadProgress(0.62, 'forging vinyl_mustard'); },
  'loading-done': () => {
    ui.show('loading'); ui.loadProgress(1, 'ready');
    ui._components.loading.node.classList.add('ax-stamped');
  },

  'pause': () => {
    ui.objective('Restore three-phase supply — goods lift', '1 of 3 fuse cores');
    ui.show('pause', { cores: '1 of 3', zone: 'Service spine · 7/L-118', elapsed: 780 });
  },

  'journal-notes': () => { ui._components.journal.setTab('notes'); ui.show('journal'); },
  'journal-notes-b': () => {
    ui._components.journal.setTab('notes'); ui.show('journal');
    ui._components.journal.key('ArrowDown');
  },
  'journal-tapes': () => { ui._components.journal.setTab('tapes'); ui.show('journal'); },
  'journal-tapes-playing': () => {
    ui._components.journal.setTab('tapes'); ui.show('journal');
    ui.setTapeTime('tape.01', 79, true);
  },
  'journal-plan': () => { ui._components.journal.setTab('plan'); ui.show('journal'); },

  'death': () => { ui.show('death', { cause: 'surveyor', location: '7/L-112, north end', elapsed: 1980 }); },
  'ending-card': () => { ui.show('ending', { ending: 'lift' }); },
  'ending-credits': () => { ui.show('ending', { ending: 'lift' }); ui._components.ending.skip(); },
  'ending-coda': () => {
    ui.show('ending', { ending: 'lift' });
    ui._components.ending.skip(); ui._components.ending.skip();
  },

  'hud-idle': () => { ui.objective('Restore three-phase supply — goods lift', '0 of 3 fuse cores'); },
  'hud-prompt': () => { ui.setPrompt({ verb: 'Open', key: 'E', subject: '7/L-112' }); },
  'hud-prompt-hold': () => {
    ui.setPrompt({ verb: 'Turn valve', key: 'E', hold: true, subject: 'Isolator 4' });
    ui.setHoldProgress(0.64);
  },
  'hud-prompt-refused': () => {
    ui.setPrompt({ verb: 'Open', key: 'E', requires: 'keycard B', subject: '7/L-140' });
  },
  'hud-prompt-safe': () => {
    ui._components.prompts.setSafe(true);
    ui.setPrompt({ verb: 'Take', key: 'E', hold: true, subject: 'Fuse core' });
    ui.setHoldProgress(0.42);
  },
  'hud-subtitles': () => {
    ui.objective('Find a way into the Cistern', '');
    ui.subtitle({ speaker: 'Hale (tape 1)', text: 'There is a chair in the middle of the corridor. Facing me.' });
    ui.sound('a rising transformer whine', null, { hint: 'to your left, distant' });
  },
  'hud-full': () => {
    ui.objective('Restore three-phase supply — goods lift', '2 of 3 fuse cores');
    ui.setPrompt({ verb: 'Open', key: 'E', subject: '7/L-118' });
    ui.subtitle({ speaker: 'Surveyor', text: 'two seventy. two seventy-one.', hint: 'behind you, close' });
    player.stamina = 0.22;
  },
  'hud-exhausted': () => {
    player.stamina = 0.03; player.fear = 0.55;
    ui.setLampBattery(0.12);
    ui.objective('Get out of the light', '');
  },
  'cine-skip': () => {
    ui.hideHud(true);
    ui._cineBegin('intro', true);
    ui._components && (ui._skipDemo = true);
    // force the affordance visible for the shot
    const el = document.querySelector('.ax-skip');
    el.classList.add('ax-on');
    el.querySelector('.ax-skip-bar i').style.transform = 'scaleX(0.55)';
  },
};

function set(name) {
  reset();
  (STATES[name] || STATES.title)();
  location.hash = name;
  return name;
}

// ---------------------------------------------------------------------------

const nav = document.getElementById('hx');
for (const k of Object.keys(STATES)) {
  const a = document.createElement('a');
  a.href = `#${k}`; a.textContent = k;
  a.addEventListener('click', (e) => { e.preventDefault(); set(k); });
  nav.appendChild(a);
}
if (new URLSearchParams(location.search).get('bare') === '1') document.body.setAttribute('data-bare', '');

let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.time += dt;
  player._breathPhase += dt * 2.2;
  ui.update(dt);
  mirrorGrade();
  requestAnimationFrame(loop);
}

function resize() { paintPlate(); }
window.addEventListener('resize', resize);
paintPlate();
set((location.hash || '#title').slice(1));
requestAnimationFrame(loop);

window.UIH = { ui, bus, engine, player, set, states: Object.keys(STATES), paintPlate };
window.UIH_READY = true;
