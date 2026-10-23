# Three.js overall style / look shader audit

Date: 2026-10-19
Branch: `docs/threejs-style-shader-audit` (based on `master` @ `7818012`)
Scope: every overall look path in the Three.js scenes (postprocessing, tone mapping, toon/outline, fog/sky/environment, custom GLSL looks, procedural-kit look helpers), the in-app debug overlay (SHADER LAB / 调试台), and proposals for a prettier cute, vivid, ACNH-adjacent 三渲二 look. This is a documentation-only audit. No visual code is changed.

## 中文摘要

- **只有一条共享风格管线**：`packages/scene-runtime/src/render-style.ts`，使用 pmndrs `postprocessing`（`RenderPass` → `EffectPass(ToneMapping ACES + OutlineEffect)`），配合 `toon-surfaces.ts` 在渲染时临时换成 `MeshToonMaterial`。预设只有三个：`original` / `toon-ink` / `toon-soft`。
- **全部 77 个 `packages/scenes` 场景和木鱼**都经过 `createDebugRenderStyle`；其中 75 个场景硬编码 `CEL_STYLE = 'toon-soft'`。另外，每个场景在 `cozy-environment.ts` 都有 profile，会统一设置天空、雾、HDR 环境光照和阴影，并且**每帧覆盖场景自带灯光的颜色和强度**。
- 自定义 GLSL 只用于装饰元素：草地（`stylized-meadow.ts`，`ShaderMaterial`）和水面/焦散（`stylized-water.ts`，`onBeforeCompile`）。没有 bloom、LUT/调色、色彩分级、景深或 SSAO。
- **调试台**（`apps/cyber-bless/src/DebugOverlay.tsx`）可以按场景切换三个预设，并按场景 ID 保存到 localStorage。它的下拉框只列出已挂载的场景，不是场景目录。没有参数滑杆，没有调色、bloom 或环境开关，也不能比较不同 look。
- 内容包的 `renderStyle` 字段会被解析，但运行时没有读取（木鱼的包写 `toon-ink`，实际固定为 `toon-soft`）。`docs/debug-overlay.md` 中相关描述已过期。
- 建议（按优先级）：① 数据化的 Look Preset（参数化 + 调试滑杆）；② 统一的 "Island Grade" 后处理（暖调 LUT + 轻微 bloom + 暗角）；③ ACNH 式卡通面：半兰伯特 + 色相偏移的阴影 + 边缘光；④ 法线/深度屏幕空间描边，替代 OutlineEffect；⑤ 渐变天空 + 高度雾 + 柔化地平线；⑥ 移动端性能分级。

---

## 1. Inventory

### 1.1 Shared look pipeline (the only postprocessing path)

| Module | What it does | Used by |
| --- | --- | --- |
| `packages/scene-runtime/src/render-style.ts` | `createRenderStyle(renderer, scene, camera)`. With `original`, it calls `renderer.render` directly. With a toon preset it lazily builds a pmndrs `EffectComposer` (`HalfFloatType`, `multisampling: 2`) → `RenderPass` → one `EffectPass(ToneMappingEffect(ACES_FILMIC), OutlineEffect)`. During the composer pass it sets `renderer.toneMapping = NoToneMapping`, so ACES runs once, in the effect. The outline is `BlendFunction.ALPHA`, colour `0x584235` (warm brown), edge strength 1.8 (ink) or 0.45 (soft), and `xRay: false`. It snapshots and restores renderer, scene and layer state each frame. If a shader error occurs or the pass throws, it falls back to `original`. | Every Three.js scene, through `debug-render-style.ts`. `packages/app/src/render-style.ts` is a re-export only. |
| `packages/scene-runtime/src/toon-surfaces.ts` | Swaps materials per frame. Opaque `MeshStandard`/`Phong`/`Lambert` materials are replaced by cached `MeshToonMaterial`s with a generated `DataTexture` gradient map. `toon-ink` uses 3 hard bands (85/165/235, nearest filter). `toon-soft` uses a 128-texel ramp with 5 plateaus (60…238) and smoothstep joins. Normal and bump maps are dropped unless the finish is preserved. In `toon-soft`, physical, metallic (≥0.3) and glossy (≤0.4 roughness) materials stay PBR; `shading:"smooth"` becomes matte `MeshStandardMaterial`. Transparent materials are skipped. Per-mesh art direction comes from `mesh.userData.toonSurface` (`color`, `simplifyMap`, `aoIntensity`, `outline`, `metalness`, `roughness`, `shading`). Live colour, emissive, opacity and visibility are copied from the source materials every frame. | Through `render-style.ts`, so every scene |
| `packages/scene-runtime/src/debug-render-style.ts` | `createDebugRenderStyle(renderer, scene, camera, {id,label,invalidate})` combines render-style, interaction cues and the cozy environment, and registers the scene with the debug style registry. If a cozy profile exists, it calls `registration.setDefault("toon-soft")`. | 77/77 scene folders in `packages/scenes/src/*/scene.ts`, and `packages/app/src/woodfish-scene.ts` |
| `packages/content/src/index.ts` | `RenderStyleId = "original" \| "toon-ink" \| "toon-soft"` is the closed enum for presets. `parseRenderStyle` validates the pack field `renderStyle`. | Content packs (`content/woodfish/*.json` = `toon-ink`) |

