import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, smoothstep, makeRng, wobble, TAU } from '../core/util.js';
import { box, cyl, lathe, merge, worldUV, vertexShade, whiteColors, pipeRun } from '../render/geo.js';
import { doorway, KIT } from '../world/Kit.js';
import { DoorLatch } from '../player/Interactor.js';

/**
 * Interactables — the registry, and every machine in the Annex.
 *
 * House style for everything in this file:
 *
 *  * **A machine is a thing before it is a mechanic.** A breaker panel has an
 *    enclosure, a hinged door, a DIN rail, a labelled schedule strip and an
 *    earth bar, because the moment the player recognises real equipment they
 *    start believing the building. The interaction is bolted to the object, not
 *    the other way round.
 *  * **Every state change is audible and visible.** Nothing in here changes the
 *    world silently. If a circuit trips, a contactor clunks, the lamp goes out
 *    somewhere the player can see, and a noise event goes on the bus for the
 *    Surveyor to hear.
 *  * **Refusals explain themselves.** `refusal()` returns prose, not `false`.
 *
 * Every factory takes the same `ctx` and returns a handle:
 *
 *   ctx  = {materials, palette, collision, rig, scene, bus, assets,
 *           interactor, inventory, player, notes, parent?}
 *   ret  = {id, root, update(dt), api…}
 */

// ---------------------------------------------------------------------------
// small shared helpers
// ---------------------------------------------------------------------------

const M = (ctx, key) => ctx.palette[key]?.() || new THREE.MeshStandardMaterial({ color: 0x8a8578, vertexColors: true });

function meshOf(geo, mat, { cast = true, receive = true, uv = 0.5, shade = null } = {}) {
  if (uv) worldUV(geo, uv);
  if (shade) vertexShade(geo, shade); else whiteColors(geo);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

function placed(position = [0, 0, 0], rotation = 0, name = 'prop') {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(position[0], position[1], position[2]);
  g.rotation.y = rotation;
  return g;
}

/**
 * Canvas-backed label texture. Used for schedule strips, terminal screens,
 * keypad displays and equipment plates so that the building's *writing* is real
 * geometry-mapped text and not a decal atlas nobody can read.
 */
export function textTexture(lines, {
  w = 512, h = 128, bg = '#d8d3c2', fg = '#211d16', font = '500 20px "Courier New", monospace',
  pad = 12, lineHeight = 24, align = 'left', glow = null, scanlines = false,
} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = font;
  g.textBaseline = 'top';
  g.textAlign = align;
  if (glow) { g.shadowColor = glow; g.shadowBlur = 8; }
  g.fillStyle = fg;
  const x = align === 'center' ? w / 2 : align === 'right' ? w - pad : pad;
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n');
  for (let i = 0; i < arr.length; i++) {
    const y = pad + i * lineHeight;
    if (y > h - lineHeight * 0.5) break;
    g.fillText(arr[i], x, y);
  }
  if (scanlines) {
    g.shadowBlur = 0;
    g.globalAlpha = 0.16;
    g.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  t.userData.canvas = c;
  t.userData.ctx = g;
  return t;
}

/** Redraw an existing text texture in place. */
export function updateTextTexture(tex, lines, opts = {}) {
  const c = tex.userData.canvas, g = tex.userData.ctx;
  if (!c) return tex;
  const {
    bg = '#d8d3c2', fg = '#211d16', font = '500 20px "Courier New", monospace',
    pad = 12, lineHeight = 24, align = 'left', glow = null, scanlines = false,
  } = opts;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.font = font; g.textBaseline = 'top'; g.textAlign = align;
  g.shadowColor = glow || 'transparent';
  g.shadowBlur = glow ? 8 : 0;
  g.fillStyle = fg;
  const x = align === 'center' ? c.width / 2 : align === 'right' ? c.width - pad : pad;
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n');
  for (let i = 0; i < arr.length; i++) {
    const y = pad + i * lineHeight;
    if (y > c.height - lineHeight * 0.5) break;
    g.fillText(arr[i], x, y);
  }
  if (scanlines) {
    g.shadowBlur = 0; g.globalAlpha = 0.16; g.fillStyle = '#000';
    for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
    g.globalAlpha = 1;
  }
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

export class Interactables {
  /** @param {object} ctx see the file header */
  constructor(ctx) {
    this.ctx = ctx;
    this.bus = ctx.bus;
    /** @type {Array<{id:string, root:THREE.Object3D, update?:Function}>} */
    this.props = [];
    this.byId = new Map();
    this._t = 0;
  }

  /** Register an already-built handle. */
  register(handle) {
    if (!handle) return null;
    this.props.push(handle);
    if (handle.id) this.byId.set(handle.id, handle);
    return handle;
  }

  get(id) { return this.byId.get(id) || null; }

  /** Build from a data description — what zone builders emit. */
  spawn(kind, opts = {}) {
    const fn = FACTORIES[kind];
    if (!fn) { console.warn(`[interactables] unknown kind "${kind}"`); return null; }
    return this.register(fn(this.ctx, opts));
  }

  update(dt) {
    this._t += dt;
    for (const p of this.props) {
      if (p.update) {
        try { p.update(dt, this._t); } catch (e) { console.error(`[interactable:${p.id}]`, e); }
      }
    }
  }

  dispose() {
    for (const p of this.props) p.dispose?.();
    this.props.length = 0;
    this.byId.clear();
  }

  debugState() {
    return this.props.map((p) => ({ id: p.id, state: p.state?.() ?? null }));
  }
}

// ---------------------------------------------------------------------------
// 1. BREAKER PANEL — the central traversal tool
// ---------------------------------------------------------------------------

/**
 * Eight-way distribution board.
 *
 * The main is deliberately under-rated (see `note_board_c`): only `maxOn` ways
 * can be live at once, so lighting the corridor ahead means putting out the
 * corridor behind. That single constraint turns a light switch into a route
 * planning problem, and it is the reason the Surveyor's light rule has teeth.
 */
export function breakerPanel(ctx, {
  id = 'board_c', position = [0, 0, 0], rotation = 0, title = 'DISTRIBUTION BOARD C',
  maxOn = 3, ways = null, parent = null,
} = {}) {
  const { rig, bus, interactor, collision, player } = ctx;
  const W = 0.52, H = 0.68, D = 0.135;
  const root = placed(position, rotation, `breaker:${id}`);
  (parent || ctx.scene).add(root);

  const steel = M(ctx, 'machinePaint');
  const galv = M(ctx, 'ductMetal');
  const plastic = M(ctx, 'plasticWhite');

  const defaults = [
    { name: 'intake', label: 'INTAKE CIRCULATION', amps: '32A', on: true },
    { name: 'intake_east', label: 'INTAKE BAYS EAST', amps: '16A', on: false },
    { name: 'intake_west', label: 'INTAKE BAYS WEST', amps: '16A', on: false },
    { name: 'spine', label: 'SPINE STRIP LIGHTING', amps: '16A', on: false },
    { name: 'cistern', label: 'CISTERN BULKHEADS', amps: '16A', on: false },
    { name: 'residence', label: 'RESIDENCE LANDING', amps: '10A', on: false },
    { name: 'stack', label: 'STACK LIFT LOBBY', amps: '16A', on: false },
    { name: 'plant', label: 'PLANT HIGH BAY', amps: '63A', on: false, dead: true },
  ];
  const spec = (ways || defaults).slice(0, 8);

  // ---- enclosure: back box, hinged door, DIN rail, gland plate ----
  const bodyParts = [];
  const backBox = box(W, H, D, 0.008, 1);
  backBox.translate(0, H / 2, -D / 2);
  bodyParts.push(backBox);
  // Gland plate at the bottom with knockouts.
  const gland = box(W - 0.08, 0.05, 0.02, 0.004, 1);
  gland.translate(0, 0.03, -D + 0.012);
  bodyParts.push(gland);
  for (let i = 0; i < 4; i++) {
    const ko = cyl(0.014, 0.014, 0.03, 8);
    ko.rotateX(Math.PI / 2);
    ko.translate(-0.16 + i * 0.105, 0.03, -D + 0.02);
    bodyParts.push(ko);
  }
  const bodyGeo = merge(bodyParts);
  root.add(meshOf(bodyGeo, steel, { uv: 0.6, shade: (x, y) => 0.62 + clamp01(y / H) * 0.28 }));

  // Escutcheon: the white plate the breaker dollies poke through.
  const esc = box(W - 0.03, H - 0.10, 0.012, 0.003, 1);
  esc.translate(0, H / 2, -0.008);
  root.add(meshOf(esc, plastic, { uv: 0.4, shade: () => 0.88 }));

  // DIN rail behind the dollies.
  const rail = box(W - 0.09, 0.035, 0.012, 0.002, 1);
  rail.translate(0, H * 0.56, -0.026);
  root.add(meshOf(rail, galv, { uv: 0.2 }));

  // Hinged lid, held open — you cannot work a board with the lid shut.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-W / 2, H / 2, 0.004);
  lidPivot.rotation.y = -2.05;
  root.add(lidPivot);
  const lid = box(W, H, 0.016, 0.005, 1);
  lid.translate(W / 2, 0, 0);
  const lidMesh = meshOf(lid, steel, { uv: 0.6, shade: () => 0.74 });
  lidPivot.add(lidMesh);
  // Schedule card taped inside the lid.
  {
    const tex = textTexture([
      title, '', ...spec.map((s, i) => `WAY ${i + 1}  ${s.label.slice(0, 20).padEnd(21)}${s.amps}`),
      '', 'MAX 3 WAYS. MAIN IS UNDER-RATED.',
    ], { w: 512, h: 320, lineHeight: 26, font: '500 19px "Courier New", monospace', bg: '#cfc8b4' });
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.09, H - 0.14),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
    card.position.set(W / 2, 0, 0.010);
    card.rotation.y = Math.PI;
    card.scale.x = -1;
    lidPivot.add(card);
  }

  // ---- breakers ----
  const breakers = [];
  const cols = 8;
  for (let i = 0; i < spec.length; i++) {
    const s = spec[i];
    const x = -W / 2 + 0.055 + (i % cols) * ((W - 0.11) / (cols - 1));
    const y = H * 0.56;

    const bg = new THREE.Group();
    bg.position.set(x, y, 0);
    root.add(bg);

    // MCB body behind the escutcheon, and the dolly in front of it.
    const bodyG = box(0.030, 0.078, 0.062, 0.004, 1);
    bodyG.translate(0, 0, -0.038);
    bg.add(meshOf(bodyG, plastic, { uv: 0.2, cast: false, shade: () => 0.72 }));

    const pivot = new THREE.Group();
    pivot.position.set(0, 0.012, 0.004);
    bg.add(pivot);
    const dolly = box(0.019, 0.030, 0.016, 0.003, 2);
    dolly.translate(0, 0.011, 0.008);
    const dollyMesh = meshOf(dolly, plastic, { uv: 0.1, shade: () => 1 });
    dollyMesh.material = new THREE.MeshStandardMaterial({
      color: s.dead ? 0x6d6a63 : 0x1c1b19, roughness: 0.5, metalness: 0, vertexColors: true,
    });
    pivot.add(dollyMesh);

    // Way number etched on the escutcheon.
    const numTex = textTexture([String(i + 1)], {
      w: 64, h: 64, lineHeight: 40, pad: 14, align: 'center',
      font: '600 34px "Courier New", monospace', bg: '#d5d0c0',
    });
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.026),
      new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.9 }));
    num.position.set(0, -0.036, 0.0005);
    bg.add(num);

    // A generous invisible hit target — a 19 mm dolly is not clickable.
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.086, 0.05),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 0.005, 0.02);
    bg.add(hit);

    const brk = {
      index: i, name: s.name, label: s.label, amps: s.amps,
      on: !!s.on && !s.dead, dead: !!s.dead,
      pivot, mesh: dollyMesh, hit, order: s.on ? i : -1,
    };
    breakers.push(brk);
    if (brk.on) rig?.setCircuit(s.name, true);
    else if (rig && !rig.circuits.has(s.name)) rig.setCircuit(s.name, false);

    interactor?.add({
      id: `${id}_way${i + 1}`,
      object: hit,
      kind: 'breaker',
      verb: brk.on ? 'Trip' : 'Reset',
      label: `way ${i + 1} — ${s.label.toLowerCase()}`,
      range: 1.5,
      refusal: () => (brk.dead ? 'Way 8 has no supply. The Plant is dead.' : null),
      onUse: () => api.toggle(i),
    });
  }

  let orderCounter = 0;
  for (const b of breakers) if (b.on) b.order = orderCounter++;

  const api = {
    /** Flip one way. Honours the main's rating by tripping the oldest way. */
    toggle(i) {
      const b = breakers[i];
      if (!b || b.dead) return false;
      if (!b.on) {
        const live = breakers.filter((x) => x.on);
        if (live.length >= maxOn) {
          // The main cannot take it. The oldest way drops out with a bang.
          live.sort((p, q) => p.order - q.order);
          const victim = live[0];
          api._set(victim, false, true);
          bus?.emit('light:overload', { board: id, tripped: victim.name });
        }
        api._set(b, true, false);
        b.order = ++orderCounter;
      } else {
        api._set(b, false, false);
      }
      player?.makeNoise?.(7);
      return true;
    },
    _set(b, on, forced) {
      b.on = on;
      rig?.setCircuit(b.name, on);
      rig?.invalidateShadows();
      const it = interactor?.get(`${id}_way${b.index + 1}`);
      if (it) it.verb = on ? 'Trip' : 'Reset';
      bus?.emit('light:circuit', { circuit: b.name, powered: on, board: id, forced });
      bus?.emit('sfx:breaker', { position: root.position.clone(), heavy: forced });
    },
    setWay(name, on) {
      const b = breakers.find((x) => x.name === name);
      if (b) api._set(b, on, false);
    },
    /** Used by `note_fuse_room` / the generator: Way 8 comes alive. */
    energiseWay8() {
      const b = breakers[7];
      if (!b) return;
      b.dead = false;
      b.mesh.material.color.set(0x1c1b19);
      api._set(b, true, false);
    },
    state: () => breakers.map((b) => ({ way: b.index + 1, name: b.name, on: b.on, dead: b.dead })),
  };

  collision?.addBoxAt(
    position[0] + Math.sin(rotation) * -D / 2, position[1] + H / 2, position[2] + Math.cos(rotation) * -D / 2,
    Math.abs(Math.cos(rotation)) * W + 0.1, H, Math.abs(Math.sin(rotation)) * W + 0.1, { tag: 'prop' });

  return {
    id, root, api, breakers,
    state: api.state,
    update(dt) {
      for (const b of breakers) {
        const want = b.on ? -0.42 : 0.42;
        b.pivot.rotation.x = damp(b.pivot.rotation.x, want, 22, dt);
      }
      lidPivot.rotation.y = damp(lidPivot.rotation.y, -2.05, 3, dt);
    },
  };
}

