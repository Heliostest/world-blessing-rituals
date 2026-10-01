import * as THREE from 'three'
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
import { createOrigamiSheet } from './origami-sheet'

type Step = 'fold' | 'lift' | 'wish' | 'done'

const STEP_ORDER: Step[] = ['fold', 'lift', 'wish']

const COPY = {
  title: '折一只纸鹤',
  hintFold: '点按纸面折一下（折纸意象练习，非完整教程）。',
  fold1: '收成方形底（1/4），再点按继续。',
  fold2: '拉长成鸟形底（2/4），再点按继续。',
  fold3: '折起颈与尾（3/4），再点按继续。',
  hintLift: '纸鹤折好了。向上拖起它，或点按下方托起。',
  hintWish: '可写一句想送给自己或他人的话，或点按下方静看片刻（练习，非法效）。',
  foldTap: '折一下',
  liftTap: '托起纸鹤',
  wishTap: '静看片刻',
  done: '纸鹤静静停在眼前（练习结束）。',
  stepsAria: '步骤',
} as const

/** Hints shown after each of the first three folds; the fourth ends the step. */
const FOLD_HINTS = [COPY.hintFold, COPY.fold1, COPY.fold2, COPY.fold3] as const

const FOLD_COUNT = 4
const FOLD_SECONDS = 0.55
const REST_Y = 0.9
const LIFT_Y = 1.3

