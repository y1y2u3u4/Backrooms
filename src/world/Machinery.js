import * as THREE from 'three';
import { box, cyl, lathe, merge, worldUV, vertexShade, pipeRun, weather } from '../render/geo.js';
import { makeRng, clamp01, lerp, TAU } from '../core/util.js';
import { Acc, emitProp, P } from './Props.js';

/**
 * Machinery — the heavy plant.
 *
 * These are the objects that make the Service Spine, the Cistern and the Plant
 * read as a working building rather than a set of corridors. They follow the
 * same contract as Props: local space, floor origin, `emitProp` places them.
 *
 * Everything here is built from the same handful of moves that real plant is:
 * a rolled or fabricated body, bolted flanges, cooling fins, a nameplate, a
 * gauge, and a run of pipe or conduit leaving in a direction that implies the
 * rest of the system. The last of those is what sells it — plant that connects
 * to nothing looks like a prop.
 */

const A = (s) => new Acc(s);

/** Bolt ring on a flange face. */
function bolts(acc, key, cx, cy, cz, r, n = 8, size = 0.014, axis = 'y') {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const g = cyl(size, size, size * 1.6, 6);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    const dx = axis === 'x' ? 0 : Math.sin(a) * r;
    const dy = axis === 'y' ? 0 : Math.cos(a) * r;
    const dz = axis === 'z' ? 0 : (axis === 'y' ? Math.cos(a) * r : Math.sin(a) * r);
    acc.g(key, (g.translate(cx + dx, cy + dy, cz + dz), g));
  }
}

/** Cooling fins on a cylinder — motors and transformers both need them. */
function fins(acc, key, r, h, n, cy) {
  for (let i = 0; i < n; i++) {
    const f = cyl(r * 1.10, r * 1.10, 0.010, 16);
    f.translate(0, cy - h / 2 + (i + 0.5) * (h / n), 0);
    acc.g(key, f);
  }
}

/** Small rectangular nameplate. */
function nameplate(acc, x, y, z, yaw = 0, w = 0.11, h = 0.07) {
  const g = P(w, h, 0.004, 0.001);
  g.rotateY(yaw); g.translate(x, y, z);
  acc.g('chrome', g);
}

// ---------------------------------------------------------------------------

/**
 * End-suction centrifugal pump on a fabricated base: motor, coupling guard,
 * volute, suction and discharge flanges, pressure gauge. Add pipework to the
 * flange positions returned in `ports`.
 */