// ---------------------------------------------------------------------------
// 2. VALVE — hold to turn, multi-turn, floods or drains
// ---------------------------------------------------------------------------

export function valve(ctx, {
  id = 'penstock_1', position = [0, 1.1, 0], rotation = 0, turns = 5,
  label = 'penstock 1', action = 'drain', requires = null, startOpen = false,
  targetZone = 'cistern', parent = null, seized = false,
} = {}) {
  const { bus, interactor, collision, player } = ctx;
  const root = placed(position, rotation, `valve:${id}`);
  (parent || ctx.scene).add(root);

  const rustMat = M(ctx, 'rust');
  const chrome = M(ctx, 'chrome');

  // Body: a flanged gate valve on a short pipe stub.
  const bodyParts = [];
  const bonnet = lathe([[0.05, 0], [0.075, 0.02], [0.070, 0.10], [0.045, 0.14], [0.030, 0.16], [0.018, 0.17]], 16);
  bodyParts.push(bonnet);
  const bodyG = lathe([[0.0, -0.10], [0.085, -0.10], [0.10, -0.06], [0.085, -0.01], [0.062, 0.0]], 16);
  bodyParts.push(bodyG);
  for (const s of [-1, 1]) {
    const flange = cyl(0.115, 0.115, 0.022, 18);
    flange.rotateZ(Math.PI / 2);
    flange.translate(s * 0.115, -0.06, 0);
    bodyParts.push(flange);
    const stub = cyl(0.072, 0.072, 0.12, 14);
    stub.rotateZ(Math.PI / 2);
    stub.translate(s * 0.06, -0.06, 0);
    bodyParts.push(stub);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const bolt = cyl(0.009, 0.009, 0.03, 6);
      bolt.rotateZ(Math.PI / 2);
      bolt.translate(s * 0.115, -0.06 + Math.sin(a) * 0.092, Math.cos(a) * 0.092);
      bodyParts.push(bolt);
    }
  }
  const bodyGeo = merge(bodyParts);
  root.add(meshOf(bodyGeo, rustMat, { uv: 0.5, shade: (x, y) => 0.6 + clamp01((y + 0.15) / 0.35) * 0.3 }));

  // Spindle + handwheel with real spokes.
  const spindle = cyl(0.014, 0.014, 0.30, 8);
  spindle.translate(0, 0.29, 0);
  root.add(meshOf(spindle, chrome, { uv: 0.2 }));

  const wheelGrp = new THREE.Group();
  wheelGrp.position.set(0, 0.40, 0);
  root.add(wheelGrp);
  const wheelParts = [];
  const rim = new THREE.TorusGeometry(0.145, 0.017, 6, 22);
  rim.rotateX(Math.PI / 2);
  wheelParts.push(rim);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const spoke = box(0.020, 0.011, 0.135, 0.004, 1);
    spoke.translate(0, 0, 0.072);
    spoke.rotateY(-a);
    wheelParts.push(spoke);
  }
  const hub = lathe([[0.0, -0.02], [0.030, -0.02], [0.034, 0.0], [0.028, 0.026], [0.014, 0.030]], 12);
  wheelParts.push(hub);
  const wheelGeo = merge(wheelParts);
  wheelGrp.add(meshOf(wheelGeo, rustMat, { uv: 0.35, shade: () => 0.82 }));

  // Indicator plate: OPEN / SHUT with a pointer that tracks the spindle.
  const plateTex = textTexture(['SHUT', '', 'OPEN'], {
    w: 128, h: 128, lineHeight: 40, align: 'center', pad: 8,
    font: '600 26px "Helvetica Neue", Arial, sans-serif', bg: '#7d7a70', fg: '#1a1815',
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.8, metalness: 0.2 }));
  plate.position.set(0, 0.20, 0.075);
  root.add(plate);

  const state = {
    turned: startOpen ? turns : 0,
    fraction: startOpen ? 1 : 0,
    open: startOpen,
    committed: false,
    spin: 0,
  };

  const holdSeconds = 1.35;

  const item = interactor?.add({
    id, object: root, kind: 'valve',
    verb: state.open ? 'Close' : 'Open',
    label,
    range: 1.9,
    hold: holdSeconds,
    requires,
    refusal: () => {
      if (seized) return 'Seized solid. Something has been through the packing.';
      return null;
    },
    onHold: (t, dt) => {
      // The wheel actually turns while held, and unwinds if released.
      state.spin += (dt > 0 ? 1 : -1) * Math.abs(dt) * 4.6;
      if (dt > 0 && Math.random() < dt * 5) bus?.emit('sfx:valve', { id, position: root.position.clone() });
      if (dt > 0) player?.makeNoise?.(4.5);
    },
    onUse: () => api.turn(1),
  });

  const api = {
    turn(n = 1) {
      const dir = state.open ? -1 : 1;
      state.turned = clamp(state.turned + n * dir, 0, turns);
      state.fraction = state.turned / turns;
      player?.makeNoise?.(6);
      bus?.emit('valve:turn', {
        id, turns: state.turned, total: turns, fraction: state.fraction, action, zone: targetZone,
      });
      if (state.turned >= turns && !state.open) {
        state.open = true;
        if (item) item.verb = 'Close';
        api._commit(true);
      } else if (state.turned <= 0 && state.open) {
        state.open = false;
        if (item) item.verb = 'Open';
        api._commit(false);
      }
    },
    _commit(open) {
      state.committed = true;
      // The world listens for this and moves water. A gate valve at the end of
      // its travel makes the whole run bang.
      bus?.emit(action === 'drain' ? 'world:drain' : 'world:flood', {
        id, zone: targetZone, open, source: id,
      });
      bus?.emit('valve:complete', { id, open, action, zone: targetZone });
      bus?.emit('player:noise', { position: root.getWorldPosition(new THREE.Vector3()), radius: 22 });
    },
    setSeized(v) { seized = v; },
    state: () => ({ ...state }),
  };

  collision?.addBoxAt(position[0], position[1] - 0.02, position[2], 0.34, 0.5, 0.34, { tag: 'prop' });

  return {
    id, root, api, state: api.state,
    update(dt) {
      // Continuous rotation from accumulated hold, plus the discrete turns.
      const target = state.turned * TAU * 0.85;
      state.spin = damp(state.spin, target, 6, dt);
      wheelGrp.rotation.y = state.spin;
    },
  };
}

