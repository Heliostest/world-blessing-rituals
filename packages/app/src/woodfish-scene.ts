import * as THREE from "three";
import { DEFAULT_PARAMETERS, type RenderStyleId } from "@wbr/content";
import type { SceneEngine, SceneMountOptions } from "@wbr/scene-runtime";
import type { WoodfishContext, WoodfishController } from "./scene-engines";
import { animate, createTimeline } from "animejs";
import { swingPose } from "./woodfish-motion";
import { parseWoodfishModel } from "./woodfish-model";
import { createDebugRenderStyle } from "@wbr/scene-runtime/debug-render-style";

type Options = WoodfishContext & SceneMountOptions;
export const woodfishEngine: SceneEngine<WoodfishContext, WoodfishController> =
  {
    create: (host, context, options) =>
      createWoodfishScene(host, { ...context, ...options }),
  };
/** Owned by one mounted ritual. No application state or reward logic lives here. */
export function createWoodfishScene(host: HTMLDivElement, options: Options) {
  let shaderFailed = false;
  let parameters = DEFAULT_PARAMETERS;
  let sound: AudioBuffer | undefined;
  let confirm: (() => Promise<void>) | undefined;
  let releaseContent: (() => Promise<void>) | undefined;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.debug.onShaderError = () => {
    shaderFailed = true;
  };
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.2, 2.2, 1.6, -1.6, 0.1, 40);
  const target = new THREE.Vector3(0.08, 0.02, 0);
  camera.position.set(0.9, 2.3, 6.5);
  camera.lookAt(target);
  let selectedStyle: RenderStyleId = "original";
  // Warm room bounce with a dominant upper-left lamp; keep the cavity shaded.
  scene.add(new THREE.HemisphereLight(0xffecd4, 0x795039, 1.55));
  const key = new THREE.DirectionalLight(0xffdfae, 3.2);
  key.position.set(-3.5, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -3,
    right: 3,
    top: 3,
    bottom: -3,
    near: 0.5,
    far: 14,
  });
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.005;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffead4, 0.65);
  fill.position.set(4, 2, 1);
  scene.add(fill);
  // A faint amber backlight outlines the wood.
  const rim = new THREE.DirectionalLight(0xffc486, 0.9);
  rim.position.set(2, 3, -4);
  scene.add(rim);
  // Fill light must also be occluded by the carved shell; otherwise the
  // chamber looks like a painted shallow dent. Smaller maps suffice here.
  for (const light of [fill, rim]) {
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    Object.assign(light.shadow.camera, {
      left: -2,
      right: 2,
      top: 2,
      bottom: -2,
      near: 0.5,
      far: 14,
    });
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.005;
    light.shadow.radius = 3;
  }
  const model = new THREE.Group();
  scene.add(model);
  const bodyGroup = new THREE.Group();
  model.add(bodyGroup);
  const mallet = new THREE.Group();
  model.add(mallet);
  mallet.position.set(1.02, 0.38, 1.24);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let modelAsset: Awaited<ReturnType<typeof parseWoodfishModel>> | null = null;
  let disposed = false,
    active = options.active,
    reducedMotion = options.reducedMotion;
  let frame = 0;
  let followAnimation: ReturnType<typeof animate> | null = null;
  let strikeAnimation: ReturnType<typeof createTimeline> | null = null;
  let bodyMesh: THREE.Mesh | null = null;
  const raycaster = new THREE.Raycaster();
  const aim = { x: 0.6, y: 0.45 };
  const hoverTarget = mallet.position.clone();
  let following = false;
  type StrikeTarget = { point: THREE.Vector3; normal: THREE.Vector3 };
  const strikes: StrikeTarget[] = [];
  const inspectMode = new URLSearchParams(window.location.search).has(
    "inspectWoodfish",
  );
  let phase = "idle";
  let needsStillFrame = false,
    loaded = false,
    reportedReady = false;
  let angle = 0,
    view = "front";
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D,
  ) {
    geometries.push(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.008 });
  materials.push(floorMaterial);
  const floor = mesh(new THREE.PlaneGeometry(200, 200), floorMaterial, scene);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.94;
  floor.castShadow = false;
  // A soft, local contact shadow, independent of directional shadow resolution.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, "rgba(73,39,12,0.30)");
  gradient.addColorStop(0.5, "rgba(73,39,12,0.15)");
  gradient.addColorStop(1, "rgba(73,39,12,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  textures.push(shadowTexture);
  const contactMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
  });
  materials.push(contactMaterial);
  const contact = mesh(
    new THREE.PlaneGeometry(3.0, 1.95),
    contactMaterial,
    scene,
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(-0.12, -0.925, 0);
  contact.castShadow = false;

  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: options.sceneId ?? "woodfish", label: "木鱼", invalidate: () => requestRender(true),
  });

  options.content
    .load(
      async (pack, bytes, soundBytes) => {
        const asset = await parseWoodfishModel(bytes, pack.bindings);
        const previousStyle = selectedStyle;
        try {
          const decoded = soundBytes
            ? await options.decodeSound(soundBytes)
            : undefined;
          if (disposed) throw Error("Scene disposed");
          parameters = pack.parameters;
          renderer.toneMappingExposure = parameters.exposure;
          key.intensity = parameters.keyIntensity;
          fill.intensity = parameters.fillIntensity;
          rim.intensity = parameters.rimIntensity;
          bodyGroup.add(asset.body);
          // Painted toy palette for toon presets; original GLB/PBR maps remain intact.
          asset.body.userData.toonSurface = { color: 0xc49a6c, simplifyMap: true, aoIntensity: 0.32 };
          asset.mallet.userData.toonSurface = { color: 0xa97549, simplifyMap: true, aoIntensity: 0.25 };
          bodyGroup.position.y = -0.91;
          asset.body.position.y = 0.91;
          mallet.add(asset.mallet);
          shaderFailed = false;
          renderer.compile(scene, camera);
          // Three reports linking failures on first use, not necessarily compile().
          // Exercise a real frame inside candidate initialization so a bad remote
          // material can still fall back to the last known good 3D pack.
          renderer.render(scene, camera);
          if (shaderFailed) throw Error("Scene shader failed");
          styleRenderer.setStyle(pack.renderStyle);
          styleRenderer.render();
          if (shaderFailed) throw Error("Scene shader failed");
          selectedStyle = pack.renderStyle;
          return { asset, decoded };
        } catch (error) {
          bodyGroup.remove(asset.body);
          mallet.remove(asset.mallet);
          asset.dispose();
          shaderFailed = false;
          styleRenderer.setStyle(previousStyle);
          throw error;
        }
      },
      { signal: options.signal },
    )
    .then((lease) => {
      if (disposed) {
        lease.value.asset.dispose();
        return;
      }
      modelAsset = lease.value.asset;
      bodyMesh = modelAsset.body;
      sound = lease.value.decoded;
      confirm = lease.confirm;
      releaseContent = lease.release;
      options.onInstruction(lease.pack.copy.instruction);
      host.dataset.contentRevision = lease.pack.revision;
      loaded = true;
      requestRender(true);
    })
    .catch(() => {
      if (!disposed) options.failed();
    });

  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    styleRenderer.resize(width, height);
    const halfHeight = 1.57,
      halfWidth = (halfHeight * width) / height;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    requestRender(true);
  }
  function requestRender(still = false) {
    needsStillFrame ||= still;
    if (!disposed && (active || needsStillFrame) && !document.hidden && !frame)
      frame = requestAnimationFrame(render);
  }
  function render(time: number) {
    frame = 0;
    if (disposed || (!active && !needsStillFrame) || document.hidden) return;
    needsStillFrame = false;
    try {
      styleRenderer.render();
    } catch {
      options.failed();
      return;
    }
    if (shaderFailed) {
      options.failed();
      return;
    }
    if (inspectMode) {
      host.dataset.mallet = JSON.stringify(mallet.position.toArray());
      host.dataset.phase = phase;
      host.dataset.queued = String(strikes.length);
    }
    if (loaded && !reportedReady && !shaderFailed) {
      reportedReady = true;
      void confirm?.()
        .then(() => options.content.prepareUpdate({ signal: options.signal }))
        .catch(() => {});
      options.ready();
    }
  }
  function stopFollowing() {
    following = false;
    followAnimation?.cancel();
    followAnimation = null;
  }
  function followTarget(immediate = false) {
    followAnimation?.cancel();
    followAnimation = null;
    if (strikeAnimation || !active || document.hidden) return;
    if (immediate || reducedMotion) {
      mallet.position.copy(hoverTarget);
      mallet.quaternion.identity();
      requestRender();
      return;
    }
    const from = mallet.position.clone(),
      rotation = mallet.quaternion.clone(),
      blend = { t: 0 };
    followAnimation = animate(blend, {
      t: 1,
      duration: 90,
      ease: "out(3)",
      onUpdate: () => {
        mallet.position.lerpVectors(from, hoverTarget, blend.t);
        mallet.quaternion.copy(rotation).slerp(new THREE.Quaternion(), blend.t);
        requestRender();
      },
      onComplete: () => {
        followAnimation = null;
      },
    });
  }
  function nextStrike() {
    if (
      disposed ||
      !active ||
      document.hidden ||
      strikeAnimation ||
      !strikes.length
    )
      return;
    followAnimation?.cancel();
    followAnimation = null;
    const target = strikes.shift()!;
    if (reducedMotion) {
      options.impact(sound);
      requestRender();
      queueMicrotask(nextStrike);
      return;
    }
    const start = swingPose(target.point, target.normal, 0.32, parameters);
    const contactAt = parameters.liftMs + parameters.strikeMs;
    const settleAt = contactAt + parameters.reboundMs;
    const ringMs = parameters.reboundMs + parameters.settleMs;
    const from = mallet.position.clone(),
      fromRotation = mallet.quaternion.clone();
    // Lift toward the viewer before lateral travel, keeping the head clear of
    // the shell. The following arc is a rigid lever about the grip, not scaling.
    const travel = new THREE.CubicBezierCurve3(
      from,
      from.clone().add(new THREE.Vector3(0, 0, 0.55)),
      start.head.clone().add(new THREE.Vector3(0, 0, 0.55)),
      start.head,
    );
    const approach = { t: 0 },
      swing = { angle: 0.32 },
      ring = { seconds: 0 };
    let contacted = false;
    function applySwing() {
      if (reducedMotion) return;
      const pose = swingPose(
        target.point,
        target.normal,
        swing.angle,
        parameters,
      );
      mallet.position.copy(pose.head);
      mallet.quaternion.copy(pose.rotation);
    }
    phase = "lift";
    strikeAnimation = createTimeline({
      autoplay: false,
      onUpdate: () => requestRender(),
      onComplete: () => {
        strikeAnimation = null;
        bodyGroup.rotation.z = 0;
        phase = "idle";
        requestRender();
        if (strikes.length) queueMicrotask(nextStrike);
        else if (following) followTarget();
      },
    })
      .add(
        approach,
        {
          t: 1,
          duration: parameters.liftMs,
          ease: "inOut(2)",
          onUpdate: () => {
            if (reducedMotion) return;
            mallet.position.copy(travel.getPoint(approach.t));
            mallet.quaternion
              .copy(fromRotation)
              .slerp(start.rotation, approach.t);
          },
        },
        0,
      )
      .call(() => {
        phase = "downswing";
      }, parameters.liftMs)
      .add(
        swing,
        {
          angle: 0,
          duration: parameters.strikeMs,
          ease: "in(2)",
          onUpdate: applySwing,
        },
        parameters.liftMs,
      )
      .call(() => {
        if (contacted) return;
        contacted = true;
        swing.angle = 0;
        applySwing();
        phase = "rebound";
        options.impact(sound);
        requestRender();
      }, contactAt)
      .add(
        swing,
        {
          angle: 0.16,
          duration: parameters.reboundMs,
          ease: "out(3)",
          onUpdate: applySwing,
        },
        contactAt,
      )
      .add(
        swing,
        {
          angle: 0.1,
          duration: parameters.settleMs,
          ease: "out(3)",
          onUpdate: applySwing,
        },
        settleAt,
      )
      .add(
        ring,
        {
          seconds: ringMs / 1000,
          duration: ringMs,
          ease: "linear",
          onUpdate: () => {
            bodyGroup.rotation.z = reducedMotion
              ? 0
              : 0.0025 *
                Math.exp(-24 * ring.seconds) *
                Math.sin(95 * ring.seconds);
          },
        },
        contactAt,
      );
    strikeAnimation.play();
  }
  function lost(event: Event) {
    event.preventDefault();
    if (!disposed) options.failed();
  }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  window.addEventListener("resize", resize);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  return {
    strike() {
      if (!loaded || !bodyMesh || !active || document.hidden) return;
      // Restrict contact to the solid upper shell, never the slit or inner wall.
      bodyMesh.updateWorldMatrix(true, false);
      raycaster.set(
        new THREE.Vector3(
          THREE.MathUtils.clamp(aim.x, -0.65, 0.65),
          THREE.MathUtils.clamp(aim.y, 0.28, 0.8),
          3,
        ),
        new THREE.Vector3(0, 0, -1),
      );
      const hit = raycaster.intersectObject(bodyMesh, false)[0];
      if (!hit) {
        options.impact(sound);
        return;
      }
      const normal = (hit.normal ?? hit.face!.normal)
        .clone()
        .transformDirection(bodyMesh.matrixWorld);
      strikes.push({ point: hit.point.clone(), normal });
      nextStrike();
    },
    movePointer(x: number, y: number, immediate = false) {
      if (!active || document.hidden || view !== "front") return;
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = raycaster.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.24),
        new THREE.Vector3(),
      );
      if (!hit) return;
      aim.x = THREE.MathUtils.clamp(hit.x, -1, 1.02);
      aim.y = THREE.MathUtils.clamp(hit.y, 0.12, 1.12);
      hoverTarget.set(aim.x, aim.y, 1.24);
      following = true;
      followTarget(immediate);
    },
    stopFollowing,
    setActive(value: boolean) {
      active = value;
      if (!active) {
        cancelAnimationFrame(frame);
        frame = 0;
        stopFollowing();
        strikeAnimation?.pause();
        resize();
      } else {
        resize();
        if (!document.hidden) {
          strikeAnimation?.resume();
          nextStrike();
        }
        requestRender();
      }
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      if (value) {
        followAnimation?.cancel();
        followAnimation = null;
        bodyGroup.rotation.z = 0;
      }
      requestRender(true);
    },
    // Used only by the explicit inspection UI (?inspectWoodfish=1), never by scoring.
    inspect(next: string) {
      view = next;
      angle =
        next === "back"
          ? Math.PI
          : next === "left"
            ? -Math.PI / 2
            : next === "right"
              ? Math.PI / 2
              : next === "front"
                ? 0.14
                : 0;
      camera.position.set(
        Math.sin(angle) * 6.5,
        next === "top" ? 6.5 : next === "bottom" ? -6.5 : 2.3,
        next === "top" || next === "bottom" ? 0.01 : Math.cos(angle) * 6.5,
      );
      camera.lookAt(target);
      mallet.visible = view === "front";
      floor.visible = contact.visible = view !== "bottom";
      requestRender(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      void releaseContent?.();
      stopFollowing();
      strikeAnimation?.cancel();
      strikeAnimation = null;
      strikes.length = 0;
      modelAsset?.dispose();
      modelAsset = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      key.shadow.dispose();
      fill.shadow.dispose();
      rim.shadow.dispose();
      styleRenderer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
