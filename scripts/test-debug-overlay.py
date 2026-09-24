"""Verify live WebGL style selection, per-scene persistence and scene cleanup."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("WBR_URL", "http://127.0.0.1:5176/").rstrip("/")
OUT = Path(__file__).resolve().parents[1] / "artifacts" / "debug-overlay"
OUT.mkdir(parents=True, exist_ok=True)
CAPTURE_STYLE = ".debug-overlay { visibility: hidden !important; }"


def open_panel(page):
    toggle = page.get_by_role("button", name="SHADER LAB")
    if toggle.get_attribute("aria-expanded") == "false":
        toggle.click()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    # Keep content defaults deterministic while exercising local overrides.
    page.route("**/scene-content/woodfish.json", lambda route: route.abort())
    page.goto(BASE, wait_until="networkidle")
    page.get_by_role("button", name="木鱼", exact=True).click()
    page.locator(".woodfish-visual[data-renderer='ready']").wait_for()
    open_panel(page)
    expect(page.locator("#debug-scene")).to_have_value("woodfish")
    canvas = page.locator(".woodfish-canvas canvas")
    page.evaluate("window.debugTestCanvas = document.querySelector('.woodfish-canvas canvas')")
    original = canvas.screenshot(style=CAPTURE_STYLE)
    (OUT / "woodfish-original.png").write_bytes(original)
    page.get_by_role("button", name="墨线卡通").click()
    expect(page.locator("#debug-overlay-panel").get_by_role("status")).to_contain_text("正在使用墨线卡通")
    ink = canvas.screenshot(style=CAPTURE_STYLE)
    (OUT / "woodfish-ink.png").write_bytes(ink)
    assert ink != original, "Switching style did not change the canvas"
    page.get_by_role("button", name="柔和卡通").click()
    expect(page.locator("#debug-overlay-panel").get_by_role("status")).to_contain_text("正在使用柔和卡通")
    soft = canvas.screenshot(style=CAPTURE_STYLE)
    (OUT / "woodfish-soft.png").write_bytes(soft)
    assert soft != ink
    assert page.evaluate("window.debugTestCanvas === document.querySelector('.woodfish-canvas canvas')"), "Style switch remounted the canvas"
    page.screenshot(path=str(OUT / "woodfish-desktop.png"))
    count = page.locator(".ritual-counter").inner_text()
    page.get_by_role("button", name="轻敲木鱼").click()
    expect(page.locator(".ritual-counter")).not_to_have_text(count)
    page.get_by_role("button", name="返回", exact=True).click()
    expect(page.locator("#debug-scene")).to_have_count(0)
    page.get_by_role("button", name="木鱼", exact=True).click()
    page.locator(".woodfish-visual[data-renderer='ready']").wait_for()
    expect(page.get_by_role("button", name="柔和卡通")).to_have_attribute("aria-pressed", "true")
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(OUT / "woodfish-mobile.png"))
    box = page.locator("#debug-overlay-panel").bounding_box()
    assert box["x"] >= 0 and box["x"] + box["width"] <= 390
    page.get_by_role("button", name="SHADER LAB").click()
    expect(page.locator("#debug-overlay-panel")).to_have_count(0)

    for scene, label in [("celtic-folk-spring", "泉边一念"), ("theravada-water", "花水位一倾")]:
        page.goto(f"{BASE}/dev/scene/{scene}", wait_until="networkidle")
        open_panel(page)
        expect(page.locator("#debug-scene")).to_have_value(scene)
        expect(page.get_by_role("button", name="原始光照")).to_have_attribute("aria-pressed", "true")
        page.get_by_role("button", name="墨线卡通").click()
        expect(page.locator("#debug-overlay-panel").get_by_role("status")).to_contain_text("正在使用墨线卡通")
        page.reload(wait_until="networkidle")
        open_panel(page)
        expect(page.get_by_role("button", name="墨线卡通")).to_have_attribute("aria-pressed", "true")
        page.get_by_role("button", name="恢复内容默认").click()
        expect(page.locator("#debug-overlay-panel").get_by_role("status")).to_contain_text("跟随内容默认值")
        expect(page.get_by_role("button", name="原始光照")).to_have_attribute("aria-pressed", "true")
        page.get_by_role("link", name="退出", exact=True).click()
        expect(page.locator("#debug-scene")).to_have_count(0)

    page.goto(BASE, wait_until="networkidle")
    page.get_by_role("button", name="木鱼", exact=True).click()
    page.locator(".woodfish-visual[data-renderer='ready']").wait_for()
    open_panel(page)
    expect(page.get_by_role("button", name="柔和卡通")).to_have_attribute("aria-pressed", "true")
    page.get_by_role("button", name="恢复内容默认").click()
    expect(page.get_by_role("button", name="原始光照")).to_have_attribute("aria-pressed", "true")
    assert not errors, errors
    production = os.environ.get("WBR_PRODUCTION_URL")
    if production:
        prod = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        prod.add_init_script("localStorage.setItem('wbr.debug.scene-styles.v1', JSON.stringify({woodfish:'toon-ink'}))")
        prod_page = prod.new_page()
        prod_page.goto(production, wait_until="networkidle")
        expect(prod_page.get_by_role("button", name="SHADER LAB")).to_have_count(0)
        prod_page.get_by_role("button", name="木鱼", exact=True).click()
        prod_page.locator(".woodfish-visual[data-renderer='ready']").wait_for()
        normal = prod_page.locator(".woodfish-canvas canvas").screenshot(style=CAPTURE_STYLE)
        prod_page.goto(production.rstrip("/") + "/?debug=1", wait_until="networkidle")
        prod_page.get_by_role("button", name="木鱼", exact=True).click()
        prod_page.locator(".woodfish-visual[data-renderer='ready']").wait_for()
        debug = prod_page.locator(".woodfish-canvas canvas").screenshot(style=CAPTURE_STYLE)
        assert normal != debug, "Production debug flag did not gate the saved override"
        open_panel(prod_page)
        expect(prod_page.get_by_role("button", name="墨线卡通")).to_have_attribute("aria-pressed", "true")
        prod.close()
        print("PASS: production debug flag gates both overlay and stored overrides")
    browser.close()
    print("PASS: live shaders, interaction, per-scene persistence, reset, cleanup, mobile layout")