// ---------------------------------------------------------------------------
// 3. GOODS LIFT
// ---------------------------------------------------------------------------

/**
 * A goods lift with a real car, a real up-and-over gate and real travel.
 *
 * The car is a moving floor: the player rides it because the collision floor
 * moves with the car and the player's feet are re-based every frame. It is
 * slow on purpose — 0.55 m/s — because a lift is the only place in the Annex
 * where the player is committed and cannot run, and that is worth 20 seconds.
 */
export function goodsLift(ctx, {
  id = 'lift_2', position = [0, 0, 0], rotation = 0,
  floors = [{ name: 'INTAKE', y: 0 }, { name: 'PLANT', y: -7.6 }],
  width = 2.2, depth = 2.0, height = 2.4, powered = false, parent = null,
} = {}) {
  const { bus, interactor, collision, player, rig } = ctx;
  const root = placed(position, rotation, `lift:${id}`);
  (parent || ctx.scene).add(root);

  const steel = M(ctx, 'machinePaint');
  const tread = M(ctx, 'tread');
  const galv = M(ctx, 'ductMetal');

  const car = new THREE.Group();
  root.add(car);

  // Car shell: chequer-plate floor, three ribbed walls, a caged roof lamp.
  const shellParts = [];
  const floorG = box(width, 0.06, depth, 0.006, 1);
  floorG.translate(0, -0.03, 0);
  shellParts.push(floorG);
  for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1]]) {
    const wallW = sx ? 0.05 : width;
    const wallD = sx ? depth : 0.05;
    const wg = box(wallW, height, wallD, 0.006, 1);
    wg.translate(sx * (width / 2), height / 2, sz * (depth / 2));
    shellParts.push(wg);
    // Ribs.
    for (let i = 0; i < 5; i++) {
      const r = box(sx ? 0.012 : width * 0.9, 0.05, sx ? depth * 0.9 : 0.012, 0.002, 1);
      r.translate(sx * (width / 2 - 0.03), 0.25 + i * 0.42, sz * (depth / 2 - 0.03));
      shellParts.push(r);
    }
  }
  const roofG = box(width, 0.05, depth, 0.005, 1);
  roofG.translate(0, height, 0);
  shellParts.push(roofG);
  const shellGeo = merge(shellParts);
  car.add(meshOf(shellGeo, steel, { uv: 0.7, shade: (x, y) => 0.55 + clamp01(y / height) * 0.3 }));

  // Up-and-over gate: two leaves that part vertically.
  const gateLower = new THREE.Group();
  const gateUpper = new THREE.Group();
  car.add(gateLower, gateUpper);
  for (const [grp, sgn] of [[gateLower, -1], [gateUpper, 1]]) {
    const parts = [];
    const leaf = box(width - 0.06, height / 2 - 0.03, 0.045, 0.005, 1);
    leaf.translate(0, sgn * (height / 4), depth / 2);
    parts.push(leaf);
    for (let i = 0; i < 4; i++) {
      const slat = box(width - 0.14, 0.035, 0.06, 0.003, 1);
      slat.translate(0, sgn * (height / 4) - height / 8 + i * (height / 16), depth / 2 + 0.008);
      parts.push(slat);
    }
    const g = merge(parts);
    grp.add(meshOf(g, galv, { uv: 0.5, shade: () => 0.78 }));
  }

  // Call panel inside the car.
  const panelGrp = new THREE.Group();
  panelGrp.position.set(width / 2 - 0.09, 1.20, depth / 2 - 0.22);
  panelGrp.rotation.y = -Math.PI / 2;
  car.add(panelGrp);
  const panelG = box(0.20, 0.34, 0.04, 0.005, 1);
  panelGrp.add(meshOf(panelG, steel, { uv: 0.3, shade: () => 0.8 }));

  const indicatorTex = textTexture([floors[0].name], {
    w: 256, h: 64, lineHeight: 34, align: 'center', pad: 12,
    font: '600 28px "Courier New", monospace', bg: '#141310', fg: '#ff9a3c', glow: '#ff7a10',
  });
  const indicator = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.038),
    new THREE.MeshBasicMaterial({ map: indicatorTex, toneMapped: true }));
  indicator.position.set(0, 0.12, 0.022);
  panelGrp.add(indicator);

  const buttons = [];
  for (let i = 0; i < floors.length; i++) {
    const bgrp = new THREE.Group();
    bgrp.position.set(0, 0.02 - i * 0.075, 0.022);
    panelGrp.add(bgrp);
    const bg = cyl(0.020, 0.022, 0.014, 12);
    bg.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2823, roughness: 0.5, metalness: 0.2, vertexColors: true });
    const m = meshOf(bg, mat, { uv: 0.1 });
    bgrp.add(m);
    buttons.push({ mesh: m, mat, floor: i });

    interactor?.add({
      id: `${id}_btn${i}`, object: bgrp, kind: 'button',
      verb: 'Press', label: floors[i].name.toLowerCase(), range: 1.6,
      refusal: () => (state.power ? (state.moving ? 'The car is moving.' : null) : 'No supply to the lift.'),
      onUse: () => api.callTo(i),
    });
  }

  // Outer call button on the jamb.
  const callGrp = placed([Math.sin(rotation) * 0 + 0, 1.15, depth / 2 + 0.30], 0, 'call');
  root.add(callGrp);
  const callBox = box(0.10, 0.16, 0.05, 0.006, 1);
  callGrp.add(meshOf(callBox, steel, { uv: 0.2, shade: () => 0.8 }));
  const callBtn = cyl(0.022, 0.024, 0.016, 12);
  callBtn.rotateX(Math.PI / 2);
  callBtn.translate(0, 0, 0.03);
  const callMat = new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.45, vertexColors: true });
  callGrp.add(meshOf(callBtn, callMat, { uv: 0.1 }));

  const state = {
    floor: 0, targetFloor: 0, y: floors[0].y, moving: false,
    gate: 1,            // 1 = open, 0 = shut
    gateTarget: 1,
    power: powered,
    trips: 0,
  };

  interactor?.add({
    id: `${id}_call`, object: callGrp, kind: 'button',
    verb: 'Call', label: 'the goods lift', range: 1.9,
    refusal: () => (state.power ? null : 'Dead. Three-phase is out.'),
    onUse: () => api.call(),
  });

  const carFloor = collision?.addFloor(
    [position[0] - width / 2, position[2] - depth / 2, position[0] + width / 2, position[2] + depth / 2],
    floors[0].y, { surface: 'metal', tag: 'lift' });

  const api = {
    setPower(on) {
      state.power = on;
      callMat.color.set(on ? 0xc0402c : 0x5a2a20);
      for (const b of buttons) b.mat.color.set(on ? 0x3a3831 : 0x2a2823);
      bus?.emit('lift:power', { id, on });
    },
    call() {
      if (!state.power || state.moving) return false;
      state.gateTarget = 1;
      bus?.emit('lift:call', { id, floor: state.floor });
      bus?.emit('player:noise', { position: root.getWorldPosition(new THREE.Vector3()), radius: 16 });
      return true;
    },
    callTo(i) {
      if (!state.power || state.moving || i === state.floor) return false;
      state.targetFloor = i;
      state.gateTarget = 0;
      state.moving = true;
      state.trips++;
      bus?.emit('lift:travel', { id, from: state.floor, to: i, floors });
      bus?.emit('player:noise', { position: root.getWorldPosition(new THREE.Vector3()), radius: 26 });
      return true;
    },
    state: () => ({ ...state, floorName: floors[state.floor]?.name }),
  };
  api.setPower(powered);

  const _p = new THREE.Vector3();
  return {
    id, root, api, state: api.state,
    update(dt) {
      // ---- gate ----
      const gateSpeed = 0.9;
      state.gate = clamp01(state.gate + Math.sign(state.gateTarget - state.gate) * dt * gateSpeed);
      if (Math.abs(state.gateTarget - state.gate) < dt * gateSpeed) state.gate = state.gateTarget;
      const travel = (height / 2 - 0.04) * state.gate;
      gateLower.position.y = -travel;
      gateUpper.position.y = travel;

      // ---- travel ----
      if (state.moving && state.gate <= 0.02) {
        const targetY = floors[state.targetFloor].y;
        const dy = targetY - state.y;
        const step = Math.sign(dy) * Math.min(Math.abs(dy), 0.55 * dt);
        state.y += step;

        // Ride: if the player is standing in the car, move them with it.
        if (player) {
          root.getWorldPosition(_p);
          const inX = Math.abs(player.position.x - _p.x) < width / 2 - 0.1;
          const inZ = Math.abs(player.position.z - _p.z) < depth / 2 - 0.1;
          const onFloor = Math.abs(player.position.y - (_p.y + state.y)) < 0.6;
          if (inX && inZ && onFloor) {
            player.position.y += step;
            player.groundY += step;
            // A tiny lateral shove at start and stop sells the mass.
            if (Math.abs(dy) > 0.4 && Math.abs(dy) < 0.6) player.kick(0.012, 0, 0.008, -0.02);
          }
        }
        if (carFloor) carFloor.y = _p.y + state.y;

        if (Math.abs(targetY - state.y) < 0.005) {
          state.y = targetY;
          state.floor = state.targetFloor;
          state.moving = false;
          state.gateTarget = 1;
          updateTextTexture(indicatorTex, [floors[state.floor].name], {
            lineHeight: 34, align: 'center', pad: 12,
            font: '600 28px "Courier New", monospace', bg: '#141310', fg: '#ff9a3c', glow: '#ff7a10',
          });
          player?.kick(0.03, 0, 0.02, 0.04);
          bus?.emit('lift:arrive', {
            id, floor: state.floor, name: floors[state.floor].name,
            exit: !!floors[state.floor].exit,
          });
          bus?.emit('player:noise', { position: root.getWorldPosition(new THREE.Vector3()), radius: 18 });
        }
      }
      car.position.y = state.y;
    },
  };
}

// ---------------------------------------------------------------------------
// 4. KEYPAD / CARD READER
// ---------------------------------------------------------------------------

