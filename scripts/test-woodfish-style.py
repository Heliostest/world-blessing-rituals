"""Exercise official toon materials and pmndrs outlines on real WebGL."""
import base64
import copy
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("WBR_URL", "http://127.0.0.1:5176/")
MODULE = "/@fs/" + (ROOT / "packages/scene-runtime/src/render-style.ts").as_posix()
THREE = "/@fs/" + (ROOT / "node_modules/three/build/three.module.js").as_posix()
REMOTE = json.loads((ROOT / "artifacts/scene-content/woodfish.json").read_text(encoding="utf-8"))
MODEL = (ROOT / "assets/woodfish/blender-v2/woodfish.glb").read_bytes()


def enter_woodfish(page, revision):
    page.get_by_role("button", name="木鱼", exact=True).click()
    page.locator(".woodfish-visual[data-renderer='ready']").wait_for()
    assert page.locator(".woodfish-canvas").get_attribute("data-content-revision") == revision
    assert page.locator(".woodfish-canvas canvas").count() == 1


def staged_woodfish(browser, inject_composer_failure=False):
    context = browser.new_context(viewport={"width": 390, "height": 844})
    manifest = copy.deepcopy(REMOTE)
    manifest["revision"] = "probe-toon-soft"
    manifest["renderStyle"] = "toon-soft"
    context.route("**/scene-content/woodfish.json", lambda route: route.fulfill(json=manifest))
    context.route("**/scene-content/*.glb", lambda route: route.fulfill(body=MODEL, content_type="model/gltf-binary"))
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    enter_woodfish(page, "bundled-woodfish-1")
    original = page.locator(".woodfish-canvas canvas").screenshot()
    page.wait_for_function("""async () => {
      const db = await new Promise((ok, no) => {const r=indexedDB.open('wbr-scene-content-v1');r.onsuccess=()=>ok(r.result);r.onerror=no});
      const value = await new Promise((ok, no) => {const r=db.transaction('metadata').objectStore('metadata').getAll();r.onsuccess=()=>ok(r.result);r.onerror=no});
      db.close(); return value.some(item => item.pending?.pack.revision === 'probe-toon-soft');
    }""")
    page.get_by_role("button", name="返回", exact=True).click()
    page.evaluate("""async ({module, fail}) => {
          const source = await (await fetch(module)).text();
          const composerUrl = source.match(/from \"([^\"]*postprocessing[^\"]*)\"/)[1];
          const {EffectComposer} = await import(composerUrl);
          const previous = EffectComposer.prototype.render;
          window.styleFailureInjected = false;
          window.composerDraws = 0;
          window.directRecoveryDraws = 0;
          EffectComposer.prototype.render = function(...args) {
            window.composerDraws++;
            if (fail && !window.styleFailureInjected) {
              const renderer = this.renderer, draw = renderer.render;
              renderer.render = function(object, camera) {
                const directRecovery = window.styleFailureInjected && object.isScene && this.getRenderTarget() === null && this.autoClear;
                const result = draw.call(this, object, camera);
                if (directRecovery) {
                  window.directRecoveryDraws++;
                }
                return result;
              };
              window.styleFailureInjected = true;
              renderer.setRenderTarget(this.inputBuffer);
              renderer.autoClear = false;
              throw Error('injected composer failure after changing renderer state');
            }
            return previous.apply(this, args);
          };
        }""", {"module": MODULE, "fail": inject_composer_failure})
    enter_woodfish(page, "probe-toon-soft")
    assert page.evaluate("window.composerDraws") > 0, "Mounted scene never used the selected style"
    selected = page.locator(".woodfish-canvas canvas").screenshot()
    if inject_composer_failure:
        assert page.evaluate("window.styleFailureInjected"), "Composer failure was not exercised"
        page.wait_for_function("window.directRecoveryDraws >= 2")
        assert page.evaluate("window.composerDraws") == 1, "Failed style should stay on direct rendering"
    else:
        assert selected != original, "Selected style should visibly change the canvas"
    count = page.locator(".ritual-counter").inner_text()
    page.get_by_role("button", name="轻敲木鱼").click()
    page.wait_for_function("before => document.querySelector('.ritual-counter')?.textContent !== before", arg=count)
    assert page.locator(".woodfish-canvas canvas").count() == 1
    if inject_composer_failure:
        page.evaluate("""() => {
          const canvas = document.querySelector('.woodfish-canvas canvas');
          const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
          if (!extension) throw Error('WEBGL_lose_context unavailable');
          extension.loseContext();
        }""")
        page.locator(".woodfish-visual[data-renderer='fallback']").wait_for()
    context.close()


