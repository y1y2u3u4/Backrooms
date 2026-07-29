import * as THREE from 'three';
import { KIT, grille } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, bulkhead, emergencyLight, hollowBox, ductRun,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade, pipeRun, weather } from '../../render/geo.js';

/**
 * THE DUCTWORK — 800 mm square galvanised, and nothing else.
 *
 * The whole zone is one idea: the player cannot stand up, cannot turn round
 * easily, cannot see past the next junction, and can hear everything. It is
 * built to be TACTILE rather than visual — the interest is in the construction,
 * because there is nothing else to look at:
 *
 *   * every 1.2 m there is a transverse joint with a raised flange and a line
 *     of rivets, so the player's crawl has a rhythm and a measurable speed
 *   * hanger straps pass through the section overhead
 *   * the sheet is dished slightly between joints, which catches the lamp
 *   * junctions are real: a mitred elbow with turning vanes, a tee with a
 *     splitter, and a takeoff that is too small to enter
 *
 * And three grilles that look into rooms the player cannot reach. Those are the
 * only wide shots in the zone and they exist to make the crawl feel like a
 * punishment.
 */

const SIZE = 0.80;              // internal clear
const FLOOR = 0;                // duct floor
const HEAD = SIZE;              // duct soffit

/** Interior of a straight duct run, with seams, rivets and hanger straps. */
function crawl(b, x0, z0, x1, z1, {
  seamEvery = 1.2, seed = 1, damage = 0, key = 'ductMetal', collide = true,
} = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return;
  const yaw = Math.atan2(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const parts = [], flanges = [];

  // Interior shell: inward-facing box. Slightly dished panels between seams so
  // the sheet is never a perfect plane.
  const nSeg = Math.max(1, Math.round(len / seamEvery));
  for (let i = 0; i < nSeg; i++) {
    const segLen = len / nSeg;
    const t = (i + 0.5) / nSeg;
    const px = lerp(x0, x1, t), pz = lerp(z0, z1, t);
    const shell = hollowBox(SIZE, SIZE, segLen - 0.006, 0.004);
    // Dish the panels a touch.
    const pos = shell.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v), vy = pos.getY(v), vz = pos.getZ(v);
      const s = 1 - Math.abs(vz) / (segLen / 2);
      const k = 0.008 * s;
      pos.setX(v, vx - Math.sign(vx) * k);
      pos.setY(v, vy - Math.sign(vy) * k);
    }
    pos.needsUpdate = true;
    if (damage > 0.4 && hash2(i, seed) < damage) weather(shell, 0.012 * damage, 0.25, seed + i);
    shell.rotateY(yaw);
    shell.translate(px, FLOOR + SIZE / 2, pz);
    parts.push(shell);
  }
  // Transverse joints: a raised flange inside, plus rivets.
  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    const px = lerp(x0, x1, t), pz = lerp(z0, z1, t);
    for (const [w, h, oy, ox] of [
      [SIZE - 0.02, 0.028, -SIZE / 2 + 0.014, 0], [SIZE - 0.02, 0.028, SIZE / 2 - 0.014, 0],
      [0.028, SIZE - 0.06, 0, -SIZE / 2 + 0.014], [0.028, SIZE - 0.06, 0, SIZE / 2 - 0.014],
    ]) {
      const f = box(w, h, 0.030, 0.003, 1);
      f.rotateY(yaw);
      f.translate(px + Math.cos(yaw) * ox, FLOOR + SIZE / 2 + oy, pz - Math.sin(yaw) * ox);
      flanges.push(f);
    }
    for (let k = 0; k < 7; k++) {
      const u = -SIZE / 2 + 0.08 + k * ((SIZE - 0.16) / 6);
      const rv = cyl(0.007, 0.007, 0.010, 5);
      rv.rotateX(Math.PI / 2);
      rv.rotateY(yaw);
      rv.translate(px + Math.cos(yaw) * u, FLOOR + 0.012, pz - Math.sin(yaw) * u);
      flanges.push(rv);
      const rv2 = rv.clone(); rv2.translate(0, SIZE - 0.024, 0);
      flanges.push(rv2);
    }
  }
  // Hanger straps crossing the soffit inside.
  for (let i = 0; i < nSeg; i += 2) {
    const t = (i + 0.5) / nSeg;
    const px = lerp(x0, x1, t), pz = lerp(z0, z1, t);
    const strap = box(SIZE - 0.01, 0.026, 0.05, 0.003, 1);
    strap.rotateY(yaw);
    strap.translate(px, FLOOR + SIZE - 0.014, pz);
    flanges.push(strap);
  }

  const g = merge(parts);
  worldUV(g, 0.42);
  // The inside of a duct is filthy and lit only by the player's lamp: keep the
  // floor well down so a near light source cannot blow the frame to white.
  vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.30 : ny < -0.5 ? 0.56 : 0.42));
  b.add(key, g);
  const fg = merge(flanges);
  worldUV(fg, 0.30);
  vertexShade(fg, () => 0.60);
  b.add('conduitMetal', fg);

  if (collide) {
    const along = Math.abs(Math.sin(yaw)) > 0.7;
    const w = along ? len : SIZE, d = along ? SIZE : len;
    b.addFloor([cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2], FLOOR, { surface: 'metal', tag: 'duct' });
    // Head restraint: forces a crouch for the whole run.
    b.addColliderAt(cx, FLOOR + HEAD + 0.30, cz, w, 0.60, d, { tag: 'ceiling' });
    // Side walls.
    if (along) {
      b.addColliderAt(cx, FLOOR + SIZE / 2, cz - SIZE / 2 - 0.05, len, SIZE, 0.10, { tag: 'wall' });
      b.addColliderAt(cx, FLOOR + SIZE / 2, cz + SIZE / 2 + 0.05, len, SIZE, 0.10, { tag: 'wall' });
    } else {
      b.addColliderAt(cx - SIZE / 2 - 0.05, FLOOR + SIZE / 2, cz, 0.10, SIZE, len, { tag: 'wall' });
      b.addColliderAt(cx + SIZE / 2 + 0.05, FLOOR + SIZE / 2, cz, 0.10, SIZE, len, { tag: 'wall' });
    }
  }
}

