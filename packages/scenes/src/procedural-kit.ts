import * as THREE from 'three'
import type { SceneContext } from './contract'

/** Shared helpers for the cream/warm C-grade procedural scenes (Design A). */

export function setSafeText(
  el: HTMLElement,
  text: string,
  assertSafeCopy: (t: string) => void,
) {
  assertSafeCopy(text)
  el.textContent = text
}

export type StepOverlay = {
  hitLayer: HTMLDivElement
  titleEl: HTMLDivElement
  dotsEl: HTMLDivElement
  hintEl: HTMLDivElement
  actionBtn: HTMLButtonElement
  renderDots(activeIdx: number, total: number): void
}

/** Builds hit layer, title, step dots, aria-live hint and one tap button. */
export function createStepOverlay(
  overlay: HTMLElement,
  copy: { title: string; stepsAria: string; action: string },
  assertSafeCopy: (t: string) => void,
): StepOverlay {
  overlay.replaceChildren()
  overlay.classList.add('scene-overlay', 'scene-overlay--cream')

  const hitLayer = document.createElement('div')
  hitLayer.className = 'scene-hit-layer'
  hitLayer.setAttribute('aria-hidden', 'true')

  const titleEl = document.createElement('div')
  titleEl.className = 'scene-title'
  setSafeText(titleEl, copy.title, assertSafeCopy)

  const dotsEl = document.createElement('div')
  dotsEl.className = 'scene-step-dots'
  dotsEl.setAttribute('role', 'list')
  dotsEl.setAttribute('aria-label', copy.stepsAria)

  const hintEl = document.createElement('div')
  hintEl.className = 'scene-hint'
  hintEl.setAttribute('aria-live', 'polite')

  const actionBtn = document.createElement('button')
  actionBtn.type = 'button'
  actionBtn.className = 'scene-bow-tap'
  setSafeText(actionBtn, copy.action, assertSafeCopy)

  overlay.append(hitLayer, titleEl, dotsEl, hintEl, actionBtn)

  const renderDots = (activeIdx: number, total: number) => {
    dotsEl.replaceChildren()
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span')
      dot.className = 'scene-step-dot'
      dot.setAttribute('role', 'listitem')
      if (i < activeIdx) dot.dataset.state = 'done'
      else if (i === activeIdx) dot.dataset.state = 'active'
      else dot.dataset.state = 'todo'
      dotsEl.appendChild(dot)
    }
  }

  return { hitLayer, titleEl, dotsEl, hintEl, actionBtn, renderDots }
}

/** Default look for the C-grade scenes: anime 三渲二 (cel bands + ink outlines). */
export const CEL_STYLE = 'toon-ink' as const

/**
 * Renderer + scene for the cream/warm palette. Like the woodfish, the canvas
 * clears fully transparent so the subject sits on the cream page itself — no
 * painted background, fog or fake stage.
 */
export function createWarmStage(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  return { renderer, scene }
}

type CelLightOpts = {
  sky: number
  ground: number
  key: number
  rim: number
  keyIntensity?: number
  keyPosition?: [number, number, number]
}

/**
 * Anime cel light rig: one clear key sets the lit/shade split, a warm sky/ground
 * bounce keeps shade bands soft (toon gradients step only direct light), and a
 * pale backlight draws a rim along silhouettes.
 */
export function addCelLights(
  scene: THREE.Scene,
  { sky, ground, key, rim, keyIntensity = 1.4, keyPosition = [2.5, 4, 3] }: CelLightOpts,
) {
  const ambient = new THREE.AmbientLight(sky, 0.35)
  const hemi = new THREE.HemisphereLight(sky, ground, 0.75)
  const keyLight = new THREE.DirectionalLight(key, keyIntensity)
  keyLight.position.set(...keyPosition)
  const rimLight = new THREE.DirectionalLight(rim, 0.7)
  rimLight.position.set(-keyPosition[0] * 0.6, keyPosition[1] * 0.5, -3)
  scene.add(ambient, hemi, keyLight, rimLight)
  return { ambient, hemi, key: keyLight, rim: rimLight }
}

/** Dispose every geometry/material reachable from `root`. */
export function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m))
    else if (mat) materials.add(mat)
  })
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
}

type ToneOpts = {
  /** Fundamental frequencies (Hz) layered together. */
  freqs: number[]
  duration: number
  gain?: number
  type?: OscillatorType
}

/**
 * One lazily created AudioContext per scene instance; call `play` only from a
 * user gesture. Missing Web Audio is a silent no-op.
 */
export function createChimeAudio() {
  let ac: AudioContext | null = null
  let closed = false

  const ensure = (): AudioContext | null => {
    if (closed) return null
    if (ac) return ac
    const Ctor =
      typeof window !== 'undefined'
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
        : undefined
    if (!Ctor) return null
    try {
      ac = new Ctor()
    } catch {
      ac = null
    }
    return ac
  }

  return {
    /** Create/resume the context inside a user gesture (mobile autoplay). */
    unlock() {
      const a = ensure()
      if (a?.state === 'suspended') void a.resume().catch(() => {})
    },
    play({ freqs, duration, gain = 0.12, type = 'sine' }: ToneOpts) {
      const a = ensure()
      if (!a) return
      try {
        if (a.state === 'suspended') void a.resume()
        const now = a.currentTime
        const master = a.createGain()
        master.gain.setValueAtTime(0.0001, now)
        master.gain.exponentialRampToValueAtTime(gain, now + 0.015)
        master.gain.exponentialRampToValueAtTime(0.0001, now + duration)
        master.connect(a.destination)
        freqs.forEach((f, i) => {
          const osc = a.createOscillator()
          osc.type = type
          osc.frequency.setValueAtTime(f, now)
          const g = a.createGain()
          g.gain.value = 1 / (i + 1)
          osc.connect(g).connect(master)
          osc.start(now)
          osc.stop(now + duration + 0.05)
        })
      } catch {
        // audio is decorative; ignore failures
      }
    },
    dispose() {
      closed = true
      if (ac) void ac.close().catch(() => {})
      ac = null
    },
  }
}

export type ChimeTone = ToneOpts

/**
 * Scene-side sound + haptics that follow the App's 音效/震动 toggles (same
 * settings the woodfish uses). Without an App host, chimes play and haptics
 * are skipped.
 */
export function createSceneFeedback(
  ctx: Pick<SceneContext, 'prepareFeedback' | 'haptic' | 'isSoundEnabled'>,
) {
  const audio = createChimeAudio()
  const soundOn = () => ctx.isSoundEnabled?.() ?? true
  return {
    /** Call at gesture start so audio may start on the later impact. */
    prepare() {
      ctx.prepareFeedback?.()
      if (soundOn()) audio.unlock()
    },
    /** The impactful moment: haptic tick plus an optional chime. */
    impact(tone?: ChimeTone) {
      ctx.haptic?.()
      if (tone && soundOn()) audio.play(tone)
    },
    dispose() {
      audio.dispose()
    },
  }
}
