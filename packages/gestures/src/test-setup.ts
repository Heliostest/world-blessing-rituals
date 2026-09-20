/** jsdom (v26) lacks PointerEvent + setPointerCapture; polyfill for gesture tests. */
class PointerEventPolyfill extends MouseEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
    this.pointerType = init.pointerType ?? 'mouse'
    this.isPrimary = init.isPrimary ?? true
  }
}

if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = PointerEventPolyfill as typeof PointerEvent
}

if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function (_pointerId: number) {
    /* no-op in jsdom */
  }
  Element.prototype.releasePointerCapture = function (_pointerId: number) {
    /* no-op in jsdom */
  }
  Element.prototype.hasPointerCapture = function (_pointerId: number) {
    return false
  }
}
