import * as THREE from 'three';
import { KIT, floorSlab, wallRun, doorway, outlet, smokeDetector } from '../Kit.js';
import {
  makeBuilders, rigProxy, portal, pendant, emergencyLight,
} from '../ZoneKit.js';
import { STAMP, roomNumber } from '../Decals.js';
import * as Props from '../Props.js';
import { makeRng, clamp01, lerp, hash2, TAU } from '../../core/util.js';
import { box, cyl, merge, worldUV, vertexShade } from '../../render/geo.js';

/**
 * THE OFFICE OF RECORD — the safe room, probably.
 *
 * Small, warm, low, and the only room in the Annex where the light is a lamp
 * rather than a fitting. A desk, a chair, a kettle that works, a radio that
 * works, and thirty years of carbon-copy discrepancy forms filed in date order
 * by somebody who never stopped.
 *
 * Safety here is PROVISIONAL, and the room says so without a line of text: one
 * thing is different every time the player comes back. The chair is facing the
 * door. There are two cups. A drawer that was shut is open. A form has been
 * filled in, and the name on it is the player's. Nothing ever moves while they
 * are watching, and nothing is ever explained.
 */

const CEIL = 2.55;
const X0 = -2.7, X1 = 2.7, Z0 = -2.3, Z1 = 2.5;

/** Counts how many times this room has been built or re-entered this session. */
let visits = 0;

