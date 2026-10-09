import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights,
  CEL_STYLE,
  claimObjectTouches,
  createLampHalo,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  setSafeText,
} from '../procedural-kit'

type Step = 'ready' | 'rise' | 'rest' | 'done'

const STEP_ORDER: Step[] = ['ready', 'rise', 'rest']

const COPY = {
  title: '燃灯上浮',
  hintReady: '点按莲灯，或向上轻推（练习）。',
  hintRise: '莲灯缓缓上浮…',
  hintRest: '灯光停在高处，点按下方结束（练习，非法效）。',
  pushTap: '轻推莲灯',
  restTap: '静看片刻',
  done: '莲灯静静亮着（练习结束）。',
  stepsAria: '步骤',
} as const

const RISE_SECONDS = 3.2
const LOW_Y = 0.45
const HIGH_Y = 2.3
/** The lanterns' paper glow; on the night stage they glow brighter. */
const SHELL_GLOW = 0.35
const SHELL_GLOW_NIGHT = 0.6

type Lantern = {
  group: THREE.Group
  light: THREE.PointLight
  shellMat: THREE.MeshStandardMaterial
  /** Night stage only: the warm glow round the lantern. */
  halo: ReturnType<typeof createLampHalo> | null
}

/** Lotus paper lantern: ring of petals around a glowing core. */
function buildLantern(
  petalGeo: THREE.BufferGeometry,
  coreGeo: THREE.BufferGeometry,
  color: number,
  lightIntensity: number,
  night: boolean,
): Lantern {
  const group = new THREE.Group()
  const shellMat = new THREE.MeshStandardMaterial({
    color,
    emissive: 0xffa060,
    emissiveIntensity: night ? SHELL_GLOW_NIGHT : SHELL_GLOW,
    roughness: 0.9,
    side: THREE.DoubleSide,
  })
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xfbe4cf,
    emissive: 0xff9a70,
    emissiveIntensity: night ? 0.4 : 0.2,
    roughness: 0.9,
    side: THREE.DoubleSide,
  })
  for (let row = 0; row < 2; row++) {
    const count = row === 0 ? 8 : 6
    for (let i = 0; i < count; i++) {
      const petal = new THREE.Mesh(petalGeo, row === 0 ? shellMat : tipMat)
      const a = (i / count) * Math.PI * 2 + row * 0.3
      const r = row === 0 ? 0.2 : 0.12
      petal.position.set(Math.cos(a) * r, 0.06 + row * 0.08, Math.sin(a) * r)
      petal.rotation.set(0, -a + Math.PI / 2, 0)
      petal.rotateX(row === 0 ? -0.55 : -0.25)
      group.add(petal)
    }
  }
  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshStandardMaterial({
      color: 0xfff1c8,
      emissive: 0xffc070,
      emissiveIntensity: 1.1,
      roughness: 0.4,
    }),
  )
  core.position.y = 0.1
  group.add(core)
  const light = new THREE.PointLight(0xffb070, lightIntensity, 3.5, 2)
  light.position.y = 0.15
  group.add(light)
  const halo = night ? createLampHalo(0xffa860, 1.25) : null
  if (halo) {
    halo.sprite.position.y = 0.12
    group.add(halo.sprite)
  }
  return { group, light, shellMat, halo }
}

