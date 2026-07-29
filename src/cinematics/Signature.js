/**
 * The three set-pieces the game is actually about.
 *
 *   impossibleDoor  a door that opens onto somewhere it cannot open onto
 *   entityReveal    the first sight of the Surveyor
 *   transformation  a corridor changing while the player is standing in it
 *
 * They share one discipline: the camera never cuts and never stops moving, and
 * the thing that sells the effect is always a *light*, never a jolt. If any of
 * these three needs a shake or a sting to land, it has been staged wrong.
 */

import { frame, once } from './helpers.js';
import { circuit } from './helpers.js';

const EYE = 1.62;

/**
 * The impossible door.
 *
 * The whole trick is that the shot has no seam to look for. One continuous
 * push through a doorway, and at the single frame where the leaf fills the
 * lens, the world behind it becomes somewhere else and the far bank of
 * fluorescents strikes. The strike is the misdirection: the eye goes to the new
 * light, not to the geometry.
 *
 * Then the camera *keeps going* and gives the player four full seconds of the
 * wrong room before handing control back, so they have to sit in it.
 *
 * @param {object} params
 *   { origin?, yaw?, onSwap?, fromCircuit?, toCircuit?, subtitle? }
 */
export function impossibleDoor(ctx, params = {}) {
  const f = frame(ctx, params);
  const swap = once(() => {
    params.onSwap?.(ctx);
    if (params.fromCircuit) circuit(ctx, params.fromCircuit, false);
  });

  return ctx.track('impossible:door', { duration: 10.6, skippable: false })
    .lock({ control: true, look: true, freeze: true })

    .audio(0.0, 'door/handle_slow')
    .grade(0.0, { uDread: 0.05 }, 1.5)
    .audio(0.9, 'door/swing_slow')

    // One move. Four keys. It does not stop.
    .camera(0.10, 9.6, [
      { pos: f.at(-1.3, 0, 0), look: f.at(4.0, 0, 0), fov: 66 },
      { pos: f.at(-0.2, 0.02, 0), look: f.at(4.8, 0.02, 0), fov: 64.5 },
      { pos: f.at(0.75, 0, 0), look: f.at(5.6, 0, 0), fov: 64 },
      { pos: f.at(2.6, 0, 0.02), look: f.at(9.0, 0.15, 0.1), fov: 65 },
      { pos: f.at(5.4, 0, 0), look: f.at(13.0, 0.1, -0.4), fov: 66 },
      { pos: f.at(7.2, 0, 0), look: f.at(15.0, 0, 1.2), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    // The leaf. 0.26 s — long enough to hide a zone rebuild, short enough that
    // the eye reads it as a door and not as a fade.
    .grade(2.10, { uExposure: 0.06 }, 0.26, 'in')
    .cue(2.38, swap)

    // The single lighting beat. Everything in the shot is spent on this.
    .cue(2.44, (c) => circuit(c, params.toCircuit || 'impossible_far', true))
    .audio(2.44, 'impossible/bank_strike')
    .grade(2.42, { uExposure: 1.42 }, 0.34, 'out')
    .grade(2.80, { uExposure: 1 }, 1.9)

    .audio(3.1, 'impossible/room_tone', { loop: true, fadeIn: 2.0 })
    .grade(3.2, { uDread: 0.30, uAberration: 0.6 }, 3.4)
    .caption(3.6, params.subtitle || 'the corridor behind you is not there any more',
      { sound: true, hint: 'behind you', duration: 4.2 })
    .grade(7.4, { uDread: 0.14, uAberration: 0.2 }, 2.6)

    .handOff(8.4)
    .onEnd((c) => { swap(); circuit(c, params.toCircuit || 'impossible_far', true); });
}

/**
 * The first sight of the Surveyor.
 *
 * Rules from the bible, obeyed literally: far away, still, briefly lit, and
 * then the light goes out. No shake, no flash, no sting, no approach. The
 * player is not allowed to be certain.
 *
 * Staging: the camera pushes in 0.7 m over five seconds and narrows from 66 to
 * 57 degrees. That is the exact grammar of noticing something — the frame
 * closes on it without the body moving much — and it is why the shot does not
 * need a single loud element.
 *
 * The light is on for 2.4 seconds. That is enough to see a silhouette at 26 m
 * and not enough to resolve it.
 *
 * @param {object} params
 *   { origin?, yaw?, entity?: [x,y,z], circuit?, dark?: boolean }
 */
export function entityReveal(ctx, params = {}) {
  const f = frame(ctx, params);
  const target = params.entity || f.at(26, 0.6, 0.3);
  const bank = params.circuit || 'intake_far';

  return ctx.track('entity:reveal', { duration: 11.2, skippable: false })
    .lock({ control: true, look: true, freeze: true })

    // It announces itself first. Three seconds of whine before anything is lit.
    .audio(0.2, 'surveyor/whine_far', { distance: 26 })
    .caption(0.4, 'a transformer whine, rising', { sound: true, hint: 'ahead, far off', duration: 3.4 })
    .grade(0.4, { uDread: 0.16 }, 2.6)

    .camera(0.10, 9.4, [
      { pos: f.at(0, 0, 0), look: target, fov: 66 },
      { pos: f.at(0.3, 0, 0.01), look: target, fov: 62 },
      { pos: f.at(0.55, 0, 0.005), look: target, fov: 58.5 },
      { pos: f.at(0.72, 0, 0), look: target, fov: 57 },
      { pos: f.at(0.78, 0, 0), look: target, fov: 57.5 },
    ], 'inOutSine', { from: 'current' })

    // Lit. 2.4 s. The restrike is ugly and mechanical on purpose — this is a
    // fluorescent bank finding itself, not a spotlight cueing a monster.
    .cue(3.1, (c) => circuit(c, bank, true))
    .audio(3.1, 'intake/ballast_strike', { far: true })
    .grade(3.1, { uExposure: 1.10 }, 0.7)
    .cue(3.4, (c) => c.ui?.subtitle?.({ text: 'a fluorescent bank strikes, far down the corridor',
      sound: true, hint: 'ahead, far off', duration: 3.0 }))

    // Out.
    .cue(5.5, (c) => circuit(c, bank, false))
    .audio(5.5, 'intake/ballast_die')
    .grade(5.5, { uExposure: 0.74 }, 0.9)
    .grade(5.5, { uDread: 0.44, uVignette: 0.12 }, 2.2)

    // The eye takes its time coming back, which is the doubt.
    .grade(6.6, { uExposure: 1 }, 3.2)
    .cue(6.0, (c) => { if (c.player) c.player.fear = Math.max(c.player.fear ?? 0, 0.45); })
    .audio(6.2, 'surveyor/whine_fade')
    .grade(8.4, { uDread: 0.18, uVignette: 0 }, 2.4)

    .handOff(8.0)
    .onEnd((c) => { circuit(c, bank, false); });
}

/**
 * A corridor changing while the player is inside it.
 *
 * The building's rule is that it only rearranges rooms nobody is looking at, so
 * the sequence is built entirely out of what is *not* in frame. A sound behind
 * turns the camera; while it is turned, the corridor ahead is re-dressed; when
 * it turns back, the change has already happened and there is nothing to catch.
 *
 * Two swaps, one in each direction, so the player cannot resolve which end
 * moved. `onSwapAhead` and `onSwapBehind` are both optional.
 */
export function transformation(ctx, params = {}) {
  const f = frame(ctx, params);
  const swapBehind = once(() => params.onSwapBehind?.(ctx));
  const swapAhead = once(() => params.onSwapAhead?.(ctx));

  return ctx.track('world:transform', { duration: 11.4, skippable: false })
    .lock({ control: true, look: true, freeze: true })

    .audio(0.0, 'annex/settle_deep')
    .grade(0.2, { uWarp: 0.10, uDread: 0.18 }, 1.6)

    // Something behind. The turn is fast to start and slow to arrive, which is
    // how a head actually turns toward a sound.
    .audio(0.9, 'annex/door_shut_behind', { distance: 9 })
    .caption(1.0, 'a door shuts', { sound: true, hint: 'behind you', duration: 2.6 })

    // The turn. Look targets sit on a fixed 6 m circle at even 45 degree
    // intervals: constant radius and constant angular spacing are what keep the
    // pan rate even. Uneven keys make the camera lurch through the middle of
    // the turn, which reads as a whip-pan rather than as a head turning.
    .camera(1.15, 3.1, [
      { pos: f.at(0, 0, 0), look: f.at(6.00, 0.00, 0), fov: 66 },
      { pos: f.at(0, 0, 0.004), look: f.at(4.24, 4.24, 0), fov: 66.5 },
      { pos: f.at(0, 0, 0.010), look: f.at(0.00, 6.00, 0), fov: 67 },
      { pos: f.at(-0.03, 0, 0.004), look: f.at(-4.24, 4.24, 0), fov: 67.5 },
      { pos: f.at(-0.05, 0, 0), look: f.at(-6.00, 0.30, 0), fov: 68 },
    ], 'inOut')

    // Facing away. This is the window.
    .cue(2.6, swapAhead)
    .audio(2.6, 'annex/structure_shift', { masked: true })

    .grade(3.0, { uDread: 0.34 }, 2.0)
    .cue(3.4, (c) => c.ui?.subtitle?.({ text: 'nothing there', sound: true, hint: 'behind you', duration: 2.4 }))

    // Hold on the empty end of the corridor a beat too long.
    .camera(4.25, 1.95, [
      { pos: f.at(-0.05, 0, 0), look: f.at(-6.00, 0.30, 0), fov: 68 },
      { pos: f.at(-0.12, 0, 0.01), look: f.at(-6.00, 0.60, 0.10), fov: 67 },
    ], 'inOutSine')

    // Back. Slower than the turn away — reluctance reads as duration.
    .camera(6.2, 3.6, [
      { pos: f.at(-0.12, 0, 0.010), look: f.at(-6.00, 0.60, 0.10), fov: 67 },
      { pos: f.at(-0.09, 0, 0.008), look: f.at(-4.24, -4.24, 0.06), fov: 66.5 },
      { pos: f.at(-0.05, 0, 0.004), look: f.at(0.00, -6.00, 0.02), fov: 66 },
      { pos: f.at(-0.02, 0, 0.002), look: f.at(4.24, -4.24, 0), fov: 66 },
      { pos: f.at(0, 0, 0), look: f.at(6.00, 0.00, 0), fov: 66 },
    ], 'inOutSine')

    .cue(7.4, swapBehind)
    .grade(9.0, { uDread: 0.22, uWarp: 0.04 }, 2.2)
    .cue(9.2, (c) => { if (c.player) c.player.fear = Math.max(c.player.fear ?? 0, 0.35); })

    .handOff(9.4)
    .onEnd((c) => { swapAhead(); swapBehind(); });
}

export default { impossibleDoor, entityReveal, transformation };
