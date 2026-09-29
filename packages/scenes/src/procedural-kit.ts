import * as THREE from 'three'

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
  overlay.classList.add('scene-overlay')

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

/** Renderer + scene + camera tuned for the cream/warm palette. */
export function createWarmStage(
  canvas: HTMLCanvasElement,
  background: number,
  fogDensity: number,
) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const bgColor = new THREE.Color(background)
  scene.background = bgColor
  scene.fog = new THREE.FogExp2(bgColor.getHex(), fogDensity)
  return { renderer, scene }
}

/** Soft floating motes around the origin (warm additive points). */
export function createMotes(count: number, color: number, spread = 2.2, height = 1.8) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.4 + Math.random() * spread
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = 0.1 + Math.random() * height
    positions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color,
    size: 0.03,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  })
  return new THREE.Points(geometry, material)
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
