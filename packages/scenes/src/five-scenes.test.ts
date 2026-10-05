// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  createDebugRenderStyle: (
    _renderer: unknown,
    scene: { updateMatrixWorld(): void },
    camera: { updateMatrixWorld(): void },
  ) => ({
    setStyle: vi.fn(),
    resize: vi.fn(),
    // Like a real render, bring world matrices up to date so pointer rays hit
    // what would be on screen.
    render: vi.fn(() => {
      scene.updateMatrixWorld()
      camera.updateMatrixWorld()
    }),
    dispose: vi.fn(),
  }),
}))

import { loadScene } from './registry'

type Script = { id: string; taps: number[]; gap?: number }

/**
 * Per scene: how many action-button taps to make before each checkpoint.
 * Frames advance between taps (`gap` seconds, default 0.1) so timed
 * transitions (walk, bow, weave, coast) finish; the crane folds one fold at a
 * time, so it waits out each fold.
 */
const SCRIPTS: Script[] = [
  { id: 'crane', taps: [4, 1, 1], gap: 3 },
  { id: 'lantern', taps: [1, 1, 1] },
  { id: 'shinto-torii', taps: [1, 1, 1] },
  { id: 'tibetan-wheel', taps: [1, 0, 1] },
  { id: 'slavic-wreath', taps: [1, 1, 1] },
  { id: 'furin-wind-chime', taps: [1, 0, 1] },
  { id: 'tanzaku-tanabata', taps: [1, 1, 1] },
  { id: 'yeondeunghoe', taps: [1, 0, 1] },
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
  // A tap that ends on the button, or Enter/Space, reaches the scene as click.
  const tap = () => button.click()
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) instance.update(0.05)
  }
  /** Advance frames until `n` checkpoints were reported (or ~15 s pass). */
  const runUntil = (n: number) => {
    for (let t = 0; t < 15 && progress.length < n; t += 0.05) instance.update(0.05)
  }
  return { mod, canvas, overlay, instance, progress, complete, haptic, button, tap, run, runUntil }
}

type Point = readonly [number, number]

/** jsdom has no layout: the stage is 300×300 (the stub renderer's aspect is 1). */
const STAGE = 300

/** Lays the stage out and draws a frame; returns the hit layer. */
function layOut(s: Awaited<ReturnType<typeof mount>>) {
  s.canvas.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: STAGE, bottom: STAGE, width: STAGE, height: STAGE }) as DOMRect
  const hit = s.overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  Object.defineProperty(hit, 'clientWidth', { configurable: true, value: STAGE })
  hit.setPointerCapture = () => {}
  s.run(0.05)
  return hit
}

/** One finger from `from` to `to`, in client px. */
function swipe(el: HTMLElement, [x0, y0]: Point, [x1, y1]: Point) {
  for (const [type, x, y] of [
    ['pointerdown', x0, y0],
    ['pointermove', (x0 + x1) / 2, (y0 + y1) / 2],
    ['pointermove', x1, y1],
    ['pointerup', x1, y1],
  ] as const) {
    const e = new Event(type)
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1, buttons: type === 'pointerup' ? 0 : 1 })
    el.dispatchEvent(e)
  }
}

/** Whether a touch that starts at this point is kept from scrolling the page. */
function claimsTouch(el: HTMLElement, [x, y]: Point) {
  const e = new Event('touchstart', { cancelable: true })
  Object.assign(e, { changedTouches: [{ clientX: x, clientY: y }] })
  el.dispatchEvent(e)
  return e.defaultPrevented
}

afterEach(() => {
  document.body.replaceChildren()
})

