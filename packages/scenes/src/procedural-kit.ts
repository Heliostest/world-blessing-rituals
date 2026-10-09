import * as THREE from 'three'
import type { SceneContext } from './contract'

/** Shared helpers for the warm C-grade procedural scenes on the island stage (Design A). */

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
  overlay.classList.add('scene-overlay', 'scene-overlay--stage')

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

  // Scenes listen for `click`, not `pointerup`: it also fires for Enter and
  // Space, and not when a finger slides off the button before lifting.
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
 * Renderer + scene for the warm palette. Like the woodfish, the canvas clears
 * fully transparent so the subject sits on the host's island stage itself —
 * no painted background, fog or fake stage in the canvas.
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

export type CelLightOpts = {
  sky: number
  ground: number
  key: number
  rim: number
  keyIntensity?: number
  keyPosition?: [number, number, number]
  ambientIntensity?: number
  hemiIntensity?: number
  rimIntensity?: number
}

/**
 * Anime cel light rig: one clear key sets the lit/shade split, a warm sky/ground
 * bounce keeps shade bands soft (toon gradients step only direct light), and a
 * pale backlight draws a rim along silhouettes.
 */
export function addCelLights(
  scene: THREE.Scene,
  {
    sky,
    ground,
    key,
    rim,
    keyIntensity = 1.4,
    keyPosition = [2.5, 4, 3],
    ambientIntensity = 0.35,
    hemiIntensity = 0.75,
    rimIntensity = 0.7,
  }: CelLightOpts,
) {
  const ambient = new THREE.AmbientLight(sky, ambientIntensity)
  const hemi = new THREE.HemisphereLight(sky, ground, hemiIntensity)
  const keyLight = new THREE.DirectionalLight(key, keyIntensity)
  keyLight.position.set(...keyPosition)
  const rimLight = new THREE.DirectionalLight(rim, rimIntensity)
  rimLight.position.set(-keyPosition[0] * 0.6, keyPosition[1] * 0.5, -3)
  scene.add(ambient, hemi, keyLight, rimLight)
  return { ambient, hemi, key: keyLight, rim: rimLight }
}

/**
 * The cel rig for the host's night stage (navy sky, moon upper right): the
 * bounce drops to under half and turns cool, the key becomes pale moonlight
 * from the moon's side, and a cool rim keeps silhouettes reading against the
 * navy. A scene's own lamps (warm emissive, a point light, a halo) are then
 * the warmest, brightest things in frame, not the props they light.
 * Art direction: 画面风格为三渲二，强调浓厚的日式二次元动画氛围，材质表现干净，轮廓明确，色彩柔和但富有…
 */
export const NIGHT_CEL_LIGHTS: CelLightOpts = {
  sky: 0x8fa6d6,
  ground: 0x1f3446,
  key: 0xc6d4ff,
  rim: 0x9cc2ff,
  keyIntensity: 0.6,
  keyPosition: [2.5, 4, 2],
  ambientIntensity: 0.16,
  hemiIntensity: 0.36,
  rimIntensity: 0.55,
}

/** The scene's own warm rig by day, the moonlit one on the night stage. */
export function addStageLights(
  scene: THREE.Scene,
  stage: SceneContext['stage'],
  day: CelLightOpts,
) {
  return addCelLights(scene, stage === 'night' ? NIGHT_CEL_LIGHTS : day)
}

/** A white radial falloff, in alpha only. */
function glowTexture(size = 64) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const a = Math.max(0, 1 - d)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(a * a * 255)
    }
  }
  const map = new THREE.DataTexture(data, size, size)
  // Data textures sample nearest by default: blocky once the halo is scaled up.
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

/**
 * A soft halo for a lamp on the night stage: an additive, camera-facing sprite
 * centred in the lamp, so the lamp's own front hides its middle and the glow
 * spills round its edges. Transparent, so the toon pass leaves it as it is
 * and draws no ink line round it. Drive `material.opacity` with the lamp;
 * `dispose` also frees the texture, which disposeTree does not reach.
 */
export function createLampHalo(color: number, size: number) {
  const map = glowTexture()
  const material = new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'lamp-halo'
  sprite.scale.setScalar(size)
  return {
    sprite,
    material,
    dispose() {
      material.dispose()
      map.dispose()
    },
  }
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

/** Raycasts from `camera` through client-space pointer positions on `canvas`. */
export function createPointerRay(canvas: HTMLCanvasElement, camera: THREE.Camera) {
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aim = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    ndc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    return raycaster
  }
  return {
    aim,
    /** True when the ray through the pointer hits any of `objects`. */
    hits(clientX: number, clientY: number, objects: THREE.Object3D[]) {
      return aim(clientX, clientY).intersectObjects(objects, false).length > 0
    },
  }
}

/**
 * Lets the page scroll from the empty parts of the stage: the stage overlay's
 * hit layer allows panning (touch-action: manipulation), and only a touch
 * that starts where `onObject` is true is kept from scrolling, so taps and
 * drags on the object stay with the scene. Returns a remover.
 */
export function claimObjectTouches(
  hitLayer: HTMLElement,
  onObject: (clientX: number, clientY: number) => boolean,
) {
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    if (touch && onObject(touch.clientX, touch.clientY)) e.preventDefault()
  }
  hitLayer.addEventListener('touchstart', onTouchStart, { passive: false })
  return () => hitLayer.removeEventListener('touchstart', onTouchStart)
}

/**
 * Sizes renderer, style pass and camera to the canvas box. Returns the aspect
 * so scenes can pull the camera back on narrow portrait screens.
 */
export function sizeStage(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  styleRenderer: { resize(w: number, h: number): void },
  camera: THREE.PerspectiveCamera,
) {
  const parent = canvas.parentElement
  const w = canvas.clientWidth || parent?.clientWidth || 1
  const h = canvas.clientHeight || parent?.clientHeight || 1
  renderer.setSize(w, h, false)
  styleRenderer.resize(w, h)
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
  return camera.aspect
}

/** Extra camera distance for portrait screens narrower than 0.8 aspect. */
export function portraitBoost(aspect: number, factor = 3) {
  return aspect < 0.8 ? (0.8 - aspect) * factor : 0
}

/** Re-runs `resize` when the canvas host changes size; returns a disconnect. */
export function observeCanvasResize(canvas: HTMLCanvasElement, resize: () => void) {
  if (typeof ResizeObserver === 'undefined') return () => {}
  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas.parentElement ?? canvas)
  return () => ro.disconnect()
}
