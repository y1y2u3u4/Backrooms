import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, bulkhead, stripLight, emergencyLight,
  handrail, gantry, steelColumn, iBeam, channel, cagedLadder, stairFlight,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import { makeRng, clamp01, lerp, smoothstep, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun } from '../../render/geo.js';

/**
 * THE STACK — the impossible one.
 *
 * A square light-well with a perimeter gantry, and identical office floors
 * going up and down past the limit of sight. It is the only place in the game
 * that admits, without a line of dialogue, that the building is not a building.
 *
 * How it is made honest without brute force:
 *
 *  * 15 REAL LEVELS on a 3.4 m rhythm, ±7 from the player's. The three nearest
 *    in each direction are fully detailed — deck, kickplate, handrail, mullions,
 *    door openings, a couple of lit offices. Beyond that the levels drop to a
 *    silhouette: deck edge, parapet band, mullion rhythm and a scatter of lit
 *    panes. At the distances involved that is all the eye can resolve anyway.
 *  * FOG DOES THE REST. The `stack` profile is thin and almost height-neutral
 *    with its base 20 m down, so extinction accumulates with pure distance up
 *    and down the shaft. Level 7 sits at ~24 m, deep enough that it is already
 *    half-dissolved; the last visible thing is a rhythm of lit panes with no
 *    edges, which reads as "more of this, forever".
 *  * THE WELL IS AN ENCLOSURE, not an absence. The decks used to hang in an open
 *    void, and because every deck ring hides the office facade of the level
 *    below it, a view up or down the shaft terminated on nothing: no surface to
 *    catch the bounce fill, nothing for the haze to accumulate against, and so
 *    the floors read as lit rectangles suspended in black rather than as floors
 *    inside a building. The decks are now lined by a real well — a continuous
 *    concrete shaft wall standing on the deck edge, on a bay rhythm of
 *    pilasters that run the whole height uninterrupted, with the slab edge
 *    expressed as a projecting band at every floor line and a services riser
 *    climbing the lot. The bay openings are what the player leans out of, and
 *    they are the only places a sightline leaves the well.
 *
 *  * THE VOID ITSELF IS STILL EMPTY. One cable bundle hangs the full height and
 *    gives the eye something to fall along, and there is a single lit fixture a
 *    long way down. Nothing crosses it. Vertigo needs an uninterrupted drop.
 */

const LEVEL = 3.40;
const VOID = 9.0;              // half-width of the open shaft
const OUTER = 11.4;            // half-width to the office facade
const UP = 7, DOWN = 7;

// ---------------------------------------------------------------------------
// the well lining
//
// One set of numbers, all measured out from the shaft's centreline, because the
// whole lining has to stack: the pilasters must clear the handrail on the inside
// and land on the deck on the outside, and the band at each floor line has to
// nose past the pilasters or the pilasters interrupt it.
//
//   8.50  band nose            projecting drip at every floor line
//   8.62  pilaster spine       the proud face; the eye follows these up and down
//   8.74  pilaster wing        the shallow step either side of the spine
//   8.90  handrail (existing)  stands just clear, in front of the wall
//   9.00  deck edge / nib      where the slab stops
//   9.02  wall face            shaft face of the well wall
//   9.30  wall back            bearing on the deck
// ---------------------------------------------------------------------------
const WALL_IN = 9.02;
const WALL_OUT = 9.30;
const PIER_IN = 8.62;
const PIER_MID = 8.74;
const NOSE_IN = 8.50, NOSE_OUT = 8.74;
const CORNER = 8.58;                  // inner faces of the corner piers
const BAND_BOT = -0.52, BAND_TOP = -0.02;      // slab edge, relative to a deck
const SILL = 0.32;                    // opening cill above a deck
const HEAD = 2.42;                    // opening head above a deck
const SOFFIT = LEVEL - 0.52;          // where the spandrel meets the band above
const PIER_U = [-6, -3, 0, 3, 6];     // 3.0 m bays, corners shared
const LO = -DOWN - 1, HI = UP + 1;    // the well outruns the last floor
const WELL_BOT = LO * LEVEL + BAND_BOT - 1.4;
const WELL_TOP = HI * LEVEL + 0.90;

/**
 * The four faces of the well, each with an along-axis and an outward one, so a
 * piece of lining can be authored once in (along, height, depth) and placed on
 * every face. `depth` always grows away from the centreline.
 */
const SIDES = [
  { ax: 1, az: 0, dx: 0, dz: -1, yaw: 0, tag: 'n' },
  { ax: 1, az: 0, dx: 0, dz: 1, yaw: 0, tag: 's' },
  { ax: 0, az: 1, dx: -1, dz: 0, yaw: Math.PI / 2, tag: 'w' },
  { ax: 0, az: 1, dx: 1, dz: 0, yaw: Math.PI / 2, tag: 'e' },
];

