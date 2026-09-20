# Cyber-Bless App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `world-blessing-rituals` into a monorepo with research content under `content/`, a mobile PWA shell `apps/cyber-bless`, shared gesture modules, and two wired pilot Three.js scenes (泉边一念 + 花水位一倾), proving the gesture library before the remaining three pilots.

**Architecture:** npm workspaces root owns `apps/*` and `packages/*`. The shell loads scenes only through a registry. Gestures are framework-agnostic (`mount` / `update` / `dispose`) and never write scores. Scenes own Three.js + step state machines; the shell owns routing and overlay chrome.

**Tech Stack:** TypeScript, Vite 6, React 19, react-router-dom 7, Three.js r170+, Vitest, npm workspaces. No Capacitor in this plan. No `@react-three/fiber` required for gestures (optional later inside a scene only).

**Spec:** `specs/2026-09-20-cyber-bless-app-design.md`

## Global Constraints

- Copy must never say 参拜成功 / 作福完成 / 通关 / 功德+N; always frame as 致敬小品 / 手势练习.
- No account, leaderboard, or points systems.
- Gesture logic lives only in `packages/gestures`; scenes compose, never fork pointer code.
- `content/traditions/*.md` is research-only; App UI titles use creative names from the scene registry.
- Gyro requires secure context; if permission denied, provide tap-to-bow / tap-to-hold fallback.
- Single-scene first-load asset budget intent: ≤ ~1.5MB gzip.
- Prefer Helio's coding path when applying repo writes: zcode (BigModel glm-5.3); Claude Opus only if zcode cannot complete the task.
- Commit after each task; push at task boundaries when remote is available.

---

## File map (create / move)

| Path | Responsibility |
|------|----------------|
| `package.json` (root) | workspaces + shared scripts |
| `content/traditions/` | moved research cards |
| `content/SOURCES.md`, `content/LICENSE` | moved from root |
| `packages/shared/` | types, disclaimers, UI primitives |
| `packages/gestures/` | drag, tilt, spin, gyro, wishWrite + tests |
| `packages/scenes/` | scene contract, registry, pilot scenes |
| `apps/cyber-bless/` | Vite React PWA shell + gesture playground routes |
| `scripts/build_map_data.py` | `TRAD` / GitHub URLs → `content/traditions` |
| `README.md` | document content vs app entry |

---

### Task 1: Content migration + workspace root

**Files:**
- Move: `traditions/` → `content/traditions/`
- Move: `SOURCES.md` → `content/SOURCES.md`
- Move: `LICENSE` → `content/LICENSE`
- Create: `package.json`
- Create: `.gitignore` entries for `node_modules`, `dist`, `*.local`
- Modify: `scripts/build_map_data.py` (`TRAD`, `GITHUB` paths)
- Modify: `README.md` (link paths under `content/`)

**Interfaces:**
- Consumes: existing git tree
- Produces: `content/traditions/<slug>.md` reachable; root workspace name `world-blessing-rituals`

- [ ] **Step 1: Move research files (git mv)**

```bash
cd /path/to/world-blessing-rituals
mkdir -p content
git mv traditions content/traditions
git mv SOURCES.md content/SOURCES.md
git mv LICENSE content/LICENSE
```

- [ ] **Step 2: Patch map builder paths**

In `scripts/build_map_data.py` set:

```python
TRAD = ROOT / "content" / "traditions"
GITHUB = "https://github.com/Heliostest/world-blessing-rituals/blob/master/content/traditions/{slug}.md"
```

Keep `OUT = ROOT / "docs" / "map-data.json"` unchanged (folder is `docs/`).

- [ ] **Step 3: Verify map script still runs**

```bash
python3 scripts/build_map_data.py
python3 -c "import json; d=json.load(open('docs/map-data.json')); assert isinstance(d, list); print(len(d))"
```

Expected: exits 0; `docs/map-data.json` is a JSON array; length stays > 500 (currently ~725).

- [ ] **Step 4: Add root workspace package.json**

```json
{
  "name": "world-blessing-rituals",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @wbr/cyber-bless",
    "build": "npm run build -w @wbr/cyber-bless",
    "test": "npm run test -w @wbr/gestures --if-present && npm run test -w @wbr/shared --if-present"
  }
}
```

- [ ] **Step 5: Update README links**

Replace `traditions/` links with `content/traditions/`. Add a short section:

```markdown
## 赛博祈福 App（开发中）

手机端壳：`apps/cyber-bless`（`npm install && npm run dev`）。
设计规格：`specs/2026-09-20-cyber-bless-app-design.md`。
```