export function pumpSet(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, scale = 1, key = 'machinePaint', damage = 0.3 } = o;
  const a = A(seed); a.height = 0.9; const rng = a.rng;

  const base = P(1.30, 0.10, 0.52, 0.008); base.translate(0, 0.05, 0);
  a.g('steelCabinet', base);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pad = P(0.10, 0.03, 0.10, 0.004); pad.translate(sx * 0.55, 0.015, sz * 0.18);
    a.g('steelCabinet', pad);
  }

  // Motor.
  const mr = 0.155;
  const motor = cyl(mr, mr, 0.52, 18); motor.rotateZ(Math.PI / 2); motor.translate(-0.30, 0.32, 0);
  a.g(key, motor);
  for (let i = 0; i < 9; i++) {
    const f = cyl(mr * 1.09, mr * 1.09, 0.012, 18); f.rotateZ(Math.PI / 2);
    f.translate(-0.54 + i * 0.055, 0.32, 0);
    a.g(key, f);
  }
  const term = P(0.14, 0.10, 0.16, 0.008); term.translate(-0.30, 0.47, 0.02);
  a.g(key, term);
  const gland = cyl(0.017, 0.017, 0.05, 8); gland.rotateX(Math.PI / 2); gland.translate(-0.30, 0.47, 0.11);
  a.g('chrome', gland);
  const feet = P(0.20, 0.17, 0.44, 0.006); feet.translate(-0.30, 0.185, 0);
  a.g(key, feet);
  const fan = lathe([[0, 0], [0.11, 0.005], [0.115, 0.06], [0.08, 0.075], [0, 0.075]], 14);
  fan.rotateZ(Math.PI / 2); fan.translate(-0.60, 0.32, 0);
  a.g('steelCabinet', fan);

  // Coupling guard.
  const guard = P(0.16, 0.24, 0.22, 0.02); guard.translate(-0.02, 0.32, 0);
  a.g('hazardYellow', guard);

  // Volute.
  const vol = lathe([[0, 0], [0.20, 0.02], [0.215, 0.10], [0.18, 0.19], [0.10, 0.22], [0, 0.225]], 20);
  vol.rotateZ(Math.PI / 2); vol.translate(0.30, 0.32, 0);
  a.g(key, vol);
  const suction = cyl(0.085, 0.085, 0.14, 14); suction.rotateZ(Math.PI / 2); suction.translate(0.56, 0.32, 0);
  const sflange = cyl(0.125, 0.125, 0.026, 16); sflange.rotateZ(Math.PI / 2); sflange.translate(0.625, 0.32, 0);
  a.g(key, suction); a.g('steelCabinet', sflange);
  bolts(a, 'chrome', 0.638, 0.32, 0, 0.10, 8, 0.011, 'x');

  const disch = cyl(0.075, 0.075, 0.20, 14); disch.translate(0.30, 0.60, 0);
  const dflange = cyl(0.112, 0.112, 0.024, 16); dflange.translate(0.30, 0.70, 0);
  a.g(key, disch); a.g('steelCabinet', dflange);
  bolts(a, 'chrome', 0.30, 0.713, 0, 0.088, 8, 0.010, 'y');

  const gstem = cyl(0.008, 0.008, 0.10, 6); gstem.translate(0.30, 0.50, 0.14);
  const gface = cyl(0.048, 0.048, 0.022, 14); gface.rotateX(Math.PI / 2); gface.translate(0.30, 0.55, 0.17);
  a.g('chrome', gstem, gface);
  const dial = cyl(0.040, 0.040, 0.004, 14); dial.rotateX(Math.PI / 2); dial.translate(0.30, 0.55, 0.183);
  a.g('paper', dial);
  nameplate(a, -0.30, 0.40, 0.16, 0, 0.12, 0.06);

  if (damage > 0.4) {
    const puddle = P(0.6, 0.004, 0.4, 0.001); puddle.translate(0.3, 0.002, 0.25);
    a.g('glassDark', puddle);
  }
  a.col(0, 0.35, 0, 1.35, 0.75, 0.55);
  const res = emitProp(b, a, { x, y, z, yaw, scale, uv: 0.5, shadeTop: 0.8, ...o });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  res.ports = {
    suction: [x + (0.70 * c) * scale, y + 0.32 * scale, z - (0.70 * s) * scale],
    discharge: [x + (0.30 * c) * scale, y + 0.72 * scale, z - (0.30 * s) * scale],
  };
  return res;
}

/** Vertical cylindrical tank on legs, with a manway, level gauge and nozzles. */
export function tank(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, r = 0.62, h = 1.9, legs = 0.35, key = 'machinePaint', rusty = false } = o;
  const a = A(seed); a.height = h + legs;
  const mat = rusty ? 'rust' : key;
  const shell = cyl(r, r, h, 22); shell.translate(0, legs + h / 2, 0);
  a.g(mat, shell);
  const top = lathe([[0, 0.22], [r * 0.5, 0.17], [r * 0.88, 0.06], [r, 0.0]], 22);
  top.translate(0, legs + h, 0);
  const bot = lathe([[0, -0.20], [r * 0.5, -0.15], [r * 0.88, -0.05], [r, 0.0]], 22);
  bot.translate(0, legs, 0);
  a.g(mat, top, bot);
  // Course seams — a rolled tank is made of plates.
  for (let i = 1; i < 3; i++) {
    const seam = cyl(r + 0.008, r + 0.008, 0.016, 22);
    seam.translate(0, legs + (i / 3) * h, 0);
    a.g(mat, seam);
  }
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * TAU + 0.4;
    const leg = P(0.07, legs, 0.07, 0.008);
    leg.translate(Math.sin(ang) * r * 0.78, legs / 2, Math.cos(ang) * r * 0.78);
    a.g('steelCabinet', leg);
    const pad = P(0.13, 0.014, 0.13, 0.003);
    pad.translate(Math.sin(ang) * r * 0.78, 0.007, Math.cos(ang) * r * 0.78);
    a.g('steelCabinet', pad);
  }
  // Manway.
  const mw = cyl(0.20, 0.20, 0.06, 16); mw.translate(0, legs + h + 0.21, 0);
  a.g('steelCabinet', mw);
  bolts(a, 'chrome', 0, legs + h + 0.25, 0, 0.17, 8, 0.012, 'y');
  // Level gauge.
  const lg = cyl(0.014, 0.014, h * 0.75, 8); lg.translate(r + 0.05, legs + h * 0.42, 0);
  a.g('glassDark', lg);
  for (const yy of [legs + 0.06, legs + h * 0.79]) {
    const fitting = P(0.06, 0.05, 0.05, 0.008); fitting.translate(r + 0.03, yy, 0);
    a.g('chrome', fitting);
  }
  // Nozzles.
  const noz = cyl(0.05, 0.05, 0.18, 12); noz.rotateZ(Math.PI / 2); noz.translate(-r - 0.06, legs + 0.16, 0);
  const nf = cyl(0.082, 0.082, 0.02, 14); nf.rotateZ(Math.PI / 2); nf.translate(-r - 0.15, legs + 0.16, 0);
  a.g(mat, noz); a.g('steelCabinet', nf);
  nameplate(a, 0, legs + h * 0.62, r + 0.01, 0, 0.14, 0.09);
  a.col(0, (legs + h) / 2, 0, r * 2, legs + h, r * 2);
  const res = emitProp(b, a, { x, y, z, yaw, uv: 0.6, shadeTop: legs + h, ...o });
  res.ports = { low: [x - (r + 0.2) * Math.cos(yaw), y + legs + 0.16, z + (r + 0.2) * Math.sin(yaw)] };
  return res;
}

