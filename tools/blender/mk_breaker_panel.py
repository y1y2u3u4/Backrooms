"""
breaker_panel.glb — wall-mounted distribution board, 0.6 x 0.9 x 0.18m.
Hinged door (pivot_door), 8 individually-modelled breaker switches
(switch_0..switch_7, each pivoting), busbars, schematic label plate,
conduit knockouts.

COORDINATE CONVENTION (Blender Z-up during authoring):
  x: width, centred (-W/2 .. +W/2)
  y: depth, y=0 is the BACK mounting face against the wall, +Y is outward
  z: height, z=0 is the vertical CENTRE of the box (-H/2 .. +H/2)

Pivot: root sits at (0,0,0) == the wall mounting face, per the "wall-mounted
props pivot at the mounting face" convention.

Reminder for future scripts: A.prim_box(name, w, h, d, location) maps
w->X, h->Z(vertical), d->Y(depth). Always pass (width, height, depth).
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
    mat_plastic = A.make_material("switch_plastic", base_color=(0.05, 0.05, 0.05), roughness=0.45, metallic=0.0)
    mat_toggle = A.make_material("switch_toggle", base_color=(0.85, 0.15, 0.1), roughness=0.35, metallic=0.0)
    mat_label = A.make_material("label_plate", base_color=(0.85, 0.83, 0.74), roughness=0.5, metallic=0.0)
    mat_chrome = A.make_material("chrome_latch", base_color=(0.7, 0.7, 0.72), roughness=0.25, metallic=1.0)
    mat_knockout = A.make_material("galv_steel", base_color=(0.45, 0.46, 0.44), roughness=0.5, metallic=0.8)

    root = A.new_empty("breaker_panel", (0, 0, 0))
    wall_t = 0.014

    # -- outer enclosure: a real box shell (back + 4 sides), open front -------
    encl = A.prim_box("Enclosure", W, H, D, location=(0, D / 2, 0))
    cavity = A.prim_box("_cavity", W - wall_t * 2, H - wall_t * 2, D, location=(0, D / 2 + wall_t, 0))
    A.boolean_op(encl, cavity, op='DIFFERENCE')
    A.assign_material(encl, mat_enclosure)
    A.finish_hero_surface(encl, bevel_width=0.003, bevel_segments=2)
    A.parent_keep_transform(encl, root)

    # -- interior backplate + busbars ------------------------------------------
    back_y = 0.05
    backplate = A.prim_box("Backplate", W - wall_t * 2 - 0.01, H - wall_t * 2 - 0.01, 0.012,
                            location=(0, back_y, 0))
    A.assign_material(backplate, mat_interior)
    A.finish_hero_surface(backplate, bevel_width=0.0015, bevel_segments=1)
    A.parent_keep_transform(backplate, root)

    busbars = []
    for i, bz in enumerate((H * 0.33, H * 0.25)):
        bar = A.prim_box(f"_bus{i}", W - 0.12, 0.022, 0.02, location=(0, back_y + 0.02, bz))
        busbars.append(bar)
    busbar_obj = A.join_objects(busbars, "Busbars")
    A.assign_material(busbar_obj, mat_copper)
    A.finish_hero_surface(busbar_obj, bevel_width=0.002, bevel_segments=1)
    A.parent_keep_transform(busbar_obj, root)

    # -- 8 breaker switches, 2 rows of 4 ---------------------------------------
    sw_w, sw_h, sw_d = 0.052, 0.085, 0.045
    gap_x, gap_z = 0.064, 0.105
    start_x = -(gap_x * 1.5)
    row_z = [0.02, 0.02 - gap_z]
    switch_objs = []
    idx = 0
    for z0 in row_z:
        for col in range(4):
            x0 = start_x + col * gap_x
            base_y = back_y + 0.02
            base = A.prim_box(f"_swbase{idx}", sw_w, sw_h, sw_d, location=(x0, base_y + sw_d / 2, z0))
            toggle = A.prim_box(f"_swtog{idx}", sw_w * 0.42, sw_h * 0.46, 0.018,
                                 location=(x0, base_y + sw_d + 0.006, z0 + sw_h * 0.15))
            A.assign_material(base, mat_plastic)
            A.assign_material(toggle, mat_toggle)
            A.finish_hero_surface(base, bevel_width=0.0025, bevel_segments=1)
            A.finish_hero_surface(toggle, bevel_width=0.002, bevel_segments=1)
            switch = A.join_objects([base, toggle], f"switch_{idx}")
            # pivot at the hinge line where the toggle meets the switch face
            pivot_pt = (x0, base_y + sw_d, z0 - sw_h * 0.10)
            A.finalize_pivot(switch, pivot_pt)
            switch_objs.append(switch)
            idx += 1

    for s in switch_objs:
        A.parent_keep_transform(s, root)

    # -- schematic label plate --------------------------------------------------
    label = A.prim_box("LabelPlate", W - 0.16, 0.09, 0.006, location=(0, back_y + 0.015, min(row_z) - 0.09))
    A.assign_material(label, mat_label)
    A.finish_hero_surface(label, bevel_width=0.0012, bevel_segments=1)
    A.parent_keep_transform(label, root)

    # -- conduit knockouts on the top face --------------------------------------
    knockouts = []
    for i, kx in enumerate((-0.18, 0.0, 0.18)):
        k = A.prim_cylinder(f"_ko{i}", 0.028, wall_t * 1.3, segments=20, location=(kx, D * 0.55, H / 2 - wall_t / 2))
        knockouts.append(k)
    knockout_obj = A.join_objects(knockouts, "Knockouts")
    A.assign_material(knockout_obj, mat_knockout)
    A.finish_round_surface(knockout_obj)
    A.parent_keep_transform(knockout_obj, root)

    # -- door leaf on a hinge pivot -----------------------------------------------
    hinge_x = -W / 2 + 0.02
    door_w, door_h, door_d = W - 0.01, H - 0.01, 0.02
    door_mesh_center_x = hinge_x + door_w / 2 - 0.005
    door = A.prim_box("DoorLeaf", door_w, door_h, door_d, location=(door_mesh_center_x, wall_t + door_d / 2, 0))

    latch_body = A.prim_box("_latch", 0.03, 0.10, 0.03,
                             location=(hinge_x + door_w - 0.05, wall_t + door_d, 0))
    hinges = []
    for hz in (H * 0.32, -H * 0.32):
        hg = A.prim_cylinder(f"_hg{hz}", 0.014, 0.05, segments=12, location=(hinge_x + 0.006, wall_t + 0.006, hz))
        hinges.append(hg)
    door_full = A.join_objects([door, latch_body] + hinges, "DoorLeaf")
    A.assign_material(door_full, mat_enclosure)
    A.finish_hero_surface(door_full, bevel_width=0.0025, bevel_segments=2)

    handle = A.prim_box("_handle2", 0.032, 0.11, 0.05,
                         location=(hinge_x + door_w - 0.05, wall_t + door_d + 0.02, 0))
    A.assign_material(handle, mat_chrome)
    A.finish_hero_surface(handle, bevel_width=0.003, bevel_segments=2)

    pivot_door = A.new_empty("pivot_door", (hinge_x, 0, 0))
    A.parent_keep_transform(door_full, pivot_door)
    A.parent_keep_transform(handle, pivot_door)
    A.parent_keep_transform(pivot_door, root)

    # -- UVs ----------------------------------------------------------------------
    for o in (encl, backplate, busbar_obj, label, knockout_obj, door_full, handle, *switch_objs):
        A.smart_uv(o, angle_limit_deg=60, island_margin=0.03)

    all_meshes = [encl, backplate, busbar_obj, label, knockout_obj, door_full, handle] + switch_objs
    tris = A.report_and_assert_tris(all_meshes, 12000, "breaker_panel (hero prop)")
    A.print_hierarchy(root)

    # Hide the door + tilt a couple of switches for the QA render only, so the
    # interior detail is actually visible in the contact sheet.
    door_full.hide_render = True
    handle.hide_render = True
    for i, s in enumerate(switch_objs):
        if i % 2 == 0:
            s.rotation_euler = (math.radians(18), 0, 0)
    bpy.context.view_layer.update()
    A.render_turntable(all_meshes, QA, front_sign=1)
    door_full.hide_render = False
    handle.hide_render = False
    for s in switch_objs:
        s.rotation_euler = (0, 0, 0)

    A.export_glb(OUT, [root])
    return tris


if __name__ == "__main__":
    build()
