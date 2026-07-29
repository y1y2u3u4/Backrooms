import * as THREE from 'three';
import { box, plane, merge, xf, worldUV, vertexShade, shadeInterior, mottle, pipeRun, cyl, lathe, weather, whiteColors } from '../render/geo.js';
import { makeRng, clamp01, lerp, smoothstep, hash2, TAU } from '../core/util.js';
import { makeLightCone } from '../render/Lighting.js';

/**
 * Kit — the Annex's modular construction language.
 *
 * Everything in the building obeys the same set of rules, which is what makes
 * an assembled-from-parts world feel like one designed place:
 *
 *   * Walls are 160 mm thick and always show their thickness at an opening.
 *   * Every wall meets the floor through a 110 mm skirting with a real bullnose
 *     profile, and meets the ceiling through a perimeter angle. No wall ever
 *     runs into a floor as a bare intersection — that single detail is the
 *     difference between "a room" and "two planes".
 *   * Suspended ceilings are a 1200x600 exposed tee grid with tiles dropped
 *     12 mm below the grid face, so the grid casts a real shadow line.
 *   * Services live in the plenum. Where a tile is missing you see them.
 *   * Nothing is placed on a perfect interval. Fixture spacing, tile damage and
 *     prop placement are all seeded per-room so two corridors built from the
 *     same call are never identical.
 */

/** Ceiling tile face height below the grid datum. */
const TILE_FACE = 0.030;
/** Tee underside below the grid datum — 8 mm proud of the tile. */
const TEE_DROP = 0.038;

export const KIT = {
  wallThickness: 0.16,
  skirtingHeight: 0.112,
  skirtingProud: 0.019,
  gridMain: 1.2,
  gridCross: 0.6,
  tileDrop: 0.013,
  ceilingIntake: 2.78,
  ceilingService: 2.95,
  corridorWidth: 2.25,
};

// --- profiles ---------------------------------------------------------------

/** Bullnose skirting profile in the XY plane, origin at floor/wall corner. */
const SKIRTING_PROFILE = [
  [0, 0], [KIT.skirtingProud, 0],
  [KIT.skirtingProud, KIT.skirtingHeight - 0.022],
  [KIT.skirtingProud * 0.72, KIT.skirtingHeight - 0.006],
  [KIT.skirtingProud * 0.30, KIT.skirtingHeight],
  [0, KIT.skirtingHeight],
];

/** Ceiling perimeter angle — an L, 24 x 24 mm. */
const ANGLE_PROFILE = [
  [0, 0], [0.024, 0], [0.024, 0.0022], [0.0022, 0.0022], [0.0022, 0.024], [0, 0.024],
];

/**
 * Extrude a profile (X = proud of the wall, Y = up) along Z by `length`,
 * centred on the origin. `side` mirrors it for the opposite wall face.
 */
function profileRunZ(profile, length, side = 1, bevel = 0.0015) {
  const shape = new THREE.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i][0], profile[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: length, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 1, steps: 1, curveSegments: 3,
  });
  g.translate(0, 0, -length / 2);
  if (side < 0) {
    g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    // Mirroring inverts winding; flip the index so faces point outward again.
    const idx = g.getIndex();
    if (idx) {
      const a = idx.array;
      for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
      idx.needsUpdate = true;
    }
    g.computeVertexNormals();
  }
  return g;
}

// --- floors -----------------------------------------------------------------

/**
 * Floor slab. `rect` = [x0, z0, x1, z1] in world space.
 * Subdivided so vertex shading can darken the perimeter — a floor lit only by
 * ceiling lights is always brighter in the middle of the room.
 */
export function floorSlab(b, rect, y, {
  key = 'carpet', surface = 'carpet', water = 0, tag = 'floor',
  subdiv = 1.6, edgeShade = 0.22, collide = true,
} = {}) {
  const [x0, z0, x1, z1] = rect;
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / subdiv)), Math.max(1, Math.round(d / subdiv)));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  worldUV(g, 2.0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  vertexShade(g, (x, _y, z) => {
    const ex = 1 - clamp01((Math.abs(x - cx) / (w / 2)) ** 3);
    const ez = 1 - clamp01((Math.abs(z - cz) / (d / 2)) ** 3);
    return 1 - edgeShade * (1 - Math.min(ex, ez));
  });
  b.add(key, g);
  if (collide) b.addFloor([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], y, { surface, water, tag });
  return g;
}

