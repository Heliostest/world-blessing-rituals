# C-grade three procedural scenes — Design A

Date: 2026-09-29
Branch: `feature/c-grade-three-scenes`

## Goals

- Add three lightweight, homage-only (C-grade) ritual *practice* scenes built on the
  same procedural Three.js pattern as `celtic-folk-spring` and `theravada-water`.
- Every scene: three progress steps, restore from `initialProgress`, reduced-motion
  support, mobile-first hit targets, clean disposal.
- All user-facing copy states 练习 / 非法效 and passes `assertSafeCopy`.

## Non-goals

- No real ritual procedure, liturgy or instructions; no claim of efficacy.
- No woodfish GLB engine, no GLB/texture/audio asset files — primitives and Web
  Audio oscillators only.
- No new gesture kinds, no content-pack (remote manifest) support for these engines.

## Design A: cream / warm, mobile-first

- Backgrounds are warm creams (`#f5efe6`, `#f3e6d8`, `#f6f0e4`) with matching
  `FogExp2`, amber/peach key lights and warm hemisphere fill — a deliberate contrast
  to the dark, cool palettes of celtic/theravada.
- Each scene uses a full-screen `.scene-hit-layer` plus a large invisible raycast
  target (box/sphere) around the interactive object, and always shows a visible
  `.scene-bow-tap` button as a tap fallback for any drag/tilt step.
- On portrait aspect ratios (< 0.8) the camera backs off so the subject fits.
- `ctx.isReducedMotion()` freezes decorative time (`t = 0`), removes auto
  animations (float/swing) by snapping to end states, and shortens/quietens audio.
- Shared helpers live in `packages/scenes/src/procedural-kit.ts`: overlay builder
  (title, step dots, aria-live hint, action button), warm stage setup, motes,
  `disposeTree`, and a per-instance lazy `AudioContext` chime (`createChimeAudio`)
  that no-ops without Web Audio and is closed on dispose.

## Scenes

| id / engine | Title | traditionSlug | Gestures (meta) |
|---|---|---|---|
| `tanzaku-tanabata` / `tanzaku-tanabata@1` | 短册系竹 | `shinto` | drag, wishWrite |
| `yeondeunghoe` / `yeondeunghoe@1` | 燃灯上浮 | `won-buddhism` | drag |
| `furin-wind-chime` / `furin-wind-chime@1` | 风铃一响 | `shinto` | tilt |

All: grade `C`, sensitivity `低`.

### tanzaku-tanabata — 短册系竹

Visuals: three segmented bamboo stalks (cylinders + node rings + leaf planes),
three pre-hung coloured paper strips swaying, one loose strip on the ground.

1. `pick` (→ progress 1): press the loose strip (picks it up and keeps dragging with
   the same pointer) or tap 「拾起纸条」.
2. `hang` (→ progress 2): drag onto the bamboo catch zone and release, or tap
   「挂到竹枝上」. The strip hangs, motes brighten, a warm glow flashes and a short
   oscillator chime plays.
3. `wish` (→ progress 3): optional short wishWrite submit, or tap 「静看片刻」.
   Dispatches `scene:complete`.

### yeondeunghoe — 燃灯上浮

Visuals: cream ground, plinth, a lotus paper lantern (two rings of petal shells +
emissive core + `PointLight`), four smaller companion lanterns drifting high.

1. `ready` (→ progress 1): tap the lantern, push upward (≈40 px vertical drag via
   `createTilt`), or tap 「轻推莲灯」.
2. `rise` (→ progress 2): lantern eases up over ~3.2 s while its light blooms and the
   camera tilts to follow; advances automatically. Reduced motion snaps to the top.
3. `rest` (→ progress 3): glow pulses; tap 「静看片刻」 to finish.

### furin-wind-chime — 风铃一响

Visuals: wooden eave beam, back wall, translucent glass bell with a red band,
clapper on a sub-pivot, and a four-segment paper ribbon that flutters.

1. `idle` (→ progress 1): vertical drag swings the bell (`createTilt`, 30°), tap the
   bell, or tap 「拂动风铃」. Triggers a damped-pendulum impulse and a glass-like
   ping (high sine partials).
2. `ring` (→ progress 2): swing + flutter for ~2.2 s, then auto-advance. Reduced
   motion skips straight to `listen` with minimal (clamped) sway.
3. `listen` (→ progress 3): gentle breeze sway; tapping the bell gives a softer
   ping without changing progress; tap 「静听片刻」 to finish.

## Lifecycle notes

- Transitions guard on `ctx.isActive()` unless restoring; `onProgress` and audio
  are suppressed while restoring from `initialProgress`.
- Auto-advances (`rise`→`rest`, `ring`→`listen`) run from `update()`, which only
  ticks while the scene is active.
- Dispose removes listeners, disposes gesture handles, closes the AudioContext,
  disposes the style renderer, renderer (+ `forceContextLoss`), and every geometry
  and material under the scene's root group.

## Registration points

- `packages/scenes/src/<id>/{scene.ts,index.ts}` — module + meta.
- `packages/scenes/src/registry.ts` — appended to `sceneRegistry`, added to
  `IMPLEMENTED`, `loadScene` cases (Gallery picks these up via
  `sceneRegistry` / `isSceneImplemented`).
- `packages/app/src/scene-engines.ts` — `proceduralEngine(id)` entries.
- `packages/app/src/scene-library.tsx` — `builtInScenes` catalog entries.
- `packages/app/src/scene-experience.tsx` — engine id union cast.

## Validation

- `npm run test -w @wbr/scenes` — registry order, metas, `isSceneImplemented`,
  `loadScene` resolves each new module with a meta equal to the registry entry.
- `npm run test -w @wbr/app` — procedural engine adapter.
- `npx tsc --noEmit -p packages/scenes`.
- `npm run build -w @wbr/cyber-bless`.
- Manual: open each scene on a phone-sized viewport, run through all three steps
  with drag/tilt and with tap fallbacks, toggle reduced motion, leave and re-enter
  mid-way to confirm progress restore.
