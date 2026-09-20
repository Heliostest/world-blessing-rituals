import * as THREE from 'three'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'

type Step = 'tilt' | 'drag' | 'anjali' | 'done'

const STEP_ORDER: Step[] = ['tilt', 'drag', 'anjali']

const COPY = {
  title: '花水位一倾',
  hintTilt: '上下拖动以倾注（练习）。',
  hintDrag: '将花瓣拖向水面后松开。',
  hintAnjali: '点按以合十（练习，非法效）。',
  hintPouring: '倾注中…',
  anjaliTap: '点按以合十',
  done: '这一倾已留下（练习结束）。',
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

export function createTheravadaWater(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'tilt'
  let disposed = false
  let started = false
  let pourProgress = 0

  const handles: GestureHandle[] = []
  let tiltHandle: GestureHandle | null = null
  let dragHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null

  overlay.replaceChildren()
  overlay.classList.add('scene-overlay')

  const hitLayer = document.createElement('div')
  hitLayer.className = 'scene-hit-layer'
  hitLayer.setAttribute('aria-hidden', 'true')

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

  const anjaliBtn = document.createElement('button')
  anjaliBtn.type = 'button'
  anjaliBtn.className = 'scene-bow-tap'
  anjaliBtn.hidden = true
  setSafeText(anjaliBtn, COPY.anjaliTap, assertSafeCopy)

  overlay.append(hitLayer, titleEl, dotsEl, hintEl, anjaliBtn)

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
    anjaliBtn.hidden = step !== 'anjali'
    hitLayer.style.pointerEvents =
      step === 'tilt' || step === 'drag' ? 'auto' : 'none'
    if (step === 'tilt') setHint(COPY.hintTilt)
    else if (step === 'drag') setHint(COPY.hintDrag)
    else if (step === 'anjali') setHint(COPY.hintAnjali)
    else setHint(COPY.done)
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1420)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 2.6, 4.4)
  camera.lookAt(0, 0.2, 0)

  const ambient = new THREE.AmbientLight(0xaa8899, 0.55)
  const key = new THREE.DirectionalLight(0xfff0e0, 1.05)
  key.position.set(2.2, 4.2, 2.5)
  scene.add(ambient, key)

  // Basin / water surface
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.35, 0.35, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xc4a882,
      metalness: 0.35,
      roughness: 0.45,
      side: THREE.DoubleSide,
    }),
  )
  basin.position.y = 0.1
  scene.add(basin)

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 48),
    new THREE.MeshStandardMaterial({
      color: 0x3a7a9a,
      metalness: 0.25,
      roughness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.22
  scene.add(water)

  // Pitcher / pour vessel (tilts with gesture)
  const pitcherGroup = new THREE.Group()
  pitcherGroup.position.set(-1.55, 1.1, 0.4)
  scene.add(pitcherGroup)

  const pitcher = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.7, 24),
    new THREE.MeshStandardMaterial({
      color: 0xb8c4d0,
      metalness: 0.5,
      roughness: 0.35,
    }),
  )
  pitcher.position.y = 0
  pitcherGroup.add(pitcher)

  const spout = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xa0aeb8, metalness: 0.45, roughness: 0.4 }),
  )
  spout.rotation.z = Math.PI / 2
  spout.position.set(0.35, 0.15, 0)
  pitcherGroup.add(spout)

  // Stream particles (simple line of droplets when pouring)
  const streamMat = new THREE.MeshStandardMaterial({
    color: 0x6ab0d0,
    transparent: true,
    opacity: 0,
  })
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), streamMat)
  stream.position.set(-0.85, 0.75, 0.4)
  scene.add(stream)

  // Petal token to drag
  const petal = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe8a0b8,
      metalness: 0.15,
      roughness: 0.55,
    }),
  )
  petal.scale.set(1.2, 0.35, 0.9)
  petal.position.set(1.25, 0.35, 1.15)
  petal.visible = false
  scene.add(petal)

  const petalHome = petal.position.clone()
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22)
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

  const movePetalTo = (clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      petal.position.set(hitPoint.x, 0.35, hitPoint.z)
    }
  }

  const completeScene = () => {
    if (step === 'done') return
    step = 'done'
    tiltHandle?.setEnabled(false)
    dragHandle?.setEnabled(false)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goDrag = () => {
    if (step !== 'tilt') return
    step = 'drag'
    tiltHandle?.setEnabled(false)
    pourProgress = 1
    streamMat.opacity = 0
    petal.visible = true
    dragHandle?.setEnabled(true)
    syncOverlayForStep()
  }

  const goAnjali = () => {
    if (step !== 'drag') return
    step = 'anjali'
    dragHandle?.setEnabled(false)
    petal.position.set(0, 0.28, 0)
    syncOverlayForStep()
  }

  const onAnjaliTap = () => {
    if (disposed || step !== 'anjali') return
    completeScene()
  }

  const onHitMove = (e: PointerEvent) => {
    if (step !== 'drag' || e.buttons === 0) return
    movePetalTo(e.clientX, e.clientY)
  }

  const wireGestures = () => {
    tiltHandle = gestures.createTilt({
      pourAngleDeg: 40,
      holdMs: 280,
      onAngle: (deg) => {
        if (step !== 'tilt') return
        const t = Math.min(1, Math.abs(deg) / 40)
        pourProgress = t
        pitcherGroup.rotation.z = THREE.MathUtils.degToRad(Math.min(Math.abs(deg), 70) * Math.sign(deg || 1) * -0.7)
        streamMat.opacity = t > 0.5 ? (t - 0.5) * 1.2 : 0
        if (t > 0.6) setHint(COPY.hintPouring)
      },
      onPour: () => {
        if (step !== 'tilt') return
        goDrag()
      },
    })
    tiltHandle.mount(hitLayer, {})
    handles.push(tiltHandle)

    dragHandle = gestures.createDrag({
      hitTest: waterHitTest,
      onDrop: (hit) => {
        if (step !== 'drag') return
        if (hit) goAnjali()
        else petal.position.copy(petalHome)
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onHitMove)
    anjaliBtn.addEventListener('pointerup', onAnjaliTap)
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
      water.position.y = 0.22 + Math.sin(t * 1.4) * 0.008
      if (step === 'tilt' && pourProgress > 0.5) {
        stream.position.y = 0.75 - (pourProgress - 0.5) * 0.3
      }
      if (step !== 'tilt') {
        pitcherGroup.rotation.z = THREE.MathUtils.lerp(
          pitcherGroup.rotation.z,
          THREE.MathUtils.degToRad(-35),
          Math.min(1, dt * 4),
        )
      }
      renderer.render(scene, camera)
    },
    dispose() {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      hitLayer.removeEventListener('pointermove', onHitMove)
      anjaliBtn.removeEventListener('pointerup', onAnjaliTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      renderer.dispose()
      basin.geometry.dispose()
      ;(basin.material as THREE.Material).dispose()
      water.geometry.dispose()
      ;(water.material as THREE.Material).dispose()
      pitcher.geometry.dispose()
      ;(pitcher.material as THREE.Material).dispose()
      spout.geometry.dispose()
      ;(spout.material as THREE.Material).dispose()
      stream.geometry.dispose()
      streamMat.dispose()
      petal.geometry.dispose()
      ;(petal.material as THREE.Material).dispose()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay')
    },
  }
}