// --- walls ------------------------------------------------------------------

/**
 * A wall run between two points on the horizontal plane.
 *
 * @param {object} opts
 *   height, thickness, key (face material), skirtKey, openings [{at, width, height, sill}]
 */
export function wallRun(b, ax, az, bx, bz, {
  y = 0, height = KIT.ceilingIntake, thickness = KIT.wallThickness,
  key = 'wallpaper', skirtKey = 'trim', angleKey = 'trim',
  openings = [], skirting = true, perimeterAngle = true,
  collide = true, seed = 1, shadeFloorY = null, capEnds = true,
} = {}) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  const ang = Math.atan2(dx, dz);       // rotation about Y so +Z maps to the run
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const rng = makeRng(seed);

  // Build in local space: run along Z, thickness along X, then rotate.
  const local = [];
  const spans = finaliseSpans(solveSpans(len, openings), height);

  for (const s of spans) {
    const segLen = s.z1 - s.z0;
    if (segLen < 0.004) continue;
    const h = s.top - s.bottom;
    if (h < 0.004) continue;
    const g = box(thickness, h, segLen, 0.008, 1);
    g.translate(0, s.bottom + h / 2, (s.z0 + s.z1) / 2 - len / 2);
    local.push(g);
  }

  // Reveals: the visible thickness at each opening. Without these an opening
  // reads as a hole cut in cardboard.
  for (const o of openings) {
    const z = o.at - len / 2;
    const hw = o.width / 2;
    const sill = o.sill || 0;
    const top = sill + o.height;
    const rv = (side) => {
      const g = box(thickness, top - sill, 0.012, 0.004, 1);
      g.translate(0, (sill + top) / 2, z + side * hw);
      return g;
    };
    local.push(rv(-1), rv(1));
    const head = box(thickness, 0.012, o.width, 0.004, 1);
    head.translate(0, top, z);
    local.push(head);
  }

  if (capEnds) {
    // Slight return at each end so a wall that terminates in open air still
    // shows construction rather than a paper edge.
    for (const s of [-1, 1]) {
      const g = box(thickness * 1.02, height, 0.014, 0.004, 1);
      g.translate(0, height / 2, s * (len / 2 - 0.007));
      local.push(g);
    }
  }

  const wallGeo = merge(local);
  worldUVLocal(wallGeo, 2.0);
  const geo = orient(wallGeo, cx, y, cz, ang);
  const fy = shadeFloorY ?? y;
  shadeInterior(geo, { floorY: fy, ceilY: y + height, strength: 0.30 });
  mottle(geo, 0.055, 0.9, seed);
  b.add(key, geo);

  if (skirting) {
    const trims = [];
    for (const side of [-1, 1]) {
      for (const s of spans) {
        if (s.bottom > 0.001) continue;      // no skirting across a doorway
        const segLen = s.z1 - s.z0;
        if (segLen < 0.06) continue;
        const g = profileRunZ(SKIRTING_PROFILE, segLen - 0.004, side);
        g.translate(side * (thickness / 2), 0, (s.z0 + s.z1) / 2 - len / 2);
        trims.push(g);
      }
    }
    if (trims.length) {
      const m = orient(merge(trims), cx, y, cz, ang);
      worldUV(m, 0.6);
      vertexShade(m, (px, py) => 0.72 + clamp01(py / KIT.skirtingHeight) * 0.16);
      b.add(skirtKey, m);
    }
  }

  if (perimeterAngle) {
    const angles = [];
    for (const side of [-1, 1]) {
      // Angle sits under the ceiling line: the L opens downward/inward.
      const g = profileRunZ(ANGLE_PROFILE, len - 0.004, side);
      g.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, 1));
      const idx = g.getIndex();
      if (idx) {
        const a = idx.array;
        for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
        idx.needsUpdate = true;
      }
      g.computeVertexNormals();
      g.translate(side * (thickness / 2), height, 0);
      angles.push(g);
    }
    const m = orient(merge(angles), cx, y, cz, ang);
    worldUV(m, 0.4);
    vertexShade(m, () => 0.68);
    b.add(angleKey, m);
  }

  if (collide) {
    // Colliders follow the solved spans so doorways are actually walkable.
    for (const s of spans) {
      if (s.bottom > 1.7) continue;   // headers do not block a walking body
      const segLen = s.z1 - s.z0;
      if (segLen < 0.02) continue;
      const mid = (s.z0 + s.z1) / 2 - len / 2;
      const wx = cx + Math.sin(ang) * mid;
      const wz = cz + Math.cos(ang) * mid;
      const along = Math.abs(Math.sin(ang)) > 0.7;
      const sx = along ? segLen : thickness;
      const sz = along ? thickness : segLen;
      b.addColliderAt(wx, y + s.bottom + (s.top - s.bottom) / 2, wz, sx, s.top - s.bottom, sz, { tag: 'wall' });
    }
  }
  return geo;
}

