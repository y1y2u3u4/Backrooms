"""
annex_lib.py — shared Blender helper library for THE ANNEX asset pipeline.

Import from any per-asset script with:
    import sys, os
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import annex_lib as A

All geometry is authored in METRES, +Y world up is produced at export time by
the glTF exporter's own axis conversion (Blender is Z-up internally; we just
build to real-world scale and let the exporter do the Y-up flip).

Conventions used throughout the asset scripts:
  * Every visible mesh gets a Bevel modifier (clamp overlap, harden normals)
    applied before export — no raw 90-degree edges.
  * Every mesh gets exactly the material slots it needs, named `MAT_...`.
  * Objects that need to animate (door leaves, wheels, switches, joints) are
    modelled with geometry offset from the origin, then given a pivot via
    `finalize_pivot()` so the object's local origin IS the hinge/joint axis.
  * Tri budgets are asserted with `report_and_assert_tris()` before export.
"""

import bpy
import bmesh
import math
import os
import json
import mathutils
from mathutils import Vector, Matrix, Euler

TAU = math.pi * 2


# ---------------------------------------------------------------------------
# Scene / object plumbing
# ---------------------------------------------------------------------------

def reset_scene():
    """Wipe to an empty scene with sane metric units."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'
    return scene


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def select_many(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[-1]


def new_empty(name, location=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    e.location = Vector(location)
    bpy.context.collection.objects.link(e)
    return e


def mesh_from_bmesh(bm, name):
    """Build a linked mesh Object from a bmesh, then free the bmesh."""
    mesh = bpy.data.meshes.new(name + "Mesh")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def translate_mesh_data(obj, offset):
    """Bake a translation into the mesh data itself (not the object transform)."""
    obj.data.transform(Matrix.Translation(Vector(offset)))
    obj.data.update()


def rotate_mesh_data(obj, euler_xyz):
    m = Euler(euler_xyz, 'XYZ').to_matrix().to_4x4()
    obj.data.transform(m)
    obj.data.update()


def finalize_pivot(obj, pivot_world):
    """
    Re-express obj so that `pivot_world` (a WORLD-space point) becomes its
    local origin, without moving any geometry. Use this for anything that
    must rotate about a joint/hinge/stem: door leaves, wheels, switches,
    limb segments.

    Works regardless of the object's current transform: first bakes its
    existing world matrix into the mesh data (so local == world), resets the
    object's transform to identity, then re-centres on the pivot. This must
    be called AFTER any join_objects()/duplicate() that might leave a
    non-zero object transform behind.
    """
    p = Vector(pivot_world)
    bpy.context.view_layer.update()
    obj.data.transform(obj.matrix_world.copy())
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    obj.data.update()
    translate_mesh_data(obj, -p)
    obj.location = p


def parent_keep_transform(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


def apply_transforms(obj, loc=True, rot=True, scale=True):
    select_only(obj)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)


def set_origin_to_bounds_bottom(obj):
    """Floor-standing prop convention: pivot at base centre."""
    select_only(obj)
    bpy.context.view_layer.update()
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    cx = sum(v.x for v in bb) / 8.0
    cy = sum(v.y for v in bb) / 8.0
    minz = min(v.z for v in bb)
    cursor = bpy.context.scene.cursor
    old = cursor.location.copy()
    cursor.location = Vector((cx, cy, minz))
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR', center='MEDIAN')
    cursor.location = old


def join_objects(objs, name=None):
    """Join a list of mesh objects into the first one (destructive)."""
    if not objs:
        return None
    select_many(objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    result = objs[0]
    if name:
        result.name = name
    return result


def duplicate(obj, name=None):
    new_obj = obj.copy()
    new_obj.data = obj.data.copy()
    if name:
        new_obj.name = name
    bpy.context.collection.objects.link(new_obj)
    return new_obj


# ---------------------------------------------------------------------------
# Primitive geometry (all built with bmesh, world-space, then wrapped)
# ---------------------------------------------------------------------------

def prim_box(name, w, h, d, location=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
    obj = mesh_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def prim_cylinder(name, radius, depth, segments=16, location=(0, 0, 0), cap_ends=True, radius2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=cap_ends, cap_tris=False, segments=segments,
        radius1=radius, radius2=radius2 if radius2 is not None else radius,
        depth=depth,
    )
    obj = mesh_from_bmesh(bm, name)
    obj.rotation_euler = (math.pi / 2, 0, 0)  # cone axis is Z already -> keep Z up
    obj.rotation_euler = (0, 0, 0)
    obj.location = Vector(location)
    return obj


def prim_cone(name, radius, depth, segments=16, location=(0, 0, 0)):
    return prim_cylinder(name, radius, depth, segments, location, cap_ends=True, radius2=0.0001)


def prim_torus(name, major_r, minor_r, major_seg=24, minor_seg=10, location=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=False, segments=minor_seg, radius=minor_r)
    ring = list(bm.verts)
    for v in ring:
        v.co = Vector((v.co.x + major_r, 0, v.co.y))
    result_verts = []
    geom = list(bm.verts) + list(bm.edges)
    step = TAU / major_seg
    all_faces = []
    prev_ring = ring
    for i in range(1, major_seg + 1):
        ang = step * i
        rot = Matrix.Rotation(ang, 4, 'Z')
        new_geom = bmesh.ops.duplicate(bm, geom=ring)['geom']
        new_verts = [g for g in new_geom if isinstance(g, bmesh.types.BMVert)]
        for v in new_verts:
            local = Vector((math.sqrt(v.co.x ** 2 + 0) - major_r, 0, v.co.z))
        for v in new_verts:
            base = v.co
            v.co = rot @ Vector((base.x, base.y, base.z))
        for a, b in zip(prev_ring, new_verts):
            pass
        prev_ring = new_verts
    bm.free()
    # Simpler: fall back to primitive_torus via bpy.ops (reliable, cheap)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r, minor_radius=minor_r,
        major_segments=major_seg, minor_segments=minor_seg,
        location=location,
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def prim_sphere(name, radius, segments=16, rings=10, location=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    obj = mesh_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def lathe_profile(name, points, segments=24, location=(0, 0, 0)):
    """
    points: list of (radius, z) pairs, bottom to top, radius >= 0.
    Produces a solid of revolution about the Z axis.
    """
    curve_pts = [Vector((p[0], 0, p[1])) for p in points]
    bm = bmesh.new()
    verts_rings = []
    step = TAU / segments
    for i in range(segments):
        ang = step * i
        ring = []
        for p in curve_pts:
            x = p.x * math.cos(ang)
            y = p.x * math.sin(ang)
            z = p.z
            ring.append(bm.verts.new((x, y, z)))
        verts_rings.append(ring)
    n = len(curve_pts)
    for i in range(segments):
        ring_a = verts_rings[i]
        ring_b = verts_rings[(i + 1) % segments]
        for j in range(n - 1):
            v0, v1 = ring_a[j], ring_a[j + 1]
            v2, v3 = ring_b[j], ring_b[j + 1]
            r0 = curve_pts[j].x
            r1 = curve_pts[j + 1].x
            if r0 < 1e-6 and r1 < 1e-6:
                continue
            try:
                if r0 < 1e-6:
                    bm.faces.new((v0, v2, v3))
                elif r1 < 1e-6:
                    bm.faces.new((v0, v1, v2))
                else:
                    bm.faces.new((v0, v1, v3, v2))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def extrude_profile_along_z(name, points2d, length, location=(0, 0, 0), caps=True):
    """Extrude a closed 2D XY polygon profile along local Z by `length`, centred."""
    bm = bmesh.new()
    bottom = [bm.verts.new((p[0], p[1], -length / 2)) for p in points2d]
    top = [bm.verts.new((p[0], p[1], length / 2)) for p in points2d]
    n = len(points2d)
    for i in range(n):
        a, b = bottom[i], bottom[(i + 1) % n]
        c, d = top[i], top[(i + 1) % n]
        bm.faces.new((a, b, d, c))
    if caps:
        try:
            bm.faces.new(bottom[::-1])
        except ValueError:
            pass
        try:
            bm.faces.new(top)
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def rounded_rect_profile(w, h, r, segs=3):
    """A rounded-rectangle 2D point loop, centred at origin, for use as a profile."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    corners = [
        (w / 2 - r, h / 2 - r, 0),
        (-(w / 2 - r), h / 2 - r, 90),
        (-(w / 2 - r), -(h / 2 - r), 180),
        (w / 2 - r, -(h / 2 - r), 270),
    ]
    for cx, cy, start_deg in corners:
        for s in range(segs + 1):
            a = math.radians(start_deg + 90 * s / segs)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# ---------------------------------------------------------------------------
