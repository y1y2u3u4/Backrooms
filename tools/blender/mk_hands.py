"""
hands_lowpoly.glb — THE ANNEX first-person hands (rebuild).

Why this was rebuilt
--------------------
The first version was two joined blobs: a stack of palm slabs, sausage
fingers off a straight knuckle line, and a plain cylinder for a sleeve. In
frame (docs/captures/verify/01_intake_spine.png) it read as a pale featureless
lump. Three separate causes, all fixed here:

  1. WRONG AXIS. The old asset was authored with the fingers down local -Z in
     Blender. The glTF Y-up flip maps Blender -Z to glTF -Y, so in the engine
     the fingers pointed straight DOWN, out of the bottom of the frame, and
     what the player actually saw was the end cap of the sleeve cylinder.
     src/player/Hands.js builds its procedural hands with the fingers down
     view-space -Z and the back of the hand up +Y, and the POSES table is
     authored for that. This rebuild authors the hand so that AFTER the
     exporter's flip it matches that convention exactly:

         Blender +Y  ->  glTF -Z   fingers (wrist to fingertip)
         Blender +Z  ->  glTF +Y   dorsal (back of the hand)
         Blender -X  ->  glTF -X   thumb side of the RIGHT hand

  2. WRONG MATERIAL SLOT. It shipped `MAT_skin_stylised`, which is not a key
     src/core/Assets.js knows, so it fell through to the unknown-slot branch
     and kept the raw Blender base colour (0.72 linear) — near-white under the
     overlay rig. Everything here uses slots Assets.js already resolves:
     MAT_skin, MAT_bone, MAT_fabric, MAT_rubber.

  3. NO SILHOUETTE. Two objects for two hands. This build is 16 named objects
     per hand — every phalanx of every digit is its own object pivoted on its
     real joint centre, so the engine can curl them, and so the silhouette has
     real knuckle breaks instead of one smooth outline.

Construction
------------
Nothing here is a primitive. Every organic form is a loft of superelliptic
cross-sections along an axis, so there are no 90-degree edges to chamfer on
the skin at all; the only hard edges in the asset are the nail rims and the
cuff hem, and those are bevelled. Shape comes from the section profile:

  * the palm section is not an oval — it carries the thenar and hypothenar
    bulges, the palmar hollow between them, the transverse pad ridge under
    the knuckles, four extensor tendon ridges on the dorsum and four
    metacarpal-head lobes at the knuckle line;
  * every phalanx is widest at its own base (a collar) and narrowest at
    mid-shaft, and the next phalanx's collar overlaps the previous one's
    head — that step is what makes a knuckle read in outline;
  * fingertips round off through the section profile instead of being capped;
  * the fingers splay a few degrees each so the gaps between them open
    toward the tips rather than closing.

Vertex colours carry an analytic occlusion/tint pass (creases at every joint,
the finger webs, the wrist, inside the cuff). src/core/Assets.js only
synthesises white vertex colours when a mesh has none, so a real colour
attribute survives and multiplies the palette material — this is how the
asset gets crease shading with no texture in a project that has no source art.

COORDINATE CONVENTION (Blender, metres)
    origin        = the wrist crease centre of each hand
    +Y            = toward the fingertips
    +Z            = dorsal (back of the hand)
    -X            = thumb / radial side of the RIGHT hand
    joint nodes   = identity local rotation, origin ON the joint centre
    flexion       = NEGATIVE rotation about the node's local X, in Blender and
                    in glTF alike (the two frames share their X axis)
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
import bpy
import bmesh
import json
from mathutils import Vector, Matrix

OUT = "/home/user/Backrooms/public/assets/models/hands_lowpoly.glb"
MANIFEST = "/home/user/Backrooms/public/assets/models/manifest.json"
QA = "/home/user/Backrooms/docs/assets/hands_lowpoly.png"
QA_SIL = "/home/user/Backrooms/docs/assets/hands_silhouette.png"
QA_FP = "/home/user/Backrooms/docs/assets/hands_firstperson.png"
QA_FP_ENGINE = "/home/user/Backrooms/docs/assets/hands_firstperson_enginepose.png"
BACKDROP = "/home/user/Backrooms/docs/captures/final2/04_residence.png"

TAU = math.pi * 2
TRI_BUDGET = 14000
TARGET_LENGTH = 0.300      # cuff back to fingertip; keeps Hands.js' rescale a no-op

# ---------------------------------------------------------------------------
# mirroring: everything is authored as a RIGHT hand and emitted through P()
# ---------------------------------------------------------------------------

_SIGN = 1


def P(v):
    """Canonical (right-hand) point -> emitted point for the side being built."""
    return Vector((v[0] * _SIGN, v[1], v[2]))


# ---------------------------------------------------------------------------
# loft machinery
# ---------------------------------------------------------------------------

def _superellipse(n, power):
    """Closed unit loop in (x, z), index 0 at +X running toward +Z."""
    e = 2.0 / power
    out = []
    for i in range(n):
        a = TAU * i / n
        ca, sa = math.cos(a), math.sin(a)
        out.append((
            math.copysign(abs(ca) ** e, ca),
            math.copysign(abs(sa) ** e, sa),
        ))
    return out


def emit_loft(name, rings, cap_start=True, cap_end=True):
    """Build a mesh object from a list of equal-length rings of canonical points."""
    bm = bmesh.new()
    vrings = []
    for ring in rings:
        vrings.append([bm.verts.new(P(p)) for p in ring])
    n = len(rings[0])
    for i in range(len(vrings) - 1):
        a, b = vrings[i], vrings[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            try:
                bm.faces.new((a[k], a[k2], b[k2], b[k]))
            except ValueError:
                pass
    if cap_start:
        try:
            bm.faces.new(vrings[0][::-1])
        except ValueError:
            pass
    if cap_end:
        try:
            bm.faces.new(vrings[-1])
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return A.mesh_from_bmesh(bm, name)


def frame_of(splay, pitch):
    """Finger frame: splay in the palm plane, then flexion toward the palm."""
    return Matrix.Rotation(splay, 3, 'Z') @ Matrix.Rotation(-pitch, 3, 'X')


def frame_from_dir(direction, dorsal_ref):
    """Frame with +Y along `direction` and +Z as close to `dorsal_ref` as possible."""
    y = Vector(direction).normalized()
    z = (Vector(dorsal_ref) - y * Vector(dorsal_ref).dot(y)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def _interp(profile, u):
    """profile: sorted [(u, a, b), ...] -> linearly interpolated (a, b)."""
    if u <= profile[0][0]:
        return profile[0][1], profile[0][2]
    for i in range(len(profile) - 1):
        u0, a0, b0 = profile[i]
        u1, a1, b1 = profile[i + 1]
        if u <= u1:
            t = (u - u0) / max(1e-9, u1 - u0)
            return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
    return profile[-1][1], profile[-1][2]


# section profiles: (u, width scale, thickness scale)
PHALANX_PROFILE = [
    (-0.20, 0.94, 0.94),
    (0.00, 1.10, 1.10),     # the joint collar — this is the knuckle break
    (0.14, 1.00, 1.00),
    (0.42, 0.955, 0.955),
    (0.68, 0.95, 0.96),
    (0.88, 1.005, 1.02),    # head of the phalanx
    (1.00, 0.925, 0.92),
]

TIP_PROFILE = [
    (-0.20, 0.94, 0.94),
    (0.00, 1.10, 1.10),
    (0.14, 1.00, 1.00),
    (0.40, 0.965, 0.99),
    (0.62, 0.95, 1.02),
    (0.78, 0.885, 0.985),
    (0.90, 0.70, 0.80),
    (0.965, 0.42, 0.50),
    (1.00, 0.15, 0.17),
]

PHALANX_RINGS = (-0.20, 0.0, 0.15, 0.40, 0.66, 0.88, 1.0)
TIP_RINGS = (-0.20, 0.0, 0.15, 0.40, 0.62, 0.78, 0.90, 0.965, 1.0)


def digit_segment(name, origin, frame, length, w0, w1, t0, t1, n=16, tip=False,
                  pad=0.0):
    """
    One phalanx. `origin` is the joint centre (canonical coords), `frame` its
    orientation, `length` the joint-to-joint distance. The loft starts slightly
    behind the joint so the collar wraps the previous segment's head.
    """
    profile = TIP_PROFILE if tip else PHALANX_PROFILE
    us = TIP_RINGS if tip else PHALANX_RINGS
    loop = _superellipse(n, 2.55)
    rings = []
    o = Vector(origin)
    for u in us:
        ws, ts = _interp(profile, u)
        uc = min(1.0, max(0.0, u))
        w = (w0 + (w1 - w0) * uc) * ws
        t = (t0 + (t1 - t0) * uc) * ts
        # palmar pad on the tip segment (the fleshy fingertip)
        padk = 1.0
        if pad and 0.30 < u < 0.92:
            padk = 1.0 + pad * math.sin(math.pi * (u - 0.30) / 0.62)
        ring = []
        for (xu, zu) in loop:
            lx = xu * w * 0.5
            lz = zu * (t * 0.52 if zu > 0 else t * 0.48 * padk)
            ring.append(o + frame @ Vector((lx, u * length, lz)))
        rings.append(ring)
    return emit_loft(name, rings)


def nail_plate(name, origin, frame, length, width, u0, u1, surf_t, n_len=5):
    """
    A nail: a shallow transversely-curved plate lying on the dorsal surface of
    a distal phalanx, sunk far enough in that no gap can open at the rim.
    """
    rings = []
    o = Vector(origin)
    nx = 6
    for i in range(n_len + 1):
        v = i / n_len
        u = u0 + (u1 - u0) * v
        # rounded off at root and tip
        taper = math.sin(math.pi * min(1.0, max(0.0, 0.12 + 0.88 * v))) ** 0.45
        hw = width * 0.5 * (0.62 + 0.38 * taper)
        top = []
        for k in range(nx):
            xr = -1.0 + 2.0 * k / (nx - 1)
            lx = xr * hw
            lz = surf_t * (1.0 - 0.16 * xr * xr) - 0.0004
            top.append(o + frame @ Vector((lx, u * length, lz)))
        bot = []
        for xr in (0.94, -0.94):
            lx = xr * hw
            bot.append(o + frame @ Vector((lx, u * length, surf_t - 0.0030)))
        rings.append(top + bot)
    return emit_loft(name, rings)


# ---------------------------------------------------------------------------
# the palm
# ---------------------------------------------------------------------------

# (y, half-width radial(-X), half-width ulnar(+X), dorsal half-thickness,
#  palmar half-thickness)
PALM_SECTIONS = [
    (-0.0240, 0.0225, 0.0230, 0.0158, 0.0158),
    (-0.0080, 0.0248, 0.0256, 0.0166, 0.0170),
    (0.0080, 0.0278, 0.0288, 0.0170, 0.0180),
    (0.0240, 0.0316, 0.0322, 0.0172, 0.0188),
    (0.0400, 0.0352, 0.0346, 0.0172, 0.0190),
    (0.0560, 0.0378, 0.0366, 0.0168, 0.0186),
    (0.0700, 0.0384, 0.0382, 0.0160, 0.0176),
    (0.0810, 0.0372, 0.0390, 0.0150, 0.0162),
    (0.0900, 0.0348, 0.0378, 0.0140, 0.0148),
    (0.0975, 0.0292, 0.0322, 0.0120, 0.0122),
]

KNUCKLE_X = (-0.0262, -0.0080, 0.0105, 0.0285)
KNUCKLE_Y = (0.0870, 0.0925, 0.0885, 0.0790)


def _bump(v, lo, hi):
    """Smooth 0..1..0 window."""
    if v <= lo or v >= hi:
        return 0.0
    t = (v - lo) / (hi - lo)
    return math.sin(math.pi * t) ** 1.2


def _ramp(v, lo, hi):
    if v <= lo:
        return 0.0
    if v >= hi:
        return 1.0
    t = (v - lo) / (hi - lo)
    return t * t * (3 - 2 * t)


def _palmar_relief(x, y):
    """Positive = the surface moves further palmar (a bulge)."""
    d = 0.0
    # thenar eminence, the mass at the base of the thumb
    d += 0.0092 * math.exp(-((x + 0.0255) / 0.0165) ** 2) * _bump(y, -0.008, 0.070)
    # hypothenar, the ulnar pad
    d += 0.0052 * math.exp(-((x - 0.0295) / 0.0150) ** 2) * _bump(y, -0.004, 0.078)
    # the hollow of the palm between them
    d -= 0.0050 * math.exp(-((x - 0.0015) / 0.0195) ** 2) * _bump(y, 0.016, 0.086)
    # transverse pad ridge just proximal of the knuckles
    d += 0.0042 * _bump(y, 0.062, 0.100) * math.exp(-((x - 0.001) / 0.0300) ** 2)
    return d


def _dorsal_relief(x, y):
    """Positive = the surface moves further dorsal."""
    d = 0.0010 * _bump(y, -0.030, 0.105)
    for kx, ky in zip(KNUCKLE_X, KNUCKLE_Y):
        # metacarpal head
        d += 0.0044 * math.exp(-((x - kx) / 0.0090) ** 2) * _bump(y, ky - 0.026, ky + 0.020)
        # extensor tendon running back from it
        tx = kx * (0.40 + 0.60 * _ramp(y, 0.020, ky))
        amp = 0.0016 * _bump(y, 0.018, ky + 0.004)
        d += amp * math.exp(-((x - tx) / 0.0058) ** 2)
    return d


def build_palm(name, n=28):
    loop = _superellipse(n, 2.7)
    rings = []
    for (y, hwr, hwu, tzd, tzp) in PALM_SECTIONS:
        ring = []
        for (xu, zu) in loop:
            x = xu * (hwr if xu < 0 else hwu)
            wd = max(0.0, zu) ** 0.62
            wp = max(0.0, -zu) ** 0.62
            z = zu * (tzd if zu > 0 else tzp)
            z += wd * _dorsal_relief(x, y)
            z -= wp * _palmar_relief(x, y)
            ring.append(Vector((x, y, z)))
        rings.append(ring)
    return emit_loft(name, rings)


# ---------------------------------------------------------------------------
# the cuff
# ---------------------------------------------------------------------------

def build_cuff(name, back_y, n=24):
    loop = _superellipse(n, 2.35)
    sections = [
        (0.0000, 0.0330, 0.0272),
        (-0.0140, 0.0348, 0.0286),
        (-0.0330, 0.0362, 0.0300),
        (-0.0540, 0.0374, 0.0312),
        (-0.0760, 0.0386, 0.0324),
        (back_y * 0.86, 0.0396, 0.0334),
        (back_y, 0.0392, 0.0330),
    ]
    rings = []
    for (y, hw, ht) in sections:
        ring = []
        for i, (xu, zu) in enumerate(loop):
            a = TAU * i / n
            # slack fabric: a few soft longitudinal folds, drifting along the arm
            fold = (1.0
                    + 0.038 * math.cos(3 * a + 0.55 + y * 6.0)
                    + 0.022 * math.cos(5 * a - 1.30 + y * 4.0))
            ring.append(Vector((xu * hw * fold, y, 0.0015 + zu * ht * fold)))
        rings.append(ring)
    return emit_loft(name, rings)


def build_cuff_hem(name, n=24):
    loop = _superellipse(n, 2.35)
    rings = []
    for (y, hw, ht) in ((0.0040, 0.0322, 0.0266),
                        (0.0010, 0.0344, 0.0284),
                        (-0.0110, 0.0350, 0.0290),
                        (-0.0150, 0.0332, 0.0274)):
        ring = [Vector((xu * hw, y, 0.0015 + zu * ht)) for (xu, zu) in loop]
        rings.append(ring)
    return emit_loft(name, rings)


# ---------------------------------------------------------------------------
# analytic vertex-colour pass
# ---------------------------------------------------------------------------

def _dist_seg(p, a, b):
    ab = b - a
    L2 = ab.dot(ab)
    if L2 < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / L2))
    return (p - (a + ab * t)).length


def paint(obj, creases, tint=None):
    """
    Bake an analytic occlusion/tint pass into a POINT float colour attribute.
    Called while the object's transform is still identity, so mesh coords are
    world coords. `creases` are canonical (right-hand) and mirrored here.
    """
    me = obj.data
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    segs = [(P(a), P(b), r, s) for (a, b, r, s) in creases]
    buf = []
    for v in me.vertices:
        p = v.co
        n = v.normal
        f = 1.0
        for (a, b, r, s) in segs:
            d = _dist_seg(p, a, b)
            if d < r:
                t = 1.0 - d / r
                f *= 1.0 - s * t * t
        # palmar faces sit in their own shadow; dorsal catches the key
        f *= 1.0 - 0.10 * max(0.0, -n.z)
        # everything sinks toward the sleeve
        f *= 1.0 - 0.16 * _ramp(-p.y, 0.004, 0.055)
        r_, g_, b_ = f, f, f
        if tint:
            tr, tg, tb = tint(p, n)
            r_, g_, b_ = f * tr, f * tg, f * tb
        buf.append((min(1.0, r_), min(1.0, g_), min(1.0, b_), 1.0))
    for i, c in enumerate(buf):
        ca.data[i].color = c
    try:
        me.color_attributes.active_color_index = 0
        me.color_attributes.render_color_index = 0
    except Exception:
        pass
    return ca


def skin_tint(p, n):
    """Warmer over the knuckles and the fingertips, cooler over the tendons."""
    warm = 0.0
    for kx, ky in zip(KNUCKLE_X, KNUCKLE_Y):
        warm = max(warm, math.exp(-(((p.x * _SIGN - kx) / 0.011) ** 2
                                    + ((p.y - ky) / 0.016) ** 2)) * max(0.0, n.z))
    warm = min(1.0, warm + 0.55 * _ramp(p.y, 0.120, 0.170))
    return (1.0 + 0.055 * warm, 1.0 - 0.030 * warm, 1.0 - 0.060 * warm)


# ---------------------------------------------------------------------------
# the hand
# ---------------------------------------------------------------------------

FINGERS = [
    # name,   knuckle index, splay deg, phalanx lengths,       width, thick, flexion deg
    ("index",  0, 5.0, (0.0400, 0.0245, 0.0215), 0.0193, 0.0191, (16, 24, 10)),
    ("middle", 1, 1.5, (0.0440, 0.0280, 0.0226), 0.0196, 0.0197, (18, 26, 12)),
    ("ring",   2, -3.0, (0.0410, 0.0262, 0.0212), 0.0183, 0.0185, (20, 28, 12)),
    ("little", 3, -8.0, (0.0322, 0.0196, 0.0182), 0.0159, 0.0161, (25, 32, 14)),
]

THUMB_MCP = Vector((-0.0400, 0.0378, -0.0142))
THUMB_DIRS = (Vector((-0.55, 0.74, -0.38)), Vector((-0.40, 0.64, -0.66)))
THUMB_LENS = (0.0330, 0.0272)
THUMB_DORSAL = Vector((-0.62, 0.10, 0.78))

SEG_KEYS = ("prox", "mid", "dist")
THUMB_KEYS = ("prox", "dist")


def build_hand(side, mats, report):
    """side: +1 right, -1 left. Returns (hand_obj, [all objects], joint table)."""
    global _SIGN
    _SIGN = side
    tag = "R" if side > 0 else "L"
    creases = []
    objs = []
    joints = {}

    # -- palm + thumb metacarpal ---------------------------------------------
    palm = build_palm(f"_palm{tag}")
    meta = None
    mf = frame_from_dir(THUMB_MCP - Vector((-0.0150, 0.0020, -0.0080)), Vector((-0.5, 0, 0.85)))
    mrings = []
    mloop = _superellipse(16, 2.5)
    mstart = Vector((-0.0150, 0.0020, -0.0080))
    mlen = (THUMB_MCP - mstart).length
    for (u, sw, st) in ((0.0, 0.0205, 0.0180), (0.30, 0.0210, 0.0182),
                        (0.62, 0.0198, 0.0172), (0.86, 0.0176, 0.0158),
                        (1.0, 0.0150, 0.0140)):
        ring = [mstart + mf @ Vector((xu * sw, u * mlen, zu * st)) for (xu, zu) in mloop]
        mrings.append(ring)
    meta = emit_loft(f"_thumbMeta{tag}", mrings)
    hand = A.join_objects([palm, meta], f"hand_{tag}")
    A.assign_material(hand, mats["skin"])

    # wrist crease + the palm/finger junction, for the colour pass
    creases.append((Vector((-0.026, -0.001, -0.016)), Vector((0.026, -0.001, -0.016)), 0.010, 0.28))
    creases.append((Vector((-0.030, 0.074, -0.020)), Vector((0.030, 0.070, -0.020)), 0.011, 0.30))

    # -- digits ---------------------------------------------------------------
    digit_objs = {}
    for (fname, ki, splay_deg, lens, w, t, flex) in FINGERS:
        mcp = Vector((KNUCKLE_X[ki], KNUCKLE_Y[ki], (0.0035, 0.0045, 0.0035, 0.0005)[ki]))
        splay = math.radians(splay_deg)
        pitch = 0.0
        origin = mcp
        widths = (w, w * 0.935, w * 0.875, w * 0.80)
        thicks = (t, t * 0.930, t * 0.865, t * 0.80)
        for si in range(3):
            pitch += math.radians(flex[si])
            fr = frame_of(splay, pitch)
            tip = (si == 2)
            nm = f"{fname}_{SEG_KEYS[si]}_{tag}"
            seg = digit_segment(
                nm, origin, fr, lens[si],
                widths[si], widths[si + 1], thicks[si], thicks[si + 1],
                n=16, tip=tip, pad=0.16 if tip else 0.0)
            if tip:
                # nail on the dorsal surface
                surf_t = thicks[si] * 0.52 * 0.99
                nail = nail_plate(f"_nail_{fname}_{tag}", origin, fr, lens[si],
                                  widths[si] * 0.66, 0.20, 0.80, surf_t)
                A.assign_material(seg, mats["skin"])
                A.assign_material(nail, mats["bone"])
                seg = A.join_objects([seg, nail], nm)
            else:
                A.assign_material(seg, mats["skin"])
            # crease ring at the joint at the base of this segment
            across = fr @ Vector((1, 0, 0))
            hw = widths[si] * 0.5
            creases.append((origin - across * hw * 0.9, origin + across * hw * 0.9,
                            0.0072, 0.34 if si else 0.30))
            digit_objs[nm] = seg
            objs.append(seg)
            joints[nm] = (origin.copy(), fr.copy())
            origin = origin + fr @ Vector((0, lens[si], 0))
        # the web/gap between this finger and the next
        if ki < 3:
            nx = KNUCKLE_X[ki + 1]
            mid = Vector(((KNUCKLE_X[ki] + nx) * 0.5, KNUCKLE_Y[ki] - 0.004, 0.0))
            creases.append((mid, mid + Vector(((nx - KNUCKLE_X[ki]) * 0.10, 0.045, -0.014)),
                            0.0085, 0.34))

    # -- thumb ----------------------------------------------------------------
    torigin = THUMB_MCP.copy()
    tw = (0.0216, 0.0198, 0.0166)
    tt = (0.0208, 0.0192, 0.0160)
    for si in range(2):
        fr = frame_from_dir(THUMB_DIRS[si], THUMB_DORSAL)
        tip = (si == 1)
        nm = f"thumb_{THUMB_KEYS[si]}_{tag}"
        seg = digit_segment(nm, torigin, fr, THUMB_LENS[si],
                            tw[si], tw[si + 1], tt[si], tt[si + 1],
                            n=16, tip=tip, pad=0.16 if tip else 0.0)
        if tip:
            surf_t = tt[si] * 0.52 * 0.99
            nail = nail_plate(f"_nail_thumb_{tag}", torigin, fr, THUMB_LENS[si],
                              tw[si] * 0.70, 0.18, 0.78, surf_t)
            A.assign_material(seg, mats["skin"])
            A.assign_material(nail, mats["bone"])
            seg = A.join_objects([seg, nail], nm)
        else:
            A.assign_material(seg, mats["skin"])
        across = fr @ Vector((1, 0, 0))
        creases.append((torigin - across * tw[si] * 0.45, torigin + across * tw[si] * 0.45,
                        0.0080, 0.32))
        digit_objs[nm] = seg
        objs.append(seg)
        joints[nm] = (torigin.copy(), fr.copy())
        torigin = torigin + fr @ Vector((0, THUMB_LENS[si], 0))

    # -- how long is the hand, and therefore how long is the sleeve ----------
    bpy.context.view_layer.update()
    max_y = max((o.matrix_world @ Vector(c)).y
                for o in [hand] + objs for c in o.bound_box)
    cuff_back = max_y - TARGET_LENGTH
    report["fingertip_y"] = round(max_y, 4)
    report["cuff_back_y"] = round(cuff_back, 4)

    cuff = build_cuff(f"_cuff{tag}", cuff_back)
    hem = build_cuff_hem(f"_cuffHem{tag}")
    A.assign_material(cuff, mats["fabric"])
    A.assign_material(hem, mats["rubber"])
    cuff = A.join_objects([cuff, hem], f"cuff_{tag}")
    objs.append(cuff)
    creases.append((Vector((0, -0.004, 0)), Vector((0, 0.004, 0)), 0.045, 0.30))

    # -- surface finishing, UVs, vertex colours -------------------------------
    all_objs = [hand] + objs
    for o in all_objs:
        A.smart_uv(o, angle_limit_deg=62, island_margin=0.02)
    for o in all_objs:
        is_cuff = o.name.startswith("cuff_")
        A.shade_smooth_auto(o, 46)
        # The only hard edges in the asset are the loft cap rims, the nail rims
        # and the cuff hem; an angle-limited bevel picks up exactly those and
        # leaves the smooth organic surfaces alone.
        A.add_bevel(o, 0.0025 if is_cuff else (0.0013 if "dist" in o.name else 0.0020),
                    1, 52)
        A.add_weighted_normal(o)
    for o in all_objs:
        if o.name.startswith("cuff_"):
            paint(o, creases, tint=lambda p, n: (0.98, 1.0, 1.0))
        else:
            paint(o, creases, tint=skin_tint)

    # -- pivots and hierarchy -------------------------------------------------
    A.finalize_pivot(hand, P(Vector((0, 0, 0))))
    A.finalize_pivot(cuff, P(Vector((0, 0, 0))))
    for nm, (origin, fr) in joints.items():
        A.finalize_pivot(digit_objs[nm], P(origin))

    A.parent_keep_transform(cuff, hand)
    for (fname, ki, *_rest) in FINGERS:
        A.parent_keep_transform(digit_objs[f"{fname}_prox_{tag}"], hand)
        A.parent_keep_transform(digit_objs[f"{fname}_mid_{tag}"], digit_objs[f"{fname}_prox_{tag}"])
        A.parent_keep_transform(digit_objs[f"{fname}_dist_{tag}"], digit_objs[f"{fname}_mid_{tag}"])
    A.parent_keep_transform(digit_objs[f"thumb_prox_{tag}"], hand)
    A.parent_keep_transform(digit_objs[f"thumb_dist_{tag}"], digit_objs[f"thumb_prox_{tag}"])

    report.setdefault("joints", {})
    for nm, (origin, fr) in joints.items():
        p = P(origin)
        report["joints"][nm] = [round(p.x, 4), round(p.y, 4), round(p.z, 4)]
    report["digit_objs"] = digit_objs
    return hand, all_objs, digit_objs


# ---------------------------------------------------------------------------
# first-person framing render
# ---------------------------------------------------------------------------

# src/player/Hands.js POSES, view space (+X right, +Y up, -Z forward)
POSES = {
    "engine_idle_R": ([0.310, -0.340, -0.520], [-0.18, -0.24, 0.10], [0.30, 0.32, 0.34, 0.38], 0.25),
    "engine_idle_L": ([-0.330, -0.390, -0.560], [-0.10, 0.30, -0.14], [0.22, 0.24, 0.26, 0.30], 0.18),
    # recommended replacements: the engine values put the wrist well below the
    # bottom of a 52-degree frame (see the report in docs/assets)
    "idle_R": ([0.285, -0.232, -0.455], [-0.10, -0.30, 0.16], [0.30, 0.32, 0.34, 0.38], 0.25),
    "idle_L": ([-0.300, -0.258, -0.480], [-0.05, 0.34, -0.20], [0.22, 0.24, 0.26, 0.30], 0.18),
    "lamp_R": ([0.272, -0.208, -0.425], [-0.02, -0.16, 0.10], [0.86, 0.90, 0.92, 0.94], 0.70),
}

CURL_K = (1.15, 0.95, 0.55)      # proximal, middle, distal
THUMB_K = (0.70, 0.60)


def apply_pose(hand, digit_objs, tag, pose):
    """Put a hand where the engine's overlay camera would see it, and curl it."""
    p, r, curl, thumb = pose
    R = (Matrix.Rotation(r[0], 4, 'X')
         @ Matrix.Rotation(r[1], 4, 'Y')
         @ Matrix.Rotation(r[2], 4, 'Z'))
    # Blender Z-up asset -> glTF/three Y-up is exactly a -90 deg turn about X.
    flip = Matrix.Rotation(math.radians(-90), 4, 'X')
    hand.parent = None
    hand.matrix_world = Matrix.Translation(Vector(p)) @ R @ flip
    for fi, (fname, *_rest) in enumerate(FINGERS):
        for si, key in enumerate(SEG_KEYS):
            o = digit_objs[f"{fname}_{key}_{tag}"]
            o.rotation_euler = (-curl[fi] * CURL_K[si], 0, 0)
    for si, key in enumerate(THUMB_KEYS):
        o = digit_objs[f"thumb_{key}_{tag}"]
        o.rotation_euler = (-thumb * THUMB_K[si], 0, 0)
    bpy.context.view_layer.update()