export function keypad(ctx, {
  id = 'keypad_1', position = [0, 1.25, 0], rotation = 0, code = '2130',
  label = 'keypad', onOpen = null, hintNote = null, parent = null,
} = {}) {
  const { bus, interactor, player, notes } = ctx;
  const root = placed(position, rotation, `keypad:${id}`);
  (parent || ctx.scene).add(root);

  const plastic = M(ctx, 'plasticWhite');
  const steel = M(ctx, 'machinePaint');

  const shell = box(0.115, 0.185, 0.038, 0.006, 2);
  root.add(meshOf(shell, steel, { uv: 0.2, shade: (x, y) => 0.72 + clamp01((y + 0.09) / 0.18) * 0.2 }));

  const dispTex = textTexture(['____'], {
    w: 256, h: 64, align: 'center', pad: 14, lineHeight: 34,
    font: '600 30px "Courier New", monospace', bg: '#0d1310', fg: '#7cff9a', glow: '#3bff6a',
  });
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.082, 0.024),
    new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: true }));
  disp.position.set(0, 0.062, 0.020);
  root.add(disp);

  const state = { entry: '', unlocked: false, fails: 0, flash: 0 };

  const redraw = () => {
    const shown = (state.entry + '____').slice(0, 4).replace(/(.)/g, '$1');
    updateTextTexture(dispTex, [state.unlocked ? 'OPEN' : shown], {
      align: 'center', pad: 14, lineHeight: 34,
      font: '600 30px "Courier New", monospace', bg: '#0d1310',
      fg: state.flash > 0 ? '#ff6b4a' : state.unlocked ? '#7cff9a' : '#7cff9a',
      glow: state.flash > 0 ? '#ff3a10' : '#3bff6a',
    });
  };

  const keys = '123456789*0#'.split('');
  for (let i = 0; i < keys.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const kg = new THREE.Group();
    kg.position.set(-0.030 + col * 0.030, 0.020 - row * 0.028, 0.020);
    root.add(kg);
    const kb = box(0.024, 0.022, 0.008, 0.002, 1);
    const km = new THREE.MeshStandardMaterial({ color: 0x2b2a26, roughness: 0.55, vertexColors: true });
    kg.add(meshOf(kb, km, { uv: 0.05, cast: false }));
    const kt = textTexture([keys[i]], {
      w: 64, h: 64, align: 'center', pad: 16, lineHeight: 30,
      font: '600 30px "Courier New", monospace', bg: '#2b2a26', fg: '#ddd8c8',
    });
    const kl = new THREE.Mesh(new THREE.PlaneGeometry(0.020, 0.018),
      new THREE.MeshStandardMaterial({ map: kt, roughness: 0.7 }));
    kl.position.set(0, 0, 0.0045);
    kg.add(kl);

    interactor?.add({
      id: `${id}_k${i}`, object: kg, kind: 'keypad', verb: 'Press', label: keys[i],
      range: 1.3,
      refusal: () => (state.unlocked ? 'Already open.' : null),
      onUse: () => api.press(keys[i]),
    });
  }

  const api = {
    press(k) {
      if (state.unlocked) return;
      player?.makeNoise?.(1.6);
      bus?.emit('sfx:keypad', { id, key: k });
      if (k === '*') { state.entry = ''; redraw(); return; }
      if (k === '#') { api.submit(); return; }
      state.entry += k;
      if (state.entry.length >= code.length) { redraw(); api.submit(); return; }
      redraw();
    },
    submit() {
      if (state.entry === code) {
        state.unlocked = true;
        redraw();
        bus?.emit('keypad:unlock', { id });
        player?.makeNoise?.(6);
        onOpen?.();
      } else {
        state.fails++;
        state.flash = 0.9;
        state.entry = '';
        redraw();
        bus?.emit('keypad:reject', { id, fails: state.fails });
        // Persistent failure is itself a noise event. It buzzes.
        player?.makeNoise?.(5);
      }
    },
    hint: () => (hintNote && notes?.hasRead(hintNote) ? code : null),
    state: () => ({ ...state }),
  };
  redraw();

  return {
    id, root, api, state: api.state,
    update(dt) {
      if (state.flash > 0) {
        state.flash -= dt;
        if (state.flash <= 0) { state.flash = 0; redraw(); }
      }
    },
  };
}

