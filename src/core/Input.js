import { Bus } from './util.js';

/**
 * Input — keyboard, mouse, pointer lock and gamepad, normalised into a small
 * action set. Also exposes a "debug camera" toggle used by the QA harness.
 */

export const ACTIONS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['ControlLeft', 'KeyC'],
  interact: ['KeyE'],
  flashlight: ['KeyF'],
  journal: ['Tab', 'KeyJ'],
  leanLeft: ['KeyQ'],
  leanRight: ['KeyR'],
  cancel: ['Escape'],
  confirm: ['Enter', 'Space'],
  drop: ['KeyG'],
};

export class Input extends Bus {
  constructor(domElement) {
    super();
    this.dom = domElement;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.releasedThisFrame = new Set();
    this.mouse = { dx: 0, dy: 0, down: false, rightDown: false, wheel: 0 };
    this.sensitivity = 0.0021;
    this.invertY = false;
    this.locked = false;
    this.enabled = true;
    this.gamepadIndex = null;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      // Tab would move focus out of the canvas; the journal owns it.
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      this.pressedThisFrame.add(e.code);
      this.emit('key', e.code, true, e);
      for (const [name, codes] of Object.entries(ACTIONS)) {
        if (codes.includes(e.code)) this.emit(`press:${name}`, e);
      }
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      this.releasedThisFrame.add(e.code);
      this.emit('key', e.code, false, e);
      for (const [name, codes] of Object.entries(ACTIONS)) {
        if (codes.includes(e.code)) this.emit(`release:${name}`, e);
      }
    };
    this._onMouseMove = (e) => {
      if (!this.locked || !this.enabled) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.mouse.down = true; this.emit('press:primary', e); }
      if (e.button === 2) { this.mouse.rightDown = true; this.emit('press:secondary', e); }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) { this.mouse.down = false; this.emit('release:primary', e); }
      if (e.button === 2) { this.mouse.rightDown = false; this.emit('release:secondary', e); }
    };
    this._onWheel = (e) => { this.mouse.wheel += Math.sign(e.deltaY); };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.dom;
      this.emit('lock', this.locked);
    };
    this._onContext = (e) => e.preventDefault();
    this._onBlur = () => { this.keys.clear(); this.mouse.down = false; };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLockChange);
    this.dom.addEventListener('contextmenu', this._onContext);
  }

  requestLock() {
    if (this.locked) return;
    this.dom.requestPointerLock?.();
  }
  exitLock() { if (this.locked) document.exitPointerLock?.(); }

  down(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (this.keys.has(c)) return true;
    return this._padAction(action);
  }
  pressed(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (this.pressedThisFrame.has(c)) return true;
    return false;
  }

  /** Axis pair for movement, gamepad-aware, magnitude-clamped. */
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('forward')) y += 1;
    if (this.down('back')) y -= 1;
    if (this.down('right')) x += 1;
    if (this.down('left')) x -= 1;
    const pad = this._pad();
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.16 ? 0 : v);
      x += dz(pad.axes[0] || 0);
      y -= dz(pad.axes[1] || 0);
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  /** Accumulated look delta in radians; consumed once per frame. */
  lookDelta() {
    let dx = this.mouse.dx * this.sensitivity;
    let dy = this.mouse.dy * this.sensitivity * (this.invertY ? -1 : 1);
    this.mouse.dx = 0; this.mouse.dy = 0;
    const pad = this._pad();
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      dx += dz(pad.axes[2] || 0) * 0.045;
      dy += dz(pad.axes[3] || 0) * 0.045;
    }
    return { dx, dy };
  }

  _pad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  _padAction(action) {
    const p = this._pad();
    if (!p) return false;
    const b = p.buttons;
    switch (action) {
      case 'sprint': return b[10]?.pressed;
      case 'crouch': return b[1]?.pressed;
      case 'interact': return b[0]?.pressed;
      case 'flashlight': return b[2]?.pressed;
      default: return false;
    }
  }

  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.mouse.wheel = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    this.dom.removeEventListener('contextmenu', this._onContext);
  }
}

export default Input;
