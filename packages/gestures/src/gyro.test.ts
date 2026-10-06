import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGyro } from './gyro'

function ptr(type: string, x = 0, y = 0) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })
}

/** The click a browser sends after a tap that ends on the target. */
function tap() {
  return new MouseEvent('click', { bubbles: true, detail: 1 })
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
    el.dispatchEvent(tap())
    expect(onBow).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('fallback waits for click: a press that slides off (pointerup only) does nothing', () => {
    delete (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, onBow })
    g.mount(el, {})
    el.dispatchEvent(ptr('pointerdown'))
    el.dispatchEvent(ptr('pointerup'))
    expect(onBow).not.toHaveBeenCalled()
    // Keyboard activation (Enter/Space) arrives as a click with detail 0.
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
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

    // Safari counts a click as the gesture, not a touch's pointerdown.
    el.dispatchEvent(ptr('pointerdown'))
    expect(DOEWithPerm.requestPermission).not.toHaveBeenCalled()
    el.dispatchEvent(ptr('pointerup'))
    el.dispatchEvent(tap())
    await vi.waitFor(() => {
      expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
    })
    await Promise.resolve()

    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).toHaveBeenCalledTimes(1)
    el.dispatchEvent(tap())
    expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
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
    el.dispatchEvent(tap())
    await vi.waitFor(() => {
      expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
    })

    // After deny, fallback tap fires onBow.
    await vi.waitFor(() => {
      el.dispatchEvent(tap())
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
    btn.dispatchEvent(tap())
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

  it('asks for motion permission only while enabled: taps in earlier steps never do', async () => {
    class DOEWithPerm extends FakeDeviceOrientationEvent {
      static requestPermission = vi.fn(async () => 'granted' as PermissionState)
    }
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = DOEWithPerm
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 30, onBow })
    // As the scenes do: mounted up front, enabled only at the motion step.
    g.mount(el, {})
    g.setEnabled(false)
    el.dispatchEvent(tap())
    el.dispatchEvent(tap())
    expect(DOEWithPerm.requestPermission).not.toHaveBeenCalled()

    g.setEnabled(true)
    el.dispatchEvent(tap())
    await vi.waitFor(() => {
      expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
    })
    await Promise.resolve()
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta: 45 }))
    expect(onBow).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('does not ask from the fallback button, whose tap does the step itself', async () => {
    class DOEWithPerm extends FakeDeviceOrientationEvent {
      static requestPermission = vi.fn(async () => 'granted' as PermissionState)
    }
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = DOEWithPerm
    const btn = document.createElement('button')
    btn.className = 'bow-tap'
    btn.append(document.createElement('span'))
    el.appendChild(btn)
    const g = createGyro({ bowBetaDeg: 30, fallbackTapSelector: '.bow-tap' })
    g.mount(el, {})
    btn.dispatchEvent(tap())
    btn.firstChild!.dispatchEvent(tap())
    expect(DOEWithPerm.requestPermission).not.toHaveBeenCalled()
    el.dispatchEvent(tap())
    await vi.waitFor(() => {
      expect(DOEWithPerm.requestPermission).toHaveBeenCalledTimes(1)
    })
    g.dispose()
  })
})

describe('createGyro riseDeg', () => {
  let el: HTMLElement
  let savedDOE: unknown

  /** Readings in order, each followed by `dt` seconds of frames. */
  const tilt = (g: ReturnType<typeof createGyro>, betas: number[], dt = 0.1) => {
    for (const beta of betas) {
      window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientation', { beta }))
      g.update(dt)
    }
  }

  beforeEach(() => {
    el = document.createElement('div')
    document.body.appendChild(el)
    savedDOE = (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    ;(globalThis as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeDeviceOrientationEvent
  })

  afterEach(() => {
    el.remove()
    if (savedDOE === undefined) {
      delete (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent
    } else {
      ;(globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent = savedDOE
    }
  })

  it.each([45, 60, 75, 90])(
    'never counts a reading pose held from the start (beta ≈ %i°), however long',
    (beta) => {
      const onBow = vi.fn()
      const onHold = vi.fn()
      const g = createGyro({ bowBetaDeg: 60, riseDeg: 30, holdMs: 800, onBow, onHold })
      g.mount(el, {})
      // A hand is never quite still: a few degrees either way, for 6 s.
      for (let i = 0; i < 20; i++) tilt(g, [beta - 6, beta + 6, beta], 0.1)
      expect(onBow).not.toHaveBeenCalled()
      expect(onHold).not.toHaveBeenCalled()
      g.dispose()
    },
  )

  it('counts lowering the phone and raising it again, after the hold', () => {
    const onBow = vi.fn()
    const onHold = vi.fn()
    const g = createGyro({ bowBetaDeg: 60, riseDeg: 30, holdMs: 800, onBow, onHold })
    g.mount(el, {})
    tilt(g, [70, 50, 30], 0.1)
    expect(onBow).not.toHaveBeenCalled()
    tilt(g, [50, 70], 0)
    expect(onBow).toHaveBeenCalledTimes(1)
    g.update(0.5)
    expect(onHold).not.toHaveBeenCalled()
    g.update(0.4)
    expect(onHold).toHaveBeenCalledTimes(1)
    g.dispose()
  })

  it('does not count a raise short of riseDeg, or one that does not reach bowBetaDeg', () => {
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 60, riseDeg: 30, holdMs: 800, onBow })
    g.mount(el, {})
    tilt(g, [45, 70, 74])
    tilt(g, [20, 45, 55, 59])
    expect(onBow).not.toHaveBeenCalled()
    g.dispose()
  })

  it('forgets readings from before it was last enabled', () => {
    const onBow = vi.fn()
    const g = createGyro({ bowBetaDeg: 60, riseDeg: 30, holdMs: 800, onBow })
    g.mount(el, {})
    tilt(g, [20])
    g.setEnabled(false)
    g.setEnabled(true)
    tilt(g, [70, 75])
    expect(onBow).not.toHaveBeenCalled()
    g.dispose()
  })
})