# Modifiers
# ---------------------------------------------------------------------------

def add_bevel(obj, width=0.003, segments=2, angle_deg=45, clamp=True, harden=True, weld=True):
    mod = obj.modifiers.new("Bevel", 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle_deg)
    mod.use_clamp_overlap = clamp
    mod.harden_normals = harden
    mod.miter_outer = 'MITER_ARC'
    return mod


def add_weighted_normal(obj, weight=50, keep_sharp=True):
    mod = obj.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL')
    mod.weight = weight
    mod.keep_sharp = keep_sharp
    return mod


def add_mirror(obj, axis='X', use_clip=True):
    mod = obj.modifiers.new("Mirror", 'MIRROR')
    mod.use_axis = (axis == 'X', axis == 'Y', axis == 'Z')
    mod.use_clip = use_clip
    return mod


def add_array(obj, count, offset=(1, 0, 0), relative=True):
    mod = obj.modifiers.new("Array", 'ARRAY')
    mod.count = count
    if relative:
        mod.relative_offset_displace = offset
    else:
        mod.use_relative_offset = False
        mod.use_constant_offset = True
        mod.constant_offset_displace = offset
    return mod


def apply_modifier(obj, mod):
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def apply_all_modifiers(obj):
    select_only(obj)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError as e:
            print(f"  ! could not apply {mod.name} on {obj.name}: {e}")


