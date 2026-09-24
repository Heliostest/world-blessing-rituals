import type * as THREE from "three";
import { debugStyles } from "./debug-styles";
import { createRenderStyle } from "./render-style";

/** Content defaults remain independent of browser-local debug overrides. */
export function createDebugRenderStyle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  { id, label, invalidate = () => {} }: { id: string; label: string; invalidate?: () => void },
) {
  const style = createRenderStyle(renderer, scene, camera);
  const registration = debugStyles.register(id, label, (selected) => {
    style.setStyle(selected);
    invalidate();
  });
  return {
    setStyle: registration.setDefault,
    resize: style.resize,
    render() {
      style.render();
      registration.report(style.getStyle());
    },
    dispose() {
      registration.dispose();
      style.dispose();
    },
  };
}
