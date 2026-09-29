import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addCelLights,
  CEL_STYLE,
  createChimeAudio,
  createMotes,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  markBackdrop,
  setSafeText,
} from '../procedural-kit'

type Step = 'pick' | 'hang' | 'wish' | 'done'

const STEP_ORDER: Step[] = ['pick', 'hang', 'wish']

const COPY = {
  title: '短册系竹',
  hintPick: '点按或拖起地上的纸条（练习）。',
  hintHang: '把纸条拖到竹枝上松开，或点按下方挂上。',
  hintWish: '可写一句短句，或点按下方静看片刻（练习，非法效）。',
  pickTap: '拾起纸条',
  hangTap: '挂到竹枝上',
  wishTap: '静看片刻',
  done: '纸条已随风轻摆（练习结束）。',
  stepsAria: '步骤',
} as const

// Soft but saturated washi: coral, mint, marigold, lavender, sakura.
const STRIP_COLORS = [0xf0876f, 0x74c3aa, 0xf6cc58, 0xa293de, 0xf5a0bd]

export function createTanzakuTanabata(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'pick'
  let disposed = false
  let started = false
  let restoring = true
  let sparkle = 0

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null
  const audio = createChimeAudio()

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.pickTap },
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
    hitLayer.style.pointerEvents = step === 'pick' || step === 'hang' ? 'auto' : 'none'
    if (step === 'pick') {
      setHint(COPY.hintPick)
      setSafeText(actionBtn, COPY.pickTap, assertSafeCopy)
    } else if (step === 'hang') {
      setHint(COPY.hintHang)
      setSafeText(actionBtn, COPY.hangTap, assertSafeCopy)
    } else if (step === 'wish') {
      setHint(COPY.hintWish)
      setSafeText(actionBtn, COPY.wishTap, assertSafeCopy)
    } else setHint(COPY.done)
  }

  // Cream night-sky: warm cream background, peach key, lavender rim and fill.
  const { renderer, scene } = createWarmStage(canvas, 0xf6ede1, 0.055)
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.9, 4.4)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.0, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'tanzaku-tanabata', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, { sky: 0xfff0dc, ground: 0xd9c2b0, key: 0xffd9ad, rim: 0xd8ccff })
  const fill = new THREE.PointLight(0xc8b4ff, 0.45, 8, 2)
  fill.position.set(-2, 2.2, 1)
  scene.add(fill)

  const world = new THREE.Group()
  scene.add(world)

  const ground = markBackdrop(new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 48),
    new THREE.MeshStandardMaterial({ color: 0xebdac0, roughness: 1 }),
  ))
  ground.rotation.x = -Math.PI / 2
  world.add(ground)

  // Procedural bamboo: segmented stalks with node rings and a few leaves.
  const bamboo = new THREE.Group()
  world.add(bamboo)
  // Flat, matte greens read as painted cel bands; darker nodes mark the rhythm.
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x9cc66e, roughness: 0.9 })
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x5f9147, roughness: 0.9 })
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x7fbc5c,
    roughness: 0.9,
    side: THREE.DoubleSide,
  })
  const segGeo = new THREE.CylinderGeometry(0.05, 0.056, 0.5, 16)
  const nodeGeo = new THREE.TorusGeometry(0.057, 0.014, 8, 20)
  // Slim lens-shaped blade instead of a flat rectangle: cleaner anime silhouette.
  const leafGeo = new THREE.CircleGeometry(0.17, 12).scale(1, 0.26, 1)
  const stalkXs = [-0.35, 0.05, 0.4]
  stalkXs.forEach((x, s) => {
    const segments = 5 + (s % 2)
    for (let i = 0; i < segments; i++) {
      const seg = new THREE.Mesh(segGeo, stalkMat)
      seg.position.set(x, 0.25 + i * 0.5, -0.2 + s * 0.12)
      bamboo.add(seg)
      const node = new THREE.Mesh(nodeGeo, nodeMat)
      node.rotation.x = Math.PI / 2
      node.position.set(x, 0.5 + i * 0.5, -0.2 + s * 0.12)
      bamboo.add(node)
      if (i >= 2) {
        const leaf = new THREE.Mesh(leafGeo, leafMat)
        const side = i % 2 === 0 ? 1 : -1
        leaf.position.set(x + side * 0.18, 0.5 + i * 0.5, -0.2 + s * 0.12)
        leaf.rotation.set(0.3, side * 0.4, side * -0.5)
        bamboo.add(leaf)
      }
    }
  })

  // Invisible catch zone around the upper bamboo (large, mobile-friendly target).
  const hangZone = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.8, 0.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  hangZone.position.set(0.02, 1.8, -0.05)
  world.add(hangZone)

  // Paper strips: a few already hanging + one loose on the ground.
  const stripGeo = new THREE.PlaneGeometry(0.12, 0.42)
  stripGeo.translate(0, -0.21, 0) // pivot at the top so it sways like paper on string
  const hangingStrips: THREE.Mesh[] = []
  const presetHangs = [
    new THREE.Vector3(-0.2, 2.3, 0.0),
    new THREE.Vector3(0.25, 2.0, 0.05),
    new THREE.Vector3(-0.5, 1.7, -0.1),
  ]
  presetHangs.forEach((p, i) => {
    const strip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshStandardMaterial({
        color: STRIP_COLORS[i % STRIP_COLORS.length],
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    )
    strip.position.copy(p)
    world.add(strip)
    hangingStrips.push(strip)
  })

  const looseMat = new THREE.MeshStandardMaterial({
    color: STRIP_COLORS[4],
    emissive: 0x6a2a3a,
    emissiveIntensity: 0.15,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })
  const loose = new THREE.Mesh(stripGeo, looseMat)
  const looseHome = new THREE.Vector3(1.15, 0.45, 1.0)
  const looseHangPos = new THREE.Vector3(0.45, 1.75, 0.12)
  loose.position.copy(looseHome)
  loose.rotation.z = 0.5
  world.add(loose)
  // Generous pick target around the loose strip.
  const pickZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  pickZone.position.set(looseHome.x, looseHome.y - 0.2, looseHome.z)
  world.add(pickZone)

  const motes = createMotes(70, 0xffc98a)
  world.add(motes)
  const moteMat = motes.material as THREE.PointsMaterial

  const sparkleLight = new THREE.PointLight(0xffd8a0, 0, 3, 2)
  sparkleLight.position.copy(looseHangPos)
  scene.add(sparkleLight)

  const dragTarget = looseHome.clone()
  let grabbed = false
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6)
  const hitPoint = new THREE.Vector3()

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    // Narrow portrait screens: back the camera off so the bamboo fits.
    const portraitBoost = camera.aspect < 0.8 ? (0.8 - camera.aspect) * 3 : 0
    cameraHome.z = 4.4 + portraitBoost
    camera.updateProjectionMatrix()
  }

  const raycastAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(pointerNdc, camera)
  }

  const bambooHitTest = (clientX: number, clientY: number) => {
    raycastAt(clientX, clientY)
    return raycaster.intersectObject(hangZone, false).length > 0
  }

  const moveStripTo = (clientX: number, clientY: number) => {
    raycastAt(clientX, clientY)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.set(
        THREE.MathUtils.clamp(hitPoint.x, -1.6, 1.6),
        THREE.MathUtils.clamp(hitPoint.y + 0.2, 0.3, 2.8),
        0.6,
      )
    }
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

  const goHang = () => {
    if (!canAct() || step !== 'pick') return
    step = 'hang'
    dragTarget.set(looseHome.x - 0.2, 0.9, 0.6)
    dragHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(1)
    syncOverlayForStep()
  }

  const goWish = () => {
    if (!canAct() || step !== 'hang') return
    step = 'wish'
    grabbed = false
    dragHandle?.setEnabled(false)
    dragTarget.copy(looseHangPos)
    looseMat.emissiveIntensity = 0.05
    wishHandle?.setEnabled(true)
    if (!restoring) {
      loose.rotation.z = 0.35
      sparkle = 1
      const reduced = ctx.isReducedMotion?.() ?? false
      audio.play({
        freqs: [1318.5, 1975.5, 2637],
        duration: reduced ? 0.35 : 0.9,
        gain: reduced ? 0.05 : 0.09,
      })
      ctx.onProgress?.(2)
    } else {
      loose.position.copy(looseHangPos)
      loose.rotation.z = 0
    }
    syncOverlayForStep()
  }

  const onActionTap = () => {
    if (disposed) return
    if (step === 'pick') goHang()
    else if (step === 'hang') goWish()
    else if (step === 'wish') completeScene()
  }

  // Registered before the drag handle so a press on the strip picks it up and
  // the same pointer keeps dragging (drag's pointerdown sees it enabled).
  const onHitDown = (e: PointerEvent) => {
    if (step !== 'pick') return
    raycastAt(e.clientX, e.clientY)
    if (raycaster.intersectObjects([pickZone, loose], false).length > 0) {
      goHang()
      grabbed = true
      moveStripTo(e.clientX, e.clientY)
    }
  }

  const onHitMove = (e: PointerEvent) => {
    if (step !== 'hang' || e.buttons === 0) return
    grabbed = true
    moveStripTo(e.clientX, e.clientY)
  }

  const onHitUp = () => {
    grabbed = false
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    dragHandle = gestures.createDrag({
      hitTest: bambooHitTest,
      onDrop: (hit) => {
        if (step !== 'hang') return
        grabbed = false
        if (hit) goWish()
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
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed) resize()
        })
        resizeObserver.observe(canvas.parentElement ?? canvas)
      }
      wireGestures()
      if ((ctx.initialProgress ?? 0) >= 1) goHang()
      if ((ctx.initialProgress ?? 0) >= 2) goWish()
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

      hangingStrips.forEach((s, i) => {
        s.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.12
        s.rotation.y = Math.sin(t * 0.7 + i) * 0.2
      })
      bamboo.rotation.z = Math.sin(t * 0.5) * 0.008
      motes.rotation.y += visualDt * 0.03

      const follow = reduced ? 1 : 1 - Math.exp(-dt * 12)
      if (step === 'hang') {
        loose.position.lerp(dragTarget, follow)
        loose.rotation.z = THREE.MathUtils.lerp(loose.rotation.z, 0, follow)
      } else if (step === 'wish' || step === 'done') {
        loose.position.lerp(looseHangPos, reduced ? 1 : 1 - Math.exp(-dt * 6))
        loose.rotation.z = THREE.MathUtils.lerp(
          loose.rotation.z,
          Math.sin(t * 1.5) * 0.14,
          reduced ? 1 : 1 - Math.exp(-dt * 3),
        )
      } else {
        looseMat.emissiveIntensity = 0.15 + Math.sin(t * 2.4) * 0.1
      }
      const scaleTarget = grabbed ? 1.2 : 1
      loose.scale.setScalar(
        THREE.MathUtils.lerp(loose.scale.x, scaleTarget, 1 - Math.exp(-dt * 12)),
      )

      // Hang burst: brighten motes + a brief warm glow at the strip.
      sparkle = Math.max(0, sparkle - dt * (reduced ? 3 : 0.8))
      moteMat.opacity = 0.55 + sparkle * 0.4
      moteMat.size = 0.03 + sparkle * 0.03
      sparkleLight.intensity = sparkle * 1.6

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.14) * 0.1,
        cameraHome.y + Math.sin(t * 0.1) * 0.04,
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
      hitLayer.removeEventListener('pointermove', onHitMove)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitUp)
      actionBtn.removeEventListener('pointerup', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      audio.dispose()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay')
    },
  }
}
