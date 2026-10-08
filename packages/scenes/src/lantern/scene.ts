import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights,
  CEL_STYLE,
  claimObjectTouches,
  createLampHalo,
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

type Step = 'light' | 'wish' | 'rest' | 'done'

const STEP_ORDER: Step[] = ['light', 'wish', 'rest']

const COPY = {
  title: '月下一灯',
  hintLight: '点按灯笼，把它慢慢点亮（练习）。',
  hintWish: '可写一句心愿，或把木牌拖到灯下挂好。',
  hintRest: '灯留在眼前，点按下方结束（练习，非法效）。',
  lightTap: '点亮灯笼',
  hangTap: '挂上愿望牌',
  restTap: '静看片刻',
  done: '灯光柔和地亮着（练习结束）。',
  stepsAria: '步骤',
} as const

const LIGHT_SECONDS = 1.6
const LANTERN_Y = 1.45
const LANTERN_HALF_H = 0.34
const Z_AXIS = new THREE.Vector3(0, 0, 1)

/** Barrel profile of the paper shade: radius at height `y` (−H..H). */
const shadeRadius = (y: number) => 0.2 + 0.1 * Math.cos((y / LANTERN_HALF_H) * (Math.PI / 2))

export function createLantern(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'light'
  let disposed = false
  let started = false
  let restoring = true
  let litT = 0
  let lit = false
  let swingVel = 0
  let swing = 0
  let grabbed = false
  let hung = false

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.lightTap },
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
    hitLayer.style.pointerEvents = step === 'light' || step === 'wish' ? 'auto' : 'none'
    if (step === 'light') {
      setHint(COPY.hintLight)
      setSafeText(actionBtn, COPY.lightTap, assertSafeCopy)
    } else if (step === 'wish') {
      setHint(COPY.hintWish)
      setSafeText(actionBtn, COPY.hangTap, assertSafeCopy)
    } else if (step === 'rest') {
      setHint(COPY.hintRest)
      setSafeText(actionBtn, COPY.restTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the host's stage. By day: honey key, peach rim and the
  // lantern's own glow. The App shows this scene on its night stage, where it
  // takes the moonlit rig and the lit lantern (glow, shade and halo, all
  // brighter) is the one warm light, catching the frame near it.
  const night = ctx.stage === 'night'
  const litPeak = night
    ? { glow: 3.2, shade: 1.05, halo: 0.75 }
    : { glow: 2.2, shade: 0.7, halo: 0 }
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0.2, 1.3, 4.1)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.0, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'lantern', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addStageLights(scene, ctx.stage, {
    sky: 0xfff0dc,
    ground: 0xd8bea0,
    key: 0xffd6a4,
    rim: 0xffd2c0,
    keyIntensity: 1.2,
    keyPosition: [-2, 4, 3],
  })

  const world = new THREE.Group()
  scene.add(world)

  // Wooden stand: two posts, a top beam and feet — a product-original frame.
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9b6a45, roughness: 0.95 })
  const postGeo = new RoundedBoxGeometry(0.08, 2.3, 0.08, 2, 0.02)
  const footGeo = new RoundedBoxGeometry(0.12, 0.07, 0.55, 2, 0.02)
  for (const x of [-0.62, 0.62]) {
    const post = new THREE.Mesh(postGeo, woodMat)
    post.position.set(x, 1.15, 0)
    world.add(post)
    const foot = new THREE.Mesh(footGeo, woodMat)
    foot.position.set(x, 0.035, 0)
    world.add(foot)
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.09, 0.12, 2, 0.025), woodMat)
  beam.position.set(0, 2.27, 0)
  world.add(beam)

  // Lantern pivots from the beam so it and the plaque can sway together.
  const pivot = new THREE.Group()
  pivot.position.set(0, 2.22, 0)
  world.add(pivot)
  const cordMat = new THREE.MeshStandardMaterial({ color: 0xc8453a, roughness: 0.95 })
  const cordLen = 2.22 - (LANTERN_Y + LANTERN_HALF_H + 0.04)
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, cordLen, 6), cordMat)
  cord.position.y = -cordLen / 2
  pivot.add(cord)

  const lantern = new THREE.Group()
  lantern.position.y = LANTERN_Y - 2.22
  pivot.add(lantern)

  // Paper shade: barrel lathe; warm-yellow washi that glows from within.
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const y = -LANTERN_HALF_H + (i / 16) * LANTERN_HALF_H * 2
    profile.push(new THREE.Vector2(shadeRadius(y), y))
  }
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf0c464,
    emissive: 0xff9530,
    emissiveIntensity: 0.04,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })
  lantern.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), shadeMat))

  // Thin bamboo ribs ring the shade, drawn as crisp ink bands.
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xc48d45, roughness: 0.9 })
  for (let i = 1; i < 8; i++) {
    const y = -LANTERN_HALF_H + (i / 8) * LANTERN_HALF_H * 2
    const rib = new THREE.Mesh(new THREE.TorusGeometry(shadeRadius(y) + 0.003, 0.005, 6, 40), ribMat)
    rib.rotation.x = Math.PI / 2
    rib.position.y = y
    lantern.add(rib)
  }
  // Dark lacquered top and bottom rims hold the shade.
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.85 })
  for (const y of [-LANTERN_HALF_H - 0.02, LANTERN_HALF_H + 0.02]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.05, 32), rimMat)
    rim.position.y = y
    lantern.add(rim)
  }
  const glow = new THREE.PointLight(0xffbe6a, 0, night ? 5 : 4, 2)
  lantern.add(glow)
  const halo = night ? createLampHalo(0xffb45e, 1.9) : null
  if (halo) lantern.add(halo.sprite)

  // Wish plaque: rests at the stand's foot, then hangs under the lantern.
  const plaque = new THREE.Group()
  world.add(plaque)
  const plaqueMat = new THREE.MeshStandardMaterial({
    color: 0xe8c89a,
    emissive: 0x6a4020,
    emissiveIntensity: 0.12,
    roughness: 0.9,
  })
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.28, 0.025, 2, 0.01), plaqueMat)
  board.position.y = -0.2
  plaque.add(board)
  const plaqueCord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6), cordMat)
  plaqueCord.position.y = -0.03
  plaque.add(plaqueCord)
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 8), cordMat)
  tassel.position.y = -0.38
  plaque.add(tassel)
  const plaqueHome = new THREE.Vector3(0.34, 0.42, 0.3)
  const plaqueHung = new THREE.Vector3(0, LANTERN_Y - LANTERN_HALF_H - 0.05, 0)
  plaque.position.copy(plaqueHome)
  plaque.rotation.z = -0.25

  const lanternZone = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  lanternZone.position.set(0, LANTERN_Y, 0)
  world.add(lanternZone)
  const plaqueZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  plaqueZone.position.set(plaqueHome.x, plaqueHome.y - 0.2, plaqueHome.z)
  world.add(plaqueZone)

  const pointer = createPointerRay(canvas, camera)
  const onPlaque = (x: number, y: number) => pointer.hits(x, y, [plaqueZone, board])
  /** Taps on the lantern, then drags of the plaque, are the scene's; elsewhere the page scrolls. */
  const onObject = (x: number, y: number) =>
    step === 'light' ? pointer.hits(x, y, [lanternZone]) : onPlaque(x, y)
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3)
  const hitPoint = new THREE.Vector3()
  const dragTarget = plaqueHome.clone()
  const hangPos = new THREE.Vector3()

  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 4.1 + portraitBoost(aspect, 3)
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

  const goRest = () => {
    if (!canAct() || step !== 'wish') return
    step = 'rest'
    grabbed = false
    hung = true
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) {
      swingVel += (ctx.isReducedMotion?.() ?? false) ? 0.1 : 0.9
      // Small wooden knock as the plaque meets the lantern.
      fx.impact({ freqs: [660, 990], duration: 0.3, gain: 0.05, type: 'triangle' })
      ctx.onProgress?.(2)
    } else plaque.position.copy(plaqueHung)
    syncOverlayForStep()
  }

  const goWish = () => {
    if (!canAct() || step !== 'light') return
    step = 'wish'
    lit = true
    dragHandle?.setEnabled(true)
    wishHandle?.setEnabled(true)
    if (!restoring) {
      const reduced = ctx.isReducedMotion?.() ?? false
      if (reduced) litT = 1
      fx.impact({ freqs: [392, 587.33, 784], duration: reduced ? 0.5 : 1.4, gain: 0.07 })
      ctx.onProgress?.(1)
    } else litT = 1
    syncOverlayForStep()
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'light') goWish()
    else if (step === 'wish') goRest()
    else if (step === 'rest') completeScene()
  }

  let downX = 0
  let downY = 0
  const onHitDown = (e: PointerEvent) => {
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
    if (step === 'wish' && onPlaque(e.clientX, e.clientY)) grabbed = true
  }
  const onHitMove = (e: PointerEvent) => {
    if (step !== 'wish' || !grabbed || e.buttons === 0) return
    if (pointer.aim(e.clientX, e.clientY).ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.set(
        THREE.MathUtils.clamp(hitPoint.x, -1, 1),
        THREE.MathUtils.clamp(hitPoint.y + 0.15, 0.3, 2.1),
        0.3,
      )
    }
  }
  const onHitUp = (e: PointerEvent) => {
    if (step !== 'light') return
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && pointer.hits(e.clientX, e.clientY, [lanternZone])) goWish()
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    stopClaim = claimObjectTouches(hitLayer, onObject)
    dragHandle = gestures.createDrag({
      startsOn: onPlaque,
      hitTest: (x, y) => grabbed && pointer.hits(x, y, [lanternZone]),
      onDrop: (hit) => {
        if (step !== 'wish') return
        if (hit) goRest()
        else dragTarget.copy(plaqueHome)
        grabbed = false
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onHitMove)
    hitLayer.addEventListener('pointerup', onHitUp)
    actionBtn.addEventListener('click', onActionTap)

    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      saves: ctx.saveWish !== undefined,
      onSubmit: (text) => {
        if (step !== 'wish' || !canAct()) return
        ctx.saveWish?.(text)
        goRest()
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
      if (initial >= 1) goWish()
      if (initial >= 2) goRest()
      if (initial >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      // Dark → warm: the shade fills with light after the tap.
      if (lit) litT = reduced ? 1 : Math.min(1, litT + dt / LIGHT_SECONDS)
      const e = litT * litT * (3 - 2 * litT)
      const flicker = reduced ? 0 : Math.sin(t * 7.3) * 0.04 + Math.sin(t * 3.1) * 0.03
      glow.intensity = e * (litPeak.glow + flicker * 4)
      shadeMat.emissiveIntensity = 0.04 + e * (litPeak.shade + flicker)
      if (halo) halo.material.opacity = e * (litPeak.halo + flicker * 2)

      // Damped pendulum: breeze sway plus the nudge when the plaque is hung.
      const breeze = reduced ? 0 : Math.sin(t * 0.8) * 0.02
      swingVel += (-(swing - breeze) * 10 - swingVel * (reduced ? 6 : 1.6)) * dt
      swing += swingVel * dt
      pivot.rotation.z = swing

      const follow = reduced ? 1 : 1 - Math.exp(-dt * 10)
      if (hung) {
        // Hang the plaque from the lantern's bottom rim, lagging the sway.
        hangPos.copy(plaqueHung).sub(pivot.position).applyAxisAngle(Z_AXIS, swing)
        plaque.position.lerp(hangPos.add(pivot.position), follow)
        plaque.rotation.z = THREE.MathUtils.lerp(
          plaque.rotation.z,
          swing * 1.6 + (reduced ? 0 : Math.sin(t * 1.6) * 0.08),
          follow,
        )
      } else if (step === 'wish') {
        plaque.position.lerp(grabbed ? dragTarget : plaqueHome, follow)
        plaque.rotation.z = THREE.MathUtils.lerp(plaque.rotation.z, grabbed ? 0 : -0.25, follow)
        plaqueMat.emissiveIntensity = 0.12 + (reduced ? 0 : Math.sin(t * 2.4) * 0.08)
      }

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
      hitLayer.removeEventListener('pointermove', onHitMove)
      hitLayer.removeEventListener('pointerup', onHitUp)
      actionBtn.removeEventListener('click', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      fx.dispose()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      halo?.dispose()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--cream')
    },
  }
}
