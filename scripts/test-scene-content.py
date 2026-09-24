"""Real WebGL/IndexedDB local-first tests. Run Vite on port 5176 first."""
import copy, hashlib, io, json, math, os, struct, wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
base = os.environ.get("WBR_URL", "http://localhost:5176/")
original = json.loads((root / "artifacts/scene-content/woodfish.json").read_text(encoding="utf-8"))
model = (root / "assets/woodfish/blender-v2/woodfish.glb").read_bytes()
bundled_hash = hashlib.sha256((root / "assets/woodfish/bundled-v1/woodfish.glb").read_bytes()).hexdigest()
audio = io.BytesIO()
with wave.open(audio, "wb") as wav:
    wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(22050)
    wav.writeframes(b"".join(struct.pack("<h", int(2400 * math.exp(-i / 1200) * math.sin(i * .1))) for i in range(5500)))
sound = audio.getvalue(); sound_hash = hashlib.sha256(sound).hexdigest()
STATE = """async () => {
  const db=await new Promise((ok,no)=>{const r=indexedDB.open('wbr-scene-content-v1',1);r.onsuccess=()=>ok(r.result);r.onerror=no});
  return new Promise((ok,no)=>{const r=db.transaction('metadata').objectStore('metadata').getAll();r.onsuccess=()=>{db.close();ok(r.result.filter(s=>s?.version===2 && Array.isArray(s.confirmed)))};r.onerror=no});
}"""
def wait_revision(page, field, revision):
    # This installed Playwright accepts an unresolved Promise as truthy in
    # wait_for_function. evaluate awaits IDB, so poll the actual boolean here.
    wait_until(page, lambda: page.evaluate("async input => {const list=await (" + STATE + ")();return list.some(s=>(input.field==='pending'?s.pending:s.confirmed?.[0])?.pack.revision===input.revision)}", {"field": field, "revision": revision}))
def enter(page, revision):
    page.get_by_role("button", name="木鱼", exact=True).click()
    page.locator('[data-renderer="ready"]').wait_for()
    expect(page.locator(".woodfish-canvas")).to_have_attribute("data-content-revision", revision)
