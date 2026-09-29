import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addCelLights,
  CEL_STYLE,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  setSafeText,
} from '../procedural-kit'

type Step = 'idle' | 'ring' | 'listen' | 'done'

const STEP_ORDER: Step[] = ['idle', 'ring', 'listen']

const COPY = {
  title: '风铃一响',
  hintIdle: '上下拖动以拂动风铃，或点按风铃（练习）。',
  hintRing: '铃声轻响…',
  hintListen: '静听余音，点按下方结束（练习，非法效）。',
  ringTap: '拂动风铃',
  listenTap: '静听片刻',
  done: '余音已散（练习结束）。',
  stepsAria: '步骤',
} as const

const RING_SECONDS = 2.2
const SWING_TRIGGER_DEG = 30
const RIBBON_SEGMENTS = 4
const BELL_RADIUS = 0.26
const BELL_SWEEP = Math.PI * 0.55

export function createFurinWindChime(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'idle'
  let disposed = false
  let started = false
  let restoring = true
  let ringElapsed = 0
  // Damped pendulum state for the bell (radians, rad/s).
  let swing = 0
  let swingVel = 0
  let dragSwing = 0

  const handles: GestureHandle[] = []
  let tiltHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.ringTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = step === 'ring' || step === 'done'
    hitLayer.style.pointerEvents = step === 'idle' || step === 'listen' ? 'auto' : 'none'
    if (step === 'idle') {
      setHint(COPY.hintIdle)
      setSafeText(actionBtn, COPY.ringTap, assertSafeCopy)
    } else if (step === 'ring') setHint(COPY.hintRing)
    else if (step === 'listen') {
      setHint(COPY.hintListen)
      setSafeText(actionBtn, COPY.listenTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the cream page, sun-warm key light.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.5, 3.4)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.45, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'furin-wind-chime', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  // Summer afternoon: sun-warm key, cool sky-blue rim off the glass.
  addCelLights(scene, {
    sky: 0xfff4e2,
    ground: 0xdcc6a6,
    key: 0xffe2b2,
    rim: 0xc4e6ff,
    keyIntensity: 1.3,
    keyPosition: [2, 4, 3],
  })
  const glint = new THREE.PointLight(0xbfe4ff, 0, 2.5, 2)
  glint.position.set(0.3, 1.7, 0.6)
  scene.add(glint)

  const world = new THREE.Group()
  scene.add(world)

  // Wooden eave beam the chime hangs from; soft bevel catches a cel highlight.
  const beam = new THREE.Mesh(
    new RoundedBoxGeometry(3.6, 0.14, 0.3, 2, 0.025),
    new THREE.MeshStandardMaterial({ color: 0xb98c60, roughness: 0.95 }),
  )
  beam.position.set(0, 2.45, -0.1)
  world.add(beam)

  // Pivot at the hanging point; everything below swings with it.
  const pivot = new THREE.Group()
  pivot.position.set(0, 2.38, 0)
  world.add(pivot)

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0xd2574d, roughness: 0.95 }),
  )
  cord.position.y = -0.15
  pivot.add(cord)

  const bellMat = new THREE.MeshStandardMaterial({
    color: 0xd2efff,
    emissive: 0x7ab8d8,
    emissiveIntensity: 0.15,
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  })
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(BELL_RADIUS, 32, 16, 0, Math.PI * 2, 0, BELL_SWEEP),
    bellMat,
  )
  bell.position.y = -0.52
  pivot.add(bell)

  // Opaque lip and crown on the clear glass: the ink pass only outlines opaque
  // surfaces, so these give the bell a crisp drawn mouth and top.
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb4e0f2, roughness: 0.9 })
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(BELL_RADIUS * Math.sin(BELL_SWEEP), 0.009, 8, 48),
    rimMat,
  )
  lip.rotation.x = Math.PI / 2
  lip.position.y = bell.position.y + BELL_RADIUS * Math.cos(BELL_SWEEP)
  pivot.add(lip)
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 8), rimMat)
  crown.position.y = bell.position.y + BELL_RADIUS
  pivot.add(crown)

  // Painted band on the glass (goldfish-red summer stripe).
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.012, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xea5a4c, roughness: 0.9 }),
  )
  band.rotation.x = Math.PI / 2
  band.position.y = -0.62
  pivot.add(band)

  // Clapper hangs inside the bell on its own sub-pivot.
  const clapperPivot = new THREE.Group()
  clapperPivot.position.y = -0.45
  pivot.add(clapperPivot)
  const clapperString = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.42, 4),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 }),
  )
  clapperString.position.y = -0.21
  clapperPivot.add(clapperString)
  const clapper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x94704c, roughness: 0.9 }),
  )
  clapper.position.y = -0.2
  clapperPivot.add(clapper)

  // Paper ribbon (tanzaku-style) as a chain of segments for flutter.
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xf7cf6c,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })
  const segGeo = new THREE.PlaneGeometry(0.14, 0.13)
  segGeo.translate(0, -0.065, 0)
  const ribbonJoints: THREE.Group[] = []
  let parent: THREE.Object3D = clapperPivot
  for (let i = 0; i < RIBBON_SEGMENTS; i++) {
    const joint = new THREE.Group()
    joint.position.y = i === 0 ? -0.42 : -0.13
    parent.add(joint)
    joint.add(new THREE.Mesh(segGeo, ribbonMat))
    ribbonJoints.push(joint)
    parent = joint
  }

  // Generous invisible hit target covering bell + ribbon.
  const tapZone = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.4, 0.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  tapZone.position.set(0, 1.45, 0)
  world.add(tapZone)

  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  const resize = () => {
    const parentEl = canvas.parentElement
    const w = canvas.clientWidth || parentEl?.clientWidth || 1
    const h = canvas.clientHeight || parentEl?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    const portraitBoost = camera.aspect < 0.8 ? (0.8 - camera.aspect) * 2.5 : 0
    cameraHome.z = 3.4 + portraitBoost
    camera.updateProjectionMatrix()
  }

  const bellHitTest = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(pointerNdc, camera)
    return raycaster.intersectObject(tapZone, false).length > 0
  }

  const ping = (soft = false) => {
    const reduced = ctx.isReducedMotion?.() ?? false
    // Glass-like: bright fundamental + inharmonic partials, quick decay.
    fx.impact({
      freqs: [2093, 2960, 4186 * 1.19],
      duration: reduced || soft ? 0.6 : 1.6,
      gain: soft ? 0.04 : reduced ? 0.05 : 0.08,
    })
  }

  const strike = (strength: number) => {
    const reduced = ctx.isReducedMotion?.() ?? false
    swingVel += (reduced ? 0.4 : 2.6) * strength
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()

  const completeScene = () => {
    if (!canAct() || step === 'done') return
    step = 'done'
    tiltHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goListen = () => {
    if (!canAct() || step !== 'ring') return
    step = 'listen'
    if (!restoring) ctx.onProgress?.(2)
    syncOverlayForStep()
  }

  const goRing = () => {
    if (!canAct() || step !== 'idle') return
    step = 'ring'
    ringElapsed = 0
    dragSwing = 0
    tiltHandle?.setEnabled(false)
    if (!restoring) {
      strike(1)
      ping()
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
    if (!restoring && (ctx.isReducedMotion?.() ?? false)) goListen()
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'idle') goRing()
    else if (step === 'listen') completeScene()
  }

  let downX = 0
  let downY = 0
  const onHitDown = (e: PointerEvent) => {
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
  }
  const onHitCancel = () => {
    dragSwing = 0
  }
  const onHitUp = (e: PointerEvent) => {
    dragSwing = 0
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved >= 12 || !bellHitTest(e.clientX, e.clientY)) return
    if (step === 'idle') goRing()
    else if (step === 'listen' && canAct()) {
      // Extra touch while listening: a softer ping, no progress change.
      strike(0.5)
      ping(true)
    }
  }

  const wireGestures = () => {
    tiltHandle = gestures.createTilt({
      pourAngleDeg: SWING_TRIGGER_DEG,
      holdMs: 0,
      onAngle: (deg) => {
        if (step !== 'idle') return
        dragSwing = THREE.MathUtils.degToRad(
          THREE.MathUtils.clamp(deg, -SWING_TRIGGER_DEG, SWING_TRIGGER_DEG) * 0.5,
        )
      },
      onPour: () => {
        if (step !== 'idle') return
        goRing()
      },
    })
    tiltHandle.mount(hitLayer, {})
    handles.push(tiltHandle)

    hitLayer.addEventListener('pointerdown', onHitDown)
    hitLayer.addEventListener('pointerup', onHitUp)
    hitLayer.addEventListener('pointercancel', onHitCancel)
    actionBtn.addEventListener('pointerup', onActionTap)
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
      if ((ctx.initialProgress ?? 0) >= 1) goRing()
      if ((ctx.initialProgress ?? 0) >= 2) goListen()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      if (step === 'ring') {
        ringElapsed += dt
        if (reduced || ringElapsed >= RING_SECONDS) goListen()
      }

      // Pendulum: breeze sway + damped impulse from strikes.
      const breeze = reduced
        ? 0
        : Math.sin(t * 0.9) * (step === 'listen' || step === 'done' ? 0.05 : 0.025)
      const stiffness = 14
      const damping = reduced ? 6 : 1.4
      const target = breeze + dragSwing
      swingVel += (-(swing - target) * stiffness - swingVel * damping) * dt
      swing += swingVel * dt
      if (reduced) swing = THREE.MathUtils.clamp(swing, -0.08, 0.08)
      pivot.rotation.z = swing
      pivot.rotation.x = swing * 0.3

      // Clapper and ribbon lag behind the bell.
      clapperPivot.rotation.z = -swing * 0.8
      ribbonJoints.forEach((joint, i) => {
        const flutter = reduced ? 0 : Math.sin(t * 3.2 - i * 0.9) * (0.08 + Math.abs(swingVel) * 0.06)
        joint.rotation.z = -swing * 0.25 * (i + 1) * 0.5 + flutter
        joint.rotation.y = reduced ? 0 : Math.sin(t * 1.7 + i) * 0.25
      })

      const energy = Math.min(1, Math.abs(swingVel) * 0.5 + Math.abs(swing))
      glint.intensity = energy * 1.2
      bellMat.emissiveIntensity = 0.15 + energy * 0.4

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.12) * 0.08,
        cameraHome.y,
        cameraHome.z,
      )
      camera.lookAt(cameraLookAt)

      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitCancel)
      actionBtn.removeEventListener('pointerup', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      fx.dispose()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--cream')
    },
  }
}
