"""Launch in a fresh Blender process with --python; no preference changes."""
import bpy
import addon_utils

addon_utils.enable("blender_mcp", default_set=False, persistent=False)
bpy.context.scene.blendermcp_port = 9876
bpy.ops.blendermcp.start_server()
print("WOODFISH_BLENDER_BRIDGE_READY", flush=True)
