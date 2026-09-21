"""Reproducible Blender model, UV unwrap and shared-source PBR bakes.

Run through bridge.py in the dedicated fresh Blender session.
Geometry uses Blender Z-up; glTF exports the application's Y-up coordinates.
"""
import bpy
import bmesh
import json
import math
from contextlib import contextmanager
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/woodfish/blender-v2"
SOURCE = ROOT / "design/woodfish"
PREVIEW = ROOT / "artifacts/woodfish/blender-v2"
for folder in (OUT, SOURCE, PREVIEW):
    folder.mkdir(parents=True, exist_ok=True)

# Only run in the dedicated scene created for this task.
if bpy.data.filepath and Path(bpy.data.filepath).resolve() != (SOURCE / "woodfish.blend").resolve():
    raise RuntimeError("Refusing to replace an unrelated open Blender document")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def apply(obj, mod):
    active(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)

@contextmanager
def isolated_bake(obj):
    visibility = [(other, other.hide_render) for other in bpy.context.scene.objects if other.type == "MESH" and other != obj]
    for other, _ in visibility:
        other.hide_render = True
    try:
        yield
    finally:
        for other, hidden in visibility:
            other.hide_render = hidden

def ellipsoid(name, location, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj

def boolean(obj, cutter, operation="DIFFERENCE"):
    mod = obj.modifiers.new("Carved " + cutter.name, "BOOLEAN")
    mod.operation = operation
    mod.solver = "EXACT"
    mod.object = cutter
    apply(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)

body = ellipsoid("WoodfishBody", (0, 0, 0), (1.07, .89, 1.02))
# A fuller lower bowl and slightly receding crown, not a flat front hemisphere.
for v in body.data.vertices:
    z = v.co.z
    v.co.x += .11 * z
    v.co.x *= 1.0 - .08 * z
    v.co.z += .06
snout = ellipsoid("Rounded mouth end", (-.91, -.07, -.52), (.42, .61, .30))
active(body)
snout.select_set(True)
bpy.ops.object.join()
mod = body.modifiers.new("Continuous carved outline", "REMESH")
mod.mode = "VOXEL"
mod.voxel_size = .022
mod.use_smooth_shade = True
apply(body, mod)
mod = body.modifiers.new("Hand rounded silhouette", "SMOOTH")
mod.factor = .75
mod.iterations = 5
apply(body, mod)
# Flat, small foot at the same height used by the runtime contact plane.
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, -1.91))
boolean(body, bpy.context.object)
inner = ellipsoid("Resonating chamber", (.025, .025, .035), (.81, .66, .78))
boolean(body, inner)
# Front is Blender -Y. Hole and swept slot actually open into the chamber.
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.175, depth=1.3,
    location=(-.33, -.66, -.19), rotation=(math.pi/2, 0, 0))
boolean(body, bpy.context.object)
bpy.ops.mesh.primitive_cube_add(size=1, location=(.49, -.70, -.07))
slot = bpy.context.object
slot.name = "Sound slit"
slot.dimensions = (1.68, 1.35, .115)
slot.rotation_euler.y = -.15
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mod = slot.modifiers.new("Round slit ends", "BEVEL")
mod.width = .055
mod.segments = 4
apply(slot, mod)
boolean(body, slot)
mod = body.modifiers.new("Soft carved lips", "BEVEL")
mod.width = .026
mod.segments = 3
mod.limit_method = "ANGLE"
mod.angle_limit = .45
apply(body, mod)
for face in body.data.polygons:
    face.use_smooth = True

# The handle follows the same grip axis as the existing rigid swing animation.
head = ellipsoid("MalletHead", (0, 0, 0), (.255, .255, .255))
axis = Vector((.65, -.10, -.90)).normalized()
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=.074, radius2=.094, depth=1.15)
handle = bpy.context.object
handle.name = "MalletHandle"
handle.location = axis * .68
handle.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
active(handle)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
mod = handle.modifiers.new("Rounded handle end", "BEVEL")
mod.width = .068
mod.segments = 5
apply(handle, mod)
active(head)
handle.select_set(True)
bpy.ops.object.join()
head.name = "Mallet"
for f in head.data.polygons:
    f.use_smooth = True