export function cardReader(ctx, {
  id = 'reader_1', position = [0, 1.25, 0], rotation = 0,
  requires = 'card_warden', label = 'card reader', onOpen = null, parent = null,
} = {}) {
  const { bus, interactor, player, inventory } = ctx;
  const root = placed(position, rotation, `reader:${id}`);
  (parent || ctx.scene).add(root);

  const steel = M(ctx, 'machinePaint');
  const shell = box(0.095, 0.150, 0.032, 0.006, 2);
  root.add(meshOf(shell, steel, { uv: 0.2, shade: () => 0.78 }));
  // Card slot with a chamfered mouth and a wear scar around it.
  const slot = box(0.062, 0.007, 0.014, 0.002, 1);
  slot.translate(0, 0.030, 0.014);
  root.add(meshOf(slot, steel, { uv: 0.1, shade: () => 0.4 }));

  const ledMat = new THREE.MeshBasicMaterial({ color: 0x8a2418, toneMapped: true });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), ledMat);
  led.position.set(0, -0.030, 0.017);
  root.add(led);

  const plateTex = textTexture(['CARD', 'ACCESS'], {
    w: 128, h: 64, align: 'center', pad: 8, lineHeight: 22,
    font: '600 17px Arial, sans-serif', bg: '#8e8b80', fg: '#191713',
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.028),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.8 }));
  plate.position.set(0, -0.058, 0.017);
  root.add(plate);

  const state = { unlocked: false, flash: 0 };

  interactor?.add({
    id, object: root, kind: 'reader', verb: 'Present card', label, range: 1.6,
    refusal: () => {
      if (state.unlocked) return null;
      if (inventory?.has(requires)) return null;
      if (inventory?.has('card_contractor')) {
        return 'Reader rejects it. Your card was issued in March.';
      }
      return 'No card.';
    },
    onUse: () => api.swipe(),
  });

  const api = {
    swipe() {
      if (state.unlocked) { onOpen?.(); return true; }
      state.unlocked = true;
      ledMat.color.set(0x35c04a);
      bus?.emit('reader:unlock', { id });
      player?.makeNoise?.(5);
      onOpen?.();
      return true;
    },
    state: () => ({ ...state }),
  };

  return {
    id, root, api, state: api.state,
    update(dt, t) {
      if (!state.unlocked) {
        // A slow red heartbeat, so a reader in the dark is findable.
        ledMat.color.setRGB(0.42 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.4)), 0.09, 0.06);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 5. TERMINAL — CRT, typed output, cross-referenced puzzle
// ---------------------------------------------------------------------------

/**
 * A monochrome VDU on a Meridian desk. Text is *typed*, one character at a
 * time, at a believable 1200-baud crawl, and the puzzle it holds cannot be
 * solved from the screen alone: the answer is on a poster in another zone.
 */
export function terminal(ctx, {
  id = 'terminal_record', position = [0, 0.76, 0], rotation = 0,
  pages = null, puzzleCode = '2130', onSolve = null, hintNote = 'nb_5', parent = null,
} = {}) {
  const { bus, interactor, player, notes } = ctx;
  const root = placed(position, rotation, `terminal:${id}`);
  (parent || ctx.scene).add(root);

  const plastic = M(ctx, 'plasticWhite');
  const steel = M(ctx, 'machinePaint');

  // Monitor: a deep, tapered case with a vented crown and a recessed tube.
  const caseParts = [];
  const shell = box(0.40, 0.36, 0.42, 0.014, 2);
  shell.translate(0, 0.18, 0);
  caseParts.push(shell);
  const hood = box(0.42, 0.05, 0.30, 0.010, 1);
  hood.translate(0, 0.375, -0.03);
  caseParts.push(hood);
  for (let i = 0; i < 9; i++) {
    const v = box(0.30, 0.006, 0.010, 0.001, 1);
    v.translate(0, 0.393, -0.14 + i * 0.026);
    caseParts.push(v);
  }
  const bezel = box(0.38, 0.30, 0.03, 0.010, 2);
  bezel.translate(0, 0.19, 0.205);
  caseParts.push(bezel);
  const foot = lathe([[0.0, 0], [0.11, 0], [0.115, 0.02], [0.07, 0.035]], 14);
  caseParts.push(foot);
  const caseGeo = merge(caseParts);
  root.add(meshOf(caseGeo, plastic, { uv: 0.5, shade: (x, y) => 0.66 + clamp01(y / 0.4) * 0.26 }));

  // Screen. Slightly inset and very slightly curved by a segmented plane.
  const screenTex = textTexture([''], {
    w: 512, h: 384, lineHeight: 20, pad: 14,
    font: '400 16px "Courier New", monospace', bg: '#090d09', fg: '#8dffa8',
    glow: '#3dff6a', scanlines: true,
  });
  const screenGeo = new THREE.PlaneGeometry(0.30, 0.225, 6, 6);
  {
    const p = screenGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / 0.15, y = p.getY(i) / 0.1125;
      p.setZ(i, -(x * x + y * y) * 0.008);
    }
    p.needsUpdate = true;
    screenGeo.computeVertexNormals();
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: true, fog: true });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.19, 0.219);
  root.add(screen);

  // Keyboard on a coiled lead.
  const kb = box(0.42, 0.035, 0.16, 0.006, 1);
  kb.translate(0, 0.018, 0.34);
  const kbMesh = meshOf(kb, plastic, { uv: 0.3, shade: () => 0.8 });
  root.add(kbMesh);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 14; c++) {
      const k = box(0.020, 0.008, 0.020, 0.002, 1);
      k.translate(-0.18 + c * 0.028, 0.040, 0.30 + r * 0.026);
      root.add(meshOf(k, plastic, { uv: 0.05, cast: false, shade: () => 0.7 }));
    }
  }

  const DEFAULT_PAGES = [
    {
      title: 'MERIDIAN FM — ANNEX 7 RECORDS TERMINAL',
      body: [
        'MERIDIAN FACILITIES MANAGEMENT',
        'ANNEX 7 SITE RECORDS  —  TERMINAL 3',
        '',
        'THIS TERMINAL HOLDS:',
        '  1  DISCREPANCY REGISTER (12/D)',
        '  2  PLANT SUPPLY STATUS',
        '  3  SEALED — AUTHORISATION REQUIRED',
        '',
        'SELECT WITH THE ROTARY. PRESS TO READ.',
      ],
    },
    {
      title: 'DISCREPANCY REGISTER',
      body: [
        'DISCREPANCY REGISTER — LAST 6 ENTRIES',
        '',
        '  4462  7/S-036  CORRIDOR RETURNS TO START',
        '  4463  7/L-118  ROOM NOT IN SCHEDULE',
        '  4464  7/L-118  ROOM NOT IN SCHEDULE',
        '  4465  7/L-118  ROOM NOT IN SCHEDULE',
        '  4466  7/R-207  DOOR LEADS TO ROOM ALREADY',
        '                 ENTERED BY ANOTHER DOOR',
        '  4467  7/P-001  SERVICES PRESENT, NO ORIGIN',
        '',
        'REGISTER IS FULL. OLDEST ENTRIES ARE NOT',
        'ARCHIVED. THEY ARE OVERWRITTEN.',
      ],
    },
    {
      title: 'PLANT SUPPLY STATUS',
      body: [
        'PLANT SUPPLY — SET No. 2',
        '',
        '  SUPPLY CORE 1 .......... NOT FITTED',
        '  SUPPLY CORE 2 .......... NOT FITTED',
        '  SUPPLY CORE 3 .......... NOT FITTED',
        '  DAY TANK ............... 61%',
        '  WAY 8 (PLANT HIGH BAY) . NO SUPPLY',
        '',
        'GOODS LIFT No. 2 WILL NOT ACCEPT A CALL',
        'UNTIL ALL THREE CORES READ HEALTHY.',
      ],
    },
    {
      title: 'SEALED',
      sealed: true,
      body: [
        'RECORD SEALED AT THE REQUEST OF AREA OFFICE',
        '',
        'ENTER AUTHORISATION (4 FIGURES)',
        '',
        'HINT ON FILE, ENTERED BY D. KEARNS:',
        '  "THE DATE ON THE POSTER. FOUR FIGURES.',
        '   THEN BACKWARDS."',
        '',
        '> ____',
      ],
    },
    {
      title: 'SEALED RECORD — OPEN',
      body: [
        'INCIDENT 0031 — SUMMARY',
        '',
        'ON 3 DECEMBER, DURING A FAMILY OPEN DAY,',
        'THE SITE REGISTER RECORDED 41 PERSONS IN',
        'AND 40 PERSONS OUT.',
        '',
        'A RECOUNT WAS ORDERED. THE RECOUNT',
        'RECORDED 41 IN AND 41 OUT.',
        '',
        'A THIRD COUNT WAS ORDERED. THE THIRD',
        'COUNT RECORDED 40 IN AND 41 OUT.',
        '',
        'AREA OFFICE CONSIDER THE MATTER CLOSED',
        'AND THE REGISTER UNRELIABLE.',
        '',
        'NO PERSON WAS REPORTED MISSING.',
      ],
    },
  ];
  const PAGES = pages || DEFAULT_PAGES;

  const state = {
    page: 0, typed: 0, entry: '', solved: false, on: true, awake: 0,
  };

  let lastDrawn = -1;
  const redraw = () => {
    const p = PAGES[state.page];
    const lines = p.body.slice();
    if (p.sealed && !state.solved) {
      lines[lines.length - 1] = `> ${(state.entry + '____').slice(0, 4)}`;
    }
    // Character-accurate typing: reveal `typed` characters across all lines.
    let budget = Math.floor(state.typed);
    const shown = [];
    for (const l of lines) {
      if (budget <= 0) break;
      shown.push(l.slice(0, budget));
      budget -= Math.max(l.length, 1);
    }
    if (shown.length && budget > -1 && shown.length < lines.length) {
      shown[shown.length - 1] += (Math.floor(state.awake * 3) % 2) ? '█' : '';
    }
    updateTextTexture(screenTex, shown, {
      lineHeight: 20, pad: 14, font: '400 16px "Courier New", monospace',
      bg: '#090d09', fg: '#8dffa8', glow: '#3dff6a', scanlines: true,
    });
  };

  const totalChars = () => PAGES[state.page].body.reduce((a, l) => a + Math.max(l.length, 1), 0);

  const api = {
    next() {
      // The sealed page is a wall until the code is entered.
      const p = PAGES[state.page];
      if (p.sealed && !state.solved) return false;
      state.page = (state.page + 1) % (state.solved ? PAGES.length : PAGES.length - 1);
      state.typed = 0;
      player?.makeNoise?.(1.4);
      bus?.emit('terminal:page', { id, page: state.page, title: PAGES[state.page].title });
      return true;
    },
    goTo(i) { state.page = clamp(i, 0, PAGES.length - 1); state.typed = 0; },
    /** The sealed page's 4-figure entry, keyed one digit at a time. */
    digit(d) {
      if (state.solved) return;
      state.entry = (state.entry + d).slice(-4);
      if (state.entry.length === 4) {
        if (state.entry === puzzleCode) {
          state.solved = true;
          state.page = PAGES.length - 1;
          state.typed = 0;
          bus?.emit('terminal:solved', { id });
          notes?.collect?.('note_open_day');
          onSolve?.();
        } else {
          state.entry = '';
          bus?.emit('terminal:reject', { id });
        }
      }
    },
    /**
     * Cross-reference helper: the player types the code by cycling a rotary,
     * which is the diegetic input this terminal actually has. Called by the
     * `*_dial` interactable.
     */
    dial(n) { api.digit(String(n % 10)); },
    state: () => ({ page: state.page, solved: state.solved, entry: state.entry }),
  };

  interactor?.add({
    id: `${id}_read`, object: screen, kind: 'terminal',
    verb: 'Read', label: 'the terminal', range: 1.5,
    onUse: () => {
      const p = PAGES[state.page];
      if (state.typed < totalChars()) { state.typed = totalChars(); redraw(); return; }
      if (p.sealed && !state.solved) { bus?.emit('ui:hint', { text: 'Use the rotary to enter four figures.' }); return; }
      api.next();
    },
  });

  // Rotary selector — a real knob with a detent, used for the code.
  const knobGrp = new THREE.Group();
  knobGrp.position.set(0.155, 0.075, 0.20);
  root.add(knobGrp);
  const knob = lathe([[0.0, 0], [0.026, 0], [0.030, 0.008], [0.026, 0.022], [0.012, 0.026]], 14);
  knobGrp.add(meshOf(knob, steel, { uv: 0.1 }));
  const pointer = box(0.006, 0.010, 0.024, 0.001, 1);
  pointer.translate(0, 0.024, 0.012);
  knobGrp.add(meshOf(pointer, steel, { uv: 0.05 }));
  let dialValue = 0;

  interactor?.add({
    id: `${id}_dial`, object: knobGrp, kind: 'dial',
    verb: 'Turn', label: 'the rotary', range: 1.5,
    refusal: () => (state.solved ? 'Nothing left to enter.' : null),
    onUse: () => {
      dialValue = (dialValue + 1) % 11;
      player?.makeNoise?.(1.2);
      bus?.emit('sfx:detent', { id, value: dialValue });
      if (dialValue === 10) { api.dial(dialValue - 1); dialValue = 0; }
      bus?.emit('terminal:dial', { id, value: dialValue });
    },
  });
  interactor?.add({
    id: `${id}_enter`, object: kbMesh, kind: 'terminal',
    verb: 'Enter', label: `figure ${''}`, range: 1.5,
    refusal: () => {
      if (state.solved) return 'The record is open.';
      if (!PAGES[state.page].sealed) return 'Nothing to enter on this page.';
      return null;
    },
    onUse: () => { api.dial(dialValue); dialValue = 0; },
  });

  return {
    id, root, api, state: api.state,
    update(dt, t) {
      state.awake = t;
      knobGrp.rotation.z = damp(knobGrp.rotation.z, -dialValue * (TAU / 10), 14, dt);
      const total = totalChars();
      if (state.typed < total) {
        state.typed = Math.min(total, state.typed + dt * 220);
        redraw();
      } else if (lastDrawn !== state.page || (t % 0.34) < dt) {
        lastDrawn = state.page;
        redraw();
      }
      // The tube breathes: a slow brightness wander plus mains ripple.
      const flick = 0.94 + 0.06 * Math.sin(t * 13.7) + wobble(t * 0.3, 2) * 0.02;
      screenMat.color.setScalar(clamp(flick, 0.7, 1.05));
    },
  };
}

// ---------------------------------------------------------------------------
// 6. GENERATOR — three cores, then fuel / primer / starter
// ---------------------------------------------------------------------------

