/**
 * The goods lift.
 *
 * A lift is the best transition device a building can give you: it is a sealed
 * box with a known interior, it takes a believable amount of time, and it makes
 * a lot of noise. Everything expensive can happen inside it.
 *
 * This sequence refuses to cheat the duration. The car takes fourteen seconds
 * between levels and the camera stays in it for all fourteen, drifting on the
 * car's suspension with the strip light buzzing. Nothing else in the game asks
 * the player to stand still for that long, which is exactly why it works.
 *
 * `params.onSwap` is called at 6.2 s, mid-travel, with the gate shut and the
 * car light the only thing in frame.
 */

import { frame, once } from './helpers.js';
import { circuit } from './helpers.js';

const EYE = 1.62;

/**
 * @param {object} params
 *   { origin?, yaw?, onSwap?, travel?, direction?: 'up'|'down',
 *     carCircuit?, arriveCircuit?, departCircuit? }
 */
export function liftRide(ctx, params = {}) {
  const f = frame(ctx, params);
  const travel = params.travel ?? 14;
  const up = params.direction !== 'down';
  const swap = once(() => {
    params.onSwap?.(ctx);
    if (params.departCircuit) circuit(ctx, params.departCircuit, false);
    if (params.arriveCircuit) circuit(ctx, params.arriveCircuit, true);
  });

  const t = ctx.track('lift', { duration: travel + 9.4 })
    .lock({ control: true, look: false, freeze: true })

    // -- gate ------------------------------------------------------------
    .audio(0.0, 'lift/gate_grab')
    .audio(0.35, 'lift/gate_close')
    .shake(1.85, 0.22, 4.0)
    .audio(1.90, 'lift/gate_seat')
    .cue(2.0, (c) => circuit(c, params.carCircuit || 'lift_car', true))
    .audio(2.05, 'lift/car_lamp_strike')

    // Look is locked but the head is not welded: the car sways on its ropes
    // for the whole ride, which is the only motion in a fourteen-second shot.
    .camera(0.1, 2.6, [
      { pos: f.at(0, 0, 0), look: f.at(3.4, 0.1, -0.1), fov: 66 },
      { pos: f.at(0.05, 0.02, 0.01), look: f.at(3.4, 0.05, -0.06), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    // -- departure -------------------------------------------------------
    .audio(2.6, 'lift/contactor')
    .shake(3.0, 0.34, 2.2)
    .audio(3.05, 'lift/motor_start')
    .audio(3.4, 'lift/run', { loop: true })
    .grade(3.0, { uGrain: 0.010 }, 1.2)

    .camera(2.9, travel + 1.2, [
      { pos: f.at(0.05, 0.02, 0.01), look: f.at(3.4, 0.05, -0.06), fov: 66 },
      { pos: f.at(0.02, -0.03, 0.05), look: f.at(3.5, -0.10, 0.02), fov: 66 },
      { pos: f.at(0.07, 0.04, -0.02), look: f.at(3.3, 0.12, -0.05), fov: 66.5 },
      { pos: f.at(0.01, -0.02, 0.03), look: f.at(3.5, -0.06, 0.04), fov: 66 },
      { pos: f.at(0.04, 0.01, 0.00), look: f.at(3.4, 0.02, 0.00), fov: 66 },
    ], 'inOutSine');

  // Passing floors — one every ~3.2 s. The audio agent gets an index so it can
  // pan a wash past the car and put a strip of light across the gate.
  const passes = Math.max(1, Math.floor((travel - 2) / 3.2));
  for (let i = 0; i < passes; i++) {
    const at = 4.4 + i * 3.2;
    t.audio(at, 'lift/pass_floor', { index: i, up });
    t.grade(at, { uExposure: 1.14 }, 0.22, 'out');
    t.grade(at + 0.24, { uExposure: 1 }, 0.5);
  }

  // -- the swap, mid-travel, gate shut --------------------------------------
  t.cue(Math.min(6.2, 3.0 + travel * 0.4), swap)
    .audio(Math.min(6.2, 3.0 + travel * 0.4), 'lift/shaft_change')

    // -- arrival -----------------------------------------------------------
    .audio(travel + 2.4, 'lift/motor_stop')
    .shake(travel + 3.0, 0.30, 3.2)
    .audio(travel + 3.05, 'lift/arrest')
    .grade(travel + 3.0, { uExposure: 0.82 }, 0.45)
    .grade(travel + 3.6, { uExposure: 1 }, 1.2)
    .audio(travel + 4.2, 'lift/gate_open')

    .camera(travel + 3.9, 4.6, [
      { pos: f.at(0.04, 0.01, 0), look: f.at(3.4, 0.02, 0), fov: 66 },
      { pos: f.at(0.9, 0, 0), look: f.at(4.6, 0.05, 0.05), fov: 66 },
      { pos: f.at(2.3, 0, 0), look: f.at(7.0, 0, 0), fov: 66 },
    ], 'inOutSine')

    .handOff(travel + 6.2)
    .onEnd((c) => { swap(); circuit(c, params.carCircuit || 'lift_car', true); });

  return t;
}

/**
 * Gate only — used when the player calls the car and has to wait for it. Short,
 * and it does not take control: it is a camera nudge and a sound, not a scene.
 */
export function liftCall(ctx, params = {}) {
  const f = frame(ctx, params);
  return ctx.track('lift:call', { duration: 5.2, skippable: true })
    .lock({ control: false, look: false, freeze: false })
    .audio(0.0, 'lift/call_button')
    .audio(0.4, 'lift/shaft_distant', { loop: true })
    .cue(0.5, (c) => c.ui?.subtitle?.({ text: 'the car starts somewhere above you', sound: true, hint: 'above, distant' }))
    .audio(4.4, 'lift/arrive_distant')
    .grade(0.2, { uDread: 0.06 }, 2.0)
    .grade(4.4, { uDread: 0 }, 0.8);
}

export default liftRide;
