import type { GestureHandle } from './types'

export type SpinOpts = {
  onAngle?(rad: number): void
  onRevolution?(n: number): void
}

/** One full element width of horizontal drag ≈ one revolution (2π rad). */
export function createSpin(opts: SpinOpts): GestureHandle {
  let el: HTMLElement | null = null
  let enabled = true
  let tracking = false
  let lastX = 0
  let angle = 0
  let lastRev = 0

  const onDown = (e: PointerEvent) => {
    if (!enabled) return
    tracking = true
    lastX = e.clientX
    el?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent) => {
    if (!tracking || !enabled || !el) return
    const dx = e.clientX - lastX
    lastX = e.clientX
    const width = el.clientWidth || 1
    angle += (dx / width) * Math.PI * 2
    opts.onAngle?.(angle)
    const rev = Math.floor(Math.abs(angle) / (Math.PI * 2))
    if (rev > lastRev) {
      for (let n = lastRev + 1; n <= rev; n++) {
        opts.onRevolution?.(n)
      }
      lastRev = rev
    }
  }

  const onUp = () => {
    tracking = false
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
      tracking = false
    },
    setEnabled(on) {
      enabled = on
      if (!on) tracking = false
    },
  }
}
