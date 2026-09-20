import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGyro } from './gyro'

function ptr(type: string, x = 0, y = 0) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })
}

/** Minimal DeviceOrientationEvent stand-in for jsdom. */
class FakeDeviceOrientationEvent extends Event {
  readonly beta: number | null
  readonly gamma: number | null
  readonly alpha: number | null
  constructor(type: string, init: { beta?: number | null; gamma?: number | null; alpha?: number | null } = {}) {
    super(type)
    this.beta = init.beta ?? null
    this.gamma = init.gamma ?? null
    this.alpha = init.alpha ?? null
  }
}

describe('createGyro', () => {
  let el: HTMLElement
  let savedDOE: unknown

  beforeEach(() => {
    el = document.createElement('div')
    document.body.appendChild(el)
    savedDOE = (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
  })

  afterEach(() => {
    el.remove()
    if (savedDOE === undefined) {
      delete (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    } else {
      ;(globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent = savedDOE
    }
  })

  it('fires onBow when beta reaches bowBetaDeg', () => {
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeDeviceOrientationEvent
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, holdMs: 0, onBow })
    g.mount(el, {})
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('does not fire onBow below bowBetaDeg', () => {
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeDeviceOrientationEvent
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, holdMs: 0, onBow })
    g.mount(el, {})
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 10 }))
    expect(onBow).not.toHaveBeenCalled()
    g.dispose()
  })

  it('fires onBow only once until beta drops below threshold', () => {
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeDeviceOrientationEvent
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, holdMs: 0, onBow })
    g.mount(el, {})
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 50 }))
    expect(onBow).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 10 }))
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).toHaveBeenCalledTimes(2)
    g.dispose()
  })

  it('fires onHold after holdMs via update(dt) while bowed', () => {
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeDeviceOrientationEvent
    const onHold = vi.fn()
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, holdMs: 200, onBow, onHold })
    g.mount(el, {})
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).toHaveBeenCalledTimes(1)
    expect(onHold).not.toHaveBeenCalled()
    g.update(0.1)
    expect(onHold).not.toHaveBeenCalled()
    g.update(0.1)
    expect(onHold).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('falls back to tap → onBow when DeviceOrientationEvent is unavailable', () => {
    delete (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, onBow })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown'))
    el.dispatchEvent(ptr('pointerup'))
    expect(onBow).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('requests permission on user gesture and listens when granted', async () => {
    class DOEWithPerm extends FakeDeviceOrientationEvent {
      static requestPermission = vi.fn(async () => 'granted' as PermissionState)
    }
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = DOEWithPerm
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, onBow })
    g.mount(el, {})

    // Mount must not call requestPermission (Safari user-gesture requirement).
    expect(DOEWithPerm.requestPermission).not.toHaveBeenCalled()
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).not.toHaveBeenCalled()

    el.dispatchEvent(ptr('pointerdown'))
    await vi.waitFor(() => {
      expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
    })
    await Promise.resolve()

    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('enables tap fallback when requestPermission denies', async () => {
    class DOEWithPerm extends FakeDeviceOrientationEvent {
      static requestPermission = vi.fn(async () => 'denied' as PermissionState)
    }
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = DOEWithPerm
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, onBow })
    g.mount(el, {})
    expect(DOEWithPerm.requestPermission).not.toHaveBeenCalled()

    // First user gesture triggers permission request (not mount).
    el.dispatchEvent(ptr('pointerdown'))
    await vi.waitFor(() => {
      expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
    })

    // After deny, fallback tap fires onBow.
    await vi.waitFor(() => {
      el.dispatchEvent(ptr('pointerup'))
      expect(onBow).toHaveBeenCalled()
    })
    g.dispose()
  })

  it('uses fallbackTapSelector when provided', () => {
    delete (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    const btn = document.createElement('button')
    btn.className = 'bow-tap'
    el.appendChild(btn)
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, onBow, fallbackTapSelector: '.bow-tap' })
    g.mount(el, {})
    btn.dispatchEvent(ptr('pointerdown'))
    btn.dispatchEvent(ptr('pointerup'))
    expect(onBow).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('ignores orientation and taps when disabled', () => {
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeDeviceOrientationEvent
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, holdMs: 0, onBow })
    g.mount(el, {})
    g.setEnabled(false)
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).not.toHaveBeenCalled()
    g.dispose()
  })
})
