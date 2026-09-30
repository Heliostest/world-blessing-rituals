// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'

// jsdom has no WebGL: stub the renderer and the toon/ink pass.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: () => ({
    setStyle: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  }),
}))

import { loadScene } from './registry'

type Script = { id: string; taps: number[] }

/**
 * Per scene: how many action-button taps to make before each checkpoint.
 * Frames advance between taps so timed transitions (walk, bow, weave, coast) finish.
 */
const SCRIPTS: Script[] = [
  { id: 'crane', taps: [4, 1, 1] },
  { id: 'lantern', taps: [1, 1, 1] },
  { id: 'shinto-torii', taps: [1, 1, 1] },
  { id: 'tibetan-wheel', taps: [1, 0, 1] },
  { id: 'slavic-wreath', taps: [1, 1, 1] },
]

async function mount(id: string, initialProgress = 0) {
  const mod = await loadScene(id)
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  const progress: number[] = []
  const haptic = vi.fn()
  const instance = mod.create({
    canvas,
    overlay,
    gestures: Gestures,
    shared: Shared,
    sceneId: id,
    initialProgress,
    onProgress: (n) => progress.push(n),
    haptic,
    isSoundEnabled: () => false,
  })
  const complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  instance.start()
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const tap = () => button.dispatchEvent(new Event('pointerup'))
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) instance.update(0.05)
  }
  /** Advance frames until `n` checkpoints were reported (or ~15 s pass). */
  const runUntil = (n: number) => {
    for (let t = 0; t < 15 && progress.length < n; t += 0.05) instance.update(0.05)
  }
  return { mod, overlay, instance, progress, complete, haptic, tap, run, runUntil }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe.each(SCRIPTS)('$id scene', ({ id, taps }) => {
  it('walks through three checkpoints to scene:complete', async () => {
    const s = await mount(id)
    expect(s.overlay.querySelector('.scene-title')?.textContent).toBe(s.mod.meta.title)
    for (let checkpoint = 1; checkpoint <= 3; checkpoint++) {
      for (let i = 0; i < taps[checkpoint - 1]; i++) {
        s.tap()
        s.run(0.1)
      }
      s.runUntil(checkpoint)
      expect(s.progress).toEqual([1, 2, 3].slice(0, checkpoint))
    }
    expect(s.complete).toHaveBeenCalledTimes(1)
    expect(s.haptic).toHaveBeenCalled()
    s.instance.dispose()
    expect(s.overlay.childElementCount).toBe(0)
  })

  it('restores a finished session silently', async () => {
    const s = await mount(id, 3)
    s.run(0.5)
    expect(s.progress).toEqual([])
    expect(s.complete).toHaveBeenCalledTimes(1)
    s.instance.dispose()
  })

  it('keeps all overlay copy within the safe-copy rules', async () => {
    const s = await mount(id)
    expect(() => Shared.assertSafeCopy(s.overlay.textContent ?? '')).not.toThrow()
    s.instance.dispose()
  })
})

describe('tibetan-wheel drag direction', () => {
  const drag = (el: HTMLElement, fromX: number, toX: number) => {
    for (const [type, x] of [
      ['pointerdown', fromX],
      ['pointermove', (fromX + toX) / 2],
      ['pointermove', toX],
      ['pointerup', toX],
    ] as const) {
      const e = new Event(type)
      Object.assign(e, { clientX: x, clientY: 100, pointerId: 1, buttons: 1 })
      el.dispatchEvent(e)
    }
  }

  it('refuses a left-to-right drag and turns on a right-to-left one', async () => {
    const s = await mount('tibetan-wheel')
    const hit = s.overlay.querySelector<HTMLElement>('.scene-hit-layer')!
    hit.setPointerCapture = () => {}
    drag(hit, 0, 3)
    s.run(0.2)
    expect(s.progress).toEqual([])
    expect(s.overlay.querySelector('.scene-hint')?.textContent).toContain('只沿顺时针')
    drag(hit, 3, 0)
    s.run(0.2)
    expect(s.progress).toEqual([1])
    s.instance.dispose()
  })
})