/** Split a wall of `len` into solid spans around a list of openings. */
function solveSpans(len, openings) {
  const spans = [];
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  let cursor = 0;
  for (const o of sorted) {
    const z0 = o.at - o.width / 2, z1 = o.at + o.width / 2;
    if (z0 > cursor) spans.push({ z0: cursor, z1: z0, bottom: 0, top: Infinity });
    const sill = o.sill || 0;
    if (sill > 0.001) spans.push({ z0, z1, bottom: 0, top: sill });
    spans.push({ z0, z1, bottom: sill + o.height, top: Infinity });
    cursor = z1;
  }
  if (cursor < len) spans.push({ z0: cursor, z1: len, bottom: 0, top: Infinity });
  return spans;
}

/** Substitute Infinity tops with the wall height, then finalise. */
function finaliseSpans(spans, height) {
  for (const s of spans) if (!isFinite(s.top)) s.top = height;
  return spans;
}

function worldUVLocal(geo, scale) {
  // The wall is built in local space then rotated; project UVs before the
  // rotation so texture grain follows the wall rather than the world axes.
  return worldUV(geo, scale);
}

function orient(geo, cx, y, cz, ang) {
  geo.rotateY(ang);
  geo.translate(cx, y, cz);
  geo.computeVertexNormals();
  return geo;
}

// --- suspended ceiling ------------------------------------------------------

/**
 * Exposed-tee suspended ceiling over `rect` at height `y`.
 *
 * Emits: perimeter angle, main runners, cross tees, tiles (dropped below the
 * grid face), and a dark plenum shell so missing tiles read as depth. Damage
 * is seeded: `damage` 0..1 controls how many tiles are missing, sagging or
 * water-stained.
 */
