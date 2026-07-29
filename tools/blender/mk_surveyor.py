"""
surveyor.glb — THE SURVEYOR, THE ANNEX's entity. ~2.9m tall, extremely
narrow, upright but wrong. A square louvred-diffuser head (one hard,
identifiable mass) on a long neck, with instrument-boom rods behind it;
torso is an irregular, slightly damaged-looking column of stacked
ceiling-void plates with a gap exposing its spine; disproportionately
long, over-segmented arms mounted high and wide, ending in flat measuring
paddles; thin legs, reversed at the knee. Neutral A-pose, procedurally
animated by the game — every joint is a separate named object pivoting
at its own joint axis.

COORDINATE CONVENTION: root at ground level between the feet (x=0,y=0,z=0).
+Z up, +Y forward (the direction it faces). Left/right is -X/+X.

Reminder: A.prim_box(name, w, h, d, location) maps w->X, h->Z(vertical),
d->Y(depth). Getting this backwards is the #1 recurring bug in this file —
double check every call.
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
import bmesh
from mathutils import Vector

OUT = "/home/user/Backrooms/public/assets/models/surveyor.glb"
QA = "/home/user/Backrooms/docs/assets/surveyor.png"
QA_SIL = "/home/user/Backrooms/docs/assets/surveyor_silhouette.png"

# -- joint heights (metres) --------------------------------------------------
ANKLE_Z = 0.06
KNEE_Z = ANKLE_Z + 0.92
HIP_Z = KNEE_Z + 0.64
SHOULDER_Z = HIP_Z + 0.70          # torso spans HIP_Z..SHOULDER_Z
NECK_TOP_Z = SHOULDER_Z + 0.22      # neck spans SHOULDER_Z..NECK_TOP_Z
HEAD_CENTER_Z = NECK_TOP_Z + 0.20

HIP_X = 0.10
SHOULDER_X = 0.185


def build():
    A.reset_scene()

    mat_plate = A.make_material("void_plate", base_color=(0.55, 0.56, 0.50), roughness=0.75, metallic=0.15)
    mat_plate_dark = A.make_material("void_plate_dark", base_color=(0.30, 0.31, 0.28), roughness=0.8, metallic=0.1)
    mat_limb = A.make_material("limb_shaft", base_color=(0.16, 0.16, 0.15), roughness=0.65, metallic=0.35)
    mat_joint = A.make_material("joint_collar", base_color=(0.42, 0.40, 0.34), roughness=0.5, metallic=0.6)
    mat_pin = A.make_material("clevis_pin", base_color=(0.55, 0.53, 0.46), roughness=0.35, metallic=0.8)
    mat_blade = A.make_material("measuring_blade", base_color=(0.62, 0.63, 0.58), roughness=0.4, metallic=0.6)
    mat_louvre = A.make_material("louvre_grille", base_color=(0.38, 0.39, 0.35), roughness=0.55, metallic=0.5)
    mat_rivet = A.make_material("rivet", base_color=(0.20, 0.20, 0.19), roughness=0.6, metallic=0.7)
    mat_spine = A.make_material("spine_core", base_color=(0.12, 0.12, 0.11), roughness=0.6, metallic=0.4)

    root = A.new_empty("surveyor", (0, 0, 0))

    def clevis_pin(name, center, axis_dir, radius=0.052):
        """A pin perpendicular to a limb's axis, poking through its collar — the
        strongest cheap 'this is a mechanism, not a body' signal."""
        axis_dir = Vector(axis_dir).normalized()
        ref = Vector((1, 0, 0)) if abs(axis_dir.z) < 0.9 else Vector((0, 1, 0))
        perp = axis_dir.cross(ref).normalized()
        p0 = Vector(center) - perp * (radius + 0.012)
        p1 = Vector(center) + perp * (radius + 0.012)
        pin = A.cylinder_between(name, p0, p1, 0.007, 0.007, segments=8)
        A.assign_material(pin, mat_pin)
        A.finish_round_surface(pin, weighted_normal=False)
        return pin

    # =========================================================================
    # TORSO — irregular, slightly damaged stacked ceiling-void plates, with a
    # gap that exposes the spine, and a fixing bolt at every seam.
    # =========================================================================
    def build_torso():
        span = SHOULDER_Z - HIP_Z
        # (z0_frac, h_frac, width, depth, twist_deg, jx, jy) — one slot has
        # width<=0, meaning "skip: gap here". Sizes are irregular on purpose;
        # one plate (idx 2) is noticeably larger than its neighbours.
        specs = [
            (0.00, 0.15, 0.30, 0.185, 3, 0.010, -0.006),
            (0.15, 0.13, 0.255, 0.155, -7, -0.016, 0.009),
            (0.28, 0.17, 0.345, 0.205, 9, 0.018, -0.011),   # jutting slab
            (0.45, 0.12, 0.0, 0.0, 0, 0.0, 0.0),             # GAP — spine shows
            (0.57, 0.15, 0.235, 0.145, -5, -0.012, 0.010),
            (0.72, 0.14, 0.205, 0.130, 6, 0.009, -0.007),
            (0.86, 0.14, 0.165, 0.110, -4, 0.0, 0.0),
        ]
        parts = []
        rivets = []
        for i, (z0f, hf, w, d, twist, jx, jy) in enumerate(specs):
            z0 = HIP_Z + z0f * span
            ph = hf * span
            if w <= 0:
                continue
            cz = z0 + ph / 2
            plate = A.prim_box(f"_plate{i}", w, ph - 0.010, d, location=(0, 0, 0))
            plate.rotation_euler = (0, 0, math.radians(twist))
            A.apply_transforms(plate, loc=False, rot=True, scale=False)
            plate.location = (jx, jy, cz)
            parts.append(plate)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    local = Vector((sx * (w / 2 - 0.018), sy * (d / 2 - 0.018), 0))
                    ang = math.radians(twist)
                    rx = jx + local.x * math.cos(ang) - local.y * math.sin(ang)
                    ry = jy + local.x * math.sin(ang) + local.y * math.cos(ang)
                    rv = A.prim_cylinder(f"_trivet{i}_{sx}_{sy}", 0.0065, 0.011, segments=6, location=(rx, ry, z0))
                    rivets.append(rv)
            # damage: shear a corner off the large jutting slab
            if i == 2:
                cutter = A.prim_box(f"_dmgcut{i}", 0.09, 0.09, d + 0.02, location=(0, 0, 0))
                cutter.rotation_euler = (0, math.radians(30), math.radians(twist + 20))
                A.apply_transforms(cutter, loc=False, rot=True, scale=False)
                cutter.location = (jx + w / 2 - 0.01, jy + d / 2 - 0.01, cz + ph / 2 - 0.01)
                A.boolean_op(plate, cutter, op='DIFFERENCE')

        torso_plates = A.join_objects(parts, "_torsoPlates")
        A.assign_material(torso_plates, mat_plate)
        A.finish_hero_surface(torso_plates, bevel_width=0.003, bevel_segments=2, angle_deg=38)

        rivet_obj = A.join_objects(rivets, "_torsoRivets")
        A.assign_material(rivet_obj, mat_rivet)
        A.finish_round_surface(rivet_obj)

        # exposed spine core, visible through the gap
        spine = A.cylinder_between("_spine", (0, 0, HIP_Z - 0.02), (0, 0, SHOULDER_Z + 0.02), 0.026, 0.024, segments=10)
        A.assign_material(spine, mat_spine)
        A.finish_round_surface(spine, weighted_normal=False)

        torso = A.join_objects([torso_plates, rivet_obj, spine], "torso")
        A.finalize_pivot(torso, (0, 0, HIP_Z))
        return torso

    torso = build_torso()
    A.parent_keep_transform(torso, root)

    # =========================================================================
    # NECK
    # =========================================================================
    neck = A.cylinder_between("neck", (0, 0, SHOULDER_Z), (0, 0.01, NECK_TOP_Z), 0.052, 0.042, segments=12)
    collar = A.prim_cylinder("_neckCollar", 0.062, 0.02, segments=12, location=(0, 0.003, SHOULDER_Z + 0.012))
    neck = A.join_objects([neck, collar], "neck")
    A.assign_material(neck, mat_limb)
    A.finish_round_surface(neck)
    A.finalize_pivot(neck, (0, 0, SHOULDER_Z))
    A.parent_keep_transform(neck, torso)

    # =========================================================================
    # HEAD — one hard square mass: a solid-bordered louvre plate you can see
    # through only in the centre, with instrument-boom rods behind it.
    # =========================================================================
    def build_head():
        plate_size = 0.44
        border_w = 0.075
        plate_t = 0.035
        aperture = plate_size - border_w * 2
        parts = []

        for w_, h_, x_, z_ in (
            (plate_size, border_w, 0, plate_size / 2 - border_w / 2),
            (plate_size, border_w, 0, -plate_size / 2 + border_w / 2),
            (border_w, aperture, -plate_size / 2 + border_w / 2, 0),
            (border_w, aperture, plate_size / 2 - border_w / 2, 0),
        ):
            strip = A.prim_box("_headBorder", w_, h_, plate_t, location=(x_, 0, z_))
            parts.append(strip)
        border_obj = A.join_objects(parts, "_headBorderJ")
        A.assign_material(border_obj, mat_plate_dark)
        A.finish_hero_surface(border_obj, bevel_width=0.003, bevel_segments=2)

        # angled louvre blades spanning the aperture — visible gaps between
        # them so the player can see through it at an angle, up close.
        blades = []
        n_blades = 6
        for i in range(n_blades):
            t = (i + 0.5) / n_blades
            bz = -aperture / 2 + t * aperture
            bl = A.prim_box(f"_blade{i}", aperture - 0.01, 0.007, plate_t * 0.85, location=(0, 0, 0))
            bl.rotation_euler = (math.radians(36), 0, 0)
            A.apply_transforms(bl, loc=False, rot=True, scale=False)
            bl.location = (0, 0, bz)
            blades.append(bl)
        blade_obj = A.join_objects(blades, "_headBlades")
        A.assign_material(blade_obj, mat_louvre)
        A.finish_hero_surface(blade_obj, bevel_width=0.0015, bevel_segments=1)

        mullion = A.prim_box("_mullion", 0.022, aperture, plate_t * 0.75, location=(0, 0, 0))
        A.assign_material(mullion, mat_plate_dark)
        A.finish_hero_surface(mullion, bevel_width=0.0015, bevel_segments=1)

        bolts = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                bx, bz = sx * (plate_size / 2 - 0.028), sy * (plate_size / 2 - 0.028)
                b = A.prim_cylinder(f"_hbolt{sx}_{sy}", 0.010, 0.016, segments=8, location=(bx, -plate_t / 2 - 0.002, bz))
                b.rotation_euler = (math.pi / 2, 0, 0)
                A.apply_transforms(b, loc=False, rot=True, scale=False)
                bolts.append(b)
        bolt_obj = A.join_objects(bolts, "_headBolts")
        A.assign_material(bolt_obj, mat_rivet)
        A.finish_round_surface(bolt_obj)

        # instrument-boom rods, mounted BEHIND the plate, sticking out past
        # its edges — the "cross" now reads as instrumentation, not the head.
        boom_y = -plate_t / 2 - 0.014
        boom_h = A.cylinder_between("_boomH", (-plate_size / 2 - 0.16, boom_y, 0), (plate_size / 2 + 0.16, boom_y, 0), 0.012, 0.012, segments=8)
        boom_v = A.cylinder_between("_boomV", (0, boom_y, -0.02), (0, boom_y, plate_size / 2 + 0.20), 0.012, 0.008, segments=8)
        boom_obj = A.join_objects([boom_h, boom_v], "_booms")
        A.assign_material(boom_obj, mat_joint)
        A.finish_round_surface(boom_obj, weighted_normal=False)

        head = A.join_objects([border_obj, blade_obj, mullion, bolt_obj, boom_obj], "head")
        # Slight tilt about its own facing normal (Y) for the "rotated
        # diffuser" read, plus a small pitch/roll for wrongness — NOT a 90
        # degree flip, which would turn the plate edge-on to the viewer.
        head.rotation_euler = (math.radians(7), math.radians(17), math.radians(4))
        A.apply_transforms(head, loc=False, rot=True, scale=False)
        head.location = (0, 0.01, HEAD_CENTER_Z)
        return head

    head = build_head()
    A.finalize_pivot(head, (0, 0, NECK_TOP_Z))
    A.parent_keep_transform(head, neck)

    # =========================================================================
    # ARMS — mounted high and wide, over-segmented, ending in a genuinely
    # flat, wide measuring paddle. Reach further down than a human's would.
    # =========================================================================
    def build_arm(side):
        sx = side  # -1 left, +1 right
        shoulder_pt = Vector((sx * SHOULDER_X, 0.0, SHOULDER_Z + 0.03))
        elbow_pt = shoulder_pt + Vector((sx * 0.12, 0.04, -0.68))
        mid_pt = elbow_pt + Vector((sx * 0.03, 0.09, -0.46))
        wrist_pt = mid_pt + Vector((sx * 0.05, 0.10, -0.46))

        def segmented(name, p0, p1, r0, r1, n_bulges=3):
            main = A.cylinder_between(f"_{name}main", p0, p1, r0, r1, segments=10)
            parts = [main]
            for i in range(1, n_bulges + 1):
                t = i / (n_bulges + 1)
                p = p0.lerp(p1, t)
                rr = (r0 + (r1 - r0) * t) * 1.24
                ring = A.prim_cylinder(f"_{name}ring{i}", rr, 0.018, segments=10, location=(0, 0, 0))
                direction = (p1 - p0).normalized()
                rot = direction.to_track_quat('Z', 'Y')
                ring.rotation_euler = rot.to_euler()
                A.apply_transforms(ring, loc=False, rot=True, scale=False)
                ring.location = p
                parts.append(ring)
            obj = A.join_objects(parts, f"_{name}J")
            A.assign_material(obj, mat_limb)
            A.finish_round_surface(obj, weighted_normal=False)
            return obj

        upper = segmented("armUpper", shoulder_pt, elbow_pt, 0.044, 0.036, n_bulges=3)
        shoulder_collar = A.prim_cylinder("_shCollar", 0.060, 0.026, segments=12, location=tuple(shoulder_pt))
        A.assign_material(shoulder_collar, mat_joint)
        A.finish_round_surface(shoulder_collar)
        shoulder_pin = clevis_pin("_shPin", shoulder_pt, elbow_pt - shoulder_pt, radius=0.030)
        upper = A.join_objects([upper, shoulder_collar, shoulder_pin], "arm_upper")
        A.finalize_pivot(upper, tuple(shoulder_pt))

        # arm_lower carries an EXTRA visible segment (elbow -> mid -> wrist)
        # inside a single pivoting object, so it reads as over-segmented.
        seg_a = segmented("armLowerA", elbow_pt, mid_pt, 0.034, 0.026, n_bulges=2)
        seg_b = segmented("armLowerB", mid_pt, wrist_pt, 0.026, 0.020, n_bulges=2)
        elbow_collar = A.prim_cylinder("_elCollar", 0.046, 0.022, segments=12, location=tuple(elbow_pt))
        A.assign_material(elbow_collar, mat_joint)
        A.finish_round_surface(elbow_collar)
        elbow_pin = clevis_pin("_elPin", elbow_pt, mid_pt - elbow_pt, radius=0.023)
        mid_collar = A.prim_cylinder("_midCollar", 0.032, 0.018, segments=10, location=tuple(mid_pt))
        A.assign_material(mid_collar, mat_joint)
        A.finish_round_surface(mid_collar)
        lower = A.join_objects([seg_a, seg_b, elbow_collar, elbow_pin, mid_collar], "arm_lower")
        A.finalize_pivot(lower, tuple(elbow_pt))

        # hand: a genuinely flat, wide measuring paddle
        blade_len, blade_w, blade_t = 0.24, 0.155, 0.014
        blade_dir = (wrist_pt - mid_pt).normalized()
        blade_end = wrist_pt + blade_dir * blade_len
        neck_stub = A.cylinder_between("_bladeNeck", wrist_pt, wrist_pt + blade_dir * 0.05, 0.024, 0.020, segments=8)
        flat = A.prim_box("_bladeFlat", blade_w, blade_len * 0.85, blade_t, location=(0, 0, 0))
        rot = blade_dir.to_track_quat('Z', 'Y')
        flat.rotation_euler = rot.to_euler()
        A.apply_transforms(flat, loc=False, rot=True, scale=False)
        flat.location = wrist_pt.lerp(blade_end, 0.55)
        ticks = []
        for i in range(3):
            t = 0.28 + i * 0.24
            tp = wrist_pt.lerp(blade_end, t)
            tick = A.prim_box(f"_tick{i}", blade_w * 0.75, 0.008, blade_t * 1.5, location=(0, 0, 0))
            tick.rotation_euler = rot.to_euler()
            A.apply_transforms(tick, loc=False, rot=True, scale=False)
            tick.location = tp
            ticks.append(tick)
        wrist_collar = A.prim_cylinder("_wrCollar", 0.030, 0.020, segments=10, location=tuple(wrist_pt))
        wrist_pin = clevis_pin("_wrPin", wrist_pt, blade_dir, radius=0.020)
        hand_parts = [neck_stub, flat] + ticks + [wrist_collar, wrist_pin]
        for o in hand_parts:
            A.assign_material(o, mat_blade)
        hand = A.join_objects(hand_parts, "hand")
        A.finish_hero_surface(hand, bevel_width=0.002, bevel_segments=1)
        A.finalize_pivot(hand, tuple(wrist_pt))

        return upper, lower, hand

    arm_upper_L, arm_lower_L, hand_L = build_arm(-1)
    arm_upper_R, arm_lower_R, hand_R = build_arm(1)
    arm_upper_L.name, arm_lower_L.name, hand_L.name = "arm_upper_L", "arm_lower_L", "hand_L"
    arm_upper_R.name, arm_lower_R.name, hand_R.name = "arm_upper_R", "arm_lower_R", "hand_R"

    A.parent_keep_transform(arm_upper_L, torso)
    A.parent_keep_transform(arm_lower_L, arm_upper_L)
    A.parent_keep_transform(hand_L, arm_lower_L)
    A.parent_keep_transform(arm_upper_R, torso)
    A.parent_keep_transform(arm_lower_R, arm_upper_R)
    A.parent_keep_transform(hand_R, arm_lower_R)

    # =========================================================================
    # LEGS — thin, reversed at the knee, sturdier than the arms so the two
    # pairs of limbs read as different things.
    # =========================================================================
    def build_leg(side):
        sx = side
        hip_pt = Vector((sx * HIP_X, 0.0, HIP_Z))
        knee_pt = Vector((sx * HIP_X * 0.9, 0.048, KNEE_Z))
        ankle_pt = Vector((sx * HIP_X * 0.8, -0.01, ANKLE_Z))

        thigh = A.cylinder_between("_thigh", hip_pt, knee_pt, 0.064, 0.050, segments=10)
        hip_collar = A.prim_cylinder("_hipCollar", 0.078, 0.028, segments=12, location=tuple(hip_pt))
        A.assign_material(hip_collar, mat_joint)
        A.finish_round_surface(hip_collar)
        hip_pin = clevis_pin("_hipPin", hip_pt, knee_pt - hip_pt, radius=0.040)
        thigh = A.join_objects([thigh, hip_collar, hip_pin], "leg_upper")
        A.assign_material(thigh, mat_limb)
        A.finish_round_surface(thigh, weighted_normal=False)
        A.finalize_pivot(thigh, tuple(hip_pt))

        shin = A.cylinder_between("_shin", knee_pt, ankle_pt, 0.046, 0.036, segments=10)
        knee_collar = A.prim_cylinder("_kneeCollar", 0.060, 0.024, segments=12, location=tuple(knee_pt))
        A.assign_material(knee_collar, mat_joint)
        A.finish_round_surface(knee_collar)
        knee_pin = clevis_pin("_kneePin", knee_pt, ankle_pt - knee_pt, radius=0.030)
        shin = A.join_objects([shin, knee_collar, knee_pin], "leg_lower")
        A.assign_material(shin, mat_limb)
        A.finish_round_surface(shin, weighted_normal=False)
        A.finalize_pivot(shin, tuple(knee_pt))

        foot = A.prim_box("_footBox", 0.075, 0.045, 0.24,
                           location=(ankle_pt.x, ankle_pt.y + 0.09, ankle_pt.z - 0.0225))
        ankle_collar = A.prim_cylinder("_ankleCollar", 0.042, 0.018, segments=10, location=tuple(ankle_pt))
        A.assign_material(foot, mat_limb)
        A.finish_hero_surface(foot, bevel_width=0.003, bevel_segments=2)
        A.assign_material(ankle_collar, mat_joint)
        A.finish_round_surface(ankle_collar)
        foot = A.join_objects([foot, ankle_collar], "foot")
        A.finalize_pivot(foot, tuple(ankle_pt))

        return thigh, shin, foot

    leg_upper_L, leg_lower_L, foot_L = build_leg(-1)
    leg_upper_R, leg_lower_R, foot_R = build_leg(1)
    leg_upper_L.name, leg_lower_L.name, foot_L.name = "leg_upper_L", "leg_lower_L", "foot_L"
    leg_upper_R.name, leg_lower_R.name, foot_R.name = "leg_upper_R", "leg_lower_R", "foot_R"

    A.parent_keep_transform(leg_upper_L, root)
    A.parent_keep_transform(leg_lower_L, leg_upper_L)
    A.parent_keep_transform(foot_L, leg_lower_L)
    A.parent_keep_transform(leg_upper_R, root)
    A.parent_keep_transform(leg_lower_R, leg_upper_R)
    A.parent_keep_transform(foot_R, leg_lower_R)

    # =========================================================================
    all_meshes = [torso, neck, head,
                  arm_upper_L, arm_lower_L, hand_L, arm_upper_R, arm_lower_R, hand_R,
                  leg_upper_L, leg_lower_L, foot_L, leg_upper_R, leg_lower_R, foot_R]
    for o in all_meshes:
        A.smart_uv(o, angle_limit_deg=58, island_margin=0.02)

    tris = A.report_and_assert_tris(all_meshes, 18000, "surveyor (entity)")
    A.print_hierarchy(root)

    # sanity-check: every named joint object's LOCAL origin must sit at its
    # joint, not at (0,0,0) — a pivot-at-origin export looks broken the
    # instant the game tries to rotate it procedurally.
    expected_local_origin_nonzero = all_meshes  # every one of these pivots on a joint
    for o in expected_local_origin_nonzero:
        if o.location.length < 1e-5 and o.name != "torso":
            print(f"  !! WARNING: {o.name} pivot looks like it's at the origin — check finalize_pivot")

    A.render_turntable(all_meshes, QA, res=760)
    A.render_silhouette(all_meshes, QA_SIL)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
