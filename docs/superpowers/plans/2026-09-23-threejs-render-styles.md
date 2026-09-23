# Three.js Render Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each Three.js ritual choose an approved visual style through its content configuration, starting with woodfish and two cartoon presets.

**Architecture:** Extend the validated woodfish content pack with a style ID, then route its scene draws through a reusable postprocessing module. The module owns composer targets, shader uniforms, resizing, and disposal; the existing scene keeps model validation, raycasting, animation, and content fallback. Crane can reuse the same API when it gains a Three.js engine.

**Tech Stack:** TypeScript, Three.js 0.170 postprocessing addons, Vitest, Vite, Playwright Python scripts.

**Spec:** `docs/superpowers/specs/2026-09-23-threejs-render-styles-design.md`

## Global Constraints

- Presets: `original`, `toon-ink`, `toon-soft`; only these IDs may arrive from content.
- Old packs without `renderStyle` resolve to `original`.
- Configure remote woodfish in `content/woodfish/pack.json` and offline woodfish independently in `content/woodfish/bundled.json`.
- Preserve transparent canvas output, current pointer/raycast behavior, content confirmation, and scene cleanup.
- Do not add a login UI, remote Shader source, a crane GLB, or style values to personal save data.
- Do not overwrite unrelated working tree changes already present in app and mobile files.

## Review Focus

1. An old cached pack without `renderStyle` must still load as `original`; pin in Task 1.
2. An unrecognized or code-like style ID must be rejected before rendering; pin in Task 1.
3. A style-only content change must create a distinct release fingerprint without a new GLB; pin in Task 1.
4. A transparent scene edge must stay transparent after postprocessing and resizing; pin in Task 2 browser probe.
5. A Shader compile failure or context loss must leave either original rendering or the existing fallback UI, and dispose GPU state; pin in Task 3 browser probe.

---

## File map

- `packages/content/src/index.ts`: style ID type, parser, default, and pack contract.
- `packages/content/src/local-first.test.ts`: old/invalid/style-select pack cases.
- `content/woodfish/{pack,bundled}.json`: independent authoring choices.
- `packages/content/src/bundled.ts`: generated bundled descriptor via existing asset preparation.
- `scripts/publish-scene-content.mjs`: existing normalized-pack fingerprint, exercised by the release check.
- `packages/app/src/render-style.ts`: reusable style renderer and Shader presets; no ritual-specific logic.
- `packages/app/src/woodfish-scene.ts`: pass pack style to renderer, draw/resize/dispose through it.
- `scripts/test-woodfish-style.py`: browser verification for style output, transparency, interaction, and error fallback.
- `docs/scene-content.md`: explain the content field and publish behavior.

### Task 1: Validated per-scene style choice

**Files:** Modify `packages/content/src/index.ts`, `packages/content/src/local-first.test.ts`, `content/woodfish/pack.json`, `content/woodfish/bundled.json`, `packages/content/src/bundled.ts`, `docs/scene-content.md`.

**Interfaces:** Produces `RenderStyleId = "original" | "toon-ink" | "toon-soft"`, `parseRenderStyle(value: unknown): RenderStyleId`, and `Pack.renderStyle: RenderStyleId` for Task 2 and Task 3.

- [ ] **Step 1: Write failing content tests.** In `local-first.test.ts`, assert `parsePack(pack()).renderStyle === "original"`; assert the two toon IDs survive parsing; assert `"toon-custom"`, `"<script>"`, and an object throw. Run a prepare/publish test or a short Node command comparing the two normalized pack fingerprints with the same model and distinct styles.

```ts
expect(parsePack(pack()).renderStyle).toBe("original");
for (const renderStyle of ["toon-ink", "toon-soft"] as const)
  expect(parsePack({ ...pack(), renderStyle }).renderStyle).toBe(renderStyle);
for (const renderStyle of ["toon-custom", "<script>", {}])
  expect(() => parsePack({ ...pack(), renderStyle })).toThrow();
```