export function ceilingGrid(b, rect, y, {
  key = 'ceilingTile', gridKey = 'gridMetal', plenumKey = 'plenum',
  damage = 0.12, seed = 7, plenumDepth = 0.62, lightSlots = [], tag = 'ceiling',
  collide = true,
} = {}) {
  const [x0, z0, x1, z1] = rect;
  const rng = makeRng(seed * 7919);
  const gx = Math.max(1, Math.round(Math.abs(x1 - x0) / KIT.gridMain));
  const gz = Math.max(1, Math.round(Math.abs(z1 - z0) / KIT.gridCross));
  const cw = (x1 - x0) / gx;
  const cd = (z1 - z0) / gz;

  const tiles = [];
  const grid = [];
  const plenum = [];
  const missing = [];

  // Plenum shell — a dark box above the grid, so a hole shows a void.
  const pw = Math.abs(x1 - x0), pd = Math.abs(z1 - z0);
  const shell = new THREE.BoxGeometry(pw, plenumDepth, pd);
  shell.translate((x0 + x1) / 2, y + plenumDepth / 2 + 0.02, (z0 + z1) / 2);
  shell.scale(1, 1, 1);
  const shellFlip = shell.clone();
  shellFlip.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); // inward-facing
  worldUV(shellFlip, 1.4);
  vertexShade(shellFlip, () => 0.30);
  plenum.push(shellFlip);
  shell.dispose();

  for (let ix = 0; ix < gx; ix++) {
    for (let iz = 0; iz < gz; iz++) {
      const cx = x0 + (ix + 0.5) * cw;
      const cz = z0 + (iz + 0.5) * cd;
      const slot = lightSlots.find((s) => Math.abs(s[0] - cx) < cw * 0.5 && Math.abs(s[1] - cz) < cd * 0.5);
      if (slot) continue;   // a fixture occupies this cell

      const h = hash2(Math.round(cx * 13), Math.round(cz * 13));
      if (h < damage * 0.34) { missing.push([cx, cz, cw, cd]); continue; }

      const sag = h < damage ? (h / Math.max(damage, 1e-4)) * 0.055 : 0;
      // Tiles must run UNDER the tee flange, not stop short of it. A gap of a
      // couple of millimetres between tile and tee shows the black plenum
      // behind and aliases into a field of black speckles across the whole
      // ceiling at any distance — the single worst artifact in the first build.
      const tw = cw - 0.010, td = cd - 0.010;
      const segs = sag > 0.004 ? 3 : 1;
      const g = new THREE.PlaneGeometry(tw, td, segs, segs);
      g.rotateX(Math.PI / 2);       // face down
      if (sag > 0.004) {
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const px = pos.getX(i) / (tw / 2), pz = pos.getZ(i) / (td / 2);
          const d = Math.max(Math.abs(px), Math.abs(pz));
          pos.setY(i, -sag * (1 - d * d));
        }
        pos.needsUpdate = true;
      }
      g.translate(cx, y - TILE_FACE, cz);
      worldUV(g, 1.22);
      const shade = 0.86 + h * 0.20;
      vertexShade(g, (px, py, pz) => {
        // Darker toward the tile edge where the grid shades it.
        const ex = 1 - clamp01(Math.abs(px - cx) / (tw / 2));
        const ez = 1 - clamp01(Math.abs(pz - cz) / (td / 2));
        return shade * (0.86 + 0.14 * Math.min(1, Math.min(ex, ez) * 5));
      });
      tiles.push(g);
    }
  }

  // Grid tees. Mains along Z at each x boundary, crosses along X.
  // The flange is wider than the tile inset so tile and tee genuinely overlap,
  // and its underside sits ~8 mm proud of the tile face, which is what gives a
  // real exposed-tee ceiling its shadow line.
  const teeW = 0.026, teeH = 0.036;
  const teeBottom = y - TEE_DROP;
  for (let ix = 0; ix <= gx; ix++) {
    const x = x0 + ix * cw;
    const g = box(teeW, teeH, Math.abs(z1 - z0), 0.003, 1);
    g.translate(x, teeBottom + teeH / 2, (z0 + z1) / 2);
    grid.push(g);
  }
  for (let iz = 0; iz <= gz; iz++) {
    const z = z0 + iz * cd;
    const g = box(Math.abs(x1 - x0), teeH, teeW, 0.003, 1);
    g.translate((x0 + x1) / 2, teeBottom + teeH / 2, z);
    grid.push(g);
  }

  // A missing tile has to show something. Hanger wires, a length of conduit and
  // a cable bundle crossing the void give the hole depth and read as a real
  // ceiling void rather than a black rectangle.
  for (const [cx, cz] of missing) {
    for (let i = 0; i < 3; i++) {
      const hx = cx + (rng() - 0.5) * cw * 0.7;
      const hz = cz + (rng() - 0.5) * cd * 0.7;
      const g = cyl(0.005, 0.005, plenumDepth * 0.92, 4);
      g.translate(hx, y + plenumDepth * 0.46, hz);
      plenum.push(g);
    }
    // Conduit crossing the void, on hangers, at a believable plenum height.
    const alongX = rng.chance(0.5);
    const cy = y + plenumDepth * (0.3 + rng() * 0.35);
    const half = (alongX ? cw : cd) * 0.62;
    const pipe = pipeRun(alongX
      ? [[cx - half, cy, cz + (rng() - 0.5) * cd * 0.4], [cx + half, cy, cz + (rng() - 0.5) * cd * 0.4]]
      : [[cx + (rng() - 0.5) * cw * 0.4, cy, cz - half], [cx + (rng() - 0.5) * cw * 0.4, cy, cz + half]],
      0.026, 6, 2);
    plenum.push(pipe);
    // Cable bundle, sagging.
    const sag = 0.09 + rng() * 0.07;
    const bx = cx + (rng() - 0.5) * cw * 0.3, bz = cz + (rng() - 0.5) * cd * 0.3;
    const by = cy + 0.10;
    plenum.push(pipeRun(alongX
      ? [[bx - half, by, bz], [bx, by - sag, bz], [bx + half, by, bz]]
      : [[bx, by, bz - half], [bx, by - sag, bz], [bx, by, bz + half]], 0.018, 5, 4));
    // A slab soffit above, so the void is not infinitely deep.
    const soffit = box((alongX ? cw : cw) * 1.0, 0.04, cd, 0.004, 1);
    soffit.translate(cx, y + plenumDepth * 0.96, cz);
    plenum.push(soffit);
  }

  if (tiles.length) { const m = merge(tiles); b.add(key, m); }
  if (grid.length) { const m = merge(grid); worldUV(m, 1.0); vertexShade(m, () => 0.78); b.add(gridKey, m); }
  if (plenum.length) { const m = merge(plenum); worldUV(m, 1.6); b.add(plenumKey, m); }

  if (collide) {
    b.addColliderAt((x0 + x1) / 2, y + 0.3, (z0 + z1) / 2, Math.abs(x1 - x0), 0.6, Math.abs(z1 - z0), { tag: 'ceiling' });
  }
  return { missing, cellW: cw, cellD: cd };
}

