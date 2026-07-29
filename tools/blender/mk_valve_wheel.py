"""
valve_wheel.glb — 0.42m corroded cast-iron gate valve on a pipe stub.
`wheel` is a separate object rotating on the stem axis. Spoked wheel with a
cast profile, hex stem nut, bonnet bolts, flanges.

COORDINATE CONVENTION: root pivot sits on the PIPE CENTRELINE (x=0 mid-length
along the pipe run, y=0, z=0) so the game can slot this straight into a
pipeRun. Pipe runs along local X.
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
import bmesh
from mathutils import Vector

OUT = "/home/user/Backrooms/public/assets/models/valve_wheel.glb"
QA = "/home/user/Backrooms/docs/assets/valve_wheel.png"


def build():
    A.reset_scene()

    mat_iron = A.make_material("cast_iron_corroded", base_color=(0.22, 0.19, 0.17), roughness=0.8, metallic=0.35)
    mat_rust = A.make_material("rust_streak", base_color=(0.32, 0.17, 0.08), roughness=0.9, metallic=0.1)
    mat_steel_stem = A.make_material("steel_stem", base_color=(0.35, 0.35, 0.36), roughness=0.4, metallic=0.85)
    mat_pipe = A.make_material("pipe_steel", base_color=(0.24, 0.24, 0.24), roughness=0.7, metallic=0.5)

    root = A.new_empty("valve_wheel", (0, 0, 0))

    # -- flow body (lathed about Z, then laid on its side along X) -----------
    body_profile = [
        (0.0, -0.085), (0.112, -0.085), (0.112, -0.076), (0.072, -0.067),
        (0.09, -0.032), (0.09, 0.032), (0.072, 0.067),
        (0.112, 0.076), (0.112, 0.085), (0.0, 0.085),
    ]
    flow_body = A.lathe_profile("FlowBody", body_profile, segments=20)
    flow_body.rotation_euler = (0, math.pi / 2, 0)
    A.apply_transforms(flow_body, loc=False, rot=True, scale=False)
    A.assign_material(flow_body, mat_iron)
    A.finish_round_surface(flow_body)

    # -- pipe stubs each side, with an end flange -----------------------------
    stub_len = 0.11
    pipe_r = 0.048
    stubs = []
    for side in (-1, 1):
        x0 = side * (0.085 + stub_len / 2)
        stub = A.prim_cylinder(f"_stub{side}", pipe_r, stub_len, segments=16, location=(x0, 0, 0))
        stub.rotation_euler = (0, math.pi / 2, 0)
        A.apply_transforms(stub, loc=False, rot=True, scale=False)
        stubs.append(stub)
        flange = A.prim_cylinder(f"_stubflange{side}", pipe_r * 1.5, 0.014, segments=16,
                                  location=(side * (0.085 + stub_len - 0.007), 0, 0))
        flange.rotation_euler = (0, math.pi / 2, 0)
        A.apply_transforms(flange, loc=False, rot=True, scale=False)
        stubs.append(flange)
    pipe_obj = A.join_objects(stubs, "PipeStubs")
    A.assign_material(pipe_obj, mat_pipe)
    A.finish_round_surface(pipe_obj)

    # -- bonnet (lathed about Z, stays vertical) on top of the flow body -------
    bonnet_profile = [
        (0.058, 0.032), (0.072, 0.038), (0.072, 0.048), (0.052, 0.058),
        (0.040, 0.088), (0.030, 0.104), (0.024, 0.112), (0.024, 0.128),
        (0.0, 0.128),
    ]
    bonnet = A.lathe_profile("Bonnet", bonnet_profile, segments=20, location=(0, 0, 0))
    A.assign_material(bonnet, mat_iron)
    A.finish_round_surface(bonnet)

    # bonnet bolts ring
    bolts = []
    n_bolts = 8
    for i in range(n_bolts):
        ang = 2 * math.pi * i / n_bolts
        bx = 0.065 * math.cos(ang)
        by = 0.065 * math.sin(ang)
        b = A.prim_cylinder(f"_bolt{i}", 0.007, 0.016, segments=6, location=(bx, by, 0.040))
        bolts.append(b)
    bolt_obj = A.join_objects(bolts, "BonnetBolts")
    A.assign_material(bolt_obj, mat_steel_stem)
    A.finish_round_surface(bolt_obj)

    # -- stem ------------------------------------------------------------------
    stem_top = 0.205
    stem = A.prim_cylinder("Stem", 0.010, stem_top - 0.128, segments=12, location=(0, 0, (stem_top + 0.128) / 2))
    A.assign_material(stem, mat_steel_stem)
    A.finish_round_surface(stem)

    # -- wheel (separate pivoting object) ---------------------------------------
    wheel_r = 0.125
    hub_r = 0.024
    n_spokes = 5
    bm = bmesh.new()
    # rim: lathe a small torus-like rim profile using our lathe helper about Z,
    # but since lathe_profile revolves (radius, z) about Z with a flat disk
    # cross-section, build the rim cross-section as a small revolved ring by
    # sweeping a circular profile around the wheel radius manually.
    rim_ring_segs = 28
    rim_tube_segs = 8
    rim_tube_r = 0.016
    rings = []
    for i in range(rim_ring_segs):
        ang = 2 * math.pi * i / rim_ring_segs
        cx, cy = wheel_r * math.cos(ang), wheel_r * math.sin(ang)
        tangent = Vector((-math.sin(ang), math.cos(ang), 0))
        radial = Vector((math.cos(ang), math.sin(ang), 0))
        up = Vector((0, 0, 1))
        ring = []
        for k in range(rim_tube_segs):
            a2 = 2 * math.pi * k / rim_tube_segs
            off = radial * (rim_tube_r * math.cos(a2)) + up * (rim_tube_r * math.sin(a2))
            ring.append(bm.verts.new((cx + off.x, cy + off.y, off.z)))
        rings.append(ring)
    for i in range(rim_ring_segs):
        ra, rb = rings[i], rings[(i + 1) % rim_ring_segs]
        for k in range(rim_tube_segs):
            k2 = (k + 1) % rim_tube_segs
            bm.faces.new((ra[k], ra[k2], rb[k2], rb[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rim = A.mesh_from_bmesh(bm, "_rim")

    hub = A.prim_cylinder("_hub", hub_r, 0.05, segments=16, location=(0, 0, 0))
    # hex nut on top of the hub
    hex_pts = [(0.017 * math.cos(math.radians(60 * i)), 0.017 * math.sin(math.radians(60 * i))) for i in range(6)]
    hex_nut = A.extrude_profile_along_z("_hexnut", hex_pts, 0.02, location=(0, 0, 0.032))

    spokes = []
    for i in range(n_spokes):
        ang = 2 * math.pi * i / n_spokes
        length = wheel_r - hub_r - 0.01
        mid_r = hub_r + length / 2 + 0.005
        sx, sy = mid_r * math.cos(ang), mid_r * math.sin(ang)
        spoke = A.prim_box(f"_spoke{i}", length, 0.022, 0.016, location=(0, 0, 0))
        spoke.rotation_euler = (0, 0, ang)
        A.apply_transforms(spoke, loc=False, rot=True, scale=False)
        spoke.location = (sx, sy, 0)
        spokes.append(spoke)

    wheel = A.join_objects([rim, hub, hex_nut] + spokes, "wheel")
    A.assign_material(wheel, mat_iron)
    A.finish_hero_surface(wheel, bevel_width=0.0025, bevel_segments=1)
    # The wheel was authored centred on its own hub axis at the local origin,
    # which IS its rotation pivot — just place it at the top of the stem.
    wheel.location = (0, 0, stem_top)

    # -- assemble ---------------------------------------------------------------
    for o in (flow_body, pipe_obj, bonnet, bolt_obj, stem):
        A.parent_keep_transform(o, root)
    A.parent_keep_transform(wheel, root)

    for o in (flow_body, pipe_obj, bonnet, bolt_obj, stem, wheel):
        A.smart_uv(o, angle_limit_deg=55, island_margin=0.02)

    all_meshes = [flow_body, pipe_obj, bonnet, bolt_obj, stem, wheel]
    tris = A.report_and_assert_tris(all_meshes, 12000, "valve_wheel (hero prop)")
    A.print_hierarchy(root)

    A.render_turntable(all_meshes, QA)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
