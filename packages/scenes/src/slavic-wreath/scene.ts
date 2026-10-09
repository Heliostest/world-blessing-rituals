import * as THREE from 'three'
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

type Step = 'weave' | 'place' | 'drift' | 'done'

const STEP_ORDER: Step[] = ['weave', 'place', 'drift']

const COPY = {
  title: '火边花环',
  hintWeave: '点按花环，把草茎与野花编成一圈（练习）。',
  hintWeaving: '草茎一圈圈交叠…',
  hintPlace: '把花环向下拖到水面，或点按下方轻轻放下。',
  hintDrift: '可写一句祝愿，或点按下方目送它漂远（练习，不以花环预测命运）。',
  weaveTap: '编一圈',
  placeTap: '放上水面',
  driftTap: '目送远去',
  done: '花环载着心意缓缓漂远（练习结束）。',
  stepsAria: '步骤',
} as const

const WEAVE_SECONDS = 2.4
/** Share of the stems already twisted before weaving: something to tap. */
const LOOSE_STEMS = 0.3
const WREATH_R = 0.3
const HOLD_POS = new THREE.Vector3(0, 0.95, 1.1)
const WATER_POS = new THREE.Vector3(0, 0, 0.35)
const RIVER_W = 3.4
const RIVER_L = 28
const RIVER_Z = -10

/** Gentle layered swell; shared by the water mesh and the floating wreath. */
const waveHeight = (x: number, z: number, t: number) =>
  Math.sin(x * 1.7 + t * 0.9) * 0.018 + Math.sin(z * 1.3 - t * 1.2) * 0.022

/** Strand that winds around the wreath ring `turns` times: reads as woven stems. */
class WovenStrand extends THREE.Curve<THREE.Vector3> {
  private phase: number
  private turns: number
  private wrap: number
  constructor(phase: number, turns: number, wrap: number) {
    super()
    this.phase = phase
    this.turns = turns
    this.wrap = wrap
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const a = u * Math.PI * 2
    const w = a * this.turns + this.phase
    const r = WREATH_R + Math.cos(w) * this.wrap
    return target.set(Math.cos(a) * r, Math.sin(w) * this.wrap, Math.sin(a) * r)
  }
}