/** Mitred elbow with turning vanes at a corner. */
function elbow(b, x, z, fromYaw, toYaw, { seed = 1 } = {}) {
  const parts = [];
  const shell = hollowBox(SIZE + 0.02, SIZE, SIZE + 0.02, 0.004);
  shell.translate(x, FLOOR + SIZE / 2, z);
  parts.push(shell);
  const g = merge(parts);
  worldUV(g, 0.42);
  vertexShade(g, (px, py, pz, nx, ny) => (ny > 0.5 ? 0.40 : ny < -0.5 ? 0.84 : 0.60));
  b.add('ductMetal', g);
  // Turning vanes on the diagonal.
  const vanes = [];
  const bis = (fromYaw + toYaw) / 2 + Math.PI / 4;
  for (let i = 0; i < 4; i++) {
    const o = -0.28 + i * 0.19;
    const v = box(0.012, SIZE - 0.06, 0.20, 0.002, 1);
    v.rotateY(bis);
    v.translate(x + Math.cos(bis) * o, FLOOR + SIZE / 2, z - Math.sin(bis) * o);
    vanes.push(v);
  }
  const vg = merge(vanes); worldUV(vg, 0.3); vertexShade(vg, () => 0.72);
  b.add('conduitMetal', vg);
  b.addFloor([x - SIZE / 2, z - SIZE / 2, x + SIZE / 2, z + SIZE / 2], FLOOR, { surface: 'metal', tag: 'duct' });
  b.addColliderAt(x, FLOOR + HEAD + 0.30, z, SIZE, 0.60, SIZE, { tag: 'ceiling' });
}

