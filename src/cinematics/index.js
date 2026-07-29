/**
 * Cinematics registry.
 *
 *   import { createSequencer } from './cinematics/Sequencer.js';
 *   import { installCinematics } from './cinematics/index.js';
 *
 *   const cine = createSequencer({ bus, engine, player, deck, ui, rig, game });
 *   installCinematics(cine);
 *   await cine.play('intro');
 *
 * Every sequence takes an optional params object; every parameter has a
 * fallback derived from the player's current pose, so a sequence called with
 * nothing at all still plays somewhere sensible instead of throwing.
 */

import { intro } from './Intro.js';
import { TRANSITIONS } from './Transitions.js';
import { liftRide, liftCall } from './Lift.js';
import { impossibleDoor, entityReveal, transformation } from './Signature.js';
import { capture, respawn } from './Death.js';
import { ending } from './Ending.js';

export const SEQUENCES = {
  intro,
  ...TRANSITIONS,
  lift: liftRide,
  'lift:call': liftCall,
  'impossible:door': impossibleDoor,
  'entity:reveal': entityReveal,
  'world:transform': transformation,
  capture,
  respawn,
  ending,
};

/** Registers every authored sequence on a sequencer. Returns the sequencer. */
export function installCinematics(sequencer) {
  sequencer.registerAll(SEQUENCES);
  return sequencer;
}

export { createSequencer } from './Sequencer.js';
export { GradeDeck } from './Grade.js';
export { EASE } from './ease.js';
export default installCinematics;
