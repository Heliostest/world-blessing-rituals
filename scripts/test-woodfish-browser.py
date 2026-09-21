"""Run against npm run dev -- --port 5176. Uses real WebGL and Web Audio.
Install test tooling separately: python -m pip install playwright
Set WBR_BROWSER to a Playwright channel (default: msedge), WBR_URL to override URL.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, os

out=Path(__file__).resolve().parents[1]/"artifacts"/"woodfish"
out.mkdir(parents=True,exist_ok=True)
base=os.environ.get("WBR_URL","http://localhost:5176/")
with sync_playwright() as p:
    browser=p.chromium.launch(channel=os.environ.get("WBR_BROWSER","msedge"),headless=True)
    context=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=2,has_touch=True)
    context.add_init_script("""window.soundCount=0; const create=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(...args){window.soundCount++;return create.apply(this,args)};""")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.on("console",lambda m:errors.append(m.text) if m.type=="error" else None)
    def enter():
        page.goto(base,wait_until="networkidle")
        page.get_by_role("button",name="木鱼",exact=True).click()
        page.locator('[data-renderer="ready"]').wait_for()
    def progress(n): expect(page.get_by_role("progressbar")).to_have_attribute("aria-valuenow",str(n))
    def state():
        page.wait_for_function("JSON.parse(localStorage.getItem('cyber-bless:personal:v1')) !== null")
        return page.evaluate("JSON.parse(localStorage.getItem('cyber-bless:personal:v1'))")
    enter()
    page.screenshot(path=str(out/"ritual-mobile.png"),full_page=True)
    hit=page.get_by_role("button",name="轻敲木鱼",exact=True)
    hit.tap();progress(1)
    page.wait_for_function("soundCount === 1")
    page.get_by_label("音效",exact=True).uncheck()
    page.get_by_label("震动",exact=True).uncheck()
    hit.tap();progress(2)
    assert page.evaluate("soundCount")==1
    page.get_by_role("button",name="暂停片刻").click()
    expect(hit).to_be_disabled()
    page.locator(".ritual-object").evaluate("b=>b.click()")
    progress(2)
    page.get_by_role("button",name="继续轻敲").click()
    hit.focus();page.keyboard.press("Space");progress(3)
    page.get_by_role("button",name="返回",exact=True).click()
    page.get_by_role("button",name="继续上次的木鱼",exact=False).click()
    progress(3)
    page.reload(wait_until="networkidle")
    page.get_by_role("button",name="继续上次的木鱼",exact=False).click()
    progress(3)
    expect(page.get_by_label("音效",exact=True)).not_to_be_checked()
    page.locator('[data-renderer="ready"]').wait_for()
    page.get_by_label("音效",exact=True).check()
    # Same JS turn: exposes stale React closures and duplicate session creation.
    page.locator(".ritual-object").evaluate("b=>{for(let i=0;i<35;i++)b.click()}")
    progress(12)
    page.wait_for_function("soundCount === 9")
    page.get_by_role("button",name="完成仪式 · 收下小美好").evaluate("b=>{b.click();b.click()}")
    expect(page.get_by_role("heading",name="今日仪式完成")).to_be_visible()
    page.wait_for_function("JSON.parse(localStorage.getItem('cyber-bless:personal:v1')).sessions.length === 1")
    s=state()
    assert len(s["ledger"])==1 and s["ledger"][0]["amount"]==10
    assert len(s["collectibles"])==1 and s["activeSession"] is None
    page.screenshot(path=str(out/"complete-mobile.png"),full_page=True)
    page.reload(wait_until="networkidle")
    assert len(state()["sessions"])==1
    # Real pointer input on a new session, hide/resume, resize, GPU context loss.
    page.locator(".ritual-tile").filter(has_text="木鱼").click()
    page.locator('[data-renderer="ready"]').wait_for()
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.locator(".ritual-object").evaluate("b=>b.click()")
    progress(0)
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    page.get_by_role("button",name="轻敲木鱼").tap();progress(1)
    for width in [320,768,1440,390]:
        page.set_viewport_size({"width":width,"height":900})
        page.wait_for_timeout(120)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        size=page.locator("canvas").evaluate("c=>({w:c.width,css:c.clientWidth})")
        assert size["w"] <= size["css"]*1.75+2
        page.screenshot(path=str(out/f"ritual-{width}.png"),full_page=True)
    page.locator("canvas").evaluate("c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    page.locator('[data-renderer="fallback"]').wait_for()
    page.get_by_role("button",name="轻敲木鱼").tap();progress(2)
    assert not errors, errors
    # Missing local resource should leave an operable static fallback.
    fallback=browser.new_context(viewport={"width":390,"height":844})
    fallback.route("**/woodfish/blender-v2/woodfish.glb",lambda route:route.abort())
    f=fallback.new_page();f.goto(base,wait_until="networkidle")
    f.get_by_role("button",name="木鱼",exact=True).click()
    f.locator('[data-renderer="fallback"]').wait_for()
    f.get_by_role("button",name="轻敲木鱼").click()
    expect(f.get_by_role("progressbar")).to_have_attribute("aria-valuenow","1")
    fallback.close()
    # Loading / resizing while paused must paint a static frame, never a blank canvas.
    slow=browser.new_context(viewport={"width":390,"height":844})
    slow.add_init_script("""window.draws=0;const draw=WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements=function(...args){window.draws++;return draw.apply(this,args)};""")
    held=[]
    slow.route("**/woodfish/blender-v2/woodfish.glb",lambda route:held.append(route))
    q=slow.new_page();q.goto(base,wait_until="networkidle")
    q.get_by_role("button",name="木鱼",exact=True).click()
    q.get_by_role("button",name="暂停片刻").click()
    q.wait_for_timeout(200)
    before=q.evaluate("draws")
    assert held
    held[0].continue_()
    q.locator('[data-renderer="ready"]').wait_for()
    assert q.evaluate("draws")>before,"Paused load hid fallback before drawing model"
    before=q.evaluate("draws")
    q.set_viewport_size({"width":768,"height":900})
    q.wait_for_timeout(150)
    assert q.evaluate("draws")>before,"Paused resize cleared the canvas without repaint"
    before=q.evaluate("draws");q.wait_for_timeout(250)
    assert q.evaluate("draws")==before,"Paused scene must not continuously animate"
    slow.close()
    # Existing crane / lantern steps still settle their own rewards.
    for name,count in [("千纸鹤",4),("小灯笼",3)]:
        c=browser.new_context();q=c.new_page();q.goto(base,wait_until="networkidle")
        q.get_by_role("button",name=name,exact=True).click()
        for _ in range(count): q.get_by_role("button",name="完成当前步骤").click()
        q.get_by_role("button",name="完成仪式 · 收下小美好").click()
        expect(q.get_by_role("heading",name="今日仪式完成")).to_be_visible()
        c.close()
    print(json.dumps({"passed":True,"consoleErrors":errors,"checks":["touch/keyboard","sound toggle","pause","exit/reload resume","35-click burst","idempotent reward","visibility","320-1440px/DPR","context loss fallback","asset failure fallback","crane/lantern"]}))
    browser.close()