def exercise(page):
    return page.evaluate(
        """async ({module, three}) => {
          const THREE = await import(three);
          const {createRenderStyle} = await import(module);
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 256;
          document.body.replaceChildren(canvas);
          const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, preserveDrawingBuffer: true});
          renderer.setSize(256, 256);
          const scene = new THREE.Scene();
          scene.add(new THREE.AmbientLight(0xffffff, 1.1));
          const lamp = new THREE.DirectionalLight(0xffffff, 2.2);
          lamp.position.set(-2, 3, 4);
          scene.add(lamp);
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.83, 48, 32), new THREE.MeshStandardMaterial({color: 0xe05a28, roughness: 0.7}));
          scene.add(sphere);
          const camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
          camera.position.z = 4;
          const style = createRenderStyle(renderer, scene, camera);
          const sample = (x, y) => {
            const rgba = new Uint8Array(4);
            renderer.getContext().readPixels(x, y, 1, 1, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, rgba);
            return Array.from(rgba);
          };
          const result = {};
          style.render();
          result.originalCenter = sample(128, 128);
          result.originalCorner = sample(1, 1);
          for (const preset of ['toon-ink', 'toon-soft']) {
            style.setStyle(preset);
            style.render();
            result[preset] = {center: sample(128, 128), corner: sample(1, 1)};
            result[preset].png = canvas.toDataURL('image/png');
            style.render();
            result[preset].stable = canvas.toDataURL('image/png') === result[preset].png;
          }
          renderer.setSize(320, 220);
          renderer.setPixelRatio(1.5);
          style.resize(320, 220);
          style.render();
          result.resizedPixels = [canvas.width, canvas.height];
          result.resizedCorner = sample(1, 1);
          style.dispose();
          renderer.dispose();
          return result;
        }""",
        {"module": MODULE, "three": THREE},
    )


def scene_pass_failure(page):
    result = page.evaluate("""async ({module, three}) => {
      const THREE = await import(three);
      const {createRenderStyle} = await import(module);
      const renderer = new THREE.WebGLRenderer({alpha: true, preserveDrawingBuffer: true});
      renderer.setSize(64, 64);
      renderer.setClearColor(0x123456, 0.25);
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.7), new THREE.MeshBasicMaterial({color: 0xff3300}));
      scene.add(mesh);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 3;
      const style = createRenderStyle(renderer, scene, camera);
      const pixels = () => renderer.domElement.toDataURL();
      style.render();
      const original = pixels();
      // Remove the baseline so matching pixels require a new canvas draw.
      renderer.clear();
      const failure = Error('candidate scene draw failed');
      const handler = () => { throw failure; };
      renderer.debug.onShaderError = handler;
      let offscreenAtFailure = false;
      mesh.onBeforeRender = () => {
        offscreenAtFailure ||= renderer.getRenderTarget() !== null;
        renderer.debug.onShaderError();
      };
      style.setStyle('toon-ink');
      let propagated = false;
      try { style.render(); } catch (error) { propagated = error === failure; }
      // Follow the host candidate-rejection path: dispose the style, then draw
      // the replacement candidate directly using the same renderer.
      style.setStyle('original');
      mesh.onBeforeRender = () => {};
      const canvasTarget = renderer.getRenderTarget() === null;
      const autoClear = renderer.autoClear;
      style.render();
      const recovered = pixels();
      const clearColor = renderer.getClearColor(new THREE.Color()).getHex();
      const clearAlpha = renderer.getClearAlpha();
      const handlerRestored = renderer.debug.onShaderError === handler;
      style.dispose(); renderer.dispose();
      return {propagated, offscreenAtFailure, canvasTarget, autoClear, clearColor,
        clearAlpha, handlerRestored, matchesOriginal: original === recovered};
    }""", {"module": MODULE, "three": THREE})
    assert result["propagated"] and result["offscreenAtFailure"], result
    assert result["canvasTarget"] and result["autoClear"], result
    assert result["clearColor"] == 0x123456 and result["clearAlpha"] == 0.25, result
    assert result["handlerRestored"] and result["matchesOriginal"], result
    print(json.dumps({"scenePassFailure": result}))


