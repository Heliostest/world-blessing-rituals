import * as THREE from "three";
import type { RenderStyleId } from "@wbr/content";

/** Optional art direction on mesh.userData.toonSurface. Source textures stay untouched. */
type ToonSurface = { color?: THREE.ColorRepresentation; simplifyMap?: boolean; aoIntensity?: number };
type Entry = { original: THREE.Material | THREE.Material[]; styled: THREE.Material | THREE.Material[]; owned: THREE.MeshToonMaterial[] };

export function createToonSurfaces(style: Exclude<RenderStyleId, "original">) {
  // Standard Three.js gradient-map configuration, not a custom shader.
  const values = style === "toon-ink" ? [85, 165, 235] : [105, 145, 180, 210, 240];
  const gradient = new THREE.DataTexture(new Uint8Array(values), values.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const cache = new Map<THREE.Mesh, Entry>();

  function adapt(source: THREE.Material, hint: ToonSurface, owned: THREE.MeshToonMaterial[]) {
    if (!(source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhongMaterial || source instanceof THREE.MeshLambertMaterial) || source.transparent) return source;
    const toon = new THREE.MeshToonMaterial({
      color: hint.color ?? source.color,
      map: hint.simplifyMap ? null : source.map,
      gradientMap: gradient,
      aoMap: source.aoMap,
      aoMapIntensity: hint.aoIntensity ?? Math.min(source.aoMapIntensity, 0.45),
      // Fine normal/bump detail makes stepped lighting noisy. Keep geometry shading.
      normalMap: null,
      bumpMap: null,
      emissive: source.emissive,
      emissiveMap: source.emissiveMap,
      emissiveIntensity: source.emissiveIntensity,
      alphaMap: source.alphaMap,
      alphaTest: source.alphaTest,
      opacity: source.opacity,
      side: source.side,
      vertexColors: source.vertexColors,
      depthWrite: source.depthWrite,
      depthTest: source.depthTest,
      visible: source.visible,
      wireframe: source.wireframe,
      fog: source.fog,
      displacementMap: source.displacementMap,
      displacementScale: source.displacementScale,
      displacementBias: source.displacementBias,
    });
    toon.name = `${source.name || "surface"} / ${style}`;
    owned.push(toon);
    return toon;
  }

  return {
    apply(scene: THREE.Scene) {
      const live = new Set<THREE.Mesh>();
      const swaps: [THREE.Mesh, Entry][] = [];
      const outlined: THREE.Mesh[] = [];
      const restore = () => { swaps.forEach(([mesh, entry]) => { mesh.material = entry.original; }); };
      try {
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          live.add(object);
          let entry = cache.get(object);
          if (!entry || entry.original !== object.material) {
            entry?.owned.forEach((material) => material.dispose());
            const owned: THREE.MeshToonMaterial[] = [];
            const hint: ToonSurface = object.userData.toonSurface ?? {};
            const original = object.material;
            const styled = Array.isArray(original)
              ? original.map((material) => adapt(material, hint, owned))
              : adapt(original, hint, owned);
            entry = { original, styled, owned };
            cache.set(object, entry);
          }
          if (entry.owned.length) {
            swaps.push([object, entry]);
            object.material = entry.styled;
            outlined.push(object);
          }
        });
        for (const [mesh, entry] of cache) {
          if (!live.has(mesh)) {
            entry.owned.forEach((material) => material.dispose());
            cache.delete(mesh);
          }
        }
      } catch (error) { restore(); throw error; }
      return { outlined, restore };
    },
    dispose() {
      cache.forEach((entry) => entry.owned.forEach((material) => material.dispose()));
      cache.clear();
      gradient.dispose();
    },
  };
}