/**
 * Switchgear line-up: `bays` cubicles with doors, meters, labels and louvres,
 * standing on a plinth over a cable trench.
 */
export function switchgear(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, bays = 4, bay = 0.80, d = 0.90, h = 2.20, lit = false } = o;
  const a = A(seed); a.height = h; const rng = a.rng;
  const W = bays * bay;
  const carc = P(W, h - 0.10, d, 0.010); carc.translate(0, 0.10 + (h - 0.10) / 2, 0);
  a.g('machinePaint', carc);
  const plinth = P(W + 0.04, 0.10, d + 0.04, 0.006); plinth.translate(0, 0.05, 0);
  a.g('steelCabinet', plinth);
  const cap = P(W + 0.03, 0.035, d + 0.03, 0.006); cap.translate(0, h - 0.017, 0);
  a.g('machinePaint', cap);
  for (let i = 0; i < bays; i++) {
    const bx = -W / 2 + (i + 0.5) * bay;
    const door = P(bay - 0.03, h - 0.20, 0.024, 0.006); door.translate(bx, 0.15 + (h - 0.20) / 2, d / 2 + 0.006);
    a.g('machinePaint', door);
    // Handle and latch.
    const hnd = P(0.026, 0.19, 0.05, 0.008); hnd.translate(bx + bay * 0.36, 1.15, d / 2 + 0.032);
    a.g('chrome', hnd);
    // Louvres low down.
    for (let v = 0; v < 4; v++) {
      const lv = P(bay - 0.24, 0.012, 0.018, 0.003); lv.rotateX(-0.45);
      lv.translate(bx, 0.30 + v * 0.035, d / 2 + 0.026);
      a.g('machinePaint', lv);
    }
    // Instrument panel.
    const ip = P(bay - 0.20, 0.34, 0.014, 0.004); ip.translate(bx, h - 0.42, d / 2 + 0.022);
    a.g('steelCabinet', ip);
    for (let k = 0; k < 2; k++) {
      const m = cyl(0.055, 0.055, 0.026, 16); m.rotateX(Math.PI / 2);
      m.translate(bx - 0.13 + k * 0.26, h - 0.36, d / 2 + 0.034);
      a.g('chrome', m);
      const face = cyl(0.046, 0.046, 0.004, 16); face.rotateX(Math.PI / 2);
      face.translate(bx - 0.13 + k * 0.26, h - 0.36, d / 2 + 0.048);
      a.g('paper', face);
    }
    for (let k = 0; k < 3; k++) {
      const lamp = cyl(0.014, 0.014, 0.016, 10); lamp.rotateX(Math.PI / 2);
      lamp.translate(bx - 0.08 + k * 0.08, h - 0.56, d / 2 + 0.03);
      a.g(k === 1 && lit ? 'hazardYellow' : 'rubber', lamp);
    }
    const lbl = P(0.20, 0.055, 0.004, 0.001); lbl.translate(bx, h - 0.66, d / 2 + 0.026);
    a.g('paper', lbl);
    // Isolator handle.
    const iso = P(0.05, 0.11, 0.06, 0.012);
    iso.rotateZ(rng.chance(0.5) ? 0.5 : -0.5);
    iso.translate(bx - bay * 0.30, 1.55, d / 2 + 0.04);
    a.g('warningRed', iso);
  }
  a.col(0, h / 2, 0, W, h, d);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.55, shadeTop: h, ...o });
}

