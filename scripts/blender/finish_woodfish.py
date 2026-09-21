"""Apply the UV-guided AI color edit, then derive/bake matching microdetail.

Run after build_woodfish.py. The candidate is generated with image_gen from
body-color.png plus woodfishbody-uv.png. Never generate each PBR map separately.
"""
import bpy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/woodfish/blender-v2"
SOURCE = ROOT / "design/woodfish"
if Path(bpy.data.filepath).resolve() != (SOURCE / "woodfish.blend").resolve():
    raise RuntimeError("Open this project's woodfish.blend before applying its materials")
scene = bpy.context.scene
body = bpy.data.objects["WoodfishBody"]
mallet = bpy.data.objects["Mallet"]
final = body.data.materials[0]
candidate = bpy.data.images.load(str(SOURCE / "uv-generated-candidate.png"), check_existing=True)
candidate.colorspace_settings.name = "sRGB"
source = bpy.data.materials.new("UV-guided AI wood microdetail source")
source.use_nodes = True
nodes, links = source.node_tree.nodes, source.node_tree.links
bsdf = nodes.get("Principled BSDF")
tex = nodes.new("ShaderNodeTexImage"); tex.image = candidate
uv = nodes.new("ShaderNodeTexCoord")
links.new(uv.outputs["UV"], tex.inputs["Vector"])
links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bw = nodes.new("ShaderNodeRGBToBW"); links.new(tex.outputs["Color"], bw.inputs[0])
# This is artistic microrelief, not a claim of recovering measured wood height.
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = .18
bump.inputs["Distance"].default_value = .007
links.new(bw.outputs[0], bump.inputs["Height"])
links.new(bump.outputs[0], bsdf.inputs["Normal"])
rough = nodes.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value = .56
rough.inputs["To Max"].default_value = .43
links.new(bw.outputs[0], rough.inputs["Value"])
links.new(rough.outputs[0], bsdf.inputs["Roughness"])
body.data.materials[0] = source
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True); bpy.context.view_layer.objects.active = body
for label, kind in (("normal", "NORMAL"), ("roughness", "ROUGHNESS")):
    target = bpy.data.images.new("body-ai-" + label, width=1024, height=1024, alpha=False)
    target.colorspace_settings.name = "Non-Color"
    target.filepath_raw = str(OUT / ("body-" + label + ".png")); target.file_format = "PNG"
    node = nodes.new("ShaderNodeTexImage"); node.image = target; nodes.active = node
    bpy.ops.object.bake(type=kind)
    target.save()
    for node in final.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image and node.image.name.startswith("body") and label in node.image.name:
            node.image = target
body.data.materials[0] = final
for node in final.node_tree.nodes:
    if node.type == "TEX_IMAGE" and node.image and "body-color" in node.image.name:
        node.image = candidate
# Match the body's warmer palette without changing the mallet's fiber positions.
mallet_material = mallet.data.materials[0]
mallet_source = sorted((m for m in bpy.data.materials if m.name.startswith("mallet source")), key=lambda m:m.name)[-1]
for node in mallet_source.node_tree.nodes:
    if node.type == "HUE_SAT":
        node.inputs["Saturation"].default_value = .9
        node.inputs["Value"].default_value = 1.0
mallet.data.materials[0] = mallet_source
bpy.ops.object.select_all(action="DESELECT")
mallet.select_set(True); bpy.context.view_layer.objects.active = mallet
mallet_color = bpy.data.images.new("mallet-color-final", width=1024, height=1024, alpha=False)
mallet_color.filepath_raw = str(OUT / "mallet-color.png"); mallet_color.file_format = "PNG"
target = mallet_source.node_tree.nodes.new("ShaderNodeTexImage"); target.image = mallet_color
mallet_source.node_tree.nodes.active = target
bpy.ops.object.bake(type="DIFFUSE"); mallet_color.save()
mallet.data.materials[0] = mallet_material
color_node = mallet_material.node_tree.nodes.new("ShaderNodeTexImage"); color_node.image = mallet_color
mallet_material.node_tree.links.new(color_node.outputs["Color"], mallet_material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])

# Bake each object's own occlusion in isolation. The rest pose used for export
# places the mallet inside the shell; it must never leave a permanent AO mark.
for obj, prefix in ((body, "body"), (mallet, "mallet")):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    mat = obj.data.materials[0]
    group = next(n for n in mat.node_tree.nodes if n.type == "GROUP" and n.node_tree.name.startswith("glTF Material Output"))
    ao_node = group.inputs["Occlusion"].links[0].from_node
    mat.node_tree.nodes.active = ao_node
    hidden = [(o, o.hide_render) for o in scene.objects if o.type == "MESH" and o != obj]
    for o, _ in hidden:
        o.hide_render = True
    try:
        bpy.ops.object.bake(type="AO")
        ao_node.image.filepath_raw = str(OUT / (prefix + "-ao.png"))
        ao_node.image.save()
    finally:
        for o, value in hidden:
            o.hide_render = value

# The runtime gets only the two meshes. All lights remain editable in .blend.
mallet.location = (0, 0, 0)
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True); mallet.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "woodfish.glb"), export_format="GLB",
    use_selection=True, export_yup=True, export_apply=True, export_tangents=True,
    export_materials="EXPORT")
mallet.location = (1.04, -1.10, .35)
scene.render.filepath = str(ROOT / "artifacts/woodfish/blender-v2/final-material.png")
bpy.ops.render.render(write_still=True)
# All authoring source textures live beside the project, not in a user cache.
bpy.ops.file.make_paths_relative()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "woodfish.blend"))
manifest_path = OUT / "manifest.json"
manifest = json.loads(manifest_path.read_text())
manifest["material"] = {"colorSource": "UV-guided image_gen edit", "normalSource": "Blender tangent-space bake of controlled microheight from that same color", "roughnessSource": "Blender bake of controlled 0.43-0.56 roughness from the same source", "aoSource": "Blender geometry bake", "triangleBudget": 100000}
manifest_path.write_text(json.dumps(manifest, indent=2))
print("UV-guided material applied and GLB exported")