export function createSlavicWreath(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'weave'
  let disposed = false
  let started = false
  let restoring = true
  let weaving = false
  let weaveT = 0
  let placeT = 0
  let drift = 0
  let ripple = 0
  let grabbed = false

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.weaveTap },
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
    actionBtn.hidden = weaving || step === 'done'
    wishSlot.hidden = step !== 'drift'
    hitLayer.style.pointerEvents =
      (step === 'weave' && !weaving) || step === 'place' ? 'auto' : 'none'
    if (step === 'weave') {
      setHint(weaving ? COPY.hintWeaving : COPY.hintWeave)
      setSafeText(actionBtn, COPY.weaveTap, assertSafeCopy)
    } else if (step === 'place') {
      setHint(COPY.hintPlace)
      setSafeText(actionBtn, COPY.placeTap, assertSafeCopy)
    } else if (step === 'drift') {
      setHint(COPY.hintDrift)
      setSafeText(actionBtn, COPY.driftTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the island stage: midsummer dusk — amber key from the far
  // bonfire side, lilac rim, soft sky bounce.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.55, 3.1)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 0.45, -0.4)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'slavic-wreath', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, {
    sky: 0xfff0e0,
    ground: 0xcdb8a0,
    key: 0xffcf98,
    rim: 0xe0d0ff,
    keyIntensity: 1.2,
    keyPosition: [-2.5, 3.5, -2],
  })

  const world = new THREE.Group()
  scene.add(world)

  // Slow river: flat-faceted swell whose sides and far end fade into the page.
  const waterGeo = new THREE.PlaneGeometry(RIVER_W, RIVER_L, 18, 56)
  waterGeo.rotateX(-Math.PI / 2)
  waterGeo.translate(0, 0, RIVER_Z)
  const waterPos = waterGeo.attributes.position
  const waterBase = Float32Array.from(waterPos.array as ArrayLike<number>)
  const waterColors = new Float32Array(waterPos.count * 4)
  const shallow = new THREE.Color(0xa8dade)
  const deep = new THREE.Color(0x7ab4c6)
  const c = new THREE.Color()
  for (let i = 0; i < waterPos.count; i++) {
    const x = waterPos.getX(i)
    const z = waterPos.getZ(i)
    const side = 1 - Math.pow(Math.abs(x) / (RIVER_W / 2), 3)
    const near = THREE.MathUtils.clamp((z - (RIVER_Z + RIVER_L / 2)) / -1.2, 0, 1)
    const far = THREE.MathUtils.clamp((z - (RIVER_Z - RIVER_L / 2)) / 10, 0, 1)
    c.copy(shallow).lerp(deep, Math.abs(x) < 0.8 ? 0.6 : 0.2)
    waterColors.set([c.r, c.g, c.b, Math.max(0, side) * near * far * 0.8], i * 4)
  }
  waterGeo.setAttribute('color', new THREE.BufferAttribute(waterColors, 4))
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      roughness: 0.3,
      metalness: 0.05,
      flatShading: true,
    }),
  )
  // Large backdrop: keep it out of the ink selection.
  water.userData.toonSurface = { outline: false }
  world.add(water)

  // Reeds along both banks.
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x7ea156, roughness: 0.9 })
  const reedGeo = new THREE.ConeGeometry(0.018, 0.7, 5)
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1
    const z = 1.6 - Math.floor(i / 2) * 1.1
    for (let j = 0; j < 3; j++) {
      const reed = new THREE.Mesh(reedGeo, reedMat)
      const h = 0.7 + ((i * 7 + j * 3) % 5) * 0.08
      reed.scale.y = h / 0.7
      reed.position.set(side * (RIVER_W / 2 - 0.15 + j * 0.07), (0.35 * h) / 0.7, z + j * 0.09)
      reed.rotation.z = side * (0.08 + j * 0.05)
      world.add(reed)
    }
  }

  // Distant bonfire on the far left bank: mood light only, no play mechanic.
  const fire = new THREE.Group()
  fire.position.set(-2.1, 0, -7.5)
  world.add(fire)
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x9aa865, roughness: 0.95 }),
  )
  mound.scale.y = 0.25
  fire.add(mound)
  const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.95 })
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), logMat)
    const a = (i / 4) * Math.PI * 2
    log.position.set(Math.cos(a) * 0.1, 0.4, Math.sin(a) * 0.1)
    log.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)
    fire.add(log)
  }
  const flameMats = [0xffb24a, 0xffd36e].map(
    (color) =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 1 }),
  )
  const flames: THREE.Mesh[] = []
  ;[
    [0, 0.34, 0.62],
    [0.08, 0.2, 0.42],
    [-0.08, 0.2, 0.46],
  ].forEach(([x, r, h], i) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, h, 10), flameMats[i ? 1 : 0])
    flame.position.set(x, 0.3 + h / 2, 0)
    fire.add(flame)
    flames.push(flame)
  })
  const fireLight = new THREE.PointLight(0xff9a50, 3, 14, 1.6)
  fireLight.position.set(0, 0.9, 0.3)
  fire.add(fireLight)

  // The wreath: three woven stem strands, leaves and a mix of wildflowers.
  const wreath = new THREE.Group()
  wreath.position.copy(HOLD_POS)
  wreath.rotation.x = 0.45
  world.add(wreath)
  const strands: THREE.Mesh[] = []
  ;[0x6f9f4a, 0x86b35a, 0x5d8a3e].forEach((color, i) => {
    const strand = new THREE.Mesh(
      new THREE.TubeGeometry(new WovenStrand((i / 3) * Math.PI * 2, 9, 0.028), 180, 0.016, 5, true),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    )
    wreath.add(strand)
    strands.push(strand)
  })
  const setWeave = (k: number) => {
    for (const s of strands) {
      const total = s.geometry.index!.count
      s.geometry.setDrawRange(0, Math.floor((total * k) / 3) * 3)
    }
  }

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x80b95c,
    roughness: 0.9,
    side: THREE.DoubleSide,
  })
  const leafGeo = new THREE.CircleGeometry(0.06, 10).scale(1, 0.38, 1)
  const blooms: { obj: THREE.Object3D; at: number }[] = []
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1
    const leaf = new THREE.Mesh(leafGeo, leafMat)
    const r = WREATH_R + (i % 2 ? 0.04 : -0.035)
    leaf.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r)
    leaf.rotation.set(-Math.PI / 2 + (i % 3) * 0.3, 0, -a + Math.PI / 2)
    wreath.add(leaf)
    blooms.push({ obj: leaf, at: 0.35 + (i / 18) * 0.3 })
  }

  const daisyPetalGeo = new THREE.CircleGeometry(0.022, 8).scale(1, 0.4, 1).translate(0.028, 0, 0)
  const petalWhite = new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.9, side: THREE.DoubleSide })
  const centerYellow = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.8 })
  const poppyRed = new THREE.MeshStandardMaterial({ color: 0xe0503c, roughness: 0.85, side: THREE.DoubleSide })
  const cornflowerBlue = new THREE.MeshStandardMaterial({ color: 0x6f8fe0, roughness: 0.85 })
  const centerGeo = new THREE.SphereGeometry(0.018, 10, 8)
  const poppyGeo = new THREE.SphereGeometry(0.045, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2)
  const cornGeo = new THREE.ConeGeometry(0.012, 0.045, 6)

  const daisy = () => {
    const g = new THREE.Group()
    for (let p = 0; p < 9; p++) {
      const petal = new THREE.Mesh(daisyPetalGeo, petalWhite)
      petal.rotation.set(-Math.PI / 2, 0, (p / 9) * Math.PI * 2)
      g.add(petal)
    }
    const center = new THREE.Mesh(centerGeo, centerYellow)
    center.scale.y = 0.6
    g.add(center)
    return g
  }
  const poppy = () => {
    const g = new THREE.Group()
    const cup = new THREE.Mesh(poppyGeo, poppyRed)
    cup.rotation.x = Math.PI
    cup.position.y = 0.035
    g.add(cup)
    const center = new THREE.Mesh(centerGeo, new THREE.MeshStandardMaterial({ color: 0x3a2a2a }))
    center.scale.setScalar(0.7)
    center.position.y = 0.03
    g.add(center)
    return g
  }
  const cornflower = () => {
    const g = new THREE.Group()
    for (let p = 0; p < 7; p++) {
      const floret = new THREE.Mesh(cornGeo, cornflowerBlue)
      const a = (p / 7) * Math.PI * 2
      floret.position.set(Math.cos(a) * 0.018, 0.02, Math.sin(a) * 0.018)
      floret.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8)
      g.add(floret)
    }
    return g
  }
  const makers = [daisy, poppy, cornflower, daisy, cornflower, poppy, daisy, daisy, cornflower, poppy, daisy]
  makers.forEach((make, i) => {
    const flower = make()
    const a = (i / makers.length) * Math.PI * 2 + 0.25
    const r = WREATH_R + ((i * 5) % 3 - 1) * 0.02
    flower.position.set(Math.cos(a) * r, 0.035, Math.sin(a) * r)
    flower.rotation.y = i * 1.3
    flower.scale.setScalar(0.9 + ((i * 3) % 4) * 0.12)
    flower.userData.size = flower.scale.x
    wreath.add(flower)
    blooms.push({ obj: flower, at: 0.6 + (i / makers.length) * 0.35 })
  })
  for (const b of blooms) if (b.obj.userData.size === undefined) b.obj.userData.size = 1

  // Expanding ripple rings when the wreath touches the water.
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  const ripples = [0, 1, 2].map(() => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 48), rippleMat)
    ring.rotation.x = Math.PI / 2
    ring.position.copy(WATER_POS).setY(0.03)
    world.add(ring)
    return ring
  })

  const wreathZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  world.add(wreathZone)

  const pointer = createPointerRay(canvas, camera)
  /** Taps and drags that start on the wreath are the scene's; elsewhere the page scrolls. */
  const onWreath = (x: number, y: number) => pointer.hits(x, y, [wreathZone])
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HOLD_POS.z)
  const hitPoint = new THREE.Vector3()
  const dragTarget = HOLD_POS.clone()

  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.1 + portraitBoost(aspect, 3)
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

  const goDrift = () => {
    if (!canAct() || step !== 'place') return
    step = 'drift'
    grabbed = false
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(true)
    placeT = restoring || (ctx.isReducedMotion?.() ?? false) ? 1 : 0
    if (!restoring) {
      ripple = 1
      // Soft water touch: low round tones with a slow fade.
      fx.impact({ freqs: [349.23, 523.25, 698.46], duration: 1.2, gain: 0.06 })
      ctx.onProgress?.(2)
    }
    syncOverlayForStep()
  }

  const goPlace = () => {
    if (!canAct() || step !== 'weave') return
    step = 'place'
    weaving = false
    weaveT = 1
    dragHandle?.setEnabled(true)
    if (!restoring) {
      fx.impact({ freqs: [784, 1174.66], duration: 0.4, gain: 0.04, type: 'triangle' })
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
  }

  const startWeave = () => {
    if (!canAct() || step !== 'weave' || weaving) return
    weaving = true
    weaveT = 0
    syncOverlayForStep()
    if (ctx.isReducedMotion?.() ?? false) goPlace()
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'weave') startWeave()
    else if (step === 'place') goDrift()
    else if (step === 'drift') completeScene()
  }

  let downX = 0
  let downY = 0
  const onHitDown = (e: PointerEvent) => {
    fx.prepare()
    downX = e.clientX
    downY = e.clientY
    if (step === 'place' && onWreath(e.clientX, e.clientY)) grabbed = true
  }
  const onHitMove = (e: PointerEvent) => {
    if (step !== 'place' || !grabbed || e.buttons === 0) return
    if (pointer.aim(e.clientX, e.clientY).ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.set(
        THREE.MathUtils.clamp(hitPoint.x, -1, 1),
        THREE.MathUtils.clamp(hitPoint.y, 0.2, 1.3),
        HOLD_POS.z,
      )
    }
  }
  const onHitUp = (e: PointerEvent) => {
    if (step !== 'weave') return
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && onWreath(e.clientX, e.clientY)) startWeave()
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    stopClaim = claimObjectTouches(hitLayer, onWreath)
    dragHandle = gestures.createDrag({
      startsOn: onWreath,
      // Carried down toward the water (the river fills the lower screen).
      hitTest: (_x, y) => grabbed && y - downY > 40,
      onDrop: (hit) => {
        if (step !== 'place') return
        if (hit) goDrift()
        else dragTarget.copy(HOLD_POS)
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
        if (step !== 'drift' || !canAct()) return
        ctx.saveWish?.(text)
        completeScene()
      },
    })
    wishHandle.mount(wishSlot, {})
    wishHandle.setEnabled(false)
    handles.push(wishHandle)
  }

  setWeave(LOOSE_STEMS)
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
      if (initial >= 1) goPlace()
      if (initial >= 2) goDrift()
      if (initial >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      // Water swell (skipped entirely with reduced motion after the first frame).
      if (!reduced || dt === 0) {
        for (let i = 0; i < waterPos.count; i++) {
          waterPos.setY(i, waterBase[i * 3 + 1] + waveHeight(waterBase[i * 3], waterBase[i * 3 + 2], t))
        }
        waterPos.needsUpdate = true
      }

      // Weave: strands wind in, then leaves and flowers open one by one.
      if (weaving) {
        weaveT = Math.min(1, weaveT + dt / WEAVE_SECONDS)
        if (weaveT >= 1) goPlace()
      }
      setWeave(LOOSE_STEMS + (1 - LOOSE_STEMS) * Math.min(1, weaveT / 0.55))
      for (const b of blooms) {
        const k = THREE.MathUtils.clamp((weaveT - b.at) / 0.08, 0, 1)
        b.obj.visible = k > 0
        b.obj.scale.setScalar(Math.max(0.001, b.obj.userData.size * k * (1 + Math.sin(k * Math.PI) * 0.25)))
      }

      const follow = reduced ? 1 : 1 - Math.exp(-dt * 8)
      if (step === 'weave') {
        wreath.position.copy(HOLD_POS).setY(HOLD_POS.y + Math.sin(t * 1.1) * 0.015)
        wreath.rotation.y += reduced ? 0 : dt * (weaving ? 0.9 : 0.15)
      } else if (step === 'place') {
        wreath.position.lerp(grabbed ? dragTarget : HOLD_POS, follow)
      } else {
        // Settle onto the water, then drift slowly downstream on the swell.
        placeT = Math.min(1, placeT + dt / 1.1)
        const e = placeT * placeT * (3 - 2 * placeT)
        drift += reduced ? 0 : dt * 0.22 * e
        const z = WATER_POS.z - drift
        const x = WATER_POS.x + Math.sin(drift * 0.6) * 0.25
        const floatY = waveHeight(x, z, t) + 0.02
        wreath.position.set(
          THREE.MathUtils.lerp(HOLD_POS.x, x, e),
          THREE.MathUtils.lerp(HOLD_POS.y, floatY, e),
          THREE.MathUtils.lerp(HOLD_POS.z, z, e),
        )
        wreath.rotation.x = THREE.MathUtils.lerp(0.45, Math.sin(t * 1.2) * 0.05, e)
        wreath.rotation.y += reduced ? 0 : dt * 0.12
        // Well downstream: gently fade out of view by shrinking.
        wreath.scale.setScalar(THREE.MathUtils.clamp(1 - (drift - 9) / 4, 0.001, 1))
      }
      wreathZone.position.copy(wreath.position)

      ripple = Math.max(0, ripple - dt * (reduced ? 3 : 0.45))
      rippleMat.opacity = ripple * 0.55
      ripples.forEach((ring, i) => {
        const k = THREE.MathUtils.clamp(1 - ripple - i * 0.15, 0, 1)
        ring.scale.setScalar(0.3 + k * (1.1 + i * 0.3))
        ring.visible = ripple > 0.01
      })

      // Distant fire flicker.
      flames.forEach((f, i) => {
        const s = reduced ? 1 : 1 + Math.sin(t * (6 + i * 1.7) + i) * 0.1 + Math.sin(t * 11 + i * 2) * 0.05
        f.scale.set(1, s, 1)
      })
      fireLight.intensity = reduced ? 3 : 3 + Math.sin(t * 7.1) * 0.4 + Math.sin(t * 12.3) * 0.2

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
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
