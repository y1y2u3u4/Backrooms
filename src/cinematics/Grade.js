/**
 * GradeDeck — arbitration over `engine.grade.uniforms`.
 *
 * Three systems want to move the same handful of post uniforms at once: the
 * player's physical state (stamina vignette, breath), the director's dread, and
 * whatever cinematic is running. If they all wrote the uniforms directly the
 * last writer each frame would win and a sequence could be silently cancelled
 * by a footstep.
 *
 * So nobody writes uniforms. Systems write *layers*, the deck composes them
 * once per frame with a per-channel rule, and a layer that is disposed always
 * gives its contribution back — which is what makes cinematic cleanup
 * guaranteed rather than best-effort.
 *
 *   add   uVignette, uDread, uWarp, uScanline, uGrain  (offset from base)
 *   mul   uExposure, uSaturation, uAutoExposure        (scale of base)
 *   max   uFade, uFlash, uInvert                       (strongest wins)
 *
 * `uFadeColor` / `uFlashColor` follow whichever layer currently owns the
 * highest value on the matching channel, so a white-noise cut and a black fade
 * can never blend into a grey one.
 */

const ADD = ['uVignette', 'uDread', 'uWarp', 'uScanline', 'uGrain', 'uAberration', 'uContrast'];
const MUL = ['uExposure', 'uSaturation', 'uAutoExposure'];
const MAX = ['uFade', 'uFlash', 'uInvert'];
const ALL = [...ADD, ...MUL, ...MAX];

export class GradeDeck {
  /** @param {object} uniforms engine.grade.uniforms */
  constructor(uniforms) {
    this.u = uniforms || {};
    this.base = {};
    for (const k of ALL) this.base[k] = this.u[k] ? this.u[k].value : (MUL.includes(k) ? 1 : 0);
    // Contrast is authored, not a channel anyone should offset by default.
    this.base.uContrast = this.u.uContrast ? this.u.uContrast.value : 1;
    this.layers = new Map();
    this._order = [];
  }

  /** Get (creating if needed) a named layer. Layers compose in creation order. */
  layer(name, priority = 0) {
    let l = this.layers.get(name);
    if (!l) {
      l = new GradeLayer(this, name, priority);
      this.layers.set(name, l);
      this._order = [...this.layers.values()].sort((a, b) => a.priority - b.priority);
    }
    return l;
  }

  drop(name) {
    const l = this.layers.get(name);
    if (!l) return;
    this.layers.delete(name);
    this._order = [...this.layers.values()].sort((a, b) => a.priority - b.priority);
    this.apply();
  }

  /** Re-read the current uniform values as the new resting state. */
  rebase(keys = ALL) {
    for (const k of keys) if (this.u[k]) this.base[k] = this.u[k].value;
  }

  /** Compose every layer and write the uniforms. Call once per frame, last. */
  apply(dt = 0) {
    for (const l of this._order) l._tick(dt);

    const out = { ...this.base };
    let fadeOwner = null, flashOwner = null;
    let fadeBest = -1, flashBest = -1;

    for (const l of this._order) {
      const v = l.values;
      for (const k in v) {
        const x = v[k];
        if (x === undefined) continue;
        if (MUL.includes(k)) out[k] = (out[k] ?? 1) * x;
        else if (MAX.includes(k)) {
          if (x > (out[k] ?? 0)) out[k] = x;
          if (k === 'uFade' && x > fadeBest) { fadeBest = x; fadeOwner = l; }
          if (k === 'uFlash' && x > flashBest) { flashBest = x; flashOwner = l; }
        } else out[k] = (out[k] ?? 0) + x;
      }
    }

    for (const k of ALL) {
      const u = this.u[k];
      if (!u) continue;
      let v = out[k];
      if (MAX.includes(k)) v = v < 0 ? 0 : v > 1 ? 1 : v;
      if (k === 'uVignette') v = v < 0 ? 0 : v > 1.0 ? 1.0 : v;
      if (k === 'uSaturation') v = v < 0 ? 0 : v;
      u.value = v;
    }
    if (fadeOwner?.colors.uFadeColor && this.u.uFadeColor) this.u.uFadeColor.value.set(fadeOwner.colors.uFadeColor);
    if (flashOwner?.colors.uFlashColor && this.u.uFlashColor) this.u.uFlashColor.value.set(flashOwner.colors.uFlashColor);
  }

  /** Emergency reset — used when a sequence is torn down mid-flight. */
  reset() {
    for (const l of this.layers.values()) l.clear();
    this.apply();
  }
}

export class GradeLayer {
  constructor(deck, name, priority) {
    this.deck = deck;
    this.name = name;
    this.priority = priority;
    this.values = {};
    this.colors = {};
    this._tweens = [];
  }

  /** Set one or more channels instantly. `undefined` removes a channel. */
  set(obj, value) {
    if (typeof obj === 'string') { this._one(obj, value); return this; }
    for (const [k, v] of Object.entries(obj)) this._one(k, v);
    return this;
  }
  _one(k, v) {
    if (k === 'fadeColor') { this.colors.uFadeColor = v; return; }
    if (k === 'flashColor') { this.colors.uFlashColor = v; return; }
    if (v === undefined || v === null) delete this.values[k];
    else this.values[k] = v;
    // A direct set overrides any tween on the same channel.
    this._tweens = this._tweens.filter((t) => t.key !== k);
  }

  /**
   * Tween a channel. Returns a promise that resolves on arrival; the promise is
   * resolved (not rejected) if the layer is cleared, so `await` sites never
   * strand a sequence.
   */
  to(key, target, duration = 0.4, ease) {
    const from = this.values[key] ?? (MUL.includes(key) ? 1 : 0);
    this._tweens = this._tweens.filter((t) => t.key !== key);
    let done;
    const p = new Promise((r) => { done = r; });
    this._tweens.push({ key, from, to: target, t: 0, d: Math.max(1e-4, duration), ease: ease || ((x) => x * x * (3 - 2 * x)), done });
    return p;
  }

  /** Snap every running tween to its destination. Used by skip. */
  finish() {
    for (const t of this._tweens) { this.values[t.key] = t.to; t.done?.(); }
    this._tweens.length = 0;
    return this;
  }

  clear() {
    for (const t of this._tweens) t.done?.();
    this._tweens.length = 0;
    this.values = {};
    this.colors = {};
    return this;
  }

  /** Fade this layer's whole contribution out, then drop it from the deck. */
  async retire(duration = 0.35) {
    const keys = Object.keys(this.values);
    await Promise.all(keys.map((k) => this.to(k, MUL.includes(k) ? 1 : 0, duration)));
    this.deck.drop(this.name);
  }

  _tick(dt) {
    if (!this._tweens.length) return;
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const t = this._tweens[i];
      t.t += dt;
      const k = t.t >= t.d ? 1 : t.t / t.d;
      this.values[t.key] = t.from + (t.to - t.from) * t.ease(k);
      if (k >= 1) { this._tweens.splice(i, 1); t.done?.(); }
    }
  }
}

export default GradeDeck;
