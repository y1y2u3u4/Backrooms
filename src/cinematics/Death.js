/**
 * Capture, and waking up afterwards.
 *
 * Capture is the one place in the whole game where a hard cut is allowed,
 * because discontinuity *is* the device: the Surveyor reaches the player, the
 * frame degrades continuously for four seconds, and then it stops being a frame
 * at all. A plate of white noise, held two and a bit seconds — long enough to
 * be uncomfortable, short enough that it does not read as a crash.
 *
 * Per the bible, the Surveyor does not scream and does not lunge. It arrives.
 * The horror is in the tilt: control goes first, then the horizon, then the
 * picture.
 *
 * Respawn is the mirror image, and deliberately slow. Waking up in the Office
 * of Record takes seven seconds, most of which is the exposure crawling back.
 */

import { frame } from './helpers.js';
import { circuit } from './helpers.js';

const EYE = 1.62;

/**
 * @param {object} params { entity?: [x,y,z], cause?: string, origin?, yaw? }
 */
export function capture(ctx, params = {}) {
  const f = frame(ctx, params);
  const at = params.entity || f.at(2.6, 0.1, 0.5);

  return ctx.track('capture', { duration: 8.2, skippable: false })
    .lock({ control: true, look: true, freeze: true })

    .audio(0.0, 'surveyor/whine_close')
    .cue(0.0, (c) => { if (c.player) c.player.fear = 1; })
    .cue(0.0, (c) => c.ui?.hideHud?.(true))

    // Degrade. Every channel moves together and none of them snaps.
    .grade(0.0, { uDread: 1.0 }, 2.4)
    .grade(0.1, { uWarp: 0.85, uSaturation: 0.34 }, 2.9)
    .grade(1.1, { uVignette: 0.34, uAberration: 1.6 }, 2.2)
    .grade(2.2, { uGrain: 0.055 }, 1.6)

    // The tilt. The camera sinks 0.4 m and rolls 24 degrees over 3.6 s while
    // holding the entity in frame. It is not a fall; it is being put down.
    .camera(0.05, 3.85, [
      { pos: f.at(0, 0, 0), look: at, fov: 66, roll: 0 },
      { pos: f.at(-0.10, 0.02, -0.06), look: at, fov: 63, roll: 0.06 },
      { pos: f.at(-0.22, 0.05, -0.20), look: at, fov: 60, roll: 0.20 },
      { pos: f.at(-0.30, 0.06, -0.40), look: at, fov: 58, roll: 0.42 },
    ], 'inOut')

    .audio(2.5, 'surveyor/blade_extend')
    .audio(3.5, 'surveyor/measure')

    // ---- the cut ---------------------------------------------------------
    // Instant, on purpose, and the only one in the game.
    .cue(3.90, (c) => {
      c.grade.finish();
      c.grade.set({
        uFlash: 0.94, flashColor: 0xf2f0ea,
        uScanline: 0.95, uGrain: 0.62, uInvert: 0.10,
        uWarp: 0, uDread: 0, uAberration: 0, uVignette: 0, uSaturation: 1, uExposure: 1,
      });
    })
    .audio(3.90, 'noise/plate_on')

    // Held slightly too long.
    .cue(4.6, (c) => c.grade.set({ uGrain: 0.48, uScanline: 0.78 }))
    .cue(5.4, (c) => c.grade.set({ uGrain: 0.66, uInvert: 0.04 }))

    .cue(6.15, (c) => {
      c.grade.set({ uFlash: 0, uScanline: 0, uGrain: 0, uInvert: 0 });
      c.grade.set({ uFade: 1, fadeColor: 0x000000 });
    })
    .audio(6.15, 'noise/plate_off')

    .cue(6.9, (c) => c.ui?.show?.('death', { cause: params.cause || 'surveyor', location: params.location }))
    .hold(8.2)

    .onEnd((c) => {
      // The death screen owns the black from here; the sequence layer must not
      // fight it, and must not leave a plate of noise on screen if skipped.
      c.grade.clear();
      c.ui?.hideHud?.(false);
      if (c.player) { c.player.fear = 0; c.player.frozen = true; }
      c.bus?.emit('game:death', { cause: params.cause || 'surveyor' });
    });
}

/**
 * Waking in the Office of Record.
 *
 * The exposure recovery is the whole sequence: 0.30 to 1.0 over four and a half
 * seconds with the saturation trailing it, which is what an eye actually does
 * and which no amount of camera movement can fake. The camera only has to right
 * itself, slowly, from a head on a desk.
 *
 * @param {object} params { origin?, yaw?, deskLook?, circuit? }
 */
export function respawn(ctx, params = {}) {
  const f = frame(ctx, params);

  return ctx.track('respawn', { duration: 8.6, skippable: true })
    .lock({ control: true, look: true, freeze: true })

    .cue(0.0, (c) => {
      c.grade.set({ uFade: 1, fadeColor: 0x000000, uExposure: 0.30, uSaturation: 0.42, uVignette: 0.30 });
      c.ui?.hide?.('death');
      c.ui?.hideHud?.(true);
      if (c.player) c.player.fear = 0;
    })
    .cue(0.05, (c) => circuit(c, params.circuit || 'office_lamp', true))
    .audio(0.1, 'office/lamp_hum', { loop: true })
    .audio(0.6, 'office/kettle_settle')

    .grade(0.7, { uFade: 0 }, 2.8, 'fade')
    .grade(1.0, { uExposure: 1 }, 4.6, 'smoother')
    .grade(1.4, { uSaturation: 1 }, 4.0)
    .grade(2.6, { uVignette: 0 }, 3.2)

    // Head off the desk. Roll and pitch unwind at different rates, which is
    // what stops it reading as a mechanical gimbal.
    .camera(0.10, 6.4, [
      { pos: f.at(0, 0, -0.62), look: f.at(0.9, 0.35, -0.86), fov: 70, roll: 0.30 },
      { pos: f.at(0, 0, -0.44), look: f.at(1.6, 0.22, -0.72), fov: 69, roll: 0.22 },
      { pos: f.at(-0.04, 0, -0.18), look: f.at(2.6, 0.06, -0.34), fov: 67.5, roll: 0.09 },
      { pos: f.at(0, 0, 0), look: f.at(4.2, 0, -0.06), fov: 66, roll: 0 },
    ], 'inOutSine')

    .audio(3.2, 'office/chair_creak')
    .caption(4.0, 'the kettle has boiled', { sound: true, hint: 'to your right, close', duration: 3.2 })
    .cue(5.0, (c) => c.ui?.hideHud?.(false))

    .handOff(6.0)
    .onEnd((c) => {
      c.ui?.hideHud?.(false);
      c.ui?.hide?.('death');
      if (c.player) { c.player.frozen = false; c.player.controlEnabled = true; c.player.lookEnabled = true; }
      c.bus?.emit('game:respawn', {});
    });
}

export default { capture, respawn };