/** Oil-filled transformer with a radiator bank and HV bushings. */
export function transformer(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.9, d = 1.25, h = 2.0 } = o;
  const a = A(seed); a.height = h + 0.55;
  const body = P(w, h, d, 0.02); body.translate(0, 0.16 + h / 2, 0);
  a.g('machinePaint', body);
  const skid = P(w + 0.12, 0.16, d + 0.12, 0.01); skid.translate(0, 0.08, 0);
  a.g('steelCabinet', skid);
  for (const sx of [-1, 1]) {
    const wheel = cyl(0.09, 0.09, 0.07, 12); wheel.rotateZ(Math.PI / 2);
    wheel.translate(sx * (w / 2 - 0.15), 0.09, d / 2 - 0.1);
    a.g('steelCabinet', wheel);
  }
  // Radiator banks on both long faces.
  for (const sz of [-1, 1]) {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const rad = P(0.05, h * 0.72, 0.24, 0.008);
      rad.translate(-w / 2 + 0.18 + i * ((w - 0.36) / (n - 1)), 0.16 + h * 0.46, sz * (d / 2 + 0.12));
      a.g('machinePaint', rad);
    }
    const hdr = cyl(0.05, 0.05, w - 0.24, 12); hdr.rotateZ(Math.PI / 2);
    hdr.translate(0, 0.16 + h * 0.82, sz * (d / 2 + 0.12));
    const hdr2 = hdr.clone(); hdr2.translate(0, -h * 0.72, 0);
    a.g('machinePaint', hdr, hdr2);
  }
  // Conservator.
  const cons = cyl(0.22, 0.22, w * 0.55, 16); cons.rotateZ(Math.PI / 2);
  cons.translate(0, 0.16 + h + 0.28, -d / 2 + 0.2);
  a.g('machinePaint', cons);
  for (const sx of [-1, 1]) {
    const brk = P(0.06, 0.30, 0.20, 0.006); brk.translate(sx * w * 0.2, 0.16 + h + 0.10, -d / 2 + 0.2);
    a.g('steelCabinet', brk);
  }
  // Bushings.
  for (let i = 0; i < 3; i++) {
    const bx = -0.45 + i * 0.45;
    const stack = lathe([[0.06, 0], [0.10, 0.02], [0.07, 0.05], [0.11, 0.09], [0.07, 0.12],
    [0.11, 0.16], [0.07, 0.19], [0.10, 0.23], [0.05, 0.26], [0.03, 0.30], [0, 0.30]], 12);
    stack.translate(bx, 0.16 + h, d * 0.18);
    a.g('enamel', stack);
    const term = cyl(0.02, 0.02, 0.09, 8); term.translate(bx, 0.16 + h + 0.34, d * 0.18);
    a.g('copper', term);
  }
  const gauge = cyl(0.06, 0.06, 0.03, 14); gauge.rotateX(Math.PI / 2);
  gauge.translate(w * 0.3, 0.16 + h * 0.85, d / 2 + 0.02);
  a.g('chrome', gauge);
  nameplate(a, -w * 0.28, 0.16 + h * 0.8, d / 2 + 0.01, 0, 0.22, 0.15);
  a.col(0, h / 2, 0, w + 0.3, h + 0.2, d + 0.5);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.7, shadeTop: h + 0.5, ...o });
}

/**
 * Diesel generator set on a skid: engine block, exhaust manifold, turbo,
 * radiator with a fan guard, alternator, control panel, exhaust stack.
 * The Plant's hero object.
 */