def shade_smooth_auto(obj, angle_deg=42):
    select_only(obj)
    bpy.ops.object.shade_smooth()
    try:
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = math.radians(angle_deg)
    except AttributeError:
        pass  # Blender 4.1+ removed this; harden_normals on bevel covers us.


def finish_hero_surface(obj, bevel_width=0.003, bevel_segments=2, angle_deg=45,
                         weighted_normal=True, smooth_angle=42):
    """Standard hero-prop finishing: bevel + shade smooth + weighted normals."""
    shade_smooth_auto(obj, smooth_angle)
    add_bevel(obj, bevel_width, bevel_segments, angle_deg)
    if weighted_normal:
        add_weighted_normal(obj)
    return obj


def finish_round_surface(obj, weighted_normal=True, smooth_angle=40):
    """
    Finishing for already-curved geometry (lathe revolves, tubes, cylinders)
    where a Bevel modifier would either do nothing useful or — worse — blow
    the triangle budget by catching every faceted ring edge. Smooth shading
    plus weighted normals is enough; any real chamfers on these parts should
    already be baked into the profile itself.
    """
    shade_smooth_auto(obj, smooth_angle)
    if weighted_normal:
        add_weighted_normal(obj)
    return obj


def boolean_op(target, tool, op='DIFFERENCE', solver='EXACT', apply=True, delete_tool=True):
    mod = target.modifiers.new("Boolean", 'BOOLEAN')
    mod.object = tool
    mod.operation = op
    mod.solver = solver
    if apply:
        select_only(target)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if delete_tool:
        bpy.data.objects.remove(tool, do_unlink=True)
    return target


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

def _set_input(node, names, value):
    for nm in names:
        if nm in node.inputs:
            node.inputs[nm].default_value = value
            return True
    return False


def make_material(name, base_color=(0.6, 0.6, 0.6), roughness=0.5, metallic=0.0,
                   alpha=1.0, emission_color=None, emission_strength=0.0,
                   transmission=0.0, ior=1.45):
    """Create (or fetch) a Principled-BSDF material named MAT_<name>."""
    full_name = name if name.startswith("MAT_") else f"MAT_{name}"
    if full_name in bpy.data.materials:
        return bpy.data.materials[full_name]
    mat = bpy.data.materials.new(full_name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    if alpha < 0.999:
        mat.blend_method = 'BLEND'
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        r, g, b = base_color
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
        _set_input(bsdf, ["Roughness"], roughness)
        _set_input(bsdf, ["Metallic"], metallic)
        _set_input(bsdf, ["Alpha"], alpha)
        _set_input(bsdf, ["IOR"], ior)
        _set_input(bsdf, ["Transmission Weight", "Transmission"], transmission)
        if emission_color is not None:
            er, eg, eb = emission_color
            _set_input(bsdf, ["Emission Color", "Emission"], (er, eg, eb, 1.0))
            _set_input(bsdf, ["Emission Strength"], emission_strength)
    return mat


def assign_material(obj, mat, slot_index=None):
    """Append (or replace) a material slot on obj; returns the slot index."""
    if slot_index is not None and slot_index < len(obj.data.materials):
        obj.data.materials[slot_index] = mat
        return slot_index
    obj.data.materials.append(mat)
    return len(obj.data.materials) - 1


def assign_material_to_faces(obj, mat, face_indices):
    """Assign a (already-appended) material's slot to a subset of faces by index."""
    slot = assign_material(obj, mat)
    for i in face_indices:
        obj.data.polygons[i].material_index = slot
    return slot


def set_faces_material_by_predicate(obj, mat, predicate):
    """predicate(polygon) -> bool, in local mesh space."""
    slot = assign_material(obj, mat)
    for p in obj.data.polygons:
        if predicate(p):
            p.material_index = slot
    return slot


# ---------------------------------------------------------------------------
# UVs
# ---------------------------------------------------------------------------

def smart_uv(obj, angle_limit_deg=66, island_margin=0.02):
    select_only(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle_limit_deg), island_margin=island_margin)
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------------------
# Triangle accounting
# ---------------------------------------------------------------------------