/** Chamfered box in a face's local axes. `du` along the wall, `dt` through it. */
function wallBox(s, u, y, t, du, dh, dt, cham = 0.014) {
  const g = box(du, dh, dt, cham, 1);
  if (s.yaw) g.rotateY(s.yaw);
  g.translate(s.ax * u + s.dx * t, y, s.az * u + s.dz * t);
  return g;
}

/** Matching collider. Geometry with no collider is invisible to the AO bake. */
function wallCollider(b, s, u, y, t, du, dh, dt, meta) {
  b.addColliderAt(
    s.ax * u + s.dx * t, y, s.az * u + s.dz * t,
    s.yaw ? dt : du, dh, s.yaw ? du : dt, meta);
}

/** Distance from the centreline — which face a point is on does not matter. */
const depthOf = (x, z) => Math.max(Math.abs(x), Math.abs(z));

/**
 * Ruin gradient. The bottom of the well is the end that has been wet for thirty
 * years; the top is merely dusty. Damage is a function of height, never a coin
 * flip, so the eye reads a direction rather than noise.
 */
const decay = (y) => clamp01((5.0 - y) / 30.0);

/**
 * Tone for a lining surface.
 *
 * Three terms, and they are the only reason the lining has shape at all: the
 * zone's direct light is four strip fittings per level tucked under the deck
 * soffits, none of which reach across an 18 m well, so everything here is lit by
 * a hemisphere constant. Up-facing ledges read light, soffits read dark, the
 * surface darkens into the shadow under each floor band, and whatever stands
 * proudest of the wall reads brightest.
 */
function liningShade(x, y, z, nx, ny, nz) {
  const f = y / LEVEL - Math.floor(y / LEVEL);       // 0 at a floor line
  let s = 0.52
    + 0.34 * clamp01(ny)
    - 0.22 * clamp01(-ny)
    + 0.13 * smoothstep(0.05, 0.42, f)
    - 0.15 * smoothstep(0.74, 1.0, f);
  s *= 0.72 + 0.28 * clamp01((WALL_OUT - depthOf(x, z)) / 0.80);
  return s * (1 - 0.34 * decay(y));
}

/** One office-facade band between two decks. */
function facade(b, y, { detail = 2, seed = 1, lit = 0.18, doors = null } = {}) {
  const parts = [], mull = [], glow = [];
  const h = LEVEL;
  const sides = [
    ['n', -OUTER, -OUTER, OUTER, -OUTER, 1],
    ['s', OUTER, OUTER, -OUTER, OUTER, 1],
    ['e', OUTER, -OUTER, OUTER, OUTER, 1],
    ['w', -OUTER, OUTER, -OUTER, -OUTER, 1],
  ];
  for (const [tag, ax, az, bx, bz] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);      // inward normal
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    // Spandrel band (solid) low, glazing above.
    const spandrel = box(0.16, 1.02, len, 0.008, 1);
    spandrel.rotateY(yaw); spandrel.translate(cx, y + 0.51, cz);
    parts.push(spandrel);
    const head = box(0.16, 0.34, len, 0.008, 1);
    head.rotateY(yaw); head.translate(cx, y + h - 0.17, cz);
    parts.push(head);
    // Recessed dark glazing.
    const glass = box(0.06, h - 1.36, len - 0.02, 0.004, 1);
    glass.rotateY(yaw);
    glass.translate(cx - nx * 0.07, y + 1.02 + (h - 1.36) / 2, cz - nz * 0.07);
    glow.push({ geo: glass, dark: true });
    // Mullions.
    const n = Math.round(len / 1.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
      const m = box(0.10, h - 1.36, 0.09, 0.004, 1);
      m.rotateY(yaw); m.translate(px, y + 1.02 + (h - 1.36) / 2, pz);
      mull.push(m);
      if (detail > 1 && i < n) {
        const tr = box(0.09, 0.055, len / n - 0.09, 0.003, 1);
        tr.rotateY(yaw);
        tr.translate(lerp(ax, bx, (i + 0.5) / n), y + 2.10, lerp(az, bz, (i + 0.5) / n));
        mull.push(tr);
      }
    }
    // Lit panes: the only colour in the shaft.
    for (let i = 0; i < n; i++) {
      if (hash2(Math.round(y * 3) + i, Math.round(ax + i * 7)) > lit) continue;
      const t = (i + 0.5) / n;
      const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
      const p = box(0.02, h - 1.6, len / n - 0.16, 0.003, 1);
      p.rotateY(yaw);
      p.translate(px - nx * 0.09, y + 1.10 + (h - 1.6) / 2, pz - nz * 0.09);
      glow.push({ geo: p, dark: false });
    }
  }
  const g = merge(parts); worldUV(g, 1.1); vertexShade(g, () => 0.44);
  b.add('concreteWall', g);
  // The facade never had a collider, which cost two things: the player could
  // walk straight through the back of a gallery and off the building, and the AO
  // bake saw the galleries as open shelves rather than as rooms with a back wall.
  // Level 0 is broken around its two door openings.
  for (const [tag, ax, az, bx, bz] of sides) {
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const along = Math.abs(bx - ax) > Math.abs(bz - az);
    const gap = doors ? doors[tag] : null;
    const runs = gap
      ? [[-OUTER, gap[0]], [gap[1], OUTER]]
      : [[-OUTER, OUTER]];
    for (const [u0, u1] of runs) {
      if (u1 - u0 < 0.05) continue;
      const uc = (u0 + u1) / 2, ul = u1 - u0;
      b.addColliderAt(
        along ? uc : cx, y + h / 2, along ? cz : uc,
        along ? ul : 0.16, h, along ? 0.16 : ul, { tag: 'facade' });
    }
  }
  const mg = merge(mull); worldUV(mg, 0.5); vertexShade(mg, () => 0.5);
  b.add('machinePaint', mg);
  const dark = glow.filter((q) => q.dark).map((q) => q.geo);
  const brightGeos = glow.filter((q) => !q.dark).map((q) => q.geo);
  if (dark.length) {
    const dg = merge(dark); worldUV(dg, 1.0); vertexShade(dg, () => 0.30);
    b.add('glassDark', dg);
  }
  if (brightGeos.length) {
    const bg = merge(brightGeos);
    b.add('stackGlow', bg, () => b.materials.emissive(0xffe0ae, 0.55));
  }
}