export function generatorSet(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, len = 5.6, w = 1.9, running = false, stackTo = 8.0 } = o;
  const a = A(seed); a.height = 3.2; const rng = a.rng;

  // Skid.
  const skid = P(len, 0.22, w, 0.012); skid.translate(0, 0.11, 0);
  a.g('steelCabinet', skid);
  for (let i = 0; i < 6; i++) {
    const mount = P(0.22, 0.10, 0.22, 0.012);
    mount.translate(-len / 2 + 0.5 + i * ((len - 1.0) / 5), 0.27, (i % 2 ? 1 : -1) * (w / 2 - 0.25));
    a.g('rubber', mount);
  }

  // Engine block.
  const bl = P(2.5, 1.05, 1.15, 0.03); bl.translate(-0.35, 0.85, 0);
  a.g('machinePaint', bl);
  const sump = P(2.4, 0.34, 1.0, 0.02); sump.translate(-0.35, 0.40, 0);
  a.g('machinePaint', sump);
  // Cylinder head + rocker cover.
  const head = P(2.3, 0.22, 0.72, 0.02); head.translate(-0.35, 1.46, 0);
  const rocker = P(2.1, 0.20, 0.55, 0.03); rocker.translate(-0.35, 1.66, 0);
  a.g('machinePaint', head); a.g('steelCabinet', rocker);
  for (let i = 0; i < 6; i++) {
    const bolt = cyl(0.022, 0.022, 0.05, 6);
    bolt.translate(-1.35 + i * 0.40, 1.78, 0.20);
    a.g('chrome', bolt);
  }
  // Exhaust manifold + turbo.
  for (let i = 0; i < 6; i++) {
    const port = cyl(0.055, 0.055, 0.18, 10); port.rotateX(Math.PI / 2);
    port.translate(-1.35 + i * 0.40, 1.30, 0.45);
    a.g('rust', port);
  }
  const man = cyl(0.075, 0.075, 2.2, 12); man.rotateZ(Math.PI / 2); man.translate(-0.35, 1.30, 0.56);
  a.g('rust', man);
  const turbo = lathe([[0, 0], [0.17, 0.03], [0.19, 0.10], [0.12, 0.16], [0.07, 0.20], [0, 0.20]], 14);
  turbo.rotateX(Math.PI / 2); turbo.translate(0.85, 1.30, 0.52);
  a.g('rust', turbo);
  const turboIn = cyl(0.09, 0.09, 0.26, 12); turboIn.rotateZ(Math.PI / 2); turboIn.translate(1.02, 1.30, 0.52);
  a.g('chrome', turboIn);

  // Alternator.
  const alt = cyl(0.62, 0.62, 1.5, 22); alt.rotateZ(Math.PI / 2); alt.translate(1.65, 0.95, 0);
  a.g('machinePaint', alt);
  for (let i = 0; i < 8; i++) {
    const f = cyl(0.635, 0.635, 0.02, 22); f.rotateZ(Math.PI / 2);
    f.translate(1.0 + i * 0.185, 0.95, 0);
    a.g('machinePaint', f);
  }
  const tbox = P(0.55, 0.42, 0.5, 0.012); tbox.translate(1.65, 1.72, 0);
  a.g('steelCabinet', tbox);
  for (let i = 0; i < 3; i++) {
    const gl = cyl(0.03, 0.03, 0.06, 8); gl.translate(1.5 + i * 0.15, 1.51, 0);
    a.g('chrome', gl);
  }

  // Radiator + fan guard at the cold end.
  const rad = P(0.34, 1.5, w - 0.10, 0.014); rad.translate(-len / 2 + 0.35, 1.0, 0);
  a.g('machinePaint', rad);
  const core = P(0.10, 1.30, w - 0.32, 0.006); core.translate(-len / 2 + 0.35, 1.0, 0);
  a.g('grilleMetal', core);
  for (let i = 0; i < 18; i++) {
    const fin = P(0.13, 0.010, w - 0.34, 0.002);
    fin.translate(-len / 2 + 0.35, 0.38 + i * 0.072, 0);
    a.g('grilleMetal', fin);
  }
  const guardR = 0.62;
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.TorusGeometry(guardR * (0.3 + i * 0.24), 0.008, 5, 20);
    ring.rotateY(Math.PI / 2); ring.translate(-len / 2 + 0.16, 1.0, 0);
    a.g('grilleMetal', ring);
  }
  for (let i = 0; i < 8; i++) {
    const spoke = P(0.008, guardR * 2, 0.012, 0.002);
    spoke.rotateX((i / 8) * Math.PI); spoke.translate(-len / 2 + 0.16, 1.0, 0);
    a.g('grilleMetal', spoke);
  }

  // Control panel on a stand.
  const cp = P(0.62, 0.85, 0.30, 0.014); cp.rotateY(-0.25); cp.translate(0.6, 1.95, -w / 2 - 0.30);
  a.g('steelCabinet', cp);
  const cpface = P(0.50, 0.70, 0.02, 0.004); cpface.rotateY(-0.25); cpface.translate(0.66, 1.95, -w / 2 - 0.45);
  a.g('rubber', cpface);
  for (let i = 0; i < 4; i++) {
    const m = cyl(0.052, 0.052, 0.02, 14); m.rotateX(Math.PI / 2); m.rotateY(-0.25);
    m.translate(0.44 + (i % 2) * 0.24, 2.16 - Math.floor(i / 2) * 0.24, -w / 2 - 0.44 - (i % 2) * 0.06);
    a.g('chrome', m);
  }
  for (const sx of [-1, 1]) {
    const leg = P(0.06, 1.55, 0.06, 0.008); leg.translate(0.6 + sx * 0.22, 0.78, -w / 2 - 0.28);
    a.g('steelCabinet', leg);
  }

  // Exhaust: silencer then a stack that leaves the frame.
  const sil = cyl(0.24, 0.24, 1.5, 16); sil.rotateZ(Math.PI / 2); sil.translate(0.2, 2.45, 0.62);
  a.g('rust', sil);
  for (const sx of [-1, 1]) {
    const brk = P(0.05, 0.55, 0.30, 0.006); brk.translate(0.2 + sx * 0.55, 2.15, 0.62);
    a.g('steelCabinet', brk);
  }
  const bellow = cyl(0.11, 0.11, 0.30, 12); bellow.rotateX(-0.6); bellow.translate(0.92, 1.75, 0.58);
  a.g('chrome', bellow);
  const up = cyl(0.15, 0.15, Math.max(0.5, stackTo - 2.6), 14);
  up.translate(-0.6, 2.6 + Math.max(0.5, stackTo - 2.6) / 2, 0.62);
  a.g('rust', up);
  const elbow = pipeRun([[0.2, 2.7, 0.62], [-0.35, 2.9, 0.62], [-0.6, 3.2, 0.62]], 0.15, 12, 6);
  a.g('rust', elbow);
  nameplate(a, -0.35, 1.05, 0.62, 0, 0.26, 0.16);

  a.col(0, 1.1, 0, len, 2.2, w);
  const res = emitProp(b, a, { x, y, z, yaw, uv: 0.8, shadeTop: 2.6, ...o });
  res.stackTop = [x - 0.6 * Math.cos(yaw), y + stackTo, z + 0.6 * Math.sin(yaw)];
  return res;
}