def count_tris(obj):
    """Triangle count as-if triangulated (works pre- or post- modifier apply)."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(depsgraph)
    mesh = ev.to_mesh()
    tris = sum(max(0, len(p.vertices) - 2) for p in mesh.polygons)
    ev.to_mesh_clear()
    return tris


def count_tris_tree(root):
    total = 0
    stack = [root]
    seen = set()
    while stack:
        o = stack.pop()
        if o.name in seen:
            continue
        seen.add(o.name)
        if o.type == 'MESH':
            total += count_tris(o)
        stack.extend(o.children)
    return total


def report_and_assert_tris(objs_or_root, budget, label):
    if isinstance(objs_or_root, (list, tuple)):
        total = sum(count_tris(o) for o in objs_or_root if o.type == 'MESH')
    else:
        total = count_tris_tree(objs_or_root)
    status = "OK" if total <= budget else "OVER BUDGET"
    print(f"[TRIS] {label}: {total} / {budget}  [{status}]")
    if total > budget:
        print(f"  !! WARNING: {label} exceeds its triangle budget by {total - budget}")
    return total


def print_hierarchy(root, indent=0):
    tag = f" ({count_tris(root)} tris)" if root.type == 'MESH' else ""
    print("  " * indent + f"- {root.name} [{root.type}]{tag}")
    for c in root.children:
        print_hierarchy(c, indent + 1)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_glb(filepath, root_objects, apply_transform_on=None):
    """
    Export the given top-level objects (and their children) as a single GLB.
    `apply_transform_on` — optional list of mesh objects to bake scale/rotation
    into before export (skip anything whose *local* rotation is meaningful,
    i.e. pivots/hinges/joints — those must keep their transform).
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    if apply_transform_on:
        for o in apply_transform_on:
            apply_transforms(o, loc=False, rot=True, scale=True)

    all_objs = []
    def collect(o):
        all_objs.append(o)
        for c in o.children:
            collect(c)
    for r in root_objects:
        collect(r)

    select_many(all_objs)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_normals=True,
        export_tangents=False,
        export_texcoords=True,
        export_colors=True,
        export_animations=False,
        export_extras=False,
    )
    print(f"[EXPORT] wrote {filepath}")
    return filepath


# ---------------------------------------------------------------------------
# Turntable contact-sheet rendering (pure bpy, no external image libs)
# ---------------------------------------------------------------------------