def render_first_person(out_png, panels, res=(880, 496), backdrop=BACKDROP):
    """
    Render the hands exactly as the engine's overlay camera sees them — a
    52-degree VERTICAL fov (src/core/Engine.js), camera at the origin looking
    down -Z — over a real in-game frame, so the framing test is honest.
    `panels`: list of (label, setup_fn).
    """
    scene = bpy.context.scene
    w, h = res

    cam_data = bpy.data.cameras.new("_FP_cam")
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle_y = math.radians(52.0)
    cam_data.clip_start = 0.01
    cam_data.clip_end = 20.0
    cam = bpy.data.objects.new("_FP_cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 0)
    cam.rotation_euler = (0, 0, 0)
    scene.camera = cam

    temps = [cam]

    # backdrop: a real game frame, filling the 52-degree frame, unlit emission
    if backdrop and os.path.exists(backdrop):
        dist = 4.0
        bh = 2 * dist * math.tan(math.radians(26.0))
        bw = bh * (w / h)
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, -dist))
        plane = bpy.context.active_object
        plane.name = "_FP_backdrop"
        plane.scale = (bw, bh, 1)
        plane.rotation_euler = (0, 0, 0)
        m = bpy.data.materials.new("_FP_backdrop_mat")
        m.use_nodes = True
        nt = m.node_tree
        for nd in list(nt.nodes):
            nt.nodes.remove(nd)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        em = nt.nodes.new("ShaderNodeEmission")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(backdrop)
        em.inputs["Strength"].default_value = 1.0
        nt.links.new(tex.outputs["Color"], em.inputs["Color"])
        nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
        plane.data.materials.append(m)
        temps.append(plane)

    # the overlay rig, as the engine actually builds it: Engine.js overlayKey +
    # overlayFill AND Hands.js' own key/fill/ambient, which sum.
    def sun(name, loc, energy, color, angle_deg=9.0):
        d = bpy.data.lights.new(name, type='SUN')
        d.energy = energy
        d.color = color
        d.angle = math.radians(angle_deg)
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        direction = -Vector(loc)
        o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        temps.append(o)
        return o

    sun("_FP_key", (0.35, 0.55, 0.90), 1.30, (1.0, 0.905, 0.760), 11)
    sun("_FP_key2", (0.40, 0.50, 0.60), 0.26, (1.0, 0.885, 0.730), 14)
    sun("_FP_fill", (-0.80, -0.10, 0.35), 0.16, (0.560, 0.640, 0.755), 22)

    if scene.world is None:
        scene.world = bpy.data.worlds.new("_FP_world")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    prev_bg = None
    if bg:
        prev_bg = (list(bg.inputs[0].default_value), bg.inputs[1].default_value)
        bg.inputs[0].default_value = (0.075, 0.065, 0.045, 1.0)
        bg.inputs[1].default_value = 0.85

    prev_engine = scene.render.engine
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 48
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.06
    scene.eevee.gtao_factor = 1.0
    scene.eevee.use_soft_shadows = True
    scene.eevee.use_bloom = False
    scene.eevee.shadow_cube_size = '1024'
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0

    tmp_dir = os.path.join(os.path.dirname(out_png), "_qa_tmp_fp")
    os.makedirs(tmp_dir, exist_ok=True)
    frames = []
    for i, (label, setup) in enumerate(panels):
        setup()
        fp = os.path.join(tmp_dir, f"fp_{i}_{label}.png")
        scene.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        frames.append(fp)

    scene.render.engine = prev_engine
    if bg and prev_bg:
        bg.inputs[0].default_value = prev_bg[0]
        bg.inputs[1].default_value = prev_bg[1]
    for o in temps:
        bpy.data.objects.remove(o, do_unlink=True)

    if len(frames) == 1:
        import shutil
        shutil.copyfile(frames[0], out_png)
    else:
        A._composite_row(frames, out_png)
    for fp in frames:
        try:
            os.remove(fp)
        except OSError:
            pass
    try:
        os.rmdir(tmp_dir)
    except OSError:
        pass
    print(f"[QA] first-person sheet -> {out_png}")
    return out_png


