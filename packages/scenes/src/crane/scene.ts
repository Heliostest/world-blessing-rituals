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
import { FORM_COUNT } from './fold-kinematics'
import { createOrigamiSheet } from './origami-sheet'

type Step = 'fold' | 'lift' | 'wish' | 'done'

const STEP_ORDER: Step[] = ['fold', 'lift', 'wish']

const COPY = {
  title: '折一只纸鹤',
  hintFold: '点按纸面折一下（按纸鹤传统折序简化为四步的练习，非完整教程）。',
  fold1: '收成方形底（1/4），再点按继续。',
  fold2: '拉长成鸟形底（2/4），再点按继续。',
  fold3: '折起颈与尾（3/4），再点按翻出鹤首、展开双翼。',
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

const FOLD_COUNT = FORM_COUNT - 1
/** Seconds per fold, by the form it folds into. */
const FOLD_SECONDS = [0, 1.6, 2.2, 2.9, 2.3] as const
const REST_Y = 0.9
const LIFT_Y = 1.3

/**
 * How each form faces the camera, in the sheet's bird-base axes (right, up,
 * front): the flat square lies back like paper on a table, the bases stand
 * up, the crane turns three-quarters with its head toward the viewer and
 * leans its back toward the camera, so the spread wings show their faces
 * instead of their edges. `size` is the form's larger side on screen (world
 * units), small enough for a portrait phone.
 */
const VIEWS: readonly { tilt: number; yaw: number; size: number }[] = [
  { tilt: 1.02, yaw: 0, size: 1.2 },
  { tilt: 0.18, yaw: -0.18, size: 1.2 },
  { tilt: 0.12, yaw: -0.22, size: 1.55 },
  { tilt: 0.1, yaw: 0.42, size: 1.4 },
  { tilt: -0.5, yaw: 0.8, size: 1.0 },
]

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export function createCrane(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'fold'
  let disposed = false
  let started = false
  let restoring = true
  // Form the paper is folding toward and the progress of that fold (1 = at rest).
  let form = 0
  let foldK = 1
  let posed = ''
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

  // One square of paper folded along explicit creases (see fold-kinematics).
  const sheet = createOrigamiSheet()
  // `paper` carries the lift; `holder` turns and scales the sheet for each form;
  // `sheet.object` is shifted so the folded paper sits on the holder's origin.
  const paper = new THREE.Group()
  paper.position.set(0, REST_Y, 0)
  world.add(paper)
  const holder = new THREE.Group()
  paper.add(holder)
  holder.add(sheet.object)

  // Rest framing of every form: orientation, then scale and centre from its
  // bounds as the camera sees them (turned to the view; the flat square's
  // diagonal, not its side, spans the screen).
  const birdAxes = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-1, 1, 0).normalize(),
    new THREE.Vector3(-1, -1, 0).normalize(),
    new THREE.Vector3(0, 0, 1),
  )
  const birdToWorld = new THREE.Quaternion().setFromRotationMatrix(birdAxes).invert()
  const box = new THREE.Box3()
  const frames = VIEWS.map((view, f) => {
    sheet.pose(f, 1)
    const q = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(-view.tilt, view.yaw, 0, 'YXZ'))
      .multiply(birdToWorld)
    sheet.bounds(box, q)
    const size = box.getSize(new THREE.Vector3())
    return {
      q,
      scale: view.size / Math.max(size.x, size.y),
      centre: box.getCenter(new THREE.Vector3()).applyQuaternion(q.clone().invert()),
    }
  })
  sheet.pose(0, 1)
  const centre = new THREE.Vector3()

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

  /** One fold of the sequence; a tap mid-fold finishes the fold under way first. */
  const foldOnce = () => {
    if (!canAct() || step !== 'fold' || form >= FOLD_COUNT) return
    form += 1
    foldK = restoring || (ctx.isReducedMotion?.() ?? false) ? 1 : 0
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

      // Fold: advance the tap and pose the sheet from its crease angles.
      if (foldK < 1) foldK = reduced ? 1 : Math.min(1, foldK + dt / FOLD_SECONDS[form])
      const key = `${form}:${foldK}`
      if (key !== posed) {
        sheet.pose(form, foldK)
        posed = key
      }
      // Turn, scale and centre between the two forms' rest framings.
      const from = frames[foldK < 1 ? form - 1 : form]
      const to = frames[form]
      const e = smooth(foldK)
      holder.quaternion.slerpQuaternions(from.q, to.q, e)
      holder.scale.setScalar(THREE.MathUtils.lerp(from.scale, to.scale, e))
      sheet.object.position.copy(centre.lerpVectors(from.centre, to.centre, e)).negate()

      // Lift: drag follows the pointer, then settles at the raised perch.
      if (step === 'lift') {
        const follow = reduced ? 1 : 1 - Math.exp(-dt * 10)
        paper.position.lerp(dragTarget, follow)
      } else if (step === 'wish' || step === 'done') {
        liftT = reduced ? 1 : Math.min(1, liftT + dt / 1.2)
        const lift = liftT * liftT * (3 - 2 * liftT)
        paper.position.set(0, THREE.MathUtils.lerp(REST_Y, LIFT_Y, lift) + Math.sin(t * 1.4) * 0.03, 0)
      } else {
        paper.position.set(0, REST_Y + Math.sin(t * 1.1) * 0.015, 0)
      }
      // A slow idle turn, so the folded layers catch the light.
      paper.rotation.y = reduced ? 0 : Math.sin(t * 0.4) * 0.1
      const lifted = step === 'wish' || step === 'done' ? liftT : 0
      glow.intensity = lifted * 0.9
      sheet.setGlow(lifted * 0.1)
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