export function createYeondeunghoe(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'ready'
  let disposed = false
  let started = false
  let restoring = true
  let riseT = 0

  const handles: GestureHandle[] = []
  let pushHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.pushTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = step === 'rise' || step === 'done'
    hitLayer.style.pointerEvents = step === 'ready' ? 'auto' : 'none'
    if (step === 'ready') {
      setHint(COPY.hintReady)
      setSafeText(actionBtn, COPY.pushTap, assertSafeCopy)
    } else if (step === 'rise') setHint(COPY.hintRise)
    else if (step === 'rest') {
      setHint(COPY.hintRest)
      setSafeText(actionBtn, COPY.restTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Transparent over the host's stage; lotus-pink accents on the lanterns.
  // The App shows this scene on its night stage, where it takes the moonlit
  // rig and the lanterns' own glow, lights and halos carry the warmth: lit
  // lamps on a dark sky, not pale paper cut-outs.
  const night = ctx.stage === 'night'
  const glowScale = night ? 1.5 : 1
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.5, 4.6)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.2, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'yeondeunghoe', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  // By day, a dusk rig: amber key from the upper left, rose-lilac rim behind
  // the lanterns.
  addStageLights(scene, ctx.stage, {
    sky: 0xffeadb,
    ground: 0xd4b4a4,
    key: 0xffcf9e,
    rim: 0xf2c4e0,
    keyIntensity: 1.15,
    keyPosition: [-2, 4, 3],
  })

  const world = new THREE.Group()
  scene.add(world)

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xcaa580, roughness: 0.95 })
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 40), plinthMat)
  plinth.position.y = 0.15
  world.add(plinth)
  // Rounded lip: a lit cel band along the top edge, like a bevel.
  const plinthLip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 8, 48), plinthMat)
  plinthLip.rotation.x = Math.PI / 2
  plinthLip.position.y = 0.3
  world.add(plinthLip)

  const petalGeo = new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI, 0, Math.PI / 2)
  petalGeo.scale(1, 1.6, 0.5)
  const coreGeo = new THREE.SphereGeometry(0.09, 16, 12)

  const main = buildLantern(petalGeo, coreGeo, 0xf5a4b8, 0.6 * glowScale, night)
  main.group.position.set(0, LOW_Y, 0)
  world.add(main.group)

  // Distant companion lanterns already drifting high.
  const companions: Lantern[] = []
  const companionSpots = [
    [-1.6, 2.6, -1.8],
    [1.4, 2.9, -2.2],
    [-0.7, 3.2, -3.0],
    [2.2, 2.2, -1.2],
  ]
  companionSpots.forEach(([x, y, z], i) => {
    const l = buildLantern(petalGeo, coreGeo, i % 2 ? 0xf8c795 : 0xf1adc6, night ? 0.5 : 0.25, night)
    l.group.position.set(x, y, z)
    l.group.scale.setScalar(0.7)
    world.add(l.group)
    companions.push(l)
  })

  // Big invisible hit sphere for easy mobile taps.
  const tapZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  tapZone.position.set(0, LOW_Y + 0.1, 0)
  world.add(tapZone)

  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    const portraitBoost = camera.aspect < 0.8 ? (0.8 - camera.aspect) * 3 : 0
    cameraHome.z = 4.6 + portraitBoost
    camera.updateProjectionMatrix()
  }

  const lanternHitTest = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(pointerNdc, camera)
    return raycaster.intersectObject(tapZone, false).length > 0
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()

  const completeScene = () => {
    if (!canAct() || step === 'done') return
    step = 'done'
    pushHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goRest = () => {
    if (!canAct() || step !== 'rise') return
    step = 'rest'
    riseT = 1
    if (!restoring) ctx.onProgress?.(2)
    syncOverlayForStep()
  }

  const goRise = () => {
    if (!canAct() || step !== 'ready') return
    step = 'rise'
    riseT = 0
    pushHandle?.setEnabled(false)
    if (!restoring) {
      // Soft warm lantern tone: low, round partials with a slow fade.
      const reduced = ctx.isReducedMotion?.() ?? false
      fx.impact({
        freqs: [523.25, 784, 1046.5],
        duration: reduced ? 0.5 : 1.4,
        gain: reduced ? 0.05 : 0.08,
      })
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
    // Reduced motion: no float animation, snap straight to the resting height.
    if (!restoring && (ctx.isReducedMotion?.() ?? false)) goRest()
  }

  const onActionTap = () => {
    if (disposed) return
    fx.prepare()
    if (step === 'ready') goRise()
    else if (step === 'rest') completeScene()
  }

  let downX = 0
  let downY = 0
  const onHitDown = (e: PointerEvent) => {
    if (step === 'ready') fx.prepare()
    downX = e.clientX
    downY = e.clientY
  }
  const onHitUp = (e: PointerEvent) => {
    if (step !== 'ready') return
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 12 && lanternHitTest(e.clientX, e.clientY)) goRise()
  }

  const wireGestures = () => {
    // Upward push: a vertical drag of ~40px that starts on the lantern;
    // elsewhere on the stage a swipe scrolls the page.
    stopClaim = claimObjectTouches(hitLayer, lanternHitTest)
    pushHandle = gestures.createTilt({
      startsOn: lanternHitTest,
      pourAngleDeg: 40,
      holdMs: 0,
      onPour: () => {
        if (step !== 'ready') return
        goRise()
      },
    })
    pushHandle.mount(hitLayer, {})
    handles.push(pushHandle)

    hitLayer.addEventListener('pointerdown', onHitDown)
    hitLayer.addEventListener('pointerup', onHitUp)
    actionBtn.addEventListener('click', onActionTap)
  }

  syncOverlayForStep()

  const setLanternY = (y: number) => {
    main.group.position.y = y
    tapZone.position.y = y + 0.1
  }

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
      if ((ctx.initialProgress ?? 0) >= 1) goRise()
      if ((ctx.initialProgress ?? 0) >= 2) goRest()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001
      const visualDt = reduced ? 0 : dt

      if (step === 'rise') {
        riseT = reduced ? 1 : Math.min(1, riseT + dt / RISE_SECONDS)
        if (riseT >= 1) goRest()
      }
      const eased = riseT * riseT * (3 - 2 * riseT)
      const baseY = step === 'ready' ? LOW_Y : THREE.MathUtils.lerp(LOW_Y, HIGH_Y, eased)
      setLanternY(baseY + Math.sin(t * 1.2) * (step === 'ready' ? 0.02 : 0.05))
      main.group.rotation.y += visualDt * 0.25
      main.group.position.x = step === 'ready' ? 0 : Math.sin(t * 0.6) * 0.08 * eased

      // Warm bloom grows as the lantern rises; pulses once resting.
      const glowBase = step === 'ready' ? 0.6 : 0.6 + eased * 1.4
      const pulse = step === 'rest' || step === 'done' ? Math.sin(t * 2.2) * 0.35 : 0
      main.light.intensity = (glowBase + pulse) * glowScale
      main.shellMat.emissiveIntensity =
        (night ? SHELL_GLOW_NIGHT : SHELL_GLOW) + eased * 0.35 + pulse * 0.2
      if (main.halo) main.halo.material.opacity = 0.35 + eased * 0.45 + pulse * 0.15

      companions.forEach((l, i) => {
        if (l.halo) l.halo.material.opacity = 0.4 + Math.sin(t * 1.3 + i * 1.7) * 0.06
        const [x, y, z] = companionSpots[i]
        l.group.position.set(x + Math.sin(t * 0.3 + i) * 0.1, y + Math.sin(t * 0.8 + i * 2) * 0.08, z)
        l.group.rotation.y += visualDt * 0.15
      })

      // Camera tilts up to follow the lantern.
      const lookY = THREE.MathUtils.lerp(1.0, 1.9, eased)
      cameraLookAt.y = lookY
      camera.position.set(
        cameraHome.x + Math.sin(t * 0.12) * 0.1,
        cameraHome.y + eased * 0.3,
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
      for (const l of [main, ...companions]) l.halo?.dispose()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