- [ ] **Step 2: Run red test.** `npm run test -w @wbr/content -- --run src/local-first.test.ts`; expect the first assertion or strict-field validation to fail.
- [ ] **Step 3: Implement the contract.** Add `renderStyle` to allowed top-level keys, parse the exact union with missing/undefined mapped to `original`, and return the normalized field. Keep `schemaVersion: 1` and all asset rules unchanged. Set the authoring JSON explicitly: bundled `original`, remote `toon-ink`; regenerate `bundled.ts` using `node scripts/prepare-app-assets.mjs`. The current publisher fingerprints `JSON.stringify(parsePack(pack))`, so a distinct ID is included without changing its flow.

```ts
export type RenderStyleId = "original" | "toon-ink" | "toon-soft";
export function parseRenderStyle(value: unknown): RenderStyleId {
  if (value === undefined) return "original";
  if (value === "original" || value === "toon-ink" || value === "toon-soft") return value;
  throw Error("Unsupported render style");
}
```

- [ ] **Step 4: Verify green and publish fingerprint.** Run `npm run test -w @wbr/content`, `npm run content:publish`, then compare the release JSON style and normalized SHA-256 input against `original`. Confirm the GLB digest remains identical. Update `docs/scene-content.md` with one JSON example and the next-entry behavior.
- [ ] **Step 5: Commit the focused change.** Stage only files listed in this task and commit `feat: validate scene render style selection`.

### Task 2: Shared cartoon postprocessor

**Files:** Create `packages/app/src/render-style.ts`, `scripts/test-woodfish-style.py`.

**Interfaces:** Consumes `RenderStyleId` from `@wbr/content`. Produces `createRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): { setStyle(id: RenderStyleId): void; resize(width: number, height: number): void; render(): void; dispose(): void }`. `render()` falls back to `original` if only the style pass fails; original scene shader errors remain visible to the host.

- [ ] **Step 1: Add a focused browser probe.** Start the existing Vite dev server as done in `scripts/test-scene-content.py`. In a Playwright page, dynamically import `/@fs/<absolute repo path>/packages/app/src/render-style.ts` and `/@fs/<absolute repo path>/node_modules/three/build/three.module.js`; create an alpha canvas, a lit colored sphere, a transparent scene, and an orthographic camera. Read pixels with `canvas.getContext("webgl2").readPixels(...)` after original and toon renders. Assert nonzero center alpha, zero corner alpha, a toon-vs-original pixel difference, and zero corner alpha after resize. Call `dispose()` and `renderer.dispose()` at the end.

```python
assert original_center[3] > 0
assert toon_corner[3] == 0
assert sum(abs(a-b) for a,b in zip(original_center[:3], toon_center[:3])) > 10
assert resized_corner[3] == 0
```

- [ ] **Step 2: Run red probe.** `python scripts/test-woodfish-style.py`; expect module import or style API failure.
- [ ] **Step 3: Implement one module.** Keep `original` on direct `renderer.render(scene,camera)`. For either toon preset, create `EffectComposer`, `RenderPass`, `ShaderPass`, and `OutputPass` from `three/addons/postprocessing`, with an explicit RGBA render target, clear alpha 0, and `NoBlending` on fullscreen passes. Use one Shader with quantized luminance and neighbor-difference ink strength. Return straight-alpha `vec4(rgb, alpha)` so OutputPass preserves canvas transparency; skip outline darkening where alpha is zero. Provide presets through numeric uniforms rather than duplicated GLSL. Set composer pixel ratio/size on resize; dispose ShaderPass, OutputPass, and composer targets when switching back or unmounting. While a style pass draws, temporarily wrap `renderer.debug.onShaderError`: if it fires or the pass throws, dispose the composer, switch to `original`, and redraw directly; restore the original callback afterward.