/** One deck ring around the void. */
function deckRing(b, y, { detail = 2, rails = true, collide = true, gap = null } = {}) {
  const parts = [];
  const rects = [
    [-OUTER, -OUTER, OUTER, -VOID],
    [-OUTER, VOID, OUTER, OUTER],
    [-OUTER, -VOID, -VOID, VOID],
    [VOID, -VOID, OUTER, VOID],
  ];
  for (const [x0, z0, x1, z1] of rects) {
    const w = x1 - x0, d = z1 - z0;
    const deck = box(w, 0.075, d, 0.006, 1);
    deck.translate((x0 + x1) / 2, y - 0.038, (z0 + z1) / 2);
    parts.push(deck);
    if (collide) {
      b.addFloor([x0, z0, x1, z1], y, { surface: 'concrete', tag: 'deck' });
      b.addColliderAt((x0 + x1) / 2, y - 0.30, (z0 + z1) / 2, w, 0.5, d, { tag: 'deck' });
    }
  }
  // Edge nib around the void, so the drop has a lip and a shadow line.
  const ring = [
    [-VOID, -VOID, VOID, -VOID], [VOID, VOID, -VOID, VOID],
    [VOID, -VOID, VOID, VOID], [-VOID, VOID, -VOID, -VOID],
  ];
  for (const [ax, az, bx, bz] of ring) {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const nib = box(0.16, 0.30, len, 0.006, 1);
    nib.rotateY(yaw);
    nib.translate((ax + bx) / 2 - Math.cos(yaw) * 0.08, y - 0.15, (az + bz) / 2 + Math.sin(yaw) * 0.08);
    parts.push(nib);
  }
  const g = merge(parts);
  worldUV(g, 1.0);
  vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.88 : ny < -0.5 ? 0.34 : 0.58));
  b.add('concreteFloor', g);

  if (rails) {
    const r = VOID - 0.10;
    const opt = { h: 1.06, spacing: detail > 1 ? 1.6 : 3.2, mid: detail > 1, toe: detail > 1, key: 'machinePaint' };
    handrail(b, [[-r, -r], [r, -r]], y, opt);
    handrail(b, [[r, -r], [r, r]], y, opt);
    handrail(b, [[-r, r], [-r, -r]], y, opt);
    if (gap) {
      // Somebody removed a bay of handrail and never put it back.
      handrail(b, [[r, r], [gap[1], r]], y, opt);
      handrail(b, [[gap[0], r], [-r, r]], y, opt);
    } else {
      handrail(b, [[r, r], [-r, r]], y, opt);
    }
    if (collide) {
      b.addColliderAt(0, y + 0.55, -r, VOID * 2, 1.1, 0.12, { tag: 'rail' });
      b.addColliderAt(-r, y + 0.55, 0, 0.12, 1.1, VOID * 2, { tag: 'rail' });
      b.addColliderAt(r, y + 0.55, 0, 0.12, 1.1, VOID * 2, { tag: 'rail' });
      if (gap) {
        b.addColliderAt((r + gap[1]) / 2, y + 0.55, r, r - gap[1], 1.1, 0.12, { tag: 'rail' });
        b.addColliderAt((-r + gap[0]) / 2, y + 0.55, r, gap[0] + r, 1.1, 0.12, { tag: 'rail' });
      } else {
        b.addColliderAt(0, y + 0.55, r, VOID * 2, 1.1, 0.12, { tag: 'rail' });
      }
    }
  }
}