**Tone mapping summary.** All scenes use ACES Filmic. Under `original` it is applied by the renderer. Under toon presets it is applied by `ToneMappingEffect`. Exposure is set in these places:

| Exposure source | Value | Scenes |
| --- | --- | --- |
| `createWarmStage` (`procedural-kit.ts:85`) | 1.0 | 75 scenes |
| Custom renderer | 1.05 | `celtic-folk-spring`, `theravada-water` |
| Content pack | `parameters.exposure` | woodfish |

> To verify: whether pmndrs `ToneMappingEffect` honours `renderer.toneMappingExposure` while the composer forces `NoToneMapping`. `node_modules` is absent in this checkout. If it does not, the woodfish pack exposure and the 1.05 values only affect `original`.

### 1.2 Environment / atmosphere look (fog, sky, IBL, lights, shadows)

| Module | What it does | Used by |
| --- | --- | --- |
| `packages/scene-runtime/src/cozy-environment.ts` | A per-scene `profiles` table (78 entries) assigns each scene a kind and an optional night flag. **Kinds:** garden 21, veranda 36, courtyard 18, river 2, table 1. Five scenes are night scenes; three of them also set `warmLight`. **Sky and fog:** a painted sky gradient `DataTexture` (horizon `0x9ed9f3` → zenith `0x409ee0`) is used as `scene.background`, and `scene.fog = THREE.Fog(horizon, 18–55)` (night: 7–24). **HDR lighting:** a Kloppenheim 1k HDR (`RGBELoader`) supplies `scene.environment` for image-based lighting (IBL) at intensity 0.16–0.25. At night the HDR is also the background. **Every `prepare()` (per frame)** it enables `shadowMap` (PCF, or PCFSoft at night). It also overwrites the colour and intensity of every Ambient, Hemisphere and Directional light in the scene; the daylight key light is 3.8. On the first frame it applies shadow settings: 2048 map by day, 1024 at night. **Ground and props:** ground, decks and trim use matte `MeshStandardMaterial`s marked `toonSurface: {outline:false, shading:"smooth"}`. Props come from the Kenney nature kit and are instanced. | All 77 `packages/scenes` scenes, plus woodfish and the others listed in the table |
| `packages/scene-runtime/src/stylized-meadow.ts` | **Custom GLSL `ShaderMaterial`** on instanced grass tufts. The vertex shader bends the blades with wind (adapted from boona13, MIT). The fragment shader uses fake sun from a constant direction, the shadow mask, a root-to-tip colour lerp and a ×1.65 boost, then includes `tonemapping_fragment`, `colorspace_fragment` and `fog_fragment`. The ground uses a generated 256 px colour map. `toonSurface: {outline:false}`; the material is not adapted because it is a `ShaderMaterial`. | Garden and river kinds via cozy-environment (daylight) |
| `packages/scene-runtime/src/stylized-trees.ts` | KayKit broadleaf trees with the atlas baked into vertex colours. Matte `MeshStandardMaterial` (roughness 0.96, envMapIntensity 0.45), tiny canopy sway, deterministic tint jitter. | Daylight cozy environments |
| `packages/scene-runtime/src/stylized-water.ts` | **`onBeforeCompile` GLSL injection**. The water surface is a transparent `MeshPhysicalMaterial` with crossing normal waves. The bed is a `MeshStandardMaterial` with a warped two-layer Voronoi caustic and derivative/distance attenuation. The bed opts out of toon adaptation so the shader survives. | `celtic-folk-spring`, `theravada-water`, `slavic-wreath`, `floating-lantern-loy-krathong` |
| Scene-local fog/background | `scene.background = 0x081420` + `FogExp2` (0.085–0.09) | `celtic-folk-spring`, `theravada-water`. Both are also in cozy profiles, which replace the background and fog at mount. |