// --- fixtures ---------------------------------------------------------------

/**
 * Recessed twin-tube troffer. Emits housing + diffuser + tubes and registers a
 * Fixture on the rig. `rotation` in radians about Y.
 */
/**
 * Recessed twin-tube troffer.
 *
 * `y` is the CEILING DATUM (the same y passed to ceilingGrid), not the fixture
 * body position — the fixture works out its own mounting depth so the diffuser
 * face lands flush with the tile face. Pass the fixture's cell centre to
 * ceilingGrid's `lightSlots` or the tile will be drawn straight over it.
 */
export function troffer(b, rig, x, y, z, {
  rotation = 0, circuit = 'main', health = 'good', seed = 1, cone = true, type = 'troffer',
} = {}) {
  const def = { troffer: [1.20, 0.30], strip: [1.55, 0.14] }[type] || [1.2, 0.3];
  const [L, W] = def;
  y = y - TILE_FACE;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotation;

  const bodyMat = b.mat('fixtureBody', () => b.materials.get('steelPainted', {
    repeat: [1.6, 1.6], color: 0xbfbfb8, metalness: 0.9, roughness: 0.55,
    dirtAmount: 0.15, detailStrength: 0.25, envMapIntensity: 0.8,
  }));
  const housing = box(L + 0.06, 0.12, W + 0.06, 0.006, 1);
  housing.translate(0, 0.062, 0);
  // Specular reflector pan behind the tubes.
  const reflector = box(L - 0.01, 0.014, W - 0.01, 0.003, 1);
  reflector.translate(0, 0.085, 0);
  // Visible flange around the aperture — this is what makes it read as a unit
  // set into the grid instead of a hole with light behind it.
  const frameParts = [];
  for (const [fw, fd, ox, oz] of [
    [L + 0.06, 0.028, 0, (W + 0.032) / 2],
    [L + 0.06, 0.028, 0, -(W + 0.032) / 2],
    [0.032, 0.028, (L + 0.032) / 2, 0],
    [0.032, 0.028, -(L + 0.032) / 2, 0],
  ]) {
    const f = box(fw, 0.014, fd + (ox !== 0 ? W + 0.06 : 0), 0.003, 1);
    f.translate(ox, 0.004, oz);
    frameParts.push(f);
  }
  // Two tubes with visible end caps.
  const tubeGeos = [];
  for (const off of [-W * 0.24, W * 0.24]) {
    const t = new THREE.CylinderGeometry(0.019, 0.019, L - 0.10, 10, 1);
    t.rotateZ(Math.PI / 2);
    t.translate(0, 0.040, off);
    tubeGeos.push(t);
  }
  const tubeGeo = merge(tubeGeos);
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2, fog: true, toneMapped: true });
  tubeMat.userData.baseColor = new THREE.Color(0xfff6e2);
  const tubes = new THREE.Mesh(tubeGeo, tubeMat);
  g.add(tubes);

  const capGeos = [];
  for (const off of [-W * 0.24, W * 0.24]) {
    for (const s of [-1, 1]) {
      const c = cyl(0.023, 0.023, 0.028, 8);
      c.rotateZ(Math.PI / 2);
      c.translate(s * (L / 2 - 0.055), 0.040, off);
      capGeos.push(c);
    }
  }
  // The housing never moves and never changes colour, so it is baked into the
  // chunk's static geometry instead of costing a draw call per fixture. Only
  // the emissive tube stays an independent object, because it animates.
  const staticGeo = merge([housing, reflector, ...frameParts, ...capGeos]);
  staticGeo.rotateY(rotation);
  staticGeo.translate(x, y, z);
  worldUV(staticGeo, 0.9);
  whiteColors(staticGeo);
  vertexShade(staticGeo, (px, py, pz, nx, ny) => (ny < -0.4 ? 0.92 : 0.62));
  b.add('fixtureBody', staticGeo, () => bodyMat);

  const fixture = rig.add({ type, position: [x, y, z], rotation, circuit, health, seed });
  fixture.tube = tubes;
  b.addObject(g);

  if (cone) {
    const c = makeLightCone(3.2, 1.55, 0xfff0cf);
    c.position.set(0, -0.03, 0);
    fixture.group.add(c);
    fixture.coneMesh = c;
  }
  return fixture;
}