/**
 * The pilasters: five to a face on a 3.0 m bay, plus a square pier at each
 * corner, every one of them running the full height of the well in a single
 * piece. This is the element that makes the shaft a shaft — a floor line only
 * tells you where you are, a pilaster tells you the place keeps going.
 */
function wellPiers(b) {
  const H = WELL_TOP - WELL_BOT, cy = (WELL_TOP + WELL_BOT) / 2;
  const parts = [];
  for (const s of SIDES) {
    for (const u of PIER_U) {
      // A proud spine between two shallow wings: a flat pilaster reads as a
      // seam in a flat wall, a stepped one catches a different tone per step.
      parts.push(wallBox(s, u, cy, (WALL_OUT + PIER_IN) / 2, 0.34, H, WALL_OUT - PIER_IN, 0.022));
      for (const k of [-1, 1]) {
        parts.push(wallBox(s, u + k * 0.245, cy, (WALL_OUT + PIER_MID) / 2,
          0.15, H, WALL_OUT - PIER_MID, 0.016));
      }
      wallCollider(b, s, u, cy, (WALL_OUT + PIER_IN) / 2, 0.64, H, WALL_OUT - PIER_IN, { tag: 'pier' });
    }
  }
  const cc = (WALL_OUT + CORNER) / 2, cs = WALL_OUT - CORNER;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = box(cs, H, cs, 0.024, 1);
    g.translate(sx * cc, cy, sz * cc);
    parts.push(g);
    b.addColliderAt(sx * cc, cy, sz * cc, cs, H, cs, { tag: 'pier' });
  }
  const g = merge(parts);
  worldUV(g, 0.95);
  vertexShade(g, liningShade);
  b.add('concreteWall', g);
}

/**
 * One floor line. The slab edge is expressed rather than hidden: a downstand
 * band the full depth of the lining, with a nosing that projects past the
 * pilasters in the floor material, so a level reads as a slab inserted into the
 * well and not as a plane floating in it.
 */
function wellBand(b, i) {
  const y = i * LEVEL;
  const du = 2 * CORNER;
  const wall = [], nose = [];
  for (const s of SIDES) {
    wall.push(wallBox(s, 0, y + (BAND_BOT + BAND_TOP) / 2, (WALL_OUT + PIER_IN) / 2,
      du, BAND_TOP - BAND_BOT, WALL_OUT - PIER_IN, 0.016));
    nose.push(wallBox(s, 0, y - 0.26, (NOSE_IN + NOSE_OUT) / 2,
      du, 0.28, NOSE_OUT - NOSE_IN, 0.010));
    wallCollider(b, s, 0, y + (BAND_BOT + BAND_TOP) / 2, (WALL_OUT + NOSE_IN) / 2,
      du, BAND_TOP - BAND_BOT, WALL_OUT - NOSE_IN, { tag: 'slabEdge' });
  }
  // Corbels where the band crosses a corner pier, so the corners carry it.
  const cc = 8.90;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = box(0.80, 0.36, 0.80, 0.018, 1);
    g.translate(sx * cc, y - 0.24, sz * cc);
    wall.push(g);
  }
  const wg = merge(wall);
  worldUV(wg, 1.6); vertexShade(wg, liningShade);
  b.add('concreteWall', wg);
  const ng = merge(nose);
  worldUV(ng, 1.1); vertexShade(ng, liningShade);
  b.add('concreteFloor', ng);
}

/**
 * The wall between one floor line and the next: a cill, a deep spandrel, and the
 * band of openings between them that the galleries look out of. Below the lowest
 * gallery there is nothing to look at, so that bay is left blank — the well goes
 * on past the last floor, which is the whole point of the place.
 */
function wellWall(b, i, blank = false) {
  const y = i * LEVEL;
  const du = 2 * CORNER;
  const t = (WALL_OUT + WALL_IN) / 2, dt = WALL_OUT - WALL_IN;
  const wall = [], nose = [];
  for (const s of SIDES) {
    if (blank) {
      const dh = SOFFIT - BAND_TOP;
      wall.push(wallBox(s, 0, y + (BAND_TOP + SOFFIT) / 2, t, du, dh, dt, 0.014));
      wallCollider(b, s, 0, y + (BAND_TOP + SOFFIT) / 2, t, du, dh, dt, { tag: 'wellWall' });
      continue;
    }
    // Cill, with a nosing that throws a shadow line the length of the face.
    wall.push(wallBox(s, 0, y + (BAND_TOP + SILL) / 2, t, du, SILL - BAND_TOP, dt, 0.014));
    nose.push(wallBox(s, 0, y + SILL + 0.035, 9.12, du, 0.07, 0.36, 0.008));
    wallCollider(b, s, 0, y + (BAND_TOP + SILL) / 2, t, du, SILL - BAND_TOP, dt, { tag: 'wellWall' });
    // Spandrel over the openings, and the lintel soffit under it.
    wall.push(wallBox(s, 0, y + (HEAD + SOFFIT) / 2, t, du, SOFFIT - HEAD, dt, 0.014));
    nose.push(wallBox(s, 0, y + HEAD + 0.045, 9.12, du, 0.09, 0.36, 0.008));
    wallCollider(b, s, 0, y + (HEAD + SOFFIT) / 2, t, du, SOFFIT - HEAD, dt, { tag: 'wellWall' });
  }
  const wg = merge(wall);
  worldUV(wg, 1.6); vertexShade(wg, liningShade);
  b.add('concreteWall', wg);
  if (nose.length) {
    const ng = merge(nose);
    worldUV(ng, 1.1); vertexShade(ng, liningShade);
    b.add('concreteFloor', ng);
  }
}