```ts
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
  vec3 flat=floor(c.rgb*steps+0.5)/steps;
  flat=mix(flat,vec3(dot(flat,vec3(0.299,0.587,0.114))),tint);
  gl_FragColor=vec4(mix(flat,flat*0.24,ink),c.a);
}`,
};
```

- [ ] **Step 4: Verify green on real WebGL.** Run the browser probe at 390×844 and 1280×800 viewport sizes. Save and inspect one screenshot per preset; check that toon shades and outlines are visible without an opaque rectangle or border halos.
- [ ] **Step 5: Commit the focused change.** Stage the module and browser probe, commit `feat: add reusable cartoon render styles`.

### Task 3: Mount woodfish with its selected style

**Files:** Modify `packages/app/src/woodfish-scene.ts`, `scripts/test-woodfish-style.py`.

**Interfaces:** Consumes `Pack.renderStyle` and `createRenderStyle(...)`. No changes to `WoodfishController` or `mountScene` interfaces.

- [ ] **Step 1: Extend the browser probe.** Route the remote woodfish manifest with `renderStyle: "toon-soft"`, enter the ritual twice so the prepared candidate becomes active, and assert its content revision and visible canvas differ from `original`. Click the woodfish and assert its count advances. Inject a failure by monkeypatching the style renderer's `EffectComposer.render` in the browser before the second mount, then assert the canvas remains usable through direct rendering. Emulate context loss with `WEBGL_lose_context` and assert the existing fallback UI appears.

```python
assert page.locator(".woodfish-canvas canvas").count() == 1
assert page.locator(".woodfish-visual").get_attribute("data-renderer") == "ready"
page.get_by_role("button", name="轻敲木鱼").click()
assert page.locator(".woodfish-canvas canvas").count() == 1
```

- [ ] **Step 2: Run red probe.** `python scripts/test-woodfish-style.py`; expect the remote style to have no visible effect yet.
- [ ] **Step 3: Integrate at three render sites.** Construct one style renderer after scene/camera creation. During candidate initialization, validate the model with the existing direct draw, then `setStyle(pack.renderStyle)` and draw through the style renderer; the module's temporary shader-error handler owns style-only failure, while the existing scene handler still catches model shader failure. Replace the normal animation frame's direct draw with `styleRenderer.render()`, call `styleRenderer.resize(width,height)` from `resize()`, and `styleRenderer.dispose()` before `renderer.dispose()`. Save the prior style ID before candidate initialization and restore it on a failed candidate, while preserving the current model cleanup.

```ts
const styleRenderer = createRenderStyle(renderer, scene, camera);
// In the candidate initializer, after the existing direct model check:
styleRenderer.setStyle(pack.renderStyle);
styleRenderer.render();
// In resize/render/dispose respectively:
styleRenderer.resize(width, height);
styleRenderer.render();
styleRenderer.dispose();
```

- [ ] **Step 4: Verify behavior.** Run `npm run test -w @wbr/app`, `npm run test -w @wbr/content`, `npm run build`, `python scripts/test-woodfish-style.py`, and `python scripts/test-scene-content.py`. Confirm remote updates remain next-entry only and offline bundled mode still renders. Run `git diff --check`.
- [ ] **Step 5: Commit the focused change.** Stage only the woodfish scene and updated probe; commit `feat: apply content-selected style to woodfish`.

### Task 4: Final verification and documentation

**Files:** Modify `docs/scene-content.md` if Task 3 reveals a changed operational detail.

**Interfaces:** No new interfaces; this task checks the complete feature against the spec.

- [ ] **Step 1: Verify the full repository.** Run `npm run verify`. Record any pre-existing failure tied to unrelated dirty files separately, and rerun only the affected gate after diagnosis.
- [ ] **Step 2: Review the diff and screenshots.** Check that canvas-only styling, toon preset difference, content revision behavior, transparent edges, and cleanup match the spec. Run `git status --short` to ensure unrelated user changes remain untouched.
- [ ] **Step 3: Commit any necessary documentation correction.** Stage only the correction and commit `docs: document scene style publishing` if a correction was needed.