export function buildSafeRoom(ctx, opts = {}) {
  const { rig, bus, decals } = ctx;
  const seed = opts.seed ?? 1010;
  const rng = makeRng(seed);
  const D = decals || ctx.world?.decals;

  const [b] = makeBuilders(ctx, 'safe', ['room']);
  const variantBuilders = makeBuilders(ctx, 'safe', ['v0', 'v1', 'v2', 'v3', 'v4', 'v5']);
  const builders = [b, ...variantBuilders];
  const fixtures = [];
  const rigFor = (bb) => rigProxy(rig, bb.origin, fixtures);
  const portals = [];
  const interactables = [];

  // =========================================================================
  // shell
  // =========================================================================
  floorSlab(b, [X0, Z0, X1, Z1], 0, { key: 'carpet', surface: 'carpet', subdiv: 1.6, edgeShade: 0.22 });
  {
    const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 3, 3);
    g.rotateX(Math.PI / 2);
    g.translate((X0 + X1) / 2, CEIL, (Z0 + Z1) / 2);
    worldUV(g, 1.4);
    vertexShade(g, () => 0.72);
    b.add('plaster', g);
    b.addColliderAt((X0 + X1) / 2, CEIL + 0.3, (Z0 + Z1) / 2, X1 - X0, 0.6, Z1 - Z0, { tag: 'ceiling' });
  }
  const sides = [
    [X0, Z0, X1, Z0, [{ at: (X1 - X0) / 2 + 0.6, width: 0.96, height: 2.02 }]],
    [X1, Z0, X1, Z1, []],
    [X1, Z1, X0, Z1, []],
    [X0, Z1, X0, Z0, []],
  ];
  for (const [ax, az, bx, bz, ops] of sides) {
    wallRun(b, ax, az, bx, bz, {
      height: CEIL, key: 'damask', skirtKey: 'trim', angleKey: 'trim',
      openings: ops, seed: seed + ax * 5 + az, perimeterAngle: false,
    });
  }
  // Picture rail and a dado, as in the Residence — the two rooms were fitted
  // out by the same contractor, which is the only clue that they connect.
  {
    const parts = [];
    for (const [ax, az, bx, bz, s] of [
      [X0, Z0, X1, Z0, -1], [X1, Z1, X0, Z1, -1], [X1, Z0, X1, Z1, -1], [X0, Z1, X0, Z0, -1],
    ]) {
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      for (const [h, th] of [[0.94, 0.055], [CEIL - 0.26, 0.034]]) {
        const g = box(0.028, th, len, 0.004, 1);
        g.rotateY(yaw);
        g.translate((ax + bx) / 2 + Math.cos(yaw) * s * 0.092, h, (az + bz) / 2 - Math.sin(yaw) * s * 0.092);
        parts.push(g);
      }
    }
    const g = merge(parts); worldUV(g, 0.45); vertexShade(g, () => 0.86);
    b.add('trim', g);
  }

  doorway(b, 0.6, 0, Z0, { rotation: 0, width: 0.94, height: 2.00, open: 0, hinge: 1, seed: 21, glazed: true });
  portals.push(portal('to_service', 'safe', [0.6, 0, Z0 + 0.4], Math.PI,
    { zone: 'service', portalId: 'to_safe' }, 'door',
    { arrive: [0.6, 0, Z0 + 1.3], arriveYaw: Math.PI }));

  // =========================================================================
  // fittings
  // =========================================================================
  const deskX = -0.75, deskZ = Z1 - 0.75;
  Props.desk(b, deskX, 0, deskZ, { seed: 31, yaw: Math.PI, w: 1.55, d: 0.72, pedestal: 'right', damage: 0.15 });
  const lamp = Props.deskLamp(b, deskX - 0.55, 0.73, deskZ + 0.10, { seed: 32, yaw: -0.6 });
  Props.paperStack(b, deskX + 0.35, 0.735, deskZ - 0.02, { seed: 33, sheets: 70 });
  Props.paperStack(b, deskX + 0.05, 0.735, deskZ + 0.16, { seed: 34, sheets: 22, w: 0.21, d: 0.297 });
  Props.wallClock(b, deskX, 1.92, Z1 - 0.10, { seed: 35, yaw: Math.PI, handsAt: [3, 47], r: 0.135 });

  // Filed carbon copies: two runs of shelving, box files in date order.
  Props.shelving(b, X0 + 0.28, 0, 0.9, { seed: 41, yaw: Math.PI / 2, w: 1.9, h: 2.05, bays: 5, contents: 1.0, damage: 0.1 });
  Props.filingCabinet(b, X1 - 0.35, 0, Z1 - 0.55, { seed: 42, yaw: -Math.PI / 2, drawers: 4, damage: 0.1 });
  Props.filingCabinet(b, X1 - 0.35, 0, Z1 - 1.25, { seed: 43, yaw: -Math.PI / 2, drawers: 4, damage: 0.05 });

  // A side table with the kettle, and a small heater under it.
  Props.bedsideTable(b, X1 - 0.55, 0, -1.35, { seed: 44, yaw: -Math.PI / 2, w: 0.62, d: 0.42, h: 0.72 });
  Props.kettle(b, X1 - 0.55, 0.72, -1.5, { seed: 45, yaw: 0.4 });
  Props.radiator(b, -1.9, 0, Z0 + 0.10, { seed: 46, yaw: 0, w: 0.75, h: 0.50 });
  Props.coatHooks(b, 2.0, 1.68, Z0 + 0.06, { seed: 47, yaw: 0, w: 0.55, coats: 1.0 });
  Props.noticeboard(b, 1.55, 1.45, Z1 - 0.06, { seed: 48, yaw: Math.PI, w: 0.9, h: 0.66, sheets: 9 });
  Props.wasteBin(b, X0 + 0.45, 0, Z0 + 0.55, { seed: 49, kind: 'mesh', full: 0.35 });
  outlet(b, X1 - 0.10, 0.26, -1.9, { rotation: -Math.PI / 2 });
  smokeDetector(b, 0.4, CEIL - 0.014, 0.2, 'plasticWhite');

  // LIGHT.
  //
  // This room used to have one pendant and a desk lamp for 5.4 x 4.8 m, and a
  // continuous playthrough caught it reporting ZERO active lights at points —
  // the one room in the game whose entire purpose is to be the place that is
  // safe. A safe room that goes dark is not atmospheric, it is the promise the
  // whole design makes to the player being broken.
  //
  // Three pendants on the 'safe' circuit, plus the desk lamp, plus an emergency
  // light on the always-powered 'emergency' circuit so that even a total loss of
  // the room's own supply leaves something burning. intensityScale is up because
  // a 17 cd domestic pendant is sized for a bedroom, and this is a room the
  // player arrives at needing to read documents in.
  for (const [px, pz, sd] of [[0.2, -0.2, 51], [-1.75, 1.35, 151], [1.9, 1.5, 152]]) {
    pendant(b, rigFor(b), px, CEIL - 0.02, pz, {
      circuit: 'safe', health: 'good', seed: sd, drop: 0.30, shade: 'globe',
      intensityScale: 1.9,
    });
  }
  const lampFix = rigFor(b).add({
    type: 'pendant', position: [lamp.bulb[0], lamp.bulb[1], lamp.bulb[2]],
    circuit: 'safe', health: 'good', seed: 52, intensityScale: 0.85,
  });
  lampFix.target.position.set(0.4, -1.2, -0.6);
  // Explicitly on 'emergency', which LightRig registers powered at construction
  // and no breaker in the game can switch off.
  emergencyLight(b, rigFor(b), X0 + 0.12, 2.20, Z0 + 1.0, { yaw: Math.PI / 2, seed: 53, circuit: 'emergency' });

  if (D) {
    D.roomPlate(b, 0.6, 2.24, Z0 + 0.10, 0, roomNumber('O', 1), 'OFFICE OF RECORD');
    D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: 0.2, y: 0.004, z: 0.4, w: 1.0, h: 3.6, strength: 0.9 });
    D.quad(b, { stamp: STAMP.wearPath, face: 'up', x: deskX, y: 0.004, z: deskZ - 0.7, w: 1.3, h: 1.0, strength: 0.7 });
    D.wallBase(b, X0 + 0.2, Z1 - 0.03, X1 - 0.2, Z1 - 0.03, { amount: 0.2, seed: 61, face: '-z' });
    D.quad(b, { stamp: STAMP.tapeResidue, face: '-z', x: -2.0, y: 1.55, z: Z1 - 0.04, w: 0.32, h: 0.42, strength: 0.7 });
    D.label(b, ['DISCREPANCY', 'RETURNS 1988-'], {
      face: '+x', x: X0 + 0.06, y: 1.95, z: 0.9, w: 0.42, h: 0.20, style: 'paper', size: 24,
    });
    D.label(b, ['DO NOT REMOVE', 'FILES FROM THIS', 'ROOM'], {
      face: '-z', x: 1.55, y: 1.92, z: Z1 - 0.05, w: 0.26, h: 0.20, style: 'paper', size: 20,
    });
  }

  // =========================================================================
  // the thing that changes
  // =========================================================================
  // Each variant is built into its own chunk and toggled. Nothing ever moves
  // while the player is in the room; it is different when they come back.
  const chairHome = [deskX + 0.15, 0, deskZ - 0.85];
  const V = variantBuilders;

  // 0 — the chair is where it was left.
  Props.officeChair(V[0], chairHome[0], 0, chairHome[2], { seed: 70, yaw: Math.PI + 0.25 });

  // 1 — the chair has been turned to face the door.
  Props.officeChair(V[1], chairHome[0] + 0.1, 0, chairHome[2] - 0.35, {
    seed: 71, yaw: Math.atan2(0.6 - chairHome[0], Z0 - chairHome[2]),
  });

  // 2 — there are two cups.
  Props.officeChair(V[2], chairHome[0], 0, chairHome[2], { seed: 72, yaw: Math.PI - 0.4 });
  for (const [cx, cz] of [[deskX + 0.62, deskZ + 0.18], [deskX + 0.80, deskZ + 0.02]]) {
    const cup = cyl(0.038, 0.031, 0.085, 12); cup.translate(cx, 0.775, cz);
    const saucer = cyl(0.065, 0.062, 0.008, 14); saucer.translate(cx, 0.736, cz);
    const g = merge([cup, saucer]); worldUV(g, 0.2); vertexShade(g, () => 0.95);
    V[2].add('enamel', g);
  }

  // 3 — a drawer that was shut is open, and the file in it has your name on it.
  Props.officeChair(V[3], chairHome[0] - 0.2, 0, chairHome[2] + 0.1, { seed: 73, yaw: Math.PI + 0.9 });
  Props.filingCabinet(V[3], X1 - 0.35, 0, Z1 - 0.55, { seed: 74, yaw: -Math.PI / 2, drawers: 4, damage: 0 });
  if (D) {
    D.label(V[3], ['DISCREPANCY', 'RETURN 4471'], {
      face: '-x', x: X1 - 0.72, y: 0.86, z: Z1 - 0.55, w: 0.22, h: 0.15, style: 'paper', size: 18,
    });
  }

  // 4 — the kettle has boiled and been moved, and the radio is on.
  Props.officeChair(V[4], chairHome[0], 0, chairHome[2], { seed: 75, yaw: Math.PI + 0.1 });
  Props.kettle(V[4], deskX + 0.62, 0.735, deskZ + 0.14, { seed: 76, yaw: 2.2 });
  Props.radio(V[4], X1 - 0.55, 0.72, -1.05, { seed: 77, yaw: -Math.PI / 2 + 0.3, on: true });
  {
    const dial = box(0.05, 0.03, 0.004, 0.001, 1);
    dial.rotateY(-Math.PI / 2 + 0.3);
    dial.translate(X1 - 0.60, 0.82, -1.0);
    V[4].add('stackGlow', dial, () => V[4].materials.emissive(0x8fffb6, 0.7));
  }

  // 5 — the chair is gone, and there are wet footprints that start in the room.
  if (D) {
    D.footprints(V[5], [[0.2, Z1 - 1.4], [0.2, Z0 + 0.6]], {
      seed: 78, boot: true, y: 0.006, fade: 1.0, strength: 0.85,
    });
    D.quad(V[5], { stamp: STAMP.puddle, face: 'up', x: 0.2, y: 0.004, z: Z1 - 1.6, w: 0.8, h: 0.7, strength: 0.8 });
  }
  Props.radio(V[5], deskX + 0.55, 0.735, deskZ + 0.10, { seed: 79, yaw: 1.1 });

  // =========================================================================
  // gameplay
  //
  // The terminal is the only one in the game. Its authorisation code is the
  // open-day date written as four figures and reversed — 3 December, 0312, 2130 —
  // which is stated in Kearns' last notebook page and nowhere else, so the last
  // page is on this desk. Solving it is a discovery, not a gate: nothing on the
  // critical path needs it.
  // =========================================================================
  interactables.push(
    {
      kind: 'terminal', id: 'terminal_record', rotation: Math.PI,
      position: [deskX + 0.42, 0.735, deskZ - 0.18], puzzleCode: '2130', hintNote: 'nb_5',
    },
    { kind: 'pickup', item: 'note', noteId: 'nb_5', position: [deskX - 0.30, 0.74, deskZ - 0.28], rotation: -0.25 },
    { kind: 'pickup', item: 'note', noteId: 'note_office_of_record', position: [deskX + 0.05, 0.74, deskZ + 0.16], rotation: 0.3 },
    { kind: 'pickup', item: 'note', noteId: 'note_daywork_1102', position: [X0 + 0.28, 1.04, 0.9], rotation: 0.1 },
    { kind: 'pickup', item: 'note', noteId: 'note_12d_filled', position: [X0 + 0.28, 1.44, 0.9], rotation: -0.2 },
    { kind: 'pickup', item: 'cassette', tapeId: 'tape_kearns_1', position: [X1 - 0.55, 0.74, -1.15], rotation: 0.7 },
    { kind: 'pickup', item: 'battery_cell', position: [X1 - 0.55, 0.74, -1.7], rotation: 1.3 },
  );

  // =========================================================================
  // finish
  // =========================================================================
  const root = new THREE.Group();
  root.name = 'zone:safe';
  const chunks = [];
  const g0 = b.finish(); chunks.push(g0); root.add(g0);
  const variants = [];
  for (const vb of V) {
    const g = vb.finish();
    g.visible = false;
    variants.push(g);
    root.add(g);
  }

  const pick = () => {
    const i = visits % variants.length;
    variants.forEach((g, k) => { g.visible = k === i; });
    visits++;
    return i;
  };
  pick();

  const off = bus?.on('zone:enter', (e) => { if (e?.zone === 'safe') pick(); });

  return {
    root, chunks, builders, portals, interactables,
    spawn: [0.6, 0, Z0 + 1.3],
    spawnYaw: Math.PI,
    // The Director's respawn point. Nothing has ever come in here.
    safe: { id: 'office_of_record', position: [0.2, 0, 0.6], yaw: Math.PI },
    fogProfile: 'safe',
    reverb: 'safe',
    ambient: { sky: 0x2a2116, ground: 0x4a3a20, intensity: 0.46 },
    variants,
    nextVariant: pick,
    dispose() { off?.(); },
    bounds: new THREE.Box3(new THREE.Vector3(X0, 0, Z0), new THREE.Vector3(X1, CEIL, Z1)),
  };
}

export default buildSafeRoom;
