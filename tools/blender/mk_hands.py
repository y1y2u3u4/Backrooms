"""
hands_lowpoly.glb — first-person hands, hand_L and hand_R as separate
objects, ~3-5k tris for the pair. Stylised but anatomically believable,
sleeve cuff included, relaxed loose-carry pose. No rig — the game poses
procedurally — but each hand is modelled with its WRIST AT THE LOCAL ORIGIN,
pointing down local -Z (i.e. -Z runs from wrist toward fingertips).
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
from mathutils import Vector

OUT = "/home/user/Backrooms/public/assets/models/hands_lowpoly.glb"
QA = "/home/user/Backrooms/docs/assets/hands_lowpoly.png"


def build_one_hand(side_sign, mat_skin, mat_sleeve):
    """side_sign: +1 for right hand (build convention), mirrored for left."""
    parts = []

    # Sleeve cuff sits ABOVE the wrist (+Z), palm and fingers hang below (-Z).
    sleeve = A.prim_cylinder("_sleeve", 0.052, 0.09, segments=10, location=(0, 0, 0.052))
    parts.append((sleeve, mat_sleeve))

    wrist_taper = A.cylinder_between("_wristTaper", (0, 0, 0.006), (0, 0, -0.01), 0.040, 0.036, segments=10)
    parts.append((wrist_taper, mat_skin))

    # Palm: tapered from a narrower wrist to a wider knuckle line, built from
    # three overlapping blocks of decreasing/increasing width so a single
    # bevel pass reads as a soft, organic mass rather than a brick.
    palm_a = A.prim_box("_palmWrist", 0.062, 0.026, 0.030, location=(0.0, 0, -0.026))
    palm_b = A.prim_box("_palmMid", 0.078, 0.027, 0.032, location=(0.002 * side_sign, 0, -0.058))
    palm_c = A.prim_box("_palmKnuckle", 0.086, 0.024, 0.030, location=(0.002 * side_sign, 0, -0.088))
    # a soft thenar bulge (thumb-side pad) so the palm isn't a flat slab
    thenar = A.prim_sphere("_thenar", 0.022, segments=8, rings=6,
                            location=(0.034 * side_sign, -0.004, -0.062))
    for o in (palm_a, palm_b, palm_c, thenar):
        parts.append((o, mat_skin))

    knuckle_z = -0.098
    finger_specs = [
        # (x offset from palm centre, length total, base radius, tip radius, curl degrees per joint)
        (-0.030, 0.062, 0.0105, 0.0075, (18, 32, 28)),   # index
        (-0.010, 0.070, 0.0110, 0.0078, (20, 34, 30)),   # middle
        (0.011, 0.066, 0.0105, 0.0074, (20, 34, 30)),    # ring
        (0.031, 0.052, 0.0090, 0.0065, (22, 36, 30)),    # pinky
    ]
    for fi, (fx, flen, r0, r1, curls) in enumerate(finger_specs):
        seg_lens = [flen * 0.40, flen * 0.34, flen * 0.26]
        pos = Vector((fx * side_sign, 0, knuckle_z))
        # direction starts pointing straight down (-Z) then curls toward -Y
        # (palm-ward) at each joint for a relaxed, loosely-curled pose.
        dir_vec = Vector((0, 0, -1))
        cum_pitch = 0.0
        for si, seg_len in enumerate(seg_lens):
            cum_pitch += math.radians(curls[si])
            dir_vec = Vector((0, -math.sin(cum_pitch), -math.cos(cum_pitch)))
            end = pos + dir_vec * seg_len
            rr0 = r0 + (r1 - r0) * (si / 3)
            rr1 = r0 + (r1 - r0) * ((si + 1) / 3)
            seg = A.cylinder_between(f"_f{fi}s{si}", pos, end, rr0, rr1, segments=6)
            parts.append((seg, mat_skin))
            # small knuckle bead at each joint to hide the seam
            bead = A.prim_sphere(f"_f{fi}b{si}", rr0 * 1.05, segments=6, rings=5, location=tuple(pos))
            parts.append((bead, mat_skin))
            pos = end
        tip = A.prim_sphere(f"_f{fi}tip", r1, segments=6, rings=5, location=tuple(pos))
        parts.append((tip, mat_skin))

    # Thumb: two segments, angled out from the side of the palm, opposing the
    # fingers, curled inward for a relaxed loose grip.
    thumb_root = Vector((0.041 * side_sign, -0.006, -0.070))
    thumb_dir1 = Vector((0.55 * side_sign, -0.55, -0.62)).normalized()
    thumb_mid = thumb_root + thumb_dir1 * 0.036
    thumb_dir2 = Vector((0.35 * side_sign, -0.75, -0.45)).normalized()
    thumb_tip = thumb_mid + thumb_dir2 * 0.030
    t0 = A.cylinder_between("_thumb0", thumb_root, thumb_mid, 0.0125, 0.0098, segments=6)
    t1 = A.cylinder_between("_thumb1", thumb_mid, thumb_tip, 0.0098, 0.0072, segments=6)
    t_base_bead = A.prim_sphere("_thumbBase", 0.0135, segments=6, rings=5, location=tuple(thumb_root))
    t_knuckle = A.prim_sphere("_thumbKnuckle", 0.0098, segments=6, rings=5, location=tuple(thumb_mid))
    t_tip = A.prim_sphere("_thumbTip", 0.0072, segments=6, rings=5, location=tuple(thumb_tip))
    for o in (t0, t1, t_base_bead, t_knuckle, t_tip):
        parts.append((o, mat_skin))

    objs = []
    for o, mat in parts:
        A.assign_material(o, mat)
        objs.append(o)
    hand = A.join_objects(objs, "hand")
    A.finish_hero_surface(hand, bevel_width=0.0026, bevel_segments=1, angle_deg=46)
    return hand


def build():
    A.reset_scene()

    mat_skin = A.make_material("skin_stylised", base_color=(0.72, 0.55, 0.45), roughness=0.55, metallic=0.0)
    mat_sleeve = A.make_material("sleeve_fabric", base_color=(0.22, 0.24, 0.20), roughness=0.85, metallic=0.0)

    root = A.new_empty("hands_lowpoly", (0, 0, 0))

    hand_r = build_one_hand(1, mat_skin, mat_sleeve)
    hand_r.name = "hand_R"
    hand_r.location = (0.10, 0, 0)

    hand_l = build_one_hand(1, mat_skin, mat_sleeve)  # build in the same (right) convention...
    hand_l.name = "_hand_r_copy"
    # ...then mirror it in place (bake a -1 X scale + flipped normals) to get
    # a true left hand rather than reusing the right-biased curl math.
    A.apply_transforms(hand_l, loc=False, rot=False, scale=True)
    import bmesh as _bmesh
    bm = _bmesh.new()
    bm.from_mesh(hand_l.data)
    for v in bm.verts:
        v.co.x *= -1
    _bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(hand_l.data)
    bm.free()
    hand_l.data.update()
    hand_l.name = "hand_L"
    hand_l.location = (-0.10, 0, 0)

    A.parent_keep_transform(hand_r, root)
    A.parent_keep_transform(hand_l, root)

    for o in (hand_r, hand_l):
        A.smart_uv(o, angle_limit_deg=60, island_margin=0.03)

    tris = A.report_and_assert_tris([hand_r, hand_l], 6000, "hands_lowpoly (pair)")
    A.print_hierarchy(root)

    A.render_turntable([hand_r, hand_l], QA)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
