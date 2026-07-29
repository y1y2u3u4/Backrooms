"""
surveyor.glb — THE SURVEYOR, THE ANNEX's entity. ~2.9m tall, extremely
narrow, upright but wrong. Square louvred-diffuser head on a long neck;
torso is a column of stacked, slightly offset ceiling-void plates;
disproportionately long, over-segmented arms ending in flat measuring
blades; thin legs, reversed at the knee. Neutral A-pose, procedurally
animated by the game — every joint is a separate named object pivoting
at its own joint axis.

COORDINATE CONVENTION: root at ground level between the feet (x=0,y=0,z=0).
+Z up, +Y forward (the direction it faces). Left/right is -X/+X.
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
import bmesh
from mathutils import Vector

OUT = "/home/user/Backrooms/public/assets/models/surveyor.glb"
QA = "/home/user/Backrooms/docs/assets/surveyor.png"

# -- joint heights (metres) --------------------------------------------------
ANKLE_Z = 0.06
KNEE_Z = ANKLE_Z + 0.92
HIP_Z = KNEE_Z + 0.64
SHOULDER_Z = HIP_Z + 0.70          # torso spans HIP_Z..SHOULDER_Z
NECK_TOP_Z = SHOULDER_Z + 0.22      # neck spans SHOULDER_Z..NECK_TOP_Z
HEAD_CENTER_Z = NECK_TOP_Z + 0.16

HIP_X = 0.10
SHOULDER_X = 0.155


def build():
    A.reset_scene()

    mat_plate = A.make_material("void_plate", base_color=(0.55, 0.56, 0.50), roughness=0.75, metallic=0.15)
    mat_plate_dark = A.make_material("void_plate_dark", base_color=(0.30, 0.31, 0.28), roughness=0.8, metallic=0.1)
    mat_limb = A.make_material("limb_shaft", base_color=(0.16, 0.16, 0.15), roughness=0.65, metallic=0.35)
    mat_joint = A.make_material("joint_collar", base_color=(0.42, 0.40, 0.34), roughness=0.5, metallic=0.6)
    mat_blade = A.make_material("measuring_blade", base_color=(0.62, 0.63, 0.58), roughness=0.4, metallic=0.6)
    mat_louvre = A.make_material("louvre_grille", base_color=(0.38, 0.39, 0.35), roughness=0.55, metallic=0.5)
    mat_rivet = A.make_material("rivet", base_color=(0.20, 0.20, 0.19), roughness=0.6, metallic=0.7)

    root = A.new_empty("surveyor", (0, 0, 0))

    # =========================================================================
    # TORSO — a column of stacked, slightly offset ceiling-void plates
    # =========================================================================
    def build_torso():
        n_plates = 7
        span = SHOULDER_Z - HIP_Z
        plate_h = span / n_plates
        parts = []
        jitter = [(0.012, -0.006), (-0.015, 0.010), (0.008, -0.012), (-0.010, 0.005),
                  (0.014, 0.008), (-0.008, -0.010), (0.0, 0.0)]
        rivets = []
        for i in range(n_plates):
            t = i / (n_plates - 1)
            w = 0.30 * (1 - 0.30 * t)     # tapers narrower toward the neck
            d = 0.17 * (1 - 0.22 * t)
            jx, jy = jitter[i]
            z0 = HIP_Z + i * plate_h
            cz = z0 + plate_h / 2
            plate = A.prim_box(f"_plate{i}", w, plate_h - 0.008, d, location=(jx, jy, cz))
            parts.append(plate)
            # corner rivets, visible fixings between stacked plates
            for sx in (-1, 1):
                for sy in (-1, 1):
                    rx = jx + sx * (w / 2 - 0.018)
                    ry = jy + sy * (d / 2 - 0.018)
                    rv = A.prim_cylinder(f"_trivet{i}_{sx}_{sy}", 0.006, 0.01, segments=6, location=(rx, ry, z0))
                    rivets.append(rv)
        torso_plates = A.join_objects(parts, "_torsoPlates")
        A.assign_material(torso_plates, mat_plate)
        A.finish_hero_surface(torso_plates, bevel_width=0.003, bevel_segments=2, angle_deg=40)

        rivet_obj = A.join_objects(rivets, "_torsoRivets")
        A.assign_material(rivet_obj, mat_rivet)
        A.finish_round_surface(rivet_obj)

        torso = A.join_objects([torso_plates, rivet_obj], "torso")
        A.finalize_pivot(torso, (0, 0, HIP_Z))
        return torso

    torso = build_torso()
    A.parent_keep_transform(torso, root)

    # =========================================================================
    # NECK — thin shaft, torso to head base
    # =========================================================================
    neck = A.cylinder_between("neck", (0, 0, SHOULDER_Z), (0, 0.01, NECK_TOP_Z), 0.052, 0.040, segments=12)
    collar = A.prim_cylinder("_neckCollar", 0.062, 0.02, segments=12, location=(0, 0.003, SHOULDER_Z + 0.012))
    neck = A.join_objects([neck, collar], "neck")
    A.assign_material(neck, mat_limb)
    A.finish_round_surface(neck)
    A.finalize_pivot(neck, (0, 0, SHOULDER_Z))
    A.parent_keep_transform(neck, torso)

    # =========================================================================
    # HEAD — square louvred diffuser grille, tilted/rotated into "wrongness"
    # =========================================================================
    def build_head():
        size = 0.36
        depth = 0.07
        frame_t = 0.030
        parts = []
        # outer frame: 4 strips forming a hollow square ring (so louvres show through)
        for w_, h_, x_, y_ in (
            (size, frame_t, 0, size / 2 - frame_t / 2),
            (size, frame_t, 0, -size / 2 + frame_t / 2),
            (frame_t, size - frame_t * 2, -size / 2 + frame_t / 2, 0),
            (frame_t, size - frame_t * 2, size / 2 - frame_t / 2, 0),
        ):
            strip = A.prim_box("_headFrame", w_, depth, h_, location=(x_, 0, y_))
            parts.append(strip)
        frame_obj = A.join_objects(parts, "_headFrameJ")
        A.assign_material(frame_obj, mat_plate_dark)
        A.finish_hero_surface(frame_obj, bevel_width=0.0025, bevel_segments=2)

        # angled louvre blades spanning the aperture, gaps between them so you
        # can see through at an angle (per the ceiling-diffuser reference).
        blades = []
        n_blades = 7
        aperture = size - frame_t * 2
        for i in range(n_blades):
            t = (i + 0.5) / n_blades
            by = -aperture / 2 + t * aperture
            bl = A.prim_box(f"_blade{i}", aperture - 0.01, 0.006, depth * 0.68, location=(0, 0, by))
            bl.rotation_euler = (math.radians(38), 0, 0)
            A.apply_transforms(bl, loc=False, rot=True, scale=False)
            blades.append(bl)
        blade_obj = A.join_objects(blades, "_headBlades")
        A.assign_material(blade_obj, mat_louvre)
        A.finish_hero_surface(blade_obj, bevel_width=0.0015, bevel_segments=1)

        # a crossing mullion (vertical) — the "diffuser grid" cross-member
        mullion = A.prim_box("_mullion", 0.022, depth * 0.7, size - frame_t * 2, location=(0, 0, 0))
        A.assign_material(mullion, mat_plate_dark)
        A.finish_hero_surface(mullion, bevel_width=0.0015, bevel_segments=1)

        # corner fixing bolts
        bolts = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                bx, by = sx * (size / 2 - 0.022), sy * (size / 2 - 0.022)
                b = A.prim_cylinder(f"_hbolt{sx}_{sy}", 0.008, 0.014, segments=8, location=(bx, -depth / 2 - 0.002, by))
                b.rotation_euler = (math.pi / 2, 0, 0)
                A.apply_transforms(b, loc=False, rot=True, scale=False)
                bolts.append(b)
        bolt_obj = A.join_objects(bolts, "_headBolts")
        A.assign_material(bolt_obj, mat_rivet)
        A.finish_round_surface(bolt_obj)

        head = A.join_objects([frame_obj, blade_obj, mullion, bolt_obj], "head")
        # mount it: rotate to face forward (a ceiling grille normally faces
        # down; rotated 90 to serve as a head) plus a wrong, unsettling tilt.
        head.rotation_euler = (math.radians(90 + 6), math.radians(4), math.radians(16))
        A.apply_transforms(head, loc=False, rot=True, scale=False)
        # true WORLD position (head is still unparented at this point)
        head.location = (0, 0.01, HEAD_CENTER_Z)
        return head

    head = build_head()
    # finalize the pivot while still unparented (world coords == local coords
    # here); only parent AFTER, so parent_keep_transform's matrix math doesn't
    # have to reason about a parent transform that isn't applied yet.
    A.finalize_pivot(head, (0, 0, NECK_TOP_Z))
    A.parent_keep_transform(head, neck)

    # =========================================================================
    # ARMS — disproportionately long, over-segmented, flat measuring-blade hands
    # =========================================================================
    def build_arm(side):
        sx = side  # -1 left, +1 right
        shoulder_pt = Vector((sx * SHOULDER_X, 0.0, SHOULDER_Z - 0.03))
        # long, loosely A-posed: elbow drops and swings slightly out/back
        elbow_pt = shoulder_pt + Vector((sx * 0.10, 0.05, -0.72))
        wrist_pt = elbow_pt + Vector((sx * 0.05, 0.10, -0.80))

        def segmented_limb(name, p0, p1, r0, r1, n_bulges=4):
            main = A.cylinder_between(f"_{name}main", p0, p1, r0, r1, segments=10)
            parts = [main]
            length = (p1 - p0).length
            for i in range(1, n_bulges + 1):
                t = i / (n_bulges + 1)
                p = p0.lerp(p1, t)
                rr = (r0 + (r1 - r0) * t) * 1.22
                ring = A.prim_cylinder(f"_{name}ring{i}", rr, 0.018, segments=10, location=tuple(p))
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

        upper = segmented_limb("armUpper", shoulder_pt, elbow_pt, 0.052, 0.040, n_bulges=3)
        shoulder_collar = A.prim_cylinder("_shCollar", 0.066, 0.024, segments=12, location=tuple(shoulder_pt))
        A.assign_material(shoulder_collar, mat_joint)
        A.finish_round_surface(shoulder_collar)
        upper = A.join_objects([upper, shoulder_collar], "arm_upper")
        A.finalize_pivot(upper, tuple(shoulder_pt))

        lower = segmented_limb("armLower", elbow_pt, wrist_pt, 0.038, 0.028, n_bulges=4)
        elbow_collar = A.prim_cylinder("_elCollar", 0.050, 0.020, segments=12, location=tuple(elbow_pt))
        A.assign_material(elbow_collar, mat_joint)
        A.finish_round_surface(elbow_collar)
        lower = A.join_objects([lower, elbow_collar], "arm_lower")
        A.finalize_pivot(lower, tuple(elbow_pt))

        # hand: a flat measuring blade with ruler-tick marks
        blade_len, blade_w, blade_t = 0.24, 0.085, 0.012
        blade_dir = (wrist_pt - elbow_pt).normalized()
        blade_end = wrist_pt + blade_dir * blade_len
        blade = A.cylinder_between("_bladeCore", wrist_pt, blade_end, 0.026, 0.010, segments=8)
        flat = A.prim_box("_bladeFlat", blade_w, blade_len * 0.94, blade_t, location=(0, 0, 0))
        mid = wrist_pt.lerp(blade_end, 0.52)
        rot = blade_dir.to_track_quat('Y', 'Z')
        flat.rotation_euler = rot.to_euler()
        A.apply_transforms(flat, loc=False, rot=True, scale=False)
        flat.location = mid
        ticks = []
        for i in range(5):
            t = 0.12 + i * 0.18
            tp = wrist_pt.lerp(blade_end, t)
            tick = A.prim_box(f"_tick{i}", blade_w * 0.9, 0.006, blade_t * 1.6, location=(0, 0, 0))
            tick.rotation_euler = rot.to_euler()
            A.apply_transforms(tick, loc=False, rot=True, scale=False)
            tick.location = tp
            ticks.append(tick)
        wrist_collar = A.prim_cylinder("_wrCollar", 0.034, 0.018, segments=10, location=tuple(wrist_pt))
        hand_parts = [blade, flat] + ticks + [wrist_collar]
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
    # LEGS — thin, reversed at the knee
    # =========================================================================
    def build_leg(side):
        sx = side
        hip_pt = Vector((sx * HIP_X, 0.0, HIP_Z))
        # reversed knee: bends slightly FORWARD (+Y) instead of the human
        # backward bend — an unsettling, subtle bird-like joint even at rest.
        knee_pt = Vector((sx * HIP_X * 0.9, 0.045, KNEE_Z))
        ankle_pt = Vector((sx * HIP_X * 0.8, -0.01, ANKLE_Z))

        thigh = A.cylinder_between("_thigh", hip_pt, knee_pt, 0.062, 0.048, segments=10)
        hip_collar = A.prim_cylinder("_hipCollar", 0.076, 0.026, segments=12, location=tuple(hip_pt))
        A.assign_material(hip_collar, mat_joint)
        A.finish_round_surface(hip_collar)
        thigh = A.join_objects([thigh, hip_collar], "leg_upper")
        A.assign_material(thigh, mat_limb)
        A.finish_round_surface(thigh, weighted_normal=False)
        A.finalize_pivot(thigh, tuple(hip_pt))

        shin = A.cylinder_between("_shin", knee_pt, ankle_pt, 0.044, 0.034, segments=10)
        knee_collar = A.prim_cylinder("_kneeCollar", 0.058, 0.022, segments=12, location=tuple(knee_pt))
        A.assign_material(knee_collar, mat_joint)
        A.finish_round_surface(knee_collar)
        shin = A.join_objects([shin, knee_collar], "leg_lower")
        A.assign_material(shin, mat_limb)
        A.finish_round_surface(shin, weighted_normal=False)
        A.finalize_pivot(shin, tuple(knee_pt))

        foot = A.prim_box("_footBox", 0.075, 0.24, 0.045, location=(ankle_pt.x, ankle_pt.y + 0.09, ankle_pt.z - 0.022))
        ankle_collar = A.prim_cylinder("_ankleCollar", 0.040, 0.016, segments=10, location=tuple(ankle_pt))
        A.assign_material(ankle_collar, mat_joint)
        A.finish_round_surface(ankle_collar)
        A.assign_material(foot, mat_limb)
        A.finish_hero_surface(foot, bevel_width=0.003, bevel_segments=2)
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

    A.render_turntable(all_meshes, QA, res=760)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