// --- construction details ---------------------------------------------------

/** Sprinkler head on a drop, on the underside of a ceiling. */
export function sprinkler(b, x, y, z, key = 'chrome') {
  const parts = [];
  const drop = cyl(0.012, 0.012, 0.05, 6); drop.translate(0, -0.025, 0);
  const bodyG = cyl(0.017, 0.022, 0.036, 8); bodyG.translate(0, -0.062, 0);
  const rose = new THREE.CylinderGeometry(0.038, 0.030, 0.008, 10); rose.translate(0, -0.012, 0);
  const deflector = box(0.042, 0.004, 0.042, 0.001, 1); deflector.translate(0, -0.086, 0);
  parts.push(drop, bodyG, rose, deflector);
  const g = merge(parts);
  g.translate(x, y, z);
  worldUV(g, 0.35);
  b.add(key, g);
}

/** Smoke detector disc. */
export function smokeDetector(b, x, y, z, key = 'plasticWhite') {
  const base = new THREE.CylinderGeometry(0.062, 0.062, 0.012, 14); base.translate(0, -0.006, 0);
  const dome = new THREE.CylinderGeometry(0.048, 0.058, 0.026, 14); dome.translate(0, -0.025, 0);
  const g = merge([base, dome]);
  g.translate(x, y, z);
  worldUV(g, 0.3);
  b.add(key, g);
}

/** Surface conduit run with saddle clips. */
export function conduit(b, points, { radius = 0.021, key = 'conduitMetal', clipEvery = 1.4 } = {}) {
  const g = pipeRun(points, radius, 8, 3);
  worldUV(g, 0.55);
  const parts = [g];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = new THREE.Vector3(...points[i - 1]);
    const bb = new THREE.Vector3(...points[i]);
    const len = a.distanceTo(bb);
    for (let d = clipEvery * 0.5; d < len; d += clipEvery) {
      const t = d / len;
      const p = a.clone().lerp(bb, t);
      const clip = box(radius * 3.1, radius * 0.9, radius * 3.1, 0.002, 1);
      clip.translate(p.x, p.y, p.z);
      parts.push(clip);
    }
    acc += len;
  }
  const m = merge(parts);
  vertexShade(m, () => 0.86);
  b.add(key, m);
}