/**
 * A well lamp on the centre pilaster of a face, at every level. Four columns of
 * them recede up and down the shaft, which is the rhythm that used to come from
 * the strip fittings before the lining hid them behind its spandrels. They are
 * housings with lit lenses rather than rig entries: sixty dynamic lights in one
 * zone is not affordable and none of them would reach anything anyway.
 */
function wellLamp(b, s, i) {
  const y = i * LEVEL + 1.78;
  const lit = hash2(i * 13 + s.dx * 3 + s.dz * 7, 41) > 0.10 + 0.5 * decay(y);
  const parts = [
    wallBox(s, 0, y, PIER_IN - 0.035, 0.30, 0.26, 0.07, 0.008),
    wallBox(s, 0, y + 0.155, PIER_IN - 0.105, 0.34, 0.06, 0.21, 0.006),
  ];
  const g = merge(parts);
  worldUV(g, 0.4);
  vertexShade(g, (x, yy, z, nx, ny) => (ny > 0.4 ? 0.86 : ny < -0.4 ? 0.44 : 0.70) * (1 - 0.3 * decay(yy)));
  b.add('machinePaint', g);
  if (!lit) return;
  const lens = wallBox(s, 0, y, 8.55, 0.22, 0.17, 0.03, 0.006);
  b.add('stackGlow', lens, () => b.materials.emissive(0xffe0ae, 0.55));
}

/**
 * The riser. Every zone's services run through to the next one, and a shaft is
 * where a building puts them: a bundle of conduit and one wet riser standing off
 * the lining on brackets, climbing from below the lowest floor to above the
 * highest without a break. It is also the one continuous vertical line the eye
 * can measure the drop against.
 */
function wellRisers(b) {
  const yTop = WELL_TOP - 0.5, yBot = WELL_BOT + 0.5;
  const H = yTop - yBot, cy = (yTop + yBot) / 2;
  const steel = [], soft = [];
  const pipes = [
    { s: SIDES[0], u: -3.86, t: 8.40, r: 0.075 },
    { s: SIDES[0], u: -3.66, t: 8.42, r: 0.021 },
    { s: SIDES[0], u: -3.60, t: 8.42, r: 0.021 },
    { s: SIDES[0], u: -3.54, t: 8.42, r: 0.021 },
    { s: SIDES[0], u: -3.48, t: 8.42, r: 0.021 },
    { s: SIDES[3], u: 3.74, t: 8.44, r: 0.062 },
    { s: SIDES[3], u: 3.56, t: 8.44, r: 0.024 },
  ];
  for (const p of pipes) {
    const g = cyl(p.r, p.r, H, 8);
    g.translate(p.s.ax * p.u + p.s.dx * p.t, cy, p.s.az * p.u + p.s.dz * p.t);
    steel.push(g);
  }
  // One rubber-sheathed bundle beside the conduit, sagging between brackets.
  {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const yy = lerp(yBot, yTop, k / 8);
      pts.push([-3.72 + Math.sin(k * 1.7) * 0.015, yy, -(8.46 + Math.cos(k * 1.3) * 0.012)]);
    }
    soft.push(pipeRun(pts, 0.030, 6, 1));
  }
  for (let i = LO; i < HI; i++) {
    const y = i * LEVEL;
    // Bracket into the spandrel, which is the only solid part of the wall at
    // that height, with a strap across the front of the bundle.
    for (const [s, u, wide] of [[SIDES[0], -3.66, 0.46], [SIDES[3], 3.66, 0.28]]) {
      steel.push(wallBox(s, u, y + 2.62, 8.66, 0.05, 0.08, 0.72, 0.006));
      steel.push(wallBox(s, u, y + 2.62, 8.34, wide, 0.05, 0.05, 0.004));
    }
    if (i % 3 === 0) {
      steel.push(wallBox(SIDES[0], -3.16, y + 1.30, 8.56, 0.20, 0.28, 0.12, 0.008));
    }
  }
  const g = merge(steel);
  worldUV(g, 0.5);
  vertexShade(g, (x, y) => (0.58 + 0.26 * clamp01((y + 26) / 52)) * (1 - 0.30 * decay(y)));
  b.add('machinePaint', g);
  const sg = merge(soft);
  worldUV(sg, 0.6); vertexShade(sg, (x, y) => 0.40 * (1 - 0.25 * decay(y)));
  b.add('rubber', sg);
}