### 1.3 Procedural-kit look helpers (`packages/scenes/src/procedural-kit.ts`)

| Export | What it does | Usage |
| --- | --- | --- |
| `CEL_STYLE = 'toon-soft'` | The default preset for the "soft painted village" look | Passed to `style.setStyle(CEL_STYLE)` by 75 scenes |
| `createWarmStage(canvas)` | `WebGLRenderer` with alpha and antialias, DPR ≤ 2, transparent clear, ACES with exposure 1.0, sRGB output. Its comment says "no painted background, fog", but cozy-environment now adds both, so the comment is stale. | 75 scenes (all except celtic, theravada) |
| `addCelLights` / `addStageLights` / `NIGHT_CEL_LIGHTS` | An "anime cel" rig of ambient, hemisphere, key and rim lights. Night swaps to cool moonlight. | 69 via `addStageLights`, 6 via `addCelLights` directly. **Their colours and intensities are overwritten each frame by cozy-environment** (see 1.2). Only light positions, and the rim light's role as an extra directional light, survive. |
| `createLampHalo` | An additive `SpriteMaterial` with a generated radial alpha texture. This is a fake glow, since there is no bloom pass. | 4 scenes (night lamp scenes) |

### 1.4 Things that do **not** exist today

No bloom (`UnrealBloomPass`/`BloomEffect`), no LUT or colour grade (`LUT3DEffect`, `HueSaturationEffect`, `BrightnessContrastEffect`), no vignette, no SSAO/N8AO, no depth of field, no screen-space normal/depth edge pass, no FXAA/SMAA (the composer relies on MSAA ×2), no `OutputPass`, and no `three/addons/postprocessing`. The 2026-09-23 plan's custom screen-space quantize + colour-difference ink `ShaderPass` was removed (see `docs/debug-overlay.md`). The mobile app (`apps/mobile-expo`) is an Expo DOM (`"use dom"`) wrapper around `@wbr/app`, so it shares the same pipeline and has no native renderer.

### 1.5 Scene → look matrix

| Scene group | Renderer setup | Default preset | Environment | Extra look shaders |
| --- | --- | --- | --- | --- |
| 75 procedural scenes in `packages/scenes/src/*` | `createWarmStage` | `toon-soft` (`CEL_STYLE`) | cozy profile (garden/veranda/courtyard/river/table) | meadow and trees on garden/river kinds; halos in 4 night scenes; water in `slavic-wreath` and `floating-lantern-loy-krathong` |
| `celtic-folk-spring`, `theravada-water` | Custom (`ACES` 1.05, `FogExp2`) | `toon-soft` via cozy default (no explicit `setStyle`) | cozy profile garden/courtyard | `stylized-water` |
| woodfish (`packages/app/src/woodfish-scene.ts`) | Custom (`ACES`, DPR ≤ 1.75, pack exposure) | `toon-soft`, hard-coded | cozy veranda | GLB + per-mesh `toonSurface` palette |

## 2. Debug UI / 调试台 findings

**What exists**