def outline_pass_failure(page):
    result = page.evaluate("""async ({module, three}) => {
      const THREE = await import(three);
      const {createRenderStyle} = await import(module);
      const renderer = new THREE.WebGLRenderer({alpha:true, preserveDrawingBuffer:true});
      renderer.setSize(64, 64);
      renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.7), new THREE.MeshStandardMaterial({color:0xc99764}));
      scene.add(mesh, new THREE.AmbientLight(0xffffff, 1));
      const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10); camera.position.z=3;
      const source = mesh.material;
      const style = createRenderStyle(renderer, scene, camera);
      style.render();
      const before = renderer.domElement.toDataURL();
      let injected = false;
      mesh.onBeforeRender = () => {
        if (!injected && scene.overrideMaterial) { injected=true; throw Error('outline mask draw failed'); }
      };
      style.setStyle('toon-ink'); style.render();
      const result = {injected, style:style.getStyle(), shadowEnabled:renderer.shadowMap.enabled,
        shadowAutoUpdate:renderer.shadowMap.autoUpdate, restoredMaterial:mesh.material===source,
        restoredOverride:scene.overrideMaterial===null, restoredLayer:mesh.layers.mask===1,
        matchesOriginal:renderer.domElement.toDataURL()===before};
      style.dispose(); renderer.dispose();
      return result;
    }""", {"module": MODULE, "three": THREE})
    assert result["injected"] and result["style"] == "original", result
    for key in ["shadowEnabled", "shadowAutoUpdate", "restoredMaterial", "restoredOverride", "restoredLayer", "matchesOriginal"]:
        assert result[key], result
    print(json.dumps({"outlinePassFailure": result}))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel=os.environ.get("WBR_BROWSER", "msedge"), headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    # Use the same Three.js module as the renderer; raw /@fs imports create a
    # second set of constructors and cannot exercise material adaptation.
    THREE = page.evaluate("""async module => {
      const source = await (await fetch(module)).text();
      return source.match(/from \"([^\"]*\/three[^\"]*)\"/)[1];
    }""", MODULE)
    scene_pass_failure(page)
    outline_pass_failure(page)
    context.close()
    for width, height in [(390, 844), (1280, 800)]:
        context = browser.new_context(viewport={"width": width, "height": height})
        page = context.new_page()
        page.on("console", lambda message: print("browser:", message.type, message.text) if message.type == "error" else None)
        page.goto(BASE, wait_until="networkidle")
        result = exercise(page)
        for preset in ["toon-ink", "toon-soft"]:
            png = result[preset].pop("png").split(",", 1)[1]
            if width == 390:
                output = ROOT / "artifacts/woodfish" / f"style-{preset}.png"
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(base64.b64decode(png))
        assert result["originalCenter"][3] > 0, result
        assert result["originalCorner"][3] == 0, result
        for preset in ["toon-ink", "toon-soft"]:
            toon = result[preset]
            assert toon["center"][3] > 0, result
            assert toon["corner"][3] == 0, result
            assert toon["stable"], "Repeated still frames changed: composer state was not restored correctly"
            assert sum(abs(a - b) for a, b in zip(result["originalCenter"][:3], toon["center"][:3])) > 10, result
        assert result["resizedCorner"][3] == 0, result
        assert result["resizedPixels"] == [480, 330], result
        context.close()
        print(json.dumps({"viewport": [width, height], "original": result["originalCenter"], "ink": result["toon-ink"]["center"], "soft": result["toon-soft"]["center"]}))
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    fallback = page.evaluate(
        """async ({module, three}) => {
          const THREE = await import(three);
          const {createRenderStyle} = await import(module);
          const canvas = document.createElement('canvas');
          const renderer = new THREE.WebGLRenderer({canvas, alpha: true, preserveDrawingBuffer: true});
          renderer.setSize(64, 64);
          const scene = new THREE.Scene();
          scene.add(new THREE.AmbientLight(0xffffff, 1));
          scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.7), new THREE.MeshStandardMaterial({color: 0xff3300})));
          const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
          camera.position.z = 3;
          const style = createRenderStyle(renderer, scene, camera);
          const sample = () => {
            const pixels = new Uint8Array(4), gl = renderer.getContext();
            gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return Array.from(pixels);
          };
          style.render();
          const original = sample();
          const gl = renderer.getContext(), previous = gl.getProgramParameter.bind(gl);
          let injected = false;
          gl.getProgramParameter = function(program, parameter) {
            if (!injected && parameter === gl.LINK_STATUS && gl.getAttachedShaders(program).some(s => gl.getShaderSource(s).includes('SHADER_TYPE MeshToonMaterial'))) {
              injected = true;
              return false;
            }
            return previous(program, parameter);
          };
          style.setStyle('toon-ink');
          style.render();
          const recovered = sample();
          gl.getProgramParameter = previous;
          style.render();
          const nextFrame = sample();
          style.dispose(); renderer.dispose();
          return {original, recovered, nextFrame, injected};
        }""",
        {"module": MODULE, "three": THREE},
    )
    assert fallback["injected"], fallback
    assert fallback["recovered"] == fallback["original"], fallback
    assert fallback["nextFrame"] == fallback["original"], fallback
    print(json.dumps({"styleShaderFallback": fallback}))
    context.close()
    staged_woodfish(browser)
    staged_woodfish(browser, inject_composer_failure=True)
    print(json.dumps({"mountedWoodfishStyle": True, "styleFailureFallback": True, "contextLossFallback": True}))
    browser.close()
