"""
breaker_panel.glb — wall-mounted distribution board, 0.6 x 0.9 x 0.18m.
Hinged door (pivot_door) with a return flange, hinge knuckle set, quarter
turn latch and an internal card holder; DIN-railed interior with a main
isolator, 8 breaker units (switch_0..switch_7 are the pivoting TOGGLE
levers; bodies/rating windows/test buttons are static detail), a
neutral/earth terminal block, wiring looms into a gland plate, and
conduit knockouts (some punched through, some still blanked).

COORDINATE CONVENTION (Blender Z-up during authoring):
  x: width, centred (-W/2 .. +W/2)
  y: depth, y=0 is the BACK mounting face against the wall, +Y is outward
  z: height, z=0 is the vertical CENTRE of the box (-H/2 .. +H/2)
Root pivot: (0,0,0) == the wall mounting face.
Reminder: A.prim_box(name, w, h, d, location) maps w->X, h->Z(vertical), d->Y(depth).
"""
import sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import annex_lib as A
import bpy

OUT = "/home/user/Backrooms/public/assets/models/breaker_panel.glb"
QA = "/home/user/Backrooms/docs/assets/breaker_panel.png"

W, H, D = 0.6, 0.9, 0.18


def build():
    A.reset_scene()

    mat_enclosure = A.make_material("steel_painted_panel", base_color=(0.58, 0.57, 0.50), roughness=0.55, metallic=0.55)
    mat_interior = A.make_material("steel_dark", base_color=(0.14, 0.14, 0.15), roughness=0.6, metallic=0.6)
    mat_copper = A.make_material("copper_busbar", base_color=(0.72, 0.42, 0.20), roughness=0.35, metallic=1.0)
    mat_plastic = A.make_material("switch_plastic", base_color=(0.10, 0.10, 0.11), roughness=0.45, metallic=0.0)
    mat_toggle = A.make_material("switch_toggle", base_color=(0.85, 0.15, 0.1), roughness=0.35, metallic=0.0)
    mat_window = A.make_material("rating_window", base_color=(0.8, 0.8, 0.75), roughness=0.3, metallic=0.0)
    mat_label = A.make_material("label_plate", base_color=(0.85, 0.83, 0.74), roughness=0.5, metallic=0.0)
    mat_paper = A.make_material("paper_schedule", base_color=(0.88, 0.87, 0.80), roughness=0.85, metallic=0.0)
    mat_chrome = A.make_material("chrome_latch", base_color=(0.7, 0.7, 0.72), roughness=0.25, metallic=1.0)
    mat_knockout = A.make_material("galv_steel", base_color=(0.45, 0.46, 0.44), roughness=0.5, metallic=0.8)
    mat_din = A.make_material("din_rail", base_color=(0.75, 0.72, 0.55), roughness=0.4, metallic=0.7)
    mat_cable = A.make_material("cable_insulation", base_color=(0.08, 0.08, 0.08), roughness=0.7, metallic=0.0)
    mat_terminal = A.make_material("terminal_block", base_color=(0.15, 0.35, 0.16), roughness=0.5, metallic=0.0)

    root = A.new_empty("breaker_panel", (0, 0, 0))
    wall_t = 0.014

    # -- outer enclosure with a rolled/folded lip around the front opening ----
    encl = A.prim_box("Enclosure", W, H, D, location=(0, D / 2, 0))
    cavity = A.prim_box("_cavity", W - wall_t * 2, H - wall_t * 2, D, location=(0, D / 2 + wall_t, 0))
    A.boolean_op(encl, cavity, op='DIFFERENCE')
    A.assign_material(encl, mat_enclosure)
    A.finish_hero_surface(encl, bevel_width=0.003, bevel_segments=2)

    lip_parts = []
    lip_t = 0.010
    for w_, h_, x_, z_ in (
        (W - wall_t * 2 + lip_t, lip_t * 1.4, 0, H / 2 - wall_t - lip_t * 0.3),
        (W - wall_t * 2 + lip_t, lip_t * 1.4, 0, -H / 2 + wall_t + lip_t * 0.3),
        (lip_t * 1.4, H - wall_t * 2, -W / 2 + wall_t + lip_t * 0.3, 0),
        (lip_t * 1.4, H - wall_t * 2, W / 2 - wall_t - lip_t * 0.3, 0),
    ):
        strip = A.prim_box("_lip", w_, h_, lip_t, location=(x_, D + lip_t / 2 - 0.001, z_))
        lip_parts.append(strip)
    lip = A.join_objects(lip_parts, "FrontLip")
    A.assign_material(lip, mat_enclosure)
    A.finish_hero_surface(lip, bevel_width=0.0022, bevel_segments=2)

    # -- interior backplate ----------------------------------------------------
    back_y = 0.05
    backplate = A.prim_box("Backplate", W - wall_t * 2 - 0.01, H - wall_t * 2 - 0.01, 0.012,
                            location=(0, back_y, 0))
    A.assign_material(backplate, mat_interior)
    A.finish_hero_surface(backplate, bevel_width=0.0015, bevel_segments=1)

    # -- busbars -----------------------------------------------------------------
    busbars = []
    for bz in (H * 0.33, H * 0.25):
        bar = A.prim_box(f"_bus{bz}", W - 0.12, 0.022, 0.02, location=(0, back_y + 0.02, bz))
        busbars.append(bar)
    busbar_obj = A.join_objects(busbars, "Busbars")
    A.assign_material(busbar_obj, mat_copper)
    A.finish_hero_surface(busbar_obj, bevel_width=0.002, bevel_segments=1)

    # -- DIN rail behind the breaker row -----------------------------------------
    din_z = 0.02 - 0.052
    din_profile = [(-0.017, 0), (0.017, 0), (0.017, 0.004), (0.0075, 0.008), (0.0075, 0.016),
                   (-0.0075, 0.016), (-0.0075, 0.008), (-0.017, 0.004)]
    din_rail = A.extrude_profile_along_z("_dinTop", din_profile, W - 0.10, location=(0, 0, 0))
    din_rail.rotation_euler = (0, math.pi / 2, 0)
    A.apply_transforms(din_rail, loc=False, rot=True, scale=False)
    din_rail.location = (0, back_y + 0.018, din_z)
    din_rail2 = A.duplicate(din_rail, "_dinBot")
    din_rail2.location = (0, back_y + 0.018, din_z - 0.185)
    din_obj = A.join_objects([din_rail, din_rail2], "DinRails")
    A.assign_material(din_obj, mat_din)
    A.finish_round_surface(din_obj)

    # -- 8 breaker units: static body/window/button + pivoting toggle -----------
    sw_w, sw_h, sw_d = 0.052, 0.085, 0.045
    gap_x, gap_z = 0.064, 0.105
    start_x = -(gap_x * 1.5)
    row_z = [0.02, 0.02 - gap_z]
    base_y = back_y + 0.02

    static_parts = []  # (obj, material)
    switch_objs = []
    idx = 0
    for z0 in row_z:
        for col in range(4):
            x0 = start_x + col * gap_x
            body = A.prim_box(f"_swbody{idx}", sw_w, sw_h, sw_d, location=(x0, base_y + sw_d / 2, z0))
            static_parts.append((body, mat_plastic))
            window = A.prim_box(f"_swwin{idx}", sw_w * 0.5, sw_h * 0.20, 0.004,
                                 location=(x0, base_y + sw_d + 0.001, z0 + sw_h * 0.30))
            static_parts.append((window, mat_window))
            test_btn = A.prim_box(f"_swtest{idx}", sw_w * 0.22, sw_h * 0.10, 0.006,
                                   location=(x0 - sw_w * 0.30, base_y + sw_d + 0.002, z0 + sw_h * 0.30))
            static_parts.append((test_btn, mat_plastic))
            # two small fixing screws on the body face
            for sxo in (-1, 1):
                scr = A.prim_cylinder(f"_swscrew{idx}_{sxo}", 0.0025, 0.005, segments=6,
                                       location=(x0 + sxo * sw_w * 0.38, base_y + sw_d + 0.001, z0 - sw_h * 0.35))
                scr.rotation_euler = (math.pi / 2, 0, 0)
                A.apply_transforms(scr, loc=False, rot=True, scale=False)
                static_parts.append((scr, mat_window))

            toggle = A.prim_box(f"_swtog{idx}", sw_w * 0.42, sw_h * 0.46, 0.018,
                                 location=(x0, base_y + sw_d + 0.006, z0 + sw_h * 0.15))
            A.assign_material(toggle, mat_toggle)
            A.finish_hero_surface(toggle, bevel_width=0.0018, bevel_segments=1)
            toggle.name = f"switch_{idx}"
            pivot_pt = (x0, base_y + sw_d, z0 - sw_h * 0.10)
            A.finalize_pivot(toggle, pivot_pt)
            switch_objs.append(toggle)
            idx += 1

    # -- main isolator: larger unit above the branch breakers --------------------
    iso_w, iso_h, iso_d = 0.10, 0.11, 0.05
    iso_z = H * 0.33 - 0.10
    iso_body = A.prim_box("_isoBody", iso_w, iso_h, iso_d, location=(0, base_y + iso_d / 2, iso_z))
    static_parts.append((iso_body, mat_plastic))
    iso_window = A.prim_box("_isoWin", iso_w * 0.5, iso_h * 0.18, 0.004, location=(0, base_y + iso_d + 0.001, iso_z + iso_h * 0.28))
    static_parts.append((iso_window, mat_window))
    iso_toggle = A.prim_box("main_isolator", iso_w * 0.5, iso_h * 0.5, 0.020, location=(0, base_y + iso_d + 0.006, iso_z + iso_h * 0.05))
    A.assign_material(iso_toggle, mat_toggle)
    A.finish_hero_surface(iso_toggle, bevel_width=0.002, bevel_segments=1)
    A.finalize_pivot(iso_toggle, (0, base_y + iso_d, iso_z - iso_h * 0.20))

    # -- neutral/earth terminal block --------------------------------------------
    term_y = back_y + 0.018
    term_z = min(row_z) - 0.10
    term_block = A.prim_box("_termBlock", W - 0.18, 0.045, 0.030, location=(0, term_y + 0.015, term_z))
    static_parts.append((term_block, mat_terminal))
    term_screws = []
    n_term = 7
    for i in range(n_term):
        tx = -( (W - 0.24) / 2) + i * (W - 0.24) / (n_term - 1)
        s = A.prim_cylinder(f"_termScrew{i}", 0.004, 0.008, segments=8, location=(tx, term_y + 0.030, term_z))
        s.rotation_euler = (math.pi / 2, 0, 0)
        A.apply_transforms(s, loc=False, rot=True, scale=False)
        term_screws.append(s)
    term_screw_obj = A.join_objects(term_screws, "_termScrews")
    static_parts.append((term_screw_obj, mat_window))

    # -- wiring looms from each breaker down to a gland plate --------------------
    gland_z = -H / 2 + wall_t + 0.05
    loom_parts = []
    for i in range(8):
        z0 = row_z[i // 4]
        x0 = start_x + (i % 4) * gap_x
        p0 = (x0, base_y + sw_d * 0.6, z0 - sw_h * 0.5)
        p1 = (x0 * 0.5, base_y + 0.03, gland_z + 0.06)
        p2 = (0, base_y + 0.02, gland_z + 0.01)
        loom = A.sweep_tube(f"_loom{i}", [p0, p1, p2], 0.003, tube_segments=5)
        loom_parts.append(loom)
    loom_obj = A.join_objects(loom_parts, "WiringLooms")
    A.assign_material(loom_obj, mat_cable)
    A.finish_round_surface(loom_obj, weighted_normal=False)

    gland_plate = A.prim_box("_glandPlate", W - 0.20, 0.05, 0.010, location=(0, back_y + 0.015, gland_z))
    static_parts.append((gland_plate, mat_interior))
    glands = []
    for gx in (-0.10, 0.0, 0.10):
        g = A.prim_cylinder(f"_gland{gx}", 0.014, 0.012, segments=14, location=(gx, back_y + 0.021, gland_z))
        g.rotation_euler = (math.pi / 2, 0, 0)
        A.apply_transforms(g, loc=False, rot=True, scale=False)
        glands.append(g)
    gland_obj = A.join_objects(glands, "_glandRings")
    static_parts.append((gland_obj, mat_din))

    # -- conduit knockouts on the top face: some punched, some blanked -----------
    knockouts_blank = []
    knockouts_punched_rings = []
    for i, kx in enumerate((-0.18, 0.0, 0.18)):
        if i == 1:
            ring = A.prim_cylinder(f"_koRing{i}", 0.028, wall_t * 1.3, segments=20, location=(kx, D * 0.55, H / 2 - wall_t / 2))
            hole = A.prim_cylinder(f"_koHole{i}", 0.020, wall_t * 2, segments=20, location=(kx, D * 0.55, H / 2 - wall_t / 2))
            A.boolean_op(ring, hole, op='DIFFERENCE')
            knockouts_punched_rings.append(ring)
        else:
            k = A.prim_cylinder(f"_ko{i}", 0.028, wall_t * 0.3, segments=20, location=(kx, D * 0.55, H / 2 - wall_t * 0.65))
            knockouts_blank.append(k)
    knockout_obj = A.join_objects(knockouts_blank + knockouts_punched_rings, "Knockouts")
    A.assign_material(knockout_obj, mat_knockout)
    A.finish_round_surface(knockout_obj)

    # merge all static interior detail into one object with multiple slots
    static_objs = []
    mat_used = []
    for o, m in static_parts:
        A.assign_material(o, m)
        static_objs.append(o)
    interior_detail = A.join_objects(static_objs, "InteriorDetail")
    A.finish_hero_surface(interior_detail, bevel_width=0.0015, bevel_segments=1)

    # -- door leaf: return flange, hinge knuckles, quarter-turn latch,
    #    stiffening rib, card holder + paper schedule -----------------------------
    hinge_x = -W / 2 + 0.02
    door_w, door_h, door_d = W - 0.01, H - 0.01, 0.020
    door_mesh_center_x = hinge_x + door_w / 2 - 0.005
    # The door sits just inside the front lip (near y=D), NOT tucked back
    # near the wall — a door mounted deep inside the cavity would read as
    # permanently ajar even at rest=0 rotation.
    door_front_y = D - door_d / 2 - 0.006
    inside_y = door_front_y - door_d / 2   # the face toward the cavity/wall
    outside_y = door_front_y + door_d / 2  # the face toward the room
    door = A.prim_box("_doorFace", door_w, door_h, door_d, location=(door_mesh_center_x, door_front_y, 0))

    # return flange: a thin frame folded back off the door's perimeter,
    # toward the wall, so it overlaps the enclosure's inner lip when closed.
    flange_t = 0.016
    flange_parts = []
    for w_, h_, x_, z_ in (
        (door_w, flange_t, door_mesh_center_x, door_h / 2 - flange_t / 2),
        (door_w, flange_t, door_mesh_center_x, -door_h / 2 + flange_t / 2),
        (flange_t, door_h, hinge_x + flange_t / 2, 0),
        (flange_t, door_h, hinge_x + door_w - flange_t / 2, 0),
    ):
        strip = A.prim_box("_flange", w_, h_, 0.014, location=(x_, inside_y - 0.006, z_))
        flange_parts.append(strip)
    flange = A.join_objects(flange_parts, "_flange")

    # stiffening ribs pressed into the inside face
    ribs = []
    for rz in (door_h * 0.2, -door_h * 0.2):
        rib = A.prim_box("_rib", door_w - 0.10, 0.012, 0.008, location=(door_mesh_center_x, inside_y - 0.003, rz))
        ribs.append(rib)
    rib_obj = A.join_objects(ribs, "_ribs")

    # card holder: a shallow U-bracket on the inside face
    holder_parts = []
    hold_w, hold_h = 0.16, 0.11
    hold_x, hold_z = hinge_x + door_w * 0.62, 0.0
    for w_, h_, x_, z_ in (
        (hold_w, 0.010, hold_x, hold_z + hold_h / 2),
        (0.010, hold_h, hold_x - hold_w / 2, hold_z),
        (0.010, hold_h, hold_x + hold_w / 2, hold_z),
        (hold_w, 0.010, hold_x, hold_z - hold_h / 2),
    ):
        strip = A.prim_box("_holder", w_, h_, 0.012, location=(x_, inside_y - 0.005, z_))
        holder_parts.append(strip)
    holder = A.join_objects(holder_parts, "_cardHolder")

    # hinge knuckle set: 3 short knuckles per hinge line, alternating gaps
    hinges = []
    for hz_base in (H * 0.32, -H * 0.32):
        for k in range(3):
            hz = hz_base + (k - 1) * 0.028
            hg = A.prim_cylinder(f"_hg{hz_base}_{k}", 0.015, 0.022, segments=12, location=(hinge_x + 0.006, door_front_y - 0.004, hz))
            hinges.append(hg)

    door_full_parts = [door, flange, rib_obj, holder] + hinges
    for o in door_full_parts:
        A.assign_material(o, mat_enclosure)
    door_full = A.join_objects(door_full_parts, "DoorLeaf")
    A.finish_hero_surface(door_full, bevel_width=0.0025, bevel_segments=2)

    # quarter-turn latch: round disc with a screwdriver slot, on the OUTSIDE
    # (room-facing) face of the door.
    latch_cx = hinge_x + door_w - 0.05
    latch_disc = A.prim_cylinder("_latchDisc", 0.022, 0.014, segments=20, location=(latch_cx, outside_y + 0.007, 0))
    latch_disc.rotation_euler = (math.pi / 2, 0, 0)
    A.apply_transforms(latch_disc, loc=False, rot=True, scale=False)
    slot_cut = A.prim_box("_latchSlot", 0.030, 0.005, 0.006, location=(latch_cx, outside_y + 0.014, 0))
    A.boolean_op(latch_disc, slot_cut, op='DIFFERENCE')
    A.assign_material(latch_disc, mat_chrome)
    A.finish_hero_surface(latch_disc, bevel_width=0.0015, bevel_segments=1)

    # paper circuit schedule, sitting in the card holder (inside face)
    schedule = A.prim_box("ScheduleCard", hold_w - 0.02, hold_h - 0.02, 0.002,
                           location=(hold_x, inside_y - 0.009, hold_z))
    A.assign_material(schedule, mat_paper)
    A.finish_hero_surface(schedule, bevel_width=0.0008, bevel_segments=1)

    pivot_door = A.new_empty("pivot_door", (hinge_x, 0, 0))
    for o in (door_full, latch_disc, schedule):
        A.parent_keep_transform(o, pivot_door)

    # -- schedule label plate on the backplate (visible with door open) ---------
    label = A.prim_box("LabelPlate", W - 0.16, 0.09, 0.006, location=(0, back_y + 0.015, min(row_z) - 0.155))
    A.assign_material(label, mat_label)
    A.finish_hero_surface(label, bevel_width=0.0012, bevel_segments=1)

    # -- assemble -----------------------------------------------------------------
    top_objs = [encl, lip, backplate, busbar_obj, din_obj, interior_detail,
                loom_obj, gland_obj if False else None, knockout_obj, label, pivot_door] + switch_objs + [iso_toggle]
    top_objs = [o for o in top_objs if o is not None]
    for o in top_objs:
        A.parent_keep_transform(o, root)

    all_meshes = [encl, lip, backplate, busbar_obj, din_obj, interior_detail, loom_obj,
                  knockout_obj, label, door_full, latch_disc, schedule] + switch_objs + [iso_toggle]
    for o in all_meshes:
        A.smart_uv(o, angle_limit_deg=60, island_margin=0.03)

    tris = A.report_and_assert_tris(all_meshes, 12000, "breaker_panel (hero prop)")
    A.print_hierarchy(root)

    # Hide the door for the QA render so the interior is actually visible;
    # tilt a couple of toggles to show the working pivot.
    door_full.hide_render = True
    latch_disc.hide_render = True
    schedule.hide_render = True
    for i, s in enumerate(switch_objs):
        if i % 2 == 0:
            s.rotation_euler = (math.radians(18), 0, 0)
    bpy.context.view_layer.update()
    A.render_turntable(all_meshes, QA, front_sign=1)
    door_full.hide_render = False
    latch_disc.hide_render = False
    schedule.hide_render = False
    for s in switch_objs:
        s.rotation_euler = (0, 0, 0)

    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
