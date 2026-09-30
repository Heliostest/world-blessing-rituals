import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addCelLights,
  CEL_STYLE,
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

type Step = 'approach' | 'bow' | 'ema' | 'done'

const STEP_ORDER: Step[] = ['approach', 'bow', 'ema']

const COPY = {
  title: '庭前一礼',
  hintApproach: '向上轻滑或点按鸟居，走到它跟前（练习）。',
  hintWalking: '缓步走近…',
  hintBow: '在鸟居前停步，向下轻滑、竖起手机稍停，或点按下方，轻轻一礼（致敬，非真实参拜）。',
  hintBowing: '低头，再缓缓抬起…',
  hintEma: '可在木牌上写一句话，或点按下方静立片刻（练习，非法效）。',
  approachTap: '走到鸟居前',
  bowTap: '轻轻一礼',
  emaTap: '静立片刻',
  done: '庭前安静下来（练习结束，不替代真实参拜）。',
  stepsAria: '步骤',
} as const

const WALK_SECONDS = 1.8
const BOW_SECONDS = 2.4
const FAR_Z = 7.6
const NEAR_Z = 4.9
const SWIPE_PX = 40

/** Box bent upward toward both ends: the kasagi's lifted tips. */
function upswept(width: number, height: number, depth: number, lift: number) {
  const geo = new THREE.BoxGeometry(width, height, depth, 24, 1, 1)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = Math.abs(pos.getX(i)) / (width / 2)
    pos.setY(i, pos.getY(i) + lift * Math.pow(u, 2.6))
  }
  geo.computeVertexNormals()
  return geo
}

/** Five-sided wooden board (plain, no text or crest). */
function emaGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.1, -0.07)
  s.lineTo(0.1, -0.07)
  s.lineTo(0.1, 0.035)
  s.lineTo(0, 0.09)
  s.lineTo(-0.1, 0.035)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false })
}

