"""
fuse_core.glb — hand-carried ceramic-and-brass power core. ~0.22m tall.
The game's key puzzle item: ribbed ceramic body, brass contacts top+bottom,
a small glass inspection window with a visible filament, a carry handle.
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
import bmesh
from mathutils import Vector

OUT = "/home/user/Backrooms/public/assets/models/fuse_core.glb"
QA = "/home/user/Backrooms/docs/assets/fuse_core.png"


def build():
    A.reset_scene()

    # -- materials ----------------------------------------------------------
    mat_ceramic = A.make_material("ceramic_ribbed", base_color=(0.80, 0.77, 0.68), roughness=0.72, metallic=0.0)
    mat_brass = A.make_material("brass", base_color=(0.68, 0.51, 0.19), roughness=0.32, metallic=1.0)
    mat_glass = A.make_material("glass", base_color=(0.85, 0.9, 0.9), roughness=0.04, metallic=0.0,
                                 alpha=0.35, transmission=0.95, ior=1.45)
    mat_filament = A.make_material("filament_emissive", base_color=(1.0, 0.55, 0.15), roughness=0.4,
                                    metallic=0.2, emission_color=(1.0, 0.5, 0.12), emission_strength=6.0)
    mat_handle = A.make_material("steel_worn", base_color=(0.22, 0.21, 0.20), roughness=0.5, metallic=0.85)

    body_r = 0.047
    top_z = 0.175

    # -- ceramic ribbed body (lathe profile) --------------------------------
    profile = [(0.0, 0.0), (body_r, 0.0), (body_r * 1.03, 0.008), (body_r * 0.90, 0.016)]
    n_ribs = 5
    rib_span = (0.150 - 0.020)
    for i in range(n_ribs):
        z0 = 0.020 + rib_span * i / (n_ribs - 1)
        profile.append((body_r * 1.00, z0 - 0.006))
        profile.append((body_r * 1.06, z0))
        profile.append((body_r * 1.00, z0 + 0.006))
    profile += [
        (body_r * 0.90, 0.160), (body_r * 0.78, top_z - 0.010),
        (body_r * 0.78, top_z), (0.0, top_z),
    ]
    body = A.lathe_profile("CeramicBody", profile, segments=14)
    A.assign_material(body, mat_ceramic)

    # window recess cut into the front face (a shallow rectangular pocket)
    win_w, win_h, win_d = 0.030, 0.045, 0.020
    cutter = A.prim_box("_winCut", win_w, win_h, win_d, location=(0, -body_r - win_d / 2 + 0.010, 0.100))
    A.boolean_op(body, cutter, op='DIFFERENCE')

    # Only the boolean-cut window opening is genuinely sharp; a high angle
    # limit keeps the bevel off the ribbed lathe surface (which is already
    # chamfered in its profile) so it doesn't blow the triangle budget.
    A.shade_smooth_auto(body, 40)
    A.add_bevel(body, width=0.0012, segments=1, angle_deg=64)
    A.add_weighted_normal(body)

    # -- brass base cap (wider, stable foot) --------------------------------
    base_cap = A.lathe_profile("BrassBase", [
        (0.0, -0.020), (body_r * 1.10, -0.020), (body_r * 1.12, -0.014),
        (body_r * 1.05, -0.002), (body_r * 0.98, 0.001), (0.0, 0.001),
    ], segments=18)
    A.assign_material(base_cap, mat_brass)
    A.finish_round_surface(base_cap)

    # three contact prongs under the base
    prongs = []
    for i in range(3):
        ang = math.radians(120 * i)
        px, py = 0.024 * math.cos(ang), 0.024 * math.sin(ang)
        p = A.prim_cylinder(f"_prong{i}", 0.0035, 0.014, segments=6, location=(px, py, -0.027))
        prongs.append(p)
    prong_obj = A.join_objects(prongs, "BrassProngs")
    A.assign_material(prong_obj, mat_brass)
    A.finish_round_surface(prong_obj)

    # -- brass top cap + contact stud ----------------------------------------
    top_cap = A.lathe_profile("BrassTop", [
        (0.0, top_z - 0.001), (body_r * 0.80, top_z - 0.001), (body_r * 0.86, top_z + 0.006),
        (body_r * 0.70, top_z + 0.014), (body_r * 0.55, top_z + 0.017), (body_r * 0.40, top_z + 0.019),
        (0.020, top_z + 0.020), (0.0, top_z + 0.020),
    ], segments=18)
    A.assign_material(top_cap, mat_brass)
    stud = A.prim_cylinder("_stud", 0.008, 0.014, segments=12, location=(0, 0, top_z + 0.027))
    stud = A.join_objects([top_cap, stud], "BrassTop")
    A.assign_material(stud, mat_brass)
    A.finish_round_surface(stud)
    top_cap = stud

    # -- carry handle: bail arc from two lugs on the top cap ----------------
    handle_r = 0.058
    lug_y = body_r * 0.72
    bm = bmesh.new()
    seg = 14
    tube_r = 0.0055
    ring_prev = None
    verts_path = []
    for i in range(seg + 1):
        t = i / seg
        ang = math.pi * t  # 0..pi arch
        x = 0.0
        y = -lug_y + (lug_y * 2) * t
        z = top_z + 0.020 + handle_r * math.sin(ang)
        verts_path.append(Vector((x, y, z)))
    # build a tube by sweeping a small ring along verts_path
    rings = []
    up = Vector((0, 0, 1))
    for i, p in enumerate(verts_path):
        if i == 0:
            tangent = (verts_path[1] - verts_path[0]).normalized()
        elif i == len(verts_path) - 1:
            tangent = (verts_path[-1] - verts_path[-2]).normalized()
        else:
            tangent = (verts_path[i + 1] - verts_path[i - 1]).normalized()
        ref = Vector((1, 0, 0))
        binorm = tangent.cross(ref)
        if binorm.length < 1e-5:
            ref = Vector((0, 1, 0))
            binorm = tangent.cross(ref)
        binorm.normalize()
        norm = binorm.cross(tangent).normalized()
        ring = []
        rseg = 6
        for k in range(rseg):
            a = 2 * math.pi * k / rseg
            off = binorm * (tube_r * math.cos(a)) + norm * (tube_r * math.sin(a))
            ring.append(bm.verts.new(p + off))
        rings.append(ring)
    for i in range(len(rings) - 1):
        ra, rb = rings[i], rings[i + 1]
        rseg = len(ra)
        for k in range(rseg):
            k2 = (k + 1) % rseg
            bm.faces.new((ra[k], ra[k2], rb[k2], rb[k]))
    try:
        bm.faces.new(rings[0][::-1])
    except ValueError:
        pass
    try:
        bm.faces.new(rings[-1])
    except ValueError:
        pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    handle = A.mesh_from_bmesh(bm, "Handle")
    A.assign_material(handle, mat_handle)
    A.finish_round_surface(handle, weighted_normal=False)

    # -- glass pane + filament -----------------------------------------------
    glass = A.prim_box("Glass", win_w * 0.94, win_h * 0.90, 0.002, location=(0, -body_r - 0.001, 0.100))
    A.assign_material(glass, mat_glass)

    fil_parts = []
    zig = [(-0.009, 0.010), (0.006, 0.100 + 0.014), (-0.006, 0.100 - 0.004), (0.009, 0.100 + 0.012)]
    pts = [Vector((zx, -body_r + 0.006, 0.100 + zz * 0)) for zx, zz in [(0, 0)]]
    coords = [
        (-0.009, 0.100 + 0.014), (0.008, 0.100 + 0.006), (-0.008, 0.100 - 0.006), (0.009, 0.100 - 0.013),
    ]
    prev = Vector((coords[0][0], -body_r + 0.006, coords[0][1]))
    for cx, cz in coords[1:]:
        cur = Vector((cx, -body_r + 0.006, cz))
        mid = (prev + cur) / 2
        length = (cur - prev).length
        seg_obj = A.prim_cylinder("_filseg", 0.0009, length, segments=6, location=(mid.x, mid.y, mid.z))
        direction = (cur - prev).normalized()
        rot = direction.to_track_quat('Z', 'Y')
        seg_obj.rotation_euler = rot.to_euler()
        A.apply_transforms(seg_obj, loc=False, rot=True, scale=False)
        fil_parts.append(seg_obj)
        prev = cur
    filament = A.join_objects(fil_parts, "Filament")
    A.assign_material(filament, mat_filament)

    # -- assemble hierarchy ---------------------------------------------------
    root = A.new_empty("fuse_core", (0, 0, 0))
    for o in (body, base_cap, top_cap, prong_obj, handle, glass, filament):
        A.parent_keep_transform(o, root)

    # Blender Z-up -> stand upright already (built along Z). Rotate whole rig
    # so its "up" (Z) becomes the object's local +Y-equivalent once exported
    # (glTF exporter's export_yup handles the axis flip automatically).
    for o in (body, base_cap, top_cap, prong_obj, handle, glass, filament):
        A.smart_uv(o, angle_limit_deg=60, island_margin=0.02)

    A.set_origin_to_bounds_bottom(root) if root.type == 'MESH' else None
    # empties can't take bounds-bottom directly; set root at world origin,
    # and shift children so the whole assembly's lowest point sits at z=0.
    lo, hi = A._bounds_of([body, base_cap, top_cap, prong_obj, handle, glass, filament])
    if lo.z < -0.0001:
        shift = -lo.z
        for o in (body, base_cap, top_cap, prong_obj, handle, glass, filament):
            o.location.z += shift

    all_meshes = [body, base_cap, top_cap, prong_obj, handle, glass, filament]
    tris = A.report_and_assert_tris(all_meshes, 4000, "fuse_core (hero prop, budget 12k, target well under)")
    A.print_hierarchy(root)

    A.render_turntable(all_meshes, QA)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