export function generator(ctx, {
  id = 'set_2', position = [0, 0, 0], rotation = 0, parent = null,
  onRunning = null, coresRequired = 3,
} = {}) {
  const { bus, interactor, collision, player, inventory, rig } = ctx;
  const root = placed(position, rotation, `gen:${id}`);
  (parent || ctx.scene).add(root);

  const machine = M(ctx, 'machinePaint');
  const galv = M(ctx, 'ductMetal');
  const rustMat = M(ctx, 'rust');
  const chrome = M(ctx, 'chrome');

  // ---- skid, block, alternator, exhaust ----
  const skidParts = [];
  const skid = box(3.6, 0.22, 1.5, 0.012, 1);
  skid.translate(0, 0.11, 0);
  skidParts.push(skid);
  for (const sx of [-1.55, 1.55]) {
    for (const sz of [-0.6, 0.6]) {
      const mount = box(0.26, 0.10, 0.26, 0.008, 1);
      mount.translate(sx, 0.05, sz);
      skidParts.push(mount);
    }
  }
  root.add(meshOf(merge(skidParts), rustMat, { uv: 0.8, shade: () => 0.55 }));

  const blockParts = [];
  const block = box(1.7, 0.95, 1.0, 0.02, 2);
  block.translate(-0.6, 0.70, 0);
  blockParts.push(block);
  const head = box(1.5, 0.28, 0.86, 0.014, 2);
  head.translate(-0.6, 1.31, 0);
  blockParts.push(head);
  // Rocker cover with six bolt bosses.
  const cover = box(1.35, 0.16, 0.60, 0.012, 2);
  cover.translate(-0.6, 1.51, 0);
  blockParts.push(cover);
  for (let i = 0; i < 6; i++) {
    const b = cyl(0.028, 0.028, 0.05, 8);
    b.translate(-1.15 + i * 0.22, 1.60, 0);
    blockParts.push(b);
  }
  // Sump.
  const sump = box(1.5, 0.30, 0.80, 0.014, 1);
  sump.translate(-0.6, 0.36, 0);
  blockParts.push(sump);
  root.add(meshOf(merge(blockParts), machine, { uv: 0.9, shade: (x, y) => 0.5 + clamp01(y / 1.7) * 0.36 }));

  // Alternator: a ribbed drum on the other end of the skid.
  const altParts = [];
  const drum = cyl(0.44, 0.44, 1.2, 20);
  drum.rotateZ(Math.PI / 2);
  drum.translate(1.05, 0.80, 0);
  altParts.push(drum);
  for (let i = 0; i < 14; i++) {
    const rib = cyl(0.46, 0.46, 0.022, 20);
    rib.rotateZ(Math.PI / 2);
    rib.translate(0.50 + i * 0.082, 0.80, 0);
    altParts.push(rib);
  }
  const term = box(0.44, 0.26, 0.36, 0.008, 1);
  term.translate(1.05, 1.32, 0);
  altParts.push(term);
  root.add(meshOf(merge(altParts), machine, { uv: 0.6, shade: () => 0.68 }));

  // Flywheel — the guard is missing, per the starting procedure.
  const flywheel = new THREE.Group();
  flywheel.position.set(0.30, 0.80, 0);
  root.add(flywheel);
  const fwParts = [];
  const fw = cyl(0.40, 0.40, 0.10, 24);
  fw.rotateZ(Math.PI / 2);
  fwParts.push(fw);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const spoke = box(0.06, 0.34, 0.05, 0.004, 1);
    spoke.translate(0, 0, 0);
    spoke.rotateX(a);
    spoke.translate(0.055, 0, 0);
    fwParts.push(spoke);
  }
  flywheel.add(meshOf(merge(fwParts), chrome, { uv: 0.3 }));
  // The bracket the guard used to bolt to, with two bolts still in it.
  const bracket = box(0.06, 0.42, 0.05, 0.004, 1);
  bracket.translate(0.30, 1.14, 0.30);
  root.add(meshOf(bracket, rustMat, { uv: 0.2 }));

  // Exhaust: lagged pipe up through the roof, with a rain cap.
  const exh = pipeRun([[-1.1, 1.66, 0.30], [-1.1, 2.4, 0.30], [-1.1, 3.6, 0.30]], 0.12, 12, 3);
  root.add(meshOf(exh, galv, { uv: 0.6, shade: () => 0.72 }));

  // ---- three sockets ----
  const socketBank = new THREE.Group();
  socketBank.position.set(1.05, 1.35, 0.62);
  root.add(socketBank);
  const bankBody = box(0.86, 0.36, 0.22, 0.008, 1);
  socketBank.add(meshOf(bankBody, machine, { uv: 0.3, shade: () => 0.72 }));

  const sockets = [];
  for (let i = 0; i < coresRequired; i++) {
    const sg = new THREE.Group();
    sg.position.set(-0.28 + i * 0.28, 0.0, 0.12);
    socketBank.add(sg);
    // Two spring clips and a base — an obviously empty fuse way.
    const parts = [];
    for (const s of [-1, 1]) {
      const clip = box(0.055, 0.075, 0.030, 0.004, 1);
      clip.translate(0, s * 0.085, 0.01);
      parts.push(clip);
    }
    const base = box(0.085, 0.20, 0.020, 0.003, 1);
    parts.push(base);
    sg.add(meshOf(merge(parts), chrome, { uv: 0.15 }));

    // The fitted core, hidden until installed.
    const coreG = new THREE.Group();
    coreG.visible = false;
    sg.add(coreG);
    const cbody = cyl(0.048, 0.048, 0.145, 14);
    cbody.rotateX(Math.PI / 2);
    cbody.translate(0, 0, 0.02);
    coreG.add(meshOf(cbody, M(ctx, 'plasticWhite'), { uv: 0.2, shade: () => 0.86 }));
    for (const s of [-1, 1]) {
      const cap = cyl(0.045, 0.045, 0.028, 14);
      cap.rotateX(Math.PI / 2);
      cap.translate(0, 0, 0.02 + s * 0.075);
      coreG.add(meshOf(cap, chrome, { uv: 0.1 }));
    }
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x221a10, toneMapped: true });
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.011, 8), lampMat);
    lamp.position.set(0, -0.13, 0.12);
    sg.add(lamp);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 0, 0.08);
    sg.add(hit);

    const sock = { index: i, grp: sg, core: coreG, lamp: lampMat, fitted: false, hit };
    sockets.push(sock);

    interactor?.add({
      id: `${id}_socket${i}`, object: hit, kind: 'socket',
      verb: 'Fit core', label: `supply core ${i + 1}`, range: 1.9,
      refusal: () => {
        if (sock.fitted) return 'Fitted and latched.';
        if (!inventory?.has('fuse_core')) return 'You are not carrying a core.';
        return null;
      },
      onUse: () => api.fit(i),
    });
  }

  // ---- control panel: fuel valve, primer, starter, gauges ----
  const panel = new THREE.Group();
  panel.position.set(-0.60, 1.30, 0.66);
  root.add(panel);
  const panelBody = box(0.70, 0.50, 0.14, 0.008, 1);
  panelBody.translate(0, 0, -0.06);
  panel.add(meshOf(panelBody, machine, { uv: 0.3, shade: (x, y) => 0.66 + clamp01((y + 0.25) / 0.5) * 0.22 }));

  // Sight glass — clears when the fuel valve is open.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a2b12, roughness: 0.15, metalness: 0, transmission: 0.6,
    thickness: 0.02, transparent: true, opacity: 0.85,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 12), glassMat);
  glass.position.set(-0.24, 0.02, 0.02);
  panel.add(glass);

  // Fuel valve — a small lever cock.
  const fuelGrp = new THREE.Group();
  fuelGrp.position.set(-0.24, -0.16, 0.03);
  panel.add(fuelGrp);
  const cock = cyl(0.028, 0.028, 0.05, 10);
  cock.rotateX(Math.PI / 2);
  fuelGrp.add(meshOf(cock, chrome, { uv: 0.1 }));
  const leverPivot = new THREE.Group();
  fuelGrp.add(leverPivot);
  const leverG = box(0.016, 0.10, 0.016, 0.003, 1);
  leverG.translate(0, 0.05, 0.03);
  leverPivot.add(meshOf(leverG, rustMat, { uv: 0.05 }));

  // Primer — a plunger pump with a real stroke.
  const primerGrp = new THREE.Group();
  primerGrp.position.set(0.02, -0.10, 0.05);
  panel.add(primerGrp);
  const barrel = cyl(0.030, 0.030, 0.12, 12);
  barrel.translate(0, 0.06, 0);
  primerGrp.add(meshOf(barrel, chrome, { uv: 0.1 }));
  const plunger = new THREE.Group();
  plunger.position.set(0, 0.12, 0);
  primerGrp.add(plunger);
  const rod = cyl(0.010, 0.010, 0.09, 8);
  rod.translate(0, 0.045, 0);
  plunger.add(meshOf(rod, chrome, { uv: 0.05 }));
  const knobG = lathe([[0, 0], [0.030, 0.004], [0.032, 0.020], [0.018, 0.030]], 12);
  knobG.translate(0, 0.09, 0);
  plunger.add(meshOf(knobG, rustMat, { uv: 0.08 }));

  // Starter — a big shrouded push button.
  const starterGrp = new THREE.Group();
  starterGrp.position.set(0.26, -0.06, 0.05);
  panel.add(starterGrp);
  const shroud = cyl(0.052, 0.056, 0.05, 14);
  shroud.rotateX(Math.PI / 2);
  starterGrp.add(meshOf(shroud, machine, { uv: 0.1 }));
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x1e5c2a, roughness: 0.45, vertexColors: true });
  const btnG = cyl(0.038, 0.038, 0.03, 14);
  btnG.rotateX(Math.PI / 2);
  btnG.translate(0, 0, 0.02);
  const btnMesh = meshOf(btnG, btnMat, { uv: 0.05 });
  starterGrp.add(btnMesh);

  // Gauges: oil pressure and hours run.
  const gaugeTex = textTexture(['0 psi', '', '0000 h'], {
    w: 128, h: 128, align: 'center', pad: 16, lineHeight: 34,
    font: '600 20px "Courier New", monospace', bg: '#c9c4b2', fg: '#201d17',
  });
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.055, 18),
    new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.5, metalness: 0.1 }));
  gauge.position.set(0.24, 0.14, 0.012);
  panel.add(gauge);

  // Panel plate.
  const plateTex = textTexture(['STANDBY SET No. 2', 'FUEL   PRIME   START'], {
    w: 512, h: 96, lineHeight: 34, pad: 14,
    font: '600 24px "Courier New", monospace', bg: '#8d8a7f', fg: '#17150f',
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.082),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.7, metalness: 0.15 }));
  plate.position.set(0, 0.19, 0.012);
  panel.add(plate);

  const state = {
    cores: 0, fuel: false, prime: 0, primed: false,
    cranking: 0, running: false, rpm: 0, hours: 0, failedAttempts: 0, coolDown: 0,
    stage: 'cores',
  };

  const setStage = (s) => {
    if (state.stage === s) return;
    state.stage = s;
    bus?.emit('gen:stage', { id, stage: s, cores: state.cores });
  };

  const api = {
    fit(i) {
      const s = sockets[i];
      if (!s || s.fitted) return false;
      if (!inventory?.take('fuse_core', 1)) return false;
      s.fitted = true;
      s.core.visible = true;
      state.cores++;
      s.lamp.color.set(0x2a2010);
      bus?.emit('gen:core', { id, socket: i, cores: state.cores, required: coresRequired });
      player?.makeNoise?.(9);
      if (state.cores >= coresRequired) setStage('fuel');
      return true;
    },
    openFuel() {
      if (state.cores < coresRequired) return false;
      state.fuel = !state.fuel;
      bus?.emit('gen:fuel', { id, open: state.fuel });
      player?.makeNoise?.(5);
      if (state.fuel) setStage('prime'); else { state.prime = 0; state.primed = false; setStage('fuel'); }
      return true;
    },
    pump() {
      if (!state.fuel) return false;
      state.prime = Math.min(12, state.prime + 1);
      player?.makeNoise?.(4);
      bus?.emit('gen:prime', { id, strokes: state.prime, firm: state.prime >= 12 });
      if (state.prime >= 12 && !state.primed) {
        state.primed = true;
        setStage('start');
      }
      plunger.userData.kick = 1;
      return true;
    },
    crank(dt) {
      if (!state.primed || state.running || state.coolDown > 0) return false;
      state.cranking += dt;
      state._holding = true;          // consumed by update(); see below
      // A starter motor on a 750 kg set is the loudest thing in the building
      // apart from the set itself. Cranking is a commitment.
      player?.makeNoise?.(14);
      if (state.cranking > 15) {
        state.cranking = 0;
        state.coolDown = 60;
        state.failedAttempts++;
        bus?.emit('gen:fail', { id, reason: 'starter overheated' });
      }
      return true;
    },
    tryCatch() {
      // The interactor's 4 s hold gets you here; anything less and she does not
      // catch, which is the whole point of the "do not hold longer than fifteen
      // seconds" line in the procedure — you are meant to feel the risk.
      if (state.cranking > 2.6 && !state.running) {
        state.running = true;
        state.cranking = 0;
        bus?.emit('gen:running', { id });
        bus?.emit('player:noise', { position: root.getWorldPosition(new THREE.Vector3()), radius: 60 });
        player?.kick(0.05, 0, 0.03, 0.02);
        onRunning?.();
        setStage('running');
        return true;
      }
      return false;
    },
    state: () => ({ ...state }),
  };

  interactor?.add({
    id: `${id}_fuel`, object: fuelGrp, kind: 'lever',
    verb: 'Open', label: 'the fuel valve', range: 1.8, hold: 0.8,
    refusal: () => (state.cores < coresRequired
      ? `${coresRequired - state.cores} supply core${state.cores === coresRequired - 1 ? '' : 's'} still missing.`
      : state.running ? 'Running.' : null),
    onUse: () => api.openFuel(),
  });

  interactor?.add({
    id: `${id}_prime`, object: primerGrp, kind: 'pump',
    verb: 'Pump', label: 'the primer', range: 1.8,
    refusal: () => {
      if (!state.fuel) return 'Fuel valve is shut.';
      if (state.running) return 'Running.';
      if (state.primed) return 'Firm. It will not take any more.';
      return null;
    },
    onUse: () => api.pump(),
  });

  interactor?.add({
    id: `${id}_start`, object: starterGrp, kind: 'starter',
    verb: 'Hold', label: 'the starter', range: 1.8, hold: 4.0,
    refusal: () => {
      if (!state.primed) return 'Not primed.';
      if (state.running) return 'Running.';
      if (state.coolDown > 0) return `Starter is hot. ${Math.ceil(state.coolDown)} s.`;
      return null;
    },
    onHold: (t, dt) => { if (dt > 0) api.crank(dt); },
    onUse: () => api.tryCatch(),
  });

  collision?.addBoxAt(position[0], position[1] + 0.9, position[2], 3.8, 1.8, 1.7, { tag: 'prop' });

  let exhaustPuff = 0;
  return {
    id, root, api, state: api.state, sockets,
    update(dt, t) {
      if (state.coolDown > 0) state.coolDown = Math.max(0, state.coolDown - dt);
      // Cranking only decays once the player lets go of the button. `_holding`
      // is set by `crank()` from the interactor's onHold and cleared here, so a
      // released starter winds down and a held one does not.
      if (!state._holding && state.cranking > 0) {
        state.cranking = Math.max(0, state.cranking - dt * 0.9);
      }
      state._holding = false;
      leverPivot.rotation.z = damp(leverPivot.rotation.z, state.fuel ? -1.42 : 0, 12, dt);
      glassMat.color.lerp(new THREE.Color(state.fuel ? 0xd8c9a0 : 0x3a2b12), 1 - Math.exp(-2.4 * dt));
      glassMat.opacity = lerp(0.85, 0.42, state.fuel ? 1 : 0);

      // Primer plunger: a real stroke that stiffens as it goes firm.
      const k = plunger.userData.kick || 0;
      plunger.userData.kick = Math.max(0, k - dt * 4);
      const stiff = state.prime / 12;
      plunger.position.y = -0.055 * (plunger.userData.kick || 0) * (1 - stiff * 0.55);

      // Starter button travel + flywheel.
      btnMesh.position.z = damp(btnMesh.position.z, state.cranking > 0.01 ? -0.014 : 0, 20, dt);
      const targetRpm = state.running ? 1 : state.cranking > 0.01 ? 0.22 : 0;
      state.rpm = damp(state.rpm, targetRpm, state.running ? 1.4 : 6, dt);
      flywheel.rotation.x += state.rpm * dt * 34;

      if (state.running) {
        state.hours += dt / 3600;
        exhaustPuff = Math.min(1, exhaustPuff + dt);
        // Everything on the skid shakes. Small amplitude, high frequency.
        const s = 0.0028 * state.rpm;
        root.position.set(
          position[0] + Math.sin(t * 61) * s,
          position[1] + Math.sin(t * 47 + 1.1) * s,
          position[2] + Math.sin(t * 53 + 2.2) * s);
        for (const so of sockets) so.lamp.color.setRGB(0.1 + 0.7 * state.rpm, 0.55 * state.rpm, 0.12 * state.rpm);
      } else if (state.cranking > 0.01) {
        const s = 0.004;
        root.position.set(
          position[0] + Math.sin(t * 23) * s,
          position[1],
          position[2] + Math.sin(t * 19) * s);
      }

      if ((t % 0.5) < dt) {
        updateTextTexture(gaugeTex, [
          `${Math.round(state.running ? 42 + Math.sin(t * 3) * 3 : 0)} psi`, '',
          `${String(Math.floor(state.hours * 10)).padStart(4, '0')} h`,
        ], {
          align: 'center', pad: 16, lineHeight: 34,
          font: '600 20px "Courier New", monospace', bg: '#c9c4b2', fg: '#201d17',
        });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 7. DOORS
// ---------------------------------------------------------------------------

/**
 * Wrap a `Kit.doorway()` group in behaviour. Variants:
 *
 *   'plain'  — swings both ways
 *   'locked' — needs `requires`; unlocks permanently once opened
 *   'jammed' — needs a pry bar; the pry itself is enormously loud
 *   'chained'— opens 60 mm and stops, forever
 *   'welded' — never opens; it is scenery that looks like a route
 *   'oneway' — no handle on one face
 */
export function annexDoor(ctx, {
  id = 'door', position = [0, 0, 0], rotation = 0, variant = 'plain',
  requires = null, width = 0.96, height = 2.06, hinge = 1, open = 0,
  label = 'the door', parent = null, builder = null, autoClose = 0, oneWaySide = 1,
} = {}) {
  const { bus, interactor, collision, rig, player, inventory } = ctx;

  // `Kit.doorway` wants a Builder-ish object; supply a shim when we are not
  // building inside a zone chunk.
  const host = builder || {
    mat: (key, factory) => (ctx.palette[key]?.() || factory?.()),
    materials: ctx.materials,
    addObject: (o) => { (parent || ctx.scene).add(o); return o; },
  };
  const grp = doorway(host, position[0], position[1], position[2], {
    rotation, width, height, hinge, open, seed: 7,
  });

  const latch = new DoorLatch(grp, {
    id, bus, rig, collision,
    locked: variant === 'locked',
    jammed: variant === 'jammed',
    chained: variant === 'chained',
    welded: variant === 'welded',
    oneWay: variant === 'oneway' ? oneWaySide : 0,
    requires,
    autoClose,
    label,
    weight: variant === 'jammed' ? 1.5 : 1,
  });
  interactor?.addDoor(latch);

  interactor?.add({
    id: `${id}_use`, object: grp, kind: 'door',
    verb: 'Open', label, range: 2.0,
    refusal: (inv) => latch.refusal(inv),
    onUse: (p) => latch.use(p, inventory),
    onRefused: (p) => latch.use(p, inventory),   // still rattles it
  });

  return {
    id, root: grp, latch,
    state: () => ({ angle: +latch.angle.toFixed(3), open: latch.isOpen, locked: latch.locked, jammed: latch.jammed }),
    update() { /* latches are stepped by the Interactor */ },
  };
}

// ---------------------------------------------------------------------------
// 8. PICKUPS
// ---------------------------------------------------------------------------

const PICKUP_BUILDERS = {
  battery_cell(ctx) {
    const g = new THREE.Group();
    const body = cyl(0.032, 0.032, 0.115, 12);
    body.translate(0, 0.058, 0);
    g.add(meshOf(body, M(ctx, 'paper'), { uv: 0.16, shade: (x, y) => 0.7 + clamp01(y / 0.12) * 0.24 }));
    for (const s of [0.012, 0.104]) {
      const band = cyl(0.034, 0.034, 0.012, 12);
      band.translate(0, s, 0);
      g.add(meshOf(band, M(ctx, 'chrome'), { uv: 0.05 }));
    }
    const term = box(0.010, 0.014, 0.010, 0.001, 1);
    term.translate(0.010, 0.122, 0);
    g.add(meshOf(term, M(ctx, 'chrome'), { uv: 0.02 }));
    return g;
  },
  card_warden(ctx) {
    const g = new THREE.Group();
    const card = box(0.086, 0.054, 0.002, 0.001, 1);
    card.rotateX(-Math.PI / 2);
    card.translate(0, 0.002, 0);
    const tex = textTexture(['MERIDIAN FM', 'WARDEN', 'A7-0114'], {
      w: 256, h: 160, lineHeight: 30, pad: 14,
      font: '600 20px Arial, sans-serif', bg: '#c8c2ae', fg: '#232019',
    });
    g.add(new THREE.Mesh(card, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 })));
    return g;
  },
  card_contractor(ctx) { return PICKUP_BUILDERS.card_warden(ctx); },
  pry_bar(ctx) {
    const g = new THREE.Group();
    const shaft = cyl(0.011, 0.013, 0.58, 6);
    shaft.rotateZ(Math.PI / 2);
    shaft.translate(0, 0.014, 0);
    g.add(meshOf(shaft, M(ctx, 'rust'), { uv: 0.2 }));
    // Flattened, curved claw at one end.
    const claw = box(0.10, 0.026, 0.038, 0.004, 1);
    claw.rotateZ(0.42);
    claw.translate(-0.30, 0.030, 0);
    g.add(meshOf(claw, M(ctx, 'rust'), { uv: 0.1 }));
    const chisel = box(0.06, 0.008, 0.030, 0.002, 1);
    chisel.rotateZ(-0.18);
    chisel.translate(0.30, 0.012, 0);
    g.add(meshOf(chisel, M(ctx, 'rust'), { uv: 0.1 }));
    return g;
  },
  tape_player(ctx) {
    const g = new THREE.Group();
    const body = box(0.075, 0.026, 0.118, 0.005, 2);
    body.translate(0, 0.013, 0);
    g.add(meshOf(body, M(ctx, 'plasticWhite'), { uv: 0.1, shade: () => 0.72 }));
    const window = box(0.048, 0.004, 0.032, 0.001, 1);
    window.translate(0, 0.027, -0.02);
    g.add(meshOf(window, M(ctx, 'chrome'), { uv: 0.05 }));
    return g;
  },
  fuse_core(ctx) {
    const g = new THREE.Group();
    const body = cyl(0.062, 0.062, 0.185, 16);
    body.rotateZ(Math.PI / 2);
    body.translate(0, 0.062, 0);
    g.add(meshOf(body, M(ctx, 'plasticWhite'), { uv: 0.2, shade: () => 0.8 }));
    for (const s of [-1, 1]) {
      const cap = cyl(0.058, 0.058, 0.03, 16);
      cap.rotateZ(Math.PI / 2);
      cap.translate(s * 0.104, 0.062, 0);
      g.add(meshOf(cap, M(ctx, 'chrome'), { uv: 0.1 }));
    }
    return g;
  },
  note(ctx) {
    const g = new THREE.Group();
    const sheet = new THREE.PlaneGeometry(0.21, 0.297, 3, 3);
    // A sheet of paper that has lain on a floor is never flat.
    const p = sheet.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.004 + Math.cos(p.getY(i) * 7) * 0.003);
    p.needsUpdate = true;
    sheet.rotateX(-Math.PI / 2);
    sheet.translate(0, 0.002, 0);
    const m = new THREE.Mesh(sheet, M(ctx, 'paper'));
    m.castShadow = false; m.receiveShadow = true;
    g.add(m);
    return g;
  },
  keys_ring(ctx) {
    const g = new THREE.Group();
    const ring = new THREE.TorusGeometry(0.028, 0.003, 5, 14);
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, 0.004, 0);
    g.add(meshOf(ring, M(ctx, 'chrome'), { uv: 0.04 }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const k = box(0.008, 0.002, 0.048, 0.0008, 1);
      k.translate(Math.cos(a) * 0.03, 0.003, Math.sin(a) * 0.03 + 0.024);
      g.add(meshOf(k, M(ctx, 'chrome'), { uv: 0.03 }));
    }
    return g;
  },
  key_penstock(ctx) { return PICKUP_BUILDERS.keys_ring(ctx); },
};

