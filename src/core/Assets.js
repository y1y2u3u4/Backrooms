import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV, whiteColors, triCount } from '../render/geo.js';

/**
 * Assets — GLB registry for the Blender-authored hero props.
 *
 * Blender exports carry placeholder materials named `MAT_<surface>`. Rather
 * than shipping baked textures, the loader re-materialises every mesh against
 * the game's procedural palette using that name. This keeps one lighting and
 * wear language across Blender assets and in-engine geometry, and it means a
 * change to a palette entry re-grades the props too.
 *
 * Assets are optional: if a GLB is missing the game logs once and carries on,
 * so the world always builds even mid-production.
 */

/** Blender material name -> palette key. Extend as the library grows. */
export const MATERIAL_MAP = {
  MAT_steel_painted: 'machinePaint',
  MAT_steel: 'conduitMetal',
  MAT_steel_galv: 'ductMetal',
  MAT_steel_rust: 'rust',
  MAT_chrome: 'chrome',
  MAT_tread: 'tread',
  MAT_plastic: 'plasticWhite',
  MAT_plastic_white: 'plasticWhite',
  MAT_rubber: 'fabric',
  MAT_ceramic: 'plasticWhite',
  MAT_brass: 'chrome',
  MAT_paint: 'doorLeaf',
  MAT_wood: 'doorLeaf',
  MAT_laminate: 'doorFrame',
  MAT_fabric: 'fabric',
  MAT_paper: 'paper',
  MAT_concrete: 'concreteWall',
  MAT_glass: null,        // handled specially
  MAT_emissive: null,     // handled specially
  MAT_skin: null,
};

export class Assets {
  constructor({ materials, palette, basePath = 'assets/models/' }) {
    this.materials = materials;
    this.palette = palette;
    this.basePath = basePath;
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.manifest = null;
    this.missing = new Set();
  }

  async loadManifest() {
    try {
      const r = await fetch(this.basePath + 'manifest.json');
      if (!r.ok) throw new Error(r.status);
      this.manifest = await r.json();
    } catch {
      this.manifest = { assets: [] };
    }
    return this.manifest;
  }

  /** Load a GLB and re-materialise it. Returns a prototype Group (not cloned). */
  async load(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const url = this.basePath + (name.endsWith('.glb') ? name : `${name}.glb`);
    let gltf;
    try {
      gltf = await this.loader.loadAsync(url);
    } catch (e) {
      if (!this.missing.has(name)) {
        console.info(`[assets] "${name}" not available yet — using in-engine fallback`);
        this.missing.add(name);
      }
      this.cache.set(name, null);
      return null;
    }
    const root = gltf.scene;
    root.name = name;
    this._remat(root);
    root.userData.tris = triCount(root);
    this.cache.set(name, root);
    return root;
  }

  /** Load many, tolerating failures. */
  async loadAll(names, onProgress) {
    const out = {};
    for (let i = 0; i < names.length; i++) {
      out[names[i]] = await this.load(names[i]);
      onProgress?.((i + 1) / names.length, names[i]);
    }
    return out;
  }

  /** An instance ready to place in the world. */
  instance(name, { scale = 1 } = {}) {
    const proto = this.cache.get(name);
    if (!proto) return null;
    const c = proto.clone(true);
    if (scale !== 1) c.scale.setScalar(scale);
    c.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    return c;
  }

  _remat(root) {
    const seen = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const g = o.geometry;
      whiteColors(g);
      if (!g.attributes.uv) worldUV(g, 1.0);

      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const key = src?.name || '';
      if (seen.has(key)) { o.material = seen.get(key); return; }

      let mat;
      if (key === 'MAT_glass') {
        mat = new THREE.MeshPhysicalMaterial({
          color: 0xcfd6d2, roughness: 0.08, metalness: 0, transmission: 0.85,
          thickness: 0.01, transparent: true, opacity: 0.5, envMapIntensity: 1.2,
          depthWrite: false,
        });
      } else if (key === 'MAT_emissive') {
        mat = new THREE.MeshBasicMaterial({ color: src?.color || 0xffe0a8, fog: true });
      } else {
        const paletteKey = MATERIAL_MAP[key];
        if (paletteKey && this.palette[paletteKey]) {
          mat = this.palette[paletteKey]();
        } else {
          // Unknown slot: keep the Blender colour but adopt the game's shader
          // injections so it grades and fogs like everything else.
          mat = new THREE.MeshStandardMaterial({
            color: src?.color ?? 0x8a8578,
            roughness: src?.roughness ?? 0.75,
            metalness: src?.metalness ?? 0.0,
            vertexColors: true,
            envMapIntensity: 0.5,
          });
          this.materials.decorate(mat, { dirtAmount: 0.5, dirtBase: -0.3, detailStrength: 0 });
          mat.envMap = this.materials.envMap;
        }
      }
      mat.name = key || 'asset';
      seen.set(key, mat);
      o.material = mat;
    });
  }

  /**
   * Collapse an instance to a single merged mesh — for props scattered in
   * quantity where the sub-object hierarchy is not needed.
   */
  static flatten(obj) {
    const geos = [];
    let mat = null;
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      whiteColors(g);
      geos.push(g);
      if (!mat) mat = o.material;
    });
    if (!geos.length) return null;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    return merged ? new THREE.Mesh(merged, mat) : null;
  }
}

export default Assets;
