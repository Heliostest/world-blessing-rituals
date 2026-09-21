"""Run with Blender --background --factory-startup --python this_file.py.

Derive a small offline bootstrap from the finished GLB; never modify the .blend
or its HD source textures. Re-export tangents after geometry simplification.
"""
from pathlib import Path
import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/woodfish/bundled-v1/woodfish.glb"
if not bpy.app.background:
    raise RuntimeError("Use a separate background Blender process")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/woodfish/blender-v2/woodfish.glb"))
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    bpy.context.view_layer.objects.active = obj
    # glTF splits vertices at UV seams. Rejoin coincident mesh vertices before
    # decimation, retaining per-loop UVs, so simplification cannot open cracks.
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=0.000001)
    mesh.to_mesh(obj.data)
    mesh.free()
    mod = obj.modifiers.new("Offline bootstrap", "DECIMATE")
    mod.ratio = .22 if obj.name == "WoodfishBody" else .45
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
for img in bpy.data.images:
    if img.size[0] > 448 or img.size[1] > 448:
        img.scale(448, 448)
        img.pack()
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", export_yup=True,
    export_apply=True, export_tangents=True, export_materials="EXPORT")
print("Bundled GLB bytes:", OUT.stat().st_size)
if OUT.stat().st_size > 2 * 1024 * 1024:
    raise RuntimeError("Offline model exceeded the 2 MiB budget")
