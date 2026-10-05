import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addCelLights,
  CEL_STYLE,
  claimObjectTouches,
  createPointerRay,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  observeCanvasResize,
  portraitBoost,
  setSafeText,
  sizeStage,
} from '../procedural-kit'
import { CLOCKWISE_FROM_ABOVE, clockwiseImpulse } from './spin-direction'

type Step = 'ready' | 'turn' | 'still' | 'done'

const STEP_ORDER: Step[] = ['ready', 'turn', 'still']

const COPY = {
  title: '廊前轻转',
  hintReady: '转筒只沿顺时针转：从右向左轻滑，或点按转筒（练习）。',
  hintReverse: '反向推不动：转筒只沿顺时针方向转动，请从右向左轻滑。',
  hintTurn: '转筒缓缓转着，可静看它慢下来，或点按下方让它停下。',
  hintSettling: '转筒渐渐慢下来…',
  hintStill: '转筒慢慢停下，点按下方或竖起手机稍停，静立片刻（练习，非法效）。',
  pushTap: '轻推一下',
  settleTap: '让它慢慢停下',
  stillTap: '静立片刻',
  done: '廊前安静下来（练习结束，不以转数计算）。',
  stepsAria: '步骤',
} as const

const DRUM_Y = 1.3
const DRUM_R = 0.36
const DRUM_H = 1.0
/** Angular speed (rad/s) from a tap push and per radian of swipe. */
const TAP_PUSH = 4.2
const SWIPE_GAIN = 2.4
const MAX_SPEED = 7
const START_SPEED = 1.2
const STILL_SPEED = 0.08
/** Extra drag (1/s) once asked to stop: about a second from full speed to rest. */
const SETTLE_DRAG = 3
/**
 * The button turns into 让它慢慢停下 as the drum starts; it waits this long
 * first, so the second tap of a double tap does not stop it at once.
 */
const SETTLE_AFTER_SECONDS = 0.8
const REVERSE_HINT_RAD = 0.5
/** How long the refused-direction hint stays before the step's own returns. */
const REVERSE_HINT_SECONDS = 2.5

type Unit = { unit: THREE.Group; drum: THREE.Group }