- [ ] **Step 6: Commit**

```bash
git add -A content scripts/build_map_data.py package.json README.md
git status
git commit -m "chore: move research cards to content/ and add npm workspaces root"
```

---

### Task 2: `@wbr/shared` — types + disclaimers

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/disclaimers.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/disclaimers.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export type GestureKind = 'drag' | 'tilt' | 'spin' | 'gyro' | 'wishWrite'`
  - `export type SceneMeta` (id, title, traditionSlug, grade, sensitivity, gestures)
  - `export const GLOBAL_DISCLAIMER: string`
  - `export const FORBIDDEN_SUCCESS_PHRASES: string[]`
  - `export function assertSafeCopy(text: string): void`

- [ ] **Step 1: Scaffold package.json**

```json
{
  "name": "@wbr/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write failing test for forbidden copy**

```ts
// packages/shared/src/disclaimers.test.ts
import { describe, it, expect } from 'vitest'
import { assertSafeCopy, FORBIDDEN_SUCCESS_PHRASES } from './disclaimers'

describe('assertSafeCopy', () => {
  it('throws on 通关', () => {
    expect(() => assertSafeCopy('本关通关')).toThrow(/forbidden/i)
  })
  it('allows 手势练习', () => {
    expect(() => assertSafeCopy('这是手势练习')).not.toThrow()
  })
  it('lists known phrases', () => {
    expect(FORBIDDEN_SUCCESS_PHRASES).toEqual(
      expect.arrayContaining(['参拜成功', '作福完成', '通关', '功德'])
    )
  })
})
```

- [ ] **Step 3: Run test — expect fail**

```bash
cd packages/shared && npx vitest run src/disclaimers.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 4: Implement types + disclaimers**

```ts
// packages/shared/src/types.ts
export type GestureKind = 'drag' | 'tilt' | 'spin' | 'gyro' | 'wishWrite'
export type Grade = 'A' | 'B' | 'C'
export type Sensitivity = '低' | '中' | '高'

export type SceneMeta = {
  id: string
  title: string
  traditionSlug: string
  grade: Grade
  sensitivity: Sensitivity
  gestures: GestureKind[]
}
```

```ts
// packages/shared/src/disclaimers.ts
export const GLOBAL_DISCLAIMER =
  '本应用中的互动均为致敬小品与手势练习，不是宗教真仪、不是通关养成，也不产生任何功德或法效。'

export const FORBIDDEN_SUCCESS_PHRASES = [
  '参拜成功',
  '作福完成',
  '通关',
  '功德',
] as const

export function assertSafeCopy(text: string): void {
  for (const p of FORBIDDEN_SUCCESS_PHRASES) {
    if (text.includes(p)) {
      throw new Error(`forbidden copy: contains "${p}"`)
    }
  }
}
```

```ts
// packages/shared/src/index.ts
export * from './types'
export * from './disclaimers'
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm install
npm run test -w @wbr/shared
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add scene types and safe-copy disclaimers"
```

---

### Task 3: `@wbr/gestures` — core handle + `drag`

**Files:**
- Create: `packages/gestures/package.json`
- Create: `packages/gestures/tsconfig.json`
- Create: `packages/gestures/src/types.ts`
- Create: `packages/gestures/src/drag.ts`
- Create: `packages/gestures/src/drag.test.ts`
- Create: `packages/gestures/src/index.ts`

**Interfaces:**
- Consumes: none (DOM PointerEvent)
- Produces:
  - `export type GestureHandle = { mount(el, opts): void; update(dt: number): void; dispose(): void; setEnabled(on: boolean): void }`
  - `export function createDrag(opts: DragOpts): GestureHandle`
  - `DragOpts = { onProgress?(t: number): void; onDrop?(hit: boolean): void; hitTest(clientX: number, clientY: number): boolean }`

- [ ] **Step 1: Write failing drag test (jsdom pointer sequence)**

```ts
// packages/gestures/src/drag.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createDrag } from './drag'

function ptr(type: string, x: number, y: number) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })
}