- `apps/cyber-bless/src/DebugOverlay.tsx` + `debug-overlay.css` is the **SHADER LAB** panel. It is enabled in dev, or in production with `?debug=1`, and is mounted on the main app, `/dev/*` and `/scene-review`.
  - The **当前场景** `<select>` lists only *currently mounted, registered* scenes (`debugStyles.getSnapshot()`), not the catalog.
  - **Preset buttons**: the three `styleOptions` (原始光照 / 墨线卡通 / 柔和卡通).
  - **Status** shows the actual style, including the fallback label if a shader failed. **恢复内容默认** clears the override.
- `packages/scene-runtime/src/debug-styles.ts` is the registry. Overrides are stored per scene ID in localStorage `wbr.debug.scene-styles.v1`, applied live without resetting ritual progress, and ignored when debug is off.
- **Scene pickers are separate tools:**

  | Tool | Location | Behaviour |
  | --- | --- | --- |
  | `SceneReview.tsx` | `/scene-review` (dev) | First/previous/next/last buttons and a jump `<select>` over `builtInScenes` |
  | `DevApp.tsx` | `/dev/scene/:sceneId` (dev) | Route `/dev/scene/:sceneId` with a Gallery |
  | `scripts/preview-cozy-scenes.mjs` | CLI | `WBR_STYLE_AUDIT=1` drives the overlay headlessly and records selected vs actual style |
- Tests: `scripts/test-debug-overlay.py`, `scripts/test-woodfish-style.py`, `packages/scene-runtime/src/debug-styles.test.ts`.

**Gaps**

1. **Look presets are a closed enum of three.** `RenderStyleId` in `@wbr/content` is shared by content validation and debug, so adding a look requires a content-schema change.
2. **No per-preset parameters.** Outline strength and colour, band count and ramp, exposure, saturation, and fog distance are constants in code, with no sliders and no "copy values" export.
3. **No environment controls.** You cannot toggle or compare sky, fog, HDR intensity, shadows, meadow or trees, or the cozy light override, even though these drive most of the overall look.
4. **No A/B comparison.** There is no split-screen or quick-toggle hotkey for "same frame, two looks". Comparisons rely on offline artifacts (`artifacts/toon-render-audit/`, `artifacts/cozy-scenes/…`).
5. **Scene picker ≠ look picker.** To audit one look across all scenes you need SceneReview plus SHADER LAB, and there is no "apply this override to all scenes" action.
6. **No performance readout.** The panel shows no frame time, draw calls, DPR or composer state, although mobile cost is the main constraint on new passes.
7. **Content default is not honoured.** The pack field `renderStyle` is parsed but has no runtime reader. The woodfish pack says `toon-ink`; the runtime hard-codes `toon-soft`, and cozy-environment also forces `toon-soft`. `docs/debug-overlay.md` ("木鱼重新使用当前内容包的 renderStyle"; "两个旧场景默认使用原始光照") is out of date.

## 3. Recommendations (三渲二 look presets)

The goal is cute, vivid, ACNH-adjacent stylized 3D: saturated but soft colour, warm shadows instead of grey ones, clean silhouettes, airy depth, and a "toy diorama" read. These proposals are ordered by value/effort.

### R1. Data-driven Look Presets + debug sliders (enabler) — 风格预设数据化

- **Approach:** Replace the `RenderStyleId` enum with a `LookPreset` object in `scene-runtime`. It would hold the following fields:

  | Group | Fields |
  | --- | --- |
  | Surfaces | ramp stops, hard/soft |
  | Outline | colour, strength, thickness |
  | Tone mapping | operator, exposure |
  | Grade | saturation, warmth, lift/gamma/gain or LUT id |
  | Bloom | threshold, intensity |
  | Atmosphere | fog near/far/colour, sky gradient |
  | Lights | normalization values currently hard-coded in cozy-environment |

  Content keeps a string id (backward-compatible with `original`/`toon-ink`/`toon-soft`) and may add an optional partial override. SHADER LAB gains grouped sliders, a "copy JSON" button, "apply to all mounted scenes" and an A/B toggle.
- **Visual intent:** None directly. This makes every later look tunable by Helio in-app instead of through code edits.
- **Tradeoffs:**

  | Perf | Effort | Consistency |
  | --- | --- | --- |
  | Zero runtime cost | Medium (refactor of render-style, toon-surfaces, cozy-environment constants; content schema migration) | Very high; one preset can be enforced everywhere. This should come first. |