for obj in (body, head):
    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Baked object-space wood stays continuous across these packed UV islands.
    bpy.ops.uv.smart_project(angle_limit=math.radians(72), island_margin=.025,
                            area_weight=.3, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.uv_layers.active.name = "WoodUV"
    # Export the actual UV layout, never a scaled screenshot of editor chrome.
    bpy.ops.uv.export_layout(filepath=str(SOURCE / (obj.name.lower() + "-uv.png")),
                             size=(2048, 2048), opacity=.16, export_all=True)
    # Bake and export use the identical triangulation / tangent basis.
    mod = obj.modifiers.new("Stable normal-map triangles", "TRIANGULATE")
    apply(obj, mod)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.bake_type = "DIFFUSE"
scene.render.bake.margin = 24
scene.render.bake.use_clear = True
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.view_settings.view_transform = "AgX"

def source_material(name, obj):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    principled = nodes.get("Principled BSDF")
    principled.inputs["Roughness"].default_value = .48
    coord = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Generated"], separate.inputs[0])
    mapping = nodes.new("ShaderNodeCombineXYZ")
    # One continuous planar fiber field through the solid, no triplanar blending.
    # Actual depth contributes to the vertical coordinate so side grain curves.
    depth = nodes.new("ShaderNodeMath"); depth.operation = "MULTIPLY"
    depth.inputs[1].default_value = .22
    links.new(separate.outputs["Y"], depth.inputs[0])
    vertical = nodes.new("ShaderNodeMath"); vertical.operation = "ADD"
    links.new(separate.outputs["Z"], vertical.inputs[0])
    links.new(depth.outputs[0], vertical.inputs[1])
    links.new(separate.outputs["X"], mapping.inputs["X"])
    links.new(vertical.outputs[0], mapping.inputs["Y"])
    tex = nodes.new("ShaderNodeTexImage")
    tex.name = "AI wood source — shared color / microheight"
    tex.image = bpy.data.images.load(str(ROOT / "assets/woodfish/generated-v1/color.png"), check_existing=True)
    tex.extension = "MIRROR"
    links.new(mapping.outputs[0], tex.inputs["Vector"])
    # Existing generated wood is strongly orange. Desaturate for oiled walnut.
    hue = nodes.new("ShaderNodeHueSaturation")
    hue.inputs["Saturation"].default_value = .65
    hue.inputs["Value"].default_value = .78
    links.new(tex.outputs["Color"], hue.inputs["Color"])
    links.new(hue.outputs[0], principled.inputs["Base Color"])
    bw = nodes.new("ShaderNodeRGBToBW")
    links.new(tex.outputs["Color"], bw.inputs[0])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .24
    bump.inputs["Distance"].default_value = .018
    links.new(bw.outputs[0], bump.inputs["Height"])
    links.new(bump.outputs[0], principled.inputs["Normal"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["From Min"].default_value = 0
    rough.inputs["From Max"].default_value = 1
    rough.inputs["To Min"].default_value = .58
    rough.inputs["To Max"].default_value = .42
    links.new(bw.outputs[0], rough.inputs["Value"])
    links.new(rough.outputs[0], principled.inputs["Roughness"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return mat

def bake_object(obj, prefix, size):
    mat = source_material(prefix + " source", obj)
    maps = {}
    active(obj)
    for label, bake_type in (("color", "DIFFUSE"), ("normal", "NORMAL"), ("roughness", "ROUGHNESS"), ("ao", "AO")):
        resolution = size if label == "color" else size // 2
        image = bpy.data.images.new(prefix + "-" + label, width=resolution, height=resolution, alpha=False)
        image.colorspace_settings.name = "sRGB" if label == "color" else "Non-Color"
        image.generated_color = (.5, .5, 1, 1) if label == "normal" else (.45, .45, .45, 1)
        image.filepath_raw = str(OUT / (prefix + "-" + label + ".png"))
        image.file_format = "PNG"
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        mat.node_tree.nodes.active = node
        scene.render.bake.normal_space = "TANGENT"
        with isolated_bake(obj):
            bpy.ops.object.bake(type=bake_type)
        image.save()
        maps[label] = image
        print("BAKED", prefix, label, flush=True)
    # Keep source node group available in .blend, but export a standard PBR material.
    final = bpy.data.materials.new(prefix + " baked satin wood")
    final.use_nodes = True
    final.use_backface_culling = True
    nodes, links = final.node_tree.nodes, final.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    for label, socket in (("color", "Base Color"), ("roughness", "Roughness")):
        node = nodes.new("ShaderNodeTexImage"); node.image = maps[label]
        links.new(node.outputs["Color"], bsdf.inputs[socket])
    node = nodes.new("ShaderNodeTexImage"); node.image = maps["normal"]
    normal = nodes.new("ShaderNodeNormalMap")
    links.new(node.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    ao_group = nodes.new("ShaderNodeGroup"); ao_group.node_tree = group
    ao = nodes.new("ShaderNodeTexImage"); ao.image = maps["ao"]
    links.new(ao.outputs["Color"], ao_group.inputs["Occlusion"])
    obj.data.materials[0] = final
    return maps

body_maps = bake_object(body, "body", 2048)
mallet_maps = bake_object(head, "mallet", 1024)

# Metadata supports budget / topology / UV checks without running Blender in CI.
stats = {}
for obj in (body, head):
    obj.data.calc_loop_triangles()
    bm = bmesh.new(); bm.from_mesh(obj.data)
    stats[obj.name] = {"vertices": len(obj.data.vertices),
        "triangles": len(obj.data.loop_triangles),
        "nonManifoldEdges": sum(not e.is_manifold for e in bm.edges),
        "uvLoops": len(obj.data.uv_layers.active.data)}
    bm.free()
(OUT / "manifest.json").write_text(json.dumps({"blender": bpy.app.version_string, "objects": stats}, indent=2))

# Neutral studio setup, retained in the authoring .blend but not in the GLB.
world = bpy.data.worlds.new("Warm studio")
scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.30, .27, .23, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = .45

def area(name, position, energy, size, color):
    data = bpy.data.lights.new(name, "AREA"); data.energy = energy; data.shape = "DISK"; data.size = size; data.color = color
    light = bpy.data.objects.new(name, data); scene.collection.objects.link(light)
    light.location = position; light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()

area("Soft warm key", (-3, -4, 6), 500, 4, (1, .86, .69))
area("Cream fill", (4, -2, 2), 100, 3, (1, .93, .83))
area("Amber rim", (2, 3, 4), 220, 3, (1, .78, .54))
bpy.ops.object.camera_add(location=(2.5, -6, 2.5))
camera = bpy.context.object
camera.rotation_euler = (Vector((-.05, 0, .02))-camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"; camera.data.ortho_scale = 3.8
scene.camera = camera
scene.render.resolution_x = 1000; scene.render.resolution_y = 900; scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
head.location = (1.04, -1.10, .35)
scene.cycles.samples = 32
scene.render.filepath = str(PREVIEW / "material.png")
bpy.ops.render.render(write_still=True)
gray = bpy.data.materials.new("Clay inspection"); gray.diffuse_color = (.38, .38, .38, 1)
scene.view_layers[0].material_override = gray
scene.render.filepath = str(PREVIEW / "clay.png")
bpy.ops.render.render(write_still=True)
scene.view_layers[0].material_override = None
head.location = (0, 0, 0)
active(body); head.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "woodfish.glb"), export_format="GLB",
    use_selection=True, export_yup=True, export_apply=True, export_tangents=True,
    export_materials="EXPORT")
head.location = (1.04, -1.10, .35)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "woodfish.blend"))
print("WOODFISH_COMPLETE", json.dumps(stats), flush=True)
