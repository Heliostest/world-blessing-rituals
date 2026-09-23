import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { RenderStyleId } from "@wbr/content";

const presets = {
  "toon-ink": { steps: 4, edge: 0.72, tint: 0.08 },
  "toon-soft": { steps: 6, edge: 0.28, tint: 0.04 },
} as const;

const shader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    steps: { value: 4 },
    edge: { value: 0.72 },
    tint: { value: 0.08 },
  },
  vertexShader: "varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader: `uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float steps, edge, tint;
varying vec2 vUv;
void main(){
  vec4 c=texture2D(tDiffuse,vUv);
  vec2 px=1.0/resolution;
  vec3 right=texture2D(tDiffuse,vUv+vec2(px.x,0.0)).rgb;
  vec3 up=texture2D(tDiffuse,vUv+vec2(0.0,px.y)).rgb;
  float ink=smoothstep(0.06,0.22,length(c.rgb-right)+length(c.rgb-up))*edge*c.a;
  vec3 quantized=floor(c.rgb*steps+0.5)/steps;
  quantized=mix(quantized,vec3(dot(quantized,vec3(0.299,0.587,0.114))),tint);
  gl_FragColor=vec4(mix(quantized,quantized*0.24,ink),c.a);
}`,
};

export function createRenderStyle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): {
  setStyle(id: RenderStyleId): void;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
} {
  let active: RenderStyleId = "original";
  let composer: EffectComposer | undefined;
  let shaderPass: ShaderPass | undefined;
  let outputPass: OutputPass | undefined;
  let width = renderer.getSize(new THREE.Vector2()).width;
  let height = renderer.getSize(new THREE.Vector2()).height;

  function release() {
    shaderPass?.dispose();
    outputPass?.dispose();
    composer?.dispose();
    shaderPass = undefined;
    outputPass = undefined;
    composer = undefined;
  }

  function sizeComposer() {
    if (!composer || !shaderPass) return;
    const ratio = renderer.getPixelRatio();
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    shaderPass.uniforms.resolution.value.set(width * ratio, height * ratio);
  }

  function setStyle(id: RenderStyleId) {
    if (id === "original") {
      release();
      active = id;
      return;
    }
    if (!composer) {
      const target = new THREE.WebGLRenderTarget(1, 1, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
      });
      composer = new EffectComposer(renderer, target);
      composer.addPass(new RenderPass(scene, camera, null, new THREE.Color(0x000000), 0));
      shaderPass = new ShaderPass(shader);
      shaderPass.material.blending = THREE.NoBlending;
      composer.addPass(shaderPass);
      outputPass = new OutputPass();
      outputPass.material.blending = THREE.NoBlending;
      composer.addPass(outputPass);
      sizeComposer();
    }
    const preset = presets[id];
    shaderPass!.uniforms.steps.value = preset.steps;
    shaderPass!.uniforms.edge.value = preset.edge;
    shaderPass!.uniforms.tint.value = preset.tint;
    active = id;
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = nextWidth;
    height = nextHeight;
    sizeComposer();
  }

  function render() {
    if (active === "original" || !composer || !shaderPass || !outputPass) {
      renderer.render(scene, camera);
      return;
    }

    // The scene pass keeps the host's shader-error handling. Only the two
    // fullscreen passes may trigger a style fallback.
    let stylePhase = false;
    let shaderFailed = false;
    const previousHandler = renderer.debug.onShaderError;
    const guarded = [shaderPass, outputPass];
    const originalRenders = guarded.map((pass) => pass.render);
    try {
      guarded.forEach((pass, index) => {
        const draw = originalRenders[index];
        pass.render = function (...args) {
          stylePhase = true;
          renderer.debug.onShaderError = () => { shaderFailed = true; };
          try {
            return draw.apply(this, args);
          } finally {
            renderer.debug.onShaderError = previousHandler;
          }
        };
      });
      composer.render();
    } catch (error) {
      if (!stylePhase) throw error;
      shaderFailed = true;
    } finally {
      guarded.forEach((pass, index) => { pass.render = originalRenders[index]; });
      renderer.debug.onShaderError = previousHandler;
    }
    if (shaderFailed) {
      setStyle("original");
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  return { setStyle, resize, render, dispose: release };
}