/** Air-handling unit: a big insulated box with access doors and duct spigots. */
export function airHandler(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, len = 4.0, w = 1.6, h = 1.9, key = 'ductMetal' } = o;
  const a = A(seed); a.height = h + 0.25;
  const base = P(len + 0.1, 0.25, w + 0.1, 0.01); base.translate(0, 0.125, 0);
  a.g('steelCabinet', base);
  const body = P(len, h, w, 0.014); body.translate(0, 0.25 + h / 2, 0);
  a.g(key, body);
  // Panel joints.
  const n = Math.round(len / 1.0);
  for (let i = 1; i < n; i++) {
    const j = P(0.03, h + 0.02, w + 0.02, 0.004);
    j.translate(-len / 2 + i * (len / n), 0.25 + h / 2, 0);
    a.g('steelCabinet', j);
  }
  for (let i = 0; i < n; i++) {
    const dx = -len / 2 + (i + 0.5) * (len / n);
    const door = P(len / n - 0.12, h - 0.30, 0.02, 0.006);
    door.translate(dx, 0.25 + h / 2, w / 2 + 0.008);
    a.g(key, door);
    for (const sy of [-1, 1]) {
      const latch = P(0.05, 0.09, 0.05, 0.010);
      latch.translate(dx + (len / n) * 0.30, 0.25 + h / 2 + sy * (h - 0.5) * 0.35, w / 2 + 0.035);
      a.g('chrome', latch);
    }
    if (i === 1) {
      const win = P(0.16, 0.16, 0.01, 0.003); win.translate(dx, 0.25 + h * 0.68, w / 2 + 0.024);
      a.g('glassDark', win);
    }
  }
  // Spigots.
  for (const sx of [-1, 1]) {
    const sp = P(0.10, h * 0.6, w * 0.62, 0.008); sp.translate(sx * (len / 2 + 0.05), 0.25 + h * 0.5, 0);
    a.g(key, sp);
    const fl = P(0.03, h * 0.62, w * 0.64, 0.004); fl.translate(sx * (len / 2 + 0.10), 0.25 + h * 0.5, 0);
    a.g('steelCabinet', fl);
  }
  a.col(0, (h + 0.25) / 2, 0, len, h + 0.25, w);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.8, shadeTop: h + 0.25, ...o });
}

/**
 * Goods lift: shaft opening, bi-parting steel doors, call station, floor
 * indicator, and a car behind if `carVisible`. The exit from the building.
 */