export function createShintoTorii(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'approach'
  let disposed = false
  let started = false
  let restoring = true
  let walkT = 0
  let walking = false
  let bowT = 0
  let bowing = false
  let emaGlow = 0

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let gyroHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.approachTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui
  actionBtn.dataset.gyroFallback = ''
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = walking || bowing || step === 'done'
    wishSlot.hidden = step !== 'ema'
    hitLayer.style.pointerEvents =
      (step === 'approach' || step === 'bow') && !walking && !bowing ? 'auto' : 'none'
    if (step === 'approach') {
      setHint(walking ? COPY.hintWalking : COPY.hintApproach)
      setSafeText(actionBtn, COPY.approachTap, assertSafeCopy)
    } else if (step === 'bow') {
      setHint(bowing ? COPY.hintBowing : COPY.hintBow)
      setSafeText(actionBtn, COPY.bowTap, assertSafeCopy)
    } else if (step === 'ema') {
      setHint(COPY.hintEma)
      setSafeText(actionBtn, COPY.emaTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the cream page: clear morning key, pale sky rim on the vermilion.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const EYE_Y = 1.45
  // Extra distance on narrow portrait screens so both pillars stay in frame.
  let zBoost = 0
  camera.position.set(0, EYE_Y, FAR_Z)
  const cameraLookAt = new THREE.Vector3(0, 1.55, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'shinto-torii', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, {
    sky: 0xfff3e4,
    ground: 0xd8c4a8,
    key: 0xffe4c0,
    rim: 0xcfe4ff,
    keyIntensity: 1.35,
    keyPosition: [3, 5, 4],
  })

  const world = new THREE.Group()
  scene.add(world)

  // Myōjin-style torii: two pillars, nuki tie beam, shimaki + upswept kasagi.
  // Proportions are an art choice, not a survey of any one shrine.
  const torii = new THREE.Group()
  world.add(torii)
  const vermilion = new THREE.MeshStandardMaterial({ color: 0xe25a32, roughness: 0.9 })
  const ink = new THREE.MeshStandardMaterial({ color: 0x2f2a2a, roughness: 0.85 })
  const pillarGeo = new THREE.CylinderGeometry(0.1, 0.115, 2.4, 24)
  const baseGeo = new THREE.CylinderGeometry(0.135, 0.14, 0.26, 24)
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, vermilion)
    pillar.position.set(side * 0.92, 1.2, 0)
    pillar.rotation.z = side * 0.025 // slight inward lean
    torii.add(pillar)
    const base = new THREE.Mesh(baseGeo, ink)
    base.position.set(side * 0.935, 0.13, 0)
    torii.add(base)
  }
  const nuki = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.13, 0.1, 2, 0.02), vermilion)
  nuki.position.y = 1.86
  torii.add(nuki)
  const gakuzuka = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.3, 0.09, 2, 0.015), vermilion)
  gakuzuka.position.y = 2.07
  torii.add(gakuzuka)
  const shimaki = new THREE.Mesh(new RoundedBoxGeometry(2.62, 0.12, 0.17, 2, 0.02), vermilion)
  shimaki.position.y = 2.28
  torii.add(shimaki)
  const kasagi = new THREE.Mesh(upswept(3.0, 0.13, 0.2, 0.13), vermilion)
  kasagi.position.y = 2.41
  torii.add(kasagi)
  const kasagiTop = new THREE.Mesh(upswept(3.12, 0.055, 0.25, 0.15), ink)
  kasagiTop.position.y = 2.5
  torii.add(kasagiTop)

  // A few approach-path stones (参道) mark entrance → path; no hall is modelled.
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcfc5b6, roughness: 0.95 })
  const stoneGeo = new RoundedBoxGeometry(0.72, 0.05, 0.42, 2, 0.02)
  for (let i = 0; i < 6; i++) {
    const stone = new THREE.Mesh(stoneGeo, stoneMat)
    stone.position.set((i % 2 ? 0.03 : -0.03), 0.025, 3.2 - i * 0.62)
    world.add(stone)
  }

  // Plain ema rack to the right, past the torii.
  const rack = new THREE.Group()
  rack.position.set(1.95, 0, -1.1)
  rack.rotation.y = -0.5
  world.add(rack)
  const rackWood = new THREE.MeshStandardMaterial({ color: 0x8e6444, roughness: 0.95 })
  for (const x of [-0.45, 0.45]) {
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.06, 1.3, 0.06, 2, 0.015), rackWood)
    post.position.set(x, 0.65, 0)
    rack.add(post)
  }
  for (const y of [1.2, 0.9]) {
    const bar = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.04, 0.05, 2, 0.012), rackWood)
    bar.position.set(0, y, 0)
    rack.add(bar)
  }
  const emaGeo = emaGeometry()
  const emaMat = new THREE.MeshStandardMaterial({ color: 0xe8cda2, roughness: 0.9 })
  const emaSpots: [number, number][] = [
    [-0.3, 1.1], [-0.08, 1.1], [0.2, 1.1], [-0.2, 0.8], [0.3, 0.8],
  ]
  const emas: THREE.Mesh[] = []
  for (const [x, y] of emaSpots) {
    const ema = new THREE.Mesh(emaGeo, emaMat)
    ema.position.set(x, y, 0.03)
    rack.add(ema)
    emas.push(ema)
  }
  // The visitor's own board: appears on the rack once written.
  const ownEmaMat = new THREE.MeshStandardMaterial({
    color: 0xf0d8ae,
    emissive: 0xffb060,
    emissiveIntensity: 0,
    roughness: 0.9,
  })
  const ownEma = new THREE.Mesh(emaGeo, ownEmaMat)
  ownEma.position.set(0.05, 0.8, 0.05)
  ownEma.visible = false
  rack.add(ownEma)

  const toriiZone = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.6, 0.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  toriiZone.position.set(0, 1.3, 0)
  world.add(toriiZone)

  const pointer = createPointerRay(canvas, camera)

  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    zBoost = portraitBoost(aspect, 4)
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()

  const completeScene = () => {
    if (!canAct() || step === 'done') return
    step = 'done'
    dragHandle?.setEnabled(false)
    gyroHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goEma = () => {
    if (!canAct() || step !== 'bow') return
    step = 'ema'
    bowing = false
    bowT = 1
    dragHandle?.setEnabled(false)
    gyroHandle?.setEnabled(false)
    wishHandle?.setEnabled(true)
    if (!restoring) {
      // Quiet, low round tone as the head lifts again.
      fx.impact({ freqs: [293.66, 440], duration: 1.2, gain: 0.06 })
      ctx.onProgress?.(2)
    }
    syncOverlayForStep()
  }

  const startBow = () => {
    if (!canAct() || step !== 'bow' || bowing) return
    bowing = true
    bowT = 0
    gyroHandle?.setEnabled(false)
    syncOverlayForStep()
    if (ctx.isReducedMotion?.() ?? false) goEma()
  }

  const goBow = () => {
    if (!canAct() || step !== 'approach') return
    step = 'bow'
    walking = false
    walkT = 1
    gyroHandle?.setEnabled(true)
    if (!restoring) {
      fx.impact({ freqs: [440, 660], duration: 0.3, gain: 0.035, type: 'triangle' })
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
  }

  const startWalk = () => {
    if (!canAct() || step !== 'approach' || walking) return
    walking = true
    walkT = 0
    syncOverlayForStep()
    if (ctx.isReducedMotion?.() ?? false) goBow()
  }

  const leaveEma = () => {
    ownEma.visible = true
    emaGlow = 1
    fx.impact({ freqs: [660, 990], duration: 0.3, gain: 0.04, type: 'triangle' })
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'approach') startWalk()
    else if (step === 'bow') startBow()
    else if (step === 'ema') completeScene()
  }

  let downX = 0
  let downY = 0
  const onHitDown = (e: PointerEvent) => {
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
  }
  const onHitUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && step === 'approach' && pointer.hits(e.clientX, e.clientY, [toriiZone])) {
      startWalk()
    }
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    // Swipe up = step forward; swipe down = lower the head.
    dragHandle = gestures.createDrag({
      hitTest: (_x, y) =>
        step === 'approach' ? downY - y > SWIPE_PX : step === 'bow' && y - downY > SWIPE_PX,
      onDrop: (hit) => {
        if (!hit) return
        if (step === 'approach') startWalk()
        else if (step === 'bow') startBow()
      },
    })
    dragHandle.mount(hitLayer, {})
    handles.push(dragHandle)
    hitLayer.addEventListener('pointerup', onHitUp)
    actionBtn.addEventListener('pointerup', onActionTap)

    // Device motion can also start the bow; without sensors the tap button stands in.
    gyroHandle = gestures.createGyro({
      // Near-upright and held: a deliberate raise, not the usual reading angle.
      bowBetaDeg: 60,
      holdMs: 600,
      fallbackTapSelector: '[data-gyro-fallback]',
      onHold: () => startBow(),
    })
    gyroHandle.mount(overlay, {})
    gyroHandle.setEnabled(false)
    handles.push(gyroHandle)

    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      onSubmit: () => {
        if (step !== 'ema') return
        leaveEma()
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
      stopResize = observeCanvasResize(canvas, () => {
        if (!disposed) resize()
      })
      wireGestures()
      const initial = ctx.initialProgress ?? 0
      if (initial >= 1) goBow()
      if (initial >= 2) goEma()
      if (initial >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      if (walking) {
        walkT = Math.min(1, walkT + dt / WALK_SECONDS)
        if (walkT >= 1) goBow()
      }
      if (bowing) {
        bowT = Math.min(1, bowT + dt / BOW_SECONDS)
        if (bowT >= 1) goEma()
      }

      // Walk: ease the camera from the path's start to just before the torii,
      // with a faint step bob.
      const w = walkT * walkT * (3 - 2 * walkT)
      const z = THREE.MathUtils.lerp(FAR_Z, NEAR_Z, w) + zBoost
      const bob = walking && !reduced ? Math.abs(Math.sin(walkT * Math.PI * 4)) * 0.025 : 0

      // Bow (一礼): pitch down and back up in one slow arc; no clapping sequence.
      const bowArc = bowing ? Math.sin(Math.PI * bowT) : 0
      const pitch = bowArc * bowArc * (3 - 2 * bowArc)
      camera.position.set(
        Math.sin(t * 0.12) * 0.06,
        EYE_Y + bob - pitch * 0.18,
        z - pitch * 0.12,
      )
      cameraLookAt.set(0, 1.55 - pitch * 1.6, 0)
      camera.lookAt(cameraLookAt)

      // The rack's boards stir a little in the breeze.
      emas.forEach((ema, i) => {
        ema.rotation.z = reduced ? 0 : Math.sin(t * 1.3 + i * 1.9) * 0.06
      })
      emaGlow = Math.max(0, emaGlow - dt * (reduced ? 3 : 0.6))
      ownEmaMat.emissiveIntensity = emaGlow * 0.6
      ownEma.rotation.z = reduced ? 0 : Math.sin(t * 1.5) * 0.08

      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopResize()
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointerup', onHitUp)
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
