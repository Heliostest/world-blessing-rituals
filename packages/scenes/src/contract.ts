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