export function createCrane(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'fold'
  let disposed = false
  let started = false
  let restoring = true
  // Paper form 0..4 and the fold transition from the previous form.
  let form = 0
  let prevForm = 0
  let foldT = 1
  let liftT = 0
  let grabbed = false

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.foldTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = step === 'done'
    wishSlot.hidden = step !== 'wish'
    hitLayer.style.pointerEvents = step === 'fold' || step === 'lift' ? 'auto' : 'none'
    if (step === 'fold') {
      setHint(FOLD_HINTS[Math.min(form, FOLD_HINTS.length - 1)])
      setSafeText(actionBtn, COPY.foldTap, assertSafeCopy)
    } else if (step === 'lift') {
      setHint(COPY.hintLift)
      setSafeText(actionBtn, COPY.liftTap, assertSafeCopy)
    } else if (step === 'wish') {
      setHint(COPY.hintWish)
      setSafeText(actionBtn, COPY.wishTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the cream page: morning key, soft rim along the paper edges.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.75, 2.6)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.0, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'crane', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, {
    sky: 0xfff6e6,
    ground: 0xd6c8ae,
    key: 0xffe6c0,
    rim: 0xb8d4e8,
    keyIntensity: 1.55,
    keyPosition: [1.5, 4, 2.5],
  })
  const glow = new THREE.PointLight(0xffe2b0, 0, 2.5, 2)
  glow.position.set(0, 1.5, 0.6)
  scene.add(glow)

  const world = new THREE.Group()
  scene.add(world)

  // Single crease-driven washi sheet (not body/wing/neck prop soup).
  const sheet = createOrigamiSheet()
  // `paper` carries lift; `holder` gives the 3/4 yaw and gentle idle turn.
  const paper = new THREE.Group()
  paper.position.set(0, REST_Y, 0)
  world.add(paper)
  const holder = new THREE.Group()
  holder.rotation.y = -0.55
  // Scale so the unit sheet / folded crane fills the product frame.
  holder.scale.setScalar(1.55)
  paper.add(holder)
  holder.add(sheet.mesh)

  // Init flat pose; plausibility checked once (clamps are silent at runtime).
  sheet.setFold(0, 0, 1)

  // Generous invisible tap target around the paper.
  const tapZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  paper.add(tapZone)

  const pointer = createPointerRay(canvas, camera)
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const hitPoint = new THREE.Vector3()
  const dragTarget = new THREE.Vector3(0, REST_Y, 0)
  let downY = 0

  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 2.6 + portraitBoost(aspect, 4.5)
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()

  const completeScene = () => {
    if (!canAct() || step === 'done') return
    step = 'done'
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goWish = () => {
    if (!canAct() || step !== 'lift') return
    step = 'wish'
    grabbed = false
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(true)
    if (!restoring) {
      const reduced = ctx.isReducedMotion?.() ?? false
      fx.impact({ freqs: [659.25, 987.77, 1318.5], duration: reduced ? 0.4 : 1.0, gain: 0.07 })
      ctx.onProgress?.(2)
    } else liftT = 1
    syncOverlayForStep()
  }

  const goLift = () => {
    if (!canAct() || step !== 'fold') return
    step = 'lift'
    dragHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(1)
    syncOverlayForStep()
  }

  /** One fold performance stage; the fourth finishes the crane. */
  const foldOnce = () => {
    if (!canAct() || step !== 'fold' || form >= FOLD_COUNT) return
    prevForm = form
    form += 1
    foldT = restoring || (ctx.isReducedMotion?.() ?? false) ? 1 : 0
    if (!restoring) {
      // Soft paper crease: short, airy triangle tones.
      fx.impact({ freqs: [880, 1320], duration: 0.2, gain: 0.035, type: 'triangle' })
    }
    if (form >= FOLD_COUNT) goLift()
    else syncOverlayForStep()
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'fold') foldOnce()
    else if (step === 'lift') goWish()
    else if (step === 'wish') completeScene()
  }

  let downX = 0
  const onHitDown = (e: PointerEvent) => {
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
    if (step === 'lift' && pointer.hits(e.clientX, e.clientY, [tapZone])) grabbed = true
  }
  const onHitMove = (e: PointerEvent) => {
    if (step !== 'lift' || !grabbed || e.buttons === 0) return
    if (pointer.aim(e.clientX, e.clientY).ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.set(
        THREE.MathUtils.clamp(hitPoint.x, -0.8, 0.8),
        THREE.MathUtils.clamp(hitPoint.y, REST_Y - 0.2, LIFT_Y + 0.3),
        0,
      )
    }
  }
  const onHitUp = (e: PointerEvent) => {
    grabbed = false
    if (step !== 'fold') return
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && pointer.hits(e.clientX, e.clientY, [tapZone])) foldOnce()
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    // Lift: a drag released well above where it began carries the crane up.
    dragHandle = gestures.createDrag({
      hitTest: (_x, y) => downY - y > 40,
      onDrop: (hit) => {
        if (step !== 'lift') return
        grabbed = false
        if (hit) goWish()
        else dragTarget.set(0, REST_Y, 0)
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onHitMove)
    hitLayer.addEventListener('pointerup', onHitUp)
    hitLayer.addEventListener('pointercancel', onHitUp)
    actionBtn.addEventListener('pointerup', onActionTap)

    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      onSubmit: () => {
        if (step !== 'wish') return
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
      if (initial >= 1) for (let i = 0; i < FOLD_COUNT; i++) foldOnce()
      if (initial >= 2) goWish()
      if (initial >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      foldT = Math.min(1, foldT + dt / FOLD_SECONDS)
      const k = foldT * foldT * (3 - 2 * foldT)
      // Drive the single sheet by crease-angle keyframes (prev → form).
      sheet.setFold(prevForm, form, k)

      // Mild wing breathe on the finished pose via a tiny holder rock (geometry
      // already has wing crease angles; avoid a second fake wing mesh).
      const spread = form >= 4 ? (prevForm >= 3 ? k : 1) : 0
      const flap = reduced ? 0 : Math.sin(t * 2.2) * 0.04 * spread
      sheet.mesh.rotation.z = flap

      // Lift: drag follows the pointer, then settles at the raised perch.
      if (step === 'lift') {
        const follow = reduced ? 1 : 1 - Math.exp(-dt * 10)
        paper.position.lerp(dragTarget, follow)
      } else if (step === 'wish' || step === 'done') {
        liftT = reduced ? 1 : Math.min(1, liftT + dt / 1.2)
        const e = liftT * liftT * (3 - 2 * liftT)
        paper.position.set(0, THREE.MathUtils.lerp(REST_Y, LIFT_Y, e) + Math.sin(t * 1.4) * 0.03, 0)
      } else {
        paper.position.set(0, REST_Y + Math.sin(t * 1.1) * 0.015, 0)
      }
      holder.rotation.y = -0.55 + (reduced ? 0 : Math.sin(t * 0.4) * 0.12)
      // Tip the folded bird slightly toward the camera so wings/neck read.
      holder.rotation.x = THREE.MathUtils.lerp(0.12, 0.32, spread)
      const lifted = step === 'wish' || step === 'done' ? liftT : 0
      glow.intensity = lifted * 0.9
      sheet.material.emissiveIntensity = 0.06 + lifted * 0.1
      const grabScale = grabbed ? 1.08 : 1
      paper.scale.setScalar(THREE.MathUtils.lerp(paper.scale.x, grabScale, 1 - Math.exp(-dt * 12)))

      cameraLookAt.y = THREE.MathUtils.lerp(1.0, 1.25, lifted)
      camera.position.set(
        cameraHome.x + Math.sin(t * 0.13) * 0.08,
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
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointermove', onHitMove)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitUp)
      actionBtn.removeEventListener('pointerup', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      fx.dispose()
      sheet.dispose()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--cream')
    },
  }
}
