/**
 * Zone transitions.
 *
 * Rule for the whole file: the player never sees the seam. Every zone swap
 * happens in a window where the frame is already accounted for — a door leaf
 * crossing the lens, a stair turn, a light striking, an audio wash that starts
 * before the change and finishes after it. `params.onSwap` is invoked exactly
 * once, inside that window, and is where the world agent tears down one zone
 * and stands up the next.
 *
 * Two reusable transitions cover most of the building:
 *
 *   through:door    a leaf swings across frame, 4.4 s
 *   through:hatch   a crouch through 0.8 m of steel, 5.6 s
 *
 * and each major boundary gets a bespoke one on top, because arriving in the
 * Cistern should not feel like arriving in the Residence.
 *
 * Every sequence hands control back while still moving, and every one of them
 * calls `onSwap` from `onEnd` too if it was skipped, so a skipped transition
 * can never leave the player in the zone they were trying to leave.
 */

import { frame, once } from './helpers.js';
import { circuit } from './helpers.js';

const EYE = 1.62;

/**
 * "Through the door" — the workhorse.
 * @param {object} params { origin?, yaw?, onSwap?, fromCircuit?, toCircuit?, depth? }
 */
export function throughDoor(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => {
    params.onSwap?.(ctx);
    if (params.fromCircuit) circuit(ctx, params.fromCircuit, false);
    if (params.toCircuit) circuit(ctx, params.toCircuit, true);
  });
  const d = params.depth ?? 2.4;

  return ctx.track('through:door', { duration: 4.4 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'door/handle')
    .audio(0.55, 'door/swing_slow')

    .camera(0.10, 4.05, [
      { pos: f.at(-0.9, 0, EYE - 1.62), look: f.at(4.0, 0, EYE), fov: 66 },
      { pos: f.at(0.05, 0.02, EYE - 1.62), look: f.at(4.6, 0.05, EYE), fov: 65 },
      { pos: f.at(0.85, 0, EYE - 1.62), look: f.at(5.2, 0, EYE - 0.04), fov: 65.5 },
      { pos: f.at(d + 0.9, 0, EYE - 1.62), look: f.at(d + 6, 0, EYE), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    // The leaf crosses the lens. 0.30 s of near-black is a door, not a cut.
    .grade(1.62, { uExposure: 0.16 }, 0.30, 'in')
    .cue(1.95, swap)
    .audio(1.95, 'door/latch_pass')
    .grade(1.98, { uExposure: 1 }, 0.62, 'out')

    .handOff(3.05)
    .onEnd((c) => { swap(); });
}

/**
 * "Through the hatch" — a crouch through 0.8 m of galvanised steel. Slower,
 * lower, and it keeps the vignette closed for a beat after control returns so
 * the duct still feels like a duct when the player takes over.
 */
export function throughHatch(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => {
    params.onSwap?.(ctx);
    if (params.fromCircuit) circuit(ctx, params.fromCircuit, false);
    if (params.toCircuit) circuit(ctx, params.toCircuit, true);
  });

  return ctx.track('through:hatch', { duration: 5.6 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'hatch/dog_release')
    .audio(0.9, 'hatch/hinge')

    .camera(0.10, 5.2, [
      { pos: f.at(-0.8, 0, EYE - 1.62), look: f.at(3.2, 0, EYE - 0.5), fov: 66 },
      { pos: f.at(0.1, 0, 0.94 - 1.62), look: f.at(2.4, 0, 0.86 - 1.62), roll: 0.05, fov: 68 },
      { pos: f.at(1.0, 0.02, 0.82 - 1.62), look: f.at(3.0, 0.03, 0.80 - 1.62), roll: -0.04, fov: 70 },
      { pos: f.at(2.2, 0, 0.90 - 1.62), look: f.at(4.6, 0, 1.10 - 1.62), roll: 0.02, fov: 68 },
      { pos: f.at(3.1, 0, 1.02 - 1.62), look: f.at(6.4, 0, EYE - 0.2), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    .grade(0.4, { uVignette: 0.26 }, 1.4)
    .grade(2.05, { uExposure: 0.12 }, 0.34, 'in')
    .cue(2.42, swap)
    .audio(2.42, 'hatch/interior_bridge')
    .grade(2.46, { uExposure: 1 }, 0.70, 'out')
    .grade(4.2, { uVignette: 0.10 }, 1.6)

    .handOff(4.05)
    .onEnd((c) => { swap(); });
}

// ---------------------------------------------------------------------------
// Bespoke boundaries
// ---------------------------------------------------------------------------

/**
 * Service spine -> The Cistern. A stair with a half-landing. The swap happens
 * on the turn, when the camera is looking at a blank concrete wall, and the
 * water wash starts one and a half seconds *before* it so the sound arrives
 * before the room does.
 */
export function toCistern(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => { params.onSwap?.(ctx); circuit(ctx, params.toCircuit || 'cistern_bulk', true); });

  return ctx.track('zone:cistern', { duration: 8.6 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'stair/step_concrete')
    .audio(1.1, 'cistern/water_wash', { fadeIn: 3.2, loop: true })

    .camera(0.1, 3.6, [
      { pos: f.at(-0.6, 0, 0), look: f.at(3.0, 0, -0.9), fov: 66 },
      { pos: f.at(1.2, 0, -0.62), look: f.at(4.2, 0, -2.0), fov: 66 },
      { pos: f.at(2.6, 0, -1.42), look: f.at(4.4, 1.6, -2.6), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    // The turn. Nothing readable in frame for 0.8 s — that is the window.
    .camera(3.7, 2.3, [
      { pos: f.at(2.6, 0, -1.42), look: f.at(4.4, 1.6, -2.6), fov: 66 },
      { pos: f.at(3.2, 0.5, -1.75), look: f.at(3.6, 2.4, -2.2), fov: 67 },
      { pos: f.at(3.4, 1.5, -2.10), look: f.at(1.0, 2.6, -3.4), fov: 67 },
    ], 'inOut')
    .cue(4.5, swap)
    .audio(4.5, 'cistern/reverb_bridge')

    .camera(6.0, 2.5, [
      { pos: f.at(3.4, 1.5, -2.10), look: f.at(1.0, 2.6, -3.4), fov: 67 },
      { pos: f.at(3.0, 2.4, -2.55), look: f.at(-1.5, 3.0, -3.6), fov: 66 },
      { pos: f.at(2.4, 3.4, -2.85), look: f.at(-4.0, 3.4, -3.2), fov: 66 },
    ], 'inOutSine')

    .grade(4.4, { uSaturation: 0.88, uVignette: 0.08 }, 3.0)
    .audio(6.6, 'cistern/wade_first')
    .handOff(6.9)
    .onEnd((c) => { swap(); });
}

/**
 * Service spine -> The Residence. A fire door with a closer on it. The pendant
 * on the far side strikes as the door opens: warm, domestic, and completely
 * wrong two floors under a council office.
 */
export function toResidence(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => { params.onSwap?.(ctx); });

  return ctx.track('zone:residence', { duration: 6.4 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'door/fire_bar')
    .audio(0.5, 'door/closer_hiss')

    .camera(0.1, 6.0, [
      { pos: f.at(-1.1, 0, 0), look: f.at(4.0, 0, 0), fov: 66 },
      { pos: f.at(0.2, 0.03, 0), look: f.at(4.6, 0.1, 0), fov: 65 },
      { pos: f.at(1.5, 0, 0), look: f.at(5.4, 0.15, 0.1), fov: 65 },
      { pos: f.at(3.4, 0, 0), look: f.at(8.0, 0.1, 0), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    .grade(1.5, { uExposure: 0.14 }, 0.34, 'in')
    .cue(1.86, swap)
    .cue(1.90, (c) => circuit(c, params.toCircuit || 'residence_pendant', true))
    .audio(1.92, 'residence/pendant_strike')
    .grade(1.92, { uExposure: 1.18 }, 0.55, 'out')
    .grade(2.6, { uExposure: 1 }, 1.6)
    .audio(2.4, 'residence/carpet_dead')
    .grade(2.4, { uSaturation: 0.94 }, 2.4)

    .handOff(4.4)
    .onEnd((c) => { swap(); });
}

/**
 * Anywhere -> The Plant. The reveal is vertical: the camera comes through a
 * personnel door at head height and then *tilts up* through fourteen metres of
 * volume while three high-bay sodium lamps strike in series. The eye is led up
 * by light, which is the only honest way to sell scale.
 */
export function toPlant(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => { params.onSwap?.(ctx); });
  const bays = params.bays || ['plant_bay_a', 'plant_bay_b', 'plant_bay_c'];

  return ctx.track('zone:plant', { duration: 9.4 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'door/steel_heavy')

    .camera(0.1, 3.0, [
      { pos: f.at(-1.0, 0, 0), look: f.at(4.0, 0, 0), fov: 66 },
      { pos: f.at(0.6, 0, 0), look: f.at(5.0, 0, 0), fov: 65 },
      { pos: f.at(1.9, 0, 0), look: f.at(7.0, 0.4, 0), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    .grade(1.15, { uExposure: 0.12 }, 0.30, 'in')
    .cue(1.48, swap)
    .grade(1.52, { uExposure: 0.42 }, 0.5, 'out')
    .audio(1.55, 'plant/room_tone', { loop: true })

    // Three strikes, 0.9 s apart, each with its own restrike thump.
    .cue(2.4, (c) => circuit(c, bays[0], true)).audio(2.4, 'plant/highbay_strike', { index: 0 })
    .grade(2.4, { uExposure: 0.72 }, 0.7)
    .cue(3.3, (c) => circuit(c, bays[1], true)).audio(3.3, 'plant/highbay_strike', { index: 1 })
    .grade(3.3, { uExposure: 0.9 }, 0.7)
    .cue(4.2, (c) => circuit(c, bays[2], true)).audio(4.2, 'plant/highbay_strike', { index: 2 })
    .grade(4.2, { uExposure: 1 }, 0.9)

    // The tilt. Slow, long, and it never reaches the ceiling — the volume has
    // to feel unresolved.
    .camera(2.2, 6.4, [
      { pos: f.at(1.9, 0, 0), look: f.at(7.0, 0.4, 0), fov: 66 },
      { pos: f.at(3.4, 0, 0.05), look: f.at(9.0, 0.6, 3.2), fov: 68 },
      { pos: f.at(5.0, 0, 0.10), look: f.at(11.0, 0.8, 8.4), fov: 71 },
      { pos: f.at(6.2, 0, 0.06), look: f.at(13.0, 0.6, 6.0), fov: 69 },
    ], 'inOutSine')

    .caption(3.0, 'generator hall — plant running', { sound: true, hint: 'all around you', duration: 3.6 })
    .handOff(7.2)
    .onEnd((c) => { swap(); for (const b of bays) circuit(c, b, true); });
}

/**
 * Anywhere -> The Stack. Vertigo, done with lens and roll rather than motion:
 * the camera holds nearly still, the FOV opens from 66 to 79 and the horizon
 * rolls four degrees over six seconds. The floors above and below do the rest.
 */
export function toStack(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => { params.onSwap?.(ctx); });

  return ctx.track('zone:stack', { duration: 8.0 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'stack/pressure_shift')

    .camera(0.1, 2.4, [
      { pos: f.at(-0.7, 0, 0), look: f.at(4.0, 0, 0), fov: 66 },
      { pos: f.at(0.9, 0, 0), look: f.at(5.0, 0, 0), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    .grade(1.05, { uExposure: 0.10 }, 0.26, 'in')
    .cue(1.34, swap)
    .grade(1.36, { uExposure: 1 }, 0.60, 'out')

    .camera(1.9, 5.6, [
      { pos: f.at(0.9, 0, 0), look: f.at(5.0, 0, 0), fov: 66, roll: 0 },
      { pos: f.at(1.5, 0, 0.06), look: f.at(5.4, 0, 2.6), fov: 71, roll: 0.026 },
      { pos: f.at(1.9, 0, 0.02), look: f.at(5.6, 0, -3.0), fov: 76, roll: 0.062 },
      { pos: f.at(2.1, 0, 0.04), look: f.at(6.0, 0, 0.4), fov: 79, roll: 0.070 },
    ], 'inOutSine')

    .grade(2.0, { uDread: 0.28, uWarp: 0.16 }, 4.0)
    .caption(3.4, 'the floors do not stop', { sound: true, hint: 'above and below', duration: 3.6 })
    .handOff(6.2)
    .onEnd((c) => { swap(); });
}

/**
 * Anywhere -> Ductwork. Short, tight, and it leaves the vignette closed: this
 * is the only transition that deliberately hands back a degraded frame,
 * because the duct is a degraded place and the player should feel the lid come
 * down on them.
 */
export function toDuct(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => { params.onSwap?.(ctx); if (params.fromCircuit) circuit(ctx, params.fromCircuit, false); });

  return ctx.track('zone:duct', { duration: 5.2 })
    .lock({ control: true, look: true, freeze: true })
    .audio(0.0, 'duct/panel_off')

    .camera(0.1, 4.9, [
      { pos: f.at(-0.6, 0, 0), look: f.at(3.0, 0, -0.4), fov: 66 },
      { pos: f.at(0.3, 0, -0.62), look: f.at(2.4, 0, -0.66), fov: 68, roll: 0.03 },
      { pos: f.at(1.2, 0.04, -0.70), look: f.at(3.4, 0.04, -0.72), fov: 71, roll: -0.02 },
      { pos: f.at(2.4, 0, -0.68), look: f.at(5.0, 0, -0.66), fov: 70 },
    ], 'inOutSine', { from: 'current' })

    .grade(0.3, { uVignette: 0.30, uSaturation: 0.82 }, 1.8)
    .grade(1.45, { uExposure: 0.08 }, 0.28, 'in')
    .cue(1.76, swap)
    .audio(1.76, 'duct/steel_bridge')
    .grade(1.80, { uExposure: 0.9 }, 0.55, 'out')
    .audio(2.6, 'duct/breath_close')

    .handOff(3.4)
    .onEnd((c) => { swap(); });
}

export const TRANSITIONS = {
  'through:door': throughDoor,
  'through:hatch': throughHatch,
  'zone:cistern': toCistern,
  'zone:residence': toResidence,
  'zone:plant': toPlant,
  'zone:stack': toStack,
  'zone:duct': toDuct,
};

export default TRANSITIONS;