# ---------------------------------------------------------------------------
# manifest
# ---------------------------------------------------------------------------

def write_manifest(entry):
    with open(MANIFEST, "r", encoding="utf-8") as f:
        data = json.load(f)
    for i, a in enumerate(data["assets"]):
        if a.get("file") == "hands_lowpoly.glb":
            data["assets"][i] = entry
            break
    else:
        data["assets"].append(entry)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"[MANIFEST] updated {MANIFEST}")


# ---------------------------------------------------------------------------

def build():
    A.reset_scene()

    mats = {
        # Slots src/core/Assets.js already resolves. MAT_skin and MAT_bone are
        # PROP_MATERIALS; MAT_fabric maps to the palette's fabric key; MAT_rubber
        # is a near-black PROP_MATERIAL, used for the rolled cuff hem.
        "skin": A.make_material("skin", base_color=(0.33, 0.175, 0.115), roughness=0.72),
        "bone": A.make_material("bone", base_color=(0.50, 0.455, 0.385), roughness=0.46),
        "fabric": A.make_material("fabric", base_color=(0.042, 0.040, 0.030), roughness=0.94),
        "rubber": A.make_material("rubber", base_color=(0.016, 0.016, 0.013), roughness=0.88),
    }

    root = A.new_empty("hands_lowpoly", (0, 0, 0))
    report = {}

    hand_r, objs_r, digits_r = build_hand(1, mats, report)
    hand_l, objs_l, digits_l = build_hand(-1, mats, report)

    A.parent_keep_transform(hand_r, root)
    A.parent_keep_transform(hand_l, root)
    hand_r.location = (0.078, 0, 0)
    hand_l.location = (-0.078, 0, 0)
    bpy.context.view_layer.update()

    all_meshes = objs_r + objs_l
    tris = A.report_and_assert_tris(all_meshes, TRI_BUDGET, "hands_lowpoly (pair)")
    A.print_hierarchy(root)

    bbox = A.bbox_metres(all_meshes)
    one = A.bbox_metres(objs_r)
    print(f"[BBOX] pair {bbox}   one hand {one}")

    A.export_glb(OUT, [root])

    # ---- QA renders (after export; these mutate transforms) -----------------
    root.rotation_euler = (math.radians(90), 0, 0)   # dorsal toward the QA "front"
    bpy.context.view_layer.update()
    A.render_turntable(all_meshes, QA, res=560)
    A.render_silhouette(all_meshes, QA_SIL, res=440, view_angle=(0.55, -0.86, 0.28))
    root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    def panel(pose_r, pose_l):
        def go():
            apply_pose(hand_r, digits_r, "R", POSES[pose_r])
            apply_pose(hand_l, digits_l, "L", POSES[pose_l])
        return go

    render_first_person(QA_FP, [
        ("idle", panel("idle_R", "idle_L")),
        ("lamp", panel("lamp_R", "idle_L")),
    ])
    render_first_person(QA_FP_ENGINE, [
        ("engine", panel("engine_idle_R", "engine_idle_L")),
    ])

    # ---- manifest -----------------------------------------------------------
    def gltf(p):
        """Blender (x, y, z) -> glTF (x, z, -y)."""
        return [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]

    sub = [
        {"name": "hand_R", "purpose": "right palm + metacarpus + thenar mass; the hand root",
         "material": "MAT_skin", "pivotGltf": [0, 0, 0]},
        {"name": "cuff_R", "purpose": "jacket sleeve cuff with rolled hem; static, child of hand_R",
         "material": "MAT_fabric + MAT_rubber (hem)", "pivotGltf": [0, 0, 0]},
    ]
    order = []
    for (fname, *_r) in FINGERS:
        order += [f"{fname}_{k}" for k in SEG_KEYS]
    order += ["thumb_prox", "thumb_dist"]
    for nm in order:
        j = report["joints"][f"{nm}_R"]
        parent = ("hand_R" if nm.endswith("_prox") else
                  nm.replace("_mid", "_prox").replace("_dist", "_mid") + "_R")
        sub.append({
            "name": f"{nm}_R",
            "purpose": f"{nm.replace('_', ' ')} phalanx, pivot on the joint centre, parent {parent}",
            "material": "MAT_skin" + (" + MAT_bone (nail)" if nm.endswith("_dist") else ""),
            "pivotGltf": gltf(j),
        })

    entry = {
        "file": "hands_lowpoly.glb",
        "tier": 1,
        "description": ("First-person hands. 16 named objects per hand — every phalanx of every "
                        "digit is its own object pivoted on its real joint centre, so the engine "
                        "curls them procedurally. Exported fully extended is NOT the rest pose: a "
                        "relaxed curl is baked into the geometry, so rotation 0 on every joint is "
                        "already a natural hand."),
        "triangles": tris,
        "triBudget": TRI_BUDGET,
        "boundingBoxMetres": bbox,
        "oneHandBoundingBoxMetres": one,
        "pivot": ("EACH hand's own local origin is its WRIST CREASE CENTRE. Axes in glTF space: "
                  "-Z from wrist toward the fingertips, +Y dorsal (back of the hand), -X the thumb "
                  "side of the RIGHT hand. This matches the convention src/player/Hands.js builds "
                  "its procedural hands with, which the previous export did NOT (it pointed the "
                  "fingers down glTF -Y). hand_L/hand_R are exported at x = -0.078/+0.078 for the "
                  "contact sheet only; Hands.js zeroes the node transform anyway."),
        "animation": {
            "restPose": ("A relaxed loose curl is baked into the mesh. Every joint node has "
                         "identity local rotation, so the asset reads as a hand with no animation "
                         "at all."),
            "flexion": ("NEGATIVE rotation about a joint node's local X flexes it toward the palm. "
                        "Positive extends it. This is the same sign in Blender and in glTF because "
                        "the two frames share their X axis. Suggested gains from the engine's 0..1 "
                        "curl: proximal 1.15, middle 0.95, distal 0.55 rad; thumb 0.70 / 0.60."),
            "spread": ("Abduction is rotation about local Z (Blender) / local Y (glTF). The sign "
                       "flips between hands; flexion does not."),
            "scale": (f"One hand measures exactly {TARGET_LENGTH:.3f} m along glTF Z (cuff back to "
                      "fingertip), so the 0.30/longest normalisation in Hands.loadModel() is a "
                      "no-op. Removing that normalisation would be better than relying on it."),
        },
        "suggestedPalette": {
            "MAT_skin": "PROP_MATERIALS.MAT_skin in src/core/Assets.js (already present)",
            "MAT_bone": "PROP_MATERIALS.MAT_bone — fingernails",
            "MAT_fabric": "fabric (Palette.js) — the jacket cuff",
            "MAT_rubber": "PROP_MATERIALS.MAT_rubber — the rolled cuff hem, near black",
        },
        "vertexColours": ("A POINT float colour attribute carries an analytic occlusion/tint pass: "
                          "creases at every joint, the finger webs, the wrist, inside the cuff, "
                          "plus warmer knuckles and fingertips. Assets._remat() only synthesises "
                          "white vertex colours when a mesh has none, so this survives and "
                          "multiplies the palette material. There are no textures."),
        "qa": {
            "turntable": "docs/assets/hands_lowpoly.png",
            "silhouette": "docs/assets/hands_silhouette.png",
            "firstPerson": ("docs/assets/hands_firstperson.png — the engine's overlay camera "
                            "(52 deg vertical fov, origin, looking down -Z) over a real in-game "
                            "frame, at the recommended poses"),
            "firstPersonEnginePose": ("docs/assets/hands_firstperson_enginepose.png — the same, at "
                                      "the POSES values currently in src/player/Hands.js, which "
                                      "put the wrist below the bottom of the frame"),
        },
    }
    write_manifest(entry)
    return tris


if __name__ == "__main__":
    build()