describe('createDrag', () => {
  it('fires onDrop(true) when released over hit', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const onDrop = vi.fn()
    const g = createDrag({
      hitTest: (x, y) => x >= 100 && x <= 120 && y >= 100 && y <= 120,
      onDrop,
    })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 10, 10))
    el.dispatchEvent(ptr('pointermove', 110, 110))
    el.dispatchEvent(ptr('pointerup', 110, 110))
    expect(onDrop).toHaveBeenCalledWith(true)
    g.dispose()
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm run test -w @wbr/gestures -- src/drag.test.ts
```

Expected: FAIL (not found / not implemented).

- [ ] **Step 3: Implement createDrag**

```ts
// packages/gestures/src/types.ts
export type GestureHandle = {
  mount(el: HTMLElement, opts: Record<string, unknown>): void
  update(dt: number): void
  dispose(): void
  setEnabled(on: boolean): void
}
```

```ts
// packages/gestures/src/drag.ts
import type { GestureHandle } from './types'

export type DragOpts = {
  hitTest: (clientX: number, clientY: number) => boolean
  onProgress?: (t: number) => void
  onDrop?: (hit: boolean) => void
}

export function createDrag(opts: DragOpts): GestureHandle {
  let el: HTMLElement | null = null
  let enabled = true
  let dragging = false
  const onDown = (e: PointerEvent) => {
    if (!enabled) return
    dragging = true
    el?.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging || !enabled) return
    opts.onProgress?.(1)
  }
  const onUp = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    opts.onDrop?.(opts.hitTest(e.clientX, e.clientY))
  }
  return {
    mount(target) {
      el = target
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
    },
    update() {},
    dispose() {
      if (!el) return
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el = null
    },
    setEnabled(on) {
      enabled = on
      if (!on) dragging = false
    },
  }
}
```

```ts
// packages/gestures/src/index.ts
export type { GestureHandle } from './types'
export { createDrag } from './drag'
export type { DragOpts } from './drag'
```

`packages/gestures/package.json`:

```json
{
  "name": "@wbr/gestures",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "devDependencies": {
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

Add `vitest.config.ts` with `environment: 'jsdom'`.

- [ ] **Step 4: Run tests — expect pass**

```bash
npm install
npm run test -w @wbr/gestures
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/gestures
git commit -m "feat(gestures): add GestureHandle and createDrag"
```

---

### Task 4: `tilt` + `spin`

**Files:**
- Create: `packages/gestures/src/tilt.ts`
- Create: `packages/gestures/src/tilt.test.ts`
- Create: `packages/gestures/src/spin.ts`
- Create: `packages/gestures/src/spin.test.ts`
- Modify: `packages/gestures/src/index.ts`

**Interfaces:**
- Produces:
  - `createTilt({ pourAngleDeg?: number; holdMs?: number; onAngle?(deg: number): void; onPour?(): void }): GestureHandle` — pointer vertical drag maps to angle; when `|angle| >= pourAngleDeg` for `holdMs`, fire `onPour` once until reset
  - `createSpin({ onAngle?(rad: number): void; onRevolution?(n: number): void }): GestureHandle` — horizontal pointer delta accumulates angle; every `2π` fires `onRevolution`

- [ ] **Step 1: Failing tests**

```ts
// tilt.test.ts — pointerdown at y=200, move to y=80 with pourAngleDeg=30, holdMs=0 → onPour called
// spin.test.ts — horizontal moves totaling width that maps to >= 2π → onRevolution(1)
```

Implement tests with synthetic PointerEvents analogous to Task 3 (full code in repo when executing; mirror drag test style).

- [ ] **Step 2: Run — expect fail**
- [ ] **Step 3: Implement tilt.ts and spin.ts**
- [ ] **Step 4: Export from index.ts; tests pass**
- [ ] **Step 5: Commit** `feat(gestures): add createTilt and createSpin`

---

### Task 5: `gyro` + `wishWrite`

**Files:**
- Create: `packages/gestures/src/gyro.ts`
- Create: `packages/gestures/src/gyro.test.ts`
- Create: `packages/gestures/src/wishWrite.ts`
- Create: `packages/gestures/src/wishWrite.test.ts`
- Modify: `packages/gestures/src/index.ts`

**Interfaces:**
- `createGyro({ bowBetaDeg?: number; holdMs?: number; onBow?(): void; onHold?(): void; fallbackTapSelector?: string }): GestureHandle`
  - listens `deviceorientation` when available
  - on mount, if `DeviceOrientationEvent.requestPermission` exists, call it; on deny, enable tap fallback on `el` (or overlay button) that calls `onBow`
- `createWishWrite({ maxLen?: number; onSubmit?(text: string): void }): GestureHandle`
  - `mount` creates a `<form>` with `<input>` + submit inside `el`
  - validates trim length 1..maxLen (default 40); empty submit ignored

- [ ] **Step 1: Failing tests**
  - gyro: inject fake DeviceOrientationEvent `{ beta: 45 }` with bowBetaDeg=30 → `onBow`
  - gyro fallback: no orientation API → tap fires `onBow`
  - wishWrite: submit `"平安"` → `onSubmit('平安')`; submit `"   "` → no call
- [ ] **Step 2–4: Implement, pass, export**
- [ ] **Step 5: Commit** `feat(gestures): add createGyro and createWishWrite`

---

### Task 6: App shell scaffold + gesture playground

**Files:**
- Create: `apps/cyber-bless/package.json`
- Create: `apps/cyber-bless/vite.config.ts`
- Create: `apps/cyber-bless/index.html`
- Create: `apps/cyber-bless/tsconfig.json`
- Create: `apps/cyber-bless/src/main.tsx`
- Create: `apps/cyber-bless/src/App.tsx`
- Create: `apps/cyber-bless/src/pages/Home.tsx`
- Create: `apps/cyber-bless/src/pages/Gallery.tsx`
- Create: `apps/cyber-bless/src/pages/About.tsx`
- Create: `apps/cyber-bless/src/pages/Playground.tsx`
- Create: `apps/cyber-bless/src/styles.css`

**Interfaces:**
- Routes: `/`, `/gallery`, `/about`, `/playground/:gesture` (`drag|tilt|spin|gyro|wishWrite`)
- Depends on `@wbr/gestures`, `@wbr/shared`

- [ ] **Step 1: Scaffold Vite React TS app in apps/cyber-bless**

```json
{
  "name": "@wbr/cyber-bless",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host"
  },
  "dependencies": {
    "@wbr/gestures": "*",
    "@wbr/shared": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "^0.170.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Wire App routes**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home'
import { Gallery } from './pages/Gallery'
import { About } from './pages/About'
import { Playground } from './pages/Playground'

export function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: 'flex', gap: 12, padding: 8 }}>
        <Link to="/">首页</Link>
        <Link to="/gallery">祈福廊</Link>
        <Link to="/about">关于</Link>
        <Link to="/playground/drag">手势试验</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/about" element={<About />} />
        <Route path="/playground/:gesture" element={<Playground />} />
      </Routes>
    </BrowserRouter>
  )
}
```

Home shows `GLOBAL_DISCLAIMER` + button to `/gallery`. About repeats disclaimer + forbidden list explanation. Gallery can temporarily list links to playground + placeholder scene ids.

- [ ] **Step 3: Playground mounts the matching create* on a full-viewport div**

Switch on `useParams().gesture`; call `assertSafeCopy` on any status string shown.

- [ ] **Step 4: Smoke run**

```bash
npm install
npm run dev -w @wbr/cyber-bless
```

Expected: Vite prints local + network URL; `/playground/drag` accepts pointer drag without console errors.

- [ ] **Step 5: Commit** `feat(cyber-bless): scaffold shell routes and gesture playground`

---

### Task 7: Scene contract + registry

**Files:**
- Create: `packages/scenes/package.json`
- Create: `packages/scenes/src/contract.ts`
- Create: `packages/scenes/src/registry.ts`
- Create: `packages/scenes/src/index.ts`
- Create: `packages/scenes/src/registry.test.ts`

**Interfaces:**
- Produces:
  - `SceneContext`, `SceneInstance`, `SceneModule` as in the design spec
  - `export const sceneRegistry: SceneMeta[]`
  - `export async function loadScene(id: string): Promise<SceneModule>`

```ts
// contract.ts
import type { SceneMeta } from '@wbr/shared'
import type * as Gestures from '@wbr/gestures'
import type * as Shared from '@wbr/shared'

export type SceneContext = {
  canvas: HTMLCanvasElement
  overlay: HTMLElement
  gestures: typeof Gestures
  shared: typeof Shared
}

export type SceneInstance = {
  start(): void
  update(dt: number): void
  dispose(): void
}

export type SceneModule = {
  meta: SceneMeta
  create(ctx: SceneContext): SceneInstance
}
```

Registry initially lists five metas; `loadScene` dynamic-imports only the two implemented scenes in later tasks; others throw `Error('scene not implemented: '+id)` until Tasks 8–9 / follow-ups.

- [ ] **Step 1: Failing test — registry contains celtic-folk-spring and theravada-water**
- [ ] **Step 2–4: Implement, pass**
- [ ] **Step 5: Commit** `feat(scenes): add SceneModule contract and registry`

---

### Task 8: Scene `celtic-folk-spring`（泉边一念）

**Files:**
- Create: `packages/scenes/src/celtic-folk-spring/index.ts`
- Create: `packages/scenes/src/celtic-folk-spring/scene.ts`
- Modify: `packages/scenes/src/registry.ts` to import it
- Create: `apps/cyber-bless/src/pages/ScenePage.tsx`
- Modify: `apps/cyber-bless/src/App.tsx` add `/scene/:sceneId`

**Interfaces:**
- meta: `{ id: 'celtic-folk-spring', title: '泉边一念', traditionSlug: 'celtic-folk', grade: 'C', sensitivity: '低', gestures: ['gyro','drag','wishWrite'] }`
- Steps: gyro bow/hold → drag token to water hit zone → wishWrite → emit complete via `overlay.dispatchEvent(new CustomEvent('scene:complete'))`
- dispose stops RAF and gesture handles

- [ ] **Step 1: Implement minimal Three.js scene** (plane water + token mesh + light); no GLTF required
- [ ] **Step 2: Wire gestures in order; show step dots in overlay**
- [ ] **Step 3: ScenePage creates canvas+overlay, loadScene, rAF loop, cleanup on unmount**
- [ ] **Step 4: Manual check** `npm run dev` → `/scene/celtic-folk-spring` completes with gyro fallback tap if needed
- [ ] **Step 5: Commit** `feat(scenes): add celtic-folk-spring pilot (泉边一念)`

---

### Task 9: Scene `theravada-water`（花水位一倾）

**Files:**
- Create: `packages/scenes/src/theravada-water/index.ts`
- Create: `packages/scenes/src/theravada-water/scene.ts`
- Modify: registry + gallery cards

**Interfaces:**
- meta: `{ id: 'theravada-water', title: '花水位一倾', traditionSlug: 'theravada-buddhism', grade: 'C', sensitivity: '低', gestures: ['tilt','drag'] }`
- Steps: tilt pour → drag petal onto water → short tap overlay control for 合十 → `scene:complete`
- Copy uses 手势练习 only; run `assertSafeCopy` on every user-visible string

- [ ] **Step 1–4:** Implement, wire gallery entries for both pilots, manual pass on phone or DevTools mobile
- [ ] **Step 5: Commit** `feat(scenes): add theravada-water pilot (花水位一倾)`

---

### Task 10: Gallery polish, complete screen, README, acceptance

**Files:**
- Modify: `apps/cyber-bless/src/pages/Gallery.tsx` — cards from `sceneRegistry` (disable unimplemented with「稍后」)
- Create: `apps/cyber-bless/src/pages/SceneComplete.tsx` or inline complete state — buttons 回廊 / 再试一次 only
- Modify: root `README.md` — how to run on phone (same LAN, `--host`)
- Modify: `specs/2026-09-20-cyber-bless-app-design.md` status line → 实现进行中 / 试点两景已通 if desired

**Acceptance checklist (all must pass):**
1. `npm test` passes for shared + gestures
2. `/playground/drag|tilt|spin|gyro|wishWrite` each interactive
3. `/scene/celtic-folk-spring` and `/scene/theravada-water` completable with fallbacks
4. No forbidden phrases in UI strings (`rg` over `apps/` + `packages/scenes` for 通关|参拜成功|作福完成|功德\+)
5. `python3 scripts/build_map_data.py` still works against `content/traditions`

- [ ] **Step 1: Implement gallery + complete UX**
- [ ] **Step 2: Run acceptance checklist commands**
- [ ] **Step 3: Commit** `feat(cyber-bless): gallery cards, complete UX, docs for phone dev`
- [ ] **Step 4: Push** `git push origin HEAD`

---

## Out of scope (later plans)

- `shinto-torii`, `tibetan-wheel`, `slavic-wreath` full scenes
- Capacitor / store release
- PWA service worker hardening
- Reading `content/*.md` inside the App

## Spec coverage self-check

| Spec item | Task |
|-----------|------|
| content/ migration | Task 1 |
| apps/cyber-bless shell + routes | Task 6, 8 |
| packages/gestures five modules | Tasks 3–5 |
| packages/scenes contract + pilots | Tasks 7–9 |
| packages/shared disclaimers | Task 2 |
| scripts path update | Task 1 |
| playground for gestures | Task 6 |
| two scenes wired | Tasks 8–9 |
| no success-points UX | Task 10 |

## Placeholder scan

No TBD / TODO / "similar to Task N" left unresolved for required behavior; Tasks 4–5 intentionally compress repeated PointerEvent test boilerplate but require full tests at execution time in the named files.

---

## Execution handoff

Plan saved to `specs/2026-09-20-cyber-bless-app-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute in this session with checkpoints

Which approach?
