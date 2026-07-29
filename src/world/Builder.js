import * as THREE from 'three';
import { merge, whiteColors, triCount } from '../render/geo.js';

/**
 * Builder — accumulates geometry into per-material buckets and merges each
 * bucket into a single mesh at the end.
 *
 * The whole world is authored as thousands of small pieces (every skirting
 * board, every conduit clip, every ceiling tee) and then collapsed into a
 * handful of draw calls per chunk. This is what makes it affordable to put in
 * the construction detail that separates a believable interior from a set of
 * boxes: the detail costs triangles, which are cheap, not draw calls, which
 * are not.
 *
 * Anything that must move, light up or be interacted with is added as a
 * separate object via `addObject` and stays independent.
 */

export class Builder {
  /**
   * @param {import('../render/Materials.js').MaterialLibrary} materials
   * @param {import('../player/Physics.js').CollisionWorld} collision
   */
  constructor(materials, collision, { name = 'chunk' } = {}) {
    this.materials = materials;
    this.collision = collision;
    this.name = name;
    this.buckets = new Map();     // materialKey -> {material, geos[]}
    this.objects = [];
    this.lights = [];
    this.interactables = [];
    this.root = new THREE.Group();
    this.root.name = name;
    this.bounds = new THREE.Box3();
    this._matCache = new Map();
  }

  /** Register (or fetch) a material under a stable key. */
  mat(key, factory) {
    if (!this._matCache.has(key)) {
      this._matCache.set(key, typeof factory === 'function' ? factory() : factory);
    }
    return this._matCache.get(key);
  }

  /**
   * Queue geometry (already positioned in world space) under a material key.
   * @param {string} key
   * @param {THREE.BufferGeometry|THREE.BufferGeometry[]} geo
   */
  add(key, geo, materialFactory = null) {
    if (!geo) return this;
    const list = Array.isArray(geo) ? geo : [geo];
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { geos: [], material: materialFactory ? this.mat(key, materialFactory) : null };
      this.buckets.set(key, bucket);
    }
    if (!bucket.material && materialFactory) bucket.material = this.mat(key, materialFactory);
    for (const g of list) {
      if (!g) continue;
      whiteColors(g);
      bucket.geos.push(g);
    }
    return this;
  }

  /** Independent object — doors, machines, lights, anything animated. */
  addObject(obj) {
    this.objects.push(obj);
    this.root.add(obj);
    return obj;
  }

  addCollider(min, max, meta) { return this.collision.addBox(min, max, meta); }
  addColliderAt(cx, cy, cz, sx, sy, sz, meta) {
    return this.collision.addBoxAt(cx, cy, cz, sx, sy, sz, meta);
  }
  addFloor(rect, y, meta) { return this.collision.addFloor(rect, y, meta); }

  /** A wall: geometry + matching collider in one call. */
  wall(key, geo, collider) {
    this.add(key, geo);
    if (collider) this.addCollider(collider[0], collider[1], collider[2]);
    return this;
  }

  /** Merge all buckets and attach to the root group. */
  finish({ castShadow = true, receiveShadow = true } = {}) {
    for (const [key, bucket] of this.buckets) {
      if (!bucket.geos.length) continue;
      if (!bucket.material) {
        console.warn(`Builder[${this.name}]: bucket "${key}" has no material; skipped`);
        continue;
      }
      const merged = merge(bucket.geos);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.name = `${this.name}:${key}`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.root.add(mesh);
      this.bounds.union(merged.boundingBox);
      for (const g of bucket.geos) g.dispose();
      bucket.geos.length = 0;
    }
    this.root.userData.tris = triCount(this.root);
    return this.root;
  }

  get stats() {
    let geos = 0;
    for (const b of this.buckets.values()) geos += b.geos.length;
    return { buckets: this.buckets.size, queued: geos, objects: this.objects.length };
  }
}

export default Builder;
