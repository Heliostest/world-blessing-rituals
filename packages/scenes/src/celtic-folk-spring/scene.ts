import * as THREE from 'three'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'

type Step = 'gyro' | 'drag' | 'wishWrite' | 'done'

const STEP_ORDER: Step[] = ['gyro', 'drag', 'wishWrite']

const COPY = {
  title: '泉边一念',
  hintGyro: '微倾停驻片刻，或点按下方以鞠躬（练习）。',
  hintDrag: '将信物拖向泉面后松开。',
  hintWish: '写下短句后提交（练习，非法效）。',
  hintHolding: '停驻片刻…',
  bowTap: '点按以鞠躬',
  done: '这一念已留下（练习结束）。',
  stepsAria: '步骤',
} as const

function setSafeText(
  el: HTMLElement,
  text: string,
  assertSafeCopy: (t: string) => void,
) {
  assertSafeCopy(text)
  el.textContent = text
}

export function createCelticFolkSpring(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'gyro'
  let disposed = false
  let started = false

  const handles: GestureHandle[] = []
  let gyroHandle: GestureHandle | null = null
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null

  overlay.replaceChildren()
  overlay.classList.add('scene-overlay')

  const titleEl = document.createElement('div')
  titleEl.className = 'scene-title'
  setSafeText(titleEl, COPY.title, assertSafeCopy)

  const dotsEl = document.createElement('div')
  dotsEl.className = 'scene-step-dots'
  dotsEl.setAttribute('role', 'list')
  dotsEl.setAttribute('aria-label', COPY.stepsAria)

  const hintEl = document.createElement('div')
  hintEl.className = 'scene-hint'
  hintEl.setAttribute('aria-live', 'polite')

  const bowBtn = document.createElement('button')
  bowBtn.type = 'button'
  bowBtn.className = 'scene-bow-tap'
  bowBtn.dataset.gyroFallback = '1'
  setSafeText(bowBtn, COPY.bowTap, assertSafeCopy)

  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'

  overlay.append(titleEl, dotsEl, hintEl, bowBtn, wishSlot)

  const renderDots = () => {
    dotsEl.replaceChildren()
    const activeIdx =
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step)
    STEP_ORDER.forEach((_, i) => {
      const dot = document.createElement('span')
      dot.className = 'scene-step-dot'
      dot.setAttribute('role', 'listitem')
      if (step === 'done' || i < activeIdx) dot.dataset.state = 'done'
      else if (i === activeIdx) dot.dataset.state = 'active'
      else dot.dataset.state = 'todo'
      dotsEl.appendChild(dot)
    })
  }

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    renderDots()
    bowBtn.hidden = step !== 'gyro'
    wishSlot.hidden = step !== 'wishWrite'
    if (step === 'gyro') setHint(COPY.hintGyro)
    else if (step === 'drag') setHint(COPY.hintDrag)
    else if (step === 'wishWrite') setHint(COPY.hintWish)
    else setHint(COPY.done)
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1a22)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 2.4, 4.2)
  camera.lookAt(0, 0, 0)

  const ambient = new THREE.AmbientLight(0x88aacc, 0.55)
  const key = new THREE.DirectionalLight(0xffffff, 1.1)
  key.position.set(2, 4, 3)
  scene.add(ambient, key)

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 48),
    new THREE.MeshStandardMaterial({
      color: 0x2a6f8f,
      metalness: 0.2,
      roughness: 0.35,
      transparent: true,
      opacity: 0.92,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.02
  scene.add(water)

  const bank = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 2.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a4a38, roughness: 0.95 }),
  )
  bank.rotation.x = -Math.PI / 2
  scene.add(bank)

  const token = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xc9a46a,
      metalness: 0.4,
      roughness: 0.4,
    }),
  )
  token.position.set(1.1, 0.2, 1.1)
  scene.add(token)

  const tokenHome = token.position.clone()
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hitPoint = new THREE.Vector3()

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
  }

  const clientToNdc = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
  }

  const waterHitTest = (clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    return raycaster.intersectObject(water, false).length > 0
  }

  const moveTokenTo = (clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      token.position.set(hitPoint.x, 0.2, hitPoint.z)
    }
  }

  const completeScene = () => {
    if (step === 'done') return
    step = 'done'
    gyroHandle?.setEnabled(false)
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goDrag = () => {
    if (step !== 'gyro') return
    step = 'drag'
    gyroHandle?.setEnabled(false)
    bowBtn.hidden = true
    dragHandle?.setEnabled(true)
    syncOverlayForStep()
  }

  const goWish = () => {
    if (step !== 'drag') return
    step = 'wishWrite'
    dragHandle?.setEnabled(false)
    token.position.set(0, 0.15, 0)
    wishHandle?.setEnabled(true)
    syncOverlayForStep()
  }

  /** Visible tap fallback completes bow step (createGyro fallback only emits onBow). */
  const onBowTapFallback = () => {
    if (disposed || step !== 'gyro') return
    goDrag()
  }

  const onOverlayMove = (e: PointerEvent) => {
    if (step !== 'drag' || e.buttons === 0) return
    moveTokenTo(e.clientX, e.clientY)
  }

  const wireGestures = () => {
    gyroHandle = gestures.createGyro({
      bowBetaDeg: 30,
      holdMs: 500,
      fallbackTapSelector: '[data-gyro-fallback]',
      onBow: () => {
        if (step !== 'gyro') return
        setHint(COPY.hintHolding)
      },
      onHold: () => {
        goDrag()
      },
    })
    gyroHandle.mount(overlay, {})
    handles.push(gyroHandle)

    bowBtn.addEventListener('pointerup', onBowTapFallback)

    dragHandle = gestures.createDrag({
      hitTest: waterHitTest,
      onDrop: (hit) => {
        if (step !== 'drag') return
        if (hit) goWish()
        else token.position.copy(tokenHome)
      },
    })
    dragHandle.mount(overlay, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    overlay.addEventListener('pointermove', onOverlayMove)

    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      onSubmit: () => {
        if (step !== 'wishWrite') return
        completeScene()
      },
    })
    wishHandle.mount(wishSlot, {})
    wishHandle.setEnabled(false)
    handles.push(wishHandle)
  }

  syncOverlayForStep()

  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed) resize()
        })
        resizeObserver.observe(canvas.parentElement ?? canvas)
      }
      wireGestures()
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const t = performance.now() * 0.001
      water.position.y = 0.02 + Math.sin(t * 1.5) * 0.01
      renderer.render(scene, camera)
    },
    dispose() {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      bowBtn.removeEventListener('pointerup', onBowTapFallback)
      overlay.removeEventListener('pointermove', onOverlayMove)
      for (const h of handles) h.dispose()
      handles.length = 0
      renderer.dispose()
      water.geometry.dispose()
      ;(water.material as THREE.Material).dispose()
      bank.geometry.dispose()
      ;(bank.material as THREE.Material).dispose()
      token.geometry.dispose()
      ;(token.material as THREE.Material).dispose()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay')
    },
  }
}