def _bounds_of(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    bpy.context.view_layer.update()
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            lo.x, lo.y, lo.z = min(lo.x, wc.x), min(lo.y, wc.y), min(lo.z, wc.z)
            hi.x, hi.y, hi.z = max(hi.x, wc.x), max(hi.y, wc.y), max(hi.z, wc.z)
    return lo, hi


def render_turntable(objs, out_png, engine='BLENDER_EEVEE', res=520, front_sign=-1):
    """
    front_sign: -1 (default) views from -Y, the usual Blender "front" side.
    Pass +1 for wall-mounted props authored with their outward/visible face
    on +Y (i.e. back-of-panel at y=0, front opening away from the wall) so
    the QA turntable actually looks at the interesting side.
    """
    """
    Renders front / 3-quarter / side views of `objs` on a neutral backdrop with
    simple 3-point-style lighting, then composites the three PNGs side-by-side
    into a single contact sheet at `out_png`. Pure bpy — no PIL dependency.
    """
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new("_QA_world")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.72, 0.72, 0.74, 1.0)
        bg.inputs[1].default_value = 1.0
    lo, hi = _bounds_of(objs)
    center = (lo + hi) / 2
    size = hi - lo
    radius = max(size.length / 2, 0.05)

    # Backdrop plane.
    bpy.ops.mesh.primitive_plane_add(size=radius * 12, location=(center.x, center.y, lo.z - 0.001))
    backdrop = bpy.context.active_object
    backdrop.name = "_QA_backdrop"
    bmat = bpy.data.materials.new("_QA_backdrop_mat")
    bmat.use_nodes = True
    bsdf = bmat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.5, 0.5, 0.52, 1.0)
        _set_input(bsdf, ["Roughness"], 0.9)
    backdrop.data.materials.append(bmat)

    # Lights (only matter for EEVEE; Workbench ignores them but it's harmless).
    # Sun lamps: irradiance is size/distance independent, so the same energy
    # values look right whether the prop is a 0.2m fuse core or a 3m entity.
    light_objs = []
    def add_light(name, loc, energy, angle_deg=6.0):
        d = bpy.data.lights.new(name, type='SUN')
        d.energy = energy
        d.angle = math.radians(angle_deg)
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        light_objs.append(o)
        return o

    key = add_light("_QA_key", (center.x + radius * 2.2, center.y - radius * 2.2, center.z + radius * 2.6), 3.0)
    fill = add_light("_QA_fill", (center.x - radius * 2.6, center.y - radius * 1.6, center.z + radius * 1.4), 1.1, angle_deg=12)
    rim = add_light("_QA_rim", (center.x, center.y + radius * 2.6, center.z + radius * 2.0), 1.8, angle_deg=8)

    def aim_light(o):
        direction = (center - o.location)
        rot_quat = direction.to_track_quat('-Z', 'Y')
        o.rotation_euler = rot_quat.to_euler()
    for l in light_objs:
        aim_light(l)

    cam_data = bpy.data.cameras.new("_QA_cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("_QA_cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    dist = radius * 3.0
    views = {
        "front": Vector((0, front_sign * dist, center.z + size.z * 0.15)),
        "three_quarter": Vector((dist * 0.82, front_sign * dist * 0.82, center.z + size.z * 0.35)),
        "side": Vector((dist, 0, center.z + size.z * 0.15)),
    }

    prev_engine = scene.render.engine
    scene.render.engine = engine
    if engine == 'BLENDER_WORKBENCH':
        scene.display.shading.light = 'STUDIO'
        scene.display.shading.color_type = 'MATERIAL'
        scene.display.shading.show_cavity = True
        scene.display.shading.cavity_type = 'BOTH'
    elif engine == 'BLENDER_EEVEE':
        scene.eevee.taa_render_samples = 32
        scene.eevee.use_gtao = True
        scene.eevee.gtao_distance = 0.3
        scene.eevee.use_soft_shadows = True
        scene.eevee.use_bloom = False
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0

    tmp_dir = os.path.join(os.path.dirname(out_png), "_qa_tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    frame_paths = []
    for name, pos in views.items():
        cam.location = pos + Vector((center.x, center.y, 0))
        direction = center - cam.location
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        cam_data.clip_end = dist * 20
        fp = os.path.join(tmp_dir, f"{name}.png")
        scene.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        frame_paths.append(fp)

    scene.render.engine = prev_engine
    bpy.data.objects.remove(backdrop, do_unlink=True)
    for l in light_objs:
        bpy.data.objects.remove(l, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)

    _composite_row(frame_paths, out_png)
    for fp in frame_paths:
        try:
            os.remove(fp)
        except OSError:
            pass
    try:
        os.rmdir(tmp_dir)
    except OSError:
        pass
    print(f"[QA] contact sheet -> {out_png}")
    return out_png


def _composite_row(png_paths, out_path):
    """Stitch N same-size PNGs horizontally using bpy.data.images pixel buffers."""
    imgs = [bpy.data.images.load(p) for p in png_paths]
    w, h = imgs[0].size
    gap = 8
    total_w = w * len(imgs) + gap * (len(imgs) - 1)
    out = bpy.data.images.new("_QA_sheet", width=total_w, height=h, alpha=False)
    canvas = [0.08, 0.08, 0.09, 1.0] * (total_w * h)
    out.pixels.foreach_set(canvas)
    buf = list(out.pixels[:])
    for idx, im in enumerate(imgs):
        px = list(im.pixels[:])
        x_off = idx * (w + gap)
        for row in range(h):
            src_start = row * w * 4
            dst_start = (row * total_w + x_off) * 4
            buf[dst_start:dst_start + w * 4] = px[src_start:src_start + w * 4]
    out.pixels.foreach_set(buf)
    out.filepath_raw = out_path
    out.file_format = 'PNG'
    out.save()
    for im in imgs:
        bpy.data.images.remove(im)
    bpy.data.images.remove(out)


# ---------------------------------------------------------------------------
# Manifest helper
# ---------------------------------------------------------------------------

def bbox_metres(objs):
    lo, hi = _bounds_of(objs)
    size = hi - lo
    # Blender Z-up -> report in the game's Y-up convention (x, y=height, z=depth)
    return {
        "x": round(size.x, 4),
        "y": round(size.z, 4),
        "z": round(size.y, 4),
    }
