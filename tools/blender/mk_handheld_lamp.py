"""
handheld_lamp.glb — the player's inspection lamp, 0.24m overall. Rubber grip,
steel wire cage over the bulb, a hook, a coiled cable stub, a slide switch.
Most-detailed prop since it's held in first person.

COORDINATE CONVENTION: origin at the CENTRE of the hand grip. +Y is "forward"
(toward the bulb/cage). The hook hangs from the rear on -Z, the cable exits
the rear cap toward -Y.
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A

OUT = "/home/user/Backrooms/public/assets/models/handheld_lamp.glb"
QA = "/home/user/Backrooms/docs/assets/handheld_lamp.png"


def build():
    A.reset_scene()

    mat_rubber = A.make_material("rubber_grip", base_color=(0.05, 0.05, 0.055), roughness=0.9, metallic=0.0)
    mat_steel = A.make_material("steel_lamp", base_color=(0.55, 0.55, 0.57), roughness=0.35, metallic=0.9)
    mat_steel_dark = A.make_material("steel_lamp_dark", base_color=(0.32, 0.32, 0.33), roughness=0.5, metallic=0.8)
    mat_glass = A.make_material("bulb_glass", base_color=(1.0, 0.97, 0.85), roughness=0.05, metallic=0.0,
                                 alpha=0.5, transmission=0.9, ior=1.4)
    mat_filament = A.make_material("bulb_filament", base_color=(1.0, 0.85, 0.5), roughness=0.3, metallic=0.1,
                                    emission_color=(1.0, 0.82, 0.45), emission_strength=8.0)
    mat_cable = A.make_material("cable_rubber", base_color=(0.02, 0.02, 0.02), roughness=0.85, metallic=0.0)
    mat_fastener = A.make_material("fastener_steel", base_color=(0.42, 0.42, 0.44), roughness=0.4, metallic=0.85)

    root = A.new_empty("handheld_lamp", (0, 0, 0))

    # -- rubber grip: ribbed lathe cylinder ------------------------------------
    grip_r = 0.017
    grip_profile = [(0.0, -0.065), (grip_r, -0.065), (grip_r * 1.05, -0.06)]
    n_ribs = 6
    for i in range(n_ribs):
        y0 = -0.05 + 0.095 * i / (n_ribs - 1)
        grip_profile.append((grip_r * 1.12, y0 - 0.006))
        grip_profile.append((grip_r * 0.95, y0))
        grip_profile.append((grip_r * 1.12, y0 + 0.006))
    grip_profile += [(grip_r * 1.05, 0.05), (grip_r, 0.058), (0.0, 0.058)]
    # lathe_profile revolves (radius, z) about Z; we want the grip's axis
    # along Y, so build about Z then rotate 90 about X.
    grip = A.lathe_profile("Grip", grip_profile, segments=14)
    grip.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(grip, loc=False, rot=True, scale=False)
    A.assign_material(grip, mat_rubber)
    A.finish_round_surface(grip)

    # rear cap (steel) closing the grip's back end, with 3 visible fixing
    # screws — the strongest cheap "this was manufactured" signal.
    rear_cap = A.prim_cylinder("_rearcap", grip_r * 1.02, 0.012, segments=14, location=(0, -0.071, 0))
    rear_cap.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(rear_cap, loc=False, rot=True, scale=False)
    A.assign_material(rear_cap, mat_steel_dark)
    A.finish_round_surface(rear_cap)

    rear_screws = []
    for i in range(3):
        ang = math.radians(120 * i + 20)
        sx, sz = grip_r * 0.65 * math.cos(ang), grip_r * 0.65 * math.sin(ang)
        scr = A.prim_cylinder(f"_rearScrew{i}", 0.0022, 0.004, segments=6, location=(sx, -0.0715, sz))
        scr.rotation_euler = (math.pi / 2, 0, 0)
        A.apply_transforms(scr, loc=False, rot=True, scale=False)
        rear_screws.append(scr)
    rear_screw_obj = A.join_objects(rear_screws, "_rearScrews")
    A.assign_material(rear_screw_obj, mat_fastener)
    A.finish_round_surface(rear_screw_obj)

    # cable strain-relief clamp band, just behind the cap where the coil exits
    clamp = A.prim_cylinder("_cableClamp", 0.0068, 0.006, segments=12, location=(0, -0.077, 0))
    clamp.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(clamp, loc=False, rot=True, scale=False)
    A.assign_material(clamp, mat_fastener)
    A.finish_round_surface(clamp)

    # slide switch: a small rectangular nub in a milled slot on the grip
    switch_y = -0.01
    slot = A.prim_box("_slot", 0.006, 0.032, 0.010, location=(grip_r * 0.95, switch_y, 0))
    switch_nub = A.prim_box("switch_slide", 0.010, 0.014, 0.008, location=(grip_r * 1.0, switch_y - 0.006, 0))
    A.assign_material(switch_nub, mat_steel)
    A.finish_hero_surface(switch_nub, bevel_width=0.0012, bevel_segments=1)
    A.finalize_pivot(switch_nub, (grip_r * 0.95, switch_y, 0))
    slot.hide_render = True  # was only a placement guide
    A.select_only(slot)
    import bpy
    bpy.data.objects.remove(slot, do_unlink=True)

    # -- head housing: steel collar between grip and cage ----------------------
    head_profile = [
        (grip_r, 0.058), (0.026, 0.062), (0.032, 0.070), (0.032, 0.082), (0.026, 0.088), (0.0, 0.088),
    ]
    head = A.lathe_profile("HeadHousing", head_profile, segments=16)
    head.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(head, loc=False, rot=True, scale=False)
    A.assign_material(head, mat_steel)
    A.finish_round_surface(head)

    # ferrule ring marking the grip/housing seam — a real join, not a blend
    ferrule = A.prim_cylinder("_ferrule", grip_r * 1.10, 0.006, segments=16, location=(0, 0.056, 0))
    ferrule.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(ferrule, loc=False, rot=True, scale=False)
    A.assign_material(ferrule, mat_fastener)
    A.finish_round_surface(ferrule)

    # cage mounting screws where the rear ring meets the housing
    cage_mount_screws = []
    for i in range(3):
        ang = math.radians(120 * i)
        sx, sz = 0.026 * math.cos(ang), 0.026 * math.sin(ang)
        scr = A.prim_cylinder(f"_cageMount{i}", 0.0024, 0.006, segments=6, location=(sx, 0.083, sz))
        scr.rotation_euler = (math.pi / 2, 0, 0)
        A.apply_transforms(scr, loc=False, rot=True, scale=False)
        cage_mount_screws.append(scr)
    cage_mount_obj = A.join_objects(cage_mount_screws, "_cageMounts")
    A.assign_material(cage_mount_obj, mat_fastener)
    A.finish_round_surface(cage_mount_obj)

    # reflector cup (recessed, behind the bulb)
    reflector = A.lathe_profile("_reflector", [
        (0.0, 0.070), (0.024, 0.074), (0.028, 0.082), (0.020, 0.086), (0.0, 0.086),
    ], segments=16)
    reflector.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(reflector, loc=False, rot=True, scale=False)
    A.assign_material(reflector, mat_steel)
    A.finish_round_surface(reflector)

    # -- bulb ---------------------------------------------------------------
    bulb_y = 0.108
    bulb = A.prim_sphere("Bulb", 0.020, segments=14, rings=10, location=(0, bulb_y, 0))
    A.assign_material(bulb, mat_glass)
    filament_pts = [
        (0, bulb_y - 0.010, 0), (0.007, bulb_y - 0.003, 0.005), (-0.006, bulb_y + 0.004, -0.004),
        (0.006, bulb_y + 0.010, 0.004), (0, bulb_y + 0.014, 0),
    ]
    filament = A.sweep_tube("Filament", filament_pts, 0.0014, tube_segments=5)
    A.assign_material(filament, mat_filament)

    # -- wire cage: 6 longitudinal wires + front/rear rings ---------------------
    cage_front_y, cage_rear_y = 0.135, 0.084
    cage_r_mid = 0.030
    n_wires = 6
    cage_parts = []
    for i in range(n_wires):
        ang = 2 * math.pi * i / n_wires
        cx, cz = math.cos(ang), math.sin(ang)
        path = []
        for t in (0.0, 0.25, 0.5, 0.75, 1.0):
            yy = cage_rear_y + (cage_front_y - cage_rear_y) * t
            rr = cage_r_mid * math.sin(math.pi * t) * 1.0 + 0.024 * (1 - math.sin(math.pi * t))
            path.append((cx * rr, yy, cz * rr))
        wire = A.sweep_tube(f"_wire{i}", path, 0.0016, tube_segments=5)
        cage_parts.append(wire)
    # front + rear rings
    ring_front = A.prim_torus("_ringF", cage_r_mid * 0.62, 0.0016, major_seg=20, minor_seg=6, location=(0, cage_front_y - 0.006, 0))
    ring_front.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(ring_front, loc=False, rot=True, scale=False)
    ring_rear = A.prim_torus("_ringR", 0.026, 0.0016, major_seg=20, minor_seg=6, location=(0, cage_rear_y, 0))
    ring_rear.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(ring_rear, loc=False, rot=True, scale=False)
    cage_parts += [ring_front, ring_rear]
    cage = A.join_objects(cage_parts, "WireCage")
    A.assign_material(cage, mat_steel)
    A.finish_round_surface(cage, weighted_normal=False)

    # -- hook: bent rod off the rear, hanging on -Z -----------------------------
    hook_path = [
        (0, -0.058, grip_r * 0.9), (0, -0.066, 0.020), (0, -0.072, 0.032),
        (0, -0.082, 0.032), (0, -0.090, 0.022), (0, -0.088, 0.010),
    ]
    hook = A.sweep_tube("Hook", hook_path, 0.0026, tube_segments=6)
    A.assign_material(hook, mat_steel_dark)
    A.finish_round_surface(hook, weighted_normal=False)

    # -- coiled cable stub exiting the rear cap ---------------------------------
    coil_pts = A.helix_points(turns=3.2, radius=0.011, pitch=0.014, segments_per_turn=10,
                               start=(0, -0.075, 0), axis='Y')
    coil_pts = [(x, y, z) for (x, y, z) in coil_pts]
    # re-sign so it travels toward -Y (backward, out of the grip)
    coil_pts = [(x, -0.075 - (y - (-0.075)), z) for (x, y, z) in coil_pts]
    cable = A.sweep_tube("CableStub", coil_pts, 0.0032, tube_segments=6)
    A.assign_material(cable, mat_cable)
    A.finish_round_surface(cable, weighted_normal=False)

    # -- assemble ----------------------------------------------------------------
    parts = [grip, rear_cap, rear_screw_obj, clamp, switch_nub, head, ferrule, cage_mount_obj,
             reflector, bulb, filament, cage, hook, cable]
    for o in parts:
        A.parent_keep_transform(o, root)

    for o in parts:
        A.smart_uv(o, angle_limit_deg=55, island_margin=0.025)

    tris = A.report_and_assert_tris(parts, 6000, "handheld_lamp (hero prop, first-person detail)")
    A.print_hierarchy(root)

    A.render_turntable(parts, QA)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
