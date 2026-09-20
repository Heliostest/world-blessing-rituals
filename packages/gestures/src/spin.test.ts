import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSpin } from './spin'

function ptr(type: string, x: number, y: number) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })
}

describe('createSpin', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 360 })
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('fires onRevolution(1) when horizontal travel equals element width (2π)', () => {
    const onRevolution = vi.fn()
    const onAngle = vi.fn()
    const g = createSpin({ onRevolution, onAngle })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 0))
    el.dispatchEvent(ptr('pointermove', 360, 0))
    expect(onAngle).toHaveBeenCalled()
    const last = onAngle.mock.calls.at(-1)![0] as number
    expect(Math.abs(last)).toBeGreaterThanOrEqual(Math.PI * 2 - 1e-9)
    expect(onRevolution).toHaveBeenCalledWith(1)
    g.dispose()
  })

  it('accumulates angle across multiple moves', () => {
    const onRevolution = vi.fn()
    const onAngle = vi.fn()
    const g = createSpin({ onRevolution, onAngle })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 0))
    el.dispatchEvent(ptr('pointermove', 180, 0)) // π
    expect(onRevolution).not.toHaveBeenCalled()
    el.dispatchEvent(ptr('pointermove', 360, 0)) // +π → 2π
    expect(onRevolution).toHaveBeenCalledWith(1)
    g.dispose()
  })

  it('fires onRevolution for each full turn', () => {
    const onRevolution = vi.fn()
    const g = createSpin({ onRevolution })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 0))
    el.dispatchEvent(ptr('pointermove', 720, 0)) // 2 widths → 2 revs
    expect(onRevolution).toHaveBeenCalledWith(1)
    expect(onRevolution).toHaveBeenCalledWith(2)
    expect(onRevolution).toHaveBeenCalledTimes(2)
    g.dispose()
  })

  it('ignores pointers when disabled', () => {
    const onRevolution = vi.fn()
    const onAngle = vi.fn()
    const g = createSpin({ onRevolution, onAngle })
    g.mount(el, {})
    g.setEnabled(false)
    el.dispatchEvent(ptr('pointerdown', 0, 0))
    el.dispatchEvent(ptr('pointermove', 360, 0))
    expect(onAngle).not.toHaveBeenCalled()
    expect(onRevolution).not.toHaveBeenCalled()
    g.dispose()
  })
})
