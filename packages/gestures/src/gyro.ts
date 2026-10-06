import type { GestureHandle } from './types'

export type GyroOpts = {
  bowBetaDeg?: number
  /**
   * A deliberate tilt: beta must also have risen this far above its lowest
   * reading since the gesture was enabled, so a pose that is only held, at
   * any reading angle, never counts. Default 0: beta alone decides.
   */
  riseDeg?: number
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
  const riseDeg = opts.riseDeg ?? 0
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
  let needsPermission = false
  let gestureArmed = false
  let permissionRequested = false
  /** Lowest beta since the gesture was enabled (for `riseDeg`). */
  let lowestBeta = Infinity

  const maybeHold = () => {
    if (!bowed || holdFired) return
    if (holdMs <= 0) return
    if (holdAccumMs < holdMs) return
    holdFired = true
    opts.onHold?.()
  }

  const applyBeta = (beta: number | null) => {
    if (!enabled || beta == null) return
    lowestBeta = Math.min(lowestBeta, beta)
    if (beta >= bowBetaDeg && beta - lowestBeta >= riseDeg) {
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

  // `click`, like the scene buttons: taps, Enter and Space all count, and a
  // finger that slides off before lifting cancels.
  const onFallbackTap = () => {
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
    tapTarget.addEventListener('click', onFallbackTap)
  }

  const startListening = () => {
    if (disposed || listening) return
    listening = true
    window.addEventListener('deviceorientation', onOrientation)
  }

  const detachGestureArm = () => {
    if (!el || !gestureArmed) return
    el.removeEventListener('click', onPermissionGesture)
    gestureArmed = false
  }

  /** The fallback button does its step by tap; asking for motion then is moot. */
  const onFallbackButton = (target: EventTarget | null) => {
    if (!el || !opts.fallbackTapSelector || !(target instanceof Node)) return false
    return el.querySelector(opts.fallbackTapSelector)?.contains(target) ?? false
  }

  // Safari grants motion access only from an activation gesture such as a
  // click (not pointerdown), and the system prompt should come in the step
  // that uses the motion: the arm is only on while the gesture is enabled.
  const onPermissionGesture = (e: Event) => {
    if (disposed || permissionRequested || !enabled || onFallbackButton(e.target)) return
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
    el.addEventListener('click', onPermissionGesture)
  }

  const syncGestureArm = () => {
    if (enabled && needsPermission && !disposed) armGestureForPermission()
    else detachGestureArm()
  }

  const setupOrientation = () => {
    const DOE = getDOE()
    if (!DOE) {
      enableFallback()
      return
    }
    if (typeof DOE.requestPermission === 'function') {
      // Safari requires requestPermission from a user gesture — arm, do not call now.
      needsPermission = true
      syncGestureArm()
    } else {
      startListening()
    }
  }

  return {
    mount(target) {
      disposed = false
      permissionRequested = false
      needsPermission = false
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
        tapTarget.removeEventListener('click', onFallbackTap)
        fallbackActive = false
      }
      tapTarget = null
      el = null
      bowed = false
      holdAccumMs = 0
      lowestBeta = Infinity
      permissionRequested = false
      needsPermission = false
    },
    setEnabled(on) {
      enabled = on
      if (!on) {
        bowed = false
        holdAccumMs = 0
        lowestBeta = Infinity
      }
      syncGestureArm()
    },
  }
}