/**
 * A grille in the duct wall, and behind it a shallow diorama of a room the
 * player cannot reach. This is the only wide view in the zone.
 */
function window_(b, rig, x, z, yaw, { seed = 1, kind = 'office', decals = null } = {}) {
  const rng = makeRng(seed);
  const nx = Math.sin(yaw), nz = Math.cos(yaw);
  // The grille itself, in the duct wall.
  grille(b, x + nx * (SIZE / 2 - 0.01), FLOOR + SIZE * 0.52, z + nz * (SIZE / 2 - 0.01), {
    w: 0.52, h: 0.42, rotation: yaw, key: 'grilleMetal', blades: 9, recess: 0.04,
  });
  // The room behind: a shallow box, inward facing, with a light in it.
  const D = 3.6, W = 4.4, H = 2.5;
  const cx = x + nx * (SIZE / 2 + D / 2), cz = z + nz * (SIZE / 2 + D / 2);
  const room = hollowBox(yaw % Math.PI === 0 ? W : D, H, yaw % Math.PI === 0 ? D : W, 0.006);
  room.translate(cx, FLOOR - 0.9 + H / 2, cz);
  worldUV(room, 1.2);
  vertexShade(room, (px, py, pz, mx, my) => (my > 0.5 ? 0.42 : my < -0.5 ? 0.66 : 0.55));
  b.add(kind === 'office' ? 'wallpaper' : 'tileWall', room);

  const f = bulkhead(b, rigProxy(rig, b.origin, []), cx, FLOOR - 0.9 + H - 0.22, cz + (yaw % Math.PI === 0 ? 1 : 0) * 1.4, {
    yaw: yaw + Math.PI, circuit: 'duct', health: kind === 'office' ? 'buzz' : 'dying', seed, mount: 'ceiling',
  });

  // A little dressing, seen through louvres, so the room reads as inhabited.
  if (kind === 'office') {
    Props.desk(b, cx, FLOOR - 0.9, cz, { seed: seed + 1, yaw: yaw + Math.PI, w: 1.4, pedestal: 'right' });
    Props.officeChair(b, cx + 0.2, FLOOR - 0.9, cz - nz * 0.9 - nx * 0.0, { seed: seed + 2, yaw: yaw + rng.range(-0.4, 0.4) });
    Props.filingCabinet(b, cx - 1.5, FLOOR - 0.9, cz + 1.0, { seed: seed + 3, yaw: yaw + Math.PI, drawers: 3, damage: 0.4 });
    Props.paperStack(b, cx, FLOOR - 0.9 + 0.73, cz, { seed: seed + 4, spilled: false, sheets: 40 });
  } else if (kind === 'nest') {
    Props.blanketNest(b, cx, FLOOR - 0.9, cz, { seed: seed + 1, yaw: rng() * TAU, r: 1.0 });
    Props.oilDrum(b, cx + 1.3, FLOOR - 0.9, cz + 0.8, { seed: seed + 2, yaw: 0.6, open: true });
    Props.plasticChair(b, cx - 1.2, FLOOR - 0.9, cz - 0.6, { seed: seed + 3, yaw: rng() * TAU });
  } else {
    Props.lockers(b, cx, FLOOR - 0.9, cz + 1.3, { seed: seed + 1, yaw: yaw + Math.PI, n: 4 });
    Props.plasticChair(b, cx - 0.8, FLOOR - 0.9, cz - 0.7, { seed: seed + 2, yaw: rng() * TAU });
    Props.wasteBin(b, cx + 1.5, FLOOR - 0.9, cz - 1.1, { seed: seed + 3, kind: 'mesh', full: 0.5 });
  }
  if (decals) {
    decals.quad(b, {
      stamp: STAMP.grimeCorner, face: 'up', x: cx, y: FLOOR - 0.9 + 0.004, z: cz,
      w: 3.0, h: 3.0, strength: 0.5,
    });
  }
  return f;
}