export function pickup(ctx, {
  id = null, item = 'battery_cell', position = [0, 0, 0], rotation = 0,
  noteId = null, tapeId = null, label = null, parent = null, count = 1,
} = {}) {
  const { bus, interactor, inventory, notes, player } = ctx;
  const isNote = !!noteId;
  const kindKey = isNote ? 'note' : item;
  const root = placed(position, rotation, `pickup:${id || item}`);
  (parent || ctx.scene).add(root);
  const build = PICKUP_BUILDERS[kindKey] || PICKUP_BUILDERS.battery_cell;
  root.add(build(ctx));

  const def = inventory?.def?.(item);
  const displayLabel = label || (isNote ? (notes?.get(noteId)?.title || 'a document') : (def?.name?.toLowerCase() || item));

  const handle = {
    id: id || `${item}_${Math.round(position[0] * 10)}_${Math.round(position[2] * 10)}`,
    root,
    taken: false,
    state: () => ({ taken: handle.taken }),
    update() {},
  };

  interactor?.add({
    id: handle.id, object: root, kind: 'pickup',
    verb: isNote ? 'Read' : 'Take', label: displayLabel, range: 2.0, once: true,
    refusal: () => {
      if (isNote) return null;
      if (item === 'fuse_core' && inventory?.handsFull) return 'You are already carrying one.';
      if (inventory?.handsFull) return 'Both hands are full.';
      if (def && inventory?.count(item) >= (def.stack ?? 1)) return `You cannot carry another ${def.name.toLowerCase()}.`;
      return null;
    },
    onUse: () => {
      handle.taken = true;
      if (isNote) {
        notes?.open(noteId);
      } else {
        inventory?.add(item, count);
        if (tapeId) notes?.collect(tapeId);
      }
      root.visible = false;
      player?.makeNoise?.(item === 'fuse_core' ? 6 : 2.2);
      bus?.emit('pickup:taken', { id: handle.id, item, noteId, position: root.position.clone() });
    },
  });

  return handle;
}