/**
 * Spalling on the band noses, worst at the bottom. Count and size both follow
 * the height gradient, so the well has a ruined end and a merely tired one.
 */
function wellDamage(b, rng) {
  const core = [], bar = [];
  for (let i = LO; i <= HI; i++) {
    const y = i * LEVEL;
    const d = decay(y);
    const n = Math.round(d * 3.4);
    for (let k = 0; k < n; k++) {
      const s = SIDES[Math.floor(rng() * 4) % 4];
      const u = rng.range(-7.6, 7.6);
      const w = rng.range(0.22, 0.66 + d * 0.5);
      const h = rng.range(0.09, 0.20);
      const yy = y - 0.26 + rng.range(-0.06, 0.06);
      core.push(wallBox(s, u, yy, NOSE_IN + 0.10, w, h, 0.18, 0.006));
      if (d > 0.55) {
        for (let r = 0; r < 2; r++) {
          const g = cyl(0.008, 0.008, w * 0.9, 6);
          g.rotateZ(Math.PI / 2);
          if (s.yaw) g.rotateY(s.yaw);
          g.translate(s.ax * u + s.dx * (NOSE_IN + 0.06), yy - 0.02 + r * 0.07,
            s.az * u + s.dz * (NOSE_IN + 0.06));
          bar.push(g);
        }
      }
    }
  }
  if (core.length) {
    const g = merge(core);
    worldUV(g, 0.7);
    vertexShade(g, (x, y) => 0.34 * (1 - 0.2 * decay(y)));
    b.add('concreteWall', g);
  }
  if (bar.length) {
    const g = merge(bar);
    worldUV(g, 0.3); vertexShade(g, () => 0.42);
    b.add('machinePaint', g);
  }
}