export function goodsLift(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 2.4, h = 2.8, open = 0, powered = false, decals = null } = o;
  const a = A(seed); a.height = h + 0.6;
  // Surround.
  const jambW = 0.28;
  for (const sx of [-1, 1]) {
    const j = P(jambW, h + 0.4, 0.30, 0.012); j.translate(sx * (w / 2 + jambW / 2), (h + 0.4) / 2, -0.15);
    a.g('machinePaint', j);
  }
  const head = P(w + jambW * 2, 0.40, 0.30, 0.012); head.translate(0, h + 0.2, -0.15);
  a.g('machinePaint', head);
  const sill = P(w + 0.10, 0.06, 0.34, 0.006); sill.translate(0, 0.03, -0.15);
  a.g('tread', sill);
  // Bi-parting doors: upper leaf goes up, lower leaf goes down.
  const gap = open * (h / 2 - 0.1);
  const lower = P(w - 0.02, h / 2 - 0.02, 0.05, 0.008); lower.translate(0, (h / 4) - gap, -0.02);
  const upper = P(w - 0.02, h / 2 - 0.02, 0.05, 0.008); upper.translate(0, (h * 3 / 4) + gap, -0.02);
  a.g('steelCabinet', lower, upper);
  for (const [gy, sgn] of [[(h / 4) - gap, 1], [(h * 3 / 4) + gap, -1]]) {
    for (let i = 0; i < 4; i++) {
      const rib = P(w - 0.16, 0.05, 0.014, 0.003);
      rib.translate(0, gy + (i - 1.5) * (h / 10), 0.012);
      a.g('steelCabinet', rib);
    }
  }
  // The shaft behind, so an open door shows depth rather than a black plane.
  const shaft = P(w + 0.4, h + 0.4, 1.6, 0.01);
  shaft.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const idx = shaft.getIndex();
  if (idx) { const arr = idx.array; for (let i = 0; i < arr.length; i += 3) { const t = arr[i]; arr[i] = arr[i + 2]; arr[i + 2] = t; } idx.needsUpdate = true; }
  shaft.computeVertexNormals();
  shaft.translate(0, (h + 0.4) / 2, -1.0);
  a.g('concreteWall', shaft);
  // Call station and indicator.
  const cs = P(0.20, 0.36, 0.09, 0.010); cs.translate(w / 2 + jambW + 0.14, 1.20, 0.02);
  a.g('steelCabinet', cs);
  const btn = cyl(0.026, 0.026, 0.02, 12); btn.rotateX(Math.PI / 2); btn.translate(w / 2 + jambW + 0.14, 1.24, 0.075);
  a.g(powered ? 'hazardYellow' : 'rubber', btn);
  const ind = P(0.44, 0.20, 0.07, 0.010); ind.translate(0, h + 0.42, 0.02);
  a.g('steelCabinet', ind);
  const indFace = P(0.34, 0.12, 0.01, 0.003); indFace.translate(0, h + 0.42, 0.06);
  a.g(powered ? 'hazardYellow' : 'glassDark', indFace);
  a.col(0, h / 2, -0.05, w + jambW * 2, h, 0.34);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.7, shadeTop: h, ...o });
}

/** Penstock / sluice gate with a rising spindle and a handwheel. */
export function sluiceGate(b, x, y, z, o = {}) {
  const { seed = 1, yaw = 0, w = 1.1, h = 1.3, openAmt = 0.25 } = o;
  const a = A(seed); a.height = h + 1.5;
  const frame = [];
  for (const sx of [-1, 1]) {
    const g = P(0.12, h + 0.3, 0.14, 0.008); g.translate(sx * (w / 2 + 0.06), (h + 0.3) / 2, 0);
    frame.push(g);
  }
  const hd = P(w + 0.24, 0.14, 0.14, 0.008); hd.translate(0, h + 0.3, 0);
  frame.push(hd);
  const sill = P(w + 0.24, 0.12, 0.18, 0.006); sill.translate(0, 0.06, 0);
  frame.push(sill);
  a.g('rust', merge(frame));
  const gate = P(w, h, 0.05, 0.006); gate.translate(0, h / 2 + openAmt * h, 0);
  a.g('rust', gate);
  for (let i = 0; i < 3; i++) {
    const rib = P(w - 0.1, 0.06, 0.05, 0.004); rib.translate(0, h * (0.25 + i * 0.25) + openAmt * h, -0.04);
    a.g('rust', rib);
  }
  // Pedestal, spindle, handwheel.
  const ped = P(0.34, 0.9, 0.34, 0.012); ped.translate(0, h + 0.75, 0.35);
  a.g('machinePaint', ped);
  const spindle = cyl(0.028, 0.028, h + 1.4, 8); spindle.translate(0, (h + 1.4) / 2 + 0.2, 0.35);
  a.g('chrome', spindle);
  const wheel = new THREE.TorusGeometry(0.26, 0.020, 6, 20);
  wheel.rotateX(Math.PI / 2); wheel.translate(0, h + 1.28, 0.35);
  a.g('warningRed', wheel);
  for (let i = 0; i < 4; i++) {
    const sp = P(0.52, 0.016, 0.022, 0.004); sp.rotateY((i / 4) * Math.PI);
    sp.translate(0, h + 1.28, 0.35);
    a.g('warningRed', sp);
  }
  const hub = cyl(0.05, 0.05, 0.08, 10); hub.translate(0, h + 1.28, 0.35);
  a.g('warningRed', hub);
  a.col(0, h / 2, 0, w + 0.3, h, 0.2);
  a.col(0, 0.45, 0.35, 0.36, 0.9, 0.36);
  return emitProp(b, a, { x, y, z, yaw, uv: 0.6, shadeTop: h + 1.4, ...o });
}