### R2. "Island Grade" postprocessing — 统一调色 (LUT + soft bloom + vignette)

- **Approach:** Extend the existing single `EffectPass` with pmndrs effects. One `EffectPass` merges them into one fullscreen shader, so this adds no extra pass for the grade:
  - `LUT3DEffect` with a small 16³ or 32³ warm, slightly lifted pastel LUT, or `HueSaturationEffect` + `BrightnessContrastEffect` as a no-asset fallback
  - `BloomEffect` (mipmap blur, high threshold ~0.85, low intensity) only for lamps, candles, emissive and water glints
  - a very light `VignetteEffect`

  Bloom replaces most of the `createLampHalo` sprite tricks over time. Consider swapping ACES for `AGX` or `NEUTRAL` (available in three r170 and pmndrs). ACES desaturates and shifts bright pastels toward yellow, which works against "vivid cute".
- **Visual intent:** A cohesive "sunny island postcard" palette across all ~78 scenes, with candy-but-soft saturation, warm highlights, cool-lavender shade and gentle glow on magical moments.
- **Tradeoffs:**

  | Perf | Effort | Consistency |
  | --- | --- | --- |
  | The LUT, saturation and vignette cost about one texture fetch merged into the existing pass, which is cheap. Bloom adds a mip chain, roughly 5–6 small passes; gate it behind a perf tier (R6) or disable it in daytime scenes. | Low–medium | High. A grade is the single biggest lever for "looks like one game". A LUT asset needs provenance per repo rules. |

### R3. ACNH-style toon surface: half-Lambert ramp + hue-shifted shade + rim — 暖色阴影卡通面

- **Approach:** Keep `MeshToonMaterial`, but extend it with `onBeforeCompile`, the same technique already used in `stylized-water.ts`, or with THREE-CustomShaderMaterial, which `docs/debug-overlay.md` already evaluated. The extension would:
  - use a half-Lambert / wrapped diffuse (`NdotL*0.5+0.5`) into a 2–3-stop **colour** ramp rather than a luminance ramp, so shadows shift toward a per-preset shade tint (e.g. warm violet `#8d7bb8` blended at 30–40%) instead of going grey
  - add a fresnel rim term coloured by the sky
  - optionally add a subtle matcap-style specular "toy sheen" on plastic or ceramic

  Make the ramp and tint uniforms part of the `LookPreset` (R1).
- **Visual intent:** The ACNH / Animal Crossing toy read: soft rounded volumes, colourful shade, a bright rim against the sky, no muddy dark sides. This directly fixes the issue that `toon-soft`'s 60→238 luminance ramp produces grey-brown shade under ACES.
- **Tradeoffs:**

  | Perf | Effort | Consistency |
  | --- | --- | --- |
  | Per-fragment cost about equal to `MeshToonMaterial`, cheaper than PBR | Medium. One shared chunk, plus golden-image checks on the "rounded diffuse / flat paper / metal / night" set that `docs/scene-rendering.md` requires. | High. The material swap already covers every opaque surface. The ground and environment (`shading:"smooth"`) should get a softened variant so the world matches the subjects. |

### R4. Screen-space normal+depth outline (replace OutlineEffect) — 屏幕空间描边

