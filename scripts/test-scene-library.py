"""Browser acceptance with small content fixtures; not a native device test."""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("WBR_URL", "http://127.0.0.1:5177/").rstrip("/")
OUT = Path(__file__).resolve().parents[1] / "artifacts" / "scene-library"
OUT.mkdir(parents=True, exist_ok=True)
payload = json.dumps({"caption": "按需下载测试：共享配置，独立进度。"}, ensure_ascii=False).encode()
digest = hashlib.sha256(payload).hexdigest()
asset = {"path": f"{digest}.json", "bytes": len(payload), "sha256": digest}
entries = [{"id": f"fixture-{n}", "title": f"测试场景 {n:03}", "engine": "celtic-folk-spring@1", "revision": "v1", "manifestUrl": f"{BASE}/fixtures/scene-{n}.json"} for n in range(500)]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    errors, downloads = [], []
    control = {"offline": False, "corrupt": False, "hold": False}
    held = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # Count actual WebGL allocations/deletions through the public WebGL API.
    page.add_init_script("""window.gpuAudit = {create: 0, remove: 0, contexts: 0, lost: 0, live: 0, peak: 0};
    const resources = new WeakMap();
    const owned = ctx => { if (!resources.has(ctx)) resources.set(ctx,new Set()); return resources.get(ctx); };
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const kind of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader']) {
        for (const [prefix, counter] of [['create','create'], ['delete','remove']]) {
          const original = proto[prefix + kind];
          if (!original) continue;
          proto[prefix + kind] = function(...args) {
            const result = original.apply(this,args), set = owned(this);
            if (prefix === 'delete' ? args[0] : result) window.gpuAudit[counter]++;
            if (prefix === 'create' && result) { set.add(result); window.gpuAudit.live++; }
            if (prefix === 'delete' && set.delete(args[0])) window.gpuAudit.live--;
            window.gpuAudit.peak = Math.max(window.gpuAudit.peak, window.gpuAudit.live);
            return result;
          };
        }
      }
    }
    const getContext = HTMLCanvasElement.prototype.getContext;
    const seen = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function(type,...args) {
      const value = getContext.call(this,type,...args);
      if (value && type.startsWith('webgl') && !seen.has(value)) {
        seen.add(value); window.gpuAudit.contexts++;
        this.addEventListener('webglcontextlost', () => { window.gpuAudit.lost++; window.gpuAudit.live -= owned(value).size; owned(value).clear(); });
      }
      return value;
    };""")

    def route_content(route):
        if control["offline"]:
            route.abort()
            return
        url = route.request.url
        if url.endswith("catalog.json"):
            route.fulfill(json={"schemaVersion": 1, "scenes": entries})
        elif url.endswith(f"{digest}.json"):
            downloads.append(url)
            if control["hold"]:
                held.append(route)
                return
            route.fulfill(body=b"bad" if control["corrupt"] else payload, content_type="application/json")
        else:
            number = int(url.rsplit("scene-", 1)[1].split(".")[0])
            route.fulfill(json={"schemaVersion": 1, "sceneId": f"fixture-{number}", "engine": "celtic-folk-spring@1", "revision": "v1", "assets": {"presentation": asset}, "config": {}})

    page.route("**/scene-content/catalog.json", route_content)
    page.route("**/fixtures/**", route_content)
    page.goto(BASE, wait_until="networkidle")
    page.get_by_role("button", name="浏览场景目录", exact=True).click()
    expect(page.locator(".scene-card")).to_have_count(24)
    expect(page.get_by_text("503 个场景 · 按需准备")).to_be_visible()
    assert not downloads, "Catalog browsing downloaded content"
    page.screenshot(path=str(OUT / "catalog-mobile.png"), full_page=True)

    def open_scene(n=0):
        page.get_by_role("button", name=f"测试场景 {n:03}").click()
        page.locator('.library-scene-stage[data-ready="true"]').wait_for()

    def back():
        page.get_by_role("button", name="返回", exact=True).click()

    open_scene()
    assert len(downloads) == 1
    page.get_by_role("button", name="点按以鞠躬").click()
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    page.get_by_role("button", name="收藏场景", exact=True).click()
    page.screenshot(path=str(OUT / "spring-mobile.png"), full_page=True)
    back()
    open_scene()
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    expect(page.get_by_role("button", name="取消收藏")).to_be_visible()
    assert len(downloads) == 1
    back()
    open_scene(1)
    assert len(downloads) == 1, "Shared hash was downloaded twice"
    module_url = "/@fs/" + (Path(__file__).resolve().parents[1] / "packages/app/src/content.tsx").as_posix()
    stats = page.evaluate("""async url => { const {contentIO} = await import(url); return contentIO({}).cache.maintain({clear:true}); }""", module_url)
    assert stats["bytes"] == len(payload) and stats["protectedBytes"] == len(payload), stats
    back()
    page.get_by_role("button", name="管理资源缓存").click()
    page.get_by_role("button", name="清理可删除资源").click()
    expect(page.get_by_text("已清理可删除资源，历史记录和进度保持不变。")).to_be_visible()
    page.screenshot(path=str(OUT / "cache-mobile.png"), full_page=True)
    back()
    open_scene()
    assert len(downloads) == 2
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    back()

    for _ in range(5):
        open_scene(1)
        back()
        expect(page.locator("canvas")).to_have_count(0)
    audit = page.evaluate("window.gpuAudit")
    # Renderer disposal deletes owned resources; forceContextLoss also releases
    # Three.js internal fallback textures. Explicit delete counts alone overstate leaks.
    assert audit["live"] == 0, audit
    assert audit["contexts"] == audit["lost"], audit

    control["offline"] = True
    page.reload(wait_until="networkidle")
    page.get_by_role("button", name="我的", exact=True).click()
    page.get_by_role("button", name="我的仪式记录").click()
    open_scene()
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    assert len(downloads) == 2
    back()
    back()
    page.get_by_role("button", name="资源缓存", exact=True).click()
    page.get_by_role("button", name="清理可删除资源").click()
    expect(page.get_by_text("已清理可删除资源，历史记录和进度保持不变。")).to_be_visible()
    back()
    page.get_by_role("button", name="我的仪式记录").click()
    page.get_by_role("button", name="测试场景 000").click()
    expect(page.get_by_role("button", name="重试打开")).to_be_visible()
    control["offline"] = False
    control["corrupt"] = True
    page.get_by_role("button", name="重试打开").click()
    expect(page.get_by_role("button", name="重试打开")).to_be_visible()
    control["corrupt"] = False
    page.get_by_role("button", name="重试打开").click()
    page.locator('.library-scene-stage[data-ready="true"]').wait_for()
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    back()
    back()
    page.get_by_role("button", name="资源缓存", exact=True).click()
    page.get_by_role("button", name="清理可删除资源").click()
    expect(page.get_by_text("已清理可删除资源，历史记录和进度保持不变。")).to_be_visible()
    back()
    page.get_by_role("button", name="我的仪式记录").click()
    control["hold"] = True
    with page.expect_request(f"**/fixtures/{digest}.json"):
        page.get_by_role("button", name="测试场景 000").click()
    page.get_by_role("button", name="取消并返回").click()
    expect(page.locator(".library-scene-stage")).to_have_count(0)
    control["hold"] = False
    for route in held:
        route.abort()
    held.clear()
    open_scene()
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    back()
    back()
    page.get_by_role("checkbox").nth(2).check()
    page.get_by_role("button", name="场景目录", exact=True).click()
    page.get_by_label("搜索场景").fill("花水位一倾")
    page.get_by_role("button", name="花水位一倾").click()
    page.locator('.library-scene-stage[data-ready="true"]').wait_for()
    hit = page.locator(".scene-hit-layer").bounding_box()
    page.mouse.move(hit["x"] + hit["width"] / 2, hit["y"] + hit["height"] / 2)
    page.mouse.down()
    page.mouse.move(hit["x"] + hit["width"] / 2, hit["y"] + hit["height"] / 2 - 90, steps=8)
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    page.mouse.up()
    page.screenshot(path=str(OUT / "water-reduced-motion.png"), full_page=True)
    back()
    page.get_by_label("搜索场景").fill("花水位一倾")
    page.get_by_role("button", name="花水位一倾").click()
    page.locator('.library-scene-stage[data-ready="true"]').wait_for()
    expect(page.locator(".scene-progress")).to_have_text("已完成 1 / 3")
    assert not errors, errors
    print(json.dumps({"catalog": 500, "downloadRequests": len(downloads), "gpu": audit, "result": "PASS"}))
    browser.close()
