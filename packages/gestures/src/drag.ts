import type { GestureHandle } from './types'

export type DragOpts = {
  /** Only a pointer that goes down where this is true starts a drag (default: anywhere). */
  startsOn?: (clientX: number, clientY: number) => boolean
  hitTest: (clientX: number, clientY: number) => boolean
  onProgress?: (t: number) => void
  onDrop?: (hit: boolean) => void
}

export function createDrag(opts: DragOpts): GestureHandle {
  let el: HTMLElement | null = null
  let enabled = true
  let dragging = false
  const onDown = (e: PointerEvent) => {
    if (!enabled || (opts.startsOn && !opts.startsOn(e.clientX, e.clientY))) return
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
