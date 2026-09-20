import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTilt } from './tilt'

function ptr(type: string, x: number, y: number) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })
}

describe('createTilt', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('fires onPour when vertical drag reaches pourAngleDeg with holdMs=0', () => {
    const onPour = vi.fn()
    const onAngle = vi.fn()
    const g = createTilt({ pourAngleDeg: 30, holdMs: 0, onPour, onAngle })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 200))
    el.dispatchEvent(ptr('pointermove', 0, 80))
    expect(onAngle).toHaveBeenCalled()
    const lastAngle = onAngle.mock.calls.at(-1)![0] as number
    expect(Math.abs(lastAngle)).toBeGreaterThanOrEqual(30)
    expect(onPour).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('maps upward drag to positive angle (startY - clientY)', () => {
    const onAngle = vi.fn()
    const g = createTilt({ pourAngleDeg: 90, holdMs: 0, onAngle })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 200))
    el.dispatchEvent(ptr('pointermove', 0, 150))
    expect(onAngle).toHaveBeenCalledWith(50)
    g.dispose()
  })

  it('does not fire onPour below pourAngleDeg', () => {
    const onPour = vi.fn()
    const g = createTilt({ pourAngleDeg: 30, holdMs: 0, onPour })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 200))
    el.dispatchEvent(ptr('pointermove', 0, 190)) // |angle|=10
    expect(onPour).not.toHaveBeenCalled()
    g.dispose()
  })

  it('fires onPour only once until angle resets below threshold', () => {
    const onPour = vi.fn()
    const g = createTilt({ pourAngleDeg: 30, holdMs: 0, onPour })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 200))
    el.dispatchEvent(ptr('pointermove', 0, 80))
    el.dispatchEvent(ptr('pointermove', 0, 70))
    expect(onPour).toHaveBeenCalledTimes(1)
    // drop below threshold → reset
    el.dispatchEvent(ptr('pointermove', 0, 190))
    el.dispatchEvent(ptr('pointermove', 0, 80))
    expect(onPour).toHaveBeenCalledTimes(2)
    g.dispose()
  })

  it('requires holdMs via update(dt) before onPour', () => {
    const onPour = vi.fn()
    const g = createTilt({ pourAngleDeg: 30, holdMs: 200, onPour })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown', 0, 200))
    el.dispatchEvent(ptr('pointermove', 0, 80))
    expect(onPour).not.toHaveBeenCalled()
    g.update(0.1) // 100ms if dt in seconds
    expect(onPour).not.toHaveBeenCalled()
    g.update(0.1) // total 200ms
    expect(onPour).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('ignores pointers when disabled', () => {
    const onPour = vi.fn()
    const onAngle = vi.fn()
    const g = createTilt({ pourAngleDeg: 30, holdMs: 0, onPour, onAngle })
    g.mount(el, {})
    g.setEnabled(false)
    el.dispatchEvent(ptr('pointerdown', 0, 200))
    el.dispatchEvent(ptr('pointermove', 0, 80))
    expect(onAngle).not.toHaveBeenCalled()
    expect(onPour).not.toHaveBeenCalled()
    g.dispose()
  })
})
