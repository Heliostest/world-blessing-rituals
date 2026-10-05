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

  it('only starts on the object when startsOn is given', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const onDrop = vi.fn()
    const g = createDrag({
      startsOn: (x) => x < 50,
      hitTest: () => true,
      onDrop,
    })
    g.mount(el, {})
    // A stray swipe that begins off the object is not a drag at all.
    el.dispatchEvent(ptr('pointerdown', 80, 10))
    el.dispatchEvent(ptr('pointermove', 80, 200))
    el.dispatchEvent(ptr('pointerup', 80, 200))
    expect(onDrop).not.toHaveBeenCalled()
    el.dispatchEvent(ptr('pointerdown', 10, 10))
    el.dispatchEvent(ptr('pointerup', 80, 200))
    expect(onDrop).toHaveBeenCalledWith(true)
    g.dispose()
  })
})
