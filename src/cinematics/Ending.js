/**
 * The ending — the goods lift ride out, and what is at the top.
 *
 * Structurally this is the intro played backwards, and that is deliberate: the
 * same car, the same gate, the same fourteen seconds. The difference is the
 * arrival. The intro's gate opened onto a corridor lit by a circuit that had to
 * be struck; this one opens onto a loading yard, and the light is already there
 * and far too much of it.
 *
 * The overexposure at the top is the only time the grade is allowed to blow
 * out, and it is doing real work: after two hours of a building lit to 30
 * candela, 1.9x exposure reads as daylight even though nothing in the scene has
 * changed colour.
 *
 * At 30 s the UI takes over for the credits. The sequence does not end until
 * the screen behind it is black, so there is no flash between the two.
 */

import { frame } from './helpers.js';
import { circuit } from './helpers.js';

export function ending(ctx, params = {}) {
  const f = frame(ctx, params);
  const travel = params.travel ?? 15;
  const id = params.ending || 'lift';

  const t = ctx.track('ending', { duration: travel + 19, skippable: true })
    .lock({ control: true, look: false, freeze: true })

    .cue(0.0, (c) => c.ui?.hideHud?.(true))
    .audio(0.0, 'lift/gate_grab')
    .audio(0.4, 'lift/gate_close')
    .shake(1.9, 0.22, 4.0)
    .audio(1.95, 'lift/gate_seat')
    .cue(2.0, (c) => circuit(c, 'lift_car', true))

    .camera(0.1, 2.8, [
      { pos: f.at(0, 0, 0), look: f.at(3.4, 0.05, -0.05), fov: 66 },
      { pos: f.at(0.04, 0.02, 0.01), look: f.at(3.4, 0.02, 0), fov: 66 },
    ], 'inOutSine', { from: 'current' })

    .audio(2.7, 'lift/contactor')
    .shake(3.1, 0.30, 2.2)
    .audio(3.15, 'lift/motor_start')
    .audio(3.5, 'lift/run', { loop: true })
    .cue(3.5, (c) => c.bus?.emit('game:ending', { ending: id }))

    // Fifteen seconds in a box. The sway is the only thing moving.
    .camera(3.0, travel + 1.4, [
      { pos: f.at(0.04, 0.02, 0.01), look: f.at(3.4, 0.02, 0), fov: 66 },
      { pos: f.at(0.00, -0.03, 0.04), look: f.at(3.5, -0.08, 0.03), fov: 66 },
      { pos: f.at(0.06, 0.03, -0.02), look: f.at(3.3, 0.10, -0.04), fov: 66.5 },
      { pos: f.at(0.01, -0.02, 0.02), look: f.at(3.5, -0.05, 0.03), fov: 66 },
      { pos: f.at(0.03, 0.00, 0.00), look: f.at(3.4, 0.00, 0.00), fov: 66 },
    ], 'inOutSine');

  const passes = Math.max(1, Math.floor((travel - 2) / 3.2));
  for (let i = 0; i < passes; i++) {
    const at = 4.6 + i * 3.2;
    t.audio(at, 'lift/pass_floor', { index: i, up: true });
    t.grade(at, { uExposure: 1.12 }, 0.22, 'out');
    t.grade(at + 0.24, { uExposure: 1 }, 0.5);
  }

  // -- arrival ---------------------------------------------------------------
  const A = travel + 3.0;
  t.audio(A - 0.6, 'lift/motor_stop')
    .shake(A, 0.28, 3.4)
    .audio(A + 0.05, 'lift/arrest')
    .grade(A, { uExposure: 0.80 }, 0.5)

    .audio(A + 1.2, 'lift/gate_open')
    .cue(A + 1.2, (c) => circuit(c, 'yard_daylight', true))
    .audio(A + 1.4, 'ending/outside_air', { loop: true, fadeIn: 3.0 })

    // The wash. Up hard, then a long settle that never fully comes back —
    // the yard stays brighter than anything in the building.
    .grade(A + 1.25, { uExposure: 1.92, uSaturation: 1.14 }, 2.4, 'smoother')
    .grade(A + 4.0, { uExposure: 1.16 }, 5.0)
    .grade(A + 1.4, { uDread: 0, uVignette: -0.12, uGrain: -0.010 }, 4.0)

    .camera(A + 1.1, 9.5, [
      { pos: f.at(0.03, 0, 0), look: f.at(3.4, 0, 0), fov: 66 },
      { pos: f.at(1.1, 0, 0.01), look: f.at(5.0, 0.15, 0.05), fov: 66 },
      { pos: f.at(3.0, 0, 0), look: f.at(9.0, 0.4, -0.3), fov: 67 },
      { pos: f.at(5.2, 0, 0.02), look: f.at(13.0, 0.6, 0.8), fov: 68 },
    ], 'inOutSine')

    .caption(A + 2.6, 'outside air', { sound: true, hint: 'ahead', duration: 3.4 })

    // Fade to black under the last of the move, then the credits.
    .grade(A + 9.0, { uFade: 1, fadeColor: 0x000000 }, 3.4, 'smoother')
    .cue(A + 12.6, (c) => c.ui?.show?.('ending', { ending: id }))
    .hold(A + 13.6)

    .onEnd((c) => {
      c.ui?.hideHud?.(true);
      if (c.player) { c.player.frozen = true; c.player.controlEnabled = false; }
      c.bus?.emit('game:ending', { ending: id });
    });

  return t;
}

export default ending;
