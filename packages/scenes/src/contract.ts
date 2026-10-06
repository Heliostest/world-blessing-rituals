import type { SceneMeta } from '@wbr/shared'
import type * as Gestures from '@wbr/gestures'
import type * as Shared from '@wbr/shared'

export type SceneContext = {
  initialProgress?: number
  onProgress?(progress: number): void
  isActive?(): boolean
  isReducedMotion?(): boolean
  /** Live App feedback settings; call `prepareFeedback` from a user gesture. */
  prepareFeedback?(): void
  /** Vibrates only when the App haptics toggle is on. */
  haptic?(): void
  isSoundEnabled?(): boolean
  /**
   * Keeps a line written in the scene's wish box as a new 心愿 (never an
   * existing one). Scenes call it with the trimmed line as they move on;
   * hosts without wishes leave it out, and the box then says nothing is kept.
   */
  saveWish?(text: string): void
  sceneId?: string
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