describe.each(SCRIPTS)('$id scene', ({ id, taps, gap = 0.1 }) => {
  it('walks through three checkpoints to scene:complete', async () => {
    const s = await mount(id)
    expect(s.overlay.querySelector('.scene-title')?.textContent).toBe(s.mod.meta.title)
    for (let checkpoint = 1; checkpoint <= 3; checkpoint++) {
      for (let i = 0; i < taps[checkpoint - 1]; i++) {
        s.tap()
        s.run(gap)
      }
      s.runUntil(checkpoint)
      expect(s.progress).toEqual([1, 2, 3].slice(0, checkpoint))
    }
    expect(s.complete).toHaveBeenCalledTimes(1)
    expect(s.haptic).toHaveBeenCalled()
    s.instance.dispose()
    expect(s.overlay.childElementCount).toBe(0)
  })

  it('ignores a press that slides off the button (pointerup without click)', async () => {
    const s = await mount(id)
    const hint = () => s.overlay.querySelector('.scene-hint')?.textContent
    const before = hint()
    for (const type of ['pointerdown', 'pointerup']) {
      s.button.dispatchEvent(new Event(type, { bubbles: true }))
      s.run(0.1)
    }
    s.run(3)
    expect(s.progress).toEqual([])
    expect(hint()).toBe(before)
    s.instance.dispose()
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

describe('crane folds', () => {
  const hint = (s: Awaited<ReturnType<typeof mount>>) =>
    s.overlay.querySelector('.scene-hint')?.textContent ?? ''
  /** Index of the active step dot (3 when all are done). */
  const activeDot = (s: Awaited<ReturnType<typeof mount>>) => {
    const dots = Array.from(s.overlay.querySelectorAll<HTMLElement>('.scene-step-dot'))
    const i = dots.findIndex((d) => d.dataset.state === 'active')
    return i < 0 ? dots.length : i
  }

  it('folds once for a quick double tap: taps wait for the fold under way', async () => {
    const s = await mount('crane')
    const atRest = hint(s)
    s.tap()
    s.run(0.09)
    s.tap()
    expect(s.haptic).toHaveBeenCalledTimes(1)
    expect(s.button.getAttribute('aria-disabled')).toBe('true')
    expect(hint(s)).toContain('…')
    s.run(2)
    expect(s.button.getAttribute('aria-disabled')).toBe('false')
    expect(hint(s)).not.toBe(atRest)
    expect(hint(s)).toContain('再点按')
    // The settled paper takes the next tap.
    s.tap()
    expect(s.haptic).toHaveBeenCalledTimes(2)
    s.instance.dispose()
  })

  it('waits for the last fold to settle before the lift hint, dot and checkpoint', async () => {
    const s = await mount('crane')
    for (let i = 0; i < 3; i++) {
      s.tap()
      s.run(3)
    }
    s.tap()
    s.run(1) // the last fold takes 2.3 s
    expect(s.progress).toEqual([])
    expect(activeDot(s)).toBe(0)
    expect(hint(s)).not.toContain('向上拖起')
    s.run(1.5)
    expect(s.progress).toEqual([1])
    expect(activeDot(s)).toBe(1)
    expect(hint(s)).toContain('向上拖起')
    s.instance.dispose()
  })

  it('keeps hint, step dots and reported steps on one count of three', async () => {
    const s = await mount('crane')
    const check = () => {
      expect(s.overlay.querySelectorAll('.scene-step-dot')).toHaveLength(3)
      expect(activeDot(s)).toBe(s.progress.length)
      // No hint carries a step fraction of its own (like 1/4 next to 0/3),
      // nor a count of folds in words (like 四次折叠).
      expect(hint(s)).not.toMatch(/\d\s*\/\s*\d/)
      expect(hint(s)).not.toMatch(/[\d一二两三四五六七八九十]\s*[次折步]/)
    }
    check()
    for (let i = 0; i < 4; i++) {
      s.tap()
      s.run(0.5)
      check()
      s.run(2.5)
      check()
    }
    expect(s.progress).toEqual([1])
    s.tap()
    s.run(0.1)
    check()
    s.tap()
    s.run(0.1)
    check()
    expect(s.progress).toEqual([1, 2, 3])
    s.instance.dispose()
  })
})

describe('tibetan-wheel drag direction', () => {
  const hint = (s: Awaited<ReturnType<typeof mount>>) =>
    s.overlay.querySelector('.scene-hint')?.textContent ?? ''

  it('refuses a left-to-right drag and turns on a right-to-left one', async () => {
    const s = await mount('tibetan-wheel')
    const hit = layOut(s)
    const ready = hint(s)
    expect(ready).toContain('只沿顺时针')
    // Both drags start on the drum, in the middle of the stage.
    swipe(hit, [130, 150], [170, 150])
    s.run(0.2)
    expect(s.progress).toEqual([])
    const refused = hint(s)
    expect(refused).not.toBe(ready)
    expect(refused).toContain('只沿顺时针')
    swipe(hit, [170, 150], [130, 150])
    s.run(0.2)
    expect(s.progress).toEqual([1])
    expect(hint(s)).not.toBe(refused)
    s.instance.dispose()
  })

  it('lets the refused-direction hint go after a moment, or at a push the right way', async () => {
    const s = await mount('tibetan-wheel')
    const hit = layOut(s)
    const ready = hint(s)
    swipe(hit, [130, 150], [170, 150])
    s.run(0.2)
    const refused = hint(s)
    expect(refused).not.toBe(ready)
    s.run(1)
    expect(hint(s)).toBe(refused)
    s.run(2)
    expect(hint(s)).toBe(ready)
    // While it turns: refused again, then a short push the right way answers it.
    s.tap()
    s.run(0.1)
    const turning = hint(s)
    swipe(hit, [130, 150], [170, 150])
    expect(hint(s)).toBe(refused)
    swipe(hit, [170, 150], [150, 150])
    expect(hint(s)).toBe(turning)
    expect(s.progress).toEqual([1])
    s.instance.dispose()
  })
})

describe('tibetan-wheel turning', () => {
  it('lets the button settle the turning drum; a double tap does not stop it at once', async () => {
    const s = await mount('tibetan-wheel')
    const label = () => s.button.textContent
    const pushLabel = label()
    s.tap()
    s.tap() // the second tap of a quick double tap
    s.run(0.1)
    expect(s.progress).toEqual([1])
    expect(label()).not.toBe(pushLabel)
    expect(s.button.getAttribute('aria-disabled')).toBe('true')
    s.run(1)
    expect(s.button.getAttribute('aria-disabled')).toBe('false')
    // Still turning: the extra tap neither pushed nor stopped it.
    expect(s.progress).toEqual([1])
    s.tap()
    expect(s.button.getAttribute('aria-disabled')).toBe('true')
    // It comes to rest well before the ~5 s it coasts on its own.
    s.run(1.5)
    expect(s.progress).toEqual([1, 2])
    expect(s.button.getAttribute('aria-disabled')).toBe('false')
    s.tap()
    expect(s.progress).toEqual([1, 2, 3])
    s.instance.dispose()
  })

  it('no longer keeps the drum turning when the button is tapped every 1.5 s', async () => {
    const s = await mount('tibetan-wheel')
    s.tap()
    // Each tap used to push it on; 18 s of this stayed at the first step.
    for (let i = 0; i < 2; i++) {
      s.run(1.5)
      if (s.progress.length === 1) s.tap()
    }
    expect(s.progress).toEqual([1, 2])
    s.instance.dispose()
  })
})

/**
 * Swipes, per scene: the step (as restored progress) where a swipe moves the
 * scene on, the same motion started on an empty part of the 300×300 stage,
 * one started on the object, and the progress the latter reports.
 */
const SWIPES: { id: string; at: number; stray: [Point, Point]; onObject: [Point, Point]; reports: number }[] = [
  { id: 'crane', at: 1, stray: [[20, 285], [20, 195]], onObject: [[150, 150], [150, 60]], reports: 2 },
  { id: 'shinto-torii', at: 0, stray: [[20, 285], [20, 195]], onObject: [[150, 150], [150, 60]], reports: 1 },
  { id: 'furin-wind-chime', at: 0, stray: [[20, 285], [20, 195]], onObject: [[150, 150], [150, 60]], reports: 1 },
  { id: 'tibetan-wheel', at: 0, stray: [[60, 285], [20, 285]], onObject: [[170, 150], [130, 150]], reports: 1 },
  { id: 'yeondeunghoe', at: 0, stray: [[20, 285], [20, 195]], onObject: [[150, 190], [150, 100]], reports: 1 },
  // Hanging: a stray swipe that ends on the bamboo must not carry the strip there.
  { id: 'tanzaku-tanabata', at: 1, stray: [[20, 285], [150, 60]], onObject: [[250, 190], [150, 60]], reports: 2 },
]

describe.each(SWIPES)('$id swipe', ({ id, at, stray, onObject, reports }) => {
  it('leaves a swipe that starts off the object to the page', async () => {
    const s = await mount(id, at)
    const hit = layOut(s)
    const hint = s.overlay.querySelector('.scene-hint')?.textContent
    expect(claimsTouch(hit, stray[0])).toBe(false)
    swipe(hit, ...stray)
    s.run(3)
    expect(s.progress).toEqual([])
    expect(s.overlay.querySelector('.scene-hint')?.textContent).toBe(hint)
    s.instance.dispose()
  })

  it('moves on for the same swipe started on the object', async () => {
    const s = await mount(id, at)
    const hit = layOut(s)
    expect(claimsTouch(hit, onObject[0])).toBe(true)
    swipe(hit, ...onObject)
    s.runUntil(1)
    expect(s.progress).toEqual([reports])
    s.instance.dispose()
  })
})

/** Minimal DeviceOrientationEvent stand-in for jsdom. */
class FakeDeviceOrientationEvent extends Event {
  readonly beta: number | null
  constructor(type: string, init: { beta?: number | null } = {}) {
    super(type)
    this.beta = init.beta ?? null
  }
}

describe('device motion', () => {
  const g = globalThis as { DeviceOrientationEvent?: unknown }
  let saved: unknown
  beforeEach(() => {
    saved = g.DeviceOrientationEvent
  })
  afterEach(() => {
    if (saved === undefined) delete g.DeviceOrientationEvent
    else g.DeviceOrientationEvent = saved
  })
  const lean = (beta: number) =>
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta }))
  const stageTap = (s: Awaited<ReturnType<typeof mount>>) =>
    s.overlay
      .querySelector('.scene-hit-layer')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))

  it.each([45, 60, 75, 90])(
    'celtic-folk-spring leaves its first step alone at a reading grip (beta ≈ %i°)',
    async (beta) => {
      g.DeviceOrientationEvent = FakeDeviceOrientationEvent
      const s = await mount('celtic-folk-spring')
      for (let i = 0; i < 30; i++) {
        lean(beta + ((i % 3) - 1) * 6)
        s.run(0.2)
      }
      expect(s.progress).toEqual([])
      s.instance.dispose()
    },
  )

  it('celtic-folk-spring moves on for a lean forward and back up, held', async () => {
    g.DeviceOrientationEvent = FakeDeviceOrientationEvent
    const s = await mount('celtic-folk-spring')
    const hint = () => s.overlay.querySelector('.scene-hint')?.textContent
    const ready = hint()
    lean(70)
    s.run(0.2)
    lean(35)
    s.run(0.2)
    lean(72)
    expect(hint()).not.toBe(ready) // 停驻片刻…
    s.run(0.5)
    expect(s.progress).toEqual([])
    s.run(0.5)
    expect(s.progress).toEqual([1])
    s.instance.dispose()
  })

  it.each([
    ['shinto-torii', 1],
    ['tibetan-wheel', 2],
  ] as const)('%s never asks for motion access before its motion step', async (id, motionStep) => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState)
    g.DeviceOrientationEvent = class extends FakeDeviceOrientationEvent {
      static requestPermission = requestPermission
    }
    const s = await mount(id)
    for (let step = 0; step < motionStep; step++) {
      stageTap(s)
      s.tap()
      s.runUntil(step + 1)
    }
    expect(s.progress).toHaveLength(motionStep)
    expect(requestPermission).not.toHaveBeenCalled()
    // At the motion step its own button still does the step, without asking.
    s.tap()
    s.run(3)
    expect(s.progress).toHaveLength(motionStep + 1)
    expect(requestPermission).not.toHaveBeenCalled()
    s.instance.dispose()
  })

  it('shinto-torii asks for motion access from a tap on the stage at the bow step', async () => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState)
    g.DeviceOrientationEvent = class extends FakeDeviceOrientationEvent {
      static requestPermission = requestPermission
    }
    const s = await mount('shinto-torii', 1)
    stageTap(s)
    expect(requestPermission).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    // Granted: raising the phone and holding it starts the bow.
    lean(20)
    lean(75)
    s.run(1)
    s.runUntil(2)
    expect(s.progress).toEqual([2])
    s.instance.dispose()
  })
})
