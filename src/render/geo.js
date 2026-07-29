import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clamp01, lerp, smoothstep, hash3 } from '../core/util.js';

export { mergeGeometries, RoundedBoxGeometry };

/**
 * Geometry kit.
 *
 * Two rules the whole world is built under:
 *
 *  * NO RAW BOXES IN SIGHT. Every visible solid gets a chamfer. Real edges
 *    catch a highlight; a perfectly sharp 90 degrees reads as CG instantly,
 *    especially under long fluorescent tubes. `box()` here is a rounded box by
 *    default with a radius tuned to the object's smallest dimension.
 *
 *  * WORLD-SPACE UVs. Texel density is set once per material, not per mesh, so
 *    a 0.9 m door frame and a 14 m wall run share the same grain and nothing
 *    stretches. `worldUV()` does a dominant-axis planar projection.
 */

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

/** Chamfered box. `radius` defaults to a sane fraction of the shortest side. */
export function box(w, h, d, radius = null, segments = 2) {
  const r = radius ?? Math.min(0.018, Math.min(w, h, d) * 0.18);
  if (r < 0.0015) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, Math.min(w, h, d) * 0.49));
}

/** Plane standing in the XY plane, facing +Z. */
export function plane(w, h, ws = 1, hs = 1) {
  return new THREE.PlaneGeometry(w, h, ws, hs);
}

/**
 * Project UVs planar along the dominant world axis of each face.
 * @param {THREE.BufferGeometry} geo
 * @param {number} scale  world units per texture repeat
 * @param {THREE.Vector2} [offset]
 */
export function worldUV(geo, scale = 1, offset = new THREE.Vector2(0, 0), swizzle = false) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const inv = 1 / scale;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }        // floors / ceilings
    else if (nx >= nz) { u = z; v = y; }               // walls facing X
    else { u = x; v = y; }                             // walls facing Z
    if (swizzle) { const t = u; u = v; v = t; }
    uv[i * 2] = u * inv + offset.x;
    uv[i * 2 + 1] = v * inv + offset.y;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Same UVs on channel 1 (three's aoMap default channel is 0, this is spare). */
export function copyUV1(geo) {
  if (geo.attributes.uv) geo.setAttribute('uv1', geo.attributes.uv.clone());
  return geo;
}

/**
 * Bake soft occlusion into vertex colours.
 *
 * `fn(x, y, z, nx, ny, nz) -> [0..1]` multiplier. Cheap authored AO: builders
 * use it to darken wall bases, ceiling perimeters and the insides of recesses.
 * Combined with the GTAO post pass this gives contact darkening at both the
 * large scale (here) and the small scale (screen space).
 */
export function vertexShade(geo, fn) {
  const pos = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const existing = geo.attributes.color;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const s = clamp01(fn(pos.getX(i), pos.getY(i), pos.getZ(i),
      nor.getX(i), nor.getY(i), nor.getZ(i), i));
    const base = existing ? [existing.getX(i), existing.getY(i), existing.getZ(i)] : [1, 1, 1];
    col[i * 3] = base[0] * s;
    col[i * 3 + 1] = base[1] * s;
    col[i * 3 + 2] = base[2] * s;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Flat white vertex colours, so a geometry can join a vertexColors material. */
export function whiteColors(geo) {
  if (geo.attributes.color) return geo;
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return geo;
}

/** Standard grounding shade for interior surfaces: darker low, darker in corners. */
export function shadeInterior(geo, { floorY = 0, ceilY = 3.0, strength = 0.34 } = {}) {
  return vertexShade(geo, (x, y, z, nx, ny, nz) => {
    const fromFloor = smoothstep(floorY - 0.02, floorY + 0.75, y);
    const fromCeil = 1 - smoothstep(ceilY - 0.55, ceilY + 0.02, y);
    const up = clamp01(ny);
    // Downward-facing surfaces (undersides) never get the sky bounce.
    const down = clamp01(-ny);
    let s = 1 - strength * (1 - fromFloor) - strength * 0.6 * (1 - fromCeil);
    s -= down * 0.18;
    s += up * 0.04;
    return s;
  });
}

/** Random per-vertex tonal noise; breaks up flat large panels. */
export function mottle(geo, amount = 0.05, scale = 0.6, seed = 1) {
  return vertexShade(geo, (x, y, z) => {
    const n = hash3(Math.round(x / scale), Math.round(y / scale), Math.round(z / scale) + seed);
    return 1 - amount * 0.5 + n * amount;
  });
}

/** Transform helper: returns the geometry for chaining. */
export function xf(geo, { pos, rot, scale } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0);
  q.setFromEuler(e);
  m.compose(
    new THREE.Vector3(pos?.[0] || 0, pos?.[1] || 0, pos?.[2] || 0),
    q,
    new THREE.Vector3(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1));
  geo.applyMatrix4(m);
  return geo;
}

/** Merge a list of geometries, filling in missing attributes so merge succeeds. */
export function merge(list, useGroups = false) {
  const clean = list.filter(Boolean);
  if (!clean.length) return new THREE.BufferGeometry();
  const wantColor = clean.some((g) => g.attributes.color);
  const wantUV = clean.some((g) => g.attributes.uv);
  for (const g of clean) {
    if (wantColor) whiteColors(g);
    if (wantUV && !g.attributes.uv) {
      const n = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    // Merging requires identical attribute sets; drop anything exotic.
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'uv1', 'color'].includes(k)) g.deleteAttribute(k);
    }
    if (!g.attributes.uv1 && clean.some((o) => o.attributes.uv1)) copyUV1(g);
    if (!g.index) {
      // mergeGeometries requires consistent indexing.
      const n = g.attributes.position.count;
      g.setIndex(Array.from({ length: n }, (_, i) => i));
    }
  }
  const out = mergeGeometries(clean, useGroups);
  if (!out) {
    console.warn('geo.merge failed; returning first geometry');
    return clean[0];
  }
  return out;
}

