/**
 * Vitals — the parts of the HUD that are not on the screen.
 *
 * There is no stamina bar and no battery meter anywhere in the Annex. The rules
 * are:
 *
 *   stamina   the vignette closes and breathes with the player's breath phase,
 *             and saturation drops a little. Running out feels like tunnel
 *             vision because that is what it is.
 *   fear      the director's `player.fear` drives `uDread`, which is the one
 *             channel the grade allows to get loud.
 *   damage    a short desaturating warp punch. Never red, never a splatter.
 *   lamp      when the cell is low the lamp browns out for a fifth of a second
 *             at irregular intervals. That is the only battery UI there is;
 *             the lamp itself belongs to the gameplay agent.
 *
 * Everything is written to a GradeDeck layer, so a cinematic can take the same
 * uniforms without either system stamping on the other.
 */

import { clamp01, lerp } from '../cinematics/ease.js';

export function createVitals({ deck, player }) {
  const layer = deck.layer('vitals', 10);

  let breath = 0;
  let hurt = 0;
  let battery = 1;
  let brownout = 0;
  let nextBrownout = 5;
  let seed = 1337;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  return {
    layer,
    /** 0..1 remaining charge, pushed by whoever owns the lamp. */
    setLampBattery(v) { battery = clamp01(v); },
    /** A hit, a fall, a door slammed into your face. 0..1. */
    hurt(amount = 0.6) { hurt = Math.max(hurt, clamp01(amount)); },
    reset() { hurt = 0; brownout = 0; layer.clear(); },

    update(dt) {
      const p = player;
      const exertion = p ? clamp01(1 - p.stamina) : 0;
      const fear = p ? clamp01(p.fear) : 0;

      // Breath: reuse the player's own phase so the picture and the body agree.
      breath = p?._breathPhase ?? (breath + dt * lerp(0.72, 2.55, exertion) * Math.PI);
      const gasp = Math.sin(breath) * 0.5 + 0.5;

      hurt = Math.max(0, hurt - dt * 1.35);

      // Brown-outs. Irregular by design — a metronome would read as a UI tick.
      if (battery < 0.24) {
        nextBrownout -= dt * lerp(0.55, 2.4, 1 - battery / 0.24);
        if (nextBrownout <= 0) { brownout = 1; nextBrownout = 2.2 + rnd() * 4.5; }
      }
      brownout = Math.max(0, brownout - dt * 4.6);
      const dip = brownout * brownout;

      const staminaVig = exertion * exertion * (0.17 + gasp * 0.055);
      const hurtVig = hurt * 0.20;
      const lowCell = battery < 0.24 ? (1 - battery / 0.24) * 0.10 : 0;

      layer.set({
        uVignette: staminaVig + hurtVig + lowCell,
        uDread: fear * 0.85,
        uWarp: hurt * 0.55,
        uSaturation: 1 - exertion * 0.10 - hurt * 0.22,
        uExposure: 1 - dip * 0.34 - lowCell * 0.18,
        uGrain: hurt * 0.012 + lowCell * 0.010,
      });
    },
  };
}

export default createVitals;
