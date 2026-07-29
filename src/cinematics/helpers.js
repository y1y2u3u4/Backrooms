/**
 * Shared helpers for authored sequences.
 *
 * Every sequence in the Annex is written in a *local frame* — metres forward,
 * right and up from a known pose — rather than in world coordinates. Two
 * reasons: the same "through the door" move has to work at every door in the
 * building, and a sequence written against absolute coordinates breaks the
 * moment the environment agent moves a wall by 400 mm.
 *
 * If the integrator passes `origin`/`yaw` the frame is anchored there; if not,
 * it falls back to wherever the player is standing. Nothing throws on missing
 * parameters — a sequence that hard-fails mid-game is worse than one that plays
 * in slightly the wrong place.
 */

export function toArr(a, fallback = [0, 0, 0]) {
  if (!a) return fallback.slice();
  if (Array.isArray(a)) return [a[0], a[1], a[2]];
  if (typeof a.x === 'number') return [a.x, a.y, a.z];
  return fallback.slice();
}

/** A right-handed local frame: `.at(forward, right, up)` -> world [x,y,z]. */
export function frame(ctx, params = {}) {
  const p = ctx.player;
  const yaw = params.yaw ?? p?.yaw ?? 0;
  const origin = params.origin
    ? toArr(params.origin)
    : (p ? [p.position.x, p.position.y + (p.eyeHeight ?? 1.63), p.position.z] : [0, 1.63, 0]);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return {
    yaw, origin,
    at(f = 0, r = 0, u = 0) {
      return [origin[0] - s * f + c * r, origin[1] + u, origin[2] - c * f - s * r];
    },
  };
}

/** Fires a callback exactly once even if a sequence is skipped and then ends. */
export function once(fn) {
  let done = false;
  return (...a) => { if (done) return; done = true; try { fn?.(...a); } catch (e) { console.error('[cine] swap', e); } };
}

/** Circuit helper that tolerates a missing rig (harness, headless QA). */
export function circuit(ctx, name, powered) {
  ctx.rig?.setCircuit?.(name, powered);
  ctx.bus?.emit('light:circuit', { circuit: name, powered });
}

export default { frame, toArr, once, circuit };
