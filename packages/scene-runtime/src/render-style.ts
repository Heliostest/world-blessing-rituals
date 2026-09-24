import * as THREE from "three";
import { BlendFunction, EffectComposer, EffectPass, OutlineEffect, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import type { RenderStyleId } from "@wbr/content";
import { createToonSurfaces } from "./toon-surfaces";

/** Three.js MeshToonMaterial + pmndrs outlines. No application-authored GLSL. */
export function createRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let active: RenderStyleId = "original";
  let composer: EffectComposer | undefined;
  let outline: OutlineEffect | undefined;
  let surfaces: ReturnType<typeof createToonSurfaces> | undefined;
  let width = renderer.getSize(new THREE.Vector2()).width;
  let height = renderer.getSize(new THREE.Vector2()).height;

  function release() {
    outline?.selection.clear();
    composer?.dispose();
    surfaces?.dispose();
    composer = undefined;
    outline = undefined;
    surfaces = undefined;
  }

  function setStyle(id: RenderStyleId) {
    if (active === id) return;
    release();
    active = id;
  }

  function prepare() {
    if (composer || active === "original") return;
    surfaces = createToonSurfaces(active);
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 2 });
    composer.addPass(new RenderPass(scene, camera));
    outline = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.ALPHA,
      visibleEdgeColor: 0x584235,
      hiddenEdgeColor: 0x584235,
      edgeStrength: active === "toon-ink" ? 1.8 : 0.65,
      resolutionScale: 1,
      xRay: false,
      multisampling: 2,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    // Tone-map before compositing ink, so dark lines are not blown out by exposure.
    composer.addPass(new EffectPass(camera, tone, outline));
    composer.setSize(width, height);
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = nextWidth;
    height = nextHeight;
    composer?.setSize(width, height);
  }

  function render() {
    if (active === "original") {
      renderer.render(scene, camera);
      return;
    }
    const previous = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      toneMapping: renderer.toneMapping,
      color: renderer.getClearColor(new THREE.Color()),
      alpha: renderer.getClearAlpha(),
      shaderError: renderer.debug.onShaderError,
      background: scene.background,
      override: scene.overrideMaterial,
      cameraMask: camera.layers.mask,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    };
    // Outline rendering changes visibility/layers internally. Restore even on a failed pass.
    const objects: [THREE.Object3D, boolean, number][] = [];
    scene.traverse((object) => objects.push([object, object.visible, object.layers.mask]));
    let frame: ReturnType<ReturnType<typeof createToonSurfaces>["apply"]> | undefined;
    let failed = false;
    try {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.debug.onShaderError = () => { failed = true; };
      prepare();
      frame = surfaces!.apply(scene);
      outline!.selection.set(frame.outlined);
      renderer.autoClear = false;
      composer!.render();
    } catch {
      failed = true;
    } finally {
      frame?.restore();
      scene.background = previous.background;
      scene.overrideMaterial = previous.override;
      camera.layers.mask = previous.cameraMask;
      objects.forEach(([object, visible, mask]) => { object.visible = visible; object.layers.mask = mask; });
      renderer.setRenderTarget(previous.target);
      renderer.autoClear = previous.autoClear;
      renderer.toneMapping = previous.toneMapping;
      renderer.shadowMap.enabled = previous.shadowEnabled;
      renderer.shadowMap.autoUpdate = previous.shadowAutoUpdate;
      renderer.setClearColor(previous.color, previous.alpha);
      renderer.debug.onShaderError = previous.shaderError;
    }
    if (failed) {
      setStyle("original");
      // Original materials are restored first: a genuine scene failure still reaches the host.
      renderer.render(scene, camera);
    }
  }

  return { setStyle, getStyle: () => active, resize, render, dispose: release };
}
