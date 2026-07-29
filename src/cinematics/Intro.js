/**
 * Intro — the descent into the Annex.
 *
 * Three beats and no more: a lift you are already inside, a corridor you walk
 * out into, and the floor.
 *
 * The floor is the whole point. The player steps out of the car onto loop
 * carpet, the camera drifts down to it while still moving forward — motivated,
 * because you look where you are putting your feet in a strange building — and
 * the carpet runs the wrong way relative to the doorway they just came through.
 * No music sting, no caption telling them. One lighting beat, one grade beat,
 * and then the camera lifts back up and quietly stops being the camera: control
 * arrives at 19.5 s while the dolly is still running to 23 s, so there is no
 * frame where the game says "you may move now".
 *
 * @param {object} ctx
 * @param {object} params  { origin?, yaw?, car?, corridor?, circuit? }
 */

import { frame } from './helpers.js';
import { circuit } from './helpers.js';

export function intro(ctx, params = {}) {
  const f = frame(ctx, params);
  const carA = params.car ? params.car : f.at(-3.2, 0, 0);   // inside the car
  const eye = 1.62;

  return ctx.track('intro', { duration: 23.5, skippable: true })
    .lock({ control: true, look: true, freeze: true })

    // Black, then the inside of a lift car that is already moving.
    .grade(0, { uFade: 1, fadeColor: 0x000000, uGrain: 0.012, uSaturation: 0.86 })
    .audio(0.0, 'intro/lift_running', { loop: true })
    .grade(0.6, { uFade: 0 }, 3.4)
    .grade(0.6, { uSaturation: 1 }, 6.0)

    .caption(1.6, 'goods lift, descending', { sound: true, hint: 'all around you', duration: 3.4 })

    // The car arrests. Small, heavy, low-frequency — not a jolt.
    .audio(4.6, 'lift/arrest')
    .shake(4.7, 0.30, 3.4)
    .grade(4.7, { uExposure: 0.86 }, 0.5)
    .grade(5.3, { uExposure: 1 }, 1.4)

    // Gate. The corridor's circuit strikes while the gate is still opening, so
    // the light arrives before the view does.
    .audio(6.0, 'lift/gate_open')
    .cue(6.4, (c) => circuit(c, params.circuit || 'intake_a', true))
    .audio(6.5, 'intake/ballast_strike')

    // Out of the car. One continuous dolly from here to the end of the shot.
    .camera(0, 6.6, [
      { pos: carA, look: f.at(6, 0, eye - 0.06), fov: 66 },
      { pos: [carA[0], carA[1], carA[2]], look: f.at(6, 0, eye - 0.02), fov: 66 },
    ], 'inOutSine', { from: null })

    .camera(6.6, 7.2, [
      { pos: carA, look: f.at(8, 0, eye), fov: 66 },
      { pos: f.at(-1.4, 0.06, 0), look: f.at(8, 0.4, eye), fov: 65 },
      { pos: f.at(1.6, 0.02, 0), look: f.at(9, 0.2, eye - 0.1), fov: 64 },
    ], 'inOut')

    // The floor. The look target drops to a point two metres ahead on the deck
    // while the body keeps moving — a glance down, not a cut to a detail shot.
    .camera(13.8, 3.4, [
      { pos: f.at(1.6, 0.02, 0), look: f.at(9, 0.2, eye - 0.1), fov: 64 },
      { pos: f.at(3.0, 0, -0.04), look: f.at(3.4, 0.1, 0.02), fov: 63 },
      { pos: f.at(4.1, 0, -0.05), look: f.at(5.0, -0.1, 0.0), fov: 63 },
    ], 'inOut')

    .audio(14.6, 'intro/floor_wrong')
    .grade(14.8, { uDread: 0.24 }, 2.6)
    .grade(15.0, { uAberration: 0.5 }, 2.0)

    // Back up to eye level, still walking.
    .camera(17.2, 6.3, [
      { pos: f.at(4.1, 0, -0.05), look: f.at(5.0, -0.1, 0.0), fov: 63 },
      { pos: f.at(5.6, 0, -0.02), look: f.at(11, 0.1, eye - 0.2), fov: 64.5 },
      { pos: f.at(7.4, 0, 0), look: f.at(14, 0, eye), fov: 66 },
    ], 'inOutSine')

    .grade(18.4, { uDread: 0.10, uAberration: 0 }, 4.0)

    // Control arrives with three and a half seconds of dolly left to run.
    .handOff(19.5, { control: false, velocity: [0, 0, 0] })
    .audio(19.5, 'intro/handover')

    .onEnd((c, r) => {
      if (c.player) { c.player.controlEnabled = true; c.player.lookEnabled = true; c.player.frozen = false; }
      c.ui?.objective?.('Restore three-phase supply — goods lift', '0 of 3 fuse cores');
      if (r.skipped) circuit(c, params.circuit || 'intake_a', true);
    });
}

export default intro;