export function buildStack(ctx, opts = {}) {
  const { rig, decals } = ctx;
  const seed = opts.seed ?? 7700;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bHere, bNear, bFar] = makeBuilders(ctx, 'stack', ['here', 'near', 'far']);
  const builders = [bHere, bNear, bFar];
  const fixtures = [];
  const rigFor = (b) => rigProxy(rig, b.origin, fixtures);
  const portals = [];

  // =========================================================================
  // levels
  // =========================================================================
  for (let i = -DOWN; i <= UP; i++) {
    const y = i * LEVEL;
    const dist = Math.abs(i);
    const detail = dist === 0 ? 3 : dist <= 2 ? 2 : 1;
    const b = dist === 0 ? bHere : dist <= 2 ? bNear : bFar;
    deckRing(b, y, { detail, rails: true, collide: dist === 0, gap: dist === 0 ? [1.4, 3.8] : null });
    facade(b, y, {
      detail, seed: seed + i * 31, lit: dist === 0 ? 0.22 : 0.16,
      // The two ways out of this level, left open in the facade collider.
      doors: dist === 0 ? { n: [-3.8, -2.6], e: [3.0, 4.2] } : null,
    });
    // Structure: columns at the four corners of the void, every level.
    if (detail >= 2) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const g = box(0.30, LEVEL - 0.08, 0.30, 0.008, 1);
        g.translate(sx * (VOID + 1.1), y + LEVEL / 2, sz * (VOID + 1.1));
        worldUV(g, 0.9); vertexShade(g, (px, py) => 0.5 + clamp01((py - y) / LEVEL) * 0.3);
        b.add('concreteWall', g);
        if (dist === 0) b.addColliderAt(sx * (VOID + 1.1), y + LEVEL / 2, sz * (VOID + 1.1), 0.30, LEVEL, 0.30, { tag: 'column' });
      }
    }
    // Level number stencilled on the well's north spandrel, facing the shaft,
    // where it can be read from the gallery opposite.
    if (D && dist <= 3) {
      D.label(b, [`${(i + 24).toString().padStart(2, '0')}`], {
        face: '+z', x: 1.5, y: y + 2.63, z: -WALL_IN, w: 0.62, h: 0.36,
        style: 'stencil', size: 96, colour: '#9a9384', distress: 0.5,
      });
    }
    // A strip light under every deck soffit — the rhythm that makes it infinite.
    //
    // EIGHT per level, not four. The walkable surface here is a perimeter gantry
    // RING, and four fittings at the mid-point of each side light the four sides
    // and leave the four corners of the ring as far from a lamp as it is possible
    // to get: the light-reach audit (tools/qa/lightreach.mjs) measured a corner of
    // this gantry at 10.66 m from the nearest live fixture, with 39 % of the
    // zone's walkable area beyond 5 m — by a wide margin the worst in the
    // building. A real gantry is lit at its corners for exactly this reason,
    // because a corner is where someone stops to turn.
    const RING = VOID + 1.2;
    if (dist <= 4) {
      const positions = [
        [0, -RING, 0], [0, RING, 0], [-RING, 0, Math.PI / 2], [RING, 0, Math.PI / 2],
        // Corners. Run at 45 degrees so the fitting follows the turn rather than
        // sitting across it.
        [-RING, -RING, Math.PI / 4], [RING, -RING, -Math.PI / 4],
        [-RING, RING, -Math.PI / 4], [RING, RING, Math.PI / 4],
      ];
      for (const [lx, lz, rot] of positions) {
        const health = hash2(i * 7 + lx, lz) < 0.18 ? 'dead' : hash2(i * 3, lz) < 0.32 ? 'buzz' : 'good';
        stripLight(b, rigFor(b), lx, y + LEVEL - 0.10, lz, {
          rotation: rot, circuit: 'stack', health, seed: 100 + i * 5 + lx,
          cage: false, cone: dist <= 1,
          // Scaled for the volume, not for the fitting. A 3.4 m gallery soffit
          // over an 18 m wide well loses most of a strip light's output into the
          // void instead of bouncing it back, and measured direct light on the
          // gantry was 4.5 units against the Intake corridor's 37 from a fitting
          // of the same rating.
          intensityScale: 3.4,
        });
      }
    }
  }

  // =========================================================================
  // the well
  //
  // Built after the decks so it lands on top of them, and one level further out
  // in each direction than the last gallery, so the lining is still there when
  // the floors have run out. `blank` closes the bay below the lowest gallery:
  // an opening there would look through into nothing, which is the failure this
  // whole enclosure exists to fix.
  // =========================================================================
  wellPiers(bFar);
  wellRisers(bFar);
  for (let i = LO; i <= HI; i++) {
    const dist = Math.abs(i);
    const b = dist === 0 ? bHere : dist <= 2 ? bNear : bFar;
    wellBand(b, i);
    if (i < HI) {
      wellWall(b, i, i < -DOWN);
      for (const s of SIDES) wellLamp(b, s, i);
    }
  }
  wellDamage(bFar, rng);

  // =========================================================================
  // the player's level
  // =========================================================================
  {
    const b = bHere;
    // Doors: in from Service on the north face, out to the Residence on the east.
    wallRun(b, -OUTER, -OUTER, OUTER, -OUTER, {
      y: 0, height: 1.02, key: 'concreteWall', seed: 11, perimeterAngle: false, skirting: false, collide: false,
    });
    doorway(b, -3.2, 0, -OUTER + 0.08, { rotation: 0, width: 1.0, height: 2.06, open: 0.5, hinge: 1, seed: 12 });
    portals.push(portal('to_service', 'stack', [-3.2, 0, -OUTER + 0.7], 0,
      { zone: 'service', portalId: 'to_stack' }, 'door',
      { arrive: [-3.2, 0, -OUTER + 1.7], arriveYaw: Math.PI }));
    doorway(b, OUTER - 0.08, 0, 3.6, { rotation: -Math.PI / 2, width: 1.0, height: 2.06, open: 0, hinge: 1, seed: 13 });
    portals.push(portal('to_residence', 'stack', [OUTER - 0.7, 0, 3.6], -Math.PI / 2,
      { zone: 'residence', portalId: 'to_stack' }, 'door',
      // Clear of the well wall's back face at WALL_OUT plus a body radius.
      { arrive: [OUTER - 1.5, 0, 3.6], arriveYaw: Math.PI / 2 }));

    // The gantry the player walks is dressed: this level has been used.
    Props.filingCabinet(b, -8.2, 0, -10.4, { seed: 201, yaw: 0.1, drawers: 4, damage: 0.5 });
    Props.filingCabinet(b, -7.7, 0, -10.4, { seed: 202, yaw: -0.05, drawers: 3, damage: 0.2 });
    Props.desk(b, 6.0, 0, -10.2, { seed: 203, yaw: Math.PI, w: 1.4, pedestal: 'right', damage: 0.3 });
    Props.officeChair(b, 6.0, 0, -9.95, { seed: 204, yaw: 0.3 });
    Props.paperStack(b, 6.2, 0.73, -10.3, { seed: 205, sheets: 55 });
    Props.wasteBin(b, 5.1, 0, -10.4, { seed: 206, kind: 'mesh', full: 0.5 });
    Props.boxStack(b, -10.2, 0, 5.6, { seed: 207, count: 4, soakBase: 0.1 });
    Props.trolley(b, -10.0, 0, -4.0, { seed: 208, yaw: 1.6, load: 0.4 });
    Props.plasticChair(b, 9.9, 0, -6.0, { seed: 209, yaw: 2.4 });
    Props.chairStack(b, 10.2, 0, 8.0, { seed: 210, yaw: 0.6, count: 5 });
    Props.wetFloorSign(b, 2.0, 0, -10.0, { seed: 211, yaw: 0.9 });
    Props.fireExtinguisher(b, -OUTER + 0.14, 0.32, 6.4, { seed: 212, yaw: Math.PI / 2 });
    Props.noticeboard(b, 0.0, 1.55, -OUTER + 0.10, { seed: 213, yaw: 0, w: 1.2, h: 0.85, sheets: 8 });

    // A bay of handrail is missing (see deckRing's `gap`), and there is a chair
    // pushed up to the opening in front of it, facing out over the drop. These
    // used to be authored as `VOID - x`, which is a point in mid-air a metre
    // inside the shaft, not a point on the deck: from the void edge the deck is
    // outboard, so it is `VOID + x`.
    {
      Props.officeChair(b, 2.6, 0, VOID + 1.05, { seed: 214, yaw: Math.PI, arms: false, damage: 0.8 });
      if (D) {
        D.quad(b, { stamp: STAMP.dustEdge, face: 'up', x: 2.6, y: 0.004, z: VOID + 1.05, w: 1.2, h: 1.2, strength: 1 });
        D.quad(b, { stamp: STAMP.sprayX, face: 'up', x: 2.6, y: 0.004, z: VOID + 1.9, w: 1.0, h: 1.0, strength: 0.8 });
      }
    }

    if (D) {
      D.roomPlate(b, -2.0, 2.05, -OUTER + 0.10, 0, roomNumber('K', 24), 'STACK');
      // Edge marking along the base of the well wall, on the deck side of it.
      D.hazardRun(b, 0, 0.004, -(WALL_OUT + 0.20), 17.0, { face: 'up', axis: 'x', h: 0.16, tile: 0.5, strength: 0.8 });
      D.hazardRun(b, 0, 0.004, WALL_OUT + 0.20, 17.0, { face: 'up', axis: 'x', h: 0.16, tile: 0.5, strength: 0.8 });
      D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: 0, y: 0.004, z: -VOID - 1.0, w: 1.4, h: 18, rot: Math.PI / 2, strength: 0.9 });
      D.footprints(b, [[-3.2, -10.4], [-3.2, -6.0], [4.0, -6.0], [9.6, -1.0]], { seed: 215, fade: 2.6, strength: 0.5 });
    }
  }

  // =========================================================================
  // the void: one cable bundle, and one light a long way down
  // =========================================================================
  {
    const b = bNear;
    const top = UP * LEVEL, bot = -DOWN * LEVEL;
    for (let k = 0; k < 5; k++) {
      const ox = -VOID + 0.55 + k * 0.06, oz = -VOID + 0.62 + (k % 2) * 0.05;
      const pts = [];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const y = lerp(top, bot, t);
        pts.push([ox + Math.sin(t * 5 + k) * 0.12, y, oz + Math.cos(t * 4 + k) * 0.12]);
      }
      const cable = pipeRun(pts, 0.018 + k * 0.004, 6, 1);
      worldUV(cable, 0.6); vertexShade(cable, () => 0.4);
      b.add('rubber', cable);
    }
    // Bracket clamps at each level, so the bundle is fixed to the building.
    for (let i = -DOWN; i <= UP; i += 2) {
      const g = box(0.34, 0.05, 0.05, 0.004, 1);
      g.rotateY(0.7); g.translate(-VOID + 0.45, i * LEVEL + 0.4, -VOID + 0.55);
      worldUV(g, 0.4); b.add('machinePaint', g);
    }
    // One bulkhead burning far below. It is the bottom of the frame's interest.
    bulkhead(bFar, rigFor(bFar), -VOID - 1.4, -DOWN * LEVEL + 2.2, -VOID - 0.6, {
      yaw: 0.8, circuit: 'stack', health: 'good', seed: 301,
    });
  }

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:stack';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables: [],
    spawn: [-3.2, 0, -OUTER + 1.7],
    spawnYaw: Math.PI,
    lightBudget: 14,
    fogProfile: 'stack',
    reverb: 'stack',
    ambient: { sky: 0x1a1a20, ground: 0x2a2a30, intensity: 0.34 },
    // The AO volume is baked over these, and geometry outside them gets no
    // occlusion at all — so they have to cover the well lining, which outruns
    // the last gallery in both directions, and the facade glazing, which sits
    // 80 mm proud of OUTER.
    bounds: new THREE.Box3(
      new THREE.Vector3(-OUTER - 0.2, WELL_BOT - 0.4, -OUTER - 0.2),
      new THREE.Vector3(OUTER + 0.2, Math.max(WELL_TOP + 0.4, UP * LEVEL + LEVEL + 0.2), OUTER + 0.2)),
  };
}

export default buildStack;
