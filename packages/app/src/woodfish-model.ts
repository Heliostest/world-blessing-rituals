import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** One self-contained GLB: real UVs, tangent normals and packed roughness/AO. */
export async function parseWoodfishModel(bytes: ArrayBuffer) {
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
  const body = gltf.scene.getObjectByName("WoodfishBody");
  const mallet = gltf.scene.getObjectByName("Mallet");
  if (!(body instanceof THREE.Mesh) || !(mallet instanceof THREE.Mesh)) {
    dispose();
    throw new Error("Woodfish GLB is missing its body or mallet");
  }
  return { body, mallet, dispose };
}
