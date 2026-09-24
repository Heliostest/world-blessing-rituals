import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
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
  let restoring = true

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const bgColor = new THREE.Color(0x081420)
  scene.background = bgColor
  scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.09)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 2.2, 3.9)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 0.05, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'celtic-folk-spring', label: '泉边一念',
  })

  const ambient = new THREE.AmbientLight(0x4a6a8a, 0.4)
  const hemi = new THREE.HemisphereLight(0x8fd0ff, 0x0a1420, 0.5)
  const key = new THREE.DirectionalLight(0xdcefff, 0.95)
  key.position.set(2, 4, 3)
  const rim = new THREE.PointLight(0xffc98a, 0.9, 6, 2)
  rim.position.set(0, 1.1, 0)
  scene.add(ambient, hemi, key, rim)

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 48),
    new THREE.MeshStandardMaterial({
      color: 0x2a7f9f,
      emissive: 0x0c3a4a,
      emissiveIntensity: 0.4,
      metalness: 0.25,
      roughness: 0.3,
      transparent: true,
      opacity: 0.92,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.02
  scene.add(water)

  const bank = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 2.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x394a3a, roughness: 0.95 }),
  )
  bank.rotation.x = -Math.PI / 2
  scene.add(bank)

  const token = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xc9a46a,
      emissive: 0x8a5a1e,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.35,
    }),
  )
  token.position.set(1.1, 0.2, 1.1)
  scene.add(token)

  const moteCount = 60
  const motePositions = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.6 + Math.random() * 2.2
    motePositions[i * 3] = Math.cos(angle) * radius
    motePositions[i * 3 + 1] = 0.15 + Math.random() * 1.6
    motePositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const moteGeometry = new THREE.BufferGeometry()
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
  const moteMaterial = new THREE.PointsMaterial({
    color: 0x9fd8ff,
    size: 0.028,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const motes = new THREE.Points(moteGeometry, moteMaterial)
  scene.add(motes)

  const tokenHome = token.position.clone()
  const dragTarget = tokenHome.clone()
  let grabbed = false
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hitPoint = new THREE.Vector3()

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
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
      dragTarget.set(hitPoint.x, 0.2, hitPoint.z)
    }
  }

  const completeScene = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step === 'done') return
    step = 'done'
    gyroHandle?.setEnabled(false)
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goDrag = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step !== 'gyro') return
    step = 'drag'
    gyroHandle?.setEnabled(false)
    bowBtn.hidden = true
    dragHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(1)
    syncOverlayForStep()
  }

  const goWish = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step !== 'drag') return
    step = 'wishWrite'
    dragHandle?.setEnabled(false)
    grabbed = false
    dragTarget.set(0, 0.15, 0)
    token.position.copy(dragTarget)
    wishHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(2)
    syncOverlayForStep()
  }

  /** Visible tap fallback completes bow step (createGyro fallback only emits onBow). */
  const onBowTapFallback = () => {
    if (disposed || step !== 'gyro') return
    goDrag()
  }

  const onOverlayMove = (e: PointerEvent) => {
    if (step !== 'drag' || e.buttons === 0) return
    grabbed = true
    moveTokenTo(e.clientX, e.clientY)
  }

  const onOverlayUp = () => {
    grabbed = false
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
        grabbed = false
        if (hit) goWish()
        else dragTarget.copy(tokenHome)
      },
    })
    dragHandle.mount(overlay, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    overlay.addEventListener('pointermove', onOverlayMove)
    overlay.addEventListener('pointerup', onOverlayUp)
    overlay.addEventListener('pointercancel', onOverlayUp)

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
      if ((ctx.initialProgress ?? 0) >= 1) goDrag()
      if ((ctx.initialProgress ?? 0) >= 2) goWish()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const t = performance.now() * 0.001
      water.position.y = 0.02 + Math.sin(t * 1.5) * 0.01
      ;(water.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.35 + Math.sin(t * 0.9) * 0.1
      motes.rotation.y += dt * 0.02

      const followRate = 1 - Math.exp(-dt * 14)
      if (step === 'drag') {
        token.position.lerp(dragTarget, followRate)
      } else if (step === 'gyro') {
        token.position.y = tokenHome.y + Math.sin(t * 1.6) * 0.025
        token.rotation.y += dt * 0.5
      }
      const scaleTarget = grabbed ? 1.25 : 1
      token.scale.setScalar(
        THREE.MathUtils.lerp(token.scale.x, scaleTarget, 1 - Math.exp(-dt * 12)),
      )

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.15) * 0.12,
        cameraHome.y + Math.sin(t * 0.11) * 0.05,
        cameraHome.z + Math.cos(t * 0.15) * 0.12,
      )
      camera.lookAt(cameraLookAt)

      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      bowBtn.removeEventListener('pointerup', onBowTapFallback)
      overlay.removeEventListener('pointermove', onOverlayMove)
      overlay.removeEventListener('pointerup', onOverlayUp)
      overlay.removeEventListener('pointercancel', onOverlayUp)
      for (const h of handles) h.dispose()
      handles.length = 0
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      water.geometry.dispose()
      ;(water.material as THREE.Material).dispose()
      bank.geometry.dispose()
      ;(bank.material as THREE.Material).dispose()
      token.geometry.dispose()
      ;(token.material as THREE.Material).dispose()
      moteGeometry.dispose()
      moteMaterial.dispose()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay')
    },
  }
}