/** Wall-mounted supply/extract grille with real louvre blades. */
export function grille(b, x, y, z, { w = 0.42, h = 0.28, rotation = 0, key = 'grilleMetal', blades = 7, recess = 0.05 } = {}) {
  const parts = [];
  const frame = box(w, h, 0.022, 0.003, 1);
  parts.push(frame);
  const inner = box(w - 0.05, h - 0.05, recess, 0.002, 1);
  inner.translate(0, 0, -recess / 2 - 0.01);
  parts.push(inner);
  for (let i = 0; i < blades; i++) {
    const t = (i + 0.5) / blades;
    const bl = box(w - 0.056, 0.014, 0.03, 0.002, 1);
    bl.rotateX(-0.55);
    bl.translate(0, h / 2 - 0.03 - t * (h - 0.06), -0.012);
    parts.push(bl);
  }
  const g = merge(parts);
  g.rotateY(rotation);
  g.translate(x, y, z);
  worldUV(g, 0.4);
  vertexShade(g, (px, py, pz, nx, ny, nz) => (nz < -0.3 || ny > 0.3 ? 0.5 : 0.9));
  b.add(key, g);
  return g;
}

/** Double socket / data outlet on a wall face. */
export function outlet(b, x, y, z, { rotation = 0, key = 'plasticWhite', type = 'power' } = {}) {
  const parts = [];
  const plate = box(0.146, 0.086, 0.011, 0.003, 1);
  parts.push(plate);
  if (type === 'power') {
    for (const s of [-1, 1]) {
      const sock = box(0.052, 0.052, 0.004, 0.002, 1);
      sock.translate(s * 0.034, 0, 0.007);
      parts.push(sock);
    }
  } else {
    for (const s of [-1, 1]) {
      const port = box(0.018, 0.03, 0.006, 0.001, 1);
      port.translate(s * 0.03, 0, 0.007);
      parts.push(port);
    }
  }
  const g = merge(parts);
  g.rotateY(rotation);
  g.translate(x, y, z);
  worldUV(g, 0.25);
  b.add(key, g);
}