- **Approach:** Write `scene normal` and `depth` into the existing `RenderPass`, using `NormalPass` or an MRT `RenderPass`. Then run one custom `Effect` that detects edges with a Sobel/Roberts filter on depth and normal, with distance-scaled thickness and colour multiplied from the scene colour (darkened, hue-kept) instead of flat brown `0x584235`. Exclusion uses an outline mask layer, or reuses the existing `toonSurface.outline:false` via layers.
- **Visual intent:** Inner creases and silhouette lines like hand-drawn 2D: coloured lines (dark red on a red object) and thinner lines in the distance. This is the core of a "reads 2D" 三渲二 look. Today's `OutlineEffect` only draws selection-mask silhouettes and runs extra mask/depth renders.
- **Tradeoffs:**

  | Perf | Effort | Consistency |
  | --- | --- | --- |
  | One normal pre-pass (≈ +1 scene draw, similar to OutlineEffect's mask render), then a cheap fullscreen edge filter. Usually a net win over OutlineEffect at `multisampling: 2`. | Medium–high. This needs application-authored GLSL, which `render-style.ts` explicitly avoids ("no application-authored GLSL"), so it is a policy decision for Helio. It also needs tuning so wood-grain or meadow normals don't produce noise; normal and bump maps are already stripped in toon mode, which helps. | High once tuned. |

### R5. Painted sky dome + height fog + soft horizon — 渐变天空与高度雾

- **Approach:** Replace the 4×64 `DataTexture` backdrop with a tiny sky-dome `ShaderMaterial`: a 3-stop gradient (horizon cream → mid aqua → zenith blue), optional procedural soft cloud blobs, and a sun disc. Replace linear `THREE.Fog` with a height-plus-distance fog that tints toward the horizon colour, either through `onBeforeCompile` on `fog_fragment` or with pmndrs `DepthEffect`-style fog in the `EffectPass`. Night presets use the same shader with navy, lavender and stars, instead of the HDR at 0.065 background intensity.
- **Visual intent:** An airy diorama depth in which the background reads as an illustration, not a photo panorama. This keeps subjects popping against a calm backdrop. It is what ACNH's sky and horizon fog do.
- **Tradeoffs:**

  | Perf | Effort | Consistency |
  | --- | --- | --- |
  | Trivial | Low–medium (sky shader); medium (height fog must be applied consistently to meadow `ShaderMaterial` and water, which include `fog_fragment` already) | High, because it lives entirely in cozy-environment |

### R6. Mobile perf tiers for the look — 性能分级

- **Approach:** Add a `quality: "low" | "mid" | "high"` field to the preset, chosen from DPR, `renderer.capabilities`, a short frame-time probe, and reduced-motion/battery hints.

  | Tier | Settings |
  | --- | --- |
  | Low | `original`-style direct render with a cheap toon ramp (R3) and no composer; vertex/backface ("inverted hull") outlines only on hero meshes; fog-only atmosphere; DPR 1.5; 1024 shadows |
  | Mid | Composer with merged grade + edges, no bloom |
  | High | Everything, including bloom and 2048 shadows |

  Show the tier and frame time in SHADER LAB.
- **Visual intent:** The same art direction on every device, degrading gracefully instead of falling back to `original` PBR.
- **Tradeoffs:**

  | Perf | Effort | Consistency |
  | --- | --- | --- |
  | Protects low-end phones; the half-float composer + MSAA ×2 + 2048 PCF shadows + per-frame light rewrite are the current heavy items | Medium. Needs real-device measurement; `docs/scene-rendering.md` notes that headless Chromium is not phone GPU evidence. | Medium; tiers must be visually validated side-by-side. |

**Suggested order:** R1 → R2 + R5 (grade and atmosphere give the biggest cross-scene payoff at low risk) → R3 → R4 → R6 in parallel with R2/R4 as passes are added.

## 4. Next steps (no implementation in this PR)

1. Decide policy with Helio: is application-authored GLSL in the shared look acceptable (needed for R3, R4, R5)? Is ACES still the target, or should we try AgX/Neutral?
2. Fix the low-risk inconsistencies found here, each in its own PR:
   - wire or remove the content `renderStyle` field (woodfish `toon-ink` vs runtime `toon-soft`)
   - update the stale comments and docs: `createWarmStage` comment, `docs/debug-overlay.md`
   - check whether pmndrs `ToneMappingEffect` honours `toneMappingExposure`
   - note that `addCelLights` colours are overridden by cozy-environment, then either drop them or make cozy-environment respect them
3. Prototype R1 (`LookPreset` + SHADER LAB sliders + A/B toggle) behind `?debug=1`.
4. Prototype R2/R5 as a fourth preset (e.g. `island-pastel`) on the review set: woodfish, one garden, one veranda, one water and one night scene. Capture comparisons with the existing `scripts/preview-cozy-scenes.mjs` audit flow into `artifacts/`.
5. Measure the composer and shadow cost on at least one low-end Android device and one iPhone before committing to bloom or screen-space edges.
