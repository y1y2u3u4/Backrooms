/**
 * Easing and interpolation for the sequencer.
 *
 * There are no linear easings exposed for camera work on purpose. A camera that
 * starts or stops instantaneously reads as a machine; every authored move in
 * the Annex accelerates and settles.
 */

export const EASE = {
  /** Default for camera translation: slow out, slow in, long tail. */
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  /** Gentler still — used for very long moves (lift travel, the ending). */
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  /** Departures: the camera leans into the move. */
  in: (t) => t * t * t,
  /** Arrivals: fast then settle. Good for a head turn. */
  out: (t) => 1 - Math.pow(1 - t, 3),
  /** A very soft arrival, for the last metre of a dolly. */
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  /** Grade fades: perceptually even. */
  fade: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  /** A settle with one small overshoot. Only for physical objects, never lights. */
  settle: (t) => 1 - Math.cos(t * Math.PI * 1.5) * Math.exp(-4.2 * t),
  /** Hold at 0 then snap late — for a light striking. */
  strike: (t) => (t < 0.82 ? 0 : (t - 0.82) / 0.18),
  linear: (t) => t,
};

export function easeFn(e) {
  if (typeof e === 'function') return e;
  return EASE[e] || EASE.inOut;
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Uniform-ish Catmull-Rom through a list of Vector3-likes. `centripetal`
 * parameterisation avoids the cusps a uniform spline produces when two control
 * points are close together, which is exactly the case where a camera would
 * visibly flick.
 */
export function catmullRom(points, t, out = { x: 0, y: 0, z: 0 }) {
  const n = points.length;
  if (n === 0) return out;
  if (n === 1) { out.x = points[0].x; out.y = points[0].y; out.z = points[0].z; return out; }
  const seg = Math.min(Math.floor(t * (n - 1)), n - 2);
  const lt = t * (n - 1) - seg;
  const p0 = points[Math.max(seg - 1, 0)];
  const p1 = points[seg];
  const p2 = points[seg + 1];
  const p3 = points[Math.min(seg + 2, n - 1)];
  const t2 = lt * lt, t3 = t2 * lt;
  const f = (a, b, c, d) =>
    0.5 * ((2 * b) + (-a + c) * lt + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  out.x = f(p0.x, p1.x, p2.x, p3.x);
  out.y = f(p0.y, p1.y, p2.y, p3.y);
  out.z = f(p0.z, p1.z, p2.z, p3.z);
  return out;
}

/** Shortest-arc interpolation between two yaw angles, in radians. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export default EASE;