/** Extrude a 2D profile (array of [x,y]) along +Z with an optional bevel. */
export function extrude(points, depth, { bevel = 0.006, steps = 1, curveSegments = 4 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps, curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Skirting / trim profile run along X. Returns geometry centred at origin. */
export function trimRun(length, profile, { bevel = 0.004 } = {}) {
  const g = extrude(profile, length, { bevel });
  g.rotateY(Math.PI / 2);
  return g;
}

/** A run of pipe through waypoints, with rounded elbows. */
export function pipeRun(points, radius = 0.05, radialSeg = 8, tubularPer = 3) {
  const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
  const seg = Math.max(6, Math.min(180, Math.round(len * tubularPer)));
  return new THREE.TubeGeometry(curve, seg, radius, radialSeg, false);
}

/** Flange/collar ring used at pipe joints and duct connections. */
export function collar(inner, outer, thickness, seg = 12) {
  const g = new THREE.CylinderGeometry(outer, outer, thickness, seg, 1, false);
  const hole = new THREE.CylinderGeometry(inner, inner, thickness * 1.2, seg, 1, true);
  hole.scale(1, 1, 1);
  // Cheap: keep the outer cylinder only; at these sizes the hole is never seen.
  hole.dispose?.();
  return g;
}

/** Lathe a profile (array of [radius, y]) — valves, handwheels, lamps. */
export function lathe(profile, segments = 20) {
  const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
  return new THREE.LatheGeometry(pts, segments);
}

/** Rounded, slightly-tapered cylinder — usable for bollards, legs, conduit. */
export function cyl(rTop, rBot, h, seg = 12, capped = true) {
  return new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !capped);
}

/**
 * A wall panel with a real edge return, so wall ends read as thick construction
 * rather than paper. Faces +Z. Returns geometry in local space centred at
 * (0, h/2, 0).
 */
export function wallPanel(w, h, thickness = 0.14, { chamfer = 0.01 } = {}) {
  const g = box(w, h, thickness, chamfer, 1);
  g.translate(0, h / 2, 0);
  return g;
}

/** Rectangular opening cut from a wall by building four surrounding panels. */
export function wallWithOpening(w, h, thickness, open) {
  const { x = 0, y = 0, ow = 1.0, oh = 2.05 } = open;
  const parts = [];
  const left = (x - ow / 2) - (-w / 2);
  const right = (w / 2) - (x + ow / 2);
  if (left > 0.001) parts.push(xf(box(left, h, thickness, 0.01, 1), { pos: [-w / 2 + left / 2, h / 2, 0] }));
  if (right > 0.001) parts.push(xf(box(right, h, thickness, 0.01, 1), { pos: [w / 2 - right / 2, h / 2, 0] }));
  const above = h - (y + oh);
  if (above > 0.001) parts.push(xf(box(ow, above, thickness, 0.01, 1), { pos: [x, y + oh + above / 2, 0] }));
  if (y > 0.001) parts.push(xf(box(ow, y, thickness, 0.01, 1), { pos: [x, y / 2, 0] }));
  return merge(parts);
}

/** Instanced-mesh helper that also tracks per-instance colour jitter. */
export function instancedFrom(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = true;
  const dummy = new THREE.Object3D();
  m.place = (pos, rot = [0, 0, 0], scale = [1, 1, 1]) => {
    dummy.position.set(pos[0], pos[1], pos[2]);
    dummy.rotation.set(rot[0], rot[1], rot[2]);
    dummy.scale.set(scale[0], scale[1], scale[2]);
    dummy.updateMatrix();
    m.setMatrixAt(m.count++, dummy.matrix);
    return m.count - 1;
  };
  m.finish = () => {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    return m;
  };
  return m;
}

/** Slightly perturb vertices to kill machine-perfect straightness. */
export function weather(geo, amount = 0.004, scale = 0.5, seed = 3) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = hash3(Math.round(x / scale), Math.round(y / scale), Math.round(z / scale) + seed) - 0.5;
    const n2 = hash3(Math.round(y / scale) + 7, Math.round(z / scale), Math.round(x / scale) + seed) - 0.5;
    const n3 = hash3(Math.round(z / scale), Math.round(x / scale) + 11, Math.round(y / scale) + seed) - 0.5;
    pos.setXYZ(i, x + n1 * amount, y + n2 * amount, z + n3 * amount);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Dispose an entire subtree's geometries and (optionally) materials. */
export function disposeTree(root, disposeMaterials = false) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (disposeMaterials && o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        m.map?.dispose(); m.normalMap?.dispose(); m.roughnessMap?.dispose();
        m.dispose();
      }
    }
  });
}

/** Total triangle count of a subtree — used by the perf HUD and QA. */
export function triCount(root) {
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const g = o.geometry;
    if (!g) return;
    const n = g.index ? g.index.count : g.attributes.position.count;
    tris += (n / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(tris);
}

export const lerpV = (a, b, t) => new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
export { _v, _n };
