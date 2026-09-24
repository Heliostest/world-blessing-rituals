import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { createToonSurfaces } from "./toon-surfaces";

describe("official toon material adaptation", () => {
  it("uses simplified painted surfaces only while drawing, without damaging PBR textures", () => {
    const color = new THREE.Texture(), normal = new THREE.Texture(), ao = new THREE.Texture();
    const original = new THREE.MeshStandardMaterial({ map: color, normalMap: normal, aoMap: ao });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
    mesh.userData.toonSurface = { color: 0xb98655, simplifyMap: true, aoIntensity: 0.3 };
    const scene = new THREE.Scene(); scene.add(mesh);
    const surfaces = createToonSurfaces("toon-soft");
    const frame = surfaces.apply(scene);
    const toon = mesh.material as unknown as THREE.MeshToonMaterial;
    expect(toon.isMeshToonMaterial).toBe(true);
    expect(toon.color.getHex()).toBe(0xb98655);
    expect(toon.map).toBeNull();
    expect(toon.normalMap).toBeNull();
    expect(toon.aoMap).toBe(ao);
    expect(toon.aoMapIntensity).toBe(0.3);
    frame.restore();
    expect(mesh.material).toBe(original);
    expect(original.map).toBe(color);
    expect(original.normalMap).toBe(normal);
    const disposeToon = vi.fn(), disposeOriginal = vi.fn(), disposeMap = vi.fn();
    toon.addEventListener("dispose", disposeToon);
    original.addEventListener("dispose", disposeOriginal);
    color.addEventListener("dispose", disposeMap);
    surfaces.dispose();
    expect(disposeToon).toHaveBeenCalledOnce();
    expect(disposeOriginal).not.toHaveBeenCalled();
    expect(disposeMap).not.toHaveBeenCalled();
  });

  it("leaves water, contact shadows and particles alone, and handles models added after initialization", () => {
    const scene = new THREE.Scene();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.8 }));
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShadowMaterial());
    const materials = [water.material, shadow.material];
    scene.add(water, shadow);
    const surfaces = createToonSurfaces("toon-ink");
    surfaces.apply(scene).restore();
    const model = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xaabbcc }));
    scene.add(model);
    const frame = surfaces.apply(scene);
    expect(frame.outlined).toEqual([model]);
    expect([water.material, shadow.material]).toEqual(materials);
    const toon = model.material;
    frame.restore();
    const disposed = vi.fn(); toon.addEventListener("dispose", disposed);
    scene.remove(model);
    surfaces.apply(scene).restore();
    expect(disposed).toHaveBeenCalledOnce();
    surfaces.dispose();
  });
});
