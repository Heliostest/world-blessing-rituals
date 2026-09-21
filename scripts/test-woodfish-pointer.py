"""Real mouse / CDP touch gestures, anime.js phases, pause and release regressions."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json, math

out=Path(__file__).resolve().parents[1]/"artifacts"/"woodfish"
with sync_playwright() as p:
    browser=p.chromium.launch(channel="msedge",headless=True)
    context=browser.new_context(viewport={"width":390,"height":844},has_touch=True)
    context.add_init_script("""window.soundCount=0;const create=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(...a){soundCount++;return create.apply(this,a)};""")
    page=context.new_page();errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.on("console",lambda m:errors.append(m.text) if m.type=="error" else None)
    page.goto("http://localhost:5176/?inspectWoodfish=1",wait_until="networkidle")
    page.get_by_role("button",name="木鱼",exact=True).click()
    try: page.locator('[data-renderer="ready"]').wait_for()
    except Exception:
        print(json.dumps({"errors":errors,"body":page.locator("body").inner_text()},ensure_ascii=True));raise
    stage=page.locator(".woodfish-object");canvas=page.locator(".woodfish-canvas")
    def pos():return json.loads(canvas.get_attribute("data-mallet"))
    def count(n):expect(page.get_by_role("progressbar")).to_have_attribute("aria-valuenow",str(n))
    stage.scroll_into_view_if_needed();box=stage.bounding_box()
    left={"x":box["x"]+box["width"]*.30,"y":box["y"]+box["height"]*.40}
    right={"x":box["x"]+box["width"]*.65,"y":box["y"]+box["height"]*.32}
    page.mouse.move(**left);page.wait_for_timeout(160);a=pos()
    page.mouse.move(**right);page.wait_for_timeout(160);b=pos()
    assert b[0]>a[0]+.25,(a,b)
    count(0)
    page.mouse.click(**right,button="right");count(0)
    page.mouse.click(**right);count(1)
    assert page.evaluate("soundCount")==0,"Audio must wait for contact"
    expect(canvas).to_have_attribute("data-phase","lift")
    page.screenshot(path=str(out/"anime-lift.png"))
    page.wait_for_function("soundCount === 1")
    page.screenshot(path=str(out/"anime-contact.png"))
    expect(canvas).to_have_attribute("data-phase","idle")
    # Real touch drag: no hit, no generated click; stationary after finger lifts.
    cdp=context.new_cdp_session(page)
    def touch(kind,points):cdp.send("Input.dispatchTouchEvent",{"type":kind,"touchPoints":points})
    touch("touchStart",[{**left,"id":1}])
    for i in range(1,9):
        touch("touchMove",[{"x":left["x"]+(right["x"]-left["x"])*i/8,"y":left["y"]+(right["y"]-left["y"])*i/8,"id":1}])
    page.wait_for_timeout(50);dragged=pos()
    touch("touchEnd",[]);page.wait_for_timeout(250)
    count(1);assert math.dist(dragged,pos())<.001
    # No hover movement for a finger which isn't touching the screen.
    stage.dispatch_event("pointermove",{"pointerId":99,"pointerType":"touch","isPrimary":True,"clientX":left["x"],"clientY":left["y"]})
    page.wait_for_timeout(100);assert math.dist(dragged,pos())<.001
    # Long press and cancelled touches never count as light taps.
    touch("touchStart",[{**left,"id":2}]);page.wait_for_timeout(450);touch("touchEnd",[]);count(1)
    touch("touchStart",[{**right,"id":3}]);touch("touchCancel",[]);count(1)
    touch("touchStart",[{**right,"id":4}]);page.wait_for_timeout(40);touch("touchEnd",[]);count(2)
    page.wait_for_function("soundCount === 2")
    expect(canvas).to_have_attribute("data-phase","idle")
    # Queue three strikes; pause before contact and freeze both motion and sound.
    stage.evaluate("b=>{b.click();b.click();b.click()}");count(5)
    page.get_by_role("button",name="暂停片刻").click()
    page.wait_for_timeout(70);frozen=pos();sounds=page.evaluate("soundCount")
    page.wait_for_timeout(600)
    assert math.dist(frozen,pos())<.001 and page.evaluate("soundCount")==sounds
    page.get_by_role("button",name="继续轻敲").click()
    page.wait_for_function("soundCount === 5")
    expect(canvas).to_have_attribute("data-phase","idle")
    # Native/background-style visibility pauses the queue without catch-up sound.
    stage.evaluate("b=>{b.click();b.click()}");count(7)
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(80);hidden=pos();sounds=page.evaluate("soundCount")
    page.wait_for_timeout(550)
    assert math.dist(hidden,pos())<.001 and page.evaluate("soundCount")==sounds
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_function("soundCount === 7")
    expect(canvas).to_have_attribute("data-phase","idle")
    assert not errors,errors
    print(json.dumps({"passed":True,"checks":["mouse hover","left/right click","impact sound timing","touch drag/release freeze","no touch hover","long press/cancel","light tap","queue pause/resume"],"consoleErrors":errors}))
    browser.close()
