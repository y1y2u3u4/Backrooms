import * as THREE from 'three';
import { whiteColors } from './geo.js';

/**
 * EmissiveBatch — one draw call per fixture *type* per zone for the glowing
 * part of a light fitting.
 *
 * Every fixture in the Annex is two things: a housing, which never moves and
 * never changes colour, and an emissive source — a fluorescent tube, a sodium
 * lamp, a bulkhead lens — which flickers on its own curve. The housing is baked
 * into the chunk's merged geometry and costs nothing. The source could not be,
 * because its colour changes every frame, so for most of this project's life it
 * was an independent `THREE.Mesh` per fixture.
 *
 * That is fine at a dozen fixtures and not fine at 217. Measured by
 * `tools/qa/perf.mjs` in the Intake's worst scenario: 221 draw calls, of which
 * 139 were emissive sources — the single largest contributor, and more than the
 * entire rest of the world put together. A first attempt hid sources beyond
 * 40 m; it recovered five draw calls, because the Intake is a dense 63 x 63 m
 * plate rather than a corridor and almost everything lit is already near. The
 * proxy was wrong: the cost was never distance, it was one mesh per fixture.
 *
 * So: one `InstancedMesh` per (zone, fixture type). The per-fixture variation is
 * exactly two things — where it is, and how bright it is this frame — which map
 * onto `instanceMatrix` and `instanceColor` without compromise. No fixture group
 * in the game animates (every read of `fixture.group.position` in the codebase
 * is a read), so an instance matrix can be written once at build time.
 *
 * Hiding an unpowered source zeroes its instance basis while KEEPING its
 * translation. Collapsing to the origin would be simpler and wrong twice over:
 * it drags the batch's bounding sphere out to enclose the world origin, which
 * defeats frustum culling, and it piles every dark fixture in the zone into one
 * degenerate heap.
 */

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _zero = new THREE.Vector3(0, 0, 0);

/**
 * A fixture's handle on its slot in a batch. Stands in for the `THREE.Mesh`
 * that `Fixture.tube` used to be, and is deliberately inert until the batch is
 * materialised — a builder can claim slots and never finish (the browser-free
 * QA harnesses do exactly that) without anything breaking.
 */
export class EmissiveSlot {
  constructor(batch, matrix) {
    this.batch = batch;
    /** World transform when lit. */
    this.matrix = matrix;
    /** Same transform with a zeroed basis — see the note above. */
    this.hidden = matrix.clone().scale(_zero);
    this.mesh = null;
    this.index = -1;
    this.visible = false;
    this._level = -1;
  }

  _bind(mesh, index) {
    this.mesh = mesh;
    this.index = index;
    mesh.setMatrixAt(index, this.hidden);
    mesh.setColorAt(index, _c.setScalar(0));
  }

  /**
   * @param {number} scale emissive multiplier — `def.tubeIntensity * level`,
   *   which legitimately exceeds 1 (a high bay's lamp runs at 2.2).
   * @param {boolean} visible
   */
  setLevel(scale, visible) {
    const mesh = this.mesh;
    if (visible !== this.visible) {
      this.visible = visible;
      if (mesh) {
        mesh.setMatrixAt(this.index, visible ? this.matrix : this.hidden);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (!visible || !mesh) return;
    // A steady fixture still ripples (+-1.5% at twice mains frequency), so this
    // does not skip many uploads — and the buffer is re-sent whole when any one
    // slot changes anyway. It is here because it is free, not because it is a
    // meaningful saving: 217 instances is 2.6 KB, which is not a cost worth
    // engineering around.
    if (Math.abs(scale - this._level) < 0.002) return;
    this._level = scale;
    mesh.setColorAt(this.index, _c.copy(this.batch.color).multiplyScalar(scale));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Current emissive colour. Diagnostics only (`Game.fixtureReport`). */
  get color() {
    return _c.copy(this.batch.color).multiplyScalar(Math.max(0, this._level));
  }
}

export class EmissiveBatch {
  constructor() {
    /** key -> {geo, color, slots[]} */
    this.groups = new Map();
    this.meshes = [];
  }

  /**
   * Claim a slot. `geoFactory` runs at most once per key, so the caller must put
   * anything that changes the geometry into the key — or, better, into the
   * instance transform, which is why a pendant passes its drop through
   * `position` instead of translating its bulb.
   *
   * @param {string} key
   * @param {() => THREE.BufferGeometry} geoFactory canonical geometry, authored
   *   about the fixture's own origin
   * @param {number} baseColor
   * @param {number[]} position world position of the emissive source
   * @param {number} rotationY
   * @returns {EmissiveSlot}
   */
  claim(key, geoFactory, baseColor, position, rotationY = 0) {
    let g = this.groups.get(key);
    if (!g) {
      g = { geo: geoFactory(), color: new THREE.Color(baseColor), slots: [] };
      this.groups.set(key, g);
    }
    _m.makeRotationY(rotationY);
    _m.setPosition(position[0], position[1], position[2]);
    const slot = new EmissiveSlot(g, _m.clone());
    g.slots.push(slot);
    return slot;
  }

  /** Build the instanced meshes and attach them to `root`. */
  materialize(root, name = 'chunk') {
    for (const [key, g] of this.groups) {
      if (!g.slots.length) { g.geo.dispose(); continue; }
      // instanceColor multiplies the material colour, so the material must be
      // white or every source would be tinted twice.
      //
      // `vertexColors` is on so one emissive geometry can carry more than one
      // brightness. A troffer's lamps and the opal diffuser in front of them
      // dim together and belong in the same instance, but they are not the same
      // luminance — the diffuser is light that has been through glass. Baking
      // that ratio into the vertices keeps it at one draw call. Any geometry
      // that arrives without colours gets white, so a source that wants a
      // single brightness is unaffected.
      whiteColors(g.geo);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, fog: true, toneMapped: true, vertexColors: true,
      });
      const mesh = new THREE.InstancedMesh(g.geo, mat, g.slots.length);
      mesh.name = `${name}:emissive:${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      for (let i = 0; i < g.slots.length; i++) g.slots[i]._bind(mesh, i);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Instance bases are zeroed but never moved, so the sphere computed here
      // stays correct for every combination of on and off.
      mesh.computeBoundingSphere();
      root.add(mesh);
      this.meshes.push(mesh);
    }
    this.groups.clear();
    return this.meshes;
  }
}

export default EmissiveBatch;
