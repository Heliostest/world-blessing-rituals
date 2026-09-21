import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateWoodfishGLB } from "@wbr/content/glb";
import { InvalidContentError } from "@wbr/content";

/** One self-contained GLB: real UVs, tangent normals and packed roughness/AO. */
export async function parseWoodfishModel(
  bytes: ArrayBuffer,
  bindings = { body: "WoodfishBody", mallet: "Mallet" },
) {
  try {
    validateWoodfishGLB(bytes, bindings);
  } catch (error) {
    throw new InvalidContentError(String(error));
  }
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    object.castShadow = object.receiveShadow = true;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    const bitmaps = new Set<ImageBitmap>();
    textures.forEach((t) => {
      t.dispose();
      if (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap)
        bitmaps.add(t.image);
    });
    bitmaps.forEach((bitmap) => bitmap.close());
  }
  const body = gltf.scene.getObjectByName(bindings.body);
  const mallet = gltf.scene.getObjectByName(bindings.mallet);
  if (!(body instanceof THREE.Mesh) || !(mallet instanceof THREE.Mesh)) {
    dispose();
    throw new InvalidContentError("Woodfish GLB is missing its body or mallet");
  }
  // woodfish@1 uses world-aligned meshes, with the mallet head at its origin.
  for (const mesh of [body, mallet]) {
    mesh.updateWorldMatrix(true, false);
    if (!mesh.matrixWorld.equals(new THREE.Matrix4())) {
      dispose();
      throw new InvalidContentError("Unsupported model transform");
    }
  }
  if (body === mallet) {
    dispose();
    throw new InvalidContentError("Model bindings must differ");
  }
  return { body, mallet, dispose };
}
