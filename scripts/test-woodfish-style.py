"""Exercise the shared cartoon postprocessor on a real WebGL canvas."""
import base64
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("WBR_URL", "http://127.0.0.1:5176/")
MODULE = "/@fs/" + (ROOT / "packages/app/src/render-style.ts").as_posix()
THREE = "/@fs/" + (ROOT / "node_modules/three/build/three.module.js").as_posix()


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
          }
          renderer.setSize(320, 220);
          style.resize(320, 220);
          style.render();
          result.resizedCorner = sample(1, 1);
          style.dispose();
          renderer.dispose();
          return result;
        }""",
        {"module": MODULE, "three": THREE},
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel=os.environ.get("WBR_BROWSER", "msedge"), headless=True)
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
            assert sum(abs(a - b) for a, b in zip(result["originalCenter"][:3], toon["center"][:3])) > 10, result
        assert result["resizedCorner"][3] == 0, result
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
          scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.7), new THREE.MeshBasicMaterial({color: 0xff3300})));
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
            if (!injected && parameter === gl.LINK_STATUS && gl.getAttachedShaders(program).some(s => gl.getShaderSource(s).includes('vec3 quantized'))) {
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
    browser.close()
