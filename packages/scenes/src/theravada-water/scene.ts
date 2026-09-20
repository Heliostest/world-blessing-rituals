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
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const bgColor = new THREE.Color(0x150f1c)
  scene.background = bgColor
  scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.085)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 2.4, 4.1)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 0.25, 0)
  camera.lookAt(cameraLookAt)

  const ambient = new THREE.AmbientLight(0x6a5468, 0.4)
  const hemi = new THREE.HemisphereLight(0xd8b8ff, 0x120a18, 0.45)
  const key = new THREE.DirectionalLight(0xfff0e0, 0.95)
  key.position.set(2.2, 4.2, 2.5)
  const fill = new THREE.PointLight(0x8ac8e0, 0.6, 6, 2)
  fill.position.set(-1.6, 1.4, 0.6)
  scene.add(ambient, hemi, key, fill)

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
      color: 0x3a8aaa,
      emissive: 0x123a4a,
      emissiveIntensity: 0.4,
      metalness: 0.25,
      roughness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.22
  scene.add(water)

  const anjaliGlow = new THREE.PointLight(0xffd9a0, 0, 5, 2)
  anjaliGlow.position.set(0, 0.9, 0)
  scene.add(anjaliGlow)

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

  // Stream (stretches from the spout tip down to the water surface while pouring)
  const streamBaseHeight = 0.9
  const streamMat = new THREE.MeshStandardMaterial({
    color: 0x8ad0e8,
    emissive: 0x3a90b0,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0,
  })
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.045, streamBaseHeight, 8),
    streamMat,
  )
  scene.add(stream)
  const spoutWorldPos = new THREE.Vector3()

  // Petal token to drag
  const petal = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe8a0b8,
      emissive: 0x6a2a40,
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.55,
    }),
  )
  petal.scale.set(1.2, 0.35, 0.9)
  petal.position.set(1.25, 0.35, 1.15)
  petal.visible = false
  scene.add(petal)

  const moteCount = 55
  const motePositions = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.6 + Math.random() * 2.1
    motePositions[i * 3] = Math.cos(angle) * radius
    motePositions[i * 3 + 1] = 0.15 + Math.random() * 1.6
    motePositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const moteGeometry = new THREE.BufferGeometry()
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
  const moteMaterial = new THREE.PointsMaterial({
    color: 0xe0b8ff,
    size: 0.028,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const motes = new THREE.Points(moteGeometry, moteMaterial)
  scene.add(motes)

  const petalHome = petal.position.clone()
  const dragTarget = petalHome.clone()
  let grabbed = false
  let petalScale = 1
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
      dragTarget.set(hitPoint.x, 0.35, hitPoint.z)
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
    grabbed = false
    dragTarget.set(0, 0.28, 0)
    petal.position.copy(dragTarget)
    syncOverlayForStep()
  }

  const onAnjaliTap = () => {
    if (disposed || step !== 'anjali') return
    completeScene()
  }

  const onHitMove = (e: PointerEvent) => {
    if (step !== 'drag' || e.buttons === 0) return
    grabbed = true
    movePetalTo(e.clientX, e.clientY)
  }

  const onHitUp = () => {
    grabbed = false
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
        grabbed = false
        if (hit) goAnjali()
        else dragTarget.copy(petalHome)
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onHitMove)
    hitLayer.addEventListener('pointerup', onHitUp)
    hitLayer.addEventListener('pointercancel', onHitUp)
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
      ;(water.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.35 + Math.sin(t * 0.9) * 0.1
      motes.rotation.y += dt * 0.02

      if (step !== 'tilt') {
        pitcherGroup.rotation.z = THREE.MathUtils.lerp(
          pitcherGroup.rotation.z,
          THREE.MathUtils.degToRad(-35),
          Math.min(1, dt * 4),
        )
      }
      pitcherGroup.updateMatrixWorld(true)
      spout.getWorldPosition(spoutWorldPos)
      if (streamMat.opacity > 0) {
        const waterY = water.position.y
        const dropHeight = Math.max(spoutWorldPos.y - waterY, 0.05)
        stream.position.set(
          spoutWorldPos.x,
          (spoutWorldPos.y + waterY) / 2,
          spoutWorldPos.z,
        )
        const radial = THREE.MathUtils.clamp(pourProgress, 0.2, 1)
        stream.scale.set(radial, dropHeight / streamBaseHeight, radial)
      }

      const followRate = 1 - Math.exp(-dt * 14)
      if (step === 'drag') {
        petal.position.lerp(dragTarget, followRate)
        petal.rotation.y += dt * 0.6
      }
      const scaleTarget = grabbed ? 1.25 : 1
      petalScale = THREE.MathUtils.lerp(petalScale, scaleTarget, 1 - Math.exp(-dt * 12))
      petal.scale.set(1.2 * petalScale, 0.35 * petalScale, 0.9 * petalScale)

      anjaliGlow.intensity =
        step === 'anjali'
          ? THREE.MathUtils.lerp(anjaliGlow.intensity, 1.1 + Math.sin(t * 3) * 0.25, 1 - Math.exp(-dt * 6))
          : THREE.MathUtils.lerp(anjaliGlow.intensity, 0, 1 - Math.exp(-dt * 6))

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.13) * 0.12,
        cameraHome.y + Math.sin(t * 0.1) * 0.05,
        cameraHome.z + Math.cos(t * 0.13) * 0.12,
      )
      camera.lookAt(cameraLookAt)

      renderer.render(scene, camera)
    },
    dispose() {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      hitLayer.removeEventListener('pointermove', onHitMove)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitUp)
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
      moteGeometry.dispose()
      moteMaterial.dispose()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay')
    },
  }
}