export function createTibetanWheel(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'ready'
  let disposed = false
  let started = false
  let restoring = true
  // Drum speed in rad/s, always ≥ 0; the sign lives in CLOCKWISE_FROM_ABOVE.
  let speed = 0
  let lastSpinAngle = 0
  let reverseAccum = 0
  let refuseWobble = 0
  /** Seconds the refused-direction hint has left (0: the step's own hint). */
  let reverseHintT = 0
  /** Seconds since the turn began, and whether the drum was asked to stop. */
  let turnT = 0
  let settling = false

  const handles: GestureHandle[] = []
  let spinHandle: GestureHandle | null = null
  let gyroHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.pushTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui
  actionBtn.dataset.gyroFallback = ''

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = step === 'done'
    hitLayer.style.pointerEvents = step === 'ready' || step === 'turn' ? 'auto' : 'none'
    // Just after the turn begins, and while the drum settles, the button waits.
    const waiting = step === 'turn' && (settling || turnT < SETTLE_AFTER_SECONDS)
    actionBtn.setAttribute('aria-disabled', String(waiting))
    const refused = reverseHintT > 0
    if (step === 'ready') {
      setHint(refused ? COPY.hintReverse : COPY.hintReady)
      setSafeText(actionBtn, COPY.pushTap, assertSafeCopy)
    } else if (step === 'turn') {
      setHint(settling ? COPY.hintSettling : refused ? COPY.hintReverse : COPY.hintTurn)
      setSafeText(actionBtn, COPY.settleTap, assertSafeCopy)
    } else if (step === 'still') {
      setHint(COPY.hintStill)
      setSafeText(actionBtn, COPY.stillTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the cream page: high-altitude sun key, cool rim, warm bounce.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.5, 3.5)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.3, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'tibetan-wheel', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, {
    sky: 0xfff2e0,
    ground: 0xd6b894,
    key: 0xffdcaa,
    rim: 0xd6e6ff,
    keyIntensity: 1.3,
    keyPosition: [2.5, 4.5, 3],
  })

  const world = new THREE.Group()
  scene.add(world)

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xa3442f, roughness: 0.9 })
  const eaveMat = new THREE.MeshStandardMaterial({ color: 0x5b3526, roughness: 0.9 })
  const axleMat = new THREE.MeshStandardMaterial({ color: 0x6d5a45, metalness: 0.3, roughness: 0.6 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0ac4c, metalness: 0.35, roughness: 0.45 })
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc97a45, metalness: 0.3, roughness: 0.5 })
  const lacquerMat = new THREE.MeshStandardMaterial({ color: 0xb2402f, roughness: 0.7 })
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x9f6f3a, metalness: 0.3, roughness: 0.55 })

  const beamGeo = new RoundedBoxGeometry(1.1, 0.12, 0.3, 2, 0.03)
  const postGeo = new RoundedBoxGeometry(0.1, 2.05, 0.1, 2, 0.02)
  const eaveGeo = new RoundedBoxGeometry(1.35, 0.07, 0.6, 2, 0.02)
  const axleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.9, 10)
  const bandH = 0.14
  const panelH = DRUM_H - bandH * 2
  const panelCount = 16
  const panelGeos = Array.from({ length: panelCount }, (_, i) =>
    new THREE.CylinderGeometry(DRUM_R, DRUM_R, panelH, 3, 1, true, (i / panelCount) * Math.PI * 2, (Math.PI * 2) / panelCount),
  )
  const bandGeo = new THREE.CylinderGeometry(DRUM_R + 0.006, DRUM_R + 0.006, bandH, 40)
  const ringGeo = new THREE.TorusGeometry(DRUM_R + 0.012, 0.014, 8, 48)
  const capGeo = new THREE.CylinderGeometry(DRUM_R * 0.55, DRUM_R + 0.01, 0.1, 40)
  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16)
  const studGeo = new THREE.SphereGeometry(0.02, 8, 6)

  /**
   * Fixed corridor wheel: frame + axle stay put, only `drum` turns. Decoration
   * is plain two-tone metal panels, lacquer bands and studs — no script.
   */
  const buildUnit = (): Unit => {
    const unit = new THREE.Group()
    for (const y of [0.3, 2.3]) {
      const beam = new THREE.Mesh(beamGeo, frameMat)
      beam.position.y = y
      unit.add(beam)
    }
    for (const x of [-0.5, 0.5]) {
      const post = new THREE.Mesh(postGeo, frameMat)
      post.position.set(x, 1.3, 0)
      unit.add(post)
    }
    const eave = new THREE.Mesh(eaveGeo, eaveMat)
    eave.position.set(0, 2.4, 0.05)
    unit.add(eave)
    const axle = new THREE.Mesh(axleGeo, axleMat)
    axle.position.y = DRUM_Y
    unit.add(axle)

    const drum = new THREE.Group()
    drum.position.y = DRUM_Y
    unit.add(drum)
    panelGeos.forEach((g, i) => drum.add(new THREE.Mesh(g, i % 2 ? copperMat : goldMat)))
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(bandGeo, lacquerMat)
      band.position.y = side * (panelH / 2 + bandH / 2)
      drum.add(band)
      for (const edge of [panelH / 2, DRUM_H / 2]) {
        const ring = new THREE.Mesh(ringGeo, goldMat)
        ring.rotation.x = Math.PI / 2
        ring.position.y = side * edge
        drum.add(ring)
      }
      const cap = new THREE.Mesh(capGeo, bronzeMat)
      cap.position.y = side * (DRUM_H / 2 + 0.05)
      if (side < 0) cap.rotation.x = Math.PI
      drum.add(cap)
      const hub = new THREE.Mesh(hubGeo, goldMat)
      hub.position.y = side * (DRUM_H / 2 + 0.12)
      drum.add(hub)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        const stud = new THREE.Mesh(studGeo, goldMat)
        stud.position.set(
          Math.cos(a) * (DRUM_R + 0.01),
          side * (panelH / 2 + bandH / 2),
          Math.sin(a) * (DRUM_R + 0.01),
        )
        drum.add(stud)
      }
    }
    return { unit, drum }
  }

  // Main wheel in front; two neighbours suggest the corridor row.
  const main = buildUnit()
  world.add(main.unit)
  const neighbours: Unit[] = []
  for (const x of [-1.25, 1.25]) {
    const u = buildUnit()
    u.unit.position.set(x, 0, -0.35)
    u.drum.rotation.y = x
    world.add(u.unit)
    neighbours.push(u)
  }

  const drumZone = new THREE.Mesh(
    new THREE.CylinderGeometry(DRUM_R + 0.2, DRUM_R + 0.2, DRUM_H + 0.3, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  drumZone.position.y = DRUM_Y
  world.add(drumZone)

  const pointer = createPointerRay(canvas, camera)
  /** Taps and swipes that start on the drum are the scene's; elsewhere the page scrolls. */
  const onDrum = (x: number, y: number) => pointer.hits(x, y, [drumZone])

  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.5 + portraitBoost(aspect, 3.5)
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()

  const completeScene = () => {
    if (!canAct() || step === 'done') return
    step = 'done'
    spinHandle?.setEnabled(false)
    gyroHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goStill = () => {
    if (!canAct() || step !== 'turn') return
    step = 'still'
    settling = false
    reverseHintT = 0
    spinHandle?.setEnabled(false)
    gyroHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(2)
    else speed = 0
    syncOverlayForStep()
  }

  const goTurn = () => {
    if (!canAct() || step !== 'ready') return
    step = 'turn'
    turnT = 0
    reverseHintT = 0
    if (!restoring) ctx.onProgress?.(1)
    else speed = TAP_PUSH // resumed mid-turn: let it coast down again
    syncOverlayForStep()
  }

  /**
   * Add clockwise speed; the first push that gets it going starts the turn.
   * A push the right way also answers a refused one, so its hint goes.
   */
  const push = (amount: number) => {
    if (!canAct() || (step !== 'ready' && step !== 'turn') || settling || amount <= 0) return
    const before = speed
    speed = Math.min(MAX_SPEED, speed + amount)
    if (before < START_SPEED && speed >= START_SPEED) {
      // Low, soft metal hum on the push that sets the drum turning.
      const reduced = ctx.isReducedMotion?.() ?? false
      fx.impact({ freqs: [196, 293.66, 392], duration: reduced ? 0.5 : 1.2, gain: 0.05 })
    }
    const refused = reverseHintT > 0
    reverseHintT = 0
    if (step === 'ready' && speed >= START_SPEED) goTurn()
    else if (refused) syncOverlayForStep()
  }

  /** While it turns, the button lets the drum slow to rest; then the still step begins. */
  const settle = () => {
    if (!canAct() || step !== 'turn' || settling || turnT < SETTLE_AFTER_SECONDS) return
    settling = true
    reverseHintT = 0
    syncOverlayForStep()
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'ready') push(TAP_PUSH)
    else if (step === 'turn') settle()
    else if (step === 'still') completeScene()
  }

  let downX = 0
  let downY = 0
  const onHitDown = (e: PointerEvent) => {
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
    reverseAccum = 0
  }
  const onHitUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && onDrum(e.clientX, e.clientY)) push(TAP_PUSH)
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    stopClaim = claimObjectTouches(hitLayer, onDrum)
    spinHandle = gestures.createSpin({
      startsOn: onDrum,
      onAngle: (angle) => {
        const delta = angle - lastSpinAngle
        lastSpinAngle = angle
        if (settling) return
        const drive = clockwiseImpulse(delta)
        if (drive > 0) {
          push(drive * SWIPE_GAIN)
          return
        }
        // Reverse drag: the drum does not follow; say so once per stroke,
        // for a moment (see REVERSE_HINT_SECONDS).
        reverseAccum += delta
        if (reverseAccum > REVERSE_HINT_RAD) {
          reverseAccum = -Infinity
          refuseWobble = 1
          reverseHintT = REVERSE_HINT_SECONDS
          syncOverlayForStep()
        }
      },
    })
    spinHandle.mount(hitLayer, {})
    handles.push(spinHandle)
    hitLayer.addEventListener('pointerup', onHitUp)
    actionBtn.addEventListener('click', onActionTap)

    gyroHandle = gestures.createGyro({
      bowBetaDeg: 60,
      holdMs: 600,
      fallbackTapSelector: '[data-gyro-fallback]',
      onHold: () => {
        if (step === 'still') completeScene()
      },
    })
    gyroHandle.mount(overlay, {})
    gyroHandle.setEnabled(false)
    handles.push(gyroHandle)
  }

  syncOverlayForStep()

  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => {
        if (!disposed) resize()
      })
      wireGestures()
      const initial = ctx.initialProgress ?? 0
      if (initial >= 1) goTurn()
      if (initial >= 2) goStill()
      if (initial >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      // Exponential drag + light friction: the drum coasts, then settles
      // (sooner once asked to stop).
      const drag = 0.55 + (settling ? SETTLE_DRAG : 0)
      speed = Math.max(0, speed * Math.exp(-dt * drag) - dt * 0.12)
      if (reduced) speed = Math.min(speed, 1.5)
      if (step === 'turn') {
        const early = turnT < SETTLE_AFTER_SECONDS
        turnT += dt
        if (speed < STILL_SPEED) goStill()
        else if (early && turnT >= SETTLE_AFTER_SECONDS) syncOverlayForStep()
      }
      if (reverseHintT > 0) {
        reverseHintT = Math.max(0, reverseHintT - dt)
        if (reverseHintT === 0) syncOverlayForStep()
      }
      main.drum.rotation.y += CLOCKWISE_FROM_ABOVE * speed * dt

      // Refused reverse push: a tiny shake, no rotation.
      refuseWobble = Math.max(0, refuseWobble - dt * 3)
      main.drum.position.x = reduced ? 0 : Math.sin(refuseWobble * 30) * 0.01 * refuseWobble

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
      stopResize()
      stopClaim()
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointerup', onHitUp)
      actionBtn.removeEventListener('click', onActionTap)
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
