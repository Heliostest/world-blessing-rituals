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

  const setupOrientation = () => {
    const DOE = getDOE()
    if (!DOE) {
      enableFallback()
      return
    }
    if (typeof DOE.requestPermission === 'function') {
      void DOE.requestPermission()
        .then((state) => {
          if (disposed) return
          if (state === 'granted') startListening()
          else enableFallback()
        })
        .catch(() => {
          if (!disposed) enableFallback()
        })
    } else {
      startListening()
    }
  }

  return {
    mount(target) {
      disposed = false
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
