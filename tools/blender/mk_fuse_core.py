"""
fuse_core.glb — hand-carried ceramic-and-brass power core, ~0.22m tall.
The game's key puzzle item. Must read as a manufactured HV-insulator-style
component, not a thermos: sharp-shouldered ceramic sheds, a bezelled glass
inspection window with a filament, knurled brass caps with visible fixings,
a hinged carry handle with drilled lugs, and a stamped data plate.
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
    mat_ceramic = A.make_material("ceramic_ribbed", base_color=(0.78, 0.75, 0.65), roughness=0.68, metallic=0.0)
    mat_brass = A.make_material("brass", base_color=(0.68, 0.51, 0.19), roughness=0.35, metallic=1.0)
    mat_brass_dark = A.make_material("brass_oxidised", base_color=(0.38, 0.29, 0.13), roughness=0.55, metallic=0.9)
    mat_glass = A.make_material("glass", base_color=(0.85, 0.9, 0.9), roughness=0.04, metallic=0.0,
                                 alpha=0.35, transmission=0.95, ior=1.45)
    mat_emissive = A.make_material("emissive", base_color=(1.0, 0.55, 0.15), roughness=0.4,
                                    metallic=0.2, emission_color=(1.0, 0.5, 0.12), emission_strength=6.0)
    mat_handle = A.make_material("steel_worn", base_color=(0.20, 0.19, 0.18), roughness=0.5, metallic=0.85)
    mat_steel_pin = A.make_material("steel_pin", base_color=(0.5, 0.5, 0.52), roughness=0.3, metallic=0.9)
    mat_paper = A.make_material("stamped_label", base_color=(0.62, 0.60, 0.52), roughness=0.6, metallic=0.15)

    body_r = 0.044          # narrow "waist" radius
    top_z = 0.175

    # -- ceramic body: sharp-shouldered insulator sheds, varying diameter ----
    def shed(zi, z_h, r_narrow, r_wide, r_drip):
        """One shed unit: sharp outward shoulder + undercut drip edge."""
        return [
            (r_narrow, zi),
            (r_narrow * 1.01, zi + z_h * 0.14),
            (r_wide, zi + z_h * 0.42),          # sharp flare out (near-vertical shoulder)
            (r_drip, zi + z_h * 0.30),          # undercut sloping back in-and-down
            (r_narrow, zi + z_h),                # sharp corner back to the next waist
        ]

    profile = [(0.0, 0.0), (body_r * 0.92, 0.0), (body_r, 0.010)]
    n_sheds = 4
    z = 0.010
    span = 0.150
    seg_h = span / n_sheds
    for i in range(n_sheds):
        r_narrow = body_r * (0.90 - i * 0.03)
        r_wide = body_r * (1.28 - i * 0.05)
        r_drip = body_r * (1.05 - i * 0.04)
        profile += shed(z, seg_h, r_narrow, r_wide, r_drip)
        z += seg_h
    profile += [
        (body_r * 0.80, z + 0.006), (body_r * 0.70, top_z - 0.008),
        (body_r * 0.70, top_z), (0.0, top_z),
    ]
    body = A.lathe_profile("CeramicBody", profile, segments=20)
    A.assign_material(body, mat_ceramic)

    # window recess: a real stepped pocket (deep cut + a shallower bezel step)
    win_w, win_h, win_d = 0.030, 0.044, 0.020
    front_y = -body_r * 1.30
    cutter = A.prim_box("_winCut", win_w, win_h, win_d, location=(0, front_y - win_d / 2 + 0.010, 0.100))
    A.boolean_op(body, cutter, op='DIFFERENCE')
    bezel_cut = A.prim_box("_bezelCut", win_w + 0.010, win_h + 0.010, 0.006,
                            location=(0, front_y + 0.004, 0.100))
    A.boolean_op(body, bezel_cut, op='DIFFERENCE')

    A.shade_smooth_auto(body, 38)
    A.add_bevel(body, width=0.0014, segments=2, angle_deg=62)
    A.add_weighted_normal(body)

    # bezel frame (proud lip around the window) + 4 corner screws
    bezel = A.prim_box("_bezelFrame", win_w + 0.014, win_h + 0.014, 0.006,
                        location=(0, front_y + 0.006, 0.100))
    bezel_hole = A.prim_box("_bezelHole", win_w + 0.002, win_h + 0.002, 0.010,
                             location=(0, front_y + 0.006, 0.100))
    A.boolean_op(bezel, bezel_hole, op='DIFFERENCE')
    A.assign_material(bezel, mat_brass)
    A.finish_hero_surface(bezel, bevel_width=0.0012, bevel_segments=1)

    screws = []
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        cx = sx * (win_w / 2 + 0.010)
        cz = 0.100 + sz * (win_h / 2 + 0.010)
        s = A.prim_cylinder(f"_scr{sx}{sz}", 0.0028, 0.006, segments=8, location=(cx, front_y + 0.007, cz))
        s.rotation_euler = (math.pi / 2, 0, 0)
        A.apply_transforms(s, loc=False, rot=True, scale=False)
        screws.append(s)
    screw_obj = A.join_objects(screws, "WindowScrews")
    A.assign_material(screw_obj, mat_steel_pin)
    A.finish_round_surface(screw_obj)

    # -- brass base cap: chamfered contact face + hex wrench-flat band + rivets
    base_cap = A.lathe_profile("BrassBase", [
        (0.0, -0.024), (body_r * 1.12, -0.024), (body_r * 1.14, -0.020),  # flat foot + chamfer start
        (body_r * 1.14, -0.014), (body_r * 1.08, -0.010),                 # hex band height
        (body_r * 1.00, -0.004), (body_r * 0.95, 0.000), (0.0, 0.000),
    ], segments=18)
    A.assign_material(base_cap, mat_brass)
    A.finish_round_surface(base_cap)

    # hex wrench-flat band (six-sided prism) overlaid on the cap
    hex_r = body_r * 1.145
    hex_pts = [(hex_r * math.cos(math.radians(60 * i + 30)), hex_r * math.sin(math.radians(60 * i + 30))) for i in range(6)]
    hex_band = A.extrude_profile_along_z("_hexBase", hex_pts, 0.010, location=(0, 0, -0.017))
    A.assign_material(hex_band, mat_brass_dark)
    A.finish_hero_surface(hex_band, bevel_width=0.0008, bevel_segments=1)

    # base rivets fixing the cap to the ceramic (visible ring of fixings)
    base_rivets = []
    for i in range(6):
        ang = math.radians(60 * i)
        rx, ry = body_r * 0.90 * math.cos(ang), body_r * 0.90 * math.sin(ang)
        rv = A.prim_cylinder(f"_rivB{i}", 0.0032, 0.006, segments=8, location=(rx, ry, -0.003))
        base_rivets.append(rv)
    base_rivet_obj = A.join_objects(base_rivets, "BaseRivets")
    A.assign_material(base_rivet_obj, mat_steel_pin)
    A.finish_round_surface(base_rivet_obj)

    # three contact prongs under the base
    prongs = []
    for i in range(3):
        ang = math.radians(120 * i)
        px, py = 0.022 * math.cos(ang), 0.022 * math.sin(ang)
        p = A.prim_cylinder(f"_prong{i}", 0.0035, 0.014, segments=6, location=(px, py, -0.031))
        prongs.append(p)
    prong_obj = A.join_objects(prongs, "BrassProngs")
    A.assign_material(prong_obj, mat_brass)
    A.finish_round_surface(prong_obj)

    # -- brass top cap: chamfer + hex band + rivets + contact stud -----------
    top_cap = A.lathe_profile("BrassTop", [
        (0.0, top_z - 0.001), (body_r * 0.70, top_z - 0.001), (body_r * 0.78, top_z + 0.004),
        (body_r * 0.80, top_z + 0.010), (body_r * 0.74, top_z + 0.016),   # hex band height
        (body_r * 0.55, top_z + 0.021), (body_r * 0.36, top_z + 0.024),
        (0.018, top_z + 0.026), (0.0, top_z + 0.026),
    ], segments=18)
    stud = A.prim_cylinder("_stud", 0.0075, 0.013, segments=12, location=(0, 0, top_z + 0.032))
    top_cap = A.join_objects([top_cap, stud], "BrassTop")
    A.assign_material(top_cap, mat_brass)
    A.finish_round_surface(top_cap)

    hex_r_t = body_r * 0.80
    hex_pts_t = [(hex_r_t * math.cos(math.radians(60 * i + 30)), hex_r_t * math.sin(math.radians(60 * i + 30))) for i in range(6)]
    hex_band_t = A.extrude_profile_along_z("_hexTop", hex_pts_t, 0.008, location=(0, 0, top_z + 0.013))
    A.assign_material(hex_band_t, mat_brass_dark)
    A.finish_hero_surface(hex_band_t, bevel_width=0.0008, bevel_segments=1)

    top_rivets = []
    for i in range(6):
        ang = math.radians(60 * i + 30)
        rx, ry = body_r * 0.70 * math.cos(ang), body_r * 0.70 * math.sin(ang)
        rv = A.prim_cylinder(f"_rivT{i}", 0.0030, 0.006, segments=8, location=(rx, ry, top_z + 0.003))
        top_rivets.append(rv)
    top_rivet_obj = A.join_objects(top_rivets, "TopRivets")
    A.assign_material(top_rivet_obj, mat_steel_pin)
    A.finish_round_surface(top_rivet_obj)

    # -- carry handle: bail with flattened drilled lugs + hinge pins ----------
    handle_r = 0.058
    lug_y = body_r * 0.68
    hinge_z = top_z + 0.030
    arc_pts = []
    seg = 14
    for i in range(seg + 1):
        t = i / seg
        ang = math.pi * t
        y = -lug_y + (lug_y * 2) * t
        zz = hinge_z + handle_r * math.sin(ang)
        arc_pts.append((0.0, y, zz))
    bail = A.sweep_tube("Handle", arc_pts, 0.0052, tube_segments=6)
    A.assign_material(bail, mat_handle)
    A.finish_round_surface(bail, weighted_normal=False)

    lugs, pins = [], []
    for s in (-1, 1):
        ly = s * lug_y
        lug = A.prim_box(f"_lug{s}", 0.020, 0.010, 0.016, location=(0, ly, hinge_z))
        lugs.append(lug)
        pin = A.prim_cylinder(f"_pin{s}", 0.0026, 0.026, segments=8, location=(0, ly, hinge_z))
        pin.rotation_euler = (0, math.pi / 2, 0)
        A.apply_transforms(pin, loc=False, rot=True, scale=False)
        pins.append(pin)
    lug_obj = A.join_objects(lugs, "HandleLugs")
    A.assign_material(lug_obj, mat_handle)
    A.finish_hero_surface(lug_obj, bevel_width=0.0012, bevel_segments=1)
    pin_obj = A.join_objects(pins, "HingePins")
    A.assign_material(pin_obj, mat_steel_pin)
    A.finish_round_surface(pin_obj)

    # -- glass pane + filament -------------------------------------------------
    glass = A.prim_box("Glass", win_w * 0.90, win_h * 0.86, 0.002, location=(0, front_y + 0.009, 0.100))
    A.assign_material(glass, mat_glass)

    coords = [
        (-0.009, 0.100 + 0.013), (0.008, 0.100 + 0.005), (-0.008, 0.100 - 0.006), (0.009, 0.100 - 0.013),
    ]
    fil_parts = []
    prev = Vector((coords[0][0], front_y + 0.006, coords[0][1]))
    for cx, cz in coords[1:]:
        cur = Vector((cx, front_y + 0.006, cz))
        seg_obj = A.cylinder_between(f"_filseg", prev, cur, 0.0009, 0.0009, segments=6)
        fil_parts.append(seg_obj)
        prev = cur
    filament = A.join_objects(fil_parts, "Filament")
    A.assign_material(filament, mat_emissive)

    # -- stamped data plate + asset tag boss (raised/recessed geometry) -------
    plate_y = front_y + 0.001
    plate_z = 0.050
    plate = A.prim_box("_dataPlate", 0.040, 0.006, 0.026, location=(0, plate_y, plate_z))
    bars = []
    for i, bw in enumerate((0.028, 0.020, 0.024)):
        bar = A.prim_box(f"_bar{i}", bw, 0.010, 0.0035, location=(0, plate_y - 0.006, plate_z + 0.007 - i * 0.008))
        bars.append(bar)
    boss = A.prim_cylinder("_boss", 0.006, 0.008, segments=12, location=(0.020, plate_y - 0.003, plate_z - 0.012))
    boss.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(boss, loc=False, rot=True, scale=False)
    plate_obj = A.join_objects([plate] + bars + [boss], "DataPlate")
    A.assign_material(plate_obj, mat_paper)
    A.finish_hero_surface(plate_obj, bevel_width=0.0008, bevel_segments=1)

    # -- assemble hierarchy ---------------------------------------------------
    root = A.new_empty("fuse_core", (0, 0, 0))
    all_meshes = [body, bezel, screw_obj, base_cap, hex_band, base_rivet_obj, prong_obj,
                  top_cap, hex_band_t, top_rivet_obj, bail, lug_obj, pin_obj,
                  glass, filament, plate_obj]
    for o in all_meshes:
        A.parent_keep_transform(o, root)
        A.smart_uv(o, angle_limit_deg=58, island_margin=0.02)

    lo, hi = A._bounds_of(all_meshes)
    if lo.z < -0.0001:
        shift = -lo.z
        for o in all_meshes:
            o.location.z += shift

    tris = A.report_and_assert_tris(all_meshes, 6000, "fuse_core (hero prop, budget 12k, target well under)")
    A.print_hierarchy(root)

    A.render_turntable(all_meshes, QA)
    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