/** Cable tray run with cables in it — the connective tissue of every plantroom. */
export function cableTray(b, points, o = {}) {
  const { seed = 1, w = 0.30, key = 'grilleMetal', cables = 5, tiers = 1 } = o;
  const a = A(seed); const rng = a.rng;
  for (let t = 0; t < tiers; t++) {
    const dy = -t * 0.22;
    for (let i = 1; i < points.length; i++) {
      const p0 = new THREE.Vector3(...points[i - 1]).add(new THREE.Vector3(0, dy, 0));
      const p1 = new THREE.Vector3(...points[i]).add(new THREE.Vector3(0, dy, 0));
      const len = p0.distanceTo(p1);
      const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      const mid = p0.clone().lerp(p1, 0.5);
      const bot = P(w, 0.012, len, 0.003); bot.rotateY(yaw); bot.translate(mid.x, mid.y, mid.z);
      a.g(key, bot);
      for (const sx of [-1, 1]) {
        const side = P(0.010, 0.075, len, 0.002);
        side.rotateY(yaw);
        side.translate(mid.x + Math.cos(yaw) * sx * w / 2, mid.y + 0.037, mid.z - Math.sin(yaw) * sx * w / 2);
        a.g(key, side);
      }
      // Rungs.
      const nr = Math.max(1, Math.round(len / 0.30));
      for (let k = 0; k < nr; k++) {
        const tt = (k + 0.5) / nr;
        const p = p0.clone().lerp(p1, tt);
        const rung = P(w, 0.010, 0.026, 0.002); rung.rotateY(yaw); rung.translate(p.x, p.y + 0.002, p.z);
        a.g(key, rung);
      }
      // Brackets every 1.8 m, hung from above.
      const nb = Math.max(1, Math.round(len / 1.8));
      for (let k = 0; k <= nb; k++) {
        const p = p0.clone().lerp(p1, k / nb);
        const arm = P(w + 0.12, 0.03, 0.03, 0.004); arm.rotateY(yaw); arm.translate(p.x, p.y - 0.02, p.z);
        a.g('steelCabinet', arm);
        if (t === 0) {
          const rod = cyl(0.008, 0.008, 0.28, 5); rod.translate(p.x, p.y + 0.14, p.z);
          a.g('steelCabinet', rod);
        }
      }
    }
  }
  // Cables riding in the tray, each a slightly different radius and sag.
  for (let c = 0; c < cables; c++) {
    const off = (-0.5 + (c + 0.5) / cables) * (w - 0.06);
    const r = rng.range(0.012, 0.026);
    const pts = points.map((p, i) => {
      const yaw = i < points.length - 1
        ? Math.atan2(points[i + 1][0] - p[0], points[i + 1][2] - p[2])
        : Math.atan2(p[0] - points[i - 1][0], p[2] - points[i - 1][2]);
      return [p[0] + Math.cos(yaw) * off, p[1] + r + 0.008, p[2] - Math.sin(yaw) * off];
    });
    const cable = pipeRun(pts, r, 7, 2);
    a.g('rubber', cable);
  }
  return emitProp(b, a, { x: 0, y: 0, z: 0, uv: 0.5, shade: false, collide: false, ...o });
}

export default {
  pumpSet, tank, switchgear, transformer, generatorSet, airHandler,
  goodsLift, sluiceGate, cableTray,
};