// ---------------------------------------------------------------------------
// 9. HIDING PLACE
// ---------------------------------------------------------------------------

/**
 * A steel locker you can get inside.
 *
 * Hiding is deliberately *bad*: the view is two 8 mm louvre slots, you cannot
 * turn round, your own breathing is the loudest thing in the mix, and the
 * Surveyor does not lose interest just because you stopped moving. It is a
 * place to wait out a measuring cycle, not a safe room.
 */
export function hidingPlace(ctx, {
  id = 'locker_1', position = [0, 0, 0], rotation = 0, kind = 'locker', parent = null,
} = {}) {
  const { bus, interactor, collision, player, hands, flashlight } = ctx;
  const root = placed(position, rotation, `hide:${id}`);
  (parent || ctx.scene).add(root);

  const W = 0.38, H = 1.82, D = 0.46;
  const steel = M(ctx, 'machinePaint');
  const galv = M(ctx, 'ductMetal');

  // Carcass: back, sides, top, plinth. All chamfered, all with a return.
  const parts = [];
  const back = box(W, H, 0.02, 0.004, 1);
  back.translate(0, H / 2, -D / 2);
  parts.push(back);
  for (const s of [-1, 1]) {
    const side = box(0.02, H, D, 0.004, 1);
    side.translate(s * (W / 2), H / 2, 0);
    parts.push(side);
  }
  const top = box(W, 0.02, D, 0.004, 1);
  top.translate(0, H, 0);
  parts.push(top);
  const plinth = box(W, 0.10, D, 0.005, 1);
  plinth.translate(0, 0.05, 0);
  parts.push(plinth);
  const shelf = box(W - 0.05, 0.014, D - 0.06, 0.003, 1);
  shelf.translate(0, H - 0.30, 0);
  parts.push(shelf);
  root.add(meshOf(merge(parts), steel, { uv: 0.6, shade: (x, y) => 0.5 + clamp01(y / H) * 0.34 }));

  // Door with real louvres.
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-W / 2 + 0.01, 0, D / 2);
  root.add(doorPivot);
  const dParts = [];
  const leaf = box(W - 0.02, H - 0.12, 0.018, 0.004, 1);
  leaf.translate((W - 0.02) / 2, (H - 0.12) / 2 + 0.10, 0);
  dParts.push(leaf);
  for (let i = 0; i < 5; i++) {
    const lv = box(W - 0.12, 0.018, 0.026, 0.002, 1);
    lv.rotateX(-0.5);
    lv.translate((W - 0.02) / 2, H - 0.30 + i * 0.038, 0.008);
    dParts.push(lv);
  }
  for (let i = 0; i < 5; i++) {
    const lv = box(W - 0.12, 0.018, 0.026, 0.002, 1);
    lv.rotateX(-0.5);
    lv.translate((W - 0.02) / 2, 0.55 + i * 0.038, 0.008);
    dParts.push(lv);
  }
  const handleG = box(0.016, 0.10, 0.030, 0.003, 1);
  handleG.translate(W - 0.07, 1.02, 0.020);
  dParts.push(handleG);
  doorPivot.add(meshOf(merge(dParts), steel, { uv: 0.5, shade: (x, y) => 0.56 + clamp01(y / H) * 0.30 }));

  const col = collision?.addBoxAt(position[0], position[1] + H / 2, position[2], W + 0.05, H, D + 0.05, { tag: 'prop' });

  const state = { inside: false, door: 0, doorTarget: 0, peek: 0, savedYaw: 0, savedFov: 0 };

  const api = {
    enter() {
      if (state.inside) return false;
      state.inside = true;
      state.savedYaw = player.yaw;
      state.savedFov = player.fovBase;
      root.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      root.getWorldPosition(p);
      player.teleport(p.x, p.y, p.z, rotation + Math.PI);
      player.controlEnabled = false;
      player.crouching = false;
      player.fovBase = 58;
      if (col) col.enabled = false;
      state.doorTarget = 0;
      hands?.setVisible(false);
      bus?.emit('hide:enter', { id, kind, position: p.clone() });
      return true;
    },
    exit() {
      if (!state.inside) return false;
      state.inside = false;
      player.controlEnabled = true;
      player.fovBase = state.savedFov || 66;
      if (col) col.enabled = true;
      // Step out in front of the locker.
      root.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      root.getWorldPosition(p);
      player.teleport(
        p.x + Math.sin(rotation) * (D / 2 + 0.55), p.y,
        p.z + Math.cos(rotation) * (D / 2 + 0.55), rotation);
      state.doorTarget = 0.6;
      hands?.setVisible(true);
      player.makeNoise(7);
      bus?.emit('hide:exit', { id, kind });
      return true;
    },
    /** Push the door open a crack to look out. Louder the wider it goes. */
    setPeek(v) { state.peek = clamp01(v); },
    /** Shut it, silently and instantly. Used only by the Attendant. */
    shut() { if (state.inside) return false; state.peek = 0; state.doorTarget = 0; state.door = 0; return true; },
    state: () => ({ ...state }),
  };

  interactor?.add({
    id: `${id}_enter`, object: root, kind: 'hide',
    verb: 'Get in', label: kind, range: 2.0,
    refusal: () => {
      if (state.inside) return null;
      if (ctx.inventory?.handsFull) return 'Not with a core in your arms.';
      return null;
    },
    onUse: () => (state.inside ? api.exit() : api.enter()),
  });

  return {
    id, root, api, state: api.state,
    update(dt, t) {
      if (state.inside) {
        // Locked look: you may pan across the slot, not turn round.
        const limit = 0.55;
        const centre = rotation + Math.PI;
        let d = player.yaw - centre;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        player.yaw = centre + clamp(d, -limit, limit);
        player.pitch = clamp(player.pitch, -0.5, 0.45);
        // Breathing gets loud and shallow; the director reads this too.
        player.fear = Math.max(player.fear, 0.35);
        player.exertion = Math.max(player.exertion, 0.28);
        state.doorTarget = state.peek * 0.42;
        if (state.peek > 0.05) player.makeNoise(1.2 + state.peek * 3);
      }
      state.door = damp(state.door, state.doorTarget, 7, dt);
      doorPivot.rotation.y = -state.door * 1.4;
    },
  };
}

// ---------------------------------------------------------------------------

export const FACTORIES = {
  breaker: breakerPanel,
  breakerPanel,
  valve,
  lift: goodsLift,
  goodsLift,
  keypad,
  cardReader,
  terminal,
  generator,
  door: annexDoor,
  pickup,
  hide: hidingPlace,
  hidingPlace,
};

export default Interactables;