export function buildDuct(ctx, opts = {}) {
  const { rig, decals } = ctx;
  const seed = opts.seed ?? 4400;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [bMain, bBranch] = makeBuilders(ctx, 'duct', ['main', 'branch']);
  const builders = [bMain, bBranch];
  const fixtures = [];
  const portals = [];

  // =========================================================================
  // the network
  // =========================================================================
  //  A: entry hatch (Intake) --------------------- junction J1
  //  B: J1 -- north branch -- fan housing (dead end, loud)
  //  C: J1 -- east run ------------------- J2 -- down to the Plant grille
  //  D: J2 -- short takeoff to a grille over a stairwell
  const J1 = [-2.0, 0];
  const J2 = [9.6, 0];

  crawl(bMain, -15.0, 0, J1[0] - SIZE / 2, 0, { seed: 1, damage: 0.2 });
  elbow(bMain, J1[0], J1[1], Math.PI / 2, 0, { seed: 2 });
  crawl(bBranch, J1[0], J1[1] + SIZE / 2, J1[0], 9.6, { seed: 3, damage: 0.6 });
  crawl(bMain, J1[0] + SIZE / 2, 0, J2[0] - SIZE / 2, 0, { seed: 4, damage: 0.35 });
  elbow(bMain, J2[0], J2[1], Math.PI / 2, Math.PI, { seed: 5 });
  crawl(bMain, J2[0], J2[1] - SIZE / 2, J2[0], -8.4, { seed: 6, damage: 0.5 });

  // Entry hatch back to Intake — a hinged access panel in the end of the run.
  {
    const b = bMain;
    const cap = box(0.03, SIZE + 0.06, SIZE + 0.06, 0.004, 1);
    cap.translate(-15.05, FLOOR + SIZE / 2, 0);
    worldUV(cap, 0.4); vertexShade(cap, () => 0.6);
    b.add('ductMetal', cap);
    const hatch = box(0.024, SIZE - 0.06, SIZE - 0.06, 0.004, 1);
    hatch.rotateY(-0.7);
    hatch.translate(-14.7, FLOOR + SIZE / 2, -0.32);
    worldUV(hatch, 0.4); vertexShade(hatch, () => 0.7);
    b.add('ductMetal', hatch);
    portals.push(portal('to_intake', 'duct', [-14.4, FLOOR, 0], Math.PI / 2,
      { zone: 'intake', portalId: 'to_duct' }, 'hatch',
      { arrive: [-13.4, FLOOR, 0], arriveYaw: -Math.PI / 2 }));
  }

  // Fan housing at the end of the north branch: the dead end you can hear.
  {
    const b = bBranch;
    const y = FLOOR + SIZE / 2;
    const shellG = hollowBox(1.5, 1.5, 1.5, 0.008);
    shellG.translate(J1[0], FLOOR + 0.75, 10.5);
    worldUV(shellG, 0.6);
    vertexShade(shellG, (px, py, pz, nx, ny) => (ny > 0.4 ? 0.36 : ny < -0.4 ? 0.7 : 0.5));
    b.add('ductMetal', shellG);
    b.addFloor([J1[0] - 0.75, 9.75, J1[0] + 0.75, 11.25], FLOOR, { surface: 'metal', tag: 'duct' });
    b.addColliderAt(J1[0], FLOOR + 1.55, 10.5, 1.5, 0.6, 1.5, { tag: 'ceiling' });
    // The impeller, stopped, behind a mesh guard.
    const hub = cyl(0.11, 0.11, 0.22, 14); hub.rotateX(Math.PI / 2); hub.translate(J1[0], y + 0.12, 11.15);
    const blades = [];
    for (let i = 0; i < 9; i++) {
      const bl = box(0.52, 0.012, 0.14, 0.003, 1);
      bl.rotateY(0.5);
      bl.rotateZ((i / 9) * TAU);
      bl.translate(J1[0], y + 0.12, 11.15);
      blades.push(bl);
    }
    const bg = merge([hub, ...blades]); worldUV(bg, 0.4); vertexShade(bg, () => 0.55);
    b.add('rust', bg);
    const guard = [];
    for (let i = 0; i < 5; i++) {
      const r = new THREE.TorusGeometry(0.09 + i * 0.11, 0.006, 4, 16);
      r.translate(J1[0], y + 0.12, 11.02);
      guard.push(r);
    }
    for (let i = 0; i < 6; i++) {
      const s = box(0.012, 1.02, 0.008, 0.002, 1);
      s.rotateZ((i / 6) * Math.PI);
      s.translate(J1[0], y + 0.12, 11.02);
      guard.push(s);
    }
    const gg = merge(guard); worldUV(gg, 0.3); vertexShade(gg, () => 0.68);
    b.add('grilleMetal', gg);
    if (D) {
      D.label(b, ['SF-3'], {
        face: '-z', x: J1[0] + 0.5, y: FLOOR + 1.2, z: 11.20, w: 0.26, h: 0.12,
        style: 'stencil', size: 40, colour: '#a8a294',
      });
      D.quad(b, { stamp: STAMP.rustRun, face: '-z', x: J1[0], y: FLOOR + 0.9, z: 11.22, w: 0.9, h: 1.2, strength: 1 });
    }
  }

  // Grilles into rooms you cannot reach.
  window_(bMain, rig, -8.4, 0, Math.PI / 2, { seed: 601, kind: 'office', decals: D });
  window_(bBranch, rig, J1[0], 5.6, 0, { seed: 602, kind: 'nest', decals: D });
  window_(bMain, rig, 4.6, 0, -Math.PI / 2, { seed: 603, kind: 'locker', decals: D });

  // The Plant end: a hinged grille that opens into the hall's duct riser.
  {
    const b = bMain;
    const cap = box(SIZE + 0.06, SIZE + 0.06, 0.03, 0.004, 1);
    cap.translate(J2[0], FLOOR + SIZE / 2, -8.45);
    worldUV(cap, 0.4); vertexShade(cap, () => 0.55);
    b.add('ductMetal', cap);
    grille(b, J2[0], FLOOR + SIZE / 2, -8.40, { w: SIZE - 0.10, h: SIZE - 0.10, rotation: Math.PI, blades: 11, recess: 0.05 });
    portals.push(portal('to_plant', 'duct', [J2[0], FLOOR, -8.0], Math.PI,
      { zone: 'plant', portalId: 'to_duct' }, 'hatch',
      { arrive: [J2[0], FLOOR, -7.2], arriveYaw: 0 }));
  }

  // A takeoff too small to enter, and a crushed section that forces a squeeze.
  {
    const b = bMain;
    const t = box(0.26, 0.26, 0.7, 0.006, 1);
    t.translate(1.6, FLOOR + SIZE - 0.20, 0.55);
    worldUV(t, 0.3); vertexShade(t, () => 0.5);
    b.add('ductMetal', t);
    // Crushed section: the shell is dented inward and the crawl narrows.
    const dent = hollowBox(SIZE, SIZE, 1.2, 0.004);
    const pos = dent.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i), vz = pos.getZ(i);
      const s = 1 - Math.abs(vz) / 0.6;
      if (vy > 0) pos.setY(i, vy - s * 0.26);
    }
    pos.needsUpdate = true;
    weather(dent, 0.02, 0.2, 9);
    dent.translate(6.4, FLOOR + SIZE / 2, 0);
    worldUV(dent, 0.42);
    vertexShade(dent, (px, py, pz, nx, ny) => (ny > 0.4 ? 0.34 : 0.7));
    b.add('ductMetal', dent);
    b.addColliderAt(6.4, FLOOR + 0.62 + 0.30, 0, 1.2, 0.6, SIZE, { tag: 'ceiling' });
  }

  // Emergency lighting: two battery units, and nothing else. The lamp is it.
  // ONE battery unit, well down the run. Galvanised sheet 400 mm from your
  // face will blow the frame out from any light closer than that, and the zone
  // is supposed to belong to the lamp.
  {
    const f = emergencyLight(bMain, rigProxy(rig, bMain.origin, fixtures), -6.4, FLOOR + 0.60, SIZE / 2 - 0.03, { yaw: Math.PI, seed: 701 });
    f.intensityScale = 0.35;
  }
  {
    const f = emergencyLight(bBranch, rigProxy(rig, bBranch.origin, fixtures), J1[0] + SIZE / 2 - 0.03, FLOOR + 0.60, 8.4, { yaw: -Math.PI / 2, seed: 702 });
    f.intensityScale = 0.30;
  }

  if (D) {
    // Dust, drag marks and the fact that something has been through here.
    for (let x = -14; x < 9; x += 2.6) {
      D.quad(bMain, {
        stamp: STAMP.dustEdge, face: 'up', x, y: FLOOR + 0.002, z: 0,
        w: SIZE - 0.06, h: 2.2, strength: 0.5,
      });
    }
    D.quad(bMain, { stamp: STAMP.wearPath, face: 'up', x: -6, y: FLOOR + 0.003, z: 0, w: 0.44, h: 16, rot: Math.PI / 2, strength: 1 });
    D.footprints(bMain, [[-13.6, 0.0], [-3.0, 0.0]], { seed: 801, boot: true, y: FLOOR + 0.004, stride: 0.5, spread: 0.10, fade: 3, strength: 0.6 });
    D.quad(bBranch, { stamp: STAMP.mould, face: '+x', x: J1[0] - SIZE / 2 + 0.02, y: FLOOR + 0.4, z: 7.4, w: 1.6, h: 0.7, strength: 1 });
    D.label(bMain, [roomNumber('D', 7)], {
      face: '-z', x: -10.6, y: FLOOR + 0.62, z: SIZE / 2 - 0.03, w: 0.34, h: 0.10,
      style: 'stencil', size: 30, colour: '#b6b0a2',
    });
    D.quad(bMain, { stamp: STAMP.tally, face: '-z', x: 2.4, y: FLOOR + 0.44, z: SIZE / 2 - 0.03, w: 0.9, h: 0.3, strength: 1 });
    D.quad(bMain, { stamp: STAMP.scratchSet, face: 'up', x: 6.4, y: FLOOR + 0.003, z: 0, w: 0.7, h: 1.4, strength: 0.9 });
  }

  // The only loose objects in the whole zone. Both matter.
  Props.paperStack(bMain, -5.2, FLOOR + 0.002, 0.2, { seed: 901, spilled: true, sheets: 9 });
  {
    // A dropped torch, still where it was dropped.
    const b = bMain;
    const t = cyl(0.026, 0.030, 0.17, 10); t.rotateZ(Math.PI / 2); t.rotateY(0.6);
    t.translate(3.4, FLOOR + 0.030, 0.18);
    worldUV(t, 0.25); vertexShade(t, () => 0.8);
    b.add('machinePaint', t);
    const lens = cyl(0.032, 0.032, 0.02, 10); lens.rotateZ(Math.PI / 2); lens.rotateY(0.6);
    lens.translate(3.31, FLOOR + 0.030, 0.13);
    worldUV(lens, 0.2);
    b.add('glassDark', lens);
  }

  const root = new THREE.Group();
  root.name = 'zone:duct';
  const chunks = [];
  for (const b of builders) { const g = b.finish(); chunks.push(g); root.add(g); }

  return {
    root, chunks, builders, portals, interactables: [],
    spawn: [-13.4, FLOOR, 0],
    spawnYaw: -Math.PI / 2,
    fogProfile: 'duct',
    reverb: 'duct',
    ambient: { sky: 0x0c0b0a, ground: 0x100f0e, intensity: 0.07 },
    bounds: new THREE.Box3(
      new THREE.Vector3(-16, FLOOR - 1.2, -10), new THREE.Vector3(12, FLOOR + 2.0, 12)),
  };
}

export default buildDuct;