def back(page): page.get_by_role("button", name="返回", exact=True).click()
def wait_until(page, predicate):
    for _ in range(100):
        if predicate(): return
        page.wait_for_timeout(50)
    raise AssertionError("Background work did not reach expected state")

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get("WBR_BROWSER", "msedge"), headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    ctx.add_init_script("""window.sampleCount=0;const create=AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource=function(...a){sampleCount++;return create.apply(this,a)};
      window.denyCacheHash='';const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...a){if(this.name==='assets'&&a[0]?.key===window.denyCacheHash)throw new DOMException('Cache full','QuotaExceededError');return put.apply(this,a)};""")
    page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    candidate = copy.deepcopy(original); candidate["revision"] = "one"
    downloads = []; held = []; requests = []; offline = False; hold_manifest = True; hold_sound = False
    def manifest(route):
        requests.append(candidate["revision"])
        if offline: route.abort()
        elif hold_manifest: held.append(route)
        else: route.fulfill(json=candidate)
    def asset(route):
        downloads.append(route.request.url)
        if offline: route.abort()
        elif route.request.url.endswith(".wav"):
            if hold_sound: held.append(route)
            else: route.fulfill(body=sound, content_type="audio/wav")
        else: route.fulfill(body=model, content_type="model/gltf-binary")
    ctx.route("**/scene-content/woodfish.json", manifest)
    ctx.route("**/scene-content/*.glb", asset); ctx.route("**/scene-content/*.wav", asset)
    page.goto(base, wait_until="networkidle")
    assert not downloads and not requests, "Home must not request scene content"
    # First paint cannot wait for a remote response which is deliberately held.
    enter(page, "bundled-woodfish-1"); wait_until(page, lambda: bool(held))
    assert not downloads
    hold_manifest = False; held.pop().fulfill(json=candidate)
    wait_revision(page, "pending", "one")
    expect(page.locator(".woodfish-canvas")).to_have_attribute("data-content-revision", "bundled-woodfish-1")
    candidate["revision"] = "two"; candidate["copy"]["instruction"] = "慢慢敲，今天也很好。"; candidate["parameters"]["keyIntensity"] = 2.8
    back(page); enter(page, "one"); wait_revision(page, "confirmed", "one"); wait_revision(page, "pending", "two")
    expect(page.locator(".woodfish-canvas")).to_have_attribute("data-content-revision", "one")
    back(page); enter(page, "two"); wait_revision(page, "confirmed", "two")
    expect(page.locator("#woodfish-instruction")).to_have_text(candidate["copy"]["instruction"])
    assert len(downloads) == 1, "Same hash must reuse cached bytes"
    page.wait_for_timeout(200)
    # Invalid candidates leave the current/confirmed version intact.
    candidate["revision"] = "missing-node"; candidate["bindings"]["body"] = "MissingBody"
    before = len(requests); back(page); enter(page, "two"); wait_until(page, lambda: len(requests) > before)
    page.wait_for_timeout(150)
    assert page.evaluate(STATE)[0]["confirmed"][0]["pack"]["revision"] == "two"
    assert not page.evaluate(STATE)[0].get("pending")
    candidate = copy.deepcopy(original); candidate["revision"] = "corrupt"
    candidate["model"]["sha256"] = "0" * 64; candidate["model"]["path"] = "0" * 64 + ".glb"
    count = len(downloads); back(page); enter(page, "two"); wait_until(page, lambda: len(downloads) > count)
    page.wait_for_timeout(150); assert not page.evaluate(STATE)[0].get("pending")
    # Persistent offline cache remains usable without waiting for the manifest.
    offline = True; count = len(downloads)
    page.reload(wait_until="networkidle"); enter(page, "two"); assert len(downloads) == count
    offline = False; candidate = copy.deepcopy(original); candidate["revision"] = "with-sound"
    candidate["sound"] = {"path": sound_hash + ".wav", "bytes": len(sound), "sha256": sound_hash}
    page.evaluate("hash=>window.denyCacheHash=hash", sound_hash)
    count = len(downloads); back(page); enter(page, "two"); wait_until(page, lambda: len(downloads) > count)
    page.wait_for_timeout(200)
    assert not page.evaluate(STATE)[0].get("pending"), "Cache write failure must not stage an unavailable package"
    page.evaluate("window.denyCacheHash=''")
    hold_sound = True; back(page); enter(page, "two"); wait_until(page, lambda: bool(held))
    assert not page.evaluate(STATE)[0].get("pending"), "Partial package must not be staged"
    # Leave during a download: a late response must not activate it.
    back(page); hold_sound = False
    try: held.pop().fulfill(body=sound, content_type="audio/wav")
    except Exception: pass
    page.wait_for_timeout(100); assert not page.evaluate(STATE)[0].get("pending")
    enter(page, "two"); wait_revision(page, "pending", "with-sound")
    back(page); enter(page, "with-sound"); wait_revision(page, "confirmed", "with-sound")
    page.get_by_role("button", name="轻敲木鱼", exact=True).click(); page.wait_for_function("sampleCount === 1")
    page.get_by_label("音效", exact=True).uncheck(); page.get_by_role("button", name="轻敲木鱼", exact=True).click()
    page.wait_for_timeout(550); assert page.evaluate("sampleCount") == 1
    assert not errors, errors

    # Stage a remote model, then inject first-use GPU failures on next entry.
    for kind in ["draw", "shader"]:
        c = browser.new_context(); q = c.new_page()
        c.add_init_script("""window.armed=false;window.injected=false;
          const draw=WebGL2RenderingContext.prototype.drawElements;
          WebGL2RenderingContext.prototype.drawElements=function(...a){if(armed&&!injected&&window.failureKind==='draw'&&a[1]>5000){injected=true;throw Error('first draw failed')}return draw.apply(this,a)};
          const get=WebGL2RenderingContext.prototype.getProgramParameter;
          WebGL2RenderingContext.prototype.getProgramParameter=function(program,param){
            if(armed&&!injected&&window.failureKind==='shader'&&param===this.LINK_STATUS&&this.getAttachedShaders(program).some(s=>this.getShaderSource(s).includes('#define STANDARD'))){injected=true;setTimeout(()=>dispatchEvent(new Event('resize')),10);return false}return get.call(this,program,param)};""")
        q.goto(base, wait_until="networkidle"); enter(q, "bundled-woodfish-1"); wait_revision(q, "pending", original["revision"])
        back(q)
        q.evaluate("async hash=>{const db=await new Promise(ok=>{const r=indexedDB.open('wbr-scene-content-v1');r.onsuccess=()=>ok(r.result)});await new Promise(ok=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').delete(hash);tx.oncomplete=ok});db.close()}", bundled_hash)
        delayed = []; c.route("**/woodfish/bundled-v1/woodfish.glb", lambda r: delayed.append(r))
        q.evaluate("kind=>{window.failureKind=kind;window.armed=true}", kind)
        q.get_by_role("button", name="木鱼", exact=True).click()
        try: q.wait_for_function("injected", timeout=7000)
        except Exception:
            print(json.dumps({"kind":kind,"state":q.evaluate(STATE),"flags":q.evaluate("[armed,injected,failureKind]"),"body":q.locator('body').inner_text()},ensure_ascii=True)); raise
        wait_until(q, lambda: bool(delayed)); q.wait_for_timeout(150)
        expect(q.locator('[data-renderer="fallback"]')).to_have_count(0)
        delayed.pop().continue_(); q.locator('[data-renderer="ready"]').wait_for()
        expect(q.locator(".woodfish-canvas")).to_have_attribute("data-content-revision", "bundled-woodfish-1")
        c.close()
    # Incompatible remote engine never blocks a fresh bootstrap.
    fresh = browser.new_context(); fresh.route("**/scene-content/woodfish.json", lambda r: r.fulfill(json={**original, "engine": "woodfish@999"}))
    q = fresh.new_page(); q.goto(base, wait_until="networkidle"); enter(q, "bundled-woodfish-1")
    q.wait_for_timeout(300); q.screenshot(path=str(root / "artifacts/woodfish/bundled-content.png"))
    print(json.dumps({"passed": True, "checks": ["no homepage requests", "held manifest cannot delay first paint", "cache reuse", "next entry activation", "copy/lighting", "bad model and hash", "persistent offline cache", "cache quota failure", "cancelled partial update", "remote audio/mute", "GPU retry with delayed fallback", "incompatible engine"]}))
    browser.close()
