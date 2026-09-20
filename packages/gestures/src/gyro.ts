import type { GestureHandle } from './types'

export type GyroOpts = {
  bowBetaDeg?: number
  holdMs?: number
  onBow?(): void
  onHold?(): void
  fallbackTapSelector?: string
}

type DOEConstructor = {
  new (type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent
  requestPermission?: () => Promise<PermissionState>
}

function getDOE(): DOEConstructor | undefined {
  return (globalThis as { DeviceOrientationEvent?: DOEConstructor }).DeviceOrientationEvent
}

export function createGyro(opts: GyroOpts): GestureHandle {
  const bowBetaDeg = opts.bowBetaDeg ?? 30
  const holdMs = opts.holdMs ?? 0

  let el: HTMLElement | null = null
  let tapTarget: HTMLElement | null = null
  let enabled = true
  let listening = false
  let fallbackActive = false
  let bowed = false
  let holdAccumMs = 0
  let holdFired = false
  let disposed = false
  let gestureArmed = false
  let permissionRequested = false

  const maybeHold = () => {
    if (!bowed || holdFired) return
    if (holdMs <= 0) return
    if (holdAccumMs < holdMs) return
    holdFired = true
    opts.onHold?.()
  }

  const applyBeta = (beta: number | null) => {
    if (!enabled || beta == null) return
    if (beta >= bowBetaDeg) {
      if (!bowed) {
        bowed = true
        holdAccumMs = 0
        holdFired = false
        opts.onBow?.()
        if (holdMs === 0) {
          // no hold gate; onHold only when holdMs > 0
        }
      }
      maybeHold()
    } else {
      bowed = false
      holdAccumMs = 0
      holdFired = false
    }
  }

  const onOrientation = (e: Event) => {
    if (!enabled || !listening) return
    const beta = (e as DeviceOrientationEvent).beta
    applyBeta(beta)
  }

  const onFallbackPointerUp = () => {
    if (!enabled || !fallbackActive) return
    opts.onBow?.()
  }

  const enableFallback = () => {
    if (disposed || !el || fallbackActive) return
    fallbackActive = true
    tapTarget =
      opts.fallbackTapSelector
        ? (el.querySelector(opts.fallbackTapSelector) as HTMLElement | null) ?? el
        : el
    tapTarget.addEventListener('pointerup', onFallbackPointerUp)
  }

  const startListening = () => {
    if (disposed || listening) return
    listening = true
    window.addEventListener('deviceorientation', onOrientation)
  }

  const detachGestureArm = () => {
    if (!el || !gestureArmed) return
    el.removeEventListener('pointerdown', onFirstUserGesture)
    el.removeEventListener('click', onFirstUserGesture)
    gestureArmed = false
  }

  const onFirstUserGesture = () => {
    if (disposed || permissionRequested) return
    permissionRequested = true
    detachGestureArm()

    const DOE = getDOE()
    if (!DOE || typeof DOE.requestPermission !== 'function') {
      startListening()
      return
    }
    void DOE.requestPermission()
      .then((state) => {
        if (disposed) return
        if (state === 'granted') startListening()
        else enableFallback()
      })
      .catch(() => {
        if (!disposed) enableFallback()
      })
  }

  const armGestureForPermission = () => {
    if (!el || gestureArmed || permissionRequested) return
    gestureArmed = true
    el.addEventListener('pointerdown', onFirstUserGesture)
    el.addEventListener('click', onFirstUserGesture)
  }

  const setupOrientation = () => {
    const DOE = getDOE()
    if (!DOE) {
      enableFallback()
      return
    }
    if (typeof DOE.requestPermission === 'function') {
      // Safari requires requestPermission from a user gesture — arm, do not call now.
      armGestureForPermission()
    } else {
      startListening()
    }
  }

  return {
    mount(target) {
      disposed = false
      permissionRequested = false
      el = target
      setupOrientation()
    },
    update(dt) {
      if (!enabled || !bowed || holdMs <= 0) return
      holdAccumMs += dt * 1000
      maybeHold()
    },
    dispose() {
      disposed = true
      detachGestureArm()
      if (listening) {
        window.removeEventListener('deviceorientation', onOrientation)
        listening = false
      }
      if (fallbackActive && tapTarget) {
        tapTarget.removeEventListener('pointerup', onFallbackPointerUp)
        fallbackActive = false
      }
      tapTarget = null
      el = null
      bowed = false
      holdAccumMs = 0
      permissionRequested = false
    },
    setEnabled(on) {
      enabled = on
      if (!on) {
        bowed = false
        holdAccumMs = 0
      }
    },
  }
}