/** Door frame + leaf. Returns the door object for the interaction system. */
export function doorway(b, x, y, z, {
  rotation = 0, width = 0.92, height = 2.06, thickness = KIT.wallThickness,
  frameKey = 'doorFrame', leafKey = 'doorLeaf', open = 0, hinge = 1, seed = 1,
  glazed = false, closed = true,
} = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotation;

  // Frame: two jambs + head, each with an architrave on both faces.
  const jambW = 0.05;
  const parts = [];
  for (const s of [-1, 1]) {
    const j = box(jambW, height + 0.02, thickness + 0.004, 0.006, 1);
    j.translate(s * (width / 2 + jambW / 2), (height + 0.02) / 2, 0);
    parts.push(j);
    for (const f of [-1, 1]) {
      const arch = box(0.062, height + 0.09, 0.016, 0.004, 1);
      arch.translate(s * (width / 2 + jambW * 0.5), (height + 0.09) / 2, f * (thickness / 2 + 0.008));
      parts.push(arch);
    }
  }
  const head = box(width + jambW * 2, jambW, thickness + 0.004, 0.006, 1);
  head.translate(0, height + 0.02 + jambW / 2 - 0.02, 0);
  parts.push(head);
  for (const f of [-1, 1]) {
    const arch = box(width + 0.19, 0.062, 0.016, 0.004, 1);
    arch.translate(0, height + 0.055, f * (thickness / 2 + 0.008));
    parts.push(arch);
  }
  // Threshold strip.
  const thr = box(width + 0.06, 0.008, thickness + 0.03, 0.002, 1);
  thr.translate(0, 0.004, 0);
  parts.push(thr);

  // The frame is static: bake it into the chunk rather than spend a draw call
  // on every doorway in the building. Only the leaf and its furniture move.
  const frameGeo = merge(parts);
  frameGeo.rotateY(rotation);
  frameGeo.translate(x, y, z);
  worldUV(frameGeo, 0.7);
  whiteColors(frameGeo);
  vertexShade(frameGeo, (px, py) => 0.80 + clamp01((py - y) / height) * 0.12);
  b.add(frameKey, frameGeo, () => b.materials.get('doorPaint', {
    repeat: [1.2, 1.2], roughness: 0.62, metalness: 0, dirtAmount: 0.5, detailStrength: 0.3,
  }));

  // Leaf, pivoting on a hinge group.
  const pivot = new THREE.Group();
  pivot.position.set(hinge * (width / 2 - 0.005), 0, 0);
  grp.add(pivot);

  const leafParts = [];
  const leaf = box(width - 0.012, height - 0.012, 0.044, 0.006, 1);
  leaf.translate(-hinge * (width / 2 - 0.005), (height - 0.012) / 2 + 0.006, 0);
  leafParts.push(leaf);
  if (glazed) {
    const vision = box(0.20, 0.52, 0.05, 0.004, 1);
    vision.translate(-hinge * (width / 2 - 0.005), height * 0.66, 0);
    // Just a recess; the glass is added as a separate transparent object.
    leafParts.push(vision);
  }
  const leafGeo = merge(leafParts);
  worldUV(leafGeo, 1.1);
  whiteColors(leafGeo);
  vertexShade(leafGeo, (px, py) => 0.78 + clamp01(py / height) * 0.16);
  const leafMesh = new THREE.Mesh(leafGeo, b.mat(leafKey, () => b.materials.get('doorPaint', {
    repeat: [1.0, 1.6], roughness: 0.58, metalness: 0, dirtAmount: 0.6, detailStrength: 0.35,
  })));
  leafMesh.castShadow = true; leafMesh.receiveShadow = true;
  pivot.add(leafMesh);

  // Lever handle both sides.
  const handleMat = b.mat('chrome', () => b.materials.get('galvSteel', {
    repeat: [2, 2], metalness: 1, roughness: 0.32, dirtAmount: 0.3, envMapIntensity: 1.1,
  }));
  const hParts = [];
  for (const f of [-1, 1]) {
    const rose = cyl(0.028, 0.028, 0.008, 10);
    rose.rotateX(Math.PI / 2);
    rose.translate(-hinge * (width - 0.13) + hinge * (width / 2 - 0.005) * 0, 1.045, f * 0.026);
    const lever = box(0.019, 0.019, 0.10, 0.006, 1);
    lever.rotateY(0);
    lever.translate(-hinge * (width - 0.13), 1.045, f * 0.072);
    const nose = box(0.017, 0.017, 0.017, 0.005, 1);
    nose.translate(-hinge * (width - 0.13) - hinge * 0.035, 1.045, f * 0.118);
    hParts.push(rose, lever, nose);
  }
  const hg = merge(hParts);
  hg.translate(hinge * (width / 2 - 0.005) * -1 + hinge * (width / 2 - 0.005), 0, 0);
  worldUV(hg, 0.3);
  whiteColors(hg);
  const handles = new THREE.Mesh(hg, handleMat);
  handles.castShadow = true;
  pivot.add(handles);

  pivot.rotation.y = open;
  grp.userData.door = { pivot, hinge, width, height, open, target: open, closed };
  b.addObject(grp);
  return grp;
}

/** Simple printed sign plate — text is drawn by the caller into a canvas map. */
export function signPlate(b, x, y, z, { rotation = 0, w = 0.30, h = 0.11, key = 'signPlate' } = {}) {
  const g = box(w, h, 0.008, 0.002, 1);
  g.rotateY(rotation);
  g.translate(x, y, z);
  worldUV(g, 0.5);
  b.add(key, g);
  return g;
}

export { profileRunZ, solveSpans, finaliseSpans, SKIRTING_PROFILE, ANGLE_PROFILE, TILE_FACE, TEE_DROP };
export default KIT;
