"""Visual inspection against the local development server; requires Playwright."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
out = Path(__file__).resolve().parents[1] / "artifacts" / "woodfish"
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width":390,"height":844}, device_scale_factor=1.5)
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.on("console",lambda m:errors.append(m.text) if m.type=="error" else None)
    page.goto("http://localhost:5176/?inspectWoodfish=1",wait_until="networkidle")
    page.get_by_role("button",name="木鱼",exact=True).click()
    page.locator('[data-renderer="ready"]').wait_for()
    page.wait_for_timeout(600)
    page.screenshot(path=str(out/"front-page.png"),full_page=True)
    for view in ["front","left","right","back","top","bottom"]:
        page.get_by_label("模型视角").select_option(view)
        page.wait_for_timeout(150)
        page.locator(".woodfish-visual").screenshot(path=str(out/f"{view}.png"))
    print(json.dumps({"errors":errors,"screenshots":str(out)},ensure_ascii=True))
    browser.close()
